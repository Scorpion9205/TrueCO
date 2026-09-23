-- ====================================================================
-- Same-tenant references
--
-- Row-level security checks the row being written, not the rows it points to, so a write
-- could still link a record to another coaching's student, batch or teacher by id. This
-- trigger rejects any tenant-to-tenant reference whose target belongs to a different
-- coaching than the row itself, whatever code path (ORM, nested connect, raw SQL) wrote it.
--
-- The target lookup runs as the invoking role, so under a tenant context another coaching's
-- row is invisible through RLS and the reference is rejected as well.
-- ====================================================================

CREATE OR REPLACE FUNCTION enforce_same_tenant_reference() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  fk_column    text := TG_ARGV[0];
  target_table text := TG_ARGV[1];
  target_id    uuid;
  target_coaching uuid;
BEGIN
  EXECUTE format('SELECT ($1).%I', fk_column) INTO target_id USING NEW;
  IF target_id IS NULL THEN
    RETURN NEW;
  END IF;

  EXECUTE format('SELECT coaching_id FROM %I WHERE id = $1', target_table)
    INTO target_coaching USING target_id;

  IF target_coaching IS DISTINCT FROM NEW.coaching_id THEN
    RAISE EXCEPTION USING
      ERRCODE = 'foreign_key_violation',
      MESSAGE = format('%s.%s must reference a %s row of the same coaching', TG_TABLE_NAME, fk_column, target_table);
  END IF;

  RETURN NEW;
END $$;

DO $$
DECLARE
  ref text[];
  refs text[][] := ARRAY[
    -- table,                      column,              referenced table
    ARRAY['attendance_records',        'session_id',        'attendance_sessions'],
    ARRAY['attendance_records',        'student_id',        'students'],
    ARRAY['attendance_sessions',       'batch_id',          'batches'],
    ARRAY['batch_students',            'batch_id',          'batches'],
    ARRAY['batch_students',            'student_id',        'students'],
    ARRAY['coaching_knowledge_chunks', 'knowledge_base_id', 'coaching_knowledge_bases'],
    ARRAY['fee_installments',          'fee_plan_id',       'fee_plans'],
    ARRAY['fee_plans',                 'student_id',        'students'],
    ARRAY['fee_transactions',          'installment_id',    'fee_installments'],
    ARRAY['homework',                  'batch_id',          'batches'],
    ARRAY['notices',                   'batch_id',          'batches'],
    ARRAY['risk_scores',               'student_id',        'students'],
    ARRAY['salaries',                  'teacher_id',        'teachers'],
    ARRAY['student_parents',           'parent_id',         'parents'],
    ARRAY['student_parents',           'student_id',        'students'],
    ARRAY['student_timeline',          'student_id',        'students'],
    ARRAY['teacher_batches',           'batch_id',          'batches'],
    ARRAY['teacher_batches',           'teacher_id',        'teachers'],
    ARRAY['teachers',                  'user_id',           'users'],
    ARRAY['test_results',              'student_id',        'students'],
    ARRAY['test_results',              'test_id',           'tests'],
    ARRAY['tests',                     'batch_id',          'batches'],
    ARRAY['user_roles',                'user_id',           'users']
  ];
BEGIN
  FOREACH ref SLICE 1 IN ARRAY refs
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'same_tenant_' || ref[2], ref[1]);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF %I, coaching_id ON %I
         FOR EACH ROW EXECUTE FUNCTION enforce_same_tenant_reference(%L, %L)',
      'same_tenant_' || ref[2], ref[2], ref[1], ref[2], ref[3]
    );
  END LOOP;
END $$;
