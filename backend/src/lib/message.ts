import { isValidEmail } from "./image.ts";

export const MAX_MESSAGE = 2000;
export const MIN_MESSAGE = 3;
export const MAX_NAME = 80;

export interface OwnerMessage {
  type: "contact" | "feedback";
  name: string;
  email: string;
  message: string;
  rating: number | null;
}

export type Validation =
  | { ok: true; value: OwnerMessage }
  | { ok: false; field: "type" | "name" | "email" | "message" | "rating"; message: string };

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u2028\u2029]/g;

/** Satu baris saja: dipakai untuk subject/nama agar tidak bisa menyuntik header email. */
export function singleLine(value: string): string {
  return value.replace(/[\r\n\u0000-\u001f\u007f\u2028\u2029]+/g, " ").replace(/\s+/g, " ").trim();
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Validasi body form Contact / Feedback. Aturan yang sama dicerminkan di frontend. */
export function validateMessage(body: Record<string, unknown>): Validation {
  const type = body.type;
  if (type !== "contact" && type !== "feedback") {
    return { ok: false, field: "type", message: "Jenis pesan tidak valid." };
  }

  const rawName = typeof body.name === "string" ? body.name : "";
  const name = singleLine(rawName);
  if (name.length > MAX_NAME) {
    return { ok: false, field: "name", message: `Nama maksimal ${MAX_NAME} karakter.` };
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (type === "contact" && !email) {
    return { ok: false, field: "email", message: "Email wajib diisi supaya pesanmu bisa dibalas." };
  }
  if (email && !isValidEmail(email)) {
    return { ok: false, field: "email", message: "Alamat email tidak valid." };
  }

  const message = (typeof body.message === "string" ? body.message : "").replace(CONTROL, "").trim();
  if (message.length < MIN_MESSAGE) {
    return { ok: false, field: "message", message: "Pesan terlalu pendek." };
  }
  if (message.length > MAX_MESSAGE) {
    return { ok: false, field: "message", message: `Pesan maksimal ${MAX_MESSAGE} karakter.` };
  }

  let rating: number | null = null;
  if (type === "feedback") {
    const r = body.rating;
    if (typeof r !== "number" || !Number.isInteger(r) || r < 1 || r > 5) {
      return { ok: false, field: "rating", message: "Pilih rating 1 sampai 5 bintang." };
    }
    rating = r;
  }

  return { ok: true, value: { type, name, email, message, rating } };
}
