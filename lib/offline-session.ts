"use client";

export type SessionPartitionInput = {
  userId?: string | null;
  kioskStudentId?: string | null;
  schoolId?: string | null;
  deviceId?: string | null;
};

export type SessionPartition = {
  userId: string | null;
  kioskStudentId: string | null;
  schoolId: string;
  deviceId: string;
  key: string;
};

const DEVICE_ID_KEY = "liberialearn_device_id";
const USER_ID_KEY = "liberialearn_user_id";
const KIOSK_STUDENT_ID_KEY = "liberialearn_kiosk_student_id";
const SCHOOL_ID_KEY = "liberialearn_school_id";

let activeSessionPartition: SessionPartitionInput | null = null;

function clean(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function createUuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random()}`;
}

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "server-device";
  const existing = clean(window.localStorage.getItem(DEVICE_ID_KEY));
  if (existing) return existing;
  const next = createUuid();
  window.localStorage.setItem(DEVICE_ID_KEY, next);
  return next;
}

function getStoredIdentity(): SessionPartitionInput {
  if (typeof window === "undefined") return {};
  return {
    userId: clean(window.localStorage.getItem(USER_ID_KEY)),
    kioskStudentId: clean(window.localStorage.getItem(KIOSK_STUDENT_ID_KEY)),
    schoolId: clean(window.localStorage.getItem(SCHOOL_ID_KEY)),
    deviceId: clean(window.localStorage.getItem(DEVICE_ID_KEY)),
  };
}

export function setActiveSessionPartition(partition: SessionPartitionInput): void {
  activeSessionPartition = {
    userId: clean(partition.userId),
    kioskStudentId: clean(partition.kioskStudentId),
    schoolId: clean(partition.schoolId),
    deviceId: clean(partition.deviceId),
  };

  if (typeof window === "undefined") return;

  if (activeSessionPartition.userId) {
    window.localStorage.setItem(USER_ID_KEY, activeSessionPartition.userId);
  } else {
    window.localStorage.removeItem(USER_ID_KEY);
  }

  if (activeSessionPartition.kioskStudentId) {
    window.localStorage.setItem(KIOSK_STUDENT_ID_KEY, activeSessionPartition.kioskStudentId);
  } else {
    window.localStorage.removeItem(KIOSK_STUDENT_ID_KEY);
  }

  if (activeSessionPartition.schoolId) {
    window.localStorage.setItem(SCHOOL_ID_KEY, activeSessionPartition.schoolId);
  } else {
    window.localStorage.removeItem(SCHOOL_ID_KEY);
  }

  if (activeSessionPartition.deviceId) {
    window.localStorage.setItem(DEVICE_ID_KEY, activeSessionPartition.deviceId);
  } else {
    window.localStorage.setItem(DEVICE_ID_KEY, getOrCreateDeviceId());
  }
}

export function clearActiveSessionPartition(): void {
  activeSessionPartition = null;
}

export function clearStoredSessionIdentity(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(USER_ID_KEY);
  window.localStorage.removeItem(KIOSK_STUDENT_ID_KEY);
  window.localStorage.removeItem(SCHOOL_ID_KEY);
}

export async function detectAndSetActiveSessionPartition(): Promise<SessionPartition> {
  try {
    const res = await fetch("/api/auth/session", { cache: "no-store" });
    if (res.ok) {
      const session = await res.json();
      const user = session?.user ?? null;
      setActiveSessionPartition({
        userId: clean(user?.id),
        schoolId: clean(user?.schoolId),
      });
    }
  } catch {
    // Keep existing/stored identity if session lookup fails.
  }
  return resolveSessionPartition();
}

export function resolveSessionPartition(partition?: SessionPartitionInput): SessionPartition {
  const source = {
    ...getStoredIdentity(),
    ...activeSessionPartition,
    ...partition,
  };
  const userId = clean(source.userId);
  const kioskStudentId = userId ? null : clean(source.kioskStudentId);
  const schoolId = clean(source.schoolId) ?? "unknown-school";
  const deviceId = clean(source.deviceId) ?? getOrCreateDeviceId();
  const principal = userId ? `u:${userId}` : kioskStudentId ? `k:${kioskStudentId}` : "anon";

  return {
    userId,
    kioskStudentId,
    schoolId,
    deviceId,
    key: `${principal}|s:${schoolId}|d:${deviceId}`,
  };
}

