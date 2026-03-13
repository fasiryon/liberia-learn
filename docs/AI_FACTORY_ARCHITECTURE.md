# LiberiaLearn AI Factory Architecture

## Overview
LiberiaLearn AI Factory exists to close curriculum delivery gaps across Liberian schools by turning standards, objectives, and classroom context into usable lesson artifacts at national scale. It combines structured curriculum generation, review controls, retrieval-grounded tutoring, unit assembly, and textbook compilation so schools can move from standards coverage gaps to teacher-ready instructional materials without abandoning human oversight.

## Pipeline Stages

### Stage 0 Education Work Order (EWO)
An Education Work Order is the structured request that starts curriculum generation. It is triggered by an admin, platform operator, or teacher workflow and carries the subject, grade, topic or objective, optional MOE alignment codes, school scope, and generation mode. The EWO is the contract between product workflows and the AI factory.

### Stage 1 Curriculum Architecture
Input: EWO metadata plus grade, subject, and standards context.
Process: the system shapes the request into a constrained curriculum-generation prompt and asks the routed model tier for structured JSON.
Output: a lesson architecture containing title, objectives, lesson body, activities, metadata, and MOE-alignment references suitable for validation and downstream storage.

### Stage 2 Lesson Generation
Input: EWO plus curriculum architecture and local context.
Process: `routedCompletion()` generates grade-appropriate lesson content with Liberian classroom framing, including local examples, vocabulary tone control, and delivery guidance when enabled.
Output: a `CurriculumContent` artifact that can be stored, reviewed, scheduled, embedded, grouped into units, or published for students.

### Stage 3 Assessment Generation
Input: lesson or unit topic, standards context, and grade.
Process: the factory generates or composes assessment questions, answer keys, and evaluation criteria using the existing curriculum helper pipeline and routed AI where needed.
Output: assessment artifacts with question sets, rubric structure, answer keys, and mastery checks.

### Stage 4 Tutor Metadata
Input: approved lesson artifacts.
Process: tutor-facing metadata is derived from stored content, including lesson structure, assessment prompts, answer keys, likely misconceptions, and scaffolded response framing for student support.
Output: grounded tutor context that supports grade-sensitive explanations and graceful fallback when no lesson context exists.

### Stage 5 Governance Validation
Input: generated lesson or assessment artifact.
Process: the platform checks for standards alignment, schema validity, approval status, and school workflow rules before promoting content.
Output: artifacts that either pass into approved or published states, fail validation, or are flagged for human review and correction.

### Stage 6 Artifact Promotion
Draft, review, and gold-state promotion are controlled by human actors.
Teachers can generate and edit classroom artifacts, admins can assemble and publish school-scoped materials, and platform operators can inspect system-wide outputs. Promotion authority stays with people, not autonomous background jobs.

## RAG Tutor Layer (new)
The RAG tutor grounds student answers in stored lesson artifacts instead of relying only on general model knowledge. Lesson text is embedded with `text-embedding-3-small`, stored in pgvector-backed `CurriculumContent.embedding`, and searched with cosine similarity. Retrieval is scoped by student grade and subject context before lesson text is injected into the tutor system prompt. If no embeddings or matching lessons exist, the tutor falls back gracefully to the standard non-RAG path.

## Unit Assembly Layer (new)
Unit assembly uses `CurriculumUnit` as the grouping model and organizes lessons into a 7-part structure: intro, three core lessons, practice, review, and assessment. The assembler first reuses existing approved or published lessons for the subject and grade, then generates only missing lesson types through `routedCompletion()` with `forceSmartTier: true`. Each linked lesson receives `orderInUnit` and `lessonType` metadata for scheduling, retrieval, and textbook compilation.

## Textbook Compiler (new)
The textbook compiler reads assembled `CurriculumUnit` records and their ordered lessons from the database, composes a structured textbook model, and renders it to a real PDF using `@react-pdf/renderer`. The PDF includes a cover page, table of contents, unit divider pages, lesson sections, numbered questions for practice and assessment content, answer keys, and a generated back cover statement.

## Teacher Co-Creation Flow (new)
Teachers can trigger AI lesson generation for their own classes, review the output, edit the lesson, and save it as draft or publish it to students. Teacher artifacts are stored as real `CurriculumContent` records with `teacherCreated=true`, audit logging, RBAC, and scheduling hooks. They differ from centrally generated factory artifacts because the teacher is the final editor and publication authority for the class-level workflow.

## Standards Coverage

| Subject | Strands / Active Coverage Window | MOE Codes / Source Coverage | Coverage % |
| --- | --- | --- | --- |
| CIVICS | Grades 6-8 generated content present | Real DB coverage in approved lessons | 100% of current generated window |
| ENGLISH | Grade 5 generated content present | Real DB coverage in published lesson set | 100% of current generated window |
| LITERACY | Grades 5-9 generated content present | Real DB coverage in approved lessons | 100% of current generated window |
| MATH | Grades 5-8 generated content present | Real DB coverage in approved and published lessons | 100% of current generated window |
| SCIENCE | Grades 5-8 generated content present | Real DB coverage in approved and published lessons | 100% of current generated window |

## Performance Characteristics
- Lesson generation time: typically 20-35 seconds through `routedCompletion()` on smart tier for a full lesson artifact.
- Unit assembly time: typically 90-150 seconds depending on how many of the 7 lesson slots already exist and how many new calls are required.
- Textbook compilation: typically 3-8 seconds when units are already stored and only PDF rendering is required.
- Embedding: typically about 1 second per lesson for `text-embedding-3-small`, excluding retry backoff.

## Governance Constraints
- AI output is advisory only until a human publishes or approves it.
- Teachers retain final authority over classroom-level co-created materials.
- No autonomous data mutation is allowed outside explicit workflow actions and logged persistence steps.
- All generation, publishing, unit assembly, and textbook compilation actions are audit logged.
