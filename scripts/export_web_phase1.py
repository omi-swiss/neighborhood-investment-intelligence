"""Publish the supported city-level opportunity-screening slice from the warehouse."""

from __future__ import annotations

import argparse
import json
import math
import os
from pathlib import Path
from typing import Any

import duckdb
import pandas as pd
from shapely import from_wkt
from shapely.geometry import mapping

DEFAULT_DATABASE = Path(os.environ.get("NII_DATABASE_PATH", "data/warehouse/nii.duckdb"))
DEFAULT_OUTPUT = Path("web/app/data/areas.generated.json")
# The analytical cohort is ACS 2020--2024 on 2020 Census tract geography.
# Do not add pre-2020 ACS rows here without an approved geography crosswalk.
SCORE_YEAR = 2024
TREND_START_YEAR = 2020
SUPPORTED_MARKETS = [
    {
        "id": "place:1150000",
        "city_geoid": "1150000",
        "city": "Washington",
        "state": "District of Columbia",
        "state_abbr": "DC",
        "metro_geoid": "47900",
        "metro": "Washington-Arlington-Alexandria, DC-VA-MD-WV",
    },
    {
        "id": "place:2404000",
        "city_geoid": "2404000",
        "city": "Baltimore",
        "state": "Maryland",
        "state_abbr": "MD",
        "metro_geoid": "12580",
        "metro": "Baltimore-Columbia-Towson, MD",
    },
    {
        "id": "place:4260000",
        "city_geoid": "4260000",
        "city": "Philadelphia",
        "state": "Pennsylvania",
        "state_abbr": "PA",
        "metro_geoid": "37980",
        "metro": "Philadelphia-Camden-Wilmington, PA-NJ-DE-MD",
    },
    {
        "id": "place:2622000",
        "city_geoid": "2622000",
        "city": "Detroit",
        "state": "Michigan",
        "state_abbr": "MI",
        "metro_geoid": "19820",
        "metro": "Detroit-Warren-Dearborn, MI",
    },
    {
        "id": "place:3712000",
        "city_geoid": "3712000",
        "city": "Charlotte",
        "state": "North Carolina",
        "state_abbr": "NC",
        "metro_geoid": "16740",
        "metro": "Charlotte-Concord-Gastonia, NC-SC",
    },
    {
        "id": "place:4513330",
        "city_geoid": "4513330",
        "city": "Charleston",
        "state": "South Carolina",
        "state_abbr": "SC",
        "metro_geoid": "16700",
        "metro": "Charleston-North Charleston, SC",
    },
    {
        "id": "place:2507000",
        "city_geoid": "2507000",
        "city": "Boston",
        "state": "Massachusetts",
        "state_abbr": "MA",
        "metro_geoid": "14460",
        "metro": "Boston-Cambridge-Newton, MA-NH",
    },
    {
        "id": "place:1271000",
        "city_geoid": "1271000",
        "city": "Tampa",
        "state": "Florida",
        "state_abbr": "FL",
        "metro_geoid": "45300",
        "metro": "Tampa-St. Petersburg-Clearwater, FL",
    },
    {
        "id": "place:1714000",
        "city_geoid": "1714000",
        "city": "Chicago",
        "state": "Illinois",
        "state_abbr": "IL",
        "metro_geoid": "16980",
        "metro": "Chicago-Naperville-Elgin, IL-IN-WI",
    },
]
STATE_CONTEXT = {
    "10": ("Delaware", "DE"),
    "11": ("District of Columbia", "DC"),
    "24": ("Maryland", "MD"),
    "34": ("New Jersey", "NJ"),
    "42": ("Pennsylvania", "PA"),
    "51": ("Virginia", "VA"),
    "54": ("West Virginia", "WV"),
    "12": ("Florida", "FL"),
    "17": ("Illinois", "IL"),
    "25": ("Massachusetts", "MA"),
    "26": ("Michigan", "MI"),
    "37": ("North Carolina", "NC"),
    "45": ("South Carolina", "SC"),
}


