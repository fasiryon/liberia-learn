"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import type { DemoHintGroup } from "@/lib/demoHints";
import { DemoHints } from "@/components/DemoHints";
import { PublicFooter } from "@/components/PublicFooter";
import {
  getGuardianLoginFields,
  getStudentLoginFields,
  sanitizePin,
  type GuardianLoginMode,
  type StudentLoginMode,
} from "@/lib/login-identifiers";

type LoginClientProps = {
  showDemoHints: boolean;
  demoGroups: DemoHintGroup[];
  demoDefaults: { email: string; password: string } | null;
};

function defaultRouteForRole(role: string, mustChangePIN = false): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "TEACHER":
      return "/teacher";
    case "GUARDIAN":
      return "/guardian";
    case "STUDENT":
      return mustChangePIN ? "/student/change-pin" : "/dashboard";
    default:
      return "/dashboard";
  }
}

function isNextUrlSafeForRole(url: string, role: string): boolean {
  if (!url.startsWith("/")) return false;
  if (role === "STUDENT" && (url.startsWith("/admin") || url.startsWith("/teacher"))) return false;
  if (role === "TEACHER" && url.startsWith("/admin")) return false;
  if (role === "GUARDIAN" && (url.startsWith("/admin") || url.startsWith("/teacher") || url.startsWith("/platform"))) return false;
  return true;
}

export function resolvePostLoginDestination(params: {
  role: string;
  isPlatformAdmin?: boolean;
  mustChangePIN?: boolean;
  nextUrl?: string | null;
}) {
  const { role, isPlatformAdmin = false, mustChangePIN = false, nextUrl = null } = params;
  const safeNext = nextUrl && isNextUrlSafeForRole(nextUrl, role) ? nextUrl : null;
  if (mustChangePIN && role === "STUDENT") {
    return "/student/change-pin";
  }
  return safeNext || (isPlatformAdmin ? "/platform" : defaultRouteForRole(role, mustChangePIN));
}

const TOUCH_INPUT = "min-h-11 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-3 py-3 text-base text-[var(--ll-text)] outline-none placeholder:text-[var(--ll-text-faint)] focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/60";

