import type { LoginAttemptStatus } from "./authDb";

export interface AccessLogEntry {
  id: number;
  email: string;
  name: string | null;
  status: LoginAttemptStatus;
  failureReason: string | null;
  tokenCode: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  verifiedAt: string | null;
}

export const ACCESS_LOG_STATUS_LABELS: Record<LoginAttemptStatus, string> = {
  pending: "Código enviado",
  success: "Login bem-sucedido",
  failed: "Falha",
  expired: "Expirado",
};

export const ACCESS_LOG_STATUS_STYLES: Record<LoginAttemptStatus, string> = {
  pending: "bg-blue-100 text-gran-blue",
  success: "bg-green-100 text-gran-success",
  failed: "bg-red-100 text-red-700",
  expired: "bg-gray-100 text-gran-muted",
};

export const ACCESS_LOG_FAILURE_LABELS: Record<string, string> = {
  invalid_token: "Código inválido",
  no_pending_token: "Sem código pendente",
  email_not_in_organogram: "E-mail fora do organograma de Tecnologia",
  superseded: "Substituído por novo código",
};

export function formatAccessLogFailure(reason: string | null): string {
  if (!reason) return "—";
  return ACCESS_LOG_FAILURE_LABELS[reason] ?? reason;
}

export function formatAccessLogDateTime(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("pt-BR");
}
