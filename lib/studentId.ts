function normalizeSchoolCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);
}

export function generateStudentId(params: {
  schoolCode: string;
  year: number;
  sequence: number;
}): string {
  const schoolCode = normalizeSchoolCode(params.schoolCode);
  if (!schoolCode) {
    throw new Error("schoolCode is required");
  }

  if (!Number.isInteger(params.year) || params.year < 1000 || params.year > 9999) {
    throw new Error("year must be a 4-digit number");
  }

  if (!Number.isInteger(params.sequence) || params.sequence < 1) {
    throw new Error("sequence must be a positive integer");
  }

  return `LBR-${params.year}-${schoolCode}-${String(params.sequence).padStart(4, "0")}`;
}
