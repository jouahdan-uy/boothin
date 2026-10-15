export type ImageKind = { contentType: "image/jpeg" | "image/png"; ext: "jpg" | "png" };

/** Deteksi tipe dari magic bytes. Header Content-Type dari client tidak dipercaya. */
export function detectImage(bytes: Uint8Array): ImageKind | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: "image/jpeg", ext: "jpg" };
  }

  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length > 8 && png.every((value, index) => bytes[index] === value)) {
    return { contentType: "image/png", ext: "png" };
  }

  return null;
}

export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,32}$/;

const EMAIL_PATTERN = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

export function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && EMAIL_PATTERN.test(value);
}
