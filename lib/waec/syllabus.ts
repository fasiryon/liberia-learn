/**
 * lib/waec/syllabus.ts — PHASE 5A Foundation
 *
 * Canonical WAEC / WASSCE syllabus map for the WAEC Prep track.
 *
 * SOURCES (public WAEC/WASSCE syllabus documents — see docs/curriculum/WAEC_SYLLABUS_MAP.md
 * for full citations):
 *   - The West African Examinations Council — https://www.waeconline.org.ng/
 *   - WASSCE subject syllabi (waecsyllabus.com, syllabus.ng aggregations of the
 *     official WAEC regional syllabus for member states incl. Liberia).
 *
 * This module is the single source of truth for:
 *   1. WAEC subjects the platform recognises (decoupled from the coarse Prisma `Subject` enum).
 *   2. Stable syllabus topic identifiers (for content tagging — see waecSyllabusTopics).
 *   3. Deterministic keyword hints (title/text → topic) used by the tagging script.
 *   4. Mastery-strand mappings + exam weights used by the readiness engine.
 *
 * IMPORTANT: topic ids and subject ids are STABLE. Never rename an existing id — it is
 * persisted in CurriculumContent.waecSyllabusTopics. Add new ids instead.
 */

import type { Subject } from "@prisma/client";

export type WaecSubjectId =
  | "waec_math"
  | "waec_english"
  | "waec_physics"
  | "waec_chemistry"
  | "waec_biology"
  | "waec_geography"
  | "waec_literature";

/** A reference to a mastery strand in StrandCatalog (subject enum + stable strandKey). */
export type MasteryStrandRef = { subject: Subject; strandKey: string };

export type WaecTopic = {
  /** Stable id, dot-namespaced by subject, e.g. "physics.mechanics". Persisted. */
  id: string;
  name: string;
  /**
   * Relative exam weight within the subject. Not required to sum to 1 — the readiness
   * engine normalises across *covered* topics. Reflects published paper emphasis.
   */
  examWeight: number;
  /** Lowercased keyword hints for deterministic title/text → topic matching. */
  keywords: string[];
  /**
   * Mastery strands this topic draws from. May be empty when no mastery strand exists
   * for the topic (e.g. Geography) — such topics contribute to tagging but not readiness.
   */
  strands: MasteryStrandRef[];
};

export type WaecSubject = {
  id: WaecSubjectId;
  /** Display name — always prefixed "WAEC " so branding is unambiguous. */
  name: string;
  /**
   * CurriculumContent.subject strings (uppercased) that belong to this WAEC subject.
   * Content subjects are free-form strings, so several may map to one WAEC subject.
   */
  contentSubjects: string[];
  /**
   * Prisma `Subject` enum bucket the mastery engine stores this subject's strands under.
   * null when the subject has no mastery strands (readiness cannot be computed — honest gap).
   */
  masterySubject: Subject | null;
  /** Human-readable source citation for this subject's topic list. */
  source: string;
  topics: WaecTopic[];
};

const M = (subject: Subject, strandKey: string): MasteryStrandRef => ({ subject, strandKey });

