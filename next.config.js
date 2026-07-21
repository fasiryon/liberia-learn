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
    cpus: 2,
    serverComponentsExternalPackages: ["@react-pdf/renderer"],
    // Next's automatic output-file-tracing missed lib/agents/prompts/*.md at
    // runtime (readFileSync(new URL(..., import.meta.url)) isn't statically
    // analyzable the way a literal path is) - ENOENT'd every agent-platform
    // cron route (agents-tick, ops-sentinel) that transitively loads
    // lib/agents/bootstrap. Force-include the whole prompts directory for
    // every route rather than enumerating routes/files one at a time.
    outputFileTracingIncludes: {
      "/*": ["./lib/agents/prompts/**/*.md"],
    },
  },
  async headers() {
    return [
      {
        source: "/api/league",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=300, stale-while-revalidate=3600",
          },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // A2 Content-Security-Policy. Shipped in Report-Only mode first so
          // CSP violations (inline scripts in credential-card + LowBandwidthMode,
          // YouTube embeds, third-party beacons) surface in the browser console /
          // Sentry without breaking the page. Switch the key to
          // "Content-Security-Policy" (enforcing) after one deploy once the
          // report stream is clean and the two known inline scripts carry nonces.
          {
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://www.youtube.com https://*.vercel-insights.com https://*.sentry.io",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "media-src 'self' blob: https:",
              "connect-src 'self' https://*.sentry.io https://*.vercel-insights.com https://api.elevenlabs.io https://api.openai.com https://api.groq.com",
              "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
              "font-src 'self' data:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
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
