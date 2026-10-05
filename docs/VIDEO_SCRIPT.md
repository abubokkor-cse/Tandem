# Demo video script (about 4 min 20 s)

**Setup:** record your screen (macOS: Cmd+Shift+5 → Record Selected Portion) with the app at http://localhost:5173 or the live URL, in light mode, browser window about 1440 wide. Close other tabs. Speak slowly and clearly; you can read the lines below. Upload to YouTube as **Unlisted** and paste the link into Devpost.

Before recording, do one full check once so the AI result is warm, then start a fresh one on camera.

---

## 0:00–0:25 · The problem (home page)
**Show:** the home page, scroll slowly to "What the track asks for".

**Say:**
"Citizen stream checks let OneAquaHealth watch urban streams between lab visits. But citizen answers are inconsistent. And if you let an AI fill in the form, people tend to copy it, even when it's wrong. That's called automation bias. Tandem is our answer for Track 3: AI that supports the assessment without replacing human judgment."

## 0:25–0:45 · The idea (home hero console)
**Show:** the console on the home page.

**Say:**
"The idea is simple. You answer first. The AI looks at your photos three times, blind, without seeing your answers. If all three looks agree on something different, you get a second look, with its evidence. And you decide."

## 0:45–1:45 · Live check
**Show:** New check → pick site **C1 Exploratório, Coimbra** → Photos → "Try with sample photos" (or upload) → point at the side panel.

**Say:**
"These are the 106 real OneAquaHealth research sites. I add my photos. They're resized on the phone and their location data is removed. The AI starts now, but look at the panel: its answers stay sealed until I'm done."

**Show:** the questions. Answer **Bottom type: Natural** and **Bank type: Natural** on purpose, **Water aspect: Muddy/turbid**, Barriers: "I'm not sure", then the rest quickly. Point at the "AI also looks" and "Only you can tell" chips.

**Say:**
"These are the official OneAquaHealth questions, word for word, with plain-language help. Each one shows whether the AI will also check it. Water depth and invasive species are only for people on site."

**Show:** the overall rating, choose **Good**, then "Compare with the AI". (Answer at a normal pace: under 1.5 s per answer, Tandem flags the check as "Answered very quickly".)

## 1:45–2:40 · Second look (the core)
**Show:** the "You and the AI" summary, then the Bottom type second-look card.

**Say:**
"Several answers were confirmed. For some, the AI saw something different, and all three of its looks agreed. Here: I said natural, and the AI saw concrete. It tells me exactly what it based that on, in which photo, and what 'artificial' means. Keeping my answer is one tap, same as changing it."

**Show:** point at the line "Track record on this question: … 100% of 9 test items". Then scroll up to the note "The AI also saw something different for water aspect, but held back".

**Say:**
"Below the evidence is the AI's measured track record on this exact question. And look here: on water colour the AI also disagreed with me, unanimously. But it held back. In our evaluation it was right only 71% of the time on water colour, so it hasn't earned the right to interrupt there. Agreement alone isn't enough. The AI earns trust one question at a time, from measured evidence."

**Show:** change Bottom type, keep Bank type with the reason "I saw it in person". Accept the Barriers suggestion. Show the rule checks: "Rated Good, in an artificial channel", then **"Different from the last check here"**. Confirm "Litter" in "The AI also noticed".

**Say:**
"Rule checks need no AI. Here my 'Good' rating conflicts with the official definition. And this one is site memory: the last check at this site recorded a natural bed. Stream beds don't change between visits, so either something happened here, or one of us is wrong. Either way, a researcher wants to know. Finally, the AI noticed litter that the form doesn't even ask about. It only goes in the record because I confirmed it."

## 2:40–3:15 · Results
**Show:** the results: overall health, the You-and-the-AI panel, At a glance, the four signs, One Health notes, scroll to the answers, open "View the FHIR R4 Bundle".

**Say:**
"The rating is mine. The AI never suggests it. Below it: water, pollution, biodiversity and habitat in plain words, and exactly who said what and who decided. The One Health notes link the stream to people and animals. Everything exports as FHIR R4 following the OneAquaHealth Implementation Guide."

## 3:15–4:00 · Researchers: the loop runs both ways
**Show:** Records (disagreements first). Point at the bottom record, **"Not counted"** (the demo bot run). Then scroll to **"What the second looks teach"**. Point at Barriers ("Check the AI") and Vegetation type ("Improve the guidance"). Then How the AI works → "It must also earn trust" → "Show the prompt".

**Say:**
"Researchers see the checks where people and the AI disagreed first, with the full audit trail. This one at the bottom was made by automation software, not a person: it's kept for transparency but not counted, so bots can't poison the data. Answers clicked faster than anyone can read, or a photo reused from an earlier check, are flagged too. And here the loop closes. Every second look ends in a human decision. Where citizens usually change their answer, like vegetation type, the question is hard and the guidance should improve. Where they usually keep it, like barriers, the AI is probably misreading photos. And our benchmark agrees: barriers is one of the AI's weaker questions. The citizen corrects the AI as much as the AI helps the citizen. The model card shows the exact prompt, every rule, and which questions are muted right now. Nothing is hidden."

## 4:00–4:20 · Close
**Show:** the home page.

**Say:**
"Tandem runs on Gemini's free tier for zero cost, works without the AI too, and could plug straight into the OneAquaHealth app. You observe, the AI takes an independent look, you decide. Thank you."
