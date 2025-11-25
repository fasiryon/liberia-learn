// lib/auth-helpers.ts
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";

type AppSession = {
  user?: {
    id?: string;
    role?: string;
    email?: string | null;
    name?: string | null;
  };
};

export async function requireAuth() {
  const rawSession = await getServerSession(authOptions);
  const session = rawSession as AppSession;

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return { session };
}

export async function requireRole(allowedRoles: string[]) {
  const rawSession = await getServerSession(authOptions);
  const session = rawSession as AppSession;

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;

  if (!role || !allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { session };
}
