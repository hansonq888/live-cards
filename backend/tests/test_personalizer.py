"""Personalizer fan-out: every variant re-verified in its own language."""

import asyncio

from livecards.agents.personalizer import PersonalizeRequest, Profile, personalize
from tests.test_pipeline import ROSTER, FakeModel, make_job

BASE = "Varenne's goal lifts him from 7.2 to 8.7."


class ByLanguage:
    """Fake model that answers per requested language (calls arrive in parallel)."""

    def __init__(self, replies: dict[str, list[str]]):
        self.replies = replies

    async def run(self, prompt, **_):
        lang = prompt.split("Language: ")[1].split(".")[0]
        queue = self.replies.get(lang, [])
        return type("R", (), {"text": queue.pop(0) if queue else ""})()


def run(model, profiles):
    trace = []
    req = PersonalizeRequest(make_job(), BASE, "Riverside FC", "Northgate Athletic")
    return asyncio.run(personalize(req, profiles, model, ROSTER, trace.append)), trace


def test_parallel_variants_are_verified():
    model = ByLanguage({"Spanish": ["Gol de Varenne: su nota sube de 7,2 a 8,7."],
                        "Arabic": ["هدف Varenne يرفع تقييمه إلى ٨٫٧"],
                        "English": ["Varenne: rating 7.2 to 8.7 after the goal."]})
    out, trace = run(model, [Profile("casual", "es", "home"), Profile("casual", "ar"),
                             Profile("analyst", "en")])
    assert {v.key for v in out} == {"casual.es.home", "casual.ar.neutral", "analyst.en.neutral"}
    assert all(v.source == "model" for v in out)


def test_mistranslated_number_is_rewritten_then_falls_back():
    model = ByLanguage({"Spanish": ["Varenne sube a 9,7.", "Varenne sube a 8,7 tras el gol."],
                        "French": ["Varenne grimpe à 9,1.", "Varenne, le plus rapide, à 8,7."]})
    out, trace = run(model, [Profile("casual", "es"), Profile("casual", "fr", "away")])
    es = next(v for v in out if v.key == "casual.es.neutral")
    fr = next(v for v in out if v.key == "casual.fr.away")
    assert es.source == "model" and es.attempts == 2
    assert fr.source == "fallback" and fr.text == BASE  # never airs the unverified French
    assert any("plus rapide" in p for p in fr.problems)


def test_model_failure_falls_back_to_verified_english():
    out, _ = run(FakeModel(RuntimeError("down")), [Profile("casual", "pt")])
    assert out[0].source == "fallback" and out[0].text == BASE


def test_default_profile_needs_no_call():
    out, _ = run(None, [Profile()])
    assert out == []
