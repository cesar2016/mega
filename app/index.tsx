import { Redirect } from "expo-router";
import { useAuthRedirect } from "lib/hooks/useAuthRedirect";

export default function Index() {
  const redirect = useAuthRedirect();
  if (redirect) return redirect;

  return <Redirect href="/(main)/tabs/feed" />;
}
