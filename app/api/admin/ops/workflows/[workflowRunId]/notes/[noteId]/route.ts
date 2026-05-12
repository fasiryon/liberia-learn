import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  updateOperatorNote,
  deleteOperatorNote,
  NOTE_STATUSES,
  NOTE_SEVERITIES,
  type NoteStatus,
  type NoteSeverity,
} from "@/lib/autonomous/operatorIncidentNoteService";
import { isRuntimeDashboardEnabled } from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { workflowRunId: string; noteId: string } }
) {
  try {
    const user = await requireUser();
    if (!user.isPlatformAdmin) {
      return NextResponse.json({ error: "Platform admin required" }, { status: 403 });
    }
    if (!isRuntimeDashboardEnabled()) {
      return NextResponse.json({ error: "Runtime dashboard disabled" }, { status: 403 });
    }

    const body = await req.json();
    const status: NoteStatus | undefined = body.status;
    const severity: NoteSeverity | undefined = body.severity;
    const noteBody: string | undefined = body.body;

    if (status !== undefined && !NOTE_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${NOTE_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }
    if (severity !== undefined && severity !== null && !NOTE_SEVERITIES.includes(severity)) {
      return NextResponse.json(
        { error: `Invalid severity. Must be one of: ${NOTE_SEVERITIES.join(", ")}` },
        { status: 400 }
      );
    }

    const updated = await updateOperatorNote(params.noteId, user.id, {
      status,
      severity,
      body: noteBody,
    });

    void logAudit({
      action: "autonomous.incident.note.updated",
      userId: user.id,
      resourceType: "WorkflowRun",
      resourceId: params.workflowRunId,
      details: { noteId: params.noteId, status, severity },
    });

    return NextResponse.json({ note: updated });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { workflowRunId: string; noteId: string } }
) {
  try {
    const user = await requireUser();
    if (!user.isPlatformAdmin) {
      return NextResponse.json({ error: "Platform admin required" }, { status: 403 });
    }
    if (!isRuntimeDashboardEnabled()) {
      return NextResponse.json({ error: "Runtime dashboard disabled" }, { status: 403 });
    }

    await deleteOperatorNote(params.noteId);

    void logAudit({
      action: "autonomous.incident.note.deleted",
      userId: user.id,
      resourceType: "WorkflowRun",
      resourceId: params.workflowRunId,
      details: { noteId: params.noteId },
    });

    return NextResponse.json({ deleted: true });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status });
  }
}
