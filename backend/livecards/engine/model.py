"""Your model: an analyst's own rating and attribute weights, applied by the same engine.

A model is data, not code: weights for each rating event and for each attribute's metrics.
That keeps it safe to accept from anyone (nothing executes), easy to share as JSON, and
fully explainable, because the engine shows the same ledger and metric breakdown for it.
"""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

from livecards.engine.attributes import ATTRIBUTE_METRICS, Metric
from livecards.engine.rating import WEIGHTS

RATING_RANGE = (-3.0, 3.0)


class ModelSpec(BaseModel):
    name: str = Field(default="My model", max_length=60)
    rating_weights: dict[str, float] = Field(default_factory=dict)
    attr_weights: dict[str, dict[str, float]] = Field(default_factory=dict)

    @field_validator("rating_weights")
    @classmethod
    def _rating(cls, v: dict[str, float]) -> dict[str, float]:
        for k, w in v.items():
            if k not in WEIGHTS:
                raise ValueError(f"unknown rating event '{k}' (known: {', '.join(WEIGHTS)})")
            if not RATING_RANGE[0] <= w <= RATING_RANGE[1]:
                raise ValueError(f"weight for '{k}' must be between {RATING_RANGE[0]} and {RATING_RANGE[1]}")
        return v

    @field_validator("attr_weights")
    @classmethod
    def _attrs(cls, v: dict[str, dict[str, float]]) -> dict[str, dict[str, float]]:
        for attr, ws in v.items():
            if attr not in ATTRIBUTE_METRICS:
                raise ValueError(f"unknown attribute '{attr}'")
            known = {m.key for m in ATTRIBUTE_METRICS[attr]}
            for k, w in ws.items():
                if k not in known:
                    raise ValueError(f"'{k}' is not a metric of {attr} (known: {', '.join(sorted(known))})")
                if not 0 <= w <= 1:
                    raise ValueError(f"metric weight {attr}.{k} must be between 0 and 1")
        return v

    def weights(self) -> dict[str, float]:
        return {**WEIGHTS, **self.rating_weights}

    def metrics(self) -> dict[str, list[Metric]]:
        """Attribute metrics with this model's weights, re-normalized to sum to 1."""
        out: dict[str, list[Metric]] = {}
        for attr, metrics in ATTRIBUTE_METRICS.items():
            custom = self.attr_weights.get(attr, {})
            ws = [custom.get(m.key, m.weight) for m in metrics]
            total = sum(ws)
            if total <= 0:  # all zero: fall back to the defaults rather than divide by zero
                ws, total = [m.weight for m in metrics], 1.0
            out[attr] = [Metric(m.key, round(w / total, 4), m.kind, m.label) for m, w in zip(metrics, ws)]
        return out

    @classmethod
    def default(cls) -> ModelSpec:
        return cls(name="Live Cards default", rating_weights=dict(WEIGHTS),
                   attr_weights={a: {m.key: m.weight for m in ms} for a, ms in ATTRIBUTE_METRICS.items()})