def _number(value: Any, digits: int = 4) -> float | None:
    if value is None or pd.isna(value):
        return None
    result = float(value)
    if not math.isfinite(result):
        return None
    return round(result, digits)


def _percentile(series: pd.Series, favorable: str = "higher") -> pd.Series:
    ranked = series.rank(method="average", pct=True) * 100
    return 100 - ranked if favorable == "lower" else ranked


def _score_frame(rows: pd.DataFrame) -> pd.DataFrame:
    rows = rows.copy()
    rows["population_growth"] = (
        rows["population_end"] / rows["population_start"]
    ) ** (1 / (SCORE_YEAR - TREND_START_YEAR)) - 1
    rows["income_growth"] = (
        rows["income_end"] / rows["income_start"]
    ) ** (1 / (SCORE_YEAR - TREND_START_YEAR)) - 1
    rows["gross_yield_proxy"] = (
        rows["median_gross_rent_real"] * 12 / rows["median_home_value_real"]
    )
    rows["demographic_score"] = _percentile(rows["population_growth"])
    rows["income_score"] = _percentile(rows["income_growth"])
    rows["rental_score"] = (
        _percentile(rows["gross_yield_proxy"]) * 0.45
        + _percentile(rows["renter_share"]) * 0.25
        + _percentile(rows["vacancy_rate"], "lower") * 0.30
    )
    rows["housing_score"] = (
        _percentile(rows["vacancy_rate"], "lower") * 0.55
        + _percentile(rows["occupied_housing_units"]) * 0.45
    )
    rows["risk_score"] = (
        _percentile(rows["poverty_rate"], "lower") * 0.50
        + _percentile(rows["unemployment_rate"], "lower") * 0.50
    )
    rows["reliability_score"] = rows["metric_coverage"] * 100
    rows["opportunity_score"] = (
        rows["demographic_score"] * 0.15
        + rows["income_score"] * 0.20
        + rows["rental_score"] * 0.25
        + rows["housing_score"] * 0.15
        + rows["risk_score"] * 0.15
        + rows["reliability_score"] * 0.10
    )
    return rows


def _benchmark(name: str, rows: pd.DataFrame) -> dict[str, Any]:
    return {
        "name": name,
        "areaCount": len(rows),
        "medianHouseholdIncome": _number(rows["median_household_income_real"].median(), 0),
        "medianHomeValue": _number(rows["median_home_value_real"].median(), 0),
        "medianGrossRent": _number(rows["median_gross_rent_real"].median(), 0),
        "vacancyRate": _number(rows["vacancy_rate"].median()),
        "renterShare": _number(rows["renter_share"].median()),
    }


