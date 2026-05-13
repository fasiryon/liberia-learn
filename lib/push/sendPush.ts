import webpush from "web-push";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { logProductSignal } from "@/lib/autonomous/signals/productSignalService";

function getVapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@liberialearn.edu.lr";
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

async function deliver(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: PushPayload,
): Promise<"sent" | "expired" | "error"> {
  const vapid = getVapidConfig();
  if (!vapid) return "error";

  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  try {
    await webpush.sendNotification(
      { endpoint, keys: { p256dh, auth } },
      JSON.stringify(payload),
    );
    return "sent";
  } catch (err: any) {
    if (err.statusCode === 410 || err.statusCode === 404) return "expired";
    logger.warn("Push delivery failed", { endpoint: endpoint.slice(0, 40), statusCode: err.statusCode });
    return "error";
  }
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (!subs.length) return;
  const user = await Promise.resolve(
    (prisma as any).user?.findUnique?.({ where: { id: userId }, select: { schoolId: true, role: true } })
  ).catch(() => null);

  const expiredIds: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      const result = await deliver(sub.endpoint, sub.p256dh, sub.auth, payload);
      if (result === "expired") {
        expiredIds.push(sub.id);
      } else if (result === "sent") {
        await prisma.pushSubscription.update({
          where: { id: sub.id },
          data: { lastUsed: new Date() },
        });
        await prisma.notificationLog.create({
          data: {
            userId,
            channel: "push",
            recipient: sub.endpoint.slice(0, 100),
            subject: payload.title,
            body: payload.body,
            status: "sent",
          },
        });
        await logProductSignal({
          schoolId: user?.schoolId ?? null,
          userId,
          actor: { type: "system", id: "push-service" },
          target: { type: "push_subscription", id: sub.id },
          eventType: "push.notification.delivered",
          source: "lib/push/sendPush",
          dedupeKey: `push.notification.delivered:${user?.schoolId ?? "unknown"}:${sub.id}:${payload.url ?? "/"}:${Date.now()}`,
          metadata: {
            urlPath: payload.url ?? "/",
            recipientRole: user?.role ?? null,
          },
        });
      }
    }),
  );

  if (expiredIds.length) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: expiredIds } } });
  }
}

export async function sendPushToMany(userIds: string[], payload: PushPayload): Promise<void> {
  await Promise.all(userIds.map((uid) => sendPushToUser(uid, payload)));
}

export async function sendPushToSchool(schoolId: string, payload: PushPayload): Promise<void> {
  const users = await prisma.user.findMany({
    where: { schoolId },
    select: { id: true },
  });
  await sendPushToMany(users.map((u) => u.id), payload);
}

export async function sendPushToClass(classId: string, payload: PushPayload): Promise<void> {
  const enrollments = await prisma.enrollment.findMany({
    where: { classId },
    select: { Student: { select: { userId: true } } },
  });
  const userIds = enrollments.map((e) => e.Student.userId);
  await sendPushToMany(userIds, payload);
}
