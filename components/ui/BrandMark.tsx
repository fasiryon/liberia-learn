export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-label="LiberiaLearn"
    >
      {/* Pencil barrel */}
      <rect x="4" y="6" width="14" height="12" rx="1" fill="var(--ll-yellow)" opacity="0.9" />
      {/* Ferrule */}
      <rect x="16" y="6" width="2" height="12" fill="var(--ll-silver)" />
      {/* Eraser */}
      <rect x="18" y="6" width="3" height="12" rx="1" fill="var(--ll-pink)" opacity="0.9" />
      {/* Tip */}
      <path d="M4 9 L1 12 L4 15 Z" fill="var(--ll-wood)" />
      {/* Graphite */}
      <circle cx="1.2" cy="12" r="0.8" fill="var(--ll-graphite)" />
    </svg>
  );
}
