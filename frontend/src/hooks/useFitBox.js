import { useLayoutEffect, useState } from "react";

/**
 * Hitung ukuran terbesar (width x height) dengan rasio tertentu yang muat di dalam
 * elemen `ref`, dikurangi `padding`. Dipakai Editor agar frame pas di stage.
 */
export function useFitBox(ref, ratio, padding = 24) {
  const [box, setBox] = useState(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !ratio) return undefined;

    function measure() {
      const availW = Math.max(0, el.clientWidth - padding * 2);
      const availH = Math.max(0, el.clientHeight - padding * 2);
      if (availW === 0 || availH === 0) return;
      let width = availW;
      let height = width / ratio;
      if (height > availH) {
        height = availH;
        width = height * ratio;
      }
      setBox((prev) =>
        prev && Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5
          ? prev
          : { width, height },
      );
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, ratio, padding]);

  return box;
}
