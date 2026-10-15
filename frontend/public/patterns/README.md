# Pattern background

Isi folder ini = galeri "My patterns" di halaman Background.

```
public/patterns/<id>.jpg           gambar penuh (dipakai di frame & hasil export)
public/patterns/thumbs/<id>.webp   thumbnail 240px untuk galeri (opsional, otomatis pakai gambar penuh kalau tidak ada)
src/data/patterns.json             daftar: id, nama tampil, tag, file, thumb, fit, base, dark
```

## Menambah pattern

Cara cepat (butuh `pip install pillow numpy`), dari folder `frontend`:

```bash
python3 scripts/add-patterns.py ~/Downloads/pattern-baru --tag cute
```

Tag yang tersedia: `cute`, `christmas`, `halloween`, `stars`, `bold`, `classic`.
Nama tampil diambil dari nama file; ubah di `src/data/patterns.json` kalau perlu.

Cara manual: taruh `nama.jpg` di folder ini, lalu tambahkan satu objek di `patterns.json`
(`id`, `name`, `tag`, `file`; `thumb` boleh dikosongkan).

## Cara gambar dipasang

Mode `mirror` (bawaan semua pattern): gambar diulang **cermin** (tiap ubin dibalik bergantian) sehingga
tepinya selalu menyambung, walau gambarnya wallpaper biasa dan bukan pola seamless. Sisi pendek gambar
disesuaikan dengan sisi pendek frame x `fit` (`fit` kecil = motif lebih kecil/rapat; dipakai otomatis
untuk gambar beresolusi rendah supaya tidak buram).

Ingin satu gambar menutupi seluruh frame (tanpa pengulangan), mis. ilustrasi? Di `src/data/themes.js`
ubah `mode: "mirror"` menjadi `mode: "cover"` pada tema itu.

Tema lain di `themes.js` (warna, gradient, pattern buatan kode) tidak terpengaruh.
