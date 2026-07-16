"use client";

import Image from "next/image";
import { useState } from "react";
import { useUserSession } from "./UserSessionProvider";

function UserAvatar({
  name,
  initials,
  avatarUrl,
  size = "md",
}: {
  name: string;
  initials: string;
  avatarUrl: string;
  size?: "md" | "sm";
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const dimension = size === "sm" ? "h-8 w-8 text-xs" : "h-9 w-9 text-sm";
  const pixelSize = size === "sm" ? 32 : 36;

  if (!imageFailed && avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={name}
        width={pixelSize}
        height={pixelSize}
        unoptimized
        className={`${dimension} shrink-0 rounded-full object-cover ring-2 ring-white`}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <span
      className={`${dimension} flex shrink-0 items-center justify-center rounded-full bg-gran-blue font-semibold text-white ring-2 ring-white`}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

export function UserMenu() {
  const { session, loading, logout, loggingOut } = useUserSession();

  if (loading) {
    return (
      <div className="h-9 w-36 animate-pulse rounded-lg bg-gray-100" aria-hidden="true" />
    );
  }

  if (!session) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="hidden min-w-0 text-right sm:block">
        <p className="truncate text-sm font-semibold text-gran-navy">
          {session.name}
        </p>
        <p className="truncate text-xs text-gran-muted">
          {session.roleLabel} · {session.email}
        </p>
      </div>

      <UserAvatar
        name={session.name}
        initials={session.initials}
        avatarUrl={session.avatarUrl}
      />

      <button
        type="button"
        onClick={() => void logout()}
        disabled={loggingOut}
        className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gran-navy transition hover:bg-gray-50 disabled:opacity-50"
      >
        <i className="fa-solid fa-right-from-bracket" aria-hidden="true" />
        <span className="hidden md:inline">
          {loggingOut ? "Saindo…" : "Sair"}
        </span>
      </button>
    </div>
  );
}
