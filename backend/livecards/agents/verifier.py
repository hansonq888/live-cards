"""Deterministic claim verifier: the gate every line passes before it can air.

Rules (each rejection names the offending claim):
  1. Numbers: every number in the text (digits, decimals, scores like "2-1", number words
     like "sixty-five", ordinals like "65th") must equal a number in the evidence bundle.
  2. People: any rostered player named in the text must be in the bundle.
  3. Claims: superlatives and history words ("fastest", "record", "season", ...) need a
     backing flag in the facts; claims about history are always rejected (one synthetic
     match has no history to verify against).

It runs in well under a millisecond, so it sits on the live path. A model reviewer can
add judgement on top, but it can never overrule a rejection from this code.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

_UNITS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
          "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
          "eighteen", "nineteen"]
_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]
_ORDINAL_WORDS = {"first": 1, "second": 2, "third": 3, "fourth": 4, "fifth": 5, "sixth": 6,
                  "seventh": 7, "eighth": 8, "ninth": 9, "tenth": 10}
WORD_VALUES: dict[str, int] = {w: i for i, w in enumerate(_UNITS)}
WORD_VALUES.update({w: 10 * i for i, w in enumerate(_TENS) if w})
WORD_VALUES.update({"hundred": 100, "dozen": 12, "twice": 2, "brace": 2})

# Ordinal words that are normal English, not numeric claims ("second half", "first touch").
_ORDINAL_PHRASES_OK = re.compile(
    r"\b(first|second)\s+(half|halves|touch|time|ball|phase|post|wave|yellow)\b", re.I)

# word -> fact key that must be truthy for the word to be allowed
SUPERLATIVES: dict[str, str | None] = {
    "fastest": "fastest_of_match", "quickest": "fastest_of_match",
    "record": None, "season": None, "career": None, "hat-trick": None, "hattrick": None,
    "best": None, "worst": None, "most": None, "highest": None, "lowest": None,
    "never": None, "always": None, "ever": None, "unbeaten": None, "debut": None,
}

_NUM_RE = re.compile(r"(?<![\w.])(\d+(?:\.\d+)?)(?:st|nd|rd|th)?(?![\w])")
_SCORE_RE = re.compile(r"\b(\d+)\s*[-–]\s*(\d+)\b")
_WORD_NUM_RE = re.compile(
    r"\b(" + "|".join(sorted(list(WORD_VALUES) + list(_TENS[2:]), key=len, reverse=True))
    + r")(?:[\s-](" + "|".join(_UNITS[1:10]) + r"))?\b", re.I)
_ORD_RE = re.compile(r"\b(" + "|".join(_ORDINAL_WORDS) + r")\b", re.I)


@dataclass
class Bundle:
    """What a line about one moment is allowed to say."""

    numbers: set[float]
    names: set[str]  # allowed person names (full and short forms)
    flags: set[str] = field(default_factory=set)  # truthy boolean facts, e.g. fastest_of_match
    evidence: list[str] = field(default_factory=list)


@dataclass
class Verdict:
    ok: bool
    problems: list[str]
    checked: int  # number of claims checked

    def reason(self) -> str:
        return "; ".join(self.problems)


def number_variants(v: float) -> set[float]:
    """A fact may be written rounded: 33.96 can appear as 34.0 or 34."""
    v = abs(v)  # signs are words in prose ("down 0.5"), so match magnitudes
    out = {round(v, 2), round(v, 1), float(round(v))}
    if 0 < abs(v) < 1:  # 0.29 xG may be written as 29%
        out.add(round(v * 100, 1))
        out.add(float(round(v * 100)))
    return out


def build_bundle(facts: dict, names: set[str], evidence: list[str] | None = None,
                 extra_numbers: set[float] | None = None) -> Bundle:
    nums: set[float] = set()
    flags: set[str] = set()
    for k, v in facts.items():
        if isinstance(v, bool) or (isinstance(v, int) and k.startswith(("fastest", "is_"))):
            if v:
                flags.add(k)
            continue
        if isinstance(v, (int, float)):
            nums |= number_variants(float(v))
        elif isinstance(v, str):
            for m in _NUM_RE.finditer(v):
                nums |= number_variants(float(m.group(1)))
    for v in extra_numbers or set():
        nums |= number_variants(v)
    return Bundle(numbers=nums, names=set(names), flags=flags, evidence=list(evidence or []))


def extract_numbers(text: str) -> list[tuple[str, float]]:
    """All numeric claims in the text, as (surface form, value)."""
    found: list[tuple[str, float]] = []
    t = text.replace(",", "")
    for m in _SCORE_RE.finditer(t):
        found += [(m.group(0), float(m.group(1))), (m.group(0), float(m.group(2)))]
    t2 = _SCORE_RE.sub(" ", t)
    # Drop time-of-day / clock forms like 65:43 -> treat as minute 65 and second 43.
    for m in _NUM_RE.finditer(t2):
        found.append((m.group(0), float(m.group(1))))
    for m in _WORD_NUM_RE.finditer(t2):
        a = WORD_VALUES.get(m.group(1).lower(), 0)
        b = WORD_VALUES.get((m.group(2) or "").lower(), 0)
        found.append((m.group(0), float(a + b)))
    t3 = _ORDINAL_PHRASES_OK.sub(" ", t2)
    for m in _ORD_RE.finditer(t3):
        found.append((m.group(0), float(_ORDINAL_WORDS[m.group(1).lower()])))
    return found


def check(text: str, bundle: Bundle, roster_names: set[str]) -> Verdict:
    problems: list[str] = []
    checked = 0
    for surface, value in extract_numbers(text):
        checked += 1
        if value not in bundle.numbers:
            problems.append(f"number '{surface}' is not in the evidence")
    # Case-sensitive: "Fell" the full-back, not "his rating fell".
    for name in roster_names:
        if re.search(rf"\b{re.escape(name)}\b", text):
            checked += 1
            if name not in bundle.names:
                problems.append(f"player '{name}' is not part of this moment")
    low = text.lower()
    for word, flag in SUPERLATIVES.items():
        if re.search(rf"\b{re.escape(word)}\b", low):
            checked += 1
            if flag is None or flag not in bundle.flags:
                problems.append(f"claim '{word}' is not supported by the evidence")
    return Verdict(ok=not problems, problems=problems, checked=checked)
