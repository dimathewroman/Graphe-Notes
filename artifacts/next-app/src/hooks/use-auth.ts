"use client";

import { useState, useEffect, useCallback } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { AuthUser } from "@workspace/api-zod";
import { supabase } from "@/lib/supabase";
import posthog from "posthog-js";

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
  logout: () => void;
  login: (provider?: "google" | "apple") => void;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUserWithDisplay | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (session?.user) {
          setUser(mapUser(session.user));
          posthog.identify(session.user.id, { email: session.user.email });
        } else {
          setUser(null);
        }
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(mapUser(session.user));
        posthog.identify(session.user.id, { email: session.user.email });
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loginWithOAuth = useCallback((provider: "google" | "apple") => {
    posthog.capture("oauth_login_attempted", { provider });
    supabase.auth
      .signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin + "/",
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
          posthog.identify(data.user.id, { email: data.user.email });
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
          posthog.identify(data.user.id, { email: data.user.email });
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
      posthog.capture("user_logged_out");
      posthog.reset();
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Sign-out failed:", err);
    } finally {
      setUser(null);
    }
  }, []);

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
