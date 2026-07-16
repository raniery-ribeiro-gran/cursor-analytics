import type { OrganogramEntry } from "./organogram";

export interface TechOrganogramNode {
  id: string;
  email: string;
  name: string;
  roleTitle: string;
  tribe: string;
  leaderName: string;
  leaderEmail: string;
  legacyManagerName: string;
  /** Nó sintético para líder externo (não está na base). */
  external?: boolean;
  children: TechOrganogramNode[];
  reportCount: number;
}

export interface TechOrganogramTreePayload {
  roots: TechOrganogramNode[];
  totalPeople: number;
  totalTribes: number;
  tribes: string[];
}

function sortNodes(a: TechOrganogramNode, b: TechOrganogramNode): number {
  const tribeCmp = a.tribe.localeCompare(b.tribe, "pt-BR");
  if (tribeCmp !== 0) return tribeCmp;
  return a.name.localeCompare(b.name, "pt-BR");
}

function normalizePersonName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function toNode(entry: OrganogramEntry): TechOrganogramNode {
  return {
    id: entry.email,
    email: entry.email,
    name: entry.name,
    roleTitle: entry.roleTitle ?? "",
    tribe: entry.tribe ?? entry.department ?? "",
    leaderName: entry.managerName,
    leaderEmail: entry.managerEmail,
    legacyManagerName: entry.legacyManagerName ?? "",
    children: [],
    reportCount: 0,
  };
}

function annotateReportCounts(node: TechOrganogramNode): number {
  let total = 0;
  for (const child of node.children) {
    total += 1 + annotateReportCounts(child);
  }
  node.reportCount = total;
  return total;
}

/**
 * Monta a árvore hierárquica pela relação líder → liderados.
 * Líderes sem e-mail na base viram nós externos (raiz sintética).
 */
export function buildTechOrganogramTree(
  entries: OrganogramEntry[],
): TechOrganogramTreePayload {
  const byEmail = new Map<string, TechOrganogramNode>();
  const byName = new Map<string, TechOrganogramNode>();
  for (const entry of entries) {
    const node = toNode(entry);
    byEmail.set(entry.email, node);
    const key = normalizePersonName(entry.name);
    if (key && !byName.has(key)) {
      byName.set(key, node);
    }
  }

  // Alias comum: Fernando ↔ Fernandes no nome do líder
  for (const [key, node] of [...byName.entries()]) {
    const altFernando = key.replace(/\bfernandes\b/g, "fernando");
    const altFernandes = key.replace(/\bfernando\b/g, "fernandes");
    if (!byName.has(altFernando)) byName.set(altFernando, node);
    if (!byName.has(altFernandes)) byName.set(altFernandes, node);
  }

  const externalRoots = new Map<string, TechOrganogramNode>();
  const isChild = new Set<string>();

  for (const node of byEmail.values()) {
    const leaderEmail = node.leaderEmail.trim().toLowerCase();
    const leaderByEmail =
      leaderEmail && byEmail.has(leaderEmail)
        ? byEmail.get(leaderEmail)!
        : null;
    const leaderByName = byName.get(normalizePersonName(node.leaderName));
    const parent = leaderByEmail ?? leaderByName ?? null;

    if (parent && parent.email !== node.email) {
      parent.children.push(node);
      isChild.add(node.email);
      continue;
    }

    const externalKey = leaderEmail
      ? `email:${leaderEmail}`
      : `name:${normalizePersonName(node.leaderName) || "sem-lider"}`;

    let external = externalRoots.get(externalKey);
    if (!external) {
      external = {
        id: externalKey,
        email: leaderEmail,
        name: node.leaderName || "Sem líder definido",
        roleTitle: "Liderança (fora da base)",
        tribe: "",
        leaderName: "",
        leaderEmail: "",
        legacyManagerName: "",
        external: true,
        children: [],
        reportCount: 0,
      };
      externalRoots.set(externalKey, external);
    }
    external.children.push(node);
    isChild.add(node.email);
  }

  for (const node of byEmail.values()) {
    node.children.sort(sortNodes);
  }

  const roots: TechOrganogramNode[] = [];
  for (const external of externalRoots.values()) {
    external.children.sort(sortNodes);
    roots.push(external);
  }
  for (const node of byEmail.values()) {
    if (!isChild.has(node.email)) {
      roots.push(node);
    }
  }

  roots.sort(sortNodes);
  for (const root of roots) {
    annotateReportCounts(root);
  }

  const tribes = [
    ...new Set(
      entries
        .map((entry) => (entry.tribe || entry.department || "").trim())
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  return {
    roots,
    totalPeople: byEmail.size,
    totalTribes: tribes.length,
    tribes,
  };
}

function nodeMatchesQuery(node: TechOrganogramNode, query: string): boolean {
  if (!query) return true;
  return (
    node.name.toLowerCase().includes(query) ||
    node.email.toLowerCase().includes(query) ||
    node.roleTitle.toLowerCase().includes(query) ||
    node.tribe.toLowerCase().includes(query)
  );
}

function subtreeHasTribe(node: TechOrganogramNode, tribe: string): boolean {
  if (!node.external && (node.tribe || "").trim().toLowerCase() === tribe) {
    return true;
  }
  return node.children.some((child) => subtreeHasTribe(child, tribe));
}

export function filterTechOrganogramTree(
  roots: TechOrganogramNode[],
  options: { query?: string; tribe?: string },
): TechOrganogramNode[] {
  const query = (options.query ?? "").trim().toLowerCase();
  const tribe = (options.tribe ?? "").trim().toLowerCase();

  function filterNode(node: TechOrganogramNode): TechOrganogramNode | null {
    if (tribe && !subtreeHasTribe(node, tribe)) {
      return null;
    }

    const filteredChildren = node.children
      .map((child) => filterNode(child))
      .filter((child): child is TechOrganogramNode => child != null);

    const selfVisible =
      nodeMatchesQuery(node, query) &&
      (!tribe ||
        node.external ||
        (node.tribe || "").trim().toLowerCase() === tribe);

    if (!selfVisible && filteredChildren.length === 0) {
      return null;
    }

    // Com busca: mantém o caminho até o match
    if (query && !nodeMatchesQuery(node, query) && filteredChildren.length === 0) {
      return null;
    }

    return {
      ...node,
      children: filteredChildren,
    };
  }

  return roots
    .map((root) => filterNode(root))
    .filter((root): root is TechOrganogramNode => root != null);
}
