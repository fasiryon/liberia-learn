export default function Loading() {
  return (
    <div className="space-y-4 px-4 py-5" role="status" aria-label="Loading labs">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-8 w-32 rounded-lg bg-[var(--ll-surface)] animate-pulse motion-reduce:animate-none" />
        <div className="h-4 w-full max-w-md rounded bg-[var(--ll-surface)]/50 animate-pulse motion-reduce:animate-none" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-56 rounded-xl bg-[var(--ll-surface)]/50 animate-pulse motion-reduce:animate-none" />
          ))}
        </div>
      </div>
    </div>
  );
}
