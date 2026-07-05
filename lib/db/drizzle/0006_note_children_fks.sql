-- X-R1 / X-R2: foreign keys so a note's attachments and version snapshots can't
-- be orphaned when the note is hard-deleted.
--
-- Applied to the Graphe Notes production DB on 2026-07-05 via the Supabase MCP
-- (migration `add_note_children_fks_restrict`). Recorded here so the drizzle
-- folder documents the schema history; `drizzle-kit push` sees no diff because
-- the constraint names match its convention and the schema now declares the
-- references.
--
-- ON DELETE RESTRICT is a safety net: the delete paths (permanent-delete route
-- and the purge-deleted cron) clean children first via purgeNoteChildren(); the
-- FK ensures any future path that forgets errors loudly instead of orphaning.

-- Remove version snapshots orphaned by past hard-deletes before adding the FK.
DELETE FROM note_versions v WHERE NOT EXISTS (SELECT 1 FROM notes n WHERE n.id = v.note_id);

ALTER TABLE attachments
  ADD CONSTRAINT attachments_note_id_notes_id_fk
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE note_versions
  ADD CONSTRAINT note_versions_note_id_notes_id_fk
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
