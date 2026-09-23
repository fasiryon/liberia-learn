// Legacy URL shares the governed decision-bound route. It cannot issue a
// diagnostic independently of the persisted LearningDecision.
// route-policy: auth=session; scope=tenant; authority=governed-learning-orchestrator; rationale=legacy URL delegates to the decision-bound route
export { dynamic, GET, POST } from "../next-action/route";
