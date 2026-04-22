import Link from "next/link";
import { LegalPageShell } from "@/app/legal/LegalPageShell";

export const metadata = { title: "Data Handling for Minors - LiberiaLearn" };

export default function DataForMinorsPage() {
  return (
    <LegalPageShell title="Data Handling for Minors">
      <section>
        <p>
          LiberiaLearn is designed for children and young people in K-12 education. The platform collects only the data
          necessary to provide learning access, track progress, support teachers, inform guardians, and help schools and
          the Ministry of Education improve education delivery.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-[var(--ll-text)]">Limited Education Data</h2>
        <p className="mt-2">
          Student records may include name, grade, school, class assignment, learning activity, quiz scores, assignment
          progress, and guardian contact information. LiberiaLearn does not ask for unrelated personal details that are
          not needed for education delivery.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-[var(--ll-text)]">No Advertising or Commercial Profiling</h2>
        <p className="mt-2">
          LiberiaLearn does not use student data for advertising, behavioral ad targeting, or commercial profiling of
          minors. Session cookies are used only for authentication and platform security.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-[var(--ll-text)]">Guardian Rights</h2>
        <p className="mt-2">
          Guardians may request access to their child&apos;s LiberiaLearn information and may request deletion where
          deletion is permitted by school record obligations and applicable public education requirements.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-[var(--ll-text)]">Contact With Data Concerns</h2>
        <p className="mt-2">
          Guardians and schools can contact LiberiaLearn through the{" "}
          <Link href="/contact" className="text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
            contact page
          </Link>{" "}
          or email data-requests@liberialearn.org for data access, correction, deletion, or privacy questions. For
          additional detail, read the{" "}
          <Link href="/legal/privacy" className="text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
            Privacy Policy
          </Link>.
        </p>
      </section>
    </LegalPageShell>
  );
}
