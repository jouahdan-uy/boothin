# boothin'

> a tiny booth for big little moments. — by zzuhdamn

Web photobooth: pilih frame → foto (timer 5 detik + filter) → review/retake → **pilih background** → stiker & teks → download / QR / email / print.

```
frontend/   React + Vite (deploy: Vercel)
backend/    Hono, jalan di Bun atau Node (deploy: Railway)
```

## Jalankan lokal

```bash
# terminal 1 — backend (http://localhost:3000)
cd backend
cp .env.example .env      # opsional, default sudah jalan untuk dev
bun install
bun run dev

# terminal 2 — frontend (http://localhost:5173)
cd frontend
bun install
bun run dev
```

Kamera di browser hanya jalan di `https://` atau `http://localhost`.

Tanpa konfigurasi apa pun, foto sementara disimpan **di memori server** (hilang saat restart, memang itu tujuannya) dan fitur email membalas "belum diaktifkan".

## Environment

**backend/.env** (lihat `backend/.env.example`)

| Variabel | Fungsi |
| --- | --- |
| `APP_URL` | URL frontend. Dipakai untuk link QR/email (`APP_URL/m/<token>`) dan whitelist CORS |
| `CORS_ORIGINS` | Origin tambahan (pisah koma), opsional |
| `SESSION_TTL_MINUTES` | Lama foto sementara disimpan (default 360) |
| `MAX_UPLOAD_MB`, `MAX_SESSIONS` | Batas ukuran foto dan jumlah sesi aktif |
| `CLOUDINARY_*` | Isi ketiganya untuk menyimpan foto di Cloudinary (otomatis aktif) |
| `RESEND_API_KEY`, `MAIL_FROM` | Aktifkan pengiriman email |
| `OWNER_EMAIL` | Tujuan pesan dari form **Contact** dan **Feedback** (butuh `RESEND_API_KEY` juga). Isi di `.env` / Railway Variables, jangan di-commit |

**frontend/.env** — `VITE_API_URL` (URL backend, lihat `frontend/.env.example`).

## Deploy

- **Frontend → Vercel**: root `frontend`, build `bun run build`. `vercel.json` sudah berisi rewrite SPA (wajib agar `/m/:token` bisa dibuka langsung). Set `VITE_API_URL`.
- **Backend → Railway**: root `backend`, start `bun src/index.ts`. Set `APP_URL` ke URL Vercel. Untuk banyak instance / restart-proof, pakai Cloudinary.

## API

| Method | Path | |
| --- | --- | --- |
| GET | `/api/health` | status + storage + email |
| POST | `/api/sessions` | upload foto final (body `image/jpeg`, atau multipart field `photo`) → `{token,url,expiresAt}` |
| GET | `/api/sessions/:token` | metadata |
| DELETE | `/api/sessions/:token` | hapus lebih awal |
| GET | `/api/photos/:token[?download=1]` | foto |
| POST | `/api/qr` `{token}` | `{url, svg}` — QR berisi link, bukan foto |
| POST | `/api/email` `{token,email}` | kirim email dengan lampiran |
| POST | `/api/message` `{type,name?,email?,message,rating?}` | form Contact / Feedback → email ke `OWNER_EMAIL` (`reply_to` = pengirim). Rate limit 5/10 menit, kolom jebakan bot, isi di-escape, **tidak disimpan di server** |
| POST | `/api/print` | 501 (print saat ini lewat `window.print()`) |

Foto tidak dikirim ke server selama editing — hanya sekali setelah foto final jadi, dan hanya kalau user minta QR/email. Tipe file divalidasi dari isi (magic bytes), ada rate limit upload & email, session kedaluwarsa dibersihkan otomatis.

## Test

```bash
cd backend  && bun test          # 39 test API + kontrak validasi form
cd frontend && bun test          # 125 test geometri frame (semua layout x 3 ketebalan border), bentuk, tema, pattern, filter, validasi form
```

## Navigasi situs

Di halaman Welcome (dan halaman `/m/...` dari QR) ada empat tombol: **About**, **How to use**, **Contact**, **Feedback**.
Semuanya dialog (tanpa pindah halaman): Esc / klik latar menutup, fokus keyboard terkunci di dalam dialog, dan di HP tombolnya jadi ikon.
Teks About dan How to use ada di `frontend/src/components/SiteDialogs.jsx` (angka layout/filter/pattern dihitung dari data, jadi tidak perlu diubah manual).
Contact dan Feedback memakai satu form (`MessageForm.jsx`) yang memanggil `POST /api/message`.

## Frame, tema, filter, icon

- **34 layout frame** (`frontend/src/engine/layouts.js`): strip, wide (menyamping/memanjang), grid, polaroid, film, creative (hati, bulat, bintang, bunga, awan, arch, berlian, oval, scrapbook, dll).
- **41 tema bawaan** (`frontend/src/data/themes.js`): warna polos, gradient, pattern (polka, gingham, hati, bintang, confetti, ombak, ...), dan 4 tema film.
- **29 pattern dari gambar** (`frontend/public/patterns/`, daftar di `src/data/patterns.json`): ditampilkan di halaman **Background** (setelah Review) dengan filter tag. Gambar yang bukan ubin seamless diulang *cermin* supaya sambungannya tidak terlihat.
- **Warna kustom**: color picker + input HEX, atau gradient dua warna.
- **Border** Slim / Medium / Wide supaya pattern terlihat jelas di frame yang marginnya tipis.
- Background bisa diganti lagi di editor (tab *frame*) tanpa kehilangan foto.
- **31 filter** dalam 7 kelompok (`frontend/src/engine/filters.js`).
- **Icon**: `frontend/public/favicon.svg`, `icon-192/512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`, `manifest.webmanifest`.

Menambah **pattern baru**: `python3 scripts/add-patterns.py <folder> --tag cute` (di folder `frontend`), atau lihat `frontend/public/patterns/README.md`.
Menambah layout baru: tambahkan satu `def({...})` di `layouts.js`; `bun test` otomatis memeriksa slot di dalam kanvas, tidak bertumpuk, dan brand tidak menabrak foto.

## Arsitektur frontend (ringkas)

- `engine/layouts.js` — **satu-satunya** sumber geometri frame. Pilihan frame, review, editor, dan export JPG memakai angka yang sama, jadi yang terlihat = yang diekspor.
- `components/FrameArt.jsx` — menggambar frame di DOM dari geometri itu (background lewat `BackgroundCanvas`, bentuk lewat `clip-path`).
- `engine/shapes.js`, `engine/backgrounds.js` — bentuk slot dan background (gradient/pattern) yang dipakai **sama persis** oleh DOM dan export.
- `engine/compositor.js` — menyusun JPG final (menunggu semua gambar & font dulu).
- `engine/capture.js`, `engine/filters.js` — ambil frame kamera (di-crop sesuai slot, mirror, filter; ada fallback untuk Safari tanpa `ctx.filter`).
- `state/` — state sesi di memori (bukan router state).
- `scripts/build-sticker-manifest.mjs` — bangun ulang `stickers.json` dari file PNG yang ada.
