import Link from "next/link";

export default function AdminIndexPage() {
  return (
    <div style={{ padding: 16 }}>
      <h1>Admin</h1>
      <ul>
        <li><Link href="/admin/homework">Homework</Link></li>
        <li><Link href="/admin/analytics">Analytics</Link></li>
        <li><Link href="/admin/guardian-link">Guardian Links</Link></li>
      </ul>
    </div>
  );
}