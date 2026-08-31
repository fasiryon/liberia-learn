# P7-A Governed Measurement Foundation

## Authority

`lib/measurement/governedMeasurement.ts` is the canonical P7-A event and metric registry. `docs/EVENT_TAXONOMY.md` remains a historical inventory of legacy `LearningEvent` families. A dashboard, report, SQL expression, or metric event is not product authority unless it names a P7-A metric ID and version.

## Event contract and evolution

Every governed event uses the `governed.*` namespace and schema version 1. It includes a stable `eventId`, `schoolId`, event time, actor type, source classification, and metadata validated against the one registry. Replayable events also carry `operationId` or `sourceEventId`; ingestion deduplicates on that identity before `eventId`. Event time represents the learner action, server decision, or human review shown in the registry. Receipt time may be retained operationally but never replaces trustworthy event time in a metric window.

Version 1 is accepted explicitly. A breaking semantic change requires a new version and consumer support. Unknown names, unsupported versions, missing required metadata, and invalid envelopes are quarantined with a reason and never enter a governed metric. Telemetry validation is non-transactional: it must not fail a learner action. An adapter must expose quarantine counts/reasons through the existing operational telemetry path.

## Privacy, cohorts, and synthetic data

The only P7-A cohort dimensions are existing tenant-safe dimensions: school, district or county where authorized, class, grade, subject, academic term, content version, teacher, and delivery mode. Learner identifiers are only join keys during calculation; aggregate outputs use the declared grain. School-scoped consumers must supply one school ID. Cross-school and national aggregation require an explicitly privileged consumer and must not expose learner drilldown.

`syntheticSource` is mandatory and has the closed values `production`, `seed`, `fixture`, `demo`, `e2e`, `load_test`, `sandbox`, and `internal_qa`. Only `production` contributes to every governed metric. This is enforced in the shared calculator, not by dashboard filters. Event metadata must not contain learner free text, safeguarding content, prompts, responses, or direct identifiers beyond approved join keys.

## Metric authority

The registry defines version, owner, source events, numerator, denominator, eligibility, window, missing-data policy, synthetic exclusion, grain, unit, directionality, and caveat for learning dosage, retention, mastery movement, teacher adoption, workflow completion, tutor helpfulness, AI grounding, hallucination, and safety decisions.

Missing data is excluded and reported as unknown unless the metric explicitly says otherwise. It is never silently changed to zero. Offline delayed events use their trustworthy `occurredAt`; duplicate replay cannot inflate a metric. Results carry metric version, input event schema versions, window, tenant scope, excluded synthetic count, and missing-data count as provenance.

## Consumer rule and P7-B handoff

Legacy analytics summaries are descriptive projections, not governed P7-A authority. New quality gates, experiment analysis, and rollout-readiness consumers must call the registry calculator or an equivalent adapter that preserves this exact metadata. P7-B can add assignment and exposure events as new versioned entries without altering the P7-A metric definitions.
