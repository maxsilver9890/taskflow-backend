import type { NextFunction, Request, Response } from "express";

import { AuthErrors } from "../lib/errors.js";
import { verifyAccessToken } from "../lib/jwt.js";

/**
 * The verified identity attached to every authenticated request.
 * `orgId` is resolved server-side from the JWT and must never be
 * overridden by client-supplied values.
 */
export interface AuthContext {
  userId: string;
  orgId: string;
  role: string;
}

// Augment Express's Request so TypeScript knows about `req.auth`.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

/**
 * Validates the `Authorization: Bearer <token>` header and attaches the
 * decoded identity to `req.auth`. Downstream handlers can trust that
 * `req.auth` is present and that `orgId` was not supplied by the client.
 *
 * Usage:
 *   router.get('/projects', authenticate, projectController.list);
 */
export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next(AuthErrors.TOKEN_MISSING());
    return;
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const payload = verifyAccessToken(token);

    req.auth = {
      userId: payload.sub,
      orgId: payload.orgId,
      role: payload.role
    };

    next();
  } catch {
    next(AuthErrors.TOKEN_INVALID());
  }
}

/**
 * Guards a route to org_admin role only.
 * Must be composed AFTER `authenticate`.
 *
 * Usage:
 *   router.delete('/projects/:id', authenticate, requireAdmin, projectController.delete);
 */
export function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (req.auth?.role !== "ORG_ADMIN") {
    next(AuthErrors.FORBIDDEN());
    return;
  }

  next();
}

/**
 * Guard that enforces cross-tenant isolation for handlers that receive an
 * `orgId` path or query parameter. The value extracted from the JWT is always
 * used as the authoritative org scope; this helper rejects requests where the
 * client-supplied value doesn't match, preventing probing of other orgs.
 *
 * NOTE: Service-layer queries must ALWAYS scope by `req.auth.orgId`, never by
 * any client-provided org value. This helper is a defence-in-depth addition.
 */
export function assertOrgScope(
  clientOrgId: string,
  req: Request,
  next: NextFunction
): boolean {
  if (clientOrgId !== req.auth?.orgId) {
    next(AuthErrors.FORBIDDEN());
    return false;
  }

  return true;
}
