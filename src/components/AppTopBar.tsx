"use client";

import { UserMenu } from "./UserMenu";
import { useUserSession } from "./UserSessionProvider";

export function AppTopBar() {
  const { session, stoppingImpersonation, stopImpersonation } = useUserSession();

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 px-4 py-2.5 backdrop-blur sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {session?.simulating && session.impersonator ? (
          <p className="min-w-0 flex-1 text-sm text-gran-navy">
            <i
              className="fa-solid fa-user-secret mr-2 text-violet-600"
              aria-hidden="true"
            />
            Simulando usuário{" "}
            <strong className="font-semibold">{session.name}</strong>{" "}
            <span className="text-gran-muted">({session.email})</span>
            {" — "}
            <button
              type="button"
              onClick={() => void stopImpersonation()}
              disabled={stoppingImpersonation}
              className="font-semibold text-gran-blue hover:underline disabled:opacity-50"
            >
              {stoppingImpersonation
                ? "Voltando..."
                : `voltar ao usuário ${session.impersonator.name}`}
            </button>
          </p>
        ) : (
          <div className="flex-1" />
        )}
        <UserMenu />
      </div>
    </header>
  );
}
