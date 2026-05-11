import { NextRequest, NextResponse } from "next/server";
import {
  CANVA_OAUTH_COOKIE_NAMES,
  consumeCanvaOAuthState,
  exchangeCanvaAuthorizationCode,
} from "@/lib/canva/canvaOAuth";

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
    const code = request.nextUrl.searchParams.get("code");
    const returnedState = request.nextUrl.searchParams.get("state");
    const error = request.nextUrl.searchParams.get("error");

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error,
          errorDescription: request.nextUrl.searchParams.get("error_description"),
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

    const verifier = await consumeCanvaOAuthState({ state: returnedState });
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
      { status: 200 }
    );
    clearOAuthCookies(response);
    return response;
  } catch (error: any) {
    const response = NextResponse.json(
      { ok: false, error: error?.message ?? "Canva OAuth callback failed" },
      { status: error?.status ?? 500 }
    );
    clearOAuthCookies(response);
    return response;
  }
}
