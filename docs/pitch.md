# Pitch and video plan (working draft)

## Rule check for the video

The video must contain **no third-party trademarks, copyrighted music or copyrighted material**
without permission.

- Don't say or show "Peacock", "Performance View", "NBA" or any broadcaster or league brand.
  Use the idea without the names: "US streamers started putting player rings and stat cards
  on basketball."
- Say "fantasy team", not "Fantasy Premier League". No league logos or match footage.
- Music: none, or royalty-free with a license we keep. Your own voiceover.
- Under 2:00 (aim for 1:50), public YouTube link; check it in a logged-out browser.

## Elevator pitch (~90 words)

**Live Cards: every number explains itself.**

Football fans get stats with no story, and AI commentary they can't trust. Live Cards puts a
ring under any player and gives them a live card that updates and explains every change, in
the fan's language, depth and club voice. Nothing airs until it's checked against the match data.

A team of agents on **Microsoft Foundry**, orchestrated with **Microsoft Agent Framework**:
a predictive auto-director, an Explainer, a code verifier plus a reasoning reviewer that block
unsupported claims, a tool-calling Q&A agent, and a Personalizer that fans each verified moment
out to five languages. Broadcasters get a control console, an audit log and machine-readable
overlay cues.

*Measured: 0 of 275 planted lies aired; the stats line airs instantly (0.3 ms to verify); the
AI line follows in about 3.3 s in the cloud.*

## Submission description (paste into the project page)

**What we built.** Live Cards is a live match-insights layer for football broadcasts and
streams. A ring follows any player; their card (a 0–10 rating and five attributes) updates as
events happen, and every change carries its reason and the events behind it. Fans can ask
questions, replay key moments, and choose casual or analyst depth in English, Spanish, French,
Portuguese or Arabic, with a neutral or home/away voice. Analysts can plug in their own rating
weights and compare. Broadcasters get a console with kill switches, a human-approval mode and an
audit log, and every on-screen element is also a timed JSON overlay cue for a graphics partner.

**The problem.** Live stats are numbers without reasons, and generative commentary can state
things that never happened. A broadcaster can't air either at scale. Live Cards separates the
two jobs: deterministic code computes every number, agents only write the words around them,
and two independent checks (a code verifier and a reasoning reviewer) must pass before
anything airs. In our 330-line evaluation, 0 of 275 planted lies got through.

**Microsoft technology.**
- **Microsoft Foundry:** gpt-4.1-mini (Explainer, Personalizer, Q&A) and gpt-5-mini (Reviewer);
  Foundry's built-in evaluators score the Explainer (groundedness, fluency, coherence) and the
  Q&A agent (intent resolution, task adherence, tool-call accuracy).
- **Microsoft Agent Framework:** workflows with conditional edges (explain → verify → review →
  rewrite or fall back → publish), a fan-out/fan-in Personalizer, a tool-calling Q&A agent,
  OpenTelemetry spans.
- **Azure Container Apps** + Container Registry: hosts the API, live streams and web app.
- **Azure Event Hubs:** the match feed (simulator publishes, engine ingests).
- **Azure Web PubSub:** pushes audit entries, approvals and control changes to every console.
- **Azure Cosmos DB:** the permanent audit log of every line aired, blocked or held.
- **Application Insights:** traces each moment through every agent and service.

**Data.** Everything is synthetic: fictional clubs, players and venue, from our own 10 fps
simulator with planted storylines.

## Why it beats today's player-tracking overlays

Basketball streams added a ring under the ball handler, streak icons and a player stat card,
and it was shortlisted for a sports-media award. That's the bar. Live Cards goes further on
every axis:

| Today's overlays | Live Cards |
|---|---|
| Ring on the ball handler | **Predictive** ring: moves to the striker *before* the cross lands, and says why |
| Stat card shows numbers | Card **explains every change** ("7.2 → 8.7: goal +1.0, interception +0.2") with evidence |
| Same graphic for everyone | **Personalized**: casual or analyst, 5 languages, home, away or neutral voice |
| Trust the producer | **Verified**: code verifier + reasoning reviewer; rejected lines never air; 0 unverified aired |
| Watch only | **Ask** it anything, and get a verified answer with evidence; **Revisit** any moment |
| Closed graphics stack | **Open cue contract** (JSON Schema) for any broadcaster's graphics partner, plus a governance console |
| Needs a tracking rig | Runs on the tracking + event feeds top leagues already produce; the vision layer extends it to games without tracking |

Say this as a story in the video, not a table: *"Rings and stat cards came to basketball last
season. We built them for football, and made them smarter: predictive, explainable,
personal, and verified."*

## Video script (target 1:50): "pull back the curtain"

Structure: start as a fan, then open the studio, then the control room. Each layer reveals the
machinery under the one before. Record at 1600×900; voiceover in your own words.