export default function LoginClient({ showDemoHints, demoGroups, demoDefaults }: LoginClientProps) {
  const router = useRouter();
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [showDemoHelp, setShowDemoHelp] = useState(false);

  const [role, setRole] = useState<"student" | "teacher" | "admin" | "guardian">("student");
  const [email, setEmail] = useState(demoDefaults?.email ?? "");
  const [password, setPassword] = useState(demoDefaults?.password ?? "");
  const [studentId, setStudentId] = useState("");
  const [studentPin, setStudentPin] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianPin, setGuardianPin] = useState("");
  const [studentMode, setStudentMode] = useState<StudentLoginMode>("email");
  const [guardianMode, setGuardianMode] = useState<GuardianLoginMode>("email");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const guardianEnabled = FEATURE_FLAGS.ENABLE_GUARDIAN_PORTAL;

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setNextUrl(params.get("next") || params.get("callbackUrl") || null);
      setFlashMessage(params.get("message"));
      const requestedRole = params.get("role");
      if (
        requestedRole === "student" ||
        requestedRole === "teacher" ||
        requestedRole === "admin" ||
        requestedRole === "guardian"
      ) {
        setRole(requestedRole);
      }
    }
  }, []);

  const ROLES_WITH_GUARDIAN = ["student", "teacher", "admin", "guardian"] as const;
  const ROLES_NO_GUARDIAN = ["student", "teacher", "admin"] as const;

  const roleOptions = guardianEnabled ? ROLES_WITH_GUARDIAN : ROLES_NO_GUARDIAN;

  const studentFields = getStudentLoginFields(studentMode);
  const guardianFields = getGuardianLoginFields(guardianMode);

  const identifierLabel =
    role === "student"
      ? studentFields.identifierLabel
      : role === "guardian"
      ? guardianFields.identifierLabel
      : "Email address";

  const identifierPlaceholder =
    role === "student"
      ? studentFields.identifierPlaceholder
      : role === "guardian"
      ? guardianFields.identifierPlaceholder
      : role === "teacher"
      ? "teacher@school.lr"
      : "admin@school.lr";

  const identifierType =
    role === "student"
      ? studentFields.identifierType
      : role === "guardian"
      ? guardianFields.identifierType
      : "email";

  const identifierValue =
    role === "student" && studentMode === "studentId"
      ? studentId
      : role === "guardian" && guardianMode === "phone"
      ? guardianPhone
      : email;

  const secretLabel =
    role === "student"
      ? studentFields.secretLabel
      : role === "guardian"
      ? guardianFields.secretLabel
      : "Password";

  const secretPlaceholder =
    role === "student"
      ? studentFields.secretPlaceholder
      : role === "guardian"
      ? guardianFields.secretPlaceholder
      : "********";

  const secretValue =
    role === "student" && studentMode === "studentId"
      ? studentPin
      : role === "guardian" && guardianMode === "phone"
      ? guardianPin
      : password;

  const secretInputMode =
    role === "student"
      ? studentFields.secretInputMode
      : role === "guardian"
      ? guardianFields.secretInputMode
      : undefined;

  const secretPattern =
    role === "student"
      ? studentFields.secretPattern
      : role === "guardian"
      ? guardianFields.secretPattern
      : undefined;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload: Record<string, string | boolean> = {
      redirect: false,
      password,
      email,
    };

    if (role === "student" && studentMode === "studentId") {
      payload.studentId = studentId;
      payload.password = studentPin;
    } else if (role === "guardian" && guardianMode === "phone") {
      payload.phone = guardianPhone;
      payload.password = guardianPin;
    }

    const res = await signIn("credentials", payload as any);

    if (res?.error) {
      setLoading(false);
      setError(res.error);
      return;
    }

    const session = await getSession();
    const userRole = (session?.user as any)?.role ?? "STUDENT";
    const isPlatformAdmin = (session?.user as any)?.isPlatformAdmin ?? false;
    const mustChangePIN = (session?.user as any)?.mustChangePIN ?? false;
    const destination = resolvePostLoginDestination({
      role: userRole,
      isPlatformAdmin,
      mustChangePIN,
      nextUrl,
    });
    router.push(destination);
  };

  const handleIdentifierChange = (value: string) => {
    if (role === "student" && studentMode === "studentId") {
      setStudentId(value);
      return;
    }
    if (role === "guardian" && guardianMode === "phone") {
      setGuardianPhone(value);
      return;
    }
    setEmail(value);
  };

  const handleSecretChange = (value: string) => {
    if (role === "student" && studentMode === "studentId") {
      setStudentPin(sanitizePin(value));
      return;
    }
    if (role === "guardian" && guardianMode === "phone") {
      setGuardianPin(sanitizePin(value));
      return;
    }
    setPassword(value);
  };

  const renderToggle = () => {
    if (role === "student") {
      return (
        <button
          type="button"
          onClick={() => setStudentMode((current) => (current === "email" ? "studentId" : "email"))}
          className="text-sm text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]"
        >
          {studentFields.toggleText}
        </button>
      );
    }

    if (role === "guardian") {
      return (
        <button
          type="button"
          onClick={() => setGuardianMode((current) => (current === "email" ? "phone" : "email"))}
          className="text-sm text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]"
        >
          {guardianFields.toggleText}
        </button>
      );
    }

    return null;
  };

  return (
    <main className="ll-page ll-page-enter flex min-h-screen flex-col px-4 py-8 sm:py-10">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#22c55e33,_transparent_55%),radial-gradient(circle_at_bottom,_#0ea5e933,_transparent_55%)]" />

      <div className="mx-auto w-full max-w-lg flex-1 flex items-center justify-center py-4">
      <div className="w-full space-y-5 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/75 p-5 shadow-none shadow-emerald-500/15 backdrop-blur sm:space-y-6 sm:p-7">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--ll-accent)] text-lg font-black text-[var(--ll-text-faint)]">
            L
          </div>
          <h1 className="text-xl font-semibold text-[var(--ll-text)]">Sign in to LiberiaLearn</h1>
          <p className="text-sm text-[var(--ll-text-muted)]">Access lessons, assignments, progress, and school tools.</p>
        </div>

        {flashMessage && (
          <p className="rounded-lg border border-emerald-800 bg-[var(--ll-yellow-soft)] px-3 py-3 text-sm text-[var(--ll-yellow)]">
            {flashMessage}
          </p>
        )}

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-faint)]">Sign in as</p>
          <div className={`grid gap-2 text-xs ${guardianEnabled ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
            {roleOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRole(option)}
                className={`min-h-11 rounded-xl border px-3 py-2.5 capitalize ${
                  role === option
                    ? "border-emerald-400 bg-[var(--ll-yellow)]/20 text-[var(--ll-yellow)]"
                    : "border-[var(--ll-border)] bg-[var(--ll-bg)]/80 text-[var(--ll-text)] hover:border-[var(--ll-border)]"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-[var(--ll-text)]">{identifierLabel}</label>
            <input
              required
              type={identifierType}
              className={TOUCH_INPUT}
              placeholder={identifierPlaceholder}
              value={identifierValue}
              onChange={(e) => handleIdentifierChange(e.target.value)}
              autoComplete={role === "student" ? studentFields.identifierAutoComplete : role === "guardian" ? guardianFields.identifierAutoComplete : "email"}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-[var(--ll-text)]">{secretLabel}</label>
            <input
              required
              type={secretInputMode ? "password" : "password"}
              className={TOUCH_INPUT}
              placeholder={secretPlaceholder}
              value={secretValue}
              onChange={(e) => handleSecretChange(e.target.value)}
              autoComplete={secretInputMode ? "one-time-code" : "current-password"}
              inputMode={secretInputMode}
              pattern={secretPattern}
            />
          </div>

          {renderToggle() ? (
            <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-3 py-2">
              {renderToggle()}
            </div>
          ) : null}

          <div className="text-right">
            <Link href="/forgot-password" className="text-xs text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
              Forgot password?
            </Link>
          </div>

          {error && <p className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--ll-yellow)] px-4 py-3 text-base font-semibold text-[var(--ll-text-faint)] shadow-lg shadow-emerald-500/30 hover:bg-[var(--ll-yellow-soft)] disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Continue"}
          </button>
        </form>

        {showDemoHints && demoGroups.length > 0 ? (
          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-faint)]">Demo help</p>
                <p className="mt-1 text-xs leading-5 text-[var(--ll-text-muted)]">
                  Seeded test accounts are available when demo mode is enabled. Keep this secondary to normal sign-in.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDemoHelp((current) => !current)}
                className="shrink-0 rounded-full border border-[var(--ll-border)] px-3 py-1 text-[11px] font-semibold text-[var(--ll-text)] hover:border-[var(--ll-border)]"
              >
                {showDemoHelp ? "Hide" : "Show"}
              </button>
            </div>

            {showDemoHelp ? (
              <div className="mt-3">
                <DemoHints title="Demo Login Hints" groups={demoGroups} />
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[var(--ll-text-muted)]">
                {demoGroups.map((group) => (
                  <span
                    key={group.key}
                    className="rounded-full border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-3 py-1"
                  >
                    {group.label}: {group.email}
                  </span>
                ))}
              </div>
            )}
          </section>
        ) : null}

        <div className="text-center text-[11px] text-[var(--ll-text-faint)]">
          <Link href="/" className="text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
            &#8592; Back to LiberiaLearn
          </Link>
        </div>
      </div>
      </div>

      <PublicFooter />
    </main>
  );
}


