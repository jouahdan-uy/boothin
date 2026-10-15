import { LAYOUTS } from "../engine/layouts.js";

export const categories = ["all", "strip", "wide", "grid", "polaroid", "film", "creative"];

/**
 * Daftar frame untuk UI. Diturunkan dari engine/layouts.js supaya nama, jumlah foto,
 * dan rasio selalu cocok dengan geometri yang sebenarnya dipakai.
 * Tema (background) dipilih terpisah: lihat data/themes.js.
 */
export const frames = LAYOUTS.map((layout) => ({
  id: layout.id,
  name: layout.name,
  category: layout.category,
  ratio: layout.ratio,
  slots: layout.slots,
  layout: layout.id,
  themeSet: layout.themeSet,
  defaultTheme: layout.defaultTheme,
}));