| Time | Shot | Voiceover (draft) | Brief stage |
|---|---|---|---|
| 0:00–0:08 | **Fan view.** Cold open at 64:50: Okelani sprint alert, ring glides to Varenne *before* the cross lands, GOAL | "This ring knew where the goal was coming from before the ball got there." | Ingest, Render |
| 0:08–0:16 | Card 7.2 → 8.7 with the stats line, then the AI line replaces it with "verified" | "Rings and stat cards came to basketball last season. We built them for football, and every change explains itself." | Interpret, Explain |
| 0:16–0:28 | Press **Explain the goal**: half-speed replay, ring follows each touch, captions per step | "Want the why? It rebuilds the move from the event data, touch by touch." | Explain |
| 0:28–0:42 | Switch language to Spanish + home voice; then **Studio → Fans tab**: analyst, Spanish home fan, Arabic, French | "Same moment, four fans. Different depth, language and voice, each re-checked in its own language." | Personalize |
| 0:42–0:54 | **Studio → Analyst mode**: rating ledger, attributes vs role baseline; **Your model** sets pressured passes to 0 → 8.67 vs 7.80 | "Analysts see every formula, and can plug in their own." | Interpret, Personalize |
| 0:54–1:04 | **Ask**: "Why did Varenne's rating jump?" → answer with evidence chips | "Ask it anything. It answers only what it can prove." | Explain |
| 1:04–1:18 | **Red-team** button: false claim injected, Verifier blocks it, Reviewer passes the rewrite, correct line airs | "We built a button that makes it lie. Out of 275 planted lies, none aired." | Trust |
| 1:18–1:32 | **Console**: approval mode holds a line, operator approves; kill switch turns the AI off and the stats line keeps airing; audit log | "Broadcasters stay in control: approve, switch off, audit every line." | Enterprise |
| 1:32–1:46 | Architecture diagram (README mermaid), App Insights trace of one moment, Foundry evaluation page | "Agents on Microsoft Foundry, orchestrated with Agent Framework, streaming through Event Hubs and Web PubSub on Container Apps." | |
| 1:46–1:50 | End card: name, live URL, repo URL. Optional 3-second real-footage clip before it. | "Live Cards. Every number explains itself." | |

Check before recording: start the live site with `?start=3890` so the sprint and goal arrive
in the first seconds; set Studio speed to 1×; close other tabs (Foundry rate limits).

## Bigger "better than" ideas (not committed; pitch to Hanson first)

1. **Duel mode:** two rings for a 1-v-1 matchup (winger vs. full back) with a live
   head-to-head card. It's visually striking and nobody has it. About 3 hours.
2. **Tap any number for its evidence:** clicking a stat replays the events behind it
   (builds on Revisit). About 2 hours.
3. **Fantasy points with reasons**, live on the card. About 2 hours.

## Ideas bank (raw material for the script; not final)

Collected Oct 24 as the product became an analysis platform. Pick and rewrite when scripting.

**One-liners**
- "Stats are everywhere. Understanding isn't."
- "Understand any moment of the match, live or after the whistle."
- "Walk through any play: every touch replayed from tracking data, the space it created, every
  stat explained and checked by AI agents."
- "The broadcast follows the ball. Live Cards follows the moment that mattered, and explains it."

**The problem**
- The league already publishes xG, xA and dozens of advanced stats; most fans can't read them.
- Stats without meaning are noise to a casual fan and a number dump to an analyst. Live Cards
  gives the first a story and the second a toolbox.

**Comparison (familiar reference point)**
- "Baseball has Statcast's public stats site, where fans can explore the tracking data. Football
  has nothing like it for fans, and the stats are only getting harder to read. Live Cards is that,
  but it teaches: every stat explained inside the moment it happened."
  Sources: MLB's Statcast glossary and Baseball Savant (mlb.com/glossary/statcast). Football
  analytics education today is aimed at professionals (Soccermatics/Twelve courses, accredited xG
  courses, university modules). Say "we're not aware of a fan-facing equivalent", not "nothing
  exists".

**Real-world grounding**
- Premier League grounds already have optical tracking (Second Spectrum, Genius Sports) at 25
  frames a second, and the league uses it for semi-automated offside. Live Cards runs on that kind
  of feed; our simulator stands in for it. (Sources in the conversation of Oct 24; cite carefully.)
- Replays are rendered from data, not video, which sidesteps broadcast-rights limits: data-drawn
  match trackers are an existing pattern in apps without video rights.
- With one camera, the vision layer produces positions, so clubs without tracking (lower leagues,
  women's and academy football) could use space control too. Label this roadmap: events
  (who passed to whom) from video are a further step.

**Trust (keep, it's measured)**
- 0 of 275 planted lies aired in the safety evaluation; two independent checks (code verifier and
  reasoning reviewer); a red-team button that tries to make it lie on screen.
- "Numbers come from code; words come from agents."

**Demo beats to consider**
- Home → "Break it down" on the equaliser → step to the long ball → space shading,
  "+844 m² of the final third since the last touch" at Okelani's sprint.
- Learn → xG in plain words → "See it in a real play".
- A player page: form in words, numbers explained.
- Analyse: Ask "why did his rating jump?" → verified answer; Agents tab trace; red team blocked.
- Console: approval and audit (enterprise); Vision: "no tracking system, just a camera".

## Before making the repo public (Monday)

- [ ] Decide whether `CLAUDE.md` (internal brief and competitive notes) stays, gets trimmed, or moves out.
- [ ] Confirm the license of `vision/vision_test.jpg` allows redistribution, or remove it.
- [ ] `git log` and the tree contain no secrets (`backend/.env` is ignored; check again).
- [x] README top: GIF, live URL. Add the video link once uploaded.
- [ ] Repo, video and live URL all open in a logged-out browser.
