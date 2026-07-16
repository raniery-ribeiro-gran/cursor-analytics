export interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** Visível apenas para administradores. */
  adminOnly?: boolean;
  /** Visível para o perfil Leitor (única tela liberada). */
  readerAllowed?: boolean;
  /** Visível apenas para Líder (e Admin). */
  leaderOnly?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
  /** Seção secundária, com menos destaque visual no menu. */
  muted?: boolean;
}

export const HOME_NAV: NavSection = {
  title: "Início",
  items: [
    {
      href: "/",
      label: "My Token Usage",
      icon: "fa-chart-line",
      readerAllowed: true,
    },
  ],
};

export const STATS_NAV: NavSection = {
  title: "Estatísticas",
  items: [
    {
      href: "/estatisticas/members-usage",
      label: "Members Usage Cycle",
      icon: "fa-chart-column",
    },
    {
      href: "/estatisticas/members-token-usage",
      label: "Members Token Usage",
      icon: "fa-microchip",
    },
    {
      href: "/estatisticas/team-token-usage",
      label: "Team Token Usage",
      icon: "fa-people-group",
      leaderOnly: true,
    },
  ],
};

export const SETTINGS_NAV: NavSection = {
  title: "Configurações",
  items: [
    {
      href: "/configuracoes/dados",
      label: "Dados",
      icon: "fa-database",
      adminOnly: true,
    },
    {
      href: "/configuracoes/organograma",
      label: "Organograma",
      icon: "fa-sitemap",
    },
    {
      href: "/configuracoes/controle-acesso",
      label: "Controle de acesso",
      icon: "fa-users-gear",
      adminOnly: true,
    },
    {
      href: "/configuracoes/logs-acesso",
      label: "Logs de acesso",
      icon: "fa-shield-halved",
      adminOnly: true,
    },
  ],
};

export const NAV_SECTIONS: NavSection[] = [HOME_NAV, STATS_NAV, SETTINGS_NAV];

export function pageTitleForPath(pathname: string): string {
  for (const section of NAV_SECTIONS) {
    const item = section.items.find((entry) => entry.href === pathname);
    if (item) return item.label;
  }
  return "Cursor Analytics";
}
