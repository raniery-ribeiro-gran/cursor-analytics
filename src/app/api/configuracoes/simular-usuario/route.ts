import { NextRequest, NextResponse } from "next/server";
import { normalizeAuthEmail } from "@/lib/auth-shared";
import { requireAdmin } from "@/lib/authz";
import { startUserSimulation } from "@/lib/impersonation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const email =
      typeof body.email === "string" ? normalizeAuthEmail(body.email) : "";

    if (!email) {
      return NextResponse.json(
        { error: "Informe o e-mail do usuário a simular" },
        { status: 400 },
      );
    }

    return startUserSimulation(auth.ctx.email, email);
  } catch (error) {
    console.error("[configuracoes/simular-usuario]", error);
    return NextResponse.json(
      { error: "Erro ao iniciar simulação de usuário" },
      { status: 500 },
    );
  }
}
