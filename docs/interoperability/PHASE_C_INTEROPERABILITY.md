# Phase C Interoperability

## Current Delivery

LiberiaLearn provides two production data-exchange capabilities:

1. OneRoster 1.2.1 CSV bulk ZIP export, validation, and import for school rosters.
2. xAPI 1.0.3 learning statement JSON export for an external Learning Record Store.

Both capabilities are school scoped, restricted to authenticated school administrators, permission checked where an export releases data, audit logged, and recorded in the data-access log for exports. No database migration or production-live schema change was required.

The OneRoster implementation follows the 1EdTech OneRoster 1.2 CSV binding. It has not been independently certified by 1EdTech. The xAPI implementation produces standards-aligned statements and validates each generated statement before release. LiberiaLearn is not itself an LRS and does not automatically push statements to an LRS.

## OneRoster 1.2.1 Bulk Exchange

### Package Profile

The export is a root-level ZIP with RFC 4180 CSV, UTF-8 text, exact OneRoster header order, and these files:

| File | Status | LiberiaLearn source or destination |
| --- | --- | --- |
| `manifest.csv` | Required | OneRoster 1.2 bulk declarations |
| `orgs.csv` | Required | Current school |
| `academicSessions.csv` | Required | Current or latest academic year and its terms |
| `courses.csv` | Required | One course record per LiberiaLearn class |
| `classes.csv` | Required | School classes |
| `users.csv` | Required | Active students and teachers |
| `roles.csv` | Required | Student and teacher role assignments |
| `enrollments.csv` | Required | Student class enrollment and primary class teacher |
| `demographics.csv` | Optional | Student birth date when present |

Bulk files use blank `status` and `dateLastModified` fields as required by the OneRoster bulk profile. Password fields are always blank on export. An import containing any OneRoster password value is rejected and the value is not retained.

### Field Mapping

| OneRoster concept | LiberiaLearn mapping |
| --- | --- |
| School org | `School.id`, `School.name`, and `School.code` |
| Academic session | Active or latest `AcademicYear` plus terms |
| User | `User` with `STUDENT` or `TEACHER` role |
| Student grade and birth date | `Student.currentGrade` and `Student.dateOfBirth` |
| Course and class | `Class` subject, grade, title, and local class ID |
| Student enrollment | `Enrollment` relation through `Student` |
| Teacher enrollment | `Class.teacherId`; one primary teacher is stored |

Exports carry stable generated OneRoster `sourcedId` values. The `userIds` field includes the local LiberiaLearn user ID and `classCode` includes the local class ID. A LiberiaLearn export can therefore be re-imported without creating duplicate local records. External packages without local identifiers reconcile by school-scoped email, login ID, class title, grade, and subject.

### Validation and Import

The import validator checks:

- the root-level ZIP layout and required manifest;
- exact headers and column counts;
- supported OneRoster and manifest versions;
- valid dates, GUID fields, enum values, and unique `sourcedId` values;
- all user, role, course, class, organization, term, and enrollment references;
- one package school and no cross-school references;
- supported student and teacher roles only;
- no supplied password values.

Admins must validate a package before the import action is enabled. The server validates it again on commit. Imports of 50 operational rows or fewer run directly. Larger imports use the existing FIFO queue and ECS worker, up to 1,500 operational rows per package. Queue failure marks the batch failed instead of falsely reporting it as accepted.

Writes use `DIRECT_URL` and require direct Postgres port 5432 in production. Read queries continue to use the pooled application client. Batch processing atomically claims a tenant-scoped batch, is idempotent after completion, and rejects a worker payload whose school does not match the batch.

New users receive generated temporary credentials and must change them. Credentials are available through the existing one-time credential download. Existing users keep their current credentials and password-change state. Imported accounts, classes, and enrollments remain confined to the selected school. A matching identity belonging to another school is rejected.

### Honest Limits

- The import is a OneRoster bulk workflow. Delta and delete synchronization are not enabled because LiberiaLearn does not yet have an agreed external source system that owns record lifecycle.
- LiberiaLearn currently stores one primary teacher on a class. If a package has multiple teachers, the primary teacher is stored and the limitation is reported as a warning.
- The importer supports student and teacher roles. Other OneRoster role vocabularies are rejected rather than silently remapped.
- This implementation is standards aligned but not independently certified by 1EdTech.

## xAPI Learning Event Export

The export queries real `LearningEvent` and `StudentPerformanceEvent` records for the administrator's school and requested UTC date range. It supports both streams together or either stream independently, with a maximum of 5,000 statements and a maximum date window of 366 days.

Each statement contains the required `actor`, `verb`, and `object`, a deterministic UUID statement ID, an ISO timestamp, and a Statement `version` of `1.0.0` as required by xAPI. The HTTP response advertises `X-Experience-API-Version: 1.0.3`.

Learning events map common actions to established ADL verbs such as experienced, attempted, completed, answered, passed, failed, and interacted. Student performance events include scaled score, ISO 8601 duration, attempt count, subject, grade, and AI-assist context when those fields exist.

### Privacy and Tenant Controls

- Every source query includes the administrator's resolved `schoolId`.
- Performance events also verify the related student's user belongs to that school.
- Student IDs and user IDs are normalized to one canonical learner before pseudonymization.
- Actor account names are stable HMAC-SHA256 pseudonyms, generated from `XAPI_EXPORT_PSEUDONYM_SECRET` or the trimmed `NEXTAUTH_SECRET` fallback.
- Production export fails closed when no sufficiently strong pseudonym secret is configured.
- Names, email addresses, phone numbers, school IDs, raw event metadata, and quality-marker payloads are not copied into statements.
- Every generated statement passes the local xAPI validator before the response is returned.

The output is a JSON array that an external LRS can consume. LiberiaLearn does not currently host an LRS, implement an LRS Statement API, or manage remote LRS credentials and delivery retries.

## Partner-Gated Standards

### LTI

Scoped and ready to build once a specific partner/requirement is named. A real implementation requires an agreed LTI version, platform and tool roles, OIDC login, OAuth key management, deployment IDs, launch claims, and a decision on required LTI Advantage services. Building those choices without a named platform would create an integration that might not match the buyer's environment.

### SCORM

Scoped and ready to build once a specific partner/requirement is named. A real implementation requires the target SCORM edition, content packaging rules, manifest behavior, run-time API behavior, completion and score semantics, and a named LMS for conformance testing.

## Verification Evidence

Automated coverage includes:

- exact OneRoster header and manifest checks;
- RFC 4180 quoting, escaped quotes, commas, and UTF-8 BOM handling;
- missing dependency, cross-school reference, and password rejection;
- a complete users, classes, roles, and enrollments ZIP round trip;
- a production-service mapping round trip from realistic Prisma records through ZIP export and importer parsing;
- xAPI learning and performance mapping, stable pseudonyms, score and duration handling, privacy exclusions, and invalid statement rejection;
- route RBAC, tenant isolation, protocol headers, PII export recording, preview without writes, invalid commit rejection, and queue dispatch;
- worker payload validation and real dispatch for both legacy student import and OneRoster import jobs.

The authoritative standards references are:

- 1EdTech OneRoster 1.2 CSV Tables: <https://www.imsglobal.org/spec/oneroster/v1p2/bind/csv/>
- 1EdTech OneRoster 1.2 specifications: <https://standards.1edtech.org/oneroster/specifications/standards/v1p2>
- ADL xAPI Data specification: <https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md>
