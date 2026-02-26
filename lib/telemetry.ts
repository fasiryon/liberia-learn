export async function emitTelemetry(
  eventType: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType,
        sessionId: null,
        contentId: null,
        metadata,
      }),
    });
  } catch {
    // telemetry must never break UX
  }
}
