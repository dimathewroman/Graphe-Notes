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
  login: (provider?: "google" | "apple") => void;
  logout: () => void;
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

  const login = useCallback((provider: "google" | "apple" = "google") => {
    supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin + (import.meta.env.BASE_URL || "/"),
      },
    }).catch((err) => {
      console.error("Sign-in failed:", err);
    });
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
    login,
    logout,
  };
}
