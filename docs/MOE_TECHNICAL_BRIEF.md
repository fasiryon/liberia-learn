# LiberiaLearn Technical Brief for the Ministry of Education

## 1. What the system is

LiberiaLearn is one national software platform that supports classroom teaching, student learning, guardian follow-up, school operations, and ministry oversight. It is designed so the Ministry does not need separate systems for each of those jobs.

## 2. Who can use it

The platform has separate views for:

- students
- teachers
- guardians
- school administrators
- platform administrators
- ministry and district oversight users

Each group only sees the information they are allowed to see.

## 3. What schools can do with it

Schools can use the platform to:

- deliver lessons
- run placement tests
- assign and grade work
- track attendance and progress
- identify students who need support
- review school-level readiness and compliance

## 4. What the Ministry can see

The Ministry-facing surfaces are for oversight, not classroom micromanagement. They include:

- national and district dashboards
- curriculum health and standards coverage
- intervention impact summaries
- export tools for reporting
- governance and audit visibility

These views are built to support decision-making at district and national level.

## 5. How student data is protected

The platform separates schools from each other. A school administrator can only work inside the school they belong to. Platform-wide roles and Ministry roles are handled separately for broader oversight tasks.

The system also keeps an audit trail for sensitive actions, including administrative changes and export actions.

## 6. How artificial intelligence is controlled

Artificial intelligence is used in a controlled way. It is not allowed to operate as an unchecked decision-maker.

Current protections include:

- routed AI requests through a central service
- usage logging and cost tracking
- monthly and daily budget controls
- grounded responses tied to curriculum and approved materials
- teacher review on sensitive instructional workflows

## 7. How the platform handles weak connectivity

The system is designed with low-connectivity use in mind. Student learning flows include offline support and sync behavior for interrupted sessions. This matters for schools where internet access is slow, unstable, or expensive.

Recent mobile work also improved readability and touch targets for small low-cost Android devices.

## 8. How readiness is measured

The current platform includes:

- `1577` passing tests across `214` test files
- `189` route handlers
- `81` data models
- a curriculum audit with `1306/1306` lessons marked `READY`
- an average lesson length of `1450` words

This means the repository is already being measured as an operational system, not just a feature prototype.

## 9. What happens when something goes wrong

The repository includes:

- deployment runbooks
- worker deployment guidance
- incident response procedures
- rollback instructions
- environment separation between production, staging, demo, and development

This gives the Ministry a clearer path for operating the platform safely during pilots and larger rollout phases.

## 10. What the next step is

The next practical step is not rebuilding the product from scratch. The next step is reviewer readiness:

- present the architecture clearly
- expose the API surface clearly
- maintain governance and audit visibility
- continue controlled rollout with school and district feedback

Supporting technical references:

- [ARCHITECTURE_EXECUTIVE.md](C:/Users/fasir/liberia-learn/docs/ARCHITECTURE_EXECUTIVE.md)
- [API_REFERENCE.md](C:/Users/fasir/liberia-learn/docs/API_REFERENCE.md)
- [SCALE_READINESS.md](C:/Users/fasir/liberia-learn/docs/ops/SCALE_READINESS.md)
- [INCIDENT_RESPONSE.md](C:/Users/fasir/liberia-learn/docs/ops/INCIDENT_RESPONSE.md)
