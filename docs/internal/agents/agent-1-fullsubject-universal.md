# .\docs\internal\agents\agent-1-fullsubject-universal.md
# LiberiaLearn — Agent-1 Universal FULL_SUBJECT Prompt (Schema-Exact)
#
# COPY/PASTE THIS WHOLE FILE. DO NOT REMOVE ANY SECTION.
#
# Goal:
# - Generate ONE schema-valid FULL_SUBJECT curriculum JSON artifact.
# - Must validate against: unified-curriculum-schema.json (draft-07).
#
# HARD CONSTRAINTS (FAIL IF ANY VIOLATED):
# - Output MUST be STRICT valid JSON only (no markdown, no commentary).
# - Output MUST conform to unified-curriculum-schema.json exactly.
# - Output MUST include REQUIRED keys: metadata, educational_context, title, content_type.
# - content_type MUST be exactly "FULL_SUBJECT".
# - FULL_SUBJECT must include nested_content with 5–12 UNIT objects.
# - Each UNIT must include nested_content with LESSON objects (recommended 3–5).
# - Each LESSON must include (strongly recommended to avoid missing fields):
#   learning_objectives, activities, assessments, cultural_context, technical_metadata, ai_tutor_metadata, virtual_labs
#
# IMPORTANT COMPATIBILITY NOTES:
# - Your schema's educational_context.subject enums include: MATH, ENGLISH, SCIENCE, PHYSICS, CHEMISTRY, BIOLOGY,
#   COMPUTER_SCIENCE, ICT, HISTORY, CIVICS, GEOGRAPHY, ECONOMICS, BUSINESS_STUDIES, ARTS, CREATIVITY, PE, LITERACY
# - Your Prisma Subject enum is different (it does NOT include ENGLISH, ICT, etc).
#   For schema validation, ALWAYS output subject using the SCHEMA enum (above).
#   When storing to Prisma later, do mapping in code (not in the agent output).
#
# STEM VIRTUAL LAB RULE:
# - Schema does NOT enforce STEM-only, but LiberiaLearn policy requires:
#   For STEM subjects (MATH, SCIENCE, PHYSICS, CHEMISTRY, BIOLOGY, COMPUTER_SCIENCE, ICT):
#   Each LESSON MUST include virtual_labs with at least 1 virtual_lab object.
# - For non-STEM subjects:
#   virtual_labs MUST exist and can be [] (empty array).
#
# BLOOM ENUM (MUST MATCH EXACTLY):
# - "REMEMBER","UNDERSTAND","APPLY","ANALYZE","EVALUATE","CREATE"
#
# ACTIVITY.type ENUM (MUST MATCH EXACTLY):
# - "VISUAL","INTERACTIVE","PRACTICE","DISCUSSION","VIRTUAL_LAB","PROJECT","INQUIRY","READING","WRITING","PRESENTATION"
#
# INTERACTION_PATTERN ENUM (IF USED, MUST MATCH EXACTLY):
# - "individual","pair","small_group","whole_class"
#
# VIRTUAL_LAB.type ENUM (MUST MATCH EXACTLY):
# - "SIMULATION","GUIDED_EXPERIMENT","DATA_ANALYSIS","MODEL_BUILDING"
#
# VIRTUAL_LAB.implementation_level ENUM (MUST MATCH EXACTLY):
# - "text_guided","interactive_simulation","full_3d"
#
# ASSESSMENT.type ENUM (MUST MATCH EXACTLY):
# - "FORMATIVE","SUMMATIVE","DIAGNOSTIC","SELF_CHECK"
#
# ASSESSMENT.format ENUM (MUST MATCH EXACTLY IF PROVIDED):
# - "MCQ","SHORT_ANSWER","ESSAY","PROJECT","LAB_REPORT","CODE"
#
# QUESTION.type ENUM (MUST MATCH EXACTLY IF PROVIDED):
# - "MCQ","TRUE_FALSE","SHORT_ANSWER","ESSAY","CODE","MATCHING"
#
# DIFFICULTY ENUM (MUST MATCH EXACTLY IF PROVIDED):
# - "D1","D2","D3","D4","D5"
#
# METADATA.id PATTERN (MUST MATCH EXACTLY):
# - Must match: ^(LESSON|UNIT|TERM|SUBJECT)-[A-Z0-9]+$
#   Examples:
#   - "SUBJECT-MATHG05CORE01"
#   - "UNIT-MATHG05U01"
#   - "LESSON-MATHG05U01L01"
#   (No hyphens after the prefix other than the one after SUBJECT/UNIT/LESSON.)
#
# METADATA.version PATTERN:
# - Must match semantic version: "1.0.0"
#
# METADATA.status ENUM:
# - "draft","review","approved","published","archived"
#
# METADATA timestamps:
# - created_at and updated_at MUST be ISO 8601 date-time strings (e.g., "2026-01-08T09:00:00Z")
#
# ==================================================
# REQUIRED OBJECT SHAPES (SAFE DEFAULTS TO PASS AJV)
# ==================================================
#
# TOP-LEVEL FULL_SUBJECT JSON MUST LOOK LIKE:
# {
#   "metadata": {...},
#   "educational_context": {...},
#   "title": "...",
#   "description": "...",
#   "content_type": "FULL_SUBJECT",
#   "prerequisites": [...optional...],
#   "standards_alignment": {...optional...},
#   "nested_content": [ ...UNIT objects... ]
# }
#
# UNIT OBJECT (nested_content item) MUST LOOK LIKE:
# {
#   "metadata": {...},
#   "educational_context": {...},
#   "title": "...",
#   "description": "...",
#   "content_type": "UNIT",
#   "prerequisites": [...optional...],
#   "nested_content": [ ...LESSON objects... ]
# }
#
# LESSON OBJECT MUST LOOK LIKE:
# {
#   "metadata": {...},
#   "educational_context": {...},
#   "title": "...",
#   "description": "...",
#   "content_type": "LESSON",
#   "prerequisites": [...optional...],
#   "learning_objectives": [ ... ],
#   "activities": [ ... ],
#   "virtual_labs": [ ... ],
#   "assessments": [ ... ],
#   "projects": [ ...optional... ],
#   "cultural_context": { ... },
#   "technical_metadata": { ... },
#   "ai_tutor_metadata": { ... },
#   "lesson_plan": { ...optional... },
#   "parent_summary": "...optional..."
# }
#
# LEARNING OBJECTIVES RULES:
# - Each objective MUST include required:
#   id (string), statement (string), bloom_level (enum)
# - success_criteria is optional in schema, but recommended to include as array of strings
# - assessment_method is optional but recommended
#
# ACTIVITIES RULES:
# - Each activity MUST include required:
#   id, type, title, duration_minutes, offline_capable
# - Recommended to include: description, instructions, materials, interaction_pattern, differentiation
#
# ASSESSMENTS RULES:
# - Each assessment MUST include required: id, type, questions
# - Each question MUST include required: id, question, points
# - If you include question.type, it MUST be one of the schema's question.type enums
# - If you include difficulty, it MUST be D1..D5
# - For MCQ questions, include "options" and "correct_answer"
# - For SHORT_ANSWER/ESSAY/CODE, include "rubric" and set ai_gradable appropriately
#
# CULTURAL CONTEXT (recommended to fill all):
# - local_examples: array of Liberia-relevant examples (markets, LD$, counties, farming, transport)
# - language_notes: string (Liberian English clarity tips)
# - real_world_applications: array
# - community_connections: array
# - sensitive_topics: optional array of {topic, guidance}
#
# TECHNICAL METADATA (REQUIRED KEYS):
# - offline_capable (boolean)
# - estimated_storage_mb (number)
# Recommended:
# - sync_required: "none" | "optional" | "required"
# - media_formats: ["image","audio","video"] etc.
# - assets: array of {path,type,size_kb,format,alt_text}
#
# AI TUTOR METADATA (recommended):
# - hint_strategy MUST be one of:
#   "progressive","socratic","direct","example_based"
# - common_misconceptions: array of {misconception, correction}
# - prerequisite_check: array of strings
# - adaptive_parameters: { difficulty_adjustment: boolean, pacing_flexible: boolean }
#
# ==================================================
# QUALITY + PEDAGOGY REQUIREMENTS (LIBERIALEARN)
# ==================================================
# - Must be usable in Liberia (Liberian examples, LD$, local communities).
# - Global inspirations:
#   Singapore: mastery + worked examples + bar models (where relevant)
#   Finland: conceptual clarity + reflection
#   Japan: problem-solving + multiple strategies
# - Keep lessons practical, clear, and mastery-based.
#
# ==================================================
# INPUT VARIABLES (SUPPLIED BY THE SYSTEM / EWO)
# ==================================================
# grade: integer 1..12
# subject: one of schema subjects (see enum list above)
# cognitive_band: FOUNDATION | CORE | SPECIALIZATION
# term/week may be provided; if not, omit or set consistently
#
# ==================================================
# NOW DO THE TASK
# ==================================================
# Generate ONE FULL_SUBJECT JSON for:
# - educational_context.grade = {grade}
# - educational_context.subject = "{subject}"
# - educational_context.cognitive_band = "{cognitive_band}"
#
# OUTPUT JSON ONLY.
