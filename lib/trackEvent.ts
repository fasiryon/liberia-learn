"use client";

export const EVENTS = {
  LESSON_VIEW: "lesson_view",
  LESSON_COMPLETE: "lesson_complete",
  LESSON_PREFETCH: "lesson_prefetch",
  HOMEWORK_START: "homework_start",
  HOMEWORK_SUBMIT: "homework_submit",
  HOMEWORK_SUBMIT_OFFLINE: "homework_submit_offline",
  TUTOR_MESSAGE: "tutor_message",
  TUTOR_OFFLINE: "tutor_offline",
  PLACEMENT_START: "placement_start",
  PLACEMENT_COMPLETE: "placement_complete",
  LOGIN: "login",
  LOGOUT: "logout",
  SCHOOL_REGISTER: "school_register",
  INVITE_ACCEPT: "invite_accept",
  // Guided onboarding telemetry (ENABLE_GUIDED_ONBOARDING feature flag)
  ONBOARDING_STEP_COMPLETED: "onboarding.step_completed",
  ONBOARDING_COMPLETED: "onboarding.completed",
  // Accessibility mode telemetry (ENABLE_ACCESSIBILITY_MODE feature flag)
  ACCESSIBILITY_MODE_TOGGLED: "accessibility.mode_toggled",
} as const;

export type EventType = (typeof EVENTS)[keyof typeof EVENTS];

function getSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let sid = sessionStorage.getItem("ll-session-id");
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem("ll-session-id", sid);
    }
    return sid;
  } catch {
    return null;
  }
}

export async function trackEvent(
  eventType: EventType | string,
  payload: Record<string, unknown> = {}
): Promise<void> {
  try {
    const { contentId, ...metadata } = payload;
    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType,
        sessionId: getSessionId(),
        contentId: (contentId as string) ?? null,
        metadata,
      }),
    });
  } catch {
    // never throws — analytics must not break UX
  }
}
