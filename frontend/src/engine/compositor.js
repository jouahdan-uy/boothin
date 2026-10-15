import { drawBackground, prepareBackground } from "./backgrounds.js";
import { loadImage } from "./images.js";
import { getGeometry } from "./layouts.js";
import { clipShape, fillShape } from "./shapes.js";

export { loadImage };

export const TEXT_FONT_FAMILY = '"Playfair Display", Georgia, serif';
export const BRAND_FONT = `italic 600 %spx ${TEXT_FONT_FAMILY}`;

/** Bayangan kartu polaroid: dinyatakan relatif terhadap lebar kanvas (sama dengan CSS `cqw` di DOM). */
export const CARD_SHADOW = { blur: 0.016, offsetY: 0.005, color: "rgba(0,0,0,0.2)" };

/** Hitung sumber crop "cover" (sama dengan CSS object-fit: cover, posisi tengah). */
export function coverCrop(imgW, imgH, boxW, boxH) {
  const imgRatio = imgW / imgH;
  const boxRatio = boxW / boxH;
  if (imgRatio > boxRatio) {
    const sw = imgH * boxRatio;
    return { sx: (imgW - sw) / 2, sy: 0, sw, sh: imgH };
  }
  const sh = imgW / boxRatio;
  return { sx: 0, sy: (imgH - sh) / 2, sw: imgW, sh };
}

function drawCover(ctx, image, rect) {
  const { sx, sy, sw, sh } = coverCrop(image.naturalWidth, image.naturalHeight, rect.w, rect.h);
  ctx.drawImage(image, sx, sy, sw, sh, rect.x, rect.y, rect.w, rect.h);
}

function rotateAround(ctx, rect, degrees) {
  if (!degrees) return;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  ctx.translate(cx, cy);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.translate(-cx, -cy);
}

async function ensureFonts(sizes) {
  if (!document.fonts?.load) return;
  try {
    await Promise.all(sizes.map((size) => document.fonts.load(BRAND_FONT.replace("%s", String(size)), "boothin'")));
  } catch {
    /* font fallback ke Georgia/serif */
  }
}

function drawDecor(ctx, d) {
  ctx.save();
  rotateAround(ctx, d, d.rot);
  fillShape(ctx, d.shape, d, d.color, d.r);
  ctx.restore();
}

function drawSlot(ctx, g, s, image) {
  ctx.save();
  rotateAround(ctx, s.group, s.rot);

  if (s.card) {
    ctx.save();
    ctx.shadowColor = CARD_SHADOW.color;
    ctx.shadowBlur = CARD_SHADOW.blur * g.width;
    ctx.shadowOffsetY = CARD_SHADOW.offsetY * g.width;
    ctx.fillStyle = g.paper;
    ctx.fillRect(s.group.x, s.group.y, s.group.w, s.group.h);
    ctx.restore();
  }

  if (s.border > 0) {
    const b = s.border;
    fillShape(ctx, s.shape, { x: s.x - b, y: s.y - b, w: s.w + b * 2, h: s.h + b * 2 }, g.paper, s.r + b);
  }

  ctx.save();
  clipShape(ctx, s.shape, s, s.r);
  drawCover(ctx, image, s);
  ctx.restore();

  ctx.restore();
}

function drawBrand(ctx, g) {
  const b = g.brand;
  ctx.save();
  ctx.translate(b.x, b.y);
  if (b.rot) ctx.rotate((b.rot * Math.PI) / 180);
  ctx.font = BRAND_FONT.replace("%s", String(b.size));
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (b.pill) {
    // Sama dengan CSS di FrameArt: tinggi 1.7em, padding horizontal 0.9em.
    const width = ctx.measureText("boothin'").width + b.size * 1.8;
    const height = b.size * 1.7;
    ctx.fillStyle = b.pillColor;
    ctx.beginPath();
    ctx.roundRect(-width / 2, -height / 2, width, height, height / 2);
    ctx.fill();
  }

  ctx.fillStyle = b.color;
  ctx.fillText("boothin'", 0, 0);
  ctx.restore();
}

/**
 * Susun foto final: background, dekorasi, slot (kartu/border/foto), brand, lalu stiker
 * (urutan array = urutan layer). Return Blob JPEG.
 */
export async function composeFinal({ frame, photos, stickers = [], quality = 0.95 }) {
  const g = getGeometry(frame);

  const missing = g.slots.findIndex((_, i) => !photos[i]);
  if (missing !== -1) throw new Error(`Foto ke-${missing + 1} belum ada.`);

  const canvas = document.createElement("canvas");
  canvas.width = g.width;
  canvas.height = g.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas tidak tersedia.");

  await ensureFonts([g.brand.size]);

  // Muat semua gambar dulu secara paralel, baru gambar berurutan (tidak ada race).
  const [photoImages, resources, stickerImages] = await Promise.all([
    Promise.all(g.slots.map((_, i) => loadImage(photos[i]))),
    prepareBackground(g.bg),
    Promise.all(
      stickers.map((s) =>
        s.type === "text"
          ? null
          : loadImage(s.src).catch((error) => {
              console.warn("Stiker dilewati:", error.message);
              return null;
            }),
      ),
    ),
  ]);

  drawBackground(ctx, g.width, g.height, g.bg, resources);

  g.decor.filter((d) => d.layer !== "above").forEach((d) => drawDecor(ctx, d));
  g.slots.forEach((s, i) => drawSlot(ctx, g, s, photoImages[i]));
  g.decor.filter((d) => d.layer === "above").forEach((d) => drawDecor(ctx, d));
  drawBrand(ctx, g);

  // Stiker: x/y dalam persen frame, size dalam persen lebar frame.
  stickers.forEach((s, i) => {
    ctx.save();
    ctx.translate((s.x / 100) * g.width, (s.y / 100) * g.height);
    ctx.rotate((s.rotation * Math.PI) / 180);

    if (s.type === "text") {
      const px = (s.size / 100) * g.width;
      ctx.font = BRAND_FONT.replace("%s", px.toFixed(2));
      ctx.fillStyle = s.color || g.ink;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(s.text, 0, 0);
    } else if (stickerImages[i]) {
      const img = stickerImages[i];
      const w = (s.size / 100) * g.width;
      const h = w * (img.naturalHeight / img.naturalWidth);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    }
    ctx.restore();
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Gagal membuat JPG."))),
      "image/jpeg",
      quality,
    );
  });
}
