# Exit-ticket review — math-number-sense-place-value

**REVIEWER ONLY. Contains answer keys.** These items are never part of the learner projection, offline package or client bundle. They are candidates in the governed item shape; Assessment Player V2 cannot score them until a qualified reviewer approves them and a Grade 7 ontology release binds them.

## 1. `g7-pv-exit-1@candidate-0.1.0` → `ll-g7-math-place-value-digit-value`

What is the value of the 6 in 3,462,105?

- 600 _(catches `mc-place-shift`)_
- 6,000 _(catches `mc-place-shift`)_
- **[key]** 60,000
- 600,000 _(catches `mc-place-shift`)_

- Hint (released after scoring): Count the places from the right: ones, tens, hundreds, thousands, ten thousands.
- Worked example (released after scoring): The 6 is in the ten-thousands place, so it is worth 6 × 10,000 = 60,000.
- Machine verification: DIGIT_VALUE (checked by __tests__/curriculum-v2-g7-native.test.ts)
- Item hash: `83a7caf5e819029ad2e4df79b796699208bfdfd9b0c8e0e3297a6b4d751761a9`

## 2. `g7-pv-exit-2@candidate-0.1.0` → `ll-g7-math-place-value-digit-value`

What is the value of the 8 in 24.068?

- 8 _(catches `mc-digit-not-value`)_
- 0.8 _(catches `mc-place-shift`)_
- 0.08 _(catches `mc-place-shift`)_
- **[key]** 0.008

- Hint (released after scoring): After the decimal point the places are tenths, hundredths, thousandths.
- Worked example (released after scoring): The 8 is the third digit after the point, in the thousandths place, so it is worth 0.008.
- Machine verification: DIGIT_VALUE (checked by __tests__/curriculum-v2-g7-native.test.ts)
- Item hash: `f472bfcf0aa0960efa7b8a6340b661614ae81a0cb5518808a85fdab5374494bd`

## 3. `g7-pv-exit-3@candidate-0.1.0` → `ll-g7-math-place-value-read-write`

Which number is seven million, three hundred five thousand, forty?

- 7,350,040 _(catches `mc-zero-placeholder`)_
- **[key]** 7,305,040
- 7,305,400 _(catches `mc-zero-placeholder`)_
- 730,540 _(catches `mc-zero-placeholder`)_

- Hint (released after scoring): Write each period (millions, thousands, ones) as a group of three digits.
- Worked example (released after scoring): Seven million → 7; three hundred five thousand → 305; forty → 040. Together: 7,305,040.
- Machine verification: WORD_FORM (checked by __tests__/curriculum-v2-g7-native.test.ts)
- Item hash: `3d1d98033510d7fd65eac459a08f034e0d658372cb035c7221411768b4a19004`

## 4. `g7-pv-exit-4@candidate-0.1.0` → `ll-g7-math-place-value-read-write`

Which shows 5.307 in expanded form?

- 5 + 0.3 + 0.07 _(catches `mc-zero-placeholder`)_
- 5 + 0.03 + 0.007 _(catches `mc-place-shift`)_
- **[key]** 5 + 0.3 + 0.007
- 5 + 3 + 7 _(catches `mc-digit-not-value`)_

- Hint (released after scoring): Name the place of each digit after the point.
- Worked example (released after scoring): 5 ones, 3 tenths, 0 hundredths and 7 thousandths: 5 + 0.3 + 0.007.
- Machine verification: EXPANDED_FORM (checked by __tests__/curriculum-v2-g7-native.test.ts)
- Item hash: `a538ad15ec25bb296937fab3155623ae0aa7c80aa99945595b0a9898339b2147`

## 5. `g7-pv-exit-5@candidate-0.3.0` → `ll-g7-math-place-value-compare`

Which list is in order from least to greatest?

- 0.37, 0.307, 0.3
- **[key]** 0.3, 0.307, 0.37
- 0.307, 0.37, 0.3 _(catches `mc-shorter-decimal-bigger`)_
- 0.3, 0.37, 0.307 _(catches `mc-longer-decimal-bigger`)_

- Hint (released after scoring): Fill empty places with zeros: 0.300, 0.307, 0.370.
- Worked example (released after scoring): As thousandths: 300, 307, 370. So the order is 0.3, 0.307, 0.37.
- Machine verification: ORDER_ASCENDING (checked by __tests__/curriculum-v2-g7-native.test.ts)
- Item hash: `c5c5d6d8769c5f670a479088fb47ce1f1322399127c62ec249f6e5dd8fdde423`

## 6. `g7-pv-exit-6@candidate-0.1.0` → `ll-g7-math-place-value-compare`

Which number is greater: 6,009,999 or 6,010,000?

