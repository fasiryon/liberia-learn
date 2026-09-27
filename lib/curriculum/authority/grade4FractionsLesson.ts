export const GRADE4_FRACTIONS_LESSON = Object.freeze({
  contentId: "ll-g4-math-fractions-equal-parts-2026.1",
  version: "1.0.0",
  title: "Fractions as Equal Parts",
  grade: 4,
  subject: "MATH",
  contentType: "lesson",
  standardCode: "LR-MATH-G4_6-02",
  payload: {
    title: "Fractions as Equal Parts",
    body: "A fraction names equal parts of one whole. The denominator is the bottom number and tells how many equal parts make the whole. The numerator is the top number and tells how many of those parts we are describing. If a cassava bread is cut into four equal pieces and we take three pieces, the fraction is 3/4. The pieces must be equal: three pieces cut from one side are not 3/4 unless the whole is divided into four equal parts.\n\nLook at 1/2, 2/4, and 3/4. In 1/2, the whole is divided into two equal parts and one is selected. In 2/4, the whole is divided into four equal parts and two are selected. Both examples describe a part of a whole, but their denominators tell us the size of the parts. A fraction can be less than one when the numerator is smaller than the denominator, equal to one when they are the same, and greater than one when the numerator is larger.\n\nTo read a fraction, say the numerator first and the denominator second: 3/4 is three-fourths. To model one, draw a rectangle, divide it into four equal sections, and shade three. You can also fold paper, use bottle caps, or draw equal groups. In every model, check that the parts are equal before naming the fraction.\n\nPractice with a family sharing one loaf or a trader dividing a cloth into equal strips. Ask: What is the whole? How many equal parts are there? How many parts are selected? Those answers give the denominator and numerator. Fractions help us describe fair sharing at home, school, and the market.",
    objectives: [
      "Identify the numerator and denominator in a fraction.",
      "Represent a fraction as equal parts of one whole.",
      "Explain why fraction parts must be equal.",
    ],
    activities: [
      "Fold paper into halves and quarters and shade a named fraction.",
      "Use bottle caps or stones to model 1/2, 2/4, and 3/4.",
      "Explain the numerator and denominator to a partner using one drawing.",
    ],
    homework: "Draw two wholes divided into equal parts. Label the numerator and denominator of each shaded fraction.",
    assessment: {
      question: "In 3/4, what does the 4 tell us?",
      options: [
        "How many equal parts make the whole",
        "How many parts are selected",
        "How many wholes there are",
        "The answer to an addition problem",
      ],
      correctAnswer: "How many equal parts make the whole",
    },
    durationMins: 45,
  },
  provenance: Object.freeze({
    authority: "LIBERIALEARN_FOUNDER_REVIEW",
    authorityScope: "Repository founder-approved platform content; not MOE approval",
    standardCode: "LR-MATH-G4_6-02",
    releaseId: "lr-moe-g4-math-fractions-2026.1",
  }),
});

/**
 * Candidate successor to GRADE4_FRACTIONS_LESSON for release 2026.2.
 *
 * GRADE4_FRACTIONS_LESSON (2026.1, 1.0.0) stays byte-for-byte unchanged: the
 * 2026.1 release binds that exact contentId + version and its identity hash
 * may be persisted in learner evidence. CurriculumContent.contentId is unique,
 * so the successor is a new content identity, not a version bump in place.
 *
 * What it adds, all of it PENDING founder review (ledger objective p3-obj4):
 * - the MOE objective "Find parts of a set" taught from the opening
 *   definition: a fraction names equal parts of a whole OR part of a set;
 * - a practice set, a quiz, a prerequisite check, teacher notes, materials and
 *   offline behavior, in the same payload shape as the Grade 4 drafts;
 * - evidence bindings: the diagnostic reuses the released 2026.1 item
 *   unchanged; practice and the end-of-lesson check come from governed items
 *   in the 2026.2 candidate release (lib/learning-authority/releases/grade4Math2026_2.ts).
 *   The end-of-lesson check assesses part of a set directly; the
 *   denominator-meaning check is supporting evidence only.
 *
 * 1.2.0 (2026-09-26) applies the curriculum/product review CPR-2026-09-26:
 * sets from the start, part-of-a-set exit evidence, fractions greater than
 * one moved to an optional extension. 1.1.0 was never approved or published.
 */
