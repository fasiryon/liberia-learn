# Understanding Essay Writing: Structure and Argument

- Candidate: `cv2-cand-g7-literacy-essay-structure-argument` v0.1.0 · Grade 7 LITERACY · Writing / argumentative essay
- Pipeline status: **REVIEW_BLOCKED** · governance: DRAFT, human review required, not published, MOE approval not claimed, qualified review not started
- Candidate hash: `e875feab4d8d9742f421ba98c4c8c59f753e613a3d67526a77409cdd6019f786` · learner projection hash: `fdab57d016e30b374f12ca86270043b9ac0220b9c9ba231b94e9aabe4a04707a` (review this exact revision only)
- Origin: AUTHORED_FIXTURE in the `candidate-lesson-v2/1.0.0` generator format (no live model call); strict parser, deterministic validator and deliverability checks passed with 0 errors
- Not assembled into `curriculum-lesson-v2/1.0.0`: assembly needs a Grade 7 template cell and ontology release that do not exist (see Review gaps)
- Strategy: WORKED_EXAMPLE_FADING — Learners see a complete model essay plan and a model PEEL paragraph, take each part apart, practise choosing and ordering parts with feedback, and only then write their own thesis and paragraph. Writing builds on the MOE Grade 7 paragraph-writing work (topic sentences, kinds of paragraphs).

## Source and provenance

- Legacy row (not modified): `hero-literacy-g7-essay-writing-structure-and-argumentation` (pk `cmpyjp25s00cqvorwisg1rhyn`), "Understanding Essay Writing: Structure and Argumentation", status published, payload approval none, unit `literacy-g7-6-paragraphs-and-text-structure`, 2 sections, current revision `cmss94dmc03b7vo54ryf3hqk1`
- Unit verification: Cleanup plan V1 keeps the unit key with reason no_verified_unit_match (no verified MOE unit).
- Recorded from `artifacts/curriculum-cleanup-v1/snapshot.json` (captured 2026-09-26T09:07:15.873Z). Learner history attached to the legacy row: LearningEvent 1 (RETAIN_HISTORY), ScheduledWork 42 (RETAIN_HISTORY). The candidate never touches these rows.
- Legacy body: read from production on 2026-10-15T19:09:16.876Z in a single READ ONLY transaction (`scripts/extract-g7-legacy-revisions.ts`), stored in `artifacts/g7-native-curriculum-v1/legacy/literacy-essay-structure-argument.json`. Revision `cmss94dmc03b7vo54ryf3hqk1` content hash `3809f98290bae0a5b8364e4bc2faf8c257111f0c21e3c383acd45310fc236ba6`; recomputed from the extract: match.
- Section-by-section comparison, concerns, recommendations and alignment options: [legacy-comparison.md](legacy-comparison.md) (reviewer only).

## Objective alignment

No structured MOE Grade 7 OBJECTIVE item matches this lesson. Its objectives are LiberiaLearn candidates; each MOE item below is a relationship, not a binding.

