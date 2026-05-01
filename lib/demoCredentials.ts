// Note: isDemo/isDevelopment intentionally NOT used here — shouldShowDemoCredentials
// checks process.env directly so it cannot be unlocked by DEMO_MODE alone in production.

export type DemoCredentialKey = "student" | "teacher" | "admin" | "guardian" | "moe";

export type DemoCredential = {
  key: DemoCredentialKey;
  label: string;
  role: "STUDENT" | "TEACHER" | "ADMIN" | "GUARDIAN" | "MOE_OFFICIAL";
  email: string;
  password: string;
};

const DEMO_PASSWORD_PLACEHOLDER = process.env.DEMO_SEED_PASSWORD?.trim() || "<DEMO_PASSWORD>";

const DEMO_CREDENTIALS: DemoCredential[] = [
  {
    key: "admin",
    label: "Admin",
    role: "ADMIN",
    email: "admin@cha.edu.lr",
    password: DEMO_PASSWORD_PLACEHOLDER,
  },
  {
    key: "teacher",
    label: "Teacher",
    role: "TEACHER",
    email: "teacher1@cha.edu.lr",
    password: DEMO_PASSWORD_PLACEHOLDER,
  },
  {
    key: "student",
    label: "Student",
    role: "STUDENT",
    email: "student1@cha.edu.lr",
    password: DEMO_PASSWORD_PLACEHOLDER,
  },
  {
    key: "guardian",
    label: "Guardian",
    role: "GUARDIAN",
    email: "guardian1@cha.family.lr",
    password: DEMO_PASSWORD_PLACEHOLDER,
  },
  {
    key: "moe",
    label: "MOE Official",
    role: "MOE_OFFICIAL",
    email: "official1@moe.gov.lr",
    password: "MOESeed2026!",
  },
];

export function getDemoCredentials(): DemoCredential[] {
  return DEMO_CREDENTIALS;
}

export function getDemoCredential(key: DemoCredentialKey): DemoCredential {
  const match = DEMO_CREDENTIALS.find((credential) => credential.key === key);
  if (!match) {
    throw new Error(`Unknown demo credential key: ${key}`);
  }
  return match;
}

/**
 * Returns true ONLY in local development AND when DEMO_MODE is explicitly
 * enabled. Both conditions must be true.
 *
 * In production (NODE_ENV === 'production') this is ALWAYS false regardless
 * of DEMO_MODE, preventing any seeded account details from appearing on the
 * public-facing login page or homepage.
 */
export function shouldShowDemoCredentials(): boolean {
  return process.env.NODE_ENV === "development" && process.env.DEMO_MODE === "true";
}
