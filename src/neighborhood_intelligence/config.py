from __future__ import annotations

import json
import os
from datetime import date
from pathlib import Path
from dotenv import dotenv_values
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
import yaml


class ReliabilityThresholds(BaseModel):
    caution_relative_moe: float = 0.20
    unreliable_relative_moe: float = 0.40


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="NII_", env_file=".env", extra="ignore")
    project_name: str = "neighborhood-investment-intelligence"
    database_path: Path = Path("data/warehouse/nii.duckdb")
    raw_dir: Path = Path("data/raw")
    published_dir: Path = Path("data/published")
    acs_years: list[int] = Field(default_factory=lambda: [2019, 2020, 2021, 2022, 2023, 2024])
    states: list[str] = Field(default_factory=list)
    opportunity_cohort_states: list[str] = Field(default_factory=list)
    opportunity_cohort_city_geoids: list[str] = Field(default_factory=list)
    reference_geography_vintage: str = "2020"
    display_geography_vintage: str = "2025"
    inflation_reference_year: int = 2024
    acs_api_base: str = "https://api.census.gov/data"
    lodes_base: str = "https://lehd.ces.census.gov/data/lodes"
    lodes_release: str = "LODES8"
    lodes_years: list[int] = Field(default_factory=lambda: [2019, 2020, 2021, 2022, 2023])
    lodes_states: list[str] = Field(default_factory=list)
    lodes_geography_vintage: str = "2020"
    employment_center_reporting_year: int = 2023
    employment_center_min_workplace_jobs: int = 5000
    qcew_api_base: str = "https://data.bls.gov/cew/data/api"
    qcew_year: int = 2025
    qcew_quarter: int = 4
    fhfa_hpi_tract_url: str = "https://www.fhfa.gov/hpi/download/annual/hpi_at_tract.csv"
    zillow_zori_zip_url: str = "https://files.zillowstatic.com/research/public_csvs/zori/Zip_zori_uc_sfrcondomfr_sm_month.csv"
    zillow_zhvi_zip_url: str = "https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv"
    zillow_zori_start_date: date = date(2019, 1, 1)
    fbi_cde_api_base: str = "https://api.usa.gov/crime/fbi/cde"
    fbi_cde_start_month: date = date(2020, 1, 1)
    bps_county_annual_url: str = "https://www2.census.gov/econ/bps/County/co{year}a.txt"
    bps_years: list[int] = Field(default_factory=lambda: [2020, 2021, 2022, 2023, 2024, 2025])
    nbi_year: int = 2025
    nbi_delimited_url: str = "https://www.fhwa.dot.gov/bridge/nbi/{year}/delimited/{state}{year_short}.txt"
    dc_building_permits_layer_url: str = "https://maps2.dcgis.dc.gov/dcgis/rest/services/FEEDS/DCRA/FeatureServer/{layer}"
    nyc_dob_job_filings_url: str = "https://data.cityofnewyork.us/resource/ic3t-wcy2.json"
    nyc_dob_now_filings_url: str = "https://data.cityofnewyork.us/resource/w9ak-ipjd.json"
    nyc_dob_permits_url: str = "https://data.cityofnewyork.us/resource/rbx6-tga4.json"
    nyc_dob_signal_start_date: date = date(2025, 1, 1)
    fema_nfhl_layer_url: str = "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28"
    epa_frs_state_url: str = "https://ordsext.epa.gov/FLA/www3/state_files/state_single_{state}.zip"
    usaspending_award_search_url: str = "https://api.usaspending.gov/api/v2/search/spending_by_award/"
    dc_property_layer_url: str = "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Property_and_Land_WebMercator/FeatureServer/{layer}"
    baltimore_property_layer_url: str = "https://geodata.baltimorecity.gov/egis/rest/services/CityView/Realproperty_OB/FeatureServer/0"
    philadelphia_property_api_url: str = "https://phl.carto.com/api/v2/sql"
    philadelphia_neighborhoods_url: str = (
        "https://raw.githubusercontent.com/opendataphilly/odp-data-storage/master/"
        "philadelphia-neighborhoods/philadelphia-neighborhoods.geojson"
    )
    nbi_states: list[str] = Field(default_factory=list)
    fbi_cde_states: list[str] = Field(default_factory=lambda: [
        "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
    ])
    tiger_base: str = "https://www2.census.gov/geo/tiger"
    request_timeout_seconds: int = 60
    reliability: ReliabilityThresholds = Field(default_factory=ReliabilityThresholds)
    census_api_key: str | None = Field(default=None, validation_alias="CENSUS_API_KEY")
    fbi_cde_api_key: str | None = Field(default=None, validation_alias="FBI_CDE_API_KEY")


def load_settings(path: Path = Path("config/default.yaml")) -> Settings:
    with path.open(encoding="utf-8") as stream:
        values = yaml.safe_load(stream)
    environment = {**dotenv_values(".env"), **os.environ}
    for name, field in Settings.model_fields.items():
        env_name = "CENSUS_API_KEY" if name == "census_api_key" else f"NII_{name.upper()}"
        value = environment.get(env_name)
        if value is None:
            continue
        if value.startswith(("[", "{")):
            value = json.loads(value)
        input_name = env_name if field.validation_alias else name
        values[input_name] = value
    return Settings.model_validate(values)
