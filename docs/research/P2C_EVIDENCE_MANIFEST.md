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

### Second independent live capture (P2-C Subject Expansion pass, 2026-08-17)

A separate real browser session, later the same day, independently
re-fetched all four pages to verify the structural facts in the founder's
Subject Expansion brief (subject codes, CASS/TASS splits, grading,
entry/certificate rules, Division I/II/III bands) before seeding them to
staging, rather than trusting the brief or the manifest rows above at face
value. Content matched exactly; the captured-render hashes below differ
from the rows above only because this is a second, independent capture
(different request, same live WordPress page), not because content
changed. Only LPSCE and LSHSCE(Regular) were seeded as new
`CurriculumAuthoritySourceVersion` rows this pass (`scripts/p2c-staging-exam-framework-seed.ts`);
LJHSCE and LSHSCE(Private) reused the existing source rows from the Math
pilot rather than re-seeding.

| Page | Canonical URL | Retrieved | Captured-render SHA-256 (this capture) |
|---|---|---|---|
| LPSCE | `https://waecliberia.org.lr/examination/` | 2026-08-17 (second browser session) | `68ec91bd02922d5c32ef64fcb8d66d190101825043b061a247a85b6411cd5b4e` |
| LSHSCE (Regular) | `https://waecliberia.org.lr/lshsceregular/` | 2026-08-17 (second browser session) | `006b02da5b17084d092f1183e5811f2f004053456500e2c37b2fbbceb8299e28` |

Reproduction note: this hash is of the plain-text page body only (everything
after the tool's own `Title:`/`URL:`/`Source element:` header line and the
`---` separator), saved to a local file with LF line endings, then
`sha256sum`'d — a documented, reproducible convention for this specific
hash, distinct from whatever exact substring the first capture's hash
covered (that convention was not recorded at the time).

## Subject expansion pilot PDFs (Language Arts, Science, Social Studies, and Grade-12 subjects)

Same three MOE archives as above, ZIP hashes re-verified unchanged this
pass (no source drift since the Math pilot). Extracted via
`pdftotext -layout` into a fresh session's scratchpad (not committed to the
repo; re-derivable from the canonical URLs and hashes below by any
engineer). One representative objective per subject/grade, matching the
Math pilot's rigor -- not full-curriculum coverage.

| Subject | Grade | Inside archive | PDF SHA-256 | Page | Topic (verbatim) |
|---|---|---|---|---|---|
| Language Arts | 6 | `English 1-6.pdf` | `6065629aa04a1bd630ed0398fafe0fa4a7c295ce0a5376839535193887abc404` | 115-116 | Kinds and Types of Sentences with Related Punctuations / Kinds of Pronouns / Paragraph Writing |
| Social Studies | 6 | `Social Studies Grade 1-6.pdf` | `5e6330de23f882058415b713cdf9bf28053214cd3e8ea54edb8191e13617a53d` | 66 | The Founding of the Liberian State |
| General Science | 6 | `General Science1-6.pdf` | `a3cb6c6c8cdb767cc07638359a0b225656042c1264580edad707fc69b68413ff` | 64 | Classification of Plants and Animals |
| Language Arts | 9 | `English 7-9.pdf` | `8f01d51551438db0e66c8d31c464a20025fb7c66054d4e836a41dc5d6dd02069` | 23 | Composition/Literature and Reading Comprehension |
| General Science | 9 | `General Science 7-9.pdf` | `79e237c6ecd428f156a617dba074adbf67cba643c3082f81fa4a47ad49440234` | 52 | Magnetism and Electricity |
| Social Studies | 9 | `Social Studies 7-9.pdf` | `89b1f263f6cd238d4e1c9b31897f85a2ca7cdcece5c78f21ed72f1b8262849bb` | 29 | Regional Geography of West Africa -- Agriculture and Mineral Resources |
| English (Grammar) | 12 | `ENGLISH GRAMMAR 10-12.pdf` | `20989a1aef7d4f4eebe6001fea3649b1c44257e3d5ea8393406cb97b60cfd883` | 26 | The Three Cases of Pronouns and Verb Usage |
| Economics | 12 | `Economics 10-12.pdf` | `ee44f53d7cc17d5c98701e6dd8e689222c21427c3d8c212d520a273c62e2a377` | 24 | Economic Development and Planning (the Liberian Economy) |
| Geography | 12 | `GEOGRAPHY 10-12.pdf` | `50f3f5276668732254f5ba7f1b8165352bf00afb8fe2bce7b120ece60664d6db` | 48 | Practical Geography -- Map Reading, Kinds of Maps and Their Uses |
| History | 12 | `History 10-12.pdf` | `dc315e831ff3f496fef2f8edc24dd4623a2383eaf74dbdfb1e806bfaef661f30` | 25 | Liberian History -- The First Liberian Civil War (1989-1997) |
| Literature-in-English | 12 | `LITERATURE 10-12.pdf` | `e0da458734c07a3710417f5fb7f791e70f72e4b0f341ed1ba8b8530909185abc` | 19 | Review African Poems and Figurative Expressions |
| Biology | 12 | `biology 10-12.pdf` | `985ca5659a086b3c6bd273f818a923a952378e4bacb702e6064cc961e257c931` | 34 | Chordata -- Aves (Birds) and Mammals |
| Chemistry | 12 | `Chemistry 10-12.pdf` | `cc6caae32d23051470ca4c4d4fb53878ad770ee2859ad86a2921f8bc48a6d4af` | 47 | Chemistry, Industry and the Environment |
| Physics | 12 | `Physics 10-12.pdf` | `d555ec8e1024dfd7124fb75c820f1fea65f66a651b57c74982e66301154b6329` | 26 | Refraction and Dispersion of Light |

One incidental finding worth recording: the Geography 10-12 PDF's own
materials list (near p.48) cites "WASSCE Q&A (Papers 1&2)" as a student
study aid — first-party MOE evidence that WASSCE-branded material
circulates as ordinary regional reference/practice material in Liberia's
own curriculum documents, consistent with (not proof of) the WASSCE
reclassification recorded in `WAEC_LIBERIA_BASELINE_AND_CURRICULUM_ALIGNMENT.md`.

No topic-level WAEC competency evidence exists for any of these 14
objectives (the same public-evidence limitation as Math) -- every one is
seeded at MOE-objective level only, honestly left unmapped to any
TOPIC_LEVEL baseline claim. See the gap engine output in the sprint final
report for how this is classified (`EXTERNAL_EVIDENCE_GAP`, not a
LiberiaLearn content defect).

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
