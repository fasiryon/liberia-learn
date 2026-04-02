export type GuardianSmsPreferences = {
  attendance: boolean;
  examResults: boolean;
  lowPerformance: boolean;
};

const DEFAULT_GUARDIAN_SMS_PREFERENCES: GuardianSmsPreferences = {
  attendance: true,
  examResults: true,
  lowPerformance: true,
};

export function readGuardianSmsPreferences(
  value: unknown,
  fallbackOptIn = true
): GuardianSmsPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallbackOptIn
      ? { ...DEFAULT_GUARDIAN_SMS_PREFERENCES }
      : {
          attendance: false,
          examResults: false,
          lowPerformance: false,
        };
  }

  const record = value as Record<string, unknown>;
  return {
    attendance:
      typeof record.attendance === "boolean"
        ? record.attendance
        : fallbackOptIn,
    examResults:
      typeof record.examResults === "boolean"
        ? record.examResults
        : fallbackOptIn,
    lowPerformance:
      typeof record.lowPerformance === "boolean"
        ? record.lowPerformance
        : fallbackOptIn,
  };
}

export function isGuardianSmsOptedIn(preferences: GuardianSmsPreferences) {
  return (
    preferences.attendance ||
    preferences.examResults ||
    preferences.lowPerformance
  );
}
