# Exit-ticket review — math-number-sense-place-value

**REVIEWER ONLY. Contains answer keys.** These items are never part of the learner projection, offline package or client bundle. They are candidates in the governed item shape; Assessment Player V2 cannot score them until a qualified reviewer approves them and a Grade 7 ontology release binds them.

## 1. `g7-pv-exit-1@candidate-0.1.0` → `ll-g7-math-place-value-digit-value`

What is the value of the 6 in 3,462,105?

- 600 _(catches `mc-digit-not-value`)_
- 6,000 _(catches `mc-digit-not-value`)_
- **[key]** 60,000
- 600,000 _(catches `mc-digit-not-value`)_

- Hint (released after scoring): Count the places from the right: ones, tens, hundreds, thousands, ten thousands.
- Worked example (released after scoring): The 6 is in the ten-thousands place, so it is worth 6 × 10,000 = 60,000.
- Machine verification: DIGIT_VALUE (checked by __tests__/curriculum-v2-g7-native.test.ts)
- Item hash: `83a7caf5e819029ad2e4df79b796699208bfdfd9b0c8e0e3297a6b4d751761a9`

## 2. `g7-pv-exit-2@candidate-0.1.0` → `ll-g7-math-place-value-digit-value`

What is the value of the 8 in 24.068?

- 8 _(catches `mc-digit-not-value`)_
- 0.8 _(catches `mc-digit-not-value`)_
- 0.08 _(catches `mc-digit-not-value`)_
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
- 5 + 0.03 + 0.007 _(catches `mc-digit-not-value`)_
- **[key]** 5 + 0.3 + 0.007
- 5 + 3 + 7 _(catches `mc-digit-not-value`)_

- Hint (released after scoring): Name the place of each digit after the point.
- Worked example (released after scoring): 5 ones, 3 tenths, 0 hundredths and 7 thousandths: 5 + 0.3 + 0.007.
- Machine verification: EXPANDED_FORM (checked by __tests__/curriculum-v2-g7-native.test.ts)
- Item hash: `a538ad15ec25bb296937fab3155623ae0aa7c80aa99945595b0a9898339b2147`

## 5. `g7-pv-exit-5@candidate-0.1.0` → `ll-g7-math-place-value-compare`

Which list is in order from least to greatest?

- 0.37, 0.307, 0.3 _(catches `mc-longer-decimal-bigger`)_
- **[key]** 0.3, 0.307, 0.37
- 0.307, 0.3, 0.37 _(catches `mc-longer-decimal-bigger`)_
- 0.3, 0.37, 0.307 _(catches `mc-longer-decimal-bigger`)_

- Hint (released after scoring): Fill empty places with zeros: 0.300, 0.307, 0.370.
- Worked example (released after scoring): As thousandths: 300, 307, 370. So the order is 0.3, 0.307, 0.37.
- Machine verification: ORDER_ASCENDING (checked by __tests__/curriculum-v2-g7-native.test.ts)
- Item hash: `7f0da1595e595b5979e1d7cbf647afbbaca012cc4bac5a54b0feacf34452b04d`

## 6. `g7-pv-exit-6@candidate-0.1.0` → `ll-g7-math-place-value-compare`

Which number is greater: 6,009,999 or 6,010,000?

- 6,009,999 _(catches `mc-longer-decimal-bigger`)_
- **[key]** 6,010,000
- They are equal _(catches `mc-longer-decimal-bigger`)_

- Hint (released after scoring): Compare from the left until the digits differ.
- Worked example (released after scoring): Both have 6 millions and 0 hundred thousands. In the ten thousands, 1 is more than 0, so 6,010,000 is greater.
- Machine verification: GREATEST (checked by __tests__/curriculum-v2-g7-native.test.ts)
- Item hash: `9f6688a0fe13d0d948b93a260bd79bb5a48e2096a77a3a516ac7cb7f056dbfb8`

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
| `g7-pv-exit-5@candidate-0.1.0` | | | | | | |
| `g7-pv-exit-6@candidate-0.1.0` | | | | | | |

Item decisions count only when recorded through governed curriculum review against the item hashes above.
