import { beforeEach, describe, expect, it, vi } from "vitest";

import * as AssignmentData from "../../src/tasks/task-assignment.data.js";
import { AppError } from "../../src/lib/errors.js";
import { assignUser } from "../../src/tasks/task-assignment.service.js";

vi.mock("../../src/tasks/task-assignment.data.js", () => ({
  findTaskForOrganization: vi.fn(),
  findUserMembership: vi.fn(),
  findUserForEmail: vi.fn(),
  createAssignment: vi.fn(),
  deleteAssignment: vi.fn(),
}));

describe("task-assignment.service — assignUser", () => {
  const db = {} as any;

  const organizationId =
    "a0ab963b-d0ad-4f44-a160-11b5ca2dfa2f";

  const taskId =
    "70000000-0000-4000-8000-000000000001";

  const userId =
    "917ffeaf-f862-4411-82c3-b0f8629d0a0f";

  const task = {
    id: taskId,
    title: "Test task",
    project: {
      id: "c1111111-1111-4111-8111-111111111111",
      name: "Test project",
    },
  };

  const membership = {
    organizationId,
    userId,
    role: "member",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws TASK_NOT_FOUND when the task is outside the organization", async () => {
    vi.mocked(AssignmentData.findTaskForOrganization).mockResolvedValue(null);

    await expect(
      assignUser(db, organizationId, taskId, userId),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "TASK_NOT_FOUND",
    });

    expect(AssignmentData.findUserMembership).not.toHaveBeenCalled();
    expect(AssignmentData.createAssignment).not.toHaveBeenCalled();
  });

  it("throws USER_OUTSIDE_ORGANIZATION when the user is not a member", async () => {
    vi.mocked(
      AssignmentData.findTaskForOrganization,
    ).mockResolvedValue(task as any);

    vi.mocked(
      AssignmentData.findUserMembership,
    ).mockResolvedValue(null);

    await expect(
      assignUser(db, organizationId, taskId, userId),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "USER_OUTSIDE_ORGANIZATION",
    });

    expect(AssignmentData.createAssignment).not.toHaveBeenCalled();
  });

  it("throws TASK_ALREADY_ASSIGNED on duplicate assignment", async () => {
    vi.mocked(
      AssignmentData.findTaskForOrganization,
    ).mockResolvedValue(task as any);

    vi.mocked(
      AssignmentData.findUserMembership,
    ).mockResolvedValue(membership as any);

    vi.mocked(
      AssignmentData.createAssignment,
    ).mockRejectedValue({ code: "P2002" });

    await expect(
      assignUser(db, organizationId, taskId, userId),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "TASK_ALREADY_ASSIGNED",
    });
  });

  it("creates an assignment successfully without a queue", async () => {
    const assignment = {
      taskId,
      userId,
      createdAt: new Date(),
    };

    vi.mocked(
      AssignmentData.findTaskForOrganization,
    ).mockResolvedValue(task as any);

    vi.mocked(
      AssignmentData.findUserMembership,
    ).mockResolvedValue(membership as any);

    vi.mocked(
      AssignmentData.createAssignment,
    ).mockResolvedValue(assignment as any);

    const result = await assignUser(
      db,
      organizationId,
      taskId,
      userId,
    );

    expect(result).toEqual(assignment);

    expect(
      AssignmentData.createAssignment,
    ).toHaveBeenCalledWith(db, taskId, userId);
  });

  it("returns the BullMQ jobId when notification enqueue succeeds", async () => {
    const assignment = {
      taskId,
      userId,
      createdAt: new Date(),
    };

    const assignee = {
      id: userId,
      email: "liam.chen@northstar.example",
      name: "Liam Chen",
    };

    const add = vi.fn().mockResolvedValue({
      id: "123",
    });

    const emailQueue = {
      add,
    } as any;

    vi.mocked(
      AssignmentData.findTaskForOrganization,
    ).mockResolvedValue(task as any);

    vi.mocked(
      AssignmentData.findUserMembership,
    ).mockResolvedValue(membership as any);

    vi.mocked(
      AssignmentData.createAssignment,
    ).mockResolvedValue(assignment as any);

    vi.mocked(
      AssignmentData.findUserForEmail,
    ).mockResolvedValue(assignee as any);

    const result = await assignUser(
      db,
      organizationId,
      taskId,
      userId,
      emailQueue,
    );

    expect(result).toEqual({
      ...assignment,
      jobId: "123",
    });

    expect(add).toHaveBeenCalledWith(
      "task_assigned",
      expect.objectContaining({
        type: "task_assigned",
        data: expect.objectContaining({
          assigneeId: userId,
          assigneeEmail: assignee.email,
          assigneeName: assignee.name,
          taskId,
          organizationId,
        }),
      }),
    );
  });
});