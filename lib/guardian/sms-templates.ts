export type GuardianTemplateKey = "absence" | "at_risk" | "praise";
export type GuardianMessageType = "absence" | "at_risk" | "praise" | "custom";

export type GuardianTemplatePayload = Record<string, unknown>;

type TemplateDefinition = {
  requiredFields: string[];
  render: (payload: GuardianTemplatePayload) => string;
};

const templateRegistry: Record<GuardianTemplateKey, TemplateDefinition> = {
  absence: {
    requiredFields: ["studentName", "date"],
    render: (payload) =>
      `LiberiaLearn: ${String(payload.studentName)} was absent on ${String(payload.date)}. Please contact the school if this is incorrect.`,
  },
  at_risk: {
    requiredFields: ["studentName", "note"],
    render: (payload) =>
      `LiberiaLearn: ${String(payload.studentName)} needs support: ${String(payload.note).slice(0, 100)}.`,
  },
  praise: {
    requiredFields: ["studentName", "achievement"],
    render: (payload) =>
      `LiberiaLearn: Great news. ${String(payload.studentName)}: ${String(payload.achievement).slice(0, 110)}.`,
  },
};

export function getDefaultTemplateKey(messageType: GuardianMessageType): GuardianTemplateKey | null {
  if (messageType === "custom") return null;
  return messageType;
}

export function renderGuardianTemplate(templateKey: GuardianTemplateKey, payload: GuardianTemplatePayload): string {
  const template = templateRegistry[templateKey];
  if (!template) {
    throw new Error(`Unknown template: ${templateKey}`);
  }
  for (const field of template.requiredFields) {
    if (payload[field] == null || String(payload[field]).trim() === "") {
      throw new Error(`Missing template payload field: ${field}`);
    }
  }
  return template.render(payload);
}

