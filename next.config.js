const { withSentryConfig } = require("@sentry/nextjs");
const createNextIntlPlugin = require("next-intl/plugin");
const withNextIntl = createNextIntlPlugin("./i18n.ts");

// Validate required env vars at build time.
if (process.env.NEXT_PHASE !== "phase-development-server" && process.env.SKIP_ENV_VALIDATION !== "true") {
  const { validateBuildEnv } = require("./lib/validateEnv.shared.js");
  validateBuildEnv();
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  staticPageGenerationTimeout: 300,
  experimental: {
    serverComponentsExternalPackages: ["@react-pdf/renderer"],
  },
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

const shouldEnableSentryBuildPlugin =
  typeof process.env.SENTRY_AUTH_TOKEN === "string" &&
  process.env.SENTRY_AUTH_TOKEN.trim().length > 0 &&
  typeof process.env.SENTRY_ORG === "string" &&
  process.env.SENTRY_ORG.trim().length > 0 &&
  typeof process.env.SENTRY_PROJECT === "string" &&
  process.env.SENTRY_PROJECT.trim().length > 0;

const nextIntlConfig = withNextIntl(nextConfig);

module.exports = shouldEnableSentryBuildPlugin
  ? withSentryConfig(nextIntlConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: true,
      telemetry: false,
      widenClientFileUpload: false,
    })
  : nextIntlConfig;
