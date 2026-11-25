/**
 * Studi Kasus 1: CMS Artikel & Blog — /api/v1/articles
 */
import { getAll, saveAll } from '../core/db.js';
import { imageEndpoint, removeImageByUrl, IMAGE_ROUTES } from '../core/uploads.js';
import {
  json, empty, notFound, conflict, methodNotAllowed, paginate, nextId,
  isNonEmptyString, checkPayload, checkPatch, checkBodyId, validationFailed,
} from '../core/http.js';

const COLLECTION = 'articles';
const BASE = '/api/v1/articles';
const STATUSES = ['draft', 'published'];
const POST_REQUIRED = ['title', 'slug', 'content', 'category', 'tags'];
const PUT_REQUIRED = [...POST_REQUIRED, 'status', 'isPinned'];
const PATCH_ALLOWED = ['title', 'content', 'category', 'tags', 'status', 'isPinned', 'views'];
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validate(data) {
  const errors = [];
  for (const f of ['title', 'content', 'category']) {
    if (f in data && !isNonEmptyString(data[f])) errors.push({ field: f, message: `${f} harus berupa string dan tidak boleh kosong` });
  }
  if ('slug' in data && !(typeof data.slug === 'string' && SLUG_RE.test(data.slug))) {
    errors.push({ field: 'slug', message: 'slug hanya boleh huruf kecil, angka, dan tanda "-" (contoh: belajar-fetch-api)' });
  }
  if ('tags' in data && !(Array.isArray(data.tags) && data.tags.every(isNonEmptyString))) {
    errors.push({ field: 'tags', message: 'tags harus berupa array string, contoh: ["javascript", "async"]' });
  }
  if ('status' in data && !STATUSES.includes(data.status)) {
    errors.push({ field: 'status', message: `status harus salah satu dari: ${STATUSES.join(', ')}` });
  }
  if ('isPinned' in data && typeof data.isPinned !== 'boolean') {
    errors.push({ field: 'isPinned', message: 'isPinned harus boolean (true/false)' });
  }
  if ('views' in data && !(Number.isInteger(data.views) && data.views >= 0)) {
    errors.push({ field: 'views', message: 'views harus bilangan bulat >= 0' });
  }
  return errors;
}

const now = () => new Date().toISOString();

export async function handle(ctx) {
  const { method, params, query, body } = ctx;
  const items = await getAll(COLLECTION);

  // HEAD /articles/check-slug/:slug
  if (params[0] === 'check-slug') {
    if (method !== 'HEAD') return methodNotAllowed(['HEAD']);
    if (params.length !== 2) return empty(404);
    return empty(items.some((a) => a.slug === params[1]) ? 200 : 404);
  }

  // Koleksi: /articles
  if (params.length === 0) {
    if (method === 'GET') {
      let result = items;
      if (query.status) result = result.filter((a) => a.status === query.status);
      if (query.category) result = result.filter((a) => a.category.toLowerCase() === query.category.toLowerCase());
      if (query.tag) result = result.filter((a) => a.tags.map((t) => t.toLowerCase()).includes(query.tag.toLowerCase()));
      if (query.search) result = result.filter((a) => a.title.toLowerCase().includes(query.search.toLowerCase()));
      const page = paginate(result, query);
      if (page.error) return page.error;
      return json(200, page.data, { 'X-Total-Count': page.total });
    }
    if (method === 'POST') {
      const invalid = checkPayload(body, { required: POST_REQUIRED });
      if (invalid) return invalid;
      const errors = validate(body);
      if (errors.length) return validationFailed(errors);
      const dup = items.find((a) => a.slug === body.slug);
      if (dup) return conflict(`Slug "${body.slug}" sudah dipakai oleh artikel ${dup.id}`, { field: 'slug', existingId: dup.id });
      const article = {
        id: nextId(items, 'art', 101),
        title: body.title,
        slug: body.slug,
        content: body.content,
        category: body.category,
        tags: body.tags,
        status: 'draft',
        isPinned: false,
        views: 0,
        coverImageUrl: null,
        updatedAt: now(),
      };
      await saveAll(COLLECTION, [...items, article]);
      return json(201, article, { Location: `${BASE}/${article.id}` });
    }
    return methodNotAllowed(['GET', 'HEAD', 'POST']);
  }

  const SUB = IMAGE_ROUTES[COLLECTION].sub;
  if (params.length > 2 || (params.length === 2 && params[1] !== SUB)) return notFound('Endpoint tidak ditemukan');

  const id = params[0];

  // Upload / hapus gambar: /:id/<sub>
  if (params.length === 2) {
    const imgIdx = items.findIndex((x) => x.id === id);
    if (imgIdx === -1) return notFound(`Data dengan id "${id}" tidak ditemukan`);
    return imageEndpoint(ctx, { collection: COLLECTION, items, idx: imgIdx });
  }
  if (!['GET', 'PUT', 'PATCH', 'DELETE'].includes(method)) return methodNotAllowed(['GET', 'HEAD', 'PUT', 'PATCH', 'DELETE']);
  const idx = items.findIndex((a) => a.id === id);
  if (idx === -1) return notFound(`Artikel dengan id "${id}" tidak ditemukan`);
  const existing = items[idx];

  if (method === 'GET') return json(200, existing);

  if (method === 'PUT') {
    const invalid = checkPayload(body, { required: PUT_REQUIRED, optional: ['id'] }) || checkBodyId(body, id);
    if (invalid) return invalid;
    const errors = validate(body);
    if (errors.length) return validationFailed(errors);
    const dup = items.find((a) => a.slug === body.slug && a.id !== id);
    if (dup) return conflict(`Slug "${body.slug}" sudah dipakai oleh artikel ${dup.id}`, { field: 'slug', existingId: dup.id });
    const replaced = {
      id,
      title: body.title,
      slug: body.slug,
      content: body.content,
      category: body.category,
      tags: body.tags,
      status: body.status,
      isPinned: body.isPinned,
      views: existing.views,
      coverImageUrl: existing.coverImageUrl ?? null,
      updatedAt: now(),
    };
    items[idx] = replaced;
    await saveAll(COLLECTION, items);
    return json(200, replaced);
  }

  if (method === 'PATCH') {
    const invalid = checkPatch(body, PATCH_ALLOWED);
    if (invalid) return invalid;
    const errors = validate(body);
    if (errors.length) return validationFailed(errors);
    const merged = { ...existing, ...body, updatedAt: now() };
    items[idx] = merged;
    await saveAll(COLLECTION, items);
    return json(200, merged);
  }

  // DELETE
  items.splice(idx, 1);
  await saveAll(COLLECTION, items);
  await removeImageByUrl(existing[IMAGE_ROUTES[COLLECTION].field]);
  return empty(204);
}
