/** Shape returned to the customer-facing chat API (no internal notes in list). */
export function supportMessageToPublicJson(m: {
  id: string;
  senderType: string;
  senderName: string | null;
  body: string;
  messageType: string;
  createdAt: Date | string;
}) {
  const createdAt =
    typeof m.createdAt === "string" ? m.createdAt : m.createdAt.toISOString();
  return {
    id: m.id,
    senderType: m.senderType,
    senderName: m.senderName,
    body: m.body,
    messageType: m.messageType,
    createdAt,
  };
}
