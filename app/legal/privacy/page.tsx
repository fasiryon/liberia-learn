import { LegalPageShell } from "@/app/legal/LegalPageShell";

export const metadata = { title: "Privacy Policy - LiberiaLearn" };

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell title="Privacy Policy">
      <section>
        <p className="font-semibold text-slate-100">Effective date: April 2026</p>
        <p className="mt-2">
          This Privacy Policy explains how LiberiaLearn, operating for education delivery in the Republic of Liberia,
          collects, uses, stores, and protects information for students, guardians, teachers, school administrators,
          and Ministry of Education users.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white">Data We Collect</h2>
        <p className="mt-2">
          LiberiaLearn collects the minimum data needed to deliver K-12 education services. This may include a
          learner&apos;s name, grade, school, learning activity, lesson progress, quiz scores, attendance or assignment
          activity, and guardian contact information. For staff and administrators, the platform may collect account,
          role, school, and activity records needed to operate the service.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white">Who Can See Student Data</h2>
        <p className="mt-2">
          Student-level information is limited to authorized users with a legitimate education role. A teacher of
          record may see students assigned to their classes. A school administrator may see student records for their
          own school. A guardian may see information for their linked child. Ministry of Education users see aggregate
          national, county, district, school, or subject reporting only; MOE views do not permit individual student
          drilldown.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white">Storage and Security</h2>
        <p className="mt-2">
          LiberiaLearn stores platform data in Supabase/Postgres with encryption at rest. Application delivery runs
          through the Vercel edge network. Access controls, role-based authorization, tenant isolation, audit logging,
          and secure session handling are used to protect education records.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white">Retention</h2>
        <p className="mt-2">
          Student and account data is retained for the active account lifetime plus 2 years, unless a longer retention
          period is required for lawful education administration, audit obligations, or verified school records.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white">No Sale or Advertising Use</h2>
        <p className="mt-2">
          Student data is never sold. LiberiaLearn does not share student data with advertisers or third parties for
          commercial advertising, tracking, or profiling purposes.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white">Guardian Requests</h2>
        <p className="mt-2">
          Guardians may request access to their child&apos;s data or request deletion where deletion is permitted by
          school and public education record requirements. Requests may be submitted through the contact page or by
          email to data-requests@liberialearn.org. Data-related inquiries should include the guardian&apos;s name, the
          child&apos;s name, school, and a safe contact method.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white">Governing Entity</h2>
        <p className="mt-2">
          This policy is governed by LiberiaLearn / Republic of Liberia for the purpose of national education delivery.
        </p>
      </section>
    </LegalPageShell>
  );
}
