import { Stack } from "expo-router";
import { useGuestRedirect } from "lib/hooks/useAuthRedirect";

export default function AuthLayout() {
  const redirect = useGuestRedirect();
  if (redirect) return redirect;

  return <Stack screenOptions={{ headerShown: false }} />;
}
