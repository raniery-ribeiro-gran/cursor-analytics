"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Step = "email" | "token";

export function LoginContent() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/";

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!expiresAt) return undefined;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };

    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [expiresAt]);

  async function sendTokenRequest() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/request-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Não foi possível enviar o código");
      }

      setName(data.name ?? null);
      setStep("token");
      setToken("");
      setExpiresAt(Date.now() + (data.expiresInSeconds ?? 60) * 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao solicitar código");
    } finally {
      setLoading(false);
    }
  }

  async function requestToken(event: React.FormEvent) {
    event.preventDefault();
    await sendTokenRequest();
  }

  async function resendToken() {
    await sendTokenRequest();
  }

  async function verifyToken(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/verify-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Código inválido");
      }

      const role = typeof data.role === "string" ? data.role : null;
      const destination =
        from.startsWith("/login") || from === "/"
          ? "/"
          : role === "leitor" && from !== "/"
            ? "/"
            : from;
      // Hard navigation garante que o cookie Set-Cookie seja enviado ao middleware.
      window.location.assign(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao validar código");
      setLoading(false);
    }
  }

  function handleTokenChange(value: string) {
    setToken(value.toUpperCase().replace(/\s/g, ""));
    if (error) setError(null);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gran-bg px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src="/gran-logo.svg"
            alt="Gran"
            width={120}
            height={40}
            className="h-10 w-auto"
            priority
          />
          <h1 className="mt-6 font-montserrat text-xl font-bold text-gran-navy">
            Cursor Analytics
          </h1>
          <p className="mt-2 text-sm text-gran-muted">
            Acesso restrito a colaboradores do organograma de Tecnologia.
          </p>
        </div>

        {step === "email" ? (
          <form onSubmit={requestToken} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="mb-1.5 block text-sm font-semibold text-gran-navy"
              >
                E-mail corporativo
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                placeholder="nome@gran.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="select-field w-full"
              />
              <p className="mt-1.5 text-xs text-gran-muted">
                Obrigatório terminar em @gran.com
              </p>
            </div>

            {error && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-gran-blue px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gran-blue/90 disabled:opacity-50"
            >
              {loading ? "Enviando…" : "Enviar código de acesso"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyToken} className="space-y-4">
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-gran-navy">
              Código enviado para <strong>{email}</strong>
              {name ? ` (${name})` : ""}. Verifique sua caixa de entrada.
            </div>

            <div>
              <label
                htmlFor="login-token"
                className="mb-1.5 block text-sm font-semibold text-gran-navy"
              >
                Código de 8 caracteres
              </label>
              <input
                id="login-token"
                type="text"
                required
                autoComplete="one-time-code"
                inputMode="text"
                maxLength={8}
                placeholder="ABC12345"
                value={token}
                onChange={(event) => handleTokenChange(event.target.value)}
                className="select-field w-full text-center font-mono text-lg tracking-widest"
              />
              <p className="mt-1.5 text-xs text-gran-muted">
                {secondsLeft > 0 ? (
                  `Expira em ${secondsLeft}s`
                ) : (
                  <>
                    Código expirado.{" "}
                    <button
                      type="button"
                      onClick={() => void resendToken()}
                      disabled={loading}
                      className="font-semibold text-gran-blue hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loading ? "Reenviando…" : "Reenviar código"}
                    </button>
                  </>
                )}
              </p>
            </div>

            {error && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || secondsLeft === 0 || token.length !== 8}
              className="w-full rounded-md bg-gran-blue px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gran-blue/90 disabled:opacity-50"
            >
              {loading ? "Validando…" : "Entrar"}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep("email");
                setError(null);
                setExpiresAt(null);
              }}
              className="w-full text-sm font-semibold text-gran-blue hover:underline"
            >
              Usar outro e-mail
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
