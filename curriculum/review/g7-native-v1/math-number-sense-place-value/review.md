# Number Sense and Place Value: Millions to Thousandths

- Candidate: `cv2-cand-g7-math-number-sense-place-value` v0.2.0 · Grade 7 MATH · Number sense / place value
- Pipeline status: **REVIEW_BLOCKED** · governance: DRAFT, human review required, not published, MOE approval not claimed, qualified review not started
- Candidate hash: `3f612d907f52f5953d879476a627fde8e9a1c5b3d30d22e171a42a8ccec80c0c` · learner projection hash: `5c5e90e92e0ee1d80c3da8d91b9cac0526a0e1cec10a02f97e29b88eed080e4c` (review this exact revision only)
- Origin: AUTHORED_FIXTURE in the `candidate-lesson-v2/1.0.0` generator format (no live model call); strict parser, deterministic validator and deliverability checks passed with 0 errors
- Not assembled into `curriculum-lesson-v2/1.0.0`: assembly needs a Grade 7 template cell and ontology release that do not exist (see Review gaps)
- Strategy: CONCRETE_PICTORIAL_ABSTRACT — Learners meet place value through a chart and counters (concrete/pictorial) before reading, writing and comparing numbers symbolically. Grade 7 extends the whole-number chart learners know to the thousandths, which the MOE Grade 7 decimals, percents and fractions period depends on. A partner activity with identical counters on a paper chart (ten counters exchanged for one in the next place) and a home task work without devices.

## Source and provenance

- Legacy row (not modified): `math-g7-1-number-sense-and-place-value-foundations` (pk `cmoeaemvu01i6vor4u3zch5hq`), "Number Sense and Place Value: Foundations", status APPROVED, payload approval PENDING_APPROVAL, unit `math-g7-1-number-sense-and-place-value`, 8 sections, current revision `cmss8t4hz00unvo54epnfst66`
- Unit verification: Cleanup plan V1 queues RETURN_FOR_REVIEW (row APPROVED while its payload is PENDING_APPROVAL).
- Recorded from `artifacts/curriculum-cleanup-v1/snapshot.json` (captured 2026-09-26T09:07:15.873Z). Learner history attached to the legacy row: CurriculumLessonPlan 1 (REPOINT), LearningEvent 18 (RETAIN_HISTORY), ScheduledWork 1 (RETAIN_HISTORY). The candidate never touches these rows.
- Legacy body: read from production on 2026-10-15T19:09:16.876Z in a single READ ONLY transaction (`scripts/extract-g7-legacy-revisions.ts`), stored in `artifacts/g7-native-curriculum-v1/legacy/math-number-sense-place-value.json`. Revision `cmss8t4hz00unvo54epnfst66` content hash `93cc90030c242b39cfbf9a86095802d967a7fd2dbcb6af7b9f7227f312fc540b`; recomputed from the extract: match.
- Section-by-section comparison, concerns, recommendations and alignment options: [legacy-comparison.md](legacy-comparison.md) (reviewer only).
- Reused repository material: `components/experience/demo/PlaceValueDemo.tsx` — Student Experience V3 synthetic DEMO: Musu's library fund example (L$2,350,480), practice items on 1,742,009, 3,060,500 and five million forty thousand nine, and their misconception feedback.
- Reused repository material: `lib/learner-experience/demo/placeValue.ts` — Deterministic place-value arithmetic used by the package tests to verify every exit-ticket key.

## Objective alignment

No structured MOE Grade 7 OBJECTIVE item matches this lesson. Its objectives are LiberiaLearn candidates; each MOE item below is a relationship, not a binding.

| Candidate objective | Statement | MOE relationships (verbatim source text) |
| --- | --- | --- |
| `ll-g7-math-place-value-read-write` | Read and write numbers from the millions to the thousandths in standard form, word form and expanded form. | BUILDS_ON: `moe-math-g4-s1-p1-numeration-addition-and-subtraction-obj1` — G4, GRADE-1-6/Math 1-6.pdf p.38 — "Read and write whole numbers up to hundred thousand"<br>BUILDS_ON: `moe-math-g4-s2-p4-multiplication-and-division-of-2-digits-multipli-obj7` — G4, GRADE-1-6/Math 1-6.pdf p.45 — "Read and write decimal numerals up to hundredths place."<br>PREREQUISITE_FOR: `moe-math-g7-s1-p3-decimals-percents-and-fractions-obj1` — G7, GRADE 7-9/Math 7-9.pdf p.10 — "Convert from decimal to percent/fraction and vice versa" |
| `ll-g7-math-place-value-digit-value` | Explain the value of a digit from its place, using the ten-times relationship between neighbouring places from the thousandths to the millions. | BUILDS_ON: `moe-math-g4-s1-p1-numeration-addition-and-subtraction-obj1` — G4, GRADE-1-6/Math 1-6.pdf p.38 — "Read and write whole numbers up to hundred thousand"<br>BUILDS_ON: `moe-math-g6-s1-p3-operations-obj2` — G6, GRADE-1-6/Math 1-6.pdf p.67 — "Round off decimals to the nearest tenth, hundredths and thousandths"<br>PREREQUISITE_FOR: `moe-math-g7-s1-p3-decimals-percents-and-fractions-obj1` — G7, GRADE 7-9/Math 7-9.pdf p.10 — "Convert from decimal to percent/fraction and vice versa" |
| `ll-g7-math-place-value-compare` | Compare and order whole numbers and decimals to the thousandths by comparing place values from the left. | BUILDS_ON: `moe-math-g4-s1-p1-numeration-addition-and-subtraction-obj2` — G4, GRADE-1-6/Math 1-6.pdf p.38 — "Compare and order whole numbers to hundred thousand"<br>BUILDS_ON: `moe-math-g4-s2-p4-multiplication-and-division-of-2-digits-multipli-obj8` — G4, GRADE-1-6/Math 1-6.pdf p.45 — "Compare and order decimal numerals up to hundredths place."<br>PREREQUISITE_FOR: `moe-math-g7-s1-p3-decimals-percents-and-fractions-obj2` — G7, GRADE 7-9/Math 7-9.pdf p.10 — "Apply decimal and percent to the solution of problems involving commissions, discounts, taxes, interest, profits and losses and rayolty" |

