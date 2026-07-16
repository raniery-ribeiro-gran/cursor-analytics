import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AUTH_SESSION_COOKIE,
  clearImpersonatorCookieOptions,
  createSessionToken,
  getImpersonatorFromCookies,
  hasImpersonatorCookie,
  IMPERSONATOR_SESSION_COOKIE,
  impersonatorCookieOptions,
  sessionCookieOptions,
} from "./auth";
import { normalizeAuthEmail, isValidGranEmail } from "./auth-shared";
import { findPersonByEmail } from "./organogramDb";
import { getUserRole } from "./userRolesDb";

export async function startUserSimulation(
  adminEmail: string,
  targetEmail: string,
): Promise<NextResponse> {
  const normalizedTarget = normalizeAuthEmail(targetEmail);

  if (!isValidGranEmail(normalizedTarget)) {
    return NextResponse.json(
      { error: "Informe um e-mail corporativo @gran.com válido" },
      { status: 400 },
    );
  }

  if (normalizedTarget === normalizeAuthEmail(adminEmail)) {
    return NextResponse.json(
      { error: "Use outro e-mail — você já está autenticado como este usuário" },
      { status: 400 },
    );
  }

  const person = await findPersonByEmail(normalizedTarget);
  if (!person) {
    return NextResponse.json(
      { error: "E-mail não encontrado no organograma de Tecnologia" },
      { status: 404 },
    );
  }

  const cookieStore = await cookies();
  const currentToken = cookieStore.get(AUTH_SESSION_COOKIE)?.value;
  if (!currentToken) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  if (await hasImpersonatorCookie()) {
    return NextResponse.json(
      { error: "Encerre a simulação atual antes de simular outro usuário" },
      { status: 400 },
    );
  }

  const targetRole = await getUserRole(normalizedTarget);
  const simulatedToken = await createSessionToken(normalizedTarget, targetRole);

  const response = NextResponse.json({
    ok: true,
    email: normalizedTarget,
    name: person.name,
    role: targetRole,
  });
  response.cookies.set(sessionCookieOptions(simulatedToken));
  response.cookies.set(impersonatorCookieOptions(currentToken));
  return response;
}

export async function stopUserSimulation(): Promise<NextResponse> {
  const impersonator = await getImpersonatorFromCookies();
  if (!impersonator) {
    return NextResponse.json(
      { error: "Nenhuma simulação ativa" },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const impersonatorToken = cookieStore.get(IMPERSONATOR_SESSION_COOKIE)?.value;
  if (!impersonatorToken) {
    return NextResponse.json(
      { error: "Nenhuma simulação ativa" },
      { status: 400 },
    );
  }

  const person = await findPersonByEmail(impersonator.email);

  const response = NextResponse.json({
    ok: true,
    email: impersonator.email,
    name: person?.name ?? impersonator.email,
  });
  response.cookies.set(sessionCookieOptions(impersonatorToken));
  response.cookies.set(clearImpersonatorCookieOptions());
  return response;
}
