import { createAuthUseCases } from "./application/auth";
import { createGameUseCases } from "./application/games";
import { createScoreboardUseCases } from "./application/scoreboard";
import { createAdminUseCases } from "./application/admin";
import { migrate, waitForDb } from "./infrastructure/db/client";
import { userRepo } from "./infrastructure/db/user-repo";
import { sessionRepo } from "./infrastructure/db/session-repo";
import { matchRepo } from "./infrastructure/db/match-repo";
import { createEngineCatalog } from "./infrastructure/engines/registry";
import { observability } from "./infrastructure/observability/adapter";
import { makePasswordHash } from "./infrastructure/auth/password";
import { log } from "./infrastructure/observability/openobserve";
import { createHandler } from "./interfaces/http/router";

const PORT = Number(process.env.PORT ?? 3000);

await waitForDb();
await migrate();
await userRepo.ensureAdmin("admin", makePasswordHash("admin"));
await log("info", "server.start", { port: PORT, centre: true });

const engines = createEngineCatalog();
const services = {
  auth: createAuthUseCases({ users: userRepo, sessions: sessionRepo, obs: observability }),
  games: createGameUseCases({ matches: matchRepo, engines, obs: observability }),
  scoreboard: createScoreboardUseCases({ matches: matchRepo, obs: observability }),
  admin: createAdminUseCases({ matches: matchRepo, engines, obs: observability }),
};

const server = Bun.serve({
  port: PORT,
  fetch: createHandler(services),
});

console.log(`arcade centre on http://localhost:${server.port}`);
