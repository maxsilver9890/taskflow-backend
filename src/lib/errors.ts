/**
 * Structured application error that carries an HTTP status code and a
 * machine-readable code string so the error handler can emit a consistent
 * JSON response without leaking internal details.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
    // Maintains proper prototype chain in transpiled ES5 targets.
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const AuthErrors = {
  EMAIL_IN_USE: () =>
    new AppError(409, "EMAIL_IN_USE", "An account with this email already exists."),

  INVALID_CREDENTIALS: () =>
    new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password."),

  TOKEN_MISSING: () =>
    new AppError(401, "TOKEN_MISSING", "Authorization token is required."),

  TOKEN_INVALID: () =>
    new AppError(401, "TOKEN_INVALID", "Authorization token is invalid or expired."),

  TOKEN_REVOKED: () =>
    new AppError(401, "TOKEN_REVOKED", "Refresh token has been revoked."),

  TOKEN_EXPIRED: () =>
    new AppError(401, "TOKEN_EXPIRED", "Refresh token has expired."),

  FORBIDDEN: () =>
    new AppError(403, "FORBIDDEN", "You do not have permission to access this resource."),
} as const;