def export(database: Path, output: Path) -> dict[str, Any]:
    connection = duckdb.connect(str(database), read_only=True)
    city_geoids = [market["city_geoid"] for market in SUPPORTED_MARKETS]
    rows = connection.execute(
        f"""
        WITH profile AS (
          SELECT *
          FROM analytics.tract_year_profile
          WHERE city_geoid IN (SELECT unnest(?))
            AND reporting_year = ?
        ),
        endpoints AS (
          SELECT
            tract_geoid,
            max(CASE WHEN reporting_year = {TREND_START_YEAR} THEN population END)
              AS population_start,
            max(CASE WHEN reporting_year = {SCORE_YEAR} THEN population END)
              AS population_end,
            max(CASE WHEN reporting_year = {TREND_START_YEAR}
              THEN median_household_income_real END) AS income_start,
            max(CASE WHEN reporting_year = {SCORE_YEAR}
              THEN median_household_income_real END) AS income_end
          FROM analytics.tract_year_profile
          WHERE reporting_year IN ({TREND_START_YEAR}, {SCORE_YEAR})
          GROUP BY tract_geoid
        ),
        county_names AS (
          SELECT county_geoid, county_name
          FROM standardized.census_bps_county_annual_observation
          QUALIFY row_number() OVER (
            PARTITION BY county_geoid ORDER BY reporting_year DESC
          ) = 1
        )
        SELECT
          profile.*,
          endpoints.population_start,
          endpoints.population_end,
          endpoints.income_start,
          endpoints.income_end,
          geography.geometry_wkt,
          geography.centroid_lon AS longitude,
          geography.centroid_lat AS latitude,
          coalesce(county_names.county_name, 'County ' || substr(profile.tract_geoid, 1, 5))
            AS county_name
        FROM profile
        JOIN endpoints USING (tract_geoid)
        JOIN standardized.geography AS geography
          ON geography.geography_id =
            'tract:' || profile.tract_geoid || ':' || profile.geography_vintage
        LEFT JOIN county_names
          ON county_names.county_geoid = substr(profile.tract_geoid, 1, 5)
        WHERE endpoints.population_start > 0
          AND endpoints.population_end > 0
          AND endpoints.income_start > 0
          AND endpoints.income_end > 0
          AND geography.geometry_wkt IS NOT NULL
        ORDER BY profile.tract_geoid
        """,
        [city_geoids, SCORE_YEAR],
    ).fetchdf()
    if rows.empty:
        raise RuntimeError("No comparable supported-market tract rows are available")
    available_city_geoids = {str(city_geoid) for city_geoid in rows["city_geoid"].unique()}
    missing_markets = [
        market["city"]
        for market in SUPPORTED_MARKETS
        if market["city_geoid"] not in available_city_geoids
    ]
    if missing_markets:
        raise RuntimeError(
            "Refusing to publish a partial comparable cohort; missing supported markets: "
            + ", ".join(missing_markets)
        )
    coverage_rows = connection.execute(
        """
        SELECT city_geoid, reporting_year
        FROM analytics.tract_year_profile
        WHERE city_geoid IN (SELECT unnest(?))
          AND reporting_year BETWEEN ? AND ?
        GROUP BY city_geoid, reporting_year
        """,
        [city_geoids, TREND_START_YEAR, SCORE_YEAR],
    ).fetchall()
    covered_units = {(str(city_geoid), int(year)) for city_geoid, year in coverage_rows}
    missing_units = [
        f"{market['city']} {year}"
        for market in SUPPORTED_MARKETS
        for year in range(TREND_START_YEAR, SCORE_YEAR + 1)
        if (market["city_geoid"], year) not in covered_units
    ]
    if missing_units:
        raise RuntimeError(
            "Refusing to publish without complete ACS cohort coverage: "
            + ", ".join(missing_units)
        )
    rows = _score_frame(rows)

    tract_ids = rows["tract_geoid"].tolist()
    trend_rows = connection.execute(
        """
        SELECT
          tract_geoid,
          reporting_year,
          population,
          median_household_income_real,
          median_gross_rent_real,
          median_home_value_real,
          vacancy_rate,
          comparability_warning
        FROM analytics.tract_year_trend
        WHERE tract_geoid IN (SELECT unnest(?))
          AND reporting_year BETWEEN ? AND ?
        ORDER BY tract_geoid, reporting_year
        """,
        [tract_ids, TREND_START_YEAR, SCORE_YEAR],
    ).fetchdf()
    trends_by_tract: dict[str, list[dict[str, Any]]] = {}
    for record in trend_rows.to_dict("records"):
        trends_by_tract.setdefault(record["tract_geoid"], []).append(
            {
                "year": int(record["reporting_year"]),
                "population": _number(record["population"], 0),
                "income": _number(record["median_household_income_real"], 0),
                "rent": _number(record["median_gross_rent_real"], 0),
                "homeValue": _number(record["median_home_value_real"], 0),
                "vacancyRate": _number(record["vacancy_rate"]),
                "warning": record["comparability_warning"],
            }
        )

    has_property_sales = connection.execute(
        """
        SELECT count(*)
        FROM information_schema.tables
        WHERE table_schema = 'analytics'
          AND table_name = 'property_recent_recorded_sale'
        """
    ).fetchone()[0]
    if has_property_sales:
        neighborhood_rows = connection.execute(
            """
            SELECT
              tract_geoid,
              neighborhood,
              count(*) AS observation_count,
              row_number() OVER (
                PARTITION BY tract_geoid
                ORDER BY count(*) DESC, neighborhood
              ) AS rank
            FROM analytics.property_recent_recorded_sale
            WHERE tract_geoid IN (SELECT unnest(?))
              AND neighborhood IS NOT NULL
              AND trim(neighborhood) <> ''
            GROUP BY tract_geoid, neighborhood
            QUALIFY rank = 1
            """,
            [tract_ids],
        ).fetchdf()
    else:
        neighborhood_rows = pd.DataFrame(
            columns=["tract_geoid", "neighborhood", "observation_count"]
        )
    neighborhoods_by_tract = {
        record["tract_geoid"]: {
            "name": " ".join(str(record["neighborhood"]).split()),
            "observationCount": int(record["observation_count"]),
        }
        for record in neighborhood_rows.to_dict("records")
    }

    supported_metros = [market["metro"] for market in SUPPORTED_MARKETS]
    metro_rows = connection.execute(
        """
        SELECT *
        FROM analytics.tract_year_profile
        WHERE reporting_year = ? AND metro IN (SELECT unnest(?))
        """,
        [SCORE_YEAR, supported_metros],
    ).fetchdf()

    city_benchmarks = {
        city: _benchmark(city, cohort)
        for city, cohort in rows.groupby("city", dropna=True)
    }
    metro_benchmarks = {
        metro: _benchmark(metro, cohort)
        for metro, cohort in metro_rows.groupby("metro", dropna=True)
    }

    areas = []
    for record in rows.to_dict("records"):
        state_name, state_abbr = STATE_CONTEXT.get(
            str(record["tract_geoid"])[:2],
            ("State unavailable", ""),
        )
        county_name = " ".join(str(record["county_name"]).split())
        geometry = from_wkt(record["geometry_wkt"])
        geometry = geometry.simplify(0.00035, preserve_topology=True)
        scores = {
            "demographicMomentum": _number(record["demographic_score"], 1),
            "incomeMomentum": _number(record["income_score"], 1),
            "rentalStrength": _number(record["rental_score"], 1),
            "housingDemand": _number(record["housing_score"], 1),
            "riskResilience": _number(record["risk_score"], 1),
            "dataReliability": _number(record["reliability_score"], 1),
        }
        tract_label = (
            f"Census Tract {record['tract_geoid'][-6:-2]}."
            f"{record['tract_geoid'][-2:]}"
        )
        neighborhood = neighborhoods_by_tract.get(record["tract_geoid"])
        display_name = neighborhood["name"] if neighborhood else tract_label
        market_id = f"place:{record['city_geoid']}"
        areas.append(
            {
                "id": record["tract_geoid"],
                "marketId": market_id,
                "name": display_name,
                "tractLabel": tract_label,
                "neighborhood": neighborhood["name"] if neighborhood else None,
                "nameSource": (
                    "public-record neighborhood aggregation"
                    if neighborhood
                    else "Census tract fallback"
                ),
                "nameConfidence": "medium" if neighborhood else "low",
                "nameObservationCount": (
                    neighborhood["observationCount"] if neighborhood else 0
                ),
                "county": county_name,
                "state": state_name,
                "stateAbbr": state_abbr,
                "city": record["city"],
                "metro": record["metro"],
                "latitude": _number(record["latitude"], 6),
                "longitude": _number(record["longitude"], 6),
                "geometry": mapping(geometry),
                "score": _number(record["opportunity_score"], 1),
                "scores": scores,
                "metrics": {
                    "population": _number(record["population"], 0),
                    "householdCount": _number(record["household_count"], 0),
                    "medianAge": _number(record["median_age"], 1),
                    "populationGrowth": _number(record["population_growth"]),
                    "medianHouseholdIncome": _number(
                        record["median_household_income_real"], 0
                    ),
                    "incomeGrowth": _number(record["income_growth"]),
                    "medianGrossRent": _number(record["median_gross_rent_real"], 0),
                    "medianHomeValue": _number(record["median_home_value_real"], 0),
                    "grossYieldProxy": _number(record["gross_yield_proxy"]),
                    "vacancyRate": _number(record["vacancy_rate"]),
                    "renterShare": _number(record["renter_share"]),
                    "unemploymentRate": _number(record["unemployment_rate"]),
                    "povertyRate": _number(record["poverty_rate"]),
                    "metricCoverage": _number(record["metric_coverage"]),
                },
                "quality": {
                    "status": str(record["data_completeness"]).lower(),
                    "populationReliability": str(record["population_reliability"]).lower(),
                    "incomeReliability": str(record["income_reliability"]).lower(),
                    "warning": "ACS five-year windows overlap; trend periods are not independent.",
                },
                "trends": trends_by_tract.get(record["tract_geoid"], []),
            }
        )

    markets = []
    counts_by_city_geoid = rows.groupby("city_geoid").size().to_dict()
    for market in SUPPORTED_MARKETS:
        city_count = int(counts_by_city_geoid.get(market["city_geoid"], 0))
        markets.append(
            {
                "id": market["id"],
                "cityGeoid": market["city_geoid"],
                "city": market["city"],
                "state": market["state"],
                "stateAbbr": market["state_abbr"],
                "metroGeoid": market["metro_geoid"],
                "metro": market["metro"],
                "label": f"{market['city']}, {market['state_abbr']} (city proper)",
                "geographyType": "place",
                "enabled": city_count > 0,
                "areaCount": city_count,
                "coverageStatus": "integrated" if city_count > 0 else "unavailable",
            }
        )
        markets.append(
            {
                "id": f"metro:{market['metro_geoid']}",
                "cityGeoid": market["city_geoid"],
                "city": market["city"],
                "state": market["state"],
                "stateAbbr": market["state_abbr"],
                "metroGeoid": market["metro_geoid"],
                "metro": market["metro"],
                "label": f"{market['metro']} (metro)",
                "geographyType": "metro",
                "enabled": False,
                "areaCount": 0,
                "coverageStatus": "planned",
            }
        )

    payload = {
        "generatedAt": pd.Timestamp.utcnow().isoformat(),
        "coverage": {
            "label": "Nine-city opportunity-screening cohort",
            "city": "Nine supported city-proper markets",
            "metro": "Metro definitions shown separately and marked planned",
            "geographicLevel": "census tract",
            "scoreReferenceYear": SCORE_YEAR,
            "trendStartYear": TREND_START_YEAR,
            "geographyVintage": str(rows["geography_vintage"].mode().iloc[0]),
            "areaCount": len(areas),
        },
        "methodology": {
            "scoreVersion": "nine-city-2.0",
            "source": "U.S. Census Bureau ACS 5-year",
            "sourceUrl": "https://www.census.gov/programs-surveys/acs",
            "availableAt": "2026-01-29",
            "observationType": "observed and derived",
            "limitations": [
                "Scores rank comparable tracts across the nine supported city-proper markets.",
                "Growth uses overlapping ACS 2020 and 2024 five-year windows on 2020 Census tract geography.",
                "Gross yield is a screening proxy based on area median rent and value, not property NOI.",
                "Official neighborhood labels are partial. A tract label is shown when no verified neighborhood source is available.",
                "Permits, flood, regulation, property, and signal coverage varies by market and stays explicitly unavailable where absent.",
            ],
        },
        "markets": markets,
        "benchmarks": {
            "city": _benchmark("Supported nine-city cohort", rows),
            "metro": _benchmark("Supported nine-metro context cohort", metro_rows),
            "byCity": city_benchmarks,
            "byMetro": metro_benchmarks,
        },
        "areas": areas,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    return payload


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", type=Path, default=DEFAULT_DATABASE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    payload = export(args.database, args.output)
    print(
        f"Published {payload['coverage']['areaCount']} real tract records "
        f"for {payload['coverage']['label']} to {args.output}"
    )


if __name__ == "__main__":
    main()
