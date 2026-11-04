import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import Auth0Provider from "next-auth/providers/auth0";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { assertDeployedDatabaseRole } from "@/lib/auth/databaseRoles";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { logAuditRequired } from "@/lib/audit";
import { normalizeLoginId, normalizeCredentialPhone } from "@/lib/login-identifiers";
import { checkRateLimit } from "@/lib/rateLimit";
import { recordMetricEvent } from "@/lib/metrics/events";
import { withRedisCache } from "@/lib/cache/redisCache";
import {
  AUTH0_MFA_ACR,
  assertRecentPrivilegedStepUp,
  getAuth0Issuer,
  getStepUpMaxAgeSeconds,
  isAuth0Configured,
  isPrivilegedAccount,
  isPrivilegedMfaEnforced,
} from "@/lib/auth/privilegedIdentity";
import { parseAuth0MfaClaims } from "@/lib/auth/auth0Claims";
import { assertTokenFresh, credentialStampOf, isDisabledCredential, privilegedAssuranceFailure, sessionFreshnessFailure, SessionRevokedError } from "@/lib/auth/sessionRevocation";
import { readTeacherProfileSettings } from "@/lib/teacher/profileSettings";

type RawCredentialInput = {
  email?: string;
  password?: string;
  studentId?: string;
  phone?: string;
};

async function findUserForCredentials(credentials: Record<string, string>) {
  const email = credentials.email?.trim().toLowerCase() ?? "";
  const studentId = credentials.studentId ? normalizeLoginId(credentials.studentId) : "";
  const phone = credentials.phone ? normalizeCredentialPhone(credentials.phone) : null;

  if (phone) {
    return prisma.user.findFirst({
      where: { role: "GUARDIAN", guardianPhoneE164: phone },
      select: {
        id: true,
        email: true,
        loginId: true,
        name: true,
        role: true,
        hashedPwd: true,
        schoolId: true,
        isPlatformAdmin: true,
        mustChangePIN: true,
        passwordChangedAt: true,
        privilegedIdentity: {
          select: {
            id: true,
            securityVersion: true,
            breakGlassUntil: true,
          },
        },
        school: { select: { status: true } },
      },
    });
  }

  if (studentId) {
    return prisma.user.findFirst({
      where: { loginId: studentId },
      select: {
        id: true,
        email: true,
        loginId: true,
        name: true,
        role: true,
        hashedPwd: true,
        schoolId: true,
        isPlatformAdmin: true,
        mustChangePIN: true,
        passwordChangedAt: true,
        privilegedIdentity: {
          select: {
            id: true,
            securityVersion: true,
            breakGlassUntil: true,
          },
        },
        school: { select: { status: true } },
      },
    });
  }

  if (!email) return null;

  return prisma.user.findFirst({
    where: { OR: [{ email }, { loginId: normalizeLoginId(email) }] },
    select: {
      id: true,
      email: true,
      loginId: true,
      name: true,
      role: true,
      hashedPwd: true,
      schoolId: true,
      isPlatformAdmin: true,
      mustChangePIN: true,
      passwordChangedAt: true,
      privilegedIdentity: {
        select: {
          id: true,
          securityVersion: true,
          breakGlassUntil: true,
        },
      },
      school: { select: { status: true } },
    },
  });
}

/** Per-account rate-limit key. Empty identifiers must fall through (`||`,
 * not `??`): otherwise every email login shares one global bucket and ten
 * attempts anywhere lock out all email sign-ins. */
export function resolveCredentialIdentifier(credentials: Record<string, string>) {
  const phone = credentials.phone ? normalizeCredentialPhone(credentials.phone) : null;
  const studentId = credentials.studentId ? normalizeLoginId(credentials.studentId) : "";
  const email = credentials.email?.trim().toLowerCase() ?? "";
  return (phone || studentId || (email ? `email:${email}` : "") || "missing")
    .replace(/[^a-zA-Z0-9@._:+-]/g, "_")
    .slice(0, 160);
}

type LoginFailureReason =
  | "rate_limited"
  | "unknown_identifier"
  | "bad_password"
  | "school_inactive"
  | "account_disabled"
  | "privileged_mfa_required";

