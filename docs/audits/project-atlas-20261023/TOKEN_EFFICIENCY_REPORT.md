# Token efficiency report

| Measure | Count |
| --- | --- |
| repository_files_discovered | 5782 |
| candidate_files_identified | 493 |
| runtime_candidate_files | 185 |
| files_inspected_in_detail | 244 |
| cached_evidence_records | 792 |
| unique_registry_entries | 121 |
| logical_runtime_groups_excluding_dispatchers | 58 |
| duplicate_path_references_eliminated | 6 |
| aliases_mapped | 15 |
| unique_flag_names | 145 |
| flag_reference_count | 473 |
| curated_evidence_records | 234 |
| discovery_only_evidence_records | 558 |

The fingerprinted evidence index separates source-confirmed records from pattern leads. Detail inspection count is the unique union of reviewers' declared paths; source discovery is an automated scan, not full-body human review. Duplicate path references counts repeated implementation references removed across the registry, not the number of redundant agents. Aliases are mapped explicitly; no false exact count of duplicate names removed is inferred from filenames.

Intentionally sampled: UI/device/accessibility journeys; full route-by-route authorization; ancillary generation CLIs; historical branches beyond four pinned contexts; all operational detector/prediction/optimization consumers; current hosted deployment and learner outcome evidence unavailable.

Remaining uncertainty: Current production agent invocation counts/flags/costs; n8n and external schedules; Vercel schedule plan and disable state; full dynamic call graph and every privileged SDK permission; fresh dependency advisories; deployed RLS/MFA/restore readiness; qualified academic review and retained outcomes.

No token-savings percentage is claimed. Actual model-token measurements were unavailable. No previous audit was adopted wholesale as a current fact: older findings were rechecked or labeled dated; source blobs and raw-byte SHA256 enable future reuse without rereading unchanged source.
