"use client";

import { AlertCircle, Bell, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { JobRow } from "@/components/notifications/JobRow";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { useAuth } from "@/lib/auth/AuthProvider";
import { config } from "@/lib/config";
import { clearJobLog, useJobLog } from "@/lib/job-log";

export default function NotificationsPage() {
  const { user } = useAuth();
  const entries = useJobLog(user?.id ?? "");

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Background email jobs queued when a task gets assigned."
        actions={
          entries.length > 0 && user ? (
            <Button variant="ghost" size="sm" onClick={() => clearJobLog(user.id)}>
              <Trash2 className="size-3.5" /> Clear
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-4 p-4 md:p-6">
        {!config.workerDeployed && (
          <div className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-2 px-4 py-3 text-[13px] text-ink-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-ink-3" />
            <p>
              The BullMQ worker that sends these emails only runs locally via Docker Compose — Render&apos;s free tier
              doesn&apos;t support background workers. On the public demo, jobs will stay in <strong>pending</strong>{" "}
              rather than moving to completed.
            </p>
          </div>
        )}

        {entries.length === 0 ? (
          <EmptyState
            icon={<Bell className="size-5" />}
            title="No notifications yet"
            description="Assign someone to a task to queue a notification job — it'll show up here, tracked by this browser."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            {entries.map((entry) => (
              <JobRow key={entry.jobId} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
