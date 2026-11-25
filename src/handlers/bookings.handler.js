/**
 * Studi Kasus 2: Sistem Reservasi Ruangan Meeting — /api/v1/bookings
 */
import { getAll, saveAll } from '../core/db.js';
import { imageEndpoint, removeImageByUrl, IMAGE_ROUTES } from '../core/uploads.js';
import {
  json, empty, notFound, conflict, methodNotAllowed, paginate, nextId,
  isNonEmptyString, checkPayload, checkPatch, checkBodyId, validationFailed, unprocessable,
} from '../core/http.js';

const COLLECTION = 'bookings';
const BASE = '/api/v1/bookings';
const STATUSES = ['confirmed', 'checked_in', 'cancelled'];
const POST_REQUIRED = ['roomId', 'bookedBy', 'date', 'startTime', 'endTime', 'participants'];
const PUT_REQUIRED = [...POST_REQUIRED, 'status'];
const PATCH_ALLOWED = ['status', 'notes', 'participants'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function isValidDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function validate(data) {
  const errors = [];
  for (const f of ['roomId', 'bookedBy']) {
    if (f in data && !isNonEmptyString(data[f])) errors.push({ field: f, message: `${f} harus berupa string dan tidak boleh kosong` });
  }
  if ('date' in data && !isValidDate(data.date)) errors.push({ field: 'date', message: 'date harus format YYYY-MM-DD yang valid' });
  for (const f of ['startTime', 'endTime']) {
    if (f in data && !(typeof data[f] === 'string' && TIME_RE.test(data[f]))) errors.push({ field: f, message: `${f} harus format HH:mm (00:00–23:59)` });
  }
  if ('participants' in data && !(Number.isInteger(data.participants) && data.participants > 0)) {
    errors.push({ field: 'participants', message: 'participants harus bilangan bulat > 0' });
  }
  if ('status' in data && !STATUSES.includes(data.status)) {
    errors.push({ field: 'status', message: `status harus salah satu dari: ${STATUSES.join(', ')}` });
  }
  if ('notes' in data && data.notes !== null && typeof data.notes !== 'string') {
    errors.push({ field: 'notes', message: 'notes harus string atau null' });
  }
  return errors;
}

function timeRangeError(b) {
  if (b.startTime >= b.endTime) {
    return unprocessable('startTime harus lebih awal dari endTime', {
      errors: [{ field: 'startTime', message: `startTime (${b.startTime}) harus < endTime (${b.endTime})` }],
    });
  }
  return null;
}

/** Cari booking aktif yang bentrok di ruangan & tanggal yang sama. */
function findConflicts(items, b, excludeId) {
  return items.filter(
    (x) =>
      x.id !== excludeId &&
      x.status !== 'cancelled' &&
      x.roomId === b.roomId &&
      x.date === b.date &&
      b.startTime < x.endTime &&
      b.endTime > x.startTime,
  );
}

function conflictResponse(b, clashes) {
  return conflict(`Jadwal ${b.roomId} pada ${b.date} jam ${b.startTime}–${b.endTime} bentrok dengan reservasi lain`, {
    conflicts: clashes.map(({ id, bookedBy, startTime, endTime, status }) => ({ id, bookedBy, startTime, endTime, status })),
  });
}

export async function handle(ctx) {
  const { method, params, query, body } = ctx;
  const items = await getAll(COLLECTION);

  if (params.length === 0) {
    if (method === 'GET') {
      let result = items;
      if (query.roomId) result = result.filter((b) => b.roomId === query.roomId);
      if (query.date) result = result.filter((b) => b.date === query.date);
      if (query.status) result = result.filter((b) => b.status === query.status);
      const page = paginate(result, query);
      if (page.error) return page.error;
      return json(200, page.data, { 'X-Total-Count': page.total });
    }
    if (method === 'POST') {
      const invalid = checkPayload(body, { required: POST_REQUIRED, optional: ['notes'] });
      if (invalid) return invalid;
      const errors = validate(body);
      if (errors.length) return validationFailed(errors);
      const rangeErr = timeRangeError(body);
      if (rangeErr) return rangeErr;
      const clashes = findConflicts(items, body, null);
      if (clashes.length) return conflictResponse(body, clashes);
      const booking = {
        id: nextId(items, 'bkg', 201),
        roomId: body.roomId,
        bookedBy: body.bookedBy,
        date: body.date,
        startTime: body.startTime,
        endTime: body.endTime,
        participants: body.participants,
        status: 'confirmed',
        notes: body.notes || null,
        attachmentUrl: null,
      };
      await saveAll(COLLECTION, [...items, booking]);
      return json(201, booking, { Location: `${BASE}/${booking.id}` });
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
  const idx = items.findIndex((b) => b.id === id);
  if (idx === -1) return notFound(`Reservasi dengan id "${id}" tidak ditemukan`);
  const existing = items[idx];

  if (method === 'GET') return json(200, existing);

  if (method === 'PUT') {
    const invalid = checkPayload(body, { required: PUT_REQUIRED, optional: ['notes', 'id'] }) || checkBodyId(body, id);
    if (invalid) return invalid;
    const errors = validate(body);
    if (errors.length) return validationFailed(errors);
    const rangeErr = timeRangeError(body);
    if (rangeErr) return rangeErr;
    if (body.status !== 'cancelled') {
      const clashes = findConflicts(items, body, id);
      if (clashes.length) return conflictResponse(body, clashes);
    }
    const replaced = {
      id,
      roomId: body.roomId,
      bookedBy: body.bookedBy,
      date: body.date,
      startTime: body.startTime,
      endTime: body.endTime,
      participants: body.participants,
      status: body.status,
      notes: body.notes === undefined ? null : body.notes,
      attachmentUrl: existing.attachmentUrl ?? null,
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
    const merged = { ...existing, ...body };
    // Mengaktifkan kembali booking yang dibatalkan harus tetap bebas bentrok.
    if (existing.status === 'cancelled' && merged.status !== 'cancelled') {
      const clashes = findConflicts(items, merged, id);
      if (clashes.length) return conflictResponse(merged, clashes);
    }
    items[idx] = merged;
    await saveAll(COLLECTION, items);
    return json(200, merged);
  }

  items.splice(idx, 1);
  await saveAll(COLLECTION, items);
  await removeImageByUrl(existing[IMAGE_ROUTES[COLLECTION].field]);
  return empty(204);
}
