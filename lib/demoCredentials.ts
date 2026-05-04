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
const MOE_PASSWORD_PLACEHOLDER = process.env.DEMO_MOE_PASSWORD?.trim() || "<DEMO_MOE_PASSWORD>";

const DEMO_CREDENTIALS: DemoCredential[] = [
  {
    key: "admin",
    label: "Admin",
    role: "ADMIN",
    email: process.env.E2E_DEMO_ADMIN_EMAIL || "<E2E_DEMO_ADMIN_EMAIL>",
    password: DEMO_PASSWORD_PLACEHOLDER,
  },
  {
    key: "teacher",
    label: "Teacher",
    role: "TEACHER",
    email: process.env.E2E_DEMO_TEACHER_EMAIL || "<E2E_DEMO_TEACHER_EMAIL>",
    password: DEMO_PASSWORD_PLACEHOLDER,
  },
  {
    key: "student",
    label: "Student",
    role: "STUDENT",
    email: process.env.E2E_DEMO_STUDENT_EMAIL || "<E2E_DEMO_STUDENT_EMAIL>",
    password: DEMO_PASSWORD_PLACEHOLDER,
  },
  {
    key: "guardian",
    label: "Guardian",
    role: "GUARDIAN",
    email: process.env.E2E_DEMO_GUARDIAN_EMAIL || "<E2E_DEMO_GUARDIAN_EMAIL>",
    password: DEMO_PASSWORD_PLACEHOLDER,
  },
  {
    key: "moe",
    label: "MOE Official",
    role: "MOE_OFFICIAL",
    email: process.env.E2E_DEMO_MOE_EMAIL || "<E2E_DEMO_MOE_EMAIL>",
    password: MOE_PASSWORD_PLACEHOLDER,
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