export const WAEC_SUBJECTS: WaecSubject[] = [
  // ── WAEC MATHEMATICS ───────────────────────────────────────────────────────
  {
    id: "waec_math",
    name: "WAEC Mathematics",
    contentSubjects: ["MATH", "MATHEMATICS", "MATHS", "GENERAL_MATHEMATICS"],
    masterySubject: "MATH",
    source: "WAEC WASSCE Mathematics (Core) syllabus — waeconline.org.ng",
    topics: [
      { id: "math.number_numeration", name: "Number & Numeration", examWeight: 0.18,
        keywords: ["number", "numeration", "fraction", "decimal", "percentage", "ratio", "proportion", "indices", "logarithm", "surd", "sequence", "sets", "modular"],
        strands: [M("MATH", "expressions_eqs"), M("MATH", "financial_sequences")] },
      { id: "math.algebraic_processes", name: "Algebraic Processes", examWeight: 0.22,
        keywords: ["algebra", "equation", "expression", "polynomial", "variation", "inequalit", "factoris", "factoriz", "simultaneous", "quadratic"],
        strands: [M("MATH", "advanced_algebra"), M("MATH", "algebra_basics"), M("MATH", "expressions_eqs")] },
      { id: "math.geometry_mensuration", name: "Geometry & Mensuration", examWeight: 0.20,
        keywords: ["geometry", "mensuration", "area", "volume", "perimeter", "angle", "circle", "polygon", "triangle", "construction", "loci", "bearing"],
        strands: [M("MATH", "geometry_proofs"), M("MATH", "functions_modeling")] },
      { id: "math.trigonometry", name: "Trigonometry", examWeight: 0.12,
        keywords: ["trigonometry", "sine", "cosine", "tangent", "elevation", "depression", "trig"],
        strands: [M("MATH", "trigonometry")] },
      { id: "math.coordinate_calculus", name: "Coordinate Geometry & Introductory Calculus", examWeight: 0.12,
        keywords: ["coordinate", "gradient", "calculus", "differentiation", "integration", "graph", "function", "slope", "rate of change"],
        strands: [M("MATH", "calculus_intro"), M("MATH", "functions_modeling")] },
      { id: "math.statistics_probability", name: "Statistics & Probability", examWeight: 0.12,
        keywords: ["statistic", "probability", "mean", "median", "mode", "standard deviation", "histogram", "frequency", "permutation", "combination"],
        strands: [M("MATH", "statistics_prob"), M("MATH", "combinatorics")] },
      { id: "math.vectors_transformation", name: "Vectors & Transformation", examWeight: 0.04,
        keywords: ["vector", "matrix", "matrices", "transformation", "translation", "rotation", "reflection", "enlargement"],
        strands: [M("MATH", "matrices_vectors")] },
    ],
  },

  // ── WAEC ENGLISH LANGUAGE ──────────────────────────────────────────────────
  {
    id: "waec_english",
    name: "WAEC English Language",
    contentSubjects: ["ENGLISH", "ENGLISH_LANGUAGE", "LITERACY"],
    masterySubject: "LITERACY",
    source: "WAEC WASSCE English Language syllabus — waeconline.org.ng / waecsyllabus.com/english-language",
    topics: [
      { id: "english.comprehension", name: "Comprehension", examWeight: 0.22,
        keywords: ["comprehension", "passage", "reading", "inference", "context"],
        strands: [M("LITERACY", "critical_analysis"), M("LITERACY", "literary_analysis")] },
      { id: "english.summary", name: "Summary", examWeight: 0.16,
        keywords: ["summary", "summarise", "summarize", "precis", "main point"],
        strands: [M("LITERACY", "academic_writing"), M("LITERACY", "research_skills")] },
      { id: "english.lexis_structure", name: "Lexis & Structure", examWeight: 0.22,
        keywords: ["grammar", "lexis", "structure", "synonym", "antonym", "sentence", "vocabulary", "tense", "concord", "clause", "phrase"],
        strands: [M("LITERACY", "grammar_advanced")] },
      { id: "english.oral", name: "Oral English", examWeight: 0.14,
        keywords: ["oral", "phonetic", "stress", "intonation", "vowel", "consonant", "rhyme", "pronunciation", "spoken"],
        strands: [M("LITERACY", "speaking_listening")] },
      { id: "english.essay_writing", name: "Essay & Continuous Writing", examWeight: 0.26,
        keywords: ["essay", "letter", "article", "report", "composition", "writing", "register", "argumentative", "narrative", "descriptive", "speech"],
        strands: [M("LITERACY", "academic_writing"), M("LITERACY", "argumentative_writing"), M("LITERACY", "rhetoric_persuasion")] },
    ],
  },

  // ── WAEC PHYSICS ───────────────────────────────────────────────────────────
  {
    id: "waec_physics",
    name: "WAEC Physics",
    contentSubjects: ["PHYSICS"],
    masterySubject: "SCIENCE",
    source: "WAEC WASSCE Physics syllabus (Interaction of Matter/Space/Time; Energy; Waves; Fields; Atomic) — waecsyllabus.com/physics",
    topics: [
      { id: "physics.matter_measurement", name: "Interaction of Matter, Space & Time", examWeight: 0.18,
        keywords: ["measurement", "unit", "density", "matter", "molecular", "elasticity", "pressure", "surface tension", "viscosity", "dimension"],
        strands: [M("SCIENCE", "physics_mechanics"), M("SCIENCE", "scientific_method")] },
      { id: "physics.mechanics", name: "Mechanics & Motion", examWeight: 0.22,
        keywords: ["motion", "force", "newton", "momentum", "energy", "work", "power", "gravity", "projectile", "equilibrium", "velocity", "acceleration", "friction"],
        strands: [M("SCIENCE", "physics_mechanics")] },
      { id: "physics.heat_energy", name: "Energy: Heat & Thermal Physics", examWeight: 0.16,
        keywords: ["heat", "temperature", "thermometer", "thermal", "gas law", "expansion", "calorimetry", "specific heat", "latent"],
        strands: [M("SCIENCE", "physics_energy")] },
      { id: "physics.waves_optics", name: "Waves, Sound & Optics", examWeight: 0.16,
        keywords: ["wave", "sound", "light", "reflection", "refraction", "lens", "mirror", "optics", "frequency", "wavelength", "diffraction"],
        strands: [M("SCIENCE", "physics_energy")] },
      { id: "physics.electricity_magnetism", name: "Electricity & Magnetism", examWeight: 0.18,
        keywords: ["electric", "current", "circuit", "resistance", "voltage", "magnet", "electromagnetic", "capacitor", "field", "induction"],
        strands: [M("SCIENCE", "physics_mechanics")] },
      { id: "physics.modern", name: "Atomic & Nuclear Physics", examWeight: 0.10,
        keywords: ["atom", "nucleus", "radioactiv", "electron", "photoelectric", "nuclear", "quantum", "isotope"],
        strands: [M("SCIENCE", "scientific_method")] },
    ],
  },

  // ── WAEC CHEMISTRY ─────────────────────────────────────────────────────────
  {
    id: "waec_chemistry",
    name: "WAEC Chemistry",
    contentSubjects: ["CHEMISTRY"],
    masterySubject: "SCIENCE",
    source: "WAEC WASSCE Chemistry syllabus — waecsyllabus.com/chemistry",
    topics: [
      { id: "chemistry.separation_matter", name: "Standard of Matter & Separation Techniques", examWeight: 0.12,
        keywords: ["separation", "mixture", "purification", "chromatography", "states of matter", "distillation", "filtration", "sublimation"],
        strands: [M("SCIENCE", "chemistry_basics"), M("SCIENCE", "scientific_method")] },
      { id: "chemistry.atomic_bonding", name: "Atomic Structure & Chemical Bonding", examWeight: 0.18,
        keywords: ["atom", "atomic structure", "electronic configuration", "periodic", "bonding", "valency", "isotope", "orbital", "molecule"],
        strands: [M("SCIENCE", "chemistry_basics")] },
      { id: "chemistry.stoichiometry", name: "Mole Concept & Stoichiometry", examWeight: 0.14,
        keywords: ["mole", "stoichiometry", "formula", "equation", "molar", "gas volume", "empirical"],
        strands: [M("SCIENCE", "chemistry_basics")] },
      { id: "chemistry.acids_bases_salts", name: "Acids, Bases & Salts", examWeight: 0.14,
        keywords: ["acid", "base", "salt", "ph", "neutralis", "neutraliz", "titration", "indicator", "alkali"],
        strands: [M("SCIENCE", "chemistry_basics")] },
      { id: "chemistry.energetics_electro", name: "Energetics, Rates, Equilibrium & Electrochemistry", examWeight: 0.16,
        keywords: ["electrolysis", "redox", "oxidation", "reduction", "energy change", "enthalpy", "rate of reaction", "equilibrium", "electrode", "cell"],
        strands: [M("SCIENCE", "chemistry_basics"), M("SCIENCE", "scientific_method")] },
      { id: "chemistry.organic", name: "Organic Chemistry", examWeight: 0.16,
        keywords: ["organic", "hydrocarbon", "alkane", "alkene", "alkyne", "alcohol", "ester", "polymer", "carbon compound", "petroleum"],
        strands: [M("SCIENCE", "organic_chemistry")] },
      { id: "chemistry.metals_industry", name: "Metals, Non-Metals & Chemistry in Industry", examWeight: 0.10,
        keywords: ["metal", "extraction", "alloy", "industrial", "fertilizer", "fertiliser", "non-metal", "corrosion", "ore"],
        strands: [M("SCIENCE", "chemistry_basics")] },
    ],
  },

  // ── WAEC BIOLOGY ───────────────────────────────────────────────────────────
  {
    id: "waec_biology",
    name: "WAEC Biology",
    contentSubjects: ["BIOLOGY"],
    masterySubject: "SCIENCE",
    source: "WAEC WASSCE Biology syllabus (5 units: variety of living things, organisation of life, evolution, continuity, ecology) — waeconline.org.ng",
    topics: [
      { id: "biology.variety_living", name: "Variety of Living Things", examWeight: 0.18,
        keywords: ["variety", "classification", "kingdom", "monera", "protista", "virus", "bacteria", "fungi", "taxonomy", "characteristics of living"],
        strands: [M("SCIENCE", "cells_biology")] },
      { id: "biology.organisation_life", name: "Organisation of Life", examWeight: 0.24,
        keywords: ["cell", "tissue", "organ", "organisation", "nutrition", "transport", "respiration", "excretion", "digestion", "circulatory", "nervous"],
        strands: [M("SCIENCE", "cells_biology"), M("SCIENCE", "advanced_biology")] },
      { id: "biology.continuity_life", name: "Continuity of Life (Reproduction & Genetics)", examWeight: 0.22,
        keywords: ["reproduction", "genetics", "heredity", "dna", "chromosome", "variation", "continuity", "mitosis", "meiosis", "inheritance"],
        strands: [M("SCIENCE", "genetics_intro"), M("SCIENCE", "advanced_biology")] },
      { id: "biology.evolution", name: "Evolution of Life", examWeight: 0.12,
        keywords: ["evolution", "adaptation", "natural selection", "darwin", "fossil", "lamarck"],
        strands: [M("SCIENCE", "advanced_biology")] },
      { id: "biology.ecology", name: "Ecology", examWeight: 0.24,
        keywords: ["ecology", "ecosystem", "habitat", "food chain", "food web", "population", "conservation", "pollution", "environment", "biotic", "abiotic"],
        strands: [M("SCIENCE", "ecology_advanced"), M("SCIENCE", "env_science")] },
    ],
  },

  // ── WAEC LITERATURE-IN-ENGLISH ─────────────────────────────────────────────
  {
    id: "waec_literature",
    name: "WAEC Literature-in-English",
    contentSubjects: ["LITERATURE", "LITERATURE_IN_ENGLISH", "LIT_IN_ENGLISH"],
    masterySubject: "LITERACY",
    source: "WAEC WASSCE Literature-in-English syllabus (Drama, Prose, Poetry, Unseen/Appreciation) — waecsyllabus.com/download/ssce/LITERATURE IN ENGLISH.pdf",
    topics: [
      { id: "literature.drama", name: "Drama", examWeight: 0.28,
        keywords: ["drama", "play", "tragedy", "comedy", "act", "scene", "dialogue", "playwright", "stage", "protagonist"],
        strands: [M("LITERACY", "literature_study")] },
      { id: "literature.prose", name: "Prose", examWeight: 0.28,
        keywords: ["prose", "novel", "narrative", "character", "plot", "theme", "novella", "fiction", "setting"],
        strands: [M("LITERACY", "literature_study"), M("LITERACY", "critical_analysis")] },
      { id: "literature.poetry", name: "Poetry", examWeight: 0.24,
        keywords: ["poem", "poetry", "stanza", "verse", "imagery", "rhyme", "rhythm", "poet", "sonnet", "ode"],
        strands: [M("LITERACY", "literature_study"), M("LITERACY", "critical_analysis")] },
      { id: "literature.appreciation", name: "Literary Appreciation & Unseen", examWeight: 0.20,
        keywords: ["figure of speech", "metaphor", "simile", "unseen", "appreciation", "literary device", "personification", "irony", "symbolism", "diction"],
        strands: [M("LITERACY", "critical_analysis"), M("LITERACY", "literary_analysis")] },
    ],
  },

  // ── WAEC GEOGRAPHY ─────────────────────────────────────────────────────────
  // NOTE: No mastery strand exists for Geography (not a Subject-enum bucket).
  // Content CAN be tagged, but readiness cannot be computed until strands are added.
  // Documented as a gap in docs/curriculum/WAEC_SYLLABUS_MAP.md.
  {
    id: "waec_geography",
    name: "WAEC Geography",
    contentSubjects: ["GEOGRAPHY"],
    masterySubject: null,
    source: "WAEC WASSCE Geography syllabus (Physical, Human/Economic, Regional Geography incl. Liberia, Practical) — waecsyllabus.com/geography",
    topics: [
      { id: "geography.physical", name: "Physical Geography", examWeight: 0.30,
        keywords: ["landform", "rock", "weather", "climate", "vegetation", "soil", "denudation", "earth", "relief", "drainage", "erosion", "plate"],
        strands: [] },
      { id: "geography.human_economic", name: "Human & Economic Geography", examWeight: 0.30,
        keywords: ["population", "settlement", "agriculture", "industry", "trade", "transport", "resource", "mining", "migration", "urban"],
        strands: [] },
      { id: "geography.regional", name: "Regional Geography (West Africa & Liberia)", examWeight: 0.24,
        keywords: ["liberia", "west africa", "nigeria", "ghana", "sierra leone", "senegambia", "region", "africa"],
        strands: [] },
      { id: "geography.practical", name: "Practical Geography & Field Work", examWeight: 0.16,
        keywords: ["map reading", "map", "statistical", "fieldwork", "field work", "survey", "gis", "scale", "contour", "photograph"],
        strands: [] },
    ],
  },
];

