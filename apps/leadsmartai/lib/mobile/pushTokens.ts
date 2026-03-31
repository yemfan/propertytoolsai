import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * All Expo push tokens registered for a Supabase auth user (LeadSmart AI agent login).
 */
export async function listExpoPushTokensForUser(userId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("mobile_push_tokens")
    .select("expo_push_token")
    .eq("user_id", userId);

  if (error) {
    console.error("listExpoPushTokensForUser:", error.message);
    return [];
  }

  const out: string[] = [];
  for (const row of data ?? []) {
    const t = (row as { expo_push_token?: string }).expo_push_token;
    if (typeof t === "string" && /ExponentPushToken|ExpoPushToken/.test(t)) {
      out.push(t);
    }
  }
  return out;
}
