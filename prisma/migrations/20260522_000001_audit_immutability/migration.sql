-- NR-9: DB-level audit log immutability
-- AuditLog rows are write-once. These triggers enforce that at the Postgres layer,
-- independent of application code, so a compromised admin or app bug cannot tamper
-- with the audit trail.

-- Prevent UPDATE on AuditLog rows
CREATE OR REPLACE FUNCTION prevent_audit_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'Audit log records are immutable and cannot be updated. (row id: %)',
    OLD.id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update
BEFORE UPDATE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_update();

-- Prevent DELETE on AuditLog rows
CREATE OR REPLACE FUNCTION prevent_audit_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'Audit log records are immutable and cannot be deleted. (row id: %)',
    OLD.id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_delete
BEFORE DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_delete();