// ── Lookups & helpers ─────────────────────────────────────────────────────────

const BY_ID = new Map<WaecSubjectId, WaecSubject>(WAEC_SUBJECTS.map((s) => [s.id, s]));

const CONTENT_SUBJECT_INDEX = new Map<string, WaecSubject>();
for (const s of WAEC_SUBJECTS) {
  for (const cs of s.contentSubjects) CONTENT_SUBJECT_INDEX.set(cs.toUpperCase(), s);
}

const TOPIC_INDEX = new Map<string, { subject: WaecSubject; topic: WaecTopic }>();
for (const s of WAEC_SUBJECTS) {
  for (const t of s.topics) TOPIC_INDEX.set(t.id, { subject: s, topic: t });
}

export function getWaecSubjects(): WaecSubject[] {
  return WAEC_SUBJECTS;
}

export function getWaecSubject(id: WaecSubjectId): WaecSubject | undefined {
  return BY_ID.get(id);
}

/** URL slug for a subject ("waec_physics" → "physics"). */
export function waecSlug(id: WaecSubjectId): string {
  return id.replace(/^waec_/, "");
}

/** Resolve a URL slug back to its WAEC subject ("physics" → waec_physics). */
export function waecSubjectFromSlug(slug: string): WaecSubject | undefined {
  return BY_ID.get(`waec_${slug}` as WaecSubjectId);
}