Prerequisites assumed:
- Can read and write whole numbers to at least 100,000 (MOE Grade 4 numeration).
- Knows that 0.5 means five tenths and can read simple decimals aloud.
- Can multiply a single digit by 10, 100 and 1,000.

## Proposed scope extensions (pending curriculum-owner approval)

- `ext-g7-math-whole-numbers-millions` — PROPOSED_LIBERIALEARN_EXTENSION, PENDING_CURRICULUM_OWNER: Reading, writing, valuing and comparing whole numbers in the millions (the millions period).
  - Evidence: MOE Grade 4 stops at whole numbers to hundred thousand (Math 1-6 p.38), and the word "million" does not occur in the extracted MOE Math 1-6 or Math 7-9 text. Decimals to the thousandths do have MOE support (Grade 4 p.45, Grade 6 p.67).
  - Objectives: `ll-g7-math-place-value-read-write`, `ll-g7-math-place-value-digit-value`, `ll-g7-math-place-value-compare`
  - Scenes using it: `intro`, `objectives`, `chart`, `ten-times`, `worked-example`, `build-number`, `counter-chart`, `compare-strategy`, `misconceptions`, `practice`, `review`
  - Exit items using it (reviewer only): `g7-pv-exit-1`, `g7-pv-exit-3`, `g7-pv-exit-6`
  - If not approved: Limit whole numbers to hundred thousands (or mark the millions material as optional enrichment), and revise or withdraw exit items g7-pv-exit-1, g7-pv-exit-3 and g7-pv-exit-6 (legacy comparison A-M1, option B).

## Teaching sequence and scene manifest

| # | Scene | Type / purpose | Objectives | Interaction | Evidence | Words | Visual | Scene hash |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `intro` | INTRO / HOOK_PHENOMENON | `place-value-read-write`, `place-value-digit-value` | NONE | NONE | 70 | `math-hero-numbers.svg` | `e29490bf8309…` |
| 2 | `objectives` | OBJECTIVE / STATE_OBJECTIVE | `place-value-read-write`, `place-value-digit-value`, `place-value-compare` | NONE | NONE | 11 | — | `015d6593c6b9…` |
| 3 | `warm-up` | CHECK_UNDERSTANDING / ACTIVATE_PRIOR_KNOWLEDGE | `place-value-digit-value` | SINGLE_CHOICE | FORMATIVE_OBSERVATION | 23 | — | `0ce421b98979…` |
| 4 | `chart` | EXPLANATION / EXPLAIN_CONCEPT | `place-value-read-write`, `place-value-digit-value` | NONE | NONE | 88 | `math-place-value-chart.svg` | `f6f02683b174…` |
| 5 | `ten-times` | INTERACTIVE_DIAGRAM / EXPLAIN_CONCEPT | `place-value-digit-value` | DIAGRAM_REVEAL | NONE | 17 | `math-ten-times-ladder.svg` | `5af3311e99f2…` |
| 6 | `worked-example` | GUIDED_EXAMPLE / MODEL_WORKED_EXAMPLE | `place-value-read-write`, `place-value-digit-value` | DIAGRAM_REVEAL | NONE | 21 | `math-library-fund.svg` | `7b7e1494a336…` |
| 7 | `build-number` | GUIDED_EXAMPLE / GUIDED_PRACTICE | `place-value-read-write` | NUMERIC (fallback FREE_RESPONSE) | FORMATIVE_OBSERVATION | 32 | — | `1c979da76058…` |
| 8 | `counter-chart` | GUIDED_EXAMPLE / GUIDED_PRACTICE | `place-value-digit-value`, `place-value-read-write` | FREE_RESPONSE | FORMATIVE_OBSERVATION | 100 | — | `1ea999e7e873…` |
| 9 | `guided-decimals` | GUIDED_EXAMPLE / GUIDED_PRACTICE | `place-value-read-write`, `place-value-digit-value` | SINGLE_CHOICE | FORMATIVE_OBSERVATION | 21 | — | `b68cdbcdb0e4…` |
| 10 | `compare-strategy` | GUIDED_EXAMPLE / MODEL_WORKED_EXAMPLE | `place-value-compare` | DIAGRAM_REVEAL | NONE | 21 | `math-compare-decimals.svg` | `6b76b0bdc94d…` |
| 11 | `misconceptions` | CHECK_UNDERSTANDING / ADDRESS_MISCONCEPTION | `place-value-read-write`, `place-value-compare` | SINGLE_CHOICE | FORMATIVE_OBSERVATION | 16 | — | `79f87d2f90ee…` |
| 12 | `practice` | PRACTICE / INDEPENDENT_PRACTICE | `place-value-read-write`, `place-value-digit-value`, `place-value-compare` | SINGLE_CHOICE | FORMATIVE_OBSERVATION | 27 | — | `781c1c36c528…` |
| 13 | `review` | REVIEW / REVIEW | `place-value-read-write`, `place-value-digit-value`, `place-value-compare` | NONE | NONE | 11 | — | `9bea72fa6c6a…` |
| 14 | `exit-ticket` | MASTERY_CHECK / ASSESS_MASTERY | `place-value-read-write`, `place-value-digit-value`, `place-value-compare` | ASSESSMENT_HANDOFF (fallback PAPER_ACTIVITY) | MASTERY_RESPONSE | 19 | — | `3c407b008e3a…` |
| 15 | `reflect` | REFLECTION / REFLECT | `place-value-digit-value` | FREE_RESPONSE | REFLECTION | 12 | — | `d6984293c360…` |
| 16 | `home-practice` | REFLECTION / APPLY | `place-value-read-write`, `place-value-digit-value` | NONE | NONE | 38 | — | `9ab79fd353b9…` |

