-- ====================================================================
-- TrueCO PostgreSQL Row-Level Security (RLS) Policy Initializer
-- Enforces Fail-Closed Defense-in-Depth Multi-Tenancy Isolation
-- ====================================================================

DO $$
DECLARE
  tbl text;
  tenant_tables text[] := ARRAY[
    'users',
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
    'audit_logs'
  ];
BEGIN
  FOREACH tbl IN ARRAY tenant_tables
  LOOP
    -- Enable RLS on table
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', tbl);

    -- Drop existing policy if exists
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I;', tbl);

    -- Create RLS Policy checking app.current_coaching_id
    EXECUTE format(
      'CREATE POLICY tenant_isolation_policy ON %I
       FOR ALL
       USING (coaching_id = NULLIF(current_setting(''app.current_coaching_id'', true), '''')' || '::uuid)
       WITH CHECK (coaching_id = NULLIF(current_setting(''app.current_coaching_id'', true), '''')' || '::uuid);',
      tbl
    );
  END LOOP;
END $$;
