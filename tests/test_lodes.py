from gzip import compress
from pathlib import Path

from neighborhood_intelligence.config import Settings
from neighborhood_intelligence.lodes import (
    LodesAsset,
    LodesClient,
    aggregate_block_observations,
    aggregate_tract_flows,
    persist_lodes_asset,
)


def test_lodes_urls_follow_the_documented_lodes8_file_layout() -> None:
    client = LodesClient(Settings())
    urls = client.data_urls("dc", 2023)

    assert urls["rac"].endswith("/dc/rac/dc_rac_S000_JT00_2023.csv.gz")
    assert urls["wac"].endswith("/dc/wac/dc_wac_S000_JT00_2023.csv.gz")
    assert urls["od_main"].endswith("/dc/od/dc_od_main_JT00_2023.csv.gz")
    assert urls["od_aux"].endswith("/dc/od/dc_od_aux_JT00_2023.csv.gz")


def test_lodes_aggregates_block_values_to_tracts_and_flows(tmp_path: Path) -> None:
    rac = tmp_path / "rac.csv.gz"
    rac.write_bytes(compress(b"h_geocode,C000\n110010001001000,3\n110010001002000,4\n110010002001000,2\n"))
    od = tmp_path / "od.csv.gz"
    od.write_bytes(compress(b"w_geocode,h_geocode,S000\n110010001001000,110010002001000,3\n110010001002000,110010002001000,4\n"))

    assert aggregate_block_observations(rac, "h_geocode") == [("11001000100", 7.0), ("11001000200", 2.0)]
    assert aggregate_tract_flows(od) == [("11001000100", "11001000200", 7.0)]


def test_lodes_raw_asset_is_checksum_addressed(tmp_path: Path) -> None:
    asset = LodesAsset("rac", "https://example.test/rac.csv.gz", b"content")

    path, digest = persist_lodes_asset(tmp_path, "LODES8", "dc", 2023, asset)

    assert path.exists()
    assert digest in path.name