/** Map a free-form CurriculumContent.subject string to its WAEC subject, if any. */
export function contentSubjectToWaec(subject: string | null | undefined): WaecSubject | undefined {
  if (!subject) return undefined;
  return CONTENT_SUBJECT_INDEX.get(subject.trim().toUpperCase());
}

export function getTopic(topicId: string): WaecTopic | undefined {
  return TOPIC_INDEX.get(topicId)?.topic;
}

export function getWaecSubjectForTopic(topicId: string): WaecSubject | undefined {
  return TOPIC_INDEX.get(topicId)?.subject;
}

/** Whether a topic id is known in the current syllabus map. */
export function isKnownTopic(topicId: string): boolean {
  return TOPIC_INDEX.has(topicId);
}

/** All distinct mastery strands that feed a WAEC subject's readiness (dedup). */
export function subjectStrandRefs(id: WaecSubjectId): MasteryStrandRef[] {
  const s = BY_ID.get(id);
  if (!s) return [];
  const seen = new Set<string>();
  const out: MasteryStrandRef[] = [];
  for (const t of s.topics) {
    for (const r of t.strands) {
      const k = `${r.subject}:${r.strandKey}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push(r);
      }
    }
  }
  return out;
}

/**
 * Deterministic keyword tagging: scan lesson subject + title + text and return the
 * matching topic ids for the given content subject's WAEC subject. Returns [] if the
 * content subject is not a WAEC subject. A topic matches when any keyword is a
 * substring of the normalised haystack.
 */
export function deterministicTopics(params: {
  contentSubject: string;
  title?: string | null;
  text?: string | null;
}): string[] {
  const subject = contentSubjectToWaec(params.contentSubject);
  if (!subject) return [];
  const haystack = `${params.title ?? ""}\n${params.text ?? ""}`.toLowerCase();
  const matched: string[] = [];
  for (const topic of subject.topics) {
    if (topic.keywords.some((kw) => haystack.includes(kw))) {
      matched.push(topic.id);
    }
  }
  return matched;
}

/**
 * Ordered, de-duplicated mastery strand candidates for a lesson, restricted to the
 * content's WAEC subject mastery bucket. Prefers already-persisted waecTopics, then
 * deterministic keyword topics, then (for a WAEC subject with no topic match) all of the
 * subject's strands. Ordered by topic exam weight (highest first) so the most exam-relevant
 * strand is tried first. Returns [] when the content subject is not a WAEC subject or has
 * no mastery strands (e.g. Geography). Pure — validate existence against StrandCatalog at
 * the call site.
 */
export function masteryStrandCandidates(params: {
  contentSubject: string;
  title?: string | null;
  text?: string | null;
  waecTopics?: string[] | null;
}): MasteryStrandRef[] {
  const subject = contentSubjectToWaec(params.contentSubject);
  if (!subject || subject.masterySubject === null) return [];

  const known = (params.waecTopics ?? []).filter((t) => TOPIC_INDEX.get(t)?.subject.id === subject.id);
  let topicIds = known.length
    ? known
    : deterministicTopics({ contentSubject: params.contentSubject, title: params.title, text: params.text });

  // No topic match → consider every topic in the subject (so we still land on a real strand).
  const topics = (topicIds.length ? topicIds.map((id) => TOPIC_INDEX.get(id)!.topic) : subject.topics)
    .slice()
    .sort((a, b) => b.examWeight - a.examWeight);

  const seen = new Set<string>();
  const out: MasteryStrandRef[] = [];
  for (const topic of topics) {
    for (const r of topic.strands) {
      const k = `${r.subject}:${r.strandKey}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push(r);
      }
    }
  }
  return out;
}
