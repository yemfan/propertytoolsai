import { supabaseAdmin } from "@/lib/supabase/admin";

/** Service input: authenticated user + agent from mobile session. */
export type RegisterPushInput = {
  userId: string;
  agentId: string;
  expoPushToken: string;
  platform: "ios" | "android" | "web" | "unknown";
  deviceId?: string | null;
  appVersion?: string | null;
};

export async function registerMobilePushToken(input: RegisterPushInput) {
  const now = new Date().toISOString();
  const row = {
    user_id: input.userId,
    agent_id: input.agentId as unknown as number,
    expo_push_token: input.expoPushToken.trim(),
    platform: input.platform,
    device_id: input.deviceId?.trim() || null,
    app_version: input.appVersion?.trim() || null,
    updated_at: now,
  };

  const { error } = await supabaseAdmin.from("mobile_push_tokens").upsert(row, {
    onConflict: "user_id,expo_push_token",
  });

  if (error) throw new Error(error.message);
}