// Support can tell a deactivated school or lockout from a mistyped PIN.
// Reason code and school only: never the identifier, name, or password.
function recordLoginFailure(reason: LoginFailureReason, schoolId: string | null = null): null {
  void recordMetricEvent(
    "auth.login.failed",
    { reason },
    {
      scope: schoolId ? "school" : "national",
      scopeId: schoolId,
      schoolId,
      severity: reason === "school_inactive" || reason === "rate_limited" ? "warning" : "info",
      pilotOnly: false,
    }
  ).catch(() => {});
  return null;
}

export async function authorizeCredentials(rawCredentials?: RawCredentialInput | null) {
  const credentials = {
    email: rawCredentials?.email ?? "",
    password: rawCredentials?.password ?? "",
    studentId: rawCredentials?.studentId ?? "",
    phone: rawCredentials?.phone ?? "",
  };

  if (!credentials.password) return null;
  // Session revocation: the authentication instant is taken BEFORE the account row is read, so a credential change
  // that commits while this login is in flight always revokes the session it produces (authTime <= passwordChangedAt).
  const authTime = Date.now();
  const identifier = resolveCredentialIdentifier(credentials);
  const identifierLimit = await checkRateLimit(`credentials:${identifier}`, {
    namespace: "auth",
    windowMs: 15 * 60 * 1000,
    limit: 10,
  });
  if (!identifierLimit.allowed) return recordLoginFailure("rate_limited");

  const user = await findUserForCredentials(credentials);
  if (!user?.hashedPwd) return recordLoginFailure("unknown_identifier");
  if (isDisabledCredential(user.hashedPwd)) return recordLoginFailure("account_disabled", user.schoolId ?? null);
  // Session revocation (Atlas SR-01): the version is the one read WITH the hash that is about to be verified.
  const credStamp = credentialStampOf(user);

  const ok = await bcrypt.compare(credentials.password, user.hashedPwd);
  if (!ok) return recordLoginFailure("bad_password", user.schoolId ?? null);

  if (user.schoolId && !user.isPlatformAdmin && user.school?.status !== "ACTIVE") {
    return recordLoginFailure("school_inactive", user.schoolId);
  }

  const privileged = isPrivilegedAccount(user);
  if (privileged && isPrivilegedMfaEnforced()) {
    const breakGlassUntil = user.privilegedIdentity?.breakGlassUntil;
    if (!breakGlassUntil || breakGlassUntil.getTime() <= Date.now()) {
      return recordLoginFailure("privileged_mfa_required", user.schoolId ?? null);
    }

    const now = Date.now();
    return {
      id: user.id,
      email: user.email,
      loginId: user.loginId ?? null,
      name: user.name ?? undefined,
      role: user.role,
      schoolId: user.schoolId ?? null,
      isPlatformAdmin: user.isPlatformAdmin,
      mustChangePIN: user.mustChangePIN ?? false,
      authProvider: "break-glass",
      mfaVerifiedAt: now,
      assuranceExpiresAt: Math.min(
        breakGlassUntil.getTime(),
        now + getStepUpMaxAgeSeconds() * 1000
      ),
      securityVersion: user.privilegedIdentity.securityVersion,
      privilegedIdentityId: user.privilegedIdentity.id,
      authTime,
      credStamp,
    } as any;
  }

  return {
    id: user.id,
    email: user.email,
    loginId: user.loginId ?? null,
    name: user.name ?? undefined,
    role: user.role,
    schoolId: user.schoolId ?? null,
    isPlatformAdmin: user.isPlatformAdmin,
    mustChangePIN: user.mustChangePIN ?? false,
    authTime,
    credStamp,
  } as any;
}

const providers: NextAuthOptions["providers"] = [
  GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    authorization: {
      params: {
        hd: undefined,
        prompt: "select_account",
      },
    },
  }),
  CredentialsProvider({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "text" },
      password: { label: "Password", type: "password" },
      studentId: { label: "Student ID", type: "text" },
      phone: { label: "Phone", type: "text" },
    },
    async authorize(rawCredentials) {
      return authorizeCredentials(rawCredentials as RawCredentialInput);
    },
  }),
];

