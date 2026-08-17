# WAEC Liberia Baseline and Curriculum Alignment — Research Evidence

Status: LIVE RESEARCH RECORD, PARTIAL. Written for P2-C
(`docs/roadmaps/CONSOLIDATED_BACKLOG.md`, PRIORITIES_1_2_5_6_7 program).
Last updated: 2026-08-17.

## Purpose and philosophy

This document records what LiberiaLearn can currently assert, with evidence,
about the Liberia examination landscape and the Liberia MOE curriculum, and
what it cannot yet assert. It exists to ground the P2-C data model
(`lib/curriculum/benchmarking/`, `prisma/schema.prisma` P2-C models) in real
sources rather than assumption.

Operating philosophy, restated from the founder decision that opened P2-C:
WAEC is a minimum external examination baseline, not the curriculum
authority and not the ceiling. Liberia MOE remains canonical. LiberiaLearn's
own mastery target is expected to sit above the WAEC baseline, with a
separate extension layer above that. This document only supports the
baseline layer (`AssessmentBaselineFramework` / `AssessmentBaselineSubject` /
`AssessmentBaselineCompetency` in the schema) and the examination landscape
context MOE objectives are compared against. It does not define LiberiaLearn
mastery or extension targets, which are a platform decision made elsewhere.

LiberiaLearn has **no formal relationship with WAEC**
(`WAEC_APPROVED = false`). Nothing in this document should be read as, or
used to construct, a claim of partnership, endorsement, licensing, or
official review authority. All alignment produced from this evidence is
`AI_ASSESSED_ALIGNMENT`, not `WAEC_APPROVED`, per
`lib/curriculum/benchmarking/aiWaecAlignment.ts`.

## Method

Research was performed with web search and page fetch against public
sources in August 2026. Per the P2-C source-authority rule, only these host
types are treated as authoritative for competency-level claims:

- `moe.gov.lr` (Liberia Ministry of Education, `.gov.lr`)
- `waecliberia.org.lr` (WAEC Liberia office, `.org.lr`)
- `waec.org` (WAEC regional)

These three host families are the only ones registered in
`AUTHORITATIVE_HOSTS` in `lib/curriculum/benchmarking/aiWaecAlignment.ts`,
and are the only sources `assertAuthoritativeAlignmentEvidence` will accept
for an AI-assessed MOE-to-WAEC mapping. All other sources cited below
(news coverage, Wikipedia, results-checker mirrors) are discovery-only, per
Phase 2 of the P2-C brief, and were never wired into the authoritative-host
set or used as alignment evidence.

**Important limitation encountered this session:** direct `WebFetch` access
to `waecliberia.org.lr` returned HTTP 403 (bot-blocked), and to an alternate
unofficial-looking mirror domain (`liberiawaec.org`) returned a DNS timeout.
`moe.gov.lr/curriculum-download/` fetched successfully but its curriculum
document links did not resolve to retrievable content in this session (the
page is a portal page, not a document index, in the fetched snapshot). This
means the facts below are search-engine-snippet level for the Liberia-hosted
primary sources, not full-document verification. Nothing below claims
syllabus-level or competency-level detail that was not directly evidenced.
Fetching actual gazetted syllabus PDFs from `moe.gov.lr` or
`waecliberia.org.lr` remains an open task — see "What LiberiaLearn cannot
assert yet" below.

## Confirmed: current Liberia examination landscape

Liberia's national assessment/examination ladder, evidenced primarily via
news coverage of the Ministry of Education's 2026 calendar (New Dawn
Liberia) and cross-checked against the WAEC Liberia LSHSCE page indexed by
search:

| Exam | Grade | Certifying body | 2026 date evidenced |
|---|---|---|---|
| LNAT — Liberia National Assessment Test | Grade 3 | MOE (diagnostic, not a leaving certificate) | April 22, 2026 |
| LPSCE — Liberia Primary School Certificate Examination | Grade 6 | MOE / WAEC Liberia | April 23-24, 2026 |
| LJHSCE — Liberia Junior High School Certificate Examination | Grade 9 | MOE / WAEC Liberia | April 20-21, 2026 |
| WASSCE / LSHSCE — West African Senior School Certificate Examination (Liberia Senior High School Certificate Examination) | Grade 12 | WAEC (regional), administered in Liberia as LSHSCE | Academic subjects begin June 1, 2026; Booker Washington Institute (BWI) candidates sit vocational/trade subjects earlier |

This directly supersedes any assumption that Ghana, Nigeria, Sierra Leone,
or Gambia's exact grade/exam structure applies unmodified to Liberia. The
grade-3/6/9/12 four-point national exam ladder, and the LNAT/LPSCE/LJHSCE
naming, are Liberia-specific.

WASSCE structure (WAEC regional, applies to the Grade 12 / LSHSCE layer;
cross-checked against Wikipedia's WASSCE article, itself sourced from WAEC
regional material, not treated as authoritative but consistent with the
Liberia-specific news coverage):

- Liberia is one of the WASSCE-participating countries (Ghana, Nigeria,
  Sierra Leone, The Gambia, Liberia).
- Core subjects: English Language, Mathematics, Civic Education, plus one
  additional core subject drawn from a technology, science,
  arts/humanities, or commercial track.
