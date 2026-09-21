// The public build-time header verifies the deployment serving the canonical
// origin, not just a successful deployment record or a healthy older release.
const target = new URL(process.env.PLAYWRIGHT_BASE_URL || "missing:");
const expected = process.env.PLAYWRIGHT_EXPECTED_SHA || "";
if (target.protocol !== "https:" || !/^[a-f0-9]{40}$/i.test(expected)) {
  throw new Error("NR-16 infrastructure: explicit HTTPS URL and full expected SHA required");
}
const deadline = Date.now() + 10 * 60_000;
while (Date.now() < deadline) {
  try {
    const response = await fetch(new URL("/login", target), {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (
      response.ok &&
      response.headers.get("x-deployment-environment") === "production" &&
      response.headers.get("x-deployment-sha") === expected
    ) {
      console.log(`NR-16 deployment ready: ${expected}`);
      process.exit(0);
    }
  } catch {
    // Connection failure remains infrastructure failure, never an assertion pass.
  }
  await new Promise((resolve) => setTimeout(resolve, 10_000));
}
throw new Error("NR-16 infrastructure: expected main deployment not ready after 10 minutes");
