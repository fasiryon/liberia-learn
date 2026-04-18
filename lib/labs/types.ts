export type LabId =
  | "gravity-explorer"
  | "pendulum-lab"
  | "molecule-motion"
  | "human-heart"
  | "electric-circuit"
  | "wave-motion"
  | "cell-division"
  | "electric-circuits"
  | "light-and-shadow"
  | "simple-machines"
  | "ecosystem-balance"
  | "cell-structure"
  | "chemical-reactions"
  | "water-cycle"
  | "earthquake-waves";

export type LabAction<TType extends string = string, TPayload = Record<string, unknown>> =
  TPayload & {
    type: TType;
  };

export type PlannedLabAction = {
  rejected: boolean;
  action?: LabAction;
  actionType?: string | null;
  confidence?: number | null;
  userFacingMessage: string;
  reason?: string | null;
};

export type LabValidationResult = {
  ok: boolean;
  reason?: string;
};

export type LabDefinition<S> = {
  id: LabId;
  title: string;
  subject: string;
  gradeBand: string;
  description?: string;
  tier: 1 | 2 | 3;
  partial?: boolean;
  curriculumStandards: string[];
  allowedActions: string[];
  initialState: S;
  validateAction: (state: S, action: LabAction) => LabValidationResult;
  applyAction: (state: S, action: LabAction) => S;
};

export type LabSession<S = unknown> = {
  labId: LabId;
  lessonId?: string | null;
  studentId: string;
  state: S;
  openedAt: string;
  updatedAt: string;
};
