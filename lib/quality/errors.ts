// Re-exported rather than redeclared: lib/curriculum/review/api.ts's reviewApiError()
// does `error instanceof ReviewOperationError` against the class from
// lib/curriculum/review/errors.ts specifically. A second, identically-shaped class
// declared here would fail that instanceof check for any quality-layer error, so
// quality code reuses the exact same class instead of a lookalike.
export { ReviewOperationError } from "@/lib/curriculum/review/errors";
