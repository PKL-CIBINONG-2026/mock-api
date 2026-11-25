/**
 * app.js — Registrasi Service Worker & UI dokumentasi API (hash router, Try it, Live DB).
 */
import { getAll, resetAll, init as initDB } from './core/db.js';
import { handleApiRequest } from './core/router.js';
import { CATEGORIES, STATUS_CODES } from './docs-data.js';

const API = './api/v1';
const MOCK_BASE = 'https://mock-api.pkl.local/api/v1';
const NO_BODY = ['GET', 'HEAD', 'DELETE'];
const MUTATING = ['POST', 'PUT', 'PATCH', 'DELETE'];
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

let swActive = false;
let lastChangedId = null;

/* ================================================================ */
/* Helpers                                                           */
/* ================================================================ */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Markdown mini: `code`, **bold**, paragraf (\n\n). */
function md(text = '') {
  return text
    .split(/\n\n+/)
    .map((p) => `<p>${esc(p).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')}</p>`)
    .join('');
}
const inline = (t) => md(t).replace(/^<p>|<\/p>$/g, '');

function highlightJson(text) {
  return esc(text).replace(
    /(&quot;(?:\\.|[^\\&]|&(?!quot;))*?&quot;)(\s*:)?|\b(true|false)\b|\bnull\b|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g,
    (m, str, colon, bool) => {
      if (str) return colon ? `<span class="j-key">${str}</span>${colon}` : `<span class="j-str">${str}</span>`;
      if (bool) return `<span class="j-bool">${m}</span>`;
      if (m === 'null') return `<span class="j-null">null</span>`;
      return `<span class="j-num">${m}</span>`;
    },
  );
}

