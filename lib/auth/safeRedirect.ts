/**
 * Same-origin path check for user-supplied post-login destinations
 * (`?next=`, `?callbackUrl=`). A leading "/" alone is not enough: browsers
 * treat "//host" and "/\host" as protocol-relative URLs to another origin.
 */
export function isSafeInternalPath(value: string | null | undefined): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//") || value.startsWith("/\\")) return false;
  // Control characters (including tab/newline, which URL parsing strips) can
  // smuggle a second slash or backslash past the checks above.
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return false;
  return true;
}
