# Demo video: final script

Target **1:58** (hard limit 2:00). Public YouTube. Fictional clubs and players only, no
third-party logos or brand names, **no copyrighted music**. Record on the live site:
https://livecards.mangorock-d6a7d3f2.northcentralus.azurecontainerapps.io

The middle follows one path a fan would take: a guided play-by-play → open it in Analyse and
break it down yourself → step out and explore the whole match.

| # | Time | Source | Words | On screen |
|---|---|---|---|---|
| 1 | 0:00–0:10 | face-start | "Hi, I'm Hanson. I love sports, data, and building things. Every top-flight match is tracked now, but fans get the numbers without the meaning." | You, framed, name tag |
| 2 | 0:10–0:16 | card: before | "Most fans get a table like this, with no explanation. So I built The Fifth Official." | Stats table → "Numbers. No meaning." |
| 3 | 0:16–0:26 | cards: hook → three | "It turns match data into interactive content: walk through a curated play, break it down yourself, or explore the whole match." | Hook card (short) → three tiles |
| 4 | 0:26–0:40 | journey 1 | "Start with a curated play-by-play: every goal, touch by touch. This pass was routine; this one split the defence. Then make your call: how good was this chance? The engine says 0.16." | Plays → play-by-play → bubbles → Guess the xG |
| 5 | 0:40–0:47 | journey 2 | "Open it in Analyse to break it down yourself, on the broadcast view or the tactics board." | Open in Analyse → touch chips → switch view |
| 6 | 0:47–0:56 | journey 3 | "Then explore the whole match: follow any player, colour the pitch by a stat, even build your own rating model." | Exit to analysis → click players → Colour by → Your model |
| 7 | 0:56–1:01 | learn | "Lost on a stat? Every one links to a short lesson." | Click a "Learn" link → lesson loop → quiz |
| 8 | 1:01–1:18 | agents | "And it has to be right. Numbers come from the match engine; words come from specialist agents built on Microsoft Agent Framework and Foundry. One writes, one checks every number, one reviews every claim. Plant a lie, and it's caught." | Agents tab → Plant a lie → red blocked row |
| 9 | 1:18–1:29 | console | "It runs on Azure Container Apps with Event Hubs, and every card is a timed overlay cue a broadcaster could air, controlled from a console." | Console tab: kill switches, audit log |
| 10 | 1:29–1:38 | card: numbers | "Zero of 275 planted lies aired. 98% fewer model calls for repeat viewers. Fifteen cents a match. Two hundred live viewers on one server." | Numbers + Microsoft strip |
| 11 | 1:38–1:47 | face-end | "Football data shouldn't just be for clubs and pundits. It should be something every fan can explore, learn from, and trust." | You, framed |
| 12 | 1:47–1:50 | card: end | "That's The Fifth Official." | End card |

About 255 words: **~1:50** at a natural pace (156 words a minute), 10 s of headroom.

## What to film (⌘⇧5 → Record Selected Portion → the browser window). Save to `video/takes/`.

Move the mouse slowly; record a little long (it gets trimmed).

- **journey.mov (~75 s, one continuous take):**
  1. `/?page=plays` → **Start the play-by-play** → scroll touch by touch to the shot → answer
     "how good was this chance?".
  2. Click **Open in Analyse** (top right) → in the breakdown bar click two or three touch chips →
     click the corner view to switch broadcast ↔ tactics once.
  3. Click **Exit to analysis** → click two players on the pitch (their card opens) → **Colour by →
     Engine** → switch to the tactics view so the rings show there too → **Settings → Your model** → change a
     weight → close and watch ratings change → (optional) ⚙ → Language → Español for one second.
- **learn.mov (~12 s):** in the play-by-play, click a **"Learn: pass difficulty →"** link → let the loop play → click a quiz answer.
- **agents.mov (~30 s):** `/?page=analyse&start=3900` → Agents tab → **Plant a lie** → red row →
  switch to a tab already open on `/?view=console` for 3 s.
- **face-start.mov, face-end.mov:** landscape, eye level, light in front. 2–3 takes each.
- **vo.m4a:** sections 2–10, 2-second pause between each.

## Numbers (measured)
0 of 275: `docs/evaluation.md` · 98%: `docs/cache.md` · $0.15: `docs/cost.md` · 200: `docs/load-test.md`.
