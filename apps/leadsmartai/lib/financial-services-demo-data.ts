/**
 * Demo data for the financial-services vertical dashboard (UI-only).
 * Used by the GFI/IMO pitch demo. Replace with live data post-pilot.
 */

export const faKpis = [
  { label: "Active prospects", value: "62", hint: "Last 30 days", delta: { value: "+18%", positive: true } },
  { label: "FNAs completed", value: "19", hint: "MTD", delta: { value: "+7 vs LM", positive: true } },
  { label: "Kitchen-table appts", value: "11", hint: "Next 14 days", delta: { value: "4 today", positive: true } },
  { label: "Recruits in pipeline", value: "24", hint: "All stages", delta: { value: "+6", positive: true } },
  { label: "Licensed this month", value: "3", hint: "New producers", delta: { value: "+2 vs LM", positive: true } },
  { label: "Premium submitted", value: "$184k", hint: "MTD annualized", delta: { value: "+$48k", positive: true } },
];

export const faProspects = [
  { name: "Diana Alvarez", city: "Phoenix, AZ", age: 42, product: "IUL", status: "FNA Done" as const, score: 88 },
  { name: "Marcus Webb", city: "Atlanta, GA", age: 51, product: "Annuity", status: "Appt Set" as const, score: 81 },
  { name: "Priya Shah", city: "Dallas, TX", age: 36, product: "Term + IUL", status: "Nurture" as const, score: 64 },
  { name: "Tomás Reyes", city: "Miami, FL", age: 29, product: "Term Life", status: "FNA Done" as const, score: 76 },
  { name: "Sandra Kim", city: "Seattle, WA", age: 47, product: "IUL + Annuity", status: "Appt Set" as const, score: 92 },
];

export const faRecruitStages = [
  { id: "interest", label: "Interest", count: 14 },
  { id: "bpm", label: "BPM Attended", count: 8 },
  { id: "license_started", label: "License In Progress", count: 6 },
  { id: "licensed", label: "Licensed", count: 4 },
  { id: "first_sale", label: "First Sale", count: 3 },
  { id: "promoted", label: "Promoted", count: 1 },
];

export const faRecruits = [
  { name: "Jordan Ellis", referredBy: "You", stage: "BPM Attended" as const, joinedDaysAgo: 3, fitScore: 84 },
  { name: "Aaliyah Brown", referredBy: "Marcus Webb (downline)", stage: "License In Progress" as const, joinedDaysAgo: 14, fitScore: 79 },
  { name: "Chen Wu", referredBy: "You", stage: "Licensed" as const, joinedDaysAgo: 41, fitScore: 88 },
  { name: "Reema Khan", referredBy: "Priya Shah (downline)", stage: "Interest" as const, joinedDaysAgo: 1, fitScore: 71 },
];

export const faAlerts = [
  { title: "FNA opened 4×", detail: "Diana Alvarez reviewed her FNA report 4 times in 24h — high intent.", tone: "success" as const },
  { title: "Recruit silent 7 days", detail: "Aaliyah Brown hasn't completed pre-licensing module 2.", tone: "warning" as const },
  { title: "Policy anniversary", detail: "5 clients have policies anniversary-ing in next 30 days.", tone: "info" as const },
  { title: "Compliance reminder", detail: "AZ state license CE due in 45 days.", tone: "warning" as const },
];

export const faTasks = [
  { title: "FNA review call — Diana Alvarez", due: "Today · 4:00 PM" },
  { title: "Send IUL illustration — Sandra Kim", due: "Today · 6:00 PM" },
  { title: "BPM follow-up — Reema Khan", due: "Tomorrow · 9:00 AM" },
  { title: "Annual review — Carlos Mendez policy", due: "May 22" },
  { title: "Submit annuity suitability — Marcus Webb", due: "May 24" },
];

export const faActivity = [
  { action: "AI SMS sent", target: "Diana Alvarez · post-FNA nudge", time: "8 min ago" },
  { action: "FNA generated", target: "Sandra Kim · 12-page report", time: "1 hr ago" },
  { action: "Recruit stage advanced", target: "Chen Wu → Licensed", time: "3 hr ago" },
  { action: "Appt booked", target: "Marcus Webb · Tue 6 PM", time: "Yesterday" },
];

export const faAiTools = [
  { label: "Generate FNA report", route: "/financial-services/dashboard/fna" },
  { label: "Draft post-appt follow-up", route: "/financial-services/dashboard/messages" },
  { label: "IUL vs term comparison", route: "/financial-services/dashboard/tools" },
  { label: "Annual review brief", route: "/financial-services/dashboard/clients" },
];

/** Sample FNA inputs used to pre-populate the demo form. */
export const faSampleFnaInputs = {
  clientName: "Diana Alvarez",
  age: 42,
  spouseAge: 44,
  annualIncome: 142000,
  spouseIncome: 88000,
  dependents: 2,
  outstandingDebts: 38000,
  mortgageBalance: 312000,
  currentSavings: 96000,
  current401k: 215000,
  retirementAge: 65,
  monthlyExpenses: 7800,
  existingCoverage: 250000,
  riskTolerance: "moderate" as const,
  goals: ["retirement income", "kids college", "income replacement"],
};
