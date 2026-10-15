import { useCallback, useMemo, useState } from "react";
import { BoothContext } from "./boothContext";

/**
 * State sesi photobooth (in-memory). Sengaja BUKAN router state: foto adalah data URL
 * besar, dan history.state punya batas ukuran di beberapa browser.
 */

const emptySlots = (n) => Array.from({ length: n }, () => null);

export function BoothProvider({ children }) {
  const [frame, setFrame] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [stickers, setStickers] = useState([]);

  /**
   * Pilih frame (+ tema). Layout yang sama dengan sebelumnya mempertahankan foto & stiker;
   * hanya temanya yang diganti kalau berbeda.
   */
  const selectFrame = useCallback(
    (next) => {
      if (frame && frame.id === next.id) {
        if (frame.themeId !== next.themeId) setFrame(next);
        return;
      }
      setFrame(next);
      setPhotos(emptySlots(next.slots));
      setStickers([]);
    },
    [frame],
  );

  /** Ketebalan border frame (px kanvas); foto & stiker tidak berubah. */
  const setInset = useCallback((inset) => {
    setFrame((current) => (current && current.inset !== inset ? { ...current, inset } : current));
  }, []);

  /** Ganti tema (background) frame yang sedang dipakai; foto & stiker tidak berubah. */
  const setTheme = useCallback((themeId) => {
    setFrame((current) => (current && current.themeId !== themeId ? { ...current, themeId } : current));
  }, []);

  const setPhoto = useCallback((index, dataUrl) => {
    setPhotos((current) => {
      const copy = [...current];
      copy[index] = dataUrl;
      return copy;
    });
  }, []);

  const clearPhotos = useCallback(() => {
    setPhotos(frame ? emptySlots(frame.slots) : []);
  }, [frame]);

  const reset = useCallback(() => {
    setFrame(null);
    setPhotos([]);
    setStickers([]);
  }, []);

  const value = useMemo(
    () => ({
      frame,
      photos,
      stickers,
      setStickers,
      selectFrame,
      setTheme,
      setInset,
      setPhoto,
      clearPhotos,
      reset,
      isComplete: Boolean(frame) && photos.length === frame.slots && photos.every(Boolean),
    }),
    [frame, photos, stickers, selectFrame, setTheme, setInset, setPhoto, clearPhotos, reset],
  );

  return <BoothContext.Provider value={value}>{children}</BoothContext.Provider>;
}
