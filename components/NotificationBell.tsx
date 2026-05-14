"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

type InboxItem = {
  id: string;
  title: string;
  body: string;
  url: string | null;
  type: string;
  isRead: boolean;
  createdAt: string;
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  function fetchInbox() {
    fetch("/api/notifications/inbox", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setItems(d.items ?? []);
          setUnreadCount(d.unreadCount ?? 0);
        }
      })
      .catch(() => null);
  }

  useEffect(() => {
    fetchInbox();
    const interval = setInterval(fetchInbox, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function markRead(id: string) {
    fetch(`/api/notifications/inbox/${id}`, { method: "PATCH" }).catch(() => null);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, isRead: true } : i)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }

  function markAllRead() {
    fetch("/api/notifications/inbox/read-all", { method: "POST" }).catch(() => null);
    setItems((prev) => prev.map((i) => ({ ...i, isRead: true })));
    setUnreadCount(0);
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface)] hover:bg-[var(--ll-surface-muted)] focus-visible:outline-none"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
      >
        <Bell className="h-4 w-4 text-[var(--ll-text-muted)]" strokeWidth={1.5} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] shadow-lg">
          <div className="flex items-center justify-between border-b border-[var(--ll-border)] px-4 py-3">
            <p className="text-sm font-semibold text-[var(--ll-text)]">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs text-[var(--ll-yellow)] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-[var(--ll-text-muted)]">You&apos;re all caught up</p>
              </div>
            ) : (
              items.map((item) => {
                const content = (
                  <div
                    key={item.id}
                    className={`flex gap-3 border-b border-[var(--ll-border)] px-4 py-3 transition hover:bg-[var(--ll-surface-muted)] ${
                      !item.isRead ? "bg-[var(--ll-yellow)]/5" : ""
                    }`}
                    onClick={() => {
                      if (!item.isRead) markRead(item.id);
                      if (!item.url) setOpen(false);
                    }}
                  >
                    {!item.isRead && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--ll-yellow)]" aria-hidden="true" />
                    )}
                    {item.isRead && <span className="mt-1.5 h-2 w-2 shrink-0" aria-hidden="true" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[var(--ll-text)]">{item.title}</p>
                      <p className="mt-0.5 text-[11px] text-[var(--ll-text-muted)] line-clamp-2">
                        {item.body.slice(0, 80)}
                      </p>
                      <p className="mt-1 text-[10px] text-[var(--ll-text-faint)]">{relativeTime(item.createdAt)}</p>
                    </div>
                  </div>
                );

                if (item.url) {
                  return (
                    <Link key={item.id} href={item.url} onClick={() => { setOpen(false); if (!item.isRead) markRead(item.id); }}>
                      {content}
                    </Link>
                  );
                }
                return <div key={item.id}>{content}</div>;
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
