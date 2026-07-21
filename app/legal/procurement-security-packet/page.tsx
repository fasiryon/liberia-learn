import { LegalPageShell } from "@/app/legal/LegalPageShell";

export const metadata = { title: "Procurement and Security Packet - LiberiaLearn" };

export default function ProcurementSecurityPacketPage() {
  return (
    <LegalPageShell title="Procurement and Security Packet">
      <section>
        <p className="font-semibold text-[var(--ll-text)]">Prepared July 21, 2026</p>
        <p className="mt-2">
          This packet summarizes LiberiaLearn&apos;s current enterprise readiness for Ministry, procurement, and security
          review. It distinguishes implemented controls from planned controls so reviewers can evaluate the live system
          without overclaiming.
        </p>
      </section>

      <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-5">
        <h2 className="text-xl font-semibold text-[var(--ll-text)]">Current Limitations at a Glance</h2>
        <ul className="mt-3 space-y-2">
          <li>- SMS health is currently dry-run healthy, not live-provider verified.</li>
          <li>- Backups are stopgap CSV exports, not full database point-in-time recovery.</li>
          <li>- Safeguarding escalation status is reactive and queryable, not proactive alerting.</li>
          <li>- Retention enforcement is manual today; scheduled purge or anonymization is planned.</li>
          <li>- Some governed export job types need generation-path completion before they can be claimed complete.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-[var(--ll-text)]">Architecture Summary</h2>
        <p className="mt-2">
          LiberiaLearn is a Next.js application deployed on Vercel with Supabase/Postgres as the primary data store.
          Prisma is used for database access. Production health checks verify database access, migration state, AI
          configuration, and SMS runtime mode. SMS currently reports healthy in dry-run mode. If live provider
          credentials are present but not probe-verified, health labels that state as
          {" "}
          <code>smsMode: &quot;live_configured_unverified&quot;</code>
          {" "}
          rather than implying verified live delivery.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-[var(--ll-text)]">Access Control and Tenant Isolation</h2>
        <p className="mt-2">
          Role-based access control is enforced through authenticated server routes and permission checks. School admins
          and teachers are scoped to their school context. Guardians are scoped to linked learners. MOE dashboard views
          are read-only and aggregate by default. Authorized MOE exports can include pseudonymized school-cohort learner
          rows without names, emails, phone numbers, guardian contacts, or raw student identifiers.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-[var(--ll-text)]">Auditability and Exports</h2>
        <p className="mt-2">
          Audit logs, export records, and data-access logs exist for governance review. Audit logs are append-only in
          application code and protected by database immutability triggers. Compliance audit search and CSV export are
          implemented with role and permission checks. Aggregate governance exports for student performance, class
          summary, and monthly reporting are implemented. Some governed export job types remain partial and are listed
          as future-sprint work.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-[var(--ll-text)]">Safeguarding</h2>
        <p className="mt-2">
          Safeguarding-related records and review surfaces exist, and escalation status can be queried. Current
          safeguarding alerting is reactive and queryable rather than proactive. LiberiaLearn should not claim proactive
          safety notification until a real alerting workflow sends timely notifications to responsible reviewers and
          records delivery evidence.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-[var(--ll-text)]">Backup and Recovery</h2>
        <p className="mt-2">
          Current backups are nightly CSV stopgap exports to private Vercel Blob storage with 90-day pruning. This is
          not a full database backup or verified point-in-time restore posture. The procurement path should include the
          planned Supabase upgrade for managed backups and point-in-time recovery, followed by documented restore drills
          with real timings and row-count evidence.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-[var(--ll-text)]">Data Retention</h2>
        <p className="mt-2">
          Retention policy language is published, but automated retention enforcement is not yet implemented for the
          active-account-plus-2-years window. Current deletion and retention handling is manual and policy-bound. A
          scheduled purge or anonymization job with audit evidence is required before claiming automated retention
          enforcement.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-[var(--ll-text)]">SSO</h2>
        <p className="mt-2">
          Single sign-on is available on request and should be scoped once a specific institutional identity provider is
          named. Building SSO without a buyer-specified provider risks implementing the wrong protocol, claims mapping,
          and operational ownership model.
        </p>
      </section>
    </LegalPageShell>
  );
}
