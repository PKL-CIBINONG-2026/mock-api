/**
 * client.js — Drop-in Client SDK untuk proyek localhost peserta PKL (Mode 2).
 *
 * Pemakaian (letakkan SEBELUM script kamu sendiri):
 *   <script type="module" src="https://<user>.github.io/<repo>/client.js"></script>
 *   <script type="module" src="./app.js"></script>
 *
 * Lalu panggil:
 *   const res = await fetch('https://mock-api.pkl.local/api/v1/articles');
 *
 * Data disimpan di IndexedDB milik origin kamu (misal http://localhost:5500).
 */
import { handleApiRequest } from './src/core/router.js';
import { resetAll } from './src/core/db.js';

export const MOCK_BASE_URL = 'https://mock-api.pkl.local/api/v1';
const PREFIXES = ['https://mock-api.pkl.local/api/v1', 'http://mock-api.pkl.local/api/v1'];

const originalFetch = window.fetch.bind(window);

function urlOf(input) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (input instanceof Request) return input.url;
  return String(input);
}

function isMockUrl(url) {
  return PREFIXES.some((p) => url === p || url.startsWith(`${p}/`) || url.startsWith(`${p}?`));
}

async function mockFetch(input, init) {
  const url = urlOf(input);
  if (!isMockUrl(url)) return originalFetch(input, init);
  const request = new Request(input, init);
  if (request.signal && request.signal.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
  const response = await handleApiRequest(request);
  console.debug(`%c[PKL Mock API]%c ${request.method} ${url} → ${response.status}`, 'color:#16a34a;font-weight:bold', 'color:inherit');
  return response;
}

if (!window.__PKL_MOCK_API__) {
  window.fetch = mockFetch;
  window.__PKL_MOCK_API__ = true;
  window.PKLMockAPI = {
    baseUrl: MOCK_BASE_URL,
    originalFetch,
    /** Kembalikan database lokal ke data seed awal. */
    reset: () => resetAll(),
  };
  console.info(
    `%c[PKL Mock API]%c aktif. Base URL: ${MOCK_BASE_URL}  •  reset data: PKLMockAPI.reset()`,
    'color:#16a34a;font-weight:bold',
    'color:inherit',
  );
}
