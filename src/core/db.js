/**
 * db.js — Wrapper IndexedDB async.
 * IndexedDB bisa diakses dari `window` maupun `ServiceWorkerGlobalScope`,
 * sehingga UI dan Service Worker membaca database yang sama.
 *
 * Setiap koleksi disimpan sebagai satu array dengan key = nama koleksi.
 */
import { seeds } from '../data/seeds.js';

const DB_NAME = 'pkl-mock-api';
const DB_VERSION = 2;
const STORE = 'collections';
const FILES = 'files';

export const COLLECTIONS = Object.keys(seeds);

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES);
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

async function run(mode, fn, storeName = STORE) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let result;
    const req = fn(store);
    if (req) req.onsuccess = () => (result = req.result);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

const clone = (v) => JSON.parse(JSON.stringify(v));

function assertCollection(name) {
  if (!COLLECTIONS.includes(name)) throw new Error(`Koleksi tidak dikenal: ${name}`);
}

/** Pastikan seluruh koleksi sudah ter-seed. */
export async function init() {
  for (const name of COLLECTIONS) await getAll(name);
}

/** Ambil seluruh isi koleksi (auto-seed jika belum ada). */
export async function getAll(name) {
  assertCollection(name);
  const data = await run('readonly', (s) => s.get(name));
  if (data === undefined) {
    const seeded = clone(seeds[name]);
    await saveAll(name, seeded);
    return seeded;
  }
  return data;
}

/** Simpan (timpa) seluruh isi koleksi. */
export async function saveAll(name, items) {
  assertCollection(name);
  await run('readwrite', (s) => s.put(clone(items), name));
}

/** Reset satu koleksi ke kondisi seed. */
export async function reset(name) {
  assertCollection(name);
  await saveAll(name, seeds[name]);
}

/** Reset seluruh koleksi ke kondisi seed awal. */
export async function resetAll() {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction([STORE, FILES], 'readwrite');
    const store = tx.objectStore(STORE);
    for (const name of COLLECTIONS) store.put(clone(seeds[name]), name);
    tx.objectStore(FILES).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ---------------- File storage (gambar upload) ---------------- */

/** Simpan file: { blob, name, type, size, createdAt }. */
export async function putFile(id, record) {
  await run('readwrite', (s) => s.put(record, id), FILES);
}

export async function getFile(id) {
  return run('readonly', (s) => s.get(id), FILES);
}

export async function deleteFile(id) {
  await run('readwrite', (s) => s.delete(id), FILES);
}
