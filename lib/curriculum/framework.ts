import {
  CurriculumFrameworkSchema,
  type CurriculumFramework,
  type CurriculumSubject,
  type SubjectPedagogy,
} from "@/lib/schemas/curriculumFramework";
import { generateMediaArtifacts } from "@/lib/curriculum/mediaGeneration";
import { generateLessonLabSimulationBundle } from "@/lib/curriculum/labSimulation";

type GradeBandCode = "G1_3" | "G4_6" | "G7_9" | "G10_12";

const GRADE_BANDS: Array<{
  code: GradeBandCode;
  label: string;
  grades: number[];
  pedagogicalFocus: string[];
}> = [
  {
    code: "G1_3",
    label: "Grades 1-3",
    grades: [1, 2, 3],
    pedagogicalFocus: [
      "Foundational literacy, numeracy, self-management, and belonging.",
      "Short routines with concrete examples, oral rehearsal, and visible success checks.",
    ],
  },
  {
    code: "G4_6",
    label: "Grades 4-6",
    grades: [4, 5, 6],
    pedagogicalFocus: [
      "Fluency, comprehension, structured writing, and applied problem solving.",
      "Teacher clarity with guided independence and frequent retrieval practice.",
    ],
  },
  {
    code: "G7_9",
    label: "Grades 7-9",
    grades: [7, 8, 9],
    pedagogicalFocus: [
      "Abstract reasoning, transition to subject specialists, and accountable group work.",
      "Rigorous practice balanced with projects, debate, and structured labs.",
    ],
  },
  {
    code: "G10_12",
    label: "Grades 10-12",
    grades: [10, 11, 12],
    pedagogicalFocus: [
      "WAEC preparation, pathway depth, and workforce-ready performance.",
      "Exam technique, independent study, portfolio work, and real-world application.",
    ],
  },
];

