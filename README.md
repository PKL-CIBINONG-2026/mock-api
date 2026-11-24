# PKL Mock API — Multi-Domain RESTful Sandbox

Stateful RESTful Mock API untuk latihan `fetch()` (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`) peserta PKL.
Berjalan **100% di browser** (Service Worker + IndexedDB) sehingga bisa di-host di **GitHub Pages** tanpa backend dan tanpa `npm install`.

Ada 4 studi kasus:

| # | Resource | Studi kasus |
|---|----------|-------------|
| 1 | `/api/v1/articles` | CMS Artikel & Blog |
| 2 | `/api/v1/bookings` | Reservasi Ruangan Meeting |
| 3 | `/api/v1/users` | Profil & Pengaturan Akun |
| 4 | `/api/v1/products` | Inventaris & Stock Opname Gudang |

## Cara kerja

1. **Service Worker (`sw.js`)** — di halaman GitHub Pages, setiap `fetch('./api/v1/...')` dicegat oleh Service Worker, jadi request terlihat nyata di **DevTools → Network** lengkap dengan status code & header.
2. **Client SDK (`client.js`)** — untuk proyek di `localhost` (Live Server). SDK membungkus `window.fetch` dan mencegat URL `https://mock-api.pkl.local/api/v1/...`.
3. **Playground (`index.html`)** — dokumentasi endpoint, tester request seperti Postman mini, tabel isi database live, tombol Reset.

Semua mode memakai router yang sama: `src/core/router.js`.

## Pakai di proyek localhost

Tambahkan SDK **sebelum** script kamu (keduanya `type="module"`):

```html
<script type="module" src="https://pkl-cibinong-2026.github.io/mock-api/client.js"></script>
<script type="module" src="./app.js"></script>
```

```js
// app.js
const BASE_URL = 'https://mock-api.pkl.local/api/v1';

// GET + pagination
const res = await fetch(`${BASE_URL}/products?lowStock=true&_page=1&_limit=5`);
console.log(res.status, res.headers.get('X-Total-Count'));
const products = await res.json();

// POST
const created = await fetch(`${BASE_URL}/bookings`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    roomId: 'ROOM-C', bookedBy: 'Raka', date: '2026-11-25',
    startTime: '14:00', endTime: '15:00', participants: 4,
  }),
});
if (created.status === 409) console.warn('Jadwal bentrok', await created.json());
console.log(created.headers.get('Location'));

// PATCH (deep merge preferences)
await fetch(`${BASE_URL}/users/usr-301`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ preferences: { theme: 'light' } }),
});

// DELETE → 204 tanpa body, JANGAN panggil res.json()
const del = await fetch(`${BASE_URL}/articles/art-106`, { method: 'DELETE' });
if (del.status === 204) console.log('Terhapus');

// HEAD → cek slug
const head = await fetch(`${BASE_URL}/articles/check-slug/belajar-fetch`, { method: 'HEAD' });
console.log(head.status === 404 ? 'Slug tersedia' : 'Slug sudah dipakai');
```

Data tersimpan di IndexedDB milik origin kamu (misal `http://localhost:5500`). Reset dari console: `PKLMockAPI.reset()`.

> Tombol **Copy Localhost SDK Snippet** di halaman Playground menyalin tag `<script>` dengan URL GitHub Pages yang aktif.

## Aturan HTTP yang diterapkan

| Status | Kapan |
|--------|-------|
| `200 OK` | GET, PUT, PATCH berhasil; HEAD ditemukan |
| `201 Created` | POST berhasil + header `Location: /api/v1/<resource>/<id>` |
| `204 No Content` | DELETE berhasil — **body kosong (`null`)** |
| `400 Bad Request` | JSON tidak valid, body kosong, PUT kurang field wajib, PATCH dengan key tidak dikenal |
| `404 Not Found` | ID tidak ditemukan / slug tersedia (HEAD) |
| `405 Method Not Allowed` | Method tidak didukung di endpoint tersebut |
| `409 Conflict` | Slug artikel / SKU produk duplikat, jadwal ruangan bentrok |
| `422 Unprocessable Entity` | Validasi nilai gagal (email salah/duplikat, stok/harga negatif, `startTime >= endTime`) |

- **PUT = full replacement.** Semua field wajib harus dikirim (400 + daftar `missingFields` jika kurang). Field opsional yang tidak dikirim menjadi `null`.
- **PATCH = partial update.** Body kosong dan key asing ditolak (400). Data digabung `{ ...existing, ...payload }`; `users.preferences` di-*deep merge*.
- **Pagination:** `?_page=1&_limit=10` di semua endpoint list, total hasil filter ada di header `X-Total-Count`.
- **Latency:** delay acak 300–500 ms. Kirim header `X-Mock-Delay: 0` untuk mematikan, atau `X-Mock-Delay: 2000` untuk delay tetap.

## Endpoint

### 1. Articles — `/api/v1/articles`
- `GET /articles?status=published|draft&category=&tag=&search=`
- `GET /articles/:id`
- `HEAD /articles/check-slug/:slug` → 200 (dipakai) / 404 (tersedia)
- `POST /articles` — wajib `title, slug, content, category, tags[]` (default `status: draft`, `isPinned: false`, `views: 0`)
- `PUT /articles/:id` — wajib `title, slug, content, category, tags, status, isPinned` (`views` dipertahankan)
- `PATCH /articles/:id` — `title, content, category, tags, status, isPinned, views`
- `DELETE /articles/:id`

### 2. Bookings — `/api/v1/bookings`
- `GET /bookings?roomId=&date=&status=confirmed|checked_in|cancelled`
- `GET /bookings/:id`
- `POST /bookings` — wajib `roomId, bookedBy, date (YYYY-MM-DD), startTime (HH:mm), endTime (HH:mm), participants (>0)`, opsional `notes`
- `PUT /bookings/:id` — wajib field POST + `status`, opsional `notes` (→ `null` jika tidak dikirim)
- `PATCH /bookings/:id` — `status, notes, participants`
- `DELETE /bookings/:id`

### 3. Users — `/api/v1/users`
- `GET /users?search=`, `GET /users/:id`
- `POST /users` — wajib `fullName, email, phone`
- `PUT /users/:id` — wajib `fullName, email, phone`, opsional `bio, address, avatarUrl` (→ `null`), `preferences` dipertahankan
- `PATCH /users/:id` — `phone, bio, address, avatarUrl, preferences{theme, twoFactorEnabled, emailNotifications}`
- `DELETE /users/:id`

### 4. Products — `/api/v1/products`
- `GET /products?lowStock=true&category=&search=`
- `GET /products/:id`
- `POST /products` / `PUT /products/:id` — wajib `sku, name, category, costPrice, sellPrice, stock, minStock, supplier`
- `PATCH /products/:id` — `stock, minStock, sellPrice`
- `DELETE /products/:id`

## Menjalankan secara lokal

Tidak perlu build. Jalankan static server apa saja dari root repo, contoh:

```bash
npx serve .
# atau
python -m http.server 8080
```

Lalu buka `http://localhost:8080/`. (Service Worker hanya jalan di `https://` atau `localhost`.)

## Deploy ke GitHub Pages

1. Push ke branch `main`.
2. Di GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Workflow `.github/workflows/deploy.yml` akan otomatis mem-publish root repo ke `https://<username>.github.io/<repo>/`.

Semua path relatif (`./sw.js`, `./api/v1/...`), jadi aman di subpath GitHub Pages.

## Struktur

```text
index.html, styles.css   UI Playground & DB Inspector
sw.js                    Service Worker interceptor (module worker)
client.js                Drop-in SDK untuk localhost
src/app.js               Registrasi SW & UI dokumentasi (hash router, Try it, Live data)
src/docs-data.js         Konten dokumentasi 4 kategori (parameter, body, response)
src/core/                db.js (IndexedDB), http.js (Response helper), router.js
src/data/seeds.js        Data awal
src/handlers/            4 handler studi kasus
```

> Catatan browser: Service Worker bertipe module didukung Chrome/Edge 91+, Safari 15+, dan Firefox versi terbaru. Jika SW tidak aktif (misal setelah hard reload), Playground otomatis memakai router secara langsung (*direct mode*).
