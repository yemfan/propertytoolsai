export type RegisteredModel = {
  id: string;
  modelKey: string;
  modelVersion: string;
  status: "candidate" | "active" | "archived";
  backend: string;
  artifactPath: string;
  schemaPath: string;
  metrics: Record<string, unknown>;
  filters: Record<string, unknown>;
  rowsUsed: number;
  trainedAt: string;
  trainedBy?: string | null;
  notes?: string | null;
  isActive: boolean;
};

export type TrainWorkflowInput = {
  exportName?: string;
  filters?: Record<string, unknown>;
  activateAfterTraining?: boolean;
  notes?: string;
};
