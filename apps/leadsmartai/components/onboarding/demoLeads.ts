import type { DemoLead, DemoMessage, LeadFocus, OnboardingProfile, PriceRangeId } from "./types";

const PRICE_LABEL: Record<PriceRangeId, string> = {
  "under-750": "$400K – $750K",
  "750-1500": "$750K – $1.5M",
  "1500-plus": "$1.5M+",
};

function seedFromString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pick<T>(arr: T[], seed: number, i: number): T {
  return arr[(seed + i * 17) % arr.length];
}

const buyerFirstNames = ["Jordan", "Alex", "Riley", "Morgan", "Casey", "Taylor", "Jamie", "Quinn"];
const buyerLastInitial = ["M.", "K.", "R.", "S.", "L.", "T.", "P.", "W."];
const sellerNames = [
  "Patricia Nguyen",
  "David Okonkwo",
  "Elena Vasquez",
  "James Chen",
  "Maria Santos",
];

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function baseMessages(name: string, city: string, intent: DemoLead["intent"]): DemoMessage[] {
  const short = name.split(" ")[0] || "there";
  if (intent === "Buyer") {
    return [
      {
        id: "m1",
        from: "lead",
        text: `Hi — I'm pre-approved and actively looking in ${city}. Can you send 2–3 listings that match what we discussed?`,
        at: "2m ago",
      },
      {
        id: "m2",
        from: "lead",
        text: "We're free for tours Saturday morning. Prefer move-in ready.",
        at: "Just now",
      },
    ];
  }
  if (intent === "Seller") {
    return [
      {
        id: "m1",
        from: "lead",
        text: `Thinking about listing our place in ${city} this spring. What would a realistic pricing strategy look like in this market?`,
        at: "8m ago",
      },
      {
        id: "m2",
        from: "lead",
        text: "Also curious what prep you'd recommend before photos.",
        at: "3m ago",
      },
    ];
  }
  return [
    {
      id: "m1",
      from: "lead",
      text: `Looking at a duplex near ${city} — need a cap rate sanity check before I write.`,
      at: "12m ago",
    },
    {
      id: "m2",
      from: "lead",
      text: `${short}, are you free for a 10-min call today?`,
      at: "1m ago",
    },
  ];
}

export function buildDemoLeads(profile: OnboardingProfile): DemoLead[] {
  const city = profile.city?.trim() || "your market";
  const seed = seedFromString(`${profile.email}|${city}|${profile.focus}|${profile.priceRangeId}`);
  const budget = PRICE_LABEL[profile.priceRangeId] ?? PRICE_LABEL["750-1500"];

  const intents: DemoLead["intent"][] =
    profile.focus === "buyers"
      ? ["Buyer", "Buyer", "Investor"]
      : profile.focus === "sellers"
        ? ["Seller", "Seller", "Buyer"]
        : ["Buyer", "Seller", "Investor"];

  const leads: DemoLead[] = [];

  for (let i = 0; i < 3; i++) {
    const intent = intents[i] ?? "Buyer";
    const isBuyerish = intent === "Buyer" || intent === "Investor";
    const name = isBuyerish
      ? `${pick(buyerFirstNames, seed, i)} ${pick(buyerLastInitial, seed, i + 3)}`
      : pick(sellerNames, seed, i);

    const areas = [
      `Near ${city} — ${pick(["Riverside", "Midtown", "North Hills", "Arts District"], seed, i)}`,
      `${city} · ${pick(["walkable core", "top schools", "new construction"], seed, i + 1)}`,
      `${pick(["Off-market hint", "Referral", "Portal"], seed, i + 2)} · ${city}`,
    ];

    const timelines = [
      "Wants to tour this weekend",
      "Closing window: 30–45 days",
      "Exploring — hot if the numbers work",
    ];

    const snippets =
      intent === "Buyer"
        ? `Pre-approved · ${budget} · saved 6 listings`
        : intent === "Seller"
          ? `Equity estimate sent · comparing 3 agents`
          : `Cash-adjacent · 1031 timeline`;

    leads.push({
      id: `demo-${seed}-${i}`,
      name,
      initials: initials(name),
      intent,
      budget,
      area: areas[i] ?? areas[0],
      timeline: pick(timelines, seed, i),
      channel: pick(["SMS", "Web", "Portal"], seed, i + 5),
      snippet: snippets,
      score: 78 + ((seed + i * 7) % 18),
      waitingSinceMin: 3 + ((seed + i) % 22),
      messages: baseMessages(name, city, intent),
    });
  }

  return leads;
}

export function randomIncomingSnippet(profile: OnboardingProfile, index: number): string {
  const city = profile.city?.trim() || "your area";
  const pool = [
    `New portal lead: relocation to ${city}`,
    `SMS reply: "Yes, send the disclosure pack"`,
    `Buyer unlocked a showing request — ${city}`,
    `Seller opened your CMA link (2nd time)`,
    `Investor asked about cap rates near ${city}`,
  ];
  const seed = seedFromString(profile.email + String(index));
  return pool[seed % pool.length];
}