| Candidate objective | Statement | MOE relationships (verbatim source text) |
| --- | --- | --- |
| `ll-g7-lit-essay-structure` | Identify and explain the parts of an argumentative essay: an introduction that ends with a thesis statement, body paragraphs that each begin with a topic sentence, and a conclusion. | SOURCE_TEXT_UNSTRUCTURED: OCR text only, objectives column; structured as ACTIVITY `moe-english-g7-s1-p1-constructing-sentences-antroduction-to-literatur-act1` under period 1 (misfiled, not bindable) — G7, GRADE 7-9/English 7-9.pdf p.4 — "1. Construct paragraphs using subject and verb agreement, capitalization, punctuations etc."<br>SOURCE_TEXT_UNSTRUCTURED: OCR text only, contents column (no structured item) — G7, GRADE 7-9/English 7-9.pdf p.4 — "2. Writing kinds of paragraphs E.g.) descriptive, narrative etc."<br>BUILDS_ON: `moe-english-g6-s1-a-subject-verb-agreement-b-using-verbs-in-senten-obj2` — G6, GRADE-1-6/English 1-6.pdf p.119 — "Construct different types of paragraphs"<br>LATER_GRADE_SCOPE: `moe-english-g8-s2-composition-literature-and-reading-comprehension-obj3` — G8, GRADE 7-9/English 7-9.pdf p.18 — "Develop composition on issues such as social norms, peer influences, decision making, etc." |
| `ll-g7-lit-argument-build` | Build an argument by writing an arguable thesis statement with reasons and answering a counterargument. | LATER_GRADE_SCOPE: `moe-english-g8-s2-composition-literature-and-reading-comprehension-obj3` — G8, GRADE 7-9/English 7-9.pdf p.18 — "Develop composition on issues such as social norms, peer influences, decision making, etc."<br>LATER_GRADE_SCOPE: `moe-english-g9-s2-composition-literature-reading-comprehension-sem-obj3` — G9, GRADE 7-9/English 7-9.pdf p.32 — "Develop and defend a points of view in composition" |
| `ll-g7-lit-evidence-support` | Choose true, relevant and specific evidence for a reason and explain how it supports the claim in a PEEL paragraph. | SOURCE_TEXT_UNSTRUCTURED: OCR text only, objectives column; structured as ACTIVITY `moe-english-g7-s1-p1-constructing-sentences-antroduction-to-literatur-act1` under period 1 (misfiled, not bindable) — G7, GRADE 7-9/English 7-9.pdf p.4 — "1. Construct paragraphs using subject and verb agreement, capitalization, punctuations etc."<br>LATER_GRADE_SCOPE: `moe-english-g9-s2-composition-literature-reading-comprehension-sem-obj3` — G9, GRADE 7-9/English 7-9.pdf p.32 — "Develop and defend a points of view in composition" |

Prerequisites assumed:
- Can write a paragraph with a topic sentence and supporting sentences (MOE Grade 7 paragraph writing).
- Can tell a fact from an opinion in simple sentences.
- Has discussed both sides of a school or community question in class.

## Teaching sequence and scene manifest

| # | Scene | Type / purpose | Objectives | Interaction | Evidence | Words | Visual | Scene hash |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `intro` | INTRO / HOOK_PHENOMENON | `essay-structure`, `argument-build` | NONE | NONE | 75 | — | `5c9953d4b7b2…` |
| 2 | `objectives` | OBJECTIVE / STATE_OBJECTIVE | `essay-structure`, `argument-build`, `evidence-support` | NONE | NONE | 11 | — | `d8e2b6464cbf…` |
| 3 | `warm-up` | CHECK_UNDERSTANDING / ACTIVATE_PRIOR_KNOWLEDGE | `essay-structure`, `evidence-support` | SINGLE_CHOICE | FORMATIVE_OBSERVATION | 14 | — | `b13da10bd925…` |
| 4 | `essay-structure` | EXPLANATION / EXPLAIN_CONCEPT | `essay-structure` | NONE | NONE | 98 | `literacy-essay-structure.svg` | `9174a7e18fd7…` |
| 5 | `model-plan` | INTERACTIVE_DIAGRAM / MODEL_WORKED_EXAMPLE | `essay-structure`, `argument-build` | DIAGRAM_REVEAL | NONE | 28 | — | `4346a7daef39…` |
| 6 | `thesis` | GUIDED_EXAMPLE / GUIDED_PRACTICE | `argument-build` | SINGLE_CHOICE | FORMATIVE_OBSERVATION | 56 | — | `b60735b0e789…` |
| 7 | `peel` | INTERACTIVE_DIAGRAM / MODEL_WORKED_EXAMPLE | `evidence-support` | DIAGRAM_REVEAL | NONE | 23 | `literacy-peel-paragraph.svg` | `7db8fb5bd58f…` |
| 8 | `evidence` | EXPLANATION / EXPLAIN_CONCEPT | `evidence-support` | NONE | NONE | 73 | `literacy-evidence-test.svg` | `98b74a7ef79c…` |
| 9 | `evidence-check` | CHECK_UNDERSTANDING / ADDRESS_MISCONCEPTION | `argument-build`, `evidence-support` | SINGLE_CHOICE | FORMATIVE_OBSERVATION | 16 | — | `66b57a1abb62…` |
| 10 | `order-paragraph` | PRACTICE / GUIDED_PRACTICE | `essay-structure` | ORDERING (fallback FREE_RESPONSE) | FORMATIVE_OBSERVATION | 21 | — | `30bfe2ec609e…` |
| 11 | `write-argument` | PRACTICE / INDEPENDENT_PRACTICE | `argument-build`, `evidence-support` | FREE_RESPONSE | FORMATIVE_OBSERVATION | 42 | — | `823d0b8db68a…` |
| 12 | `review` | REVIEW / REVIEW | `essay-structure`, `argument-build`, `evidence-support` | NONE | NONE | 11 | — | `bbeb1a819e2b…` |
| 13 | `exit-ticket` | MASTERY_CHECK / ASSESS_MASTERY | `essay-structure`, `argument-build`, `evidence-support` | ASSESSMENT_HANDOFF (fallback PAPER_ACTIVITY) | MASTERY_RESPONSE | 16 | — | `ba2f86d89b4c…` |
| 14 | `reflect` | REFLECTION / REFLECT | `essay-structure` | FREE_RESPONSE | REFLECTION | 14 | — | `232578b92a7e…` |

