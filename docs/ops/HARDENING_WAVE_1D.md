# Hardening Wave 1D

## What Changed

- Added browser-certification tests for:
  - service-worker routing rules
  - exam session save/restore/clear helpers
  - lesson scroll-progress save/restore/clear helpers
- Extracted narrow persistence helpers from the student exam and lesson clients so browser state can be tested directly without changing user flows.
- Added explicit `typeof window !== "undefined"` guards around session-storage access in the global assistant shell.
- Kept the existing assignment workflow tests as the certification evidence for:
  - teacher create
  - student submit
  - teacher grade
  - guardian notification safety

## Production-Ready

- Browser-side session persistence for lessons and exams: yes
- Service-worker route policy for offline lesson support: yes
- Assignment workflow browser/API certification evidence: yes

## External Setup Still Required

- None for the browser-certification code itself.
- Offline behavior still depends on browser support for Service Worker, Cache Storage, and IndexedDB.

## Known Limitations

- This wave certifies browser behavior with targeted unit tests and existing route tests; it does not add full end-to-end Playwright coverage.
- Service-worker behavior is validated through static policy assertions and existing offline queue tests rather than a real browser automation harness.
