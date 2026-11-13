# SEC-R03 independent implementation review

Verdict: PASS for the examined code-side final-response containment. This is an independent static review of the current implementation diff, not approval to merge, deploy, enable an agent or mark a production incident resolved. Finding status remains subject to CoS exact-commit acceptance.

Reviewed against RED test commit `5ba8f6bc` and the working-tree implementation. The primary executor reports 11 new synthetic checks and 31 related existing checks passing. I inspected the test assertions and implementation but did not rerun tests or start a concurrent heavy job. TypeScript was in progress at review and must be recorded separately by the primary executor.

## Security assessment

- All eight built-in declarations explicitly name their audience. `teaching-runtime` is minor, `liberialearn-family` is guardian, and internal/admin agents remain general. Audience is read from the code registry, not request context, user text or a model's chosen role. Existing declarations receive a stable policy regardless of the trusted system caller used by SMS or classroom infrastructure.
- `moderation.ts` maps UNCERTAIN to UNSAFE for minor and guardian audiences, including timeout, invalid JSON and malformed verdict handling. General behavior remains UNCERTAIN for compatibility. The runtime also independently blocks every public verdict other than SAFE, so a directly mocked UNCERTAIN result cannot bypass release.
- Public input blocks before language detection, translation, model/tool loop or final output. The returned text is a fixed fallback without reflected input. It cannot accidentally release an unchecked model response.
- The first final answer is checked before release. When blocked, a single regeneration is independently checked. If regeneration fails, times out or hits a cap, its result replaces the first candidate; the first unsafe answer is not retained for return. If the second candidate remains blocked, the final public response is the fixed fallback and the invocation remains ESCALATED rather than SUCCESS.
- Public translated output is checked again after translation, closing the otherwise unchecked final transformation. A translated blocked answer is replaced with the same static fallback. No additional translation call is made on the fallback itself. General/internal translation behavior is unchanged.
- The change preserves existing depth, time, spend, feature, role, resource authorization and escalation boundaries. It does not introduce model-approved publication, official grades, safeguarding adjudication or agent activation.

## Tests assessed

`post-audit/tests/moderation-audience.test.ts` uses the real moderator with synthetic provider timeout, invalid JSON and UNCERTAIN outputs for guardian policy, and retains a general behavior control. `runtime-audience.test.ts` uses the real registry/runtime with synthetic agents, covers public input rejection before model completion, public output rejection across regeneration, post-translation rejection, internal behavior and explicit built-in audiences. Assertions check returned status/text and ensure the unchecked marker is not persisted as final output.

The two layers together substantiate classification-error containment without external model calls. They are not educational-effectiveness tests, production agent activation checks or a full transport integration test. Optional future coverage could explicitly assert that regeneration failure/cost cap does not return the first blocked candidate and that a second SAFE candidate succeeds. Static inspection of the current assignments confirms those paths are contained.

## Bounded limitations

1. **Classroom caller discards non-SUCCESS fallback.** `lib/teaching/runtime.ts:100-106` throws before consuming `result.response` on FAILURE/ESCALATED. Thus this repair prevents unchecked classroom narration, but the static runtime fallback is not itself rendered as classroom narration by that caller. Do not claim end-to-end classroom fallback delivery from these tests. The guardian caller in `lib/agents/sms/guardianInbound.ts:249-261` consumes a response independently of status, so its returned static fallback can be sent. Classroom UX acceptance may require a later bounded integration check or an owner-approved caller change.
2. **Optional audience is compatibility, not automatic future registration safety.** Future system-role agents that omit audience inherit general. Current built-ins are explicit and tested, satisfying this repair's named scope. New public agents must declare audience or extend a registry rule; a model or untrusted client cannot change an existing registered policy.
3. **Final-response moderation is not tool transaction rollback.** Existing allowlisted tools execute during the loop before final-answer moderation. This change does not moderate every teacher whisper/tool argument or roll back preexisting effects. The examined public tools retain their existing resource checks. This is not evidence that all possible future tools are safe.
4. **No activation or deployment evidence.** No enabled agents, production flags, overrides, paid calls or live messages were observed or changed during review. The code-level repair does not resolve SEC-R07 effective activation or SEC-R08 deployed assurance.

No blocking final-response bypass was found in the examined diff. Keep the production exposure statement UNKNOWN and the CoS tracker OPEN until exact-commit review. Record final TypeScript and test-log fingerprints before handing off.

## Version binding

Working source HEAD at review: `b3bebe4c4e2e2390b3b7bbed86c213b7f673600f`. SHA256 values below bind this verdict to the actual implementation and test contents; reconcile if files change before commit.

- `lib/agents/runtime.ts`: `ad30be24c50d23eba8f6ca03d54e4e88e9b50f8ee6d84a7a505f7776c1aa7f8f`.
- `lib/agents/moderation.ts`: `f630568e2a90973ae21b4349b283f1567e53b06d32136ba0dd568fe98028a94b`.
- `lib/agents/types.ts`: `e57d07fa56617c685970809bd1de3ec0eb25f5e6607a195f67b8066dedcab41c`.
- `lib/agents/agents/content-qa.agent.ts`: `d14e83c823d083b21a27dd01874eb02528a193eee96faa3fe2bbcc0d45adc4b6`.
- `lib/agents/agents/district-update.agent.ts`: `9bfe3d2338feeeac71de1187a02a731eba1efd96fae71d2457ec658f37c8ea97`.
- `lib/agents/agents/echo.agent.ts`: `f287f45a3697eb02ab07f2936b47d820b07636912ecdec4e4a99527a488e8073`.
- `lib/agents/agents/liberialearn-family.agent.ts`: `2443b1642facc9ae3ce19b12c513599788eca018b21fb28e3e1f552e5880513a`.
- `lib/agents/agents/moe-narrative-report.agent.ts`: `ad2b4813421bbfa683326bfb437fc9b56234b1baac5f589c944914467d3373be`.
- `lib/agents/agents/morning-brief.agent.ts`: `c9af29c0f9647eb596a66551b8a1120b08d44589d02058c11c9154a90ced73de`.
- `lib/agents/agents/ops-sentinel.agent.ts`: `274f3bd754c0c4907cb8f6cad79a1dbf45386782e2386f6532cdc926f9690261`.
- `lib/agents/agents/teaching-runtime.agent.ts`: `27ffecd03c76f409738a2bfb45b287ad8a03238ae62148e6ecee608b68db3237`.
- `docs/audits/project-atlas-20261023/post-audit/tests/moderation-audience.test.ts`: `f2fe3162ee3dc33db1fa1d7226eb462e3158017fe9cc26d342514c861538e8d4`.
- `docs/audits/project-atlas-20261023/post-audit/tests/runtime-audience.test.ts`: `3b6c73ab632f6fb51b4d6c165a409a455913e7720d192b46c4a861dab06ac7e5`.
