import { SkeletonCard, SkeletonRow } from "@/components/ui/Skeleton"

export default function Loading() {
  return (
    <div className="space-y-6 p-4">
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-[var(--ll-surface-muted)] animate-pulse" />
    </div>
  )
}