Full hashes, asset digests and source digests are in `scene-manifest.json`.

## Scenes in full

### Big and small numbers in everyday Liberia (`intro`)

Learner action: Read the two numbers and think about which digit is worth the most in each.

Musu's school raised **L$2,350,480** for a new library. At the market, a trader weighs **2.375 kg** of rice for a customer. One number is in the millions. The other has parts smaller than one.

Both numbers follow the same rule: **where a digit sits decides what it is worth**. In this lesson you will use that rule to read, write and compare numbers from the millions down to the thousandths.

- Media DIAGRAM (MEDIA_OPTIONAL): Two number cards: L$2,350,480 split into its millions, thousands and ones periods; 2.375 kg split into 2 ones and 375 thousandths. — alt: L$2,350,480 is 2 millions, 350 thousands and 480 ones. 2.375 kg is 2 ones and 375 thousandths.
- Accessibility: Introduction: L$2,350,480 is 2 millions, 350 thousands and 480 ones; 2.375 kg is 2 ones and 375 thousandths. Where a digit sits decides its value. · keyboard: Tab to each control, press Enter or Space to choose, then use Continue.
- Offline (FULL_OFFLINE): Text, steps and questions are part of the saved lesson.

### What you will be able to do (`objectives`)

Learner action: Read the three goals and the success check.

By the end of this lesson you will be able to:

- Read and write numbers from the millions to the thousandths in standard form, in words and in expanded form.
- Explain what any digit is worth by naming its place.
- Compare and order numbers by looking at their places from the left.
- Success check: you can say what every digit in 3,462,105.68 is worth.

- Accessibility: Lesson goals: read and write numbers from millions to thousandths, explain the value of each digit, and compare and order numbers. · keyboard: Tab to each control, press Enter or Space to choose, then use Continue.
- Offline (FULL_OFFLINE): Text, steps and questions are part of the saved lesson.

### Warm-up: what do you remember? (`warm-up`)

Learner action: Answer two quick questions from earlier grades and read the feedback.

Before we start, check what you already know from earlier grades. These answers are not marked. They show you where to focus today.

- In 5,384, what is the 3 worth? — options: 3 / 300 (expected) / 30
- Which means the same as 0.5? — options: 5 tenths (expected) / 5 hundredths / 5 ones
- Hints: Name each place, starting from the ones place.
- Accessibility: Two warm-up questions: the value of the 3 in 5,384, and the meaning of 0.5. Each answer shows written feedback. · keyboard: Tab to each control, press Enter or Space to choose, then use Continue.
- Offline (FULL_OFFLINE): Text, steps and questions are part of the saved lesson.

### The place-value chart: millions to thousandths (`chart`)

Learner action: Study the chart and read the number 4,205,316.27 aloud.

Every digit has a **place** (its position) and a **value** (what it is worth in that place).

Left of the decimal point, digits are grouped in threes called **periods**: ones, thousands and millions. Commas separate the periods. Right of the decimal point are the **tenths**, **hundredths** and **thousandths**.

In **4,205,316.27** the 4 is in the millions place, so it is worth 4,000,000. The 0 holds the ten-thousands place: there are no ten thousands. The 2 after the point is in the tenths place, so it is worth 0.2.

- Read one period at a time, then say its name: four million, two hundred five thousand, three hundred sixteen.
- Read the decimal part by its last place: and twenty-seven hundredths. In class you may also hear four million ... sixteen point two seven.
- A zero holds an empty place so every other digit stays where it belongs.