Full hashes, asset digests and source digests are in `scene-manifest.json`.

## Scenes in full

### Why write an argument? (`intro`)

Learner action: Read the situation and think about how you would convince the meeting.

At a PTA meeting, parents and teachers disagree: should the school use its empty land for a **school garden**? Some people speak well, but a week later nobody remembers exactly what they said.

A written argument lasts. An **argumentative essay** puts your claim, your reasons and your evidence in an order a reader can follow, so they can judge your argument and maybe agree with you. Today you will learn that order and use it.

- Accessibility: Introduction: a PTA meeting disagrees about a school garden. A written argumentative essay organizes a claim, reasons and evidence so a reader can follow and judge it. · keyboard: Tab to each control, press Enter or Space to choose, then use Continue.
- Offline (FULL_OFFLINE): Text, steps and questions are part of the saved lesson.

### What you will be able to do (`objectives`)

Learner action: Read the three goals and the success check.

By the end of this lesson you will be able to:

- Name the parts of an argumentative essay and say what each part does.
- Write a clear thesis statement and answer the other side of the argument.
- Choose evidence that really supports a reason, and explain it in a PEEL paragraph.
- Success check: you can write a thesis and one PEEL body paragraph on a topic you choose.

- Accessibility: Lesson goals: name the parts of an essay, write a thesis and answer the other side, and support a reason with explained evidence. · keyboard: Tab to each control, press Enter or Space to choose, then use Continue.
- Offline (FULL_OFFLINE): Text, steps and questions are part of the saved lesson.

### Warm-up: paragraphs and facts (`warm-up`)

Learner action: Answer two questions from your paragraph-writing lessons and read the feedback.

Essays are built from paragraphs. Check what you remember. These answers are not marked.

- What does a topic sentence do? — options: It tells the main idea of the paragraph (expected) / It gives the last small detail / It always asks the reader a question
- Which sentence is a fact, not an opinion? — options: School gardens are the best thing a school can have. / Cassava leaves are grown and eaten in many parts of Liberia. (expected) / Everyone loves working in the garden.
- Hints: A fact can be checked; an opinion is what someone thinks or feels.
- Accessibility: Two warm-up questions: what a topic sentence does, and which sentence is a fact. Each answer shows written feedback. · keyboard: Tab to each control, press Enter or Space to choose, then use Continue.
- Offline (FULL_OFFLINE): Text, steps and questions are part of the saved lesson.

### The three parts of an argumentative essay (`essay-structure`)

Learner action: Study the essay diagram and the job of each part.

An argumentative essay has three parts, and each part has a job.

The **introduction** catches the reader's attention with a hook, gives a little background, and ends with the **thesis statement**: your claim and the main reasons for it.

Each **body paragraph** argues one reason. It starts with a **topic sentence**, then gives evidence and explains it. A strong essay also uses one paragraph to answer the other side.

The **conclusion** restates the thesis in new words, sums up the reasons, and ends with a final thought or a call to action. It does not add new reasons.

