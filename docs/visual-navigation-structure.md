# Visual navigation structure

## PropertyToolsAI (consumer)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [≡]  [LOGO]     [ 🔍  Search tools & guides…          ]   Log in  Sign up  Premium │
├─────────────────────────────────────────────────────────────────────────────┤
│ (narrow screens: second row = full-width search)                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┬──────────────────────────────────────────────────────────────┐
│ Tools        │                                                              │
│              │                     page content                              │
│ Dashboard    │                                                              │
│ ▼ Home value │                                                              │
│   · Estimate │                                                              │
│ ▼ Financing  │                                                              │
│ ▼ Investing  │                                                              │
│ ▼ AI tools   │                                                              │
│ ▼ Recommended│                                                              │
└──────────────┴──────────────────────────────────────────────────────────────┘
     ↑ drawer off-canvas on mobile; fixed + open on lg
```

## LeadSmart AI (agent dashboard)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [≡]  LeadSmart AI / Command center    [ 🔍 Search leads… ]   🔔  Credits  Profile │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┬──────────────────────────────────────────────────────────────┐
│ Workspace    │                                                              │
│ Dashboard    │                     page content                              │
│ Leads        │                                                              │
│ Opportunities│                                                              │
│ Pipeline     │                                                              │
│ ▼ AI tools   │                                                              │
│ ▼ Reports    │                                                              │
│ Settings     │                                                              │
└──────────────┴──────────────────────────────────────────────────────────────┘
     ↑ mobile: overlay drawer; lg: static column beside main
```

## Code map

| Piece | Location |
|-------|-----------|
| Shared navigation UI + types | `packages/ui/navigation/*` |
| PropertyTools nav data | `apps/propertytoolsai/nav.config.tsx` |
| LeadSmart nav data | `apps/leadsmartai/nav.config.tsx` |
| PropertyTools wiring | `components/AppShell.tsx`, `nav.config.tsx` |
| LeadSmart wiring | `components/AppShell.tsx`, `DashboardShell.tsx`, `nav.config.tsx` |
