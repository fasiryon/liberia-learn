"use client";

function PencilIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className="transition-transform duration-150 group-hover:rotate-[-8deg]"
    >
      <rect
        x="2"
        y="8"
        width="10"
        height="5"
        rx="0.5"
        fill={active ? "var(--ll-yellow)" : "var(--ll-text-faint)"}
      />
      <path d="M2 13 L0.5 15 L2 13.5Z" fill="var(--ll-wood)" />
      <circle cx="0.8" cy="15" r="0.6" fill="var(--ll-graphite)" />
      <rect
        x="12"
        y="8"
        width="3"
        height="5"
        rx="0.5"
        fill={active ? "var(--ll-pink)" : "rgba(232,145,158,0.5)"}
      />
      <rect x="11.5" y="8" width="1" height="5" fill="var(--ll-silver)" />
    </svg>
  );
}

export function PencilButton({
  onClick,
  label = "Ask the tutor",
  active = false,
}: {
  onClick: () => void;
  label?: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`group relative flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-150 ${
        active
          ? "border-[var(--ll-yellow)] bg-[var(--ll-yellow-soft)] text-[var(--ll-yellow)]"
          : "border-[var(--ll-border)] bg-[var(--ll-surface-muted)] text-[var(--ll-text-muted)] hover:border-[var(--ll-border-strong)] hover:text-[var(--ll-text)]"
      }`}
    >
      <PencilIcon active={active} />
      <span>{label}</span>
    </button>
  );
}

export function PencilButtonFloat({
  onClick,
  active = false,
}: {
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open learning tools"
      className={`group fixed bottom-5 right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full border shadow-lg transition-all duration-150 sm:static sm:h-auto sm:w-auto sm:rounded-lg sm:px-3 sm:py-2 ${
        active
          ? "border-[var(--ll-yellow)] bg-[var(--ll-yellow-soft)]"
          : "border-[var(--ll-border-strong)] bg-[var(--ll-surface)] hover:border-[var(--ll-yellow)]"
      }`}
    >
      <PencilIcon active={active} />
    </button>
  );
}
