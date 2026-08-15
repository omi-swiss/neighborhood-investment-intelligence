from neighborhood_intelligence.quality import Reliability, reliability_flag, validate_geoid


def test_reliability_thresholds_are_inclusive() -> None:
    assert reliability_flag(100, 10, 0.2, 0.4) is Reliability.RELIABLE
    assert reliability_flag(100, 20, 0.2, 0.4) is Reliability.CAUTION
    assert reliability_flag(100, 40, 0.2, 0.4) is Reliability.UNRELIABLE


def test_geoid_validation() -> None:
    assert validate_geoid("11001000100")
    assert not validate_geoid("1100100010")
    assert not validate_geoid("1100100010A")
