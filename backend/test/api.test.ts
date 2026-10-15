import { describe, expect, test } from "bun:test";
import { createApp } from "../src/app.ts";
import { loadConfig } from "../src/config.ts";
import { MemoryStorage } from "../src/services/storage.ts";
import { MailNotConfiguredError, OwnerNotConfiguredError, sendOwnerMessage } from "../src/services/mail.ts";
import { encodeQr } from "../src/services/qr.ts";

// JPEG minimal (cukup magic bytes) dan PNG 1x1 valid
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = (res: Response) => res.json() as Promise<any>;

function setup(env: Record<string, string> = {}, sendMail?: any, sendMessage?: any) {
  const config = loadConfig({ APP_URL: "https://boothin.test", ...env });
  const ctx = createApp({ config, storage: new MemoryStorage(), sendMail, sendMessage });
  const origin = { Origin: "https://boothin.test" };

  const upload = (bytes: Uint8Array, name = "photo.jpg", type = "image/jpeg", ip = "1.1.1.1") => {
    const form = new FormData();
    form.set("photo", new File([bytes.slice()], name, { type }));
    return ctx.app.request("/api/sessions", {
      method: "POST",
      body: form,
      headers: { ...origin, "x-forwarded-for": ip },
    });
  };

  return { ...ctx, upload, origin };
}

describe("health & cors", () => {
  test("health ok", async () => {
    const { app } = setup();
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.status).toBe("ok");
    expect(body.storage).toBe("memory");
    expect(body.mail).toBe("not_configured");
  });

  test("CORS hanya untuk origin yang diizinkan", async () => {
    const { app } = setup({ CORS_ORIGINS: "https://other.test/" });
    const ok = await app.request("/api/health", { headers: { Origin: "https://boothin.test" } });
    expect(ok.headers.get("access-control-allow-origin")).toBe("https://boothin.test");
    const other = await app.request("/api/health", { headers: { Origin: "https://other.test" } });
    expect(other.headers.get("access-control-allow-origin")).toBe("https://other.test");
    const evil = await app.request("/api/health", { headers: { Origin: "https://evil.test" } });
    expect(evil.headers.get("access-control-allow-origin")).toBeNull();
  });

  test("route tidak dikenal -> JSON 404", async () => {
    const { app } = setup();
    const res = await app.request("/api/nope");
    expect(res.status).toBe(404);
    expect((await json(res)).error).toBe("not_found");
  });
});