const SUBJECTS: CurriculumSubject[] = [
  { code: "MATH", title: "Mathematics", family: "core", description: "Conceptual and procedural mathematics with strong problem solving and Singapore-style mastery.", grades: [1,2,3,4,5,6,7,8,9,10,11,12], lowerPrimary: true, upperPrimary: true, juniorSecondary: true, seniorSecondary: true, waecAlignedFromGrade: 10, weicFocus: ["W","I"] },
  { code: "ENGLISH", title: "English", family: "core", description: "Reading, writing, speaking, grammar, and WAEC-ready academic English.", grades: [1,2,3,4,5,6,7,8,9,10,11,12], lowerPrimary: true, upperPrimary: true, juniorSecondary: true, seniorSecondary: true, waecAlignedFromGrade: 10, weicFocus: ["C","W"] },
  { code: "LITERACY", title: "Literacy", family: "core", description: "Early and middle-grade literacy focused on decoding, fluency, comprehension, and writing.", grades: [1,2,3,4,5,6], lowerPrimary: true, upperPrimary: true, juniorSecondary: false, seniorSecondary: false, waecAlignedFromGrade: null, weicFocus: ["C"] },
  { code: "SCIENCE", title: "Science", family: "core", description: "Integrated science from observation to evidence-based reasoning and later specialization.", grades: [1,2,3,4,5,6,7,8,9,10,11,12], lowerPrimary: true, upperPrimary: true, juniorSecondary: true, seniorSecondary: true, waecAlignedFromGrade: 10, weicFocus: ["W","I"] },
  { code: "SOCIAL_STUDIES", title: "Social Studies", family: "core", description: "Identity, community, place, economy, and civic understanding rooted in Liberia.", grades: [1,2,3,4,5,6,7,8,9], lowerPrimary: true, upperPrimary: true, juniorSecondary: true, seniorSecondary: false, waecAlignedFromGrade: null, weicFocus: ["C"] },
  { code: "CIVICS", title: "Civics", family: "core", description: "Rights, duties, participation, institutions, and ethical citizenship.", grades: [4,5,6,7,8,9,10,11,12], lowerPrimary: false, upperPrimary: true, juniorSecondary: true, seniorSecondary: true, waecAlignedFromGrade: 10, weicFocus: ["C","E"] },
  { code: "GEOGRAPHY", title: "Geography", family: "core", description: "Human and physical geography with Liberia, West Africa, and global systems.", grades: [6,7,8,9,10,11,12], lowerPrimary: false, upperPrimary: true, juniorSecondary: true, seniorSecondary: true, waecAlignedFromGrade: 10, weicFocus: ["C","W"] },
  { code: "HISTORY", title: "History", family: "core", description: "Liberian, African, and world history with source analysis and civic judgment.", grades: [6,7,8,9,10,11,12], lowerPrimary: false, upperPrimary: true, juniorSecondary: true, seniorSecondary: true, waecAlignedFromGrade: 10, weicFocus: ["C"] },
  { code: "GOVERNMENT", title: "Government", family: "core", description: "Governance, institutions, public systems, and constitutional literacy.", grades: [10,11,12], lowerPrimary: false, upperPrimary: false, juniorSecondary: false, seniorSecondary: true, waecAlignedFromGrade: 10, weicFocus: ["C","W"] },
  { code: "ECONOMICS", title: "Economics", family: "core", description: "Markets, households, production, trade, and policy reasoning.", grades: [10,11,12], lowerPrimary: false, upperPrimary: false, juniorSecondary: false, seniorSecondary: true, waecAlignedFromGrade: 10, weicFocus: ["E","W"] },
  { code: "DIGITAL_LITERACY", title: "Digital Literacy", family: "stem", description: "Safe, effective use of digital tools for learning, work, and communication.", grades: [3,4,5,6,7,8,9], lowerPrimary: false, upperPrimary: true, juniorSecondary: true, seniorSecondary: false, waecAlignedFromGrade: null, weicFocus: ["I","W"] },
  { code: "COMPUTATIONAL_THINKING", title: "Computational Thinking", family: "stem", description: "Patterns, decomposition, logic, and algorithms across subjects.", grades: [4,5,6,7,8,9], lowerPrimary: false, upperPrimary: true, juniorSecondary: true, seniorSecondary: false, waecAlignedFromGrade: null, weicFocus: ["I","W"] },
  { code: "COMPUTER_SCIENCE", title: "Computer Science", family: "stem", description: "Programming, systems, problem solving, and digital creation.", grades: [7,8,9,10,11,12], lowerPrimary: false, upperPrimary: false, juniorSecondary: true, seniorSecondary: true, waecAlignedFromGrade: 10, weicFocus: ["I","W"] },
  { code: "AI_LITERACY", title: "AI Literacy", family: "stem", description: "Responsible AI use, prompt quality, data bias, and human oversight.", grades: [7,8,9,10,11,12], lowerPrimary: false, upperPrimary: false, juniorSecondary: true, seniorSecondary: true, waecAlignedFromGrade: null, weicFocus: ["I","C"] },
  { code: "DATA_LITERACY", title: "Data Literacy", family: "stem", description: "Reading charts, interpreting evidence, and making data-based decisions.", grades: [5,6,7,8,9,10,11,12], lowerPrimary: false, upperPrimary: true, juniorSecondary: true, seniorSecondary: true, waecAlignedFromGrade: null, weicFocus: ["I","W"] },
  { code: "ENGINEERING_FOUNDATIONS", title: "Engineering Foundations", family: "stem", description: "Design, build, test, and improve practical solutions.", grades: [7,8,9,10,11,12], lowerPrimary: false, upperPrimary: false, juniorSecondary: true, seniorSecondary: true, waecAlignedFromGrade: null, weicFocus: ["I","W","E"] },
  { code: "ROBOTICS", title: "Robotics", family: "stem", description: "Sensors, automation, coding, and physical computing.", grades: [8,9,10,11,12], lowerPrimary: false, upperPrimary: false, juniorSecondary: true, seniorSecondary: true, waecAlignedFromGrade: null, weicFocus: ["I","W"] },
  { code: "ICT_SYSTEMS", title: "ICT Systems", family: "stem", description: "Hardware, software, troubleshooting, and systems use in schools and industry.", grades: [9,10,11,12], lowerPrimary: false, upperPrimary: false, juniorSecondary: true, seniorSecondary: true, waecAlignedFromGrade: null, weicFocus: ["I","W"] },
  { code: "NETWORKING_CLOUD", title: "Networking / Cloud", family: "stem", description: "Connectivity, cloud workflows, and foundational network administration.", grades: [10,11,12], lowerPrimary: false, upperPrimary: false, juniorSecondary: false, seniorSecondary: true, waecAlignedFromGrade: null, weicFocus: ["I","W"] },
  { code: "FINANCIAL_LITERACY", title: "Financial Literacy", family: "life_career", description: "Budgeting, saving, borrowing, consumer judgment, and household planning.", grades: [4,5,6,7,8,9,10,11,12], lowerPrimary: false, upperPrimary: true, juniorSecondary: true, seniorSecondary: true, waecAlignedFromGrade: null, weicFocus: ["E","W"] },
  { code: "BUSINESS_ENTREPRENEURSHIP", title: "Business / Entrepreneurship", family: "life_career", description: "Opportunity finding, value creation, customer understanding, and enterprise basics.", grades: [7,8,9,10,11,12], lowerPrimary: false, upperPrimary: false, juniorSecondary: true, seniorSecondary: true, waecAlignedFromGrade: 10, weicFocus: ["E","W","I"] },
  { code: "CAREER_EXPLORATION", title: "Career Exploration", family: "life_career", description: "Career awareness, work habits, pathways, and transitions into opportunity.", grades: [5,6,7,8,9,10,11,12], lowerPrimary: false, upperPrimary: true, juniorSecondary: true, seniorSecondary: true, waecAlignedFromGrade: null, weicFocus: ["W"] },
  { code: "COMMUNICATION_SKILLS", title: "Communication Skills", family: "life_career", description: "Professional communication, listening, writing, and presentation.", grades: [4,5,6,7,8,9,10,11,12], lowerPrimary: false, upperPrimary: true, juniorSecondary: true, seniorSecondary: true, waecAlignedFromGrade: null, weicFocus: ["W","C"] },
  { code: "PROBLEM_SOLVING", title: "Problem Solving", family: "life_career", description: "Structured reasoning, planning, reflection, and transfer across subjects.", grades: [4,5,6,7,8,9,10,11,12], lowerPrimary: false, upperPrimary: true, juniorSecondary: true, seniorSecondary: true, waecAlignedFromGrade: null, weicFocus: ["W","I"] },
  { code: "PROJECT_MANAGEMENT", title: "Project Management", family: "life_career", description: "Planning, roles, milestones, documentation, and delivery discipline.", grades: [8,9,10,11,12], lowerPrimary: false, upperPrimary: false, juniorSecondary: true, seniorSecondary: true, waecAlignedFromGrade: null, weicFocus: ["W","E"] },
  { code: "ART_DESIGN", title: "Art / Design", family: "creative_human", description: "Observation, craft, visual design, and cultural expression.", grades: [1,2,3,4,5,6,7,8,9,10,11,12], lowerPrimary: true, upperPrimary: true, juniorSecondary: true, seniorSecondary: true, waecAlignedFromGrade: null, weicFocus: ["I","C"] },
  { code: "MUSIC", title: "Music", family: "creative_human", description: "Rhythm, voice, performance, and Liberian musical heritage.", grades: [1,2,3,4,5,6,7,8,9], lowerPrimary: true, upperPrimary: true, juniorSecondary: true, seniorSecondary: false, waecAlignedFromGrade: null, weicFocus: ["C"] },
  { code: "CREATIVITY_INNOVATION", title: "Creativity / Innovation", family: "creative_human", description: "Idea generation, prototyping, reflection, and original expression.", grades: [4,5,6,7,8,9,10,11,12], lowerPrimary: false, upperPrimary: true, juniorSecondary: true, seniorSecondary: true, waecAlignedFromGrade: null, weicFocus: ["I","E"] },
  { code: "MEDIA_LITERACY", title: "Media Literacy", family: "creative_human", description: "Reading media critically, checking evidence, and communicating responsibly.", grades: [5,6,7,8,9,10,11,12], lowerPrimary: false, upperPrimary: true, juniorSecondary: true, seniorSecondary: true, waecAlignedFromGrade: null, weicFocus: ["C","I"] },
  { code: "PUBLIC_SPEAKING", title: "Public Speaking", family: "creative_human", description: "Voice, structure, confidence, and audience awareness.", grades: [4,5,6,7,8,9,10,11,12], lowerPrimary: false, upperPrimary: true, juniorSecondary: true, seniorSecondary: true, waecAlignedFromGrade: null, weicFocus: ["C","W"] },
  { code: "HEALTH_WELLNESS", title: "Health / Wellness", family: "creative_human", description: "Physical, mental, and social health for resilient learners and communities.", grades: [1,2,3,4,5,6,7,8,9,10,11,12], lowerPrimary: true, upperPrimary: true, juniorSecondary: true, seniorSecondary: true, waecAlignedFromGrade: null, weicFocus: ["C","W"] },
  { code: "PE", title: "Physical Education", family: "creative_human", description: "Movement, fitness, teamwork, and healthy routines.", grades: [1,2,3,4,5,6,7,8,9,10,11,12], lowerPrimary: true, upperPrimary: true, juniorSecondary: true, seniorSecondary: true, waecAlignedFromGrade: null, weicFocus: ["C"] },
  { code: "LEADERSHIP", title: "Leadership", family: "creative_human", description: "Service, initiative, responsibility, and collaborative leadership.", grades: [6,7,8,9,10,11,12], lowerPrimary: false, upperPrimary: true, juniorSecondary: true, seniorSecondary: true, waecAlignedFromGrade: null, weicFocus: ["C","W","E"] },
  { code: "CONFLICT_RESOLUTION", title: "Conflict Resolution", family: "creative_human", description: "Communication, mediation, empathy, and peaceful problem solving.", grades: [4,5,6,7,8,9,10,11,12], lowerPrimary: false, upperPrimary: true, juniorSecondary: true, seniorSecondary: true, waecAlignedFromGrade: null, weicFocus: ["C"] },
  { code: "AGRICULTURE", title: "Agriculture", family: "national_development", description: "Food systems, soil, crops, agribusiness, and national development.", grades: [4,5,6,7,8,9,10,11,12], lowerPrimary: false, upperPrimary: true, juniorSecondary: true, seniorSecondary: true, waecAlignedFromGrade: 10, weicFocus: ["W","E"] },
  { code: "ENVIRONMENTAL_STUDIES", title: "Environmental Studies", family: "national_development", description: "Climate, conservation, sanitation, and sustainable stewardship.", grades: [4,5,6,7,8,9,10,11,12], lowerPrimary: false, upperPrimary: true, juniorSecondary: true, seniorSecondary: true, waecAlignedFromGrade: null, weicFocus: ["C","W"] },
  { code: "ENERGY_INFRASTRUCTURE", title: "Energy & Infrastructure", family: "national_development", description: "Power, water, roads, housing, and infrastructure systems literacy.", grades: [7,8,9,10,11,12], lowerPrimary: false, upperPrimary: false, juniorSecondary: true, seniorSecondary: true, waecAlignedFromGrade: null, weicFocus: ["W","I"] },
  { code: "LOGISTICS_TRADE", title: "Logistics / Trade", family: "national_development", description: "Supply chains, ports, customs, movement of goods, and regional trade.", grades: [8,9,10,11,12], lowerPrimary: false, upperPrimary: false, juniorSecondary: true, seniorSecondary: true, waecAlignedFromGrade: null, weicFocus: ["W","E"] },
  { code: "COMMUNITY_LEADERSHIP", title: "Community Leadership", family: "national_development", description: "Community problem solving, local planning, and public-interest leadership.", grades: [6,7,8,9,10,11,12], lowerPrimary: false, upperPrimary: true, juniorSecondary: true, seniorSecondary: true, waecAlignedFromGrade: null, weicFocus: ["C","E"] },
  { code: "TECHNICAL_TRADES", title: "Technical Trades", family: "national_development", description: "Foundations of fabrication, repair, safety, and employable technical skills.", grades: [8,9,10,11,12], lowerPrimary: false, upperPrimary: false, juniorSecondary: true, seniorSecondary: true, waecAlignedFromGrade: null, weicFocus: ["W","E"] },
];

