/**
 * Types mirror the backend contract exactly (see taskflow-backend src/**).
 * Prisma serialises enums by their TypeScript name (TODO, IN_PROGRESS, ...)
 * and dates as ISO strings.
 */

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export type OrgRole = "ORG_ADMIN" | "MEMBER";

// ── Auth ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  /** Access-token lifetime in seconds. */
  expiresIn: number;
}

/** POST /auth/login */
export interface LoginResponse extends TokenPair {
  user: AuthUser;
}

/** POST /auth/register */
export interface RegisterResponse extends TokenPair {
  user: AuthUser & { createdAt: string };
  organization: { id: string; name: string };
}

/** POST /auth/refresh */
export type RefreshResponse = TokenPair;

export interface LoginInput {
  email: string;
  password: string;
}
export interface RegisterInput {
  email: string;
  name: string;
  password: string;
  organizationName: string;
}

// ── Projects ────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ProjectDashboard {
  projectId: string;
  counts: Record<"todo" | "in_progress" | "review" | "done", number>;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
}
export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
}

// ── Tasks ───────────────────────────────────────────────────────────────────

export interface AssigneeUser {
  id: string;
  name: string;
  email: string;
}

export interface TaskAssignment {
  taskId: string;
  userId: string;
  createdAt: string;
  user: AssigneeUser;
}

/** Row returned by POST/PATCH /tasks (no relations). */
export interface TaskBase {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Row returned by GET /tasks (list) – includes assignments with user info. */
export interface Task extends TaskBase {
  assignments: TaskAssignment[];
}

/** GET /tasks/:id – includes the project but NOT assignments or comments. */
export interface TaskWithProject extends TaskBase {
  project: Project;
}

export interface TaskListParams {
  page?: number;
  limit?: number;
  status?: TaskStatus;
  priority?: TaskPriority;
  /** User id. */
  assignee?: string;
  /** ISO timestamps. */
  dueFrom?: string;
  dueTo?: string;
  projectId?: string;
}

export interface CreateTaskInput {
  projectId: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  /** ISO timestamp. */
  dueDate?: string;
}

export interface UpdateTaskInput {
  projectId?: string;
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
}

/** POST /tasks/:id/assign – `jobId` is only present if the email job was enqueued. */
export interface AssignmentResult {
  taskId: string;
  userId: string;
  createdAt: string;
  jobId?: string;
}

// ── Jobs ────────────────────────────────────────────────────────────────────

export type JobStatus = "pending" | "active" | "completed" | "failed";

/** GET /jobs/:id */
export interface JobInfo {
  jobId: string;
  status: JobStatus;
  type: string | null;
  createdAt: string | null;
  finishedAt: string | null;
  attemptsMade: number;
  failedReason: string | null;
}

// ── Errors ──────────────────────────────────────────────────────────────────

/** Standard error envelope produced by the backend error handler. */
export interface ApiErrorBody {
  error: string;
  code: string;
  details?: {
    issues?: Record<string, string[] | undefined>;
    [key: string]: unknown;
  };
}
