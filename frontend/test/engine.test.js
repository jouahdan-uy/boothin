import { existsSync } from "node:fs";
import { describe, expect, test } from "bun:test";

import patternPack from "../src/data/patterns.json";
import {
  IMPORTED_THEMES,
  PATTERN_TAGS,
  THEMES,
  customThemeId,
  getTheme,
  importedFor,
  isCustomThemeId,
  resolveThemeId,
  themesFor,
} from "../src/data/themes.js";
import { frames } from "../src/data/frames.js";
import { coverCrop } from "../src/engine/compositor.js";
import { FILTERS, FILTER_GROUPS } from "../src/engine/filters.js";
import { LAYOUTS, getGeometry } from "../src/engine/layouts.js";
import { SHAPE_NAMES, shapePath } from "../src/engine/shapes.js";

/** Kotak pembatas sebuah rect yang diputar `rot` derajat di sekitar pusatnya. */
function bounds(r, rot = 0) {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const t = (rot * Math.PI) / 180;
  const pts = [[-r.w / 2, -r.h / 2], [r.w / 2, -r.h / 2], [r.w / 2, r.h / 2], [-r.w / 2, r.h / 2]].map(([x, y]) => [
    cx + x * Math.cos(t) - y * Math.sin(t),
    cy + x * Math.sin(t) + y * Math.cos(t),
  ]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
}

const overlapArea = (a, b) =>
  Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y, b.y));

describe("layouts", () => {
  test("id unik dan daftar frame cocok dengan layout", () => {
    const ids = LAYOUTS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(frames.length).toBe(LAYOUTS.length);
    expect(frames.map((f) => f.slots)).toEqual(LAYOUTS.map((l) => l.slots));
  });

  for (const layout of LAYOUTS) {
   for (const inset of [0, 70, 140]) {
    test(`${layout.id} (border ${inset}): slot di dalam kanvas, tidak bertumpuk, brand tidak menabrak`, () => {
      const g = getGeometry({ id: layout.id, inset });
      expect(g.slots.length).toBe(layout.slots);
      expect(g.width * g.height).toBeLessThan(8e6); // batas aman memori canvas di HP

      const boxes = g.slots.map((s) => ({ s, b: bounds(s.group, s.rot) }));

      boxes.forEach(({ s, b }) => {
        const pad = s.border || 0;
        expect(b.x - pad).toBeGreaterThanOrEqual(0);
        expect(b.y - pad).toBeGreaterThanOrEqual(0);
        expect(b.x2 + pad).toBeLessThanOrEqual(g.width);
        expect(b.y2 + pad).toBeLessThanOrEqual(g.height);
        expect(s.w).toBeGreaterThan(150);
        expect(s.h).toBeGreaterThan(150);
      });

      if (!layout.overlap) {
        for (let i = 0; i < boxes.length; i += 1) {
          for (let j = i + 1; j < boxes.length; j += 1) {
            expect(overlapArea(boxes[i].b, boxes[j].b)).toBeLessThan(2);
          }
        }
      }

      // kotak teks brand (~4.3em lebar) tidak boleh menimpa foto
      const br = g.brand;
      const tw = br.size * 4.3;
      const th = br.size * (br.pill ? 1.8 : 1.1);
      const box = br.rot
        ? { x: br.x - th / 2, y: br.y - tw / 2, x2: br.x + th / 2, y2: br.y + tw / 2 }
        : { x: br.x - tw / 2, y: br.y - th / 2, x2: br.x + tw / 2, y2: br.y + th / 2 };
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x2).toBeLessThanOrEqual(g.width);
      expect(box.y2).toBeLessThanOrEqual(g.height);
      boxes.forEach(({ b }) => expect(overlapArea(box, b)).toBeLessThan(2));
    });
   }
  }

  test("border lebih tebal memperbesar margin; film mengabaikannya", () => {
    const thin = getGeometry({ id: "classic-strip-3", inset: 0 });
    const wide = getGeometry({ id: "classic-strip-3", inset: 140 });
    expect(wide.slots[0].x).toBeGreaterThan(thin.slots[0].x);
    expect(wide.slots[0].w).toBeLessThan(thin.slots[0].w);
    expect(wide.brand).toEqual(thin.brand);
    expect(getGeometry({ id: "film-roll", inset: 140 }).inset).toBe(0);
  });

  test("kategori punya isi", () => {
    for (const c of ["strip", "wide", "grid", "polaroid", "film", "creative"]) {
      expect(frames.some((f) => f.category === c)).toBe(true);
    }
  });
});

describe("tema", () => {
  test("id unik, setiap layout punya tema bawaan yang cocok", () => {
    const ids = THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const layout of LAYOUTS) {
      expect(resolveThemeId(layout, layout.defaultTheme)).toBe(layout.defaultTheme);
    }
  });

  test("layout film hanya menerima tema film, dan sebaliknya", () => {
    const film = LAYOUTS.find((l) => l.themeSet === "film");
    const normal = LAYOUTS.find((l) => l.themeSet !== "film");
    expect(themesFor(film).every((t) => t.group === "film")).toBe(true);
    expect(themesFor(normal).some((t) => t.group === "film")).toBe(false);
    expect(resolveThemeId(film, "cream")).toBe(film.defaultTheme);
    expect(resolveThemeId(normal, "film-black")).toBe(normal.defaultTheme);
  });

  test("tema tak dikenal jatuh ke cream", () => {
    expect(getTheme("tidak-ada").id).toBe("cream");
  });

  test("teks di atas pill selalu gelap (terbaca di tema gelap)", () => {
    const g = getGeometry({ id: "star-1", themeId: "stars-night" });
    expect(g.brand.pill).toBe(true);
    expect(g.brand.color).toBe("#171513");
  });
});

