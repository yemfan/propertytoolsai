import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEY = "leadsmart_access_token";

const g = globalThis as typeof globalThis & { localStorage?: Storage };

function webGet(): string | null {
  const ls = g.localStorage;
  if (!ls) return null;
  return ls.getItem(KEY);
}

function webSet(value: string): void {
  g.localStorage?.setItem(KEY, value);
}

function webRemove(): void {
  g.localStorage?.removeItem(KEY);
}

export async function readStoredAccessToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return webGet();
    }
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function writeStoredAccessToken(token: string): Promise<void> {
  const t = token.trim();
  if (Platform.OS === "web") {
    webSet(t);
    return;
  }
  await SecureStore.setItemAsync(KEY, t);
}

export async function clearStoredAccessToken(): Promise<void> {
  if (Platform.OS === "web") {
    webRemove();
    return;
  }
  await SecureStore.deleteItemAsync(KEY);
}
