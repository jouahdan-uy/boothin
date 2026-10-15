/**
 * Filter kamera. Satu definisi (`ops`) dipakai untuk:
 *  - CSS filter (preview live + canvas 2D yang mendukung ctx.filter)
 *  - fallback per-pixel untuk browser tanpa ctx.filter (Safari lama / iOS)
 */

export const FILTER_GROUPS = [
  { id: "basic", label: "Basic" },
  { id: "bw", label: "B&W" },
  { id: "warm", label: "Warm" },
  { id: "cool", label: "Cool" },
  { id: "pastel", label: "Pastel" },
  { id: "film", label: "Film" },
  { id: "fun", label: "Fun" },
];

const f = (id, name, group, ops) => ({ id, name, group, ops });

export const FILTERS = [
  /* basic */
  f("original", "Original", "basic", []),
  f("beauty", "Beauty", "basic", [["brightness", 1.04], ["saturate", 0.92], ["contrast", 0.96]]),
  f("bright", "Bright", "basic", [["brightness", 1.12], ["contrast", 1.05], ["saturate", 1.1]]),
  f("soft", "Soft", "basic", [["brightness", 1.08], ["contrast", 0.88], ["saturate", 0.9]]),
  f("vivid", "Vivid", "basic", [["saturate", 1.5], ["contrast", 1.08]]),

  /* hitam putih */
  f("mono", "Mono", "bw", [["grayscale", 1]]),
  f("noir", "Noir", "bw", [["grayscale", 1], ["contrast", 1.4], ["brightness", 0.92]]),
  f("silver", "Silver", "bw", [["grayscale", 1], ["contrast", 0.9], ["brightness", 1.1]]),
  f("newsprint", "Newsprint", "bw", [["grayscale", 1], ["contrast", 1.7], ["brightness", 1.1]]),

  /* hangat */
  f("warm", "Warm", "warm", [["sepia", 0.25], ["saturate", 1.2]]),
  f("golden", "Golden", "warm", [["sepia", 0.45], ["saturate", 1.5], ["brightness", 1.05]]),
  f("sunset", "Sunset", "warm", [["sepia", 0.4], ["hue-rotate", -15], ["saturate", 1.7]]),
  f("peach", "Peach", "warm", [["sepia", 0.25], ["hue-rotate", -20], ["saturate", 1.3], ["brightness", 1.08]]),
  f("retro70", "Retro 70s", "warm", [["sepia", 0.6], ["contrast", 1.1], ["saturate", 1.4], ["hue-rotate", -10]]),

  /* dingin */
  f("cool", "Cool", "cool", [["saturate", 0.9], ["hue-rotate", 12]]),
  f("ice", "Ice", "cool", [["hue-rotate", 20], ["saturate", 0.8], ["brightness", 1.1], ["contrast", 1.05]]),
  f("ocean", "Ocean", "cool", [["hue-rotate", 25], ["saturate", 1.4]]),
  f("mint", "Mint", "cool", [["sepia", 0.2], ["hue-rotate", 60], ["saturate", 0.9], ["brightness", 1.05]]),

  /* pastel */
  f("sakura", "Sakura", "pastel", [["sepia", 0.3], ["hue-rotate", 300], ["saturate", 1.5], ["brightness", 1.08]]),
  f("cotton", "Cotton", "pastel", [["sepia", 0.2], ["hue-rotate", 290], ["saturate", 1.1], ["brightness", 1.1], ["contrast", 0.9]]),
  f("lavender", "Lavender", "pastel", [["sepia", 0.3], ["hue-rotate", 220], ["saturate", 1.2], ["brightness", 1.05]]),
  f("bubblegum", "Bubblegum", "pastel", [["sepia", 0.35], ["hue-rotate", 310], ["saturate", 1.9], ["brightness", 1.05]]),

  /* film */
  f("vintage", "Vintage", "film", [["sepia", 0.35], ["contrast", 0.92], ["saturate", 0.8]]),
  f("polaroid", "Polaroid", "film", [["sepia", 0.25], ["contrast", 1.15], ["brightness", 1.05], ["saturate", 1.3], ["hue-rotate", -8]]),
  f("faded", "Faded", "film", [["contrast", 0.85], ["brightness", 1.1], ["saturate", 0.75], ["sepia", 0.15]]),
  f("kodak", "Kodak", "film", [["sepia", 0.3], ["saturate", 1.6], ["contrast", 1.1]]),
  f("cinema", "Cinema", "film", [["contrast", 1.25], ["saturate", 0.85], ["sepia", 0.2], ["brightness", 0.95]]),

  /* seru */
  f("y2k", "Y2K", "fun", [["hue-rotate", 300], ["saturate", 1.8], ["contrast", 1.1]]),
  f("cyber", "Cyber", "fun", [["hue-rotate", 180], ["saturate", 1.5], ["contrast", 1.15]]),
  f("pop", "Pop", "fun", [["saturate", 2], ["contrast", 1.15]]),
  f("negative", "Negative", "fun", [["invert", 1]]),
];

