import { redirect } from "next/navigation";
import { TeamTokenUsageAdminPage } from "@/components/TeamTokenUsageAdminPage";
import { getAuthContext } from "@/lib/authz";
import { listTechOrganogram } from "@/lib/organogramDb";
import { isAdminRole } from "@/lib/roles";
import { buildTechOrganogramTree } from "@/lib/techOrganogramTree";

export const dynamic = "force-dynamic";

export default async function Page() {
  const auth = await getAuthContext();
  if (!auth || !isAdminRole(auth.role)) redirect("/");

  const people = await listTechOrganogram();
  const tree = buildTechOrganogramTree(people);

  return (
    <TeamTokenUsageAdminPage
      roots={tree.roots}
      totalPeople={tree.totalPeople}
    />
  );
}
