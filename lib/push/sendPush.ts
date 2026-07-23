import webpush from "web-push";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { logProductSignal } from "@/lib/autonomous/signals/productSignalService";

function getVapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:admin@liberialearn.edu.lr";
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

export interface PushResult {
  sent: number;
  failed: number;
  smsFallback: number;
}

const SMS_FALLBACK_TYPES = [
  "New Assignment",
  "Assignment Graded",
  "Class is Live Now",
  "New Message",
  "Message from Student",
  "Reply from your teacher",
  "Message from Guardian",
];

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

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<PushResult> {
  const result: PushResult = { sent: 0, failed: 0, smsFallback: 0 };

  const [subs, user] = await Promise.all([
    prisma.pushSubscription.findMany({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { schoolId: true, role: true, guardianPhoneE164: true } }).catch(() => null),
  ]);

  if (!subs.length) {
    // No push subscriptions — try SMS fallback for supported notification types
    if (SMS_FALLBACK_TYPES.includes(payload.title) && user?.guardianPhoneE164) {
      try {
        const { sendSMS } = await import("@/lib/sms");
        const smsBody = `${payload.title}: ${payload.body}`.slice(0, 160);
        const smsResult = await sendSMS(user.guardianPhoneE164, smsBody);
        if (smsResult.ok) {
          result.smsFallback = 1;
          await prisma.notificationLog.create({
            data: {
              userId,
              channel: "sms",
              recipient: user.guardianPhoneE164.slice(0, 20),
              subject: payload.title,
              body: smsBody,
              status: "sent",
            },
          }).catch(() => null);
        }
      } catch {
        // Silent — SMS fallback is best-effort
      }
    }
    return result;
  }

  const expiredIds: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      const deliveryResult = await deliver(sub.endpoint, sub.p256dh, sub.auth, payload);
      if (deliveryResult === "expired") {
        expiredIds.push(sub.id);
        result.failed += 1;
      } else if (deliveryResult === "sent") {
        result.sent += 1;
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
      } else {
        result.failed += 1;
      }
    }),
  );

  if (expiredIds.length) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: expiredIds } } });
  }

  return result;
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