const FAMILY_PEDAGOGY: Record<CurriculumSubject["family"], Record<GradeBandCode, Omit<SubjectPedagogy["gradeBandProfiles"][GradeBandCode], never>>> = {
  core: {
    G1_3: {
      conceptModel: "Finland-style clarity with oral rehearsal and concrete examples before abstract naming.",
      explanationStyle: "Short direct teaching cycles, board modeling, and frequent checks for understanding.",
      practiceModel: "Teacher-led repetition followed by paired fluency tasks and independent attempts.",
      assessmentStyle: "Quick retrieval checks, oral responses, copy-free demonstrations, and short written proof of learning.",
      extensionStyle: "Early acceleration through challenge prompts and alternate representations rather than extra worksheets.",
      activityLabStyle: "Simple classroom routines using counters, stories, maps, readers, and discussion circles.",
    },
    G4_6: {
      conceptModel: "Singapore-style concept progression with explicit vocabulary and worked examples.",
      explanationStyle: "I do, we do, you do sequencing with clear success criteria and visible anchors.",
      practiceModel: "Structured guided practice, spaced review, and mixed retrieval to build fluency and transfer.",
      assessmentStyle: "Short written checks, explanation tasks, and cumulative quizzes tied to mastery targets.",
      extensionStyle: "Depth over speed with challenge sets, small projects, and peer explanation roles.",
      activityLabStyle: "Teacher-managed investigations, source analysis, and practical activities with limited materials.",
    },
    G7_9: {
      conceptModel: "Japan-style structure plus Korea/China rigor: coherent steps, explicit reasoning, and accountable practice.",
      explanationStyle: "Model-then-prove teaching with subject vocabulary, note-making routines, and error analysis.",
      practiceModel: "Deliberate guided practice, retrieval spirals, and mixed-difficulty tasks with no random drift.",
      assessmentStyle: "Concept quizzes, extended responses, and scenario tasks showing method as well as answer.",
      extensionStyle: "High performers accelerate into deeper proofs, transfer tasks, and interdisciplinary links.",
      activityLabStyle: "Structured discussions, practical investigations, map/source work, and classroom experiments.",
    },
    G10_12: {
      conceptModel: "WAEC-facing rigor with full conceptual coherence, exam command words, and independent study habits.",
      explanationStyle: "Exam-smart direct instruction backed by evidence, worked solutions, and model answers.",
      practiceModel: "Timed practice, cumulative review, essay planning, and scaffold removal over time.",
      assessmentStyle: "WAEC-style items, data interpretation, essays, and practicals with explicit mark schemes.",
      extensionStyle: "Pathway-aligned seminars, portfolio artifacts, and advanced challenge sets for early accelerators.",
      activityLabStyle: "Evidence-rich practicals, debates, seminars, and applied field tasks linked to workforce relevance.",
    },
  },
  stem: {
    G1_3: {
      conceptModel: "Playful systems thinking through patterns, sequencing, and cause-and-effect.",
      explanationStyle: "Teacher talk is concrete, visual, and short, with immediate hands-on rehearsal.",
      practiceModel: "Build, test, fix cycles using paper, bottle caps, movement, and manipulatives.",
      assessmentStyle: "Performance checks on whether learners can sort, sequence, classify, and explain.",
      extensionStyle: "Optional design challenges for fast finishers that keep the same core concept.",
      activityLabStyle: "Mini making tasks and observation labs with household materials.",
    },
    G4_6: {
      conceptModel: "Conceptual models first, then structured tool use, then digital extension if available.",
      explanationStyle: "Clear demonstration, chunked vocabulary, and explicit reasoning about systems and data.",
      practiceModel: "Guided build-debug cycles, short coding analogies, chart reading, and design sketches.",
      assessmentStyle: "Task completion evidence, explanation of method, and short practical quizzes.",
      extensionStyle: "Project variants with added constraints, optimization, or data collection.",
      activityLabStyle: "Offline-capable labs, guided walkthroughs, and simple simulations where devices exist.",
    },
    G7_9: {
      conceptModel: "Engineering and computational reasoning with disciplined problem decomposition.",
      explanationStyle: "Explicit modeling of procedure, debugging, notation, and why each step matters.",
      practiceModel: "Prototype-test-refine loops, algorithm design, and multi-step quantitative tasks.",
      assessmentStyle: "Practical scenarios, code/pseudocode review, data analysis, and short theory questions.",
      extensionStyle: "Independent builds, robotics extensions, and innovation briefs for accelerated learners.",
      activityLabStyle: "Design sprints, classroom labs, structured simulations, and team troubleshooting.",
    },
    G10_12: {
      conceptModel: "Industry-relevant systems thinking connected to WAEC and workforce applications.",
      explanationStyle: "Teacher explanations connect theory, tools, and employability practices in one sequence.",
      practiceModel: "Applied tasks, troubleshooting logs, cumulative projects, and timed technical drills.",
      assessmentStyle: "WAEC-style technical questions, practical demonstrations, portfolios, and scenarios.",
      extensionStyle: "Pathway capstones, entrepreneurship tie-ins, and advanced independent problem solving.",
      activityLabStyle: "Production-style labs, documented builds, simulation hooks, and future 3D lab linkage.",
    },
  },
  life_career: {
    G1_3: {
      conceptModel: "Habits, routines, and everyday decision making taught through stories and role play.",
      explanationStyle: "Simple language, explicit routines, and repeated modelling of good choices.",
      practiceModel: "Oral rehearsal, paired talk, and classroom scenarios.",
      assessmentStyle: "Teacher observation and short demonstration tasks.",
      extensionStyle: "Leadership helper roles and richer scenario choices.",
      activityLabStyle: "Role play, classroom jobs, and simple projects.",
    },
    G4_6: {
      conceptModel: "Skills are framed as practical tools for school, family, and community life.",
      explanationStyle: "Concrete examples, sentence frames, and direct modeling of communication and planning.",
      practiceModel: "Structured scenarios, budgeting tasks, and collaborative mini-projects.",
      assessmentStyle: "Reflection prompts, performance tasks, and short response checks.",
      extensionStyle: "Small enterprise ideas and extra planning responsibility.",
      activityLabStyle: "Classroom enterprises, presentations, and practical challenge tasks.",
    },
    G7_9: {
      conceptModel: "Transferable employability skills with explicit frameworks for thinking and action.",
      explanationStyle: "Teacher explains the process model clearly before students apply it to Liberia-relevant cases.",
      practiceModel: "Scenario work, project roles, client-style briefs, and peer feedback.",
      assessmentStyle: "Rubric-based performance, reflections, and challenge tasks.",
      extensionStyle: "Student-led ventures, advanced case studies, and innovation pitches.",
      activityLabStyle: "Project sprints, interviews, market observations, and planning workshops.",
    },
    G10_12: {
      conceptModel: "Pathway preparation for work, enterprise, and post-secondary transitions.",
      explanationStyle: "Direct coaching on standards, documentation, communication, and professional judgment.",
      practiceModel: "Simulated workplace tasks, business cases, and project management artifacts.",
      assessmentStyle: "Portfolios, presentations, applied exams, and WAEC-adjacent written responses where relevant.",
      extensionStyle: "Startup prototypes, field briefs, and leadership for younger learners.",
      activityLabStyle: "Internship-style simulations, business labs, and cross-subject capstone projects.",
    },
  },
  creative_human: {
    G1_3: {
      conceptModel: "Expression, self-regulation, and belonging through songs, stories, movement, and visuals.",
      explanationStyle: "Brief teacher models followed by imitation, rehearsal, and positive feedback.",
      practiceModel: "Call-and-response, guided creation, and structured sharing.",
      assessmentStyle: "Observation of participation, clarity, and basic understanding.",
      extensionStyle: "Choice-based expression with teacher support.",
      activityLabStyle: "Performance, drawing, movement, and reflection circles.",
    },
    G4_6: {
      conceptModel: "Technique plus expression, with explicit language for critique and improvement.",
      explanationStyle: "Model, notice, practice, revise.",
      practiceModel: "Short repeated practice, peer rehearsal, and guided critique.",
      assessmentStyle: "Performance tasks, annotated products, and reflective responses.",
      extensionStyle: "Independent composition, design, or leadership roles.",
      activityLabStyle: "Studios, speaking drills, health role play, and collaborative performances.",
    },
    G7_9: {
      conceptModel: "Craft, judgment, and communication with disciplined rehearsal and reflection.",
      explanationStyle: "Clear exemplars, explicit criteria, and repeated revision cycles.",
      practiceModel: "Critique protocols, deliberate rehearsal, and structured creativity tasks.",
      assessmentStyle: "Performances, portfolios, essays, and scenarios showing application.",
      extensionStyle: "Public products, student-led workshops, and innovation challenges.",
      activityLabStyle: "Studios, debates, design briefs, and wellness/community campaigns.",
    },
    G10_12: {
      conceptModel: "Confident communication, leadership, and applied creativity for civic and professional life.",
      explanationStyle: "Teacher coaching emphasizes purpose, audience, evidence, and polish.",
      practiceModel: "Iterative drafting, presentation practice, and collaborative production.",
      assessmentStyle: "Public speaking, portfolio review, scenario essays, and campaign artifacts.",
      extensionStyle: "Advanced showcases, younger-student mentoring, and pathway-linked creative work.",
      activityLabStyle: "Media production, leadership labs, public forums, and community-facing projects.",
    },
  },
  national_development: {
    G1_3: {
      conceptModel: "Local environment and community roles taught through familiar routines and observation.",
      explanationStyle: "Use nearby places, farms, and homes as the entry point for every idea.",
      practiceModel: "Naming, sorting, drawing, and simple cause-effect talk.",
      assessmentStyle: "Oral checks and practical identification tasks.",
      extensionStyle: "Local helper interviews and picture-based challenge prompts.",
      activityLabStyle: "Observation walks, class gardens, and simple care routines.",
    },
    G4_6: {
      conceptModel: "Community systems, stewardship, and practical contribution.",
      explanationStyle: "Teacher explains how local resources, health, environment, and livelihoods connect.",
      practiceModel: "Mapping, records, comparisons, and practical mini-projects.",
      assessmentStyle: "Short written responses, practical checks, and project rubrics.",
      extensionStyle: "Community challenge tasks and deeper data collection.",
      activityLabStyle: "School garden work, sanitation projects, and guided investigations.",
    },
    G7_9: {
      conceptModel: "National development as a system of resources, infrastructure, environment, and leadership.",
      explanationStyle: "Explicit system maps and Liberia-based cases anchor each lesson.",
      practiceModel: "Problem analysis, design tasks, field notes, and structured teamwork.",
      assessmentStyle: "Scenarios, practical tasks, and community improvement proposals.",
      extensionStyle: "Student-led initiatives and entrepreneurship links.",
      activityLabStyle: "Agriculture trials, energy models, logistics simulations, and civic field tasks.",
    },
    G10_12: {
      conceptModel: "Applied pathways tied to national growth, resilience, and decent work.",
      explanationStyle: "Teacher links content to policy, enterprise, and workforce standards without losing classroom clarity.",
      practiceModel: "Projects, practicals, data tasks, and pathway briefs.",
      assessmentStyle: "Applied exams, WAEC-aligned writing where relevant, and practical demonstrations.",
      extensionStyle: "Capstones, enterprise planning, and community implementation pilots.",
      activityLabStyle: "Field-linked projects, technical labs, and simulation-backed decision tasks.",
    },
  },
};

