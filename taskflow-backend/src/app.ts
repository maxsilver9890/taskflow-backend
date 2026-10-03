import cors from "cors";
import express from "express";
import helmet from "helmet";
import type IORedis from "ioredis";
import { createDocsRouter } from "./docs/docs.routes.js";

import { createAuthRouter } from "./auth/auth.routes.js";
import { createEmailDlq, createEmailQueue } from "./jobs/queue.js";
import { createJobRouter } from "./jobs/job.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { createProjectRouter } from "./projects/project.routes.js";
import { createHealthRouter } from "./routes/health.js";
import { setEmailQueue } from "./tasks/task.controller.js";
import { createTaskRouter } from "./tasks/task.routes.js";

export function createApp(redisConnection: IORedis) {
  const app = express();

  // Trust the first proxy hop so express-rate-limit reads the real client IP
  // when deployed behind nginx / ALB / Cloudflare. Remove in development if
  // running locally without a proxy.
  app.set("trust proxy", 1);
  
  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  // ── Background-job queues ─────────────────────────────────────────────────
  const emailQueue = createEmailQueue(redisConnection);
  // Explicit dead-letter queue — the worker forwards exhausted jobs here.
  // The API only reads from it (not currently exposed via REST), but the Queue
  // instance is passed to the job router so job.service.ts can inspect it if
  // needed in future iterations.
  const emailDlq = createEmailDlq(redisConnection);

  // Wire the main queue into the task controller so assignUser can enqueue.
  setEmailQueue(emailQueue);

  // ── Routes ──────────────────────────────────────────────────────────────────
  app.use(createHealthRouter(redisConnection));
  app.use("/auth", createAuthRouter());
  app.use("/projects", createProjectRouter());
  app.use("/tasks", createTaskRouter());
  app.use("/jobs", createJobRouter(emailQueue, emailDlq));
  app.use("/api-docs", createDocsRouter());

  // ── Error handling (must be last) ───────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
