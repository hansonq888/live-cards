# Live Cards

A ring follows any player, their live card updates and explains every change, and fans can ask
it anything. Every answer is verified against the match data. Built for the Microsoft x Premier
League *Inside the Game* hackathon.

> Work in progress (Oct 22–26, 2026). Everything below describes what exists in the repo today.

**All data is synthetic.** Clubs (Riverside FC, Northgate Athletic), players, the venue and
every event are invented by our simulator. No real league data, names or branding.

## Repo layout

```
backend/                  Python 3.12 (uv)
  livecards/
    contracts.py          Data contracts: frames, events, card state, moments, overlay cues
    sim/                  90-minute match simulator (10 fps tracking + events)
      roster.py           Fictional clubs and players
      storylines.py       Planted demo beats (sprint + goal, fading player, late winner, ...)
      simulator.py        Agent-based possession model
      match.py            Compact match container, save/load
    engine/               Stats engine: deterministic code only, never an LLM
      metrics.py          Pure formulas: xG, pass difficulty, thresholds
      rating.py           Live rating + auditable ledger
      attributes.py       Card attributes vs. calibrated role baselines
      engine.py           Live stats, alerts, upgrades, moments, team state
      baselines.json      Role baselines measured on 8 synthetic matches
    replay.py             Live replay stream (stand-in for the Event Hubs feed)
    cli.py                `livecards simulate | replay`
  scripts/                calibrate_baselines.py, foundry_smoke.py
  tests/                  pytest suite
web/                      React + three.js viewer (Vite); public/prototype = the Oct 21 renderer
prototype/, vision/       Original prototype and the YOLO feasibility test (kept as-is)
docs/azure-setup.md       Foundry + Agent Framework setup
```

## Quick start

```bash
cd backend
uv sync
uv run pytest -q
uv run livecards replay --seed 7 --from 64 --to 68            # hero moment, as fast as possible
uv run livecards replay --seed 7 --speed 10 --follow RIV-09    # live at 10x
```

## How the numbers are made

Numbers come from code; words come from agents. Each figure below is computed in
`backend/livecards/engine` and unit-tested.

**Live rating (0–10):** starts at 6.0, moves with each event and is capped to [3.0, 10.0].
Every change is written to a ledger with its event id.

| Event | Change | | Event | Change |
|---|---|---|---|---|
| Goal | +1.0 | | Tackle or interception won | +0.1 |
| Assist | +0.6 | | Pass completed under pressure | +0.03 |
| Chance created | +0.15 | | Turnover in own half | −0.15 |
| Shot on target | +0.1 | | Foul conceded | −0.05 |
| | | | Yellow card | −0.3 |

**Attributes (1–99):** a pre-match base, moved by live performance against a role baseline,
recomputed every minute:

`attribute = base + clamp(round(8 × Σ wᵢ·zᵢ), −20, +20)`, where `zᵢ = (valueᵢ − role meanᵢ) / role sdᵢ`

| Attribute | Metrics (weight) |
|---|---|
| Pace | top speed (0.6), sprints (0.4). Can only rise. |
| Passing | completion % (0.4), forward passes (0.3), average pass difficulty (0.3) |
| Threat | shots (0.3), chance quality xG (0.4), chances created (0.3) |
| Defending | tackles won (0.35), interceptions (0.35), pressures that won the ball (0.3) |
| Engine | distance per minute (0.6), high-intensity runs (0.4) |

Early in a match, values are shrunk toward the role mean (a 30-minute prior), so one tackle can't
swing a card. Role baselines are measured from the simulator (`scripts/calibrate_baselines.py`).

**Pass difficulty (1–10):** `1 + min(4, distance/10) + min(2, progress/15) + 1.5 if under pressure
+ 1.0 if it ends in the final third + 0.5 for a cross or through ball`.

**xG:** `logistic(−1.1 + 1.6·goal-mouth angle − 0.075·distance)`. The penalty spot is 0.29.

**Upgrades and downgrades:** fire when the rating rises (falls) 0.5+ within 10 minutes, or an
attribute moves 3+ net within 10 minutes. Each fires once per rise.

**Alerts:** sprint over 32 km/h, fastest sprint of the match, 3 successful actions in a row
(tackle won, interception, shot on target, chance created, pass of difficulty 6.5+), and
distance milestones every 2 km.

**Every moment carries evidence:** event ids, or `trk-<player>-<tenths of a second>` references
into the tracking data.