describe("bentuk", () => {
  test("semua bentuk menghasilkan path valid (kecuali rect)", () => {
    for (const name of SHAPE_NAMES) {
      const d = shapePath(name, 800, 700, 40);
      if (name === "rect") expect(d).toBe(null);
      else {
        expect(typeof d).toBe("string");
        expect(d.startsWith("M")).toBe(true);
        expect(/NaN|undefined|Infinity/.test(d)).toBe(false);
      }
    }
  });

  test("bentuk tak dikenal melempar error", () => {
    expect(() => shapePath("kotak-ajaib", 10, 10)).toThrow();
  });
});

describe("filter", () => {
  test("id unik dan setiap filter punya kelompok yang terdaftar", () => {
    expect(new Set(FILTERS.map((f) => f.id)).size).toBe(FILTERS.length);
    const groups = FILTER_GROUPS.map((g) => g.id);
    FILTERS.forEach((f) => expect(groups.includes(f.group)).toBe(true));
    groups.forEach((g) => expect(FILTERS.some((f) => f.group === g)).toBe(true));
  });
});

describe("coverCrop", () => {
  test("crop tengah, rasio sama dengan kotak tujuan", () => {
    const wide = coverCrop(1600, 900, 1, 1);
    expect(wide.sh).toBe(900);
    expect(wide.sw).toBe(900);
    expect(wide.sx).toBe(350);
    const tall = coverCrop(900, 1600, 2, 1);
    expect(tall.sw).toBe(900);
    expect(tall.sh).toBe(450);
    expect(tall.sy).toBe(575);
  });
});

describe("tema kustom (color picker)", () => {
  test("id dibentuk dan dikenali; input liar ditolak", () => {
    expect(customThemeId("#FF6B8B")).toBe("custom:ff6b8b");
    expect(customThemeId("#ffffff", "#000000")).toBe("custom:ffffff:000000");
    expect(isCustomThemeId("custom:ff6b8b")).toBe(true);
    for (const bad of ["custom:zzzzzz", "custom:fff", "custom:ff6b8b:12", "cream", "", null, undefined]) {
      expect(isCustomThemeId(bad)).toBe(false);
    }
  });

  test("teks kontras: warna terang -> teks gelap, warna gelap -> teks terang", () => {
    expect(getTheme("custom:ffffff").ink).toBe("#171513");
    expect(getTheme("custom:101010").ink).toBe("#eee7dc");
    expect(getTheme("custom:ff6b8b").bg).toEqual({ type: "solid", color: "#ff6b8b" });
    expect(getTheme("custom:ff0000:0000ff").bg.type).toBe("linear");
  });

  test("berlaku untuk semua layout, termasuk film (warna rol)", () => {
    const film = LAYOUTS.find((l) => l.themeSet === "film");
    expect(resolveThemeId(film, "custom:336699")).toBe("custom:336699");
    const g = getGeometry({ id: film.id, themeId: "custom:336699" });
    expect(g.decor.find((d) => d.w === g.width).color).toBe("#336699");
    const normal = LAYOUTS.find((l) => l.themeSet !== "film");
    expect(getGeometry({ id: normal.id, themeId: "custom:ff6b8b" }).bg.color).toBe("#ff6b8b");
  });
});

describe("pattern dari gambar", () => {
  test("setiap entri manifest punya file penuh + thumbnail, id unik, tag valid", () => {
    expect(patternPack.length).toBe(29);
    expect(new Set(patternPack.map((p) => p.id)).size).toBe(patternPack.length);
    for (const p of patternPack) {
      expect(existsSync(new URL(`../public/patterns/${p.file}`, import.meta.url))).toBe(true);
      expect(existsSync(new URL(`../public/patterns/${p.thumb}`, import.meta.url))).toBe(true);
      expect(PATTERN_TAGS.includes(p.tag)).toBe(true);
      expect(p.fit).toBeGreaterThan(0);
      expect(p.fit).toBeLessThan(1.01);
    }
  });

  test("tema impor: tidak berlaku untuk film, berlaku untuk lainnya", () => {
    expect(IMPORTED_THEMES.length).toBe(patternPack.length);
    const film = LAYOUTS.find((l) => l.themeSet === "film");
    const normal = LAYOUTS.find((l) => l.themeSet !== "film");
    expect(importedFor(film).length).toBe(0);
    expect(importedFor(normal).length).toBe(patternPack.length);
    expect(resolveThemeId(normal, "img-red-bows")).toBe("img-red-bows");
    expect(resolveThemeId(film, "img-red-bows")).toBe(film.defaultTheme);
  });

  test("pattern selalu memakai pill agar tulisan brand terbaca", () => {
    for (const t of IMPORTED_THEMES) {
      expect(t.brandPill).toBe(true);
      expect(t.bg.mode).toBe("mirror");
    }
    expect(getGeometry({ id: "heart-2", themeId: "img-starry-navy" }).brand.color).toBe("#171513");
  });
});
