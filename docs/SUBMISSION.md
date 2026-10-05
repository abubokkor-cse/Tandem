# Devpost submission text

Copy each section into the matching Devpost field.

---

## Project name
Tandem

## Tagline (Elevator pitch)
Two independent looks at every stream: citizens answer first, the AI checks the photos blind, and the citizen decides.

## Track
**Track 3: AI-Supported Assessment.** Use AI responsibly to support stream assessment without replacing human judgment.

---

## Inspiration
Citizen stream checks are how OneAquaHealth can watch 106 urban stream sites between lab campaigns, but citizen answers vary: muddy versus tea-coloured water, slow versus stagnant flow, left versus right bank, "Good" because it looks green. The easy fix, letting an AI fill in the form, causes a worse problem. When people see an automated answer first, they tend to accept it even when it is wrong (automation bias). The citizen stops observing, and the data quietly becomes the AI's. We wanted AI that makes citizen data more reliable **and** keeps the citizen's own observation at the centre.

## What it does
Tandem follows the official OneAquaHealth Citizen Science App stream check question for question, in the app's own official wording in 6 languages (English, Português, Italiano, Français, Nederlands, Norsk), at the 106 real OneAquaHealth research sites.

1. **You observe.** Upstream and downstream photos, then the official questions, with plain-language help under every scientific term.
2. **The AI looks, blind.** A vision model answers the questions a photo can show, from the photos only, three independent times. It never sees the citizen's answers and says "cannot tell" when the photos don't show enough. Questions only a person on site can answer (water depth, invasive species) are never sent to it.
3. **Compare.** Where both agree, the answer is corroborated. Where the AI's looks disagree with each other, it stays quiet. Only when all three looks agree on something different does the citizen get a **second look**: their answer, the AI's answer, its evidence ("downstream photo, both banks: sloping concrete walls"), the photo, what the term means, and **the AI's measured track record on that question**.
   **The AI earns trust one question at a time.** Unanimous looks can still be unanimously wrong. On questions where the AI scored below 80% in our evaluation (water colour, at 71%), it records what it saw for researchers but never interrupts the citizen. The list is read from the evaluation results, so new labelled photos move questions in or out without code changes.
4. **You decide.** Keep (with an optional reason) or change, one tap either way. Rule checks come next (e.g. "rated Good but reported sewage", taken from the official rating definitions), including **site memory**: if the channel, bed or banks differ from the last check at the same site, Tandem asks, because those rarely change between visits. Then anything unusual the AI noticed that the form doesn't ask about (litter, oil, algae, wildlife). Only what the citizen confirms goes in.
5. **Results.** The citizen's overall health rating; Water, Pollution, Biodiversity and Habitat in plain words; a "You and the AI" panel showing who said what and who decided; One Health notes for people, animals and the ecosystem; and the full audit trail.

**Bots and click-throughs can't poison the data.** A check made by automation software is quarantined: kept for transparency, but not counted and never learned from. Answers faster than anyone can read the questions, the same photo twice, or a photo reused from an earlier check are shown to the citizen and flagged for a researcher, never silently deleted.

Researchers get a records view sorted so disagreements come first (where an expert learns most), and a **"what the second looks teach"** panel: per question, if citizens usually change their answer, the guidance needs work; if they usually keep it, the AI needs checking. The human corrects the AI as much as the AI helps the human. Researchers also get JSON, CSV and **FHIR R4** export shaped by the official OneAquaHealth Implementation Guide (`LocationOah`, `ObservationIndicatorsOah`, with a Provenance resource recording the citizen as author and the AI as informant). **The official HL7 validator reports 0 errors and 0 warnings** against the OneAquaHealth guide built from its source, with online terminology checks.

**Measured, not assumed.** On 25 openly licensed stream photos, labelled blind by an independent reference, the AI agreed **96%** of the time when all 3 looks agreed, and only **67%** at 2 of 3: the evidence behind the rule that it speaks only when unanimous. In a simulation it caught **90%** of citizen errors with **4%** false alarms. We publish the weak spots too: water colour (71%), and a tendency to answer when it should say "cannot tell". (Full report in the repo; the full-set reference labels are from a different AI model, so the figures likely overstate real-world accuracy.)

