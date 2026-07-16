import { NextRequest, NextResponse } from "next/server";
import {
  isManageableUserRole,
  MANAGEABLE_USER_ROLES,
  USER_ROLE_LABELS,
  type UserRole,
} from "@/lib/roles";
import { requireAdmin } from "@/lib/authz";
import {
  countAdmins,
  createUserRole,
  listOrganogramUsersWithoutRole,
  listUserAccessEntries,
  updateUserRole,
} from "@/lib/userRolesDb";
import { isValidGranEmail, normalizeAuthEmail } from "@/lib/auth-shared";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const [users, addCandidates] = await Promise.all([
      listUserAccessEntries(),
      listOrganogramUsersWithoutRole(),
    ]);
    return NextResponse.json({
      users,
      addCandidates,
      roles: MANAGEABLE_USER_ROLES.map((id) => ({
        id,
        label: USER_ROLE_LABELS[id],
      })),
    });
  } catch (error) {
    console.error("[configuracoes/usuarios GET]", error);
    return NextResponse.json(
      { error: "Erro ao carregar usuários" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const email =
      typeof body.email === "string" ? normalizeAuthEmail(body.email) : "";
    const role =
      typeof body.role === "string" ? (body.role as UserRole) : null;

    if (!email || !role || !isManageableUserRole(role)) {
      return NextResponse.json(
        { error: "Informe e-mail e perfil válidos (Administrador, Líder ou Leitor)" },
        { status: 400 },
      );
    }

    if (
      email === auth.ctx.email &&
      role !== "administrador" &&
      (await countAdmins(auth.ctx.email)) === 0
    ) {
      return NextResponse.json(
        { error: "Não é possível remover o último administrador do sistema" },
        { status: 400 },
      );
    }

    const updated = await updateUserRole(email, role);
    if (!updated) {
      return NextResponse.json(
        { error: "Usuário não encontrado no organograma de Tecnologia" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      user: {
        email: updated.email,
        role: updated.role,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    console.error("[configuracoes/usuarios PATCH]", error);
    return NextResponse.json(
      { error: "Erro ao atualizar perfil do usuário" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const email =
      typeof body.email === "string" ? normalizeAuthEmail(body.email) : "";
    const role =
      typeof body.role === "string" ? (body.role as UserRole) : null;

    if (!email || !isValidGranEmail(email)) {
      return NextResponse.json(
        { error: "Informe um e-mail corporativo @gran.com válido" },
        { status: 400 },
      );
    }

    if (!role || !isManageableUserRole(role)) {
      return NextResponse.json(
        { error: "Informe um perfil válido (Administrador, Líder ou Leitor)" },
        { status: 400 },
      );
    }

    const created = await createUserRole(email, role);
    if (created === "not_in_organogram") {
      return NextResponse.json(
        { error: "E-mail não encontrado no organograma de Tecnologia" },
        { status: 404 },
      );
    }
    if (created === "exists") {
      return NextResponse.json(
        { error: "Este usuário já está cadastrado no controle de acesso" },
        { status: 409 },
      );
    }
    if (!created) {
      return NextResponse.json(
        { error: "Erro ao adicionar usuário" },
        { status: 500 },
      );
    }

    const entries = await listUserAccessEntries();
    const user = entries.find((entry) => entry.email === created.email);

    return NextResponse.json({ user });
  } catch (error) {
    console.error("[configuracoes/usuarios POST]", error);
    return NextResponse.json(
      { error: "Erro ao adicionar usuário" },
      { status: 500 },
    );
  }
}
