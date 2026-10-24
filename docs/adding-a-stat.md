# Adding or calibrating a stat

Every stat Live Cards shows is defined once, in
[`backend/livecards/engine/registry.py`](../backend/livecards/engine/registry.py). The Learn
page, the play breakdowns, the form labels and `/api/stats` all read from it.

## Add a stat

1. **Write the function** in the engine (for example `metrics.py`) and unit-test it. Numbers
   only ever come from code.
2. **Add a `StatDef`** to `REGISTRY`:
   - `plain`, `how`, `formula`, `note`: the words on the Learn page
   - `compute`: the dotted path to your function
   - `settings`: the constants a league may calibrate, read from the engine's own constants
     (never copied), so the page always shows what the engine uses
   - `meaning`: how a fan reads a value, in all five languages, with the same `{placeholders}`
   - `bands`: thresholds, if the meaning changes by range (for example "routine / hard / very hard")
   - `example`: which play from the match shows it best
3. **Run the tests.** `tests/test_registry.py` checks every entry:
   - the function exists
   - every language has the same placeholders
   - the bands match their wordings
   - the settings reproduce the engine's numbers
   - the example is a real play
4. **That's it.** The stat appears on the Learn page with its example and settings, and
   breakdowns can use its wording.

To let the AI agents explain the stat, add its value to the facts in
`agents/explainer.py::job_for`. The verifier then allows exactly that number in a line, and
blocks any other.

## Calibrate a stat

Settings are named constants in the engine (for example `XG_INTERCEPT`, `SPRINT_KMH`,
`space.REACTION_S`). Changing one changes the engine, the registry and the Learn page together.
Bump `registry.VERSION` so every screen and the API show which definitions are in force.

Rating weights can also be changed without code. In **Analyse → Model**, an analyst sets their
own weights (validated data, never code). A second engine replays the match with them, and the
card compares both, line by line.
