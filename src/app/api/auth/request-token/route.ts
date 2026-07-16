import { NextRequest, NextResponse } from "next/server";
import {
  getRequestIp,
  getRequestUserAgent,
  isValidGranEmail,
  LOGIN_TOKEN_TTL_MS,
  normalizeAuthEmail,
} from "@/lib/auth";
import {
  createLoginAttempt,
  generateLoginToken,
} from "@/lib/authDb";
import { sendLoginTokenEmail } from "@/lib/email";
import { findPersonByEmail } from "@/lib/organogramDb";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email =
      typeof body.email === "string" ? normalizeAuthEmail(body.email) : "";

    if (!email) {
      return NextResponse.json(
        { error: "Informe o e-mail" },
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
      return NextResponse.json(
        { error: "E-mail não encontrado no organograma de Tecnologia" },
        { status: 403 },
      );
    }

    const token = generateLoginToken();
    const ipAddress = getRequestIp(request);
    const userAgent = getRequestUserAgent(request);
    const expiresAt = new Date(Date.now() + LOGIN_TOKEN_TTL_MS);

    await createLoginAttempt(email, token, ipAddress, expiresAt, userAgent);
    await sendLoginTokenEmail(email, token);

    return NextResponse.json({
      ok: true,
      expiresInSeconds: LOGIN_TOKEN_TTL_MS / 1000,
      name: person.name,
    });
  } catch (error) {
    console.error("[auth/request-token]", error);
    return NextResponse.json(
      { error: "Erro ao solicitar código de acesso" },
      { status: 500 },
    );
  }
}
