/**
 * Satu-satunya sumber kebenaran untuk geometri frame.
 *
 * Pilihan frame, Review, Editor, dan export JPG memakai angka dari sini, jadi apa yang
 * dilihat user = apa yang diekspor. Semua satuan = piksel kanvas export.
 *
 * Sebuah layout = ukuran kanvas + daftar slot (+ dekorasi). Warna datang dari TEMA
 * (data/themes.js); layout hanya memakai token "$paper" / "$ink" / "$band" / "$hole".
 */

import { getTheme, resolveThemeId } from "../data/themes.js";

const M = 80; // margin luar
const G = 44; // jarak antar foto

/* ---------- helper ---------- */

const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
const ratioLabel = (w, h) => `${w / gcd(w, h)}:${h / gcd(w, h)}`;

const slot = (x, y, w, h, extra = {}) => ({
  x, y, w, h, shape: "rect", r: 0, rot: 0, card: null, border: 0, ...extra,
});

function rowSlots(n, { x, y, w, h, gap }, extra) {
  const sw = (w - gap * (n - 1)) / n;
  return Array.from({ length: n }, (_, i) => slot(x + i * (sw + gap), y, sw, h, extra));
}

function colSlots(n, { x, y, w, h, gap }, extra) {
  const sh = (h - gap * (n - 1)) / n;
  return Array.from({ length: n }, (_, i) => slot(x, y + i * (sh + gap), w, sh, extra));
}

function gridSlots(cols, rows, { x, y, w, h, gap }, extra) {
  const sw = (w - gap * (cols - 1)) / cols;
  const sh = (h - gap * (rows - 1)) / rows;
  return Array.from({ length: cols * rows }, (_, i) =>
    slot(x + (i % cols) * (sw + gap), y + Math.floor(i / cols) * (sh + gap), sw, sh, extra),
  );
}

/** Kartu polaroid: foto `size` x `size` di dalam kartu, pusat kartu di (cx, cy). */
function polaroidCard(cx, cy, size, rot, pad, padBottom, extra = {}) {
  const gw = size + pad * 2;
  const gh = size + pad + padBottom;
  return slot(cx - gw / 2 + pad, cy - gh / 2 + pad, size, size, {
    rot,
    card: { pad, padBottom },
    ...extra,
  });
}

const TAPE_COLORS = ["rgba(255,196,216,0.82)", "rgba(186,222,255,0.82)", "rgba(255,238,160,0.82)"];

/** Selotip di tepi atas sebuah kartu (ikut miring bersama kartu). */
function tapeFor(s, index) {
  const gh = s.h + s.card.pad + s.card.padBottom;
  const cx = s.x - s.card.pad + (s.w + s.card.pad * 2) / 2;
  const cy = s.y - s.card.pad + gh / 2;
  const theta = (s.rot * Math.PI) / 180;
  const d = gh / 2;
  const w = 230;
  const h = 62;
  return {
    x: cx + d * Math.sin(theta) - w / 2,
    y: cy - d * Math.cos(theta) - h / 2 + 8,
    w, h, shape: "rect", r: 0,
    rot: s.rot + (index % 2 ? 7 : -6),
    color: TAPE_COLORS[index % TAPE_COLORS.length],
    layer: "above",
  };
}

const brandAt = (W, H, footer, extra = {}) => ({
  x: W / 2,
  y: H - footer / 2,
  size: Math.round(0.06 * Math.min(W, H)),
  rot: 0,
  ...extra,
});

const none = [];

/* ---------- builder per keluarga layout ---------- */

const stripOf = (n) => (W, H) => {
  const footer = 230;
  return {
    slots: colSlots(n, { x: M, y: M, w: W - M * 2, h: H - M - footer, gap: G }),
    decor: none,
    brand: brandAt(W, H, footer),
  };
};

const rowOf = (n, footer) => (W, H) => ({
  slots: rowSlots(n, { x: M, y: M, w: W - M * 2, h: H - M - footer, gap: G }),
  decor: none,
  brand: brandAt(W, H, footer),
});

const gridOf = (cols, rows, footer = 200) => (W, H) => ({
  slots: gridSlots(cols, rows, { x: M, y: M, w: W - M * 2, h: H - M - footer, gap: G }),
  decor: none,
  brand: brandAt(W, H, footer),
});