- Media DIAGRAM (MEDIA_OPTIONAL): Place-value chart from millions to thousandths, grouped into millions, thousands and ones periods, holding 4,205,316.27 with the value of each digit underneath. — alt: 4,205,316.27 in a place-value chart: 4 millions (4,000,000), 2 hundred thousands (200,000), 0 ten thousands, 5 thousands (5,000), 3 hundreds (300), 1 ten (10), 6 ones (6), 2 tenths (0.2), 7 hundredths (0.07).
- Accessibility: The place-value chart from millions to thousandths, using 4,205,316.27: each digit is listed with its place and value in the text and key points. · keyboard: Tab to each control, press Enter or Space to choose, then use Continue.
- Offline (FULL_OFFLINE): Text, steps and questions are part of the saved lesson.

### Each place is worth ten times the next (`ten-times`)

Learner action: Open each step in order to follow the × 10 and ÷ 10 pattern.

Places are not random. Open each step to see how every place is connected to its neighbours.

1. **Start at the ones** — One one is worth 1. This is the place everything else is measured from.
2. **Move left: multiply by 10** — 1 ten = 10 ones = 10. 1 hundred = 10 tens = 100. Each step to the left makes a place worth 10 times more.
3. **Keep going to the millions** — 1 thousand = 1,000. 1 ten thousand = 10,000. 1 hundred thousand = 100,000. 1 million = 1,000,000: six steps of × 10 from the ones.
4. **Move right: divide by 10** — 1 tenth = 1 ÷ 10 = 0.1. A tenth is ten times smaller than one.
5. **Hundredths and thousandths** — 1 hundredth = 0.01 and 1 thousandth = 0.001. Each step to the right divides by 10 again.
6. **Same digit, different values** — In 5,555.555 every digit is a 5, but the values are 5,000, 500, 50, 5, 0.5, 0.05 and 0.005.

- Hints: Moving left multiplies by 10; moving right divides by 10.
- Media DIAGRAM (MEDIA_OPTIONAL): A ladder of places from millions down to thousandths with × 10 arrows going up and ÷ 10 arrows going down. — alt: Ladder of place values: 1,000,000; 100,000; 10,000; 1,000; 100; 10; 1; 0.1; 0.01; 0.001. Each rung is 10 times the rung below it.
- Accessibility: Six steps, each a button that opens text: values grow by × 10 to the left (up to 1,000,000) and shrink by ÷ 10 to the right (down to 0.001). · keyboard: Tab to each control, press Enter or Space to choose, then use Continue.
- Offline (FULL_OFFLINE): Text, steps and questions are part of the saved lesson.

### Worked example: Musu's library fund (`worked-example`)

Learner action: Open each step of the worked example and check it against the chart.

Musu's school collected **L$2,350,480**. Musu's teacher asks three questions about the number. Open each step to see how to answer them.

1. **What is the 3 worth?** — Name the places from the left: millions (2), hundred thousands (3). The 3 is worth 3 × 100,000 = 300,000.
2. **Write it in expanded form** — 2,000,000 + 300,000 + 50,000 + 400 + 80. The zeros in the thousands and ones places are not written as parts.
3. **Write it in words** — Two million, three hundred fifty thousand, four hundred eighty Liberian dollars.
4. **Check by adding the parts** — 2,000,000 + 300,000 + 50,000 + 400 + 80 = 2,350,480. The parts add back to the number, so the expanded form is right.

- Hints: Name the place before you say the value.
- Media DIAGRAM (MEDIA_OPTIONAL): L$2,350,480 in a place-value chart with the 3 outlined in the hundred-thousands column and the expanded form written below. — alt: 2,350,480 in a chart: 2 millions, 3 hundred thousands (outlined, worth 300,000), 5 ten thousands, 0 thousands, 4 hundreds, 8 tens, 0 ones. Expanded form 2,000,000 + 300,000 + 50,000 + 400 + 80.
- Accessibility: Worked example on L$2,350,480 in four text steps: the 3 is worth 300,000; expanded form; word form; check by adding. · keyboard: Tab to each control, press Enter or Space to choose, then use Continue.
- Offline (FULL_OFFLINE): Text, steps and questions are part of the saved lesson.

### Build a number (`build-number`)

Learner action: Place each digit in a place-value chart, then write the number you built.

Numbers are built from digits in places. Draw a place-value chart from the millions to the thousandths and build this number. Remember: a place with nothing in it still needs a **zero**.

- 3 millions, 4 hundred thousands, 0 ten thousands, 6 thousands
- 0 hundreds, 2 tens, 9 ones
- 5 tenths, 0 hundredths, 8 thousandths

