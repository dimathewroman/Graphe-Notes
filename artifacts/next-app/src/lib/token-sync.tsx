"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { setAccessToken } from "@workspace/api-client-react/custom-fetch";

export function TokenSync() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAccessToken(session?.access_token ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
