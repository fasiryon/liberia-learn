"use client";

type TrackPayload = {
  drugId?: string;
  [key: string]: unknown;
};

export async function trackEvent(
  eventType: string,
  payload: TrackPayload = {}
): Promise<void> {
  try {
    await fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType,
        drugId: payload.drugId ?? null,
        sessionId: getSessionId(),
        metadata: payload,
      }),
    });
  } catch (error) {
    console.warn('Analytics error:', error);
  }
}

function getSessionId() {
  if (typeof window === 'undefined') return null;
  let sid = window.localStorage.getItem('nursing-pill-sid');
  if (!sid) {
    sid = crypto.randomUUID();
    window.localStorage.setItem('nursing-pill-sid', sid);
  }
  return sid;
}


