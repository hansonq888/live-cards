# Demo video: final script

Target **1:55** (hard limit 2:00). Public YouTube upload. Fictional clubs and players only, no
third-party logos or brand names on screen, **no copyrighted music**. Record on the live site:
https://livecards.mangorock-d6a7d3f2.northcentralus.azurecontainerapps.io

Files go in `video/takes/`: `face-start.mov`, `face-end.mov`, takes `3.mov`–`7.mov`, and
`vo.m4a` (or one VO file per section, named by section number).

| # | Time | Source | Words (VO or on camera) | On screen |
|---|---|---|---|---|
| 1 | 0:00–0:10 | **Face** (`face-start`) | "Hi, I'm Hanson. I've loved football for as long as I can remember. Today every top-flight match is tracked: every player, every touch. But fans like me get the numbers without the meaning. So I built The Fifth Official." | You, on camera. Name tag: *Hanson Qin*. |
| 2 | 0:10–0:15 | Card: hook (cut to 5 s) | *(music-free; let it breathe, or VO:)* "It turns match data into a new kind of content." | 2–1 → "Inside every scoreline…" → pass path, 22 m · +28 m² · xG 0.16. |
| 3 | 0:15–0:23 | Card: three ways in | "Interactive, like a video you can step inside. Walk through curated explanations, break down any play yourself, or just scroll through the match." | Plays · Analyse · Matches tiles light up in turn. |
| 4 | 0:23–0:48 | Take 3: Plays story | "Curated plays are the heart of it. Every goal becomes a play-by-play. Step through each touch: this pass was routine, this one split the defence, and here's the space it opened. Then make your call: how good was this chance? The engine says 0.16." | Plays tab → **Start the play-by-play** → scroll the bubbles as the board replays → difficulty meter fills → space badge → **Guess the xG** → answer revealed. |
| 5 | 0:48–1:02 | Take 6: Learn | "Every stat has its own lesson: one idea, shown simply, then tested on real players. And the lessons come from the same definitions the engine uses, so every new stat becomes a new chapter." | xG loop (30 m = 0.05, 8 m = 0.42) → top five → quiz click → Pass difficulty. |
| 6 | 1:02–1:15 | Takes 4 + 5: Analyse | "Then go deeper yourself: shot maps, momentum, the xG race. Fan or analyst, it's the same data and two different experiences, in your language." | Play-by-play bar → **Exit to analysis** → hover the shot map → ⚙ → Analyst → ⚙ → Español. |
| 7 | 1:15–1:31 | Take 7: Agents | "Teaching only works if it's right. Every number comes from the match engine. Every sentence is written by AI agents on Microsoft Foundry and checked against the data before you see it. Plant a lie, and it's caught." | Agents tab → **Plant a lie** → red row: blocked, the reason, the safe line airs. |
| 8 | 1:31–1:40 | Card: numbers | "Zero of 275 planted lies aired. 98% fewer model calls for repeat viewers. Fifteen cents a match. Two hundred live viewers on one server." | Four numbers count up → *Built on Microsoft* strip. |
| 9 | 1:40–1:49 | **Face** (`face-end`) | "Football data shouldn't just be for clubs and pundits. It should be something every fan can explore, learn from, and trust." | You, on camera. |
| 10 | 1:49–1:55 | Card: end | "That's The Fifth Official. Understand every moment." | Wordmark, tagline, live URL, GitHub. |

About 270 spoken words in 1:55: an easy, clear pace.

## Takes to record (⌘⇧5 → Record Selected Portion, browser window ~1920×1080)

- **3 · Plays:** `/?page=plays` → Start the play-by-play → scroll one touch at a time (or click the dots) to the shot → guess the xG. ~25 s.
- **6 · Learn:** `/?page=learn#xg` → let the loop play once → scroll to the quiz, click an answer → click Pass difficulty. ~15 s.
- **4 · Analyse a play:** `/?page=analyse&play=e-1666` → click two touch chips → **Exit to analysis**. ~8 s.
- **5 · Analyse explore:** scroll to Overview → hover 2–3 shot dots → ⚙ → Explanations → Analyst → ⚙ → Language → Español. ~10 s.
- **7 · Agents:** Analyse → Agents tab → **Plant a lie** → wait for the red row. ~15 s (record longer; it's trimmed).
- *(optional)* **2 · Matches:** `/?page=watch` → click the 2–1 card; 2–3 s, used under "just scroll through the match".

## Face clips

Landscape, eye level, light in front of you (window or lamp), same spot for both. 2–3 takes
each; the cleanest is picked in the edit.

## Rules check

- All four numbers are measured: `docs/evaluation.md` (0 of 275), `docs/cache.md` (98%),
  `docs/cost.md` ($0.15), `docs/load-test.md` (200).
- "Every top-flight match is now tracked" is said as general context, with no figure and no
  company or league named.
- No music, unless it's something you made yourself.
