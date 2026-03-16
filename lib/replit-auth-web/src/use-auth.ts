import { useState, useEffect, useCallback } from "react";
import { createClient, type User as SupabaseUser } from "@supabase/supabase-js";
import type { AuthUser } from "@workspace/api-client-react";
import { setAccessToken } from "@workspace/api-client-react/custom-fetch";

export type { AuthUser };

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

function mapUser(u: SupabaseUser): AuthUser {
  return {
    id: u.id,
    email: u.email ?? null,
    firstName: u.user_metadata?.full_name?.split(" ")[0] ?? u.user_metadata?.first_name ?? null,
    lastName: u.user_metadata?.full_name?.split(" ").slice(1).join(" ") ?? u.user_metadata?.last_name ?? null,
    profileImageUrl: u.user_metadata?.avatar_url ?? u.user_metadata?.picture ?? null,
  };
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginWithOAuth: (provider: "google" | "apple") => void;
  loginWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => void;
  login: (provider?: "google" | "apple") => void;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (session?.user) {
          setUser(mapUser(session.user));
          setAccessToken(session.access_token);
        } else {
          setUser(null);
          setAccessToken(null);
        }
      })
      .catch(() => {
        setUser(null);
        setAccessToken(null);
      })
      .finally(() => {
        setIsLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(mapUser(session.user));
        setAccessToken(session.access_token);
      } else {
        setUser(null);
        setAccessToken(null);
      }
      setIsLoading(false);
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  const loginWithOAuth = useCallback((provider: "google" | "apple") => {
    supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin + (import.meta.env.BASE_URL || "/"),
      },
    }).catch((err) => {
      console.error("OAuth sign-in failed:", err);
    });
  }, []);

  const login = useCallback((provider: "google" | "apple" = "google") => {
    loginWithOAuth(provider);
  }, [loginWithOAuth]);

  const loginWithEmail = useCallback(async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Sign-in failed" };
    }
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) return { error: error.message };
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Sign-up failed" };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Sign-out failed:", err);
    } finally {
      setUser(null);
      setAccessToken(null);
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