- Requested NUMERIC: Build the number from its places, then enter it in standard form. [millions: 3; hundred thousands: 4; ten thousands: 0; thousands: 6; hundreds: 0; tens: 2; ones: 9; tenths: 5; hundredths: 0; thousandths: 8]
- Fallback (FREE_RESPONSE, objective preserved: true): Write the number you built in standard form, with commas between the periods and a decimal point. You can use stones or bottle caps as counters on your paper chart.
- Expected observation (reviewer only): 3,406,029.508, with zeros held in the ten-thousands, hundreds and hundredths places. Watch for 3,46,029.58 (zeros dropped).
- Hints: Write one digit in every column, from the millions to the thousandths. | Commas go between the millions, thousands and ones periods.
- Accessibility: Build the number with 3 millions, 4 hundred thousands, 0 ten thousands, 6 thousands, 0 hundreds, 2 tens, 9 ones, 5 tenths, 0 hundredths and 8 thousandths, then type it. · keyboard: Tab to each control, press Enter or Space to choose, then use Continue. · non-pointer: Type the number in the text box. No dragging is needed; the place list is in the text.
- Offline (FULL_OFFLINE): The written response works offline; the response is kept on the device until it can be sent.

### Build it with counters: ten for one (`counter-chart`)

Learner action: With a partner, build numbers with identical counters on a paper chart and exchange ten counters for one.

Work with a partner. Draw a place-value chart in your exercise book with ten labelled columns, from **millions** to **thousandths**, and mark the decimal point between the ones and the tenths. Use counters that are all the same, such as small stones, bottle caps or seeds. A counter is worth one of the place it sits in: the **column** decides the value, not the counter.

When a column holds **ten** counters, take them away and put **one** counter in the next column to the left. The number does not change, because ten of one place make one of the next.

- Put 14 counters in the hundredths column. Exchange ten of them for 1 counter in the tenths column. Read the number: 0.14.
- Clear the chart. Build 2,050,316.47, one column at a time. Leave empty columns empty, but write 0 for them when you record the number.
- Swap roles: one partner builds a number, the other writes it in standard form and says the value of each digit.
- No counters? Draw tally marks in the columns instead.

- Step 1: how many counters were in the hundredths column, what did ten of them become, and did the number change? Explain why. (min 40 chars)
- Step 3: write the number your partner built in standard form, then give the value of its first digit. (min 10 chars)
- Expected observation (reviewer only): Step 1: 14 hundredths become 1 tenth and 4 hundredths; the number stays 0.14 because 10 hundredths = 1 tenth. Step 3: the number is written with commas between periods and zeros in empty places, and the first digit's value is named (for example 2,000,000). Watch for counters read without their column (14 counters read as 14).
- Hints: A counter's value comes from its column. | Ten counters in one column make one counter in the column to its left.
- Accessibility: Partner activity with a paper place-value chart from millions to thousandths and identical counters: exchange ten counters in one column for one in the next column to the left, build 2,050,316.47, then build and read each other's numbers. Two written answers. · keyboard: Tab to each control, press Enter or Space to choose, then use Continue. · non-pointer: Tally marks can replace counters, or a partner places the counters while the learner says where they go. Answers are typed or written.
- Offline (FULL_OFFLINE): Needs no device: paper, counters and the exercise book. Written answers are kept on the device until they can be sent.

### Guided practice: digits after the point (`guided-decimals`)

Learner action: Answer two questions about decimal places and read the feedback after each one.

Use the chart. Name the place first, then give the value. Read the feedback after each answer before you move on.

- In 15.273, what is the 7 worth? — options: 7 / 0.7 / 0.07 (expected) / 70
- Which shows 6.408 in expanded form? — options: 6 + 0.4 + 0.08 / 6 + 0.4 + 0.008 (expected) / 6 + 4 + 8
- Hints: After the point the places are tenths, hundredths, thousandths.
- Accessibility: Two guided questions: the value of the 7 in 15.273, and the expanded form of 6.408, each with written feedback. · keyboard: Tab to each control, press Enter or Space to choose, then use Continue.
- Offline (FULL_OFFLINE): Text, steps and questions are part of the saved lesson.

### How to compare and order numbers (`compare-strategy`)

Learner action: Open each step to follow the compare-from-the-left method.

To compare numbers, compare their places, not how many digits they have. Open each step to order **0.5**, **0.45** and **0.405**.

1. **Line up the places** — Write the numbers one under the other with the decimal points in a column. Fill empty places with zeros: 0.500, 0.450, 0.405.
2. **Compare from the left** — Start at the greatest place. The ones are all 0, so look at the tenths: 5, 4 and 4.
3. **The first different digit decides** — 5 tenths is the most, so 0.5 is the greatest. 0.450 and 0.405 tie in the tenths. In the hundredths 5 is more than 0, so 0.45 is greater than 0.405.
4. **Write the order** — From least to greatest: 0.405, 0.45, 0.5.
5. **Whole numbers work the same way** — 4,099,999 and 4,100,000 both have 4 millions. In the hundred thousands 0 is less than 1, so 4,099,999 is less than 4,100,000, even with all its nines.

