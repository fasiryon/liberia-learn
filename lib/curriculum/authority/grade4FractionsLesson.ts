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
 * - the MOE "parts of a set" model taught explicitly, not only in activities;
 * - a practice set, a quiz, a prerequisite check, teacher notes, materials and
 *   offline behavior, in the same payload shape as the Grade 4 drafts;
 * - evidence bindings: the diagnostic reuses the released 2026.1 item
 *   unchanged, and practice/quiz/exit evidence comes from governed items in
 *   the 2026.2 candidate release (lib/learning-authority/releases/grade4Math2026_2.ts).
 */
export const GRADE4_FRACTIONS_LESSON_2026_2 = Object.freeze({
  contentId: "ll-g4-math-fractions-equal-parts-2026.2",
  version: "1.1.0",
  title: "Fractions as Equal Parts of a Whole and of a Set",
  grade: 4,
  subject: "MATH",
  contentType: "lesson",
  standardCode: "LR-MATH-G4_6-02",
  supersedes: Object.freeze({ contentId: GRADE4_FRACTIONS_LESSON.contentId, version: GRADE4_FRACTIONS_LESSON.version }),
  payload: Object.freeze({
    title: "Fractions as Equal Parts of a Whole and of a Set",
    body: [
      GRADE4_FRACTIONS_LESSON.payload.body,
      "A fraction can also name part of a set, a group of separate objects. A set of 5 bottle caps has 2 red caps and 3 blue caps. The whole is the set of 5 caps, so the denominator is 5. The red caps are 2 of them, so 2/5 of the caps are red and 3/5 are blue. Here each object counts as one equal part, even if the caps are different colours.",
      "To name part of a set, ask the same three questions: What is the whole set? How many objects are in it? How many objects are we describing? If 8 learners sit on a bench and 3 of them are girls, the fraction of the learners who are girls is 3/8.",
    ].join("\n\n"),
    objectives: [
      ...GRADE4_FRACTIONS_LESSON.payload.objectives,
      "Name the fraction of a set of objects.",
    ],
    activities: [
      ...GRADE4_FRACTIONS_LESSON.payload.activities,
      "Sets of objects: groups make a set of 6 stones with some painted or marked, and name the fraction that is marked.",
    ],
    practice: Object.freeze([
      Object.freeze({ prompt: "A cassava bread is cut into 8 equal pieces. 3 pieces are eaten. What fraction is eaten?", answer: "3/8" }),
      Object.freeze({ prompt: "There are 5 bottle caps. 2 are red. What fraction of the caps are red?", answer: "2/5" }),
      Object.freeze({ prompt: "In 5/6, which number is the denominator and what does it tell us?", answer: "6: the whole has 6 equal parts" }),
      Object.freeze({ prompt: "A cloth is cut into 4 pieces of different sizes. Is one piece 1/4 of the cloth?", answer: "No, the 4 parts are not equal" }),
    ]),
    homework: Object.freeze([
      Object.freeze({ prompt: "Draw a rectangle, divide it into 6 equal parts and shade 4. Write the fraction shaded.", answer: "4/6" }),
      Object.freeze({ prompt: "A family has 7 children. 4 are boys. What fraction of the children are boys?", answer: "4/7" }),
      Object.freeze({ prompt: "Write the fraction for three-fifths.", answer: "3/5" }),
    ]),
    quiz: Object.freeze([
      Object.freeze({ prompt: "A set has 6 mangoes. 5 are ripe. What fraction of the mangoes are ripe?", options: Object.freeze(["5/6", "1/6", "6/5", "5/11"]), answer: "5/6" }),
      Object.freeze({ prompt: "Which picture shows 1/3?", options: Object.freeze(["A shape cut into 3 equal parts with 1 part shaded", "A shape cut into 3 unequal parts with 1 part shaded", "A shape cut into 4 equal parts with 1 part shaded", "A shape cut into 3 equal parts with 2 parts shaded"]), answer: "A shape cut into 3 equal parts with 1 part shaded" }),
      Object.freeze({ prompt: "In 2/9, what does the 2 tell us?", options: Object.freeze(["How many parts are selected", "How many equal parts make the whole", "How many wholes there are", "The size of each part"]), answer: "How many parts are selected" }),
    ]),
    diagnosticCheck: Object.freeze({
      prompt: "A mango is cut into 2 equal pieces. Is each piece a half?",
      options: Object.freeze(["Yes, 2 equal pieces make halves", "No, halves need 4 pieces", "No, a half is the bigger piece", "It depends on who eats it"]),
      answer: "Yes, 2 equal pieces make halves",
    }),
    assessment: GRADE4_FRACTIONS_LESSON.payload.assessment,
    teacherNotes: "Two errors to watch: reversing numerator and denominator (writing 4/3 for three-fourths) and naming unequal pieces as fractions. For sets, learners sometimes use the number of objects not selected as the denominator (writing 2/3 for 2 red caps out of 5); ask them to count the whole set first. Parts of a set follow the MOE objective 'Find parts of a set' (Grade 4 Mathematics, page 42); the examples and data are LiberiaLearn explanatory material.",
    materials: Object.freeze(["Paper for folding", "Bottle caps or stones", "Exercise books"]),
    offline: "Fully offline: paper folding, bottle caps and stones. Online, the fraction-visualizer tool shows equal-part strips; it does not model sets.",
    durationMins: 45,
    evidence: Object.freeze({
      diagnostic: Object.freeze({ itemId: "g4-frac-diagnostic-equal-parts", itemVersion: "1.0.0" }),
      practice: Object.freeze([
        Object.freeze({ itemId: "g4-frac-practice-part-of-whole", itemVersion: "1.0.0" }),
        Object.freeze({ itemId: "g4-frac-practice-part-of-set", itemVersion: "1.0.0" }),
        Object.freeze({ itemId: "g4-frac-practice-unequal-parts", itemVersion: "1.0.0" }),
      ]),
      endOfLesson: Object.freeze({ itemId: "g4-frac-check-denominator-meaning", itemVersion: "1.0.0" }),
    }),
  }),
  provenance: Object.freeze({
    authority: "LIBERIALEARN_FOUNDER_REVIEW",
    authorityScope: "Candidate platform content pending founder review; not MOE approval",
    reviewState: "PENDING_FOUNDER_REVIEW",
    standardCode: "LR-MATH-G4_6-02",
    releaseId: "lr-moe-g4-math-2026.2",
    moeObjectiveIds: Object.freeze(["moe-math-g4-s1-p3-number-theory-and-fraction-obj4"]),
  }),
});
