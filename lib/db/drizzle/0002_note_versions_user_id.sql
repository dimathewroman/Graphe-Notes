-- Migration: add user_id to note_versions (INFO-1 remediation)
--
-- Adds a denormalised user_id column so RLS policies can use a direct
-- equality check instead of a correlated sub-query joining through notes.
--
-- Apply order:
--   1. Add nullable column
--   2. Backfill from notes.user_id
--   3. Add NOT NULL constraint
--   4. Add index
--   5. Drop old JOIN-based RLS policies and replace with direct checks

-- Step 1: Add nullable user_id column
ALTER TABLE public.note_versions
  ADD COLUMN IF NOT EXISTS user_id varchar;

-- Step 2: Backfill existing rows from the parent note
UPDATE public.note_versions nv
SET user_id = n.user_id
FROM public.notes n
WHERE nv.note_id = n.id
  AND nv.user_id IS NULL;

-- Step 3: Enforce NOT NULL now that all rows are populated
ALTER TABLE public.note_versions
  ALTER COLUMN user_id SET NOT NULL;

-- Step 4: Index for RLS scan performance
CREATE INDEX IF NOT EXISTS note_versions_user_id_idx ON public.note_versions (user_id);

-- Step 5: Replace JOIN-based RLS policies with direct user_id checks
DROP POLICY IF EXISTS "note_versions_select" ON public.note_versions;
DROP POLICY IF EXISTS "note_versions_insert" ON public.note_versions;
DROP POLICY IF EXISTS "note_versions_update" ON public.note_versions;
DROP POLICY IF EXISTS "note_versions_delete" ON public.note_versions;

CREATE POLICY "note_versions_select" ON public.note_versions
  FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "note_versions_insert" ON public.note_versions
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "note_versions_update" ON public.note_versions
  FOR UPDATE
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "note_versions_delete" ON public.note_versions
  FOR DELETE USING (user_id = auth.uid()::text);
