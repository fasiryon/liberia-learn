// Re-export from the canonical push module so callers can import from "@/lib/push"
export { sendPushToUser, sendPushToMany, sendPushToSchool, sendPushToClass } from "@/lib/push/sendPush";
export type { PushPayload, PushResult } from "@/lib/push/sendPush";
