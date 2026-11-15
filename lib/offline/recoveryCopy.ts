/** Learner recovery wording, T1 return 2026-11-15. No automatic-send promise for blocked work. */
export const RECOVERY_COPY = Object.freeze({
  saved: "Saved on this device. Open Offline Status to check it or try again.",
  waiting: "Waiting to send",
  savedOnDevice: "Saved on this device.",
  notSent: "Not sent yet",
  couldNotSend: "Could not send. Your work is still saved on this device.",
  retry: "Try again",
  retrying: "Trying again…",
  stillNotSent: "Still not sent. Your work is safe on this device. If this keeps happening, tell your teacher.",
  checking: "Checking saved work…",
  sending: "Sending saved work…",
  sent: "Everything has been sent",
  signIn: "Sign in again to send saved work",
  sentCount: (count: number) => `${count} item${count === 1 ? "" : "s"} sent`,
});
