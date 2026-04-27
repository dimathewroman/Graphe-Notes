-- Fix RLS policy performance: wrap every auth.uid() call in (select auth.uid()).
--
-- Calling auth.uid() directly in a policy expression causes Postgres to
-- re-evaluate the function on every row it examines.  Wrapping it in a
-- scalar subquery (select auth.uid()) converts it to an InitPlan that runs
-- once per query, eliminating the per-row overhead.  This pattern is the
-- standard recommendation from the Supabase performance advisors.

-- ============================================================
-- notes
-- ============================================================
DROP POLICY IF EXISTS "notes_select" ON public.notes;
DROP POLICY IF EXISTS "notes_insert" ON public.notes;
DROP POLICY IF EXISTS "notes_update" ON public.notes;
DROP POLICY IF EXISTS "notes_delete" ON public.notes;

CREATE POLICY "notes_select" ON public.notes FOR SELECT USING (user_id = (select auth.uid())::text);
CREATE POLICY "notes_insert" ON public.notes FOR INSERT WITH CHECK (user_id = (select auth.uid())::text);
CREATE POLICY "notes_update" ON public.notes FOR UPDATE USING (user_id = (select auth.uid())::text) WITH CHECK (user_id = (select auth.uid())::text);
CREATE POLICY "notes_delete" ON public.notes FOR DELETE USING (user_id = (select auth.uid())::text);

-- ============================================================
-- folders
-- ============================================================
DROP POLICY IF EXISTS "folders_select" ON public.folders;
DROP POLICY IF EXISTS "folders_insert" ON public.folders;
DROP POLICY IF EXISTS "folders_update" ON public.folders;
DROP POLICY IF EXISTS "folders_delete" ON public.folders;

CREATE POLICY "folders_select" ON public.folders FOR SELECT USING (user_id = (select auth.uid())::text);
CREATE POLICY "folders_insert" ON public.folders FOR INSERT WITH CHECK (user_id = (select auth.uid())::text);
CREATE POLICY "folders_update" ON public.folders FOR UPDATE USING (user_id = (select auth.uid())::text) WITH CHECK (user_id = (select auth.uid())::text);
CREATE POLICY "folders_delete" ON public.folders FOR DELETE USING (user_id = (select auth.uid())::text);

-- ============================================================
-- attachments
-- ============================================================
DROP POLICY IF EXISTS "attachments_select" ON public.attachments;
DROP POLICY IF EXISTS "attachments_insert" ON public.attachments;
DROP POLICY IF EXISTS "attachments_update" ON public.attachments;
DROP POLICY IF EXISTS "attachments_delete" ON public.attachments;

CREATE POLICY "attachments_select" ON public.attachments FOR SELECT USING (user_id = (select auth.uid())::text);
CREATE POLICY "attachments_insert" ON public.attachments FOR INSERT WITH CHECK (user_id = (select auth.uid())::text);
CREATE POLICY "attachments_update" ON public.attachments FOR UPDATE USING (user_id = (select auth.uid())::text) WITH CHECK (user_id = (select auth.uid())::text);
CREATE POLICY "attachments_delete" ON public.attachments FOR DELETE USING (user_id = (select auth.uid())::text);

-- ============================================================
-- quick_bits
-- ============================================================
DROP POLICY IF EXISTS "quick_bits_select" ON public.quick_bits;
DROP POLICY IF EXISTS "quick_bits_insert" ON public.quick_bits;
DROP POLICY IF EXISTS "quick_bits_update" ON public.quick_bits;
DROP POLICY IF EXISTS "quick_bits_delete" ON public.quick_bits;

CREATE POLICY "quick_bits_select" ON public.quick_bits FOR SELECT USING (user_id = (select auth.uid())::text);
CREATE POLICY "quick_bits_insert" ON public.quick_bits FOR INSERT WITH CHECK (user_id = (select auth.uid())::text);
CREATE POLICY "quick_bits_update" ON public.quick_bits FOR UPDATE USING (user_id = (select auth.uid())::text) WITH CHECK (user_id = (select auth.uid())::text);
CREATE POLICY "quick_bits_delete" ON public.quick_bits FOR DELETE USING (user_id = (select auth.uid())::text);

