// route-policy: auth=session; scope=platform; authority=platform-admin-step-up; rationale=only the initiating platform ADMIN session may claim the shared OAuth state and exchange a platform credential
import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCanvaAuthorizationCode,
} from "@/lib/canva/canvaOAuth";
import { requireCanvaPlatformSession, consumeBoundCanvaOAuthState, canvaOAuthErrorStatus } from "@/lib/canva/oauthSession";

export async function GET(request: NextRequest) {
  try {
  const session = await requireCanvaPlatformSession();
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const dest = new URL("/admin/settings/canva", origin);

  if (oauthError) {
    dest.searchParams.set("error", "Canva authorization was refused");
    return NextResponse.redirect(dest);
  }

  if (!code || !state) {
    dest.searchParams.set("error", "Missing code or state from Canva");
    return NextResponse.redirect(dest);
  }

    const codeVerifier = await consumeBoundCanvaOAuthState({ state, session });
    await exchangeCanvaAuthorizationCode({ code, codeVerifier });
    dest.searchParams.set("connected", "true");
    return NextResponse.redirect(dest);
  } catch (err: unknown) {
    const status = canvaOAuthErrorStatus(err);
    if (status === 401 || status === 403) return NextResponse.json({ error: "Forbidden" }, { status, headers: { "Cache-Control": "private, no-store" } });
    const destination = new URL("/admin/settings/canva", request.nextUrl.origin);
    destination.searchParams.set("error", "Canva authorization failed");
    return NextResponse.redirect(destination);
  }
}
