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

/* ------------------------------------------------------------------ */
/* Gambar upload: <img src="https://mock-api.pkl.local/api/v1/uploads/…">  */
/* Browser tidak memakai fetch() untuk <img>, jadi src-nya kita ganti     */
/* otomatis menjadi blob: URL dari IndexedDB.                             */
/* ------------------------------------------------------------------ */
const UPLOAD_PREFIXES = PREFIXES.map((p) => `${p}/uploads/`);
const blobCache = new Map(); // mock URL → Promise<blob URL | null>

const isUploadUrl = (url) => typeof url === 'string' && UPLOAD_PREFIXES.some((p) => url.startsWith(p));

/** Ubah URL gambar mock menjadi blob: URL yang bisa dipakai di <img>, CSS, dll. */
function imageUrl(url) {
  if (!isUploadUrl(url)) return Promise.resolve(url);
  if (!blobCache.has(url)) {
    const job = handleApiRequest(new Request(url, { headers: { 'X-Mock-Delay': '0' } }))
      .then(async (res) => (res.ok ? URL.createObjectURL(await res.blob()) : null))
      .catch(() => null);
    blobCache.set(url, job);
    job.then((u) => { if (!u) blobCache.delete(url); });
  }
  return blobCache.get(url);
}

function patchImg(img) {
  const src = img.getAttribute('src');
  if (!isUploadUrl(src)) return;
  img.dataset.mockSrc = src;
  imageUrl(src).then((blobUrl) => {
    if (blobUrl && img.getAttribute('src') === src) img.setAttribute('src', blobUrl);
  });
}

function watchImages() {
  document.querySelectorAll('img[src]').forEach(patchImg);
  new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.target.tagName === 'IMG') patchImg(m.target);
      m.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        if (n.tagName === 'IMG') patchImg(n);
        n.querySelectorAll?.('img[src]').forEach(patchImg);
      });
    }
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });
}

if (!window.__PKL_MOCK_API__) {
  watchImages();
  window.fetch = mockFetch;
  window.__PKL_MOCK_API__ = true;
  window.PKLMockAPI = {
    baseUrl: MOCK_BASE_URL,
    originalFetch,
    /** Ubah URL gambar upload menjadi blob: URL (otomatis untuk <img>). */
    imageUrl,
    /** Kembalikan database lokal ke data seed awal. */
    reset: () => resetAll(),
  };
  console.info(
    `%c[PKL Mock API]%c aktif. Base URL: ${MOCK_BASE_URL}  •  reset data: PKLMockAPI.reset()`,
    'color:#16a34a;font-weight:bold',
    'color:inherit',
  );
}
