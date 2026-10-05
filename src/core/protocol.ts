// The OneAquaHealth Citizen Science App stream check, question for question.
// Wording and answer letters come from the official web app (apps.oneaquahealth.eu,
// English locale, retrieved 2026-09-27). The app's answer lookup tables sit behind a
// login (/api/citizens/*), so the answer ids below are ours; the letters (A), (B)...
// match what citizens see in the official app.

export type QuestionKind = 'single' | 'multi' | 'yesno' | 'number';

/** How far a photo can answer a question. Drives what the AI is allowed to answer. */
export type Visibility =
  | 'photo' // usually answerable from a stream photo
  | 'partial' // sometimes visible, often not; the AI must say when it cannot tell
  | 'field'; // needs being there (smell, species, depth); the AI never answers

export interface Option {
  id: string;
  label: string; // official wording, with the app's letter
  plain?: string; // plain-language help shown under the option
}

export interface Question {
  id: QuestionId;
  page: 1 | 2 | 3;
  kind: QuestionKind;
  title: string; // official short title
  text: string; // official question text
  help?: string; // our plain-language explanation of the scientific term
  options: Option[];
  visibility: Visibility;
  side?: 'left' | 'right';
  /** Only asked when another answer allows it. */
  dependsOn?: { question: QuestionId; equals: string };
}

export type QuestionId =
  | 'channel_form'
  | 'bottom_type'
  | 'bank_type'
  | 'habitats'
  | 'natural_debris'
  | 'water_flow'
  | 'water_aspect'
  | 'water_withdrawal'
  | 'barriers'
  | 'draining_pipes'
  | 'sewage_discharge'
  | 'construction'
  | 'water_height'
  | 'impervious_left'
  | 'impervious_right'
  | 'vegetation_left'
  | 'vegetation_type_left'
  | 'vegetation_right'
  | 'vegetation_type_right'
  | 'invasive_species'
  | 'vegetation_cut';

export const NOT_SURE = 'not_sure';

const yesNo: Option[] = [
  { id: 'yes', label: 'Yes' },
  { id: 'no', label: 'No' },
  { id: NOT_SURE, label: 'I’m not sure' },
];

const vegetationTypes: Option[] = [
  { id: 'herbs', label: 'Herbs (A)', plain: 'Grasses and low, soft-stemmed plants' },
  { id: 'shrubs', label: 'Shrubs (B)', plain: 'Woody bushes, usually below head height' },
  { id: 'trees', label: 'Trees (C)', plain: 'Woody plants with a trunk, taller than a person' },
  { id: NOT_SURE, label: 'I’m not sure' },
];

