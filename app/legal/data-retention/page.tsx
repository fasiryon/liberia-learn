import { LegalPageShell } from "@/app/legal/LegalPageShell";

export const metadata = { title: "Data Retention Policy - LiberiaLearn" };

export default function DataRetentionPolicyPage() {
  return (
    <LegalPageShell title="Data Retention Policy">
      <section>
        <p className="font-semibold text-[var(--ll-text)]">Effective date: July 21, 2026</p>
        <p className="mt-2">
          This policy describes LiberiaLearn&apos;s current data retention practice and the enforcement work still
          planned. It is intentionally current-state accurate: where automation is not yet implemented, this policy says
          so directly.
        </p>
      </section>

      <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-5">
        <h2 className="text-xl font-semibold text-[var(--ll-text)]">Current Limitations at a Glance</h2>
        <ul className="mt-3 space-y-2">
          <li>- Automated retention enforcement is not yet implemented.</li>
          <li>- Deletion and retention review is currently manual and policy-bound.</li>
          <li>- Current backups are stopgap CSV backups, not full database point-in-time recovery.</li>
          <li>- Supabase managed backup and restore capability requires the planned paid-tier upgrade.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-[var(--ll-text)]">Current Practice</h2>
        <p className="mt-2">
          Student, guardian, teacher, school, assignment, progress, attendance, and operational records are retained
          while the school or account remains active. Retention after offboarding is currently handled through
          operational review rather than an automated purge or anonymization job. LiberiaLearn has not yet implemented
          scheduled retention enforcement for the active-account-plus-2-years window stated in the privacy policy.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-[var(--ll-text)]">Audit and Access Records</h2>
        <p className="mt-2">
          Audit logs, export records, and data-access logs are retained for accountability and procurement review. Audit
          logs are append-only in the application and protected by database immutability triggers. They are not deleted
          during ordinary account cleanup because they preserve evidence of administrative, safeguarding, export, and
          security-relevant activity.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-[var(--ll-text)]">Backups</h2>
        <p className="mt-2">
          The current backup job is a stopgap nightly CSV backup to private Vercel Blob storage with 90-day pruning. It
          is useful for targeted recovery evidence, but it is not a full database backup or a verified point-in-time
          restore system. LiberiaLearn remains on the Supabase free tier, so the procurement posture should reference
          the planned Supabase upgrade for managed backups, point-in-time recovery, and formal restore drills before
          national-scale rollout.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-[var(--ll-text)]">Requests and Deletion</h2>
        <p className="mt-2">
          Guardians and schools may request access, correction, or deletion review. Deletion is evaluated against school
          record obligations, safeguarding obligations, audit obligations, and Ministry requirements. Where deletion is
          permitted, the current process is manual and policy-bound. A scheduled purge or anonymization job matching the
          stated retention window is planned but not yet implemented.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-[var(--ll-text)]">Planned Enforcement Work</h2>
        <p className="mt-2">
          The next required engineering step is a real retention-enforcement workflow: scheduled review, purge or
          anonymization by data class, audit evidence for every action, and exception handling for legal, school-record,
          safeguarding, or procurement holds.
        </p>
      </section>
    </LegalPageShell>
  );
}
