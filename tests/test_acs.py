from neighborhood_intelligence.acs import CensusAcsClient, CensusApiError
from neighborhood_intelligence.config import Settings


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
