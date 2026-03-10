import { PlannerShell } from "@/components/planner-shell";
import { hasSupabaseBrowserConfig } from "@/lib/env";
import { getPageDashboardContext } from "@/lib/household-session";

export default async function HomePage() {
  const { session, dashboard } = await getPageDashboardContext();

  return (
    <PlannerShell
      initialDashboard={dashboard}
      sessionEmail={session.email}
      authConfigured={hasSupabaseBrowserConfig()}
      authMode={session.authMode}
      authenticated={session.authenticated}
    />
  );
}
