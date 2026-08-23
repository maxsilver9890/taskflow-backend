import { Router } from "express";

import { authRateLimiter } from "../middleware/rate-limit.js";
import {
  loginHandler,
  logoutHandler,
  refreshHandler,
  registerHandler
} from "./auth.controller.js";

export function createAuthRouter(): Router {
  const router = Router();

  // Apply the rate limiter (10 req/min/IP) to every auth endpoint.
  router.use(authRateLimiter);

  /**
   * @route   POST /auth/register
   * @desc    Create a new user account and organisation; the registrant
   *          becomes ORG_ADMIN of the newly created organisation.
   * @access  Public
   */
  router.post("/register", registerHandler);

  /**
   * @route   POST /auth/login
   * @desc    Validate credentials and receive an access + refresh token pair.
   * @access  Public
   */
  router.post("/login", loginHandler);

  /**
   * @route   POST /auth/refresh
   * @desc    Rotate a refresh token and receive a fresh access + refresh token pair.
   * @access  Public (bearer of a valid refresh token)
   */
  router.post("/refresh", refreshHandler);

  /**
   * @route   POST /auth/logout
   * @desc    Revoke a refresh token. The short-lived access token expires naturally.
   * @access  Public (bearer of a valid refresh token)
   */
  router.post("/logout", logoutHandler);

  return router;
}