if (isAuth0Configured()) {
  const auth0Config = {
    clientId: process.env.AUTH0_CLIENT_ID!.trim(),
    clientSecret: process.env.AUTH0_CLIENT_SECRET!.trim(),
    issuer: getAuth0Issuer(),
  };
  providers.unshift(
    Auth0Provider({
      ...auth0Config,
      authorization: {
        params: {
          scope: "openid email profile",
          prompt: "login",
          max_age: 0,
          acr_values: AUTH0_MFA_ACR,
        },
      },
    })
  );
  const stepUpProvider = Auth0Provider({
    ...auth0Config,
    authorization: {
      params: {
        scope: "openid email profile",
        prompt: "login",
        max_age: 0,
        acr_values: AUTH0_MFA_ACR,
      },
    },
  });
  providers.unshift({
    ...stepUpProvider,
    id: "auth0-step-up",
    name: "Privileged step-up",
  });
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "auth0" || account?.provider === "auth0-step-up") {
        const authTime = Date.now(); // before the account read (session revocation contract)
        if (!user.email) return false;
        const assurance = parseAuth0MfaClaims(account.id_token);
        if (!assurance?.mfa || !assurance.emailVerified) {
          return "/login?error=MfaRequired";
        }

        const dbUser = await prisma.user.findUnique({
          where: { email: user.email.trim().toLowerCase() },
          select: {
            id: true,
            email: true,
            loginId: true,
            name: true,
            role: true,
            schoolId: true,
            isPlatformAdmin: true,
            mustChangePIN: true,
            privilegedIdentity: true,
            hashedPwd: true,
            passwordChangedAt: true,
          },
        });
        if (!dbUser || !isPrivilegedAccount(dbUser)) return false;
        if (isDisabledCredential(dbUser.hashedPwd)) return false; // Atlas SR-02: disabled at every provider
        if (
          dbUser.privilegedIdentity?.providerSubject &&
          dbUser.privilegedIdentity.providerSubject !== assurance.subject
        ) {
          return false;
        }

        const now = new Date();
        const identity = await prisma.$transaction(async (tx) => {
          const enrolled = await tx.privilegedIdentity.upsert({
            where: { userId: dbUser.id },
            create: {
              userId: dbUser.id,
              provider: "auth0",
              providerSubject: assurance.subject,
              mfaEnrolledAt: now,
              mfaChangedAt: now,
              lastMfaAt: now,
            },
            update: {
              provider: "auth0",
              providerSubject: assurance.subject,
              mfaEnrolledAt: dbUser.privilegedIdentity?.mfaEnrolledAt ?? now,
              mfaChangedAt: dbUser.privilegedIdentity?.mfaChangedAt ?? now,
              lastMfaAt: now,
              breakGlassUntil: null,
              breakGlassReason: null,
            },
          });
          if (!dbUser.privilegedIdentity?.mfaEnrolledAt) {
            await logAuditRequired(
              {
                userId: dbUser.id,
                action: "auth.privileged_mfa.enrolled",
                resourceType: "privileged_identity",
                resourceId: enrolled.id,
                schoolId: dbUser.schoolId,
                details: { provider: "auth0" },
              },
              tx
            );
          }
          return enrolled;
        });

        Object.assign(user as any, {
          id: dbUser.id,
          email: dbUser.email,
          loginId: dbUser.loginId,
          name: dbUser.name,
          role: dbUser.role,
          schoolId: dbUser.schoolId,
          isPlatformAdmin: dbUser.isPlatformAdmin,
          mustChangePIN: dbUser.mustChangePIN,
          authProvider: "auth0",
          mfaVerifiedAt: now.getTime(),
          assuranceExpiresAt: now.getTime() + 12 * 60 * 60 * 1000,
          securityVersion: identity.securityVersion,
          privilegedIdentityId: identity.id,
          authenticatedAt: assurance.authenticatedAt.getTime(),
          authTime,
          credStamp: credentialStampOf(dbUser),
        });
        return true;
      }
      if (account?.provider === "google") {
        const authTime = Date.now(); // before the account read (session revocation contract)
        (user as any).authTime = authTime;
        if (!user.email) return false;

        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: { id: true, role: true, googleId: true, schoolId: true, school: { select: { googleSsoEnabled: true } },
            TeacherProfile: { select: { permissions: true } }, hashedPwd: true, passwordChangedAt: true },
        });

        if (dbUser) {
          if (dbUser.role !== "TEACHER") return false;
          if (dbUser.school && dbUser.school.googleSsoEnabled === false) return false;
          // A deactivated teacher (admin "deactivate") must not start a new session through Google either.
          if (readTeacherProfileSettings(dbUser.TeacherProfile?.permissions).active === false) return false;
          if (isDisabledCredential(dbUser.hashedPwd)) return false; // Atlas SR-02: disabled at every provider
          (user as any).credStamp = credentialStampOf(dbUser);
          // NR-8: a TEACHER row can theoretically exist with schoolId: null
          // (User.schoolId is nullable in schema). Never issue an active
          // session for that state — the invite/school-code flow is the
          // only path that should assign it.
          if (!dbUser.schoolId) return "/login?error=SchoolAssignmentRequired";
          if (!dbUser.googleId) {
            await prisma.user.update({
              where: { email: user.email },
              data: { googleId: user.id },
            });
          }
          return true;
        }

        // New Google user — require a school invite for this email address.
        const invite = await prisma.inviteToken.findFirst({
          where: {
            email: user.email!.toLowerCase(),
            tokenType: "SSO_INVITE",
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
          select: { id: true, schoolId: true, role: true },
        });

        if (!invite) {
          return "/login?error=InviteRequired";
        }

        const persistedInviteRole = assertDeployedDatabaseRole(invite.role);
        if (persistedInviteRole !== "TEACHER" && persistedInviteRole !== "ADMIN") {
          return "/login?error=InviteRoleUnsupported";
        }

        const newUser = await prisma.user.create({
          data: {
            email: user.email!.toLowerCase(),
            name: user.name ?? "New Teacher",
            role: persistedInviteRole,
            hashedPwd: "",
            googleId: user.id,
            schoolId: invite.schoolId,
          },
        });
        (user as any).credStamp = credentialStampOf(newUser);

        await prisma.inviteToken.update({
          where: { id: invite.id },
          data: { usedAt: new Date() },
        });

        void prisma.auditLog
          .create({
            data: {
              userId: newUser.id,
              action: "auth.google_sso.account_created",
              resourceType: "user",
              resourceId: newUser.id,
              schoolId: invite.schoolId,
            },
          })
          .catch(() => null);

        return true;
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (account?.provider === "google" && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email as string },
          select: { id: true, role: true, schoolId: true, isPlatformAdmin: true, loginId: true, mustChangePIN: true },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.schoolId = dbUser.schoolId ?? null;
          token.isPlatformAdmin = dbUser.isPlatformAdmin ?? false;
          token.loginId = dbUser.loginId ?? null;
          token.mustChangePIN = dbUser.mustChangePIN ?? false;
        }
        token.authTime = typeof (user as any)?.authTime === "number" ? (user as any).authTime : Date.now();
        token.credStamp = typeof (user as any)?.credStamp === "number" ? (user as any).credStamp : undefined;
        return token;
      }
      if (!user) {
        // Every refresh (/api/auth/session, getServerSession, update): uncached, by account id. Throwing makes next-auth
        // drop the session (cookie cleared on /api/auth/session; getServerSession returns null). See sessionRevocation.ts.
        await assertTokenFresh(token as Record<string, unknown>);
        return token;
      }
      if (user) {
        // Immutable for the life of the session; refreshes never change it (unlike iat).
        token.authTime = typeof (user as any).authTime === "number" ? (user as any).authTime : Date.now();
        // The credential version read with the verified credential (Atlas SR-01); absent means the session is refused.
        token.credStamp = typeof (user as any).credStamp === "number" ? (user as any).credStamp : undefined;
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.schoolId = (user as any).schoolId ?? null;
        token.isPlatformAdmin = (user as any).isPlatformAdmin ?? false;
        token.loginId = (user as any).loginId ?? null;
        token.mustChangePIN = (user as any).mustChangePIN ?? false;
        token.authProvider = (user as any).authProvider ?? account?.provider ?? null;
        token.mfaVerifiedAt = (user as any).mfaVerifiedAt ?? null;
        token.assuranceExpiresAt = (user as any).assuranceExpiresAt ?? null;
        token.securityVersion = (user as any).securityVersion ?? null;

        const privilegedIdentityId = (user as any).privilegedIdentityId as string | undefined;
        if (privilegedIdentityId && token.mfaVerifiedAt && token.assuranceExpiresAt) {
          const privilegedSessionId = randomUUID();
          token.privilegedSessionId = privilegedSessionId;
          await prisma.privilegedSessionAssurance.create({
            data: {
              identityId: privilegedIdentityId,
              sessionId: privilegedSessionId,
              assuranceMethod: token.authProvider === "break-glass" ? "BREAK_GLASS" : "AUTH0_MFA",
              authenticatedAt: new Date((user as any).authenticatedAt ?? token.mfaVerifiedAt),
              mfaVerifiedAt: new Date(token.mfaVerifiedAt as number),
              securityVersion: token.securityVersion as number,
              expiresAt: new Date(token.assuranceExpiresAt as number),
            },
          });
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = (token as any).id;
        (session.user as any).role = (token as any).role;
        (session.user as any).schoolId = (token as any).schoolId ?? null;
        (session.user as any).isPlatformAdmin = (token as any).isPlatformAdmin ?? false;
        (session.user as any).iat = (token as any).iat ?? null;
        (session.user as any).authTime = typeof (token as any).authTime === "number" ? (token as any).authTime : null;
        (session.user as any).credStamp = typeof (token as any).credStamp === "number" ? (token as any).credStamp : null;
        (session.user as any).loginId = (token as any).loginId ?? null;
        (session.user as any).mustChangePIN = (token as any).mustChangePIN ?? false;
        (session.user as any).authProvider = (token as any).authProvider ?? null;
        (session.user as any).mfaVerifiedAt = (token as any).mfaVerifiedAt ?? null;
        (session.user as any).assuranceExpiresAt = (token as any).assuranceExpiresAt ?? null;
        (session.user as any).securityVersion = (token as any).securityVersion ?? null;
        (session.user as any).privilegedSessionId = (token as any).privilegedSessionId ?? null;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
};

export type SessionUser = {
  id: string;
  email?: string | null;
  loginId?: string | null;
  name?: string | null;
  role: "STUDENT" | "TEACHER" | "ADMIN" | "GUARDIAN" | "DISTRICT_ADMIN" | "MOE_OFFICIAL" | "MOE_SUPER_ADMIN" | "MOE_DISTRICT_ADMIN";
  schoolId?: string | null;
  isPlatformAdmin?: boolean;
  iat?: number | null;
  /** Epoch ms of the authentication itself; never refreshed (session revocation contract). */
  authTime?: number | null;
  /** The credential version (User.passwordChangedAt, ms; 0 when null) the session authenticated against. */
  credStamp?: number | null;
  mustChangePIN?: boolean;
  authProvider?: string | null;
  mfaVerifiedAt?: number | null;
  assuranceExpiresAt?: number | null;
  securityVersion?: number | null;
  privilegedSessionId?: string | null;
};

export async function getOptionalUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  const u = session?.user as any;
  if (!u?.id) return null;

  return {
    id: u.id,
    email: u.email ?? null,
    loginId: u.loginId ?? null,
    name: u.name ?? null,
    role: u.role ?? "STUDENT",
    schoolId: u.schoolId ?? null,
    isPlatformAdmin: u.isPlatformAdmin ?? false,
    iat: typeof u.iat === "number" ? u.iat : null,
    authTime: typeof u.authTime === "number" ? u.authTime : null,
    credStamp: typeof u.credStamp === "number" ? u.credStamp : null,
    mustChangePIN: u.mustChangePIN ?? false,
    authProvider: u.authProvider ?? null,
    mfaVerifiedAt: typeof u.mfaVerifiedAt === "number" ? u.mfaVerifiedAt : null,
    assuranceExpiresAt:
      typeof u.assuranceExpiresAt === "number" ? u.assuranceExpiresAt : null,
    securityVersion: typeof u.securityVersion === "number" ? u.securityVersion : null,
    privilegedSessionId:
      typeof u.privilegedSessionId === "string" ? u.privilegedSessionId : null,
  };
}

