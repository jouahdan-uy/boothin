import { Hono } from "hono";
import { TOKEN_PATTERN } from "../lib/image.ts";
import type { SessionService } from "../services/sessions.ts";

export function photoRoutes(sessions: SessionService) {
  const app = new Hono();

  /** GET /api/photos/:token[?download=1] */
  app.get("/:token", async (c) => {
    const token = c.req.param("token");
    const found = TOKEN_PATTERN.test(token) ? await sessions.readPhoto(token) : null;

    if (!found) {
      return c.json({ error: "not_found", message: "Foto tidak ditemukan atau sudah kedaluwarsa." }, 404);
    }

    const ext = found.session.contentType === "image/png" ? "png" : "jpg";
    const disposition = c.req.query("download") === "1" ? "attachment" : "inline";

    return new Response(found.bytes.slice(), {
      headers: {
        "Content-Type": found.session.contentType,
        "Content-Length": String(found.bytes.byteLength),
        "Content-Disposition": `${disposition}; filename="boothin-${token}.${ext}"`,
        "Cache-Control": "private, max-age=60",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });

  return app;
}
