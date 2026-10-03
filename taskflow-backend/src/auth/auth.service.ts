import crypto from "node:crypto";

import bcrypt from "bcrypt";
import type { PrismaClient } from "@prisma/client";

import { env } from "../config/env.js";
import { AuthErrors } from "../lib/errors.js";
import {
  hashToken,
  refreshTokenExpiresAt,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} from "../lib/jwt.js";
import type { LoginBody, LogoutBody, RefreshBody, RegisterBody } from "./auth.schemas.js";
import {
  createRefreshToken,
  createUserWithOrg,
  findRefreshTokenByHash,
  findUserByEmail,
  revokeAllUserRefreshTokens,
  revokeRefreshToken
} from "./auth.data.js";

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Issue a fresh access + refresh token pair and persist the refresh token.
 * Centralised so both /register and /refresh go through identical logic.
 */
async function issueTokenPair(
  db: PrismaClient,
  userId: string,
  orgId: string,
  role: string
) {
  const jti = crypto.randomUUID();
  const rawRefreshToken = signRefreshToken({ sub: userId, jti });
  const tokenHash = hashToken(rawRefreshToken);
  const expiresAt = refreshTokenExpiresAt();

  await createRefreshToken(db, { id: jti, userId, tokenHash, expiresAt });

  const accessToken = signAccessToken({ sub: userId, orgId, role });

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    tokenType: "Bearer" as const,
    expiresIn: env.jwtAccessTtlSeconds
  };
}

// ─── Service operations ────────────────────────────────────────────────────────

/**
 * Register a new user account.
 *
 * Each registration creates a brand-new organisation and makes the registrant
 * its ORG_ADMIN. The client never supplies an organizationId or role — both are
 * determined entirely server-side to prevent privilege escalation.
 *
 * Transaction order: organisation → user → org_member (ORG_ADMIN role)
 * All three writes are atomic; a failure at any step rolls everything back.
 */
export async function register(db: PrismaClient, body: RegisterBody) {
  // 1. Reject duplicate emails before doing any hashing work.
  const existing = await findUserByEmail(db, body.email);

  if (existing) {
    throw AuthErrors.EMAIL_IN_USE();
  }

  // 2. Hash the password with bcrypt (cost factor floored at 12 per spec).
  const rounds = Math.max(env.bcryptRounds, 12);
  const passwordHash = await bcrypt.hash(body.password, rounds);

  // 3. Atomically create: org → user → org_member(ORG_ADMIN).
  const { user, org } = await createUserWithOrg(db, {
    email: body.email,
    name: body.name,
    passwordHash,
    organizationName: body.organizationName
  });

  // 4. Issue tokens — registrant is immediately logged in as org admin.
  const tokens = await issueTokenPair(db, user.id, org.id, "ORG_ADMIN");

  return {
    user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
    organization: { id: org.id, name: org.name },
    ...tokens
  };
}

/**
 * Validate credentials and return a token pair for the user's organisation.
 *
 * Multi-org memberships: This implementation selects the first (oldest) org
 * membership to keep the login flow simple. If a user belongs to multiple orgs,
 * a future endpoint (e.g. POST /auth/select-org) should let them switch context.
 */
export async function login(db: PrismaClient, body: LoginBody) {
  // 1. Look up user by email.
  const user = await findUserByEmail(db, body.email);

  /**
   * Always run bcrypt.compare even when user is null to avoid a timing-based
   * user enumeration attack. The dummy hash will always fail comparison.
   */
  const dummyHash = "$2b$12$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  const candidateHash = user?.passwordHash ?? dummyHash;
  const passwordMatch = await bcrypt.compare(body.password, candidateHash);

  if (!user || !passwordMatch) {
    throw AuthErrors.INVALID_CREDENTIALS();
  }

  // 2. Resolve the user's primary organisation membership.
  const membership = await db.orgMember.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true, role: true }
  });

  if (!membership) {
    // User exists but has no org — should not happen given registration logic.
    throw AuthErrors.FORBIDDEN();
  }

  // 3. Issue token pair.
  const tokens = await issueTokenPair(db, user.id, membership.organizationId, membership.role);

  return {
    user: { id: user.id, email: user.email, name: user.name },
    ...tokens
  };
}

/**
 * Rotate a refresh token: verify, revoke the old one, issue a fresh pair.
 * Rotation ensures a stolen token can only be used once before it is invalidated.
 */
export async function refresh(db: PrismaClient, body: RefreshBody) {
  // 1. Verify JWT signature + expiry (claims aren't needed — step 6 re-derives
  // membership from the DB record for the new token, same pattern as logout()).
  try {
    verifyRefreshToken(body.refreshToken);
  } catch {
    throw AuthErrors.TOKEN_INVALID();
  }

  // 2. Look up stored record by hash.
  const tokenHash = hashToken(body.refreshToken);
  const stored = await findRefreshTokenByHash(db, tokenHash);

  if (!stored) {
    throw AuthErrors.TOKEN_INVALID();
  }

  // 3. Check revocation.
  if (stored.revokedAt !== null) {
    /**
     * A revoked token being replayed could indicate token theft.
     * Revoke all of this user's tokens as a safety measure (TOFU principle).
     */
    await revokeAllUserRefreshTokens(db, stored.userId);
    throw AuthErrors.TOKEN_REVOKED();
  }

  // 4. Check DB-level expiry (belt-and-suspenders alongside JWT exp claim).
  if (stored.expiresAt < new Date()) {
    throw AuthErrors.TOKEN_EXPIRED();
  }

  // 5. Revoke old token before issuing the new pair.
  await revokeRefreshToken(db, stored.id);

  // 6. Resolve membership for new access token claims.
  const membership = await db.orgMember.findFirst({
    where: { userId: stored.userId },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true, role: true }
  });

  if (!membership) {
    throw AuthErrors.FORBIDDEN();
  }

  const tokens = await issueTokenPair(db, stored.userId, membership.organizationId, membership.role);

  return tokens;
}

/**
 * Logout: revoke the supplied refresh token.
 * The access token will expire naturally (15 min TTL); no server-side blocklist needed.
 */
export async function logout(db: PrismaClient, body: LogoutBody) {
  // Verify the JWT structure first (avoids DB lookup on garbage input).
  try {
    verifyRefreshToken(body.refreshToken);
  } catch {
    // Already invalid — treat as a successful logout (idempotent).
    return;
  }

  const tokenHash = hashToken(body.refreshToken);
  const stored = await findRefreshTokenByHash(db, tokenHash);

  if (!stored || stored.revokedAt !== null) {
    // Already revoked or unknown — idempotent logout is fine.
    return;
  }

  await revokeRefreshToken(db, stored.id);
}
