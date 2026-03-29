import { describe, expect, it } from "vitest";
import {
  matchAgents,
  parseLeadAddress,
  scoreAgentForLead,
  type LeadLocationSignals,
  type MatchableAgent,
} from "./matching";

describe("parseLeadAddress", () => {
  it("extracts zip and city from typical US address", () => {
    const p = parseLeadAddress("123 Main St, Los Angeles, CA 90001");
    expect(p.zip).toBe("90001");
    expect(p.city).toContain("los angeles");
    expect(p.state).toBe("CA");
  });
});

describe("scoreAgentForLead", () => {
  const lead: LeadLocationSignals = {
    city: "los angeles",
    zip: "90001",
    state: "CA",
  };

  it("returns -1 when agent does not accept new leads", () => {
    const agent: MatchableAgent = {
      id: "a1",
      serviceAreas: ["90001"],
      acceptsNewLeads: false,
    };
    expect(scoreAgentForLead(lead, agent)).toBe(-1);
  });

  it("prefers zip match over empty service areas", () => {
    const zipAgent: MatchableAgent = {
      id: "z",
      serviceAreas: ["90001"],
      acceptsNewLeads: true,
    };
    const broad: MatchableAgent = {
      id: "b",
      serviceAreas: [],
      acceptsNewLeads: true,
    };
    expect(scoreAgentForLead(lead, zipAgent)).toBeGreaterThan(scoreAgentForLead(lead, broad));
  });
});

describe("matchAgents", () => {
  it("returns top 3 by score", () => {
    const lead: LeadLocationSignals = {
      city: "austin",
      zip: "78701",
      state: "TX",
    };
    const agents: MatchableAgent[] = [
      { id: "1", serviceAreas: [], acceptsNewLeads: true },
      { id: "2", serviceAreas: ["78701"], acceptsNewLeads: true },
      { id: "3", serviceAreas: ["austin"], acceptsNewLeads: true },
      { id: "4", serviceAreas: ["nyc"], acceptsNewLeads: true },
    ];
    const top = matchAgents(lead, agents, { limit: 3 });
    expect(top.length).toBe(3);
    expect(top[0].id).toBe("2");
    expect(top.map((a) => a.id)).toEqual(["2", "3", "1"]);
  });
});
