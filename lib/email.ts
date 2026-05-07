// lib/email.ts
import type { Resend } from "resend";
import { logger } from "@/lib/logger";

type RecipientRole = "principal" | "platform_admin" | "teacher" | "student" | "guardian" | "user";

export type EmailSendResult = { ok: boolean; id?: string; error?: string };

export type EmailEnvelope = {
  to: string;
  subject: string;
  html: string;
  text: string;
  type: string;
  recipientRole: RecipientRole;
  transactional?: boolean;
};

const FROM =
  process.env.EMAIL_FROM ??
  process.env.RESEND_FROM_EMAIL ??
  "LiberiaLearn <noreply@liberialearn.edu.lr>";

let resendCtor: typeof import("resend").Resend | null = null;

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  if (!resendCtor) {
    resendCtor = require("resend").Resend;
  }
  return new resendCtor(apiKey);
}

function logEmailWarning(input: {
  type: string;
  recipientRole: RecipientRole;
  reason: string;
  provider?: string;
}) {
  const metadata = {
    emailType: input.type,
    recipientRole: input.recipientRole,
    reason: input.reason,
    provider: input.provider ?? "resend",
  };

  logger.warn("[EMAIL] delivery warning", metadata);

  if (process.env.NODE_ENV !== "test") {
    try {
      const Sentry = require("@sentry/nextjs");
      Sentry.captureMessage("Email delivery warning", {
        level: "warning",
        tags: {
          component: "email",
          emailType: input.type,
          recipientRole: input.recipientRole,
        },
        extra: {
          reason: input.reason,
          provider: metadata.provider,
        },
      });
    } catch {
      // Email warnings are best-effort; delivery behavior should not depend on telemetry import success.
    }
  }
}

