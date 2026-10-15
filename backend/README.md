# boothin' backend

Hono + Bun (atau Node). Lihat README di root untuk API, environment, dan deploy.

```bash
bun install
bun run dev        # watch
bun test           # 25 test
bun run typecheck
```

Entry: `src/index.ts` (Bun; otomatis pakai `@hono/node-server` bila dijalankan di Node).
`src/app.ts` merakit aplikasi (`createApp`) dan dipakai langsung oleh test.

Folder `_unused/` berisi sisa file dari rancangan backend sebelumnya yang ditemukan di folder kerja
(tidak dipakai dan tidak ikut di-typecheck). Aman dihapus kalau sudah tidak dibutuhkan.
