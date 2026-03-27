import { readFile } from "fs/promises";
import path from "path";

export type PolicySourceDefinition = {
  sourceId: string;
  sourceLabel: string;
  relativePath: string;
  subject?: string | null;
  grade?: number | null;
};

const POLICY_SOURCES: PolicySourceDefinition[] = [
  {
    sourceId: "moe-briefing-package",
    sourceLabel: "MOE Briefing Package",
    relativePath: "docs/rollout/MOE_BRIEFING_PACKAGE.md",
  },
  {
    sourceId: "governance-data-governance",
    sourceLabel: "Data Governance",
    relativePath: "docs/governance/DATA_GOVERNANCE.md",
  },
  {
    sourceId: "governance-security-model",
    sourceLabel: "Security Model",
    relativePath: "docs/governance/SECURITY_MODEL.md",
  },
  {
    sourceId: "adr-moe-governance-controls",
    sourceLabel: "ADR 0008 MOE Governance Controls",
    relativePath: "docs/adr/0008-moe-governance-controls.md",
  },
  {
    sourceId: "adr-ai-stabilization-policy",
    sourceLabel: "ADR 0012 AI Stabilization Policy",
    relativePath: "docs/adr/0012-ai-stabilization-policy.md",
  },
];

export function listPolicySources(): PolicySourceDefinition[] {
  return POLICY_SOURCES;
}

export async function loadPolicySourceText(relativePath: string): Promise<string> {
  const filePath = path.join(process.cwd(), relativePath);
  return readFile(filePath, "utf8");
}