- Hints: Fill empty places with zeros so every number has the same number of decimal places.
- Media DIAGRAM (MEDIA_OPTIONAL): 0.500, 0.450 and 0.405 lined up in a tenths-hundredths-thousandths chart, with the first different digit outlined, beside two hundredths grids shading 50 and 45 squares. — alt: 0.500, 0.450 and 0.405 lined up by place. Tenths: 5, 4, 4. Hundredths: 0, 5, 0. A hundredths grid shows 50 squares shaded for 0.5 and 45 squares for 0.45, so 0.5 is greater.
- Accessibility: Five text steps showing how to order 0.5, 0.45 and 0.405 by lining up places and comparing from the left, and the same method for 4,099,999 and 4,100,000. · keyboard: Tab to each control, press Enter or Space to choose, then use Continue.
- Offline (FULL_OFFLINE): Text, steps and questions are part of the saved lesson.

### Watch out: three common mistakes (`misconceptions`)

Learner action: Decide whether each claim is right, then read why.

Many learners make these three mistakes. Choose an answer for each one, then read the explanation.

- Kollie says 0.45 is greater than 0.5 because 45 is greater than 5. Is he right? — options: Yes, because 45 is more than 5 / No, 0.5 is greater (expected)
- Which number is two million, forty thousand, seven hundred? — options: 2,400,700 / 2,040,700 (expected) / 240,700
- How do you write four and six hundredths? — options: 4.6 / 4.06 (expected) / 4.600
- Hints: Use the chart: put each digit in its column before deciding.
- Accessibility: Three misconception checks: whether 0.45 is greater than 0.5, writing two million forty thousand seven hundred, and writing four and six hundredths. · keyboard: Tab to each control, press Enter or Space to choose, then use Continue.
- Offline (FULL_OFFLINE): Text, steps and questions are part of the saved lesson.

### Your turn: independent practice (`practice`)

Learner action: Answer five questions on your own, then read the feedback.

Work on your own. Each answer shows why it is right or what to check again. Use the place-value chart in your exercise book if it helps.

- What is the value of the 7 in 1,742,009? — options: 7,000 / 700,000 (expected) / 70,000
- Which is 3,060,500 in expanded form? — options: 3,000,000 + 60,000 + 500 (expected) / 3,000,000 + 600,000 + 50 / 300,000 + 60,000 + 500
- Which number is five million, forty thousand, nine? — options: 5,409 / 5,400,009 / 5,040,009 (expected)
- A farmers' cooperative sold 2.75 tonnes of cocoa in June and 2.705 tonnes in July. In which month did it sell more? — options: June (2.75 tonnes) (expected) / July (2.705 tonnes) / They sold the same
- In 9.384, what is the 4 worth? — options: 4 / 0.04 / 0.004 (expected) / 0.4
- Hints: Name the place, then the value. | To compare, line up the places and look from the left.
- Accessibility: Five practice questions on digit values, expanded form, word form and comparing decimals, each with written feedback. · keyboard: Tab to each control, press Enter or Space to choose, then use Continue.
- Offline (FULL_OFFLINE): Text, steps and questions are part of the saved lesson.

### Key ideas to remember (`review`)

Learner action: Read the four key ideas before the exit ticket.

Before the exit ticket, review the big ideas of this lesson.

- The value of a digit depends on its place: in 2,350,480 the 3 is worth 300,000.
- Each place is worth 10 times the place to its right, from the thousandths up to the millions.
- Zeros hold empty places: three million, sixty thousand, five hundred is 3,060,500.
- To compare, line up the places and look from the left. The first different digit decides: 0.5 is greater than 0.45.

- Accessibility: Review of four key ideas: digit value depends on place, each place is ten times the next, zeros hold empty places, and compare from the left. · keyboard: Tab to each control, press Enter or Space to choose, then use Continue.
- Offline (FULL_OFFLINE): Text, steps and questions are part of the saved lesson.

### Exit ticket (`exit-ticket`)

Learner action: Answer the exit-ticket questions on your own, without a calculator.

Answer each question on your own, without a calculator. Your school's assessment system checks these answers, not this lesson.

- Fallback (PAPER_ACTIVITY, objective preserved: true): Your teacher gives the same exit-ticket questions on paper and records your answers.
- Accessibility: Exit-ticket questions on reading, writing, digit value and comparing, answered with the keyboard or touch. · keyboard: Tab to each option and press Space. · non-pointer: Without a device, the teacher reads each question and its choices aloud and records the learner's spoken answer.
- Offline (FALLBACK_REQUIRED): Answers given on a device are checked after reconnecting; without a device the teacher gives the same questions on paper.

### Explain it in your own words (`reflect`)

Learner action: Write two or three sentences explaining place and value.

Good mathematicians can explain their thinking. Write your answer in full sentences.

- Explain to a friend why the 4 in 40,000 and the 4 in 0.04 are worth different amounts. Use the words place and value. (min 40 chars)
- Expected observation (reviewer only): Names ten thousands and hundredths, and gives the values 40,000 and 0.04 (four hundredths); may mention the ×10 pattern.
- Hints: Name the place of each 4, then say what one of that place is worth.
- Accessibility: Write two or three sentences explaining why the 4 in 40,000 and the 4 in 0.04 have different values. · keyboard: Tab to each control, press Enter or Space to choose, then use Continue.
- Offline (FULL_OFFLINE): The written answer is kept on the device until it can be sent.

### At home: numbers around you (`home-practice`)

Learner action: Find two numbers at home or in your community and explain their digits to a family member.