describe("sessions & photos", () => {
  test("upload -> metadata -> ambil foto -> download", async () => {
    const { upload, app } = setup();
    const res = await upload(JPEG);
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.token).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(body.url).toBe(`https://boothin.test/m/${body.token}`);

    const meta = await app.request(`/api/sessions/${body.token}`);
    expect(meta.status).toBe(200);

    const photo = await app.request(`/api/photos/${body.token}`);
    expect(photo.status).toBe(200);
    expect(photo.headers.get("content-type")).toBe("image/jpeg");
    expect(photo.headers.get("content-disposition")).toStartWith("inline");
    expect(new Uint8Array(await photo.arrayBuffer())).toEqual(JPEG);

    const dl = await app.request(`/api/photos/${body.token}?download=1`);
    expect(dl.headers.get("content-disposition")).toStartWith("attachment");
  });

  test("upload body mentah image/jpeg (cara frontend)", async () => {
    const { app, origin } = setup();
    const res = await app.request("/api/sessions", {
      method: "POST",
      headers: { ...origin, "content-type": "image/jpeg" },
      body: JPEG,
    });
    expect(res.status).toBe(201);
    const { token } = await json(res);
    const photo = await app.request(`/api/photos/${token}`);
    expect(new Uint8Array(await photo.arrayBuffer())).toEqual(JPEG);
  });

  test("body mentah kosong / content-type aneh -> 400", async () => {
    const { app } = setup();
    const empty = await app.request("/api/sessions", {
      method: "POST", headers: { "content-type": "image/jpeg" }, body: new Uint8Array(0),
    });
    expect(empty.status).toBe(400);
    const weird = await app.request("/api/sessions", {
      method: "POST", headers: { "content-type": "text/plain" }, body: "hai",
    });
    expect(weird.status).toBe(400);
  });

  test("tipe ditentukan dari isi file, bukan dari header client", async () => {
    const { upload } = setup();
    const png = await upload(PNG, "x.jpg", "image/jpeg");
    expect(png.status).toBe(201);

    const fake = await upload(new TextEncoder().encode("<script>alert(1)</script>"), "x.jpg", "image/jpeg");
    expect(fake.status).toBe(415);
  });

  test("tanpa field photo / bukan multipart -> 400", async () => {
    const { app, origin } = setup();
    const empty = await app.request("/api/sessions", { method: "POST", body: new FormData(), headers: origin });
    expect(empty.status).toBe(400);
    const json = await app.request("/api/sessions", {
      method: "POST",
      body: "{}",
      headers: { ...origin, "content-type": "application/json" },
    });
    expect(json.status).toBe(400);
  });

  test("terlalu besar -> 413", async () => {
    const { upload } = setup({ MAX_UPLOAD_MB: "1" });
    const big = new Uint8Array(1024 * 1024 + 10);
    big.set(JPEG);
    expect((await upload(big)).status).toBe(413);
  });

  test("token acak / tidak valid -> 404 dan tidak crash", async () => {
    const { app } = setup();
    for (const token of ["abc", "........", "../../etc/passwd", "A".repeat(12)]) {
      const res = await app.request(`/api/photos/${encodeURIComponent(token)}`);
      expect(res.status).toBe(404);
    }
  });

  test("session kedaluwarsa -> 404 dan foto dihapus dari storage", async () => {
    const { upload, app, sessions, storage } = setup();
    const { token } = await json(await upload(JPEG));
    // majukan waktu
    const realNow = Date.now;
    Date.now = () => realNow() + 7 * 3600_000;
    try {
      const res = await app.request(`/api/photos/${token}`);
      expect(res.status).toBe(404);
      expect(await storage.get(token)).toBeNull();
      expect(sessions.count).toBe(0);
    } finally {
      Date.now = realNow;
    }
  });

  test("cleanup() menghapus session kedaluwarsa", async () => {
    const { upload, sessions } = setup();
    await upload(JPEG);
    await upload(JPEG);
    expect(sessions.count).toBe(2);
    const realNow = Date.now;
    Date.now = () => realNow() + 7 * 3600_000;
    try {
      expect(await sessions.cleanup()).toBe(2);
      expect(sessions.count).toBe(0);
    } finally {
      Date.now = realNow;
    }
  });

  test("batas jumlah session -> 503", async () => {
    const { upload } = setup({ MAX_SESSIONS: "2" });
    expect((await upload(JPEG, "a.jpg", "image/jpeg", "2.2.2.1")).status).toBe(201);
    expect((await upload(JPEG, "a.jpg", "image/jpeg", "2.2.2.2")).status).toBe(201);
    expect((await upload(JPEG, "a.jpg", "image/jpeg", "2.2.2.3")).status).toBe(503);
  });

  test("DELETE menghapus foto", async () => {
    const { upload, app } = setup();
    const { token } = await json(await upload(JPEG));
    expect((await app.request(`/api/sessions/${token}`, { method: "DELETE" })).status).toBe(204);
    expect((await app.request(`/api/photos/${token}`)).status).toBe(404);
  });

  test("rate limit upload -> 429", async () => {
    const { upload } = setup();
    let last = 201;
    for (let i = 0; i < 31; i++) last = (await upload(JPEG, "a.jpg", "image/jpeg", "9.9.9.9")).status;
    expect(last).toBe(429);
  });
});

