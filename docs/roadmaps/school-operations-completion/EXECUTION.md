# LiberiaLearn — School Operations Completion

## Objective
Close every operational gap between LiberiaLearn as a
production platform and LiberiaLearn as a real school
operating system.

A real school can open at 8:30 AM, enroll users, run
classes, assign work, track progress, notify guardians,
support teachers, report to administrators, and surface
MOE-level visibility without founder intervention.

## Branch
feat/school-operations-completion

## Execution Rules
1. Run phases sequentially — never in parallel
2. Use one fresh agent session per phase
3. Commit after each successful phase gate
4. Do not skip gates
5. Do not claim completion unless all gates pass
6. Inspect existing code before writing anything
7. Do not duplicate systems that already exist
8. Preserve backward compatibility at all times
9. Update CURRENT_EXECUTION_STATE.md after every phase

## Required Reading Before Every Phase
- docs/roadmaps/school-operations-completion/CURRENT_EXECUTION_STATE.md
- docs/roadmaps/school-operations-completion/AGENT.md
- docs/SYSTEM_COMPLETE_SIGNOFF.md

## Phase Order
1. Academic Year + Grade Promotion
2. Safe Multi-School Import System
3. Real Timetable / Bell Schedule
4. Classroom Assignment Updates
5. Full-Year Curriculum Organization
6. Missing Content Generation (dry_run + approval first)
7. Day-1 School Operations Simulation Gate

## Critical Risks

### student.gradeLevel Compatibility
This field is used in: student dashboard, curriculum
queries, adaptive recommendations, MOE analytics,
teacher views, and intervention logic.
StudentEnrollment becomes the long-term source of truth
but student.gradeLevel MUST remain readable everywhere
it is currently used. Never break existing reads.

### Import System
The CSV import, sample template, and validation already
exist. Extend them. Do not rebuild from scratch.
app/admin/students/import/page.tsx already has format
documentation. Add to it, do not replace it.

### Timetable Migration
Timetable, TimetableSlot, TimetableAssignment are all
new models. This is the largest schema addition in this
sprint. Migration must be named, clean, and reversible.
Existing ScheduledWork must continue to work unchanged.

### Classroom Updates
Use 30-second polling + manual refresh button only.
NEVER use Supabase Realtime, WebSockets, Pusher, or Ably.
The codebase has not been tested with WebSocket
connections. Polling is reliable and safe here.

### Curriculum Organization
Phase 5 is a MAPPING operation, not a generation
operation. Map the 3,405 existing approved lessons into
units and weeks. Do not regenerate content that exists.

### Content Generation Safety
Phase 6 requires: audit → dry_run → cost estimate →
human approval → real generation. Never skip this order.
Never auto-approve generated content. All new content
starts as DRAFT or NEEDS_REVIEW status.

### Day-1 Simulation
Do not claim PASS unless a real non-technical user could
complete the step without founder help.

## Final Success Definition
- Students can progress Grade 1 through Grade 12
- Admins can safely import real users with preview
- Students see a real daily timetable at 8:30 AM
- Teachers can assign work during class
- Students can submit work
- Teachers can review submissions with student context
- Guardians can see child progress and message teacher
- Admins can monitor all school operations
- MOE sees aggregate activity without student PII
- Curriculum is organized by year, unit, week, lesson
- Day-1 Simulation Gate passes all 10 gates