-- ============================================================
-- quick_bit_settings
-- ============================================================
DROP POLICY IF EXISTS "quick_bit_settings_select" ON public.quick_bit_settings;
DROP POLICY IF EXISTS "quick_bit_settings_insert" ON public.quick_bit_settings;
DROP POLICY IF EXISTS "quick_bit_settings_update" ON public.quick_bit_settings;
DROP POLICY IF EXISTS "quick_bit_settings_delete" ON public.quick_bit_settings;

CREATE POLICY "quick_bit_settings_select" ON public.quick_bit_settings FOR SELECT USING (user_id = (select auth.uid())::text);
CREATE POLICY "quick_bit_settings_insert" ON public.quick_bit_settings FOR INSERT WITH CHECK (user_id = (select auth.uid())::text);
CREATE POLICY "quick_bit_settings_update" ON public.quick_bit_settings FOR UPDATE USING (user_id = (select auth.uid())::text) WITH CHECK (user_id = (select auth.uid())::text);
CREATE POLICY "quick_bit_settings_delete" ON public.quick_bit_settings FOR DELETE USING (user_id = (select auth.uid())::text);

-- ============================================================
-- smart_folders
-- ============================================================
DROP POLICY IF EXISTS "smart_folders_select" ON public.smart_folders;
DROP POLICY IF EXISTS "smart_folders_insert" ON public.smart_folders;
DROP POLICY IF EXISTS "smart_folders_update" ON public.smart_folders;
DROP POLICY IF EXISTS "smart_folders_delete" ON public.smart_folders;

CREATE POLICY "smart_folders_select" ON public.smart_folders FOR SELECT USING (user_id = (select auth.uid())::text);
CREATE POLICY "smart_folders_insert" ON public.smart_folders FOR INSERT WITH CHECK (user_id = (select auth.uid())::text);
CREATE POLICY "smart_folders_update" ON public.smart_folders FOR UPDATE USING (user_id = (select auth.uid())::text) WITH CHECK (user_id = (select auth.uid())::text);
CREATE POLICY "smart_folders_delete" ON public.smart_folders FOR DELETE USING (user_id = (select auth.uid())::text);

-- ============================================================
-- vault_settings
-- ============================================================
DROP POLICY IF EXISTS "vault_settings_select" ON public.vault_settings;
DROP POLICY IF EXISTS "vault_settings_insert" ON public.vault_settings;
DROP POLICY IF EXISTS "vault_settings_update" ON public.vault_settings;
DROP POLICY IF EXISTS "vault_settings_delete" ON public.vault_settings;

CREATE POLICY "vault_settings_select" ON public.vault_settings FOR SELECT USING (user_id = (select auth.uid())::text);
CREATE POLICY "vault_settings_insert" ON public.vault_settings FOR INSERT WITH CHECK (user_id = (select auth.uid())::text);
CREATE POLICY "vault_settings_update" ON public.vault_settings FOR UPDATE USING (user_id = (select auth.uid())::text) WITH CHECK (user_id = (select auth.uid())::text);
CREATE POLICY "vault_settings_delete" ON public.vault_settings FOR DELETE USING (user_id = (select auth.uid())::text);

-- ============================================================
-- ai_usage  (user_id is uuid — no ::text cast needed)
-- ============================================================
DROP POLICY IF EXISTS "ai_usage_select" ON public.ai_usage;
DROP POLICY IF EXISTS "ai_usage_insert" ON public.ai_usage;
DROP POLICY IF EXISTS "ai_usage_update" ON public.ai_usage;
DROP POLICY IF EXISTS "ai_usage_delete" ON public.ai_usage;

CREATE POLICY "ai_usage_select" ON public.ai_usage FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "ai_usage_insert" ON public.ai_usage FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "ai_usage_update" ON public.ai_usage FOR UPDATE USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "ai_usage_delete" ON public.ai_usage FOR DELETE USING (user_id = (select auth.uid()));

-- ============================================================
-- user_api_keys  (user_id is uuid)
-- ============================================================
DROP POLICY IF EXISTS "user_api_keys_select" ON public.user_api_keys;
DROP POLICY IF EXISTS "user_api_keys_insert" ON public.user_api_keys;
DROP POLICY IF EXISTS "user_api_keys_update" ON public.user_api_keys;
DROP POLICY IF EXISTS "user_api_keys_delete" ON public.user_api_keys;