function buildGradeBandProfiles(subject: CurriculumSubject): SubjectPedagogy["gradeBandProfiles"] {
  return {
    G1_3: FAMILY_PEDAGOGY[subject.family].G1_3,
    G4_6: FAMILY_PEDAGOGY[subject.family].G4_6,
    G7_9: FAMILY_PEDAGOGY[subject.family].G7_9,
    G10_12: FAMILY_PEDAGOGY[subject.family].G10_12,
  };
}

function subjectCodesForBand(band: GradeBandCode): string[] {
  const grades = GRADE_BANDS.find((entry) => entry.code === band)?.grades ?? [];
  return SUBJECTS.filter((subject) => grades.some((grade) => subject.grades.includes(grade))).map((subject) => subject.code);
}

const PEDAGOGY_MATRIX: SubjectPedagogy[] = SUBJECTS.map((subject) => ({
  subjectCode: subject.code,
  subjectTitle: subject.title,
  gradeBandProfiles: buildGradeBandProfiles(subject),
}));

const defaultLessonMedia = generateMediaArtifacts({
  sourceLessonId: "framework-lesson-schema",
  subject: "MATH",
  grade: 7,
  unitTitle: "Framework Unit",
  lessonTitle: "Framework Lesson Template",
  objective: "Students explain and apply the target concept in Liberia-relevant situations with visible evidence of understanding.",
  teacherExplanation: "Teacher explanation is concept-first, example-rich, and written so it can be taught with minimal prep.",
  workedExamples: [
    "Example 1 models the full process with every step visible.",
    "Example 2 varies the context while preserving the same core method.",
  ],
  guidedPractice: [
    "Guided practice starts with whole-class rehearsal and then moves to pair support.",
  ],
  groupWorkTask: "Students solve a shared problem with visible roles and an accountability product.",
  guardianSupportNote: "Guardians receive one plain-language note describing what was learned and how to encourage effort.",
  homePracticeSuggestion: "Home practice uses low-material routines that fit family life and avoid overcommunication.",
  realWorldApplication: "Each lesson names a practical Liberia-relevant use of the skill.",
  digitalConnection: "Each lesson notes a simple digital extension when tools exist, plus an offline equivalent.",
  materialsNeeded: ["board", "paper", "exercise books", "teacher guide"],
});

