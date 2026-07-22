"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

export function PersonNameTooltip({
  name,
  tribe,
  leaderName,
  className,
}: {
  name: string;
  tribe?: string | null;
  leaderName?: string | null;
  className?: string;
}) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );
  const squad = tribe?.trim() || "—";
  const leader = leaderName?.trim() || "—";

  const show = useCallback((element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const preferredTop = rect.top - 8;
    const top = preferredTop < 88 ? rect.bottom + 8 : preferredTop;
    const left = Math.min(
      Math.max(12, rect.left),
      window.innerWidth - 220,
    );
    setCoords({
      top,
      left,
    });
    setOpen(true);
  }, []);

  const hide = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => setOpen(false);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [open]);

  return (
    <>
      <span
        className={`inline-flex max-w-full cursor-help ${className ?? ""}`}
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={(event) => show(event.currentTarget)}
        onMouseLeave={hide}
        onFocus={(event) => show(event.currentTarget)}
        onBlur={hide}
        tabIndex={0}
      >
        <span className="truncate border-b border-dotted border-gran-muted/50">
          {name}
        </span>
      </span>
      {open && coords
        ? createPortal(
            <span
              id={tooltipId}
              role="tooltip"
              className="pointer-events-none fixed z-[80] w-max max-w-xs rounded-lg border border-gray-200 bg-white px-3 py-2 text-left shadow-lg"
              style={{
                top: coords.top,
                left: coords.left,
                transform:
                  coords.top < 88 ? "translateY(0)" : "translateY(-100%)",
              }}
            >
              <span className="block text-[10px] font-bold uppercase tracking-wide text-gran-muted">
                Squad
              </span>
              <span className="mt-0.5 block text-xs font-semibold text-gran-navy">
                {squad}
              </span>
              <span className="mt-2 block text-[10px] font-bold uppercase tracking-wide text-gran-muted">
                Líder direto
              </span>
              <span className="mt-0.5 block text-xs font-semibold text-gran-navy">
                {leader}
              </span>
            </span>,
            document.body,
          )
        : null}
    </>
  );
}
