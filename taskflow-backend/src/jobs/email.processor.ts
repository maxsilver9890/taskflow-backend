/**
 * BullMQ email job processor.
 *
 * Imported by the worker process (worker/worker.ts).  Never imported by the
 * API server — processor logic stays separate from request handling.
 *
 * ── Retry & DLQ flow ─────────────────────────────────────────────────────────
 *
 *   1. Job enters taskflow:email queue.
 *   2. Worker picks it up and calls emailProvider.send().
 *   3. On failure BullMQ re-queues with exponential back-off (1 s → 2 s → 4 s).
 *   4. After attempt 3 fails:
 *        a. BullMQ marks the job "failed" in the main queue's sorted set.
 *           The original job is RETAINED (removeOnFail: false) so it remains
 *           queryable at GET /jobs/:id with status "failed".
 *        b. The worker's "failed" event handler detects exhaustion
 *           (attemptsMade >= attempts) and adds a DLQ entry to the explicit
 *           taskflow:email:dlq queue with full failure context.
 *        c. The DLQ entry never expires and is never retried automatically.
 *
 * This two-pronged approach means:
 *   • The original job ID returned at assignment time always resolves via
 *     GET /jobs/:id (the main queue retains it).
 *   • Operators get a clean, explicit DLQ queue that is independent of the
 *     main queue's internal failed sorted set and can be inspected or bulk-
 *     replayed without touching the main queue.
 */

import { Worker } from "bullmq";
import type { Queue } from "bullmq";
import type IORedis from "ioredis";

import type { EmailProvider } from "../lib/email.js";
import type { DlqEntry, EmailJobPayload } from "./queue.js";
import { EMAIL_QUEUE_NAME } from "./queue.js";

export function createEmailWorker(
  connection: IORedis,
  emailProvider: EmailProvider,
  dlq: Queue<DlqEntry>,
  logger: {
    info: (obj: Record<string, unknown>, msg: string) => void;
    warn: (obj: Record<string, unknown>, msg: string) => void;
    error: (obj: Record<string, unknown>, msg: string) => void;
  }
): Worker<EmailJobPayload> {
  const worker = new Worker<EmailJobPayload>(
    EMAIL_QUEUE_NAME,
    async (job) => {
      logger.info(
        { jobId: job.id, jobType: job.data.type, attempt: job.attemptsMade + 1 },
        "Processing email job"
      );

      const { type, data } = job.data;

      switch (type) {
        case "task_assigned": {
          await emailProvider.send({
            to: data.assigneeEmail,
            subject: `You've been assigned to: ${data.taskTitle}`,
            text: [
              `Hi ${data.assigneeName},`,
              ``,
              `You have been assigned to the following task:`,
              ``,
              `  Task:    ${data.taskTitle}`,
              `  Project: ${data.projectName}`,
              ``,
              `Log in to TaskFlow to view the full details.`,
              ``,
              `— The TaskFlow team`
            ].join("\n")
          });

          logger.info(
            {
              jobId: job.id,
              taskId: data.taskId,
              assigneeId: data.assigneeId,
              to: data.assigneeEmail
            },
            "Task-assigned email delivered"
          );
          break;
        }

        default: {
          // Guard against unknown job types — log and discard rather than crash.
          logger.warn(
            { jobId: job.id, jobType: type },
            "Unknown email job type — skipping"
          );
        }
      }
    },
    {
      connection,
      concurrency: 5
    }
  );

  worker.on("completed", (job) => {
    logger.info(
      { jobId: job.id, jobType: job.data.type },
      "Email job completed"
    );
  });

  /**
   * "failed" fires on every failed attempt, including intermediate ones that
   * will be retried.  We only forward to the DLQ when all attempts are
   * exhausted (attemptsMade === configured attempts).
   *
   * After forwarding, the original job stays in the main queue's "failed"
   * sorted set (removeOnFail: false) so GET /jobs/:id continues to resolve it.
   */
  worker.on("failed", (job, err) => {
    if (!job) return;

    const maxAttempts = job.opts.attempts ?? 3;
    const exhausted = job.attemptsMade >= maxAttempts;

    if (!exhausted) {
      logger.error(
        {
          jobId: job.id,
          jobType: job.data.type,
          attempt: job.attemptsMade,
          maxAttempts,
          err
        },
        "Email job attempt failed — will retry"
      );
      return;
    }

    // ── All retries exhausted: forward to explicit DLQ ─────────────────────
    logger.error(
      {
        jobId: job.id,
        jobType: job.data.type,
        attemptsMade: job.attemptsMade,
        err
      },
      "Email job exhausted all retries — forwarding to DLQ"
    );

    const dlqEntry: DlqEntry = {
      originalJobId: job.id,
      enqueuedAt: new Date().toISOString(),
      failedReason: err instanceof Error ? err.message : String(err),
      attemptsMade: job.attemptsMade,
      payload: job.data
    };

    // Fire-and-forget: DLQ enqueue failure must not crash the worker event
    // loop.  Log the error and move on.
    dlq.add("dlq:task_assigned", dlqEntry).catch((dlqErr: unknown) => {
      logger.error(
        { originalJobId: job.id, dlqErr },
        "Failed to forward exhausted job to DLQ — manual intervention required"
      );
    });
  });

  return worker;
}
