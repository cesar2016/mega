import { Stack, useLocalSearchParams } from "expo-router";
import { useGuestRedirect } from "lib/hooks/useAuthRedirect";

export default function AuthLayout() {
  const { returnUrl } = useLocalSearchParams<{ returnUrl?: string }>();
  const redirect = useGuestRedirect(returnUrl || "/(main)/tabs/feed");
  if (redirect) return redirect;

  return <Stack screenOptions={{ headerShown: false }} />;
}
