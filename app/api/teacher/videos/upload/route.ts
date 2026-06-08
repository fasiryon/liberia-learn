import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Canonical upload route: POST /api/teacher/lessons/{contentId}/video
// This shim accepts contentId as a query parameter for compatibility.
export async function POST(request: NextRequest) {
  const contentId = request.nextUrl.searchParams.get("contentId");
  if (!contentId) {
    return NextResponse.json(
      { error: "contentId query parameter required. Use POST /api/teacher/lessons/{contentId}/video instead." },
      { status: 400 }
    );
  }
  return NextResponse.redirect(
    new URL(`/api/teacher/lessons/${contentId}/video`, request.url),
    { status: 307 }
  );
}
