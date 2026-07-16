import { getEnv } from "./env";
import {
  buildLoginTokenEmailHtml,
  buildLoginTokenEmailText,
  getLoginEmailAttachments,
} from "./loginEmailTemplate";

function isSmtpConfigured(): boolean {
  return Boolean(getEnv("SMTP_HOST") && getEnv("SMTP_FROM"));
}

export async function sendLoginTokenEmail(
  to: string,
  token: string,
): Promise<void> {
  const subject = "Código de acesso — Cursor Analytics";
  const text = buildLoginTokenEmailText(token);
  const html = buildLoginTokenEmailHtml(token);
  const attachments = getLoginEmailAttachments();

  if (!isSmtpConfigured()) {
    console.warn(
      `[auth] SMTP não configurado. Token para ${to}: ${token}`,
    );
    return;
  }

  const nodemailer = await import("nodemailer");
  const port = Number(getEnv("SMTP_PORT") ?? "587");
  const secure = getEnv("SMTP_SECURE") === "true" || port === 465;

  const transporter = nodemailer.createTransport({
    host: getEnv("SMTP_HOST"),
    port,
    secure,
    auth:
      getEnv("SMTP_USER")
        ? {
            user: getEnv("SMTP_USER"),
            pass: getEnv("SMTP_PASSWORD") ?? "",
          }
        : undefined,
  });

  await transporter.sendMail({
    from: getEnv("SMTP_FROM"),
    to,
    subject,
    text,
    html,
    attachments,
  });
}
