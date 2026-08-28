# NR-12 Lesson Generation Guidelines

## Purpose

NR-12 closes the Grade 2 and Grade 9 critical deserts. A lesson counts toward
coverage only when it is teachable, authority-traceable, assessable, and
renderable by the existing lesson and quiz players. A title plus generic
instructional prose is a lesson shell, not a completed lesson.

## Authority before generation

The Liberia MOE curriculum is the source of the learning target. Existing repo
standard records are used where they are the available authority. Verified MOE
objective records are used for the Grade 2 Social Studies and Grade 9
Mathematics, Language Arts, General Science, and Social Studies records listed
in `lib/curriculum/nr12GradeDeserts.ts`.

Each lesson must retain:

- grade and canonical subject identity;
- one or more exact authority codes in `moeAlignments`;
- strand and source file/page metadata;
- an objective derived from the authority record;
- prerequisite and next-concept metadata;
- no unsupported WAEC topic-level claim.

The international techniques in `lib/curriculum/framework.ts` are pedagogy,
not curriculum authority. They are used in this order:

1. Grades 1-3: concrete examples, oral rehearsal, visible success checks, and
   short direct teaching cycles.
2. Grades 4-6: concrete-pictorial-abstract progression, explicit vocabulary,
   worked examples, guided release, and spaced retrieval.
3. Grades 7-9: coherent Japanese-style lesson structure, Korea/China-style
   practice rigor, explicit reasoning, note-making, error analysis, retrieval
   spirals, and independent transfer.
4. Grades 10-12: WAEC-facing command words, model answers, timed practice, and
   independent study, only where the applicable Liberian authority supports the
   subject or assessment claim.

These techniques change how a Liberian standard is taught. They never create a
new standard or replace MOE/WAEC authority.

## Required lesson structure

Every generated lesson must contain actual content for:

1. objective and prerequisite retrieval;
2. key vocabulary;
3. teacher explanation;
4. two concrete worked examples with visible reasoning;
5. guided practice with teacher checks;
6. independent practice with a changed case;
7. misconception and correction;
8. mastery check and remediation;
9. extension that deepens the same standard;
10. teacher notes, materials, and guardian support;
11. standard and block delivery variants where the schema supports both;
12. deterministic assessment metadata.

The lesson must tell a teacher what to say or show, what learners do, what a
correct response contains, and what to do when the response is wrong. Phrases
such as “model one example,” “use a short exit task,” or “apply the concept”
without the actual example or task are shells and fail validation.

## Grade adaptation

### Grade 2

Use short direct sentences, familiar objects, oral rehearsal, pictures, maps,
sorting, counting, drawing, and low-resource materials. Read directions aloud
when reading is not the target. Keep one action per instruction and make the
reason for each step visible. Do not make a Grade 2 lesson harder by adding
abstract vocabulary or long text.

### Grade 9

Use precise subject vocabulary, structured notes, worked reasoning, comparison
of methods where appropriate, error analysis, evidence, and independent
explanation. Keep the work at junior-secondary level. WAEC trajectory may guide
discipline and command words, but the repo must not claim a topic-level WAEC
mapping unless that evidence exists.

## Assessment contract

These are LiberiaLearn delivery defaults, not claims that MOE or WAEC requires
these exact counts:

| Assessment | Count | Purpose |
|---|---:|---|
| Lesson exit ticket | 2 | Immediate mastery signal, one recall/representation and one application |
| Lesson quiz | 5 | Objective, application, misconception repair, evidence, and transfer |
| Unit quiz | 10 | Cumulative sampling across the unit concepts and mapped standards |
| Term exam blueprint | 30 | Balanced cumulative coverage; the teacher may use the existing exam tool when a different approved format is required |

The five lesson-quiz items must have four options, one correct answer,
plausible distractors, an explanation, a mapped authority code, and a
deterministic answer key. Correct-option positions must vary. Numerical values
may change between items or lessons, but the measured concept and operation
must remain stable. An exam or quiz must not repeatedly test one memorized
number, one sentence copied from the lesson, or an unrelated fact.

## Generation and approval flow

1. Select an authority record and a single lesson-sized concept.
2. Build the objective, examples, guided practice, independent task, and
   assessment blueprint from that record.
3. Validate schema, grade/subject identity, authority trace, lesson structure,
   answer keys, placeholder absence, and shared depth threshold.
4. Persist through the existing governed curriculum repository.
5. Send automated candidates through `triageAndApprove`; high-risk first-of-kind
   Grade 2/9 content remains available for human/MOE review.
6. Count only `APPROVED` or `published` records in the coverage audit.

The deterministic NR-12 generator is in
`lib/curriculum/nr12GradeDeserts.ts`. The read-only audit is
`npm run audit:nr12`. It never mutates production or staging.

## Known generator improvements

The former coverage/factory templates were schema-valid but materially
under-specified: generic objectives, empty MOE alignments, abstract worked
examples, prose-only assessments, and budget fallbacks containing “Review
question” and “Option A.” NR-12 replaces that path for the critical cells with
source-linked authored lesson specifications and makes the runtime use the
stored five-question quiz when present. Generic AI quiz fallbacks containing
placeholder questions are rejected rather than presented as real assessment.

The remaining national factory and AI-generated lesson paths must adopt this
same authority-first and assessment contract before they are used for later
desert closure. Their existing word floors are necessary but not sufficient:
semantic alignment, concrete examples, item validity, and teacher usability
must also pass.
