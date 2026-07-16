import fs from "fs";
import path from "path";

const GRAN_LOGO_CID = "gran-logo-branca@cursor-analytics";

const BRAND = {
  navy: "#001533",
  blue: "#0045ad",
  red: "#dd303e",
  bg: "#f5f7fa",
  headerBg: "#0e154b",
  muted: "#6b7280",
  border: "#e5e7eb",
  white: "#ffffff",
} as const;

function getGranLogoPath(): string {
  const logoPath = path.join(process.cwd(), "public", "logo-branca.svg");
  if (!fs.existsSync(logoPath)) {
    throw new Error(`Logo Gran não encontrada: ${logoPath}`);
  }
  return logoPath;
}

export function getLoginEmailAttachments() {
  return [
    {
      filename: "logo-branca.svg",
      path: getGranLogoPath(),
      cid: GRAN_LOGO_CID,
      contentType: "image/svg+xml",
      contentDisposition: "inline" as const,
    },
  ];
}

export function buildLoginTokenEmailText(token: string): string {
  return [
    "Gran — Cursor Analytics",
    "",
    "Olá,",
    "",
    "Use o código abaixo para entrar no Cursor Analytics:",
    "",
    token,
    "",
    "O código expira em 1 minuto.",
    "",
    "Se você não solicitou este acesso, ignore este e-mail.",
    "",
    "—",
    "Gran · Cursor Analytics",
    "Métricas de uso do Cursor — Engenharia",
  ].join("\n");
}

export function buildLoginTokenEmailHtml(token: string): string {
  const safeToken = token
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Código de acesso — Cursor Analytics</title>
  </head>
  <body style="margin:0;padding:0;background-color:${BRAND.bg};font-family:Arial,Helvetica,sans-serif;color:${BRAND.navy};">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${BRAND.bg};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:${BRAND.white};border:1px solid ${BRAND.border};border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background-color:${BRAND.headerBg};padding:28px 32px;text-align:center;">
                <img
                  src="cid:${GRAN_LOGO_CID}"
                  alt="Gran"
                  width="120"
                  height="31"
                  style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;"
                />
                <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#cbd5e1;letter-spacing:0.02em;">
                  Cursor Analytics
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:${BRAND.muted};">
                  Olá,
                </p>
                <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:700;color:${BRAND.navy};">
                  Seu código de acesso
                </h1>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">
                  Use o código abaixo para entrar no Cursor Analytics.
                  Ele é válido por <strong>1 minuto</strong>.
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="center" style="background-color:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:10px;padding:20px 16px;">
                      <span style="display:inline-block;font-size:30px;line-height:1;font-weight:700;letter-spacing:0.28em;color:${BRAND.blue};font-family:Consolas,'Courier New',monospace;">
                        ${safeToken}
                      </span>
                    </td>
                  </tr>
                </table>
                <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:${BRAND.muted};">
                  Se o código expirar, volte à tela de login e clique em
                  <strong>Reenviar código</strong>.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background-color:${BRAND.bg};border-top:1px solid ${BRAND.border};padding:20px 32px;text-align:center;">
                <p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:${BRAND.muted};">
                  Gran · Cursor Analytics
                </p>
                <p style="margin:0;font-size:11px;line-height:1.5;color:#9ca3af;">
                  Métricas de uso do Cursor — Engenharia<br />
                  Se você não solicitou este acesso, ignore este e-mail.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
