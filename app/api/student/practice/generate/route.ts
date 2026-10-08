// route-policy: auth=session; scope=tenant; authority=canonical-learner-context; rationale=authenticated role and server-resolved published lesson scope constrain tutor access.
import { NextRequest } from "next/server";
import { POST as tutorPost } from "@/app/api/student/tutor/route";

/** Compatibility endpoint for the assistant practice action. Same context, flags, moderation, limits and budget. */
export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { body = null; }
  const input = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  return tutorPost(new NextRequest(req.url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, tutorAction: "practice" }),
  }));
}
