import { NextResponse } from "next/server";

import { OFFICIAL_SOURCE_LINKS } from "@/lib/constants";
import { getConfiguredAuthMode } from "@/lib/env";
import { UnauthorizedSessionError, requireHouseholdSession } from "@/lib/household-session";
import { createPublicDashboard } from "@/lib/public-dashboard";

export async function GET() {
  try {
    const { repository, household, session } = await requireHouseholdSession();
    const dashboard = await repository.getDashboardPayload(household.id);

    return NextResponse.json({
      dashboard,
      officialSourceLinks: OFFICIAL_SOURCE_LINKS,
      authenticated: session.authenticated,
    });
  } catch (error) {
    if (error instanceof UnauthorizedSessionError && getConfiguredAuthMode() !== "demo") {
      return NextResponse.json(
        {
          dashboard: createPublicDashboard(),
          officialSourceLinks: OFFICIAL_SOURCE_LINKS,
          authenticated: false,
        },
        { status: 401 },
      );
    }

    throw error;
  }
}
