"""The stat registry: every stat Live Cards shows, defined once.

Each entry says what the stat means in plain words, how it's calculated, the code that computes
it, the settings a league could calibrate, how a fan reads a value ("goes in about 3 in 10"), in
five languages, and which play from the match shows it best. The Learn page, the play breakdowns
and the API all read from here, so a new stat added here (plus its function in the engine)
appears everywhere at once. `settings` are read from the engine's own constants, never copied,
so the registry can't show a different number from the one the engine uses.

To add a stat: write and test its function in the engine, add a StatDef below, run the tests
(test_registry.py checks every entry), and it's live. See docs/adding-a-stat.md.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field

from livecards.engine import metrics as mx
from livecards.engine import rating, space

VERSION = "2026.10.1"  # bump when a definition or setting changes; shown with every stat


@dataclass(frozen=True)
class StatDef:
    id: str
    name: str
    plain: str  # what it means, for a fan
    how: str  # how we calculate it
    formula: str
    compute: str  # dotted path of the engine function that computes it
    settings: dict[str, float]  # calibratable constants, read live from the engine
    meaning: dict[str, dict[str, str]]  # how a value reads, per language: {key: template}
    example: str  # which play shows it best: "max_xg" or "hero_goal"
    note: str = ""
    bands: list[float] = field(default_factory=list)  # thresholds behind the meaning keys


LANGS = ("en", "es", "fr", "pt", "ar")

REGISTRY: list[StatDef] = [
    StatDef(
        id="xg", name="Expected goals (xG)",
        plain="How likely a shot is to go in, judged only by where it was taken. An xG of 0.30 "
              "means shots like it are scored about 3 times in 10. Add up a player's or team's xG "
              "and you get how many goals their chances were worth.",
        how="Closer and more central shots score more often. Our model uses the distance to goal "
            "and the angle the goal mouth makes from the shot.",
        formula="xG = 1 / (1 + e^-(intercept + angle_weight·angle + distance_weight·distance))",
        compute="livecards.engine.metrics.xg",
        settings={"intercept": mx.XG_INTERCEPT, "angle_weight": mx.XG_ANGLE,
                  "distance_weight": mx.XG_DISTANCE, "big_chance_from": mx.BIG_CHANCE_XG},
        meaning={
            "n_in_10": {"en": "chances like this go in about {n} in 10",
                        "es": "ocasiones así acaban en gol unas {n} de cada 10",
                        "fr": "ce type d'occasion finit au fond environ {n} fois sur 10",
                        "pt": "chances assim viram gol cerca de {n} em 10 vezes",
                        "ar": "مثل هذه الفرص تُسجَّل نحو {n} مرات من 10"},
            "under_1": {"en": "fewer than 1 in 10 chances like this go in",
                        "es": "menos de 1 de cada 10 ocasiones así acaba en gol",
                        "fr": "moins d'une fois sur 10 au fond",
                        "pt": "menos de 1 em 10 chances assim vira gol",
                        "ar": "أقل من مرة من كل 10 فرص مماثلة تُسجَّل"},
        },
        example="max_xg",
        note="A deliberately simple model. Professional xG models also use the type of pass "
             "before the shot, body part, defenders in the way and more.",
    ),
    StatDef(
        id="pass_difficulty", name="Pass difficulty",
        plain="How hard a pass was, from 1 to 10. Short sideways passes are easy; long passes "
              "forward, under pressure, into the final third are hard.",
        how="Points for distance and for ground gained toward goal, plus extra for pressure, for "
            "ending in the final third, and for crosses and through balls.",
        formula="1 + min(dist_cap, distance/dist_per_point) + min(gain_cap, gain/gain_per_point)"
                " + pressure + final_third + cross_or_through",
        compute="livecards.engine.metrics.pass_difficulty",
        settings={"dist_per_point": mx.PD_DIST_PER_POINT, "dist_cap": mx.PD_DIST_CAP,
                  "gain_per_point": mx.PD_GAIN_PER_POINT, "gain_cap": mx.PD_GAIN_CAP,
                  "pressure": mx.PD_PRESSURE, "final_third": mx.PD_FINAL_THIRD,
                  "cross_or_through": mx.PD_CROSS_OR_THROUGH},
        meaning={
            "band_0": {"en": "a routine pass", "es": "un pase sencillo", "fr": "une passe simple",
                       "pt": "um passe simples", "ar": "تمريرة سهلة"},
            "band_1": {"en": "harder than most passes", "es": "más difícil que la mayoría",
                       "fr": "plus dure que la plupart", "pt": "mais difícil que a maioria",
                       "ar": "أصعب من معظم التمريرات"},
            "band_2": {"en": "a very hard pass", "es": "un pase muy difícil",
                       "fr": "une passe très difficile", "pt": "um passe muito difícil",
                       "ar": "تمريرة صعبة جدًا"},
        },
        bands=[4.5, 6.5],
        example="hero_goal",
    ),
    StatDef(
        id="space_control", name="Space control",
        plain="Which team would win a race to each part of the pitch, right now. When a run or "
              "pass grows a team's space in the final third, it has opened the defence up.",
        how="For every square of a grid, each player's arrival time: a reaction time spent "
            "carrying on at their current speed, then a straight run at top speed. The faster team "
            "wins the square, softly: a small head start is close to 50/50.",
        formula="control = 1 / (1 + e^-(t_them − t_us) / sigma)",
        compute="livecards.engine.space.control",
        settings={"reaction_s": space.REACTION_S, "max_speed_mps": space.MAX_SPEED,
                  "sigma_s": space.SIGMA_S, "cell_m": space.CELL_M},
        meaning={
            "final_third": {"en": "{team} control {m} m² of the final third",
                            "es": "{team} controla {m} m² del último tercio",
                            "fr": "{team} contrôle {m} m² du dernier tiers",
                            "pt": "{team} controla {m} m² do terço final",
                            "ar": "{team} يسيطر على {m} م² من الثلث الأخير"},
        },
        example="hero_goal",
        note="A simplified version of the pitch-control models used in professional analysis, "
             "built only from player positions and speeds.",
    ),
    StatDef(
        id="sprints", name="Sprints and high-intensity runs",
        plain="A sprint is running at sprint speed or faster for at least a second; a "
              "high-intensity run is a little slower. They show who is doing the hard running, "
              "often off the ball where the camera isn't.",
        how="Measured from tracking data: player speed, ten times a second.",
        formula="sprint ≥ sprint_kmh · high-intensity ≥ high_intensity_kmh · held ≥ 1 s",
        compute="livecards.engine.metrics.kmh",
        settings={"sprint_kmh": mx.SPRINT_KMH, "high_intensity_kmh": mx.HIGH_INTENSITY_KMH,
                  "alert_kmh": mx.ALERT_SPRINT_KMH},
        meaning={
            "threshold": {"en": "sprint speed starts at {kmh} km/h",
                          "es": "el sprint empieza en {kmh} km/h",
                          "fr": "le sprint commence à {kmh} km/h",
                          "pt": "o sprint começa em {kmh} km/h",
                          "ar": "يبدأ العدو السريع من {kmh} كم/س"},
        },
        example="hero_goal",
    ),
    StatDef(
        id="rating", name="Live rating and form",
        plain="Every player starts at 6.0 and moves with what they do: up for goals, assists, "
              "chances, tackles and passes under pressure; down for losing the ball in their own "
              "half, fouls and cards. Fans see it as form, in words.",
        how="Each event adds a fixed weight, so every change can be traced to the events behind "
            "it. Analysts can set their own weights in Analyse → Model.",
        formula="rating = 6.0 + Σ weight(event), kept between 3.0 and 10.0",
        compute="livecards.engine.rating.Rating",
        settings=dict(rating.WEIGHTS),
        meaning={
            "band_0": {"en": "Struggling", "es": "En apuros", "fr": "En difficulté",
                       "pt": "Em apuros", "ar": "في معاناة"},
            "band_1": {"en": "Quiet", "es": "Discreto", "fr": "Discret", "pt": "Discreto",
                       "ar": "هادئ"},
            "band_2": {"en": "Steady", "es": "Cumplidor", "fr": "Solide", "pt": "Regular",
                       "ar": "ثابت"},
            "band_3": {"en": "Playing well", "es": "A buen nivel", "fr": "En forme",
                       "pt": "Jogando bem", "ar": "في مستوى جيد"},
            "band_4": {"en": "On fire", "es": "Encendido", "fr": "Inarrêtable",
                       "pt": "Em chamas", "ar": "متألق"},
        },
        bands=[5.6, 6.3, 7.0, 8.0],
        example="hero_goal",
        note="The weights are our own design, not an industry standard.",
    ),
]


def by_id() -> dict[str, StatDef]:
    return {s.id: s for s in REGISTRY}


def as_json() -> dict:
    return {"version": VERSION, "stats": [asdict(s) for s in REGISTRY]}
