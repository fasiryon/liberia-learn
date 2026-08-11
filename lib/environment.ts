export type AppEnvironment =
  | "production"
  | "staging"
  | "demo"
  | "development";

export function getEnvironment(): AppEnvironment {
  if (process.env.NODE_ENV === "development") {
    return "development";
  }
  if (process.env.DEMO_MODE === "true") {
    return "demo";
  }
  if (
    process.env.VERCEL_ENV === "preview" ||
    process.env.VERCEL_ENV === "staging"
  ) {
    return "staging";
  }
  return "production";
}

export function isProduction(): boolean {
  return getEnvironment() === "production";
}

export function isDemo(): boolean {
  return getEnvironment() === "demo";
}

export function isStaging(): boolean {
  return getEnvironment() === "staging";
}

export function isDevelopment(): boolean {
  return getEnvironment() === "development";
}
