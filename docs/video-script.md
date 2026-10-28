# Demo video: final script

Target **1:58** (hard limit 2:00). Public YouTube. Fictional clubs and players only, no
third-party logos or brand names, **no copyrighted music**. Record on the live site:
https://livecards.mangorock-d6a7d3f2.northcentralus.azurecontainerapps.io

| # | Time | Source | Words | On screen |
|---|---|---|---|---|
| 1 | 0:00–0:10 | face-start | "Hi, I'm Hanson. I've loved football for as long as I can remember. Today every top-flight match is tracked: every player, every touch. But fans like me get the numbers without the meaning. So I built The Fifth Official." | You, framed, name tag |
| 2 | 0:10–0:14 | card: hook | "It turns match data into a new kind of content." | Hook card (cut to 4 s) |
| 3 | 0:14–0:21 | card: three | "Interactive, like a video you can step inside. Walk through curated explanations, break down any play yourself, or just scroll through the match." | Three tiles light up |
| 4 | 0:21–0:29 | take A: live | "And it runs live, as the match happens: the ring follows the play, and every rating change explains itself." | Live view: ring on a player, card upgrades with its reason |
| 5 | 0:29–0:52 | take B: Plays | "Curated plays are the heart of it. Every goal becomes a play-by-play. Step through each touch: this pass was routine, this one split the defence, here's the space it opened. Then make your call: how good was this chance? The engine says 0.16." | Plays → Start the play-by-play → scroll bubbles → meter → space → Guess the xG |
| 6 | 0:52–1:02 | take C: Learn | "Every stat has its own lesson, built from the same definitions the engine uses, so every new stat becomes a new chapter." | xG loop → quiz click |
| 7 | 1:02–1:13 | take D: Analyse | "Then go deeper yourself: shot maps, momentum, the xG race. Fan or analyst, same data, two different experiences, in your language." | Exit to analysis → hover shot map → ⚙ Analyst → ⚙ Español |
| 8 | 1:13–1:31 | take E: Agents | "Teaching only works if it's right. Every number comes from the match engine. Specialist AI agents on Microsoft Foundry write the words: one writes, one checks every number, one reviews every claim, one translates. Nothing airs until the checks pass. Plant a lie, and it's caught." | Agents tab: the pipeline rows → Plant a lie → red blocked row |
| 9 | 1:31–1:40 | card: numbers | "Zero of 275 planted lies aired. 98% fewer model calls for repeat viewers. Fifteen cents a match. Two hundred live viewers on one server." | Numbers count up, Microsoft strip |
| 10 | 1:40–1:52 | face-end | "Any broadcaster or streaming app could put this beside their coverage. Because football data shouldn't just be for clubs and pundits. It should be something every fan can explore, learn from, and trust." | You, framed |
| 11 | 1:52–1:58 | card: end | "That's The Fifth Official. Understand every moment." | End card |

## What to film (⌘⇧5 → Record Selected Portion → the browser window). Save to `video/takes/`.

Record each a little longer than needed (I trim). Move the mouse slowly and deliberately.

- **A · live.mov (~12 s):** `/?page=watch&match=7&start=3920&speed=2` → let it play (the goal comes after ~13 s); the ring follows,
  the goal goes in at 65′ and Varenne's card upgrades with its reason.
- **B · plays.mov (~30 s):** `/?page=plays` → Start the play-by-play → scroll one touch at a time
  to the shot → click an answer in "how good was this chance?".
- **C · learn.mov (~15 s):** `/?page=learn#xg` → let the loop play once → scroll to the quiz →
  click an answer.
- **D · analyse.mov (~15 s):** `/?page=analyse&play=e-1666` → click two touch chips → Exit to
  analysis → scroll to the shot map, hover two dots → ⚙ → Explanations → Analyst → ⚙ →
  Language → Español.
- **E · agents.mov (~25 s):** `/?page=analyse&start=3900` → Agents tab → wait for rows to fill →
  Plant a lie → wait for the red blocked row.
- **face-start.mov, face-end.mov:** landscape, eye level, light in front. 2–3 takes each.
- **vo.m4a:** QuickTime → New Audio Recording. Read sections 2–9 in order with a 2-second pause
  between each.

## Numbers (measured)
0 of 275: `docs/evaluation.md` · 98%: `docs/cache.md` · $0.15: `docs/cost.md` · 200: `docs/load-test.md`.
