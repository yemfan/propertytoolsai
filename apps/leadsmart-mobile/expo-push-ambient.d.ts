/**
 * Minimal typings so `tsc` passes before/without hoisted `expo-device` / `expo-notifications`
 * (run `pnpm install` at repo root for real implementations).
 */
declare module "expo-device" {
  export const isDevice: boolean;
}

declare module "expo-notifications" {
  export function setNotificationHandler(handler: {
    handleNotification: () => Promise<{
      shouldShowAlert: boolean;
      shouldPlaySound: boolean;
      shouldSetBadge: boolean;
    }>;
  }): void;

  export function getPermissionsAsync(): Promise<{ status: string }>;
  export function requestPermissionsAsync(): Promise<{ status: string }>;

  export enum AndroidImportance {
    DEFAULT = 3,
    HIGH = 4,
    MAX = 5,
  }

  export function setNotificationChannelAsync(id: string, config: Record<string, unknown>): Promise<void>;

  export function getExpoPushTokenAsync(options?: { projectId?: string }): Promise<{ data: string }>;

  export function addNotificationResponseReceivedListener(
    listener: (response: NotificationOpenResponse) => void
  ): { remove(): void };

  export function getLastNotificationResponseAsync(): Promise<NotificationOpenResponse | null>;
}

interface NotificationOpenResponse {
  notification?: { request: { content: { data?: Record<string, unknown> } } };
}
