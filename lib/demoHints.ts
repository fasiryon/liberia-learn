export type DemoHintGroup = {
  key: "student" | "teacher" | "admin" | "guardian" | "moe";
  label: string;
  email: string;
  passwordHint: string;
};

export const DEMO_PASSWORD_VALUE = "Password123";
export const DEMO_PASSWORD_HINT = `Password: ${DEMO_PASSWORD_VALUE}`;

const DEMO_HINTS: DemoHintGroup[] = [
  {
    key: "student",
    label: "Student",
    email: "student1@mcs.edu.lr",
    passwordHint: DEMO_PASSWORD_HINT,
  },
  {
    key: "teacher",
    label: "Teacher",
    email: "teacher@mcs.edu.lr",
    passwordHint: DEMO_PASSWORD_HINT,
  },
  {
    key: "admin",
    label: "Admin",
    email: "admin@mcs.edu.lr",
    passwordHint: DEMO_PASSWORD_HINT,
  },
  {
    key: "guardian",
    label: "Guardian",
    email: "guardian1@mca.edu.lr",
    passwordHint: DEMO_PASSWORD_HINT,
  },
  {
    key: "moe",
    label: "MOE / District",
    email: "jkollie@mca.edu.lr",
    passwordHint: DEMO_PASSWORD_HINT,
  },
];

export function getDemoHintGroups(): DemoHintGroup[] {
  return DEMO_HINTS;
}

export function getDemoHintGroup(key: DemoHintGroup["key"]): DemoHintGroup {
  const match = DEMO_HINTS.find((h) => h.key === key);
  if (!match) throw new Error(`Unknown demo hint key: ${key}`);
  return match;
}
