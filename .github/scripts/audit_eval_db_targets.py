"""Temporary diagnostic: no application imports, writes, or raw error logging."""
import datetime
import hashlib
import json
import os
import re
import subprocess
import urllib.parse

MIGRATION = "20261013_000001_content_bundle_scheduledwork_pins"
# Reuse reviewed same-day evidence; never reconnect to these known targets.
VERIFIED = {
    "bnphuinpvgpmebcsvmsp": "2026-10-14T17:42:56Z; public and archived Prisma ledgers",
    "yonpfzjczoffhrgibxkz": "2026-10-14T17:57:50Z; public Prisma ledger",
}
EVIDENCE_DATE = datetime.date(2026, 10, 14)


def parse_target(value):
    if not value or value != value.strip() or "\n" in value or "\r" in value:
        raise ValueError("INVALID_CONNECTION_SETTING")
    url = urllib.parse.urlsplit(value)
    if url.scheme not in ("postgres", "postgresql") or not url.hostname or url.fragment:
        raise ValueError("INVALID_CONNECTION_SETTING")
    if not url.username or not url.path or url.path == "/":
        raise ValueError("INCOMPLETE_CONNECTION_SETTING")
    host = url.hostname.lower()
    user = urllib.parse.unquote(url.username)
    database = urllib.parse.unquote(url.path[1:])
    port = url.port or 5432
    overrides = {key.lower() for key in urllib.parse.parse_qs(url.query)}
    if overrides & {"host", "hostaddr", "port", "user", "password", "dbname", "service"}:
        raise ValueError("CONNECTION_TARGET_OVERRIDE")
    project = None
    direct = re.fullmatch(r"db\.([a-z]{20})\.supabase\.co", host)
    pooler = re.fullmatch(r"[a-z0-9-]+\.pooler\.supabase\.com", host)
    if direct:
        project = direct.group(1)
    elif pooler and "." in user and re.fullmatch(r"[a-z]{20}", user.rsplit(".", 1)[1]):
        project = user.rsplit(".", 1)[1]
    fingerprint = hashlib.sha256(f"{host}|{port}|{database}".encode()).hexdigest()[:16]
    return {
        "host": host, "port": port, "user": user, "database": database,
        "password": urllib.parse.unquote(url.password or ""),
        "project": project, "fingerprint": fingerprint,
    }


def read_json(target, sql):
    # Never place the URL/password in arguments or print subprocess stderr.
    env = {k: v for k, v in os.environ.items() if not k.startswith("PG")}
    env.update({
        "PGHOST": target["host"], "PGPORT": str(target["port"]),
        "PGDATABASE": target["database"], "PGUSER": target["user"],
        "PGPASSWORD": target["password"], "PGSSLMODE": "require",
        "PGCONNECT_TIMEOUT": "8", "PGPASSFILE": os.devnull,
        "PGOPTIONS": "-c default_transaction_read_only=on -c statement_timeout=10000 -c lock_timeout=3000",
    })
    result = subprocess.run(
        ["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-c",
         f"BEGIN READ ONLY; {sql} ROLLBACK;"],
        env=env, capture_output=True, text=True, timeout=20, check=False,
    )
    if result.returncode:
        raise RuntimeError("READ_ONLY_LEDGER_QUERY_FAILED")
    return json.loads(result.stdout.strip())


def audit_setting(name, value, today=None):
    result = {"setting": name, "status": "UNVERIFIED"}
    try:
        target = parse_target(value)
        result["targetFingerprint"] = target["fingerprint"]
        if target["project"]:
            result["supabaseProjectRef"] = target["project"]
        if target["project"] in VERIFIED and target["database"] == "postgres" and target["port"] in (5432, 6543):
            if (today or datetime.datetime.now(datetime.timezone.utc).date()) != EVIDENCE_DATE:
                result["reason"] = "REVIEWED_EVIDENCE_EXPIRED"
                return result
            result.update(status="NOT_APPLIED", source="REUSED_AUTHORITATIVE_LEDGER_EVIDENCE",
                          evidence=VERIFIED[target["project"]])
            return result
        schemas = read_json(target, "SELECT coalesce(json_agg(table_schema ORDER BY table_schema), '[]'::json) FROM information_schema.tables WHERE table_name = '_prisma_migrations';")
        if not schemas:
            result["reason"] = "NO_VISIBLE_PRISMA_LEDGER"
            return result
        ledgers = []
        for schema in schemas:
            identifier = '"' + schema.replace('"', '""') + '"'
            rows = read_json(target, f"SELECT coalesce(json_agg(row_to_json(m)), '[]'::json) FROM (SELECT migration_name, checksum, finished_at, rolled_back_at, applied_steps_count FROM {identifier}.\"_prisma_migrations\" WHERE migration_name = '{MIGRATION}') m;")
            ledgers.append({"schema": schema, "rows": rows})
        result.update(status="APPLIED" if any(x["rows"] for x in ledgers) else "NOT_APPLIED",
                      source="READ_ONLY_PRISMA_LEDGER_QUERY", ledgers=ledgers)
    except Exception:
        # Exceptions may contain connection credentials; expose a fixed reason only.
        result["reason"] = "INVALID_SETTING_OR_READ_ONLY_LEDGER_CHECK_FAILED"
    return result


def main():
    results = [audit_setting(name, os.environ.get(name, ""))
               for name in ("DATABASE_URL", "DIRECT_URL")]
    print(json.dumps({"migration": MIGRATION, "observedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                      "results": results}, sort_keys=True))
    return 0 if all(x["status"] == "NOT_APPLIED" for x in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
