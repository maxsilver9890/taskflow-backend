"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { FieldError, Input, Label, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ApiError, errorMessage } from "@/lib/api/errors";
import type { Task, TaskPriority, TaskStatus, TaskWithProject } from "@/lib/api/types";
import { useAllProjects } from "@/hooks/use-projects";
import { useCreateTask, useUpdateTask } from "@/hooks/use-tasks";
import { dateInputToIso, isoToDateInput } from "@/lib/utils";

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  defaultProjectId,
  defaultStatus,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | TaskWithProject | null;
  defaultProjectId?: string;
  defaultStatus?: TaskStatus;
  onSaved?: (task: Task) => void;
}) {
  const isEdit = !!task;
  const { data: projects, isLoading: projectsLoading } = useAllProjects();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState<TaskStatus>("TODO");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const create = useCreateTask();
  const update = useUpdateTask();
  const pending = create.isPending || update.isPending;

  // Re-sync local form state from the task/defaults each time the dialog opens.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setProjectId(task?.projectId ?? defaultProjectId ?? "");
    setStatus(task?.status ?? defaultStatus ?? "TODO");
    setPriority(task?.priority ?? "MEDIUM");
    setDueDate(task ? isoToDateInput(task.dueDate) : "");
    setFieldErrors({});
  }, [open, task, defaultProjectId, defaultStatus]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function submit() {
    setFieldErrors({});
    const trimmedDescription = description.trim();
    try {
      if (isEdit && task) {
        const saved = await update.mutateAsync({
          id: task.id,
          input: {
            title: title.trim(),
            description: trimmedDescription === "" ? null : trimmedDescription,
            projectId,
            status,
            priority,
            dueDate: dueDate ? dateInputToIso(dueDate) : null,
          },
        });
        toast.success("Task updated");
        onSaved?.(saved as Task);
      } else {
        const saved = await create.mutateAsync({
          title: title.trim(),
          projectId,
          status,
          priority,
          ...(trimmedDescription && { description: trimmedDescription }),
          ...(dueDate && { dueDate: dateInputToIso(dueDate) }),
        });
        toast.success("Task created");
        onSaved?.(saved as Task);
      }
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length > 0) {
        setFieldErrors(err.fieldErrors);
      } else {
        toast.error(errorMessage(err));
      }
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit task" : "New task"}
      size="lg"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} loading={pending} disabled={!title.trim() || !projectId}>
            {isEdit ? "Save changes" : "Create task"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="task-title">Title</Label>
          <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} autoFocus />
          <FieldError>{fieldErrors.title?.[0]}</FieldError>
        </div>
        <div>
          <Label htmlFor="task-description">Description</Label>
          <Textarea
            id="task-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={10000}
          />
          <FieldError>{fieldErrors.description?.[0]}</FieldError>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label htmlFor="task-project">Project</Label>
            <Select
              id="task-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={projectsLoading || !!defaultProjectId}
            >
              <option value="" disabled>
                Select a project…
              </option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <FieldError>{fieldErrors.projectId?.[0]}</FieldError>
          </div>
          <div>
            <Label htmlFor="task-status">Status</Label>
            <Select id="task-status" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              <option value="TODO">To do</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="REVIEW">Review</option>
              <option value="DONE">Done</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="task-priority">Priority</Label>
            <Select id="task-priority" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </Select>
          </div>
          <div className="col-span-2">
            <Label htmlFor="task-due">Due date</Label>
            <Input id="task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <FieldError>{fieldErrors.dueDate?.[0]}</FieldError>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
