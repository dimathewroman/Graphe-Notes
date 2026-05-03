-- Revoke PostgREST RPC access to the rls_auto_enable SECURITY DEFINER function.
--
-- Supabase security advisor flagged this function as callable by anon and
-- authenticated roles via /rest/v1/rpc/rls_auto_enable. The function itself
-- only enables RLS on new tables (not destructive), but exposing a
-- SECURITY DEFINER function to unauthenticated callers violates least-privilege.
--
-- The event trigger that calls this function on CREATE TABLE is unaffected —
-- it fires as the table owner, not via RPC.

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
