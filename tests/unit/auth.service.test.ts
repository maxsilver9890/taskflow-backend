/**
 * Unit tests for auth service helpers.
 *
 * These tests do NOT require a live database — all Prisma calls are replaced
 * with vi.fn() stubs so the suite runs in isolation.
 *
 * Run with: npx vitest run tests/unit/auth.service.test.ts
 * (Requires vitest to be installed: npm install -D vitest)
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import bcrypt from "bcrypt";

import { AppError } from "../../src/lib/errors.js";
import { hashToken, signRefreshToken } from "../../src/lib/jwt.js";
import { login, register, refresh, logout } from "../../src/auth/auth.service.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build the minimal Prisma mock shape needed by auth.service. */
function makePrismaMock() {
  return {
    user: {
      create: vi.fn(),
      findUnique: vi.fn()
    },
    orgMember: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn()
    },
    organization: {
      findUnique: vi.fn()
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    $transaction: vi.fn()
  } as unknown as import("@prisma/client").PrismaClient;
}

// ─── register ─────────────────────────────────────────────────────────────────

describe("auth.service — register", () => {
  let db: ReturnType<typeof makePrismaMock>;

  const orgId = "00000000-0000-0000-0000-000000000001";
  const userId = "00000000-0000-0000-0000-000000000002";

  beforeEach(() => {
    db = makePrismaMock();
  });

  it("throws EMAIL_IN_USE when a user with that email already exists", async () => {
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "user-1",
      email: "a@example.com"
    });

    await expect(
      register(db, {
        email: "a@example.com",
        name: "Alice",
        password: "password123",
        organizationName: "Acme"
      })
    ).rejects.toMatchObject({ code: "EMAIL_IN_USE" });
  });

  it("creates org + user + ORG_ADMIN membership atomically and hashes the password", async () => {
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    let capturedHash = "";
    let capturedRole = "";

    (db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn: Function) => {
      const tx = {
        organization: {
          create: vi.fn().mockResolvedValue({ id: orgId, name: "Acme" })
        },
        user: {
          create: vi.fn().mockImplementation(({ data }: any) => {
            capturedHash = data.passwordHash;
            return Promise.resolve({ id: userId, email: data.email, name: data.name, createdAt: new Date() });
          })
        },
        orgMember: {
          create: vi.fn().mockImplementation(({ data }: any) => {
            capturedRole = data.role;
            return Promise.resolve({});
          })
        }
      };
      return fn(tx);
    });

    (db.refreshToken.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await register(db, {
      email: "alice@example.com",
      name: "Alice",
      password: "plaintextpassword",
      organizationName: "Acme"
    });

    // Password must be hashed
    expect(capturedHash).not.toBe("plaintextpassword");
    const matches = await bcrypt.compare("plaintextpassword", capturedHash);
    expect(matches).toBe(true);

    // Role must be ORG_ADMIN — never MEMBER
    expect(capturedRole).toBe("ORG_ADMIN");

    // Response includes org info
    expect(result.organization).toMatchObject({ id: orgId, name: "Acme" });
    expect(result.tokenType).toBe("Bearer");
  });

  it("does not expose organizationId or role in the request shape", () => {
    // Compile-time guard: RegisterBody must not contain these fields.
    // If this type assertion compiles, the schema is correct.
    type HasNoOrgId = "organizationId" extends keyof import("../../src/auth/auth.schemas.js").RegisterBody ? true : false;
    type HasNoRole  = "role"           extends keyof import("../../src/auth/auth.schemas.js").RegisterBody ? true : false;
    const _orgId: HasNoOrgId = false;
    const _role:  HasNoRole  = false;
    expect(_orgId).toBe(false);
    expect(_role).toBe(false);
  });
});

// ─── login ────────────────────────────────────────────────────────────────────

describe("auth.service — login", () => {
  let db: ReturnType<typeof makePrismaMock>;

  beforeEach(() => {
    db = makePrismaMock();
  });

  it("throws INVALID_CREDENTIALS when the user is not found", async () => {
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      login(db, { email: "ghost@example.com", password: "password" })
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("throws INVALID_CREDENTIALS when the password is wrong", async () => {
    const hash = await bcrypt.hash("correctpassword", 4);

    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "user-1",
      email: "alice@example.com",
      name: "Alice",
      passwordHash: hash
    });

    await expect(
      login(db, { email: "alice@example.com", password: "wrongpassword" })
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("returns tokens on valid credentials", async () => {
    const hash = await bcrypt.hash("correct", 4);
    const userId = "00000000-0000-0000-0000-000000000001";
    const orgId = "00000000-0000-0000-0000-000000000002";

    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: userId,
      email: "alice@example.com",
      name: "Alice",
      passwordHash: hash
    });
    (db.orgMember.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      organizationId: orgId,
      role: "MEMBER"
    });
    (db.refreshToken.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await login(db, { email: "alice@example.com", password: "correct" });

    expect(result).toHaveProperty("accessToken");
    expect(result).toHaveProperty("refreshToken");
    expect(result.tokenType).toBe("Bearer");
  });
});

// ─── refresh ──────────────────────────────────────────────────────────────────

describe("auth.service — refresh", () => {
  let db: ReturnType<typeof makePrismaMock>;

  beforeEach(() => {
    db = makePrismaMock();
  });

  it("throws TOKEN_REVOKED and revokes all tokens when replaying a revoked token", async () => {
    const userId = "00000000-0000-0000-0000-000000000001";
    const rawToken = signRefreshToken({ sub: userId, jti: "some-jti" });
    const tokenHash = hashToken(rawToken);

    (db.refreshToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "some-jti",
      userId,
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: new Date() // already revoked!
    });
    (db.refreshToken.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

    await expect(
      refresh(db, { refreshToken: rawToken })
    ).rejects.toMatchObject({ code: "TOKEN_REVOKED" });

    expect(db.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId }) })
    );
  });

  it("throws TOKEN_INVALID when an unrecognised token is supplied", async () => {
    (db.refreshToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const rawToken = signRefreshToken({ sub: "user-1", jti: "unknown-jti" });

    await expect(
      refresh(db, { refreshToken: rawToken })
    ).rejects.toMatchObject({ code: "TOKEN_INVALID" });
  });
});

// ─── Task assignment validation placeholder ────────────────────────────────────

describe("auth.service — logout", () => {
  let db: ReturnType<typeof makePrismaMock>;

  beforeEach(() => {
    db = makePrismaMock();
  });

  it("is idempotent when token is already revoked", async () => {
    const rawToken = signRefreshToken({ sub: "user-1", jti: "jti-1" });

    (db.refreshToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "jti-1",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: new Date() // already revoked
    });

    // Should not throw
    await expect(logout(db, { refreshToken: rawToken })).resolves.toBeUndefined();
    expect(db.refreshToken.update).not.toHaveBeenCalled();
  });
});
