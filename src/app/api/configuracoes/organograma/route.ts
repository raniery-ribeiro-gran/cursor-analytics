import { NextResponse } from "next/server";
import { getEmailInitials, getGravatarUrl } from "@/lib/avatar";
import { listTechOrganogram } from "@/lib/organogramDb";
import {
  buildTechOrganogramTree,
  type TechOrganogramNode,
} from "@/lib/techOrganogramTree";

export const dynamic = "force-dynamic";

type ChartNode = TechOrganogramNode & {
  initials: string;
  avatarUrl: string | null;
  children: ChartNode[];
};

function enrichChartNodes(nodes: TechOrganogramNode[]): ChartNode[] {
  return nodes.map((node) => ({
    ...node,
    initials: getEmailInitials(node.name, node.email || node.id),
    avatarUrl: node.email ? getGravatarUrl(node.email, 128) : null,
    children: enrichChartNodes(node.children),
  }));
}

export async function GET() {
  try {
    const people = await listTechOrganogram();
    const tree = buildTechOrganogramTree(people);
    return NextResponse.json({
      ...tree,
      roots: enrichChartNodes(tree.roots),
    });
  } catch (error) {
    console.error("[configuracoes/organograma]", error);
    return NextResponse.json(
      { error: "Erro ao carregar organograma de Tecnologia" },
      { status: 500 },
    );
  }
}
