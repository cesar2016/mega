import { useOnboardingRedirect } from "lib/hooks/useAuthRedirect";
import OnboardingScreen from "features/onboarding/OnboardingScreen";

export default function OnboardingRoute() {
  const redirect = useOnboardingRedirect();
  if (redirect) return redirect;

  return <OnboardingScreen />;
}
