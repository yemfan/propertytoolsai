/**
 * Device registration + push payload shapes (Expo / mobile + backend push routes).
 */

export type PushPlatform = "ios" | "android" | "web";

/** Typical body for `/api/.../push/register` style endpoints. */
export type PushDeviceRegistration = {
  expoPushToken?: string | null;
  deviceId?: string | null;
  platform?: PushPlatform | null;
  appVersion?: string | null;
};

/**
 * Data payload merged into push notifications (string values recommended by FCM/APNs tooling).
 */
export type PushNotificationData = Record<string, string | number | boolean | null>;
