export default function Loading() {
  return (
    <div className="space-y-4 p-4">
      <div className="h-8 w-48 rounded-lg bg-[var(--ll-surface)] animate-pulse" />
      <div className="h-4 w-full rounded bg-[var(--ll-surface)]/50 animate-pulse" />
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-[var(--ll-surface)]/50 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
