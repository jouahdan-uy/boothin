import { Hono } from "hono";
import type { Config } from "../config.ts";
import { detectImage, TOKEN_PATTERN } from "../lib/image.ts";
import { rateLimit } from "../middleware/rateLimit.ts";
import { SessionFullError, type SessionService } from "../services/sessions.ts";

export function sessionRoutes(config: Config, sessions: SessionService) {
  const app = new Hono();

  /**
   * POST /api/sessions   (body mentah image/jpeg, atau multipart field "photo")
   * Menyimpan foto final sementara dan mengembalikan token + link publik.
   */
  app.post(
    "/",
    rateLimit({ name: "upload", windowMs: 10 * 60_000, max: 30 }),
    async (c) => {
      const declared = Number(c.req.header("content-length") ?? 0);
      if (declared > config.maxUploadBytes + 4096) {
        return c.json({ error: "too_large", message: "Foto terlalu besar." }, 413);
      }

      /*
       * Dua bentuk upload didukung:
       *  1) body mentah (Content-Type: image/jpeg), dipakai frontend
       *  2) multipart/form-data dengan field "photo"
       */
      const contentType = c.req.header("content-type") ?? "";
      let bytes: Uint8Array;

      if (contentType.startsWith("multipart/form-data")) {
        let body: Record<string, string | File>;
        try {
          body = (await c.req.parseBody()) as Record<string, string | File>;
        } catch {
          return c.json({ error: "bad_request", message: "Body multipart tidak valid." }, 400);
        }

        const file = body["photo"];
        if (!(file instanceof File)) {
          return c.json({ error: "bad_request", message: "Field 'photo' wajib diisi." }, 400);
        }
        if (file.size > config.maxUploadBytes) {
          return c.json({ error: "too_large", message: "Foto terlalu besar." }, 413);
        }
        bytes = new Uint8Array(await file.arrayBuffer());
      } else if (contentType.startsWith("image/")) {
        bytes = new Uint8Array(await c.req.arrayBuffer());
        if (bytes.byteLength > config.maxUploadBytes) {
          return c.json({ error: "too_large", message: "Foto terlalu besar." }, 413);
        }
      } else {
        return c.json(
          { error: "bad_request", message: "Kirim foto sebagai image/jpeg atau multipart field 'photo'." },
          400
        );
      }

      if (bytes.byteLength === 0) {
        return c.json({ error: "bad_request", message: "Foto kosong." }, 400);
      }

      const kind = detectImage(bytes);

      if (!kind) {
        return c.json(
          { error: "unsupported_type", message: "Hanya JPG atau PNG yang diterima." },
          415
        );
      }

      try {
        const session = await sessions.create(bytes, kind.contentType);

        return c.json(
          {
            token: session.token,
            url: `${config.appUrl}/m/${session.token}`,
            expiresAt: new Date(session.expiresAt).toISOString(),
          },
          201
        );
      } catch (error) {
        if (error instanceof SessionFullError) {
          return c.json(
            { error: "busy", message: "Server sedang penuh, coba lagi beberapa menit lagi." },
            503
          );
        }
        throw error;
      }
    }
  );

  /** GET /api/sessions/:token : metadata (dipakai halaman /m/:token). */
  app.get("/:token", async (c) => {
    const token = c.req.param("token");
    const session = TOKEN_PATTERN.test(token) ? await sessions.get(token) : null;

    if (!session) {
      return c.json({ error: "not_found", message: "Foto tidak ditemukan atau sudah kedaluwarsa." }, 404);
    }

    return c.json({
      token: session.token,
      url: `${config.appUrl}/m/${session.token}`,
      expiresAt: new Date(session.expiresAt).toISOString(),
    });
  });

  /** DELETE /api/sessions/:token : hapus lebih awal. */
  app.delete("/:token", async (c) => {
    const token = c.req.param("token");
    if (TOKEN_PATTERN.test(token)) await sessions.remove(token);
    return c.body(null, 204);
  });

  return app;
}
