import type { TaskListParams } from "@/lib/api/types";

export const qk = {
  projects: {
    all: ["projects"] as const,
    list: (page: number, limit: number) => ["projects", "list", page, limit] as const,
    everything: () => ["projects", "list-all"] as const,
    detail: (id: string) => ["projects", "detail", id] as const,
    dashboard: (id: string) => ["projects", "dashboard", id] as const,
  },
  tasks: {
    all: ["tasks"] as const,
    list: (params: TaskListParams) => ["tasks", "list", params] as const,
    count: (params: TaskListParams) => ["tasks", "count", params] as const,
    ofProject: (projectId: string) => ["tasks", "project-all", projectId] as const,
    ofOrg: () => ["tasks", "org-all"] as const,
    detail: (id: string) => ["tasks", "detail", id] as const,
  },
  jobs: {
    detail: (id: string) => ["jobs", id] as const,
  },
};
