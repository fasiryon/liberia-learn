# Linux validation status

Updated 2026-10-26. Release recommendation remains **do not activate**.
Code head: `fd2cd44509be0ae44b7281961e1e2c43e3da13af`.
The pilot flag stays OFF, and no policy or lesson was activated.

## Confirmed evidence

- Fresh `npm ci` in the pinned Noble Linux image, with private dependencies and
  no host `node_modules`, production credentials or `.env` files. Database
  settings point to deliberately unreachable container-loopback port 1.
- Full unit suite at parent `a970a52595a1531cb401da07605f13bcd230cc86`:
  832 files passed, 3 skipped; 8,487 tests passed, 35 skipped; native exit 0.
  Network was disabled. A prior `/app` checkout-path collision was corrected
  by relocation to `/workspace/liberialearn`, without changing assertions.
- Installed versions: next-auth 4.24.15, Sentry nextjs/node 10.75.2,
  DOMPurify 3.4.17, Sharp 0.35.5, Next 14.2.35. Both unused Prisma auth
  adapters are absent. This is installed-tree evidence, not standalone tracing.
- The first production build compiled with retained Sentry/OpenTelemetry and
  existing lint warnings, then exited 1 on the browser harness's environment
  type. Commit `8f376bc654fcffe4eb4e5b143e5698140d7ac01d` explicitly types
  and initializes `NODE_ENV`, preserving secret scrubbing and all assertions.
- The changed gate had incorrectly submitted a standalone `.mts` browser
  harness to Vitest. It now selects the configured `__tests__` test/spec files
  and reports that changed browser harnesses require separate acceptance.
- The route audit had swallowed unavailable Git history and falsely printed
  an empty-change PASS in the shallow validation clone. Commit `fd2cd445`
  makes this fail closed. Seven focused route-policy tests pass. With actual
  Git history supplied, the exact-head audit reports 92 declared changed
  routes and 502 frozen legacy routes. CI already uses `fetch-depth: 0`.
- All 60 original receipt-listed files and `RELEASE_HANDOFF.md` were rechecked
  at `fd2cd445`; every hash matches. No draft.7 was created.

## Interrupted checks and remaining gates

The exact-head changed gate passed its audit and new regression, then stayed
in full type checking. The host reported `uv_os_get_passwd` ENOMEM during
another small startup. T2 stopped only its disposable validation container;
the wrapper recorded exit 137. Docker initially reported no exit event, then
confirmed the container was removed. Local database containers were preserved.
The partial log and failing receipt remain. This is not a type-check pass or
a diagnosed application defect. The 10 GB container / 8 GB heap attempt must
not be repeated on this memory-constrained host without sufficient headroom.

The Windows launcher also fails in `tsx`'s user-information lookup, before
factory code loads. Existing `jiti` can run the same factory CLI with a 512 MB
heap cap. No security check or dependency was patched around that startup issue.

Still required: bounded exact-head types/changed CI, production build,
standalone package/receipt/map hashes, actual production Sharp resolution,
flag-OFF and unallowlisted production HTTP 404 probes, built action/optimizer
inspection, and final-head authenticated/browser acceptance against only the
verified disposable database. The prepared standalone probe has not run.
T1's all-six authenticated acceptance at `3f7eff122` remains earlier-base
evidence and does not certify the changed dependencies automatically.

Security remains blocked by Next's critical finding and 18 production high
groups lacking final dispositions. A passing unit suite or Sharp workaround
does not waive those gates. No scanner was disabled or force-fixed.

## Review packet

`artifacts/academic-review/six-lesson-draft6-integrated-review-20261024.zip`
contains all 80 original review entries unchanged plus eight map-integration
supplement entries. SHA-256:
`637d88c588accadc45602d54281eddbe943e7d7a7f9a922817809faf537a1938`.
Size 986,136 bytes; 88 entries; deterministic rebuild verified. Its sibling
receipt hashes every embedded file. It is DRAFT review material, not approval.
Original archive and frozen candidates remain unchanged.