const sampleLessonMedia = generateMediaArtifacts({
  sourceLessonId: "sample-math-g7-fractions",
  subject: "MATH",
  grade: 7,
  unitTitle: "Fractions and Ratio Reasoning",
  lessonTitle: "Comparing Fractions with Shared Benchmarks",
  objective: "Students compare fractions using benchmarks, common denominators, and Liberia-relevant quantity contexts.",
  teacherExplanation: "The teacher models fraction size using market-sharing examples, number lines, and equivalence logic before students explain which strategy is more efficient.",
  workedExamples: [
    "Compare 3/4 and 5/8 by converting to eighths and explain why 6/8 is larger than 5/8.",
    "Compare 2/3 and 3/5 by reasoning from the benchmark of one-half and checking with common denominators.",
  ],
  guidedPractice: [
    "Students compare four teacher-selected fraction pairs with partner talk and full-class justification.",
  ],
  groupWorkTask: "Each group builds a comparison strategy poster showing when to use benchmarks and when to use common denominators.",
  guardianSupportNote: "Ask your child to explain which fraction is larger in a real sharing situation and why.",
  homePracticeSuggestion: "Use cups, slices, or portions at home to compare halves, thirds, fourths, and eighths.",
  realWorldApplication: "Supports fair sharing, budgeting, cooking, and trade quantities.",
  digitalConnection: "Can extend to a fraction visualizer when devices exist, but the lesson stands fully offline.",
  materialsNeeded: ["fraction cards", "string number line", "exercise books", "chalkboard"],
});

