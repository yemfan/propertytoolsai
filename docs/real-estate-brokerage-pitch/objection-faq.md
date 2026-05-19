# Objection FAQ — Brokerage Owner Pitch

> The 10 questions a brokerage owner is most likely to ask in a 45-minute working session, plus 2 bonus questions specific to franchise-affiliated brokerages. Each entry has:
>
> - **Short answer** — verbal, 2–3 sentences
> - **If they press** — paragraph-level detail
> - **Don't say** — landmines that lose credibility

---

## 1. "How is this actually different from kvCORE / Follow Up Boss / Chime?"

**Short answer.** Those tools were built agent-first, with the broker as a reporting afterthought. kvCORE has a marketing site builder we don't, but their AI is template-driven and their broker dashboard is shallow. FUB has the cleanest agent UI in the category and zero broker tools. Chime is closest to us on AI but has a 5-year-old UX. We built the broker dashboard as a first-class product and shipped AI nurture that's actually agent-ready, not "AI" stitched onto templates.

**If they press.** Specifically: kvCORE's "AI" is template variable substitution. Their agent-fitness flags, leaderboard, and lead-routing rules are all available but bolted on after the fact. FUB doesn't even pretend to do broker tools — they tell you to buy "FUB Custom" if you want broker analytics, which is $300/agent. Chime's AI is closer to ours but their broker dashboard is from 2019. The category gap is real, and we're betting on closing it before the incumbents catch up.

**Don't say.** "Their AI is bad" — execs hear hyperbole and stop trusting you. Stay specific.

---

## 2. "Will my agents actually adopt it? We've done CRM switches before. They don't stick."

**Short answer.** Adoption is the real game and we've thought hard about it. Two structural answers: one, the AI does 80% of the follow-up the agent was never going to do anyway, so the friction is "check email" not "learn Salesforce." Two, the home-value funnel and CMA generator are tools agents will use because *they want to look professional*, not because the broker told them to. Adoption follows utility, not policy.

**If they press.** The migration failure pattern is consistent across the category: brokerage forces a new CRM, agents keep using their old workflow (spreadsheets, gmail, whatever), CRM goes unused after month 3. We work around it by making the highest-value parts (CMA, home-value funnel, AI nurture) usable *from day one without learning anything new*. Your agent doesn't need to enter their pipeline into our system to get value from the CMA generator. Once they're using one piece, the rest follows naturally.

**Don't say.** "Adoption will be 100%" — every broker who's done this knows it won't be. Aim for honest 70–80% within 90 days.

---

## 3. "What's the migration plan from our current CRM?"

**Short answer.** Standard CSV import for contacts, leads, pipeline stages, and notes. Workflow mapping we do during onboarding — your existing tags, sources, and statuses get translated manually. Plan for 4–6 weeks of parallel-running where both systems work, then deprecate the old one.

**If they press.** Concretely: week 1, contacts/leads imported. Week 2, custom-field mapping for source tracking, lead quality, agent attribution. Week 3, AI templates approved by your managing broker. Week 4, MLS / IDX feed connected. Weeks 5–6, parallel operation — agents can log into both systems. Week 7, old CRM read-only. Week 8, old CRM canceled. The cost is paying for both systems for 6–8 weeks during transition; budget that in.

**Don't say.** "We'll migrate everything perfectly" — there are always edge cases (deleted contacts, weird tags, integrations to other tools). Promise process, not perfection.

---

## 4. "What about MLS / IDX integration?"

**Short answer.** We integrate with most major MLS via RETS / Spark / Bridge feeds — usually day-one. If your specific MLS is custom or your IDX vendor is unusual, we add it during onboarding, typically 2 weeks. We don't replace your IDX vendor; we sit beside it.

**If they press.** We support feeds from the top 50 MLS in the U.S. as of today. Lesser-known MLS or vendor-specific IDX setups (e.g., older Spark XML feeds, certain Real Geeks plugins) we add per-deployment. The integration is read-only — we pull listing data into the CMA generator, the agent's saved searches, and the home-value funnel — but writes to the MLS still happen through your existing vendor.

**Don't say.** "Yes we support every MLS." We don't. Be specific that it's per-deployment for edge cases.

---

## 5. "How fast will we see results?"

**Short answer.** Speed-to-lead and lead-conversion lift show up in the first 30 days — those are the easy wins. Retention and producer-ratio shifts take 6–9 months to measure. Our contract includes a 30-day onboarding checkpoint: if cohort retention isn't above 50% at day 30, we restructure together.

**If they press.** The order of returns: week 2, AI nurture starts firing → speed-to-lead drops; week 3–4, conversion uptick visible on the leaderboard; month 2–3, agents start using the home-value funnel as a recruiting tool and you see lead volume tick up; month 6, retention numbers start to show the lift; month 12, the case study writes itself. The retention metric is the slowest because it's a 12-month rolling average.

**Don't say.** "Year one will transform your brokerage" — too vague to be credible. Lead with the 30-day visible wins.

---

## 6. "What if we want to leave after year one?"

**Short answer.** Year-one annual contract. Month-to-month after that. Data exports to CSV / JSON in one click. We don't lock anything behind tiers, don't charge for export, don't slow-walk the offboarding. If we can't earn the renewal, you should leave.

