"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "./PageHeader";
import {
  filterTechOrganogramTree,
  type TechOrganogramNode,
  type TechOrganogramTreePayload,
} from "@/lib/techOrganogramTree";

type ChartNode = TechOrganogramNode & {
  initials?: string;
  avatarUrl?: string | null;
  children: ChartNode[];
};

type ChartPayload = Omit<TechOrganogramTreePayload, "roots"> & {
  roots: ChartNode[];
};

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return name;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

/** Cargo em title case só na UI (não altera o banco). */
function formatRoleTitle(roleTitle: string): string {
  const trimmed = roleTitle.trim();
  if (!trimmed) return "Cargo não informado";
  return trimmed
    .toLocaleLowerCase("pt-BR")
    .replace(/(^|[\s\/\-_(])(\p{L})/gu, (_, sep: string, letter: string) => {
      return `${sep}${letter.toLocaleUpperCase("pt-BR")}`;
    });
}

function collectExpandableIds(nodes: ChartNode[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    if (node.children.length > 0) {
      ids.push(node.id);
      ids.push(...collectExpandableIds(node.children));
    }
  }
  return ids;
}

/** Expande nós até exibir o nível alvo (nível 1 = raiz). */
function collectIdsOpenUntilLevel(
  nodes: ChartNode[],
  maxVisibleLevel: number,
  currentLevel = 1,
): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    if (node.children.length === 0) continue;
    if (currentLevel < maxVisibleLevel) {
      ids.push(node.id);
      ids.push(
        ...collectIdsOpenUntilLevel(
          node.children,
          maxVisibleLevel,
          currentLevel + 1,
        ),
      );
    }
  }
  return ids;
}

const DEFAULT_OPEN_LEVEL = 3;

function collectAncestorIds(
  roots: ChartNode[],
  targetId: string,
): Set<string> | null {
  function walk(
    node: ChartNode,
    path: string[],
  ): Set<string> | null {
    const nextPath = [...path, node.id];
    if (node.id === targetId) return new Set(nextPath);
    for (const child of node.children) {
      const found = walk(child, nextPath);
      if (found) return found;
    }
    return null;
  }

  for (const root of roots) {
    const found = walk(root, []);
    if (found) return found;
  }
  return null;
}

