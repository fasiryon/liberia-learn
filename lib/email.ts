// lib/email.ts
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM =
  process.env.EMAIL_FROM ??
  process.env.RESEND_FROM_EMAIL ??
  "LiberiaLearn <noreply@liberialearn.edu.lr>";

// ── Internal helpers ──

async function send(to: string, subject: string, html: string) {
  if (!resend) {
    console.log(`[EMAIL-DEV] To: ${to} | Subject: ${subject}`);
    console.log(html);
    return { ok: true, id: "dev-no-send" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to,
      subject,
      html,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) };
  }
}

function p(text: string) {
  return `<p style="margin:0 0 12px;color:#cbd5e1;font-size:15px;line-height:1.6">${text}</p>`;
}

function btn(text: string, url: string) {
  return `<a href="${url}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">${text}</a>`;
}

function base(content: string, schoolName = "LiberiaLearn") {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#020617;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#020617;padding:24px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:12px;overflow:hidden">
        <tr><td style="background:#1B4332;padding:20px 24px">
          <h1 style="margin:0;color:#fff;font-size:20px">${schoolName}</h1>
        </td></tr>
        <tr><td style="padding:24px">
          ${content}
        </td></tr>
        <tr><td style="padding:16px 24px;border-top:1px solid #1e293b">
          <p style="margin:0;color:#64748b;font-size:12px;text-align:center">
            Powered by LiberiaLearn &mdash; AI-powered education for Liberia
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Exported email functions ──

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
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const html = base(
    p(`Hello ${name ?? "Teacher"},`) +
      p(`You've been invited to join <strong>${schoolName}</strong> on LiberiaLearn as a Teacher.`) +
      p("Click below to set up your account:") +
      `<p style="margin:24px 0;text-align:center">${btn("Accept Invitation", inviteUrl)}</p>` +
      p("This link expires in 7 days."),
    schoolName
  );
  return send(to, `You're invited to ${schoolName} — LiberiaLearn`, html);
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
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const html = base(
    p(`Hello ${name ?? "Student"},`) +
      p(`You've been invited to join <strong>${schoolName}</strong> on LiberiaLearn.`) +
      p("Click below to start learning:") +
      `<p style="margin:24px 0;text-align:center">${btn("Join Now", inviteUrl)}</p>` +
      p("This link expires in 7 days."),
    schoolName
  );
  return send(to, `Welcome to ${schoolName} — LiberiaLearn`, html);
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
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const html = base(
    p(`Hello ${guardianName ?? "Guardian"},`) +
      p(`You've been invited to track <strong>${studentName}</strong>'s progress at <strong>${schoolName}</strong> on LiberiaLearn.`) +
      p("Click below to set up your guardian account:") +
      `<p style="margin:24px 0;text-align:center">${btn("Accept Invitation", inviteUrl)}</p>` +
      p("This link expires in 7 days."),
    schoolName
  );
  return send(to, `Guardian Invite — ${schoolName}`, html);
}

export async function sendPasswordReset({
  to,
  name,
  resetUrl,
}: {
  to: string;
  name?: string;
  resetUrl: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const html = base(
    p(`Hello ${name ?? "User"},`) +
      p("You requested a password reset for your LiberiaLearn account.") +
      `<p style="margin:24px 0;text-align:center">${btn("Reset Password", resetUrl)}</p>` +
      p("If you didn't request this, please ignore this email.")
  );
  return send(to, "Password Reset — LiberiaLearn", html);
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
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const html = base(
    p(`Hello ${studentName},`) +
      p(`Your homework "<strong>${homeworkTitle}</strong>" has been graded.`) +
      p(`<strong>Score: ${score}%</strong>`) +
      (teacherNotes ? p(`Teacher notes: ${teacherNotes}`) : "") +
      `<p style="margin:24px 0;text-align:center">${btn("View Dashboard", dashboardUrl)}</p>`
  );
  return send(to, `Homework Graded: ${homeworkTitle}`, html);
}

export async function sendWeeklyProgressToGuardian({
  to,
  guardianName,
  studentName,
  schoolName,
  weekSummary,
  dashboardUrl,
}: {
  to: string;
  guardianName: string;
  studentName: string;
  schoolName: string;
  weekSummary: { subject: string; homework: number; avgScore: number }[];
  dashboardUrl: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const rows = weekSummary
    .map(
      (w) =>
        `<tr>
          <td style="padding:6px 12px;border-bottom:1px solid #1e293b;color:#cbd5e1">${w.subject}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #1e293b;color:#cbd5e1;text-align:center">${w.homework}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #1e293b;color:#cbd5e1;text-align:center">${w.avgScore}%</td>
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

  const html = base(
    p(`Hello ${guardianName},`) +
      p(`Here's <strong>${studentName}</strong>'s weekly progress at <strong>${schoolName}</strong>:`) +
      table +
      `<p style="margin:24px 0;text-align:center">${btn("View Full Dashboard", dashboardUrl)}</p>`,
    schoolName
  );
  return send(to, `Weekly Progress: ${studentName} — ${schoolName}`, html);
}