function filmHoles(W, H, vertical) {
  const holes = [];
  const w = 48;
  const h = 72;
  const pitch = 140;
  if (vertical) {
    for (let y = 40; y + h <= H - 40; y += pitch) {
      holes.push({ x: 52, y, w, h, shape: "round", r: 12, rot: 0, color: "$hole", layer: "below" });
      holes.push({ x: W - 52 - w, y, w, h, shape: "round", r: 12, rot: 0, color: "$hole", layer: "below" });
    }
  } else {
    for (let x = 40; x + w <= W - 40; x += pitch) {
      holes.push({ x, y: 46, w, h, shape: "round", r: 12, rot: 0, color: "$hole", layer: "below" });
      holes.push({ x, y: H - 46 - h, w, h, shape: "round", r: 12, rot: 0, color: "$hole", layer: "below" });
    }
  }
  return holes;
}

const band = (W, H) => ({ x: 0, y: 0, w: W, h: H, shape: "rect", r: 0, rot: 0, color: "$band", layer: "below" });

const filmRoll = (n) => (W, H) => {
  const footer = 200;
  const top = 90;
  return {
    slots: colSlots(n, { x: 170, y: top, w: W - 340, h: H - top - footer, gap: 40 }),
    decor: [band(W, H), ...filmHoles(W, H, true)],
    brand: brandAt(W, H, 200, { y: H - 100, size: 64 }),
  };
};

const cineStrip = (n) => (W, H) => ({
  slots: rowSlots(n, { x: 330, y: 170, w: W - 330 - 100, h: H - 340, gap: 60 }),
  decor: [band(W, H), ...filmHoles(W, H, false)],
  brand: { x: 165, y: H / 2, size: 64, rot: -90 },
});

function shaped(shape, boxes, border, { rotations = [], brandY, footer = 200 } = {}) {
  return (W, H) => ({
    slots: boxes.map(([x, y, w, h], i) => slot(x, y, w, h, { shape, border, rot: rotations[i] ?? 0 })),
    decor: none,
    brand: brandAt(W, H, footer, brandY ? { y: brandY } : {}),
  });
}

/* ---------- katalog ---------- */

function def(meta) {
  const [width, height] = meta.size;
  return {
    category: "creative",
    defaultTheme: "cream",
    themeSet: "standard",
    ...meta,
    width,
    height,
    ratio: meta.ratio ?? ratioLabel(width, height),
  };
}