**If they press.** Specifically: exportable data includes contacts, leads, pipeline stages, every outbound communication (with TCPA opt-in metadata), and every CMA / home-value report generated. We provide read-only access for 30 days after offboarding so your agents can grab anything they need before final shutdown. Standard MSDA / data-portability terms in the contract.

**Don't say.** "You'll never want to leave." (You can't predict that, and it sounds hollow.)

---

## 7. "What does compliance look like, especially TCPA?"

**Short answer.** Every SMS-eligible lead has a logged opt-in with the disclosure version captured, IP address, timestamp, and consent text on file. AI-drafted outbound can be queued for managing-broker review before send. Full searchable archive of every message. We've been through TCPA carrier review and have the artifacts to show your compliance team.

**If they press.** We support all of: explicit opt-in checkbox at point of lead capture, the 4-element TCPA disclosure (brand, frequency, msg & data rates, STOP/HELP), state-by-state disclosure injection where required, automatic STOP-keyword honoring, opt-out evidence retention for the 4-year SEC standard. We're not Smarsh-certified for FINRA archiving, but for real estate that's not a typical requirement.

**Don't say.** "We're fully compliant" — too sweeping. Stick to the specifics of what we've audited.

---

## 8. "Pricing seems too aggressive — what's the catch?"

**Short answer.** No catch. We're newer at the brokerage tier and pricing accordingly to win deployments. Pricing locks for year one. Year-two renewals can move, but never more than 10% in a single renewal cycle, and we'd give you 90 days notice before any change.

**If they press.** Our per-agent unit economics work because we don't have a sales-led GTM yet — no quota-carrying reps, no expensive demo-team, no SDR pipeline. That changes in 18 months as we scale, but it doesn't affect your contracted pricing. The 10% cap on renewal price changes is a real contractual term we include in every brokerage-tier agreement.

**Don't say.** "Pricing might change later" — too vague. Either commit to the cap or be silent.

---

## 9. "Has any brokerage with 100+ agents actually used this in production?"

**Short answer.** Honestly, you'd be among our first three large-brokerage deployments. 3,400+ producers on the platform total — but most are individual agents or small teams. That's the tradeoff: in exchange for being a first-mover, the rollout gets shaped around your workflow, you have direct founder access during deployment, and the case study at month 12 becomes a moat against the brokerages who come after.

**If they press.** Be specific about what's de-risked vs. what's not. **De-risked:** the platform itself (3,400 producers in production, 99.9% uptime), the AI nurture pipeline (millions of messages sent), the compliance posture (audited carrier-side). **What's newer at scale:** the broker dashboard with 100+ agents (we've tested at 50; 100+ is a new pattern), lead-routing rules at scale, brokerage-wide leaderboard at 100+ agents. We monitor those during the rollout closely.

**Don't say.** "We have many large brokerages" — they'll check. Honesty here is the only credible move.

---

## 10. "What support do we get during onboarding and beyond?"

**Short answer.** Onboarding: dedicated implementation lead for the first 60 days, direct Slack channel with the founder during year one, weekly check-ins for the first 90 days, then monthly. Beyond year one: business reviews quarterly, 24-hour response on support tickets, named CSM as we scale.

**If they press.** Day-one onboarding is white-glove — we do the CSV imports with you, train your managing broker on the dashboard live, sit in on the first two agent rollout sessions. The founder Slack channel is real and direct, not a community Slack. After year one, support transitions to standard tier (24h SLA) with the option to upgrade to premium support if you want shorter SLAs.

**Don't say.** "We have a great support team" — every vendor says that. Be specific about the artifacts.

---

## Bonus B1 — for franchise-affiliated brokerages (eXp / KW / Compass / REMAX)

### "Does this work with our franchise tech stack?"

**Short answer.** We sit beside it, not inside it. Your eXp Cloud / KW Command / Compass One stays in place for the things they do best (back-office, franchise-mandated workflows). We add the lead-to-listing layer those tools don't handle well. Many of our agents at franchise brokerages already use us alongside the franchise tools.

**If they press.** Specifically: we don't try to replace franchise-mandated transaction management, MLS access, or back-office accounting. We integrate where possible (lead capture from kvCORE-as-IDX, write-back of certain status changes). The franchise side governs the legal-transactional layer; we govern the lead-and-conversion layer.

---

## Bonus B2 — for franchise-affiliated brokerages

### "Will our franchise corporate stop us from using a non-approved CRM?"

**Short answer.** Most franchise agreements don't restrict CRM choice for the brokerage. kvCORE is "approved" at some franchises because of corporate deals, but using a separate CRM at the brokerage level is almost always allowed. We've seen it work at eXp, KW, REMAX, and Coldwell affiliates.

**If they press.** Check your specific franchise agreement; we've never seen one that explicitly bans a third-party CRM at the brokerage tier, but agreements vary. If your corporate has a "preferred vendors" list, we can apply to be on it — that's a separate workstream, takes 3–6 months, and we'll lead it if you sign.

---

## Closing posture

Execs don't expect perfect answers. They expect:

1. **Honest acknowledgment** that the concern is real.
2. **A specific, narrow answer** (not "we're great").
3. **Visible thinking** — show you've considered the concern before they raised it.

If you don't know an answer: *"I don't know — let me come back to you within 48 hours with a specific answer."* That earns more credibility than any guess.

**The one question you can't dodge:** if they ask whether you have a 100+ agent brokerage reference, be honest. Say no, and pivot to the first-mover framing. Trying to spin around this loses the deal.
