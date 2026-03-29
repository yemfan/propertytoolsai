import { Alert, Linking } from "react-native";

/**
 * Opens a URL via the OS (tel/sms/mailto/maps, etc.).
 * Uses canOpenURL when possible so we can show a clear message instead of a silent failure.
 */
export async function openExternalUrl(url: string, unavailableMessage: string): Promise<boolean> {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert("Cannot open link", unavailableMessage);
      return false;
    }
    await Linking.openURL(url);
    return true;
  } catch {
    Alert.alert("Cannot open link", unavailableMessage);
    return false;
  }
}
