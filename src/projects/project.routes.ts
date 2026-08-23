import { Router } from "express";

import { authenticate, requireAdmin } from "../middleware/authenticate.js";
import {
  createProjectHandler,
  dashboardHandler,
  deleteProjectHandler,
  getProjectHandler,
  listProjectsHandler,
  updateProjectHandler
} from "./project.controller.js";

export function createProjectRouter(): Router {
  const router = Router();

  router.use(authenticate);

  router.post("/", createProjectHandler);
  router.get("/", listProjectsHandler);
  router.get("/:id/dashboard", dashboardHandler);
  router.get("/:id", getProjectHandler);
  router.patch("/:id", updateProjectHandler);
  router.delete("/:id", requireAdmin, deleteProjectHandler);

  return router;
}