export const LAYOUTS = [
  /* ===== polaroid ===== */
  def({
    id: "single-polaroid", name: "One Moment", category: "polaroid", size: [1200, 1500], slots: 1,
    build: (W, H) => ({
      slots: [slot(M, M, W - M * 2, H - M - 290)],
      decor: none,
      brand: brandAt(W, H, 290, { y: H - 145 + 10 }),
    }),
  }),
  def({
    id: "instax-wide", name: "Instax Wide", category: "polaroid", size: [1800, 1440], slots: 1,
    build: (W, H) => ({
      slots: [slot(90, 90, W - 180, H - 90 - 270)],
      decor: none,
      brand: brandAt(W, H, 270, { y: H - 135 + 8 }),
    }),
  }),
  def({
    id: "polaroid-duo", name: "Twin Polaroids", category: "polaroid", size: [2400, 1500], slots: 2,
    defaultTheme: "blush", overlap: true,
    build: (W, H) => {
      const a = polaroidCard(700, 690, 880, -3, 50, 190);
      const b = polaroidCard(1700, 720, 880, 3, 50, 190);
      return { slots: [a, b], decor: none, brand: brandAt(W, H, 200, { y: H - 105 }) };
    },
  }),
  def({
    id: "scrapbook", name: "Scrapbook", category: "polaroid", size: [1800, 1800], slots: 3,
    defaultTheme: "grid-paper", overlap: true,
    build: (W, H) => {
      const slots = [
        polaroidCard(520, 590, 640, -7, 36, 150),
        polaroidCard(1280, 540, 640, 5, 36, 150),
        polaroidCard(900, 1135, 640, -2, 36, 150),
      ];
      return { slots, decor: slots.map(tapeFor), brand: brandAt(W, H, 200, { y: H - 118 }) };
    },
  }),
  def({
    id: "mini-polaroids", name: "Mini Polaroids", category: "polaroid", size: [1800, 1800], slots: 4,
    defaultTheme: "sky", overlap: true,
    build: (W, H) => ({
      slots: [
        polaroidCard(560, 435, 560, -2, 30, 120),
        polaroidCard(1240, 435, 560, 2, 30, 120),
        polaroidCard(560, 1195, 560, 2, 30, 120),
        polaroidCard(1240, 1195, 560, -2, 30, 120),
      ],
      decor: none,
      brand: brandAt(W, H, 200, { y: H - 112 }),
    }),
  }),

  /* ===== strip (vertikal / memanjang ke bawah) ===== */
  def({ id: "strip-2", name: "Duo Strip", category: "strip", size: [1200, 2400], slots: 2, build: stripOf(2) }),
  def({ id: "classic-strip-3", name: "Classic Strip", category: "strip", size: [1200, 3600], slots: 3, build: stripOf(3) }),
  def({ id: "classic-strip-4", name: "Four Up", category: "strip", size: [1200, 4800], slots: 4, build: stripOf(4) }),

  /* ===== wide (menyamping / memanjang ke samping) ===== */
  def({ id: "panorama", name: "Panorama", category: "wide", size: [2000, 1250], slots: 1, build: rowOf(1, 220) }),
  def({ id: "side-by-side", name: "Side by Side", category: "wide", size: [2400, 1500], slots: 2, build: rowOf(2, 220) }),
  def({ id: "wide-strip-3", name: "Wide Strip", category: "wide", size: [3600, 1200], slots: 3, build: rowOf(3, 190) }),
  def({ id: "wide-strip-4", name: "Long Strip", category: "wide", size: [4800, 1200], slots: 4, build: rowOf(4, 190) }),
  def({
    id: "trio-wide", name: "Trio Wide", category: "wide", size: [2400, 1500], slots: 3,
    build: (W, H) => {
      const footer = 220;
      const availW = W - M * 2;
      const availH = H - M - footer;
      const bigW = (availW - G) * 0.56;
      const smallW = availW - G - bigW;
      const smallH = (availH - G) / 2;
      return {
        slots: [
          slot(M, M, bigW, availH),
          slot(M + bigW + G, M, smallW, smallH),
          slot(M + bigW + G, M + smallH + G, smallW, smallH),
        ],
        decor: none,
        brand: brandAt(W, H, footer),
      };
    },
  }),

  /* ===== grid ===== */
  def({ id: "grid-2x2", name: "Little Grid", category: "grid", size: [1600, 1600], slots: 4, build: gridOf(2, 2) }),
  def({ id: "grid-2x3", name: "Six Up", category: "grid", size: [1200, 1800], slots: 6, build: gridOf(2, 3) }),
  def({ id: "grid-3x2", name: "Six Wide", category: "grid", size: [1800, 1200], slots: 6, build: gridOf(3, 2) }),
  def({
    id: "soft-grid", name: "Soft Grid", category: "grid", size: [1600, 1600], slots: 4, defaultTheme: "peach",
    build: (W, H) => ({
      slots: gridSlots(2, 2, { x: 100, y: 100, w: W - 200, h: H - 100 - 220, gap: 56 }, { shape: "round", r: 70 }),
      decor: none,
      brand: brandAt(W, H, 220),
    }),
  }),

  /* ===== film ===== */
  def({
    id: "film-roll", name: "Film Roll", category: "film", size: [1200, 4800], slots: 4,
    themeSet: "film", defaultTheme: "film-black", build: filmRoll(4),
  }),
  def({
    id: "film-3", name: "Film Three", category: "film", size: [1200, 3600], slots: 3,
    themeSet: "film", defaultTheme: "film-sepia", build: filmRoll(3),
  }),
  def({
    id: "cine-strip", name: "Cine Strip", category: "film", size: [3600, 1200], slots: 3,
    themeSet: "film", defaultTheme: "film-blue", build: cineStrip(3),
  }),

  /* ===== creative ===== */
  def({
    id: "big-small", name: "Big & Small", category: "creative", size: [1200, 1500], slots: 3, defaultTheme: "blush",
    build: (W, H) => {
      const footer = 230;
      const availW = W - M * 2;
      const availH = H - M - footer;
      const bigW = (availW - G) * 0.6;
      const smallW = availW - G - bigW;
      const smallH = (availH - G) / 2;
      return {
        slots: [
          slot(M, M, bigW, availH),
          slot(M + bigW + G, M, smallW, smallH),
          slot(M + bigW + G, M + smallH + G, smallW, smallH),
        ],
        decor: none,
        brand: brandAt(W, H, footer),
      };
    },
  }),
  def({
    id: "heart-1", name: "Big Heart", size: [1500, 1500], slots: 1, defaultTheme: "hearts-pink",
    build: shaped("heart", [[160, 140, 1180, 1080]], 36, { brandY: 1400 }),
  }),
  def({
    id: "heart-2", name: "Twin Hearts", size: [2400, 1500], slots: 2, defaultTheme: "hearts-pink",
    build: shaped("heart", [[140, 190, 1000, 920], [1260, 190, 1000, 920]], 36, { rotations: [-5, 5], brandY: 1370 }),
  }),
  def({
    id: "heart-3", name: "Heart Trio", size: [1800, 1800], slots: 3, defaultTheme: "polka-pink",
    build: shaped("heart", [[140, 120, 760, 700], [900, 120, 760, 700], [520, 860, 760, 700]], 30, { brandY: 1690 }),
  }),
  def({
    id: "heart-4", name: "Clover Hearts", size: [1700, 1800], slots: 4, defaultTheme: "hearts-red",
    build: shaped(
      "heart",
      [[100, 100, 720, 660], [880, 100, 720, 660], [100, 800, 720, 660], [880, 800, 720, 660]],
      28,
      { brandY: 1640 },
    ),
  }),
  def({
    id: "circle-2", name: "Duo Bubbles", size: [2400, 1500], slots: 2, defaultTheme: "cotton-candy",
    build: shaped("circle", [[140, 120, 1000, 1000], [1260, 120, 1000, 1000]], 30, { brandY: 1330 }),
  }),
  def({
    id: "circle-3", name: "Bubbles", size: [1200, 3600], slots: 3, defaultTheme: "cotton-candy",
    build: shaped(
      "circle",
      [[80, 80, 1040, 1040], [80, 1170, 1040, 1040], [80, 2260, 1040, 1040]],
      0,
      { brandY: 3450 },
    ),
  }),
  def({
    id: "circle-4", name: "Polka Grid", size: [1600, 1700], slots: 4, defaultTheme: "polka-cream",
    build: shaped(
      "circle",
      [[130, 110, 640, 640], [830, 110, 640, 640], [130, 810, 640, 640], [830, 810, 640, 640]],
      28,
      { brandY: 1590 },
    ),
  }),
  def({
    id: "arch-3", name: "Arches", size: [3000, 1600], slots: 3, defaultTheme: "sage",
    build: (W, H) => ({
      slots: rowSlots(3, { x: 100, y: 100, w: W - 200, h: 1240, gap: 60 }, { shape: "arch" }),
      decor: none,
      brand: brandAt(W, H, 200, { y: 1470 }),
    }),
  }),
  def({
    id: "star-1", name: "Superstar", size: [1500, 1500], slots: 1, defaultTheme: "stars-night",
    build: shaped("star", [[150, 110, 1200, 1141]], 0, { brandY: 1400 }),
  }),
  def({
    id: "flower-1", name: "Flower Power", size: [1500, 1500], slots: 1, defaultTheme: "daisy",
    build: shaped("flower", [[175, 100, 1150, 1150]], 0, { brandY: 1390 }),
  }),
  def({
    id: "cloud-1", name: "Cloud Nine", size: [1800, 1500], slots: 1, defaultTheme: "ocean",
    build: shaped("cloud", [[150, 150, 1500, 1000]], 0, { brandY: 1350 }),
  }),
  def({
    id: "diamond-4", name: "Diamonds", size: [1600, 1700], slots: 4, defaultTheme: "holo",
    overlap: true, // kotak pembatas saling menjorok; bentuk berlian hanya bersentuhan di sudut
    build: shaped(
      "diamond",
      [[490, 110, 620, 620], [170, 430, 620, 620], [810, 430, 620, 620], [490, 750, 620, 620]],
      0,
      { brandY: 1570 },
    ),
  }),
  def({
    id: "oval-1", name: "Cameo", size: [1500, 1800], slots: 1, defaultTheme: "stripes-candy",
    build: shaped("oval", [[200, 120, 1100, 1400]], 40, { brandY: 1670 }),
  }),
];

