import Link from "next/link";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listAuthorizedLearnerContent } from "@/lib/student/learnDiscovery.server";
import { buildCurriculumDisplayTitle } from "@/lib/curriculum/title";
import styles from "@/components/textbooks/textbooks.module.css";

export const dynamic = "force-dynamic";

export default async function StudentTextbooksPage() {
  const user = await requireRole("STUDENT");
  const student = await prisma.student.findUnique({ where: { userId: user.id }, select: { currentGrade: true, deletedAt: true, user: { select: { schoolId: true } } } });
  const validStudent = student && !student.deletedAt && user.schoolId && student.user.schoolId === user.schoolId;
  const lessons = validStudent && student.currentGrade ? await listAuthorizedLearnerContent(user, { grade: student.currentGrade, contentType: { in: ["lesson", "unit_plan", "term_plan", "full_pack"] } }, 36) : [];
  const subjects = [...new Set(lessons.map(row => row.subject))];
  return <main id="main-content" className={styles.hub}><div className={styles.hubInner}>
    <Link className={styles.back} href="/dashboard">Back to Dashboard</Link>
    <header className={styles.hubHeader}><div className={styles.brand}><BookOpen size={23} /> Liberia<span>Learn</span></div><p className={styles.eyebrow}>YOUR READING ROOM</p><h1>My Textbooks</h1><p>Good ideas deserve room to grow. Explore the curriculum readings available for your grade, one page at a time.</p><p>These are authorized curriculum readings, not published textbook editions. Compiled books are not available in this library yet.</p>
      {process.env.NODE_ENV !== "production" && <Link href="/pilot-preview/textbooks" className={styles.demoLink}>Explore the synthetic book demo <ArrowUpRight size={16} /></Link>}
    </header>
    {!lessons.length ? <section className={styles.notice}><h2>{!validStudent ? "Library unavailable" : !student.currentGrade ? "Your placement comes first" : "Your reading shelf is waiting"}</h2><p>{!validStudent ? "Ask your teacher to check your school access." : !student.currentGrade ? "Ask your teacher to complete your grade placement so your readings can appear here." : "No readings are available for your grade yet. Your teacher can help you find a lesson to read."}</p></section> : <div className={styles.shelves}>{subjects.map(subject => <section className={styles.shelf} key={subject}><h2>{String(subject).replace(/_/g, " ")}</h2>{lessons.filter(row => row.subject === subject).map(row => <Link className={styles.readingCard} key={row.contentId} href={row.contentType === "lesson" ? `/student/textbooks/${encodeURIComponent(row.contentId)}` : `/student/lesson/${encodeURIComponent(row.contentId)}`}><span>{buildCurriculumDisplayTitle({ title: row.title, subject: row.subject, gradeLevel: row.grade })}<small>Grade {row.grade} · {row.contentType.replace(/_/g, " ")} · {row.contentType === "lesson" ? "Open reading" : "Open curriculum resource"}</small></span><ArrowUpRight size={18} /></Link>)}</section>)}</div>}
  </div></main>;
}
