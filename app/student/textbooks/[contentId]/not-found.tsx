import Link from "next/link";
import styles from "@/components/textbooks/textbooks.module.css";
export default function MissingReading() { return <main id="main-content" className={styles.hub}><div className={styles.hubInner}><h1>Reading unavailable</h1><p>This reading may be unavailable for your grade or school, or no longer available. Ask your teacher for help choosing a reading.</p><Link className={styles.demoLink} href="/student/textbooks">Return to your library</Link></div></main>; }
