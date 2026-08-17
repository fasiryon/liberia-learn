# P2-C Evidence Manifest — Math Pilot

Reproducible manifest for every authoritative source used in the P2-C
Mathematics pilot. Companion to
`docs/research/WAEC_LIBERIA_BASELINE_AND_CURRICULUM_ALIGNMENT.md`. Generated
2026-08-17. Any engineer can re-fetch each URL below and compare the SHA-256
to confirm they are working from the same evidence.

## Curriculum edition classification

Per Gate 3 of this round's task: these archives are recorded as
`CURRENTLY_VERIFIED_OFFICIAL_EDITION`, not `CURRENT_LATEST_EDITION`. Two
distinct dates were captured and they disagree in an informative way:

- **HTTP `Last-Modified` header** (server-side, captured via `curl -I` this
  session): **2026-07-29** for all three archives (within the surrounding
  ~19 minutes of each other, consistent with a batch re-upload/re-serve
  rather than independent edits).
- **Internal per-file timestamps** inside each ZIP (from `unzip -l`, i.e.
  when each PDF was itself last saved before zipping): **2020-07**
  consistently across all sampled pilot PDFs.

The most defensible reading: the ZIP files were technically re-uploaded or
re-served by the web host on 2026-07-29 (a redeploy, CDN refresh, or
scheduled republish), but the PDF content inside was last authored in
2020-07 and there is no positive evidence its content changed. No official
MOE statement was found this session asserting either "this is the current
official curriculum" or "a newer edition exists." Do not treat
`CURRENTLY_VERIFIED_OFFICIAL_EDITION` as `CURRENT_LATEST_EDITION` in any
downstream label, UI, or seed record — if a future session finds a newer
MOE curriculum publication, this edition should be superseded via the
existing source-versioning path (`lib/curriculum/benchmarking/sourceVersioning.ts`),
not silently replaced.

## MOE curriculum archives (authorityType: LIBERIA_MOE)

| Field | Grade 1-6 | Grade 7-9 | Grade 10-12 |
|---|---|---|---|
| Canonical URL | `http://www.moe.gov.lr/wp-content/uploads/2019/09/GRADE-1-6.zip` | `http://www.moe.gov.lr/wp-content/uploads/2019/09/GRADE-7-9.zip` | `http://www.moe.gov.lr/wp-content/uploads/2019/09/Grade-10-12.zip` |
| Retrieved (this manifest pass) | 2026-08-17T16:3x:xxZ | 2026-08-17T16:3x:xxZ | 2026-08-17T16:3x:xxZ |
| HTTP status | 200 | 200 | 200 |
| HTTP Last-Modified | 2026-07-29T14:00:22Z | 2026-07-29T14:12:06Z | 2026-07-29T14:25:44Z |
| Content-Length | 5,884,359 bytes | 3,291,956 bytes | 6,916,974 bytes |
| ZIP SHA-256 | `82b95c17bf5bdbcdf8614c0c1b2c09f0a103c05fe50b5cb8bedf3cb3d9e429a0` | `fffb3aed17eeae7cd2fdd1fabc69ea1c7e1587e04d91b6ea01752b1cd185f425` | `3b3fed2df4a9a1c3d6576cba8ad9f16cc1e0c19a64dcf358f09429f0767ee8ed` |
| Authority | LIBERIA_MOE (`.gov.lr`) | LIBERIA_MOE (`.gov.lr`) | LIBERIA_MOE (`.gov.lr`) |
| Edition status | CURRENTLY_VERIFIED_OFFICIAL_EDITION | CURRENTLY_VERIFIED_OFFICIAL_EDITION | CURRENTLY_VERIFIED_OFFICIAL_EDITION |
| Rights | RIGHTS_UNKNOWN (no license/rights statement found on the page or in the archive) | RIGHTS_UNKNOWN | RIGHTS_UNKNOWN |
| Reference/rights mode | REFERENCE_ONLY-equivalent: permitted for citation, metadata, internal analysis, AI analysis; NOT permitted for learner display or reproduction until rights are confirmed | same | same |

