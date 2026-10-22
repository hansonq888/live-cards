# Live Cards — Build Brief for the Coding Agent

You are helping **Hanson Qin** (Yale CS & Math, class of 2028) build a solo entry for the
**Microsoft × Premier League "Inside the Game: Developer Hackathon"** in about four days.
Read this whole file before writing code. It holds the hackathon rules, the product spec,
the engineering rules, the build plan and the sources.

- **Submission deadline:** Tuesday, October 27, 2026. The exact cutoff time isn't confirmed,
  so check the official rules. **Target: submit Monday night, Oct 26.**
- **Winners announced:** November 20, 2026.
- **Today:** Thursday, October 22, 2026. Hanson is on fall break through Monday.
- **Full spec (living doc, may be newer than this file):** https://claude.ai/artifact/E1xjzX1Hqq5zYVxqZbiruU

---

## 1. The hackathon

### Challenge: "The Synthetic Match Insights Engine for Premier League Studio"
Build an AI-powered solution that turns **synthetic, football-realistic match events** into
**explainable match intelligence**, real-time narratives and automated recaps. It should work
for studio, broadcast and streaming use, and be personalized for fans in any market.

**Data rule:** projects must use **synthetic, football-realistic data**. No real Premier League
match data is given to participants. Use **fictional clubs and players only**.

**Required pipeline (one pipeline, five stages):**
1. **Ingest:** synthetic match events as they happen (passes, shots, tackles, possession
   changes, pressure events, match metadata).
2. **Interpret:** turn them into meaningful statistics, patterns and context.
3. **Explain:** say *why* a moment matters, not only that it happened.
4. **Render:** insight that can sit on screen alongside the match. The brief says outputs should
   be "timed and machine-readable enough to be rendered as synchronized graphical overlays on a
   live match feed, in the way the platform's rendering partner handles overlays."
5. **Personalize:** the same intelligence should reach a data-hungry analyst and a casual fan as
   "two genuinely different experiences" (custom modes, favorite clubs and players,
   player-focused mode, language). The brief adds: "a Project that only generates metrics has no
   audience, and a solution that only personalizes has nothing to personalize."

**Features the brief suggests:**
- **Player identification:** real-time player name tagging, with optional speed and distance
  indicators triggered at predefined thresholds.
- **Pass quality:** pass distance, pass accuracy, pass difficulty rating.
- **Speed metrics:** ball speed, shot speed.
- **Auto-eventing:** a model running over a video feed to generate these metrics automatically.
  Optional; we treat it as a "Nice" item.
- **Narrative generation:** key narratives, player-performance context, milestones, recaps.
- **Explainability:** control vs. chaos, tactical pressure changes, game rhythm.
- **Data innovation:** create or extend synthetic datasets.
- **Multi-language storytelling.**

### Submission requirements
- A **newly built** project. The git history starting this week shows that.
- A **project pitch or description:** what you built, which Microsoft and Azure technologies,
  what it does, what problem it solves.
- A **demo video under 2 minutes.** Judges don't have to watch past 2:00. It must show the
  project working, use a public URL (YouTube, Vimeo, Facebook Video or Youku), and contain **no
  third-party trademarks, copyrighted music or other copyrighted material** without permission.
- A **public GitHub repo.**

### Judging rubric (each 20%)
1. **Technological implementation:** quality software practices, effective use of the hero
   technologies, well-structured, documented, maintainable code.
2. **Agentic design and innovation:** creative agentic patterns, sophisticated orchestration or
   multi-agent collaboration, novel AI use.
3. **Real-world impact and applicability:** significance of the problem, production readiness,
   potential impact.
4. **User experience and presentation:** well-designed, intuitive UX, clear value in the demo,
   balanced frontend and backend.
5. **Adherence to the hackathon category.**

### Prizes
- **Grand Prize, first** (about $4,000 per team member plus a Premier League match ticket) and
  **second** (about $2,500 per member plus a ticket): best overall solution with real-world
  impact and innovative use of the Microsoft platform.
- **Best Use of Microsoft Foundry**, **Best Enterprise Solution**, **Best Multi-Agent
  Orchestration** and **Best Azure Cloud Native Integration:** about $1,500 per member each.