export const GRADE4_FRACTIONS_LESSON_2026_2 = Object.freeze({
  contentId: "ll-g4-math-fractions-equal-parts-2026.2",
  version: "1.2.0",
  title: "Fractions as Equal Parts of a Whole and of a Set",
  grade: 4,
  subject: "MATH",
  contentType: "lesson",
  standardCode: "LR-MATH-G4_6-02",
  supersedes: Object.freeze({ contentId: GRADE4_FRACTIONS_LESSON.contentId, version: GRADE4_FRACTIONS_LESSON.version }),
  payload: Object.freeze({
    title: "Fractions as Equal Parts of a Whole and of a Set",
    body: [
      "A fraction can name equal parts of a whole, or part of a set. Both use the same two numbers.\n- Part of a whole: a cassava bread is cut into 4 equal pieces and we take 3 pieces. The whole is the bread, cut into 4 equal parts, so we have 3/4 of the bread.\n- Part of a set: there are 5 bottle caps and 2 of them are red. The whole is the set of 5 caps, so 2/5 of the caps are red.",
      "The denominator is the bottom number. It tells how many equal parts make the whole, or how many objects are in the whole set. The numerator is the top number. It tells how many of those parts or objects we are describing.",
      "In a whole, the parts must be equal: three pieces cut from one side of a bread are not 3/4 unless the whole bread is divided into four equal parts. In a set, each object counts as one part, even if the objects are different sizes or colours.",
      "To find a fraction, ask three questions. What is the whole: one object, or a set of objects? How many equal parts or objects make the whole? How many of them are we describing? If 8 learners sit on a bench and 3 of them are girls, the whole is the set of 8 learners, so 3/8 of the learners are girls.",
      "To read a fraction, say the numerator first and the denominator second: 3/4 is three-fourths and 2/5 is two-fifths. To model a fraction, lay out a set of bottle caps or stones and mark some of them, or draw a rectangle, divide it into equal parts and shade some. In every model, decide what the whole is before naming the fraction.",
      "Fractions describe fair sharing and groups at home, school and the market: part of one loaf, or part of a basket of mangoes.",
    ].join("\n\n"),
    objectives: [
      "Name a fraction as equal parts of a whole or as part of a set.",
      "Find parts of a set: name the fraction of a set of objects.",
      "Identify the numerator and denominator and say what each tells us.",
      "Explain why the parts of a whole must be equal.",
    ],
    activities: [
      "Sets first: groups lay out 6 bottle caps or stones, mark 2 of them and name the fraction marked (2/6). Repeat with sets of 5 and 8 objects.",
      "Wholes: fold paper into halves and quarters and shade a named fraction.",
      "Whole or set? The teacher holds up a folded paper and then a group of stones; for each, learners say what the whole is and name the fraction shown.",
      "Explain the numerator and denominator to a partner using one set of objects and one drawing.",
    ],
    practice: Object.freeze([
      Object.freeze({ prompt: "There are 5 bottle caps. 2 are red. What fraction of the caps are red?", answer: "2/5" }),
      Object.freeze({ prompt: "A basket has 10 mangoes. 7 are ripe. What fraction of the mangoes are not ripe?", answer: "3/10" }),
      Object.freeze({ prompt: "A cassava bread is cut into 8 equal pieces. 3 pieces are eaten. What fraction is eaten?", answer: "3/8" }),
      Object.freeze({ prompt: "In 5/6, which number is the denominator and what does it tell us?", answer: "6: the whole has 6 equal parts (or the set has 6 objects)" }),
      Object.freeze({ prompt: "A cloth is cut into 4 pieces of different sizes. Is one piece 1/4 of the cloth?", answer: "No, the 4 parts are not equal" }),
    ]),
    homework: Object.freeze([
      Object.freeze({ prompt: "Draw a set of 9 stones and circle 4 of them. Write the fraction of the stones circled.", answer: "4/9" }),
      Object.freeze({ prompt: "A family has 7 children. 4 are boys. What fraction of the children are boys?", answer: "4/7" }),
      Object.freeze({ prompt: "Draw a rectangle, divide it into 6 equal parts and shade 4. Write the fraction shaded.", answer: "4/6" }),
      Object.freeze({ prompt: "Write the fraction for three-fifths.", answer: "3/5" }),
    ]),
    quiz: Object.freeze([
      Object.freeze({ prompt: "A group has 9 learners. 4 of them wear sandals. What fraction of the group wear sandals?", options: Object.freeze(["4/9", "5/9", "4/5", "9/4"]), answer: "4/9" }),
      Object.freeze({ prompt: "Which picture shows 1/3?", options: Object.freeze(["A shape cut into 3 equal parts with 1 part shaded", "A shape cut into 3 unequal parts with 1 part shaded", "A shape cut into 4 equal parts with 1 part shaded", "A shape cut into 3 equal parts with 2 parts shaded"]), answer: "A shape cut into 3 equal parts with 1 part shaded" }),
      Object.freeze({ prompt: "In 2/9, what does the 2 tell us?", options: Object.freeze(["How many parts are selected", "How many equal parts make the whole", "How many wholes there are", "The size of each part"]), answer: "How many parts are selected" }),
    ]),
    diagnosticCheck: Object.freeze({
      prompt: "A mango is cut into 2 equal pieces. Is each piece a half?",
      options: Object.freeze(["Yes, 2 equal pieces make halves", "No, halves need 4 pieces", "No, a half is the bigger piece", "It depends on who eats it"]),
      answer: "Yes, 2 equal pieces make halves",
    }),
    assessment: Object.freeze({
      question: "There are 8 mangoes. 3 are ripe. What fraction of the mangoes are ripe?",
      options: Object.freeze(["3/8", "5/8", "3/5", "8/3"]),
      correctAnswer: "3/8",
    }),
    optionalExtension: "Optional extension, not assessed in this lesson: when the numerator and the denominator are the same, as in 4/4, the fraction is one whole. When the numerator is larger, as in 5/4, the fraction is more than one whole. Adding fractions (objective 3.7) returns to this.",
    teacherNotes: "Teach the set model from the first minute, next to the whole model; parts of a set are the MOE objective 'Find parts of a set' (Grade 4 Mathematics, page 42), not an extension. Errors to watch: reversing numerator and denominator (writing 4/3 for three-fourths); naming unequal pieces of a whole as fractions; and, for sets, using the number of objects not described as the denominator (writing 3/5 for 3 ripe mangoes out of 8, which compares ripe to unripe). Ask learners to count the whole set first. The exit assessment checks part of a set; the check on what the denominator means is supporting evidence. Examples and data are LiberiaLearn explanatory material. Fractions greater than one are an optional extension only.",
    materials: Object.freeze(["Bottle caps or stones (required; about 10 per group)", "Paper for folding", "Exercise books"]),
    offline: "Fully offline, and the physical sets are required: bottle caps or stones for parts of a set, paper folding for parts of a whole. Online, the fraction-visualizer tool shows equal-part strips of one whole only; it does not let a learner build or mark a set (product gap SET_FRACTION_MANIPULATIVE_REQUIRED).",
    durationMins: 45,
    evidence: Object.freeze({
      diagnostic: Object.freeze({ itemId: "g4-frac-diagnostic-equal-parts", itemVersion: "1.0.0" }),
      practice: Object.freeze([
        Object.freeze({ itemId: "g4-frac-practice-part-of-set", itemVersion: "1.0.0" }),
        Object.freeze({ itemId: "g4-frac-practice-part-of-whole", itemVersion: "1.0.0" }),
        Object.freeze({ itemId: "g4-frac-practice-unequal-parts", itemVersion: "1.0.0" }),
      ]),
      endOfLesson: Object.freeze({ itemId: "g4-frac-check-part-of-set", itemVersion: "1.0.0" }),
      supporting: Object.freeze([
        Object.freeze({ itemId: "g4-frac-check-denominator-meaning", itemVersion: "1.0.0" }),
      ]),
    }),
  }),
  provenance: Object.freeze({
    authority: "LIBERIALEARN_FOUNDER_REVIEW",
    authorityScope: "Candidate platform content pending founder review; not MOE approval",
    reviewState: "PENDING_FOUNDER_REVIEW",
    standardCode: "LR-MATH-G4_6-02",
    releaseId: "lr-moe-g4-math-2026.2",
    moeObjectiveIds: Object.freeze(["moe-math-g4-s1-p3-number-theory-and-fraction-obj4"]),
    productGaps: Object.freeze(["SET_FRACTION_MANIPULATIVE_REQUIRED"]),
  }),
});
