import { provisionAIReviewAgents } from "../lib/curriculum/review/aiReview";
async function main() {
  const agents = await provisionAIReviewAgents({ enable: true });
  console.log(JSON.stringify(agents.map((agent) => ({ agentKey: agent.agentKey, specialty: agent.specialty, enabled: agent.enabled, promptHash: agent.promptHash }))));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
