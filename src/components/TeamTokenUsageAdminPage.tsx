"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MembersTokenUsageUserDetail } from "@/lib/membersTokenUsageStats";
import type { TechOrganogramNode } from "@/lib/techOrganogramTree";
import type { TokenUsageDateRangeMeta } from "@/lib/tokenUsageDateRangeShared";
import { MembersTokenUsagePage } from "./MembersTokenUsagePage";
import { TokenUsageUserDetailView } from "./MembersTokenUsageUserModal";
import { PageHeader } from "./PageHeader";
import { TokenUsageDateRangeFilter } from "./TokenUsageDateRangeFilter";

function filterTree(
  nodes: TechOrganogramNode[],
  query: string,
): TechOrganogramNode[] {
  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  if (!normalized) return nodes;

  return nodes.flatMap((node) => {
    const children = filterTree(node.children, query);
    const matches = [node.name, node.email, node.roleTitle, node.tribe].some(
      (value) => value.toLocaleLowerCase("pt-BR").includes(normalized),
    );
    return matches || children.length > 0 ? [{ ...node, children }] : [];
  });
}

function collectInitiallyExpanded(
  nodes: TechOrganogramNode[],
  level = 1,
): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    if (node.children.length === 0) continue;
    if (level < 3) ids.push(node.id);
    ids.push(...collectInitiallyExpanded(node.children, level + 1));
  }
  return ids;
}

function collectExpandable(nodes: TechOrganogramNode[]): string[] {
  return nodes.flatMap((node) =>
    node.children.length > 0
      ? [node.id, ...collectExpandable(node.children)]
      : [],
  );
}