- **Multi-agent judges look for:** "specialized agents have distinct roles, coordinate through
  shared state and effective handoffs, recover from failures, and deliver an end-to-end outcome
  a single agent could not achieve as effectively." Named options: GitHub Copilot, Microsoft
  Agent Framework, A2A, or another supported orchestration approach.
- **Enterprise judges look for:** "readiness for enterprise deployment and long-term business
  impact… reliability, transparency, and controls required for use in production."
- **Cloud native judges look for:** effective integration of AKS, Container Apps, Functions,
  Logic Apps and AI-optimized data platforms; event-driven architectures; operational excellence.

**Our targets:** Grand Prize (primary), Multi-Agent Orchestration and Enterprise (secondary).

### The competition (scanned Oct 21, 2026)
- 490 projects were registered, but about 241 were empty placeholders and only 23 had a demo video.
- **Crowded lanes to avoid as a headline:** fact-checked AI commentary, generic "ask the match"
  chatbots, "AI broadcast director / studio crew", multilingual commentary, what-if simulators,
  accessibility commentary, momentum and tactical dashboards.
- **Near us:** OmniPitch (player spotlight HUD with live ratings), KickStream (3D pitch plus
  player ratings), MatchLens (player cards). **Nobody** does live cards that explain their own
  changes, an auto-director, Q&A on the selected player, and a broadcaster control console
  together.

---

## 2. The product: Live Cards

**One-liner:** *Performance View for the Premier League, but better.* A ring follows any player,
their live card updates and explains every change, and fans can ask it anything. Every answer is
verified against the match data.

**Why "Performance View":** Peacock launched Performance View for its NBA streams in November
2025: a colored ring under the ball handler, hot-streak icons and a "Player Pulse Card". It was
shortlisted for a 2026 Hashtag Sports Award. Football has no equivalent. **Ours is better in four
ways:**
1. Every change explains itself, with evidence.
2. Fans can ask it questions.
3. It personalizes by level, language, club and fantasy team.
4. Broadcasters get a console to control and audit what airs.

**Hook line for the video:** "Peacock gave NBA fans Performance View: a ring, a few icons, a stats
card. We built it for the Premier League, and made it better. Every number explains itself, you
can ask it anything, it speaks your language, and broadcasters control what airs."

**Hero demo moment:** the ring follows a winger on a sprint (speed alert). The auto-director
glides it to the striker as the cross comes in. Goal. His card upgrades from 6.9 to 8.6 with the
reason on screen. A fan asks "why did he jump?" and gets a verified answer. Then the same moment
appears for an analyst, a casual fan, and a Spanish-speaking fan whose fantasy captain he is.

### Users and modes

| User | Mode | What they do |
|---|---|---|
| Fan | **Live** | Follow any player with the ring (click, keyboard, or auto-director); cards update and explain themselves |
| Fan | **Ask** | Plain-language questions about any player or the match; verified answer plus evidence |
| Fan | **Revisit** | Scrub a timeline of key moments; the ring and card replay each one as it was |
| Broadcaster operator | **Console** | Per-feature kill switches, insight allowlist, manual or auto approval for AI lines, audit log, metrics |

**Premier League hooks:**
- **Fantasy mode:** the ring follows your fantasy XI, and cards show live fantasy points with reasons, using fantasy-style scoring. *Should.*
- **Five languages,** adapted rather than translated: English, Spanish, French, Arabic, Portuguese. *Must.*
- **Home, away or neutral voice.** *Must.*
- **Player of the Match:** the case for each nominee, built from verified events. *Should.*
- **Team of the Matchweek** shareable cards. *Nice.*
- **Second-screen mode.** *Nice.*

---

## 3. Functional requirements

Tiers: **Must** ships by Saturday night, **Should** on Sunday, **Nice** only if ahead.

**Ingest**
- F1 Must: simulator plays a full 90-minute match between two fictional clubs, with metadata (lineups, positions, venue).
- F2 Must: player and ball positions at 10 fps, plus events (pass, shot, tackle, interception, foul, card, goal, substitution, possession change, pressure).
- F3 Must: planted storylines so the demo has drama on cue: a winger's sprint, a dominant spell, a late goal, a substitution, a fading player.
- F4 Must: replay as a live stream at 1x–20x; events and positions arrive frame by frame.

