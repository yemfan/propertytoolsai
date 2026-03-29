/**
 * LeadSmart mobile push — single entry surface for registration + outbound notifications.
 *
 * - **Registration**: `registerMobilePushToken` persists Expo tokens on `mobile_push_tokens`
 *   (see `POST /api/mobile/push/register`).
 * - **Outbound**: dispatch helpers load tokens by Supabase `user_id` and send via Expo Push API.
 *
 * Integration notes: `docs/MOBILE_PUSH.md`
 */

export { registerMobilePushToken, type RegisterPushInput } from "@/lib/mobile/push";
export { sendExpoPushMessages, type ExpoPushMessage } from "@/lib/mobile/expoPushSend";
export { listExpoPushTokensForUser } from "@/lib/mobile/pushTokens";
export {
  dispatchMobileHotLeadPush,
  dispatchMobileInboundEmailPush,
  dispatchMobileInboundSmsPush,
  dispatchMobileNeedsHumanPush,
  dispatchMobileReminderPush,
} from "@/lib/mobile/pushDispatch";
