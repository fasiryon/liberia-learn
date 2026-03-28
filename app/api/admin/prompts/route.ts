import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listPrompts } from "@/lib/ai/promptRegistry";
import { isPromptRegistryEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isPromptRegistryEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireUser();
    if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(listPrompts());
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to load prompt registry" },
      { status: error?.status ?? 500 }
    );
  }
}
