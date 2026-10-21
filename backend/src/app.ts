import { Hono } from "hono";
import { cors } from "hono/cors";
import { loadConfig, type Config } from "./config.js";
import { emailRoutes, type MailSender } from "./routes/email.js";
import { messageRoutes } from "./routes/message.js";
import { photoRoutes } from "./routes/photos.js";
import { printRoutes } from "./routes/print.js";
import { qrRoutes } from "./routes/qr.js";
import { sessionRoutes } from "./routes/sessions.js";
import { sendOwnerMessage, sendPhotoMail, type MessageSender } from "./services/mail.js";
import { SessionService } from "./services/sessions.js";
import { createStorage, type Storage } from "./services/storage.js";

export interface AppDeps {
  config?: Config;
  storage?: Storage;
  sendMail?: MailSender;
  sendMessage?: MessageSender;
}

export function createApp(deps: AppDeps = {}) {
  const config = deps.config ?? loadConfig();
  const storage = deps.storage ?? createStorage(config);
  const sessions = new SessionService(config, storage);

  const app = new Hono();

  app.use(
    "/api/*",
    cors({
      origin: (origin) => (config.corsOrigins.includes(origin) ? origin : null),
      allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type"],
      maxAge: 600,
    })
  );

  app.get("/", (c) => c.json({ name: "boothin' backend", status: "ok" }));

  app.get("/api/health", (c) =>
    c.json({
      status: "ok",
      message: "Boothin backend is running",
      storage: storage.name,
      mail: config.resendApiKey ? "configured" : "not_configured",
      messages: config.resendApiKey && config.ownerEmail ? "configured" : "not_configured",
      sessions: sessions.count,
    })
  );

  app.route("/api/sessions", sessionRoutes(config, sessions));
  app.route("/api/photos", photoRoutes(sessions));
  app.route("/api/qr", qrRoutes(config, sessions));
  app.route("/api/print", printRoutes());
  app.route("/api/message", messageRoutes(config, deps.sendMessage ?? sendOwnerMessage));
  app.route("/api/email", emailRoutes(config, sessions, deps.sendMail ?? sendPhotoMail));

  app.notFound((c) => c.json({ error: "not_found", message: "Route tidak ditemukan." }, 404));

  app.onError((error, c) => {
    console.error("[error]", error);
    return c.json({ error: "internal", message: "Terjadi kesalahan di server." }, 500);
  });

  return { app, config, sessions, storage };
}
