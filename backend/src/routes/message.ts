import { Hono } from "hono";
import type { Config } from "../config.ts";
import { validateMessage } from "../lib/message.ts";
import { rateLimit } from "../middleware/rateLimit.ts";
import {
  MailNotConfiguredError,
  OwnerNotConfiguredError,
  sendOwnerMessage,
  type MessageSender,
} from "../services/mail.ts";

const MAX_BODY_BYTES = 16 * 1024;

export function messageRoutes(config: Config, send: MessageSender = sendOwnerMessage) {
  const app = new Hono();

  /**
   * POST /api/message  { type: "contact" | "feedback", name?, email?, message, rating?, website? }
   * `website` adalah kolom jebakan (honeypot): manusia tidak melihatnya, bot biasanya mengisinya.
   */
  app.post("/", rateLimit({ name: "message", windowMs: 10 * 60_000, max: 5 }), async (c) => {
    if (Number(c.req.header("content-length") ?? 0) > MAX_BODY_BYTES) {
      return c.json({ error: "too_large", message: "Pesan terlalu besar." }, 413);
    }

    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return c.json({ error: "bad_request", message: "Body harus berupa JSON." }, 400);
    }

    // Bot: pura-pura berhasil, tidak ada yang dikirim.
    if (typeof body.website === "string" && body.website.trim() !== "") {
      return c.json({ ok: true });
    }

    const result = validateMessage(body as Record<string, unknown>);
    if (!result.ok) {
      return c.json({ error: "invalid", field: result.field, message: result.message }, 400);
    }

    try {
      await send(config, result.value);
    } catch (error) {
      if (error instanceof MailNotConfiguredError || error instanceof OwnerNotConfiguredError) {
        return c.json(
          { error: "mail_not_configured", message: "Pengiriman pesan belum diaktifkan di server." },
          503
        );
      }
      console.error("[message] gagal kirim:", error instanceof Error ? error.message : error);
      return c.json({ error: "mail_failed", message: "Pesan gagal dikirim, coba lagi nanti." }, 502);
    }

    return c.json({ ok: true });
  });

  return app;
}
