import { randomBytes } from "node:crypto";
import type { Config } from "../config.ts";
import type { Storage } from "./storage.ts";

export interface Session {
  token: string;
  contentType: string;
  size: number;
  createdAt: number;
  expiresAt: number;
}

export class SessionFullError extends Error {}

export class SessionService {
  private sessions = new Map<string, Session>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private config: Config, private storage: Storage) {}

  /** Jalankan pembersihan berkala. unref() supaya tidak menahan proses (dan test) tetap hidup. */
  startCleanup(intervalMs = 60_000) {
    if (this.timer) return;
    this.timer = setInterval(() => void this.cleanup(), intervalMs);
    this.timer.unref?.();
  }

  stopCleanup() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async create(bytes: Uint8Array, contentType: string): Promise<Session> {
    if (this.sessions.size >= this.config.maxSessions) {
      await this.cleanup();
      if (this.sessions.size >= this.config.maxSessions) throw new SessionFullError();
    }

    const token = randomBytes(9).toString("base64url"); // 12 karakter, tidak bisa ditebak
    const now = Date.now();

    await this.storage.put(token, bytes, contentType);

    const session: Session = {
      token,
      contentType,
      size: bytes.byteLength,
      createdAt: now,
      expiresAt: now + this.config.sessionTtlMs,
    };

    this.sessions.set(token, session);
    return session;
  }

  /** Mengembalikan null untuk token yang tidak ada ATAU sudah kedaluwarsa. */
  async get(token: string): Promise<Session | null> {
    const session = this.sessions.get(token);
    if (!session) return null;

    if (session.expiresAt <= Date.now()) {
      await this.remove(token);
      return null;
    }

    return session;
  }

  async readPhoto(token: string): Promise<{ session: Session; bytes: Uint8Array } | null> {
    const session = await this.get(token);
    if (!session) return null;

    const bytes = await this.storage.get(token);
    if (!bytes) return null;

    return { session, bytes };
  }

  async remove(token: string): Promise<void> {
    this.sessions.delete(token);
    await this.storage.delete(token).catch(() => {});
  }

  async cleanup(): Promise<number> {
    const now = Date.now();
    let removed = 0;

    for (const [token, session] of this.sessions) {
      if (session.expiresAt <= now) {
        await this.remove(token);
        removed += 1;
      }
    }

    return removed;
  }

  get count() {
    return this.sessions.size;
  }
}
