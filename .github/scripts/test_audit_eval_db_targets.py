import datetime
import json
import subprocess
import unittest
from unittest.mock import patch

import audit_eval_db_targets as audit


class DiagnosticSafetyTests(unittest.TestCase):
    known = "postgresql://postgres.bnphuinpvgpmebcsvmsp:synthetic-only@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
    unknown = "postgresql://reader:synthetic-only@other-db.example:5432/postgres"

    def test_known_database_reuses_evidence_without_connecting(self):
        with patch.object(audit, "read_json") as query:
            result = audit.audit_setting("DATABASE_URL", self.known, audit.EVIDENCE_DATE)
        self.assertEqual(result["status"], "NOT_APPLIED")
        query.assert_not_called()
        self.assertNotIn("synthetic-only", json.dumps(result))

    def test_known_project_different_database_does_not_reuse_evidence(self):
        with patch.object(audit, "read_json", return_value=[]) as query:
            result = audit.audit_setting("DIRECT_URL", self.known.replace("/postgres", "/different"))
        self.assertEqual(result["status"], "UNVERIFIED")
        query.assert_called_once()

    def test_lookalike_host_never_reuses_evidence(self):
        value = "postgresql://postgres:x@db.bnphuinpvgpmebcsvmsp.supabase.co.evil.example/postgres"
        self.assertIsNone(audit.parse_target(value)["project"])

    def test_connection_target_override_never_reuses_evidence(self):
        with patch.object(audit, "read_json") as query:
            result = audit.audit_setting("DATABASE_URL", self.known + "?host=other-db.example")
        self.assertEqual(result["status"], "UNVERIFIED")
        query.assert_not_called()

    def test_expired_evidence_fails_closed_without_reconnecting(self):
        with patch.object(audit, "read_json") as query:
            result = audit.audit_setting("DATABASE_URL", self.known, datetime.date(2026, 10, 15))
        self.assertEqual(result["status"], "UNVERIFIED")
        query.assert_not_called()

    def test_missing_or_invalid_settings_never_connect(self):
        for value in ("", "not-a-url", self.known + "\n", "https://example.com", "postgresql://user@host"):
            with self.subTest(value=value), patch.object(audit, "read_json") as query:
                self.assertEqual(audit.audit_setting("DIRECT_URL", value)["status"], "UNVERIFIED")
                query.assert_not_called()

    def test_missing_ledger_is_unverified(self):
        with patch.object(audit, "read_json", return_value=[]):
            self.assertEqual(audit.audit_setting("DATABASE_URL", self.unknown)["status"], "UNVERIFIED")

    def test_empty_current_and_archived_ledgers_prove_absence(self):
        with patch.object(audit, "read_json", side_effect=[["public", "archive"], [], []]):
            result = audit.audit_setting("DATABASE_URL", self.unknown)
        self.assertEqual(result["status"], "NOT_APPLIED")
        self.assertEqual(len(result["ledgers"]), 2)

    def test_any_matching_attempt_holds_push_even_if_rolled_back(self):
        with patch.object(audit, "read_json", side_effect=[["public"], [{"rolled_back_at": "2026-10-13"}]]):
            self.assertEqual(audit.audit_setting("DATABASE_URL", self.unknown)["status"], "APPLIED")

    def test_connection_failure_never_leaks_error_or_certifies_absence(self):
        with patch.object(audit, "read_json", side_effect=RuntimeError("synthetic-secret")):
            result = audit.audit_setting("DATABASE_URL", self.unknown)
        self.assertEqual(result["status"], "UNVERIFIED")
        self.assertNotIn("synthetic-secret", json.dumps(result))

    def test_psql_uses_read_only_transaction_and_password_only_in_environment(self):
        completed = subprocess.CompletedProcess([], 0, stdout="[]\n", stderr="")
        with patch.object(subprocess, "run", return_value=completed) as run:
            audit.read_json(audit.parse_target(self.unknown), "SELECT 1;")
        args, kwargs = run.call_args
        self.assertNotIn("synthetic-only", " ".join(args[0]))
        self.assertIn("BEGIN READ ONLY; SELECT 1; ROLLBACK;", args[0])
        self.assertIn("default_transaction_read_only=on", kwargs["env"]["PGOPTIONS"])
        self.assertEqual(kwargs["env"]["PGSSLMODE"], "require")
        self.assertTrue(kwargs["capture_output"])


if __name__ == "__main__":
    unittest.main()
