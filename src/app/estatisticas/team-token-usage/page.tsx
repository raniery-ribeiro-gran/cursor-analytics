import { redirect } from "next/navigation";
import { MembersTokenUsagePage } from "@/components/MembersTokenUsagePage";
import { getAuthContext } from "@/lib/authz";
import { canViewTeamTokenUsage } from "@/lib/roles";

export default async function Page() {
  const auth = await getAuthContext();
  if (!auth || !canViewTeamTokenUsage(auth.role)) {
    redirect("/");
  }

  return <MembersTokenUsagePage variant="team" />;
}
