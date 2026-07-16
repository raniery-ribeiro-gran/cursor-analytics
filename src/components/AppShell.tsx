"use client";

import { usePathname } from "next/navigation";
import { AppTopBar } from "./AppTopBar";
import { Sidebar } from "./Sidebar";
import { SidebarProvider } from "./SidebarProvider";
import { UserSessionProvider } from "./UserSessionProvider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <UserSessionProvider>
      <SidebarProvider>
        <div className="flex min-h-screen bg-gran-bg">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <AppTopBar />
            {children}
          </div>
        </div>
      </SidebarProvider>
    </UserSessionProvider>
  );
}
