import numpy as np

from livevision import Detection, homography, kit_team, to_pitch


def test_homography_round_trips_pitch_points():
    metres = [(-52.5, -34.0), (52.5, -34.0), (52.5, 34.0), (-52.5, 34.0), (0.0, 0.0)]
    # A tilted broadcast-like view: far side squeezed, near side wide.
    pixels = [(-400, 700), (1680, 700), (1100, 120), (180, 120), (640, 330)]
    H = homography(pixels[:4], metres[:4])
    x, y = to_pitch(H, pixels[2])
    assert abs(x - 52.5) < 1e-3 and abs(y - 34.0) < 1e-3


def _player(bgr: tuple[int, int, int]) -> tuple[np.ndarray, Detection]:
    img = np.zeros((100, 100, 3), np.uint8)
    img[:] = (40, 140, 40)  # grass
    img[20:80, 40:60] = bgr  # shirt
    return img, Detection((40, 20, 60, 80), 0.9, "person")


def test_kit_colour_splits_teams():
    assert kit_team(*_player((46, 16, 200))) == "RIV"  # red shirt (BGR)
    assert kit_team(*_player((216, 78, 29))) == "NGT"  # blue shirt
    assert kit_team(*_player((24, 197, 245))) == "GK"  # yellow keeper


def test_grass_only_box_has_no_team():
    img, d = _player((40, 140, 40))
    assert kit_team(img, d) is None
