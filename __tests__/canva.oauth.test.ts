import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCanvaCredentialFindUnique = vi.hoisted(() => vi.fn());
const mockCanvaCredentialUpsert = vi.hoisted(() => vi.fn());
const mockCanvaStateCreate = vi.hoisted(() => vi.fn());
const mockCanvaStateDelete = vi.hoisted(() => vi.fn());
const mockCanvaStateDeleteMany = vi.hoisted(() => vi.fn());
const mockCanvaStateFindUnique = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    canvaOAuthCredential: {
      findUnique: mockCanvaCredentialFindUnique,
      upsert: mockCanvaCredentialUpsert,
    },
    canvaOAuthState: {
      create: mockCanvaStateCreate,
      delete: mockCanvaStateDelete,
      deleteMany: mockCanvaStateDeleteMany,
      findUnique: mockCanvaStateFindUnique,
    },
  },
}));

async function importOAuthModule() {
  vi.resetModules();
  return await import("@/lib/canva/canvaOAuth");
}

function setOAuthEnv() {
  process.env.CANVA_CLIENT_ID = "canva-client-id";
  process.env.CANVA_CLIENT_SECRET = "canva-client-secret";
  process.env.CANVA_REDIRECT_URI = "https://liberia-learn.test/api/canva/callback";
  process.env.NEXTAUTH_SECRET = "nextauth-secret-for-tests";
}

function resetOAuthEnv() {
  delete process.env.CANVA_CLIENT_ID;
  delete process.env.CANVA_CLIENT_SECRET;
  delete process.env.CANVA_REDIRECT_URI;
  delete process.env.CANVA_MCP_AUTHORIZATION_TOKEN;
  delete process.env.NEXTAUTH_SECRET;
}

describe("Canva OAuth PKCE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOAuthEnv();
    setOAuthEnv();
    mockCanvaStateCreate.mockResolvedValue({ id: "state-1" });
    mockCanvaStateDelete.mockResolvedValue({ id: "state-1" });
    mockCanvaStateDeleteMany.mockResolvedValue({ count: 0 });
  });

  it("creates a PKCE authorization redirect and stores verifier state server-side", async () => {
    const { GET } = await import("../app/api/canva/auth/route");

    const response = await GET();
    const location = response.headers.get("location");
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(location).toContain("https://www.canva.com/api/oauth/authorize");
    expect(location).toContain("response_type=code");
    expect(location).toContain("client_id=canva-client-id");
    expect(location).toContain("redirect_uri=https%3A%2F%2Fliberia-learn.test%2Fapi%2Fcanva%2Fcallback");
    expect(location).toContain("code_challenge_method=S256");
    expect(location).toContain("code_challenge=");
    expect(location).toContain("state=");

    expect(setCookie).toContain("canva_oauth_code_verifier=");
    expect(setCookie).toContain("canva_oauth_state=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Path=/");
    expect(mockCanvaStateDeleteMany).toHaveBeenCalledWith({
      where: {
        expiresAt: {
          lt: expect.any(Date),
        },
      },
    });
    expect(mockCanvaStateCreate).toHaveBeenCalledWith({
      data: {
        state: expect.any(String),
        codeVerifier: expect.any(String),
        expiresAt: expect.any(Date),
      },
    });
  });

  it("exchanges the code using DB-backed verifier state, stores encrypted tokens, and clears cookies", async () => {
    const encryptedTokenCapture: { value?: string } = {};
    mockCanvaCredentialUpsert.mockImplementation(async ({ create }) => {
      encryptedTokenCapture.value = create.encryptedTokenSet;
      return { id: "credential-1" };
    });
    mockCanvaStateFindUnique.mockResolvedValue({
      id: "state-1",
      state: "test-state",
      codeVerifier: "test-verifier",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "access-token-1",
          refresh_token: "refresh-token-1",
          expires_in: 3600,
          token_type: "bearer",
          scope: "profile:read",
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      ) as Response
    );

    const { GET } = await import("../app/api/canva/callback/route");
    const request = new NextRequest(
      "https://liberia-learn.test/api/canva/callback?code=auth-code-1&state=test-state"
    );

    const response = await GET(request);
    const body = await response.json();
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(body).toMatchObject({
      ok: true,
      provider: "canva",
      scope: "profile:read",
      tokenType: "bearer",
      expiresIn: 3600,
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.canva.com/rest/v1/oauth/token",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Basic\s+/),
          "Content-Type": "application/x-www-form-urlencoded",
        }),
      })
    );
    expect(mockCanvaCredentialUpsert).toHaveBeenCalled();
    expect(mockCanvaStateFindUnique).toHaveBeenCalledWith({
      where: {
        state: "test-state",
      },
    });
    expect(mockCanvaStateDelete).toHaveBeenCalledWith({
      where: {
        state: "test-state",
      },
    });
    expect(encryptedTokenCapture.value).toBeDefined();
    expect(encryptedTokenCapture.value).not.toContain("access-token-1");
    expect(encryptedTokenCapture.value).not.toContain("refresh-token-1");
    expect(setCookie).toContain("canva_oauth_code_verifier=;");
    expect(setCookie).toContain("canva_oauth_state=;");
    expect(setCookie).toContain("Path=/");

    fetchSpy.mockRestore();
  });

  it("returns a clear error when callback state is missing from DB", async () => {
    mockCanvaStateFindUnique.mockResolvedValue(null);

    const { GET } = await import("../app/api/canva/callback/route");
    const request = new NextRequest(
      "https://liberia-learn.test/api/canva/callback?code=auth-code-1&state=missing-state"
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      ok: false,
      error: "Canva OAuth state was not found or has already been used",
    });
  });

  it("returns a clear error when callback state has expired", async () => {
    mockCanvaStateFindUnique.mockResolvedValue({
      id: "state-1",
      state: "expired-state",
      codeVerifier: "expired-verifier",
      createdAt: new Date(Date.now() - 700_000),
      expiresAt: new Date(Date.now() - 1_000),
    });

    const { GET } = await import("../app/api/canva/callback/route");
    const request = new NextRequest(
      "https://liberia-learn.test/api/canva/callback?code=auth-code-1&state=expired-state"
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      ok: false,
      error: "Canva OAuth state has expired. Please reconnect Canva.",
    });
    expect(mockCanvaStateDelete).toHaveBeenCalledWith({
      where: {
        state: "expired-state",
      },
    });
  });

  it("round-trips a stored credential and returns the access token for MCP use", async () => {
    let storedRecord: any;
    mockCanvaCredentialUpsert.mockImplementation(async ({ create }) => {
      storedRecord = {
        provider: "canva",
        encryptedTokenSet: create.encryptedTokenSet,
        accessTokenExpiresAt: create.accessTokenExpiresAt,
      };
      return storedRecord;
    });
    mockCanvaCredentialFindUnique.mockImplementation(async () => storedRecord ?? null);

    const { persistCanvaOAuthTokens, resolveCanvaMcpAuthorizationToken } = await importOAuthModule();

    await persistCanvaOAuthTokens({
      access_token: "access-token-roundtrip",
      refresh_token: "refresh-token-roundtrip",
      expires_in: 3600,
      token_type: "bearer",
      scope: "design:content:read profile:read",
    });

    const token = await resolveCanvaMcpAuthorizationToken();
    expect(token).toBe("access-token-roundtrip");
    expect(storedRecord.accessTokenExpiresAt).toBeInstanceOf(Date);
  });
});
