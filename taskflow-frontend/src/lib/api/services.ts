import { api } from "./client";
import type {
  AssignmentResult,
  CreateProjectInput,
  CreateTaskInput,
  JobInfo,
  LoginInput,
  LoginResponse,
  Paginated,
  Project,
  ProjectDashboard,
  RegisterInput,
  RegisterResponse,
  Task,
  TaskBase,
  TaskListParams,
  TaskWithProject,
  UpdateProjectInput,
  UpdateTaskInput,
} from "./types";

// ── Auth (public endpoints) ──────────────────────────────────────────────────

export const authApi = {
  login: (input: LoginInput) =>
    api<LoginResponse>("/auth/login", { method: "POST", body: input, anonymous: true }),
  register: (input: RegisterInput) =>
    api<RegisterResponse>("/auth/register", { method: "POST", body: input, anonymous: true }),
  logout: (refreshToken: string) =>
    api<{ message: string }>("/auth/logout", { method: "POST", body: { refreshToken }, anonymous: true }),
};

// ── Health ───────────────────────────────────────────────────────────────────

export const healthApi = {
  check: () => api<{ status: "ok" | "unavailable" }>("/health", { anonymous: true }),
};

// ── Projects ─────────────────────────────────────────────────────────────────

export const projectsApi = {
  list: (page = 1, limit = 20) =>
    api<Paginated<Project>>("/projects", { query: { page, limit } }),
  get: (id: string) => api<Project>(`/projects/${id}`),
  create: (input: CreateProjectInput) => api<Project>("/projects", { method: "POST", body: input }),
  update: (id: string, input: UpdateProjectInput) =>
    api<Project>(`/projects/${id}`, { method: "PATCH", body: input }),
  remove: (id: string) => api<void>(`/projects/${id}`, { method: "DELETE" }),
  dashboard: (id: string) => api<ProjectDashboard>(`/projects/${id}/dashboard`),
};

// ── Tasks ────────────────────────────────────────────────────────────────────

export const tasksApi = {
  list: (params: TaskListParams = {}) =>
    api<Paginated<Task>>("/tasks", { query: { ...params } }),
  get: (id: string) => api<TaskWithProject>(`/tasks/${id}`),
  create: (input: CreateTaskInput) => api<TaskBase>("/tasks", { method: "POST", body: input }),
  update: (id: string, input: UpdateTaskInput) =>
    api<TaskBase>(`/tasks/${id}`, { method: "PATCH", body: input }),
  remove: (id: string) => api<void>(`/tasks/${id}`, { method: "DELETE" }),
  assign: (taskId: string, userId: string) =>
    api<AssignmentResult>(`/tasks/${taskId}/assign`, { method: "POST", body: { userId } }),
  unassign: (taskId: string, userId: string) =>
    api<void>(`/tasks/${taskId}/assign/${userId}`, { method: "DELETE" }),
};

// ── Jobs ─────────────────────────────────────────────────────────────────────

export const jobsApi = {
  get: (id: string) => api<JobInfo>(`/jobs/${encodeURIComponent(id)}`),
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const PAGE_LIMIT = 100; // backend maximum
const MAX_PAGES = 5;

/**
 * Loads every task matching the filters by walking pages of 100 (the API's max).
 * Capped at MAX_PAGES to keep boards/analytics responsive; `truncated` reports
 * whether more tasks exist than were loaded.
 */
export async function fetchAllTasks(
  params: Omit<TaskListParams, "page" | "limit"> = {},
): Promise<{ tasks: Task[]; total: number; truncated: boolean }> {
  const first = await tasksApi.list({ ...params, page: 1, limit: PAGE_LIMIT });
  const tasks = [...first.data];
  const totalPages = Math.ceil(first.total / PAGE_LIMIT);
  const lastPage = Math.min(totalPages, MAX_PAGES);

  if (lastPage > 1) {
    const rest = await Promise.all(
      Array.from({ length: lastPage - 1 }, (_, i) =>
        tasksApi.list({ ...params, page: i + 2, limit: PAGE_LIMIT }),
      ),
    );
    for (const page of rest) tasks.push(...page.data);
  }

  return { tasks, total: first.total, truncated: totalPages > MAX_PAGES };
}
