import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { normalizeLoginId, normalizeCredentialPhone } from "@/lib/login-identifiers";

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
    },
  });
}

export async function authorizeCredentials(rawCredentials?: RawCredentialInput | null) {
  const credentials = {
    email: rawCredentials?.email ?? "",
    password: rawCredentials?.password ?? "",
    studentId: rawCredentials?.studentId ?? "",
    phone: rawCredentials?.phone ?? "",
  };

  if (!credentials.password) return null;

  const user = await findUserForCredentials(credentials);
  if (!user?.hashedPwd) return null;

  const ok = await bcrypt.compare(credentials.password, user.hashedPwd);
  if (!ok) return null;

  return {
    id: user.id,
    email: user.email,
    loginId: user.loginId ?? null,
    name: user.name ?? undefined,
    role: user.role,
    schoolId: user.schoolId ?? null,
    isPlatformAdmin: user.isPlatformAdmin,
  } as any;
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
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
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.schoolId = (user as any).schoolId ?? null;
        token.isPlatformAdmin = (user as any).isPlatformAdmin ?? false;
        token.loginId = (user as any).loginId ?? null;
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
  };
}

async function assertSessionFresh(userId: string, sessionIat?: number | null) {
  if (!sessionIat) return;
  const record = await prisma.user.findUnique({ where: { id: userId }, select: { passwordChangedAt: true } });
  if (!record?.passwordChangedAt) return;
  const changedAtMs = record.passwordChangedAt.getTime();
  if (sessionIat * 1000 < changedAtMs) {
    throw Object.assign(new Error("Session expired"), { status: 401 });
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getOptionalUser();
  if (!user) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  await assertSessionFresh(user.id, user.iat ?? null);
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