CREATE POLICY "user_api_keys_select" ON public.user_api_keys FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "user_api_keys_insert" ON public.user_api_keys FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "user_api_keys_update" ON public.user_api_keys FOR UPDATE USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "user_api_keys_delete" ON public.user_api_keys FOR DELETE USING (user_id = (select auth.uid()));

-- ============================================================
-- user_settings  (user_id is uuid)
-- ============================================================
DROP POLICY IF EXISTS "user_settings_select" ON public.user_settings;
DROP POLICY IF EXISTS "user_settings_insert" ON public.user_settings;
DROP POLICY IF EXISTS "user_settings_update" ON public.user_settings;
DROP POLICY IF EXISTS "user_settings_delete" ON public.user_settings;

CREATE POLICY "user_settings_select" ON public.user_settings FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "user_settings_insert" ON public.user_settings FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "user_settings_update" ON public.user_settings FOR UPDATE USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "user_settings_delete" ON public.user_settings FOR DELETE USING (user_id = (select auth.uid()));

-- ============================================================
-- note_versions  (no user_id — join through notes)
-- ============================================================
DROP POLICY IF EXISTS "note_versions_select" ON public.note_versions;
DROP POLICY IF EXISTS "note_versions_insert" ON public.note_versions;
DROP POLICY IF EXISTS "note_versions_update" ON public.note_versions;
DROP POLICY IF EXISTS "note_versions_delete" ON public.note_versions;

CREATE POLICY "note_versions_select" ON public.note_versions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.notes WHERE notes.id = note_versions.note_id AND notes.user_id = (select auth.uid())::text));
CREATE POLICY "note_versions_insert" ON public.note_versions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.notes WHERE notes.id = note_versions.note_id AND notes.user_id = (select auth.uid())::text));
CREATE POLICY "note_versions_update" ON public.note_versions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.notes WHERE notes.id = note_versions.note_id AND notes.user_id = (select auth.uid())::text))
  WITH CHECK (EXISTS (SELECT 1 FROM public.notes WHERE notes.id = note_versions.note_id AND notes.user_id = (select auth.uid())::text));
CREATE POLICY "note_versions_delete" ON public.note_versions FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.notes WHERE notes.id = note_versions.note_id AND notes.user_id = (select auth.uid())::text));

-- ============================================================
-- users  (id is varchar; UPDATE guards storage_tier from self-promotion)
-- ============================================================
DROP POLICY IF EXISTS "users_select" ON public.users;
DROP POLICY IF EXISTS "users_insert" ON public.users;
DROP POLICY IF EXISTS "users_update" ON public.users;
DROP POLICY IF EXISTS "users_delete" ON public.users;

CREATE POLICY "users_select" ON public.users FOR SELECT USING (id = (select auth.uid())::text);
CREATE POLICY "users_insert" ON public.users FOR INSERT WITH CHECK (id = (select auth.uid())::text);
CREATE POLICY "users_update" ON public.users FOR UPDATE
  USING (id = (select auth.uid())::text)
  WITH CHECK (id = (select auth.uid())::text AND storage_tier = (SELECT u.storage_tier FROM public.users u WHERE u.id = (select auth.uid())::text));
CREATE POLICY "users_delete" ON public.users FOR DELETE USING (id = (select auth.uid())::text);

-- ============================================================
-- templates  (user_id is varchar; presets are readable by everyone)
-- ============================================================
DROP POLICY IF EXISTS "templates_select" ON public.templates;
DROP POLICY IF EXISTS "templates_insert" ON public.templates;
DROP POLICY IF EXISTS "templates_update" ON public.templates;
DROP POLICY IF EXISTS "templates_delete" ON public.templates;

CREATE POLICY "templates_select" ON public.templates
  FOR SELECT USING (user_id = (select auth.uid())::text OR is_preset = true);
CREATE POLICY "templates_insert" ON public.templates
  FOR INSERT WITH CHECK (user_id = (select auth.uid())::text);
CREATE POLICY "templates_update" ON public.templates
  FOR UPDATE
  USING (user_id = (select auth.uid())::text)
  WITH CHECK (user_id = (select auth.uid())::text);
CREATE POLICY "templates_delete" ON public.templates
  FOR DELETE USING (user_id = (select auth.uid())::text);
