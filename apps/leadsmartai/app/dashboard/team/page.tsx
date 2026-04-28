import type { Metadata } from "next";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { getRoster, listTeamsForAgent } from "@/lib/teams/service";
import { TeamDashboard } from "@/components/team/TeamDashboard";
import type { TeamRoster } from "@/lib/teams/types";

export const metadata: Metadata = {
  title: "Team",
  description:
    "Manage your team — invite agents, see the roster, control pending invitations.",
  robots: { index: false },
};

/**
 * Team management page. Server component:
 *   - Resolves the calling agent
 *   - Loads the agent's first owned/joined team + its roster
 *   - Hands the data to the client component
 *
 * MVP scope: one team per agent on this page. Multi-team support is
 * a follow-up — when an agent owns several teams, the page would
 * pick a primary and add a switcher.
 */
export default async function TeamPage() {
  const ctx = await getCurrentAgentContext();
  const teams = await listTeamsForAgent(ctx.agentId);

  let roster: TeamRoster | null = null;
  let isOwner = false;

  if (teams.length > 0) {
    const team = teams[0];
    roster = await getRoster(team.id);
    isOwner = team.ownerAgentId === ctx.agentId;
  }

  return (
    <TeamDashboard
      currentAgentId={ctx.agentId}
      isOwner={isOwner}
      roster={roster}
    />
  );
}
