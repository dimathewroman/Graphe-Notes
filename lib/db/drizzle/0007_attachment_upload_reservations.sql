-- Ordered migration after the production-equivalent 0006 baseline. This
-- preflight intentionally fails closed if the known safety baseline is absent.
DO $baseline$
DECLARE
  actual_tables text[];
BEGIN
  IF to_regclass('private.attachment_upload_reservations') IS NOT NULL THEN
    RAISE EXCEPTION 'unexpected baseline: attachment upload reservations already exists';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'attachments_note_id_notes_id_fk'
      AND conrelid = 'public.attachments'::regclass
      AND confdeltype = 'r'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'note_versions_note_id_notes_id_fk'
      AND conrelid = 'public.note_versions'::regclass
      AND confdeltype = 'r'
  ) THEN
    RAISE EXCEPTION 'unexpected baseline: required 0006 RESTRICT constraints are absent';
  END IF;

  SELECT array_agg(c.relname::text ORDER BY c.relname)
    INTO actual_tables
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r';
  IF actual_tables IS DISTINCT FROM ARRAY[
    'ai_usage', 'attachments', 'folders', 'note_versions', 'notes',
    'quick_bit_settings', 'quick_bits', 'smart_folders', 'templates',
    'user_api_keys', 'user_settings', 'users', 'vault_settings'
  ]::text[] THEN
    RAISE EXCEPTION 'unexpected baseline: public table fingerprint differs';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'unexpected baseline: public RLS is incomplete';
  END IF;

  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public') <> 52
     OR EXISTS (
       SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       EXCEPT
       SELECT tablename
       FROM pg_policies
       WHERE schemaname = 'public'
       GROUP BY tablename
       HAVING count(*) = 4
     ) THEN
    RAISE EXCEPTION 'unexpected baseline: public policy fingerprint differs';
  END IF;

  IF to_regclass('public.attachments_user_id_idx') IS NULL
     OR to_regclass('public.attachments_note_id_idx') IS NULL
     OR to_regclass('public.attachments_note_id_created_at_idx') IS NULL
     OR to_regclass('public.note_versions_user_id_idx') IS NULL
     OR to_regclass('public.note_versions_note_id_created_at_idx') IS NULL
     OR to_regclass('public.notes_user_id_deleted_at_idx') IS NULL THEN
    RAISE EXCEPTION 'unexpected baseline: required attachment/note indexes are absent';
  END IF;

  IF to_regprocedure('public.rls_auto_enable()') IS NULL OR EXISTS (
    SELECT 1
    FROM pg_proc p
    CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    WHERE p.oid = 'public.rls_auto_enable()'::regprocedure
      AND acl.grantee = 0
      AND acl.privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'unexpected baseline: rls_auto_enable revoke is absent';
  END IF;
END
$baseline$;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

CREATE TABLE private.attachment_upload_reservations (
  id uuid PRIMARY KEY,
  user_id varchar NOT NULL,
  note_id integer NOT NULL,
  state text NOT NULL DEFAULT 'uploading',
  lease_token uuid NOT NULL,
  lease_expires_at timestamptz NOT NULL,
  retry_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error_code text,
  storage_path text,
  master_path text,
  proxy_path text,
  attachment jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attachment_upload_reservations_state_check CHECK (state IN ('uploading', 'cleanup_pending')),
  CONSTRAINT attachment_upload_reservations_path_check CHECK (storage_path IS NOT NULL OR master_path IS NOT NULL OR proxy_path IS NOT NULL),
  CONSTRAINT attachment_upload_reservations_error_check CHECK (last_error_code IS NULL OR length(last_error_code) <= 64)
);

CREATE INDEX attachment_upload_reservations_due_idx
  ON private.attachment_upload_reservations (state, next_attempt_at, lease_expires_at);
CREATE INDEX attachment_upload_reservations_lease_idx
  ON private.attachment_upload_reservations (lease_token);

ALTER TABLE private.attachment_upload_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.attachment_upload_reservations FROM PUBLIC;

DO $roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON SCHEMA private FROM anon;
    REVOKE ALL ON TABLE private.attachment_upload_reservations FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON SCHEMA private FROM authenticated;
    REVOKE ALL ON TABLE private.attachment_upload_reservations FROM authenticated;
  END IF;
END
$roles$;

-- No guessed application-role grant. The release operator must first prove the
-- SUPABASE_DB_URL role, then grant that exact role USAGE on private and
-- SELECT/INSERT/UPDATE/DELETE on this table. An unproven role fails closed.
