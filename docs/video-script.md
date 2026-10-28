# Demo video: script and shot list

Target **1:50** (hard limit 2:00). Public YouTube upload. Only fictional clubs and players on
screen, no third-party logos, **no copyrighted music** (record without music, or use a track you
made yourself). Record on the deployed site so the URL in the end card is the one judges open.

**Story in one line:** football coverage gives you a score and a table; The Fifth Official turns a
match into something you can explore, learn from and trust, and every word on screen has been
checked by AI agents against the match data.

**Style:** fast, interactive. The cursor is always doing something: hovering, clicking,
scrolling. Cut on the click. Zoom in on the thing that changes. Captions on every line, in
case judges watch muted.

---

## Timed script

| Time | Voice-over | On screen | Source |
|---|---|---|---|
| 0:00–0:08 | "A match gives you ninety minutes of moments. Most coverage gives you a score and a stats table." | **Title card A**: a 2–1 scoreline that cracks open into shot dots, a pass arrow and a rating ticking up. | Card (Claude makes) |
| 0:08–0:14 | "The Fifth Official turns a match into something you can explore." | Home page. Slow push-in on the hero, the cursor moves to **Browse matches**. | You record |
| 0:14–0:20 | "Three ways in: follow a full match, learn from curated plays, or take the game apart yourself." | **Card B**: three tiles (Matches · Plays · Analyse) light up one by one. | Card |
| 0:20–0:30 | "Pick a match. Every one has its key moments, player ratings and clubs." | Matches list → click the 2–1 card → match centre, scroll past key moments and the player stats table (headshots). | You record |
| 0:30–0:52 | "Curated plays are a new kind of match content. Each goal becomes a play-by-play. Step through every touch, see how hard the pass was, guess how good the chance was, then see the answer." | Plays tab → **Start the play-by-play** → scroll: the board replays each touch, bubbles light up → difficulty meter fills → space gain badge → **Guess the xG**: click "Maybe", the answer reveals 0.16. | You record |
| 0:52–1:12 | "Want to dig deeper? Open any play in Analyse, step through it, then explore the whole match: shot maps, momentum, the xG race. In your language, at your level." | Analyse: the play-by-play bar → **Exit to analysis** → hover the shot map (detail appears) → hover momentum → ⚙ menu: Explanations → Analyst, Language → Español (a line changes language). | You record |
| 1:12–1:24 | "New to the numbers? Every stat has a lesson, and every lesson grows from the same stat definitions the engine uses." | Learn: the xG concept loop → top five → quiz click → switch to Pass difficulty (badge moves). | You record (or B-roll Claude captures) |
| 1:24–1:40 | "Every number comes from the match engine. Every sentence is written by agents on Microsoft Foundry and checked before you see it. Plant a lie, and it's caught." | Analyse → Agents tab → **Plant a lie** → the red row: blocked, the reason, the safe line airs instead. | You record |
| 1:40–1:50 | "Measured: zero of 275 planted lies aired. 98% fewer model calls for repeat viewers. Fifteen cents a match. Two hundred live viewers on one process." | **Card C**: the four numbers count up, then the architecture strip (Foundry · Agent Framework · Container Apps · Event Hubs · Web PubSub · Cosmos DB · App Insights). | Card |
| 1:50–1:56 | "The Fifth Official. Understand every moment." | **End card**: wordmark, tagline, live URL, GitHub URL. | Card |

All four numbers are measured, in `docs/evaluation.md`, `docs/cache.md`, `docs/cost.md` and `docs/load-test.md`.
Say them exactly as written there: 0 of 275, 98% fewer, $0.15 per match, 200 concurrent viewers.

---

## Shot list (what to record yourself)

Record each as its own take with macOS screen recording (⌘⇧5, "Record selected portion",
1920×1080 browser window, cursor shown). 5–15 s each, starting and ending still for a beat.
Browser zoom 100%, hide bookmarks bar, one tab.

1. **Home:** load `/`, wait 1 s, move to **Browse matches**.
2. **Matches → match centre:** `/?page=watch` → click Riverside 2–1 Northgate → scroll slowly to the player stats table.
3. **Plays → story:** `/?page=plays` → **Start the play-by-play** → scroll one touch at a time (or click the dots) to the shot → guess the xG.
4. **Analyse play-by-play:** `/?page=analyse&play=e-1666` → click a couple of touch chips → **Exit to analysis**.
5. **Analyse explore:** scroll to Overview; hover 2–3 shot dots; hover momentum bars; open ⚙ → Analyst; ⚙ → Español.
6. **Learn:** `/?page=learn#xg` → let the loop play once → click a quiz option → click Pass difficulty.
7. **Agents:** Analyse → Agents tab → **Plant a lie** → wait for the red blocked row.
8. *(optional)* **Watch view:** a goal on the broadcast camera with the player card upgrading.

## What Claude can make for you

- **Animated cards** (A, B, C and the end card) as 1080p MP4s: built as HTML/CSS animations in
  the app's own type and colours, and recorded frame-perfect.
- **B-roll** of the 2D pages (Plays story, Learn loops, Matches) captured automatically. The 3D
  broadcast and tactics views record smoother from your own screen.
- **The edit:** drop your takes in a folder and Claude can trim them, add zoom-ins on the
  interesting part, burn in captions and join everything with the cards into one MP4 under
  2:00, using ffmpeg. Record the voice-over separately (QuickTime → New Audio Recording) and it
  gets laid under the cut.

## Order of work tonight (deadline 11:59 pm PT)

1. Deploy (v16) and check the public URL. ~10 min
2. You record takes 1–7; Claude builds the cards at the same time. ~40 min
3. Voice-over, one take per row of the script. ~15 min
4. Edit and export, checking it runs under 2:00. ~30 min
5. Upload to YouTube (public), then fill in the submission form with the video URL, repo URL and live URL. ~20 min
