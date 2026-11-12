// route-policy: auth=session; scope=platform; authority=platform-admin-step-up; rationale=only a stepped-up platform ADMIN may initialize the shared platform OAuth credential; state binds to the initiating session
import { NextResponse } from "next/server";
import {
  hasCanvaOAuthClientConfig,
  getCanvaOAuthConfig,
  createCanvaPkcePair,
  buildCanvaAuthorizationUrl,
} from "@/lib/canva/canvaOAuth";
import { requireCanvaPlatformSession, saveBoundCanvaOAuthState, canvaOAuthErrorStatus } from "@/lib/canva/oauthSession";

export async function GET() {
  try {
    const session = await requireCanvaPlatformSession();

    if (!hasCanvaOAuthClientConfig()) {
      return NextResponse.json(
        { error: "Canva OAuth is not configured on this server" },
        { status: 503 }
      );
    }

    const { clientId, redirectUri } = getCanvaOAuthConfig();
    const { codeVerifier, codeChallenge, state } = createCanvaPkcePair();
    await saveBoundCanvaOAuthState({ state, codeVerifier, session });
    const url = buildCanvaAuthorizationUrl({ clientId, redirectUri, codeChallenge, state });

    return NextResponse.json({ url: url.toString() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "Canva authorization unavailable" },
      { status: canvaOAuthErrorStatus(err), headers: { "Cache-Control": "private, no-store" } }
    );
  }
}
