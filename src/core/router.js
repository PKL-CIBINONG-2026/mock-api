/**
 * router.js — Inti engine Mock API.
 * URL pattern matcher, query parser, body parser & dispatcher ke 4 handler.
 * Fungsi `handleApiRequest(request)` menerima `Request` standar dan
 * mengembalikan `Response` standar Fetch API.
 */
import { handle as articles } from '../handlers/articles.handler.js';
import { handle as bookings } from '../handlers/bookings.handler.js';
import { handle as users } from '../handlers/users.handler.js';
import { handle as products } from '../handlers/products.handler.js';
import { handle as uploads } from '../handlers/uploads.handler.js';
import { IMAGE_ROUTES } from './uploads.js';
import { json, empty, error, badRequest, notFound, isPlainObject, simulateLatency, ALLOWED_METHODS } from './http.js';

export const API_PREFIX = '/api/v1';

const handlers = { articles, bookings, users, products, uploads };

const BODY_METHODS = ['POST', 'PUT', 'PATCH'];
const KNOWN_METHODS = ALLOWED_METHODS.split(', ');

// Antrian sederhana agar request yang mengubah data diproses berurutan
// (mencegah lost-update saat beberapa request datang bersamaan).
let queue = Promise.resolve();
function serialize(fn) {
  const result = queue.then(fn, fn);
  queue = result.catch(() => {});
  return result;
}

/** Pecah URL menjadi { resource, params, query } relatif terhadap /api/v1. */
export function parseUrl(rawUrl) {
  const url = new URL(rawUrl);
  const idx = url.pathname.indexOf(API_PREFIX);
  if (idx === -1) return null;
  const rest = url.pathname.slice(idx + API_PREFIX.length);
  if (rest !== '' && !rest.startsWith('/')) return null;
  const segments = rest.split('/').filter(Boolean).map((s) => decodeURIComponent(s));
  const [resource, ...params] = segments;
  const query = Object.fromEntries(url.searchParams.entries());
  const baseUrl = url.origin + url.pathname.slice(0, idx + API_PREFIX.length);
  return { resource, params, query, baseUrl };
}

export async function handleApiRequest(request) {
  try {
    const method = request.method.toUpperCase();
    let parsed;
    try {
      parsed = parseUrl(request.url);
    } catch {
      return badRequest('URL tidak valid');
    }
    if (!parsed) return notFound(`Path harus diawali ${API_PREFIX}`);

    await simulateLatency(request);

    if (method === 'OPTIONS') return empty(204);
    if (!KNOWN_METHODS.includes(method)) return error(405, `Method ${method} tidak didukung`, undefined, { Allow: ALLOWED_METHODS });

    const { resource, params, query, baseUrl } = parsed;

    if (!resource) {
      const index = {
        name: 'PKL Multi-Domain Mock API',
        version: 'v1',
        resources: Object.keys(handlers).filter((r) => r !== 'uploads').map((r) => `${API_PREFIX}/${r}`),
      };
      return method === 'HEAD' ? empty(200) : json(200, index);
    }

    const handler = handlers[resource];
    if (!handler) return notFound(`Resource "${resource}" tidak ada. Tersedia: ${Object.keys(handlers).join(', ')}`);

    let body;
    let form = null;
    const contentType = (request.headers.get('Content-Type') || '').toLowerCase();
    const isMultipart = contentType.includes('multipart/form-data');
    const isImageRoute = Boolean(IMAGE_ROUTES[resource]) && params.length === 2 && params[1] === IMAGE_ROUTES[resource].sub;

    if (isImageRoute && method === 'POST') {
      // Upload gambar: body harus FormData. Validasi lanjutan ada di core/uploads.js.
      if (isMultipart) {
        try {
          form = await request.formData();
        } catch (e) {
          return badRequest('Body multipart/form-data tidak valid', { parseError: e.message });
        }
      }
    } else if (BODY_METHODS.includes(method) && isMultipart) {
      return error(415, `Endpoint ${method} ini menerima JSON. Gunakan header Content-Type: application/json`, {
        hint: 'Upload gambar hanya lewat endpoint /:id/' + (IMAGE_ROUTES[resource] ? IMAGE_ROUTES[resource].sub : '<sub>'),
      });
    } else if (BODY_METHODS.includes(method)) {
      const text = await request.text();
      if (!text.trim()) return badRequest(`Request body ${method} tidak boleh kosong. Kirim JSON object.`);
      try {
        body = JSON.parse(text);
      } catch (e) {
        return badRequest('Body bukan JSON yang valid', { parseError: e.message });
      }
      if (!isPlainObject(body)) return badRequest('Body harus berupa JSON object ({ ... }), bukan array/primitive');
    }

    // HEAD khusus untuk check-slug ditangani handler; HEAD lain = GET tanpa body.
    const isSlugCheck = resource === 'articles' && params[0] === 'check-slug';
    const effectiveMethod = method === 'HEAD' && !isSlugCheck ? 'GET' : method;

    const res = await serialize(() => handler({ method: effectiveMethod, params, query, body, form, baseUrl }));

    if (method === 'HEAD' && !isSlugCheck) {
      return new Response(null, { status: res.status, statusText: res.statusText, headers: res.headers });
    }
    return res;
  } catch (e) {
    console.error('[mock-api]', e);
    return error(500, 'Terjadi kesalahan internal pada mock server', { reason: String(e && e.message ? e.message : e) });
  }
}
