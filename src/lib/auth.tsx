import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./api";

// Auth state for the single instance-level login (not per-user accounts -- see the
// backend's InstanceAuth docstring). One TanStack Query, backed by GET /auth/me, shared
// through context so every consumer (AppShell's gate, the login page, the logout
// button) reads/invalidates the same cached result instead of each polling separately.

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Call after POST /auth/login or POST /auth/reset-password succeeds, and after
      POST /auth/logout, so every consumer picks up the new state immediately instead of
      waiting for staleTime to lapse. */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["auth", "me"],
    queryFn: api.me,
    // The session cookie is httpOnly and short-lived (12h server-side) -- re-check on
    // window refocus rather than trusting a cached "authenticated" indefinitely, so an
    // expired/invalidated session (e.g. a password reset from another tab) is noticed
    // without requiring a manual reload. staleTime keeps normal navigation between
    // protected pages from re-firing this on every single route change.
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const value: AuthContextValue = {
    isAuthenticated: q.data?.authenticated ?? false,
    isLoading: q.isLoading,
    refresh: async () => {
      await qc.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() must be used within <AuthProvider>.");
  return ctx;
}
