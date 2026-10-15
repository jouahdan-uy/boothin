import { describe, expect, test } from "bun:test";

import { MAX_MESSAGE, MAX_NAME, isValidEmail, validateMessageForm } from "../src/lib/messageRules.js";

describe("validateMessageForm", () => {
  test("contact valid", () => {
    const r = validateMessageForm("contact", { name: "Ana", email: "ana@contoh.id", message: "Halo!" });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual({});
  });

  test("contact: email wajib dan harus valid", () => {
    expect(validateMessageForm("contact", { message: "halo" }).errors.email).toBeTruthy();
    expect(validateMessageForm("contact", { email: "bukan", message: "halo" }).errors.email).toBeTruthy();
    expect(validateMessageForm("contact", { email: "a@b", message: "halo" }).errors.email).toBeTruthy();
  });

  test("feedback: email opsional tapi kalau diisi harus valid; rating wajib bulat 1-5", () => {
    expect(validateMessageForm("feedback", { rating: 5, message: "oke" }).ok).toBe(true);
    expect(validateMessageForm("feedback", { rating: 5, email: "x", message: "oke" }).errors.email).toBeTruthy();
    for (const rating of [0, 6, 2.5, undefined, "4"]) {
      expect(validateMessageForm("feedback", { rating, message: "oke" }).errors.rating).toBeTruthy();
    }
  });

  test("batas panjang pesan dan nama", () => {
    expect(validateMessageForm("feedback", { rating: 3, message: "hi" }).errors.message).toBeTruthy();
    expect(validateMessageForm("feedback", { rating: 3, message: "x".repeat(MAX_MESSAGE) }).ok).toBe(true);
    expect(validateMessageForm("feedback", { rating: 3, message: "x".repeat(MAX_MESSAGE + 1) }).errors.message).toBeTruthy();
    expect(validateMessageForm("feedback", { rating: 3, name: "n".repeat(MAX_NAME + 1), message: "oke" }).errors.name).toBeTruthy();
  });

  test("spasi di pinggir diabaikan", () => {
    expect(validateMessageForm("contact", { email: "  ana@contoh.id ", message: "   hai   " }).ok).toBe(true);
    expect(validateMessageForm("contact", { email: "ana@contoh.id", message: "     " }).errors.message).toBeTruthy();
  });

  test("isValidEmail menolak input aneh", () => {
    for (const bad of ["", "a", "a@b", "a b@c.com", "a@b.c", "a@@b.com", "<x>@b.com", null, 5]) {
      expect(isValidEmail(bad)).toBe(false);
    }
    expect(isValidEmail("ana@contoh.id")).toBe(true);
  });
});