**Interpret** (deterministic code only, never the LLM)
- F5 Must: per-player live stats: touches, passes and accuracy, pass difficulty, shots, chances created, tackles, distance, top speed, sprints.
- F6 Must: brief metrics: pass distance, pass accuracy, pass difficulty, ball speed, shot speed.
- F7 Must: card attributes and live rating from transparent formulas (section 4).
- F8 Must: team state: possession by window, momentum, control vs. chaos index.
- F9 Must: moment detector (goals, big chances, sprints over threshold, streaks, upgrades, momentum swings), each with an importance score.

**Explain**
- F10 Must: every card change and alert gets a one-line reason grounded only in computed stats.
- F11 Must: every claim carries evidence (event IDs and stat values).
- F12 Must: the verifier blocks any number or claim not in the evidence; one rewrite, then a safe template.

**Render**
- F13 Must: match viewer: an animated pitch (start from `prototype/index.html`) with a broadcast-style camera following play.
- F14 Must: a ring under the selected player that follows them; switching by click, keyboard or auto-director, with a smooth glide.
- F15 Must: name tag, live card panel, upgrade animation with the reason, alert badges (sprint, streak).
- F16 Must: everything on screen is also emitted as **timed, machine-readable overlay cues** (JSON).
- F17 Nice: vision closer: a real-footage clip with detected players and the ring tracking one, **only if organizers confirm the footage is allowed.**

**Personalize**
- F18 Must: casual and analyst modes with genuinely different wording and depth.
- F19 Must: 5 languages; home, away or neutral voice.
- F20 Must: player-focus mode (one player all match, with their running story).
- F21 Should: fantasy mode.

**Ask, Revisit, Console**
- F22 Should: Ask: Q&A through query tools over the match data; verified before display.
- F23 Should: Revisit: a key-moment timeline; jumping to a moment restores the ring, the card as it was, and the reason.
- F24 Should: Console: kill switches, insight allowlist, approval mode, audit log of every cue with its evidence.
- F25 Must: metrics panel: event-to-screen latency, claims checked vs. blocked, cues per minute.
- F26 Nice: play-by-play voice for the followed player (Azure AI Speech).
- F27 Should: Player of the Match case and Team of the Matchweek cards at full time.

---

## 4. Card and rating model (transparent; show the formulas in-app and in the README)

**Live rating (0–10):** starts at 6.0 and moves with each event, capped between 3.0 and 10.0.
Starting weights, to be tuned:

| Event | Change |
|---|---|
| Goal | +1.0 |
| Assist | +0.6 |
| Chance created | +0.15 |
| Shot on target | +0.1 |
| Tackle or interception won | +0.1 |
| Pass completed under pressure | +0.03 |
| Turnover in own half | −0.15 |
| Foul conceded | −0.05 |
| Yellow card | −0.3 |

**Attributes (1–99),** recomputed every minute against a role baseline:
- **Pace:** top speed, sprint count
- **Passing:** completion %, forward passes, average pass difficulty
- **Threat:** shots, chance quality (distance and angle), chances created
- **Defending:** tackles, interceptions, pressures won
- **Engine:** distance, high-intensity runs

**Upgrades:** fire when an attribute rises 3+ points within 10 minutes, or the rating rises 0.5+.
Downgrades mirror this. Each fires at most once per window.

**Alerts:** sprint over 32 km/h; fastest sprint of the match; 3 successful actions in a row
(streak icon); distance milestones every 2 km.

**Card design and attribute names are our own.** Don't use FIFA, EA Sports FC, FUT, or any game's
card design. Say "inspired by football gaming culture."

---

## 5. Agent design (Microsoft Agent Framework, Python; models on Microsoft Foundry)