const sampleLessonLabSimulation = generateLessonLabSimulationBundle({
  sourceLessonId: "sample-math-g7-fractions",
  subject: "MATH",
  gradeLevel: 7,
  unitTitle: "Fractions and Ratio Reasoning",
  lessonTitle: "Comparing Fractions with Shared Benchmarks",
  lessonObjective: "Students compare fractions using benchmarks, common denominators, and Liberia-relevant quantity contexts.",
});

export const curriculumFramework: CurriculumFramework = CurriculumFrameworkSchema.parse({
  governance: {
    curriculumVersion: "LiberiaLearn.CF.2026.1",
    effectiveYear: 2026,
    approvalStatus: "draft",
    authorSource: "LiberiaLearn national curriculum framework",
    supersedes: null,
    supersededBy: null,
    isNationalDefault: true,
    isSchoolOverride: false,
  },
  gradeBands: GRADE_BANDS.map((band) => ({
    ...band,
    subjectCodes: subjectCodesForBand(band.code),
  })),
  subjects: SUBJECTS,
  seniorPathways: [
    {
      code: "STEM_SYSTEMS",
      title: "STEM & Systems Pathway",
      primarySubjects: ["MATH", "SCIENCE", "COMPUTER_SCIENCE", "ENGINEERING_FOUNDATIONS"],
      minorClusters: [
        { code: "DIGITAL_INNOVATION", title: "Digital Innovation Minor", electiveSubjects: ["AI_LITERACY", "DATA_LITERACY", "NETWORKING_CLOUD"] },
        { code: "ROBOTICS_MAKER", title: "Robotics & Maker Minor", electiveSubjects: ["ROBOTICS", "ICT_SYSTEMS", "PROJECT_MANAGEMENT"] },
      ],
      workforceOutcomes: [
        "Prepares learners for technical tertiary study, ICT support roles, and engineering foundations.",
        "Builds strong analytical, digital, and problem-solving habits for future industry growth.",
      ],
    },
    {
      code: "BUSINESS_CIVIC",
      title: "Business, Economics & Civic Leadership Pathway",
      primarySubjects: ["ENGLISH", "ECONOMICS", "GOVERNMENT", "BUSINESS_ENTREPRENEURSHIP"],
      minorClusters: [
        { code: "PUBLIC_LEADERSHIP", title: "Public Leadership Minor", electiveSubjects: ["LEADERSHIP", "COMMUNITY_LEADERSHIP", "PUBLIC_SPEAKING"] },
        { code: "ENTERPRISE_MEDIA", title: "Enterprise Media Minor", electiveSubjects: ["FINANCIAL_LITERACY", "MEDIA_LITERACY", "PROJECT_MANAGEMENT"] },
      ],
      workforceOutcomes: [
        "Builds WAEC-aligned humanities and business readiness with strong communication and leadership.",
        "Supports entrepreneurship, public service, nonprofit, and commerce-oriented futures.",
      ],
    },
    {
      code: "AGRITECH_TRADES",
      title: "Agriculture, Infrastructure & Technical Trades Pathway",
      primarySubjects: ["AGRICULTURE", "SCIENCE", "TECHNICAL_TRADES", "ENERGY_INFRASTRUCTURE"],
      minorClusters: [
        { code: "SUSTAINABLE_SYSTEMS", title: "Sustainable Systems Minor", electiveSubjects: ["ENVIRONMENTAL_STUDIES", "LOGISTICS_TRADE", "DATA_LITERACY"] },
        { code: "COMMUNITY_ENTERPRISE", title: "Community Enterprise Minor", electiveSubjects: ["BUSINESS_ENTREPRENEURSHIP", "FINANCIAL_LITERACY", "COMMUNITY_LEADERSHIP"] },
      ],
      workforceOutcomes: [
        "Prepares learners for agriculture modernization, infrastructure support, and technical work pathways.",
        "Connects school learning to local production, energy, transport, and trade priorities.",
      ],
    },
    {
      code: "CREATIVE_HEALTH",
      title: "Creative, Communication & Wellness Pathway",
      primarySubjects: ["ENGLISH", "ART_DESIGN", "HEALTH_WELLNESS", "COMMUNICATION_SKILLS"],
      minorClusters: [
        { code: "MEDIA_DESIGN", title: "Media & Design Minor", electiveSubjects: ["MEDIA_LITERACY", "CREATIVITY_INNOVATION", "PUBLIC_SPEAKING"] },
        { code: "YOUTH_LEADERSHIP", title: "Youth Leadership Minor", electiveSubjects: ["LEADERSHIP", "CONFLICT_RESOLUTION", "PE"] },
      ],
      workforceOutcomes: [
        "Supports education, media, wellness, youth development, and communication-focused futures.",
        "Builds confident presentation, project leadership, and human-centered design habits.",
      ],
    },
  ],
  pedagogyMatrix: PEDAGOGY_MATRIX,
  lessonSchema: {
    objective: "Students explain and apply the target concept in Liberia-relevant situations with visible evidence of understanding.",
    masteryLevel: "secure",
    waecAlignment: {
      required: true,
      examStyle: "waec_preparatory",
      referenceCodes: [],
    },
    weicTags: ["W", "E", "I", "C"],
    teacherExplanation: "Teacher explanation is concept-first, example-rich, and written so it can be taught with minimal prep.",
    workedExamples: [
      "Example 1 models the full process with every step visible.",
      "Example 2 varies the context while preserving the same core method.",
    ],
    guidedPractice: [
      "Guided practice starts with whole-class rehearsal and then moves to pair support.",
      "Questions are sequenced from accessible to demanding without random jumps.",
    ],
    independentPractice: [
      "Independent practice includes easy, medium, and challenge items with answer guidance for the teacher.",
    ],
    lessonOpeningRoutine: "Open with a retrieval prompt, a Liberia-relevant hook, and a clear success statement.",
    classroomActivities: [
      "One core classroom activity must be doable with common materials and no internet dependency.",
    ],
    groupWorkTask: "Students solve a shared problem with visible roles and an accountability product.",
    projectTask: "Students produce a small applied artifact linked to work, community, or entrepreneurship.",
    discussionPrompt: "Students discuss how the lesson concept shows up in school, home, market, farm, or civic life.",
    pacingGuidance: "Keep lessons between 45 and 60 minutes, with explicit checkpoints at opening, guided practice, and closing.",
    materialsNeeded: ["board", "paper", "exercise books", "teacher guide"],
    differentiationNotes: [
      "Support learners with sentence frames, worked stems, and lower-floor entry questions.",
      "Extend high performers with transfer tasks, proof tasks, or design constraints.",
    ],
    commonMisconceptions: [
      "Every lesson records the most likely misunderstanding and the specific corrective move.",
    ],
    teacherNotes: [
      "Teacher notes focus on what to emphasize, what to skip, and what evidence to watch for.",
    ],
    guardianSupportNote: "Guardians receive one plain-language note describing what was learned and how to encourage effort.",
    homePracticeSuggestion: "Home practice uses low-material routines that fit family life and avoid overcommunication.",
    whatToLookFor: "Guardians look for confidence, correct process, and completion rather than perfect language.",
    realWorldApplication: "Each lesson names a practical Liberia-relevant use of the skill.",
    careerConnection: "Each lesson links the concept to at least one visible career or livelihood path.",
    digitalConnection: "Each lesson notes a simple digital extension when tools exist, plus an offline equivalent.",
    visualAssetSpecs: defaultLessonMedia.visualAssetSpecs,
    audioScriptSpecs: defaultLessonMedia.audioScriptSpecs,
    slideDeckSpecs: defaultLessonMedia.slideDeckSpecs,
    videoStoryboardSpecs: defaultLessonMedia.videoStoryboardSpecs,
    labDefinitionSpecs: defaultLessonMedia.labDefinitionSpecs,
  },
  assessmentSchema: {
    quickChecks: ["two-question retrieval check", "oral hinge question"],
    practiceSets: ["fluency set", "mixed application set"],
    quizzes: ["weekly quiz"],
    remediationQuizzes: ["misconception-focused recheck"],
    challengeTasks: ["extension task for early accelerators"],
    unitTests: ["standards-aligned unit test"],
    termExams: ["cumulative term exam"],
    waecStyleItems: ["structured WAEC-style item set"],
    itemTypes: ["MCQ", "short_answer", "word_problem", "essay", "scenario", "practical"],
    scoringFields: ["explanation", "difficulty", "waecFlag", "weicTags"],
  },
  teacherWorkloadGuardrails: {
    minLessonMinutes: 45,
    maxLessonMinutes: 60,
    maxPrepComplexity: "moderate",
    maxMaterialsPerLesson: 6,
    pacingRule: "No lesson should require more than one main concept, one main activity, and one closing assessment cycle.",
    planningRule: "Teachers should be able to teach from the generated lesson with normal preparation, not a separate design session.",
  },
  guardianSystem: {
    lessonFields: ["guardianSupportNote", "homePracticeSuggestion", "whatToLookFor"],
    chunkType: "guardian_support",
    communicationPolicy: {
      defaultDigest: "weekly",
      urgentAlertsOnly: true,
      urgentTriggers: ["academic_decline", "repeated_missing_work", "attendance_risk", "major_exam_risk"],
      frequencyCaps: {
        weeklyDigestMaxPerWeek: 1,
        urgentAlertsMaxPerDay: 1,
      },
      quietHours: {
        startHourLocal: 20,
        endHourLocal: 6,
      },
      channelControl: {
        allowSms: true,
        allowEmail: true,
        allowWhatsappLater: true,
      },
    },
  },
  mediaAndLabs: {
    visualSupports: ["diagram", "chart", "illustration"],
    audioSupports: ["reading_support", "explanation_summary"],
    slideDeckFormat: {
      compatibleWithPptx: true,
      sections: [
        "opening routine",
        "concept explanation",
        "worked examples",
        "guided practice",
        "independent practice",
        "closing and reflection",
      ],
    },
    labSupports: ["classroom_lab", "group_experiment", "simulation_hook"],
    threeDLabHooks: {
      enabledForFutureIntegration: true,
      requiredFields: ["lessonLinkage", "subjectRelevance", "metadataHooks"],
    },
  },
  mediaGenerationEngine: {
    stage: "after_lesson_validation_before_chunking",
    schemaFirst: true,
    bestEffort: true,
    nonBlocking: true,
    artifactTypes: ["VisualAssetSpec", "AudioScriptSpec", "SlideDeckSpec", "VideoStoryboardSpec", "LabDefinitionSpec"],
    failurePolicy: {
      persistLessonWhenMediaFails: true,
      allowNullDeferredMedia: true,
      failCurriculumGenerationOnMediaError: false,
    },
  },
  generationBlueprint: {
    pipeline: [
      "curriculum_blueprint",
      "instructional_profile",
      "lesson_generation",
      "assessment_generation",
      "guardian_support_generation",
      "lesson_validation",
      "media_generation",
      "chunking",
      "ingestion",
    ],
    freeformLessonPromptsAllowed: false,
  },
  ragChunkBlueprint: {
    chunkTypes: [
      "concept",
      "example",
      "practice",
      "teacher_support",
      "guardian_support",
      "assessment",
      "media_support",
      "lab_support",
      "simulation_support",
      "teacher_lab_support",
      "guardian_lab_support",
    ],
    requiredFields: ["subject", "gradeLevel", "chunkType", "unitTitle", "lessonTitle", "waecFlag", "weicTags"],
  },
  gapFillPriorities: {
    firstWave: [
      "Grade 7 Mathematics",
      "Grade 3 Literacy",
      "Grade 6 Literacy",
      "Guardian support coverage",
      "Empty retrieval areas for curriculum-aligned chunks",
    ],
    secondWave: [
      "Full semester sequence generation",
      "Full-year coverage by subject and grade",
    ],
  },
});

