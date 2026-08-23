BEGIN TRANSACTION READ ONLY;

SELECT json_build_object(
  'currentUser', current_user,
  'publicBaseline',
    (SELECT array_agg(c.relname::text ORDER BY c.relname)
       FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r') = ARRAY[
        'ai_usage','attachments','folders','note_versions','notes',
        'quick_bit_settings','quick_bits','smart_folders','templates',
        'user_api_keys','user_settings','users','vault_settings'
      ]::text[]
    AND (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity) = 13
    AND (SELECT count(*) FROM pg_policies WHERE schemaname='public') = 52
    AND (SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname IN (
          'attachments_user_id_idx','attachments_note_id_idx',
          'attachments_note_id_created_at_idx','note_versions_user_id_idx',
          'note_versions_note_id_created_at_idx','notes_user_id_deleted_at_idx')) = 6
    AND (SELECT count(*) FROM pg_constraint WHERE conname IN (
          'attachments_note_id_notes_id_fk','note_versions_note_id_notes_id_fk')
          AND confdeltype='r') = 2,
  'publicExecuteRevoked',
    to_regprocedure('public.rls_auto_enable()') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM pg_proc p
      CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f',p.proowner))) acl
      WHERE p.oid='public.rls_auto_enable()'::regprocedure
        AND acl.grantee=0 AND acl.privilege_type='EXECUTE'),
  'privateTableReady',
    to_regclass('private.attachment_upload_reservations') IS NOT NULL
    AND (SELECT relrowsecurity FROM pg_class
          WHERE oid='private.attachment_upload_reservations'::regclass)
    AND (SELECT count(*) FROM pg_constraint
          WHERE conrelid='private.attachment_upload_reservations'::regclass
            AND contype='f') = 0,
  'runtimePrivileges',
    has_schema_privilege(current_user,'private','USAGE')
    AND has_table_privilege(current_user,'private.attachment_upload_reservations',
      'SELECT,INSERT,UPDATE,DELETE'),
  'clientPrivilegesRevoked',
    NOT has_schema_privilege('anon','private','USAGE')
    AND NOT has_schema_privilege('authenticated','private','USAGE')
    AND NOT has_table_privilege('anon','private.attachment_upload_reservations','SELECT,INSERT,UPDATE,DELETE')
    AND NOT has_table_privilege('authenticated','private.attachment_upload_reservations','SELECT,INSERT,UPDATE,DELETE')
);

ROLLBACK;
