// A finished stream check, with its full audit trail, and the summary researchers see.

import type { AiAnomaly, AiReport } from './ai';
import type { Answers, HealthRating, PhotoRole } from './protocol';
import type { Comparison } from './reconcile';
import { isQuarantined, type EffortTrace, type IntegritySignal } from './integrity';
import type { PreviousCheck, RuleHit } from './rules';

export interface PhotoMeta {
  role: PhotoRole;
  width: number;
  height: number;
  brightness: number; // 0..255 mean luminance
  sharpness: number; // variance of the Laplacian on a 256 px copy
  issues: string[];
  thumb?: string; // small data URL kept on the device
  hash?: string; // 64-bit difference hash, to spot a reused photo
}

export type AiStatus = 'used' | 'declined' | 'unavailable' | 'failed';

export interface StreamCheck {
  id: string;
  createdAt: string;
  site: { code?: string; name: string; city?: string; lat?: number; lon?: number };
  photos: PhotoMeta[];
  /** Final answers, after any second look. */
  answers: Answers;
  overall?: HealthRating;
  note?: string;
  aiStatus: AiStatus;
  ai: AiReport | null;
  comparisons: Comparison[];
  rules: (RuleHit & { resolution?: 'kept' | 'changed' })[];
  /** What the AI noticed beyond the form, and whether the citizen confirmed it. */
  anomalies: (AiAnomaly & { decision: 'confirmed' | 'rejected' | 'unanswered' })[];
  synthetic?: boolean;
  /** How the check was made (time on the questions, automation), and what that suggests. */
  trace?: EffortTrace;
  integrity?: IntegritySignal[];
}

export type TrustLabel = 'corroborated' | 'citizen_reported' | 'closer_look' | 'quarantined';

export interface TrustSummary {
  label: TrustLabel;
  corroborated: number;
  comparable: number; // answers the AI could also judge
  changedAfterSecondLook: number;
  keptAfterSecondLook: number;
  suggestionsAccepted: number;
  openChecks: number;
  sceneProblem: boolean;
  priority: number; // higher = review first
  reasons: string[];
}

export function summarize(r: StreamCheck): TrustSummary {
  const c = r.comparisons;
  const comparable = c.filter((x) => ['corroborated', 'second_look', 'ai_unsure', 'suggestion'].includes(x.status)).length;
  const corroborated = c.filter((x) => x.status === 'corroborated').length;
  const changed = c.filter((x) => x.status === 'second_look' && x.resolution === 'changed').length;
  const kept = c.filter((x) => x.status === 'second_look' && x.resolution === 'kept').length;
  const accepted = c.filter((x) => x.status === 'suggestion' && x.resolution === 'accepted').length;
  const openChecks = r.rules.filter((h) => h.severity === 'check' && h.resolution !== 'changed').length;
  const sceneProblem = !!r.ai && (!r.ai.scene.is_stream || r.ai.scene.quality !== 'ok');

  const reasons: string[] = (r.integrity ?? []).map((s) => s.title.toLowerCase());
  if (kept) reasons.push(`${kept} answer${kept > 1 ? 's' : ''} kept after the AI saw something different`);
  if (openChecks) reasons.push(`${openChecks} consistency check${openChecks > 1 ? 's' : ''} left as answered`);
  if (sceneProblem) reasons.push(r.ai!.scene.is_stream ? `photo issue: ${r.ai!.scene.quality.replace(/_/g, ' ')}` : 'the AI did not see a stream in the photos');

  // A kept disagreement is not an error: the citizen was there. It is where an expert learns most.
  const flags = (r.integrity ?? []).filter((s) => s.level === 'review').length;
  const priority = kept * 2 + openChecks * 2 + (sceneProblem ? 3 : 0) + flags * 3;
  const label: TrustLabel = isQuarantined(r.integrity)
    ? 'quarantined'
    : priority > 0
      ? 'closer_look'
      : comparable > 0 && corroborated / comparable >= 0.5
        ? 'corroborated'
        : 'citizen_reported';

  return {
    label,
    corroborated,
    comparable,
    changedAfterSecondLook: changed,
    keptAfterSecondLook: kept,
    suggestionsAccepted: accepted,
    openChecks,
    sceneProblem,
    priority,
    reasons,
  };
}

export const TRUST_TEXT: Record<TrustLabel, { title: string; body: string }> = {
  corroborated: {
    title: 'Corroborated',
    body: 'Most answers the photos can show were confirmed by an independent AI look.',
  },
  citizen_reported: {
    title: 'Citizen-reported',
    body: 'The citizen’s observations, with little to compare against. Not a sign of a problem.',
  },
  quarantined: {
    title: 'Not counted',
    body: 'Made by automation software, not a person. Kept for transparency, left out of the statistics and of what the AI learns from.',
  },
  closer_look: {
    title: 'Worth a closer look',
    body: 'The citizen and the AI saw something differently, or a check was left open. The citizen may well be right: they were there.',
  },
};

/** The most recent check at the same site before `before`, for the site memory check. */
export function previousCheck(records: StreamCheck[], siteCode: string | undefined, before = new Date().toISOString()): PreviousCheck | undefined {
  if (!siteCode) return undefined;
  const r = records
    .filter((x) => x.site.code === siteCode && x.createdAt < before)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return r && { date: r.createdAt, answers: r.answers, synthetic: r.synthetic };
}
