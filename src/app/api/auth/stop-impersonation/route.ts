import { NextResponse } from "next/server";
import { stopUserSimulation } from "@/lib/impersonation";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    return stopUserSimulation();
  } catch (error) {
    console.error("[auth/stop-impersonation]", error);
    return NextResponse.json(
      { error: "Erro ao encerrar simulação" },
      { status: 500 },
    );
  }
}
