# Reading a bar graph and finding the mode

- Lesson: `cv2-math-g4-s2-p6-geometry-and-statistics-obj6` v0.1.0 · Grade 4 MATH · unit `g4-math-u6-geometry-statistics`
- Pipeline status: **REVIEW_BLOCKED** · governance: DRAFT, human review required, not published, MOE approval not claimed
- Artifact hash: `d260faaa24a39749003a784737fea5d32cfa1a88cf221e36fed0725df9d3b1e6` (approve this exact revision only)
- Pinned context: release `lr-moe-g4-math-fractions-2026.1` (identity `de256495ec6f72fe…`), cell `cell-g4-math-v1@1.1.0`, context `8bb7aa0a63d3cbe8…`
- Source: `GRADE-1-6/Math 1-6.pdf` (archive `82b95c17bf5b…`)
- Provenance: AUTHORED_FIXTURE by curriculum-v2-assembler@1.0.0; prompt none@-; candidate `a59146701fa5496a…`
- Strategy: STRUCTURED_PROBLEM_SOLVING — Learners read one class data set from a table, then a bar graph, then answer questions that need the graph, ending with the mode.

## Objective alignment

| Objective | Statement (MOE source) | Source | Concepts | Standards / skills |
| --- | --- | --- | --- | --- |
| `moe-math-g4-s2-p6-geometry-and-statistics-obj6` | Read and interpret bar graphs, line graphs, pie chart, and mode, mean, median, & average. | p.49 (MEDIUM) | — (unbound) | — (unbound) |

Prerequisites:
- Learners can count and compare whole numbers to 50.
- Scope: this lesson covers bar graphs and the mode; line graphs, pie charts, mean and median are taught in later lessons of the same objective.

## Scene sequence

| # | Scene | Type / purpose | Objectives | Interaction | Words | Tools | Evidence | Offline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Class 4's favourite fruit | INTRO / HOOK_PHENOMENON | — | NONE | 45 | — | — | FULL_OFFLINE |
| 2 | What you will be able to do | OBJECTIVE / STATE_OBJECTIVE | obj6 | NONE | 11 | — | — | FULL_OFFLINE |
| 3 | The bar graph | MEDIA / EXPLAIN_CONCEPT | obj6 | NONE (fallback: TEXT_WALKTHROUGH) | 46 | — | — | CACHED_ASSET_REQUIRED |
| 4 | Match each fruit to its count | PRACTICE / GUIDED_PRACTICE | obj6 | MATCHING (fallback: FREE_RESPONSE) | 13 | — | FORMATIVE_OBSERVATION (PRACTICE): fruit-counts→obj6 | FULL_OFFLINE |
| 5 | Finding the mode | GUIDED_EXAMPLE / MODEL_WORKED_EXAMPLE | obj6 | NONE | 44 | — | — | FULL_OFFLINE |
| 6 | Quick check | CHECK_UNDERSTANDING / CHECK_UNDERSTANDING | obj6 | SINGLE_CHOICE | 7 | — | FORMATIVE_OBSERVATION (PRACTICE): how-many-more→obj6, which-mode→obj6 | FULL_OFFLINE |
| 7 | Why use a graph? | REFLECTION / REFLECT | obj6 | FREE_RESPONSE | 8 | — | REFLECTION (PRACTICE): why-graph→obj6 | FULL_OFFLINE |
| 8 | Show what you know | MASTERY_CHECK / ASSESS_MASTERY | obj6 | ASSESSMENT_HANDOFF (fallback: PAPER_ACTIVITY) | 16 | — | MASTERY_RESPONSE (QUIZ): bg-mastery→obj6 | FALLBACK_REQUIRED |

## Scenes in full

### Class 4's favourite fruit (`hook`)

Learner action: Guess which fruit your own class would choose most.

Class 4 voted for their favourite fruit on anonymous slips: no names were written, and anyone could choose not to vote. The counts (illustrative) were: mango 9, banana 6, orange 4, pineapple 3.

How can we show these numbers so anyone can read them quickly?

- Accessibility: Anonymous fruit votes in Class 4: mango 9, banana 6, orange 4, pineapple 3. · keyboard: Read the text, then Continue.
- Offline (FULL_OFFLINE): Text only.

