# PropertyTools AI — static images

Canonical files served by the app:

- **`ptlogoicon48.png`** — Favicon / Apple touch icon (`app/layout.tsx` `metadata.icons`). **Must be this exact lowercase name** (Linux/Vercel are case-sensitive). Same asset as **`PTLogoIcon48.png`** in `Propertytoolsai/Images/`.
- **`ptlogo.png`** — Header, sidebar, and marketing homepage logo (`AppShell`, `Header`, `PropertyToolsPage`). Same asset as **`PTLogo.png`** in `Propertytoolsai/Images/`.

URLs use lowercase names so they work on case-sensitive hosts (e.g. Linux/Vercel).

**Update from repo `Images/`:**

| Served as            | Source file (`Propertytoolsai/Images/`) |
|----------------------|----------------------------------------|
| `ptlogo.png`         | `PTLogo.png`                           |
| `ptlogoicon48.png`   | `PTLogoIcon48.png`                     |

Example (from repo root):

```powershell
Copy-Item Images/PTLogo.png apps/propertytoolsai/public/images/ptlogo.png -Force
Copy-Item Images/PTLogoIcon48.png apps/propertytoolsai/public/images/ptlogoicon48.png -Force
```
