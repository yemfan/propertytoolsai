import { SupportStatus } from "@prisma/client";

/** Conversation can be resumed in the widget (not terminal). */
export const ACTIVE_SUPPORT_STATUSES: SupportStatus[] = [
  SupportStatus.open,
  SupportStatus.waiting_on_support,
  SupportStatus.waiting_on_customer,
];

export function isActiveSupportStatus(status: SupportStatus): boolean {
  return ACTIVE_SUPPORT_STATUSES.includes(status);
}
