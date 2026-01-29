import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          select: { id: true, email: true, name: true, role: true, hashedPwd: true },
        });

        if (!user?.hashedPwd) return null;

        const ok = await bcrypt.compare(credentials.password, user.hashedPwd);
        if (!ok) return null;

        return { id: user.id, email: user.email, name: user.name ?? undefined, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // @ts-expect-error custom field
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        // @ts-expect-error custom fields
        session.user.role = (token as any).role;
        // NextAuth puts user id on token.sub for jwt sessions
        // @ts-expect-error custom field
        session.user.id = token.sub;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
};

export type SessionUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  role?: any;
};

export type SessionUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  role?: any;
};

export async function getOptionalUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  const u: any = session?.user;
  if (!u) return null;

  return {
    id: u.id,
    email: u.email ?? null,
    name: u.name ?? null,
    role: u.role,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getOptionalUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function requireUserId(): Promise<string> {
  const user = await requireUser();
  if (!user.id) throw new Error("Unauthorized");
  return user.id;
}
