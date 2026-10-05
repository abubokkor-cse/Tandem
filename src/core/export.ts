// Research exports: JSON keeps the whole audit trail; CSV has one row per answer.

import { NOT_VISIBLE } from './ai';
import { optionLabel, question, type Answer } from './protocol';
import { summarize, type StreamCheck } from './record';

const fmt = (id: Parameters<typeof optionLabel>[0], v: Answer | undefined) =>
  v === undefined ? '' : Array.isArray(v) ? (v.length ? v.map((x) => optionLabel(id, x)).join('; ') : 'none') : optionLabel(id, String(v));

const cell = (s: unknown) => {
  const t = String(s ?? '');
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

export function toCsv(records: StreamCheck[]): string {
  const header = [
    'record_id', 'created_at', 'site_code', 'site_name', 'city', 'synthetic', 'overall_rating', 'trust_label',
    'question', 'first_answer', 'final_answer', 'ai_answer', 'ai_looks_agreeing', 'ai_looks', 'status', 'citizen_decision', 'reason', 'ai_evidence',
  ];
  const rows = [header.join(',')];
  for (const r of records) {
    const t = summarize(r);
    for (const c of r.comparisons) {
      const ai = c.ai;
      rows.push(
        [
          r.id, r.createdAt, r.site.code ?? '', r.site.name, r.site.city ?? '', r.synthetic ? 'yes' : 'no', r.overall ?? '', t.label,
          question(c.question).title,
          fmt(c.question, c.original ?? c.citizen),
          fmt(c.question, r.answers[c.question]),
          ai ? (ai.value === NOT_VISIBLE ? 'cannot tell' : fmt(c.question, ai.value)) : '',
          ai ? Math.round(ai.support * ai.looks) : '',
          ai?.looks ?? '',
          c.status, c.resolution ?? '', c.reason ?? '', ai?.evidence ?? '',
        ].map(cell).join(','),
      );
    }
  }
  return rows.join('\n');
}

export function toJson(records: StreamCheck[]): string {
  // Thumbnails stay on the device.
  return JSON.stringify(records.map((r) => ({ ...r, photos: r.photos.map(({ thumb: _t, ...p }) => p) })), null, 2);
}

export function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
