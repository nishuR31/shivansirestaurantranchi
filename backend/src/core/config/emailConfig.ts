import env from "./envConfig";
import logger from "./loggerConfig";
import { sendViaBrevo, brevoConfigured } from "../providers/brevoProvider";
import { sendViaSmtp, smtpConfigured } from "../providers/nodemailerProvider";
import { sendViaGmailApi as sendViaGmail, gmailApiConfigured as gmailConfigured } from "../providers/gmailProvider";

export const EMAIL_FROM = env.SMTP_FROM;

export async function sendMailProvider(
  to: string,
  subject: string,
  html: string,
  text?: string,
): Promise<void> {
  const transport = env.EMAIL_TRANSPORT;

  if (transport === "brevo" && brevoConfigured) {
    logger.debug(`Sending email to ${to} via Brevo`);
    await sendViaBrevo(to, subject, html, text);
    return;
  }

  if (transport === "gmail" && gmailConfigured) {
    logger.debug(`Sending email to ${to} via Gmail API`);
    await sendViaGmail(to, subject, html);
    return;
  }

  if (transport === "smtp" && smtpConfigured) {
    logger.debug(`Sending email to ${to} via SMTP`);
    await sendViaSmtp(to, subject, html);
    return;
  }

  // Auto mode or fallback
  if (brevoConfigured) {
    logger.debug(`Sending email to ${to} via Brevo (fallback)`);
    await sendViaBrevo(to, subject, html, text);
  } else if (gmailConfigured) {
    logger.debug(`Sending email to ${to} via Gmail API (fallback)`);
    await sendViaGmail(to, subject, html);
  } else if (smtpConfigured) {
    logger.debug(`Sending email to ${to} via SMTP (fallback)`);
    await sendViaSmtp(to, subject, html);
  } else {
    throw new Error(
      "No email providers are configured. Please configure Brevo, Gmail API, or SMTP.",
    );
  }
}
