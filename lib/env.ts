// lib/env.ts
function getEnvVar(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Missing environment variable: ${key}`);
    }
    return value;
  }
  
  export const env = {
    DATABASE_URL: getEnvVar("DATABASE_URL"),
    NEXTAUTH_SECRET: getEnvVar("NEXTAUTH_SECRET"),
    NEXTAUTH_URL: getEnvVar("NEXTAUTH_URL"),
    // Add more as needed later
  } as const;
  