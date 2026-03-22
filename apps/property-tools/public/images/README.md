# PropertyTools AI — static images

Canonical files served by the app:

- **`pticon.png`** — Favicon / Apple touch icon (`app/layout.tsx` `metadata.icons`).
- **`ptlogo.png`** — Header, sidebar, and marketing homepage logo (`Header`, `Sidebar`, `PropertyToolsPage`).

**Source art (repo):** copy from `Propertytoolsai/Images/` when updating:

| Served as     | Typical source file     |
|---------------|-------------------------|
| `ptlogo.png`  | `Images/PTLogo.png`     |
| `pticon.png`  | `Images/icon.png` (favicon) |

Run from repo root (example):

`Copy-Item Images/PTLogo.png apps/property-tools/public/images/ptlogo.png -Force`  
`Copy-Item Images/icon.png apps/property-tools/public/images/pticon.png -Force`
