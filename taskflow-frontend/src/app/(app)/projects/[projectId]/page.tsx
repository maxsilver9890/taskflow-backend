"use client";

import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { DashboardStats } from "@/components/analytics/DashboardStats";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProjectFormDialog } from "@/components/projects/ProjectFormDialog";
import { AssignDialog } from "@/components/tasks/AssignDialog";
import { KanbanBoard } from "@/components/tasks/KanbanBoard";
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { useDeleteProject, useProject, useProjectDashboard } from "@/hooks/use-projects";
import { useProjectTasks } from "@/hooks/use-tasks";
import type { Task, TaskStatus } from "@/lib/api/types";
import { errorMessage } from "@/lib/api/errors";
import { formatDueDate } from "@/lib/utils";

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();

  const project = useProject(projectId);
  const dashboard = useProjectDashboard(projectId);
  const tasksQuery = useProjectTasks(projectId);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [assigningTask, setAssigningTask] = useState<Task | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>("TODO");

  const deleteProject = useDeleteProject();

  function openAddTask(status: TaskStatus) {
    setEditingTask(null);
    setDefaultStatus(status);
    setTaskFormOpen(true);
  }
  function openEditTask(task: Task) {
    setEditingTask(task);
    setTaskFormOpen(true);
  }

  async function confirmDeleteProject() {
    try {
      await deleteProject.mutateAsync(projectId);
      toast.success("Project deleted");
      router.replace("/projects");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  if (project.isError) {
    return (
      <div>
        <PageHeader title="Project" />
        <div className="p-4 md:p-6">
          <ErrorState error={project.error} onRetry={project.refetch} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={
          <>
            <Link href="/projects" className="flex size-6 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink">
              <ArrowLeft className="size-4" />
            </Link>
            {project.isLoading ? <Skeleton className="h-6 w-48" /> : project.data?.name}
          </>
        }
        description={project.data ? `Created ${formatDueDate(project.data.createdAt)}` : undefined}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="size-3.5" /> Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="size-3.5" />
            </Button>
            <Button size="sm" onClick={() => openAddTask("TODO")}>
              <Plus className="size-4" /> New task
            </Button>
          </>
        }
      />

      <div className="space-y-5 p-4 md:p-6">
        {project.data?.description && <p className="max-w-2xl text-[13.5px] text-ink-2">{project.data.description}</p>}

        {dashboard.isLoading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : dashboard.data ? (
          <DashboardStats dashboard={dashboard.data} />
        ) : null}

        {tasksQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : tasksQuery.isError ? (
          <ErrorState error={tasksQuery.error} onRetry={tasksQuery.refetch} />
        ) : (
          <>
            <KanbanBoard
              tasks={tasksQuery.data?.tasks ?? []}
              onAddTask={openAddTask}
              onEdit={openEditTask}
              onAssign={setAssigningTask}
            />
            {tasksQuery.data?.truncated && (
              <p className="text-center text-[12px] text-ink-3">
                Showing the first 500 tasks. Use the All tasks page with filters to see the rest.
              </p>
            )}
          </>
        )}
      </div>

      {project.data && <ProjectFormDialog open={editOpen} onOpenChange={setEditOpen} project={project.data} />}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete project?"
        description={`This permanently deletes “${project.data?.name}” and all of its tasks. This cannot be undone.`}
        confirmLabel="Delete project"
        destructive
        loading={deleteProject.isPending}
        onConfirm={confirmDeleteProject}
      />

      <TaskFormDialog
        open={taskFormOpen}
        onOpenChange={setTaskFormOpen}
        task={editingTask}
        defaultProjectId={projectId}
        defaultStatus={editingTask ? undefined : defaultStatus}
      />

      {assigningTask && (
        <AssignDialog open={!!assigningTask} onOpenChange={(open) => !open && setAssigningTask(null)} task={assigningTask} />
      )}
    </div>
  );
}