- 6,009,999 _(catches `mc-compare-by-digits`)_
- **[key]** 6,010,000
- They are equal

- Hint (released after scoring): Compare from the left until the digits differ.
- Worked example (released after scoring): Both have 6 millions and 0 hundred thousands. In the ten thousands, 1 is more than 0, so 6,010,000 is greater.
- Machine verification: GREATEST (checked by __tests__/curriculum-v2-g7-native.test.ts)
- Item hash: `9f6688a0fe13d0d948b93a260bd79bb5a48e2096a77a3a516ac7cb7f056dbfb8`

## Candidate assessment definitions (Curriculum Excellence V1)

Candidate assessment definitions for the v0.3.0 lesson (Curriculum Excellence Standard V1). Unreviewed and unreleased: nothing scores them, writes mastery from them or releases them. Teacher-administered on paper or in class until a qualified reviewer approves them and a governed release binds them. Keys and scoring guides are reviewer only and must never reach a learner projection, offline package or client bundle.

| Task | Kind | When | Scaffold | Context | Scoring | Objectives |
| --- | --- | --- | --- | --- | --- | --- |
| `pm-d0` | PREREQUISITE_DIAGNOSTIC (prerequisite 1) | PRE_LESSON | FULL | REHEARSED | KEYED | `ll-g7-math-place-value-digit-value` |
| `pm-d1` | PREREQUISITE_DIAGNOSTIC (prerequisite 2) | PRE_LESSON | FULL | REHEARSED | KEYED | `ll-g7-math-place-value-digit-value` |
| `pm-d2` | PREREQUISITE_DIAGNOSTIC (prerequisite 3) | PRE_LESSON | FULL | REHEARSED | KEYED | `ll-g7-math-place-value-digit-value` |
| `pm-c1` | SHORT_CONSTRUCTED_RESPONSE | END_OF_LESSON | NONE | REHEARSED | KEYED | `ll-g7-math-place-value-read-write` |
| `pm-c2` | SHORT_CONSTRUCTED_RESPONSE | END_OF_LESSON | NONE | REHEARSED | KEYED | `ll-g7-math-place-value-digit-value` |
| `pm-r1` | EXTENDED_REASONING | END_OF_LESSON | NONE | REHEARSED | ANALYTIC_RUBRIC | `ll-g7-math-place-value-compare` |
| `pm-r2` | EXTENDED_REASONING | END_OF_LESSON | NONE | REHEARSED | ANALYTIC_RUBRIC | `ll-g7-math-place-value-digit-value` |
| `pm-t1` | TRANSFER_TASK | END_OF_LESSON | NONE | NEW | ANALYTIC_RUBRIC | `ll-g7-math-place-value-compare` |
| `pm-dr1` | DELAYED_RETRIEVAL | DELAYED 7 days | NONE | REHEARSED | ANALYTIC_RUBRIC | `ll-g7-math-place-value-read-write`, `ll-g7-math-place-value-digit-value`, `ll-g7-math-place-value-compare` |
| `pm-dr2` | DELAYED_RETRIEVAL | DELAYED 21 days | NONE | REHEARSED | ANALYTIC_RUBRIC | `ll-g7-math-place-value-compare` |
| `pm-x1` (optional) | EXTENSION | END_OF_LESSON | NONE | NEW | ANALYTIC_RUBRIC | `ll-g7-math-place-value-compare` |

### `pm-d0`

In 45,384, what is the 3 worth?

- Delivered in the lesson by `warm-up#warm-hundreds`
- Key: 300
- If the prerequisite is missing: Before the chart scene, rebuild the thousands period with counters on a paper chart (MOE Grade 4 numeration), then re-check with two similar numbers.

### `pm-d1`

Which means the same as 0.5?

- Delivered in the lesson by `warm-up#warm-tenths`
- Key: 5 tenths
- If the prerequisite is missing: Fold a paper strip into ten equal parts and shade five; then fold each tenth into ten to show 50 hundredths. Re-check with 0.3.

### `pm-d2`

What is 7 × 1,000?

- Delivered in the lesson by `warm-up#warm-times-ten`
- Key: 7,000
- If the prerequisite is missing: Do the counter-exchange activity (ten counters become one in the next column) before the ten-times scene, then re-check with 4 × 10, 4 × 100, 4 × 1,000.

### `pm-c1`

Write in standard form: four hundred sixty thousand, three and twenty-five thousandths.

- Key: 460,003.025
- Targets: `mc-zero-placeholder`, `mc-decimal-word-form`
- Note: Within MOE scope (hundred thousands and thousandths), so it survives a decision against the millions extension.

### `pm-c2`

In 135,276.049, write the value of the 3 and the value of the 4.

- Key: 3 → 30,000; 4 → 0.04
- Targets: `mc-digit-not-value`, `mc-place-shift`