### What you will be able to do (`goal`)

Learner action: Read the goal.

By the end of this lesson you will be able to:

- Read the values shown by a bar graph.
- Answer questions using a bar graph.
- Find the mode of a data set.

- Accessibility: Goal: read a bar graph, answer questions with it, and find the mode. · keyboard: Read the list, then Continue.
- Offline (FULL_OFFLINE): Text only.

### The bar graph (`read-graph`)

Learner action: Read the height of each bar against the number scale.

A bar graph has a bar for each fruit. The **height** of each bar shows how many votes it got: read where the top of the bar meets the number scale on the side.

The mango bar reaches 9, banana 6, orange 4 and pineapple 3.

- Fallback (TEXT_WALKTHROUGH, objective preserved: true): Draw the graph on squared paper: a scale from 0 to 10 up the side, and a bar for each fruit: mango up to 9, banana up to 6, orange up to 4, pineapple up to 3.
- Hints: Follow the top of the bar across to the scale.
- Media DIAGRAM (MEDIA_REQUIRED): Vertical bar graph titled Favourite fruit in Class 4: bars for mango (9), banana (6), orange (4), pineapple (3) against a scale from 0 to 10. — alt: Bar graph of favourite fruit: mango 9, banana 6, orange 4, pineapple 3. Mango has the tallest bar.
- Accessibility: Bar graph of favourite fruit: mango 9 votes, banana 6, orange 4, pineapple 3. The bar heights show the counts; mango is tallest. · keyboard: Read the text description, then Continue.
- Offline (CACHED_ASSET_REQUIRED): The graph image must be cached; the squared-paper drawing works without it.

### Match each fruit to its count (`match-bars`)

Learner action: Match each fruit to the number its bar shows.

Use the bar graph to match each fruit to its number of votes.

- Requested MATCHING: Match each fruit to its number of votes. [mango; banana; orange; pineapple; 9; 6; 4; 3]
- Fallback (FREE_RESPONSE, objective preserved: true): Write each fruit and the number its bar shows, for example: mango - 9.
- Hints: Read the top of each bar.
- Accessibility: Match mango, banana, orange and pineapple to 9, 6, 4 and 3 using the bar graph. · keyboard: Choose each fruit with Tab, then its number from a list. · non-pointer: Pick each fruit's count from a list with the keyboard instead of drawing lines.
- Offline (FULL_OFFLINE): Written matching works offline.

### Finding the mode (`mode`)

Learner action: Follow the example and say the mode aloud.

The **mode** is the value that appears most often. In a bar graph it is the category with the tallest bar.

The tallest bar is mango, with 9 votes. So the mode is **mango**, not 9: the mode is the answer people chose most.

- Accessibility: The mode is the most common answer. The tallest bar is mango with 9 votes, so the mode is mango. · keyboard: Read the text, then Continue.
- Offline (FULL_OFFLINE): Text only.

### Quick check (`check`)

Learner action: Choose an answer for each question.

Use the fruit bar graph to answer.

- How many more votes did banana get than orange? — options: 2 (expected) / 10 / 4
- What is the mode of the fruit votes? — options: 9 / Mango (expected) / Pineapple
- Hints: Read each bar's top against the scale.
- Accessibility: Two questions using the fruit votes: how many more chose banana than orange, and what the mode is. · keyboard: Tab to each option and press Space.
- Offline (FULL_OFFLINE): Feedback works offline.

### Why use a graph? (`reflect`)

Learner action: Write a short answer.

Write a short answer in your own words.

- Why is a bar graph easier to read than a list of votes? (min 20 chars)
- Accessibility: Write why a bar graph is easier to read than a list of votes. · keyboard: Tab to the text box and type.
- Offline (FULL_OFFLINE): Kept on this device.

### Show what you know (`mastery`)

Learner action: Answer the final questions.

Answer each question. Your answers are checked by the school's learning system, not on this device.