function OrganogramRows({
  nodes,
  level = 0,
  expanded,
  forceExpanded,
  onToggle,
  onTeam,
  onPerson,
}: {
  nodes: TechOrganogramNode[];
  level?: number;
  expanded: Set<string>;
  forceExpanded: boolean;
  onToggle: (id: string) => void;
  onTeam: (node: TechOrganogramNode) => void;
  onPerson: (node: TechOrganogramNode) => void;
}) {
  const orderedNodes = [...nodes].sort((a, b) => {
    const aIsLeader = a.reportCount > 0;
    const bIsLeader = b.reportCount > 0;
    if (aIsLeader !== bIsLeader) return aIsLeader ? -1 : 1;
    return a.name.localeCompare(b.name, "pt-BR");
  });

  return (
    <>
      {orderedNodes.map((node) => {
        const canOpenPerson = Boolean(node.email) && !node.external;
        const canOpenTeam = canOpenPerson && node.reportCount > 0;
        const hasChildren = node.children.length > 0;
        const isExpanded = forceExpanded || expanded.has(node.id);
        const initials = node.name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0]?.toLocaleUpperCase("pt-BR"))
          .join("");
        return (
          <div
            key={node.id}
            className={
              level > 0
                ? "relative ml-4 border-l border-blue-100"
                : undefined
            }
          >
            <div
              role={hasChildren ? "button" : undefined}
              tabIndex={hasChildren ? 0 : undefined}
              aria-expanded={hasChildren ? isExpanded : undefined}
              onClick={() => {
                if (hasChildren) onToggle(node.id);
              }}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (
                  hasChildren &&
                  (event.key === "Enter" || event.key === " ")
                ) {
                  event.preventDefault();
                  onToggle(node.id);
                }
              }}
              className={`group grid gap-3 border-b border-gray-100 px-4 py-3 transition md:grid-cols-[minmax(0,1fr)_auto] md:items-center ${
                hasChildren
                  ? "cursor-pointer hover:bg-gradient-to-r hover:from-blue-50 hover:to-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gran-blue"
                  : "hover:bg-gray-50/70"
              }`}
              style={{ paddingLeft: `${16 + level * 24}px` }}
            >
              <div className="flex min-w-0 items-start gap-3">
                {hasChildren ? (
                  <button
                    type="button"
                    aria-label={isExpanded ? "Recolher nível" : "Expandir nível"}
                    aria-expanded={isExpanded}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggle(node.id);
                    }}
                    className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-gran-blue transition group-hover:bg-blue-100"
                  >
                    <i
                      className={`fa-solid fa-chevron-${isExpanded ? "down" : "right"} text-[10px]`}
                    />
                  </button>
                ) : (
                  <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-gray-300" />
                )}
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-montserrat text-xs font-bold shadow-sm ${
                    canOpenTeam
                      ? "bg-gradient-to-br from-gran-blue to-gran-navy text-white"
                      : "border border-gray-200 bg-white text-gran-muted"
                  }`}
                >
                  {initials || <i className="fa-solid fa-user" />}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-montserrat text-sm font-bold text-gran-navy group-hover:text-gran-blue">
                      {node.name}
                    </p>
                    {canOpenTeam ? (
                      <span
                        title={`${node.reportCount} pessoa(s) em toda a hierarquia abaixo`}
                        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gran-blue"
                      >
                        <i className="fa-solid fa-people-group" />
                        {node.reportCount}
                      </span>
                    ) : null}
                    {node.tribe ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                        <i className="fa-solid fa-layer-group" />
                        {node.tribe}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-gran-muted">
                    {node.roleTitle || "Cargo não informado"}
                    {node.email ? ` · ${node.email}` : ""}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 md:justify-end">
                {canOpenTeam ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onTeam(node);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md bg-gran-blue px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-gran-navy hover:shadow"
                  >
                    <i className="fa-solid fa-people-group" />
                    Ver time
                  </button>
                ) : null}
                {canOpenPerson ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onPerson(node);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gran-navy shadow-sm transition hover:-translate-y-0.5 hover:border-gran-blue hover:text-gran-blue hover:shadow"
                  >
                    <i className="fa-solid fa-user" />
                    Ver pessoa
                  </button>
                ) : null}
              </div>
            </div>
            {hasChildren && isExpanded ? (
              <OrganogramRows
                nodes={node.children}
                level={level + 1}
                expanded={expanded}
                forceExpanded={forceExpanded}
                onToggle={onToggle}
                onTeam={onTeam}
                onPerson={onPerson}
              />
            ) : null}
          </div>
        );
      })}
    </>
  );
}

function TeamDashboardModal({
  leader,
  onClose,
}: {
  leader: TechOrganogramNode | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!leader) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [leader, onClose]);

  if (!leader) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-gran-navy/50"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-dashboard-title"
        className="relative z-10 flex max-h-[94vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-gran-bg shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 bg-white px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gran-muted">
              Team Token Usage
            </p>
            <h2
              id="team-dashboard-title"
              className="mt-1 font-montserrat text-xl font-bold text-gran-navy"
            >
              Time de {leader.name}
            </h2>
            <p className="mt-1 text-sm text-gran-muted">
              {leader.reportCount} pessoa(s) em toda a hierarquia abaixo
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gran-navy hover:bg-gray-50"
          >
            Fechar
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <MembersTokenUsagePage
            key={leader.email}
            variant="team"
            apiBase="/api/estatisticas/admin/team-token-usage"
            leaderEmail={leader.email}
            embedded
          />
        </div>
      </div>
    </div>
  );
}

function PersonUsageModal({
  person,
  onClose,
}: {
  person: TechOrganogramNode | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<MembersTokenUsageUserDetail | null>(null);
  const [dateRange, setDateRange] =
    useState<TokenUsageDateRangeMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (range?: { from: string; to: string }) => {
      if (!person?.email) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ email: person.email });
        if (range) {
          params.set("from", range.from);
          params.set("to", range.to);
        }
        const response = await fetch(
          `/api/estatisticas/admin/team-token-usage/person?${params}`,
        );
        const payload = (await response.json()) as Partial<
          MembersTokenUsageUserDetail
        > & {
          error?: string;
          dateRange?: TokenUsageDateRangeMeta;
        };
        if (payload.dateRange) setDateRange(payload.dateRange);
        if (!response.ok) {
          setData(null);
          throw new Error(payload.error ?? "Erro ao carregar a pessoa");
        }
        setData(payload as MembersTokenUsageUserDetail);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Erro ao carregar a pessoa",
        );
      } finally {
        setLoading(false);
      }
    },
    [person],
  );

  useEffect(() => {
    if (!person) return;
    setData(null);
    setDateRange(null);
    void load();
  }, [person, load]);

  useEffect(() => {
    if (!person) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [person, onClose]);

  if (!person) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-gran-navy/50"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="person-usage-title"
        className="relative z-10 flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-gran-bg shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-gran-muted">
              Token Usage da pessoa
            </p>
            <h2
              id="person-usage-title"
              className="mt-1 truncate font-montserrat text-xl font-bold text-gran-navy"
            >
              {person.name}
            </h2>
            <p className="mt-1 truncate text-sm text-gran-muted">
              {person.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gran-navy hover:bg-gray-50"
          >
            Fechar
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <TokenUsageDateRangeFilter
            meta={dateRange}
            loading={loading}
            onApply={(from, to) => void load({ from, to })}
          />
          {loading && !data ? (
            <p className="text-sm text-gran-muted">Carregando usage…</p>
          ) : null}
          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          {data ? <TokenUsageUserDetailView data={data} /> : null}
        </div>
      </div>
    </div>
  );
}

export function TeamTokenUsageAdminPage({
  roots,
  totalPeople,
}: {
  roots: TechOrganogramNode[];
  totalPeople: number;
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(collectInitiallyExpanded(roots)),
  );
  const [selectedLeader, setSelectedLeader] =
    useState<TechOrganogramNode | null>(null);
  const [selectedPerson, setSelectedPerson] =
    useState<TechOrganogramNode | null>(null);

  const visibleRoots = useMemo(() => filterTree(roots, query), [roots, query]);
  const hasQuery = query.trim().length > 0;

  const toggleNode = useCallback((id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <>
      <PageHeader
        title="Team Token Usage"
        subtitle="Explore toda a hierarquia e abra o consumo de qualquer time ou pessoa."
        icon="fa-users-viewfinder"
      />
      <main className="flex-1 px-6 py-6">
        <section className="mb-5 overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-r from-white via-blue-50/60 to-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gran-blue text-white shadow-sm">
                  <i className="fa-solid fa-sitemap" />
                </span>
                <p className="font-montserrat text-base font-bold text-gran-navy">
                  Organograma da Diretoria de TI
                </p>
              </div>
              <p className="mt-1 text-sm text-gran-muted">
                {totalPeople} pessoa(s). Líderes exibem toda a hierarquia abaixo.
              </p>
              <p className="mt-2 text-xs text-gran-muted">
                <i className="fa-solid fa-circle-info mr-1 text-gran-blue" />
                Clique na linha de um líder para expandir ou recolher.
              </p>
            </div>
            <label className="block w-full md:max-w-md">
              <span className="text-xs font-bold uppercase tracking-wide text-gran-muted">
                Buscar pessoa, cargo, e-mail ou tribo
              </span>
              <span className="relative mt-1 block">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gran-muted" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Digite para filtrar…"
                  className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gran-navy shadow-sm outline-none focus:border-gran-blue focus:ring-2 focus:ring-blue-100"
                />
              </span>
            </label>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50/80 px-4 py-2.5">
            <p className="text-xs font-bold uppercase tracking-wide text-gran-muted">
              Hierarquia
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setExpanded(new Set(collectExpandable(roots)))}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gran-navy hover:border-gran-blue hover:text-gran-blue"
              >
                <i className="fa-solid fa-angles-down" />
                Expandir tudo
              </button>
              <button
                type="button"
                onClick={() => setExpanded(new Set())}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gran-navy hover:border-gran-blue hover:text-gran-blue"
              >
                <i className="fa-solid fa-angles-up" />
                Recolher tudo
              </button>
            </div>
          </div>
          {visibleRoots.length > 0 ? (
            <OrganogramRows
              nodes={visibleRoots}
              expanded={expanded}
              forceExpanded={hasQuery}
              onToggle={toggleNode}
              onTeam={setSelectedLeader}
              onPerson={setSelectedPerson}
            />
          ) : (
            <p className="px-6 py-12 text-center text-sm text-gran-muted">
              Nenhuma pessoa encontrada.
            </p>
          )}
        </section>
      </main>

      <TeamDashboardModal
        leader={selectedLeader}
        onClose={() => setSelectedLeader(null)}
      />
      <PersonUsageModal
        person={selectedPerson}
        onClose={() => setSelectedPerson(null)}
      />
    </>
  );
}
