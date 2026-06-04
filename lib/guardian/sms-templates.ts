export type GuardianTemplateKey =
  | "absence"
  | "at_risk"
  | "praise"
  | "weekly_digest"
  | "assignment_due"
  | "certificate_awarded";

export type GuardianMessageType =
  | "absence"
  | "at_risk"
  | "praise"
  | "weekly_digest"
  | "assignment_due"
  | "certificate_awarded"
  | "custom";

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
  weekly_digest: {
    requiredFields: ["studentName", "lessonsCompleted", "avgScore"],
    render: (payload) => {
      const base = `LiberiaLearn: ${String(payload.studentName)} finished ${String(payload.lessonsCompleted)} lesson(s) this week, ${String(payload.avgScore)}% avg.`;
      const tip = payload.actionTip
        ? ` ${String(payload.actionTip)}`
        : ` Keep it up!`;
      const stop = ` Reply STOP to opt out.`;
      return (base + tip + stop).slice(0, 160);
    },
  },
  assignment_due: {
    requiredFields: ["studentName", "subject", "dueDate"],
    render: (payload) =>
      `LiberiaLearn: Reminder — ${String(payload.studentName)} has a ${String(payload.subject)} assignment due on ${String(payload.dueDate)}. Please encourage them to complete it. Reply STOP to unsubscribe.`,
  },
  certificate_awarded: {
    requiredFields: ["studentName", "subject", "certificateCode"],
    render: (payload) =>
      `LiberiaLearn: Congratulations! ${String(payload.studentName)} earned a certificate in ${String(payload.subject)}. Certificate code: ${String(payload.certificateCode)}. Reply STOP to unsubscribe.`,
  },
};

export function getDefaultTemplateKey(messageType: GuardianMessageType): GuardianTemplateKey | null {
  if (messageType === "custom") return null;
  return messageType as GuardianTemplateKey;
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
