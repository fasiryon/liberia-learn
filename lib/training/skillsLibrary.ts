/**
 * lib/training/skillsLibrary.ts
 *
 * Real teaching-practice content for the Teaching Skills Library
 * (/teacher/skills). Deliberately separate from lib/training/modules.ts:
 *
 * - TRAINING_MODULES drives the Phase A teacher training certification flow
 *   (badges, levels, a printable completion record whose disclaimer
 *   specifically states it is platform-proficiency training only, not an
 *   MOE credential). Adding pedagogy content into that array would change
 *   badge-earning requirements for every teacher who already holds a badge
 *   (isLevelComplete requires ALL modules at a level to be complete).
 * - lib/reporting/training/index.ts separately enumerates every active
 *   TrainingModule DB row for a governance training-summary report. Seeding
 *   new TrainingModule rows for skills content would silently fold pedagogy
 *   reference material into that certification-completion report.
 *
 * Both are real, already-shipped surfaces this sprint should not regress.
 * The skills library is therefore pure reference content for v1: no
 * completion tracking, no badges, no new DB rows. This is a genuine scope
 * decision made after investigating the reuse path, not a shortcut.
 */

export type SkillArticle = {
  /** Stable id, used in the page URL fragment and as a React key. */
  id: string;
  category: string;
  title: string;
  summary: string;
  /** Paragraphs of real, specific guidance. */
  body: string[];
  estimatedMinutes: number;
};

export type SkillCategory = {
  id: string;
  label: string;
  description: string;
};

export const SKILL_CATEGORIES: SkillCategory[] = [
  {
    id: "differentiation",
    label: "Differentiated Instruction",
    description: "Reaching students at different levels within one class period.",
  },
  {
    id: "formative-assessment",
    label: "Formative Assessment",
    description: "Quick, low-effort ways to check understanding before it becomes a test result.",
  },
  {
    id: "classroom-management",
    label: "Classroom Management for Large Classes",
    description: "Practical routines for classrooms with 50+ students and limited materials.",
  },
  {
    id: "low-bandwidth",
    label: "Low-Bandwidth and Offline Teaching",
    description: "Keeping instruction moving when connectivity, power, or devices are unreliable.",
  },
];

