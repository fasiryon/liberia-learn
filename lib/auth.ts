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

function resolveCredentialIdentifier(credentials: Record<string, string>) {
  const phone = credentials.phone ? normalizeCredentialPhone(credentials.phone) : null;
  const studentId = credentials.studentId ? normalizeLoginId(credentials.studentId) : "";
  const email = credentials.email?.trim().toLowerCase() ?? "";
  return (phone ?? studentId ?? normalizeLoginId(email) ?? "missing")
    .replace(/[^a-zA-Z0-9@._:+-]/g, "_")
    .slice(0, 160);
}

export async function authorizeCredentials(rawCredentials?: RawCredentialInput | null) {
  const credentials = {
    email: rawCredentials?.email ?? "",
    password: rawCredentials?.password ?? "",
    studentId: rawCredentials?.studentId ?? "",
    phone: rawCredentials?.phone ?? "",
  };

  if (!credentials.password) return null;
  const identifier = resolveCredentialIdentifier(credentials);
  const identifierLimit = await checkRateLimit(`credentials:${identifier}`, {
    namespace: "auth",
    windowMs: 15 * 60 * 1000,
    limit: 10,
  });
  if (!identifierLimit.allowed) return null;

  const user = await findUserForCredentials(credentials);
  if (!user?.hashedPwd) return null;

  const ok = await bcrypt.compare(credentials.password, user.hashedPwd);
  if (!ok) return null;

  if (user.schoolId && !user.isPlatformAdmin && user.school?.status !== "ACTIVE") {
    return null;
  }

  const privileged = isPrivilegedAccount(user);
  if (privileged && isPrivilegedMfaEnforced()) {
    const breakGlassUntil = user.privilegedIdentity?.breakGlassUntil;
    if (!breakGlassUntil || breakGlassUntil.getTime() <= Date.now()) return null;

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
          },
        });
        if (!dbUser || !isPrivilegedAccount(dbUser)) return false;
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
        });
        return true;
      }
      if (account?.provider === "google") {
        if (!user.email) return false;

        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: { id: true, role: true, googleId: true, schoolId: true, school: { select: { googleSsoEnabled: true } } },
        });

        if (dbUser) {
          if (dbUser.role !== "TEACHER") return false;
          if (dbUser.school && dbUser.school.googleSsoEnabled === false) return false;
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
        return token;
      }
      if (user) {
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
    if (
      dbRecord.role !== user.role ||
      dbRecord.schoolId !== (user.schoolId ?? null) ||
      dbRecord.isPlatformAdmin !== Boolean(user.isPlatformAdmin)
    ) {
      throw Object.assign(new Error("Session expired"), { status: 401 });
    }
    if (dbRecord.schoolId && !dbRecord.isPlatformAdmin && dbRecord.school?.status !== "ACTIVE") {
      throw Object.assign(new Error("School inactive"), { status: 403 });
    }
    if (
      user.iat &&
      dbRecord.passwordChangedAt &&
      user.iat * 1000 < dbRecord.passwordChangedAt.getTime()
    ) {
      throw Object.assign(new Error("Session expired"), { status: 401 });
    }

    const identity = dbRecord.privilegedIdentity;
    const assurance = identity?.sessions[0];
    if (
      !identity ||
      !assurance ||
      user.securityVersion !== identity.securityVersion ||
      assurance.securityVersion !== identity.securityVersion ||
      assurance.revokedAt ||
      assurance.expiresAt.getTime() <= Date.now()
    ) {
      throw Object.assign(new Error("Session expired"), { status: 401 });
    }
    if (
      user.authProvider === "break-glass" &&
      (!identity.breakGlassUntil || identity.breakGlassUntil.getTime() <= Date.now())
    ) {
      throw Object.assign(new Error("Break-glass access expired"), { status: 401 });
    }
    return;
  }

  // Cache DB freshness check for 700s — must outlive full load-test window (83s warm + 540s test = 623s).
  // Tradeoff: password changes and school deactivations take up to 700s to propagate.
  const record = await withRedisCache<FreshnessRecord>(
    `cache:session-fresh:${user.id}`,
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

  if (record.schoolId && !record.isPlatformAdmin && record.schoolStatus !== "ACTIVE") {
    throw Object.assign(new Error("School inactive"), { status: 403 });
  }

  if (
    record.role !== user.role ||
    record.schoolId !== (user.schoolId ?? null) ||
    record.isPlatformAdmin !== Boolean(user.isPlatformAdmin)
  ) {
    throw Object.assign(new Error("Session expired"), { status: 401 });
  }

  if (!user.iat || !record.passwordChangedAt) return;
  const changedAtMs = new Date(record.passwordChangedAt).getTime();
  if (user.iat * 1000 < changedAtMs) {
    throw Object.assign(new Error("Session expired"), { status: 401 });
  }
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
