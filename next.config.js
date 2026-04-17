const { withSentryConfig } = require("@sentry/nextjs");

// Validate required env vars at build time.
if (process.env.NEXT_PHASE !== "phase-development-server" && process.env.SKIP_ENV_VALIDATION !== "true") {
  const { validateBuildEnv } = require("./lib/validateEnv.shared.js");
  validateBuildEnv();
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
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

const shouldEnableSentryBuildPlugin =
  typeof process.env.SENTRY_AUTH_TOKEN === "string" &&
  process.env.SENTRY_AUTH_TOKEN.trim().length > 0 &&
  typeof process.env.SENTRY_ORG === "string" &&
  process.env.SENTRY_ORG.trim().length > 0 &&
  typeof process.env.SENTRY_PROJECT === "string" &&
  process.env.SENTRY_PROJECT.trim().length > 0;

module.exports = shouldEnableSentryBuildPlugin
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: true,
      telemetry: false,
      widenClientFileUpload: false,
    })
  : nextConfig;
