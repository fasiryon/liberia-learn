# Queue Processing Rules

Drop a .md file into QUEUE/ with one of these prefixes:

| Prefix | Output folder | Purpose |
|--------|--------------|---------|
| RESEARCH- | GENERATED/briefings/ | Research brief |
| DRAFT- | GENERATED/drafts/ | Content draft |
| AUDIT- | GENERATED/audits/ | Audit report |
| SPRINT-REVIEW- | GENERATED/reviews/ | Sprint review |
| BRIEF-MOE- | GENERATED/briefings/ | MOE document |

Files without a recognised prefix land in GENERATED/misc/.

Files are renamed _DONE.md on success or _FAILED.md on error.
