type TeacherProfileSettings = {
  active?: boolean;
  subjectSpecialty?: string | null;
  bio?: string | null;
};

export function readTeacherProfileSettings(value: unknown): TeacherProfileSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  return {
    active: typeof record.active === "boolean" ? record.active : undefined,
    subjectSpecialty:
      typeof record.subjectSpecialty === "string" ? record.subjectSpecialty : null,
    bio: typeof record.bio === "string" ? record.bio : null,
  };
}

export function mergeTeacherProfileSettings(
  value: unknown,
  updates: TeacherProfileSettings
) {
  return {
    ...readTeacherProfileSettings(value),
    ...updates,
  };
}