| Agent | Job | Input → output | Fallback |
|---|---|---|---|
| Stats engine (code, not an agent) | Stats, ratings, attributes, moments | events + positions → card state, moments with importance | Unit-tested; can't hallucinate |
| Auto-director | Who the ring follows, and why | moments, ball proximity, current attack, recent upgrades → target player + one-line rationale | Rule-based: nearest player to the ball in the final third |
| Explainer | The reason for each upgrade, alert or AI read | moment + evidence bundle → short reason per audience | Template, e.g. "Passing +3: 8 forward passes since 60'" |
| Verifier | Check every number and claim against evidence | copy + evidence → pass, or reject naming the bad claim | Rejected copy never airs; template instead |
| Q&A agent | Answer fan questions using query tools over match data | question + match state → answer + evidence | "I can't verify that" instead of a guess |
| Personalizer | Casual/analyst, language, club voice, fantasy | verified English copy + fan profile → variants (in parallel) | Azure AI Translator for language only |

**Rules:**
- Numbers only come from the stats engine; agents write words around them.
- The auto-director holds a player for at least 6 seconds before switching.
- Personalization runs after verification, and the verifier re-checks the numbers in each variant.
- Speed target, to be measured: goal on the feed to explained upgrade on screen in under 3 seconds.
  Use a small, fast model for explanations and templates for routine alerts.

**Agent Framework quick start (Python), from Microsoft Learn:**
```python
from agent_framework import Agent
from agent_framework.foundry import FoundryChatClient
from azure.identity import AzureCliCredential

agent = Agent(
    client=FoundryChatClient(
        project_endpoint="https://<foundry-service>.services.ai.azure.com/api/projects/<project>",
        model="<deployed-model-name>",
        credential=AzureCliCredential(),
    ),
    name="Explainer",
    instructions="...",
)
result = await agent.run("...")
```
Use the framework's **workflows** for the multi-agent graph: explicit execution paths, the
verifier's send-back loop, and human-in-the-loop approval in console manual mode. The framework's
own guidance: if a plain function can do it, write a function instead of an agent.

---

## 6. Microsoft products

| Product | Job | Tier |
|---|---|---|
| Microsoft Foundry | Hosts the models: small and fast for explanations and personalization, stronger for the verifier and Q&A | Must |
| Microsoft Agent Framework (Python) | The agent workflow | Must |
| Azure Event Hubs | Live feed: the simulator publishes events and position frames | Must |
| Azure Web PubSub | Pushes ring position, card updates, alerts and cues to viewers and the console | Must |
| Azure Container Apps | Hosts the engine, agents, API and web app | Must |
| Application Insights (OpenTelemetry) | Traces each moment through each agent; latency per step | Must |
| Azure Cosmos DB | Replay state snapshots and the audit log | Should (SQLite first) |
| Azure AI Speech | Play-by-play voice | Nice |
| Azure AI Translator | Language fallback | Nice |
| Container Apps GPU / Azure ML | The vision model for the closer | Nice |

**Day-one check (first hour Thursday):** deploy one model in Microsoft Foundry on Hanson's Azure
account. If the student subscription blocks it, switch to the standard Azure free trial right
away. GPU access is also likely limited on student accounts, which is fine because vision is Nice.

**Local-first strategy:** build everything locally first (SSE or WebSocket instead of Web PubSub,
an in-process queue instead of Event Hubs, SQLite instead of Cosmos). Swap in the Azure services
on Sunday behind thin interfaces.

---

## 7. Architecture and data contracts

```
Match simulator ──▶ Event Hubs ──▶ Stats engine (code) ──card state + moments──▶
   Agent workflow [Auto-director | Explainer ─▶ Verifier ─▶ Personalizer | Q&A agent]  (models: Foundry)
        ──▶ Web PubSub ──▶ { Fan viewer (Live/Ask/Revisit) | Broadcaster console | Overlay cues JSON }
Hosting: Container Apps · State/audit: Cosmos DB · Tracing: Application Insights
```

**Position frame** (10 per second):
```json
{"t":2287.4,"ball":{"x":41.2,"y":2.6,"z":0.1},"players":[{"id":"RIV-07","x":36.8,"y":21.3,"v":9.3}]}
```

**Event:**
```json
{"id":"e-0412","t":2287.4,"minute":38,"type":"shot","team":"RIV","player":"RIV-09","x":88.2,"y":41.0,"outcome":"goal","speed_kmh":104}
```

**Card state:**
```json
{"player":"RIV-09","t":2290.0,"rating":8.6,"delta":1.7,"attrs":{"pace":71,"passing":64,"threat":88,"defending":40,"engine":69},"reason":"Goal from his first touch in the box","evidence":["e-0398","e-0405","e-0412"],"verified":true}
```

