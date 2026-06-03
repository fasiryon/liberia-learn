import { sendEmail } from "@/lib/email";
import { sendSMS } from "@/lib/sms";
import { logger } from "@/lib/logger";

export type AlertChannel = "email" | "sms" | "both";

export type AlertInput = {
  subject: string;
  body: string;
  channel?: AlertChannel;
};

export type AlertResult = {
  emailSent: boolean;
  smsSent: boolean;
  error?: string;
};

function getAlertEmail(): string | null {
  return process.env.OPS_ALERT_EMAIL?.trim() || null;
}

function getAlertPhone(): string | null {
  return process.env.OPS_ALERT_PHONE?.trim() || null;
}

export async function sendOpsAlert(input: AlertInput): Promise<AlertResult> {
  const { subject, body, channel = "email" } = input;
  const alertEmail = getAlertEmail();
  const alertPhone = getAlertPhone();
  const result: AlertResult = { emailSent: false, smsSent: false };

  const sendEmailAlert = channel === "email" || channel === "both";
  const sendSmsAlert = channel === "sms" || channel === "both";

  if (sendEmailAlert && alertEmail) {
    try {
      const html = `<pre style="font-family:monospace;white-space:pre-wrap">${body}</pre>`;
      const emailResult = await sendEmail({
        to: alertEmail,
        subject: `[LiberiaLearn Ops] ${subject}`,
        html,
        text: body,
        type: "ops_alert",
        recipientRole: "platform_admin",
        transactional: true,
      });
      result.emailSent = emailResult.ok;
      if (!emailResult.ok) {
        logger.warn("[OPS_ALERT] email failed", { subject, error: emailResult.error });
      }
    } catch (err) {
      logger.error("[OPS_ALERT] email threw", { subject, err });
      result.error = String(err);
    }
  } else if (sendEmailAlert && !alertEmail) {
    logger.warn("[OPS_ALERT] OPS_ALERT_EMAIL not set — skipping email alert", { subject });
  }

  if (sendSmsAlert && alertPhone) {
    try {
      const smsResult = await sendSMS(alertPhone, `[LiberiaLearn] ${subject}\n${body.slice(0, 140)}`);
      result.smsSent = smsResult.ok;
      if (!smsResult.ok) {
        logger.warn("[OPS_ALERT] SMS failed", { subject, error: smsResult.error });
      }
    } catch (err) {
      logger.error("[OPS_ALERT] SMS threw", { subject, err });
    }
  }

  logger.info("[OPS_ALERT] alert dispatched", {
    subject,
    channel,
    emailSent: result.emailSent,
    smsSent: result.smsSent,
  });

  return result;
}