Place value is all around you. This task needs no device, no printing and nothing to buy. You can do it with anyone at home, even someone who does not read: you do the reading and the explaining.

- Find one large number: a price on a sign or receipt, a number on a calendar or a rice bag, or an amount you hear on the radio.
- Find one decimal: a measurement on a package (such as 0.5 kg or 1.25 litres). If you cannot find one, make one with three digits after the point.
- Draw a place-value chart on paper or in the sand. Write both numbers in it and read them aloud.
- Ask your family member to point to any digit. Say its place and its value.
- Bring one of your numbers to class with the value of one of its digits.

- Accessibility: Home task with no device: find a large number and a decimal at home or in the community, write them in a place-value chart, read them aloud to a family member and say the value of any digit they point to. · keyboard: Tab to each control, press Enter or Space to choose, then use Continue.
- Offline (FULL_OFFLINE): A paper task done away from the device; the steps are part of the saved lesson.

## Misconceptions

- `mc-digit-not-value` (`ll-g7-math-place-value-digit-value`): Gives the digit itself (3) instead of its value in the number (300,000). → Ask two questions every time: which place is the digit in, and what is one of that place worth? Then multiply.
- `mc-zero-placeholder` (`ll-g7-math-place-value-read-write`): Leaves out zeros that hold empty places, writing three million, sixty thousand, five hundred as 3,600,500. → Write the number in a place-value chart first; every column must hold a digit, even if it is 0.
- `mc-decimal-word-form` (`ll-g7-math-place-value-read-write`): Writes 'four and six hundredths' as 4.6, ignoring the place the fraction name gives. → The fraction name tells you the last place: hundredths ends two places after the point, so 4.06.
- `mc-longer-decimal-bigger` (`ll-g7-math-place-value-compare`): Thinks a decimal with more digits is greater (0.45 > 0.5 because 45 > 5). → Line up the decimal points, fill empty places with zeros (0.50 and 0.45) and compare from the left.

## Assessment handoff (Assessment Player V2)

- `g7-pv-exit-ticket`: SINGLE_CHOICE, QUIZ, CORE; scoring SERVER_AUTHORITY; governed items: none yet; 6 candidate items in [assessment-review.md](assessment-review.md) (reviewer only); tools prohibited scientific-calculator, basic-calculator; offline FALLBACK_REQUIRED

## Instructional revision ledger

- Title: "Number Sense and Place Value: Foundations" → "Number Sense and Place Value: Millions to Thousandths". Names the exact Grade 7 scope: whole-number places to the millions and decimal places to the thousandths, which the MOE Grade 7 decimals, percents and fractions period builds on.
- Legacy body comparison: **RECORDED_AWAITING_REVIEWER_SIGNOFF** (revision `cmss8t4hz00unvo54epnfst66`; see [legacy-comparison.md](legacy-comparison.md)).

