import {
  MANAGEABLE_USER_ROLES,
  USER_ROLE_DESCRIPTIONS,
  USER_ROLE_LABELS,
} from "@/lib/roles";
import { PageHeader } from "./PageHeader";

export function ProfilesSettings() {
  return (
    <>
      <PageHeader
        title="Perfis de acesso"
        subtitle="Referência dos perfis disponíveis nesta fase do Cursor Analytics"
      />

      <main className="flex-1 space-y-4 px-6 py-6">
        <section className="rounded-lg border border-blue-200 bg-blue-50 p-5 text-sm text-gran-navy">
          Perfis desta fase: <strong>Administrador</strong>,{" "}
          <strong>Líder</strong> e <strong>Leitor</strong> (padrão no primeiro
          login). O Líder acessa o Team Token Usage com a hierarquia do
          organograma.
        </section>

        {MANAGEABLE_USER_ROLES.map((role) => (
          <section
            key={role}
            className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-montserrat text-lg font-bold text-gran-navy">
                {USER_ROLE_LABELS[role]}
              </h2>
              {role === "administrador" ? (
                <span className="rounded-full bg-gran-navy/10 px-2.5 py-0.5 text-xs font-semibold text-gran-navy">
                  Acesso total
                </span>
              ) : role === "lider" ? (
                <span className="rounded-full bg-gran-blue/10 px-2.5 py-0.5 text-xs font-semibold text-gran-navy">
                  Time
                </span>
              ) : (
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gran-muted">
                  Padrão no login
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-gran-navy/80">
              {USER_ROLE_DESCRIPTIONS[role]}
            </p>
          </section>
        ))}

        <section className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gran-muted shadow-sm">
          Para promover alguém a Administrador ou Líder, ou rebaixar para Leitor,
          use <strong className="text-gran-navy">Controle de acesso</strong> em
          Configurações.
        </section>
      </main>
    </>
  );
}
