/** Rich dummy datasets for platform dashboard previews (UI-only). */

export const agentKpis = [
  { label: "New Leads", value: "48", hint: "Last 7 days", delta: { value: "+12%", positive: true } },
  { label: "Hot Leads", value: "14", hint: "Score ≥ 80", delta: { value: "+3", positive: true } },
  { label: "Follow-Ups Due", value: "9", hint: "Next 48 hours", delta: { value: "2 urgent", positive: false } },
  { label: "Active Deals", value: "23", hint: "Across pipeline", delta: { value: "+4", positive: true } },
  { label: "Closed This Month", value: "6", hint: "MTD", delta: { value: "+18% vs LY", positive: true } },
];

export const agentLeads = [
  { name: "Jordan Ellis", city: "Austin, TX", score: 92, status: "Hot" as const },
  { name: "Priya Shah", city: "Denver, CO", score: 78, status: "Warm" as const },
  { name: "Marcus Chen", city: "Seattle, WA", score: 64, status: "Nurture" as const },
  { name: "Elena Ruiz", city: "Miami, FL", score: 88, status: "Hot" as const },
  { name: "Sam Okonkwo", city: "Chicago, IL", score: 71, status: "Warm" as const },
];

export const agentPipelineStages = [
  { id: "new", label: "New", count: 18, pct: 0.22 },
  { id: "contacted", label: "Contacted", count: 14, pct: 0.17 },
  { id: "qualified", label: "Qualified", count: 12, pct: 0.15 },
  { id: "offer", label: "Offer", count: 9, pct: 0.11 },
  { id: "uc", label: "Under Contract", count: 11, pct: 0.14 },
  { id: "closed", label: "Closed", count: 17, pct: 0.21 },
];

export const agentAlerts = [
  { title: "Client activity spike", detail: "Jordan Ellis opened your CMA 4× in 24h.", tone: "info" as const },
  { title: "Inactive hot lead", detail: "Elena Ruiz — no reply in 5 days.", tone: "warning" as const },
  { title: "Engagement signal", detail: "Marcus Chen saved 3 listings in East Austin.", tone: "success" as const },
];

export const agentTasks = [
  { title: "Send pricing guidance — Priya Shah", due: "Today · 2:00 PM", done: false },
  { title: "Schedule showing — 742 Maple Ave", due: "Tomorrow · 10:30 AM", done: false },
  { title: "Follow up lender pre-approval — Marcus Chen", due: "Mar 18", done: true },
];

export const agentActivity = [
  { action: "AI follow-up drafted", target: "Jordan Ellis", time: "12 min ago" },
  { action: "Lead score updated", target: "Priya Shah → 78", time: "1 hr ago" },
  { action: "Pipeline stage changed", target: "Offer → Under Contract", time: "3 hr ago" },
];

export const brokerKpis = [
  { label: "New Financing Leads", value: "31", hint: "Inbound + partner", delta: { value: "+9%", positive: true } },
  { label: "Pre-Qualified", value: "18", hint: "DTI verified", delta: { value: "+2", positive: true } },
  { label: "Applications In Progress", value: "12", hint: "LOS active", delta: { value: "4 due this week", positive: false } },
  { label: "Docs Pending", value: "7", hint: "Borrower action", delta: { value: "-3 vs last week", positive: true } },
  { label: "Funded This Month", value: "$4.2M", hint: "4 loans", delta: { value: "+$640k", positive: true } },
];

export const brokerBorrowers = [
  { name: "Alex Morgan", amount: "$485,000", readiness: "Strong", status: "Underwriting" as const },
  { name: "Taylor Brooks", amount: "$612,500", readiness: "Moderate", status: "Docs" as const },
  { name: "Jamie Park", amount: "$350,000", readiness: "Strong", status: "Application" as const },
  { name: "Riley Nguyen", amount: "$775,000", readiness: "Needs assets", status: "Pre-Qual" as const },
];

export const brokerPipeline = [
  { label: "Inquiry", count: 22 },
  { label: "Pre-Qual", count: 18 },
  { label: "Application", count: 12 },
  { label: "Docs", count: 9 },
  { label: "Underwriting", count: 6 },
  { label: "Funded", count: 4 },
];

export const brokerMissingDocs = [
  { borrower: "Taylor Brooks", items: "2023 W-2, bank statements (2 mo)" },
  { borrower: "Riley Nguyen", items: "Gift letter, earnest money proof" },
];

export const brokerTasks = [
  { title: "Request updated pay stubs — Riley Nguyen", due: "Today" },
  { title: "Lock confirmation — Alex Morgan", due: "Tomorrow" },
  { title: "Send disclosure package — Jamie Park", due: "Mar 19" },
];