describe("qr", () => {
  test("mengembalikan url + svg", async () => {
    const { upload, app, origin } = setup();
    const { token } = await json(await upload(JPEG));
    const res = await app.request("/api/qr", {
      method: "POST",
      headers: { ...origin, "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.url).toBe(`https://boothin.test/m/${token}`);
    expect(body.svg).toStartWith("<svg");
  });

  test("token tidak ada / body rusak -> 404", async () => {
    const { app } = setup();
    for (const body of [JSON.stringify({ token: "AAAAAAAAAAAA" }), "bukan json", "{}"]) {
      const res = await app.request("/api/qr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      expect(res.status).toBe(404);
    }
  });
});

describe("email", () => {
  const post = (app: any, payload: unknown, ip = "3.3.3.3") =>
    app.request("/api/email", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(payload),
    });

  test("kirim email dengan link dan lampiran", async () => {
    const calls: any[] = [];
    const { upload, app } = setup({}, async (_c: unknown, mail: any) => void calls.push(mail));
    const { token } = await json(await upload(JPEG));
    const res = await post(app, { token, email: "kamu@contoh.id" });
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].to).toBe("kamu@contoh.id");
    expect(calls[0].link).toBe(`https://boothin.test/m/${token}`);
    expect(calls[0].photo).toEqual(JPEG);
  });

  test("validasi email", async () => {
    const { upload, app } = setup({}, async () => {});
    const { token } = await json(await upload(JPEG));
    const bad = ["", "x", "a@b", "a b@c.com", "a@b.c", 123, null];
    // IP berbeda tiap percobaan supaya yang diuji validasi, bukan rate limit
    for (const [i, email] of bad.entries()) {
      expect((await post(app, { token, email }, `4.4.4.${i}`)).status).toBe(400);
    }
  });

  test("session tidak ada -> 404", async () => {
    const { app } = setup({}, async () => {});
    expect((await post(app, { token: "AAAAAAAAAAAA", email: "a@b.co" })).status).toBe(404);
  });

  test("email belum dikonfigurasi -> 503", async () => {
    const { upload, app } = setup({}, async () => {
      throw new MailNotConfiguredError();
    });
    const { token } = await json(await upload(JPEG));
    expect((await post(app, { token, email: "a@b.co" })).status).toBe(503);
  });

  test("provider gagal -> 502", async () => {
    const { upload, app } = setup({}, async () => {
      throw new Error("boom");
    });
    const { token } = await json(await upload(JPEG));
    expect((await post(app, { token, email: "a@b.co" })).status).toBe(502);
  });

  test("rate limit email -> 429", async () => {
    const { upload, app } = setup({}, async () => {});
    const { token } = await json(await upload(JPEG));
    let last = 200;
    for (let i = 0; i < 7; i++) last = (await post(app, { token, email: "a@b.co" }, "5.5.5.5")).status;
    expect(last).toBe(429);
  });
});

describe("qr encoder", () => {
  test("ukuran modul sesuai versi QR", () => {
    const small = encodeQr("hi");
    expect(small.version).toBe(1);
    expect(small.size).toBe(21);
    const url = encodeQr("https://boothin.app/m/8xF92kL3mQ");
    expect(url.size).toBe(url.version * 4 + 17);
  });
});

describe("print", () => {
  test("501 sampai ada print bridge", async () => {
    const { app } = setup();
    expect((await app.request("/api/print", { method: "POST" })).status).toBe(501);
  });
});

describe("message (Contact & Feedback)", () => {
  const post = (app: any, payload: unknown, ip = "7.7.7.1") =>
    app.request("/api/message", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: typeof payload === "string" ? payload : JSON.stringify(payload),
    });

  test("contact valid dikirim ke pengirim dengan data yang sudah dibersihkan", async () => {
    const sent: any[] = [];
    const { app } = setup({}, undefined, async (_c: unknown, m: any) => void sent.push(m));
    const res = await post(app, { type: "contact", name: "  Ana \n Budi ", email: " ana@contoh.id ", message: "  Halo, boleh tanya?  " });
    expect(res.status).toBe(200);
    expect((await json(res)).ok).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual({ type: "contact", name: "Ana Budi", email: "ana@contoh.id", message: "Halo, boleh tanya?", rating: null });
  });

  test("feedback: rating wajib 1-5 (bulat), email opsional", async () => {
    const sent: any[] = [];
    const { app } = setup({}, undefined, async (_c: unknown, m: any) => void sent.push(m));
    const ok = await post(app, { type: "feedback", rating: 4, message: "Suka banget!" }, "7.7.7.2");
    expect(ok.status).toBe(200);
    expect(sent[0].rating).toBe(4);
    expect(sent[0].email).toBe("");
    const bad = [0, 6, 3.5, "5", null, undefined];
    for (const [i, rating] of bad.entries()) {
      const res = await post(app, { type: "feedback", rating, message: "oke" }, `7.7.8.${i}`);
      expect(res.status).toBe(400);
      expect((await json(res)).field).toBe("rating");
    }
    // email feedback diisi tapi salah -> ditolak
    expect((await post(app, { type: "feedback", rating: 5, email: "x", message: "oke" }, "7.7.9.1")).status).toBe(400);
  });

  test("validasi: tipe, email wajib (contact), pesan pendek/panjang, nama panjang, body rusak", async () => {
    const { app } = setup({}, undefined, async () => {});
    const cases: [unknown, string][] = [
      [{ type: "spam", message: "halo" }, "type"],
      [{ type: "contact", message: "halo" }, "email"],
      [{ type: "contact", email: "bukan-email", message: "halo" }, "email"],
      [{ type: "contact", email: "a@b.co", message: "hi" }, "message"],
      [{ type: "contact", email: "a@b.co", message: "x".repeat(2001) }, "message"],
      [{ type: "contact", email: "a@b.co", name: "n".repeat(81), message: "halo" }, "name"],
    ];
    for (const [i, [payload, field]] of cases.entries()) {
      const res = await post(app, payload, `7.8.0.${i}`);
      expect(res.status).toBe(400);
      expect((await json(res)).field).toBe(field);
    }
    expect((await post(app, "bukan json", "7.8.1.1")).status).toBe(400);
    expect((await post(app, "[1,2]", "7.8.1.2")).status).toBe(400);
  });

  test("honeypot terisi: pura-pura berhasil tapi TIDAK ada yang dikirim", async () => {
    const sent: any[] = [];
    const { app } = setup({}, undefined, async (_c: unknown, m: any) => void sent.push(m));
    const res = await post(app, { type: "contact", email: "a@b.co", message: "beli obat murah", website: "http://spam.example" }, "7.9.0.1");
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(0);
  });

  test("tanpa konfigurasi -> 503, gagal provider -> 502", async () => {
    const payload = { type: "contact", email: "a@b.co", message: "halo dunia" };
    const a = setup({}, undefined, async () => { throw new MailNotConfiguredError(); });
    expect((await post(a.app, payload, "7.9.1.1")).status).toBe(503);
    const b = setup({}, undefined, async () => { throw new OwnerNotConfiguredError(); });
    expect((await post(b.app, payload, "7.9.1.2")).status).toBe(503);
    const c = setup({}, undefined, async () => { throw new Error("boom"); });
    const res = await post(c.app, payload, "7.9.1.3");
    expect(res.status).toBe(502);
    expect(JSON.stringify(await json(res))).not.toContain("boom");
  });

  test("rate limit -> 429 (5 per 10 menit per IP)", async () => {
    const { app } = setup({}, undefined, async () => {});
    let last = 200;
    for (let i = 0; i < 6; i++) last = (await post(app, { type: "feedback", rating: 5, message: "bagus" }, "7.9.2.1")).status;
    expect(last).toBe(429);
  });

  test("body terlalu besar -> 413", async () => {
    const { app } = setup({}, undefined, async () => {});
    const res = await app.request("/api/message", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "99999", "x-forwarded-for": "7.9.3.1" },
      body: "{}",
    });
    expect(res.status).toBe(413);
  });

  test("health menunjukkan status pesan", async () => {
    const off = setup({}, undefined, async () => {});
    expect((await json(await off.app.request("/api/health"))).messages).toBe("not_configured");
    const on = setup({ RESEND_API_KEY: "re_x", OWNER_EMAIL: "owner@contoh.id" });
    expect((await json(await on.app.request("/api/health"))).messages).toBe("configured");
  });
});

