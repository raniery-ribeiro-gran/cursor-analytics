import { NextResponse } from "next/server";
import { getEmailInitials, getGravatarUrl } from "@/lib/avatar";
import {
  getImpersonatorFromCookies,
  getSessionFromCookies,
} from "@/lib/auth";
import {
  canManageBacklog,
  canPrioritizeDemands,
  isAdminRole,
  USER_ROLE_LABELS,
} from "@/lib/roles";
import { findPersonByEmail } from "@/lib/organogramDb";
import { getUserRole } from "@/lib/userRolesDb";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  const role = await getUserRole(session.email);
  const person = await findPersonByEmail(session.email);
  const name = person?.name ?? session.email;

  const impersonator = await getImpersonatorFromCookies();
  let impersonatorInfo: { email: string; name: string } | null = null;
  if (impersonator) {
    const impersonatorPerson = await findPersonByEmail(impersonator.email);
    impersonatorInfo = {
      email: impersonator.email,
      name: impersonatorPerson?.name ?? impersonator.email,
    };
  }

  return NextResponse.json({
    authenticated: true,
    email: session.email,
    name,
    department: person?.department ?? null,
    initials: getEmailInitials(name, session.email),
    avatarUrl: getGravatarUrl(session.email),
    role,
    roleLabel: USER_ROLE_LABELS[role],
    isAdmin: isAdminRole(role),
    canPrioritize: canManageBacklog(role),
    canPrioritizeDemands: canPrioritizeDemands(role),
    simulating: impersonatorInfo != null,
    impersonator: impersonatorInfo,
  });
}
