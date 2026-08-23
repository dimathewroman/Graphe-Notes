REVOKE ALL ON SCHEMA private FROM PUBLIC;
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

-- The same operator grant gate as ordered migration 0007 applies. No runtime
-- role is guessed or granted by a source-only validation.
