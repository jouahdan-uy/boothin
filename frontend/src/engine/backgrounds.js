import { loadImage } from "./images.js";

/**
 * Background frame: warna polos, gradient, pattern prosedural, atau gambar (untuk pattern
 * buatan sendiri). Semua digambar ke canvas dengan fungsi yang sama, dan ukurannya
 * relatif terhadap lebar kanvas, jadi hasilnya sama di preview kecil maupun export besar.
 *
 *  bg = { type: "solid", color }
 *     | { type: "linear", angle, stops: [[0, "#fff"], [1, "#000"]] }
 *     | { type: "radial", cx, cy, radius, stops }
 *     | { type: "pattern", pattern, base, color, color2?, colors?, cell }   // cell = per mil lebar
 *     | { type: "image", src, mode: "tile" | "cover", size }                // size = per mil lebar
 *  Semua tipe boleh punya `grain` (0..0.2) untuk tekstur kertas.
 */

const TAU = Math.PI * 2;

/** PRNG deterministik: confetti/grain selalu sama di preview dan export. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- bentuk kecil untuk pattern (dalam kotak 0..1, digambar dengan fill) ---------- */

let cachedShapes = null;

/** Path2D dibuat saat pertama dipakai, bukan saat modul dimuat (modul ini harus bisa diimpor tanpa DOM). */
function shapes() {
  if (cachedShapes) return cachedShapes;

  const star = new Path2D();
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? 0.5 : 0.21;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = 0.5 + Math.cos(angle) * radius;
    const y = 0.53 + Math.sin(angle) * radius;
    if (i === 0) star.moveTo(x, y);
    else star.lineTo(x, y);
  }
  star.closePath();

  cachedShapes = {
    heart: new Path2D(
      "M0.5 0.95C0.5 0.95 0.04 0.64 0.04 0.32C0.04 0.14 0.17 0.04 0.3 0.04C0.4 0.04 0.47 0.1 0.5 0.19C0.53 0.1 0.6 0.04 0.7 0.04C0.83 0.04 0.96 0.14 0.96 0.32C0.96 0.64 0.5 0.95 0.5 0.95Z",
    ),
    sparkle: new Path2D("M0.5 0Q0.56 0.44 1 0.5Q0.56 0.56 0.5 1Q0.44 0.56 0 0.5Q0.44 0.44 0.5 0Z"),
    star,
  };
  return cachedShapes;
}

function stamp(ctx, path, cx, cy, size, rotation = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.scale(size, size);
  ctx.translate(-0.5, -0.5);
  ctx.fill(path);
  ctx.restore();
}

/* ---------- pattern ---------- */

function tileRows(w, h, cell, draw, { offset = true } = {}) {
  let row = 0;
  for (let y = -cell; y < h + cell; y += cell) {
    const shift = offset && row % 2 === 1 ? cell / 2 : 0;
    for (let x = -cell + shift; x < w + cell; x += cell) draw(x + cell / 2, y + cell / 2, row);
    row += 1;
  }
}

