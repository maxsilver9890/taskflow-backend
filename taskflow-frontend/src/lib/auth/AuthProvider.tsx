"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { authApi } from "@/lib/api/services";
import type { AuthUser, LoginInput, OrgRole, RegisterInput } from "@/lib/api/types";
import {
  clearSession,
  decodeAccessToken,
  parseSession,
  readSessionRaw,
  subscribeSession,
  writeSession,
} from "./session";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  orgId: string | null;
  organizationName: string | null;
  role: OrgRole | null;
  isAdmin: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const noopSubscribe = () => () => {};

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // `hydrated` is false during SSR/hydration and true afterwards, so we never
  // flash the login screen for a user who is actually signed in.
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const raw = useSyncExternalStore(subscribeSession, readSessionRaw, () => null);
  const session = useMemo(() => parseSession(raw), [raw]);
  const claims = useMemo(() => (session ? decodeAccessToken(session.accessToken) : null), [session]);

  const login = useCallback(
    async (input: LoginInput) => {
      const res = await authApi.login(input);
      queryClient.clear();
      writeSession({ accessToken: res.accessToken, refreshToken: res.refreshToken, user: res.user });
    },
    [queryClient],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const res = await authApi.register(input);
      queryClient.clear();
      writeSession({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        user: { id: res.user.id, email: res.user.email, name: res.user.name },
        organizationName: res.organization.name,
      });
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    const current = parseSession(readSessionRaw());
    if (current) {
      try {
        // Revokes the refresh token server-side. Logout is idempotent; failures
        // (offline, etc.) must never block signing out locally.
        await authApi.logout(current.refreshToken);
      } catch {
        /* ignore */
      }
    }
    clearSession();
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(() => {
    const status: AuthStatus = !hydrated ? "loading" : session ? "authenticated" : "unauthenticated";
    return {
      status,
      user: session?.user ?? null,
      orgId: claims?.orgId ?? null,
      organizationName: session?.organizationName ?? null,
      role: claims?.role ?? null,
      isAdmin: claims?.role === "ORG_ADMIN",
      login,
      register,
      logout,
    };
  }, [hydrated, session, claims, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** For code that only renders when authenticated (inside the app shell). */
export function useCurrentUser(): AuthUser {
  const { user } = useAuth();
  if (!user) throw new Error("useCurrentUser called while signed out");
  return user;
}
