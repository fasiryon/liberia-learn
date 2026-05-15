import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const SUPPORTED = ["en", "kpe", "bss"];

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { language } = await req.json();
    if (!SUPPORTED.includes(language)) {
      return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
    }
    await prisma.user.update({ where: { id: user.id }, data: { languagePreference: language } as any });
    return NextResponse.json({ language });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
