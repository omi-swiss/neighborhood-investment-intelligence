from neighborhood_intelligence.transform import deflate


def test_deflation_uses_reference_year() -> None:
    assert deflate(100.0, 2023, 2023) == 100.0
    assert deflate(None, 2023, 2023) is None
    assert deflate(100.0, 2019, 2023) > 100.0