const PATTERNS = {
  dots(ctx, w, h, bg, cell) {
    ctx.fillStyle = bg.color;
    tileRows(w, h, cell, (cx, cy) => {
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.2, 0, TAU);
      ctx.fill();
    });
  },

  stripes(ctx, w, h, bg, cell) {
    ctx.fillStyle = bg.color;
    for (let x = 0; x < w; x += cell * 2) ctx.fillRect(x, 0, cell, h);
  },

  diagonal(ctx, w, h, bg, cell) {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-Math.PI / 4);
    const reach = Math.hypot(w, h);
    ctx.fillStyle = bg.color;
    for (let x = -reach; x < reach; x += cell * 2) ctx.fillRect(x, -reach, cell, reach * 2);
    ctx.restore();
  },

  checker(ctx, w, h, bg, cell) {
    ctx.fillStyle = bg.color;
    for (let y = 0, r = 0; y < h; y += cell, r += 1) {
      for (let x = 0, c = 0; x < w; x += cell, c += 1) {
        if ((r + c) % 2 === 0) ctx.fillRect(x, y, cell, cell);
      }
    }
  },

  gingham(ctx, w, h, bg, cell) {
    ctx.fillStyle = bg.color;
    ctx.globalAlpha = 0.4;
    for (let x = 0; x < w; x += cell * 2) ctx.fillRect(x, 0, cell, h);
    for (let y = 0; y < h; y += cell * 2) ctx.fillRect(0, y, w, cell);
    ctx.globalAlpha = 1;
  },

  grid(ctx, w, h, bg, cell) {
    ctx.strokeStyle = bg.color;
    ctx.lineWidth = Math.max(1, cell * 0.045);
    ctx.beginPath();
    for (let x = 0; x <= w; x += cell) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let y = 0; y <= h; y += cell) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
  },

  hearts(ctx, w, h, bg, cell) {
    ctx.fillStyle = bg.color;
    tileRows(w, h, cell, (cx, cy, row) => stamp(ctx, shapes().heart, cx, cy, cell * 0.5, row % 2 ? 0.2 : -0.2));
  },

  stars(ctx, w, h, bg, cell) {
    ctx.fillStyle = bg.color;
    tileRows(w, h, cell, (cx, cy, row) => stamp(ctx, shapes().star, cx, cy, cell * 0.5, row % 2 ? 0.15 : -0.15));
  },

  sparkles(ctx, w, h, bg, cell) {
    ctx.fillStyle = bg.color;
    tileRows(w, h, cell, (cx, cy, row) => stamp(ctx, shapes().sparkle, cx, cy, cell * (row % 2 ? 0.3 : 0.45)));
  },

  flowers(ctx, w, h, bg, cell) {
    tileRows(w, h, cell, (cx, cy, row) => {
      const r = cell * 0.13;
      const turn = row % 2 ? 0.3 : 0;
      ctx.fillStyle = bg.color;
      for (let i = 0; i < 5; i += 1) {
        const a = turn + (i * TAU) / 5 - Math.PI / 2;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * r * 1.35, cy + Math.sin(a) * r * 1.35, r, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = bg.color2 ?? "#f2b632";
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.8, 0, TAU);
      ctx.fill();
    });
  },

  confetti(ctx, w, h, bg, cell) {
    const random = rng(1234);
    const palette = bg.colors?.length ? bg.colors : [bg.color];
    const count = Math.round((w * h) / (cell * cell * 1.5));
    for (let i = 0; i < count; i += 1) {
      const x = random() * w;
      const y = random() * h;
      const size = cell * (0.1 + random() * 0.14);
      const kind = Math.floor(random() * 3);
      const turn = random() * TAU;
      ctx.fillStyle = palette[Math.floor(random() * palette.length)];
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(turn);
      if (kind === 0) ctx.fillRect(-size, -size * 0.4, size * 2, size * 0.8);
      else if (kind === 1) {
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.7, 0, TAU);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size, size * 0.8);
        ctx.lineTo(-size, size * 0.8);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  },

  waves(ctx, w, h, bg, cell) {
    ctx.strokeStyle = bg.color;
    ctx.lineWidth = Math.max(1, cell * 0.1);
    ctx.lineCap = "round";
    for (let y = cell * 0.4; y < h + cell; y += cell * 0.7) {
      ctx.beginPath();
      for (let x = 0; x <= w + 4; x += 4) {
        const yy = y + Math.sin((x / cell) * TAU) * cell * 0.16;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  },

  scallop(ctx, w, h, bg, cell) {
    ctx.strokeStyle = bg.color;
    ctx.fillStyle = bg.base;
    ctx.lineWidth = Math.max(1, cell * 0.06);
    let row = 0;
    for (let y = 0; y < h + cell; y += cell * 0.5) {
      const shift = row % 2 ? cell / 2 : 0;
      for (let x = -cell + shift; x < w + cell; x += cell) {
        ctx.beginPath();
        ctx.arc(x + cell / 2, y, cell / 2, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      row += 1;
    }
  },
};

export const PATTERN_NAMES = Object.keys(PATTERNS);

/* ---------- gradient ---------- */

function addStops(gradient, stops) {
  stops.forEach(([at, color]) => gradient.addColorStop(at, color));
  return gradient;
}

function linearGradient(ctx, w, h, angle, stops) {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const length = Math.abs(w * dx) + Math.abs(h * dy);
  const cx = w / 2;
  const cy = h / 2;
  return addStops(
    ctx.createLinearGradient(cx - (dx * length) / 2, cy - (dy * length) / 2, cx + (dx * length) / 2, cy + (dy * length) / 2),
    stops,
  );
}

/* ---------- grain ---------- */

function drawGrain(ctx, w, h, amount) {
  const size = 160;
  const tile = document.createElement("canvas");
  tile.width = size;
  tile.height = size;
  const tctx = tile.getContext("2d");
  const data = tctx.createImageData(size, size);
  const random = rng(99);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = random() > 0.5 ? 255 : 0;
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = Math.round(random() * 255 * amount);
  }
  tctx.putImageData(data, 0, 0);

  ctx.save();
  ctx.fillStyle = ctx.createPattern(tile, "repeat");
  // Grain mengikuti ukuran kanvas supaya terlihat sama di preview dan export.
  const scale = Math.max(1, w / 1200);
  ctx.scale(scale, scale);
  ctx.fillRect(0, 0, w / scale, h / scale);
  ctx.restore();
}

/* ---------- gambar yang bukan ubin seamless ---------- */

/**
 * Isi kanvas dengan satu gambar yang diulang CERMIN (tiap ubin dibalik bergantian), sehingga
 * tepi antar-ubin selalu menyambung walau gambarnya bukan pola seamless.
 *
 * Ukuran ditentukan oleh sisi PENDEK kanvas (bukan lebarnya): sisi pendek gambar dipetakan ke
 * sisi pendek frame x `fit`. Dengan begitu frame strip (1200x4800) dan frame lebar (4800x1200)
 * sama-sama memakai motif berukuran wajar, dan hasilnya sama di preview kecil maupun export besar.
 * Ubin pertama diletakkan di tengah kanvas.
 */
function drawMirrored(ctx, image, w, h, fit) {
  const iw = image.naturalWidth;
  const ih = image.naturalHeight;
  const scale = (Math.min(w, h) * fit) / Math.min(iw, ih);
  const tw = iw * scale;
  const th = ih * scale;
  const x0 = (w - tw) / 2;
  const y0 = (h - th) / 2;

  const firstI = Math.floor(-x0 / tw);
  const lastI = Math.ceil((w - x0) / tw) - 1;
  const firstJ = Math.floor(-y0 / th);
  const lastJ = Math.ceil((h - y0) / th) - 1;

  // Ubin sedikit dilebihkan (0.75px) agar tidak ada garis tipis di sambungan akibat pembulatan.
  const bleed = 0.75;

  for (let j = firstJ; j <= lastJ; j += 1) {
    for (let i = firstI; i <= lastI; i += 1) {
      ctx.save();
      ctx.translate(x0 + i * tw, y0 + j * th);
      if (((i % 2) + 2) % 2 === 1) {
        ctx.translate(tw, 0);
        ctx.scale(-1, 1);
      }
      if (((j % 2) + 2) % 2 === 1) {
        ctx.translate(0, th);
        ctx.scale(1, -1);
      }
      ctx.drawImage(image, -bleed / 2, -bleed / 2, tw + bleed, th + bleed);
      ctx.restore();
    }
  }
}

/* ---------- API ---------- */

/** Muat resource yang dibutuhkan sebuah background (hanya tipe "image" yang butuh). */
export async function prepareBackground(bg) {
  if (bg?.type === "image" && bg.src) {
    try {
      return { image: await loadImage(bg.src) };
    } catch (error) {
      console.warn("Pattern gambar gagal dimuat:", error.message);
    }
  }
  return {};
}

/** Gambar background ke ctx (kanvas berukuran w x h). Sinkron; panggil prepareBackground dulu. */
export function drawBackground(ctx, w, h, bg, resources = {}) {
  ctx.save();

  switch (bg.type) {
    case "linear":
      ctx.fillStyle = linearGradient(ctx, w, h, bg.angle ?? 160, bg.stops);
      ctx.fillRect(0, 0, w, h);
      break;

    case "radial": {
      const radius = Math.max(w, h) * (bg.radius ?? 0.8);
      ctx.fillStyle = addStops(
        ctx.createRadialGradient(w * (bg.cx ?? 0.5), h * (bg.cy ?? 0.4), 0, w * (bg.cx ?? 0.5), h * (bg.cy ?? 0.4), radius),
        bg.stops,
      );
      ctx.fillRect(0, 0, w, h);
      break;
    }

    case "pattern": {
      const cell = Math.max(4, ((bg.cell ?? 50) / 1000) * w);
      ctx.fillStyle = bg.base;
      ctx.fillRect(0, 0, w, h);
      const paint = PATTERNS[bg.pattern];
      if (!paint) throw new Error(`Pattern tidak dikenal: ${bg.pattern}`);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.clip();
      paint(ctx, w, h, bg, cell);
      ctx.restore();
      break;
    }

    case "image": {
      ctx.fillStyle = bg.base ?? "#f6efe3";
      ctx.fillRect(0, 0, w, h);
      const image = resources.image;
      if (!image) break;

      const iw = image.naturalWidth;
      const ih = image.naturalHeight;
      ctx.imageSmoothingQuality = "high";

      if (bg.mode === "cover") {
        const scale = Math.max(w / iw, h / ih);
        ctx.drawImage(image, (w - iw * scale) / 2, (h - ih * scale) / 2, iw * scale, ih * scale);
      } else if (bg.mode === "mirror") {
        drawMirrored(ctx, image, w, h, bg.fit ?? 1);
      } else {
        const tileW = ((bg.size ?? 200) / 1000) * w;
        const tileH = tileW * (ih / iw);
        for (let y = 0; y < h; y += tileH) {
          for (let x = 0; x < w; x += tileW) ctx.drawImage(image, x, y, tileW, tileH);
        }
      }
      break;
    }

    default:
      ctx.fillStyle = bg.color ?? "#ffffff";
      ctx.fillRect(0, 0, w, h);
  }

  ctx.restore();

  if (bg.grain) drawGrain(ctx, w, h, bg.grain);
}
