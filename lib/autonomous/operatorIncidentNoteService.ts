import { prisma } from "@/lib/db";

export const NOTE_TYPES = [
  "INVESTIGATION",
  "ROOT_CAUSE",
  "RECOVERY_ACTION",
  "ROLLBACK_NOTE",
  "FOLLOW_UP",
  "RESOLUTION",
] as const;

export const NOTE_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "WONT_FIX"] as const;
export const NOTE_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export type NoteType = (typeof NOTE_TYPES)[number];
export type NoteStatus = (typeof NOTE_STATUSES)[number];
export type NoteSeverity = (typeof NOTE_SEVERITIES)[number];

export interface CreateNoteInput {
  workflowRunId: string;
  noteType: NoteType;
  severity?: NoteSeverity | null;
  body: string;
  createdByUserId: string;
  schoolId?: string | null;
  tenantId?: string | null;
}

export interface UpdateNoteInput {
  status?: NoteStatus;
  severity?: NoteSeverity | null;
  body?: string;
}

export async function createOperatorNote(input: CreateNoteInput) {
  if (!NOTE_TYPES.includes(input.noteType)) {
    throw Object.assign(new Error(`Invalid noteType: ${input.noteType}`), { status: 400 });
  }
  if (input.severity && !NOTE_SEVERITIES.includes(input.severity)) {
    throw Object.assign(new Error(`Invalid severity: ${input.severity}`), { status: 400 });
  }
  return (prisma as any).operatorIncidentNote.create({
    data: {
      workflowRunId: input.workflowRunId,
      noteType: input.noteType,
      severity: input.severity ?? null,
      status: "OPEN",
      body: input.body,
      createdByUserId: input.createdByUserId,
      schoolId: input.schoolId ?? null,
      tenantId: input.tenantId ?? null,
    },
  });
}

export async function listOperatorNotes(workflowRunId: string) {
  return (prisma as any).operatorIncidentNote.findMany({
    where: { workflowRunId },
    orderBy: { createdAt: "asc" },
  });
}

export async function updateOperatorNote(
  noteId: string,
  requestingUserId: string,
  input: UpdateNoteInput
) {
  const note = await (prisma as any).operatorIncidentNote.findUnique({ where: { id: noteId } });
  if (!note) throw Object.assign(new Error("Note not found"), { status: 404 });

  if (input.status && !NOTE_STATUSES.includes(input.status)) {
    throw Object.assign(new Error(`Invalid status: ${input.status}`), { status: 400 });
  }
  if (input.severity && !NOTE_SEVERITIES.includes(input.severity)) {
    throw Object.assign(new Error(`Invalid severity: ${input.severity}`), { status: 400 });
  }

  const resolvedAt =
    input.status === "RESOLVED" && note.status !== "RESOLVED" ? new Date() : note.resolvedAt;

  return (prisma as any).operatorIncidentNote.update({
    where: { id: noteId },
    data: {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.severity !== undefined ? { severity: input.severity } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      resolvedAt,
    },
  });
}

export async function deleteOperatorNote(noteId: string) {
  const note = await (prisma as any).operatorIncidentNote.findUnique({ where: { id: noteId } });
  if (!note) throw Object.assign(new Error("Note not found"), { status: 404 });
  return (prisma as any).operatorIncidentNote.delete({ where: { id: noteId } });
}
