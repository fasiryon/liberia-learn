type PortalIconProps = {
  label: string;
  accentClassName: string;
  className?: string;
};

export function PortalIcon({
  label,
  accentClassName,
  className = "",
}: PortalIconProps) {
  return (
    <div
      className={`flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-black ${accentClassName} ${className}`.trim()}
      aria-hidden="true"
    >
      {label}
    </div>
  );
}
