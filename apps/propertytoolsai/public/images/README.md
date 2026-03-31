# PropertyTools AI — static images

Canonical files served by the app:

- **`app-icon.png`** — Favicon / Apple touch icon (`app/layout.tsx` `metadata.icons`). **Must be this exact lowercase name** (Linux/Vercel are case-sensitive).
- **`ptlogo.png`** — Header, sidebar, and marketing homepage logo (`AppShell`, `Header`, `PropertyToolsPage`). Same asset as **`PTLogo.png`** in `Propertytoolsai/Images/`.

URLs use lowercase names so they work on case-sensitive hosts (e.g. Linux/Vercel).

**Update from repo `Images/`:**

| Served as      | Source file (`Propertytoolsai/Images/`) |
|----------------|----------------------------------------|
| `app-icon.png` | Add or export your square app icon PNG |
| `ptlogo.png`   | `PTLogo.png`                           |

Example (from repo root):

```powershell
Copy-Item Images/PTLogo.png apps/propertytoolsai/public/images/ptlogo.png -Force
# Copy or export your favicon as apps/propertytoolsai/public/images/app-icon.png
```
