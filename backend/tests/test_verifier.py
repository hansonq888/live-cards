"""The verifier must block every unsupported claim. Mutation-checked against real moments."""

import re

import pytest

from livecards.agents.explainer import job_for
from livecards.agents.verifier import build_bundle, check, extract_numbers
from livecards.engine.engine import MatchEngine
from livecards.replay import feed, ticks

ROSTER = {"Luca Varenne", "Varenne", "Tayo Okelani", "Okelani", "Aaron Fell", "Fell",
          "Viktor Halden", "Halden"}
FACTS = {"minute": 65, "speed_kmh": 104.0, "xg": 0.16, "distance_m": 16.6, "score_home": 1,
         "score_away": 1, "from": 7.2, "to": 8.7, "assist": "Tayo Okelani"}
NAMES = {"Luca Varenne", "Varenne", "Tayo Okelani", "Okelani"}
GOOD = "Varenne finishes Okelani's cross at 104 km/h; his rating climbs from 7.2 to 8.7."


def verdict(text, facts=FACTS, names=NAMES):
    return check(text, build_bundle(facts, names), ROSTER)


def test_accurate_line_passes():
    v = verdict(GOOD)
    assert v.ok, v.problems
    assert v.checked >= 5


def test_rounding_and_percent_are_accepted():
    assert verdict("A 16% chance, struck at 104 km/h from 17 m.").ok


@pytest.mark.parametrize("bad,claim", [
    ("Varenne finishes at 105 km/h.", "105"),
    ("His rating climbs from 7.2 to 8.9.", "8.9"),
    ("Varenne scores in the sixty-sixth minute.", "sixty"),
    ("Varenne scores at minute sixty-six.", "sixty-six"),
    ("RIV lead 2-1 after Varenne's strike.", "2-1"),
    ("Varenne's 3rd goal of the game.", "3rd"),
    ("Varenne completes a brace.", "brace"),
    ("Halden sets up Varenne at 104 km/h.", "Halden"),
    ("The fastest strike of the match from Varenne.", "fastest"),
    ("Varenne's best goal this season.", "best"),
    ("A career-high rating of 8.7 for Varenne.", "career"),
])
def test_unsupported_claims_are_blocked(bad, claim):
    v = verdict(bad)
    assert not v.ok
    assert any(claim.split("-")[0] in p for p in v.problems), v.problems


def test_fastest_allowed_when_the_fact_backs_it():
    facts = {"speed_kmh": 34.0, "fastest_of_match": 1}
    assert verdict("Okelani hits 34.0 km/h, the fastest sprint of the match.", facts).ok
    assert not verdict("Okelani hits 34.0 km/h, the fastest sprint of the match.",
                       {"speed_kmh": 34.0, "fastest_of_match": 0}).ok


def test_names_are_case_sensitive():
    # "fell" the verb is not Fell the right back.
    assert verdict("Varenne's rating fell to 7.2 before this.").ok
    assert not verdict("Fell finds Varenne at 104 km/h.").ok


def test_number_extraction_forms():
    vals = [v for _, v in extract_numbers("sixty-five, 7.2, 1-1, 3rd, twenty one, third")]
    assert vals == [1, 1, 7.2, 3, 65, 21, 3]


@pytest.fixture(scope="module")
def all_jobs(match):
    engine = MatchEngine(match.meta)
    jobs = []
    for tick in ticks(match):
        for m in feed(engine, match, tick):
            jobs.append(job_for(m, engine))
    return jobs, {n for p in match.meta.players for n in (p.name, p.short)}


def test_every_engine_template_passes(all_jobs):
    jobs, roster = all_jobs
    failures = [(j.template, check(j.template, j.bundle(), roster).problems) for j in jobs
                if not check(j.template, j.bundle(), roster).ok]
    assert not failures, failures[:5]


def test_mutated_templates_are_all_blocked(all_jobs):
    """Mutation check: change any one number in any real template and it must be blocked."""
    jobs, roster = all_jobs
    mutants = blocked = 0
    for job in jobs:
        bundle = job.bundle()
        for m in re.finditer(r"\d+(?:\.\d+)?", job.template):
            value = float(m.group(0))
            for new in (value + 7, value * 3 + 11):
                txt = f"{new:.1f}" if "." in m.group(0) else str(int(new))
                if float(txt) in bundle.numbers:
                    continue  # the mutant happens to equal another real fact
                mutant = job.template[:m.start()] + txt + job.template[m.end():]
                mutants += 1
                blocked += not check(mutant, bundle, roster).ok
    assert mutants > 500
    assert blocked == mutants
