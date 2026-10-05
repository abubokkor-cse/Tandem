// The prompt and response schema sent to the vision model.
// Design notes are in docs/PROMPTS.md.

import { ANOMALY_KINDS } from '../src/core/ai.js';
import { AI_QUESTIONS, NOT_SURE, type QuestionId } from '../src/core/protocol.js';

export const PROMPT_VERSION = 'tandem-prompt-v1';

/** Per-question rules that tell the model when it may answer and when it must say it cannot tell. */
const GUIDANCE: Partial<Record<QuestionId, string>> = {
  channel_form: 'Judge the cross-section of the channel. If the banks or bed are hidden by vegetation or the angle, say not_visible.',
  bottom_type: 'Only answer if the bed is visible through the water or the channel is dry. Murky or deep water: not_visible.',
  bank_type: 'Answer for the banks that dominate the photos. Concrete walls or mortared stones = artificial; stones placed without mortar = laid_stones.',
  habitats: 'List every habitat you can actually see. An empty list means you looked and none is there; if the channel is not visible enough to judge, set not_visible.',
  natural_debris: 'List what you can see. Empty list = visible channel with none present.',
  water_flow: 'Use visible cues only: waves, white water, ripples (fast); smooth moving surface (slow); still pools, standing water, algae mats (stagnant); no water (dry). A still photo often cannot separate slow from stagnant: then not_visible.',
  water_aspect: 'clear = you can see into the water or the bed; turbid = brown, grey or cloudy; foam = visible foam or froth; colored = unusual colour, dye or oily sheen. Reflections and shade are not colour changes.',
  water_withdrawal: 'yes only if you see a pump, hose, intake or channel taking water out. no only if the stretch is clearly visible and nothing like that is there.',
  barriers: 'A transversal barrier crosses the stream from bank to bank (weir, small dam, sill). Bridges and culverts over the water are not barriers unless they block the channel.',
  draining_pipes: 'yes only if a pipe outlet is visible AND what comes out looks polluted (grey, discoloured, foamy, oily, smelly-looking residue). A pipe you cannot judge: not_visible. no only if the banks are clearly visible and no such pipe is there.',
  sewage_discharge: 'yes only for a visible discharge that looks like sewage (grey water, solids, sewage fungus, toilet waste). You cannot see smell: when in doubt, not_visible.',
  construction: 'yes for machinery, works, fresh concrete, sandbags or works fencing in or at the stream.',
  impervious_left: 'Left margin = the bank on your left when facing DOWNSTREAM. Roads, pavements, car parks, buildings count as impervious. Answer yes if they cover more than a third of that margin within 5-10 m of the bank top.',
  impervious_right: 'Right margin = the bank on your right when facing DOWNSTREAM. Same rule as the left margin.',
  vegetation_left: 'Is the left margin (facing downstream) covered by plants?',
  vegetation_right: 'Is the right margin (facing downstream) covered by plants?',
  vegetation_type_left: 'Which plant form covers more than half of the left margin: herbs, shrubs or trees.',
  vegetation_type_right: 'Which plant form covers more than half of the right margin: herbs, shrubs or trees.',
  vegetation_cut: 'yes for fresh stumps, mown strips, cut stems or cleared banks that look recent. Old or unclear: not_visible.',
};

export function buildPrompt(photoRoles: string[]): string {
  const questions = AI_QUESTIONS.map((q) => {
    const opts = q.options
      .filter((o) => o.id !== NOT_SURE)
      .map((o) => `${o.id} = ${o.label}${o.plain ? ` (${o.plain})` : ''}`)
      .join('; ');
    const kind = q.kind === 'multi' ? 'choose ALL that apply (may be empty)' : 'choose exactly ONE';
    return `- ${q.id}: "${q.text}" [${kind}] options: ${opts}. ${GUIDANCE[q.id] ?? ''}`;
  }).join('\n');

  return `You are helping a citizen scientist check an urban stream for the OneAquaHealth project.
The citizen has already answered the questions below on site. You do NOT see their answers.
Your job is to give an independent reading of the photos, so that agreement between you and the citizen means something.

Photos provided (in order): ${photoRoles.join(', ')}.
Orientation: the "downstream" photo faces the way the water flows, so its left side shows the LEFT margin.
The "upstream" photo faces the other way, so in it the LEFT margin appears on the RIGHT side of the image.

Rules:
1. Answer only from what is visible. Never guess from what streams "usually" look like.
2. If you cannot tell, set not_visible = true and value = []. Saying not_visible is always better than a guess. The citizen was there and saw more than the photos show.
3. Answer "no" (or an empty list) only when the relevant area is clearly visible and the feature is absent.
4. evidence: one short sentence naming the photo and where in it you see the deciding detail (e.g. "downstream photo, right bank: vertical concrete wall"). Plain language, no jargon.
5. photo: the photo that shows the deciding detail, or "none".
6. Do not rate the overall ecosystem health. Do not identify species. Do not give safety or medical advice.
7. scene: is_stream = false if the photos do not show a stream or river channel at all. quality = the main problem with the photos, or "ok".
8. anomalies: list only things you can clearly see that the questions do not cover: litter (waste, plastic, trolleys), oil_sheen (rainbow film on water), algal_bloom (green scum or mats), dead_animals, wildlife (any animal: say which broad group, e.g. "a duck on the left bank", never a species name), other (anything else unusual). An empty list is a normal answer.

Questions:
${questions}

Return JSON only, matching the schema, with one entry in "answers" for every question id listed above.`;
}

/** Gemini responseSchema (OpenAPI subset). */
export function responseSchema() {
  const ids = AI_QUESTIONS.map((q) => q.id);
  const values = [...new Set(AI_QUESTIONS.flatMap((q) => q.options.map((o) => o.id)).filter((v) => v !== NOT_SURE))];
  return {
    type: 'OBJECT',
    properties: {
      scene: {
        type: 'OBJECT',
        properties: {
          is_stream: { type: 'BOOLEAN' },
          quality: { type: 'STRING', enum: ['ok', 'too_dark', 'blurry', 'obstructed', 'no_water_visible'] },
          note: { type: 'STRING' },
        },
        required: ['is_stream', 'quality', 'note'],
      },
      answers: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            question: { type: 'STRING', enum: ids },
            not_visible: { type: 'BOOLEAN' },
            value: { type: 'ARRAY', items: { type: 'STRING', enum: values } },
            photo: { type: 'STRING', enum: ['upstream', 'downstream', 'context', 'biodiversity', 'none'] },
            evidence: { type: 'STRING' },
          },
          required: ['question', 'not_visible', 'value', 'photo', 'evidence'],
          propertyOrdering: ['question', 'evidence', 'photo', 'not_visible', 'value'],
        },
      },
      anomalies: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            kind: { type: 'STRING', enum: [...ANOMALY_KINDS] },
            photo: { type: 'STRING', enum: ['upstream', 'downstream', 'context', 'biodiversity', 'none'] },
            evidence: { type: 'STRING' },
          },
          required: ['kind', 'photo', 'evidence'],
          propertyOrdering: ['evidence', 'photo', 'kind'],
        },
      },
    },
    required: ['scene', 'answers', 'anomalies'],
    propertyOrdering: ['scene', 'answers', 'anomalies'],
  };
}
