import { normalizeToE164 } from "@/lib/phone";

export type StudentLoginMode = "email" | "studentId";
export type GuardianLoginMode = "email" | "phone";

export function normalizeLoginId(value: string) {
  return value.trim().replace(/\s+/g, "-").toUpperCase();
}

export function slugifyLoginSeed(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function sanitizePin(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function isValidPin(pin: string) {
  return /^\d{4,6}$/.test(pin);
}

export function normalizeCredentialPhone(value: string) {
  return normalizeToE164(value, "+231");
}

export function getStudentLoginFields(mode: StudentLoginMode) {
  if (mode === "studentId") {
    return {
      identifierLabel: "Student ID",
      identifierPlaceholder: "Student ID (e.g. LBR-2024-001)",
      identifierType: "text" as const,
      identifierAutoComplete: "username",
      secretLabel: "PIN",
      secretPlaceholder: "Enter 4-6 digit PIN",
      secretInputMode: "numeric" as const,
      secretPattern: "\\d{4,6}",
      toggleText: "Use email instead",
    };
  }

  return {
    identifierLabel: "Email address",
    identifierPlaceholder: "student@school.lr",
    identifierType: "email" as const,
    identifierAutoComplete: "email",
    secretLabel: "Password",
    secretPlaceholder: "********",
    secretInputMode: undefined,
    secretPattern: undefined,
    toggleText: "Use Student ID instead",
  };
}

export function getGuardianLoginFields(mode: GuardianLoginMode) {
  if (mode === "phone") {
    return {
      identifierLabel: "Phone number",
      identifierPlaceholder: "+231 XX XXX XXXX",
      identifierType: "tel" as const,
      identifierAutoComplete: "tel",
      secretLabel: "PIN",
      secretPlaceholder: "Enter 4-6 digit PIN",
      secretInputMode: "numeric" as const,
      secretPattern: "\\d{4,6}",
      toggleText: "Use email instead",
    };
  }

  return {
    identifierLabel: "Email address",
    identifierPlaceholder: "guardian@family.lr",
    identifierType: "email" as const,
    identifierAutoComplete: "email",
    secretLabel: "Password",
    secretPlaceholder: "********",
    secretInputMode: undefined,
    secretPattern: undefined,
    toggleText: "Use phone instead",
  };
}

