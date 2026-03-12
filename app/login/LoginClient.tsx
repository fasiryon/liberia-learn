"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import type { DemoHintGroup } from "@/lib/demoHints";
import { DemoHints } from "@/components/DemoHints";
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

function defaultRouteForRole(role: string): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "TEACHER":
      return "/teacher";
    case "GUARDIAN":
      return "/guardian";
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

const TOUCH_INPUT = "min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-3 text-base text-slate-50 outline-none placeholder:text-slate-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/60";

export default function LoginClient({ showDemoHints, demoGroups, demoDefaults }: LoginClientProps) {
  const router = useRouter();
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

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
    const safeNext = nextUrl && isNextUrlSafeForRole(nextUrl, userRole) ? nextUrl : null;
    const destination = safeNext || (isPlatformAdmin ? "/platform" : defaultRouteForRole(userRole));
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
          className="text-sm text-emerald-300 hover:text-emerald-200"
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
          className="text-sm text-emerald-300 hover:text-emerald-200"
        >
          {guardianFields.toggleText}
        </button>
      );
    }

    return null;
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#22c55e33,_transparent_55%),radial-gradient(circle_at_bottom,_#0ea5e933,_transparent_55%)]" />

      <div className="w-full max-w-md space-y-6 rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-emerald-500/20 backdrop-blur">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-lg font-black text-slate-950">
            L
          </div>
          <h1 className="mt-1 text-lg font-semibold text-slate-50">Sign in to LiberiaLearn</h1>
          <p className="text-xs text-slate-400">Access your personalized lessons, assignments, and progress.</p>
        </div>

        {flashMessage && (
          <p className="rounded-lg border border-emerald-800 bg-emerald-950/40 px-3 py-3 text-sm text-emerald-200">
            {flashMessage}
          </p>
        )}

        {showDemoHints && demoGroups.length > 0 && <DemoHints title="Demo Login Hints" groups={demoGroups} />}

        <div className={`grid gap-2 text-xs ${guardianEnabled ? "grid-cols-4" : "grid-cols-3"}`}>
          {roleOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRole(option)}
              className={`rounded-full border px-2.5 py-2 capitalize ${
                role === option
                  ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                  : "border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500"
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300">{identifierLabel}</label>
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
            <label className="block text-xs font-medium text-slate-300">{secretLabel}</label>
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

          {renderToggle() && <div>{renderToggle()}</div>}

          <div className="text-right">
            <Link href="/forgot-password" className="text-xs text-emerald-300 hover:text-emerald-200">
              Forgot password?
            </Link>
          </div>

          {error && <p className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex min-h-11 w-full items-center justify-center rounded-xl bg-emerald-500 px-4 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-emerald-500/40 hover:bg-emerald-400 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Continue"}
          </button>
        </form>

        <div className="text-center text-[11px] text-slate-500">
          <Link href="/" className="text-emerald-300 hover:text-emerald-200">
            Back to homepage
          </Link>
        </div>
      </div>
    </main>
  );
}


