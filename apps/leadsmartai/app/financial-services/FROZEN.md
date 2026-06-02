# ⛔ FROZEN — `leadsmartai/app/financial-services` (net-new features)

**Status:** Frozen 2026-06-02 (HelmSmart V2 refactor, Phase 0). **No net-new vertical features here.**

**Why:** This is the emerging **Financial-Services vertical** (36 routes) being built *inside* the leadsmartai monolith, riding entirely on the real-estate `agent_id` schema (it owns **zero tables** of its own — see `Table_Classification_Report.md`). Continuing to build here deepens the exact coupling the refactor exists to remove (Risk R5).

**Disposition:** Extracted as **`@helm/pack-financial-services`** once the Core DNA boundaries + tenancy v2 exist (Extraction Plan Phase 5). This is the first non-RE pack and the proof of "Configure Many."

**Allowed:** critical bugfixes for the live app.
**Not allowed:** new FS features, new FS tables on `agent_id`, new downline/compliance/FNA surfaces — wait for the pack fence.

See `…/HelmSmart/Claude/Implementation_Plan_OptionD.md` (Part 5) and `Core_Decision_Record.md` (Risk R5).
