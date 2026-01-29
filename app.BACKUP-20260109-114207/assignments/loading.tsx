// app/assignments/loading.tsx
export default function LoadingAssignments() {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#22c55e22,_transparent_60%),radial-gradient(circle_at_bottom,_#0ea5e922,_transparent_60%)]" />
        <div className="mx-auto max-w-5xl min-h-screen px-4 py-6 space-y-4">
          <header className="flex items-center justify-between rounded-3xl border border-white/5 bg-slate-950/70 px-4 py-3 shadow-lg shadow-black/40 backdrop-blur">
            <div>
              <div className="h-3 w-32 bg-slate-800 rounded animate-pulse mb-2" />
              <div className="h-5 w-48 bg-slate-700 rounded animate-pulse" />
            </div>
          </header>
          
          <section className="rounded-3xl border border-white/5 bg-slate-950/80 p-4 shadow-lg shadow-black/40 backdrop-blur">
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3">
                  <div className="h-4 w-3/4 bg-slate-800 rounded animate-pulse mb-2" />
                  <div className="h-3 w-1/2 bg-slate-800 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    );
  }