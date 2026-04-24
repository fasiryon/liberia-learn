# Phase 5.2 — Pre-Implementation Curriculum Audit Report

**Date:** 2026-04-23  
**Branch:** feat/phase-5-2-adaptive-intelligence  
**Source:** Live production DB (Supabase — bnphuinpvgpmebcsvmsp)  
**Purpose:** Establish content coverage baseline before building the adaptive learning intelligence system.

---

## 1. Overall Inventory

| Status | Count |
|---|---|
| APPROVED | 1,307 |
| published (awaiting approval) | 389 |
| pending_approval | 143 |
| **Total** | **1,839** |

The adaptive recommendation engine will operate on the **1,307 APPROVED** lessons. Published and pending content is not served to students until approved, but represents a significant pipeline of content that, if approved, would substantially close gaps.

---

## 2. APPROVED Coverage by Grade

| Grade | Level | MATH | SCIENCE | LITERACY | CIVICS | SOCIAL_STUDIES | ENGLISH | CS | Total APPROVED |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Primary | 40 | 40 | 40 | 40 | 40 | — | — | 200 |
| 2 | Primary | **1** | **1** | **1** | **0** | **0** | — | — | **3** |
| 3 | Primary | 40 | 40 | 40 | 40 | 40 | — | — | 200 |
| 4 | Primary | 40 | 40 | 40 | 40 | 40 | — | — | 200 |
| 5 | Upper Primary | 7 | 6 | 6 | 1 | 0 | 0 | 1 | **21** |
| 6 | Upper Primary | 8 | 6 | 7 | 5 | 0 | 0 | 0 | **26** |
| 7 | Junior Secondary | 10 | 5 | 7 | 5 | 0 | 0 | 0 | **27** |
| 8 | Junior Secondary | 9 | 6 | 8 | 5 | 0 | 0 | 0 | **28** |
| 9 | Junior Secondary | **1** | **0** | **1** | **0** | **0** | — | — | **2** |
| 10 | Senior Secondary | 40 | 40 | 40 | 40 | 40 | — | — | 200 |
| 11 | Senior Secondary | 40 | 40 | 40 | 40 | 40 | — | — | 200 |
| 12 | Senior Secondary | 40 | 40 | 40 | 40 | 40 | — | — | 200 |

**Legend:** 0 = zero lessons; — = subject not tracked at that level.  
**Threshold:** ≥15 lessons per grade-subject = adequate. <15 = gap. 0 = critical gap.

---

## 3. Severity Classification

### CRITICAL — Grades with near-zero approved content

**Grade 2:** Only 3 approved lessons total (1 each in MATH, LITERACY, SCIENCE). CIVICS and SOCIAL_STUDIES have zero approved lessons. This grade is effectively not served by the adaptive engine.

**Grade 9:** Only 2 approved lessons total (1 MATH, 1 LITERACY). SCIENCE, CIVICS, and SOCIAL_STUDIES have zero. The entire Junior Secondary exit year is a content desert. Students finishing Grade 8 have nowhere to go in the system.

### SEVERE — Grades with thin coverage across all subjects

**Grade 5:** 21 APPROVED across 6 subjects. Every core subject is below threshold. However, 42 published SCIENCE lessons, 38 published MATH lessons, and 36 published LITERACY lessons exist in the pipeline — if approved, Grade 5 coverage becomes adequate immediately.

**Grade 6:** 26 APPROVED, no SOCIAL_STUDIES approved, no ENGLISH or CS. Thinner than Grade 5 and with a smaller published backlog.

### MODERATE — Junior Secondary grades (7, 8)

**Grade 7:** 27 APPROVED lessons across 5 subjects. A published backlog of 184 lessons (36 each for CIVICS, ENGLISH, MATH, SCIENCE, SOCIAL_STUDIES) is ready for approval. ENGLISH and SOCIAL_STUDIES have zero approved content.

**Grade 8:** 28 APPROVED lessons. No ENGLISH, SOCIAL_STUDIES, or published backlog. The gap here will not close without new content generation.

---

## 4. Subject-Level Analysis (APPROVED only)

| Subject | G1 | G2 | G3 | G4 | G5 | G6 | G7 | G8 | G9 | G10 | G11 | G12 | Total |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| MATH | 40 | 1 | 40 | 40 | 7 | 8 | 10 | 9 | 1 | 40 | 40 | 40 | **276** |
| SCIENCE | 40 | 1 | 40 | 40 | 6 | 6 | 5 | 6 | 0 | 40 | 40 | 40 | **264** |
| LITERACY | 40 | 1 | 40 | 40 | 6 | 7 | 7 | 8 | 1 | 40 | 40 | 40 | **270** |
| CIVICS | 40 | 0 | 40 | 40 | 1 | 5 | 5 | 5 | 0 | 40 | 40 | 40 | **256** |
| SOCIAL_STUDIES | 40 | 0 | 40 | 40 | 0 | 0 | 0 | 0 | 0 | 40 | 40 | 40 | **240** |
| ENGLISH | — | — | — | — | 0 | 0 | 0 | 0 | — | — | — | — | **0** |
| COMPUTER_SCIENCE | — | — | — | — | 1 | 0 | 0 | 0 | — | — | — | — | **1** |

**SOCIAL_STUDIES** has zero approved content in grades 5–9. Its bimodal distribution (full in G1–4 and G10–12, empty in G5–9) is the largest structural gap by subject.

**ENGLISH** as a separate subject from LITERACY has zero approved lessons anywhere. G5 has 10 pending/published English lessons; G7 has 41 — neither are student-accessible.

**COMPUTER_SCIENCE** has 1 approved lesson (G5). Effectively absent.

