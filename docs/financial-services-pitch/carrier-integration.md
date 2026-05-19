# Carrier Integration — What's Possible, What's Hard, What We're Committing To

> **For when an exec asks "can you integrate with our carrier tools?"** Short answer: yes — and the gating factor is vendor agreements and per-carrier opt-ins, not engineering. This doc lays out the real landscape, the realistic 3-phase plan, and what GFI gets by being a pilot partner.

---

## The four integration surfaces that matter

| Tool | Owner | What's possible | How hard |
|---|---|---|---|
| **WinFlex / iGo** | iPipeline | Submit illustration request → receive PDF + structured quote; submit e-application | Medium — needs iPipeline partner agreement + per-carrier opt-in |
| **FireLight** | Insurance Technologies | Submit e-application; track underwriting status | Medium — similar partner-agreement model |
| **TransACT** | Transamerica | Single-carrier (Transamerica-only) — limited public API; some developer portal endpoints | Hard — must go through Transamerica's tech relations team |
| **NIPR** (license tracking) | NAIC / NIPR | Producer license lookup, CE status, state appointments | Easy — standard subscription API, ~$200–500/mo |

---

## The 3-phase realistic plan

### Phase 2A — Read-only carrier visibility *(post-pilot weeks 1–8)*

Lowest-risk, highest-immediate-value. We don't write anything to carrier systems; we just read.

- **NIPR integration**: producer license status, expirations, CE credits, state appointments. Standard subscription API. We commit to this confidently.
- **iPipeline DataAccess (read)**: producer-level activity feed — illustrations they've already generated, applications in flight. Displayed alongside our pipeline view.
- **No e-app or illustration submission yet**

**What execs see at end of Phase 2A:** producer dashboard shows their actual carrier-side activity inside our workspace. No more switching tabs.

### Phase 2B — Illustration generation via iPipeline *(post-pilot, months 3–6)*

The "FNA → polished carrier illustration → kitchen-table presentation" loop, end-to-end.

- iPipeline WinFlex Connect API integration
- Producer enters client info once (in our FNA tool)
- We submit illustration request to the carrier via iPipeline
- Carrier-issued illustration PDF returned in 30–60 seconds
- Our FNA + the carrier illustration arrive together as a single deliverable

**Why it matters:** today producers do this across 3 tools (our FNA, iPipeline's WinFlex separately, a PowerPoint deck). We collapse it to one.

### Phase 3 — E-application submission *(6–12+ months)*

Highest regulatory + liability complexity. Held until the pilot proves out and GFI's principal/OSJ is committed to running the compliance review with us.

- FireLight or iGo integration for submitting actual policy applications
- Requires producer e-signature flow, beneficiary capture, suitability questionnaire
- Carrier audit + compliance review of our integration before each carrier enables it
- Often a 6–12 week review cycle per carrier

---

## The hurdles that aren't code

These are the actual reasons most CRMs don't integrate with carriers, even though the APIs exist. Worth understanding because they're the questions GFI's IT/compliance teams will ask.

1. **Vendor partner agreements.** iPipeline doesn't open its API to anyone with a credit card. They have a partner program with contractual terms, per-transaction fees, and a vetting process. Same with Insurance Technologies (FireLight).
2. **Per-carrier opt-in.** Even with the vendor agreement, **each carrier individually decides** whether to enable an integration partner for their producers. Transamerica enabling LeadSmart AI is a separate negotiation from Nationwide enabling us.
3. **Costs.** iPipeline partner agreements typically include per-transaction fees ($0.50–$5 per illustration submitted) on top of platform licensing. That eats into our $39–49/producer/mo pricing, which is why we phase it.
4. **Identity / auth.** Producer credentials live with the carrier, not with us. Either we OAuth on their behalf (carrier must support it) or we operate service-to-service (carrier must issue us delegated credentials).
5. **Liability.** If our integration submits a wrong illustration and the producer presents it to a client, who's on the hook? Vendor contracts spell this out. Carriers tend to want indemnity from the integrator.

---

## What this means for the pilot proposal

Updating the language slightly from the original pilot doc:

| Original framing | More accurate framing |
|---|---|
| "Phase 2: carrier integration (post-pilot)" | **Phase 2A** (post-pilot weeks 1–8): NIPR + iPipeline read-only — *committed*. **Phase 2B** (months 3–6): WinFlex illustration submission via iPipeline — *committed conditional on partner agreement, accelerated by GFI's intro*. **Phase 3** (6–12+ months): e-app via FireLight — *roadmap, no firm date* |

The pilot itself doesn't include any carrier integration work. Phase 2 starts the day the pilot's decision review hits "expand."

---

## The GFI-specific angle (strategic shortcut)

For GFI specifically (Transamerica-affiliated), there's a leverage point no other agency can replicate.

**Transamerica's internal tools (TransACT, their illustration platform) are theoretically more accessible to us through GFI's existing carrier relationship than they are to any random CRM vendor.**

If GFI's leadership has executive contacts inside Transamerica's tech relations team, they can request that LeadSmart AI be approved as an integration partner for GFI-affiliated producers. That's the kind of asset GFI brings to the partnership that no other agency can — and it's worth bringing up in the pitch.

**Concretely**, ask the exec: *"If we sign the pilot, can you make a single introduction to Transamerica tech relations? That alone moves our Phase 2B timeline from 4 months to 6 weeks."*

---

## Verbatim demo answer (when asked live)

> "Yes — and the gating factor is vendor agreements, not code. We have a 3-phase plan: NIPR + iPipeline read-only in pilot Phase 2A, WinFlex illustration submission in 2B, and e-app in Phase 3. The Phase 2B and 3 work moves dramatically faster if GFI introduces us to their Transamerica relationship — that's one of the things being a pilot partner actually gets you."

---

## What to commit to vs. what to position as roadmap

For the meeting:

- **Commit confidently:** NIPR license tracking (Phase 2A). It's a $200–500/mo subscription, no partner gates.
- **Commit with conditions:** iPipeline read-only (Phase 2A) — assumes we close the iPipeline partner agreement during the pilot's first 30 days.
- **Position as accelerated by pilot partnership:** WinFlex illustration submission (Phase 2B), Transamerica TransACT integration.
- **Position as roadmap discovery:** FireLight e-app, multi-carrier expansion beyond Transamerica.

Never promise a carrier integration with a date that depends on a third party we haven't signed yet.
