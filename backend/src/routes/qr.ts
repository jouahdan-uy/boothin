import { Hono } from "hono";
import type { Config } from "../config.js";
import { TOKEN_PATTERN } from "../lib/image.js";
import { qrToSvg } from "../services/qr.js";
import type { SessionService } from "../services/sessions.js";

export function qrRoutes(config: Config, sessions: SessionService) {
  const app = new Hono();

  /**
   * POST /api/qr  { token }
   * Mengembalikan URL yang di-encode ke QR. QR tidak menyimpan foto,
   * hanya link `${APP_URL}/m/<token>`. Gambar QR (SVG) dibuat di backend oleh services/qr.ts tanpa dependency.
   */
  app.post("/", async (c) => {
    const body = await c.req.json().catch(() => null);
    const token = typeof body?.token === "string" ? body.token : "";
    const session = TOKEN_PATTERN.test(token) ? await sessions.get(token) : null;

    if (!session) {
      return c.json({ error: "not_found", message: "Sesi tidak ditemukan atau sudah kedaluwarsa." }, 404);
    }

    const url = `${config.appUrl}/m/${session.token}`;

    return c.json({
      token: session.token,
      url,
      svg: qrToSvg(url),
      expiresAt: new Date(session.expiresAt).toISOString(),
    });
  });

  return app;
}
