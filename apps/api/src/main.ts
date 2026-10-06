import { getServices } from "./bootstrap";
import { createHandler } from "./interfaces/http/router";

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "127.0.0.1";

const services = await getServices();
const handler = createHandler(services);

async function listen(retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      return Bun.serve({
        port: PORT,
        hostname: HOST,
        fetch: handler,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/EADDRINUSE|already in use/i.test(msg) || i === retries - 1) throw err;
      await Bun.sleep(150);
    }
  }
  throw new Error(`could not bind ${HOST}:${PORT}`);
}

const server = await listen();
console.log(`arcade centre on http://${HOST}:${server.port}`);
