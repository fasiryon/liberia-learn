// lib/auth.ts
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email:    { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? "";
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            hashedPwd: true,
            schoolId: true,
            isPlatformAdmin: true,
          },
        });

        if (!user?.hashedPwd) return null;

        const ok = await bcrypt.compare(password, user.hashedPwd);
        if (!ok) return null;

        // Return payload becomes `user` in jwt callback
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
          schoolId: user.schoolId ?? null,
          isPlatformAdmin: user.isPlatformAdmin,
        } as any;
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
      }
      return session;
    },
  },

  pages: { signIn: "/login" },
};

// Typed helpers — use these in route handlers
export type SessionUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  role: "STUDENT" | "TEACHER" | "ADMIN" | "GUARDIAN" | "DISTRICT_ADMIN" | "MOE_OFFICIAL";
  schoolId?: string | null;
  isPlatformAdmin?: boolean;
  iat?: number | null;
};

/** Returns null if not authenticated. Does NOT throw. */
export async function getOptionalUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  const u = session?.user as any;
  if (!u?.id) return null;

  return {
    id: u.id,
    email: u.email ?? null,
    name: u.name ?? null,
    role: (u.role ?? "STUDENT"),
    schoolId: u.schoolId ?? null,
    isPlatformAdmin: u.isPlatformAdmin ?? false,
    iat: typeof u.iat === "number" ? u.iat : null,
  };
}

async function assertSessionFresh(userId: string, sessionIat?: number | null) {
  if (!sessionIat) return;
  const record = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordChangedAt: true },
  });
  if (!record?.passwordChangedAt) return;
  const changedAtMs = record.passwordChangedAt.getTime();
  if (sessionIat * 1000 < changedAtMs) {
    throw Object.assign(new Error("Session expired"), { status: 401 });
  }
}

/** Throws 401 if not authenticated. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getOptionalUser();
  if (!user) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  await assertSessionFresh(user.id, user.iat ?? null);
  return user;
}

/** Throws 401/403 if not authenticated or not in allowed roles. */
export async function requireRole(...roles: string[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
  return user;
}

/** Throws 401/403 if not a platform admin. */
export async function requirePlatformAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isPlatformAdmin) {
    throw Object.assign(new Error("Forbidden — platform admin required"), { status: 403 });
  }
  return user;
}
