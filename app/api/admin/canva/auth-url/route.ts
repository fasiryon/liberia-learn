import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  hasCanvaOAuthClientConfig,
  getCanvaOAuthConfig,
  createCanvaPkcePair,
  saveCanvaOAuthState,
  buildCanvaAuthorizationUrl,
} from "@/lib/canva/canvaOAuth";

export async function GET() {
  try {
    await requireRole("ADMIN");

    if (!hasCanvaOAuthClientConfig()) {
      return NextResponse.json(
        { error: "Canva OAuth is not configured on this server" },
        { status: 503 }
      );
    }

    const { clientId, redirectUri } = getCanvaOAuthConfig();
    const { codeVerifier, codeChallenge, state } = createCanvaPkcePair();
    await saveCanvaOAuthState({ state, codeVerifier });
    const url = buildCanvaAuthorizationUrl({ clientId, redirectUri, codeChallenge, state });

    return NextResponse.json({ url: url.toString() });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Internal error" },
      { status: err.status ?? 500 }
    );
  }
}
