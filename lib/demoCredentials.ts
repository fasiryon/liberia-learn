export type DemoCredentialKey = "student" | "teacher" | "admin" | "guardian" | "moe";

export type DemoCredential = {
  key: DemoCredentialKey;
  label: string;
  role: "STUDENT" | "TEACHER" | "ADMIN" | "GUARDIAN" | "MOE_OFFICIAL";
  email: string;
  password: string;
};

const DEMO_CREDENTIALS: DemoCredential[] = [
  {
    key: "admin",
    label: "Admin",
    role: "ADMIN",
    email: "admin@cha.edu.lr",
    password: "DemoSeed2026!",
  },
  {
    key: "teacher",
    label: "Teacher",
    role: "TEACHER",
    email: "teacher1@cha.edu.lr",
    password: "DemoSeed2026!",
  },
  {
    key: "student",
    label: "Student",
    role: "STUDENT",
    email: "student1@cha.edu.lr",
    password: "DemoSeed2026!",
  },
  {
    key: "guardian",
    label: "Guardian",
    role: "GUARDIAN",
    email: "guardian1@cha.family.lr",
    password: "DemoSeed2026!",
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
