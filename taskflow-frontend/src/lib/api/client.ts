import { config } from "@/lib/config";
import { clearSession, decodeAccessToken, readSession, updateTokens } from "@/lib/auth/session";
import { ApiError, parseErrorBody } from "./errors";
import type { RefreshResponse } from "./types";

type Query = Record<string, string | number | boolean | undefined | null>;

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Query;
  body?: unknown;
  /** Skip the Authorization header and the refresh-on-401 behaviour. */
  anonymous?: boolean;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: Query): string {
  const url = new URL(config.apiUrl + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function rawRequest<T>(path: string, opts: RequestOptions, accessToken: string | null): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken && !opts.anonymous) headers.Authorization = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "NETWORK_ERROR", "Network request failed");
  }

  if (res.status === 204) return undefined as T;

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!res.ok) throw parseErrorBody(res.status, payload);
  return payload as T;
}

// ── Token refresh ────────────────────────────────────────────────────────────
//
// The backend rotates refresh tokens and treats *replaying a revoked token* as
// theft: it revokes every refresh token for that user. So we must never send
// the same refresh token twice. Two guards:
//   1. single-flight within a tab (one shared in-flight promise)
//   2. a cross-tab Web Lock, re-reading storage inside the lock so a tab that
//      lost the race adopts the tokens the winner just stored.

let inflight: Promise<string> | null = null;

const EXPIRY_SKEW_MS = 30_000;

function tokenIsFresh(token: string): boolean {
  const claims = decodeAccessToken(token);
  return !!claims && claims.expMs - Date.now() > EXPIRY_SKEW_MS;
}

async function doRefresh(staleAccessToken: string | null): Promise<string> {
  const session = readSession();
  if (!session) throw new ApiError(401, "TOKEN_MISSING", "Not signed in");

  // Another tab may already have rotated the tokens while we waited for the lock.
  if (session.accessToken !== staleAccessToken && tokenIsFresh(session.accessToken)) {
    return session.accessToken;
  }

  try {
    const tokens = await rawRequest<RefreshResponse>(
      "/auth/refresh",
      { method: "POST", body: { refreshToken: session.refreshToken }, anonymous: true },
      null,
    );
    updateTokens({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
    return tokens.accessToken;
  } catch (err) {
    // A definitive auth failure means the session is over. Transient errors
    // (network, 429, 5xx) leave the stored session intact so the user can retry.
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      clearSession();
    }
    throw err;
  }
}

export async function refreshAccessToken(staleAccessToken: string | null): Promise<string> {
  if (inflight) return inflight;

  const run = () => doRefresh(staleAccessToken);
  const promise: Promise<string> =
    typeof navigator !== "undefined" && navigator.locks
      ? new Promise<string>((resolve, reject) => {
          void navigator.locks.request("taskflow-token-refresh", async () => {
            try {
              resolve(await run());
            } catch (err) {
              reject(err instanceof Error ? err : new Error(String(err)));
            }
          });
        })
      : run();

  inflight = promise.finally(() => {
    inflight = null;
  });
  return inflight;
}

// ── Public request function ──────────────────────────────────────────────────

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (opts.anonymous) return rawRequest<T>(path, opts, null);

  const session = readSession();
  if (!session) throw new ApiError(401, "TOKEN_MISSING", "Not signed in");

  let token = session.accessToken;

  // Refresh proactively if the token is about to expire.
  if (!tokenIsFresh(token)) {
    token = await refreshAccessToken(token);
  }

  try {
    return await rawRequest<T>(path, opts, token);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && err.code !== "RATE_LIMIT_EXCEEDED") {
      // Access token rejected (expired early, clock skew…). Refresh once and retry.
      const fresh = await refreshAccessToken(token);
      return rawRequest<T>(path, opts, fresh);
    }
    throw err;
  }
}
