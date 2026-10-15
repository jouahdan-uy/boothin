/**
 * Aturan form Contact / Feedback. Dicerminkan dari backend (backend/src/lib/message.ts):
 * validasi di sini hanya untuk UX, yang menentukan tetap server.
 */
export const MAX_MESSAGE = 2000;
export const MIN_MESSAGE = 3;
export const MAX_NAME = 80;

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

export const isValidEmail = (value) => typeof value === "string" && value.length <= 254 && EMAIL.test(value);

/**
 * @param {"contact"|"feedback"} type
 * @param {{name?: string, email?: string, message?: string, rating?: number}} values
 * @returns {{ ok: boolean, errors: Record<string, string> }}
 */
export function validateMessageForm(type, values) {
  const errors = {};
  const name = (values.name ?? "").trim();
  const email = (values.email ?? "").trim();
  const message = (values.message ?? "").trim();

  if (name.length > MAX_NAME) errors.name = `Nama maksimal ${MAX_NAME} karakter.`;

  if (type === "contact" && !email) errors.email = "Email wajib diisi supaya pesanmu bisa dibalas.";
  else if (email && !isValidEmail(email)) errors.email = "Alamat email tidak valid.";

  if (message.length < MIN_MESSAGE) errors.message = "Pesan terlalu pendek.";
  else if (message.length > MAX_MESSAGE) errors.message = `Pesan maksimal ${MAX_MESSAGE} karakter.`;

  if (type === "feedback" && !(Number.isInteger(values.rating) && values.rating >= 1 && values.rating <= 5)) {
    errors.rating = "Pilih rating 1 sampai 5 bintang.";
  }

  return { ok: Object.keys(errors).length === 0, errors };
}
