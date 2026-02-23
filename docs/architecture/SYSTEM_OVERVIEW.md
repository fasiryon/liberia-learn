# System Overview

## What LiberiaLearn Is
LiberiaLearn is a multi-tenant, offline-first education platform with role-based experiences:
- Admin: school configuration, reporting, compliance controls
- Teacher: lesson planning, assignment creation, grading, messaging
- Student: daily learning, submissions, mastery progression
- Guardian: communication channel via SMS and (optional) app access

## Core Systems
- Authentication and session management
- Tenant isolation and access control
- Offline sync engine with deterministic conflict resolution
- Messaging and notification orchestration (SMS-first)
- Metrics, audit logging, health checks
- AI curriculum and instruction engine (explainable + teacher override)
- Governance and compliance reporting

## Non-Functional Requirements
- Secure by default
- Observable (logs/metrics/traces)
- Reliable under load and degraded connectivity
- Accessible and usable in low digital literacy contexts
- Versioned, auditable, and rollback-friendly

## “National-Grade” Definition
National-grade means:
- abuse-resistant
- explainable AI
- data export + deletion
- incident response readiness
- feature flags / kill switches for safety