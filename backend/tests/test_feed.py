"""The Event Hubs wire format round-trips a whole match exactly."""

import numpy as np

from livecards.feed import _body, decode, encode


def test_encode_decode_round_trip(match):
    msgs = encode(match)
    assert msgs[0][0] == "meta" and msgs[0][1]["n_msgs"] == len(msgs)
    back = decode(list(reversed(msgs)))  # arrival order doesn't matter
    assert [e.model_dump() for e in back.events] == [e.model_dump() for e in match.events]
    assert np.allclose(back.pos, match.pos, atol=0.006)
    assert np.array_equal(back.lineup_idx, match.lineup_idx) and back.lineups == match.lineups
    assert back.score() == match.score()


def test_messages_fit_event_hubs_limits(match):
    sizes = [len(_body(k, p)) for k, p in encode(match)]
    assert max(sizes) < 256_000  # Basic tier max event size
