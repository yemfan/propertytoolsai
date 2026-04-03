export type AssignedAgentPayload = {
  authUserId: string;
  agentRowId: string | null;
  displayName: string;
  phone: string | null;
  email: string | null;
  avatarUrl: string | null;
  assignmentSource: "profile" | "default";
};