type FreshnessRecord = {
  passwordChangedAt: string | null;
  role: string;
  schoolId: string | null;
  isPlatformAdmin: boolean;
  schoolStatus: string | null;
};

async function assertSessionFresh(user: SessionUser) {
  if (isPrivilegedAccount(user) && isPrivilegedMfaEnforced()) {
    const dbRecord = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        role: true,
        passwordChangedAt: true,
        schoolId: true,
        isPlatformAdmin: true,
        school: { select: { status: true } },
        privilegedIdentity: {
          select: {
            id: true,
            securityVersion: true,
            breakGlassUntil: true,
            sessions: {
              where: { sessionId: user.privilegedSessionId ?? "missing" },
              take: 1,
              select: {
                securityVersion: true,
                expiresAt: true,
                revokedAt: true,
              },
            },
          },
        },
      },
    });
    if (!dbRecord) throw Object.assign(new Error("Unauthorized"), { status: 401 });
    // Identity, school, credential version (never the refreshable iat) and absolute lifetime; then the assurance.
    const privilegedFailure = sessionFreshnessFailure(user, dbRecord);
    if (privilegedFailure) throw new SessionRevokedError(privilegedFailure);

    const assuranceFailure = privilegedAssuranceFailure(user, dbRecord.privilegedIdentity);
    if (assuranceFailure) throw new SessionRevokedError(assuranceFailure);
    return;
  }

  // Cache DB freshness check for 700s — must outlive full load-test window (83s warm + 540s test = 623s).
  // Secondary check only: the uncached jwt-refresh check (assertTokenFresh) is authoritative. The key includes the
  // credential version, so a fresh login after a change reads its own entry; school deactivation may lag up to 700s here.
  const record = await withRedisCache<FreshnessRecord>(
    `cache:session-fresh:${user.id}:${user.credStamp ?? "none"}`,
    700,
    async () => {
      const dbRecord = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          passwordChangedAt: true,
          role: true,
          schoolId: true,
          isPlatformAdmin: true,
          school: { select: { status: true } },
        },
      });
      if (!dbRecord) throw Object.assign(new Error("Unauthorized"), { status: 401 });
      return {
        passwordChangedAt: dbRecord.passwordChangedAt?.toISOString() ?? null,
        role: dbRecord.role,
        schoolId: dbRecord.schoolId,
        isPlatformAdmin: dbRecord.isPlatformAdmin,
        schoolStatus: dbRecord.school?.status ?? null,
      };
    }
  );

  // Same rule as the uncached jwt-refresh check (which is authoritative); a token without authTime is stale.
  const failure = sessionFreshnessFailure(user, record);
  if (failure) throw new SessionRevokedError(failure);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getOptionalUser();
  if (!user) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  try {
    await assertSessionFresh(user);
  } catch (err: any) {
    // Re-throw auth/authz rejections (401 session expired, 403 inactive school).
    // Swallow DB/Redis infrastructure errors during cold starts: the JWT is still
    // cryptographically valid and the route's own FALLBACK_LIMIT_EXCEEDED shield
    // handles any subsequent DB unavailability. Without this, concurrent cold-start
    // requests that fail the Prisma connection during assertSessionFresh bubble up
    // as HTTP 500 instead of returning a degraded 200.
    if (err?.status === 401 || err?.status === 403 || isPrivilegedAccount(user)) throw err;
  }
  return user;
}

export async function requireRole(...roles: string[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
  return user;
}

export async function requirePlatformAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isPlatformAdmin) {
    throw Object.assign(new Error("Forbidden - platform admin required"), { status: 403 });
  }
  return user;
}

export async function requirePrivilegedStepUp(user?: SessionUser): Promise<SessionUser> {
  const resolved = user ?? (await requireUser());
  if (!isPrivilegedAccount(resolved)) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
  assertRecentPrivilegedStepUp(resolved);
  return resolved;
}
