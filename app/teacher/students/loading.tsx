export default function Loading() {
  return (
    <div className="space-y-4 p-4">
      <div className="h-8 w-48 rounded-lg bg-slate-800 animate-pulse" />
      <div className="h-4 w-full rounded bg-slate-800/50 animate-pulse" />
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 rounded-2xl bg-slate-800/50 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
