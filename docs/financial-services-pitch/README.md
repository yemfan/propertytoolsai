# GFI Executive Pitch — Asset Index

Everything you need to walk into the GFI executive conversation, in one place. Drafted for an informal 1-on-1 with 1–2 senior execs, with a 90-day no-cost pilot as the ask.

---

## The five written assets

| # | Asset | What it's for | When to use |
|---|---|---|---|
| 1 | [One-pager](one-pager.md) | Forwardable exec summary in markdown. Names the bottleneck in GFI's language, four pilot metrics, the pilot ask, "why us / why now." | Send to the exec **before** the meeting. Have your coach forward it. |
| 2 | [Objection FAQ](objection-faq.md) | 10 likely exec questions + 2 MLM-specific bonus, each with short verbal answer, deeper detail if pressed, and landmines to avoid. | Read the night before. Internalize, don't read live. |
| 3 | [Demo script](demo-script.md) | 7 scenes × 12 min walkthrough of the live workspace. Pre-demo setup, talk track per scene, Q&A branches, closing posture for each likely outcome. | Day-of, during prep. Run through it once with the coach. |
| 4 | [Competitor comparison](competitor-comparison.md) | Side-by-side of LeadSmart AI vs. carrier portals, AgencyBloc/Redtail, Salesforce FSC, sheets+WhatsApp. Honest about our gaps. | After the meeting in the follow-up email, or live when an exec asks "how is this different from X?" |
| 5 | [Carrier integration](carrier-integration.md) | The 3-phase plan for integrating with WinFlex/iGo/FireLight/TransACT — what's possible, what's hard, what we'll commit to. | Live when an exec asks "can you integrate with our carrier tools?" — this is the structured answer. |

---

## The four live URLs

These are what execs will see in a browser. All are GFI-themed when the production env has `NEXT_PUBLIC_FINANCIAL_SERVICES_THEME=gfi` set.

| URL | What it shows | Use during demo? |
|---|---|---|
| [leadsmart-ai.com/financial-services](https://leadsmart-ai.com/financial-services) | Public marketing landing — hero, 4 pilot metrics, feature grid, pricing | **Scene 1** of the demo |
| [leadsmart-ai.com/financial-services/one-pager](https://leadsmart-ai.com/financial-services/one-pager) | Print-to-PDF exec brief — same content as the markdown one-pager, web-rendered with GFI brand | Forward as backup, or open at the end as the leave-behind |
| [leadsmart-ai.com/financial-services/dashboard/overview](https://leadsmart-ai.com/financial-services/dashboard/overview) | The producer workspace — sectioned sidebar, KPIs, recruit pipeline preview | **Scenes 2–6** of the demo |
| [leadsmart-ai.com/financial-services/dashboard/fna](https://leadsmart-ai.com/financial-services/dashboard/fna) | AI Financial Needs Analysis generator — the wedge feature | **Scene 3** of the demo (the wow moment) |

---

## How to use this for the meeting

### One week before
1. Send the **one-pager** to your coach. Have them forward to the GFI exec.
2. Read the **objection FAQ** end-to-end. Mark the 3 questions you think are most likely.

### Two days before
3. Read the **demo script** end-to-end. Open each live URL. Make sure they load and the GFI brand is showing.
4. Click through the demo path yourself, end-to-end, timed. If you're over 12 minutes, cut Scene 5 (Scripts) or Scene 6 (Roadmap tour).

### Day of
5. Pre-warm the FNA cache (see demo script section "Pre-demo setup"). Generate the Diana Alvarez FNA once so the live demo returns in <2 sec.
6. Close everything except the demo browser window. Notifications muted.

### During
7. Open with the **hook** from Scene 0 — *speak before sharing screen.*
8. Lead with the **FNA** if you only have time for one feature. It's the most demo-able thing in the product.
9. End with the **ask** (Scene 7) and **stop talking.** Let them respond.

### After
10. Send the follow-up email within 24 hours. Attach the **one-pager** + a link to the **competitor comparison**.
11. If they asked a question you didn't fully answer, include the answer in the email.

---

## Status — what's shipped

All 6 PRs merged to `main` and live on `leadsmart-ai.com`:

| # | PR | Type |
|---|---|---|
| [#470](https://github.com/yemfan/propertytoolsai/pull/470) | scaffold MLM/IMO vertical + GFI pitch artifacts | Feature |
| [#471](https://github.com/yemfan/propertytoolsai/pull/471) | drop sidebar, use focused top-nav (later replaced) | Feature |
| [#472](https://github.com/yemfan/propertytoolsai/pull/472) | TCR-compliant SMS consent UI + audit row | Fix (TCR) |
| [#473](https://github.com/yemfan/propertytoolsai/pull/473) | sectioned sidebar w/ MLM-finance IA + 14 placeholders | Feature |
| [#474](https://github.com/yemfan/propertytoolsai/pull/474) | demo script — 12-min exec walkthrough | Docs |
| [#475](https://github.com/yemfan/propertytoolsai/pull/475) | competitor comparison — LSAI vs. the MLM finance stack | Docs |

---

## Still on the human plate (not code)

1. **Twilio TCR resubmission** — submitted. Awaiting carrier review (1–3 business days). If approved, AI SMS is unblocked for the live demo.
2. **GFI baseline metrics** — get from your contact: current speed-to-lead, recruit-to-licensed conversion, FNAs per producer per month, premium submitted in first 60 days post-license. We measure against these.
3. **Pilot MD identification** — coach to name one MD whose team would be the pilot cohort (10–25 producers).
4. **Meeting scheduled** — 1–2 weeks out, informal, with the senior exec(s) your coach has access to.

---

## Quick reference — the four pilot metrics

These are the numbers we commit to moving during a 90-day pilot. Calibrate to GFI's actual baselines before the meeting.

| Metric | Industry baseline | Pilot target |
|---|---|---|
| Speed-to-lead | Hours to days | **Under 5 minutes** |
| FNAs per producer / month | 1–2 | **4+** |
| Recruit interest → licensed (60d) | 25–35% | **+10pp lift** |
| Premium submitted (new producer, 60d) | Varies | **2× cohort baseline** |
