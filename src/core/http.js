/**
 * http.js — Helper pembuat Response, status code, header & simulasi latency.
 * Dipakai bersama oleh Service Worker (sw.js), Client SDK (client.js) dan UI.
 */

export const STATUS_TEXT = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  400: 'Bad Request',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
};

export const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS';

function baseHeaders(extra = {}) {
  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
    'Access-Control-Allow-Headers': 'Content-Type, X-Mock-Delay',
    'Access-Control-Expose-Headers': 'X-Total-Count, Location',
    'Cache-Control': 'no-store',
    'X-Powered-By': 'PKL-Mock-API',
  });
  for (const [k, v] of Object.entries(extra)) headers.set(k, String(v));
  return headers;
}

/** Response JSON standar. */
export function json(status, data, extraHeaders = {}) {
  const headers = baseHeaders(extraHeaders);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data, null, 2), {
    status,
    statusText: STATUS_TEXT[status] || '',
    headers,
  });
}

/** Response tanpa body (204, HEAD, OPTIONS). Body benar-benar null. */
export function empty(status, extraHeaders = {}) {
  return new Response(null, {
    status,
    statusText: STATUS_TEXT[status] || '',
    headers: baseHeaders(extraHeaders),
  });
}

/** Response error dengan format konsisten. */
export function error(status, message, details, extraHeaders = {}) {
  const body = { error: STATUS_TEXT[status] || 'Error', status, message };
  if (details !== undefined) body.details = details;
  return json(status, body, extraHeaders);
}

export const badRequest = (message, details) => error(400, message, details);
export const notFound = (message = 'Resource tidak ditemukan', details) => error(404, message, details);
export const conflict = (message, details) => error(409, message, details);
export const unprocessable = (message, details) => error(422, message, details);
export const methodNotAllowed = (allowed) =>
  error(405, `Method tidak diizinkan. Gunakan: ${allowed.join(', ')}`, undefined, { Allow: allowed.join(', ') });

/**
 * Simulasi network latency 300–500ms.
 * Header `X-Mock-Delay: 0` mematikan delay, `X-Mock-Delay: 1500` = delay tetap 1500ms.
 */
export async function simulateLatency(request) {
  const raw = request.headers.get('X-Mock-Delay');
  let ms;
  if (raw !== null && raw.trim() !== '' && !Number.isNaN(Number(raw))) {
    ms = Math.min(Math.max(Number(raw), 0), 10000);
  } else {
    ms = 300 + Math.floor(Math.random() * 201);
  }
  if (ms > 0) await new Promise((r) => setTimeout(r, ms));
}

/**
 * Pagination `?_page=1&_limit=10`. Tanpa query tersebut seluruh data dikembalikan.
 * @returns {{ data: any[], total: number } | { error: Response }}
 */
export function paginate(items, query) {
  const total = items.length;
  if (query._page === undefined && query._limit === undefined) return { data: items, total };
  const page = query._page === undefined ? 1 : Number(query._page);
  const limit = query._limit === undefined ? 10 : Number(query._limit);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1) {
    return { error: badRequest('_page dan _limit harus bilangan bulat >= 1', { _page: query._page, _limit: query._limit }) };
  }
  const start = (page - 1) * limit;
  return { data: items.slice(start, start + limit), total };
}

/** Generate id berikutnya, misal "art-107". */
export function nextId(items, prefix, start) {
  const max = items.reduce((m, it) => {
    const n = Number(String(it.id).replace(`${prefix}-`, ''));
    return Number.isFinite(n) && n > m ? n : m;
  }, start - 1);
  return `${prefix}-${max + 1}`;
}

export const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
export const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

/**
 * Cek payload POST/PUT: field wajib (undefined/null = hilang) lalu key asing.
 * @returns {Response|null}
 */
export function checkPayload(body, { required = [], optional = [] }) {
  const missing = required.filter((f) => body[f] === undefined || body[f] === null);
  if (missing.length) {
    return badRequest(`Field wajib belum lengkap: ${missing.join(', ')}`, {
      missingFields: missing,
      requiredFields: required,
    });
  }
  const allowed = [...required, ...optional];
  const unknown = Object.keys(body).filter((k) => !allowed.includes(k));
  if (unknown.length) {
    return badRequest(`Field tidak dikenal: ${unknown.join(', ')}`, { unknownFields: unknown, allowedFields: allowed });
  }
  return null;
}

/**
 * Cek payload PATCH: tolak body kosong & key asing.
 * @returns {Response|null}
 */
export function checkPatch(body, allowed) {
  const keys = Object.keys(body);
  if (keys.length === 0) {
    return badRequest('Body PATCH tidak boleh kosong. Kirim minimal satu field yang ingin diubah.', { allowedFields: allowed });
  }
  const unknown = keys.filter((k) => !allowed.includes(k));
  if (unknown.length) {
    return badRequest(`Field tidak dikenal / tidak boleh di-PATCH: ${unknown.join(', ')}`, {
      unknownFields: unknown,
      allowedFields: allowed,
    });
  }
  return null;
}

/** Validasi id di body PUT (opsional) harus sama dengan id di URL. */
export function checkBodyId(body, id) {
  if (body.id !== undefined && body.id !== id) {
    return badRequest(`id di body ("${body.id}") tidak sama dengan id di URL ("${id}")`);
  }
  return null;
}

export const validationFailed = (errors) => unprocessable('Validasi data gagal', { errors });
