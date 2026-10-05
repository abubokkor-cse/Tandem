// Records stay on this device (localStorage). Nothing is uploaded except photos sent to the AI.
import type { StreamCheck } from '../core/record';

const KEY = 'tandem.records.v1';

export function loadRecords(): StreamCheck[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as StreamCheck[];
  } catch {
    return [];
  }
}

export function saveRecord(r: StreamCheck): void {
  const all = [r, ...loadRecords().filter((x) => x.id !== r.id)];
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage full: keep the record, drop photo thumbnails from the oldest ones.
    const slim = all.map((x, i) => (i === 0 ? x : { ...x, photos: x.photos.map(({ thumb: _t, ...p }) => p) }));
    try {
      localStorage.setItem(KEY, JSON.stringify(slim));
    } catch {
      /* give up silently; the export buttons still work */
    }
  }
}

export function deleteRecord(id: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(loadRecords().filter((x) => x.id !== id)));
  } catch {
    /* ignore */
  }
}

export function newId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
