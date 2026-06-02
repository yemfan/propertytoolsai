// Pure org-membership RBAC: the role vocabulary plus the guards that protect team
// management. No I/O — the caller resolves the actor's and target's roles, then asks
// these predicates. Every app and industry pack enforces the same membership rules.

export type OrgRole = "owner" | "admin" | "bookkeeper" | "viewer";

/** Roles allowed to manage team members (invite, change roles, remove). */
export const TEAM_MANAGER_ROLES: readonly OrgRole[] = ["owner", "admin"] as const;

/** True if the role may manage the team. */
export function canManageTeam(role: string | null | undefined): boolean {
  return role != null && (TEAM_MANAGER_ROLES as readonly string[]).includes(role);
}

/** Throw unless the role may manage the team. */
export function assertCanManageTeam(role: string | null | undefined): void {
  if (!canManageTeam(role)) {
    throw new Error("Only admins and owners can manage team members");
  }
}

export type MemberAction = "change_role" | "remove";

export interface MemberGuardInput {
  /** Role of the member being changed/removed. */
  targetRole: string | null | undefined;
  /** User id of the member being changed/removed. */
  targetUserId: string;
  /** User id of the actor performing the change. */
  actorUserId: string;
  action: MemberAction;
}

/**
 * Guard a role change or removal against the two invariants every workspace shares:
 * the owner is untouchable, and you cannot act on yourself. Throws on violation.
 */
export function assertCanModifyMember(input: MemberGuardInput): void {
  const removing = input.action === "remove";
  if (input.targetRole === "owner") {
    throw new Error(removing ? "Cannot remove the owner" : "Cannot change the owner's role");
  }
  if (input.targetUserId === input.actorUserId) {
    throw new Error(removing ? "Cannot remove yourself" : "Cannot change your own role");
  }
}
