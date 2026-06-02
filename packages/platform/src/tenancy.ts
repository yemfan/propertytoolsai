// HelmSmart 5-level tenancy domain model (Tenancy_Migration_Plan_v2).
//   tenant > organization > workspace > user + role + permissions
// Organization is the DEFAULT working scope; tenant/workspace are nullable context
// (a solo SMB is implicitly 1 tenant : 1 org : 1 workspace).
//
// Backed by migration 00047_tenancy_v2 on the Core DB.

/**
 * Base membership role (coarse). Mirrors the DB CHECK on organization_members.role.
 * TODO(tenancy): generalize to owner|admin|member|viewer and move `bookkeeper`
 * to a Finance-DNA capability (Tenancy_Migration_Plan_v2 §1, Option D §2.1).
 */
export type Role = "owner" | "admin" | "bookkeeper" | "viewer";

export type TenantKind =
  | "single"
  | "brokerage"
  | "agency"
  | "franchise"
  | "fmo"
  | "enterprise";

export type WorkspaceKind = "team" | "department" | "branch" | "location" | "general";

/** LEVEL 1 — billing / parent account (brokerage, agency, FMO, franchise). */
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  kind: TenantKind;
  plan: string;
  stripeCustomerId: string | null;
}

/** LEVEL 2 — a single business/company. The default working scope. */
export interface Organization {
  id: string;
  tenantId: string | null;
  name: string;
  slug: string;
  plan: string;
  subscriptionStatus: string;
}

/** LEVEL 3 — a sub-unit inside an org (team, department, branch, location). */
export interface Workspace {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  kind: WorkspaceKind;
}

/** LEVEL 4 — a user's membership of an org, optionally scoped to a workspace. */
export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: Role;
  workspaceId: string | null;
}

/**
 * The resolved access scope for a request. Org is the working unit; tenant is roll-up
 * context; workspace narrows within the org. Mirrors get_user_scope() in the DB.
 */
export interface UserScope {
  userId: string;
  organizationId: string;
  tenantId: string | null;
  workspaceId: string | null;
  role: Role;
}

/** Cookie that carries the active organization id (set at onboarding / org switch). */
export const ORG_COOKIE = "helmsmart-org-id";
