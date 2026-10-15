#!/usr/bin/env python3
"""
Tambah pattern baru ke galeri.

  python3 scripts/add-patterns.py <folder-berisi-gambar> [--tag cute|christmas|halloween|stars|bold|classic]

Untuk tiap gambar (jpg/png/webp): disalin ke public/patterns/<id>.jpg (dikompres), dibuatkan
thumbnail di public/patterns/thumbs/<id>.webp, lalu ditambahkan ke src/data/patterns.json.
Nama tampil diambil dari nama file ("red bows.jpg" -> "Red Bows"); edit patterns.json untuk mengubahnya.
Butuh: pip install pillow numpy
"""
import argparse, json, re, sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "patterns"
MANIFEST = ROOT / "src" / "data" / "patterns.json"
TAGS = ["cute", "christmas", "halloween", "stars", "bold", "classic"]

ap = argparse.ArgumentParser()
ap.add_argument("folder")
ap.add_argument("--tag", default="cute", choices=TAGS)
args = ap.parse_args()

(OUT / "thumbs").mkdir(parents=True, exist_ok=True)
entries = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else []
taken = {e["id"] for e in entries}

added = 0
for path in sorted(Path(args.folder).iterdir()):
    if path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
        continue
    base = re.sub(r"[^a-z0-9]+", "-", path.stem.lower()).strip("-")[:40] or "pattern"
    pid, n = base, 2
    while pid in taken:
        pid, n = f"{base}-{n}", n + 1
    taken.add(pid)

    im = Image.open(path).convert("RGB")
    w, h = im.size
    im.save(OUT / f"{pid}.jpg", "JPEG", quality=84, optimize=True, progressive=True)
    th = im.copy()
    th.thumbnail((240, 427), Image.LANCZOS)
    th.save(OUT / "thumbs" / f"{pid}.webp", "WEBP", quality=78, method=6)

    avg = np.asarray(im.resize((48, 48), Image.BOX), float).reshape(-1, 3).mean(axis=0)
    lum = 0.2126 * avg[0] + 0.7152 * avg[1] + 0.0722 * avg[2]
    entries.append({
        "id": pid,
        "name": re.sub(r"\s+", " ", re.sub(r"[-_]+", " ", path.stem)).strip().title()[:28] or pid,
        "tag": args.tag,
        "file": f"{pid}.jpg",
        "thumb": f"thumbs/{pid}.webp",
        "w": w,
        "h": h,
        "fit": round(min(1.0, min(w, h) * 2.1 / 1200), 2),  # resolusi rendah -> ubin lebih kecil agar tidak buram
        "base": "#%02x%02x%02x" % tuple(int(round(x)) for x in avg),
        "dark": bool(lum < 110),
    })
    added += 1
    print("+", pid)

MANIFEST.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n")
print(f"{added} pattern ditambahkan, total {len(entries)}.")
