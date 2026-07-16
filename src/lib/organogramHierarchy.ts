import type { OrganogramEntry } from "./organogram";
import { listTechOrganogram } from "./organogramDb";
import { buildTechOrganogramTree, type TechOrganogramNode } from "./techOrganogramTree";

export interface OrganogramDescendant {
  email: string;
  name: string;
  roleTitle: string;
  tribe: string;
  depth: number;
}

function findNodeByEmail(
  nodes: TechOrganogramNode[],
  email: string,
): TechOrganogramNode | null {
  const target = email.trim().toLowerCase();
  for (const node of nodes) {
    if (!node.external && node.email.toLowerCase() === target) {
      return node;
    }
    const nested = findNodeByEmail(node.children, email);
    if (nested) return nested;
  }
  return null;
}

function collectDescendants(
  node: TechOrganogramNode,
  depth: number,
  out: OrganogramDescendant[],
): void {
  for (const child of node.children) {
    if (child.external) continue;
    out.push({
      email: child.email.toLowerCase(),
      name: child.name,
      roleTitle: child.roleTitle,
      tribe: child.tribe,
      depth,
    });
    collectDescendants(child, depth + 1, out);
  }
}

/**
 * Retorna toda a árvore de liderados (diretos + indiretos) abaixo do e-mail.
 * Usa a mesma resolução de líder da UI do organograma (e-mail ou nome).
 */
export async function getOrganogramDescendants(
  leaderEmailInput: string,
): Promise<OrganogramDescendant[]> {
  const leaderEmail = leaderEmailInput.trim().toLowerCase();
  if (!leaderEmail.includes("@")) return [];

  const people = await listTechOrganogram();
  const { roots } = buildTechOrganogramTree(people);
  const leaderNode = findNodeByEmail(roots, leaderEmail);
  if (!leaderNode) return [];

  const descendants: OrganogramDescendant[] = [];
  collectDescendants(leaderNode, 1, descendants);

  const seen = new Set<string>();
  return descendants.filter((person) => {
    if (seen.has(person.email)) return false;
    seen.add(person.email);
    return true;
  });
}

export async function getOrganogramDescendantEmailSet(
  leaderEmail: string,
): Promise<Set<string>> {
  const descendants = await getOrganogramDescendants(leaderEmail);
  return new Set(descendants.map((person) => person.email));
}

export async function isOrganogramDescendant(
  leaderEmail: string,
  memberEmail: string,
): Promise<boolean> {
  const set = await getOrganogramDescendantEmailSet(leaderEmail);
  return set.has(memberEmail.trim().toLowerCase());
}

export type { OrganogramEntry };