export const QUESTIONS: Question[] = [
  // Page 1: "What do you see from where you stand (in ca. 100m)?"
  {
    id: 'channel_form',
    page: 1,
    kind: 'single',
    title: 'Channel Form',
    text: 'The channel form is…',
    help: 'Look at the cross-section of the stream bed, as if you cut it across.',
    options: [
      { id: 'flat', label: 'Flat (A)', plain: 'Wide and shallow, with a flat bottom' },
      { id: 'u_shape', label: 'U Shape (B)', plain: 'Rounded sides and bottom' },
      { id: 'v_shape', label: 'V Shape (C)', plain: 'Steep sides meeting in a narrow bottom' },
      { id: NOT_SURE, label: 'I’m not sure' },
    ],
    visibility: 'photo',
  },
  {
    id: 'bottom_type',
    page: 1,
    kind: 'single',
    title: 'Bottom Type',
    text: 'The bottom of the wet channel is…',
    options: [
      { id: 'natural', label: 'Natural (A)', plain: 'Sand, gravel, stones or mud' },
      {
        id: 'artificial',
        label: 'Artificial (concrete or stones with concrete) (B)',
        plain: 'A hard, human-made floor',
      },
      { id: NOT_SURE, label: 'I’m not sure' },
    ],
    visibility: 'partial',
  },
  {
    id: 'bank_type',
    page: 1,
    kind: 'single',
    title: 'Bank Type',
    text: 'The banks of the channel are…',
    options: [
      { id: 'natural', label: 'Natural (A)', plain: 'Earth, roots, plants, natural rock' },
      {
        id: 'artificial',
        label: 'Artificial (concrete or stones with concrete) (B)',
        plain: 'Walls or stones held together by concrete',
      },
      {
        id: 'laid_stones',
        label: 'Layed stones with no concrete (C)',
        plain: 'Stones placed by people, with gaps between them',
      },
      { id: NOT_SURE, label: 'I’m not sure' },
    ],
    visibility: 'photo',
  },
  {
    id: 'habitats',
    page: 1,
    kind: 'multi',
    title: 'Habitats',
    text: 'The habitats present are…',
    help: 'Tick every one you see. Leave all unticked if there are none.',
    options: [
      { id: 'sand_banks', label: 'Sand banks (A)', plain: 'Sand or gravel along the edge' },
      { id: 'sand_islands', label: 'Sand islands (B)', plain: 'Sand or gravel surrounded by water' },
      { id: 'stone_deposits', label: 'Stone deposits (C)', plain: 'Piles of stones in or by the water' },
      {
        id: 'riffles',
        label: 'Riffles, rapids, falls (D)',
        plain: 'Shallow, fast water breaking over stones, or small drops',
      },
      { id: 'aquatic_vegetation', label: 'Aquatic vegetation (E)', plain: 'Plants growing in the water' },
    ],
    visibility: 'photo',
  },
  {
    id: 'natural_debris',
    page: 1,
    kind: 'multi',
    title: 'Natural Debris',
    text: 'There are…',
    help: 'Tick every one you see. Leave all unticked if there are none.',
    options: [
      { id: 'fallen_trees', label: 'Fallen trees (A)' },
      { id: 'fallen_branches', label: 'Fallen branches (B)' },
      { id: 'leaf_deposits', label: 'Deposits of fallen leaves (C)' },
    ],
    visibility: 'photo',
  },
  {
    id: 'water_flow',
    page: 1,
    kind: 'single',
    title: 'Water Flow',
    text: 'How is the water flowing',
    options: [
      { id: 'fast', label: 'Fast (with waves or high velocity) (A)' },
      { id: 'slow', label: 'Slow (B)' },
      { id: 'stagnant', label: 'Stagnant/intermittent (C)', plain: 'Not moving, or only pools' },
      { id: 'dry', label: 'Dry (D)' },
      { id: NOT_SURE, label: 'I’m not sure' },
    ],
    visibility: 'partial',
  },
  // Page 2
  {
    id: 'water_aspect',
    page: 2,
    kind: 'single',
    title: 'Water Aspect',
    text: 'How is the water?',
    options: [
      { id: 'clear', label: 'Clear/transparent (A)', plain: 'You can see into the water' },
      { id: 'turbid', label: 'Muddy/turbid (B)', plain: 'Cloudy or brown; you cannot see in' },
      { id: 'foam', label: 'Has foam (C)' },
      { id: 'colored', label: 'Has colors/altered color (D)', plain: 'Unusual colour, oily sheen, dye' },
      { id: NOT_SURE, label: 'I’m not sure' },
    ],
    visibility: 'photo',
  },
  {
    id: 'water_withdrawal',
    page: 2,
    kind: 'yesno',
    title: 'Water Withdrawal',
    text: 'Is there any kind of obvious water collection, use, removal from the stream?',
    help: 'For example pumps, hoses or channels taking water away.',
    options: yesNo,
    visibility: 'partial',
  },
  {
    id: 'barriers',
    page: 2,
    kind: 'yesno',
    title: 'Barriers',
    text: 'Do you see any dams or other transversal artificial barriers?',
    help: 'A “transversal” barrier crosses the stream from bank to bank, like a weir or a small dam.',
    options: yesNo,
    visibility: 'photo',
  },
  {
    id: 'draining_pipes',
    page: 2,
    kind: 'yesno',
    title: 'Draining Pipes',
    text: 'Are there pipes draining polluted water into the stream?',
    options: yesNo,
    visibility: 'partial',
  },
  {
    id: 'sewage_discharge',
    page: 2,
    kind: 'yesno',
    title: 'Sewage discharge',
    text: 'Is there any kind of water entry or discharge of sewage?',
    options: yesNo,
    visibility: 'partial',
  },
  {
    id: 'construction',
    page: 2,
    kind: 'yesno',
    title: 'Construction',
    text: 'Is there any construction/works in stream?',
    options: yesNo,
    visibility: 'photo',
  },
  {
    id: 'water_height',
    page: 2,
    kind: 'number',
    title: 'Water height',
    text: 'What is the water height?',
    help: 'Your estimate in metres, for example 0.3.',
    options: [],
    visibility: 'field',
  },
  // Page 3: "In the margins/riparian zone (5-10m from the channel banktop)"
  {
    id: 'impervious_left',
    page: 3,
    kind: 'yesno',
    side: 'left',
    title: 'Impervious Areas (Left)',
    text: 'Is more than one third of the left margin covered by impervious areas (such as roads, sidewalks or buildings)?',
    help: 'Left means left when you face downstream (the way the water flows).',
    options: yesNo,
    visibility: 'photo',
  },
  {
    id: 'impervious_right',
    page: 3,
    kind: 'yesno',
    side: 'right',
    title: 'Impervious Areas (Right)',
    text: 'Is more than one third of the right margin covered by impervious areas (such as roads, sidewalks or buildings)?',
    help: 'Right means right when you face downstream (the way the water flows).',
    options: yesNo,
    visibility: 'photo',
  },
  {
    id: 'vegetation_left',
    page: 3,
    kind: 'yesno',
    side: 'left',
    title: 'Vegetation (Left)',
    text: 'Is the left margin covered by vegetation?',
    options: yesNo,
    visibility: 'photo',
  },
  {
    id: 'vegetation_type_left',
    page: 3,
    kind: 'single',
    side: 'left',
    title: 'Vegetation Type (Left)',
    text: 'Which vegetation is dominant (covers more than half) in the left margin (first 5 meters from the channel banktop)?',
    options: vegetationTypes,
    visibility: 'photo',
    dependsOn: { question: 'vegetation_left', equals: 'yes' },
  },
  {
    id: 'vegetation_right',
    page: 3,
    kind: 'yesno',
    side: 'right',
    title: 'Vegetation (Right)',
    text: 'Is the right margin covered by vegetation?',
    options: yesNo,
    visibility: 'photo',
  },
  {
    id: 'vegetation_type_right',
    page: 3,
    kind: 'single',
    side: 'right',
    title: 'Vegetation Type (Right)',
    text: 'Which vegetation is dominant (covers more than half) in the right margin (first 5 meters from the channel banktop)?',
    options: vegetationTypes,
    visibility: 'photo',
    dependsOn: { question: 'vegetation_right', equals: 'yes' },
  },
  {
    id: 'invasive_species',
    page: 3,
    kind: 'yesno',
    title: 'Invasive Species',
    text: 'Do you see any non-native or invasive plant species?',
    options: yesNo,
    visibility: 'field',
  },
  {
    id: 'vegetation_cut',
    page: 3,
    kind: 'yesno',
    title: 'Vegetation Cuts',
    text: 'Have there been recent cuts of vegetation (partial or total) on the banks of the stream?',
    options: yesNo,
    visibility: 'partial',
  },
];

