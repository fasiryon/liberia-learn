import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  createOperatorNote,
  listOperatorNotes,
  NOTE_TYPES,
  NOTE_SEVERITIES,
  type NoteType,
  type NoteSeverity,
} from "@/lib/autonomous/operatorIncidentNoteService";
import { isRuntimeDashboardEnabled } from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { workflowRunId: string } }
) {
  try {
    const user = await requireUser();
    if (!user.isPlatformAdmin) {
      return NextResponse.json({ error: "Platform admin required" }, { status: 403 });
    }
    if (!isRuntimeDashboardEnabled()) {
      return NextResponse.json({ error: "Runtime dashboard disabled" }, { status: 403 });
    }

    const notes = await listOperatorNotes(params.workflowRunId);
    return NextResponse.json({ notes });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { workflowRunId: string } }
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
    const noteType: NoteType = body.noteType;
    const severity: NoteSeverity | undefined = body.severity;
    const noteBody: string = body.body;

    if (!noteType || !NOTE_TYPES.includes(noteType)) {
      return NextResponse.json(
        { error: `Invalid noteType. Must be one of: ${NOTE_TYPES.join(", ")}` },
        { status: 400 }
      );
    }
    if (severity && !NOTE_SEVERITIES.includes(severity)) {
      return NextResponse.json(
        { error: `Invalid severity. Must be one of: ${NOTE_SEVERITIES.join(", ")}` },
        { status: 400 }
      );
    }
    if (!noteBody || typeof noteBody !== "string" || noteBody.trim().length === 0) {
      return NextResponse.json({ error: "body is required" }, { status: 400 });
    }

    const note = await createOperatorNote({
      workflowRunId: params.workflowRunId,
      noteType,
      severity: severity ?? null,
      body: noteBody.trim(),
      createdByUserId: user.id,
      schoolId: null,
      tenantId: null,
    });

    void logAudit({
      action: "autonomous.incident.note.created",
      userId: user.id,
      resourceType: "WorkflowRun",
      resourceId: params.workflowRunId,
      details: { noteId: note.id, noteType },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status });
  }
}