**Overlay cue:**
```json
{"cue":"o-117","start":2290.0,"duration":6,"type":"card_upgrade","player":"RIV-09","ring":true,"text":{"casual":"...","analyst":"..."},"lang":"en","evidence":["e-0412"]}
```

**Coordinates:** pitch 105 × 68 m, origin at the center spot, x toward the right-hand goal.
Positions are in meters, times in seconds from kickoff.

**Suggested stack:** Python 3.11+ (FastAPI, Agent Framework, pytest) for the backend; React +
three.js for the frontend (Vite or Next.js); SQLite locally, then Cosmos DB.

---

## 8. Scope

- **Must (Saturday night):** simulator with storylines and live replay; stats engine, attributes,
  rating, moments with tests; viewer (pitch, ring, switching, card, upgrade animation, alerts);
  auto-director, explainer, verifier, personalizer (casual/analyst, 5 languages, club voice);
  overlay cues; metrics panel; deployed on Azure with a public URL.
- **Should (Sunday, in order):** Ask → Revisit → Console → Fantasy mode → Player of the Match.
- **Nice:** vision closer (only with organizer OK), play-by-play voice, 3D camera moves,
  second screen, Team of the Matchweek.
- **Out:** real Premier League data, club names, logos or game branding; multiple simultaneous
  matches; accounts and payments; training custom vision models.

---

## 9. Build plan

**The gate is Friday night:** a live replay with the ring, cards and explained upgrades working end
to end. If a day's exit check fails, cut scope the next morning, never quality.

- **Thursday (data and engine):** Foundry check; repo setup; simulator (90 minutes, 10 fps,
  events, storylines); stats engine, attributes, rating, moment detector with tests.
  *Exit:* a replay prints card states, upgrades and alerts in the terminal.
- **Friday (live experience):** viewer (pitch, ring, switching, card panel, upgrade animation,
  alerts); auto-director, explainer, verifier; streaming to the browser.
  *Exit:* the ring follows play and explained upgrades appear.
- **Saturday (personalization and depth):** personalizer; overlay cues; metrics; start Ask and
  Revisit. *Exit:* every Must item works locally.
- **Sunday (Azure, console, polish):** deploy (Container Apps, Event Hubs, Web PubSub, App
  Insights); console; fantasy mode if time; run 3 matches and record latency and verifier numbers;
  visual polish; vision closer only if everything else is done and footage is cleared.
  *Exit:* the public URL works and numbers are recorded.
- **Monday (story):** video script and recording (YouTube); README (GIF, architecture, agent
  table, rating formulas, setup, metrics); project page; **submit Monday night.**
- **Tuesday:** buffer only.

### Demo video script (under 1:50)
1. **0:00–0:10 Hook:** the "Performance View, but better" line above.
2. **0:10–0:40 Live:** winger sprint alert, auto-director glides to the striker, goal, card 6.9 → 8.6 with the reason.
3. **0:40–0:55 Personalize:** the same upgrade for analyst, casual, Spanish with home voice, fantasy points.
4. **0:55–1:10 Ask:** "Why did his rating jump?" Verified answer; clicking shows the events.
5. **1:10–1:22 Revisit:** scrub back to the sprint.
6. **1:22–1:37 Console:** flip a kill switch, open the audit log, show metrics (latency, claims blocked, 0 unsupported claims aired).
7. **1:37–1:50 How:** Microsoft stack architecture, an optional 5-second real-footage clip, end card with the URL.

---

## 10. Engineering rules for the coding agent

1. **Numbers come from code, words from agents.** No LLM ever computes or invents a stat.
2. **Everything verifiable:** every reason and answer carries evidence IDs, and the verifier runs
   before anything is displayed.
3. **Fictional everything:** clubs, players, crests, sponsors. No real Premier League names,
   logos or game branding anywhere, including the video and repo.
4. **Tests where it counts:** the stats engine and rating model need unit tests; the verifier needs
   tests that prove it blocks bad claims (mutation-check them). Judges grade code quality.
5. **Local first, Azure behind interfaces,** so the demo never depends on a cloud hiccup until
   Sunday.
