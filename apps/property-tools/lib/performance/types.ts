export type PerformanceOverview = {
  totalLeads: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  totalConversions: number;
  grossRevenue: number;
  avgLeadScore: number;
  avgResponseMinutes: number;
};

export type SourcePerformanceRow = {
  source: string;
  leads: number;
  hotLeads: number;
  conversions: number;
  grossRevenue: number;
  avgLeadScore: number;
  conversionRate: number;
};

export type AgentPerformanceRow = {
  agentId: string;
  agentName: string;
  leadsAssigned: number;
  hotLeads: number;
  repliesSent: number;
  conversions: number;
  grossRevenue: number;
  avgResponseMinutes: number;
  closeRate: number;
};

export type FunnelPerformance = {
  visitors: number;
  leads: number;
  conversations: number;
  appointments: number;
  conversions: number;
};
