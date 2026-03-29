/** `contacts` table row shape (LeadSmart CRM dashboard). */
export type CrmContactRow = {
  id: string;
  agent_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  type: "buyer" | "seller" | string | null;
  created_at: string;
};

/** `property_reports` table row shape (LeadSmart CRM dashboard). */
export type CrmPropertyReportRow = {
  id: string;
  agent_id: string;
  address: string | null;
  report_type: string | null;
  created_at: string;
};