### Pilot PDFs used (extracted via `pdftotext -layout`)

| PDF | Inside archive | Internal file date (per `unzip -l`) | SHA-256 (PDF file, not the surrounding ZIP) | Page(s) used |
|---|---|---|---|---|
| `Math 1-6.pdf` | Grade 1-6 | 2020-07-12 | `ae569b18b38b48cb936f164a79de053005f214500331364be3399c1c185fa74e` | p.22 (Grade 3, Review of Operations) |
| `Math 7-9.pdf` | Grade 7-9 | 2020-07-16 | `b8f076e1448671bc4f0e7af91ca69795db273f10d6fa0aba6cfc4e9065d28224` | p.37 (Grade 9, Two-Set Problems) |
| `Maths 10-12.pdf` | Grade 10-12 | 2020-07-23 | `987f937d3c354bcfb036cdac971c0f04a7b40c391b119a827a9d072191250237` | p.67-68 (Grade 12, Differentiation and Integration) |

Note: the SHA-256 values above are 64-character hex digests (verified by
length this session); if a re-fetch produces a different PDF hash, the
underlying archive content has changed since 2026-08-17 and every alignment
record derived from it should be marked stale via the existing
`planAuthoritySourceChange` path.

## WAEC Liberia pages (authorityType: WAEC_LIBERIA)

These are live HTML pages, not downloadable archives. No raw HTTP response
body was saved (the retrieval path was a real browser session's rendered
`<main>` text via the `claude-in-chrome` tool's `get_page_text`, since the
headless `WebFetch` tool was blocked with HTTP 403 on this domain). The
hash below is of the **captured text render**, not necessarily byte-for-byte
identical to the page's raw HTML source — this is recorded honestly as a
`CAPTURED_RENDER` hash, distinct in kind from the MOE ZIP file hashes above.

| Page | Canonical URL | Retrieved | Captured-render SHA-256 |
|---|---|---|---|
| LPSCE | `https://waecliberia.org.lr/examination/` | 2026-08-17 (browser session, ~12:14 local) | `cc6e6275da76860e0838a0fb68f48504060f8a54d6a40e742a1997f471348118` |
| LJHSCE | `https://waecliberia.org.lr/ljhsce/` | 2026-08-17 (browser session, ~12:15 local) | `fabd89d5b1051637fdb759ad4db7198dc682f150b69a0d69a8e0456453b6d323` |
| LSHSCE (Regular) | `https://waecliberia.org.lr/lshsceregular/` | 2026-08-17 (browser session, ~12:16 local) | `097774b2d058c4d203851689fa5e97755443931189188b8a9b4de54b3c871aaf` |
| LSHSCE (Private) | `https://waecliberia.org.lr/lshsceprivate/` | 2026-08-17 (browser session, ~12:18 local) | `8002907b9d237897bc1bad82b339096faf289e11bbd4aa613e14cc045266bc57` |

Authority: WAEC_LIBERIA (`.org.lr`). Verification status: VERIFIED (live,
first-party, directly rendered this session). Rights: RIGHTS_UNKNOWN, same
posture as the MOE archives — no explicit license statement found; citation
and analysis permitted, redistribution/reproduction not assumed permitted.
Edition status: not applicable in the archive sense (these are live pages,
not versioned documents); treat as CURRENTLY_VERIFIED, re-check before
relying on them again in a future session since WAEC could edit these
WordPress pages at any time without a version marker.

## Reproduction notes for another engineer

1. MOE archives: `curl -sL -o <name>.zip "<canonical URL>"`, then
   `sha256sum <name>.zip` and compare to the table above. Extract the pilot
   PDF with `unzip`, then `sha256sum` it directly and compare.
2. WAEC pages: the headless fetch tool used in this repo's automation was
   blocked by this host (HTTP 403) on every path tried; a real browser
   session succeeded. Reproducing the exact captured-render hash requires
   the same extraction method (main-content text render); a different
   extraction method (raw HTML, a different reader mode) will not match
   byte-for-byte and that is expected, not a discrepancy to chase.
