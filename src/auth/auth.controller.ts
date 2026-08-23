import type { NextFunction, Request, Response } from "express";

import { prisma } from "../config/prisma.js";
import {
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema
} from "./auth.schemas.js";
import * as AuthService from "./auth.service.js";

export async function registerHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { body } = registerSchema.parse({ body: req.body });
    const result = await AuthService.register(prisma, body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function loginHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { body } = loginSchema.parse({ body: req.body });
    const result = await AuthService.login(prisma, body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function refreshHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { body } = refreshSchema.parse({ body: req.body });
    const result = await AuthService.refresh(prisma, body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function logoutHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { body } = logoutSchema.parse({ body: req.body });
    await AuthService.logout(prisma, body);
    res.status(200).json({ message: "Logged out successfully." });
  } catch (error) {
    next(error);
  }
}
