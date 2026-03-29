import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "leadsmart_onboarding_v1_complete";

export async function readOnboardingComplete(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v === "1";
  } catch {
    return false;
  }
}

export async function writeOnboardingComplete(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}