| Scene | Change | Source | Rationale |
| --- | --- | --- | --- |
| `intro` | REVISED | PlaceValueDemo.tsx scene 'intro' (Big numbers are all around us) | Kept the school-fund context; added a decimal measurement (2.375 kg) because Grade 7 extends place value below one. |
| `objectives` | NEW | — | States three measurable objectives and a success check (the DEMO listed goals only inside the intro). |
| `warm-up` | NEW | — | Prior-knowledge activation on Grade 4 place value and tenths, with diagnostic feedback. |
| `chart` | REVISED | PlaceValueDemo.tsx scene 'explain' (4,205,316 chart) | Preserved the 4,205,316 example and the zero-holds-ten-thousands point; extended the chart to thousandths (4,205,316.27) and introduced the term 'period'. |
| `ten-times` | NEW | — | Makes the ×10 / ÷10 relationship explicit across the decimal point; the DEMO stated it in one sentence. |
| `worked-example` | REVISED | PlaceValueDemo.tsx scene 'example' (Musu's library fund) | Preserved the three-step value-of-3 example; added expanded form, word form and a check-by-adding step. |
| `build-number` | REVISED | PlaceValueTools.tsx NumberBuilder (interactive DEMO tool) | The DEMO builder is not a renderable lesson interaction, so the candidate declares NUMERIC with a written fallback and a paper chart with counters for classrooms without devices. |
| `counter-chart` | REVISED | Legacy lab 'Understanding Place Value with Local Materials' (revision cmss8t4hz00unvo54epnfst66); legacy comparison R-M1 | Keeps the legacy's offline, hands-on pair work, but with identical counters in labelled columns and a ten-for-one exchange, at the Grade 7 range (millions to thousandths). Does not restore the cassava/leaf/stone token values or the hundreds-only range. |
| `guided-decimals` | NEW | — | Guided decimal place-value items with per-option feedback. |
| `compare-strategy` | NEW | — | Compare-from-the-left method for decimals and whole numbers (objective 3). |
| `misconceptions` | NEW | — | Targets three common errors: longer decimal is bigger, dropped zero placeholders, decimal word form. |
| `practice` | PRESERVED | PlaceValueDemo.tsx PRACTICE q1–q3 | Items on 1,742,009, 3,060,500 and 5,040,009 kept with their feedback; one word changed in q3 feedback ('group name' → 'period name') to match the chart scene. Two new items added (cocoa tonnes comparison, thousandths). |
| `review` | REVISED | PlaceValueDemo.tsx scene 'review' | Kept the three takeaways; added zero placeholders and comparing. |
| `exit-ticket` | NEW | — | Assessment handoff to Assessment Player V2; candidate items are reviewer-only until released. |
| `reflect` | NEW | — | Written explanation of place versus value. |
| `home-practice` | REVISED | Legacy 'Guardian Support' section (revision cmss8t4hz00unvo54epnfst66); legacy comparison R-M2 | Turns the legacy's generic home-support sentence into a concrete, device-free task that a family member who does not read can still share. |

## Runtime deliverability (Lesson Player V2 today)

| Scene | DEFAULT | OFFLINE | WEBGL_UNAVAILABLE | VIDEO_UNAVAILABLE | KEYBOARD_ONLY | SCREEN_READER | REDUCED_MOTION | LOW_MEMORY | POINTER_DRAG_UNAVAILABLE |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| intro | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY |
| objectives | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY |
| warm-up | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY |
| chart | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY |
| ten-times | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY |
| worked-example | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY |
| build-number | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK |
| counter-chart | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY |
| guided-decimals | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY |
| compare-strategy | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY |
| misconceptions | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY |
| practice | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY |
| review | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY |
| exit-ticket | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK |
| reflect | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY |
| home-practice | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY |

## Review gaps

- **BLOCKING** MOE_OBJECTIVE_UNBOUND: No structured MOE Grade 7 MATH OBJECTIVE item matches ll-g7-math-place-value-read-write, ll-g7-math-place-value-digit-value, ll-g7-math-place-value-compare; the objectives are LiberiaLearn candidates. A qualified curriculum reviewer must accept them as a LiberiaLearn extension (with the MOE relationships listed) or rebind the lesson to an existing MOE objective.
- **BLOCKING** TEMPLATE_CELL_MISSING: No governed template cell exists for Grade 7 MATH (lib/learning-authority/cells has Grade 4 Math only), so no unit placement, interaction classification or concept link can be resolved.
- **BLOCKING** ONTOLOGY_RELEASE_MISSING: No ontology release is registered for Grade 7 MATH (curriculum/releases/k12-scope.json); concepts, standard/skill bindings, governed items, evidence and tool policies are all absent.
- **BLOCKING** SCOPE_EXTENSION_UNAPPROVED: ext-g7-math-whole-numbers-millions: Reading, writing, valuing and comparing whole numbers in the millions (the millions period). This is a proposed LiberiaLearn extension beyond the repository MOE source, pending curriculum-owner approval. MOE Grade 4 stops at whole numbers to hundred thousand (Math 1-6 p.38), and the word "million" does not occur in the extracted MOE Math 1-6 or Math 7-9 text. Decimals to the thousandths do have MOE support (Grade 4 p.45, Grade 6 p.67). If not approved: Limit whole numbers to hundred thousands (or mark the millions material as optional enrichment), and revise or withdraw exit items g7-pv-exit-1, g7-pv-exit-3 and g7-pv-exit-6 (legacy comparison A-M1, option B).
- **BLOCKING** LEGACY_COMPARISON_SIGNOFF: The legacy body of math-g7-1-number-sense-and-place-value-foundations (revision cmss8t4hz00unvo54epnfst66, content hash 93cc90030c24…) was read read-only and compared section by section in legacy-comparison.md. A qualified reviewer confirms the comparison and decides every restoration and revision recommendation before approval.
- **ADVISORY** UNSUPPORTED_INTERACTION_DECLARED (`build-number`): NUMERIC is a declared intent with no renderer yet; learners receive the FREE_RESPONSE fallback.
- **ADVISORY** SCENE_USES_FALLBACK (`build-number`): Delivered through its declared fallback under: DEFAULT, OFFLINE, WEBGL_UNAVAILABLE, VIDEO_UNAVAILABLE, KEYBOARD_ONLY, SCREEN_READER, REDUCED_MOTION, LOW_MEMORY, POINTER_DRAG_UNAVAILABLE.
- **ADVISORY** SCENE_USES_FALLBACK (`exit-ticket`): Delivered through its declared fallback under: DEFAULT, OFFLINE, WEBGL_UNAVAILABLE, VIDEO_UNAVAILABLE, KEYBOARD_ONLY, SCREEN_READER, REDUCED_MOTION, LOW_MEMORY, POINTER_DRAG_UNAVAILABLE.
- **BLOCKING** ASSESSMENT_ITEMS_PENDING: g7-pv-exit-ticket has no governed items; candidate exit-ticket items are in the reviewer-only assessment review and must be reviewed and released in an ontology release before Assessment Player V2 can score them.

## Reviewer decision

Use [reviewer-checklist.md](reviewer-checklist.md). Record APPROVE / REVISE / REJECT only through governed curriculum review for the exact candidate hash above. Approval requires HUMAN_REVIEW by a qualified reviewer; automated, policy and AI review cannot approve native Curriculum V2, and nothing in this folder is a decision.
