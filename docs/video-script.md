# Demo video: final script

Target **1:58** (hard limit 2:00). Public YouTube. Fictional clubs and players only, no
third-party logos or brand names, **no copyrighted music**. Record on the live site:
https://livecards.mangorock-d6a7d3f2.northcentralus.azurecontainerapps.io

The middle follows one path a fan would take: a guided play-by-play → open it in Analyse and
break it down yourself → step out and explore the whole match.

| # | Time | Source | Words | On screen |
|---|---|---|---|---|
| 1 | 0:00–0:10 | face-start | "Hi, I'm Hanson. I love sports, I love data, and I love building things. Today every top-flight match is tracked: every player, every touch. But fans get the numbers without the meaning." | You, framed, name tag |
| 2 | 0:10–0:16 | card: before | "This is what most fans get: a table of numbers, with no explanation. So I built The Fifth Official, to give that data a use it never had." | Stats table → "Numbers. No meaning." |
| 3 | 0:16–0:20 | card: hook | "It turns match data into a new kind of content." | Hook card |
| 4 | 0:20–0:27 | card: three | "Interactive, like a video you can step inside. Walk through curated explanations, break down any play yourself, or just scroll through the match." | Three tiles light up |
| 5 | 0:27–0:47 | take: journey (part 1) | "Start with a curated play-by-play. Every goal is told touch by touch: this pass was routine, this one split the defence, here's the space it opened. Then make your call: how good was this chance? The engine says 0.16." | Plays → Start the play-by-play → scroll bubbles → meter → Guess the xG |
| 6 | 0:47–1:00 | take: journey (part 2) | "Want to see it for yourself? Open it in Analyse and break it down: step through every touch on the pitch, in the broadcast view or the tactics board." | Open in Analyse → breakdown bar → click touch chips → switch views |
| 7 | 1:00–1:16 | take: journey (part 3) | "Then step out and explore the whole match. Click any player to follow them; their card explains every change. Colour the pitch by a stat to see who's doing the work. Fan or analyst, in your language." | Exit to analysis → click 2 players → Colour by → Engine → tactical view → ⚙ Analyst → Español |
| 8 | 1:16–1:24 | take: learn | "And every stat has its own lesson, so every new stat becomes a new chapter." | xG loop → quiz click |
| 9 | 1:24–1:42 | take: agents (+ console) | "Teaching only works if it's right. Every number comes from the match engine. Specialist AI agents on Microsoft Foundry write the words: one writes, one checks every number, one reviews every claim, one translates. Plant a lie, and it's caught. And every card is also a timed overlay cue a broadcaster could put on their own feed, with a console to control what airs." | Agents tab → Plant a lie → red blocked row → console (3 s) |
| 10 | 1:42–1:50 | card: numbers | "Zero of 275 planted lies aired. 98% fewer model calls for repeat viewers. Fifteen cents a match. Two hundred live viewers on one server." | Numbers count up, Microsoft strip |
| 11 | 1:50–1:56 | face-end | "Football data shouldn't just be for clubs and pundits. It should be something every fan can explore, learn from, and trust." | You, framed |
| 12 | 1:56–2:00 | card: end | "That's The Fifth Official." | End card (trimmed to 4 s) |

## What to film (⌘⇧5 → Record Selected Portion → the browser window). Save to `video/takes/`.

Move the mouse slowly; record a little long (it gets trimmed).

- **journey.mov (~75 s, one continuous take):**
  1. `/?page=plays` → **Start the play-by-play** → scroll touch by touch to the shot → answer
     "how good was this chance?".
  2. Click **Open in Analyse** (top right) → in the breakdown bar click two or three touch chips →
     click the corner view to switch broadcast ↔ tactics once.
  3. Click **Exit to analysis** → click two players on the pitch (their card opens) → **Colour by →
     Engine** → switch to the tactics view so the rings show there too → ⚙ → Analyst →
     ⚙ → Español.
- **learn.mov (~12 s):** `/?page=learn#xg` → let the loop play → click a quiz answer.
- **agents.mov (~30 s):** `/?page=analyse&start=3900` → Agents tab → **Plant a lie** → red row →
  switch to a tab already open on `/?view=console` for 3 s.
- **face-start.mov, face-end.mov:** landscape, eye level, light in front. 2–3 takes each.
- **vo.m4a:** sections 2–10, 2-second pause between each.

## Numbers (measured)
0 of 275: `docs/evaluation.md` · 98%: `docs/cache.md` · $0.15: `docs/cost.md` · 200: `docs/load-test.md`.
