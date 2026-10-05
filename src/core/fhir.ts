// FHIR R4 export shaped by the OneAquaHealth Implementation Guide (github.com/hl7-eu/oah, 0.1.0-ci-build).
//
// What the IG requires, and how we meet it:
// - ObservationIndicatorsOah: status = final, code (OAH indicator, preferred binding), subject = LocationOah,
//   effective[x], performer, value CodeableConcept or Quantity; components CodeableConcept/string/Quantity.
// - LocationOah: identifier, name, mode = instance, position (lat/long).
// The IG has no codes for the citizen form's individual questions, so each Observation carries two codings:
// the OAH indicator it belongs to (TemporaryOahSystem) and the question itself (our citizen-question system).
// How each answer was reached (agreed with the AI, kept or changed after a second look) is recorded in
// Observation.note and in a Provenance resource, so nothing about the AI's role is hidden.

import { ANOMALY_LABELS, NOT_VISIBLE } from './ai';
import { HEALTH_RATINGS, NOT_SURE, QUESTIONS, question, type Answer, type QuestionId } from './protocol';
import type { StreamCheck } from './record';

export const OAH = 'http://hl7.eu/fhir/ig/oah';
export const OAH_SYSTEM = `${OAH}/CodeSystem/temporarySystem-oah-eu`;
export const OAH_LOCATION_ID = 'https://oneaquahealth.eu/location-id';
/** Canonical base for Tandem's own code systems. Change to the published repository URL. */
export const TANDEM = 'https://github.com/tandem-oah/tandem/fhir';
const DAR = 'http://terminology.hl7.org/CodeSystem/data-absent-reason';

/** Which OAH indicator each citizen question informs. */
export const OAH_INDICATOR: Record<QuestionId, { code: string; display: string }> = {
  channel_form: { code: 'morophology', display: 'Morphology of the streams' },
  bottom_type: { code: 'morophology', display: 'Morphology of the streams' },
  bank_type: { code: 'morophology', display: 'Morphology of the streams' },
  habitats: { code: 'morophology', display: 'Morphology of the streams' },
  natural_debris: { code: 'morophology', display: 'Morphology of the streams' },
  water_flow: { code: 'hydrology', display: 'Hydrology of the stream' },
  water_height: { code: 'hydrology', display: 'Hydrology of the stream' },
  water_withdrawal: { code: 'hydrology', display: 'Hydrology of the stream' },
  barriers: { code: 'hydrology', display: 'Hydrology of the stream' }, // longitudinal connectivity
  water_aspect: { code: 'foam', display: 'Foam/colour/smell' },
  draining_pipes: { code: 'LandUse', display: 'Land use in the margins' },
  sewage_discharge: { code: 'LandUse', display: 'Land use in the margins' },
  construction: { code: 'LandUse', display: 'Land use in the margins' },
  impervious_left: { code: 'LandUse', display: 'Land use in the margins' },
  impervious_right: { code: 'LandUse', display: 'Land use in the margins' },
  vegetation_left: { code: 'riparianVegetation', display: 'Riparian vegetation' },
  vegetation_right: { code: 'riparianVegetation', display: 'Riparian vegetation' },
  vegetation_type_left: { code: 'riparianVegetation', display: 'Riparian vegetation' },
  vegetation_type_right: { code: 'riparianVegetation', display: 'Riparian vegetation' },
  vegetation_cut: { code: 'riparianVegetation', display: 'Riparian vegetation' },
  invasive_species: { code: 'invasiveOrganisms', display: 'Invasive invertebrate, plants and fish' },
};

/** The OAH IG's own riparian vegetation codes, used where a citizen answer matches one. */
const OAH_VEGETATION: Record<string, { code: string; display: string }> = {
  trees: { code: 'trees', display: 'Trees (height >3m)' },
  shrubs: { code: 'bushes', display: 'Bushes (height (1.5-3m)' },
  herbs: { code: 'herbaceous', display: 'Herbaceous (height < 1.5m)' },
};

