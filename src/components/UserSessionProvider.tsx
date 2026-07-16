"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/lib/roles";

export interface ImpersonatorInfo {
  email: string;
  name: string;
}

export interface UserSession {
  email: string;
  name: string;
  department: string | null;
  initials: string;
  avatarUrl: string;
  role: UserRole;
  roleLabel: string;
  isAdmin: boolean;
  canPrioritize: boolean;
  canPrioritizeDemands: boolean;
  simulating: boolean;
  impersonator: ImpersonatorInfo | null;
}

interface UserSessionContextValue {
  session: UserSession | null;
  loading: boolean;
  logout: () => Promise<void>;
  loggingOut: boolean;
  refreshSession: () => Promise<void>;
  stopImpersonation: () => Promise<void>;
  stoppingImpersonation: boolean;
}

const UserSessionContext = createContext<UserSessionContextValue | null>(null);

export function UserSessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [stoppingImpersonation, setStoppingImpersonation] = useState(false);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/session");
      const data = await response.json();

      if (data.authenticated) {
        setSession({
          email: data.email,
          name: data.name,
          department: data.department ?? null,
          initials: data.initials,
          avatarUrl: data.avatarUrl,
          role: data.role,
          roleLabel: data.roleLabel,
          isAdmin: data.isAdmin,
          canPrioritize: data.canPrioritize,
          canPrioritizeDemands: data.canPrioritizeDemands,
          simulating: Boolean(data.simulating),
          impersonator: data.impersonator ?? null,
        });
      } else {
        setSession(null);
      }
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const logout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setSession(null);
      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }, [router]);

  const stopImpersonation = useCallback(async () => {
    setStoppingImpersonation(true);
    try {
      const response = await fetch("/api/auth/stop-impersonation", {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Erro ao encerrar simulação");
      }
      await refreshSession();
      router.refresh();
    } finally {
      setStoppingImpersonation(false);
    }
  }, [refreshSession, router]);

  const value = useMemo(
    () => ({
      session,
      loading,
      logout,
      loggingOut,
      refreshSession,
      stopImpersonation,
      stoppingImpersonation,
    }),
    [
      session,
      loading,
      logout,
      loggingOut,
      refreshSession,
      stopImpersonation,
      stoppingImpersonation,
    ],
  );

  return (
    <UserSessionContext.Provider value={value}>
      {children}
    </UserSessionContext.Provider>
  );
}

export function useUserSession(): UserSessionContextValue {
  const context = useContext(UserSessionContext);
  if (!context) {
    throw new Error("useUserSession must be used within UserSessionProvider");
  }
  return context;
}