function highlightJs(code) {
  const re = /(\/\/[^\n]*)|('(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*")|\b(const|let|await|async|if|else|return|new|try|catch|throw|function)\b|\b(fetch|JSON|console)\b/g;
  let out = '';
  let last = 0;
  for (const m of code.matchAll(re)) {
    out += esc(code.slice(last, m.index));
    const cls = m[1] ? 'c-com' : m[2] ? 'c-str' : m[3] ? 'c-kw' : 'c-fn';
    out += `<span class="${cls}">${esc(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + esc(code.slice(last));
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 2200);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }
  toast('Disalin ke clipboard');
}

const sdkUrl = () => new URL('./client.js', location.href).href;
const sdkTag = () => `<script type="module" src="${sdkUrl()}"></script>`;
const statusClass = (c) => (c < 300 ? 's2' : c < 500 ? 's4' : 's5');
const findCat = (key) => CATEGORIES.find((c) => c.key === key);

/* ================================================================ */
/* Sidebar                                                           */
/* ================================================================ */
const GUIDE = [
  { href: '#/', label: 'Pengenalan', icon: 'home' },
  { href: '#/quickstart', label: 'Mulai di localhost', icon: 'rocket' },
  { href: '#/conventions', label: 'Status code & aturan', icon: 'book' },
];

function renderNav(filter = '') {
  const q = filter.trim().toLowerCase();
  const guide = GUIDE.filter((g) => !q || g.label.toLowerCase().includes(q))
    .map((g) => `<a class="nav-link" href="${g.href}"><i class="ti ti-${g.icon} nav-icon" aria-hidden="true"></i><span>${g.label}</span></a>`)
    .join('');
  const cats = CATEGORIES.map((c) => {
    const eps = c.endpoints.filter((e) => !q || `${e.method} ${e.path} ${e.title} ${c.name}`.toLowerCase().includes(q));
    if (q && !eps.length) return '';
    return `
      <a class="nav-link nav-cat" href="#/${c.key}"><i class="ti ti-${c.icon} nav-icon" aria-hidden="true"></i><span>${c.name}</span></a>
      <div class="nav-sub">${eps
        .map((e) => `<a class="nav-link" href="#/${c.key}/${e.slug}"><span class="m m-${e.method}">${e.method}</span><span>${esc(e.title)}</span></a>`)
        .join('')}</div>`;
  }).join('');
  $('#nav').innerHTML = `
    ${guide ? `<div class="nav-group"><div class="nav-title">Panduan</div>${guide}</div>` : ''}
    <div class="nav-group"><div class="nav-title">API Reference</div>${cats || '<div class="nav-empty">Tidak ada hasil.</div>'}</div>`;
  markActiveNav();
}

function markActiveNav() {
  const hash = location.hash || '#/';
  $$('.nav-link').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === hash));
}

/* ================================================================ */
/* Pages                                                             */
/* ================================================================ */
function pageIntro() {
  return `
  <div class="page">
    <section class="hero">
      <div class="eyebrow">REST API Sandbox · PKL Cibinong 2026</div>
      <h1>PKL Mock API</h1>
      <p class="lead">API tiruan untuk latihan <code>fetch()</code>. Datanya benar-benar tersimpan (stateful): data yang kamu buat dengan <code>POST</code> akan muncul lagi saat <code>GET</code>, sampai kamu menekan <strong>Reset data</strong>.</p>
      <div class="endpoint-line" style="margin-top:18px"><span class="base">Base URL (localhost)</span> ${MOCK_BASE}</div>
    </section>

    <h2>4 Kategori API</h2>
    <div class="cards">
      ${CATEGORIES.map((c) => `
        <a class="cat-card" href="#/${c.key}">
          <div class="emoji"><i class="ti ti-${c.icon}" aria-hidden="true"></i></div>
          <h3>${c.name}</h3>
          <p>${c.summary}</p>
          <code>/api/v1/${c.key}</code>
          <div class="methods">${[...new Set(c.endpoints.map((e) => e.method))].map((m) => `<span class="m m-${m}">${m}</span>`).join('')}</div>
        </a>`).join('')}
    </div>

    <h2>Cara memakai</h2>
    <div class="steps">
      <div class="step"><div><h4>Pilih endpoint di menu kiri</h4><p>Setiap endpoint punya penjelasan parameter, body, dan kemungkinan status code.</p></div></div>
      <div class="step"><div><h4>Coba langsung dengan tombol “Send”</h4><p>Panel <strong>Try it</strong> mengirim request sungguhan. Buka DevTools → Network untuk melihat request dan header-nya.</p></div></div>
      <div class="step"><div><h4>Pakai di proyekmu sendiri</h4><p>Tambahkan satu baris <code>&lt;script&gt;</code> SDK di proyek localhost-mu, lalu <code>fetch()</code> ke base URL di atas. <a href="#/quickstart">Lihat panduan →</a></p></div></div>
    </div>
    ${pager(null, { href: '#/quickstart', label: 'Mulai di localhost' })}
  </div>`;
}

function pageQuickstart() {
  const html = `<!-- index.html -->
${sdkTag()}
<script type="module" src="./app.js"></script>`;
  const js = `// app.js
const BASE_URL = '${MOCK_BASE}';

// 1. GET daftar artikel
const res = await fetch(\`\${BASE_URL}/articles?_page=1&_limit=5\`);
const articles = await res.json();
console.log(res.status, res.headers.get('X-Total-Count'), articles);

// 2. POST data baru
const created = await fetch(\`\${BASE_URL}/products\`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sku: 'MS-PAD-01', name: 'Mousepad XL', category: 'Electronics',
    costPrice: 50000, sellPrice: 80000, stock: 10, minStock: 3, supplier: 'PT Nusantara Tech',
  }),
});
if (!created.ok) {
  const err = await created.json();
  console.error(created.status, err.message, err.details);
}

// 3. DELETE → 204 tanpa body
const del = await fetch(\`\${BASE_URL}/articles/art-106\`, { method: 'DELETE' });
if (del.status === 204) console.log('Berhasil dihapus');`;
  return `
  <div class="page">
    <div class="crumbs"><a href="#/">Panduan</a> / <span>Mulai di localhost</span></div>
    <h1>Mulai di localhost</h1>
    <p class="lead">Kerjakan tugas di komputermu sendiri (misal pakai VS Code Live Server) tanpa perlu backend dan tanpa masalah CORS.</p>

    <h2>1. Pasang SDK</h2>
    <div class="prose"><p>Taruh script SDK <strong>sebelum</strong> script milikmu. Keduanya harus <code>type="module"</code>.</p></div>
    ${codePanel('HTML', html, 'html')}

    <h2>2. Panggil API dengan fetch()</h2>
    <div class="prose"><p>Semua request ke <code>${MOCK_BASE}</code> otomatis dijawab oleh SDK.</p></div>
    ${codePanel('JavaScript', js, 'js')}

    <div class="callout"><i class="ti ti-bulb" aria-hidden="true"></i><p>Data di localhost tersimpan di IndexedDB browser-mu sendiri. Untuk mengembalikan data ke awal, ketik <code>PKLMockAPI.reset()</code> di Console.</p></div>
    <div class="callout warn"><i class="ti ti-alert-triangle" aria-hidden="true"></i><p>Script <code>type="module"</code> butuh web server (Live Server, <code>npx serve</code>, dll). Membuka file HTML langsung (<code>file://</code>) tidak akan berjalan.</p></div>
    ${pager({ href: '#/', label: 'Pengenalan' }, { href: '#/conventions', label: 'Status code & aturan' })}
  </div>`;
}

function pageConventions() {
  return `
  <div class="page">
    <div class="crumbs"><a href="#/">Panduan</a> / <span>Status code & aturan</span></div>
    <h1>Status code & aturan</h1>
    <p class="lead">Mock API ini mengikuti aturan HTTP dengan ketat supaya kamu terbiasa menangani setiap kemungkinan response.</p>

    <h2>HTTP Status Code</h2>
    <div class="table-wrap"><table>
      <thead><tr><th>Status</th><th>Nama</th><th>Kapan muncul</th></tr></thead>
      <tbody>${STATUS_CODES.map(([c, n, d]) => `<tr><td><span class="code-status ${statusClass(c)}">${c}</span></td><td class="name">${n}</td><td class="desc">${inline(d)}</td></tr>`).join('')}</tbody>
    </table></div>

    <h2>PUT vs PATCH</h2>
    <div class="table-wrap"><table>
      <thead><tr><th></th><th>PUT</th><th>PATCH</th></tr></thead>
      <tbody>
        <tr><td class="name">Arti</td><td class="desc">Ganti seluruh data (full replacement)</td><td class="desc">Ubah sebagian data (partial update)</td></tr>
        <tr><td class="name">Field wajib</td><td class="desc">Semua harus dikirim, kurang satu → <code>400</code></td><td class="desc">Minimal satu field, body kosong → <code>400</code></td></tr>
        <tr><td class="name">Field opsional</td><td class="desc">Tidak dikirim → jadi <code>null</code></td><td class="desc">Tidak dikirim → nilai lama tetap</td></tr>
        <tr><td class="name">Field tidak dikenal</td><td class="desc"><code>400</code></td><td class="desc"><code>400</code></td></tr>
      </tbody>
    </table></div>

    <h2>Pagination</h2>
    <div class="prose"><p>Semua endpoint daftar mendukung <code>?_page=1&amp;_limit=10</code>. Jumlah seluruh data (setelah filter) dikirim lewat header <code>X-Total-Count</code>.</p></div>
    ${codePanel('JavaScript', `const res = await fetch(\`\${BASE_URL}/products?_page=2&_limit=2\`);
const total = Number(res.headers.get('X-Total-Count'));
const totalPages = Math.ceil(total / 2);`, 'js')}

    <h2>Simulasi latency</h2>
    <div class="prose"><p>Setiap response diberi delay acak <strong>300–500 ms</strong> supaya kamu terbiasa membuat <em>loading state</em>. Kirim header <code>X-Mock-Delay: 0</code> untuk mematikannya, atau misal <code>X-Mock-Delay: 2000</code> untuk delay 2 detik.</p></div>

    <h2>Upload gambar</h2>
    <div class="prose"><p>Setiap kategori punya endpoint upload gambar dengan body <code>FormData</code> (field <code>image</code>, PNG/JPEG/WEBP/GIF, maks 2 MB):</p></div>
    <div class="table-wrap"><table>
      <thead><tr><th>Kategori</th><th>Endpoint upload</th><th>Field yang terisi</th></tr></thead>
      <tbody>
        <tr><td class="name">Articles</td><td class="name">POST /articles/:id/cover</td><td class="type">coverImageUrl</td></tr>
        <tr><td class="name">Bookings</td><td class="name">POST /bookings/:id/attachment</td><td class="type">attachmentUrl</td></tr>
        <tr><td class="name">Users</td><td class="name">POST /users/:id/avatar</td><td class="type">avatarUrl</td></tr>
        <tr><td class="name">Products</td><td class="name">POST /products/:id/image</td><td class="type">imageUrl</td></tr>
      </tbody>
    </table></div>
    <div class="prose" style="margin-top:12px"><p>File disimpan di IndexedDB dan bisa diambil lewat <code>GET /api/v1/uploads/:fileId</code> (URL lengkapnya ada di field gambar dan header <code>Location</code>). Di localhost, SDK otomatis membuat <code>&lt;img src="https://mock-api.pkl.local/api/v1/uploads/…"&gt;</code> bisa tampil.</p></div>
    ${codePanel('JavaScript', `const formData = new FormData();
formData.append('image', document.querySelector('#foto').files[0]);

const res = await fetch(\`\${BASE_URL}/products/prd-401/image\`, {
  method: 'POST',
  body: formData, // jangan set Content-Type, browser yang mengisi boundary
});
const product = await res.json();
document.querySelector('#preview').src = product.imageUrl;`, 'js')}

    <h2>Format error</h2>
    ${jsonPanel('Contoh response 400', { error: 'Bad Request', status: 400, message: 'Field wajib belum lengkap: slug, status', details: { missingFields: ['slug', 'status'], requiredFields: ['title', 'slug', 'content', 'category', 'tags', 'status', 'isPinned'] } })}
    ${pager({ href: '#/quickstart', label: 'Mulai di localhost' }, { href: `#/${CATEGORIES[0].key}`, label: CATEGORIES[0].name })}
  </div>`;
}

function pageCategory(cat) {
  const i = CATEGORIES.indexOf(cat);
  const prev = i === 0 ? { href: '#/conventions', label: 'Status code & aturan' } : { href: `#/${CATEGORIES[i - 1].key}`, label: CATEGORIES[i - 1].name };
  const next = { href: `#/${cat.key}/${cat.endpoints[0].slug}`, label: cat.endpoints[0].title };
  return `
  <div class="page">
    <div class="crumbs"><a href="#/">API Reference</a> / <span>${cat.name}</span></div>
    <h1 class="cat-title"><span class="emoji"><i class="ti ti-${cat.icon}" aria-hidden="true"></i></span>${cat.name}</h1>
    <div class="prose lead">${md(cat.desc)}</div>
    <div class="endpoint-line"><span class="base">Resource</span> /api/v1/${cat.key}</div>

    <h2>Endpoint</h2>
    <div class="table-wrap"><table class="endpoint-table">
      <thead><tr><th>Method</th><th>Path</th><th>Keterangan</th></tr></thead>
      <tbody>${cat.endpoints.map((e) => `<tr data-href="#/${cat.key}/${e.slug}"><td><span class="m m-${e.method}">${e.method}</span></td><td class="path">${esc(e.path)}</td><td class="desc">${esc(e.title)}</td></tr>`).join('')}</tbody>
    </table></div>

    <h2>Objek data</h2>
    ${fieldTable(cat.schema.map(([name, type, desc]) => ({ name, type, desc })), false)}

    ${dbSection(cat)}
    ${pager(prev, next)}
  </div>`;
}

function pageEndpoint(cat, ep) {
  const all = CATEGORIES.flatMap((c) => c.endpoints.map((e) => ({ c, e })));
  const idx = all.findIndex((x) => x.e === ep);
  const p = all[idx - 1];
  const n = all[idx + 1];
  const pathParams = ep.pathParams || (ep.path.includes(':id') ? [{ name: 'id', type: 'string', desc: `ID data, contoh \`${cat.idExample}\`` }] : []);
  return `
  <div class="page">
    <div class="crumbs"><a href="#/">API Reference</a> / <a href="#/${cat.key}">${cat.name}</a> / <span>${esc(ep.title)}</span></div>
    <div class="split">
      <div class="doc">
        <h1>${esc(ep.title)}</h1>
        <div class="endpoint-line"><span class="m m-${ep.method}">${ep.method}</span><span><span class="base">/api/v1</span>${esc(ep.path)}</span></div>
        <div class="prose">${md(ep.desc)}</div>

        ${pathParams.length ? `<h3>Path parameter</h3>${fieldTable(pathParams.map((x) => ({ ...x, required: true })), true)}` : ''}
        ${ep.query ? `<h3>Query parameter</h3>${fieldTable(ep.query, true)}` : ''}
        ${ep.form ? `<h3>Request body <span class="pill">multipart/form-data</span></h3>${fieldTable(ep.form, true)}` : ''}
        ${ep.body ? `<h3>Request body <span class="pill">application/json</span></h3>${fieldTable(ep.body, true)}` : ''}

        <h3>Response</h3>
        <div class="table-wrap"><table>
          <tbody>${ep.responses.map(([c, d]) => `<tr><td style="width:80px"><span class="code-status ${statusClass(c)}">${c}</span></td><td class="desc">${inline(d)}</td></tr>`).join('')}</tbody>
        </table></div>
      </div>

      <div class="console">
        ${tryPanel(ep)}
        ${snippetPanel(ep)}
      </div>
    </div>
    ${dbSection(cat)}
    ${pager(p && { href: `#/${p.c.key}/${p.e.slug}`, label: p.e.title }, n && { href: `#/${n.c.key}/${n.e.slug}`, label: n.e.title })}
  </div>`;
}

/* ================================================================ */
/* Components                                                        */
/* ================================================================ */
function pager(prev, next) {
  return `<nav class="pager">
    ${prev ? `<a href="${prev.href}"><small><i class="ti ti-arrow-left" aria-hidden="true"></i> Sebelumnya</small><span>${esc(prev.label)}</span></a>` : ''}
    ${next ? `<a class="next" href="${next.href}"><small>Berikutnya <i class="ti ti-arrow-right" aria-hidden="true"></i></small><span>${esc(next.label)}</span></a>` : ''}
  </nav>`;
}

function fieldTable(fields, showRequired) {
  return `<div class="table-wrap"><table>
    <thead><tr><th>Field</th><th>Tipe</th><th>Keterangan</th></tr></thead>
    <tbody>${fields.map((f) => `<tr>
      <td class="name">${esc(f.name)}${showRequired ? (f.required ? '<span class="req">wajib</span>' : '<span class="opt">opsional</span>') : ''}</td>
      <td class="type">${esc(f.type)}</td>
      <td class="desc">${f.desc ? inline(f.desc) : '—'}${f.example ? ` <span class="pill">contoh: <code>${esc(f.example)}</code></span>` : ''}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function codePanel(title, code, lang) {
  const body = lang === 'js' ? highlightJs(code) : esc(code);
  return `<div class="panel" style="margin:12px 0 4px">
    <div class="panel-head"><span class="title"><i class="ti ti-code" aria-hidden="true"></i> ${title}</span><button class="mini-btn" data-copy="${esc(code)}">Copy</button></div>
    <pre>${body}</pre>
  </div>`;
}

function jsonPanel(title, obj) {
  const text = JSON.stringify(obj, null, 2);
  return `<div class="panel" style="margin:12px 0 4px">
    <div class="panel-head"><span class="title"><i class="ti ti-code" aria-hidden="true"></i> ${title}</span></div>
    <pre>${highlightJson(text)}</pre>
  </div>`;
}

function tryPanel(ep) {
  const hasBody = !NO_BODY.includes(ep.method);
  return `<div class="panel" id="try">
    <div class="panel-head"><span class="title"><i class="ti ti-bolt" aria-hidden="true"></i> Try it</span><button class="mini-btn" id="try-reset">Reset contoh</button></div>
    <div class="try-body">
      <div class="url-row"><span class="m m-${ep.method}">${ep.method}</span><input id="try-url" spellcheck="false" value="${esc(API + ep.example.url)}" aria-label="URL" /></div>
      ${ep.upload ? uploadField() : ''}
      ${hasBody && !ep.upload ? `<div class="try-label"><span>Body (JSON)</span><button class="mini-btn" id="try-format">Format</button></div>
      <textarea id="try-body" spellcheck="false">${esc(JSON.stringify(ep.example.body, null, 2))}</textarea>` : ''}
      <div class="try-actions">
        <label class="check"><input type="checkbox" id="try-delay" checked /> Simulasi latency</label>
        <button class="btn btn-primary send-btn" id="try-send"><i class="ti ti-send" aria-hidden="true"></i> Send</button>
      </div>
    </div>
  </div>
  <div class="panel" id="resp">
    <div class="panel-head"><span class="title"><i class="ti ti-arrow-back-up" aria-hidden="true"></i> Response</span><span class="resp-meta" id="resp-meta"></span></div>
    <div id="resp-out"><div class="resp-empty">Tekan <strong>Send</strong> untuk melihat response.</div></div>
  </div>`;
}

function uploadField() {
  return `<div class="try-label"><span>Body (FormData) · field <code>image</code></span><button class="mini-btn" id="try-sample">Pakai gambar contoh</button></div>
      <label class="dropzone" id="dropzone">
        <input type="file" id="try-file" accept="image/png,image/jpeg,image/webp,image/gif" />
        <img id="try-preview" alt="" hidden />
        <span class="dz-text" id="dz-text"></span>
      </label>`;
}

const DZ_EMPTY = '<i class="ti ti-photo-up" aria-hidden="true"></i><b>Pilih atau seret gambar ke sini</b><small>PNG, JPEG, WEBP, GIF · maks 2 MB</small>';

/** Buat gambar PNG contoh lewat canvas (untuk mencoba upload tanpa menyiapkan file). */
function makeSampleImage(label) {
  const c = document.createElement('canvas');
  c.width = 480; c.height = 300;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 480, 300);
  grad.addColorStop(0, '#6366f1'); grad.addColorStop(1, '#a855f7');
  g.fillStyle = grad; g.fillRect(0, 0, 480, 300);
  g.fillStyle = 'rgba(255,255,255,.15)';
  for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(60 + i * 80, 240 - (i % 2) * 60, 30 + i * 6, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#fff'; g.textAlign = 'center';
  g.font = '700 30px Inter, system-ui, sans-serif'; g.fillText(label, 240, 140);
  g.font = '500 16px "JetBrains Mono", monospace'; g.fillText(new Date().toLocaleTimeString('id-ID'), 240, 175);
  return new Promise((r) => c.toBlob((b) => r(new File([b], `contoh-${Date.now()}.png`, { type: 'image/png' })), 'image/png'));
}

let selectedFile = null;

function setSelectedFile(file) {
  selectedFile = file || null;
  const img = $('#try-preview');
  const text = $('#dz-text');
  if (!img) return;
  if (img.src) URL.revokeObjectURL(img.src);
  if (selectedFile) {
    img.src = URL.createObjectURL(selectedFile);
    img.hidden = false;
    text.innerHTML = `<b>${esc(selectedFile.name)}</b><small>${esc(selectedFile.type || 'unknown')} · ${(selectedFile.size / 1024).toFixed(1)} KB · klik untuk ganti</small>`;
  } else {
    img.hidden = true;
    img.removeAttribute('src');
    text.innerHTML = DZ_EMPTY;
  }
}

function uploadSnippet(ep, mode) {
  const path = ep.example.url;
  const url = mode === 'sdk' ? '`${BASE_URL}' + path + '`' : `'${API}${path}'`;
  return [
    '<!-- HTML -->',
    '<input type="file" id="foto" accept="image/*" />',
    '<img id="preview" />',
    '',
    ...(mode === 'sdk' ? [`const BASE_URL = '${MOCK_BASE}';`] : []),
    "const file = document.querySelector('#foto').files[0];",
    '',
    'const formData = new FormData();',
    "formData.append('image', file);",
    '',
    `const res = await fetch(${url}, {`,
    "  method: 'POST',",
    '  body: formData, // JANGAN set header Content-Type sendiri',
    '});',
    'const data = await res.json();',
    'if (!res.ok) throw new Error(data.message);',
    '',
    `document.querySelector('#preview').src = data.${ep.imageField};`,
  ].join('\n');
}

function snippetFor(ep, base, mode) {
  if (ep.upload) return uploadSnippet(ep, mode);
  const path = ep.example.url;
  const lines = [];
  if (mode === 'sdk') lines.push(`const BASE_URL = '${base}';`, '');
  const url = mode === 'sdk' ? `\`\${BASE_URL}${path}\`` : `'${API}${path}'`;
  const hasBody = !NO_BODY.includes(ep.method);
  if (ep.method === 'GET' && !hasBody) lines.push(`const res = await fetch(${url});`);
  else {
    lines.push(`const res = await fetch(${url}, {`, `  method: '${ep.method}',`);
    if (hasBody) {
      lines.push(`  headers: { 'Content-Type': 'application/json' },`);
      const bodyStr = JSON.stringify(ep.example.body, null, 2).split('\n').map((l, i) => (i ? `  ${l}` : l)).join('\n');
      lines.push(`  body: JSON.stringify(${bodyStr}),`);
    }
    lines.push('});');
  }
  lines.push('');
  if (ep.method === 'HEAD') lines.push("// HEAD tidak punya body, cukup cek status", "console.log(res.status === 200 ? 'Sudah dipakai' : 'Tersedia');");
  else if (ep.method === 'DELETE') lines.push("// 204 = berhasil, body kosong (jangan res.json())", "if (res.status === 204) console.log('Terhapus');");
  else {
    lines.push('const data = await res.json();');
    lines.push("if (!res.ok) throw new Error(data.message);");
    if (ep.slug === 'list') lines.push("console.log(res.headers.get('X-Total-Count'), data);");
    else if (ep.method === 'POST') lines.push("console.log(res.headers.get('Location'), data);");
    else lines.push('console.log(data);');
  }
  return lines.join('\n');
}

function snippetPanel(ep) {
  return `<div class="panel" id="snippet">
    <div class="panel-head">
      <div class="tabs-mini"><button class="on" data-snip="sdk">localhost (SDK)</button><button data-snip="page">halaman ini</button></div>
      <button class="mini-btn" id="snip-copy">Copy</button>
    </div>
    <pre id="snip-code">${highlightJs(snippetFor(ep, MOCK_BASE, 'sdk'))}</pre>
  </div>`;
}

function dbSection(cat) {
  return `<div class="db-head">
      <h2>Live data <span class="pill">IndexedDB → ${cat.key}</span></h2>
      <div style="display:flex;gap:8px;align-items:center"><span class="pill" id="db-count"></span><button class="btn" id="db-refresh"><i class="ti ti-refresh" aria-hidden="true"></i> Refresh</button></div>
    </div>
    <div class="table-wrap"><table class="db-table" id="db-table" data-cat="${cat.key}"><tbody><tr><td class="null">Memuat…</td></tr></tbody></table></div>`;
}

/* ================================================================ */
/* Live DB                                                           */
/* ================================================================ */
async function refreshDB() {
  const table = $('#db-table');
  if (!table) return;
  const name = table.dataset.cat;
  const rows = await getAll(name);
  if (!document.body.contains(table)) return;
  $('#db-count').textContent = `${rows.length} baris`;
  if (!rows.length) {
    table.innerHTML = '<tbody><tr><td class="null">Koleksi kosong. Klik “Reset data” untuk mengembalikan data awal.</td></tr></tbody>';
    return;
  }
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v) => {
    if (v === null || v === undefined) return '<td class="null">null</td>';
    if (isUploadUrl(v)) return `<td><a href="${esc(v)}" target="_blank" rel="noopener" title="${esc(v)}"><img class="thumb" src="${esc(v)}" alt="" /></a></td>`;
    return `<td>${esc(typeof v === 'object' ? JSON.stringify(v) : v)}</td>`;
  };
  table.innerHTML =
    `<thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>` +
    `<tbody>${rows.map((r) => `<tr class="${r.id === lastChangedId ? 'flash' : ''}">${cols.map((c) => cell(r[c])).join('')}</tr>`).join('')}</tbody>`;
  lastChangedId = null;
}

/* ================================================================ */
/* Try it                                                            */
/* ================================================================ */
async function sendTry(ep) {
  const btn = $('#try-send');
  const rawUrl = $('#try-url').value.trim();
  let url;
  try { url = new URL(rawUrl, location.href); } catch { toast('URL tidak valid'); return; }
  const headers = {};
  if (!$('#try-delay').checked) headers['X-Mock-Delay'] = '0';
  const init = { method: ep.method, headers };
  if (ep.upload) {
    const fd = new FormData();
    if (selectedFile) fd.append('image', selectedFile);
    init.body = fd; // Content-Type multipart diisi otomatis oleh browser
  } else if ($('#try-body')) { headers['Content-Type'] = 'application/json'; init.body = $('#try-body').value; }

  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2 spin" aria-hidden="true"></i> Loading…';
  $('#resp-meta').innerHTML = '<span class="time">menunggu…</span>';
  const t0 = performance.now();
  try {
    const res = swActive ? await fetch(url, init) : await handleApiRequest(new Request(url, init));
    const ms = Math.round(performance.now() - t0);
    const isImage = (res.headers.get('Content-Type') || '').startsWith('image/');
    const blob = isImage ? await res.blob() : null;
    const text = ep.method === 'HEAD' || isImage ? '' : await res.text();
    renderResponse(res, text, ms, blob);
    if (res.ok && MUTATING.includes(ep.method)) {
      try { lastChangedId = JSON.parse(text).id ?? null; } catch { lastChangedId = null; }
      await refreshDB();
    }
  } catch (e) {
    $('#resp-meta').innerHTML = '<span class="code-status s5">Error</span>';
    $('#resp-out').innerHTML = `<pre>${esc(String(e))}</pre>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-send" aria-hidden="true"></i> Send';
  }
}

const IMAGE_FIELDS = ['coverImageUrl', 'attachmentUrl', 'avatarUrl', 'imageUrl'];
const isUploadUrl = (v) => typeof v === 'string' && v.includes('/api/v1/uploads/');

function renderResponse(res, text, ms, blob) {
  $('#resp-meta').innerHTML = `<span class="code-status ${statusClass(res.status)}">${res.status} ${esc(res.statusText)}</span><span class="time">${ms} ms${swActive ? '' : ' · direct'}</span>`;
  const show = ['content-type', 'x-total-count', 'location', 'allow'];
  const headers = [...res.headers.entries()].filter(([k]) => show.includes(k));
  let body;
  if (blob) body = `<div class="resp-image"><img src="${URL.createObjectURL(blob)}" alt="Response gambar" /></div>`;
  else if (!text) body = `<div class="resp-empty">Body kosong (<code>null</code>)${res.status === 204 ? ' — inilah kenapa DELETE tidak boleh memanggil <code>res.json()</code>' : ''}</div>`;
  else {
    try {
      const data = JSON.parse(text);
      const imgs = data && !Array.isArray(data) ? IMAGE_FIELDS.filter((f) => isUploadUrl(data[f])) : [];
      const preview = imgs.map((f) => `<figure class="resp-image"><img src="${esc(data[f])}" alt="${f}" /><figcaption>${f}</figcaption></figure>`).join('');
      body = preview + `<pre>${highlightJson(JSON.stringify(data, null, 2))}</pre>`;
    }
    catch { body = `<pre>${esc(text)}</pre>`; }
  }
  $('#resp-out').innerHTML =
    (headers.length ? `<div class="resp-headers">${headers.map(([k, v]) => `<div><b>${esc(k)}:</b> ${esc(v)}</div>`).join('')}</div>` : '') + body;
}

function bindEndpointPage(ep) {
  const resetExample = () => {
    $('#try-url').value = API + ep.example.url;
    if ($('#try-body')) $('#try-body').value = JSON.stringify(ep.example.body, null, 2);
    if (ep.upload) { $('#try-file').value = ''; setSelectedFile(null); }
  };
  if (ep.upload) {
    selectedFile = null;
    $('#dz-text').innerHTML = DZ_EMPTY;
    $('#try-file').addEventListener('change', (e) => setSelectedFile(e.target.files[0]));
    $('#try-sample').addEventListener('click', async () => setSelectedFile(await makeSampleImage(ep.title)));
    const dz = $('#dropzone');
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('over'));
    dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('over'); setSelectedFile(e.dataTransfer.files[0]); });
  }
  $('#try-send').addEventListener('click', () => sendTry(ep));
  $('#try-url').addEventListener('keydown', (e) => e.key === 'Enter' && sendTry(ep));
  $('#try-body')?.addEventListener('keydown', (e) => e.key === 'Enter' && (e.ctrlKey || e.metaKey) && sendTry(ep));
  $('#try-reset').addEventListener('click', resetExample);
  $('#try-format')?.addEventListener('click', () => {
    try { $('#try-body').value = JSON.stringify(JSON.parse($('#try-body').value), null, 2); }
    catch (err) { toast(`JSON tidak valid: ${err.message}`); }
  });
  let mode = 'sdk';
  $$('[data-snip]').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.snip;
    $$('[data-snip]').forEach((x) => x.classList.toggle('on', x === b));
    $('#snip-code').innerHTML = highlightJs(snippetFor(ep, MOCK_BASE, mode));
  }));
  $('#snip-copy').addEventListener('click', () => copyText(snippetFor(ep, MOCK_BASE, mode)));
}

/* ================================================================ */
/* Router                                                            */
/* ================================================================ */
function route() {
  const parts = (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean);
  const content = $('#content');
  let html;
  let ep = null;
  let title = 'PKL Mock API Docs';
  if (!parts.length) html = pageIntro();
  else if (parts[0] === 'quickstart') { html = pageQuickstart(); title = 'Mulai di localhost · PKL Mock API'; }
  else if (parts[0] === 'conventions') { html = pageConventions(); title = 'Status code & aturan · PKL Mock API'; }
  else {
    const cat = findCat(parts[0]);
    ep = cat && parts[1] ? cat.endpoints.find((e) => e.slug === parts[1]) : null;
    if (cat && ep) { html = pageEndpoint(cat, ep); title = `${ep.method} ${ep.path} · PKL Mock API`; }
    else if (cat && !parts[1]) { html = pageCategory(cat); title = `${cat.name} · PKL Mock API`; }
    else html = `<div class="page"><h1>Halaman tidak ditemukan</h1><p class="lead"><a href="#/">Kembali ke Pengenalan</a></p></div>`;
  }
  content.innerHTML = html;
  document.title = title;
  document.body.classList.remove('nav-open');
  markActiveNav();
  window.scrollTo(0, 0);
  if (ep) bindEndpointPage(ep);
  refreshDB();
}

/* ================================================================ */
/* Service Worker                                                    */
/* ================================================================ */
function setStatus(text, kind, tip) {
  const el = $('#sw-status');
  el.className = `status status-${kind}`;
  el.querySelector('b').textContent = text;
  el.title = tip;
}

async function registerSW() {
  if (!('serviceWorker' in navigator)) {
    setStatus('Direct mode', 'pending', 'Browser tidak mendukung Service Worker; request dijalankan langsung tanpa tampil di tab Network.');
    return;
  }
  try {
    await navigator.serviceWorker.register('./sw.js', { type: 'module', scope: './', updateViaCache: 'none' });
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => {
        const t = setTimeout(resolve, 3000);
        navigator.serviceWorker.addEventListener('controllerchange', () => { clearTimeout(t); resolve(); }, { once: true });
      });
    }
    swActive = Boolean(navigator.serviceWorker.controller);
    if (swActive) setStatus('API Online', 'ok', 'Service Worker aktif — request terlihat di DevTools → Network');
    else setStatus('Direct mode', 'pending', 'Service Worker belum mengontrol halaman (hard reload?). Reload biasa untuk mengaktifkan.');
  } catch (e) {
    console.error(e);
    setStatus('Direct mode', 'err', `Gagal registrasi Service Worker: ${e.message}`);
  }
}

/* ================================================================ */
/* Global events & init                                              */
/* ================================================================ */
function bindGlobal() {
  window.addEventListener('hashchange', route);
  $('#search').addEventListener('input', (e) => renderNav(e.target.value));
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); $('#search').focus(); }
    if (e.key === 'Escape') document.body.classList.remove('nav-open');
  });
  $('#btn-menu').addEventListener('click', () => document.body.classList.toggle('nav-open'));
  $('#backdrop').addEventListener('click', () => document.body.classList.remove('nav-open'));
  $('#btn-reset').addEventListener('click', async () => {
    if (!confirm('Kembalikan semua data (articles, bookings, users, products) ke kondisi awal?')) return;
    await resetAll();
    await refreshDB();
    toast('Semua data dikembalikan ke kondisi awal');
  });
  // Delegasi klik di area konten
  $('#content').addEventListener('click', (e) => {
    const copy = e.target.closest('[data-copy]');
    if (copy) return copyText(copy.dataset.copy);
    const row = e.target.closest('tr[data-href]');
    if (row) location.hash = row.dataset.href;
    if (e.target.closest('#db-refresh')) refreshDB();
  });
}

async function main() {
  renderNav();
  bindGlobal();
  await initDB();
  route();
  await registerSW();
}

main().catch((e) => {
  console.error(e);
  setStatus('Error', 'err', String(e));
  $('#content').innerHTML = `<div class="page"><h1>Gagal memuat dokumentasi</h1>
    <p class="lead">Coba muat ulang halaman dengan <code>Ctrl + Shift + R</code>. Jika masih gagal, kirim pesan error berikut ke pembimbing:</p>
    <div class="endpoint-line">${esc(e && e.message ? e.message : e)}</div></div>`;
});
