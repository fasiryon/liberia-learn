import { NextRequest, NextResponse } from "next/server";
import { requireCandidateReviewer } from "@/lib/learner-experience/reviewerAccess";
import { diagnosticRequestSchema, reviewDiagnosticResult } from "@/lib/learner-experience/candidateReview";

export const dynamic = "force-dynamic";
export async function POST(request: NextRequest, { params }: { params: { experienceId: string } }) {
  await requireCandidateReviewer();
  const headers = { "Cache-Control": "private, no-store", "Vary": "Cookie" };
  const trustedOrigin = new URL(process.env.NEXTAUTH_URL ?? request.url).origin;
  if (request.headers.get("origin") !== trustedOrigin || !request.headers.get("content-type")?.startsWith("application/json")) return NextResponse.json({ error: "Request rejected" }, { status: 403, headers });
  const body = await request.text();
  if (body.length > 10000) return NextResponse.json({ error: "Request rejected" }, { status: 413, headers });
  try {
    const result = reviewDiagnosticResult(params.experienceId, diagnosticRequestSchema.parse(JSON.parse(body)));
    return NextResponse.json(result ?? { error: "Candidate unavailable" }, { status: result ? 200 : 404, headers });
  } catch {
    return NextResponse.json({ error: "Diagnostic unavailable or responses invalid" }, { status: 400, headers });
  }
}
