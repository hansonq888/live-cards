# Decisions log

Short records of choices that change scope or design, newest first.

## Oct 22 — adopted the five recommendations

1. **The Verifier is the star, and it's measured.** Deterministic code checks every number
   (digits, decimals, scores, number words, ordinals), every player name and every
   superlative against the evidence. It is mutation-tested: every engine template passes,
   and every one-number mutation of every template (500+ mutants per match) is blocked.
   *Next:* score it with Foundry's evaluations (`FoundryEvals`) on a red-team set, and add a
   gpt-5-mini reviewer for judgement calls that code can't make ("key", "big"). The reviewer
   can add a rejection but can never overrule one from code.
2. **Agent trace in the UI.** Every moment shows Explainer → Verifier → (rewrite) →
   Publish, with outcomes and timings. The AI-model kill switch demonstrates recovery:
   the model goes off, templates take over, and still nothing unverified airs.
3. **Predictive auto-director.** It moves the ring to the intended receiver of a cross or
   through ball while the ball is in the air, with a rationale on screen ("Cross incoming:
   Varenne arriving, xG 0.28 from there"). It is deterministic code (10 Hz): if a plain
   function can do it, it's a function.
4. **The overlay cue contract is a product.** It's published as JSON Schema at
   [overlay-cue.schema.json](overlay-cue.schema.json) and served at `/api/cue-schema`.
   *Next:* an independent "partner renderer" page that draws only from the cue stream.
5. **Cut:** second screen, Team of the Matchweek, play-by-play voice. The vision layer
   stays (organizers confirmed real footage is OK; written confirmation to be saved)
   as synthetic-render tracking with measured accuracy, plus a short self-filmed real clip.

## Oct 22 — model choices, from measurements

| Deployment | Model | Measured | Role |
|---|---|---|---|
| `explainer-mini` | gpt-4.1-mini | 0.8–2.3 s per line, 14/14 lines verified first try | Explainer, Personalizer |
| `reasoner-mini` | gpt-5-mini | 3.3–6.4 s even for "hi" | Q&A, reviewer (off the live path) |

The Students subscription allows only 5 regions (westus, northcentralus, canadacentral,
francecentral, belgiumcentral), and gpt-5.4-mini has zero quota. The project is in North
Central US.

## Oct 22 — engine calibration

- Interceptions are cut-outs in the passing lane. Other lost passes are `recovery`
  events, which don't count toward the rating.
- Pace can only rise during a match. Tiredness shows in Engine.
- Upgrades use the *net* change over the 10-minute window, to avoid flicker.
- Role baselines are measured on 8 synthetic matches (`scripts/calibrate_baselines.py`).
