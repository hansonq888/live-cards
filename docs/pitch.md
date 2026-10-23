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

Fans watching football see stats with no story, and AI commentary they can't trust. Live Cards
puts a ring under any player and gives them a live card that updates and explains every change
in their language and voice, and nothing airs until it's checked against the match data.

A team of agents on **Microsoft Foundry**, orchestrated with **Microsoft Agent Framework**:
a predictive auto-director, an Explainer, a code verifier plus a reasoning reviewer that block
unsupported claims, and a Personalizer that fans each verified moment out to casual and analyst
fans in five languages. Broadcasters get a control console and machine-readable overlay cues.

*Measured: 0 unverified lines aired across N matches; instant stats line in under 100 ms; AI
line p50 X s.* Report only measured numbers; fill these in Sunday.

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

## Video script (target 1:50)

| Time | Shot | Voiceover (draft, rewrite in your words) | Brief stage on screen |
|---|---|---|---|
| 0:00–0:08 | Cold open: ring glides to Varenne as the cross comes in, GOAL, card 7.2 → 8.7 | "This ring knew where the goal was coming from before the ball got there." | |
| 0:08–0:18 | Title card + one line | "Rings and stat cards came to basketball last season. Football has nothing like it. This is Live Cards." | |
| 0:18–0:40 | Replay the move: sprint alert 34 km/h, PREDICTED ticker, instant stats line, AI line replaces it | "Every change explains itself: the stats appear instantly, then a verified sentence." | Ingest → Interpret → Explain → Render |
| 0:40–0:55 | Fans tab: same goal, analyst / Spanish home fan / Arabic / French away fan | "Same moment, four fans, each version re-checked in its own language." | Personalize |
| 0:55–1:10 | Red-team button: false claim injected, Verifier blocks, rewrite airs | "We tried to make it lie. It refused." | Explain (trust) |
| 1:10–1:20 | Kill switch: model off, templates keep airing, metrics show 0 unverified | "Take the AI down mid-match and nothing breaks." | |
| 1:20–1:32 | Ask: "Why did his rating jump?", verified answer with evidence | "Ask it anything. It only answers what it can prove." | |
| 1:32–1:45 | Architecture (Foundry, Agent Framework workflow graph, Container Apps, Event Hubs, Web PubSub, App Insights trace) | "Six agents on Microsoft Foundry, orchestrated with Agent Framework, running on Azure." | |
| 1:45–1:50 | Optional 3-second real-footage clip with the ring, then end card with the URL | "Built for football. Ready for any league." | |

## Bigger "better than" ideas (not committed; pitch to Hanson first)

1. **Duel mode:** two rings for a 1-v-1 matchup (winger vs. full back) with a live
   head-to-head card. It's visually striking and nobody has it. About 3 hours.
2. **Tap any number for its evidence:** clicking a stat replays the events behind it
   (builds on Revisit). About 2 hours.
3. **Fantasy points with reasons**, live on the card. About 2 hours.
