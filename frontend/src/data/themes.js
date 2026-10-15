/**
 * Tema frame = background + warna teks + warna "kertas" (kartu polaroid / border bentuk).
 *
 * group:
 *   solid | gradient | pattern  -> bisa dipakai semua layout kecuali film
 *   film                        -> hanya untuk layout film (warna rol + lubang sprocket)
 *
 * Menambah pattern dari gambar sendiri (PNG/JPG/SVG):
 *   1. taruh file di  frontend/public/patterns/nama.png
 *   2. tambahkan tema baru di bawah, mis.:
 *      { id: "batik", name: "Batik", group: "pattern", ink: INK, paper: PAPER, brandPill: true,
 *        bg: { type: "image", src: "/patterns/batik.png", mode: "tile", size: 220, base: "#f6efe3" } }
 *      (mode "tile" = diulang, ukuran `size` per mil lebar frame; mode "cover" = menutupi penuh)
 */

import patternPack from "./patterns.json";

const INK = "#171513";
const CREAM_INK = "#eee7dc";
const PAPER = "#fffdf8";

const solid = (id, name, color, extra = {}) => ({
  id, name, group: "solid", ink: INK, paper: PAPER, bg: { type: "solid", color, grain: 0.04 }, ...extra,
});

const gradient = (id, name, bg, extra = {}) => ({
  id, name, group: "gradient", ink: INK, paper: PAPER, bg, ...extra,
});

const pattern = (id, name, bg, extra = {}) => ({
  id, name, group: "pattern", ink: INK, paper: PAPER, brandPill: true, bg: { type: "pattern", ...bg }, ...extra,
});

const film = (id, name, band, hole, text = CREAM_INK) => ({
  id, name, group: "film", ink: text, paper: PAPER, bg: { type: "solid", color: band }, film: { band, hole },
});

export const THEMES = [
  /* ---------- polos ---------- */
  solid("cream", "Cream", "#f6efe3"),
  solid("blush", "Blush", "#f3dfe2"),
  solid("sky", "Sky", "#dbe8f3"),
  solid("mint", "Mint", "#dcebdd"),
  solid("lavender", "Lavender", "#e6dff2"),
  solid("butter", "Butter", "#f7efc9"),
  solid("peach", "Peach", "#fbd9c4"),
  solid("sage", "Sage", "#cfdcc3"),
  solid("cherry", "Cherry", "#c93a3a", { ink: CREAM_INK }),
  solid("noir", "Noir", "#171513", { ink: CREAM_INK, paper: "#f1ebe0" }),

  /* ---------- gradient ---------- */
  gradient("sunset", "Sunset", {
    type: "linear", angle: 160, stops: [[0, "#ffd9a8"], [0.5, "#ff9fae"], [1, "#b99cf2"]],
  }),
  gradient("cotton-candy", "Cotton Candy", {
    type: "linear", angle: 150, stops: [[0, "#ffd1e6"], [1, "#c9e4ff"]],
  }),
  gradient("peach-fizz", "Peach Fizz", {
    type: "linear", angle: 180, stops: [[0, "#fff1d6"], [1, "#ffb3a7"]],
  }),
  gradient("dreamy", "Dreamy", {
    type: "radial", cx: 0.3, cy: 0.25, radius: 1, stops: [[0, "#fff6fb"], [0.5, "#f1d6f2"], [1, "#c5d4f7"]],
  }),
  gradient("holo", "Holo Y2K", {
    type: "linear", angle: 135, stops: [[0, "#ffd6f6"], [0.33, "#d6e6ff"], [0.66, "#d6fff2"], [1, "#fff3d6"]],
  }),
  gradient("ocean", "Ocean", {
    type: "linear", angle: 170, stops: [[0, "#cfeaf7"], [1, "#7fb5de"]],
  }),
  gradient("aurora", "Aurora", {
    type: "linear", angle: 160, stops: [[0, "#14213d"], [0.55, "#1f6f78"], [1, "#6b4fa1"]],
  }, { ink: CREAM_INK }),
  gradient("matcha-latte", "Matcha Latte", {
    type: "linear", angle: 170, stops: [[0, "#f3f0dc"], [1, "#b9d4a6"]],
  }),

  /* ---------- pattern ---------- */
  pattern("polka-pink", "Polka Pink", { pattern: "dots", base: "#f7d3da", color: "#ffffff", cell: 52 }),
  pattern("polka-cream", "Polka Cherry", { pattern: "dots", base: "#f6efe3", color: "#e8527a", cell: 52 }),
  pattern("gingham-red", "Gingham Red", { pattern: "gingham", base: "#fff7f0", color: "#e0463d", cell: 28 }),
  pattern("gingham-blue", "Gingham Blue", { pattern: "gingham", base: "#f4f8fc", color: "#4a7fd1", cell: 28 }),
  pattern("stripes-navy", "Navy Stripes", { pattern: "stripes", base: "#f6efe3", color: "#1f2f5c", cell: 34 }),
  pattern("stripes-candy", "Candy Stripes", { pattern: "stripes", base: "#ffffff", color: "#f5a3b8", cell: 34 }),
  pattern("diagonal-mint", "Mint Diagonal", { pattern: "diagonal", base: "#e4f3e8", color: "#bfe3cb", cell: 34 }),
  pattern("checker-bw", "Checker B&W", { pattern: "checker", base: "#f4f1ea", color: "#171513", cell: 60 }),
  pattern("checker-pink", "Checker Pink", { pattern: "checker", base: "#fde7ec", color: "#f7b6c7", cell: 60 }),
  pattern("grid-paper", "Grid Paper", { pattern: "grid", base: "#f9f6ee", color: "#b9d2e8", cell: 40 }),
  pattern("hearts-pink", "Hearts Pink", { pattern: "hearts", base: "#fbe3e8", color: "#f19ab0", cell: 62 }),
  pattern("hearts-red", "Hearts Red", { pattern: "hearts", base: "#fff4ea", color: "#e0463d", cell: 62 }),
  pattern("stars-night", "Starry Night", { pattern: "stars", base: "#16213e", color: "#ffd86b", cell: 70 }, { ink: CREAM_INK }),
  pattern("stars-butter", "Stars Butter", { pattern: "stars", base: "#fbf1c7", color: "#f2b632", cell: 70 }),
  pattern("daisy", "Daisy", { pattern: "flowers", base: "#bfe3f2", color: "#ffffff", color2: "#f2b632", cell: 80 }),
  pattern("confetti", "Confetti", {
    pattern: "confetti", base: "#fffaf0", cell: 60,
    colors: ["#f06a8d", "#6bb7f2", "#ffd24d", "#7ed6a8", "#b08cf0"],
  }),
  pattern("waves-blue", "Waves", { pattern: "waves", base: "#d9ebf7", color: "#7fb5de", cell: 90 }),
  pattern("sparkle-black", "Sparkle Night", { pattern: "sparkles", base: "#171513", color: "#f5f0e6", cell: 80 }, { ink: CREAM_INK }),
  pattern("scallop-pink", "Scallop Pink", { pattern: "scallop", base: "#fde7ec", color: "#f3a6bb", cell: 70 }),

  /* ---------- film (khusus layout film) ---------- */
  film("film-black", "Classic Black", "#171513", "#eee7dc"),
  film("film-sepia", "Sepia", "#2b1f17", "#d8c3a5"),
  film("film-blue", "Midnight Blue", "#12263a", "#cfe3f5"),
  film("film-rose", "Rose Noir", "#3b1a2a", "#f5cfdc"),
];

