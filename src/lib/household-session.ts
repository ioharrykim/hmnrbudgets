import { hasSupabaseBrowserConfig } from "@/lib/env";
import { createPublicDashboard } from "@/lib/public-dashboard";
import { getSessionContext } from "@/lib/session";
import { getRepository } from "@/lib/storage";

export class UnauthorizedSessionError extends Error {
  constructor() {
    super("로그인이 필요합니다.");
  }
}

export async function requireHouseholdSession() {
  const session = await getSessionContext();

  if (hasSupabaseBrowserConfig() && !session.authenticated) {
    throw new UnauthorizedSessionError();
  }

  if (!session.email) {
    throw new UnauthorizedSessionError();
  }

  const repository = getRepository();
  const household = await repository.getOrCreateHouseholdByEmail(session.email, session.authUserId);

  return {
    session,
    repository,
    household,
  };
}

export async function getPageDashboardContext() {
  const session = await getSessionContext();

  if (hasSupabaseBrowserConfig() && !session.authenticated) {
    return {
      session,
      dashboard: createPublicDashboard(session.email),
    };
  }

  const repository = getRepository();
  const household = await repository.getOrCreateHouseholdByEmail(session.email, session.authUserId);
  const dashboard = await repository.getDashboardPayload(household.id);

  return {
    session,
    dashboard: dashboard ?? createPublicDashboard(session.email),
  };
}
