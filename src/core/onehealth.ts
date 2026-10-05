// What the verified findings mean for people, animals and the ecosystem: the One Health view.
// Plain, cautious wording: these are observations, not laboratory results.

import type { AiAnomaly } from './ai';
import type { Answers } from './protocol';

export interface OneHealthNote {
  for: 'people' | 'animals' | 'ecosystem';
  tone: 'caution' | 'positive' | 'neutral';
  text: string;
}

export function oneHealthNotes(a: Answers, confirmed: AiAnomaly[] = []): OneHealthNote[] {
  const notes: OneHealthNote[] = [];
  const has = (k: AiAnomaly['kind']) => confirmed.some((x) => x.kind === k);
  const inflow = a.sewage_discharge === 'yes' || a.draining_pipes === 'yes';
  const oddWater = a.water_aspect === 'foam' || a.water_aspect === 'colored' || has('oil_sheen') || has('algal_bloom');

  // People
  if (inflow || oddWater) {
    notes.push({
      for: 'people',
      tone: 'caution',
      text: 'Avoid skin contact with the water and wash your hands after the visit. Sewage, foam, oil or blooms can carry pathogens or chemicals.',
    });
  }
  if (has('algal_bloom')) {
    notes.push({ for: 'people', tone: 'caution', text: 'Some algal blooms release toxins. Report it to the city if it covers a large area.' });
  }
  if (!inflow && !oddWater && a.water_aspect === 'clear' && a.bank_type === 'natural' && a.vegetation_left === 'yes' && a.vegetation_right === 'yes') {
    notes.push({
      for: 'people',
      tone: 'positive',
      text: 'Natural, green urban streams are associated with cooler surroundings and better wellbeing for people living nearby.',
    });
  }

  // Animals
  if (inflow || oddWater || has('dead_animals')) {
    notes.push({ for: 'animals', tone: 'caution', text: 'Keep dogs from drinking or swimming here.' });
  }
  if (has('dead_animals')) {
    notes.push({ for: 'animals', tone: 'caution', text: 'Dead fish or animals can signal low oxygen or pollution. Do not touch them; report the location.' });
  }
  if (a.barriers === 'yes') {
    notes.push({ for: 'animals', tone: 'neutral', text: 'Barriers across the stream can stop fish and other animals moving up and down the stream.' });
  }
  if (has('wildlife')) {
    notes.push({ for: 'animals', tone: 'positive', text: 'Animals were seen: the stream is supporting wildlife.' });
  }

  // Ecosystem
  if (a.vegetation_left === 'no' || a.vegetation_right === 'no') {
    notes.push({
      for: 'ecosystem',
      tone: 'caution',
      text: 'Bare margins give no shade or shelter, warm the water and let banks erode. Riparian planting is one of the most effective restoration measures.',
    });
  }
  if (a.impervious_left === 'yes' || a.impervious_right === 'yes') {
    notes.push({ for: 'ecosystem', tone: 'neutral', text: 'Paved margins send rainwater, and what it carries from roads, straight into the stream.' });
  }
  if (a.bottom_type === 'artificial' || a.bank_type === 'artificial') {
    notes.push({ for: 'ecosystem', tone: 'neutral', text: 'Concrete beds and banks remove the places where insects, fish and plants live.' });
  }
  if (has('litter')) {
    notes.push({ for: 'ecosystem', tone: 'caution', text: 'Litter breaks down into microplastics and can trap or be eaten by animals.' });
  }
  const habitats = Array.isArray(a.habitats) ? a.habitats.length : 0;
  if (habitats >= 2) {
    notes.push({ for: 'ecosystem', tone: 'positive', text: `${habitats} habitat types: varied habitats support more kinds of life.` });
  }
  return notes;
}
