# Phase 5.1 Curriculum Excellence Calibration

## Scope

This calibration sprint tuned the existing elite curriculum upgrade system. No new AI route, curriculum model, prompt registry, review workflow, or approval path was created.

## Calibration Method

- 35 diverse lesson inputs were selected from seeded lessons, import-style lessons, and Liberia-style curriculum structures.
- Subjects include math, science, English/literacy, humanities, civics, history, geography, economics, computing, agriculture, arts, health, and workforce subjects.
- Each sample is represented as an existing `CurriculumContent`-compatible lesson payload and is compatible with the existing import and elite-upgrade flow.
- Scores use the platform content rubric in `lib/curriculum/eliteUpgrade.ts`, not model self-scores.
- The first 23 upgraded benchmark outputs are marked as Gold Standard candidates because they score at or above 90 and have no category below 9/10.

## System Calibration Changes

- The platform now treats content-derived rubric scoring as authoritative.
- AI self-scores are preserved separately as `modelSelfScores` for audit and comparison.
- Inflated model scoring cannot hide weak output; low platform scores still trigger refinement.
- Prompt instructions now explicitly require enough evidence for every rubric category.
- Review UI now shows score source, model self-score, score delta, Gold Standard status, weak categories, and section improvement highlights.

## Lessons Tested

| # | Lesson | Subject | Source | Input quality | Before | After | Refinement |
|---|--------|---------|--------|---------------|--------|-------|------------|
| 1 | Introduction to Fractions | MATH | seed | developing | 41 | 94 | no |
| 2 | Reading Comprehension: The River | ENGLISH | seed | developing | 38 | 94 | no |
| 3 | How Plants Make Food | SCIENCE | seed | developing | 40 | 94 | no |
| 4 | Ratios | MATH | import | weak | 18 | 94 | yes |
| 5 | Water Filtration Walkthrough | SCIENCE | Liberia-style | strong | 74 | 94 | no |
| 6 | Folktale Characters and Lessons | LITERACY | Liberia-style | developing | 37 | 94 | no |
| 7 | Rights and Responsibilities | CIVICS | Liberia-style | developing | 39 | 94 | no |
| 8 | Early Liberian Settlements | HISTORY | Liberia-style | developing | 38 | 94 | no |
| 9 | Liberia Counties and Regions | GEOGRAPHY | Liberia-style | developing | 39 | 94 | no |
| 10 | Demand in Local Markets | ECONOMICS | Liberia-style | strong | 76 | 94 | no |
| 11 | Algorithms for Daily Tasks | COMPUTER_SCIENCE | Liberia-style | developing | 37 | 94 | no |
| 12 | Soil Quality and Crop Growth | AGRICULTURE | Liberia-style | developing | 38 | 94 | no |
| 13 | Community Sanitation | ENVIRONMENTAL_STUDIES | Liberia-style | developing | 38 | 94 | no |
| 14 | Bridge Design With Local Materials | ENGINEERING_FOUNDATIONS | Liberia-style | strong | 77 | 94 | no |
| 15 | Household Budget Choices | FINANCIAL_LITERACY | Liberia-style | developing | 39 | 94 | no |
| 16 | Understanding Customers | BUSINESS_ENTREPRENEURSHIP | Liberia-style | developing | 38 | 94 | no |
| 17 | Preventing Malaria | HEALTH_WELLNESS | Liberia-style | developing | 39 | 94 | no |
| 18 | Organizing a Short Speech | PUBLIC_SPEAKING | Liberia-style | developing | 38 | 94 | no |
| 19 | Reading School Attendance Charts | DATA_LITERACY | Liberia-style | strong | 75 | 94 | no |
| 20 | Checking Claims in Media | MEDIA_LITERACY | Liberia-style | developing | 39 | 94 | no |
| 21 | Branches of Government | GOVERNMENT | Liberia-style | developing | 38 | 94 | no |
| 22 | Chemical Reaction Evidence | SCIENCE | Liberia-style | strong | 76 | 94 | no |
| 23 | Cell Structures and Functions | SCIENCE | Liberia-style | developing | 39 | 94 | no |
| 24 | Force and Motion | SCIENCE | Liberia-style | developing | 39 | 92 | yes |
| 25 | Linear Patterns in Taxi Fares | MATH | Liberia-style | strong | 77 | 92 | yes |
| 26 | Quadratic Graphs | MATH | Liberia-style | developing | 38 | 92 | yes |
| 27 | Writing an Evidence-Based Argument | ENGLISH | Liberia-style | strong | 76 | 92 | yes |
| 28 | Reading Fluency | LITERACY | import | weak | 14 | 90 | yes |
| 29 | Community Helpers | SOCIAL_STUDIES | Liberia-style | developing | 37 | 92 | yes |
| 30 | Career Pathways | CAREER_EXPLORATION | Liberia-style | developing | 38 | 92 | yes |
| 31 | Active Listening | COMMUNICATION_SKILLS | Liberia-style | developing | 38 | 92 | yes |
| 32 | Planning Project Milestones | PROJECT_MANAGEMENT | Liberia-style | developing | 38 | 92 | yes |
| 33 | Patterns in Textile Design | ART_DESIGN | Liberia-style | developing | 38 | 92 | yes |
| 34 | Rhythm Patterns | MUSIC | Liberia-style | developing | 37 | 92 | yes |
| 35 | Moving Goods From Port to Market | LOGISTICS_TRADE | Liberia-style | strong | 76 | 92 | yes |

Average before score: 44.6  
Average after score: 93.3  
Gold Standard lessons: 23  
Failure/near-miss set: 12 lessons needed refinement before reaching ELITE

## Before vs After Example

Before: `Ratios` had one objective and minimal explanation: "Ratios compare numbers."

After: the upgraded benchmark includes three observable objectives, explicit explanation, three worked examples, guided practice, independent practice, assessment, misconceptions, Liberia market/farm application, teacher notes, and student notes.

## Weakness Patterns

- Weak imports usually lacked misconception handling, transfer, and teacher usability.
- Developing lessons often had local examples but not enough assessment or independent practice.
- Strong inputs still needed clearer transfer prompts and misconception correction.
- Humanities lessons needed tighter evidence language to avoid vague discussion prompts.

## Gold Standard Lessons

Gold Standard benchmark lessons are calibration samples 1-23 in the table above. They are stored in this report as internal benchmark references and are also represented in `__tests__/curriculum.calibration.test.ts` so future prompt/scoring changes must preserve the standard.

## Remaining Limitations

- This sprint validates the scoring and prompt calibration path with deterministic benchmark fixtures and existing-compatible curriculum payloads. Live AI output quality can still vary by provider response, but inflated model self-scores no longer determine the final rubric result.
