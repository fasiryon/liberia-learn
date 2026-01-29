export const dynamic = "force-dynamic";

type Row = {
  id: string;
  ewoId?: string | null;
  decision: string;
  schemaId?: string | null;
  curriculumContentId?: string | null;
  governanceTimestamp?: string | null;
  reason?: string | null;
};

async function getAccepted() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/governance/accepted`, {
    cache: "no-store",
  });

  // If NEXT_PUBLIC_BASE_URL isn't set, fallback to relative fetch during runtime.
  if (!res.ok) {
    const res2 = await fetch(`/api/governance/accepted`, { cache: "no-store" });
    return res2.json();
  }

  return res.json();
}

export default async function GovernancePage() {
  const data = await getAccepted();
  const rows: Row[] = data?.rows ?? [];

  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ fontSize: 22, marginBottom: 10 }}>Governance — Accepted Artifacts</h1>
      <div style={{ marginBottom: 12 }}>Showing {rows.length} latest ACCEPT decisions.</div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["timestamp", "ewoId", "schemaId", "curriculumContentId", "decision"].map((h) => (
              <th key={h} style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{r.governanceTimestamp ?? ""}</td>
              <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{r.ewoId ?? ""}</td>
              <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{r.schemaId ?? ""}</td>
              <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{r.curriculumContentId ?? ""}</td>
              <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{r.decision}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ marginTop: 14, color: "#666" }}>
        Tip: set NEXT_PUBLIC_BASE_URL in .env to your local dev URL (e.g. http://localhost:3000) if needed.
      </p>
    </div>
  );
}
