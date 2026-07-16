"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/lib/roles";
import { USER_ROLE_LABELS } from "@/lib/roles";
import { PageHeader } from "./PageHeader";
import { AutocompleteField } from "./AutocompleteField";
import { useUserSession } from "./UserSessionProvider";

interface AccessUser {
  email: string;
  name: string;
  department: string;
  role: UserRole;
  hasLoggedIn: boolean;
  updatedAt: string | null;
}

interface RoleOption {
  id: UserRole;
  label: string;
}

interface AddCandidate {
  email: string;
  name: string;
  department: string;
}

export function AccessControlSettings() {
  const router = useRouter();
  const { session, refreshSession } = useUserSession();
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [addCandidates, setAddCandidates] = useState<AddCandidate[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingEmail, setSavingEmail] = useState<string | null>(null);
  const [simulatingEmail, setSimulatingEmail] = useState<string | null>(null);
  const [simulateOpen, setSimulateOpen] = useState(false);
  const [simulateEmail, setSimulateEmail] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<UserRole>("leitor");
  const [addingUser, setAddingUser] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftRoles, setDraftRoles] = useState<Record<string, UserRole>>({});

  const addCandidateOptions = useMemo(
    () =>
      addCandidates.map((candidate) => ({
        value: candidate.email,
        label: candidate.name,
        description: candidate.email,
        meta: candidate.department,
      })),
    [addCandidates],
  );

  const simulateOptions = useMemo(() => {
    const people = new Map<string, AddCandidate>();
    for (const user of users) {
      people.set(user.email, {
        email: user.email,
        name: user.name,
        department: user.department,
      });
    }
    for (const candidate of addCandidates) {
      people.set(candidate.email, candidate);
    }

    return [...people.values()]
      .filter((person) => person.email !== session?.email)
      .map((person) => ({
        value: person.email,
        label: person.name,
        description: person.email,
        meta: person.department,
      }))
      .sort((a, b) =>
        a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" }),
      );
  }, [addCandidates, session?.email, users]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/configuracoes/usuarios");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Erro ao carregar usuários");
      }

      const loadedUsers = data.users as AccessUser[];
      setUsers(loadedUsers);
      setAddCandidates((data.addCandidates as AddCandidate[]) ?? []);
      setRoles(data.roles as RoleOption[]);
      setDraftRoles(
        Object.fromEntries(loadedUsers.map((user) => [user.email, user.role])),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function saveRole(email: string) {
    const role = draftRoles[email];
    if (!role) return;

    setSavingEmail(email);
    setError(null);
    try {
      const response = await fetch("/api/configuracoes/usuarios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Erro ao salvar perfil");
      }

      setUsers((prev) =>
        prev.map((user) =>
          user.email === email
            ? {
                ...user,
                role,
                updatedAt: data.user.updatedAt ?? user.updatedAt,
              }
            : user,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar perfil");
    } finally {
      setSavingEmail(null);
    }
  }

  function openAddModal() {
    setAddEmail("");
    setAddRole("leitor");
    setAddOpen(true);
    setError(null);
  }

  function openSimulateModal() {
    setSimulateEmail("");
    setSimulateOpen(true);
    setError(null);
  }

  async function addUser() {
    if (!addEmail.trim()) return;

    setAddingUser(true);
    setError(null);
    try {
      const response = await fetch("/api/configuracoes/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addEmail, role: addRole }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Erro ao adicionar usuário");
      }

      const user = data.user as AccessUser;
      setUsers((prev) =>
        [...prev, user].sort((a, b) =>
          a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
        ),
      );
      setDraftRoles((prev) => ({ ...prev, [user.email]: user.role }));
      setAddCandidates((prev) =>
        prev.filter((candidate) => candidate.email !== user.email),
      );
      setAddOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar usuário");
    } finally {
      setAddingUser(false);
    }
  }

  async function simulateUser(email: string) {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return;

    setSimulatingEmail(normalized);
    setError(null);
    try {
      const response = await fetch("/api/configuracoes/simular-usuario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Erro ao simular usuário");
      }

      await refreshSession();
      setSimulateOpen(false);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao simular usuário");
    } finally {
      setSimulatingEmail(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Controle de acesso"
        subtitle="Gerencie administradores e pré-cadastre colaboradores"
      />

      <main className="flex-1 px-6 py-6">
        <section className="mb-6 rounded-lg bg-white p-6 shadow-sm">
          <p className="text-sm text-gran-muted">
            Nesta fase os perfis gerenciáveis são{" "}
            <strong className="text-gran-navy">Administrador</strong> e{" "}
            <strong className="text-gran-navy">Leitor</strong>. A listagem inclui
            quem já acessou e quem foi{" "}
            <strong className="text-gran-navy">pré-cadastrado</strong>. No
            primeiro login, quem não foi pré-cadastrado recebe{" "}
            <strong className="text-gran-navy">Leitor</strong> automaticamente.
          </p>
        </section>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="overflow-hidden rounded-lg bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-4">
            <div>
              <h2 className="font-montserrat text-base font-bold text-gran-navy">
                Usuários com perfil
              </h2>
              <p className="mt-1 text-sm text-gran-muted">
                {users.length} cadastrado{users.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-md border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-semibold text-violet-900 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={openSimulateModal}
                disabled={simulateOptions.length === 0 || simulatingEmail != null}
              >
                <i className="fa-solid fa-user-secret" aria-hidden="true" />
                Simular usuário
              </button>
              <button
                type="button"
                className="btn-primary inline-flex items-center gap-2"
                onClick={openAddModal}
                disabled={addCandidates.length === 0}
                title={
                  addCandidates.length === 0
                    ? "Todos do organograma já possuem perfil"
                    : undefined
                }
              >
                <i className="fa-solid fa-user-plus" aria-hidden="true" />
                Adicionar usuário
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gran-muted">
              Carregando usuários...
            </div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-gran-muted">
              Nenhum usuário cadastrado ainda. Use &quot;Adicionar usuário&quot;
              ou aguarde o primeiro login.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gran-navy">
                  <tr>
                    {["Nome", "E-mail", "Área", "Status", "Perfil", "Ações"].map(
                      (col) => (
                        <th
                          key={col}
                          className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white"
                        >
                          {col}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((user) => {
                    const draftRole = draftRoles[user.email] ?? user.role;
                    const changed = draftRole !== user.role;
                    const isSelf = session?.email === user.email;

                    return (
                      <tr key={user.email} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-gran-navy">
                          {user.name}
                          {isSelf && (
                            <span className="ml-2 text-xs font-normal text-gran-muted">
                              (você)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gran-navy/80">{user.email}</td>
                        <td className="px-4 py-3 text-gran-muted">
                          {user.department}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {user.hasLoggedIn ? (
                            <span className="inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-gran-success">
                              Já acessou
                            </span>
                          ) : (
                            <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                              Pré-cadastrado
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            className="select-field min-w-[160px]"
                            value={draftRole}
                            onChange={(event) =>
                              setDraftRoles((prev) => ({
                                ...prev,
                                [user.email]: event.target.value as UserRole,
                              }))
                            }
                          >
                            {roles.map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              className="btn-primary text-xs"
                              disabled={!changed || savingEmail === user.email}
                              onClick={() => void saveRole(user.email)}
                            >
                              {savingEmail === user.email ? "Salvando..." : "Salvar"}
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-900 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={
                                simulatingEmail != null ||
                                user.email === session?.email
                              }
                              onClick={() => void simulateUser(user.email)}
                              title={
                                user.email === session?.email
                                  ? "Você já está autenticado com este e-mail"
                                  : "Simular este usuário"
                              }
                            >
                              <i className="fa-solid fa-user-secret" aria-hidden="true" />
                              {simulatingEmail === user.email
                                ? "Simulando..."
                                : "Simular"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-user-title"
          >
            <h2
              id="add-user-title"
              className="font-montserrat text-lg font-bold text-gran-navy"
            >
              Adicionar usuário
            </h2>
            <p className="mt-2 text-sm text-gran-muted">
              Vincule um perfil a alguém do organograma que ainda não acessou o
              sistema.
            </p>

            <div className="mt-4 space-y-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gran-muted">
                  Colaborador
                </span>
                <AutocompleteField
                  options={addCandidateOptions}
                  value={addEmail}
                  onChange={setAddEmail}
                  placeholder="Buscar por nome, e-mail ou área..."
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gran-muted">
                  Perfil
                </span>
                <select
                  className="select-field"
                  value={addRole}
                  onChange={(event) =>
                    setAddRole(event.target.value as UserRole)
                  }
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-gray-200 px-4 py-2 text-sm font-semibold text-gran-navy hover:bg-gray-50"
                disabled={addingUser}
                onClick={() => setAddOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={!addEmail || addingUser}
                onClick={() => void addUser()}
              >
                {addingUser ? "Adicionando..." : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {simulateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="simulate-user-title"
          >
            <h2
              id="simulate-user-title"
              className="font-montserrat text-lg font-bold text-gran-navy"
            >
              Simular usuário
            </h2>
            <p className="mt-2 text-sm text-gran-muted">
              Navegue pelo sistema com o perfil e permissões de outro colaborador
              do organograma. O banner no topo permite voltar à sua conta de
              administrador.
            </p>

            <div className="mt-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gran-muted">
                  Colaborador
                </span>
                <AutocompleteField
                  options={simulateOptions}
                  value={simulateEmail}
                  onChange={setSimulateEmail}
                  placeholder="Buscar por nome, e-mail ou área..."
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-gray-200 px-4 py-2 text-sm font-semibold text-gran-navy hover:bg-gray-50"
                disabled={simulatingEmail != null}
                onClick={() => setSimulateOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-md bg-violet-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!simulateEmail || simulatingEmail != null}
                onClick={() => void simulateUser(simulateEmail)}
              >
                <i className="fa-solid fa-user-secret" aria-hidden="true" />
                {simulatingEmail ? "Iniciando..." : "Simular"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
