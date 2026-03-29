import type { PushNotificationData } from "./notification-push";

/** Push / in-app notification envelope (mobile + web). */
export type NotificationPayload = {
  id: string;
  title: string;
  body: string;
  data?: PushNotificationData;
  channel?: "push" | "email" | "sms" | "in_app";
  deepLink?: string | null;
  createdAt?: string;
};
