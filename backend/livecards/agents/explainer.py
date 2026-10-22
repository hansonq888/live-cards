"""Explainer: writes the one-line reason for a moment, from facts only.

The model only writes words. Every number it may use is handed to it in `facts`,
and the verifier checks the result before anything airs.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field

from livecards.agents.verifier import Bundle, build_bundle
from livecards.contracts import Moment
from livecards.engine.engine import MatchEngine

INSTRUCTIONS = """You write the on-screen reason for a live football player-card change.
Rules:
- ONE sentence, at most 16 words, present tense, broadcast tone.
- Use only the facts given. Every number you write must appear in the facts exactly.
  Prefer digits. You may leave numbers out entirely.
- Only name people listed in the facts.
- No superlatives (fastest, best, record...) unless a fact says so. No claims about
  seasons, careers or history.
- No hashtags, emojis or quotation marks."""

AUDIENCE = {
    "casual": "Write for a casual fan: plain words, the story of the moment.",
    "analyst": "Write for an analyst: precise, cite the key metric.",
}


@dataclass
class ExplainJob:
    moment: Moment
    facts: dict  # everything the line may use
    names: set[str]
    template: str
    audience: str = "casual"
    feedback: str | None = None
    meta: dict = field(default_factory=dict)

    def bundle(self) -> Bundle:
        return build_bundle(self.facts, self.names, self.moment.evidence)

    def prompt(self) -> str:
        parts = [AUDIENCE[self.audience],
                 f"Moment type: {self.moment.type.replace('_', ' ')}",
                 f"Facts: {json.dumps(self.facts, ensure_ascii=False)}",
                 f"Reference wording (rewrite it, keep it accurate): {self.template}"]
        if self.feedback:
            parts.append(f"Your previous line was rejected by the fact checker: {self.feedback}. "
                         "Fix exactly that.")
        return "\n".join(parts)


def job_for(moment: Moment, engine: MatchEngine) -> ExplainJob:
    """Collect the facts and names a line about this moment may use."""
    facts: dict = {"minute": moment.minute, **moment.facts}
    names: set[str] = set()
    score = engine.score
    facts["score"] = f"{engine.home} {score[engine.home]}-{score[engine.away]} {engine.away}"
    if moment.player:
        p = engine.players[moment.player].meta
        names |= {p.name, p.short}
        facts["player"] = p.name
        facts["position"] = p.position
        card = engine.card(moment.player)
        facts["rating_now"] = card.rating
        s = engine.players[moment.player].stats
        facts.update(goals=s.goals, shots=s.shots, passes_completed=s.passes_completed,
                     distance_km=round(s.distance_m / 1000, 1),
                     top_speed_kmh=round(s.top_speed_kmh, 1))
    for key in ("assist", "off", "on"):
        if isinstance(moment.facts.get(key), str):
            full = moment.facts[key]
            names.add(full)
            names.add(full.split()[-1])
    if moment.team:
        facts["team"] = engine.meta.team(moment.team).name
    return ExplainJob(moment=moment, facts=facts, names=names, template=moment.template)