type Json = Record<string, unknown>;

function answerConcept(id: QuestionId, v: string): Json {
  const q = question(id);
  const label = q.options.find((o) => o.id === v)?.label ?? v;
  const coding: Json[] = [{ system: `${TANDEM}/CodeSystem/citizen-answer`, code: `${id}.${v}`, display: label }];
  if (id.startsWith('vegetation_type_') && OAH_VEGETATION[v]) coding.unshift({ system: OAH_SYSTEM, ...OAH_VEGETATION[v] });
  return { coding, text: label };
}

function decisionNote(r: StreamCheck, id: QuestionId): string | undefined {
  const c = r.comparisons.find((x) => x.question === id);
  if (!c?.ai) return undefined;
  const ai = c.ai.value === NOT_VISIBLE ? 'could not tell' : `saw ${c.ai.value.join(', ') || 'none'}`;
  const looks = `${Math.round(c.ai.support * c.ai.looks)}/${c.ai.looks} looks`;
  switch (c.status) {
    case 'corroborated':
      return `Corroborated by an independent AI look (${looks}).`;
    case 'second_look':
      return c.resolution === 'changed'
        ? `Changed by the citizen after a second look. First answer: ${String(c.original)}. AI ${ai} (${looks}).`
        : `Kept by the citizen after a second look. AI ${ai} (${looks}).${c.reason ? ` Reason: ${c.reason}.` : ''}`;
    case 'suggestion':
      return c.resolution === 'accepted' ? `Citizen was not sure and accepted the AI answer (${looks}).` : `Citizen not sure; AI ${ai} (${looks}), not accepted.`;
    case 'ai_unsure':
      return `AI looks did not agree (${looks}); no prompt was shown.`;
    default:
      return `AI ${ai}.`;
  }
}

