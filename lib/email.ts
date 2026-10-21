import { devLoginEnabled } from "@/lib/demo";

// Sends plain-text email through Resend (https://resend.com/docs/api-reference).
// Set RESEND_API_KEY and EMAIL_FROM (e.g. "Listening Rooms <hei@listeningrooms.no>").
// Locally without a key, the message is only logged.

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
}) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    if (devLoginEnabled()) {
      console.info(`[email to ${input.to}] ${input.subject}\n${input.text}`);
      return;
    }
    throw new Error("Email is not configured (RESEND_API_KEY, EMAIL_FROM).");
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
    }),
  });
  if (!response.ok)
    throw new Error(`Sending email failed (${response.status}).`);
}
