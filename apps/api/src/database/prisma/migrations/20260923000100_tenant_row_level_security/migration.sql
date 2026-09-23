-- ====================================================================
-- Tenant Row-Level Security (defence in depth behind the Prisma tenant extension)
--
-- Every statement the API issues runs in a transaction that sets, via set_config(..., true):
--   app.current_coaching_id  the tenant of the current request/job, or
--   app.rls_bypass = 'on'    for explicit RequestContextService.runAsSystem() operations
-- With neither set, tenant tables return no rows and reject writes (fail closed).
--
-- FORCE applies the policies to the table owner too. Superusers and roles with BYPASSRLS
-- still skip RLS entirely, so the API must connect as an ordinary role (checked at startup).
-- ====================================================================

DO $$
DECLARE
  tbl text;
  tenant_tables text[] := ARRAY[
    'users',
    'user_roles',
    'students',
    'parents',
    'student_parents',
    'teachers',
    'batches',
    'batch_students',
    'teacher_batches',
    'attendance_sessions',
    'attendance_records',
    'tests',
    'test_results',
    'homework',
    'fee_plans',
    'fee_installments',
    'fee_transactions',
    'salaries',
    'expenses',
    'notification_history',
    'student_timeline',
    'risk_scores',
    'subscriptions',
    'ai_credit_wallets',
    'settings',
    'audit_logs',
    'notices',
    'coaching_knowledge_bases',
    'coaching_knowledge_chunks'
  ];
BEGIN
  FOREACH tbl IN ARRAY tenant_tables
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', tbl);
    EXECUTE format(
      $policy$
      CREATE POLICY tenant_isolation_policy ON %I
        FOR ALL
        USING (
          current_setting('app.rls_bypass', true) = 'on'
          OR coaching_id = NULLIF(current_setting('app.current_coaching_id', true), '')::uuid
        )
        WITH CHECK (
          current_setting('app.rls_bypass', true) = 'on'
          OR coaching_id = NULLIF(current_setting('app.current_coaching_id', true), '')::uuid
        )
      $policy$,
      tbl
    );
  END LOOP;
END $$;

-- Approximate nearest-neighbour index for RAG similarity search (cosine distance, <=> operator)
CREATE INDEX IF NOT EXISTS coaching_knowledge_chunks_embedding_hnsw_idx
  ON coaching_knowledge_chunks USING hnsw (embedding vector_cosine_ops);
