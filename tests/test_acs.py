from datetime import date
from pathlib import Path

from neighborhood_intelligence.acs import CensusAcsClient, CensusApiError, persist_observations
from neighborhood_intelligence.config import Settings
from neighborhood_intelligence.db import connect, migrate


def test_tract_request_uses_two_census_in_predicates() -> None:
    client = CensusAcsClient(Settings())
    captured: dict[str, object] = {}

    def fake_get_json(url: str, params: object) -> object:
        captured["params"] = params
        return [["NAME", "state", "county", "tract"], ["example", "11", "001", "000100"]]

    client.get_json = fake_get_json  # type: ignore[method-assign]
    client.fetch_state_tracts(2023, "11")
    assert [item for item in captured["params"] if item[0] == "in"] == [("in", "state:11"), ("in", "county:*")]


def test_lineage_url_omits_census_api_key() -> None:
    client = CensusAcsClient(Settings(CENSUS_API_KEY="secret-key"))

    def fake_get_json(_url: str, _params: object) -> object:
        return [["NAME", "state", "county", "tract"], ["example", "11", "001", "000100"]]

    client.get_json = fake_get_json  # type: ignore[method-assign]

    _, request_url, _ = client.fetch_state_tracts(2023, "11")

    assert "key=" not in request_url


def test_invalid_api_key_error_does_not_include_request_url(monkeypatch) -> None:
    client = CensusAcsClient(Settings(CENSUS_API_KEY="secret-key"))

    class FakeResponse:
        is_redirect = True
        is_error = False
        status_code = 302
        headers = {"location": "https://api.census.gov/data/invalid_key.html"}

    class FakeHttpClient:
        def __enter__(self):
            return self

        def __exit__(self, *_args: object) -> None:
            return None

        def get(self, _url: str, params: object) -> FakeResponse:
            assert ("key", "secret-key") in params
            return FakeResponse()

    monkeypatch.setattr("neighborhood_intelligence.acs.httpx.Client", lambda **_kwargs: FakeHttpClient())

    try:
        client.get_json("https://api.census.gov/data/example", [("key", "secret-key")])
    except CensusApiError as error:
        assert "secret-key" not in str(error)
    else:
        raise AssertionError("Expected an invalid-key error")


def test_bulk_persist_replaces_only_matching_acs_observations(tmp_path: Path) -> None:
    conn = connect(tmp_path / "acs.duckdb")
    migrate(conn, Path("migrations/duckdb"))
    row = (
        "11001000100", 2024, "2020", "population", 100.0, 5.0, None, None,
        "All people", "B01003", "B01003_001", None, date(2020, 1, 1),
        date(2024, 12, 31), date(2026, 1, 29), "2024", "run-one",
    )
    persist_observations(conn, [row])
    replaced = (*row[:4], 125.0, *row[5:-1], "run-two")
    persist_observations(conn, [replaced])

    assert conn.execute(
        "SELECT estimate, ingestion_run_id FROM standardized.acs_observation"
    ).fetchone() == (125.0, "run-two")
    conn.close()
