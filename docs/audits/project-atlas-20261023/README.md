# Project Atlas audit

Base `887f23eccbe5b194c2e7ff93c0b09c843549a9eb`. Audit branch `audit/project-atlas-20261023`. All authored files are confined to this directory in the isolated worktree. Main and all other worktrees were preserved.

Start with [EXECUTIVE_BRIEF.md](EXECUTIVE_BRIEF.md). The ten requested outputs are AGENT_INVENTORY.md, AGENT_DEPENDENCY_MAP.md, ACTIVATION_DECISIONS.md, PLATFORM_CAPABILITY_MATRIX.md, STRATEGIC_GAP_ANALYSIS.md, RISK_REGISTER.md, PRIORITIZED_ROADMAP.md, EXECUTIVE_BRIEF.md, AGENT_INVENTORY.csv and AUDIT_EVIDENCE.json.

[AGENT_REGISTRY.json](AGENT_REGISTRY.json) is the canonical proposed registry. Markdown and CSV views are generated from it by build_reports.py; review JSON/Markdown files are frozen reviewer inputs, not independent registries to maintain. CANDIDATES.json holds deterministic discovery, import and blob metadata; DISCOVERY_COVERAGE.json reconciles candidate paths; FEATURE_FLAG_REFERENCES.json/.csv indexes source flag references without environment values; BRANCH_CONTEXT.json pins four in-flight documentation contexts. No secrets, raw student records or protected assessment keys are included.

Evidence codes and limitations are in AUDIT_EVIDENCE.json. Production activity is unknown; an empty connected GitHub PR-run query is recorded with its narrow limitations. Candidate counts, source-confirmed capability groups and workflow dispatchers must not be conflated. For future updates, compare source_commit/git_blob/fingerprint and reread only changed evidence. Do not invoke agents or application scripts to regenerate this documentation.

Reproduction: discover.py creates cheap tracked-source metadata; enrich_discovery.py adds targeted provider/flag metadata; supplement.py and the frozen domain review inputs supply judged records; branch_context.py pins selected branch documentation; build_reports.py renders normalized outputs; validate_reports.py checks integrity. Discovery scripts scan source, and do not execute application imports. All runtime testing and hosted verification remain separate authorized work.
