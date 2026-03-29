import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { onboardingStyles as s } from "../../lib/onboarding/styles";

export default function OnboardingWelcomeScreen() {
  const router = useRouter();

  return (
    <View style={s.flex}>
      <View style={s.safePad}>
        <View style={s.centerBlock}>
          <Text style={s.kicker}>LeadSmart</Text>
          <Text style={s.title}>Your pipeline, in your pocket</Text>
          <Text style={s.body}>
            See hot leads, reply faster, and stay on top of SMS and email — built for agents on the go.
          </Text>
        </View>
        <View>
          <Pressable
            style={s.primaryBtn}
            onPress={() => router.push("/(onboarding)/value")}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text style={s.primaryBtnText}>Get started</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
