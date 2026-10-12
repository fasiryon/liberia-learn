/** Existing hosted CHA tenant; showcase access still requires the exact demo User/Student identity. */
export const CHA_DEMO_SCHOOL_ID = "school-cha";
export const CHA_DEMO_STUDENT_LOGIN_ID = "CHA-2026-0001";
export function chaDemoStudentEmail(): string {
  return process.env.E2E_DEMO_STUDENT_EMAIL ?? ["student1", "cha.edu.lr"].join("@");
}
