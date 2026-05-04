-- Append-only enforcement for audit_logs and a privileged retention purge function.
-- The retention purge function bypasses the no-update/no-delete triggers via
-- `session_replication_role = 'replica'`, scoped to the function call only.

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS audit_logs_no_update ON audit_logs;
--> statement-breakpoint
CREATE TRIGGER audit_logs_no_update
BEFORE UPDATE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
--> statement-breakpoint

DROP TRIGGER IF EXISTS audit_logs_no_delete ON audit_logs;
--> statement-breakpoint
CREATE TRIGGER audit_logs_no_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION audit_logs_retention_purge(retention_days INT)
RETURNS TABLE (deleted INT, cutoff TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ;
  v_deleted INT;
BEGIN
  IF retention_days IS NULL OR retention_days <= 0 THEN
    RETURN QUERY SELECT 0, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  v_cutoff := now() - (retention_days || ' days')::interval;

  SET LOCAL session_replication_role = 'replica';
  WITH del AS (
    DELETE FROM audit_logs WHERE created_at < v_cutoff RETURNING 1
  )
  SELECT COUNT(*)::INT INTO v_deleted FROM del;

  RETURN QUERY SELECT v_deleted, v_cutoff;
END;
$$;
