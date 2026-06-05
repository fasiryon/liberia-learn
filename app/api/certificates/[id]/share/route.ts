import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { resolveLessonTitle } from "@/lib/lessons/resolveLessonTitle";
import { generateShareToken } from "@/lib/certificates/shareToken";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole("STUDENT", "ADMIN");

    const certificate = await prisma.certificate.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        type: true,
        referenceId: true,
        awardedAt: true,
        student: {
          select: {
            userId: true,
            user: { select: { name: true } },
          },
        },
      },
    });

    if (!certificate) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (user.role === "STUDENT" && certificate.student.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let title = `${certificate.referenceId.replace(/_/g, " ")} Subject`;

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
      }
    }

    const shareToken = generateShareToken(params.id);
    const baseUrl =
      process.env.NEXTAUTH_URL ?? "https://liberia-learn.vercel.app";
    const shareUrl = `${baseUrl}/share/certificate/${params.id}?token=${shareToken}`;
    const imageUrl = `${baseUrl}/api/certificates/${params.id}/image?token=${shareToken}`;

    await prisma.certificateShare.upsert({
      where: { shareToken },
      create: {
        certificateId: params.id,
        sharedById: user.id,
        shareToken,
        channel: "whatsapp",
      },
      update: { sharedById: user.id },
    });

    const studentName = certificate.student.user?.name ?? "A student";
    const whatsappText = `🎓 ${studentName} just earned a certificate in ${title} on LiberiaLearn! View it here: ${shareUrl}`;

    return NextResponse.json({ shareUrl, imageUrl, whatsappText });
  } catch (error) {
    return handleApiError(error);
  }
}
