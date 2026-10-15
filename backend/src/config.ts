/**
 * Semua konfigurasi dibaca dari environment variable di satu tempat,
 * supaya route/service tidak perlu tahu soal process.env.
 */

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

export interface Config {
  port: number;
  /** URL frontend publik. Dipakai untuk link QR/email: `${appUrl}/m/<token>` */
  appUrl: string;
  corsOrigins: string[];
  sessionTtlMs: number;
  maxUploadBytes: number;
  maxSessions: number;
  storageDriver: "memory" | "cloudinary";
  cloudinary: { cloudName: string; apiKey: string; apiSecret: string } | null;
  resendApiKey: string | null;
  mailFrom: string;
  /** Tujuan pesan dari form Contact / Feedback. Kosong = form membalas "belum diaktifkan". */
  ownerEmail: string | null;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const appUrl = (env.APP_URL ?? "http://localhost:5173").replace(/\/+$/, "");

  const cloudinary =
    env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
      ? {
          cloudName: env.CLOUDINARY_CLOUD_NAME,
          apiKey: env.CLOUDINARY_API_KEY,
          apiSecret: env.CLOUDINARY_API_SECRET,
        }
      : null;

  const wantsCloudinary = env.STORAGE_DRIVER
    ? env.STORAGE_DRIVER === "cloudinary"
    : cloudinary !== null;

  if (wantsCloudinary && !cloudinary) {
    throw new Error(
      "STORAGE_DRIVER=cloudinary tapi CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET belum diisi."
    );
  }

  return {
    port: num(env.PORT, 3000),
    appUrl,
    corsOrigins: [...new Set([appUrl, ...list(env.CORS_ORIGINS)])],
    sessionTtlMs: num(env.SESSION_TTL_MINUTES, 360) * 60_000,
    maxUploadBytes: num(env.MAX_UPLOAD_MB, 8) * 1024 * 1024,
    maxSessions: num(env.MAX_SESSIONS, 500),
    storageDriver: wantsCloudinary ? "cloudinary" : "memory",
    cloudinary,
    resendApiKey: env.RESEND_API_KEY || null,
    mailFrom: env.MAIL_FROM || "Boothin' <onboarding@resend.dev>",
    ownerEmail: env.OWNER_EMAIL?.trim() || null,
  };
}