- Introduction: hook, background, thesis statement.
- Body: one reason per paragraph, each with a topic sentence, evidence and explanation.
- Conclusion: restate, sum up, final thought. No new reasons.

- Media DIAGRAM (MEDIA_OPTIONAL): An essay drawn as three stacked blocks: introduction (hook, background, thesis), body paragraphs (topic sentence, evidence, explanation; one answers the other side), conclusion (restate, sum up, final thought). — alt: Essay structure: introduction with hook, background and thesis; body paragraphs, each with a topic sentence, evidence and explanation, one answering the other side; conclusion that restates, sums up and ends with a final thought.
- Accessibility: The three parts of an argumentative essay and the job of each: introduction with thesis, body paragraphs with topic sentences and evidence, and a conclusion that adds no new reasons. · keyboard: Tab to each control, press Enter or Space to choose, then use Continue.
- Offline (FULL_OFFLINE): Text, steps and questions are part of the saved lesson.

### Take apart a model essay plan (`model-plan`)

Learner action: Open each part of the model essay plan in order.

Here is a plan for the essay **Every school in Liberia should have a school garden**. Open each part to see what the writer put there and why.

1. **Introduction: hook** — Imagine eating fresh greens at lunch that you and your classmates grew yourselves. (A picture the reader can imagine pulls them in.)
2. **Introduction: thesis statement** — Every school in Liberia should have a school garden because gardens teach useful farming and science skills and give schools fresh food for learners. (Claim + two reasons.)
3. **Body paragraph 1: first reason** — Topic sentence: A school garden turns science and agriculture lessons into real work. The paragraph then gives evidence and explains it.
4. **Body paragraph 2: second reason** — Topic sentence: A garden can add fresh vegetables to school meals. Evidence and explanation follow.
5. **Body paragraph 3: the other side** — Some people say gardens take time away from lessons. But garden work can be part of science and agriculture lessons, done in short weekly sessions. (Objection, then answer.)
6. **Conclusion** — School gardens build skills and feed learners. Every school with land should start one this year. (Restate, sum up, call to action; no new reasons.)

- Hints: Notice that each body paragraph matches one reason from the thesis.
- Accessibility: Six text steps of a model plan for 'Every school in Liberia should have a school garden': hook, thesis, two reason paragraphs, an answer to the other side, and a conclusion. · keyboard: Tab to each control, press Enter or Space to choose, then use Continue.
- Offline (FULL_OFFLINE): Text, steps and questions are part of the saved lesson.

### Guided practice: what makes a strong thesis (`thesis`)

Learner action: Choose the strongest thesis in each question and read why.

A strong thesis statement is a **claim**: a sentence a sensible person could disagree with. It is specific, and it names the reasons the essay will argue.

A topic ('school gardens'), a plain fact ('some schools have gardens') or an announcement ('I will write about gardens') is not a thesis, because there is nothing to argue.

- Claim: could someone disagree?
- Specific: says exactly what should happen.
- Reasons: names why, so the reader knows what is coming.

- Which is the strongest thesis statement? — options: School gardens. / Some schools in Liberia have gardens. / Every school in Liberia should have a school garden because gardens teach farming skills and provide fresh food. (expected) / I will write about gardens in this essay.
- Which sentence could a sensible person disagree with? — options: Monrovia is the capital of Liberia. / Students should have 30 minutes of reading time every school day because it builds vocabulary and confidence. (expected) / Many students go to school.
- Hints: Ask: could a sensible person disagree with this sentence?
- Accessibility: What makes a strong thesis, then two questions: choose the strongest thesis and choose the sentence someone could disagree with, each with written feedback. · keyboard: Tab to each control, press Enter or Space to choose, then use Continue.
- Offline (FULL_OFFLINE): Text, steps and questions are part of the saved lesson.

### Build a body paragraph with PEEL (`peel`)

Learner action: Open each PEEL sentence of the model paragraph in order.

A strong body paragraph follows **PEEL**: **P**oint, **E**vidence, **E**xplain, **L**ink. Open each step to build the first body paragraph of the garden essay.

