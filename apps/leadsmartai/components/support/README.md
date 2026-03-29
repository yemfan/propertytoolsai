# Support UI

| File | Role |
|------|------|
| `CustomerSupportChat.tsx` | Customer widget + `SupportChatLauncher` (slide-over). Uses `api`, `polling`, and `useSupportRealtime` (typing + presence). |
| `SupportDashboard.tsx` | Agent inbox; same realtime hook for peer typing / customer presence. |

Imports:

- `import CustomerSupportChat from "@/components/support/CustomerSupportChat"`
- `import { SupportChatLauncher } from "@/components/support/CustomerSupportChat"`
- `import SupportDashboard from "@/components/support/SupportDashboard"`