- Fallback (PAPER_ACTIVITY, objective preserved: true): Your teacher draws the graph on the board and records your answers on paper.
- Accessibility: Final questions reading a bar graph and finding a mode, with every graph described in text. · keyboard: Tab to each option and press Space. · non-pointer: Without a device, the teacher reads each question and its choices aloud and records the spoken answer.
- Offline (FALLBACK_REQUIRED): Answers given on a device are scored after reconnecting; without a device the teacher gives the same questions on paper.

## Misconceptions

- `mode-is-biggest-number` (obj6): Thinks the mode is the largest count rather than the category with the largest count. → The mode is the answer chosen most often (mango), not the number 9.
- `reads-bar-width` (obj6): Compares bars by width or position instead of height. → Read where the top of each bar meets the number scale.

## Lab candidate links

- none

## Assessment handoffs (Assessment Player V2)

- `bg-mastery`: SINGLE_CHOICE, QUIZ, CORE; scoring SERVER_AUTHORITY; governed items: none yet; tools allowed none, prohibited none; offline FALLBACK_REQUIRED

## Runtime deliverability

| Scene | DEFAULT | OFFLINE | WEBGL_UNAVAILABLE | VIDEO_UNAVAILABLE | KEYBOARD_ONLY | SCREEN_READER | REDUCED_MOTION | LOW_MEMORY | POINTER_DRAG_UNAVAILABLE |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| hook | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY |
| goal | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY |
| read-graph | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK |
| match-bars | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK |
| mode | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY |
| check | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY |
| reflect | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY | PRIMARY |
| mastery | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK | FALLBACK |

## Review gaps

- **ADVISORY** CONCEPT_UNBOUND: moe-math-g4-s2-p6-geometry-and-statistics-obj6 has no governed concept in lr-moe-g4-math-fractions-2026.1; concept-level evidence stays unbound.
- **ADVISORY** STANDARD_UNBOUND: moe-math-g4-s2-p6-geometry-and-statistics-obj6 has no standard/skill binding in lr-moe-g4-math-fractions-2026.1.
- **ADVISORY** SOURCE_CONFIDENCE_MEDIUM: moe-math-g4-s2-p6-geometry-and-statistics-obj6 text was extracted at MEDIUM confidence; the reviewer confirms the wording.
- **BLOCKING** MEDIA_ASSET_REQUIRED (`read-graph`): Required DIAGRAM has no governed asset; a reviewer supplies one or accepts the fallback.
- **ADVISORY** UNSUPPORTED_INTERACTION_DECLARED (`match-bars`): MATCHING is a declared intent with no renderer yet; learners receive the FREE_RESPONSE fallback.
- **ADVISORY** SCENE_USES_FALLBACK (`read-graph`): Delivered through its declared fallback under: DEFAULT, OFFLINE, WEBGL_UNAVAILABLE, VIDEO_UNAVAILABLE, KEYBOARD_ONLY, SCREEN_READER, REDUCED_MOTION, LOW_MEMORY, POINTER_DRAG_UNAVAILABLE.
- **ADVISORY** SCENE_USES_FALLBACK (`match-bars`): Delivered through its declared fallback under: DEFAULT, OFFLINE, WEBGL_UNAVAILABLE, VIDEO_UNAVAILABLE, KEYBOARD_ONLY, SCREEN_READER, REDUCED_MOTION, LOW_MEMORY, POINTER_DRAG_UNAVAILABLE.
- **ADVISORY** SCENE_USES_FALLBACK (`mastery`): Delivered through its declared fallback under: DEFAULT, OFFLINE, WEBGL_UNAVAILABLE, VIDEO_UNAVAILABLE, KEYBOARD_ONLY, SCREEN_READER, REDUCED_MOTION, LOW_MEMORY, POINTER_DRAG_UNAVAILABLE.
- **BLOCKING** ASSESSMENT_ITEMS_PENDING: bg-mastery has no governed items for moe-math-g4-s2-p6-geometry-and-statistics-obj6; Assessment Player V2 items must be authored and released.

## Reviewer decision

Record APPROVE / REVISE / REJECT through the governed curriculum review for this exact artifact hash. Approval requires HUMAN_REVIEW by a qualified reviewer; automated, policy and AI review cannot approve native Curriculum V2.