1. **P: Point (topic sentence)** — A school garden turns science and agriculture lessons into real work.
2. **E: Evidence** — For example, when learners plant pepper and greens, they measure the beds, test which soil holds water best and record how fast each plant grows.
3. **E: Explain** — This shows that the garden makes learners practise measuring, testing and recording: skills they need in science class and on a family farm.
4. **L: Link** — So a garden makes lessons more useful, which is one reason every school should have one.

- Hints: The Explain sentence answers: so what? How does this evidence prove the point?
- Media DIAGRAM (MEDIA_OPTIONAL): Four stacked boxes labelled Point, Evidence, Explain and Link, each holding one sentence of the model garden paragraph, with arrows showing how each sentence leads to the next. — alt: PEEL paragraph: Point (a garden turns lessons into real work), Evidence (learners measure beds, test soil, record growth), Explain (they practise science and farming skills), Link (so every school should have a garden).
- Accessibility: A model PEEL paragraph in four text steps: point, evidence, explanation and link, about how a garden turns lessons into real work. · keyboard: Tab to each control, press Enter or Space to choose, then use Continue.
- Offline (FULL_OFFLINE): Text, steps and questions are part of the saved lesson.

### Choosing strong evidence (`evidence`)

Learner action: Learn four kinds of evidence and the questions that test them.

Evidence is what makes a reader believe your reason. Four kinds are useful in school essays: **facts and figures** from a source you can name, **examples** of real events, the words of an **expert** (such as a teacher, nurse or agriculture officer), and your own **experience**.

Before you use evidence, test it with four questions. Never make up a fact or a number: if you use a figure, say where it comes from.

- Is it true, and can the reader check it?
- Is it relevant: does it prove this reason?
- Is it specific: who, what, where, when?
- Where does it come from?

- Media DIAGRAM (MEDIA_OPTIONAL): Four evidence cards (facts and figures, examples, expert words, experience) passing through a four-question test: true, relevant, specific, source. — alt: Four kinds of evidence (facts and figures with a source, examples, expert words, experience) and four tests: is it true, is it relevant, is it specific, where does it come from.
- Accessibility: Four kinds of evidence and four test questions for evidence, listed in the text and key points. · keyboard: Tab to each control, press Enter or Space to choose, then use Continue.
- Offline (FULL_OFFLINE): Text, steps and questions are part of the saved lesson.

### Watch out: weak evidence and weak reasons (`evidence-check`)

Learner action: Choose the best answer to each question and read why.

Writers often fall into these traps. Choose an answer for each question, then read the explanation.

- Reason: a garden can add fresh vegetables to school meals. Which evidence supports this reason best? — options: Gardens look beautiful when the flowers bloom. / Last term our agriculture club harvested greens and pepper that the school cook used in lunch for a week. (expected) / Gardens are good, and everyone knows it. / Many countries have gardens.
- Musa writes: 'School gardens are good because they are good for schools.' What is the problem? — options: Nothing. It is a strong argument. / It repeats the claim instead of giving a real reason. (expected) / The sentence is too long.
- Why should an argumentative essay mention the other side? — options: To show the writer has changed their mind. / To answer a likely objection, which makes the argument stronger. (expected) / To make the essay longer.
- Hints: Read the reason and the evidence together. Does the evidence prove this reason?
- Accessibility: Three questions: choose the evidence that best supports a reason, spot a reason that repeats the claim, and explain why essays answer the other side. · keyboard: Tab to each control, press Enter or Space to choose, then use Continue.
- Offline (FULL_OFFLINE): Text, steps and questions are part of the saved lesson.

### Put a paragraph in PEEL order (`order-paragraph`)

Learner action: Read the four sentences and write their letters in PEEL order.

These four sentences make one body paragraph, but they are mixed up. Put them in PEEL order: Point, Evidence, Explain, Link.

- A. So when learners grow food at school, everyone eats better, which is why every school needs a garden.
- B. Fresh vegetables from a school garden can make school meals healthier.
- C. This shows that the garden gives the kitchen food it would otherwise have to buy or go without.
- D. For example, our school's greens and pepper were used in lunch for a whole week last term.

