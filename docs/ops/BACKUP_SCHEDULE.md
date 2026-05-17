# Nightly Backup Schedule — LiberiaLearn

## Overview

LiberiaLearn runs an automated nightly CSV backup of all core student data to Vercel Blob private storage. Backups are triggered by a Vercel cron job at 02:00 UTC and retained for 90 days.

---

## Schedule

| Job | Cron | Route | Notes |
|-----|------|-------|-------|
| Nightly Backup | `0 2 * * *` | `/api/cron/nightly-backup` | Runs at 02:00 UTC (approx. 09:00 WAT) |

Authentication: `Authorization: Bearer $CRON_SECRET` — Vercel injects this automatically.

---

## What is Backed Up

| File | Records | Limit | Notes |
|------|---------|-------|-------|
| `students.csv` | All students | Unbounded | Name, grade, schoolId, createdAt |
| `grades.csv` | Grade records | 50,000 most recent | studentId, classId, score, createdAt |
| `attendance.csv` | Attendance records | 50,000 most recent | studentId, classId, date, status |

Fields containing commas, quotes, or newlines are RFC 4180–escaped.

---

## Blob Storage Paths

```
backups/
  2026-05-17/
    students.csv
    grades.csv
    attendance.csv
  2026-05-16/
    ...
```

- Access: **private** (not publicly listable or downloadable without blob token)
- Blob store: Vercel Blob (`BLOB_READ_WRITE_TOKEN` env var)
- Retention: **90 days** — blobs older than 90 days are deleted automatically during each backup run

---

## Retention Policy

- Blobs at `backups/` prefix older than 90 days (`uploadedAt < now - 90d`) are enumerated via `list()` and batch-deleted via `del()`.
- Prune failure is non-fatal — the backup completes and the prune error is logged silently.
- At steady state, ~90 daily snapshots exist in blob storage.

---

## Recovery Procedure

### Step 1 — List available backups

```bash
# Via Vercel Blob dashboard:
# https://vercel.com/dashboard → Storage → Blob → Browse → backups/

# Or via API:
curl -H "Authorization: Bearer $BLOB_READ_WRITE_TOKEN" \
  "https://blob.vercel-storage.com/?prefix=backups/"
```

### Step 2 — Download the target backup

```bash
# Download a specific day's files (replace DATE with e.g. 2026-05-17):
curl -o students.csv  "https://<BLOB_STORE>.public.blob.vercel-storage.com/backups/DATE/students.csv"
curl -o grades.csv    "https://<BLOB_STORE>.public.blob.vercel-storage.com/backups/DATE/grades.csv"
curl -o attendance.csv "https://<BLOB_STORE>.public.blob.vercel-storage.com/backups/DATE/attendance.csv"
```

### Step 3 — Import into Postgres

```sql
-- In Supabase SQL editor or psql:
\COPY "Student" (id, ...) FROM 'students.csv' WITH (FORMAT csv, HEADER true);
\COPY "Grade"   (id, ...) FROM 'grades.csv'   WITH (FORMAT csv, HEADER true);
\COPY "Attendance" (id, ...) FROM 'attendance.csv' WITH (FORMAT csv, HEADER true);
```

Adjust column list to match current schema before importing. Run in a transaction with a test rollback first.

---

## RTO / RPO Targets

| Target | Value | Notes |
|--------|-------|-------|
| **RPO** (Recovery Point Objective) | 24 hours | At most one day of data at risk — last successful backup |
| **RTO** (Recovery Time Objective) | 4 hours | Time from decision to restored production DB |
| Backup verification | Weekly | Spot-check by downloading one day's `students.csv` and row-counting |

---

## Monitoring

- Each backup run returns `{ backed_up: ["students", "grades", "attendance"], date: "2026-05-17" }`.
- If a file fails to upload, it is omitted from `backed_up` (partial backup is still committed).
- Vercel cron logs are viewable at: **Vercel Dashboard → Project → Logs → Cron**.
- Alert on missing runs: if `backed_up` does not include all 3 keys by 03:00 UTC, page the on-call engineer.

---

## Env Vars Required

| Variable | Purpose |
|----------|---------|
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob write access |
| `CRON_SECRET` | Authenticates the cron POST request |
| `DATABASE_URL` / `DIRECT_URL` | Prisma DB connection |
