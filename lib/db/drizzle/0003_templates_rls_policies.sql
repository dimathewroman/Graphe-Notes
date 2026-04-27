-- Add RLS policies for the templates table.
-- RLS was enabled in 0001 (ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY)
-- but no policies were created, leaving the table unprotected against direct
-- PostgREST access with the anon key.
--
-- Policy design:
--   - SELECT: own rows OR preset rows (isPreset = true are global, shared across users)
--   - INSERT: own rows only (user_id must match)
--   - UPDATE: own rows only
--   - DELETE: own rows only (presets can only be deleted by server-side admin ops)

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates_select" ON public.templates
  FOR SELECT USING (user_id = auth.uid()::text OR is_preset = true);

CREATE POLICY "templates_insert" ON public.templates
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "templates_update" ON public.templates
  FOR UPDATE
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "templates_delete" ON public.templates
  FOR DELETE USING (user_id = auth.uid()::text);
