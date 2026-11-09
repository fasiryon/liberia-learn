# Project Atlas executive brief

LiberiaLearn has substantial reusable school operations, governed learner-state foundations, bounded AI orchestration and human-review controls. The main problem is completing and validating academic workflows, content quality and operational authority before expanding activation. A rewrite is not justified.

At main `887f23ecc`, the proposed registry has **121 entries**: 43 LLM, 5 LLM infrastructure, 9 deterministic workflow, 37 scheduled automation, 1 external workflow, 26 documentation-only persona. These include **37 scheduler/workflow dispatchers and 26 documentation personas**, not 121 independent AI agents. **0 production-active agents confirmed; 2 configured-disabled entries; 2 test-only; 0 confirmed obsolete**. Remaining live activation is unknown. See [catalog](AGENT_INVENTORY.md) for exact status counts and grouping.

Two HIGH code defects merit P0 repair. School administrators can read global raw agent invocation rows through `/api/admin/agents/invocations`. Student offline sync can overwrite canonical teacher attendance using newer device timestamps. Production exploitation was not observed. Evidence: [invocation route](../../../app/api/admin/agents/invocations/route.ts#L45), [attendance policy](../../../lib/offline-sync/policies.ts#L27), SEC-R01/02 in [risk register](RISK_REGISTER.md).

The five largest gaps are academically admitted full-day K-12 content, governed diagnostic/remediation coverage beyond G4 Math, complete independent-assessment-to-records integration, demonstrated retention/transfer/intervention outcomes, and reliable low-connectivity operations. The frozen Oct16 catalog baseline reports 0 mechanical passes among 1,105 revisions and says every judgment review is pending; it is dated repository evidence, not a new production audit. [Baseline](../../../docs/curriculum/modernization/LIBRARY_QUALITY_BASELINE_V1.md#L3), [governed registry](../../../lib/learning-authority/publishedReleases.ts#L1), [V2 write hold](../../../lib/assessment/v2/consumers.ts#L26).

Prioritize these five actions:

1. Close cross-school invocation access and student-authored canonical attendance, with hostile two-school/teacher-record checks.
2. Repair WAEC attempt replay and lab suggested-score/refusal attribution before admitting those signals as attainment.
3. Finish one exact-version, independently reviewed schoolday under the existing CoS program gates, with missing resources explicit.
4. Complete one approved Assessment V2 → human moderation → official-reader slice; retain downstream-write holds until proven.
5. Verify job identity/handler support, full restore, costs and effective flags; then run a measured retention/transfer pilot.

Useful consolidation is narrow: teacher planner/grader contracts, legacy generation entry points, health ownership and cost ledgers. The tutor already uses a shared grounded engine; `router.ts` already re-exports the provider router. Keep these. The factory's eight roles are injected workflow stages, not eight autonomous agents. MergeOps write policy remains disabled. n8n/hosted workflows, current flags, current dependency advisories and current learning outcomes require external verification. See [architecture](AGENT_DEPENDENCY_MAP.md), [activation decisions](ACTIVATION_DECISIONS.md) and [roadmap](PRIORITIZED_ROADMAP.md).

Koloqua and Kindergarten admission are additional inclusion gaps: current locales are en/kpe/bss and enrollment accepts grades 1–12. Existing narration/localization and schoolday planning provide a starting point. [Locale registry](../../../i18n.ts#L4), [learning review](learning-review.md).

No application code, schema, production configuration, flags, database records or other agents' worktrees were modified. In-flight branches were read through pinned Git objects. A [Chief of Staff handoff](CHIEF_OF_STAFF_HANDOFF.md) is prepared in this audit workspace; no external message was sent. [Token efficiency report](TOKEN_EFFICIENCY_REPORT.md) records scope and sampling.