### `pm-r1`

Kebeh says 0.7 is less than 0.65 because 65 is bigger than 7. Is she right? Explain using place value, and show one way to check your answer.

- Scoring: 0: Agrees with Kebeh, or no place-value reasoning. · 1: Correct decision with a vague or partly correct reason, or a correct reason with no check. · 2: Says Kebeh is wrong and justifies by place: 7 tenths is more than 6 tenths, or 0.70 is more than 0.65 when both are written to hundredths; gives a check (chart, number line or hundredths grid).
- Targets: `mc-longer-decimal-bigger`

### `pm-r2`

The digit 5 appears three times in 505.05. Write what each 5 is worth. Then explain how the value of the first 5 compares with the value of the 5 in the ones place.

- Scoring: 0: Gives 5 for every digit, or no relationship stated. · 1: All three values correct with no explanation of the relationship, or a correct relationship with one value wrong. · 2: 500, 5 and 0.05, and explains that 500 is 100 times 5 because it is two places to the left (each place is ten times the place to its right).
- Targets: `mc-digit-not-value`, `mc-place-shift`

### `pm-t1`

Draw a number line from 2.3 to 2.4 and mark it in hundredths. Place 2.35 and 2.305 on it. Which one is closer to 2.3? Explain how the number line shows it.

- Scoring: 0: Says 2.35 is closer, or places 2.305 beyond 2.35. · 1: Correct answer with an imprecise placement or explanation. · 2: 2.35 at the halfway mark, 2.305 between 2.30 and 2.31; says 2.305 is closer to 2.3 and explains using the marks (2.305 is less than one hundredth away; 2.35 is five hundredths away).
- Targets: `mc-longer-decimal-bigger`, `mc-shorter-decimal-bigger`
- Note: New representation: the lesson uses charts and grids, never a number line.

### `pm-dr1`

Without notes: (a) What is the value of the 9 in 293,400.6? (b) Write 3.046 in expanded form. (c) Order 0.08, 0.8 and 0.088 from least to greatest and explain how you decided.

- Key: (a) 90,000 (b) 3 + 0.04 + 0.006 (c) 0.08, 0.088, 0.8; the explanation compares tenths first, then hundredths and thousandths
- Scoring: 0: none correct · 1: one part correct · 2: two parts correct · 3: three parts correct, explanation partial · 4: (a), (b) and (c) correct with a place-value explanation

### `pm-dr2`

Which is greater, 0.6 or 0.599? Explain.

- Scoring: 0: 0.599 · 1: 0.6 with no valid reason · 2: 0.6, explained by tenths (6 tenths > 5 tenths) or by writing 0.600
- Targets: `mc-longer-decimal-bigger`

### `pm-x1`

Use each of the digits 0, 3, 5 and 8 exactly once, and one decimal point, to make the number closest to 5. Explain why no other arrangement is closer.

- Key: 5.038
- Scoring: 0: other · 1: 5.038 without a complete argument, or 5.083 with place-value reasoning · 2: 5.038 with an argument from the left: 5 ones first, then the smallest possible tenths (0), hundredths (3) and thousandths (8)
- Note: Optional and non-gating; the in-lesson challenge scene rehearses the same reasoning with different digits.

## Item review requirements

A qualified Grade 7 Math reviewer checks every item before any release can bind it:

1. The keyed option is the only defensible answer, and the worked example explains it correctly.
2. Each distractor is plausible for a Grade 7 learner, clearly wrong, and catches the misconception it is mapped to.
3. The item measures its mapped objective (and the alignment decision in legacy-comparison.md has not moved that objective).
4. Language is plain enough for learners still building English fluency, and contexts are realistic in Liberia.
5. The machine verification for the item passed (see the test) and agrees with the reviewer's own working.
6. Evidence context (DIAGNOSTIC or PRACTICE) and the no-calculator / no-dictionary tool policy are right for an exit ticket.
7. The legacy lesson had no keyed items to carry over (see legacy-comparison.md); nothing here is copied from it.

| Item | Key correct | Distractors sound | Objective / misconception mapping | Language and context | Decision (APPROVE / REVISE / REJECT) | Reviewer initials |
| --- | --- | --- | --- | --- | --- | --- |
| `g7-pv-exit-1@candidate-0.1.0` | | | | | | |
| `g7-pv-exit-2@candidate-0.1.0` | | | | | | |
| `g7-pv-exit-3@candidate-0.1.0` | | | | | | |
| `g7-pv-exit-4@candidate-0.1.0` | | | | | | |
| `g7-pv-exit-5@candidate-0.3.0` | | | | | | |
| `g7-pv-exit-6@candidate-0.1.0` | | | | | | |

Item decisions count only when recorded through governed curriculum review against the item hashes above.