function PersonCard({
  node,
  selected,
  onSelect,
  hasChildren,
  expanded,
  onToggle,
}: {
  node: ChartNode;
  selected: boolean;
  onSelect: () => void;
  hasChildren: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = Boolean(node.avatarUrl) && !imgFailed;

  return (
    <div
      className={`org-node-wrap w-[122px] rounded-lg border bg-white px-1.5 pb-1.5 pt-2 text-center shadow-sm transition ${
        selected
          ? "border-gran-navy ring-1 ring-gran-navy/25"
          : node.external
            ? "border-dashed border-gray-300 bg-gray-50"
            : "border-gray-200 hover:border-gran-blue/40"
      }`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect();
          }
        }}
        className="w-full cursor-inherit text-center"
      >
        <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gran-navy text-[10px] font-bold text-white">
          {showImage ? (
            <Image
              src={node.avatarUrl!}
              alt=""
              width={32}
              height={32}
              className="h-full w-full object-cover"
              unoptimized
              onError={() => setImgFailed(true)}
            />
          ) : (
            <span>{node.initials ?? "?"}</span>
          )}
        </div>
        <p className="font-montserrat text-[11px] font-bold leading-tight text-gran-navy">
          {shortName(node.name)}
        </p>
        <p className="mt-0.5 line-clamp-2 min-h-[1.6rem] text-[9px] leading-tight text-gran-muted">
          {node.external
            ? "Liderança externa"
            : formatRoleTitle(node.roleTitle)}
        </p>
        {!node.external && node.tribe ? (
          <p className="mt-0.5 truncate text-[8px] font-semibold uppercase tracking-wide text-gran-blue">
            {node.tribe}
          </p>
        ) : null}
      </div>

      {hasChildren && (
        <button
          type="button"
          data-org-control="expand"
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          className="mt-1 inline-flex cursor-pointer items-center gap-1 rounded-full border border-gray-200 bg-gran-bg px-1.5 py-0.5 text-[9px] font-semibold text-gran-navy hover:bg-gray-200"
          aria-expanded={expanded}
        >
          <i className="fa-solid fa-users text-[8px]" aria-hidden="true" />
          {node.reportCount}
          <i
            className={`fa-solid fa-chevron-down text-[7px] transition ${
              expanded ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>
      )}
    </div>
  );
}

function ChartBranch({
  nodes,
  expanded,
  selectedId,
  onSelect,
  onToggle,
}: {
  nodes: ChartNode[];
  expanded: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  if (nodes.length === 0) return null;

  return (
    <ul>
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0;
        const isOpen = expanded.has(node.id);

        return (
          <li key={node.id}>
            <PersonCard
              node={node}
              selected={selectedId === node.id}
              onSelect={() => onSelect(node.id)}
              hasChildren={hasChildren}
              expanded={isOpen}
              onToggle={() => onToggle(node.id)}
            />
            {hasChildren && isOpen && (
              <div className="org-children">
                <ChartBranch
                  nodes={node.children}
                  expanded={expanded}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  onToggle={onToggle}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function OrganogramSettings() {
  const [data, setData] = useState<ChartPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tribe, setTribe] = useState("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
    moved: boolean;
  } | null>(null);
  const skipClickRef = useRef(false);

  const loadTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/configuracoes/organograma");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Erro ao carregar organograma");
      }
      const tree = payload as ChartPayload;
      setData(tree);
      setExpanded(
        new Set(collectIdsOpenUntilLevel(tree.roots, DEFAULT_OPEN_LEVEL)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTree();
  }, [loadTree]);

  const filteredRoots = useMemo(() => {
    if (!data) return [];
    return filterTechOrganogramTree(data.roots, {
      query,
      tribe: tribe === "all" ? "" : tribe,
    }) as ChartNode[];
  }, [data, query, tribe]);

  useEffect(() => {
    if (!query.trim() || filteredRoots.length === 0) return;
    setExpanded(new Set(collectExpandableIds(filteredRoots)));
  }, [query, filteredRoots]);

  function toggleNode(id: string) {
    if (skipClickRef.current) return;
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectNode(id: string) {
    if (skipClickRef.current) return;
    setSelectedId(id);
    const ancestors = collectAncestorIds(filteredRoots, id);
    if (ancestors) {
      setExpanded((current) => {
        const next = new Set(current);
        for (const ancestorId of ancestors) next.add(ancestorId);
        return next;
      });
    }
  }

  function handleViewportPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    // Controles interativos: não iniciar pan (senão o clique some).
    if (target.closest("button, input, select, textarea, a, label")) return;

    const viewport = viewportRef.current;
    if (!viewport) return;

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
      moved: false,
    };
  }

  function handleViewportPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const viewport = viewportRef.current;
    if (!drag || !viewport || drag.pointerId !== event.pointerId) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    if (!drag.moved && Math.hypot(dx, dy) < 5) return;

    if (!drag.moved) {
      drag.moved = true;
      setIsPanning(true);
      skipClickRef.current = true;
      // Captura só depois do limiar, para não engolir clique em botões.
      if (!viewport.hasPointerCapture(event.pointerId)) {
        viewport.setPointerCapture(event.pointerId);
      }
    }

    viewport.scrollLeft = drag.scrollLeft - dx;
    viewport.scrollTop = drag.scrollTop - dy;
  }

  function endViewportPan(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const viewport = viewportRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const wasMoved = drag.moved;
    dragRef.current = null;
    setIsPanning(false);

    if (viewport?.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }

    if (wasMoved) {
      // Mantém o bloqueio até o ciclo do click sintético terminar.
      window.setTimeout(() => {
        skipClickRef.current = false;
      }, 50);
    }
  }

  return (
    <>
      <PageHeader
        title="Organograma"
        subtitle="Visão hierárquica de Tecnologia — líderes, times e tribos"
        icon="fa-sitemap"
        onRefresh={loadTree}
        loading={loading}
        refreshLabel="Atualizar"
      />

      <main className="flex min-h-0 flex-1 flex-col px-6 py-6">
        {data && (
          <section className="mb-4 flex flex-wrap gap-x-8 gap-y-2 text-sm text-gran-muted">
            <p>
              <span className="font-montserrat text-xl font-bold text-gran-navy">
                {data.totalPeople}
              </span>{" "}
              pessoas
            </p>
            <p>
              <span className="font-montserrat text-xl font-bold text-gran-navy">
                {data.totalTribes}
              </span>{" "}
              tribos
            </p>
          </section>
        )}

        <section className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row">
            <label className="block min-w-0 flex-1">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gran-muted">
                Buscar
              </span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nome, e-mail, cargo ou tribo"
                className="select-field w-full"
              />
            </label>
            <label className="block w-full sm:w-56">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gran-muted">
                Tribo
              </span>
              <select
                value={tribe}
                onChange={(event) => setTribe(event.target.value)}
                className="select-field w-full"
              >
                <option value="all">Todas</option>
                {data?.tribes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setExpanded(new Set(collectExpandableIds(filteredRoots)))
              }
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gran-navy hover:bg-gray-50"
            >
              Expandir tudo
            </button>
            <button
              type="button"
              onClick={() => setExpanded(new Set())}
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gran-navy hover:bg-gray-50"
            >
              Recolher tudo
            </button>
          </div>
        </section>

        {error && (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {loading && !data ? (
          <p className="text-sm text-gran-muted">Carregando organograma…</p>
        ) : filteredRoots.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gran-muted">
            Nenhum resultado para os filtros atuais.
          </p>
        ) : (
          <div
            ref={viewportRef}
            onPointerDown={handleViewportPointerDown}
            onPointerMove={handleViewportPointerMove}
            onPointerUp={endViewportPan}
            onPointerCancel={endViewportPan}
            className={`min-h-[28rem] flex-1 overflow-auto rounded-xl border border-gray-200 bg-[linear-gradient(180deg,#eef2f7_0%,#f8fafc_40%,#ffffff_100%)] px-3 py-4 ${
              isPanning ? "cursor-grabbing select-none" : "cursor-grab"
            }`}
          >
            <div className="inline-block min-w-full">
              <ul className="org-chart">
                {filteredRoots.map((root) => {
                  const hasChildren = root.children.length > 0;
                  const isOpen = expanded.has(root.id);
                  return (
                    <li key={root.id}>
                      <PersonCard
                        node={root}
                        selected={selectedId === root.id}
                        onSelect={() => selectNode(root.id)}
                        hasChildren={hasChildren}
                        expanded={isOpen}
                        onToggle={() => toggleNode(root.id)}
                      />
                      {hasChildren && isOpen && (
                        <div className="org-children">
                          <ChartBranch
                            nodes={root.children}
                            expanded={expanded}
                            selectedId={selectedId}
                            onSelect={selectNode}
                            onToggle={toggleNode}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
