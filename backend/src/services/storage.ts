import { createHash } from "node:crypto";
import type { Config } from "../config.js";

/**
 * Storage hanya menyimpan byte foto. Metadata session (token, expiry)
 * disimpan di services/sessions.ts. Foto tidak pernah ditulis ke filesystem.
 */
export interface Storage {
  readonly name: "memory" | "cloudinary";
  put(token: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(token: string): Promise<Uint8Array | null>;
  delete(token: string): Promise<void>;
}

/** Dev / single-instance. Hilang saat server restart, itu memang tujuannya. */
export class MemoryStorage implements Storage {
  readonly name = "memory" as const;
  private files = new Map<string, Uint8Array>();

  async put(token: string, bytes: Uint8Array): Promise<void> {
    this.files.set(token, bytes);
  }

  async get(token: string): Promise<Uint8Array | null> {
    return this.files.get(token) ?? null;
  }

  async delete(token: string): Promise<void> {
    this.files.delete(token);
  }
}

type CloudinaryConfig = NonNullable<Config["cloudinary"]>;

/**
 * Cloudinary lewat REST API (signed upload), tanpa SDK supaya tidak
 * menambah dependency.
 */
export class CloudinaryStorage implements Storage {
  readonly name = "cloudinary" as const;
  private urls = new Map<string, string>();

  constructor(private cfg: CloudinaryConfig) {}

  private sign(params: Record<string, string>): string {
    const toSign = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join("&");
    return createHash("sha1").update(toSign + this.cfg.apiSecret).digest("hex");
  }

  private publicId(token: string) {
    return `boothin/${token}`;
  }

  async put(token: string, bytes: Uint8Array, contentType: string): Promise<void> {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signed = { public_id: this.publicId(token), timestamp, tags: "boothin-temp" };

    const form = new FormData();
    form.set("file", new Blob([bytes.slice()], { type: contentType }), `${token}.jpg`);
    form.set("api_key", this.cfg.apiKey);
    form.set("signature", this.sign(signed));
    for (const [key, value] of Object.entries(signed)) form.set(key, value);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.cfg.cloudName}/image/upload`,
      { method: "POST", body: form }
    );

    if (!response.ok) {
      throw new Error(`Cloudinary upload gagal (${response.status})`);
    }

    const data = (await response.json()) as { secure_url?: string };
    if (!data.secure_url) throw new Error("Cloudinary tidak mengembalikan secure_url");
    this.urls.set(token, data.secure_url);
  }

  async get(token: string): Promise<Uint8Array | null> {
    const url = this.urls.get(token);
    if (!url) return null;
    const response = await fetch(url);
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  }

  async delete(token: string): Promise<void> {
    this.urls.delete(token);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signed = { public_id: this.publicId(token), timestamp };

    const form = new FormData();
    form.set("api_key", this.cfg.apiKey);
    form.set("signature", this.sign(signed));
    for (const [key, value] of Object.entries(signed)) form.set(key, value);

    await fetch(`https://api.cloudinary.com/v1_1/${this.cfg.cloudName}/image/destroy`, {
      method: "POST",
      body: form,
    }).catch(() => {});
  }
}

export function createStorage(config: Config): Storage {
  return config.storageDriver === "cloudinary" && config.cloudinary
    ? new CloudinaryStorage(config.cloudinary)
    : new MemoryStorage();
}
