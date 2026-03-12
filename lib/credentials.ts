import { sendSMS } from "@/lib/sms";

export function generatePin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function formatCredentialSms(input: {
  schoolName: string;
  name: string;
  loginId: string;
  pin: string;
  role: string;
}) {
  return [
    `LiberiaLearn - ${input.schoolName}`,
    `${input.name}`,
    `${input.role} ID: ${input.loginId}`,
    `PIN: ${input.pin}`,
    "Go to: liberialearn.edu.lr",
    `Select ${input.role}`,
    "Enter your ID and PIN",
  ].join("\n");
}

export async function sendCredentialSms(input: {
  to: string;
  schoolName: string;
  name: string;
  loginId: string;
  pin: string;
  role: string;
}) {
  return sendSMS(
    input.to,
    formatCredentialSms({
      schoolName: input.schoolName,
      name: input.name,
      loginId: input.loginId,
      pin: input.pin,
      role: input.role,
    })
  );
}

