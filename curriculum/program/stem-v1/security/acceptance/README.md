# Security acceptance records (CoS independent review)

One file per finding: `<finding id>.json`, written by the CoS reviewer after re-verifying the implementer's evidence. The program builder refuses a risk-register status of COS_PASS, COS_REVISE, COS_BLOCKED, FIXED_AWAITING_MERGE or FIXED without a valid record.

```json
{
  "finding": "SEC-R03",
  "decision": "PASS | REVISE | BLOCKED",
  "implementer": "Codex: Project Atlas task",
  "branch": "audit/project-atlas-security-triage",
  "testCommit": "<sha of the commit that adds the failing regression test>",
  "fixCommit": "<sha of the separate commit that applies the repair>",
  "failingBeforeFix": { "commit": "<testCommit>", "command": "<exact command>", "result": "FAIL", "log": "<path>", "logSha256": "<sha>" },
  "passingAfterFix": { "commit": "<fixCommit>", "command": "<exact command>", "result": "PASS", "log": "<path>", "logSha256": "<sha>" },
  "typecheck": { "commit": "<fixCommit>", "result": "PASS" },
  "adjacentChecks": ["<route or path checked, and result>"],
  "safeFailure": "<how the repair behaves when a dependency fails>",
  "learningWorkflowPreserved": "<evidence that honest learner flows still work>",
  "independentReview": { "reviewer": "<security-auditor agent / CoS>", "result": "PASS | FINDINGS", "notes": "<...>" },
  "reviewedAt": "<ISO time>",
  "reasons": ["<for REVISE or BLOCKED: exactly what must change>"]
}
```

PASS requires a FAIL-before / PASS-after pair on separate commits, TypeScript PASS, at least one adjacent check and an independent review without unresolved findings. No record claims a merge or deployment; FIXED additionally requires the founder's merge authorization reference.
