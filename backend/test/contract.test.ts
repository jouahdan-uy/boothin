import { existsSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import { validateMessage } from "../src/lib/message.ts";

/**
 * Kontrak: aturan validasi form di frontend harus sama dengan backend.
 * Dilewati otomatis kalau folder frontend tidak ada (mis. backend di-deploy sendirian).
 */
const frontendRules = new URL("../../frontend/src/lib/messageRules.js", import.meta.url);

describe("validasi frontend == backend", () => {
  if (!existsSync(frontendRules)) {
    test("frontend tidak ada, dilewati", () => expect(true).toBe(true));
    return;
  }

  const cases: Record<string, unknown>[] = [
    { type: "contact", name: "Ana", email: "ana@contoh.id", message: "Halo!" },
    { type: "contact", message: "halo" },
    { type: "contact", email: "bukan", message: "halo" },
    { type: "contact", email: "a@b.co", message: "hi" },
    { type: "contact", email: "a@b.co", message: "   " },
    { type: "contact", email: "a@b.co", message: "x".repeat(2000) },
    { type: "contact", email: "a@b.co", message: "x".repeat(2001) },
    { type: "contact", email: "a@b.co", name: "n".repeat(80), message: "halo" },
    { type: "contact", email: "a@b.co", name: "n".repeat(81), message: "halo" },
    { type: "feedback", rating: 5, message: "oke" },
    { type: "feedback", rating: 0, message: "oke" },
    { type: "feedback", rating: 6, message: "oke" },
    { type: "feedback", rating: 2.5, message: "oke" },
    { type: "feedback", message: "oke" },
    { type: "feedback", rating: 3, email: "salah", message: "oke" },
    { type: "feedback", rating: 3, email: "ok@contoh.id", message: "oke" },
    { type: "feedback", rating: 3, email: "  ok@contoh.id  ", message: "  oke  " },
  ];

  test("hasil sama untuk semua kasus (lolos/tidak dan field yang salah)", async () => {
    const { validateMessageForm } = await import(frontendRules.href);
    for (const input of cases) {
      const back = validateMessage(input);
      const front = validateMessageForm(input.type as string, input);
      expect(front.ok).toBe(back.ok);
      if (!back.ok) expect(Object.keys(front.errors).includes(back.field)).toBe(true);
    }
  });
});