/**
 * Pattern dari gambar (public/patterns/*, daftar di data/patterns.json).
 * Gambar potret biasa (bukan ubin seamless) dipasang dengan pengulangan cermin; lihat engine/backgrounds.js.
 */
export const IMPORTED_THEMES = patternPack.map((p) => ({
  id: `img-${p.id}`,
  name: p.name,
  group: "imported",
  tag: p.tag,
  thumb: p.thumb ? `/patterns/${p.thumb}` : null,
  ink: p.dark ? CREAM_INK : INK,
  paper: PAPER,
  brandPill: true,
  bg: { type: "image", src: `/patterns/${p.file}`, mode: "mirror", fit: p.fit, base: p.base },
}));

export const PATTERN_TAGS = ["cute", "christmas", "halloween", "stars", "bold", "classic"];

const byId = new Map([...THEMES, ...IMPORTED_THEMES].map((theme) => [theme.id, theme]));

/* ---------- warna kustom (color picker) ---------- */

const HEX = /^[0-9a-f]{6}$/i;
const luminance = (hex) => {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Id tema kustom: "custom:rrggbb" (warna polos) atau "custom:rrggbb:rrggbb" (gradient 2 warna). */
export function customThemeId(color, color2) {
  const a = String(color).replace("#", "").toLowerCase();
  const b = color2 ? String(color2).replace("#", "").toLowerCase() : "";
  return b ? `custom:${a}:${b}` : `custom:${a}`;
}

export const isCustomThemeId = (id) => typeof id === "string" && /^custom:[0-9a-f]{6}(:[0-9a-f]{6})?$/i.test(id);

const customCache = new Map();

function buildCustomTheme(id) {
  const [, a, b] = id.split(":");
  const lum = b ? (luminance(a) + luminance(b)) / 2 : luminance(a);
  const light = lum > 0.55;
  return {
    id,
    name: b ? "Custom gradient" : "Custom color",
    group: "custom",
    ink: light ? INK : CREAM_INK,
    paper: PAPER,
    bg: b
      ? { type: "linear", angle: 160, stops: [[0, `#${a}`], [1, `#${b}`]] }
      : { type: "solid", color: `#${a}` },
    // Dipakai layout film: warna rol = warna pilihan, lubang kontras terhadapnya.
    film: { band: `#${a}`, hole: light ? "#171513" : "#eee7dc" },
  };
}

export const THEME_GROUPS = [
  { id: "solid", label: "Solid" },
  { id: "gradient", label: "Gradient" },
  { id: "pattern", label: "Pattern" },
  { id: "film", label: "Film" },
];

export function getTheme(id) {
  if (isCustomThemeId(id)) {
    if (!customCache.has(id)) customCache.set(id, buildCustomTheme(id.toLowerCase()));
    return customCache.get(id);
  }
  return byId.get(id) ?? byId.get("cream");
}

/** Tema bawaan yang cocok untuk sebuah layout (film hanya untuk film, dan sebaliknya). */
export function themesFor(layout) {
  const wantsFilm = layout?.themeSet === "film";
  return THEMES.filter((theme) => (theme.group === "film") === wantsFilm);
}

/** Pattern gambar boleh dipakai semua layout kecuali film. */
export function importedFor(layout) {
  return layout?.themeSet === "film" ? [] : IMPORTED_THEMES;
}

/** Pastikan id tema cocok dengan layout; kalau tidak, pakai default layout. */
export function resolveThemeId(layout, themeId) {
  if (isCustomThemeId(themeId)) return themeId.toLowerCase();
  const allowed = [...themesFor(layout), ...importedFor(layout)];
  if (themeId && allowed.some((theme) => theme.id === themeId)) return themeId;
  return layout?.defaultTheme ?? allowed[0].id;
}

export { HEX as HEX_PATTERN };
