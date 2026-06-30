# How LiberiaLearn Lessons Are Made, Checked, and Kept Current

*A plain-English guide for school leaders and the Ministry of Education.*
*Last updated: 30 June 2026.*

This document answers the questions principals and Ministry officials most often
ask: Who writes the lessons? Are they accurate? Are they aligned to the Liberian
curriculum? How often are they updated? It is written for non-technical readers.

---

## 1. Who writes the lessons (authorship)

LiberiaLearn lessons are **drafted by artificial intelligence and then reviewed
by people before students ever see them.** No lesson reaches a student on AI
output alone.

Each lesson is built in **two passes**:

- **Pass 1 — the lesson body.** A large language model writes the full teaching
  text: explanation, worked examples, activities, and practice. Lessons are
  long and structured on purpose — most run **2,500 to 4,500 words across ~17
  sections** (introduction, direct instruction, guided practice, independent
  practice, assessment, and reflection).
- **Pass 2 — the lesson "label sheet."** A second model reads the finished body
  and extracts structured information: learning objectives, key vocabulary,
  curriculum-standard tags, and the end-of-lesson assessment questions.

The platform enforces **depth gates** so lessons are never thin: a draft under
**2,000 words is automatically rejected**, and shorter drafts are sent back for
expansion to a **3,000-word working floor**, with minimum lengths for each
section of the lesson. A lesson that fails these gates does not advance.

Teachers can also **create or adapt their own lessons** inside the platform.
Teacher-created content goes through the same review gate before it is published
to a class.

---

## 2. How lessons are reviewed (the approval process)

Every lesson moves through a simple, auditable **state machine**:

```
   DRAFT  ──►  NEEDS_REVIEW  ──►  APPROVED / PUBLISHED
                     │
                     └──►  REJECTED (with a reason, sent back for revision)
```

- A newly generated or teacher-edited lesson enters **NEEDS_REVIEW**.
- A human reviewer works through a **moderation queue**, reading the lesson and
  either approving it (status becomes *published/APPROVED*) or rejecting it with
  a written reason.
- **Students only ever see APPROVED/published lessons.** The system refuses to
  serve any other status — this is enforced in code, not by policy alone.
- **School principals can override** teacher-created content for their own
  school, and the Ministry has read-only oversight of the whole library.

Because the queue, the approvals, and the rejections are all recorded, there is
always a traceable answer to "who approved this lesson, and when."

---

## 3. How often lessons are updated (cadence)

We will be candid here, because the Ministry should have an accurate picture.

- **Current state.** The present lesson library was generated in **batches**,
  and every lesson carries a "last updated" timestamp in the system. The library
  is substantial: **~5,900 approved lessons** across grades 1–12 and all core
  subjects.
- **Going forward.** LiberiaLearn is moving to a **scheduled quarterly review
  cycle** beginning **Q1 2027**: each quarter, a slice of the library is
  re-reviewed for accuracy and currency, prioritised by the subjects and grades
  with the most student usage. Urgent corrections (factual errors flagged by
  teachers) are handled immediately, outside the quarterly cycle, through the
  same review queue.

Teachers can **flag any lesson** for help or correction directly from the lesson
page; flagged lessons surface to reviewers.

---

## 4. Alignment to the Liberian curriculum

Lessons carry **curriculum-standard tags** (stored on each lesson) that map them
to national standards, and the platform tracks **coverage** — which standards
have lessons and which are still thin. There is a dedicated alignment view that
reports coverage by subject and grade band.

For the **West African Senior School Certificate Examination (WASSCE/WAEC)**, the
platform already grades extended writing against **WAEC-style rubrics**.
A fuller, branded WAEC preparation track is on the roadmap (see the platform
improvement plan).

**Formal sign-off** of the full library against the official Liberian national
curriculum is **in progress with curriculum specialists.** We do not claim
completed national accreditation; we claim a structured, standards-tagged library
with an alignment review underway.

---

## 5. Curriculum coverage dashboard

Administrators can see a live **coverage heatmap** at
`/admin/curriculum/coverage` — a grade × subject grid showing how many approved
lessons exist in each cell, where the "deserts" are, and audio-narration
coverage. The Ministry has a **read-only mirror** of the same dashboard. This
makes gaps visible and honest rather than hidden.

---

## 6. Quality and safety gates

Several safeguards run continuously:

- **Automated test suite.** The platform is protected by **~3,570 automated
  tests** that run before any change ships. A change that breaks a test does not
  reach production.
- **Content sanitisation.** All lesson HTML is passed through a sanitiser before
  display, so lesson content cannot inject unsafe code into a student's browser.
- **Immutable audit log.** Approvals, rejections, role changes, and exports are
  written to a tamper-resistant audit log (records cannot be silently edited or
  deleted).
- **Human-in-the-loop review.** As described in section 2, no lesson is published
  without a person approving it.

---

### Summary for decision-makers

LiberiaLearn is **AI-drafted, human-approved, standards-tagged, and
version-tracked.** The library is large and deep (lessons are thousands of words,
not summaries), students only see approved content, coverage gaps are visible on
a dashboard, and the platform is moving to a published quarterly update cycle.
The honest open items are **formal national-curriculum sign-off** and a
**dedicated WAEC preparation track**, both in progress.
