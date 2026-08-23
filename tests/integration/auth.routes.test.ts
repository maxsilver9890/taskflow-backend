import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

import { prisma } from "../../src/config/prisma.js";
import { createApp } from "../../src/app.js";

function makeRedisStub() {
  return {
    status: "ready",
    ping: async () => "PONG",
    quit: async () => {}
  } as unknown as import("ioredis").default;
}

async function resetTestDatabase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "comments",
      "task_assignments",
      "tasks",
      "projects",
      "refresh_tokens",
      "org_members",
      "organizations",
      "users"
    CASCADE;
  `);
}

describe("Authentication integration tests", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    await resetTestDatabase();
    app = createApp(makeRedisStub());
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("POST /auth/register", () => {
    it("returns 422 when body is missing required fields", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({});

      expect(res.status).toBe(422);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("returns 422 when email format is invalid", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({
          email: "not-an-email",
          name: "Test User",
          password: "password123",
          organizationName: "Acme Corp"
        });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("returns 422 when organizationName is missing", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({
          email: "test@example.com",
          name: "Test User",
          password: "password123"
        });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("returns 201 with accessToken, refreshToken, user, and organization on valid input", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({
          email: "valid.register@example.com",
          name: "Valid Register User",
          password: "Password123!",
          organizationName: "Valid Register Organization"
        });

      expect(res.status).toBe(201);

      expect(res.body).toEqual(
        expect.objectContaining({
          user: expect.objectContaining({
            id: expect.any(String),
            email: "valid.register@example.com",
            name: "Valid Register User"
          }),
          organization: expect.objectContaining({
            id: expect.any(String),
            name: "Valid Register Organization"
          }),
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          tokenType: "Bearer",
          expiresIn: 900
        })
      );
    });

    it("returns 409 EMAIL_IN_USE when the same email is registered twice", async () => {
      const body = {
        email: "duplicate@example.com",
        name: "Duplicate User",
        password: "Password123!",
        organizationName: "Duplicate Organization"
      };

      const first = await request(app)
        .post("/auth/register")
        .send(body);

      expect(first.status).toBe(201);

      const second = await request(app)
        .post("/auth/register")
        .send(body);

      expect(second.status).toBe(409);
      expect(second.body.code).toBe("EMAIL_IN_USE");
    });
  });

  describe("POST /auth/login", () => {
    it("returns 401 for unknown credentials", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({
          email: "nobody@example.com",
          password: "doesnotmatter"
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("INVALID_CREDENTIALS");
    });

    it("returns 422 when body is missing", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({});

      expect(res.status).toBe(422);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("returns 200 with access and refresh tokens for valid credentials", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({
          email: "login@example.com",
          name: "Login User",
          password: "Password123!",
          organizationName: "Login Organization"
        });

      expect(res.status).toBe(201);

      const login = await request(app)
        .post("/auth/login")
        .send({
          email: "login@example.com",
          password: "Password123!"
        });

      expect(login.status).toBe(200);

      expect(login.body).toEqual(
        expect.objectContaining({
          user: expect.objectContaining({
            email: "login@example.com"
          }),
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          tokenType: "Bearer",
          expiresIn: 900
        })
      );
    });
  });

  describe("POST /auth/refresh", () => {
    it("returns 401 when refresh token is invalid JWT", async () => {
      const res = await request(app)
        .post("/auth/refresh")
        .send({
          refreshToken: "not.a.jwt"
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("TOKEN_INVALID");
    });
  });

  describe("Cross-tenant access prevention", () => {
    it("returns 403 when accessing another org's project with a valid token", async () => {
      // Create organization A and its user.
      const orgA = await request(app)
        .post("/auth/register")
        .send({
          email: "tenant-a@example.com",
          name: "Tenant A User",
          password: "Password123!",
          organizationName: "Tenant A Organization"
        });

      expect(orgA.status).toBe(201);

      // Create organization B and its user.
      const orgB = await request(app)
        .post("/auth/register")
        .send({
          email: "tenant-b@example.com",
          name: "Tenant B User",
          password: "Password123!",
          organizationName: "Tenant B Organization"
        });

      expect(orgB.status).toBe(201);

      const tenantAToken = orgA.body.accessToken as string;
      const tenantBToken = orgB.body.accessToken as string;

      // Create a project as Tenant A.
      const project = await request(app)
        .post("/projects")
        .set("Authorization", `Bearer ${tenantAToken}`)
        .send({
          name: "Tenant A Private Project",
          description: "Should not be visible to Tenant B"
        });

      expect(project.status).toBe(201);

      const projectId = project.body.id as string;

      // Tenant B attempts to access Tenant A's project.
      const forbidden = await request(app)
        .get(`/projects/${projectId}`)
        .set("Authorization", `Bearer ${tenantBToken}`);

      expect(forbidden.status).toBe(403);
      expect(forbidden.body.code).toBe("FORBIDDEN");

      // Ensure no Tenant A project data is exposed.
      expect(forbidden.body).not.toHaveProperty(
        "id",
        projectId
      );
      expect(forbidden.body).not.toHaveProperty(
        "name",
        "Tenant A Private Project"
      );
    });
  });
});