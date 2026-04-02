import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "leadsmart_clear_session_on_next_launch";

/** When false, next cold start signs out Supabase (session not remembered). */
export async function setClearSessionOnNextLaunch(shouldClearOnNextLaunch: boolean): Promise<void> {
  if (shouldClearOnNextLaunch) {
    await AsyncStorage.setItem(KEY, "1");
  } else {
    await AsyncStorage.removeItem(KEY);
  }
}

export async function consumeShouldClearSessionOnLaunch(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v === "1") {
      await AsyncStorage.removeItem(KEY);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
