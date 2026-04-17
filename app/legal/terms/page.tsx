import { LegalPageShell } from "@/app/legal/LegalPageShell";

export const metadata = { title: "Terms of Service - LiberiaLearn" };

export default function TermsOfServicePage() {
  return (
    <LegalPageShell title="Terms of Service">
      <section>
        <p className="font-semibold text-slate-100">Effective date: April 2026</p>
        <p className="mt-2">
          These Terms of Service govern access to and use of LiberiaLearn, a K-12 national education delivery platform
          serving students, guardians, teachers, schools, and Ministry of Education stakeholders in the Republic of
          Liberia.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white">Platform Purpose</h2>
        <p className="mt-2">
          LiberiaLearn exists to support K-12 education delivery, curriculum access, assessment, student support,
          school operations, and national education reporting. The platform is not a general social network or
          advertising service.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white">Permitted Use</h2>
        <p className="mt-2">
          Users may use LiberiaLearn only for educational purposes, school administration, guardian engagement, and
          authorized Ministry of Education oversight. Users must access only the records, classes, schools, and reports
          that their role permits.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white">School Administrator Responsibilities</h2>
        <p className="mt-2">
          School administrators are responsible for maintaining accurate student, teacher, class, school, and guardian
          records. Administrators must correct inaccurate student data promptly and must not create accounts or links
          for people who are not authorized to access the relevant school data.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white">Acceptable Use</h2>
        <p className="mt-2">
          Users must not harass, threaten, impersonate, misrepresent identity or school affiliation, interfere with
          platform security, or attempt automated scraping, credential stuffing, bulk extraction, or unauthorized access.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white">Intellectual Property</h2>
        <p className="mt-2">
          Curriculum content, generated lesson materials, assessments, platform workflows, and LiberiaLearn-branded
          materials are owned by LiberiaLearn unless a separate written agreement states otherwise. Schools and users
          receive access for education delivery, not ownership or resale rights.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white">Limitation of Liability</h2>
        <p className="mt-2">
          LiberiaLearn is provided to support education delivery and decision-making. To the fullest extent permitted by
          applicable law, LiberiaLearn is not liable for indirect, incidental, consequential, or punitive damages arising
          from platform use, interrupted access, user-entered data errors, or reliance on automated recommendations
          without appropriate educator review.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white">Governing Law</h2>
        <p className="mt-2">
          These Terms are governed by the laws and public education requirements of the Republic of Liberia.
        </p>
      </section>
    </LegalPageShell>
  );
}
