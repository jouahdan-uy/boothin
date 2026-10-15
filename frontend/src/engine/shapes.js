/**
 * Bentuk slot foto. Setiap bentuk didefinisikan SEKALI sebagai SVG path dalam koordinat
 * satuan (0..1) yang dihitung dari ukuran slot (px), lalu dipakai:
 *  - canvas : ctx.clip(new Path2D(d)) setelah translate/scale ke rect slot
 *  - DOM    : <clipPath clipPathUnits="objectBoundingBox"><path d=... />
 * Jadi bentuk di editor dan di hasil export identik.
 */

export const SHAPE_NAMES = [
  "rect", "round", "pill", "circle", "heart", "star", "arch", "diamond", "flower", "cloud", "oval",
];

const f = (n) => (Math.round(n * 100000) / 100000).toString();

/** Perekam path dalam px; keluaran dinormalisasi ke 0..1 (dibagi w / h). */
class PathBuilder {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = [];
  }
  M(x, y) { this.d.push(`M${f(x / this.w)} ${f(y / this.h)}`); return this; }
  L(x, y) { this.d.push(`L${f(x / this.w)} ${f(y / this.h)}`); return this; }
  C(x1, y1, x2, y2, x, y) {
    this.d.push(`C${f(x1 / this.w)} ${f(y1 / this.h)} ${f(x2 / this.w)} ${f(y2 / this.h)} ${f(x / this.w)} ${f(y / this.h)}`);
    return this;
  }
  A(rx, ry, large, sweep, x, y) {
    this.d.push(`A${f(rx / this.w)} ${f(ry / this.h)} 0 ${large} ${sweep} ${f(x / this.w)} ${f(y / this.h)}`);
    return this;
  }
  Z() { this.d.push("Z"); return this; }
  /** Lingkaran utuh sebagai sub-path (dua busur). */
  circle(cx, cy, r) {
    return this.M(cx + r, cy).A(r, r, 1, 1, cx - r, cy).A(r, r, 1, 1, cx + r, cy).Z();
  }
  toString() { return this.d.join(""); }
}

function roundedRect(p, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  p.M(rr, 0).L(w - rr, 0).A(rr, rr, 0, 1, w, rr).L(w, h - rr).A(rr, rr, 0, 1, w - rr, h)
    .L(rr, h).A(rr, rr, 0, 1, 0, h - rr).L(0, rr).A(rr, rr, 0, 1, rr, 0).Z();
}