- Requested ORDERING: Put the four sentences in PEEL order. [A: Link sentence about everyone eating better; B: Point about fresh vegetables; C: Explanation about food for the kitchen; D: Evidence about a week of lunches]
- Fallback (FREE_RESPONSE, objective preserved: true): Write the four letters in PEEL order (for example: X, X, X, X), then say which letter is the topic sentence.
- Expected observation (reviewer only): B, D, C, A. B is the topic sentence (Point).
- Hints: The Point is the topic sentence: it states the reason. | The Link connects back to the thesis, so it comes last.
- Accessibility: Four mixed sentences labelled A to D, listed in the text. Type their letters in PEEL order. · keyboard: Tab to each control, press Enter or Space to choose, then use Continue. · non-pointer: Type the letters in order in the text box. No dragging is needed.
- Offline (FULL_OFFLINE): The written answer is kept on the device until it can be sent.

### Write your own thesis and PEEL paragraph (`write-argument`)

Learner action: Choose a topic, write a thesis, then write one PEEL body paragraph.

Now write your own. Choose one topic, decide what you think, and write. Use only true evidence: an example you know, a fact you can check, or your own experience. Your teacher reads this writing; it is not marked by this lesson.

- Topic 1: Every community should have a public library.
- Topic 2: Schools should start each day with 20 minutes of reading.
- Topic 3: Learners should help keep their school compound clean every week.

- Write a thesis statement for your topic: your claim and two reasons. (min 60 chars)
- Write one body paragraph for your first reason using PEEL: Point, Evidence, Explain, Link. (min 250 chars)
- Expected observation (reviewer only): Thesis is an arguable claim that names two reasons. Paragraph opens with a topic sentence matching reason one, gives specific true evidence, explains how it supports the point, and links back to the claim.
- Hints: Start your thesis with your claim, then use 'because' to add two reasons. | Begin your paragraph with your first reason as the topic sentence.
- Accessibility: Choose one of three topics, then write a thesis statement and one PEEL body paragraph in two text boxes. · keyboard: Tab to each control, press Enter or Space to choose, then use Continue.
- Offline (FULL_OFFLINE): Writing is kept on the device until it can be sent to the teacher.

### Key ideas to remember (`review`)

Learner action: Read the key ideas before the exit ticket.

Before the exit ticket, review the big ideas of this lesson.

- An essay has an introduction (ending with the thesis), body paragraphs and a conclusion.
- A thesis is a claim someone could disagree with, plus the reasons you will argue.
- Each body paragraph follows PEEL: Point, Evidence, Explain, Link.
- Strong evidence is true, relevant and specific, and you can say where it comes from.
- Answer the other side; do not add new reasons in the conclusion.

- Accessibility: Review of five key ideas: essay parts, thesis, PEEL paragraphs, strong evidence, and answering the other side. · keyboard: Tab to each control, press Enter or Space to choose, then use Continue.
- Offline (FULL_OFFLINE): Text, steps and questions are part of the saved lesson.

### Exit ticket (`exit-ticket`)

Learner action: Answer the exit-ticket questions on your own.

Answer each question on your own. Your school's assessment system checks these answers, not this lesson.

- Fallback (PAPER_ACTIVITY, objective preserved: true): Your teacher gives the same exit-ticket questions on paper and records your answers.
- Accessibility: Exit-ticket questions on essay structure, thesis and counterargument, and evidence, answered with the keyboard or touch. · keyboard: Tab to each option and press Space. · non-pointer: Without a device, the teacher reads each question and its choices aloud and records the learner's spoken answer.
- Offline (FALLBACK_REQUIRED): Answers given on a device are checked after reconnecting; without a device the teacher gives the same questions on paper.

### Plan your next step as a writer (`reflect`)

Learner action: Write two or three sentences about your writing.

Good writers know what they need to practise. Write your answer in full sentences.

- Which part of an essay is hardest for you: the thesis, the evidence or the conclusion? What will you do to make it better next time? (min 40 chars)
- Hints: Name one part, say why it is hard, and name one thing you will try.
- Accessibility: Write two or three sentences about which part of an essay is hardest for you and how you will improve it. · keyboard: Tab to each control, press Enter or Space to choose, then use Continue.
- Offline (FULL_OFFLINE): The written answer is kept on the device until it can be sent.

