import type { OrgMemberRole, PrismaClient } from "@prisma/client";

// ─── User queries ──────────────────────────────────────────────────────────────

export async function findUserByEmail(db: PrismaClient, email: string) {
  return db.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true
    }
  });
}



/**
 * Atomically create a user, a new organisation, and the org_admin membership
 * record in a single transaction. The registrant always becomes the org admin —
 * role is never client-supplied.
 *
 * Returns the created user and org so the service can issue tokens immediately.
 */
export async function createUserWithOrg(
  db: PrismaClient,
  data: {
    email: string;
    name: string;
    passwordHash: string;
    organizationName: string;
  }
) {
  return db.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: { name: data.organizationName },
      select: { id: true, name: true }
    });

    const user = await tx.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash: data.passwordHash
      },
      select: { id: true, email: true, name: true, createdAt: true }
    });

    await tx.orgMember.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: "ORG_ADMIN"
      }
    });

    return { user, org };
  });
}

// ─── Organisation membership queries ──────────────────────────────────────────

/**
 * Resolve the caller's membership for a specific organisation.
 * Returns null when the user is not a member — callers treat this as 403.
 */
export async function findOrgMembership(
  db: PrismaClient,
  userId: string,
  organizationId: string
) {
  return db.orgMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { role: true, organizationId: true }
  });
}

// ─── Refresh token queries ─────────────────────────────────────────────────────

export async function createRefreshToken(
  db: PrismaClient,
  data: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }
) {
  return db.refreshToken.create({ data });
}

/**
 * Lookup a refresh token by its SHA-256 hash.
 * Returns null when the hash is not found (i.e. token was never issued).
 */
export async function findRefreshTokenByHash(db: PrismaClient, tokenHash: string) {
  return db.refreshToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      revokedAt: true
    }
  });
}

/**
 * Revoke a single refresh token by its DB id.
 * Used by /auth/logout and during token rotation.
 */
export async function revokeRefreshToken(db: PrismaClient, id: string) {
  return db.refreshToken.update({
    where: { id },
    data: { revokedAt: new Date() }
  });
}

/**
 * Revoke ALL active refresh tokens for a user.
 * Used by the bonus logout-all-devices flow.
 */
export async function revokeAllUserRefreshTokens(db: PrismaClient, userId: string) {
  return db.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}