6. **Demo-driven:** the hero moment must work flawlessly; prioritize it over breadth.
7. **Don't overclaim:** in the README and pitch, report only measured numbers.
8. **Ask Hanson before** committing build time to a scope change, adding paid services, or anything
   irreversible. Proposing ideas never needs permission (see section 13).

---

## 11. Starter assets in this kit

- `prototype/index.html` + `prototype/capture.py`: a working three.js synthetic-match renderer
  from Oct 21. It has a 4-4-2 simulator with formation shifting and pressing, a scripted attack
  and goal, a broadcast camera, animated players, a ring that follows and glides between players,
  a card overlay, a sprint alert and a score bug. `capture.py` renders frames with headless
  Chromium (SwiftShader). Run `npm install three@0.160.0` next to it.
  **The card stats and "AI read" text in it are hard-coded placeholders.**
- `prototype/synthetic_match_demo.mp4`: a 12-second render of that prototype.
- `vision/vision_test.py` + `vision/vision_test.jpg`: pretrained YOLOv8s (Ultralytics, no
  training) on a frame of royalty-free indoor footage. It found 19 of about 21 players; a
  kit-color split got 10 white / 9 dark, and the keeper was misclassified. The ball is tiny and
  often missed. Ultralytics is **AGPL**, which is fine for a public repo but worth noting.

---

## 12. Open questions (ask Hanson)

- Organizers: is self-recorded or openly licensed non-Premier League footage allowed for the
  vision layer? (contact: reactor@microsoft.com or the hackathon discussion board)
- Is a teammate joining for frontend polish?
- Keep the name "Live Cards"?
- Exact submission cutoff time and time zone.

---

## 13. Creative latitude: be ambitious

Hanson wants a partner, not just an executor. This brief is a strong starting point, not a cage.

- **Pitch ideas freely,** at any time: features, better UX, sharper demo moments, smarter agent
  patterns, better uses of Microsoft Foundry and Agent Framework, Premier League angles, ways to
  beat the competition described in section 1. Bold ideas are welcome.
- **Challenge the spec.** If a requirement, formula, design choice or the demo script could be
  better, say so and propose the alternative with your reasoning.
- **Aim high on quality.** The viewer should look like a real broadcast product, the agent design
  should impress the judges, and the demo should make people say "I want this."
- **Cheap wins are yours to take.** If an improvement takes under about 30 minutes and doesn't put
  the day's exit check at risk, go ahead and tell Hanson what you did.
- **Bigger ideas need a quick pitch:** what it is, why it helps us win (tie it to a rubric line or
  prize), roughly how long it takes, and what it would replace or push back. Then let Hanson decide.
- **Guardrails don't move:** the hackathon rules (synthetic data, no trademarks, newly built,
  2-minute video), the engineering rules in section 10, and the Friday-night gate. Ambition comes
  after the core works, never instead of it.
- **End each work session** with 1–3 ideas that would most improve the entry, ranked.

---

## 14. Sources

- Hackathon home, projects and rules: https://innovationstudio.microsoft.com/hackathons/insidethegamedeveloperhackathon/home/projects
- Microsoft Reactor series, "Inside the Game: Developer Hackathon": https://developer.microsoft.com/en-us/reactor/series/s-1709/
- Reactor session, "Build AI-powered soccer insights apps with AKS and ACA" (Oct 14, 2026, on demand): https://developer.microsoft.com/en-us/reactor/events/27536/
- Microsoft Agent Framework overview: https://learn.microsoft.com/agent-framework/overview/agent-framework-overview
- Peacock Performance View (Peacock blog): https://www.peacocktv.com/blog/peacock-performance-view-experience-the-nba-like-never-before
- Sports Video Group on Performance View: https://www.sportsvideo.org/?p=293386
- Hashtag Sports Awards 2026 shortlist, Peacock Performance View: https://www.hashtagsports.com/awards/shortlist-2026/peacock-performance-view
- Full living spec (Claude doc): https://claude.ai/artifact/E1xjzX1Hqq5zYVxqZbiruU

Challenge text, prize descriptions, judging rubric and dates were copied by Hanson from the
hackathon site on Oct 21, 2026; re-check the official rules page for any updates.