describe("email ke pemilik (sendOwnerMessage)", () => {
  async function capture(msg: any, env: Record<string, string> = { RESEND_API_KEY: "re_test", OWNER_EMAIL: "owner@contoh.id" }) {
    const config = loadConfig({ APP_URL: "https://boothin.test", ...env });
    const realFetch = globalThis.fetch;
    let seen: any = null;
    globalThis.fetch = (async (url: string, init: any) => {
      seen = { url, headers: init.headers, body: JSON.parse(init.body) };
      return new Response("{}", { status: 200 });
    }) as any;
    try {
      await sendOwnerMessage(config, msg);
    } finally {
      globalThis.fetch = realFetch;
    }
    return seen;
  }

  test("tujuan = OWNER_EMAIL, reply_to = pengirim, API key di header", async () => {
    const seen = await capture({ type: "contact", name: "Ana", email: "ana@contoh.id", message: "Halo", rating: null });
    expect(seen.url).toBe("https://api.resend.com/emails");
    expect(seen.headers.Authorization).toBe("Bearer re_test");
    expect(seen.body.to).toEqual(["owner@contoh.id"]);
    expect(seen.body.reply_to).toBe("ana@contoh.id");
    expect(seen.body.subject).toBe("[boothin'] Contact: Ana");
  });

  test("HTML di-escape dan subject tidak bisa disuntik baris baru", async () => {
    const seen = await capture({
      type: "contact",
      name: "Evil\r\nBcc: korban@contoh.id",
      email: "a@b.co",
      message: "<script>alert(1)</script> <img src=x onerror=alert(2)>",
      rating: null,
    });
    expect(seen.body.html.includes("<script>")).toBe(false);
    expect(seen.body.html.includes("&lt;script&gt;")).toBe(true);
    expect(seen.body.html.includes("<img src=x")).toBe(false);
    expect(/[\r\n]/.test(seen.body.subject)).toBe(false);
  });

  test("feedback: subject berisi bintang; tanpa email -> tanpa reply_to", async () => {
    const seen = await capture({ type: "feedback", name: "", email: "", message: "Keren", rating: 4 });
    expect(seen.body.subject).toBe("[boothin'] Feedback ★★★★☆");
    expect("reply_to" in seen.body).toBe(false);
  });

  test("tanpa API key / OWNER_EMAIL melempar error yang sesuai", async () => {
    const msg = { type: "contact", name: "", email: "a@b.co", message: "halo", rating: null } as const;
    let e1: unknown, e2: unknown;
    try { await sendOwnerMessage(loadConfig({}), msg); } catch (e) { e1 = e; }
    try { await sendOwnerMessage(loadConfig({ RESEND_API_KEY: "re_x" }), msg); } catch (e) { e2 = e; }
    expect(e1 instanceof MailNotConfiguredError).toBe(true);
    expect(e2 instanceof OwnerNotConfiguredError).toBe(true);
  });

  test("OWNER_EMAIL dibaca dari env (dan dipangkas)", () => {
    expect(loadConfig({ OWNER_EMAIL: "  owner@contoh.id " }).ownerEmail).toBe("owner@contoh.id");
    expect(loadConfig({}).ownerEmail).toBe(null);
  });
});
