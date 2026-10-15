import { Hono } from "hono";

/**
 * Sesuai planning: versi awal print = window.print() di browser.
 * Endpoint ini disiapkan untuk tahap lanjutan (Local Print Bridge ke
 * printer USB/Network di komputer booth), jadi sekarang sengaja 501.
 */
export function printRoutes() {
  const app = new Hono();

  app.post("/", (c) =>
    c.json(
      {
        error: "not_implemented",
        message: "Print lewat server belum tersedia. Gunakan tombol Print di browser (window.print).",
      },
      501
    )
  );

  return app;
}
