const { withSentryConfig } = require("@sentry/nextjs");

// Validate required env vars at build time (skip during Next.js lint/type-check phases)
if (process.env.NEXT_PHASE !== "phase-development-server" && process.env.SKIP_ENV_VALIDATION !== "true") {
  try {
    const { validateEnv } = require("./lib/validateEnv");
    validateEnv();
  } catch (err) {
    console.error("[ENV VALIDATION]", err.message);
    // Don't hard-fail build — warn only (DB_URL may be unavailable in CI)
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  telemetry: false,
  disableLogger: true,
  widenClientFileUpload: false,
});
