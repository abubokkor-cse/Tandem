# Evaluation report

Generated 2026-10-04 20:01 UTC · model `gemini-3.8-flash` · prompt `tandem-prompt-v1` · 3 independent looks per photo.

**Photos:** 27 openly licensed stream photos from Wikimedia Commons (authors and licences in `eval/manifest.json`). The AI saw each one as a downstream photo, with the same prompt the app uses. Every labeller answered only from the photo, treated as facing downstream, and **never saw the AI's answers**. Multi-select questions are scored per option (present or absent).


## Against an independent AI reference (25 photos)

Labelled by a different AI model (Claude), blind to Gemini's answers. Two AI systems can share mistakes, so treat this as agreement with an independent reference, likely an overestimate of real-world accuracy.

| | Result |
|---|---|
| Agreement when **all 3 looks agree** (the only time the app interrupts a citizen) | **96%** (95% CI 93%–97%), on 93% of labelled answers |
| Agreement on every answer the AI gave | 94% (95% CI 91%–96%), Cohen's κ 0.927, answering 98% |
| Labeller said "cannot tell from this photo" and the AI also held back | 41% (45 of 109) |
| Simulated citizen errors (20% of answers made wrong) caught by a second look | 90% |
| Correct citizen answers questioned anyway (false alarms) | 4% |

| Looks agreeing | Answers | Agreement |
|---|---|---|
| 2 of 3 | 18 | 67% |
| 3 of 3 | 343 | 96% |

<details><summary>By question</summary>

| Question | Labelled items | AI answered | Agreement (95% CI) | κ |
|---|---|---|---|---|
| channel_form | 6 | 83% | 100% (57%–100%) | 1 |
| bottom_type | 9 | 89% | 100% (68%–100%) | 1 |
| bank_type | 23 | 96% | 100% (85%–100%) | 1 |
| habitats | 105 | 100% | 93% (87%–97%) | 0.761 |
| natural_debris | 48 | 100% | 92% (80%–97%) | 0.701 |
| water_flow | 14 | 79% | 91% (62%–98%) | 0.81 |
| water_aspect | 7 | 100% | 71% (36%–92%) | 0 |
| barriers | 24 | 96% | 87% (68%–96%) | 0.709 |
| construction | 24 | 96% | 100% (86%–100%) | 1 |
| impervious_left | 20 | 100% | 100% (84%–100%) | 1 |
| impervious_right | 20 | 100% | 100% (84%–100%) | 1 |
| vegetation_left | 18 | 100% | 100% (82%–100%) | 1 |
| vegetation_type_left | 14 | 100% | 86% (60%–96%) | 0.717 |
| vegetation_right | 20 | 100% | 100% (84%–100%) | 1 |
| vegetation_type_right | 17 | 100% | 88% (66%–97%) | 0.775 |

</details>


## Weak spots

- **water_aspect**: 71% agreement on 7 items.
- When the labeller said "cannot tell from this photo", the AI held back only 41% of the time: it is more willing to answer than it should be. The 3-of-3 rule is what keeps this from reaching citizens.

## Limits

- Small sets, so the intervals are wide; no expert panel yet.
- Photos come from open collections, not yet from the OneAquaHealth app; single photos, not the app's upstream + downstream pairs.
- The simulation flips answers at random; real citizen errors are not random.
