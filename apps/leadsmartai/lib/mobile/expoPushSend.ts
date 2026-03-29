/**
 * Send notifications via Expo Push API (https://docs.expo.dev/push-notifications/sending-notifications/).
 * Uses EXPO_ACCESS_TOKEN when set (recommended for production throughput).
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: "default" | null;
  priority?: "default" | "normal" | "high";
  channelId?: string;
};

type ExpoPushApiTicket = {
  status?: string;
  id?: string;
  message?: string;
  details?: { error?: string };
};

type ExpoPushApiResponse = {
  data?: ExpoPushApiTicket[];
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Sends up to 100 messages per request (Expo limit). Silently no-ops when messages is empty.
 */
export async function sendExpoPushMessages(messages: ExpoPushMessage[]): Promise<void> {
  if (!messages.length) return;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const token = process.env.EXPO_ACCESS_TOKEN?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  for (const batch of chunk(messages, 100)) {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(batch),
      });
      const json = (await res.json().catch(() => ({}))) as ExpoPushApiResponse;
      if (!res.ok) {
        console.error("expo push: HTTP error", res.status, JSON.stringify(json).slice(0, 500));
        continue;
      }
      const tickets = json.data ?? [];
      for (const t of tickets) {
        if (t.status === "error") {
          console.error("expo push ticket error:", t.message, t.details?.error);
        }
      }
    } catch (e) {
      console.error("expo push: fetch failed", e);
    }
  }
}