export function filterToCss(filter) {
  if (!filter || filter.ops.length === 0) return "none";
  return filter.ops
    .map(([name, value]) => (name === "hue-rotate" ? `hue-rotate(${value}deg)` : `${name}(${value})`))
    .join(" ");
}

export function getFilter(id) {
  return FILTERS.find((f) => f.id === id) ?? FILTERS[0];
}

const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function matrixOp(r, g, b, m) {
  return [
    clamp(m[0] * r + m[1] * g + m[2] * b),
    clamp(m[3] * r + m[4] * g + m[5] * b),
    clamp(m[6] * r + m[7] * g + m[8] * b),
  ];
}

// Matriks mengikuti spesifikasi CSS Filter Effects.
const OPS = {
  grayscale(r, g, b, a) {
    const k = 1 - Math.min(1, a);
    return matrixOp(r, g, b, [
      0.2126 + 0.7874 * k, 0.7152 - 0.7152 * k, 0.0722 - 0.0722 * k,
      0.2126 - 0.2126 * k, 0.7152 + 0.2848 * k, 0.0722 - 0.0722 * k,
      0.2126 - 0.2126 * k, 0.7152 - 0.7152 * k, 0.0722 + 0.9278 * k,
    ]);
  },
  sepia(r, g, b, a) {
    const k = 1 - Math.min(1, a);
    return matrixOp(r, g, b, [
      0.393 + 0.607 * k, 0.769 - 0.769 * k, 0.189 - 0.189 * k,
      0.349 - 0.349 * k, 0.686 + 0.314 * k, 0.168 - 0.168 * k,
      0.272 - 0.272 * k, 0.534 - 0.534 * k, 0.131 + 0.869 * k,
    ]);
  },
  saturate(r, g, b, s) {
    return matrixOp(r, g, b, [
      0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
      0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
      0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
    ]);
  },
  "hue-rotate"(r, g, b, deg) {
    const rad = (deg * Math.PI) / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    return matrixOp(r, g, b, [
      0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
      0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
      0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
    ]);
  },
  invert(r, g, b, a) {
    const k = Math.min(1, a);
    return [clamp(r * (1 - k) + (1 - r) * k), clamp(g * (1 - k) + (1 - g) * k), clamp(b * (1 - k) + (1 - b) * k)];
  },
  brightness(r, g, b, v) {
    return [clamp(r * v), clamp(g * v), clamp(b * v)];
  },
  contrast(r, g, b, v) {
    const i = -0.5 * v + 0.5;
    return [clamp(r * v + i), clamp(g * v + i), clamp(b * v + i)];
  },
};

/** Terapkan filter ke ImageData (mutasi in-place). */
export function applyFilterToImageData(imageData, filter) {
  if (!filter || filter.ops.length === 0) return imageData;
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] / 255;
    let g = d[i + 1] / 255;
    let b = d[i + 2] / 255;
    for (const [name, value] of filter.ops) [r, g, b] = OPS[name](r, g, b, value);
    d[i] = Math.round(r * 255);
    d[i + 1] = Math.round(g * 255);
    d[i + 2] = Math.round(b * 255);
  }
  return imageData;
}

/** Apakah canvas 2D mendukung ctx.filter? (Safari < 18 tidak.) */
export function supportsCanvasFilter(ctx) {
  return typeof ctx.filter === "string";
}
