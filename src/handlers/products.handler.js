/**
 * Studi Kasus 4: Manajemen Inventaris & Stock Opname Gudang — /api/v1/products
 */
import { getAll, saveAll } from '../core/db.js';
import {
  json, empty, notFound, conflict, methodNotAllowed, paginate, nextId,
  isNonEmptyString, checkPayload, checkPatch, checkBodyId, validationFailed,
} from '../core/http.js';

const COLLECTION = 'products';
const BASE = '/api/v1/products';
const REQUIRED = ['sku', 'name', 'category', 'costPrice', 'sellPrice', 'stock', 'minStock', 'supplier'];
const PATCH_ALLOWED = ['stock', 'minStock', 'sellPrice'];
const SKU_RE = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

function validate(data) {
  const errors = [];
  for (const f of ['name', 'category', 'supplier']) {
    if (f in data && !isNonEmptyString(data[f])) errors.push({ field: f, message: `${f} harus string dan tidak boleh kosong` });
  }
  if ('sku' in data && !(typeof data.sku === 'string' && SKU_RE.test(data.sku))) {
    errors.push({ field: 'sku', message: 'sku harus huruf kapital/angka dipisah "-" (contoh: KB-MECH-01)' });
  }
  for (const f of ['costPrice', 'sellPrice']) {
    if (f in data && !(typeof data[f] === 'number' && Number.isFinite(data[f]) && data[f] >= 0)) {
      errors.push({ field: f, message: `${f} harus angka dan tidak boleh negatif` });
    }
  }
  for (const f of ['stock', 'minStock']) {
    if (f in data && !(Number.isInteger(data[f]) && data[f] >= 0)) {
      errors.push({ field: f, message: `${f} harus bilangan bulat dan tidak boleh negatif` });
    }
  }
  return errors;
}

function skuConflict(items, sku, excludeId) {
  const dup = items.find((p) => p.id !== excludeId && p.sku === sku);
  return dup ? conflict(`SKU "${sku}" sudah terdaftar pada produk ${dup.id}`, { field: 'sku', existingId: dup.id }) : null;
}

export async function handle({ method, params, query, body }) {
  const items = await getAll(COLLECTION);

  if (params.length === 0) {
    if (method === 'GET') {
      let result = items;
      if (query.lowStock === 'true') result = result.filter((p) => p.stock <= p.minStock);
      if (query.lowStock === 'false') result = result.filter((p) => p.stock > p.minStock);
      if (query.category) result = result.filter((p) => p.category.toLowerCase() === query.category.toLowerCase());
      if (query.search) {
        const q = query.search.toLowerCase();
        result = result.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
      }
      const page = paginate(result, query);
      if (page.error) return page.error;
      return json(200, page.data, { 'X-Total-Count': page.total });
    }
    if (method === 'POST') {
      const invalid = checkPayload(body, { required: REQUIRED });
      if (invalid) return invalid;
      const errors = validate(body);
      if (errors.length) return validationFailed(errors);
      const dup = skuConflict(items, body.sku);
      if (dup) return dup;
      const product = { id: nextId(items, 'prd', 401) };
      for (const f of REQUIRED) product[f] = body[f];
      await saveAll(COLLECTION, [...items, product]);
      return json(201, product, { Location: `${BASE}/${product.id}` });
    }
    return methodNotAllowed(['GET', 'HEAD', 'POST']);
  }

  if (params.length > 1) return notFound('Endpoint tidak ditemukan');

  const id = params[0];
  if (!['GET', 'PUT', 'PATCH', 'DELETE'].includes(method)) return methodNotAllowed(['GET', 'HEAD', 'PUT', 'PATCH', 'DELETE']);
  const idx = items.findIndex((p) => p.id === id);
  if (idx === -1) return notFound(`Produk dengan id "${id}" tidak ditemukan`);
  const existing = items[idx];

  if (method === 'GET') return json(200, existing);

  if (method === 'PUT') {
    const invalid = checkPayload(body, { required: REQUIRED, optional: ['id'] }) || checkBodyId(body, id);
    if (invalid) return invalid;
    const errors = validate(body);
    if (errors.length) return validationFailed(errors);
    const dup = skuConflict(items, body.sku, id);
    if (dup) return dup;
    const replaced = { id };
    for (const f of REQUIRED) replaced[f] = body[f];
    items[idx] = replaced;
    await saveAll(COLLECTION, items);
    return json(200, replaced);
  }

  if (method === 'PATCH') {
    const invalid = checkPatch(body, PATCH_ALLOWED);
    if (invalid) return invalid;
    const errors = validate(body);
    if (errors.length) return validationFailed(errors);
    const merged = { ...existing, ...body };
    items[idx] = merged;
    await saveAll(COLLECTION, items);
    return json(200, merged);
  }

  items.splice(idx, 1);
  await saveAll(COLLECTION, items);
  return empty(204);
}
