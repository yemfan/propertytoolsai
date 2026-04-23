import { PlaybooksPageClient } from "./PlaybooksPageClient";

export const dynamic = "force-dynamic";

/**
 * Standalone playbooks page — agent's cross-anchor "my checklists"
 * landing view. Shows every open + applied playbook task regardless
 * of anchor (transaction, open-house, generic).
 *
 * Generic-anchored playbooks (bare date, no linked entity) get
 * created here. Transaction- or open-house-anchored playbooks are
 * applied from those detail pages.
 */
export default function PlaybooksPage() {
  return <PlaybooksPageClient />;
}
