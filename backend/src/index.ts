import { createApp } from "./app.ts";

const { app, config, sessions, storage } = createApp();

sessions.startCleanup();

console.log(
  `boothin' backend :${config.port} | storage=${storage.name} | ttl=${Math.round(config.sessionTtlMs / 60000)}m | app=${config.appUrl}`
);

/**
 * Bun: export default { port, fetch } sudah cukup.
 * Node (mis. Railway tanpa Bun): pakai @hono/node-server.
 */
if (typeof (globalThis as { Bun?: unknown }).Bun === "undefined") {
  const { serve } = await import("@hono/node-server");
  serve({ fetch: app.fetch, port: config.port });
}

export default {
  port: config.port,
  fetch: app.fetch,
};
