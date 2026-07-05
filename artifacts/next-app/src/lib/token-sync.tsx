"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { setAccessToken, setVaultProof } from "@workspace/api-client-react/custom-fetch";

export function TokenSync() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAccessToken(session?.access_token ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token ?? null);
      // Drop any vault proof when the session ends (sign-out) so it can't be
      // reused (§S). It's in-memory anyway, but clear it explicitly.
      if (!session) setVaultProof(null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
