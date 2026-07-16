export interface OrganogramEntry {
  level: number;
  name: string;
  email: string;
  /** Tribo / área (department na tabela legada `organogram`). */
  department: string;
  managerName: string;
  managerEmail: string;
  roleTitle?: string;
  tribe?: string;
  legacyManagerName?: string;
}

export interface OrganogramLookup {
  department: string;
  managerName: string;
  managerEmail: string;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function alternateEmails(email: string): string[] {
  const normalized = normalizeEmail(email);
  if (!normalized.includes("@")) return [normalized];

  const [local, domain] = normalized.split("@");
  const alternates = new Set<string>([normalized]);

  if (domain === "gran.com") {
    alternates.add(`${local}@grancursosonline.com.br`);
  } else if (domain === "grancursosonline.com.br") {
    alternates.add(`${local}@gran.com`);
  }

  return [...alternates];
}

export class OrganogramIndex {
  private byEmail = new Map<string, OrganogramEntry>();
  private byName = new Map<string, OrganogramEntry>();

  constructor(entries: OrganogramEntry[]) {
    for (const entry of entries) {
      if (entry.email) {
        for (const candidate of alternateEmails(entry.email)) {
          if (!this.byEmail.has(candidate)) {
            this.byEmail.set(candidate, entry);
          }
        }
      }

      const normalizedName = normalizeName(entry.name);
      if (normalizedName && !this.byName.has(normalizedName)) {
        this.byName.set(normalizedName, entry);
      }
    }
  }

  lookup(requesterEmail: string, requesterName: string): OrganogramLookup | null {
    const byEmail = this.findByEmail(requesterEmail);
    if (byEmail) {
      return {
        department: byEmail.department,
        managerName: byEmail.managerName,
        managerEmail: byEmail.managerEmail,
      };
    }

    const normalizedName = normalizeName(requesterName);
    const byName = this.byName.get(normalizedName);
    if (byName) {
      return {
        department: byName.department,
        managerName: byName.managerName,
        managerEmail: byName.managerEmail,
      };
    }

    return null;
  }

  findByEmail(email: string): OrganogramEntry | null {
    for (const candidate of alternateEmails(email)) {
      const entry = this.byEmail.get(candidate);
      if (entry) return entry;
    }
    return null;
  }

  all(): OrganogramEntry[] {
    return [...this.byEmail.values()];
  }

  byTribe(): Map<string, OrganogramEntry[]> {
    const result = new Map<string, OrganogramEntry[]>();
    for (const entry of this.byEmail.values()) {
      const tribe = entry.tribe || entry.department || "Sem tribo";
      const list = result.get(tribe) ?? [];
      list.push(entry);
      result.set(tribe, list);
    }
    return result;
  }
}
