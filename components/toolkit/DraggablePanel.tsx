"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface DraggablePanelProps {
  title: string;
  onClose: () => void;
  onMinimize?: () => void;
  children: React.ReactNode;
  initialPosition?: { x: number; y: number };
  a11yLabel: string;
}

let nextZ = 1000;

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      "button,[href],input,select,textarea,[tabindex]:not([tabindex='-1'])"
    )
  ).filter((el) => !el.hasAttribute("disabled"));
}

export default function DraggablePanel({
  title,
  onClose,
  onMinimize,
  children,
  initialPosition = { x: 20, y: 20 },
  a11yLabel,
}: DraggablePanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState(initialPosition);
  const [zIndex, setZIndex] = useState(() => ++nextZ);
  const [minimized, setMinimized] = useState(false);

  const bounds = useMemo(() => {
    if (typeof window === "undefined") return { width: 1280, height: 720 };
    return { width: window.innerWidth, height: window.innerHeight };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!panelRef.current) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }

      if (event.key !== "Tab") return;
      const focusable = getFocusable(panelRef.current);
      if (!focusable.length) return;

      const active = document.activeElement as HTMLElement | null;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const node = panelRef.current;
    node?.addEventListener("keydown", onKeyDown);
    return () => node?.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const beginDrag = (startX: number, startY: number) => {
    const start = { ...position };
    const node = panelRef.current;
    const panelWidth = node?.offsetWidth ?? 420;
    const panelHeight = minimized ? 56 : node?.offsetHeight ?? 320;

    const onMove = (clientX: number, clientY: number) => {
      const maxX = Math.max(8, bounds.width - panelWidth - 8);
      const maxY = Math.max(8, bounds.height - panelHeight - 8);
      setPosition({
        x: Math.min(maxX, Math.max(8, start.x + clientX - startX)),
        y: Math.min(maxY, Math.max(8, start.y + clientY - startY)),
      });
    };

    const handleMouseMove = (event: MouseEvent) => onMove(event.clientX, event.clientY);
    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) onMove(touch.clientX, touch.clientY);
    };
    const stop = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", stop);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", stop);
  };

  return (
    <section
      ref={panelRef}
      role="dialog"
      aria-label={a11yLabel}
      tabIndex={-1}
      onMouseDown={() => setZIndex(++nextZ)}
      className="fixed w-[min(92vw,440px)] rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] text-[var(--ll-text)] shadow-none"
      style={{ left: position.x, top: position.y, zIndex }}
    >
      <header
        className="flex cursor-move items-center justify-between rounded-t-xl border-b border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2"
        onMouseDown={(event) => {
          event.preventDefault();
          setZIndex(++nextZ);
          beginDrag(event.clientX, event.clientY);
        }}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          if (!touch) return;
          setZIndex(++nextZ);
          beginDrag(touch.clientX, touch.clientY);
        }}
      >
        <h2 className="text-sm font-semibold">{title}</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`Minimize ${title}`}
            className="rounded border border-[var(--ll-border)] px-2 py-1 text-xs"
            onClick={() => {
              setMinimized((v) => !v);
              onMinimize?.();
            }}
          >
            _
          </button>
          <button
            type="button"
            aria-label={`Close ${title}`}
            className="rounded border border-rose-500 px-2 py-1 text-xs text-[var(--ll-danger)]"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </header>
      {!minimized && <div className="max-h-[70vh] overflow-auto p-3">{children}</div>}
    </section>
  );
}
