import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  getRequestIp,
  getRequestUserAgent,
  isValidGranEmail,
  normalizeAuthEmail,
  sessionCookieOptions,
} from "@/lib/auth";
import {
  findValidPendingAttempt,
  markLoginAttemptSuccess,
  recordFailedLoginWithoutPending,
  verifyLoginToken,
} from "@/lib/authDb";
import { findPersonByEmail } from "@/lib/organogramDb";
import { ensureUserRole, getUserRole, markUserLoggedIn } from "@/lib/userRolesDb";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email =
      typeof body.email === "string" ? normalizeAuthEmail(body.email) : "";
    const token = typeof body.token === "string" ? body.token : "";
    const ipAddress = getRequestIp(request);
    const userAgent = getRequestUserAgent(request);

    if (!email || !token) {
      return NextResponse.json(
        { error: "Informe o e-mail e o código" },
        { status: 400 },
      );
    }

    if (!isValidGranEmail(email)) {
      return NextResponse.json(
        { error: "Use um e-mail corporativo @gran.com" },
        { status: 400 },
      );
    }

    const person = await findPersonByEmail(email);
    if (!person) {
      await recordFailedLoginWithoutPending(
        email,
        "email_not_in_organogram",
        ipAddress,
        userAgent,
      );
      return NextResponse.json(
        { error: "E-mail não encontrado no organograma de Tecnologia" },
        { status: 403 },
      );
    }

    const attempt = await findValidPendingAttempt(email);
    if (!attempt) {
      await recordFailedLoginWithoutPending(
        email,
        "no_pending_token",
        ipAddress,
        userAgent,
      );
      return NextResponse.json(
        { error: "Código expirado ou não solicitado. Gere um novo código." },
        { status: 400 },
      );
    }

    if (!verifyLoginToken(attempt, token)) {
      // Registra tentativa inválida sem cancelar o código pendente ainda válido.
      await recordFailedLoginWithoutPending(
        email,
        "invalid_token",
        ipAddress,
        userAgent,
      );
      return NextResponse.json(
        { error: "Código inválido. Verifique o e-mail ou reenvie um novo código." },
        { status: 401 },
      );
    }

    await markLoginAttemptSuccess(attempt.id, ipAddress, userAgent);
    await ensureUserRole(email);
    await markUserLoggedIn(email);
    const role = await getUserRole(email);
    const sessionToken = await createSessionToken(email, role);
    const response = NextResponse.json({
      ok: true,
      email,
      name: person.name,
      role,
    });
    response.cookies.set(sessionCookieOptions(sessionToken));
    return response;
  } catch (error) {
    console.error("[auth/verify-token]", error);
    return NextResponse.json(
      { error: "Erro ao validar código de acesso" },
      { status: 500 },
    );
  }
}
