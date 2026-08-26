"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Session as SupabaseSession, User as SupabaseUser } from "@supabase/supabase-js";
import type { AuthUser } from "@workspace/api-zod";
import * as Sentry from "@sentry/nextjs";
import { supabase } from "@/lib/supabase";
import { eraseAuthenticatedCollaborationReplicas, eraseStaleAuthenticatedCollaborationReplicas, runReplicaProtectedBoundary } from "@/lib/collaboration/note-collaboration-replica";
import posthog from "posthog-js";
import { toast } from "sonner";

export type { AuthUser };

export type AuthUserWithDisplay = AuthUser & { displayName: string };

function mapUser(u: SupabaseUser): AuthUserWithDisplay {
  const firstName = u.user_metadata?.full_name?.split(" ")[0] ?? u.user_metadata?.first_name ?? null;
  const lastName =
    u.user_metadata?.full_name?.split(" ").slice(1).join(" ") ??
    u.user_metadata?.last_name ??
    null;
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || u.email || "User";
  return {
    id: u.id,
    email: u.email ?? null,
    firstName,
    lastName,
    profileImageUrl: u.user_metadata?.avatar_url ?? u.user_metadata?.picture ?? null,
    displayName,
  };
}

interface AuthState {
  user: AuthUserWithDisplay | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginWithOAuth: (provider: "google" | "apple") => void;
  loginWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  login: (provider?: "google" | "apple") => void;
}

/** Returns true only if there is a Supabase session token in localStorage that
 *  needs to be validated. A fresh browser context (no stored token) skips the
 *  loading spinner entirely and shows the login screen immediately. */
function hasStoredSession(): boolean {
  if (typeof window === "undefined") return true; // SSR: assume loading
  if (new URLSearchParams(window.location.search).has("code")) return true;
  try {
    return Object.keys(localStorage).some(
      (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
    );
  } catch {
    return true; // localStorage blocked (private browsing strict mode)
  }
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUserWithDisplay | null>(null);
  // Start as false so the login screen (including the demo button) is visible
  // immediately on both server and client — no SSR mismatch, no spinner on
  // first paint for unauthenticated visitors or test environments.
  // We only flip to true inside useEffect when a stored token actually exists
  // and needs Supabase validation.
  const [isLoading, setIsLoading] = useState(false);
  const authenticatedOwnerRef = useRef<string | null>(null);
  const sessionTransitionRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    // No stored token → nothing to validate; login screen already visible.
    if (!hasStoredSession()) {
      return;
    }

    // A stored token exists: show the spinner while Supabase validates it.
    // Safety net caps the wait at 5 s so a hanging Supabase call can't lock
    // the UI indefinitely.
    setIsLoading(true);
    const safetyTimer = setTimeout(() => setIsLoading(false), 5000);

    const applySession = (session: SupabaseSession | null): Promise<void> => {
      const transition = sessionTransitionRef.current
        .catch(() => undefined)
        .then(async () => {
          const nextUser = session?.user ?? null;
          const previousOwner = authenticatedOwnerRef.current;
          const nextOwner = nextUser?.id ?? null;
          try {
            if (nextOwner) {
              if (previousOwner && previousOwner !== nextOwner) {
                await eraseAuthenticatedCollaborationReplicas(previousOwner);
              }
              await eraseStaleAuthenticatedCollaborationReplicas(nextOwner);
            } else if (previousOwner) {
              await eraseAuthenticatedCollaborationReplicas(previousOwner);
            }
          } catch {
            Sentry.captureException(new Error("Collaboration replica disposal failed."));
            if (!nextOwner) {
              authenticatedOwnerRef.current = null;
              setUser(null);
            }
            throw new Error("Collaboration replica transition failed.");
          }

          authenticatedOwnerRef.current = nextOwner;
          if (session?.user) {
            setUser(mapUser(session.user));
            posthog.identify(session.user.id);
          } else {
            setUser(null);
          }
        });
      sessionTransitionRef.current = transition;
      return transition;
    };

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => applySession(session))
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        clearTimeout(safetyTimer);
        setIsLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session)
        .catch(() => setUser(null))
        .finally(() => setIsLoading(false));
    });

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const loginWithOAuth = useCallback((provider: "google" | "apple") => {
    posthog.capture("oauth_login_attempted", { provider });
    supabase.auth
      .signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin + "/auth/callback",
        },
      })
      .catch((err: unknown) => {
        console.error("OAuth sign-in failed:", err);
      });
  }, []);

  const login = useCallback(
    (provider: "google" | "apple" = "google") => {
      loginWithOAuth(provider);
    },
    [loginWithOAuth],
  );

  const loginWithEmail = useCallback(
    async (email: string, password: string): Promise<{ error: string | null }> => {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { error: error.message };
        if (data.user) {
          posthog.identify(data.user.id);
          posthog.capture("user_logged_in", { method: "email" });
        }
        return { error: null };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Sign-in failed" };
      }
    },
    [],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string): Promise<{ error: string | null }> => {
      try {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) return { error: error.message };
        if (data.user) {
          posthog.identify(data.user.id);
          posthog.capture("user_signed_up", { method: "email" });
        }
        return { error: null };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Sign-up failed" };
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      if (user?.id) {
        await runReplicaProtectedBoundary(
          () => eraseAuthenticatedCollaborationReplicas(user.id),
          async () => {
            await supabase.auth.signOut();
          },
        );
      } else {
        await supabase.auth.signOut();
      }
      posthog.capture("user_logged_out");
      posthog.reset();
      setUser(null);
    } catch {
      Sentry.captureException(new Error("Sign-out cleanup failed."));
      toast.error("Local editor cache could not be cleared. Sign out was cancelled.");
    }
  }, [user?.id]);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    loginWithOAuth,
    loginWithEmail,
    signUpWithEmail,
    login,
    logout,
  };
}