## Misconceptions

- `mc-topic-not-thesis` (`ll-g7-lit-argument-build`): Writes a topic or an announcement ('This essay is about gardens') instead of an arguable claim. → Ask: could a sensible person disagree with this sentence? If not, it is a topic or a fact, not a thesis.
- `mc-opinion-as-evidence` (`ll-g7-lit-evidence-support`): Uses an opinion or a feeling ('everyone loves gardens') as if it were evidence. → Evidence must be something the reader can check or picture: an example, a fact with a source, or a real experience.
- `mc-circular-reasoning` (`ll-g7-lit-argument-build`): Repeats the claim as its own reason ('gardens are good because they are good'). → A reason answers 'why?' with new information. Say what the garden does, not just that it is good.
- `mc-irrelevant-evidence` (`ll-g7-lit-evidence-support`): Gives true but unrelated evidence that does not support the reason in that paragraph. → Read the reason and the evidence together: does the evidence prove this reason, or something else?
- `mc-ignore-counterargument` (`ll-g7-lit-argument-build`): Thinks mentioning the other side weakens an essay, so never answers objections. → Answering the strongest objection shows the reader you have thought it through, and makes your claim harder to reject.
- `mc-conclusion-new-idea` (`ll-g7-lit-essay-structure`): Adds a brand-new reason in the conclusion. → The conclusion restates the thesis in new words and sums up the reasons already argued; new reasons belong in a body paragraph.

## Assessment handoff (Assessment Player V2)

- `g7-essay-exit-ticket`: SINGLE_CHOICE, QUIZ, CORE; scoring SERVER_AUTHORITY; governed items: none yet; 6 candidate items in [assessment-review.md](assessment-review.md) (reviewer only); tools prohibited dictionary; offline FALLBACK_REQUIRED

## Instructional revision ledger

- Title: "Understanding Essay Writing: Structure and Argumentation" → "Understanding Essay Writing: Structure and Argument". Plainer word for Grade 7 learners; the topic is unchanged.
- Legacy body comparison: **RECORDED_AWAITING_REVIEWER_SIGNOFF** (revision `cmss94dmc03b7vo54ryf3hqk1`; see [legacy-comparison.md](legacy-comparison.md)).

| Scene | Change | Source | Rationale |
| --- | --- | --- | --- |
| `intro` | NEW | — | Community decision (PTA meeting, school garden) as the reason to write an argument. |
| `objectives` | NEW | — | Three measurable objectives and a success check. |
| `warm-up` | NEW | — | Activates MOE Grade 6–7 paragraph knowledge (topic sentence) and fact versus opinion. |
| `essay-structure` | NEW | — | Three-part essay structure with the job of each part. |
| `model-plan` | NEW | — | Complete model plan on a Liberian school topic, including a counterargument paragraph. |
| `thesis` | NEW | — | Distinguishes claims from topics, facts and announcements with feedback. |
| `peel` | NEW | — | PEEL paragraph model (Point, Evidence, Explain, Link). Whether PEEL is familiar in Liberian classrooms is for the reviewer to confirm (legacy comparison R-L5). |
| `evidence` | NEW | — | Kinds of evidence and four tests; explicitly forbids invented figures. |
| `evidence-check` | NEW | — | Misconception checks: irrelevant evidence, circular reasoning, ignoring the other side. |
| `order-paragraph` | NEW | — | Declared ORDERING interaction with a written fallback. |
| `write-argument` | NEW | — | Interactive writing practice: thesis plus one PEEL paragraph, teacher-reviewed with the rubric. |
| `review` | NEW | — | Five key ideas. |
| `exit-ticket` | NEW | — | Assessment handoff; candidate items reviewer-only until released. |
| `reflect` | NEW | — | Writer self-assessment and next step. |

## Runtime deliverability (Lesson Player V2 today)