export async function sendEmail(input: EmailEnvelope): Promise<EmailSendResult> {
  if (process.env.NODE_ENV === "test") {
    return { ok: true, id: "test-no-send" };
  }

  const resend = getResendClient();
  if (!resend) {
    logEmailWarning({
      type: input.type,
      recipientRole: input.recipientRole,
      reason: "provider_credentials_missing",
    });
    return { ok: true, id: "email-disabled" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    if (error) {
      logEmailWarning({
        type: input.type,
        recipientRole: input.recipientRole,
        reason: error.message,
      });
      return { ok: false, error: error.message };
    }

    return { ok: true, id: data?.id };
  } catch (err: any) {
    const reason = err?.message ?? String(err);
    logEmailWarning({
      type: input.type,
      recipientRole: input.recipientRole,
      reason,
    });
    return { ok: false, error: reason };
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraph(text: string) {
  return `<p style="margin:0 0 12px;color:#cbd5e1;font-size:15px;line-height:1.6">${text}</p>`;
}

function button(text: string, url: string) {
  return `<a href="${escapeHtml(url)}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;font-size:15px">${escapeHtml(text)}</a>`;
}

function brandedLayout(input: {
  title?: string;
  preview: string;
  content: string;
  unsubscribeUrl?: string;
}) {
  const unsubscribe = input.unsubscribeUrl
    ? `<p style="margin:12px 0 0;color:#94a3b8;font-size:12px;text-align:center"><a href="${escapeHtml(
        input.unsubscribeUrl
      )}" style="color:#99f6e4">Unsubscribe</a> from non-essential emails.</p>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(input.title ?? "LiberiaLearn")}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden">${escapeHtml(input.preview)}</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:8px;overflow:hidden">
        <tr><td style="background:#1b4332;padding:20px 24px">
          <h1 style="margin:0;color:#fff;font-size:22px;letter-spacing:0">LiberiaLearn</h1>
          <p style="margin:4px 0 0;color:#bbf7d0;font-size:13px">National learning platform for Liberian schools</p>
        </td></tr>
        <tr><td style="padding:24px">
          ${input.content}
        </td></tr>
        <tr><td style="padding:16px 24px;border-top:1px solid #1e293b">
          <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center">
            LiberiaLearn helps schools deliver lessons, track progress, and keep families informed.
          </p>
          ${unsubscribe}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function textBlock(lines: Array<string | undefined | null>) {
  return lines.filter(Boolean).join("\n\n");
}

export async function sendSchoolEnrollmentReceived({
  to,
  principalName,
  schoolName,
  loginId,
  temporaryPassword,
}: {
  to: string;
  principalName?: string;
  schoolName: string;
  loginId: string;
  temporaryPassword: string;
}): Promise<EmailSendResult> {
  const subject = `School enrollment received - ${schoolName}`;
  const text = textBlock([
    `Hello ${principalName ?? "Principal"},`,
    `Your school enrollment request for ${schoolName} has been received and is pending platform approval.`,
    `Login ID: ${loginId}`,
    `Temporary password: ${temporaryPassword}`,
    "You will receive another email when the school is approved.",
  ]);
  const html = brandedLayout({
    title: subject,
    preview: `Your enrollment request for ${schoolName} was received.`,
    content:
      paragraph(`Hello ${escapeHtml(principalName ?? "Principal")},`) +
      paragraph(`Your school enrollment request for <strong>${escapeHtml(schoolName)}</strong> has been received and is pending platform approval.`) +
      paragraph(`Login ID: <strong>${escapeHtml(loginId)}</strong>`) +
      paragraph(`Temporary password: <strong>${escapeHtml(temporaryPassword)}</strong>`) +
      paragraph("You will receive another email when the school is approved."),
  });
  return sendEmail({ to, subject, html, text, type: "school_enrollment_received", recipientRole: "principal" });
}

export async function sendSchoolApprovalNotice({
  to,
  principalName,
  schoolName,
  schoolCode,
  loginUrl,
}: {
  to: string;
  principalName?: string;
  schoolName: string;
  schoolCode: string;
  loginUrl: string;
}): Promise<EmailSendResult> {
  const subject = `School approved - ${schoolName}`;
  const text = textBlock([
    `Hello ${principalName ?? "Principal"},`,
    `${schoolName} has been approved on LiberiaLearn.`,
    `School code: ${schoolCode}`,
    `Login: ${loginUrl}`,
  ]);
  const html = brandedLayout({
    title: subject,
    preview: `${schoolName} has been approved.`,
    content:
      paragraph(`Hello ${escapeHtml(principalName ?? "Principal")},`) +
      paragraph(`<strong>${escapeHtml(schoolName)}</strong> has been approved on LiberiaLearn.`) +
      paragraph(`Your school code is <strong>${escapeHtml(schoolCode)}</strong>.`) +
      `<p style="margin:24px 0;text-align:center">${button("Go to Login", loginUrl)}</p>`,
  });
  return sendEmail({ to, subject, html, text, type: "school_approval", recipientRole: "principal" });
}

export async function sendSchoolOnboardingKit({
  to,
  principalName,
  schoolName,
  kitUrl,
}: {
  to: string;
  principalName: string;
  schoolName: string;
  kitUrl: string;
}): Promise<EmailSendResult> {
  const subject = `LiberiaLearn onboarding kit - ${schoolName}`;
  const text = textBlock([
    `Hello ${principalName},`,
    `Your LiberiaLearn onboarding kit for ${schoolName} is ready.`,
    `Onboarding assets: ${kitUrl}`,
    "Next steps: review the flyer, share the parent letter, and use the student guide during classroom setup.",
  ]);
  const html = brandedLayout({
    title: subject,
    preview: `Your onboarding kit for ${schoolName} is ready.`,
    content:
      paragraph(`Hello ${escapeHtml(principalName)},`) +
      paragraph(`Your LiberiaLearn onboarding kit for <strong>${escapeHtml(schoolName)}</strong> is ready.`) +
      paragraph("Review the flyer, share the parent letter, and use the student guide during classroom setup.") +
      `<p style="margin:24px 0;text-align:center">${button("Open Onboarding Kit", kitUrl)}</p>`,
  });
  return sendEmail({ to, subject, html, text, type: "school_onboarding_kit", recipientRole: "principal" });
}

export async function sendSchoolRejectionNotice({
  to,
  principalName,
  schoolName,
  reason,
}: {
  to: string;
  principalName?: string;
  schoolName: string;
  reason?: string | null;
}): Promise<EmailSendResult> {
  const subject = `School enrollment update - ${schoolName}`;
  const text = textBlock([
    `Hello ${principalName ?? "Principal"},`,
    `Your school enrollment request for ${schoolName} was not approved at this time.`,
    reason ? `Reason: ${reason}` : null,
    "You can reapply after addressing the missing information.",
  ]);
  const html = brandedLayout({
    title: subject,
    preview: `Enrollment update for ${schoolName}.`,
    content:
      paragraph(`Hello ${escapeHtml(principalName ?? "Principal")},`) +
      paragraph(`Your school enrollment request for <strong>${escapeHtml(schoolName)}</strong> was not approved at this time.`) +
      (reason ? paragraph(`Reason: ${escapeHtml(reason)}`) : "") +
      paragraph("You can reapply after addressing the missing information."),
  });
  return sendEmail({ to, subject, html, text, type: "school_rejection", recipientRole: "principal" });
}

export async function sendPlatformAdminSchoolPending({
  to,
  schoolName,
  county,
  principalName,
}: {
  to: string;
  schoolName: string;
  county?: string | null;
  principalName: string;
}): Promise<EmailSendResult> {
  const subject = `Pending school enrollment - ${schoolName}`;
  const text = textBlock([
    "A new school enrollment request needs review.",
    `School: ${schoolName}`,
    `County: ${county ?? "County not set"}`,
    `Principal: ${principalName}`,
  ]);
  const html = brandedLayout({
    title: subject,
    preview: `${schoolName} needs platform review.`,
    content:
      paragraph("A new school enrollment request needs review.") +
      paragraph(`<strong>${escapeHtml(schoolName)}</strong> - ${escapeHtml(county ?? "County not set")}`) +
      paragraph(`Principal: ${escapeHtml(principalName)}`),
  });
  return sendEmail({ to, subject, html, text, type: "platform_admin_school_pending", recipientRole: "platform_admin" });
}

export async function sendTeacherInvite({
  to,
  name,
  schoolName,
  inviteUrl,
}: {
  to: string;
  name?: string;
  schoolName: string;
  inviteUrl: string;
}): Promise<EmailSendResult> {
  const subject = `Teacher invitation - ${schoolName}`;
  const text = textBlock([
    `Hello ${name ?? "Teacher"},`,
    `You have been invited to join ${schoolName} on LiberiaLearn as a teacher.`,
    `Accept invitation: ${inviteUrl}`,
    "This link expires in 7 days.",
  ]);
  const html = brandedLayout({
    title: subject,
    preview: `You have been invited to teach with ${schoolName} on LiberiaLearn.`,
    content:
      paragraph(`Hello ${escapeHtml(name ?? "Teacher")},`) +
      paragraph(`You have been invited to join <strong>${escapeHtml(schoolName)}</strong> on LiberiaLearn as a teacher.`) +
      `<p style="margin:24px 0;text-align:center">${button("Accept Invitation", inviteUrl)}</p>` +
      paragraph("This link expires in 7 days."),
  });
  return sendEmail({ to, subject, html, text, type: "teacher_invite", recipientRole: "teacher" });
}

export async function sendStudentInvite({
  to,
  name,
  schoolName,
  inviteUrl,
}: {
  to: string;
  name?: string;
  schoolName: string;
  inviteUrl: string;
}): Promise<EmailSendResult> {
  const subject = `Student invitation - ${schoolName}`;
  const text = textBlock([
    `Hello ${name ?? "Student"},`,
    `You have been invited to join ${schoolName} on LiberiaLearn.`,
    `Join: ${inviteUrl}`,
    "This link expires in 7 days.",
  ]);
  const html = brandedLayout({
    title: subject,
    preview: `Start learning with ${schoolName} on LiberiaLearn.`,
    content:
      paragraph(`Hello ${escapeHtml(name ?? "Student")},`) +
      paragraph(`You have been invited to join <strong>${escapeHtml(schoolName)}</strong> on LiberiaLearn.`) +
      `<p style="margin:24px 0;text-align:center">${button("Join Now", inviteUrl)}</p>` +
      paragraph("This link expires in 7 days."),
  });
  return sendEmail({ to, subject, html, text, type: "student_invite", recipientRole: "student" });
}

export async function sendGuardianInvite({
  to,
  guardianName,
  studentName,
  schoolName,
  inviteUrl,
}: {
  to: string;
  guardianName?: string;
  studentName: string;
  schoolName: string;
  inviteUrl: string;
}): Promise<EmailSendResult> {
  const subject = `Guardian invitation - ${schoolName}`;
  const text = textBlock([
    `Hello ${guardianName ?? "Guardian"},`,
    `You have been invited to track ${studentName}'s progress at ${schoolName} on LiberiaLearn.`,
    `Accept invitation: ${inviteUrl}`,
    "This link expires in 7 days.",
  ]);
  const html = brandedLayout({
    title: subject,
    preview: `Track ${studentName}'s progress with ${schoolName}.`,
    content:
      paragraph(`Hello ${escapeHtml(guardianName ?? "Guardian")},`) +
      paragraph(`You have been invited to track <strong>${escapeHtml(studentName)}</strong>'s progress at <strong>${escapeHtml(schoolName)}</strong> on LiberiaLearn.`) +
      `<p style="margin:24px 0;text-align:center">${button("Accept Invitation", inviteUrl)}</p>` +
      paragraph("This link expires in 7 days."),
  });
  return sendEmail({ to, subject, html, text, type: "guardian_invite", recipientRole: "guardian" });
}

export async function sendGuardianWelcome({
  to,
  guardianName,
  schoolName,
  dashboardUrl,
}: {
  to: string;
  guardianName: string;
  schoolName: string;
  dashboardUrl: string;
}): Promise<EmailSendResult> {
  const subject = `Guardian account ready - ${schoolName}`;
  const text = textBlock([
    `Hello ${guardianName},`,
    `Your LiberiaLearn guardian account for ${schoolName} is ready.`,
    `Dashboard: ${dashboardUrl}`,
  ]);
  const html = brandedLayout({
    title: subject,
    preview: "Your guardian account is ready.",
    content:
      paragraph(`Hello ${escapeHtml(guardianName)},`) +
      paragraph(`Your LiberiaLearn guardian account for <strong>${escapeHtml(schoolName)}</strong> is ready.`) +
      `<p style="margin:24px 0;text-align:center">${button("Open Guardian Dashboard", dashboardUrl)}</p>`,
  });
  return sendEmail({ to, subject, html, text, type: "guardian_welcome", recipientRole: "guardian" });
}

export async function sendPasswordReset({
  to,
  name,
  resetUrl,
}: {
  to: string;
  name?: string;
  resetUrl: string;
}): Promise<EmailSendResult> {
  const subject = "Password reset - LiberiaLearn";
  const text = textBlock([
    `Hello ${name ?? "User"},`,
    "You requested a password reset for your LiberiaLearn account.",
    `Reset password: ${resetUrl}`,
    "If you did not request this, ignore this email.",
  ]);
  const html = brandedLayout({
    title: subject,
    preview: "Reset your LiberiaLearn password.",
    content:
      paragraph(`Hello ${escapeHtml(name ?? "User")},`) +
      paragraph("You requested a password reset for your LiberiaLearn account.") +
      `<p style="margin:24px 0;text-align:center">${button("Reset Password", resetUrl)}</p>` +
      paragraph("If you did not request this, ignore this email."),
  });
  return sendEmail({ to, subject, html, text, type: "password_reset", recipientRole: "user" });
}

export async function sendHomeworkGraded({
  to,
  studentName,
  homeworkTitle,
  score,
  teacherNotes,
  dashboardUrl,
}: {
  to: string;
  studentName: string;
  homeworkTitle: string;
  score: number;
  teacherNotes?: string;
  dashboardUrl: string;
}): Promise<EmailSendResult> {
  const subject = `Homework graded - ${homeworkTitle}`;
  const text = textBlock([
    `Hello ${studentName},`,
    `Your homework "${homeworkTitle}" has been graded.`,
    `Score: ${score}%`,
    teacherNotes ? `Teacher notes: ${teacherNotes}` : null,
    `Dashboard: ${dashboardUrl}`,
  ]);
  const html = brandedLayout({
    title: subject,
    preview: `Your homework score is ${score}%.`,
    content:
      paragraph(`Hello ${escapeHtml(studentName)},`) +
      paragraph(`Your homework "<strong>${escapeHtml(homeworkTitle)}</strong>" has been graded.`) +
      paragraph(`<strong>Score: ${score}%</strong>`) +
      (teacherNotes ? paragraph(`Teacher notes: ${escapeHtml(teacherNotes)}`) : "") +
      `<p style="margin:24px 0;text-align:center">${button("View Dashboard", dashboardUrl)}</p>`,
  });
  return sendEmail({ to, subject, html, text, type: "homework_graded", recipientRole: "student" });
}

export async function sendStudentWelcome({
  to,
  studentName,
  schoolName,
  loginId,
  loginUrl,
}: {
  to: string;
  studentName: string;
  schoolName: string;
  loginId: string;
  loginUrl: string;
}): Promise<EmailSendResult> {
  const subject = `Welcome to LiberiaLearn - ${schoolName}`;
  const text = textBlock([
    `Hello ${studentName},`,
    `Your account at ${schoolName} has been created.`,
    `Login ID: ${loginId}`,
    `Login: ${loginUrl}`,
  ]);
  const html = brandedLayout({
    title: subject,
    preview: `Your ${schoolName} student account is ready.`,
    content:
      paragraph(`Hello ${escapeHtml(studentName)},`) +
      paragraph(`Your account at <strong>${escapeHtml(schoolName)}</strong> has been created.`) +
      paragraph(`Your login ID is <strong>${escapeHtml(loginId)}</strong>. Use the password you chose during registration.`) +
      `<p style="margin:24px 0;text-align:center">${button("Go to LiberiaLearn", loginUrl)}</p>`,
  });
  return sendEmail({ to, subject, html, text, type: "student_welcome", recipientRole: "student" });
}

export async function sendCertificateAwarded({
  to,
  studentName,
  certificateTitle,
  certificateCode,
  verifyUrl,
}: {
  to: string;
  studentName: string;
  certificateTitle: string;
  certificateCode: string;
  verifyUrl: string;
}): Promise<EmailSendResult> {
  const subject = `Certificate awarded - ${certificateTitle}`;
  const text = textBlock([
    `Hello ${studentName},`,
    `You earned a LiberiaLearn certificate: ${certificateTitle}.`,
    `Certificate code: ${certificateCode}`,
    `Verify: ${verifyUrl}`,
  ]);
  const html = brandedLayout({
    title: subject,
    preview: `You earned ${certificateTitle}.`,
    content:
      paragraph(`Hello ${escapeHtml(studentName)},`) +
      paragraph(`You earned a LiberiaLearn certificate: <strong>${escapeHtml(certificateTitle)}</strong>.`) +
      paragraph(`Certificate code: <strong>${escapeHtml(certificateCode)}</strong>`) +
      `<p style="margin:24px 0;text-align:center">${button("View Certificate", verifyUrl)}</p>`,
  });
  return sendEmail({ to, subject, html, text, type: "certificate_awarded", recipientRole: "student" });
}

export async function sendAssignmentDue({
  to,
  studentName,
  assignmentTitle,
  className,
  teacherName,
  dueAt,
  assignmentUrl,
}: {
  to: string;
  studentName: string;
  assignmentTitle: string;
  className: string;
  teacherName: string;
  dueAt?: Date | null;
  assignmentUrl: string;
}): Promise<EmailSendResult> {
  const dueText = dueAt ? dueAt.toLocaleDateString("en-LR") : "No due date set";
  const subject = `Assignment due - ${assignmentTitle}`;
  const text = textBlock([
    `Hello ${studentName},`,
    `${teacherName} assigned "${assignmentTitle}" for ${className}.`,
    `Due: ${dueText}`,
    `Assignment: ${assignmentUrl}`,
  ]);
  const html = brandedLayout({
    title: subject,
    preview: `${assignmentTitle} is due ${dueText}.`,
    content:
      paragraph(`Hello ${escapeHtml(studentName)},`) +
      paragraph(`${escapeHtml(teacherName)} assigned "<strong>${escapeHtml(assignmentTitle)}</strong>" for ${escapeHtml(className)}.`) +
      paragraph(`Due: <strong>${escapeHtml(dueText)}</strong>`) +
      `<p style="margin:24px 0;text-align:center">${button("Open Assignment", assignmentUrl)}</p>`,
    unsubscribeUrl: `${process.env.NEXTAUTH_URL ?? "https://liberia-learn.vercel.app"}/guardian/settings`,
  });
  return sendEmail({
    to,
    subject,
    html,
    text,
    type: "assignment_due",
    recipientRole: "student",
    transactional: false,
  });
}

export async function sendWeeklyProgressToGuardian({
  to,
  guardianName,
  studentName,
  schoolName,
  weekSummary,
  dashboardUrl,
  unsubscribeUrl,
}: {
  to: string;
  guardianName: string;
  studentName: string;
  schoolName: string;
  weekSummary: { subject: string; homework: number; avgScore: number }[];
  dashboardUrl: string;
  unsubscribeUrl?: string;
}): Promise<EmailSendResult> {
  const subject = `Weekly progress - ${studentName}`;
  const summaryLines = weekSummary.map(
    (item) => `${item.subject}: ${item.homework} homework item(s), ${item.avgScore}% average score`
  );
  const text = textBlock([
    `Hello ${guardianName},`,
    `Here is ${studentName}'s weekly progress at ${schoolName}:`,
    summaryLines.join("\n"),
    `Dashboard: ${dashboardUrl}`,
  ]);
  const rows = weekSummary
    .map(
      (item) =>
        `<tr>
          <td style="padding:6px 12px;border-bottom:1px solid #1e293b;color:#cbd5e1">${escapeHtml(item.subject)}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #1e293b;color:#cbd5e1;text-align:center">${item.homework}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #1e293b;color:#cbd5e1;text-align:center">${item.avgScore}%</td>
        </tr>`
    )
    .join("");
  const table = `<table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr style="background:#1e293b">
      <th style="padding:8px 12px;text-align:left;color:#94a3b8;font-size:13px">Subject</th>
      <th style="padding:8px 12px;text-align:center;color:#94a3b8;font-size:13px">Homework</th>
      <th style="padding:8px 12px;text-align:center;color:#94a3b8;font-size:13px">Avg Score</th>
    </tr>
    ${rows}
  </table>`;
  const html = brandedLayout({
    title: subject,
    preview: `${studentName}'s weekly progress is ready.`,
    content:
      paragraph(`Hello ${escapeHtml(guardianName)},`) +
      paragraph(`Here is <strong>${escapeHtml(studentName)}</strong>'s weekly progress at <strong>${escapeHtml(schoolName)}</strong>:`) +
      table +
      `<p style="margin:24px 0;text-align:center">${button("View Full Dashboard", dashboardUrl)}</p>`,
    unsubscribeUrl: unsubscribeUrl ?? `${process.env.NEXTAUTH_URL ?? "https://liberia-learn.vercel.app"}/guardian/settings`,
  });
  return sendEmail({
    to,
    subject,
    html,
    text,
    type: "guardian_weekly_digest",
    recipientRole: "guardian",
    transactional: false,
  });
}
