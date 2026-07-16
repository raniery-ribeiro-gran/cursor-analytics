const MAX_USER_AGENT_LENGTH = 512;

export function normalizeUserAgent(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_USER_AGENT_LENGTH);
}

export function formatUserAgentSummary(
  userAgent: string | null | undefined,
): string {
  if (!userAgent) return "—";

  let browser = "Navegador desconhecido";
  if (/Edg\//.test(userAgent)) browser = "Edge";
  else if (/OPR\/|Opera/.test(userAgent)) browser = "Opera";
  else if (/Firefox\//.test(userAgent)) browser = "Firefox";
  else if (/Chrome\//.test(userAgent)) browser = "Chrome";
  else if (/Safari\//.test(userAgent)) browser = "Safari";

  let device = "";
  if (/iPhone/.test(userAgent)) device = "iPhone";
  else if (/iPad/.test(userAgent)) device = "iPad";
  else if (/Android/.test(userAgent)) device = "Android";
  else if (/Windows/.test(userAgent)) device = "Windows";
  else if (/Mac OS X|Macintosh/.test(userAgent)) device = "macOS";
  else if (/Linux/.test(userAgent)) device = "Linux";

  if (device) return `${browser} · ${device}`;
  return browser;
}
