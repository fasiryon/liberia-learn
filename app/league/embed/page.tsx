import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LiberiaLearn National School Rankings",
};

// Override X-Frame-Options for this route via Next.js headers in next.config.js
// (see next.config.js where /league/embed allows framing from moe.gov.lr)

async function getLeagueData() {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    const res = await fetch(`${baseUrl}/api/league`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { rows: [], term: "", updatedAt: null };
    return res.json();
  } catch {
    return { rows: [], term: "", updatedAt: null };
  }
}

function pct(n: number) {
  return `${Math.round(n)}%`;
}

export default async function LeagueEmbedPage() {
  const { rows = [], term = "", updatedAt } = await getLeagueData();

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        fontSize: 13,
        color: "#1a1a1a",
        padding: "12px",
        background: "#fff",
      }}
    >
      <div style={{ marginBottom: 8 }}>
        <strong>LiberiaLearn National School Rankings</strong>
        {term && <span style={{ marginLeft: 8, color: "#666", fontSize: 12 }}>Term: {term}</span>}
        {updatedAt && (
          <span style={{ marginLeft: 8, color: "#666", fontSize: 12 }}>
            · Updated: {new Date(updatedAt).toLocaleDateString()}
          </span>
        )}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: "#f9fafb" }}>
            {["Rank", "School", "County", "Avg Grade", "Attendance", "Lessons", "Score"].map((h) => (
              <th
                key={h}
                style={{ padding: "6px 10px", textAlign: "left", borderBottom: "1px solid #e5e7eb", fontWeight: 600 }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} style={{ padding: "16px", textAlign: "center", color: "#888" }}>
                No ranking data available yet.
              </td>
            </tr>
          )}
          {(rows as {
            id: string;
            nationalRank: number | null;
            schoolName: string;
            county: string;
            avgGrade: number;
            attendance: number;
            lessonCompletion: number;
            score: number;
          }[])
            .slice(0, 20)
            .map((r, idx) => (
              <tr key={r.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "6px 10px", fontWeight: "bold", color: "#d97706" }}>
                  {r.nationalRank ?? idx + 1}
                </td>
                <td style={{ padding: "6px 10px" }}>{r.schoolName}</td>
                <td style={{ padding: "6px 10px", color: "#666" }}>{r.county || "—"}</td>
                <td style={{ padding: "6px 10px" }}>{pct(r.avgGrade)}</td>
                <td style={{ padding: "6px 10px" }}>{pct(r.attendance)}</td>
                <td style={{ padding: "6px 10px" }}>{pct(r.lessonCompletion)}</td>
                <td style={{ padding: "6px 10px", fontWeight: 600 }}>{r.score.toFixed(1)}</td>
              </tr>
            ))}
        </tbody>
      </table>
      <p style={{ fontSize: 10, color: "#aaa", marginTop: 8 }}>
        Powered by LiberiaLearn · Ministry of Education
      </p>
    </div>
  );
}
