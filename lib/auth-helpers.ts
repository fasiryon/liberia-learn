// lib/auth-helpers.ts
import { NextResponse } from "next/server";
import { requireUser, requireRole as requireCanonicalRole } from "./auth";

function authRefusal(error: unknown) {
  const status = (error as { status?: number } | null | undefined)?.status;
  const safeStatus = status === 401 || status === 403 || status === 428 ? status : 503;
  const messages = {
    401: "Unauthorized",
    403: "Forbidden",
    428: "Step-up required",
    503: "Authentication verification unavailable",
  };
  return NextResponse.json({ error: messages[safeStatus] }, { status: safeStatus });
}

export async function requireAuth() {
  try {
    return { session: { user: await requireUser() } };
  } catch (error) {
    return authRefusal(error);
  }
}

export async function requireRole(allowedRoles: string[]) {
  try {
    return { session: { user: await requireCanonicalRole(...allowedRoles) } };
  } catch (error) {
    return authRefusal(error);
  }
}
