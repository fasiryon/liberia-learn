import { NextResponse } from "next/server";
import {
  buildCanvaAuthorizationUrl,
  CANVA_OAUTH_COOKIE_NAMES,
  createCanvaPkcePair,
  getCanvaOAuthConfig,
  saveCanvaOAuthState,
} from "@/lib/canva/canvaOAuth";

const COOKIE_MAX_AGE_SECONDS = 600;

export async function GET() {
  try {
    const { clientId, redirectUri } = getCanvaOAuthConfig();
    const { codeVerifier, codeChallenge, state } = createCanvaPkcePair();
    await saveCanvaOAuthState({ state, codeVerifier });
    const authorizeUrl = buildCanvaAuthorizationUrl({
      clientId,
      redirectUri,
      codeChallenge,
      state,
    });

    const response = NextResponse.redirect(authorizeUrl, 302);
    const secure = process.env.NODE_ENV === "production";

    response.cookies.set(CANVA_OAUTH_COOKIE_NAMES.verifier, codeVerifier, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE_SECONDS,
    });

    response.cookies.set(CANVA_OAUTH_COOKIE_NAMES.state, state, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to start Canva authorization" },
      { status: error?.status ?? 500 }
    );
  }
}