- Candidates additionally sit three to four elective subjects.
- Grading: A1-F9 letter/number bands; C6 (50-54%) is the minimum passing
  grade; grades of D7 or lower in Mathematics/English are reported as
  limiting for tertiary admission even though technically passing.
- For 2026, WAEC and MOE Liberia are reported (via `moeliberia.com`, a
  **non-authoritative** news domain, not `moe.gov.lr`) to be introducing an
  expanded subject list (39 subjects) with candidates selecting 9. This
  claim is recorded here as discovery-only and is explicitly **not**
  asserted as verified, since its only source is a non-government domain.

## What LiberiaLearn can assert right now

- The four-tier Liberia national exam ladder (LNAT/LPSCE/LJHSCE/WASSCE-LSHSCE)
  and their grade levels, evidenced from Liberia-specific 2026 news
  coverage of the Ministry of Education's academic calendar.
- The general WASSCE core/elective subject structure and grading scale, as
  it is expected to apply to Liberia's Grade-12 LSHSCE layer, evidenced from
  a general WASSCE reference source and consistent with (not contradicted
  by) Liberia-specific coverage.
- That `moe.gov.lr` (`.gov.lr`) and `waecliberia.org.lr` (`.org.lr`) are the
  correct primary-authority domains to target for syllabus-level documents,
  and that at least one alternate WAEC-Liberia-branded domain
  (`liberiawaec.org`) exists but was unreachable and is not yet vetted as
  official or unofficial.
- That LiberiaLearn has no formal WAEC relationship (`WAEC_APPROVED = false`)
  and that this is not a blocker for the P2-C architecture.

## What LiberiaLearn cannot assert yet

- No subject-by-subject WAEC baseline competency has been extracted from an
  authoritative document. `AssessmentBaselineCompetency` rows have not been
  seeded from real syllabus content; only unit-test fixtures with clearly
  synthetic codes (e.g. `WAEC.LJHSCE.MATH.1`) exist in
  `__tests__/p2c/depth-gap-engine.test.ts`, and those are test data, not
  production data.
- No MOE curriculum objective has been normalized from a real
  `moe.gov.lr` syllabus document into `CurriculumBaselineAlignment`-ready
  form. The `moe.gov.lr/curriculum-download/` portal page confirms a
  "National Curriculum" download exists but this session could not resolve
  it to retrievable document content.
- The 39-new-subjects-for-2026 claim is unverified against a `.gov.lr` or
  `.org.lr` source and must not be treated as confirmed.
- Whether `liberiawaec.org` is an official WAEC Liberia mirror, a licensed
  partner site, or an unrelated third party is unknown and it is not in the
  authoritative-host set pending that determination.
- No examiner-report-level diagnostic signals (Phase 22 of the P2-C brief)
  have been extracted; none were located as directly fetchable public
  documents this session.

## Next steps for closing these gaps

1. Obtain the actual gazetted MOE national curriculum PDF(s) linked from
   `moe.gov.lr/curriculum-download/` (the "National Curriculum" link), either
   via a fetch-capable session, a manually supplied file, or an official
   government API/feed if one exists.
2. Obtain the actual WAEC Liberia LSHSCE syllabus/subject specification from
   `waecliberia.org.lr`, either directly (if bot-blocking can be worked
   around through a legitimate, permitted access path) or via a manually
   supplied document.
3. Once both are in hand, run the Phase 32 subject pilot (Mathematics,
   English/Language Arts, Science) against real extracted competencies
   rather than test fixtures, and populate `CurriculumAuthoritySource` /
   `CurriculumAuthoritySourceVersion` with real hashes and retrieval dates.
4. Independently verify the 39-subject 2026 WASSCE expansion claim against
   `moe.gov.lr` or `waecliberia.org.lr` before it is used in any coverage
   claim.

## Sources consulted (discovery only unless marked AUTHORITATIVE)

- [WAEC Liberia Announces 2026 National Examination Dates — The New Dawn Liberia](https://www.thenewdawnliberia.com/waec-liberia-announces-2026-national-examination-dates/)
- [the liberia senior high school certificate examination (lshsce) — waecliberia.org.lr](https://www.waecliberia.org.lr/lshsce.html) (AUTHORITATIVE domain; page itself returned HTTP 403 on fetch this session, so content is search-index-snippet level only)
- [Curriculum Download — moe.gov.lr](https://moe.gov.lr/curriculum-download/) (AUTHORITATIVE domain; portal page fetched, no resolvable document content this session)
- [West African Senior School Certificate Examination — Wikipedia](https://en.wikipedia.org/wiki/West_African_Senior_School_Certificate_Examination) (discovery/background only, not authoritative)
- [WAEC Liberia Releases 2025 Exam Results, Introduces New Subjects for 2026 — moeliberia.com](https://www.moeliberia.com/waec-liberia-releases-2025-exam-results-introduces-new-subjects-for-2026/) (discovery only; `.com` domain, not the government `moe.gov.lr` domain, despite the similar name — do not conflate)
- W.A.E.C. Liberia alternate domain `liberiawaec.org` (unreachable this session; authority status unverified)
