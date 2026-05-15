import { NextRequest, NextResponse } from "next/server";
import {
  consumeCanvaOAuthState,
  exchangeCanvaAuthorizationCode,
} from "@/lib/canva/canvaOAuth";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const dest = new URL("/admin/settings/canva", origin);

  if (oauthError) {
    dest.searchParams.set("error", oauthError);
    return NextResponse.redirect(dest);
  }

  if (!code || !state) {
    dest.searchParams.set("error", "Missing code or state from Canva");
    return NextResponse.redirect(dest);
  }

  try {
    const codeVerifier = await consumeCanvaOAuthState({ state });
    await exchangeCanvaAuthorizationCode({ code, codeVerifier });
    dest.searchParams.set("connected", "true");
    return NextResponse.redirect(dest);
  } catch (err: any) {
    dest.searchParams.set("error", err.message ?? "OAuth exchange failed");
    return NextResponse.redirect(dest);
  }
}
