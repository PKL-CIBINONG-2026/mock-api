/**
 * Studi Kasus 3: Manajemen Profil & Pengaturan Akun User — /api/v1/users
 */
import { getAll, saveAll } from '../core/db.js';
import {
  json, empty, badRequest, notFound, methodNotAllowed, paginate, nextId,
  isNonEmptyString, isPlainObject, checkPayload, checkPatch, checkBodyId, validationFailed, unprocessable,
} from '../core/http.js';

const COLLECTION = 'users';
const BASE = '/api/v1/users';
const REQUIRED = ['fullName', 'email', 'phone'];
const OPTIONAL_PROFILE = ['bio', 'address', 'avatarUrl'];
const PATCH_ALLOWED = ['phone', 'bio', 'address', 'avatarUrl', 'preferences'];
const THEMES = ['light', 'dark', 'system'];
const PREF_KEYS = ['theme', 'twoFactorEnabled', 'emailNotifications'];
const DEFAULT_PREFERENCES = { theme: 'light', twoFactorEnabled: false, emailNotifications: true };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?\d{9,15}$/;

function validate(data) {
  const errors = [];
  if ('fullName' in data && !isNonEmptyString(data.fullName)) errors.push({ field: 'fullName', message: 'fullName harus string dan tidak boleh kosong' });
  if ('email' in data && !(typeof data.email === 'string' && EMAIL_RE.test(data.email))) errors.push({ field: 'email', message: 'Format email tidak valid (contoh: nama@domain.com)' });
  if ('phone' in data && !(typeof data.phone === 'string' && PHONE_RE.test(data.phone))) errors.push({ field: 'phone', message: 'phone harus string berisi 9–15 digit angka (boleh diawali +)' });
  for (const f of OPTIONAL_PROFILE) {
    if (f in data && data[f] !== null && typeof data[f] !== 'string') errors.push({ field: f, message: `${f} harus string atau null` });
  }
  if ('avatarUrl' in data && typeof data.avatarUrl === 'string' && !/^https?:\/\//.test(data.avatarUrl)) {
    errors.push({ field: 'avatarUrl', message: 'avatarUrl harus URL yang diawali http:// atau https://' });
  }
  return errors;
}

function emailTaken(items, email, excludeId) {
  return items.find((u) => u.id !== excludeId && u.email.toLowerCase() === String(email).toLowerCase());
}

const emailTakenResponse = (email) =>
  unprocessable(`Email "${email}" sudah terdaftar`, { errors: [{ field: 'email', message: 'Email sudah dipakai user lain' }] });

export async function handle({ method, params, query, body }) {
  const items = await getAll(COLLECTION);

  if (params.length === 0) {
    if (method === 'GET') {
      let result = items;
      if (query.search) {
        const q = query.search.toLowerCase();
        result = result.filter((u) => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
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
      if (emailTaken(items, body.email)) return emailTakenResponse(body.email);
      const user = {
        id: nextId(items, 'usr', 301),
        fullName: body.fullName,
        email: body.email,
        phone: body.phone,
        bio: null,
        address: null,
        avatarUrl: null,
        preferences: { ...DEFAULT_PREFERENCES },
      };
      await saveAll(COLLECTION, [...items, user]);
      return json(201, user, { Location: `${BASE}/${user.id}` });
    }
    return methodNotAllowed(['GET', 'HEAD', 'POST']);
  }

  if (params.length > 1) return notFound('Endpoint tidak ditemukan');

  const id = params[0];
  if (!['GET', 'PUT', 'PATCH', 'DELETE'].includes(method)) return methodNotAllowed(['GET', 'HEAD', 'PUT', 'PATCH', 'DELETE']);
  const idx = items.findIndex((u) => u.id === id);
  if (idx === -1) return notFound(`User dengan id "${id}" tidak ditemukan`);
  const existing = items[idx];

  if (method === 'GET') return json(200, existing);

  if (method === 'PUT') {
    const invalid = checkPayload(body, { required: REQUIRED, optional: [...OPTIONAL_PROFILE, 'id'] }) || checkBodyId(body, id);
    if (invalid) return invalid;
    const errors = validate(body);
    if (errors.length) return validationFailed(errors);
    if (emailTaken(items, body.email, id)) return emailTakenResponse(body.email);
    const replaced = {
      id,
      fullName: body.fullName,
      email: body.email,
      phone: body.phone,
      bio: body.bio ?? null,
      address: body.address ?? null,
      avatarUrl: body.avatarUrl ?? null,
      preferences: existing.preferences, // dipertahankan
    };
    items[idx] = replaced;
    await saveAll(COLLECTION, items);
    return json(200, replaced);
  }

  if (method === 'PATCH') {
    const invalid = checkPatch(body, PATCH_ALLOWED);
    if (invalid) return invalid;
    const errors = validate(body);
    if ('preferences' in body) {
      const prefs = body.preferences;
      if (!isPlainObject(prefs)) return badRequest('preferences harus berupa object, contoh: { "theme": "dark" }');
      const keys = Object.keys(prefs);
      if (keys.length === 0) return badRequest('preferences tidak boleh object kosong', { allowedFields: PREF_KEYS });
      const unknown = keys.filter((k) => !PREF_KEYS.includes(k));
      if (unknown.length) {
        return badRequest(`Field preferences tidak dikenal: ${unknown.join(', ')}`, { unknownFields: unknown, allowedFields: PREF_KEYS });
      }
      if ('theme' in prefs && !THEMES.includes(prefs.theme)) errors.push({ field: 'preferences.theme', message: `theme harus salah satu dari: ${THEMES.join(', ')}` });
      for (const k of ['twoFactorEnabled', 'emailNotifications']) {
        if (k in prefs && typeof prefs[k] !== 'boolean') errors.push({ field: `preferences.${k}`, message: `${k} harus boolean` });
      }
    }
    if (errors.length) return validationFailed(errors);
    const { preferences, ...profile } = body;
    const merged = {
      ...existing,
      ...profile,
      preferences: { ...existing.preferences, ...(preferences || {}) }, // deep merge
    };
    items[idx] = merged;
    await saveAll(COLLECTION, items);
    return json(200, merged);
  }

  items.splice(idx, 1);
  await saveAll(COLLECTION, items);
  return empty(204);
}
