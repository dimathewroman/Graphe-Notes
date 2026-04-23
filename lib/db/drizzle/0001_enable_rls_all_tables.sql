-- Enable RLS on every public table and create per-user access policies.
-- API routes use the service role key (bypasses RLS). These policies are
-- defense-in-depth against direct PostgREST access with the anon key.

-- ============================================================
-- Enable RLS
-- ============================================================

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_bits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_bit_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Tables with user_id (varchar) -- auth.uid()::text
-- ============================================================

-- notes
CREATE POLICY "notes_select" ON public.notes FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "notes_insert" ON public.notes FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "notes_update" ON public.notes FOR UPDATE USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "notes_delete" ON public.notes FOR DELETE USING (user_id = auth.uid()::text);

-- folders
CREATE POLICY "folders_select" ON public.folders FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "folders_insert" ON public.folders FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "folders_update" ON public.folders FOR UPDATE USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "folders_delete" ON public.folders FOR DELETE USING (user_id = auth.uid()::text);

-- attachments
CREATE POLICY "attachments_select" ON public.attachments FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "attachments_insert" ON public.attachments FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "attachments_update" ON public.attachments FOR UPDATE USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "attachments_delete" ON public.attachments FOR DELETE USING (user_id = auth.uid()::text);

-- quick_bits
CREATE POLICY "quick_bits_select" ON public.quick_bits FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "quick_bits_insert" ON public.quick_bits FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "quick_bits_update" ON public.quick_bits FOR UPDATE USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "quick_bits_delete" ON public.quick_bits FOR DELETE USING (user_id = auth.uid()::text);

-- quick_bit_settings
CREATE POLICY "quick_bit_settings_select" ON public.quick_bit_settings FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "quick_bit_settings_insert" ON public.quick_bit_settings FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "quick_bit_settings_update" ON public.quick_bit_settings FOR UPDATE USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "quick_bit_settings_delete" ON public.quick_bit_settings FOR DELETE USING (user_id = auth.uid()::text);

-- smart_folders
CREATE POLICY "smart_folders_select" ON public.smart_folders FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "smart_folders_insert" ON public.smart_folders FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "smart_folders_update" ON public.smart_folders FOR UPDATE USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "smart_folders_delete" ON public.smart_folders FOR DELETE USING (user_id = auth.uid()::text);

-- vault_settings
CREATE POLICY "vault_settings_select" ON public.vault_settings FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "vault_settings_insert" ON public.vault_settings FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "vault_settings_update" ON public.vault_settings FOR UPDATE USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "vault_settings_delete" ON public.vault_settings FOR DELETE USING (user_id = auth.uid()::text);

-- ============================================================
-- Tables with user_id (uuid) -- auth.uid() directly
-- ============================================================

-- ai_usage
CREATE POLICY "ai_usage_select" ON public.ai_usage FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "ai_usage_insert" ON public.ai_usage FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "ai_usage_update" ON public.ai_usage FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "ai_usage_delete" ON public.ai_usage FOR DELETE USING (user_id = auth.uid());

-- user_api_keys
CREATE POLICY "user_api_keys_select" ON public.user_api_keys FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "user_api_keys_insert" ON public.user_api_keys FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_api_keys_update" ON public.user_api_keys FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_api_keys_delete" ON public.user_api_keys FOR DELETE USING (user_id = auth.uid());

-- user_settings
CREATE POLICY "user_settings_select" ON public.user_settings FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "user_settings_insert" ON public.user_settings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_settings_update" ON public.user_settings FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_settings_delete" ON public.user_settings FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- note_versions -- no user_id, join through notes
-- ============================================================

CREATE POLICY "note_versions_select" ON public.note_versions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.notes WHERE notes.id = note_versions.note_id AND notes.user_id = auth.uid()::text));
CREATE POLICY "note_versions_insert" ON public.note_versions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.notes WHERE notes.id = note_versions.note_id AND notes.user_id = auth.uid()::text));
CREATE POLICY "note_versions_update" ON public.note_versions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.notes WHERE notes.id = note_versions.note_id AND notes.user_id = auth.uid()::text))
  WITH CHECK (EXISTS (SELECT 1 FROM public.notes WHERE notes.id = note_versions.note_id AND notes.user_id = auth.uid()::text));
CREATE POLICY "note_versions_delete" ON public.note_versions FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.notes WHERE notes.id = note_versions.note_id AND notes.user_id = auth.uid()::text));

-- ============================================================
-- users -- own row only, prevent storage_tier self-promotion
-- ============================================================

CREATE POLICY "users_select" ON public.users FOR SELECT USING (id = auth.uid()::text);
CREATE POLICY "users_insert" ON public.users FOR INSERT WITH CHECK (id = auth.uid()::text);
CREATE POLICY "users_update" ON public.users FOR UPDATE
  USING (id = auth.uid()::text)
  WITH CHECK (id = auth.uid()::text AND storage_tier = (SELECT u.storage_tier FROM public.users u WHERE u.id = auth.uid()::text));
CREATE POLICY "users_delete" ON public.users FOR DELETE USING (id = auth.uid()::text);
