export function TeacherDashboardBackLink() {
  return (
    <div className="flex items-center gap-3 mb-6">
      <a
        href="/teacher/dashboard"
        className="flex items-center gap-1.5 text-sm text-[var(--ll-text-faint)] transition-colors hover:text-[var(--ll-yellow)]"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M10 3L5 8l5 5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Back to Dashboard
      </a>
    </div>
  );
}
