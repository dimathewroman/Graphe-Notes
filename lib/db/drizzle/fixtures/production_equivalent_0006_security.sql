-- Synthetic equivalent of the non-table security object recorded by 0005.
-- It exists only in disposable validation databases.
CREATE FUNCTION public.rls_auto_enable()
RETURNS event_trigger
LANGUAGE plpgsql
AS $$ BEGIN END $$;

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()
FROM PUBLIC, anon, authenticated;