export function toFhirBundle(r: StreamCheck): Json {
  const u = (s: string) => `urn:uuid:${uuidFrom(`${r.id}:${s}`)}`;
  const locationRef = u('location');
  const citizenRef = u('citizen');
  const deviceRef = u('ai');
  const effective = r.createdAt;
  const entries: Json[] = [];

  entries.push({
    fullUrl: locationRef,
    resource: {
      resourceType: 'Location',
      meta: { profile: [`${OAH}/StructureDefinition/location-oah`] },
      identifier: [r.site.code ? { system: OAH_LOCATION_ID, value: r.site.code } : { system: `${TANDEM}/location-id`, value: slug(r.site.name) }],
      name: r.site.name,
      ...(r.site.city ? { description: `${r.site.city} · OneAquaHealth ${r.site.code ? 'research site' : 'citizen site'}` } : {}),
      mode: 'instance',
      ...(r.site.lat !== undefined && r.site.lon !== undefined ? { position: { latitude: r.site.lat, longitude: r.site.lon } } : {}),
    },
  });

  entries.push({
    fullUrl: citizenRef,
    resource: {
      resourceType: 'Practitioner',
      // Pseudonymous: no name, contact or device identifier.
      identifier: [{ system: `${TANDEM}/citizen-id`, value: uuidFrom(`citizen:${r.id}`).slice(0, 8) }],
      name: [{ text: 'Citizen scientist (pseudonymous)' }],
    },
  });

  if (r.ai) {
    entries.push({
      fullUrl: deviceRef,
      resource: {
        resourceType: 'Device',
        deviceName: [{ name: `Tandem AI second look (${r.ai.model}, ${r.ai.looks} independent looks)`, type: 'user-friendly-name' }],
        note: [{ text: 'Vision-language model. Answers from photos only, without seeing the citizen answers. Never sets the overall rating.' }],
      },
    });
  }

  const obsRefs: string[] = [];
  const base = (id: string, code: Json, extra: Json): Json => {
    const ref = u(`obs:${id}`);
    obsRefs.push(ref);
    return {
      fullUrl: ref,
      resource: {
        resourceType: 'Observation',
        meta: { profile: [`${OAH}/StructureDefinition/observation-indicators-oah`] },
        status: 'final',
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'survey', display: 'Survey' }] }],
        code,
        subject: { reference: locationRef },
        effectiveDateTime: effective,
        performer: [{ reference: citizenRef }],
        method: { text: 'OneAquaHealth citizen stream check (visual, ca. 100 m reach), with an AI second look' },
        ...extra,
      },
    };
  };

  for (const q of QUESTIONS) {
    const v: Answer | undefined = r.answers[q.id];
    if (v === undefined) continue;
    const ind = OAH_INDICATOR[q.id];
    const code = {
      coding: [
        { system: OAH_SYSTEM, code: ind.code, display: ind.display },
        { system: `${TANDEM}/CodeSystem/citizen-question`, code: q.id, display: q.title },
      ],
      text: q.title,
    };
    const note = decisionNote(r, q.id);
    const extra: Json = note ? { note: [{ text: note }] } : {};
    if (v === NOT_SURE) {
      extra.dataAbsentReason = { coding: [{ system: DAR, code: 'asked-unknown', display: 'Asked But Unknown' }], text: 'Citizen was not sure' };
    } else if (q.kind === 'number' && typeof v === 'number') {
      extra.valueQuantity = { value: v, unit: 'm', system: 'http://unitsofmeasure.org', code: 'm' };
    } else if (q.kind === 'multi' && Array.isArray(v)) {
      if (v.length) extra.component = v.map((o) => ({ code: { coding: [{ system: `${TANDEM}/CodeSystem/citizen-question`, code: q.id }] }, valueCodeableConcept: answerConcept(q.id, o) }));
      else extra.valueCodeableConcept = { coding: [{ system: `${TANDEM}/CodeSystem/citizen-answer`, code: `${q.id}.none`, display: 'None' }], text: 'None' };
    } else {
      extra.valueCodeableConcept = answerConcept(q.id, String(v));
    }
    entries.push(base(q.id, code, extra));
  }

  if (r.overall) {
    const rating = HEALTH_RATINGS.find((x) => x.id === r.overall)!;
    entries.push(
      base('overall', { coding: [{ system: `${TANDEM}/CodeSystem/citizen-question`, code: 'overall_health', display: 'Overall assessment of the stream ecosystem health' }], text: 'Overall stream ecosystem health (citizen)' }, {
        valueCodeableConcept: { coding: [{ system: `${TANDEM}/CodeSystem/citizen-answer`, code: `overall_health.${rating.id}`, display: rating.label }], text: rating.label },
        note: [{ text: 'The citizen’s own judgement. The AI never suggests this rating.' }, ...(r.note ? [{ text: `Citizen note: ${r.note}` }] : [])],
      }),
    );
  }

  for (const a of r.anomalies.filter((x) => x.decision === 'confirmed')) {
    entries.push(
      base(`anomaly:${a.kind}`, { coding: [{ system: `${TANDEM}/CodeSystem/citizen-question`, code: 'additional_observation', display: 'Additional observation' }], text: 'Additional observation' }, {
        valueCodeableConcept: { coding: [{ system: `${TANDEM}/CodeSystem/anomaly`, code: a.kind, display: ANOMALY_LABELS[a.kind] }], text: ANOMALY_LABELS[a.kind] },
        note: [{ text: `Noticed by the AI (${Math.round(a.support * 3)}/3 looks) and confirmed by the citizen. AI evidence: ${a.evidence}` }],
      }),
    );
  }

  entries.push({
    fullUrl: u('provenance'),
    resource: {
      resourceType: 'Provenance',
      target: obsRefs.map((reference) => ({ reference })),
      recorded: effective,
      activity: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-DataOperation', code: 'CREATE', display: 'create' }],
        text: 'Citizen stream check with an independent AI second look (citizen answered first; AI saw photos only)',
      },
      agent: [
        { type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type', code: 'author', display: 'Author' }] }, who: { reference: citizenRef } },
        ...(r.ai
          ? [{ type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type', code: 'informant', display: 'Informant' }] }, who: { reference: deviceRef } }]
          : []),
      ],
    },
  });

  for (const e of entries) {
    const res = e.resource as Json;
    res.text = { status: 'generated', div: `<div xmlns="http://www.w3.org/1999/xhtml">${esc(narrate(res))}</div>` };
  }

  return {
    resourceType: 'Bundle',
    id: uuidFrom(`bundle:${r.id}`),
    meta: { lastUpdated: effective },
    identifier: { system: `${TANDEM}/record-id`, value: r.id },
    type: 'collection',
    timestamp: effective,
    entry: entries,
  };
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A short human-readable narrative for every resource (FHIR best practice dom-6). */
function narrate(r: Json): string {
  const cc = (c: unknown) => ((c as { text?: string; coding?: { display?: string }[] } | undefined)?.text ?? (c as { coding?: { display?: string }[] } | undefined)?.coding?.[0]?.display ?? '');
  switch (r.resourceType) {
    case 'Location':
      return `Stream site ${String(r.name)}`;
    case 'Practitioner':
      return 'Citizen scientist (pseudonymous)';
    case 'Device':
      return String((r.deviceName as { name: string }[])[0].name);
    case 'Observation': {
      const v = r.valueQuantity ? `${(r.valueQuantity as { value: number }).value} m` : r.valueCodeableConcept ? cc(r.valueCodeableConcept) : r.component ? (r.component as Json[]).map((c) => cc(c.valueCodeableConcept)).join(', ') : 'not sure';
      return `${cc(r.code)}: ${v}`;
    }
    case 'Provenance':
      return 'Citizen stream check with an independent AI second look';
    default:
      return String(r.resourceType);
  }
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'site';
}

/** Deterministic UUID-shaped id from a string (FNV-1a), so exports are stable and diffable. */
export function uuidFrom(s: string): string {
  const parts: string[] = [];
  for (let seed = 0; seed < 4; seed++) {
    let h = 0x811c9dc5 ^ seed;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    parts.push(h.toString(16).padStart(8, '0'));
  }
  const hex = parts.join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Tandem's own code systems, so validators can check every code we emit. */
export function tandemCodeSystems(): Json[] {
  const base = (id: string, title: string, concept: { code: string; display: string }[]) => ({
    resourceType: 'CodeSystem',
    id,
    url: `${TANDEM}/CodeSystem/${id}`,
    version: '0.1.0',
    name: title.replace(/[^A-Za-z]/g, ''),
    title,
    status: 'draft',
    experimental: true,
    publisher: 'Tandem (OneAquaHealth IEEE Global Hackathon 2026)',
    description: `${title}. Codes for the OneAquaHealth citizen stream check, which the OneAquaHealth IG does not model yet.`,
    caseSensitive: true,
    content: 'complete',
    count: concept.length,
    concept,
    text: { status: 'generated', div: `<div xmlns="http://www.w3.org/1999/xhtml">${esc(title)}</div>` },
  });
  const questions = [...QUESTIONS.map((q) => ({ code: q.id, display: q.title })), { code: 'overall_health', display: 'Overall assessment of the stream ecosystem health' }, { code: 'additional_observation', display: 'Additional observation' }];
  const answers: { code: string; display: string }[] = [];
  for (const q of QUESTIONS) {
    for (const o of q.options) answers.push({ code: `${q.id}.${o.id}`, display: o.label });
    if (q.kind === 'multi') answers.push({ code: `${q.id}.none`, display: 'None' });
  }
  for (const r of HEALTH_RATINGS) answers.push({ code: `overall_health.${r.id}`, display: r.label });
  const anomalies = Object.entries(ANOMALY_LABELS).map(([code, display]) => ({ code, display }));
  return [
    base('citizen-question', 'Citizen stream check questions', questions),
    base('citizen-answer', 'Citizen stream check answers', answers),
    base('anomaly', 'Additional observations noticed by the AI and confirmed by the citizen', anomalies),
  ];
}
