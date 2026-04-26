import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { invalidateCache } from "@/lib/cache/redisCache";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await requireUser();
    if (!user.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const now = new Date();
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const key = `moe:dashboard:national:v2:${month}`;
    await invalidateCache(key);
    return NextResponse.json({ ok: true, invalidated: key });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error" }, { status: err?.status ?? 500 });
  }
}
