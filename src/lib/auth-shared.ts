/** Utilitários de auth sem dependências de servidor (seguro para Client Components). */

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidGranEmail(email: string): boolean {
  const normalized = normalizeAuthEmail(email);
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex <= 0) return false;
  const local = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  return local.length > 0 && domain === "gran.com";
}
