/**
 * Strand Catalog Seed — Block 7A: Mastery Engine Foundation
 *
 * Seeds the StrandCatalog table with the Liberia-aligned strand taxonomy for:
 *   MATH, SCIENCE, ENGINEERING, COMPUTER_SCIENCE, LITERACY (English), CIVICS
 *
 * Design principles:
 * - Idempotent: uses upsert with (subject, strandKey) as the natural key.
 * - Additive: never deletes existing rows; sets isActive to control visibility.
 * - WAEC refs only appear for G10-12 strands (WASSCE alignment).
 * - strandKey uses snake_case and is stable (safe to reference in profiles/tags).
 *
 * Run via: ts-node prisma/seed.ts (called automatically from main seed)
 */

import { PrismaClient, GradeBand, Subject } from "@prisma/client";

const prisma = new PrismaClient();

type StrandSeed = {
  subject: Subject;
  strandKey: string;
  name: string;
  gradeBand: GradeBand;
  waecRef?: string;
};

const STRANDS: StrandSeed[] = [
  // ── MATH ──────────────────────────────────────────────────────────────────
  // G1–3
  { subject: "MATH", strandKey: "number_sense",       name: "Number Sense & Place Value",       gradeBand: "G1_3" },
  { subject: "MATH", strandKey: "basic_operations",   name: "Basic Operations (+−×÷)",          gradeBand: "G1_3" },
  { subject: "MATH", strandKey: "shapes_geometry",    name: "Shapes & Basic Geometry",          gradeBand: "G1_3" },
  { subject: "MATH", strandKey: "measurement_basics", name: "Measurement & Units",              gradeBand: "G1_3" },
  { subject: "MATH", strandKey: "patterns",           name: "Patterns & Relationships",         gradeBand: "G1_3" },
  // G4–6
  { subject: "MATH", strandKey: "fractions_decimals", name: "Fractions & Decimals",             gradeBand: "G4_6" },
  { subject: "MATH", strandKey: "multi_digit_ops",    name: "Multi-Digit Operations",           gradeBand: "G4_6" },
  { subject: "MATH", strandKey: "area_perimeter",     name: "Area, Perimeter & Volume",         gradeBand: "G4_6" },
  { subject: "MATH", strandKey: "data_graphs",        name: "Data Handling & Graphs",           gradeBand: "G4_6" },
  { subject: "MATH", strandKey: "ratios_rates",       name: "Ratios & Rates",                   gradeBand: "G4_6" },
  // G7–9
  { subject: "MATH", strandKey: "algebra_basics",     name: "Algebra Fundamentals",             gradeBand: "G7_9" },
  { subject: "MATH", strandKey: "proportional",       name: "Proportional Reasoning",           gradeBand: "G7_9" },
  { subject: "MATH", strandKey: "geometry_proofs",    name: "Geometry & Proof",                 gradeBand: "G7_9" },
  { subject: "MATH", strandKey: "statistics_prob",    name: "Statistics & Probability",         gradeBand: "G7_9" },
  { subject: "MATH", strandKey: "expressions_eqs",    name: "Expressions & Equations",          gradeBand: "G7_9" },
  // G10–12 (WAEC WASSCE aligned)
  { subject: "MATH", strandKey: "advanced_algebra",   name: "Advanced Algebra & Functions",     gradeBand: "G10_12", waecRef: "WASSCE-MATH-A1" },
  { subject: "MATH", strandKey: "trigonometry",       name: "Trigonometry",                     gradeBand: "G10_12", waecRef: "WASSCE-MATH-A2" },
  { subject: "MATH", strandKey: "calculus_intro",     name: "Introductory Calculus",            gradeBand: "G10_12", waecRef: "WASSCE-MATH-A3" },
  { subject: "MATH", strandKey: "functions_modeling", name: "Functions & Mathematical Modeling", gradeBand: "G10_12", waecRef: "WASSCE-MATH-A4" },
  { subject: "MATH", strandKey: "combinatorics",      name: "Combinatorics & Probability",      gradeBand: "G10_12", waecRef: "WASSCE-MATH-A5" },

  // ── SCIENCE ───────────────────────────────────────────────────────────────
  // G1–3
  { subject: "SCIENCE", strandKey: "living_nonliving",  name: "Living & Non-Living Things",       gradeBand: "G1_3" },
  { subject: "SCIENCE", strandKey: "plants_animals",    name: "Plants & Animals",                 gradeBand: "G1_3" },
  { subject: "SCIENCE", strandKey: "earth_materials",   name: "Earth Materials & Rocks",          gradeBand: "G1_3" },
  { subject: "SCIENCE", strandKey: "weather_patterns",  name: "Weather & Seasons",                gradeBand: "G1_3" },
  { subject: "SCIENCE", strandKey: "simple_machines",   name: "Simple Machines & Forces",         gradeBand: "G1_3" },
  // G4–6
  { subject: "SCIENCE", strandKey: "ecosystems",        name: "Ecosystems & Food Chains",         gradeBand: "G4_6" },
  { subject: "SCIENCE", strandKey: "matter_properties", name: "Matter & Its Properties",          gradeBand: "G4_6" },
  { subject: "SCIENCE", strandKey: "forces_motion",     name: "Forces & Motion",                  gradeBand: "G4_6" },
  { subject: "SCIENCE", strandKey: "earth_systems",     name: "Earth Systems & Resources",        gradeBand: "G4_6" },
  { subject: "SCIENCE", strandKey: "human_body",        name: "Human Body Systems",               gradeBand: "G4_6" },
  // G7–9
  { subject: "SCIENCE", strandKey: "cells_biology",     name: "Cell Biology",                     gradeBand: "G7_9" },
  { subject: "SCIENCE", strandKey: "chemistry_basics",  name: "Chemistry Fundamentals",           gradeBand: "G7_9" },
  { subject: "SCIENCE", strandKey: "physics_energy",    name: "Physics: Energy & Waves",          gradeBand: "G7_9" },
  { subject: "SCIENCE", strandKey: "env_science",       name: "Environmental Science",            gradeBand: "G7_9" },
  { subject: "SCIENCE", strandKey: "genetics_intro",    name: "Introduction to Genetics",         gradeBand: "G7_9" },
  // G10–12
  { subject: "SCIENCE", strandKey: "advanced_biology",  name: "Advanced Biology",                 gradeBand: "G10_12", waecRef: "WASSCE-BIO-A1" },
  { subject: "SCIENCE", strandKey: "organic_chemistry", name: "Organic Chemistry",                gradeBand: "G10_12", waecRef: "WASSCE-CHEM-A1" },
  { subject: "SCIENCE", strandKey: "physics_mechanics", name: "Physics: Mechanics & Electricity", gradeBand: "G10_12", waecRef: "WASSCE-PHY-A1" },
  { subject: "SCIENCE", strandKey: "ecology_advanced",  name: "Advanced Ecology & Conservation",  gradeBand: "G10_12", waecRef: "WASSCE-BIO-A2" },
  { subject: "SCIENCE", strandKey: "scientific_method", name: "Scientific Method & Research",     gradeBand: "G10_12", waecRef: "WASSCE-GEN-SCI" },

  // ── ENGINEERING ───────────────────────────────────────────────────────────
  // G1–3
  { subject: "ENGINEERING", strandKey: "building_structures",  name: "Building & Structures",        gradeBand: "G1_3" },
  { subject: "ENGINEERING", strandKey: "design_process_basic", name: "Design Process Basics",        gradeBand: "G1_3" },
  { subject: "ENGINEERING", strandKey: "materials_selection",  name: "Materials & Their Uses",       gradeBand: "G1_3" },
  { subject: "ENGINEERING", strandKey: "problem_solving_eng",  name: "Problem Solving & Making",     gradeBand: "G1_3" },
  // G4–6
  { subject: "ENGINEERING", strandKey: "simple_circuits",      name: "Simple Circuits & Electricity", gradeBand: "G4_6" },
  { subject: "ENGINEERING", strandKey: "mechanical_systems",   name: "Mechanical Systems & Machines", gradeBand: "G4_6" },
  { subject: "ENGINEERING", strandKey: "engineering_design",   name: "Engineering Design Process",   gradeBand: "G4_6" },
  { subject: "ENGINEERING", strandKey: "structural_analysis",  name: "Structural Analysis & Load",   gradeBand: "G4_6" },
  // G7–9
  { subject: "ENGINEERING", strandKey: "electrical_systems",   name: "Electrical Systems & Circuits", gradeBand: "G7_9" },
  { subject: "ENGINEERING", strandKey: "programming_logic",    name: "Programming Logic & Control",  gradeBand: "G7_9" },
  { subject: "ENGINEERING", strandKey: "engineering_math",     name: "Engineering Mathematics",      gradeBand: "G7_9" },
  { subject: "ENGINEERING", strandKey: "systems_thinking",     name: "Systems Thinking & Design",    gradeBand: "G7_9" },
  // G10–12
  { subject: "ENGINEERING", strandKey: "electronics_advanced", name: "Advanced Electronics",         gradeBand: "G10_12" },
  { subject: "ENGINEERING", strandKey: "software_eng_basics",  name: "Software Engineering Basics",  gradeBand: "G10_12" },
  { subject: "ENGINEERING", strandKey: "project_management",   name: "Engineering Project Management", gradeBand: "G10_12" },
  { subject: "ENGINEERING", strandKey: "professional_eng",     name: "Professional Engineering Practice", gradeBand: "G10_12" },

  // ── COMPUTER SCIENCE ──────────────────────────────────────────────────────
  // G1–3
  { subject: "COMPUTER_SCIENCE", strandKey: "digital_literacy",    name: "Digital Literacy & Devices",    gradeBand: "G1_3" },
  { subject: "COMPUTER_SCIENCE", strandKey: "input_output",        name: "Input, Output & Storage",       gradeBand: "G1_3" },
  { subject: "COMPUTER_SCIENCE", strandKey: "sequencing",          name: "Sequencing & Instructions",     gradeBand: "G1_3" },
  { subject: "COMPUTER_SCIENCE", strandKey: "patterns_algorithms", name: "Patterns & Simple Algorithms",  gradeBand: "G1_3" },
  // G4–6
  { subject: "COMPUTER_SCIENCE", strandKey: "programming_basics",   name: "Programming Fundamentals",     gradeBand: "G4_6" },
  { subject: "COMPUTER_SCIENCE", strandKey: "data_representation",  name: "Data Representation",          gradeBand: "G4_6" },
  { subject: "COMPUTER_SCIENCE", strandKey: "internet_safety",      name: "Internet Safety & Ethics",     gradeBand: "G4_6" },
  { subject: "COMPUTER_SCIENCE", strandKey: "comp_thinking",        name: "Computational Thinking",       gradeBand: "G4_6" },
  // G7–9
  { subject: "COMPUTER_SCIENCE", strandKey: "programming_intermed", name: "Intermediate Programming",     gradeBand: "G7_9" },
  { subject: "COMPUTER_SCIENCE", strandKey: "data_structures",      name: "Data Structures",              gradeBand: "G7_9" },
  { subject: "COMPUTER_SCIENCE", strandKey: "networking_basics",    name: "Networking Fundamentals",      gradeBand: "G7_9" },
  { subject: "COMPUTER_SCIENCE", strandKey: "cybersecurity",        name: "Cybersecurity Principles",     gradeBand: "G7_9" },
  // G10–12
  { subject: "COMPUTER_SCIENCE", strandKey: "algorithms_advanced",  name: "Advanced Algorithms & Complexity", gradeBand: "G10_12" },
  { subject: "COMPUTER_SCIENCE", strandKey: "databases",            name: "Databases & Data Management",  gradeBand: "G10_12" },
  { subject: "COMPUTER_SCIENCE", strandKey: "software_development", name: "Software Development Lifecycle", gradeBand: "G10_12" },
  { subject: "COMPUTER_SCIENCE", strandKey: "ai_ml_intro",          name: "Introduction to AI & Machine Learning", gradeBand: "G10_12" },

  // ── LITERACY (English) ────────────────────────────────────────────────────
  // G1–3
  { subject: "LITERACY", strandKey: "phonics_decoding",      name: "Phonics & Decoding",              gradeBand: "G1_3" },
  { subject: "LITERACY", strandKey: "sight_words",           name: "Sight Words & Fluency",           gradeBand: "G1_3" },
  { subject: "LITERACY", strandKey: "reading_comp_basic",    name: "Basic Reading Comprehension",     gradeBand: "G1_3" },
  { subject: "LITERACY", strandKey: "narrative_writing",     name: "Narrative Writing",               gradeBand: "G1_3" },
  { subject: "LITERACY", strandKey: "oral_language",         name: "Oral Language & Listening",       gradeBand: "G1_3" },
  // G4–6
  { subject: "LITERACY", strandKey: "vocabulary_context",    name: "Vocabulary in Context",           gradeBand: "G4_6" },
  { subject: "LITERACY", strandKey: "reading_comp_intermed", name: "Intermediate Reading Comprehension", gradeBand: "G4_6" },
  { subject: "LITERACY", strandKey: "expository_writing",    name: "Expository Writing",              gradeBand: "G4_6" },
  { subject: "LITERACY", strandKey: "grammar_mechanics",     name: "Grammar & Writing Mechanics",     gradeBand: "G4_6" },
  { subject: "LITERACY", strandKey: "literary_elements",     name: "Literary Elements & Analysis",    gradeBand: "G4_6" },
  // G7–9
  { subject: "LITERACY", strandKey: "literary_analysis",     name: "Literary Analysis",               gradeBand: "G7_9" },
  { subject: "LITERACY", strandKey: "argumentative_writing", name: "Argumentative Writing",           gradeBand: "G7_9" },
  { subject: "LITERACY", strandKey: "research_skills",       name: "Research & Evidence Skills",      gradeBand: "G7_9" },
  { subject: "LITERACY", strandKey: "grammar_advanced",      name: "Advanced Grammar & Style",        gradeBand: "G7_9" },
  { subject: "LITERACY", strandKey: "speaking_listening",    name: "Speaking & Listening",            gradeBand: "G7_9" },
  // G10–12
  { subject: "LITERACY", strandKey: "critical_analysis",     name: "Critical Analysis of Texts",      gradeBand: "G10_12", waecRef: "WASSCE-ENG-A1" },
  { subject: "LITERACY", strandKey: "academic_writing",      name: "Academic & Formal Writing",       gradeBand: "G10_12", waecRef: "WASSCE-ENG-A2" },
  { subject: "LITERACY", strandKey: "rhetoric_persuasion",   name: "Rhetoric & Persuasive Writing",   gradeBand: "G10_12", waecRef: "WASSCE-ENG-A3" },
  { subject: "LITERACY", strandKey: "literature_study",      name: "Literature Study & Criticism",    gradeBand: "G10_12", waecRef: "WASSCE-ENG-A4" },
  { subject: "LITERACY", strandKey: "career_communication",  name: "Career & Professional Communication", gradeBand: "G10_12", waecRef: "WASSCE-ENG-A5" },

  // ── CIVICS ────────────────────────────────────────────────────────────────
  // Added: ACTION-1 — MOE Standards Coverage remediation (GAP-1)
  // Resolves: CIVICS had 6 MOE codes but 0 StrandCatalog entries, breaking
  // the mastery tracking and intervention path for all Civics standards.
  // G1–3
  { subject: "CIVICS", strandKey: "national_identity",       name: "National Identity & Symbols",          gradeBand: "G1_3" },
  // G4–6
  { subject: "CIVICS", strandKey: "government_basics",       name: "Structure of Government",              gradeBand: "G4_6" },
  { subject: "CIVICS", strandKey: "rights_responsibilities", name: "Rights & Civic Duties",               gradeBand: "G4_6" },
  // G7–9
  { subject: "CIVICS", strandKey: "liberian_history",        name: "Liberian History",                     gradeBand: "G7_9" },
  { subject: "CIVICS", strandKey: "constitutional_law",      name: "Constitutional Government",            gradeBand: "G7_9" },
  // G10–12
  { subject: "CIVICS", strandKey: "international_relations", name: "International Relations & Global Bodies", gradeBand: "G10_12" },
];

/**
 * Seeds StrandCatalog rows idempotently.
 * Returns the count of strands created or confirmed.
 */
export async function seedStrandCatalog(): Promise<number> {
  console.log(`  Seeding ${STRANDS.length} strand catalog entries...`);

  let count = 0;
  for (const strand of STRANDS) {
    await prisma.strandCatalog.upsert({
      where: {
        StrandCatalog_subject_strandKey_key: {
          subject: strand.subject,
          strandKey: strand.strandKey,
        },
      },
      update: {
        name: strand.name,
        gradeBand: strand.gradeBand,
        waecRef: strand.waecRef ?? null,
        isActive: true,
      },
      create: {
        subject: strand.subject,
        strandKey: strand.strandKey,
        name: strand.name,
        gradeBand: strand.gradeBand,
        waecRef: strand.waecRef ?? null,
        isActive: true,
      },
    });
    count++;
  }

  console.log(`  ✓ StrandCatalog: ${count} strands upserted.`);
  return count;
}
