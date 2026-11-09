I don't have local file or shell access in this session, so this review covers only the code you supplied. I couldn't check it against the worktree, the receipt bytes or the Prisma schema. These findings are AI review only. They are not human approval, and I ran no runtime, keyboard, screen-reader or offline-parity tests. Nothing was edited or activated.

## Interface acknowledgement

I acknowledge the interface as described, with the blockers below:
- **Exact selection:** only `factory@4.0.0-draft.6@<key>` is accepted.
- **Separate loader:** the draft.6 loader has its own receipt and does not reuse the draft.4/5 regex.
- **Derived view:** the pilot gets a `PILOT_ONLY` view; the authority stays `CURRICULUM_V2_DRAFT`.
- **Player prop:** the shared player gains an optional `progressStorage="MEMORY"` prop, and the default stays `DEVICE`.

**Overlaps:** the supplied set touches only the new files and the `LessonPlayerV2.tsx` diff. Teaching renderers, the review routes, the registry and the official delivery resolver are untouched. Before the merge, whoever owns `LessonPlayerV2.tsx` needs to confirm in the repo that nothing else is changing it at the same time.

## Blockers (P0/P1)

1. **P0 – Normal use wipes the lesson.** The wrapper unmounts the player whenever `admitted` becomes false, and in MEMORY mode the progress lives only in the player. These events all send the learner back to scene 1:
   - every tab switch (`visibilitychange`);
   - the `pageshow` and `online` events, because `changed()` sets the state to false first;
   - any access check slower than 2.5 seconds (the timeout).

   On slow or unreliable connections this makes the pilot close to unusable. It also breaks accessibility: focus is lost and a `role="alert"` fires over and over.

   **Fix:** use three states (`VERIFYING`, `ADMITTED`, `DENIED`).
   - Unmount the player only on a definite denial: 404, identity or hash mismatch, or expiry.
   - On temporary states (hidden, offline, slow request), hide the player with `hidden` + `inert` and keep it mounted. Or lift the in-memory progress into the wrapper.
   - Don't use `role="alert"` for the brief verifying state on first load.
2. **P1 – Banner text is garbled.** `"Pilot lesson ??? not graded"` looks like a mangled em dash, so screen readers would read out the question marks. Use `—` or a hyphen and add a test for it.
3. **P1 – The pilot view is never validated.** `pilotExperience()` changes scene types, interactions, completion and offline modes, and sets `teaching: undefined`. But `validateLessonExperience` only runs on the sealed projection. The server should validate the pilot view too, and there should be a test for each of the five pinned lessons.
4. **P1 – Every 2-second check reruns the full integrity check.** Each `accessOnly` poll runs `loadDraft6Review`: it reads and hashes every file, runs academic validation, regenerates the projection, and makes about four database queries.
   - For a 200-student cohort that is about 100 requests per second, each doing that full verification.
   - **Fix:** in `accessOnly` mode, run only the policy, approval and audit checks plus a check of the package hash pin. Cache the integrity result keyed by the receipt hash. Add backoff and jitter to the polling.

## Contract findings (P2)

5. **Review references aren't covered by the approval hash.** `pilotApprovalBinding` covers the cohort, the time window, the selection and the package hash. The seven `reviews` references and `approvalRecordId` aren't included, so they can be swapped after authorization. Include them, or document that they're intentionally left out.
6. **Students with no academic enrollment get through.** If `academicEnrollments.length === 0`, the active-year check is skipped. Confirm that's intended; otherwise fail closed.
7. **No separation of duties.** The approval needs a platform-admin ADMIN, but the same person can write both the cohort policy and the approval. If the founder wants two-person control, add the check `approval.createdById !== policy author`.
8. **The decoding claim depends on the Next.js version.** If Next.js already decodes `params`, then `%2540` is decoded twice and still reaches canonical form. That isn't exploitable, because the grammar check runs afterwards, but the claim that double encoding is rejected may be untrue. Pin the claim to the Next.js version in use and test it at the HTTP boundary, as the existing review route does.
9. **Civics is excluded only because no Civics hash is pinned.** That is sufficient: no hash, no admission. Making it explicit would be stronger: assert at module load that no key matches civics or social studies, and add a test where a policy lists Civics and is denied.
10. **The ungraded pilot drops the mastery check entirely.** Replacing `MASTERY_CHECK` scenes with a static message also removes the independent practice. That works against the founder's standard of independent learning, retention and transfer. Keep it as ungraded practice with keyless feedback instead, unless the founder prefers it removed.
11. **"Memory storage" now also changes what happens at the end.** With no `runtime`, MEMORY also means a `PILOT_ONLY` finish, a hidden "Flag for teacher" line and a changed exit link. That ties storage to pilot behaviour inside a shared component. Prefer an explicit `pilot` flag or `finishMode` prop.

    Separately, scenes with lab interactions aren't removed. Unless no lab scene exists in the five lessons, I couldn't confirm what happens: lab launch may silently no-op, or navigate away and lose the memory progress. Either remove lab scenes in the pilot view or assert that none exist.
