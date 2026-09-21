import { expect, test } from "@playwright/test";

// A single session avoids repeated auth rate-limit consumption. This suite never
// visits progress/lesson pages: some apparently read-only GETs persist awards.
test("production shell, real student auth and self-scoped learner path", async ({ page, context }) => {
  const severeErrors: string[] = [];
  const deniedRequests: string[] = [];
  let credentialsEntered = false;
  const origin = new URL(process.env.PLAYWRIGHT_BASE_URL!).origin;
  page.on("pageerror", () => severeErrors.push("pageerror"));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const source = message.location().url;
    if (!source || new URL(source, origin).origin === origin) severeErrors.push("console.error");
  });
  const readOnlyGet = (path: string) => {
    if (!/^\/(?!\/)/.test(path)) throw new Error("NR-16 read-only API path must stay on the production origin");
    return page.request.get(path);
  };
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const safeMethod = ["GET", "HEAD", "OPTIONS"].includes(request.method());
    const realCredentials = url.origin === origin &&
      url.pathname === "/api/auth/callback/credentials" && request.method() === "POST";
    if (url.origin !== origin) {
      const observability = /(?:^|\.)(?:sentry\.io|vercel-insights\.com)$/.test(url.hostname) ||
        url.hostname === "va.vercel-scripts.com";
      if (credentialsEntered && !observability) {
        deniedRequests.push(`CROSS_ORIGIN ${url.hostname}`);
      }
      await route.abort("blockedbyclient");
      return;
    }
    if (!safeMethod && !realCredentials) {
      deniedRequests.push(`${request.method()} ${url.pathname}`);
      await route.abort("blockedbyclient");
      return;
    }
    // Next link prefetch can execute server code on pages outside this proof.
    if (request.headers()["next-router-prefetch"] === "1") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    await route.continue();
  });

  const home = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(home?.status()).toBe(200);
  expect(home?.headers()["x-deployment-environment"]).toBe("production");
  expect(home?.headers()["x-deployment-sha"]).toBe(process.env.PLAYWRIGHT_EXPECTED_SHA);
  await expect(page.getByRole("heading", { name: /Liberia's students deserve better than the status quo/i })).toBeVisible();
  const manifest = await readOnlyGet("/manifest.json");
  expect(manifest.status()).toBe(200);
  expect((await manifest.json()).display).toBe("standalone");
  const worker = await readOnlyGet("/sw.js");
  expect(worker.status()).toBe(200);

  const unauthorized = await readOnlyGet("/api/adaptive/mastery");
  expect(unauthorized.status()).toBe(401);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await page.goto("/login?role=student");
  await page.getByRole("button", { name: "student", exact: true }).click();
  credentialsEntered = true;
  await page.locator('input[type="email"], input[type="text"]').fill(process.env.E2E_DEMO_STUDENT_EMAIL!);
  await page.locator('input[type="password"]').fill(process.env.E2E_DEMO_STUDENT_PASSWORD!);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
  await expect(page.getByRole("link", { name: /Continue today's lesson/i })).toBeVisible();
  const sessionResponse = await readOnlyGet("/api/auth/session");
  expect(sessionResponse.status()).toBe(200);
  const session = await sessionResponse.json();
  // Do not place session payloads or learner data in assertion diagnostics.
  expect(session.user?.role === "STUDENT").toBe(true);
  expect(session.user?.isPlatformAdmin === false).toBe(true);
  expect(typeof session.user?.schoolId === "string" && session.user.schoolId.length > 0).toBe(true);
  const own = await readOnlyGet("/api/adaptive/mastery");
  const spoofed = await readOnlyGet("/api/adaptive/mastery?schoolId=nr16-other-school&studentId=nr16-other-student");
  expect(own.status()).toBe(200);
  expect(spoofed.status()).toBe(200);
  expect(JSON.stringify(await own.json()) === JSON.stringify(await spoofed.json())).toBe(true);
  const privileged = await readOnlyGet("/api/admin/invites");
  expect(privileged.status()).toBe(403);
  const finalDeployment = await readOnlyGet("/");
  expect(finalDeployment.status()).toBe(200);
  expect(finalDeployment.headers()["x-deployment-environment"]).toBe("production");
  expect(finalDeployment.headers()["x-deployment-sha"]).toBe(process.env.PLAYWRIGHT_EXPECTED_SHA);
  expect(deniedRequests.length, "Unexpected write or cross-origin attempts were blocked").toBe(0);
  expect(severeErrors.length, "Browser reported severe console/runtime errors").toBe(0);
});
