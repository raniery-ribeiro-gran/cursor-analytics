import { Suspense } from "react";
import { LoginContent } from "@/components/LoginContent";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gran-bg text-sm text-gran-muted">
          Carregando…
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
