# Demo video: final script

Target **1:58** (hard limit 2:00). Public YouTube. Fictional clubs and players only, no
third-party logos or brand names, **no copyrighted music**. Record on the live site:
https://livecards.mangorock-d6a7d3f2.northcentralus.azurecontainerapps.io

| # | Time | Source | Words | On screen |
|---|---|---|---|---|
| 1 | 0:00–0:10 | face-start | "Hi, I'm Hanson. I've loved football for as long as I can remember. Today every top-flight match is tracked: every player, every touch. But fans like me get the numbers without the meaning." | You, framed, name tag |
| 2 | 0:10–0:16 | card: before | "This is what most fans get: a table of numbers, with no explanation. So I built The Fifth Official, to give that data a use it never had." | Stats table → "Numbers. No meaning." |
| 3 | 0:16–0:20 | card: hook | "It turns match data into a new kind of content." | Hook card (cut to 4 s) |
| 4 | 0:20–0:27 | card: three | "Interactive, like a video you can step inside. Walk through curated explanations, break down any play yourself, or just scroll through the match." | Three tiles light up |
| 5 | 0:27–0:45 | take: analyse | "Explore any match yourself. It moves with the game: live as it happens, or replayed any time after. The ring follows the play, every rating change explains itself, and you can open any moment: shot maps, momentum, the xG race. Fan or analyst, in your language." | Ring + card upgrade at the 65′ goal → Overview: hover the shot map → ⚙ Analyst → ⚙ Español |
| 6 | 0:45–1:05 | take: plays | "Or let it walk you through. Curated plays turn every goal into a play-by-play. Step through each touch: this pass was routine, this one split the defence, here's the space it opened. Then make your call: how good was this chance? The engine says 0.16." | Plays → Start the play-by-play → scroll bubbles → meter → Guess the xG |
| 7 | 1:05–1:14 | take: learn | "Every stat has its own lesson, built from the same definitions the engine uses, so every new stat becomes a new chapter." | xG loop → quiz click |
| 8 | 1:14–1:36 | take: agents (+ console) | "Teaching only works if it's right. Every number comes from the match engine. Specialist AI agents on Microsoft Foundry write the words: one writes, one checks every number, one reviews every claim, one translates. Plant a lie, and it's caught. And every card you've seen is also a timed overlay cue, so a broadcaster could put it on their own feed, with a console to control exactly what airs." | Agents tab → Plant a lie → red blocked row → console tab (3 s) |
| 9 | 1:36–1:45 | card: numbers | "Zero of 275 planted lies aired. 98% fewer model calls for repeat viewers. Fifteen cents a match. Two hundred live viewers on one server." | Numbers count up, Microsoft strip |
| 10 | 1:45–1:53 | face-end | "Football data shouldn't just be for clubs and pundits. It should be something every fan can explore, learn from, and trust." | You, framed |
| 11 | 1:53–1:58 | card: end | "That's The Fifth Official. Understand every moment." | End card |

## What to film (⌘⇧5 → Record Selected Portion → the browser window). Save to `video/takes/`.

Record each a little longer than needed (it gets trimmed). Move the mouse slowly.

- **analyse.mov (~30 s):** `/?page=analyse&start=3920&speed=2` → let it play through the 65′ goal
  (ring follows, Varenne's card upgrades) → scroll to Overview → hover two shot-map dots →
  ⚙ → Explanations → Analyst → ⚙ → Language → Español.
- **plays.mov (~30 s):** `/?page=plays` → Start the play-by-play → scroll one touch at a time to
  the shot → click an answer to "how good was this chance?".
- **learn.mov (~15 s):** `/?page=learn#xg` → let the loop play once → scroll to the quiz → click
  an answer.
- **agents.mov (~30 s):** `/?page=analyse&start=3900` → Agents tab → wait for rows → **Plant a
  lie** → wait for the red blocked row → switch to a second tab already open on `/?view=console`
  for 3 s.
- **face-start.mov, face-end.mov:** landscape, eye level, light in front. 2–3 takes each.
- **vo.m4a:** QuickTime → New Audio Recording. Read sections 2–9 in order with a 2-second pause
  between each.

## Numbers (measured)
0 of 275: `docs/evaluation.md` · 98%: `docs/cache.md` · $0.15: `docs/cost.md` · 200: `docs/load-test.md`.
