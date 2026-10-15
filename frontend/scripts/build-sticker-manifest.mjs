// Bangun public/stickers/stickers.json dari file PNG yang benar-benar ada.
// Jalankan: node scripts/build-sticker-manifest.mjs
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../public/stickers/", import.meta.url).pathname;
const manifestPath = join(root, "stickers.json");

const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : { stickers: [] };
const known = new Map((previous.stickers ?? []).map((s) => [s.id, s]));

const categories = readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== "thumbs")
  .map((d) => d.name)
  .sort();

const stickers = [];
const dropped = [];

for (const category of categories) {
  const files = readdirSync(join(root, category)).filter((f) => f.endsWith(".png")).sort();
  for (const file of files) {
    const id = file.replace(/\.png$/, "");
    const old = known.get(id);
    const entry = {
      id,
      name: old?.name ?? id.replace(/_/g, " "),
      category,
      src: `/stickers/${category}/${file}`,
    };
    if (existsSync(join(root, "thumbs", category, `${id}.webp`))) {
      entry.thumb = `/stickers/thumbs/${category}/${id}.webp`;
    }
    if (old?.source) entry.source = old.source;
    stickers.push(entry);
  }
}

for (const old of previous.stickers ?? []) {
  if (!stickers.some((s) => s.id === old.id)) dropped.push(old.src);
}

writeFileSync(manifestPath, JSON.stringify({ version: 2, stickers }, null, 2) + "\n");
console.log(`${stickers.length} stiker, ${categories.length} kategori (${categories.join(", ")})`);
if (dropped.length) console.log(`${dropped.length} entri lama dibuang karena filenya tidak ada:\n  ${dropped.join("\n  ")}`);
