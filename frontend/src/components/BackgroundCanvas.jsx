import { useEffect, useMemo, useRef } from "react";

import { drawBackground, prepareBackground } from "../engine/backgrounds.js";

/**
 * Menggambar background sebuah tema memakai fungsi yang SAMA dengan export final,
 * jadi pattern/gradient di layar identik dengan hasil JPG.
 * `zoom` memperbesar motif (untuk swatch kecil agar polanya tetap terlihat).
 */
export default function BackgroundCanvas({ bg: source, zoom = 1, className = "" }) {
  const ref = useRef(null);
  // Swatch yang diperbesar tidak memakai grain (di ukuran kecil, bintik kertas jadi noda kasar).
  const bg = useMemo(() => (zoom > 1 && source.grain ? { ...source, grain: 0 } : source), [source, zoom]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;

    let cancelled = false;
    let resources = {};
    let raf = 0;

    const paint = () => {
      if (cancelled || !canvas.clientWidth || !canvas.clientHeight) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.min(1400, Math.max(32, Math.round(canvas.clientWidth * dpr)));
      const h = Math.max(1, Math.round((w * canvas.clientHeight) / canvas.clientWidth));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const ctx = canvas.getContext("2d");
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.scale(zoom, zoom);
      drawBackground(ctx, w / zoom, h / zoom, bg, resources);
    };

    prepareBackground(bg).then((loaded) => {
      if (cancelled) return;
      resources = loaded;
      paint();
    });

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(paint);
    });
    observer.observe(canvas);

    return () => {
      cancelled = true;
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [bg, zoom]);

  return <canvas ref={ref} className={`frame-art-bg ${className}`.trim()} aria-hidden="true" />;
}