---

## 5. Published Backlog — Quick Wins

The following published lessons can be approved with no new content generation required:

| Grade | Subject | Published | Pending | Total Pipeline |
|---|---|---|---|---|
| G7 | MATH | 40 | 6 | 46 |
| G5 | SCIENCE | 42 | 30 | 72 |
| G7 | CIVICS | 36 | 2 | 38 |
| G7 | ENGLISH | 36 | 5 | 41 |
| G7 | SCIENCE | 36 | 3 | 39 |
| G7 | SOCIAL_STUDIES | 36 | 5 | 41 |
| G5 | MATH | 38 | 9 | 47 |
| G5 | LITERACY | 36 | 2 | 38 |
| G10 | MATH | 37 | 4 | 41 |
| G3 | SCIENCE | 36 | 1 | 37 |
| G9 | MATH | 1 | 9 | 10 |

**Highest-impact approval action:** Approve G7 bulk (184 lessons) → Grade 7 becomes fully functional. Approve G5 bulk (~125 lessons) → Grade 5 becomes adequate.

---

## 6. Missing Required Subjects by Curriculum Level

Based on Liberia MOE national curriculum framework:

### Primary (Grades 1–6)
| Subject | G1 | G2 | G3 | G4 | G5 | G6 |
|---|---|---|---|---|---|---|
| HEALTH | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| PHYSICAL_EDUCATION | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| RELIGIOUS_STUDIES | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| ENGLISH (distinct from LITERACY) | — | — | — | — | ❌ | ❌ |
| SOCIAL_STUDIES | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |

### Junior Secondary (Grades 7–9)
| Subject | G7 | G8 | G9 |
|---|---|---|---|
| ENGLISH | ❌ | ❌ | ❌ |
| SOCIAL_STUDIES | ❌ | ❌ | ❌ |
| PHYSICAL_EDUCATION | ❌ | ❌ | ❌ |
| AGRICULTURE | ❌ | ❌ | ❌ |
| HOME_ECONOMICS | ❌ | ❌ | ❌ |

### Senior Secondary (Grades 10–12)
| Subject | G10 | G11 | G12 |
|---|---|---|---|
| ENGLISH (distinct) | ❌ | ❌ | ❌ |
| CHEMISTRY (vs bundled SCIENCE) | ❌ | ❌ | ❌ |
| PHYSICS (vs bundled SCIENCE) | ❌ | ❌ | ❌ |
| BIOLOGY (vs bundled SCIENCE) | ❌ | ❌ | ❌ |
| GEOGRAPHY | ❌ | ❌ | ❌ |
| ECONOMICS | ❌ | ❌ | ❌ |

Note: Senior secondary SCIENCE bundles Chemistry, Physics, and Biology into one subject. This is a tracking limitation, not necessarily a content gap — but it prevents strand-level mastery tracking for individual sciences.

---

## 7. Adaptive Engine Coverage Assessment

These gaps directly constrain the Phase 5.2 adaptive learning system:

1. **Grade 2 and Grade 9 are effectively unservable.** The recommendation engine cannot generate meaningful pathways with 1–2 lessons per grade. Students in these grades should receive a "limited availability" notice rather than false recommendations from a 1-lesson sample.

2. **Grades 5–8 will produce low-confidence recommendations.** Fewer than 15 lessons per subject means the mastery engine will have sparse evidence. Confidence tiers must reflect this: most recommendations will land in `CONFIDENCE_LOW`, which should suppress automatic escalation.

3. **SOCIAL_STUDIES and ENGLISH recommendation paths will dead-end in grades 5–9.** The engine must handle gracefully the case where a subject has zero approved content — return no recommendation for that subject rather than surfacing stale or pending lessons.

4. **Senior secondary (G10–12) and primary anchor grades (G1, G3, G4) are fully stocked** at 40 lessons per subject. Adaptive recommendations will be most reliable and actionable for these grades.

5. **The published backlog represents the fastest path to improving recommendation quality.** Approving Grade 7 and Grade 5 backlogs would increase total approved content from 1,307 to approximately 1,616 (+24%) and would make Grades 5 and 7 fully functional overnight.

---

## 8. Implications for Phase 5.2 Implementation

| Decision | Reason |
|---|---|
| `CONFIDENCE_LOW` floor for G2, G9 | Not enough approved content to make reliable inferences |
| Subject availability check before recommendation | SOCIAL_STUDIES/ENGLISH return null for G5–9, not an error |
| Separate `approvedCount` field in teacher intelligence | Teachers need to know when low recommendations reflect data sparsity, not student performance |
| MOE intelligence must surface coverage gaps | `weakSubjects` array must call out G2, G9, G5–8 SOCIAL_STUDIES as system gaps, not just performance gaps |
| Intervention triggers must be grade-aware | A G9 student appearing "behind" may simply have no content at their grade level |

---

## 9. Summary

**1,307 approved lessons across grades 1–12, 7 subjects.**  
**Well-stocked:** Grades 1, 3, 4, 10, 11, 12 (200 approved each).  
**Critical gaps:** Grade 2 (3 lessons), Grade 9 (2 lessons).  
**Severe gaps:** Grades 5–8 (21–28 approved per grade).  
**Missing subjects entirely:** HEALTH, PHYSICAL_EDUCATION, ENGLISH (standalone), SOCIAL_STUDIES in G5–9.  
**Quick-win pipeline:** 389 published lessons ready for MOE approval — approving G7 and G5 backlogs would resolve two of the four severity tiers immediately.

---

**END OF PHASE 0 AUDIT — Phase 5.2 implementation may proceed.**
