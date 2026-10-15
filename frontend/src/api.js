/**
 * Client untuk backend Boothin' (Hono). Set VITE_API_URL di .env untuk produksi.
 * Foto tidak pernah dikirim saat user mengedit — hanya sekali setelah foto final jadi.
 */
export const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(message, { status = 0, code = "unknown" } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request(path, options) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, options);
  } catch {
    throw new ApiError("Server tidak bisa dihubungi. Cek koneksi internet kamu.", { code: "network" });
  }

  if (!response.ok) {
    let body = null;
    try {
      body = await response.json();
    } catch {
      /* body bukan JSON */
    }
    throw new ApiError(body?.message ?? `Permintaan gagal (${response.status}).`, {
      status: response.status,
      code: body?.error ?? "http",
    });
  }
  return response;
}

/** Upload foto final (Blob JPEG) -> session sementara. */
export async function createSession(blob) {
  const res = await request("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": blob.type || "image/jpeg" },
    body: blob,
  });
  return res.json();
}

export async function getSession(token) {
  const res = await request(`/api/sessions/${encodeURIComponent(token)}`);
  return res.json();
}

/** QR berisi URL share (bukan fotonya). Return { url, svg, expiresAt }. */
export async function createQr(token) {
  const res = await request("/api/qr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  return res.json();
}

export async function sendEmail(token, email) {
  const res = await request("/api/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, email }),
  });
  return res.json();
}

/** URL foto sementara (untuk <img> / link download di halaman /m/:token). */
export function photoUrl(token, { download = false } = {}) {
  return `${API_URL}/api/photos/${encodeURIComponent(token)}${download ? "?download=1" : ""}`;
}

/**
 * Kirim pesan Contact / Feedback ke pemilik (lewat backend, bukan mailto:, supaya email pemilik
 * tidak terpampang). `website` adalah kolom jebakan bot dan harus selalu kosong untuk manusia.
 */
export async function sendMessage({ type, name, email, message, rating, website = "" }) {
  const res = await request("/api/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, name, email, message, rating, website }),
  });
  return res.json();
}
