/**
 * Application CSRF boundary for state-changing, cookie-authenticated JSON endpoints (Atlas SR-05).
 *
 * A request is accepted only when all of these hold:
 *  - it declares `Content-Type: application/json` (a cross-site HTML form or a "simple" text/plain fetch cannot);
 *  - it carries an `Origin` header equal to the request's own origin (absent Origin is refused);
 *  - Fetch Metadata, when present, is `same-origin`.
 * This does not replace SameSite cookies; it removes the dependence on them for these endpoints.
 */
export class CrossOriginRequestError extends Error {
  readonly status = 403;
  constructor(readonly code: "CSRF_CONTENT_TYPE" | "CSRF_ORIGIN_MISSING" | "CSRF_ORIGIN_MISMATCH" | "CSRF_FETCH_SITE") {
    super("Cross-origin request refused");
    this.name = "CrossOriginRequestError";
  }
}

export function assertSameOriginJson(req: Request): void {
  const contentType = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") throw new CrossOriginRequestError("CSRF_CONTENT_TYPE");
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite !== null && fetchSite !== "same-origin") throw new CrossOriginRequestError("CSRF_FETCH_SITE");
  const origin = req.headers.get("origin");
  if (!origin) throw new CrossOriginRequestError("CSRF_ORIGIN_MISSING");
  let expected: string;
  try { expected = new URL(req.url).origin; } catch { throw new CrossOriginRequestError("CSRF_ORIGIN_MISMATCH"); }
  if (origin !== expected) throw new CrossOriginRequestError("CSRF_ORIGIN_MISMATCH");
}