12. **Small items.**
    - `exitHref="/student/lessons"`: check that the route exists.
    - `tools.prohibited` can contain duplicates.
    - The full-body (non-`accessOnly`) API response isn't used by the wrapper; drop it or document why it stays.

## Revocation and isolation

The model is sound.
- **Revocation:** these are re-checked from the database on every request, with no fallback and no cache:
  - a policy or lesson `revokedAt` (any non-null value revokes, failing closed);
  - an inactive approval;
  - a removed cohort member;
  - expiry.
- **Isolation:** both handlers are GET-only and write nothing; there is no evidence channel and no offline packaging.
- **Honest limits:** the doc says open players are removed only within the polling interval plus the request timeout, and that bytes already on the device can't be recalled. Keep that wording.

## Maps and visuals

There is no change to geographic blocks or the registry, and the county map stays in `DRAFT6_T1_HANDOFF.md`. That's correct. The pilot view keeps teaching content on scenes that aren't assessments, so the science energy/temperature `DATA_PLOT` and the fractions `CHECK` interactions should survive. Confirm the fractions checks don't sit inside `MASTERY_CHECK` scenes, which would be stripped (see item 10).

## Still open before activation (not done here)

1. Rerun the five pinned hashes against the receipt and manifest bytes in the repo.
2. Runtime, keyboard, screen-reader and offline-parity evidence for each selected lesson, after fixing items 1–3.
3. Real human sign-off for content, rights, access, accessibility, safety and runtime, plus an operator-authored `AUTHORIZED_PILOT_RELEASE` record with its matching audit log entry.

---

## Codex disposition after the review

The text above is Claude Code's actual supplied-code review on 2026-10-22. It had no local tools and ran no tests. The following is Codex's response, not a second Claude approval of the final patch.

| Finding | Disposition |
| --- | --- |
| 1, temporary checks wipe memory | Fixed with VERIFYING/ADMITTED/DENIED states. Hidden, offline, slow or temporarily failed checks hide and inert the same player instance; only definite denial, expiry or revocation unmount it. A component test preserves a changed practice state through those transitions and proves revocation destroys it. |
| 2, banner encoding | The actual UTF-8 source and authenticated browser render contain the required em dash. The browser asserts the exact text and its screenshot confirms it. The question marks were introduced in the Windows CLI text transport to Claude, not in the app. |
| 3, derived scene validation | Fixed. pilotExperience calls validateLessonExperience. All five pinned derived views are tested. This also caught and removed invented tutor/assistant tool IDs; the player has no runtime tutor channel and exposes its native tutor context as blocked. Only existing registered prohibited IDs are preserved. |
| 4, full rebuild per heartbeat | Fixed by separating authorizeStudentLearningPreview from content loading. Heartbeats recheck current DB authority and return no content; every new content response still verifies all bytes and regenerates/validates the projection. No cached authorization or alternate package is used. A route test proves heartbeats do not call the package loader. Full cohort load/latency remains an activation check. |
| 5, replaceable references | Fixed. The approval binding now also covers review references and approvalRecordId. Mutation regressions prove both invalidate the binding. |
| 6, no academic enrollment | Deliberately matches the existing enrollmentReadModel behavior. The current own-school class roster is always mandatory. When academic enrollment exists, active status/year/date is also mandatory. Legacy schools do not gain access without a roster. |
| 7, two-person rule | Not requested or asserted. A current platform-admin ADMIN's genuine separate approval plus linked audit record is mandatory; founder activation is a separate operational gate. No fictional separation of duties is claimed. |
| 8, URL decoding | The actual Next 14.2.35 built route delivered a remaining percent-encoding layer. One-pass boundary normalization fixed the observed denial. Next can normalize another layer before the handler; the real HTTP regression therefore verifies that encoded spellings bind the same exact version/hash, while malformed or unknown-version selections still fail. Unit checks reject unresolved escapes at the helper boundary. No claim of rejecting every doubly encoded wire URL remains. |
| 9, Civics | Already denied by the five exact pinned identities and a hostile-policy regression. No Civics hash can be admitted by configuration. |
| 10, independent assessment | The founder explicitly requires replacing the draft assessment handoff with an ungraded message. That requirement takes precedence over the review suggestion. Formative independent practice elsewhere is preserved. Protected assessment content is never converted into ungoverned practice. |
| 11, memory/finish coupling and labs | MEMORY is currently an explicit pilot-only caller option; default DEVICE behavior is unchanged and regression-tested. Reusing it for another delivery mode requires a separate contract review. The five pinned pilot views contain no lab-launch interaction. No live links/runtime evidence channel are supplied. |
| 12, small items | /student/lessons exists. The invented tool IDs were removed rather than expanded into the registry. Full-body GET remains a verified authenticated content endpoint for integration and browser checks, with no offline cache or write method. |

No candidate package, teaching renderer, geographic block registry or official delivery policy was changed to resolve these findings. All genuine release, rights, accessibility, safety and human-authority gates remain open until their owners supply evidence. This document is AI coordination evidence, not a subject-expert approval or activation record.
