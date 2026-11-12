// route-policy: auth=session; scope=platform; authority=platform-admin-step-up; rationale=only a stepped-up platform ADMIN can start platform credential authorization; state is bound to that authenticated session
import { NextResponse } from "next/server";
import {
  buildCanvaAuthorizationUrl,
  CANVA_OAUTH_COOKIE_NAMES,
  createCanvaPkcePair,
  getCanvaOAuthConfig,
} from "@/lib/canva/canvaOAuth";
import { requireCanvaPlatformSession, saveBoundCanvaOAuthState, canvaOAuthErrorStatus } from "@/lib/canva/oauthSession";

const COOKIE_MAX_AGE_SECONDS = 600;

export async function GET() {
  try {
    const session = await requireCanvaPlatformSession();
    const { clientId, redirectUri } = getCanvaOAuthConfig();
    const { codeVerifier, codeChallenge, state } = createCanvaPkcePair();
    await saveBoundCanvaOAuthState({ state, codeVerifier, session });
    const authorizeUrl = buildCanvaAuthorizationUrl({
      clientId,
      redirectUri,
      codeChallenge,
      state,
    });

    const response = NextResponse.redirect(authorizeUrl, 302);
    response.headers.set("Cache-Control", "private, no-store");
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
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Canva authorization unavailable" },
      { status: canvaOAuthErrorStatus(error), headers: { "Cache-Control": "private, no-store" } }
    );
  }
}
