# Memory System

## Operational Memory Architecture

Memory is derived operational knowledge used to improve future workflow decisions. It is not a raw data lake. It must be tenant-scoped, lineage-backed, retention-controlled, and safe for the role requesting it.

## Memory Types

- Tenant operational summaries.
- Agent execution summaries.
- Approved playbooks.
- Curriculum quality findings.
- Intervention outcome summaries.
- Aggregate national trend summaries.
- Incident and rollback lessons.

## Retrieval Strategy

Retrieval must filter by:

- tenant scope
- role authorization
- data sensitivity
- recency
- lineage quality
- approved use case

## Summarization And Compression

Summaries must preserve evidence ids and omit raw PII. Compression must not remove policy-relevant caveats, approval history, or uncertainty.

## Retention Policies

Memory records require retention class, expiration date, sensitivity label, and deletion/archival path. National aggregate memory may outlive tenant operational memory only when it is privacy-safe.

## Vector Retrieval

Vector retrieval is allowed only after tenant partitioning, redaction, retention, and lineage are implemented. Embedding metadata must include tenant and sensitivity scope. Cross-tenant nearest-neighbor search is forbidden unless using approved aggregate-only records.

## Memory Lineage

Every memory item must reference source events or records, generation method, version refs, authoring agent, redaction status, and approval status if used for governance-impacting decisions.

## Tenant Safety

No memory object may be retrieved across schools for non-platform roles. MOE and national retrieval must use aggregate records with cohort suppression and no student identifiers.
