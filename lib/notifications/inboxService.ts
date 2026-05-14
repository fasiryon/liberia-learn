import { prisma } from "@/lib/db";

export async function createInboxNotification(
  userId: string,
  payload: { title: string; body: string; url?: string; type?: string }
): Promise<void> {
  await prisma.notificationInboxItem
    .create({
      data: {
        userId,
        title: payload.title,
        body: payload.body,
        url: payload.url ?? null,
        type: payload.type ?? "info",
      },
    })
    .catch(() => null);
}