| Scene | DEFAULT | OFFLINE | WEBGL_UNAVAILABLE | VIDEO_UNAVAILABLE | KEYBOARD_ONLY | SCREEN_READER | REDUCED_MOTION | LOW_MEMORY | POINTER_DRAG_UNAVAILABLE |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| intro | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY |
| objectives | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY |
| warm-up | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY |
| essay-structure | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY |
| model-plan | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY |
| thesis | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY |
| peel | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY |
| evidence | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY |
| evidence-check | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY |
| order-paragraph | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK |
| write-argument | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY |
| review | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY |
| exit-ticket | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK |
| reflect | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY |

## Review gaps

- **BLOCKING** MOE_OBJECTIVE_UNBOUND: No structured MOE Grade 7 LITERACY OBJECTIVE item matches ll-g7-lit-essay-structure, ll-g7-lit-argument-build, ll-g7-lit-evidence-support; the objectives are LiberiaLearn candidates. A qualified curriculum reviewer must accept them as a LiberiaLearn extension (with the MOE relationships listed) or rebind the lesson to an existing MOE objective.
- **BLOCKING** MOE_SOURCE_STRUCTURING_DEFECT: MOE Grade 7 Language Arts paragraph-writing objectives (English 7-9.pdf p.4, objectives column of period II, OCR header 'PERIOD: 11') were structured as ACTIVITY items act1-act4 under period I, so no bindable Grade 7 paragraph objective exists. The structured source must be corrected through the source-structuring process before any Grade 7 writing objective can bind.
- **BLOCKING** MOE_GRADE_SCOPE_REVIEW: The MOE places argumentative composition ('develop and defend a point of view') in Grade 9 (p.32) and issue-based composition in Grade 8 (p.18). The reviewer decides whether this Grade 7 lesson stays as an introduction, is rescoped to paragraph writing, or moves grade.
- **BLOCKING** TEMPLATE_CELL_MISSING: No governed template cell exists for Grade 7 LITERACY (lib/learning-authority/cells has Grade 4 Math only), so no unit placement, interaction classification or concept link can be resolved.
- **BLOCKING** ONTOLOGY_RELEASE_MISSING: No ontology release is registered for Grade 7 LITERACY (curriculum/releases/k12-scope.json); concepts, standard/skill bindings, governed items, evidence and tool policies are all absent.
- **BLOCKING** LEGACY_COMPARISON_SIGNOFF: The legacy body of hero-literacy-g7-essay-writing-structure-and-argumentation (revision cmss94dmc03b7vo54ryf3hqk1, content hash 3809f98290ba…) was read read-only and compared section by section in legacy-comparison.md. A qualified reviewer confirms the comparison and decides every restoration and revision recommendation before approval.
- **ADVISORY** UNSUPPORTED_INTERACTION_DECLARED (`order-paragraph`): ORDERING is a declared intent with no renderer yet; learners receive the FREE_RESPONSE fallback.
- **ADVISORY** SCENE_USES_FALLBACK (`order-paragraph`): Delivered through its declared fallback under: DEFAULT, OFFLINE, WEBGL_UNAVAILABLE, VIDEO_UNAVAILABLE, KEYBOARD_ONLY, SCREEN_READER, REDUCED_MOTION, LOW_MEMORY, POINTER_DRAG_UNAVAILABLE.
- **ADVISORY** SCENE_USES_FALLBACK (`exit-ticket`): Delivered through its declared fallback under: DEFAULT, OFFLINE, WEBGL_UNAVAILABLE, VIDEO_UNAVAILABLE, KEYBOARD_ONLY, SCREEN_READER, REDUCED_MOTION, LOW_MEMORY, POINTER_DRAG_UNAVAILABLE.
- **BLOCKING** ASSESSMENT_ITEMS_PENDING: g7-essay-exit-ticket has no governed items; candidate exit-ticket items are in the reviewer-only assessment review and must be reviewed and released in an ontology release before Assessment Player V2 can score them.

## Reviewer decision

Use [reviewer-checklist.md](reviewer-checklist.md). Record APPROVE / REVISE / REJECT only through governed curriculum review for the exact candidate hash above. Approval requires HUMAN_REVIEW by a qualified reviewer; automated, policy and AI review cannot approve native Curriculum V2, and nothing in this folder is a decision.
