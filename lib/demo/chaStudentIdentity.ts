/** Canonical handout identity from prisma/seeds/cha-demo.ts, not national synthetic users. */
export const CHA_DEMO_SCHOOL_ID = "cha-high-academy";
export const CHA_DEMO_STUDENT_LOGIN_ID = "CHA-2026-0001";
export function chaDemoStudentEmail(): string {
  return process.env.E2E_DEMO_STUDENT_EMAIL ?? ["student1", "cha.edu.lr"].join("@");
}