const BY_ID = new Map(LAYOUTS.map((layout) => [layout.id, layout]));

export function getLayout(id) {
  return BY_ID.get(id);
}

/* ---------- geometri + tema ---------- */

const cache = new Map();

/**
 * Geometri lengkap sebuah frame: ukuran kanvas, slot (+ group/rotasi), dekorasi, brand,
 * dengan warna tema sudah di-resolve. Di-cache per (layout, tema).
 */
export const MAX_INSET = 200;

export function getGeometry(frame) {
  const layout = BY_ID.get(frame.layout ?? frame.id);
  if (!layout) throw new Error(`Layout tidak dikenal: ${frame.layout ?? frame.id}`);

  const themeId = resolveThemeId(layout, frame.themeId);
  // Layout film sudah berupa rol penuh: ketebalan border tidak berlaku.
  const inset = layout.themeSet === "film" ? 0 : Math.min(MAX_INSET, Math.max(0, Math.round(Number(frame.inset) || 0)));
  const key = `${layout.id}:${themeId}:${inset}`;
  if (cache.has(key)) return cache.get(key);

  const theme = getTheme(themeId);
  const raw = layout.build(layout.width, layout.height);

  if (raw.slots.length !== layout.slots) {
    throw new Error(`Layout ${layout.id}: ${raw.slots.length} slot, diharapkan ${layout.slots}`);
  }

  const palette = {
    $paper: theme.paper,
    $ink: theme.ink,
    $band: theme.film?.band ?? theme.ink,
    $hole: theme.film?.hole ?? theme.paper,
  };
  const color = (value) => palette[value] ?? value;

  /*
   * Border lebih tebal: peta seluruh isi (foto + dekorasi) ke dalam kotak yang menyusut `inset`
   * px di semua sisi. Posisi brand sengaja TIDAK dipetakan: area footer justru sedikit melebar,
   * jadi brand tidak mungkin menabrak foto.
   */
  const sx = (layout.width - inset * 2) / layout.width;
  const sy = (layout.height - inset * 2) / layout.height;
  const place = (r) => (inset ? { ...r, x: inset + r.x * sx, y: inset + r.y * sy, w: r.w * sx, h: r.h * sy } : r);

  const slots = raw.slots.map(place).map((s) => ({
    ...s,
    group: s.card
      ? { x: s.x - s.card.pad, y: s.y - s.card.pad, w: s.w + s.card.pad * 2, h: s.h + s.card.pad + s.card.padBottom }
      : { x: s.x, y: s.y, w: s.w, h: s.h },
  }));

  const result = {
    layoutId: layout.id,
    themeId,
    theme,
    width: layout.width,
    height: layout.height,
    ratio: layout.width / layout.height,
    bg: theme.bg,
    ink: theme.ink,
    paper: theme.paper,
    slots,
    decor: raw.decor.map((d) => ({ ...place(d), color: color(d.color) })),
    inset,
    // Teks di atas pill selalu gelap (pill = warna kertas yang terang), apa pun warna tema.
    brand: {
      ...raw.brand,
      pill: Boolean(theme.brandPill),
      pillColor: theme.paper,
      color: theme.brandPill ? "#171513" : theme.ink,
    },
  };

  cache.set(key, result);
  return result;
}

/** Konversi rect px -> persen terhadap kanvas, untuk posisi absolut di DOM. */
export function pct(rect, g) {
  return {
    left: `${(rect.x / g.width) * 100}%`,
    top: `${(rect.y / g.height) * 100}%`,
    width: `${(rect.w / g.width) * 100}%`,
    height: `${(rect.h / g.height) * 100}%`,
  };
}

/** Persen sebuah rect terhadap rect lain (mis. foto di dalam kartu polaroid). */
export function pctWithin(rect, outer) {
  return {
    left: `${((rect.x - outer.x) / outer.w) * 100}%`,
    top: `${((rect.y - outer.y) / outer.h) * 100}%`,
    width: `${(rect.w / outer.w) * 100}%`,
    height: `${(rect.h / outer.h) * 100}%`,
  };
}
