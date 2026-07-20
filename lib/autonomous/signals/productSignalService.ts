import { prisma } from "@/lib/db";
import { logLearningEvent, type LogLearningEventInput } from "@/lib/events/logLearningEvent";

export type ProductSignalCategory =
  | "report_card"
  | "assignment"
  | "attendance"
  | "lesson"
  | "ai_tutor"
  | "teacher_feedback"
  | "guardian"
  | "discussion"
  | "live_session"
  | "push_notification";

export const PRODUCT_SIGNAL_EVENT_TYPES: Record<ProductSignalCategory, string[]> = {
  report_card: ["report_card.generated", "report_card.published"],
  assignment: ["assignment.created", "assignment.submitted", "assignment.graded"],
  attendance: ["attendance.updated", "offline.sync.attendance.accepted"],
  lesson: ["lesson.started", "lesson.completed"],
  ai_tutor: ["ai.interaction"],
  teacher_feedback: ["teacher.feedback.created", "report_card.comment_updated", "assignment.graded"],
  guardian: ["guardian.report_card.viewed", "guardian.message.received"],
  discussion: ["discussion.thread.created", "discussion.post.created", "discussion.post.upvoted"],
  live_session: ["live_session.joined", "live_session.ended", "live_session.attendance_marked"],
  push_notification: ["push.notification.delivered", "push.notification.opened"],
};

const PII_KEY_PATTERN = /(name|email|phone|address|recipient|body|message|comment|feedback|content|answer|prompt|response)/i;
const SAFE_DERIVED_KEY_PATTERN = /(Length|Count|Band|Id|Ids|At|Status|Channel|Role|Path|Score)$/;

export function categoryForEventType(eventType: string): ProductSignalCategory | null {
  for (const [category, eventTypes] of Object.entries(PRODUCT_SIGNAL_EVENT_TYPES)) {
    if (eventTypes.includes(eventType)) return category as ProductSignalCategory;
  }
  return null;
}

function sanitizeMetadata(value: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (PII_KEY_PATTERN.test(key) && !SAFE_DERIVED_KEY_PATTERN.test(key)) continue;
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      result[key] = sanitizeMetadata(entry as Record<string, unknown>);
      continue;
    }
    if (typeof entry === "string" && entry.length > 160 && /\s/.test(entry)) continue;
    result[key] = entry;
  }
  return result;
}

export async function logProductSignal(input: LogLearningEventInput, options?: { throwOnError?: boolean }) {
  if (process.env.ENABLE_AUTONOMOUS_SIGNAL_INTEGRATION?.trim() === "false") return null;

  try {
    const learningEventModel = (prisma as any).learningEvent;
    if (!learningEventModel?.create) return null;
    if (input.dedupeKey && learningEventModel?.findFirst) {
      const existing = await learningEventModel.findFirst({
        where: {
          schoolId: input.schoolId ?? null,
          eventType: input.eventType,
          dedupeKey: input.dedupeKey,
        },
        select: { id: true },
      }).catch(() => null);
      if (existing) return existing;
    }

    const category = categoryForEventType(input.eventType);
    return logLearningEvent(
      {
        ...input,
        metadata: {
          signalCategory: category ?? "other",
          ...(sanitizeMetadata(input.metadata) ?? {}),
        },
        qualityMarkers: {
          signalIntegrated: true,
          metadataSanitized: true,
          ...(input.qualityMarkers ?? {}),
        },
      },
      options
    );
  } catch (error) {
    if (options?.throwOnError) throw error;
    return null;
  }
}