export const PAGE_TITLES: Record<1 | 2 | 3, string> = {
  1: 'What do you see from where you stand (in ca. 100 m)?',
  2: 'The water and what enters or leaves it',
  3: 'In the margins/riparian zone (5–10 m from the channel banktop)',
};

export type HealthRating = 'good' | 'moderate' | 'poor';

export const HEALTH_RATINGS: { id: HealthRating; label: string; description: string }[] = [
  {
    id: 'good',
    label: 'Good quality',
    description:
      'The ecosystem components are there: riparian vegetation, natural channel, good water quality, biodiversity',
  },
  {
    id: 'moderate',
    label: 'Moderate quality',
    description: 'Some alterations, still biodiverse, with vegetation in the margins, water looks good...',
  },
  {
    id: 'poor',
    label: 'Poor quality',
    description:
      'Highly modified / artificialized, loss of riparian vegetation, loss of habitats, polluted',
  },
];

export const PHOTO_ROLES = [
  { id: 'upstream', label: 'Upstream photo', required: true, hint: 'Stand on the bank and face where the water comes from.' },
  { id: 'downstream', label: 'Downstream photo', required: true, hint: 'Face the way the water flows. Your left is the left margin.' },
  { id: 'context', label: 'Surrounding context', required: false, hint: 'Houses, roads, what is around the stream.' },
  { id: 'biodiversity', label: 'Interesting biodiversity', required: false, hint: 'A plant, animal or fungus you noticed.' },
] as const;

export type PhotoRole = (typeof PHOTO_ROLES)[number]['id'];

export function question(id: QuestionId): Question {
  const q = QUESTIONS.find((x) => x.id === id);
  if (!q) throw new Error(`Unknown question ${id}`);
  return q;
}

export function optionLabel(id: QuestionId, optionId: string): string {
  if (optionId === 'not_visible') return 'Cannot tell from the photos';
  const q = question(id);
  if (q.kind === 'number') return `${optionId} m`;
  return q.options.find((o) => o.id === optionId)?.label ?? optionId;
}

/** Questions the AI may answer from photos. 'field' questions are never sent. */
export const AI_QUESTIONS = QUESTIONS.filter((q) => q.visibility !== 'field');

/** A citizen answer: option id, list of option ids (multi), or metres (number). */
export type Answer = string | string[] | number;
export type Answers = Partial<Record<QuestionId, Answer>>;

export function isAsked(q: Question, answers: Answers): boolean {
  if (!q.dependsOn) return true;
  return answers[q.dependsOn.question] === q.dependsOn.equals;
}
