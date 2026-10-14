/**
 * The Student Experience V3 design preview (synthetic demo lessons) is available in development and
 * test builds, and in a production build only when STUDENT_DESIGN_PREVIEW=1 is set on purpose.
 */
export function isStudentDesignPreviewEnabled(env: Record<string, string | undefined>): boolean {
  return env.NODE_ENV !== "production" || env.STUDENT_DESIGN_PREVIEW === "1";
}
