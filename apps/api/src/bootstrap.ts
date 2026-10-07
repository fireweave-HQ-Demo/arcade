import { createAuthUseCases } from "./application/auth";
import { createGameUseCases } from "./application/games";
import { createScoreboardUseCases } from "./application/scoreboard";
import { createAdminUseCases } from "./application/admin";
import { createHistoryUseCases } from "./application/history";
import { migrate, waitForDb } from "./infrastructure/db/client";
import { userRepo } from "./infrastructure/db/user-repo";
import { sessionRepo } from "./infrastructure/db/session-repo";
import { matchRepo } from "./infrastructure/db/match-repo";
import { pinRepo } from "./infrastructure/db/pin-repo";
import { createEngineCatalog } from "./infrastructure/engines/registry";
import { observability } from "./infrastructure/observability/adapter";
import { makePasswordHash } from "./infrastructure/auth/password";
import { log } from "./infrastructure/observability/openobserve";
import type { AppServices } from "./interfaces/http/router";

/** Fresh boot each process start (works with bun --watch full restarts). */
export async function getServices(): Promise<AppServices> {
  await waitForDb();
  await migrate();
  await userRepo.ensureAdmin("admin", makePasswordHash("admin"));
  await log("info", "server.start", { centre: true });

  const engines = createEngineCatalog();
  return {
    auth: createAuthUseCases({
      users: userRepo,
      sessions: sessionRepo,
      obs: observability,
    }),
    games: createGameUseCases({ matches: matchRepo, engines, obs: observability, pins: pinRepo }),
    scoreboard: createScoreboardUseCases({ matches: matchRepo, obs: observability }),
    admin: createAdminUseCases({ matches: matchRepo, engines, obs: observability }),
    history: createHistoryUseCases({ matches: matchRepo, engines, obs: observability }),
  };
}