**How it maps to Track 3:**
- **AI prompts:** an abstain-first prompt with a "when to say cannot tell" rule per question, upstream/downstream orientation handling, and a strict JSON schema with evidence written before the answer. The exact prompt is shown in the app.
- **Validation checks:** 13 rule checks without AI, including site memory against the last check at the same site; integrity checks that quarantine automated (bot) input and flag answers faster than the questions can be read, the same photo twice, or a photo reused from an earlier check; blur and darkness checks on the phone, and a "this is not a stream" photo check.
- **Explainable AI:** evidence naming the photo and the spot, confidence shown as "3 of 3 looks agree", the AI's measured track record on every question it asks about, and a model card.
- **Human-in-the-loop:** the citizen answers first, the AI speaks only when unanimous **and** on questions where it has earned trust, the citizen makes every final decision, the AI never rates overall health, and citizens' decisions flow back as actions for researchers.

## How we built it
- **Front end:** React and TypeScript (Vite), mobile-first, light and dark themes, keyboard and screen-reader friendly. Photos are resized on the phone, which also strips GPS and other EXIF data.
- **AI:** Google Gemini (`gemini-3.8-flash`, free tier) through a serverless function, so the key never reaches the browser. Three parallel calls on the same photos give three independent looks, which are majority-voted per question. Agreement becomes the confidence.
- **Core logic** in plain TypeScript: reconciliation, the earned-trust gate, rule checks and site memory, the learning-from-decisions summary, the health view from official definitions, One Health notes, FHIR mapping and evaluation metrics (accuracy, Cohen's κ, calibration, selective accuracy). Covered by unit tests and an end-to-end browser test that runs the real AI.
- **Data:** the questions and answer letters come from the official OneAquaHealth web app, the 106 sites from the OneAquaHealth public API, and the FHIR codes from the hl7-eu/oah Implementation Guide.

## Challenges we ran into
- **Making AI confidence honest.** A model saying "90% sure" means little, so we measure agreement between independent looks instead, and we only interrupt a volunteer when all of them agree.
- **Left and right banks.** They are defined facing downstream, so the left bank appears on the right of an upstream photo. The prompt handles this explicitly.
- **Keeping the citizen's view independent.** The AI starts working as soon as the photos are in, but its answers stay sealed until the citizen has finished.
- **The newest Gemini model** doesn't return several answers from one request, so we send the three looks as parallel requests.

## Accomplishments that we're proud of
- A human-first, AI-second workflow that follows the official OneAquaHealth form exactly.
- In our end-to-end test with a real concrete canal photo, the AI caught a deliberately wrong "natural bed" answer with 3 of 3 looks agreeing, correctly said "cannot tell" about margins that were out of frame, and noticed litter the form doesn't ask about.
- FHIR R4 output that passes the official HL7 validator against the project's own Implementation Guide with 0 errors and 0 warnings.
- It runs at $0 per month and works fully without the AI.

## What we learned
The most responsible thing an assessment AI can do is often to stay quiet, and agreement alone is not enough: an AI should earn the right to interrupt, question by question, from measured evidence. Good human-AI collaboration is about **when** the AI speaks, **how** it explains itself, and making it as easy to disagree with the AI as to agree.

## Path to production
Tandem is built to drop into the OneAquaHealth app: the core logic is plain, unit-tested TypeScript and records already export as FHIR R4 that validates against the project's own Implementation Guide. For a real deployment: a paid or EU-hosted model endpoint where photos are not used for training (GDPR), records posted to the OneAquaHealth FHIR server with volunteer accounts, a shared rate limit and server-side bot signals, an expert-labelled benchmark from the app's own photos, and an offline queue for streams without signal.

## What's next for Tandem
- Grow the benchmark with expert labels from OneAquaHealth volunteers and researchers, and photos from the app itself.
- Tune the second-look threshold and the earned-trust list from those numbers.
- Site memory across devices, from the OneAquaHealth server's history for each site.
- Plug the core logic into the OneAquaHealth Citizen Science App and its FHIR server.
- Offline queueing for streams without signal, and Tandem's own interface text in the six languages its questions already use.

## Built with
typescript · react · vite · google-gemini · vercel · fhir · hl7 · node.js · vitest · puppeteer

## Links
- Live demo: https://tandem-oneaquahealth.vercel.app
- Code: https://github.com/abubokkor-cse/Tandem
- Video: _YouTube URL_
