import { ImageResponse } from "next/og";

import { prisma } from "@/lib/db";
import { verifyShareToken } from "@/lib/certificates/shareToken";
import { resolveLessonTitle } from "@/lib/lessons/resolveLessonTitle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Liberian flag colors
const RED = "#BF0A30";
const BLUE = "#002868";
const GOLD = "#FFD700";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token") ?? "";

  if (!verifyShareToken(params.id, token)) {
    return new Response("Forbidden", { status: 403 });
  }

  const certificate = await prisma.certificate.findUnique({
    where: { id: params.id },
    select: {
      type: true,
      referenceId: true,
      awardedAt: true,
      certificateCode: true,
      student: {
        select: { user: { select: { name: true } } },
      },
    },
  });

  if (!certificate) {
    return new Response("Not Found", { status: 404 });
  }

  let title = `${certificate.referenceId.replace(/_/g, " ")} Subject`;
  let subject = certificate.referenceId.replace(/_/g, " ");

  if (certificate.type === "LESSON") {
    const sw = await prisma.scheduledWork.findUnique({
      where: { id: certificate.referenceId },
      select: {
        content: { select: { payload: true, subject: true, contentId: true } },
      },
    });
    if (sw) {
      const payload = (sw.content.payload ?? {}) as Record<string, unknown>;
      title = resolveLessonTitle({
        payload,
        subject: sw.content.subject,
        fallbackTitle: sw.content.contentId,
      });
      subject = sw.content.subject.replace(/_/g, " ");
    }
  }

  const studentName = certificate.student.user?.name ?? "Student";
  const awardedDate = new Date(certificate.awardedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const typeLabel =
    certificate.type === "LESSON" ? "Lesson Certificate" : "Subject Certificate";

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0a0a0a",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Top accent bar — Liberian flag stripe */}
        <div style={{ display: "flex", height: 10, width: "100%" }}>
          <div style={{ flex: 1, backgroundColor: RED }} />
          <div style={{ flex: 1, backgroundColor: "#ffffff" }} />
          <div style={{ flex: 1, backgroundColor: RED }} />
          <div style={{ flex: 1, backgroundColor: "#ffffff" }} />
          <div style={{ flex: 1, backgroundColor: RED }} />
        </div>

        {/* Blue left sidebar accent */}
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 0,
            width: 8,
            height: 620,
            backgroundColor: BLUE,
            display: "flex",
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            padding: "40px 80px",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: GOLD,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
              }}
            >
              🎓
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: "0.2em",
                  color: GOLD,
                  textTransform: "uppercase",
                }}
              >
                LiberiaLearn
              </span>
              <span style={{ fontSize: 11, color: "#888", letterSpacing: "0.12em" }}>
                CERTIFICATE OF ACHIEVEMENT
              </span>
            </div>
          </div>

          {/* Divider */}
          <div
            style={{
              width: 80,
              height: 3,
              backgroundColor: GOLD,
              marginBottom: 28,
              display: "flex",
            }}
          />

          {/* Certifies that */}
          <span style={{ fontSize: 16, color: "#aaa", marginBottom: 8, display: "flex" }}>
            This certifies that
          </span>

          {/* Student name */}
          <span
            style={{
              fontSize: 56,
              fontWeight: 700,
              color: GOLD,
              marginBottom: 12,
              textAlign: "center",
              display: "flex",
              lineHeight: 1.1,
            }}
          >
            {studentName}
          </span>

          {/* Has successfully completed */}
          <span style={{ fontSize: 16, color: "#aaa", marginBottom: 10, display: "flex" }}>
            has successfully completed
          </span>

          {/* Lesson title */}
          <span
            style={{
              fontSize: 30,
              fontWeight: 600,
              color: "#ffffff",
              textAlign: "center",
              maxWidth: 900,
              marginBottom: 8,
              display: "flex",
              lineHeight: 1.2,
            }}
          >
            {title}
          </span>

          {/* Subject · Type */}
          <span style={{ fontSize: 15, color: "#888", marginBottom: 28, display: "flex" }}>
            {subject} · {typeLabel}
          </span>

          {/* Footer row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
              borderTop: "1px solid #2a2a2a",
              paddingTop: 16,
            }}
          >
            <span style={{ fontSize: 13, color: "#666", display: "flex" }}>
              {awardedDate}
            </span>
            <span
              style={{
                fontSize: 13,
                fontFamily: "monospace",
                color: GOLD,
                letterSpacing: "0.12em",
                display: "flex",
              }}
            >
              {certificate.certificateCode}
            </span>
            <span style={{ fontSize: 13, color: "#555", display: "flex" }}>
              liberialearn.vercel.app
            </span>
          </div>
        </div>

        {/* Bottom accent */}
        <div style={{ display: "flex", height: 6, width: "100%" }}>
          <div style={{ flex: 2, backgroundColor: RED }} />
          <div style={{ flex: 1, backgroundColor: "#ffffff" }} />
          <div style={{ flex: 2, backgroundColor: BLUE }} />
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