export const sampleCurriculumBlueprint = {
  governance: {
    ...curriculumFramework.governance,
    approvalStatus: "review" as const,
  },
  scope: {
    grade: 7,
    subject: "MATH",
    unitTitle: "Fractions and Ratio Reasoning",
    lessonTitle: "Comparing Fractions with Shared Benchmarks",
  },
  pedagogyProfile:
    curriculumFramework.pedagogyMatrix.find((entry) => entry.subjectCode === "MATH")?.gradeBandProfiles.G7_9 ?? null,
  lessonBlueprint: {
    objective: "Students compare fractions using benchmarks, common denominators, and Liberia-relevant quantity contexts.",
    masteryLevel: "secure" as const,
    waecAlignment: {
      required: false,
      examStyle: "intro" as const,
      referenceCodes: ["JSS-MATH-FRAC-01"],
    },
    weicTags: ["W", "I"] as const,
    teacherExplanation: "The teacher models fraction size using market-sharing examples, number lines, and equivalence logic before students explain which strategy is more efficient.",
    workedExamples: [
      "Compare 3/4 and 5/8 by converting to eighths and explain why 6/8 is larger than 5/8.",
      "Compare 2/3 and 3/5 by reasoning from the benchmark of one-half and checking with common denominators.",
    ],
    guidedPractice: [
      "Students compare four teacher-selected fraction pairs with partner talk and full-class justification.",
    ],
    independentPractice: [
      "Students solve six comparison problems, including one word problem about sharing rice and one challenge item.",
    ],
    lessonOpeningRoutine: "Begin with a one-minute retrieval task on equivalent fractions and a short hook about fair sharing at the market.",
    classroomActivities: ["Students place fraction cards on a rope number line and defend their positions."],
    groupWorkTask: "Each group builds a comparison strategy poster showing when to use benchmarks and when to use common denominators.",
    projectTask: "Students create a one-page guide for younger learners on how to compare fractions correctly.",
    discussionPrompt: "When is it smarter to use a benchmark instead of rewriting both fractions with common denominators?",
    pacingGuidance: "Keep direct teaching to 12 minutes, guided practice to 15 minutes, group task to 12 minutes, and closing to 6 minutes.",
    materialsNeeded: ["fraction cards", "string number line", "exercise books", "chalkboard"],
    differentiationNotes: [
      "Provide partially completed number lines for learners who need support.",
      "Ask strong learners to compare non-unit fractions with unlike denominators mentally before proving the method.",
    ],
    commonMisconceptions: ["Students may think the larger denominator always means the larger fraction."],
    teacherNotes: ["Insist that students name the comparison strategy, not only the final answer."],
    guardianSupportNote: "Ask your child to explain which fraction is larger in a real sharing situation and why.",
    homePracticeSuggestion: "Use cups, slices, or portions at home to compare halves, thirds, fourths, and eighths.",
    whatToLookFor: "Look for a correct explanation, not only a guessed answer.",
    realWorldApplication: "Supports fair sharing, budgeting, cooking, and trade quantities.",
    careerConnection: "Useful in business, agriculture measurement, construction, and data work.",
    digitalConnection: "Can extend to a fraction visualizer when devices exist, but the lesson stands fully offline.",
    visualAssetSpecs: sampleLessonMedia.visualAssetSpecs,
    audioScriptSpecs: sampleLessonMedia.audioScriptSpecs,
    slideDeckSpecs: sampleLessonMedia.slideDeckSpecs,
    videoStoryboardSpecs: sampleLessonMedia.videoStoryboardSpecs,
    labDefinitionSpecs: sampleLessonMedia.labDefinitionSpecs,
    pseudoLabs: sampleLessonLabSimulation.pseudoLabs,
    simulationDefinitions: sampleLessonLabSimulation.simulationDefinitions,
    threeDLabDefinitions: sampleLessonLabSimulation.threeDLabDefinitions,
  },
  assessmentBlueprint: {
    quickCheck: "One hinge question asks whether 5/6 is greater than 7/9 and requires a method explanation.",
    challengeTask: "Students design their own pair of fractions where a benchmark is faster than a common denominator.",
    waecBridge: "By Grade 10 this concept feeds structured WAEC fraction, ratio, and algebraic reasoning items.",
  },
  chunkReadiness: {
    chunkTypes: [
      "concept",
      "example",
      "practice",
      "teacher_support",
      "guardian_support",
      "assessment",
      "media_support",
      "lab_support",
      "simulation_support",
      "teacher_lab_support",
      "guardian_lab_support",
    ],
    fields: {
      subject: "MATH",
      gradeLevel: 7,
      unitTitle: "Fractions and Ratio Reasoning",
      lessonTitle: "Comparing Fractions with Shared Benchmarks",
      waecFlag: false,
      weicTags: ["W", "I"],
    },
  },
};

export function getSubjectMapByGrade(): Record<number, string[]> {
  return Object.fromEntries(
    Array.from({ length: 12 }, (_, index) => index + 1).map((grade) => [
      grade,
      SUBJECTS.filter((subject) => subject.grades.includes(grade)).map((subject) => subject.code),
    ])
  );
}

export function getSeniorSecondaryCoreSubjects(): string[] {
  return ["MATH", "ENGLISH", "SCIENCE", "CIVICS", "COMMUNICATION_SKILLS", "FINANCIAL_LITERACY"];
}
