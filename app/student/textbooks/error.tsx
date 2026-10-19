"use client";
import Link from "next/link";
import styles from "@/components/textbooks/textbooks.module.css";
export default function TextbookError({ reset }: { reset: () => void }) { return <main id="main-content" className={styles.hub}><div className={styles.hubInner}><h1>We couldn&apos;t open this reading</h1><p>Check your connection and try again. Your saved reading aids do not grant offline access.</p><button className={styles.demoLink} onClick={reset}>Try again</button><Link className={styles.demoLink} href="/student/textbooks">Return to library</Link></div></main>; }
