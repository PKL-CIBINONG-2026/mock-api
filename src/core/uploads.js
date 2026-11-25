/**
 * uploads.js — Helper upload gambar (multipart/form-data) yang dipakai ke-4 studi kasus.
 *
 * Setiap resource punya satu sub-endpoint gambar:
 *   POST   /api/v1/<resource>/:id/<sub>   (FormData field "image") → 201
 *   DELETE /api/v1/<resource>/:id/<sub>   → 204
 * File disimpan di IndexedDB (store "files") dan dilayani oleh GET /api/v1/uploads/:fileId.
 */
import { saveAll, putFile, deleteFile } from './db.js';
import { json, empty, error, badRequest, notFound, methodNotAllowed } from './http.js';

/** Nama sub-endpoint & field gambar per resource. */
export const IMAGE_ROUTES = {
  articles: { sub: 'cover', field: 'coverImageUrl', label: 'cover artikel' },
  bookings: { sub: 'attachment', field: 'attachmentUrl', label: 'lampiran reservasi' },
  users: { sub: 'avatar', field: 'avatarUrl', label: 'avatar user' },
  products: { sub: 'image', field: 'imageUrl', label: 'foto produk' },
};

export const FORM_FIELD = 'image';
export const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

const FILE_RE = /\/api\/v1\/uploads\/(img-[a-z0-9-]+)$/;

export function fileIdFromUrl(url) {
  const m = typeof url === 'string' ? url.match(FILE_RE) : null;
  return m ? m[1] : null;
}

/** Hapus file di IndexedDB jika url menunjuk ke file upload mock. */
export async function removeImageByUrl(url) {
  const id = fileIdFromUrl(url);
  if (id) await deleteFile(id);
}

const newFileId = () => `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Validasi & simpan gambar dari FormData.
 * @returns {Promise<{ error: Response } | { url: string, path: string }>}
 */
export async function storeImage(ctx) {
  if (!ctx.form) {
    return {
      error: error(415, 'Upload gambar harus memakai Content-Type multipart/form-data (kirim body berupa FormData)', {
        hint: "const fd = new FormData(); fd.append('image', fileInput.files[0]); fetch(url, { method: 'POST', body: fd });",
      }),
    };
  }
  const file = ctx.form.get(FORM_FIELD);
  if (!file || typeof file === 'string') {
    return { error: badRequest(`Field file "${FORM_FIELD}" wajib diisi pada FormData`, { field: FORM_FIELD, receivedFields: [...ctx.form.keys()] }) };
  }
  if (!IMAGE_TYPES.includes(file.type)) {
    return { error: error(415, `Tipe file "${file.type || 'tidak diketahui'}" tidak didukung`, { allowedTypes: IMAGE_TYPES }) };
  }
  if (file.size === 0) return { error: badRequest('File kosong (0 byte)') };
  if (file.size > MAX_SIZE) {
    return { error: error(413, `Ukuran file ${(file.size / 1024 / 1024).toFixed(2)} MB melebihi batas 2 MB`, { maxBytes: MAX_SIZE, receivedBytes: file.size }) };
  }
  const id = newFileId();
  await putFile(id, {
    blob: file.slice(0, file.size, file.type),
    name: file.name || `${id}`,
    type: file.type,
    size: file.size,
    createdAt: new Date().toISOString(),
  });
  return { url: `${ctx.baseUrl}/uploads/${id}`, path: `/api/v1/uploads/${id}` };
}

/**
 * Tangani POST / DELETE /<resource>/:id/<sub>.
 * `items[idx]` adalah data yang sudah dipastikan ada.
 */
export async function imageEndpoint(ctx, { collection, items, idx }) {
  const { field, label } = IMAGE_ROUTES[collection];
  const existing = items[idx];

  if (ctx.method === 'POST') {
    const stored = await storeImage(ctx);
    if (stored.error) return stored.error;
    const updated = { ...existing, [field]: stored.url };
    if ('updatedAt' in existing) updated.updatedAt = new Date().toISOString();
    items[idx] = updated;
    await saveAll(collection, items);
    if (existing[field] && existing[field] !== stored.url) await removeImageByUrl(existing[field]);
    return json(201, updated, { Location: stored.path });
  }

  if (ctx.method === 'DELETE') {
    if (!existing[field]) return notFound(`Data ${existing.id} belum memiliki ${label}`);
    await removeImageByUrl(existing[field]);
    items[idx] = { ...existing, [field]: null };
    await saveAll(collection, items);
    return empty(204);
  }

  return methodNotAllowed(['POST', 'DELETE']);
}