export const SKILL_ARTICLES: SkillArticle[] = [
  // ── Differentiated Instruction ──────────────────────────────────────────
  {
    id: "tiered-practice",
    category: "differentiation",
    title: "Tiered Practice for Mixed-Ability Classes",
    summary: "Give every student the same lesson, different levels of the same task.",
    estimatedMinutes: 6,
    body: [
      "Most LiberiaLearn classes span a wide range of prior mastery, especially after a promotion cycle brings students from different feeder schools together. Tiered practice keeps the whole class on the same lesson topic while adjusting the difficulty of the task itself, so no student is doing obviously easier or harder work in a way that singles them out.",
      "In practice: after teaching the core concept to the whole class, split the follow-up practice into three versions of the same task. Foundational: the same problem type with smaller numbers or a worked first example. Standard: the version most students should be able to complete. Stretch: an extension that adds a second step or asks students to explain their reasoning in writing.",
      "You do not need three separate worksheets. Write one core practice set on the board or in a handout, then verbally offer the foundational or stretch variant to specific students or table groups as you circulate. Assign based on the mastery signals already visible in the Intelligence tab and this class's homework history, not on guesswork.",
      "Keep grading uniform: mark all three tiers against the same standard (did the student demonstrate the concept), not against a curve. A student who completes the foundational tier correctly has met the lesson's core objective.",
    ],
  },
  {
    id: "flexible-grouping",
    category: "differentiation",
    title: "Flexible Grouping Strategies",
    summary: "Rotate groupings by skill, not by fixed ability labels.",
    estimatedMinutes: 5,
    body: [
      "Fixed ability groups (the same 'top group' and 'bottom group' every week) tend to calcify over a term: students in a lower group stop expecting to move, and students in a higher group stop being challenged to explain their thinking to others. Flexible grouping rotates who is grouped with whom based on the specific skill being practiced that day, not a permanent label.",
      "A simple rotation to use with LiberiaLearn data: before grouping for a practice activity, glance at recent homework or exit-ticket results for the specific skill being taught today (not overall class rank). Group students who are strong on today's specific skill with students who are still building it, two or three per group, so the stronger student explains their reasoning aloud. Reasoning aloud is often the more valuable practice for the stronger student, not just the weaker one.",
      "Change the grouping the next time a different skill is being practiced. A student who is ahead in fractions may be exactly average in reading comprehension, and flexible grouping makes that visible to the whole class over time rather than fixing one identity per student.",
    ],
  },

  // ── Formative Assessment ────────────────────────────────────────────────
  {
    id: "exit-tickets",
    category: "formative-assessment",
    title: "Exit Tickets and Quick Checks",
    summary: "A two-minute check at the end of class tells you what tomorrow's lesson needs to fix.",
    estimatedMinutes: 5,
    body: [
      "An exit ticket is one short question, answered in the last two minutes of class, that tells you whether today's core idea landed before students leave the room. It is deliberately smaller than a quiz: one question, one clear right answer or a short written response, no grade attached.",
      "Write the exit ticket before you plan the lesson's practice section, not after. If you cannot write a single question that would prove a student understood today's objective, the objective itself may be too vague to teach cleanly.",
      "Use the result to decide tomorrow's opening five minutes, not today's grade. If most of the class missed the exit ticket, open tomorrow's lesson by re-teaching the specific misconception the wrong answers revealed, using the AI-graded homework and assignment data in your gradebook to identify which specific step students got wrong, not just that they got the answer wrong.",
      "For classes without spare paper, a show-of-hands or fingers-on-chest (1 to 4, for confidence level) version works, though it is less precise and easier for students to copy their neighbor. Written exit tickets, even on scrap paper, give an honest per-student signal a show of hands cannot.",
    ],
  },
  {
    id: "homework-data-adjustment",
    category: "formative-assessment",
    title: "Using AI-Graded Homework Data to Adjust Tomorrow's Lesson",
    summary: "The gradebook already tells you which specific step is breaking down, not just who failed.",
    estimatedMinutes: 6,
    body: [
      "LiberiaLearn's AI-assisted homework grading does more than produce a score: it surfaces which specific step or sub-skill a student got wrong, not just whether the final answer was correct. Most teachers only check the score column. The higher-value habit is reading the per-question breakdown for the two or three lowest-scoring questions across the whole class before planning tomorrow's lesson.",
      "If ten students in a class of thirty missed the same specific step (for example, correctly setting up a ratio but making an arithmetic error in simplifying it), that is a five-minute reteach at the start of tomorrow's lesson, not an individual intervention for ten separate students. Group misconceptions are cheaper to fix once, in front of the whole class, than one student at a time.",
      "Always review AI-suggested scores before releasing them to students, especially for open-ended or written answers. The AI grading pipeline is a first pass, not a final judgment, and a teacher's override is expected and normal when the AI misreads a valid alternative method or a genuine but differently-worded correct explanation.",
    ],
  },

  // ── Classroom Management for Large Under-Resourced Classrooms ──────────
  {
    id: "large-class-routines",
    category: "classroom-management",
    title: "Managing 60+ Students with Minimal Materials",
    summary: "Routines do the work that individual attention cannot, at this class size.",
    estimatedMinutes: 6,
    body: [
      "At 60 or more students per class, which is common in many Liberian public schools, individual attention to every student every day is not achievable, and trying to give it leads to burnout without actually reaching most students. The higher-leverage investment is a small number of very consistent routines that reduce the time spent on transitions and behavior management, freeing the remaining time for actual teaching.",
      "Pick two or three routines and drill them until they are automatic in the first two weeks of a term: how students signal they need help without leaving their seat (a raised hand plus a specific hand signal for 'I need the teacher' versus 'I need a peer'), how materials move around the room when there are not enough for one per student (a fixed rotation order by row, not ad hoc), and how the class transitions from whole-group instruction to independent practice (a single verbal or visual cue, not a multi-step announcement each time).",
      "Materials scarcity is real: with one textbook per group of four or five students, structure practice so that only one student per group needs to hold the book at a time, and rotate who holds it by question number, not by asking students to share simultaneously, which slows every group down to the pace of the least-engaged member.",
      "Use LiberiaLearn's low-bandwidth and printed-material options (see the Low-Bandwidth and Offline Teaching category) to put practice problems directly in students' hands on paper when device access is the bottleneck, rather than having 60 students wait in a queue for five shared devices.",
    ],
  },
  {
    id: "peer-tutoring",
    category: "classroom-management",
    title: "Peer Tutoring and Student Monitors",
    summary: "A structured student-monitor system extends your reach without extra staff.",
    estimatedMinutes: 5,
    body: [
      "A rotating student-monitor role, assigned to a different student each week, can handle low-stakes classroom management tasks that do not require a teacher's judgment: collecting completed work by row, redistributing shared materials, and flagging (not resolving) which table groups are stuck versus which are simply working quietly.",
      "Peer tutoring works best as a structured pairing, not a free-for-all. Pair a student who has just demonstrated mastery of today's specific skill (check recent homework or the exit ticket, not a permanent 'smart student' label) with a student still working on that same skill, for a fixed five-minute window with a specific task: 'explain how you got question 3,' not an open-ended 'help your neighbor.'",
      "Rotate both the monitor role and peer-tutoring pairs regularly. A student who is only ever the tutor loses practice being challenged themselves, and a student who is only ever the one being helped can internalize that as a fixed identity rather than a temporary gap in one specific skill.",
    ],
  },

  // ── Low-Bandwidth and Offline Teaching Adaptations ──────────────────────
  {
    id: "teaching-offline",
    category: "low-bandwidth",
    title: "Teaching When the Internet Is Down",
    summary: "Plan the fallback before you need it, not during the outage.",
    estimatedMinutes: 5,
    body: [
      "Internet and power outages are a normal part of the school day in much of Liberia, not an edge case to plan around only occasionally. Before relying on any LiberiaLearn lesson in class, use the offline-lessons feature to download that day's approved lesson content in advance, ideally the evening before or during a reliable connectivity window, so the lesson plan itself does not depend on the connection holding up during class.",
      "For lessons involving video or audio content, confirm the offline download completed and play a few seconds locally before class starts. A partially-downloaded lesson can look complete in a file listing but fail silently when played, and discovering that in front of 60 students wastes real teaching time.",
      "Keep a print-based backup plan for your two or three most-used lesson types (the ones you teach most weeks), not for every lesson. If connectivity fails entirely and the offline download was not current, a printed practice sheet on the same topic, even a simpler one than the digital lesson, keeps the period productive rather than lost.",
    ],
  },
  {
    id: "sms-and-print",
    category: "low-bandwidth",
    title: "SMS and Printed Materials for Homes Without Devices",
    summary: "Many guardians and students have no reliable device access outside school hours.",
    estimatedMinutes: 5,
    body: [
      "Not every student has a smartphone or a shared family device with reliable data at home, even where their school has connectivity. LiberiaLearn's two-way SMS quiz feature lets a student respond to a short quiz sent to a basic phone number, no app or data connection required, which is often the only channel available for homework practice outside school hours.",
      "SMS quizzes work best for short, single-answer practice (a multiple-choice or short-numeric question), not for open-ended writing tasks. Reserve SMS for spaced review of material already taught in class, not for introducing new content, since there is no way to check comprehension of a new concept through a single text exchange.",
      "For guardians who want to support learning at home but have no device at all, a printed weekly practice sheet sent home with the student, even a single page, keeps the household included in the loop. Pair this with the printed report-card and transcript options already available in the platform so that progress information reaches guardians the same way, not just through an app they may not have access to.",
    ],
  },
];

export function getSkillsByCategory(categoryId: string): SkillArticle[] {
  return SKILL_ARTICLES.filter((article) => article.category === categoryId);
}

export function getSkillById(id: string): SkillArticle | undefined {
  return SKILL_ARTICLES.find((article) => article.id === id);
}