const BUILDERS = {
  round(p, w, h, r) { roundedRect(p, w, h, r || Math.min(w, h) * 0.12); },
  pill(p, w, h) { roundedRect(p, w, h, Math.min(w, h) / 2); },

  circle(p, w, h) {
    const rx = w / 2;
    const ry = h / 2;
    p.M(w, ry).A(rx, ry, 1, 1, 0, ry).A(rx, ry, 1, 1, w, ry).Z();
  },
  oval(p, w, h) { BUILDERS.circle(p, w, h); },

  heart(p, w, h) {
    // Dua lengkung atas + ujung bawah; proporsi disetel agar mengisi kotak penuh.
    p.M(0.5 * w, 0.98 * h)
      .C(0.5 * w, 0.98 * h, 0.02 * w, 0.66 * h, 0.02 * w, 0.32 * h)
      .C(0.02 * w, 0.14 * h, 0.16 * w, 0.02 * h, 0.3 * w, 0.02 * h)
      .C(0.4 * w, 0.02 * h, 0.47 * w, 0.08 * h, 0.5 * w, 0.17 * h)
      .C(0.53 * w, 0.08 * h, 0.6 * w, 0.02 * h, 0.7 * w, 0.02 * h)
      .C(0.84 * w, 0.02 * h, 0.98 * w, 0.14 * h, 0.98 * w, 0.32 * h)
      .C(0.98 * w, 0.66 * h, 0.5 * w, 0.98 * h, 0.5 * w, 0.98 * h)
      .Z();
  },

  star(p, w, h) {
    // Bintang lima, dinormalisasi ke kotak (cocok untuk slot ~1.05 : 1).
    const pts = [];
    for (let i = 0; i < 10; i += 1) {
      const radius = i % 2 === 0 ? 1 : 0.4;
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
    }
    const xs = pts.map((q) => q[0]);
    const ys = pts.map((q) => q[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    pts.forEach(([x, y], i) => {
      const px = ((x - minX) / (maxX - minX)) * w;
      const py = ((y - minY) / (maxY - minY)) * h;
      if (i === 0) p.M(px, py);
      else p.L(px, py);
    });
    p.Z();
  },

  arch(p, w, h) {
    // Setengah lingkaran di atas, dasar lurus. Jari-jari dihitung dari lebar (bukan dari h).
    const r = Math.min(w / 2, h);
    p.M(0, h).L(0, r).A(w / 2, r, 0, 1, w, r).L(w, h).Z();
  },

  diamond(p, w, h) { p.M(w / 2, 0).L(w, h / 2).L(w / 2, h).L(0, h / 2).Z(); },

  flower(p, w, h) {
    const s = Math.min(w, h);
    const cx = w / 2;
    const cy = h / 2;
    const petal = s * 0.22;
    const ring = s * 0.28;
    for (let i = 0; i < 6; i += 1) {
      const a = (i * Math.PI) / 3 - Math.PI / 2;
      p.circle(cx + Math.cos(a) * ring * (w / s), cy + Math.sin(a) * ring * (h / s), petal);
    }
    p.circle(cx, cy, s * 0.3);
  },

  cloud(p, w, h) {
    // Gabungan lingkaran + dasar rata (nonzero fill menyatukan semuanya).
    p.circle(0.24 * w, 0.62 * h, 0.2 * h);
    p.circle(0.42 * w, 0.4 * h, 0.27 * h);
    p.circle(0.66 * w, 0.44 * h, 0.24 * h);
    p.circle(0.8 * w, 0.64 * h, 0.2 * h);
    // Searah jarum jam seperti lingkaran (nonzero fill): kalau berlawanan arah, area tumpang tindih jadi lubang.
    p.M(0.24 * w, 0.5 * h).L(0.8 * w, 0.5 * h).L(0.8 * w, 0.82 * h).L(0.24 * w, 0.82 * h).Z();
  },
};

const cache = new Map();

/**
 * Path (koordinat 0..1) untuk sebuah bentuk. null untuk "rect" (tanpa clip).
 * `r` = radius sudut dalam px, hanya untuk "round".
 */
export function shapePath(shape, w, h, r = 0) {
  if (!shape || shape === "rect") return null;
  const build = BUILDERS[shape];
  if (!build) throw new Error(`Bentuk tidak dikenal: ${shape}`);

  const key = `${shape}|${Math.round(w)}|${Math.round(h)}|${Math.round(r)}`;
  if (cache.has(key)) return cache.get(key);

  const p = new PathBuilder(w, h);
  build(p, w, h, r);
  const d = p.toString();
  cache.set(key, d);
  return d;
}

/** ID aman untuk atribut id/url(#...) */
export function shapeKey(shape, w, h, r = 0) {
  return `${shape}-${Math.round(w)}x${Math.round(h)}-${Math.round(r)}`;
}

/** Terapkan clip bentuk ke ctx (canvas) untuk sebuah rect. Pemanggil harus save()/restore(). */
export function clipShape(ctx, shape, rect, r = 0) {
  const d = shapePath(shape, rect.w, rect.h, r);
  ctx.beginPath();
  if (!d) {
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    return;
  }
  ctx.translate(rect.x, rect.y);
  ctx.scale(rect.w, rect.h);
  ctx.clip(new Path2D(d));
  ctx.scale(1 / rect.w, 1 / rect.h);
  ctx.translate(-rect.x, -rect.y);
}

/** Isi bentuk dengan warna (tanpa clip) — dipakai untuk border/dekorasi. */
export function fillShape(ctx, shape, rect, color, r = 0) {
  const d = shapePath(shape, rect.w, rect.h, r);
  ctx.save();
  ctx.fillStyle = color;
  if (!d) {
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  } else {
    ctx.translate(rect.x, rect.y);
    ctx.scale(rect.w, rect.h);
    ctx.fill(new Path2D(d));
  }
  ctx.restore();
}
