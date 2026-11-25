/**
 * Melayani file gambar hasil upload — GET /api/v1/uploads/:fileId
 */
import { getFile } from '../core/db.js';
import { notFound, methodNotAllowed } from '../core/http.js';

export async function handle({ method, params }) {
  if (params.length !== 1) return notFound('Gunakan /api/v1/uploads/:fileId');
  if (method !== 'GET') return methodNotAllowed(['GET', 'HEAD']);
  const file = await getFile(params[0]);
  if (!file) return notFound(`File "${params[0]}" tidak ditemukan`);
  return new Response(file.blob, {
    status: 200,
    statusText: 'OK',
    headers: {
      'Content-Type': file.type,
      'Content-Length': String(file.size),
      'Content-Disposition': `inline; filename="${encodeURIComponent(file.name)}"`,
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'X-Powered-By': 'PKL-Mock-API',
    },
  });
}
