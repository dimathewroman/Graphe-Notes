-- Durable editor save ordering. Existing rows intentionally remain NULL: their
-- first ordered save must match the opaque server-issued updated_at revision.
ALTER TABLE public.notes
  ADD COLUMN save_session_id uuid,
  ADD COLUMN save_sequence bigint;
