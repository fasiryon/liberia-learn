export type HelpArticle = {
  title: string;
  body: string;
};

export type CalendarMilestone = {
  window: "30 days" | "60 days" | "90 days";
  title: string;
  actions: string[];
  evidence: string[];
};

export const ADMIN_HELP_ARTICLES: HelpArticle[] = [
  {
    title: "1. Finish the school setup wizard",
    body: "Open School Setup Wizard, confirm the school name, county, principal contact, school phone, school type, and grades offered. These fields feed onboarding readiness and school-level reporting.",
  },
  {
    title: "2. Add teachers and students",
    body: "Use the teacher and student CSV import tools for rosters. Keep batches small on the free Supabase tier and verify the import count before moving to the next setup step.",
  },
  {
    title: "3. Create classes and timetable entries",
    body: "Create at least one class for each active grade and subject. Add timetable entries so teachers and students can see what is expected each day.",
  },
  {
    title: "4. Schedule the first lesson",
    body: "Use approved curriculum content and schedule the first lesson for a real class. The readiness dashboard checks scheduled approved lessons and delivery activity.",
  },
  {
    title: "5. Verify delivery and completions",
    body: "Have one teacher open the scheduled lesson and one student complete learning activity. This creates the delivery and progress signals used by readiness dashboards.",
  },
  {
    title: "6. Review training adoption",
    body: "Open Training Adoption to see aggregate teacher progress. The dashboard shows counts only and does not expose individual teacher data.",
  },
  {
    title: "7. Use compliance and audit surfaces",
    body: "Use Compliance, Audit Log, and Governance Exports when preparing evidence for school leadership or Ministry review. Do not export student PII unless a specific authorized export path allows it.",
  },
];

export const TEACHER_HELP_ARTICLES: HelpArticle[] = [
  {
    title: "1. Complete your training modules",
    body: "Open Your Training and complete the short modules for login, class work, lessons, assignments, feedback, guardian messages, reports, and accessibility tools.",
  },
  {
    title: "2. Open your class roster",
    body: "Use Students or a class card to confirm that the learners assigned to you match the class list from your school administrator.",
  },
  {
    title: "3. Teach from scheduled lessons",
    body: "Use the schedule and curriculum pages to find the approved lesson for the day. Keep lesson delivery tied to the scheduled content so completion evidence stays accurate.",
  },
  {
    title: "4. Assign and review work",
    body: "Create homework or assignments with clear instructions, review submissions, adjust any AI-suggested score when needed, and release useful feedback.",
  },
  {
    title: "5. Use class intelligence weekly",
    body: "Check class performance, exam readiness, and intervention alerts at least once each week. Use these signals to plan support for learners who are falling behind.",
  },
  {
    title: "6. Communicate safely",
    body: "Use platform messaging and approved guardian alert flows. Keep messages factual, school-related, and limited to the student support purpose.",
  },
];

export const MOE_HELP_ARTICLES: HelpArticle[] = [
  {
    title: "1. Start with the national dashboard",
    body: "Use the MOE dashboard for aggregate trends across active schools. Small cohorts are suppressed or aggregated, so individual student drilldown is not part of the MOE workflow.",
  },
  {
    title: "2. Review curriculum coverage",
    body: "Use curriculum coverage and readiness views to identify which grade-subject cells have enough approved content for delivery and which cells still need work.",
  },
  {
    title: "3. Read delivery and learning signals",
    body: "Use school and subject summaries for lesson delivery, completion, performance events, interventions, and AI usage quality. Treat low-volume schools as early signals, not final judgments.",
  },
  {
    title: "4. Export only approved report types",
    body: "Use governance export routes for authorized aggregate reporting. Safeguarding and sensitive data should appear only as redacted or summarized evidence.",
  },
  {
    title: "5. Review procurement evidence",
    body: "Use legal, privacy, data-for-minors, compliance, audit, and governance pages together when reviewing platform readiness for broader rollout.",
  },
];

export const STUDENT_HELP_ARTICLES: HelpArticle[] = [
  {
    title: "1. Start on Today",
    body: "Use the Today page to find scheduled lessons, assignments, live class notices, events, and next best actions.",
  },
  {
    title: "2. Complete lessons and quizzes",
    body: "Open the scheduled lesson using the content link, read or listen where available, complete the learning activity, and submit quizzes when prompted.",
  },
  {
    title: "3. Check progress",
    body: "Use Progress, Passport, Exams, Certificates, Portfolio, and Leaderboard to see mastery, exam readiness, earned records, and class activity.",
  },
  {
    title: "4. Use support tools safely",
    body: "Use AI tutor, practice, messages, and teacher feedback for learning support. Do not share passwords or personal information in messages.",
  },
];

export const GUARDIAN_HELP_ARTICLES: HelpArticle[] = [
  {
    title: "1. Review linked learners",
    body: "Use the guardian dashboard to confirm each linked student and review attendance, assignments, progress, report cards, and upcoming events.",
  },
  {
    title: "2. Watch for support signals",
    body: "Use performance summaries and study plans to see where a learner needs help at home, especially before exams or missed assignments.",
  },
  {
    title: "3. Communicate through approved channels",
    body: "Use guardian messaging and school SMS alerts for school-related updates. Reply STOP to SMS only when you want to unsubscribe from SMS alerts.",
  },
];

export const IMPLEMENTATION_CALENDAR: CalendarMilestone[] = [
  {
    window: "30 days",
    title: "School launch and first real delivery",
    actions: [
      "Confirm school profile, county, grades, and principal contact.",
      "Import teachers and students for the first active grades.",
      "Create classes and timetable entries for the first two teaching weeks.",
      "Schedule one approved lesson per active class.",
      "Have every teacher complete Level 1 training modules.",
    ],
    evidence: [
      "Onboarding readiness shows school, teacher, student, class, and curriculum steps moving from incomplete to complete.",
      "At least one scheduled approved lesson exists for the school.",
      "Training Adoption shows Level 1 Training Badge progress.",
    ],
  },
  {
    window: "60 days",
    title: "Routine classroom use and support habits",
    actions: [
      "Run weekly lesson delivery checks with teachers.",
      "Use assignments or homework in each active class.",
      "Review class performance and exam readiness once per week.",
      "Link guardians for priority learners where school records support it.",
      "Have teachers complete Level 2 training modules.",
    ],
    evidence: [
      "Delivery readiness shows lessons delivered or student completions recorded.",
      "Assignment or homework counts are present for active classes.",
      "Teacher dashboards and intervention follow-through create recent audit signals.",
    ],
  },
  {
    window: "90 days",
    title: "Review, governance, and scale decision",
    actions: [
      "Review pilot readiness with school leadership.",
      "Export aggregate governance evidence for authorized review.",
      "Identify grade-subject gaps before expanding to more classes.",
      "Confirm support workflow for learners flagged by interventions.",
      "Have teachers complete Level 3 training modules and print completion records where fully complete.",
    ],
    evidence: [
      "Pilot readiness score and blocking issues are reviewed honestly.",
      "Audit and compliance surfaces show activity without weakening tenant isolation.",
      "Training Completion Records use platform proficiency wording and include the required disclaimer.",
    ],
  },
];
