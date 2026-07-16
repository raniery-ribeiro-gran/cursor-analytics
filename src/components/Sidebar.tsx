"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "./SidebarProvider";
import { NAV_SECTIONS, type NavItem, type NavSection } from "@/lib/navigation";
import { useUserSession } from "./UserSessionProvider";

function CollapsedNavTooltip({ label }: { label: string }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-[calc(100%+0.625rem)] top-1/2 z-[100] -translate-y-1/2 whitespace-nowrap rounded-md bg-gran-navy px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      {label}
      <span
        className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-gran-navy"
        aria-hidden="true"
      />
    </span>
  );
}

function NavLink({
  item,
  active,
  collapsed,
  muted = false,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  muted?: boolean;
}) {
  return (
    <Link
      href={item.href}
      aria-label={collapsed ? item.label : undefined}
      className={`relative flex items-center rounded-lg font-semibold transition ${
        collapsed ? "group justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"
      } ${
        muted ? "text-xs" : "text-sm"
      } ${
        active
          ? muted
            ? "bg-gray-200 text-gran-navy shadow-sm"
            : "bg-gran-red text-white shadow-sm"
          : muted
            ? "text-gran-muted/80 hover:bg-gray-50 hover:text-gran-muted"
            : "text-gran-navy hover:bg-gray-100"
      }`}
    >
      <i
        className={`fa-solid ${item.icon} shrink-0 text-center ${
          collapsed ? "w-5 text-base" : "w-4"
        } ${
          active
            ? muted
              ? "text-gran-muted"
              : "text-white"
            : "text-gran-muted"
        } ${muted && !active ? "opacity-70" : ""}`}
        aria-hidden="true"
      />
      {collapsed && <CollapsedNavTooltip label={item.label} />}
      {!collapsed && <span className="flex-1 leading-snug">{item.label}</span>}
    </Link>
  );
}

function filterNavSections(
  sections: NavSection[],
  isAdmin: boolean,
  isReader: boolean,
  isLeader: boolean,
  canViewTeam: boolean,
): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (isReader) return Boolean(item.readerAllowed);
        if (isLeader) {
          return Boolean(item.readerAllowed || item.leaderOnly);
        }
        if (item.leaderOnly) return canViewTeam;
        if (item.adminOnly) return isAdmin;
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);
}

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, ready, toggle } = useSidebar();
  const { session, loading: sessionLoading } = useUserSession();
  const isCollapsed = ready && collapsed;
  const navSections = sessionLoading
    ? []
    : filterNavSections(
        NAV_SECTIONS,
        session?.isAdmin ?? false,
        session?.role === "leitor",
        session?.role === "lider",
        Boolean(session?.isAdmin || session?.role === "lider"),
      );

  return (
    <aside
      className={`relative flex shrink-0 flex-col overflow-visible border-r border-gray-200 bg-white transition-[width] duration-200 ease-in-out ${
        isCollapsed ? "w-[4.25rem]" : "w-72"
      }`}
    >
      <div
        className={`border-b border-gray-100 ${isCollapsed ? "px-2 py-4" : "px-5 py-5"}`}
      >
        <Link
          href="/"
          className={`flex ${isCollapsed ? "justify-center" : "block"}`}
          title="Gran — Cursor Analytics"
        >
          <Image
            src="/gran-logo.svg"
            alt="Gran"
            width={86}
            height={22}
            priority
            className={`w-auto ${isCollapsed ? "h-4" : "h-[22px]"}`}
          />
        </Link>
        {!isCollapsed && (
          <>
            <p className="mt-3 font-montserrat text-sm font-bold text-gran-navy">
              Cursor Analytics
            </p>
            <p className="text-xs text-gran-muted">
              Métricas de uso do Cursor — Engenharia
            </p>
          </>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!isCollapsed}
          aria-label={
            isCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"
          }
          className={`group relative mt-3 flex w-full items-center rounded-lg text-sm font-semibold text-gran-navy transition hover:bg-gray-100 ${
            isCollapsed ? "justify-center px-2 py-2" : "gap-2 px-0 py-1"
          }`}
        >
          <i
            className={`fa-solid ${isCollapsed ? "fa-angles-right" : "fa-angles-left"} w-4 text-center text-gran-muted`}
            aria-hidden="true"
          />
          {isCollapsed && <CollapsedNavTooltip label="Expandir menu" />}
          {!isCollapsed && (
            <span className="text-xs text-gran-muted">Recolher menu</span>
          )}
        </button>
      </div>

      <nav
        className={`flex-1 py-4 ${
          isCollapsed
            ? "overflow-visible px-2"
            : "overflow-x-hidden overflow-y-auto px-3"
        }`}
        aria-label="Menu principal"
        aria-busy={sessionLoading}
      >
        {sessionLoading ? (
          <div className="animate-pulse space-y-3 px-2" aria-hidden="true">
            {isCollapsed ? (
              <>
                <div className="mx-auto h-9 w-9 rounded-lg bg-gray-100" />
                <div className="mx-auto h-9 w-9 rounded-lg bg-gray-100" />
              </>
            ) : (
              <>
                <div className="h-3 w-16 rounded bg-gray-100" />
                <div className="h-10 rounded-lg bg-gray-100" />
                <div className="h-10 rounded-lg bg-gray-100" />
              </>
            )}
          </div>
        ) : null}
        {!sessionLoading && navSections.map((section, sectionIndex) => (
          <div
            key={section.title}
            className={`${sectionIndex > 0 ? "mt-4" : ""} ${isCollapsed ? "" : "mb-6 last:mb-0"}`}
          >
            {isCollapsed ? (
              sectionIndex > 0 && (
                <hr className="mb-3 border-gray-200" aria-hidden="true" />
              )
            ) : (
              <p
                className={`mb-2 px-3 font-bold uppercase tracking-wide ${
                  section.muted
                    ? "text-[10px] text-gran-muted/50"
                    : "text-xs text-gran-muted"
                }`}
              >
                {section.title}
              </p>
            )}
            <ul className={`space-y-1 ${section.muted ? "opacity-90" : ""}`}>
              {section.items.map((item) => (
                <li key={item.href}>
                  <NavLink
                    item={item}
                    active={pathname === item.href}
                    collapsed={isCollapsed}
                    muted={section.muted}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
