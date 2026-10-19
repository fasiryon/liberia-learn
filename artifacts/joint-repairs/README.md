# Focused PR190 repair evidence

Base: `45d86dc56ce4f9b02f66bae72ff773b701c32d4a`.
Main and both PR heads were reverified unchanged during this continuation.
The uncommitted repairs were preserved and inspected before validation.

All logs are local command captures. PowerShell adds `NativeCommandError` wrappers
around some ordinary stderr warnings; use the process exit code and final test
summary, not that wrapper, to determine success. No hosted secrets or environment
files were copied. Database URLs use `127.0.0.1:1`; no migration or data mutation
was requested. Build is a local Next production build, not a deployment.

- Initial targeted run: 6 suites / 90 tests passed.
- Added mount-order regression: failed before the handshake repair (tutor shell
  appeared after it missed the player's event), then passed in the changed gate.
- `validate-changed.log`: API route audit, 79 changed tests, 331 related tests,
  TypeScript; PASS. The browser harness was subsequently added and is covered by
  the production build's typecheck and explicit JavaScript syntax checks.
- `lint.log`: PASS with pre-existing warnings.
- `os-vault.log`: 4 passed, 2 Windows symlink skips.
- `browser-initial-marker-wait.log`: harness failure waiting for an intentionally
  hidden readiness span to become visible. Corrected to wait for attachment;
  no application assertion was weakened.
- `browser.log`, `browser-repairs.json`: PASS at 390, 768, 1440 and 1920px;
  keyboard activation, empty and changed-page bookmarks, authored heading,
  protected help, late shell mounting, and exact permitted scene identity.
  Zero page errors and zero POSTs. Four screenshots retained.
- Full suite, build, PWA and Student Today results are recorded in the final
  validation report after their commands complete.

The browser fixture uses the actual components with a synthetic runtime and
PRESENTATION_ONLY evidence channel. It is not an authenticated school session,
a released Grade 7 lesson, a paid tutor invocation, or evidence of learning.
The assistance adapter conservatively prevents unaided classification because
this seam has no trusted attempt-bound assistance ledger; no score or mastery
is activated. Qualified curriculum approval and independent repair review are
still separate human decisions.

Final results: 7,501 full-suite tests passed, 8 skipped; production standalone build passed; 14 PWA cases passed; all five Student Today fixture groups passed. UTF-8 .txt captures retain the final command logs. See ../../docs/reviews/PR190_REPAIR_VALIDATION_2026-10-16.md. fixture-output preserves regenerated baselines locally and is not part of the repair commit.
Committed UTF-8 log copies normalize trailing whitespace only; raw local .log captures are preserved.
