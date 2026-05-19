import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { normalizeLoginId, normalizeCredentialPhone } from "@/lib/login-identifiers";
import { checkRateLimit } from "@/lib/rateLimit";
import { withRedisCache } from "@/lib/cache/redisCache";

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

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
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
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        if (!user.email) return false;

        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: { id: true, role: true, googleId: true, school: { select: { googleSsoEnabled: true } } },
        });

        if (dbUser) {
          if (dbUser.role !== "TEACHER") return false;
          if (dbUser.school && dbUser.school.googleSsoEnabled === false) return false;
          if (!dbUser.googleId) {
            await prisma.user.update({
              where: { email: user.email },
              data: { googleId: user.id },
            });
          }
        } else {
          await prisma.user.create({
            data: {
              email: user.email,
              name: user.name ?? "New Teacher",
              role: "TEACHER",
              hashedPwd: "",
              googleId: user.id,
            },
          });
        }
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
  role: "STUDENT" | "TEACHER" | "ADMIN" | "GUARDIAN" | "DISTRICT_ADMIN" | "MOE_OFFICIAL";
  schoolId?: string | null;
  isPlatformAdmin?: boolean;
  iat?: number | null;
  mustChangePIN?: boolean;
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
  };
}

type FreshnessRecord = {
  passwordChangedAt: string | null;
  schoolId: string | null;
  isPlatformAdmin: boolean;
  schoolStatus: string | null;
};

async function assertSessionFresh(user: SessionUser) {
  // Cache DB freshness check for 120s — reduces DB load from O(VUs) to O(distinct users / 2min).
  // Tradeoff: password changes and school deactivations take up to 120s to propagate.
  const record = await withRedisCache<FreshnessRecord>(
    `cache:session-fresh:${user.id}`,
    120,
    async () => {
      const dbRecord = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          passwordChangedAt: true,
          schoolId: true,
          isPlatformAdmin: true,
          school: { select: { status: true } },
        },
      });
      if (!dbRecord) throw Object.assign(new Error("Unauthorized"), { status: 401 });
      return {
        passwordChangedAt: dbRecord.passwordChangedAt?.toISOString() ?? null,
        schoolId: dbRecord.schoolId,
        isPlatformAdmin: dbRecord.isPlatformAdmin,
        schoolStatus: dbRecord.school?.status ?? null,
      };
    }
  );

  if (record.schoolId && !record.isPlatformAdmin && record.schoolStatus !== "ACTIVE") {
    throw Object.assign(new Error("School inactive"), { status: 403 });
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
  await assertSessionFresh(user);
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
