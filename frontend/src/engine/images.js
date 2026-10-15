const imageCache = new Map();

/** Muat gambar (di-cache). Menolak kalau gagal. */
export function loadImage(src) {
  if (imageCache.has(src)) return imageCache.get(src);
  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => {
      imageCache.delete(src);
      reject(new Error(`Gagal memuat gambar: ${src.slice(0, 60)}`));
    };
    image.src = src;
  });
  imageCache.set(src, promise);
  return promise;
}
