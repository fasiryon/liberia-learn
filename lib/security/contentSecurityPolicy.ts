export function buildContentSecurityPolicy(nonce: string, production = process.env.NODE_ENV === "production") {
  const scriptSources = [
    "'self'",
    `'nonce-${nonce}'`,
    ...(production ? [] : ["'unsafe-eval'"]),
    "https://www.youtube.com",
    "https://*.vercel-insights.com",
    "https://*.sentry.io",
  ];

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
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
  ].join("; ");
}
