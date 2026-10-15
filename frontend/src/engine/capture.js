import { applyFilterToImageData, filterToCss, supportsCanvasFilter } from "./filters.js";

/**
 * Ambil satu frame dari <video> persis seperti yang terlihat di preview:
 * di-crop "cover" ke rasio elemen video yang tampil, di-mirror kalau preview di-mirror,
 * dan difilter. Hasil: JPEG data URL (lebar maks `maxWidth` supaya memori tetap ringan).
 */
export function captureFromVideo(video, { filter, mirrored = true, maxWidth = 1280, quality = 0.92 }) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) throw new Error("Video belum siap.");

  const boxW = video.clientWidth || vw;
  const boxH = video.clientHeight || vh;
  const target = boxW / boxH;

  let sw;
  let sh;
  if (vw / vh > target) {
    sh = vh;
    sw = vh * target;
  } else {
    sw = vw;
    sh = vw / target;
  }
  const sx = (vw - sw) / 2;
  const sy = (vh - sh) / 2;

  const outW = Math.round(Math.min(sw, maxWidth));
  const outH = Math.round(outW / target);

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas tidak tersedia.");

  const native = supportsCanvasFilter(ctx);
  ctx.save();
  if (native) ctx.filter = filterToCss(filter);
  if (mirrored) {
    ctx.translate(outW, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, outW, outH);
  ctx.restore();

  if (!native && filter && filter.ops.length > 0) {
    const data = ctx.getImageData(0, 0, outW, outH);
    ctx.putImageData(applyFilterToImageData(data, filter), 0, 0);
  }

  return canvas.toDataURL("image/jpeg", quality);
}
