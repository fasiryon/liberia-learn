// route-policy: auth=session; scope=platform; authority=platform-admin-step-up; rationale=only the initiating platform ADMIN session can atomically claim OAuth state before any token exchange or credential persistence
import { NextRequest, NextResponse } from "next/server";
import {
  CANVA_OAUTH_COOKIE_NAMES,
  exchangeCanvaAuthorizationCode,
} from "@/lib/canva/canvaOAuth";
import { requireCanvaPlatformSession, consumeBoundCanvaOAuthState, canvaOAuthErrorStatus } from "@/lib/canva/oauthSession";

function clearOAuthCookies(response: NextResponse) {
  for (const name of Object.values(CANVA_OAUTH_COOKIE_NAMES)) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireCanvaPlatformSession();
    const code = request.nextUrl.searchParams.get("code");
    const returnedState = request.nextUrl.searchParams.get("state");
    const error = request.nextUrl.searchParams.get("error");

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: "Canva authorization was refused",
        },
        { status: 400 }
      );
    }

    if (!code) {
      return NextResponse.json({ ok: false, error: "Missing authorization code" }, { status: 400 });
    }

    if (!returnedState) {
      return NextResponse.json({ ok: false, error: "Missing OAuth state" }, { status: 400 });
    }

    const verifier = await consumeBoundCanvaOAuthState({ state: returnedState, session });
    const tokenResponse = await exchangeCanvaAuthorizationCode({
      code,
      codeVerifier: verifier,
    });

    const response = NextResponse.json(
      {
        ok: true,
        provider: "canva",
        scope: tokenResponse.scope ?? null,
        tokenType: tokenResponse.token_type ?? null,
        expiresIn: tokenResponse.expires_in ?? null,
      },
      { status: 200, headers: { "Cache-Control": "private, no-store" } }
    );
    clearOAuthCookies(response);
    return response;
  } catch (error: unknown) {
    const response = NextResponse.json(
      { ok: false, error: "Canva authorization failed" },
      { status: canvaOAuthErrorStatus(error), headers: { "Cache-Control": "private, no-store" } }
    );
    clearOAuthCookies(response);
    return response;
  }
}
