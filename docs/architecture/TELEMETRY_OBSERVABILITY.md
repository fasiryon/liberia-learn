# Telemetry & Observability

## Mandatory Signals
- Structured logs (request + tenant + user role + route)
- Metrics (error rates, latency, success rates)
- Traces (request -> DB -> dependencies)
- Audit logs (user actions affecting data)

## Education-Specific Metrics
- onboarding completion rate
- teacher workflow drop-offs (e.g., assignment creation)
- offline conflict rate
- SMS delivery + opt-out rate
- AI suggestion acceptance/override rate

## Definition of Done
A feature is incomplete if it ships without measurable signals and failure visibility.