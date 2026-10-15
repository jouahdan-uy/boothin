import { Hono } from "hono";
import type { Config } from "../config.ts";
import { isValidEmail, TOKEN_PATTERN } from "../lib/image.ts";
import { rateLimit } from "../middleware/rateLimit.ts";
import { MailNotConfiguredError, sendPhotoMail } from "../services/mail.ts";
import type { SessionService } from "../services/sessions.ts";

export type MailSender = typeof sendPhotoMail;

export function emailRoutes(
  config: Config,
  sessions: SessionService,
  send: MailSender = sendPhotoMail
) {
  const app = new Hono();

  /** POST /api/email  { token, email } */
  app.post("/", rateLimit({ name: "email", windowMs: 10 * 60_000, max: 6 }), async (c) => {
    const body = await c.req.json().catch(() => null);
    const token = typeof body?.token === "string" ? body.token : "";
    const email = typeof body?.email === "string" ? body.email.trim() : "";

    if (!isValidEmail(email)) {
      return c.json({ error: "invalid_email", message: "Alamat email tidak valid." }, 400);
    }

    const found = TOKEN_PATTERN.test(token) ? await sessions.readPhoto(token) : null;
    if (!found) {
      return c.json({ error: "not_found", message: "Sesi tidak ditemukan atau sudah kedaluwarsa." }, 404);
    }

    try {
      await send(config, {
        to: email,
        link: `${config.appUrl}/m/${token}`,
        photo: found.bytes,
        filename: `boothin-${token}.${found.session.contentType === "image/png" ? "png" : "jpg"}`,
      });
    } catch (error) {
      if (error instanceof MailNotConfiguredError) {
        return c.json(
          { error: "mail_not_configured", message: "Pengiriman email belum diaktifkan di server." },
          503
        );
      }
      console.error("[email] gagal kirim:", error instanceof Error ? error.message : error);
      return c.json({ error: "mail_failed", message: "Email gagal dikirim, coba lagi." }, 502);
    }

    return c.json({ ok: true });
  });

  return app;
}
