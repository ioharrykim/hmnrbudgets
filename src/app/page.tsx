import { PlannerShell } from "@/components/planner-shell";
import { getConfiguredAuthMode } from "@/lib/env";
import { getPageDashboardContext } from "@/lib/household-session";

export default async function HomePage() {
  const { session, dashboard } = await getPageDashboardContext();

  return (
    <PlannerShell
      initialDashboard={dashboard}
      sessionEmail={session.email}
      authConfigured={getConfiguredAuthMode() !== "demo"}
      authMode={session.authMode}
      authenticated={session.authenticated}
    />
  );
}