export const brokerActivity = [
  { action: "Document uploaded", who: "Taylor Brooks", time: "8 min ago" },
  { action: "Rate lock requested", who: "Alex Morgan", time: "42 min ago" },
  { action: "Pre-qual letter generated", who: "Jamie Park", time: "Yesterday" },
];

export const supportKpis = [
  { label: "Open Tickets", value: "37", hint: "All queues", delta: { value: "+5 new", positive: false } },
  { label: "Urgent Tickets", value: "6", hint: "SLA < 1h", delta: { value: "2 breaching", positive: false } },
  { label: "Waiting on Support", value: "14", hint: "Unassigned / pending", delta: { value: "-3 vs yesterday", positive: true } },
  { label: "Avg Response Time", value: "18m", hint: "Rolling 24h", delta: { value: "-4m", positive: true } },
  { label: "Resolved Today", value: "52", hint: "Team total", delta: { value: "+12%", positive: true } },
];

export const supportTickets = [
  {
    id: "t1",
    name: "Morgan Blake",
    subject: "Billing — duplicate charge",
    priority: "urgent" as const,
    unread: 3,
  },
  {
    id: "t2",
    name: "Casey Lee",
    subject: "Integration — webhook retries",
    priority: "high" as const,
    unread: 1,
  },
  {
    id: "t3",
    name: "Samira Patel",
    subject: "How to export leads CSV",
    priority: "medium" as const,
    unread: 0,
  },
];

export const supportThread = [
  { from: "customer" as const, name: "Morgan Blake", text: "Hi — I’m seeing two identical charges on 3/12. Can you confirm which one is valid?", time: "10:14 AM" },
  { from: "agent" as const, name: "You", text: "Thanks Morgan — I’m pulling the Stripe invoices now. One sec.", time: "10:16 AM" },
  { from: "customer" as const, name: "Morgan Blake", text: "Appreciate it. Invoice IDs are INV-2041 and INV-2042.", time: "10:18 AM" },
];

export const supportNotes = [
  "Verified duplicate checkout session within 120s window — refund recommended for INV-2042.",
  "Account on Growth plan; last successful payment 3/01.",
];

export const supportTrends = [
  { week: "W1", opened: 42, resolved: 38 },
  { week: "W2", opened: 47, resolved: 44 },
  { week: "W3", opened: 51, resolved: 49 },
  { week: "W4", opened: 55, resolved: 52 },
];

export const supportWorkload = [
  { agent: "Avery", open: 11, urgent: 2 },
  { agent: "Quinn", open: 9, urgent: 1 },
  { agent: "Jordan", open: 8, urgent: 2 },
  { agent: "Riley", open: 6, urgent: 1 },
];

export const adminKpis = [
  { label: "Total Visitors", value: "128.4k", hint: "30d", delta: { value: "+6.2%", positive: true } },
  { label: "Tool Usage", value: "41.2k", hint: "Sessions", delta: { value: "+3.1%", positive: true } },
  { label: "Leads Captured", value: "9,860", hint: "All products", delta: { value: "+8.4%", positive: true } },
  { label: "Qualified Leads", value: "2,140", hint: "Score ≥ 70", delta: { value: "+5.1%", positive: true } },
  { label: "Paying Agents", value: "1,024", hint: "Active subs", delta: { value: "+2.0%", positive: true } },
  { label: "Revenue", value: "$842k", hint: "MRR roll-up", delta: { value: "+4.6%", positive: true } },
];

export const adminPtaPerformance = {
  traffic: "84.2k visits",
  topTools: ["Home Value Estimator", "Cap Rate Calculator", "Closing Cost Estimator"],
  topPages: ["/home-value-estimator", "/cap-rate-calculator", "/pricing"],
  conversion: "3.8% visitor → lead",
  upgrades: "+124 premium upgrades (30d)",
};

export const adminLeadSmart = {
  agents: "3,420 active",
  assignments: "18,400 (30d)",
  followUp: "74% within 24h",
  closeRate: "11.2%",
  mrr: "$412k",
};

export const adminFunnel = [
  { label: "Visitors", value: 128400 },
  { label: "Tool Users", value: 41200 },
  { label: "Leads", value: 9860 },
  { label: "Qualified Leads", value: 2140 },
  { label: "Assigned Leads", value: 1680 },
  { label: "Closed Deals", value: 188 },
];

export const adminOps = {
  tickets: 37,
  response: "18m avg",
  categories: ["Billing 28%", "Integrations 19%", "Onboarding 16%", "Other 37%"],
};

export const adminInsights = [
  { title: "Conversion lift", detail: "Home Value Estimator → lead up 1.2pp WoW.", tone: "success" as const },
  { title: "Traffic spike", detail: "Organic +14% from “investment property” cluster.", tone: "info" as const },
  { title: "System warning", detail: "Webhook retries elevated for Partner API (p95 2.4s).", tone: "warning" as const },
];
