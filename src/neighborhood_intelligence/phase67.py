from __future__ import annotations

import csv
from collections.abc import Callable, Iterable, Iterator
from datetime import date
from hashlib import sha256
import json
from pathlib import Path
from uuid import uuid4

import duckdb

from .acs import new_run_id, now_utc

VERIFICATION = {"VERIFIED", "NEEDS_REVIEW"}
REVIEW_STATUS = {"VERIFIED", "MANUAL_REVIEW_REQUIRED", "RETIRED"}
CONFIDENCE = {"LOW", "MEDIUM", "HIGH"}
PUBLIC_PROJECT_STATUSES = {
    "PROPOSED",
    "APPROVED",
    "AWARDED",
    "UNDER_CONSTRUCTION",
    "COMPLETED",
    "DELAYED",
    "CANCELLED",
}
PUBLIC_FUNDING_STATUSES = {
    "UNKNOWN",
    "PROPOSED",
    "BUDGETED",
    "APPROPRIATED",
    "AWARDED",
    "PARTIALLY_SPENT",
    "SPENT",
}
JURISDICTION_TYPES = {"STATE", "COUNTY", "CITY"}
POLICY_DIMENSIONS = {
    "TENANT_PROTECTIONS",
    "EVICTION_COMPLEXITY",
    "RENT_GROWTH_RESTRICTIONS",
    "LANDLORD_COMPLIANCE",
    "PROPERTY_TAX",
    "DEVELOPMENT_RESTRICTIONS",
    "SHORT_TERM_RENTAL_RESTRICTIONS",
}
RISK_CATEGORIES = {
    "FLOOD",
    "HISTORICAL_FLOOD",
    "WILDFIRE",
    "EXTREME_HEAT",
    "SEA_LEVEL_RISE",
    "CONTAMINATION",
    "BROWNFIELD",
    "AIR_QUALITY",
    "NOISE",
    "INDUSTRIAL_PROXIMITY",
    "SUPERFUND",
    "CLIMATE",
    "INSURANCE",
}
GEOGRAPHY_TYPES = {"STATE", "COUNTY", "TRACT", "PLACE", "ZIP", "POINT", "POLYGON", "CUSTOM"}


def _required(row: dict[str, str], field: str, entity: str) -> str:
    value = (row.get(field) or "").strip()
    if not value:
        raise ValueError(f"{entity} field {field} is required.")
    return value


def _date(value: str | None) -> date | None:
    return date.fromisoformat(value) if value else None


def _number(value: str | None) -> float | None:
    return float(value) if value else None


def _enum(value: str, allowed: set[str], field: str) -> str:
    normalized = value.upper()
    if normalized not in allowed:
        raise ValueError(f"{field} must be one of {sorted(allowed)}.")
    return normalized


def _validate_fips(value: str | None, length: int, field: str) -> str | None:
    if not value:
        return None
    if len(value) != length or not value.isdigit():
        raise ValueError(f"{field} must be a {length}-digit FIPS code.")
    return value


def iter_public_projects(path: Path, run_id: str) -> Iterator[tuple[object, ...]]:
    with path.open(encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source):
            entity = "Public-project"
            project_status = _enum(
                _required(row, "project_status", entity),
                PUBLIC_PROJECT_STATUSES,
                "project_status",
            )
            funding_status = _enum(
                _required(row, "funding_status", entity),
                PUBLIC_FUNDING_STATUSES,
                "funding_status",
            )
            verification = _enum(
                _required(row, "verification_status", entity), VERIFICATION, "verification_status"
            )
            confidence = _enum(
                _required(row, "confidence_level", entity), CONFIDENCE, "confidence_level"
            )
            geography_type = _enum(
                _required(row, "geography_type", entity), GEOGRAPHY_TYPES, "geography_type"
            )
            county = _validate_fips(row.get("county_geoid"), 5, "county_geoid")
            tract = _validate_fips(row.get("tract_geoid"), 11, "tract_geoid")
            latitude, longitude = _number(row.get("latitude")), _number(row.get("longitude"))
            if (latitude is None) != (longitude is None):
                raise ValueError("Public-project latitude and longitude must be supplied together.")
            if latitude is not None and (not -90 <= latitude <= 90 or not -180 <= longitude <= 180):
                raise ValueError("Public-project coordinates are invalid.")
            last_verified = _date(_required(row, "last_verified_date", entity))
            yield (
                _required(row, "project_id", entity),
                _required(row, "project_name", entity),
                _required(row, "sponsor_name", entity),
                _required(row, "project_type", entity),
                project_status,
                funding_status,
                _date(row.get("announcement_date")),
                _date(row.get("approval_date")),
                _date(row.get("construction_start_date")),
                _date(row.get("expected_completion_date")),
                _date(row.get("actual_completion_date")),
                _number(row.get("total_project_cost_usd")),
                _number(row.get("proposed_funding_usd")),
                _number(row.get("budgeted_funding_usd")),
                _number(row.get("appropriated_funding_usd")),
                _number(row.get("awarded_funding_usd")),
                _number(row.get("spent_funding_usd")),
                geography_type,
                _required(row, "geography_id", entity),
                county,
                tract,
                latitude,
                longitude,
                (row.get("coordinate_precision") or "").upper() or None,
                _required(row, "primary_source_url", entity),
                row.get("secondary_source_url") or None,
                _date(row.get("source_document_date")),
                last_verified,
                verification,
                confidence,
                run_id,
            )


def iter_regulatory_policies(path: Path, run_id: str) -> Iterator[tuple[object, ...]]:
    with path.open(encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source):
            entity = "Regulatory-policy"
            jurisdiction_type = _enum(
                _required(row, "jurisdiction_type", entity),
                JURISDICTION_TYPES,
                "jurisdiction_type",
            )
            state_fips = _validate_fips(
                _required(row, "state_fips", entity), 2, "state_fips"
            )
            county = _validate_fips(row.get("county_geoid"), 5, "county_geoid")
            place = _validate_fips(row.get("place_geoid"), 7, "place_geoid")
            if jurisdiction_type == "COUNTY" and not county:
                raise ValueError("County policies require county_geoid.")
            if jurisdiction_type == "CITY" and not place:
                raise ValueError("City policies require place_geoid.")
            yield (
                _required(row, "policy_id", entity),
                jurisdiction_type,
                state_fips,
                county,
                place,
                _required(row, "jurisdiction_name", entity),
                _required(row, "policy_category", entity).upper(),
                _enum(
                    _required(row, "policy_dimension", entity),
                    POLICY_DIMENSIONS,
                    "policy_dimension",
                ),
                _required(row, "policy_summary", entity),
                _date(row.get("effective_date")),
                _date(row.get("expiration_date")),
                row.get("official_citation") or None,
                _required(row, "official_source_url", entity),
                _date(_required(row, "last_verified_date", entity)),
                _enum(_required(row, "review_status", entity), REVIEW_STATUS, "review_status"),
                _enum(
                    _required(row, "confidence_level", entity), CONFIDENCE, "confidence_level"
                ),
                row.get("applicability_note") or None,
                run_id,
            )


def iter_environmental_risks(path: Path, run_id: str) -> Iterator[tuple[object, ...]]:
    with path.open(encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source):
            entity = "Environmental-risk"
            numeric, text_value = _number(row.get("value_numeric")), row.get("value_text") or None
            if numeric is None and text_value is None:
                raise ValueError("Environmental-risk needs value_numeric or value_text.")
            yield (
                _required(row, "observation_id", entity),
                row.get("source_record_id") or None,
                _enum(
                    _required(row, "geography_type", entity),
                    GEOGRAPHY_TYPES,
                    "geography_type",
                ),
                _required(row, "geography_id", entity),
                row.get("geography_vintage") or None,
                _enum(
                    _required(row, "risk_category", entity),
                    RISK_CATEGORIES,
                    "risk_category",
                ),
                _required(row, "metric_id", entity),
                numeric,
                text_value,
                row.get("unit") or None,
                _date(row.get("observation_date")),
                _date(row.get("reference_period_start")),
                _date(row.get("reference_period_end")),
                _required(row, "source_vintage", entity),
                _date(row.get("publication_date")),
                _required(row, "source_url", entity),
                _required(row, "assignment_method", entity).upper(),
                _enum(_required(row, "review_status", entity), REVIEW_STATUS, "review_status"),
                _enum(
                    _required(row, "confidence_level", entity), CONFIDENCE, "confidence_level"
                ),
                run_id,
            )


def ingest_evidence_csv(
    conn: duckdb.DuckDBPyConnection,
    raw_dir: Path,
    source_id: str,
    source_file: Path,
    rows_factory: Callable[[Path, str], Iterable[tuple[object, ...]]],
    insert_sql: str,
    schema_version: str,
) -> int:
    content = source_file.read_bytes()
    digest = sha256(content).hexdigest()
    target = raw_dir / source_id / f"{digest}-{source_file.name}"
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        target.write_bytes(content)
    run_id = new_run_id()
    conn.execute(
        "INSERT INTO meta.ingestion_run VALUES (?, ?, ?, NULL, 'RUNNING', ?, NULL, NULL, NULL)",
        [
            run_id,
            source_id,
            now_utc(),
            json.dumps({"file_name": source_file.name, "delivery": "reviewed_csv"}),
        ],
    )
    try:
        rows = list(rows_factory(target, run_id))
        conn.execute("BEGIN TRANSACTION")
        if rows:
            conn.executemany(insert_sql, rows)
        conn.execute(
            "INSERT INTO raw.source_asset VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                str(uuid4()),
                run_id,
                f"manual-import://{source_id}/{source_file.name}",
                now_utc(),
                str(target.relative_to(raw_dir)),
                digest,
                len(content),
                schema_version,
                "Row-level public source URLs retained; review upstream terms before redistribution",
            ],
        )
        conn.execute(
            "UPDATE meta.ingestion_run SET completed_at=?, status='SUCCEEDED', "
            "record_count=?, checksum_sha256=? WHERE run_id=?",
            [now_utc(), len(rows), digest, run_id],
        )
        conn.execute("COMMIT")
        return len(rows)
    except Exception as error:
        try:
            conn.execute("ROLLBACK")
        except duckdb.TransactionException:
            pass
        conn.execute(
            "UPDATE meta.ingestion_run SET completed_at=?, status='FAILED', error_message=? "
            "WHERE run_id=?",
            [now_utc(), str(error), run_id],
        )
        raise


def build_phase67_products(conn: duckdb.DuckDBPyConnection) -> None:
    conn.execute(
        """
        CREATE OR REPLACE TABLE analytics.private_investment_map_pin AS
        SELECT *,
          CASE
            WHEN project_status IN ('OPERATING', 'COMPLETED') THEN 1.00
            WHEN project_status = 'UNDER_CONSTRUCTION' THEN 0.85
            WHEN project_status IN ('FINANCED', 'PERMITTED') THEN 0.65
            WHEN project_status = 'ENTITLED' THEN 0.45
            ELSE 0.25
          END AS realization_signal,
          CASE evidence_type
            WHEN 'SEC_FILING' THEN 1.00
            WHEN 'FINANCING_RECORD' THEN 0.95
            WHEN 'PERMIT' THEN 0.90
            WHEN 'PROPERTY_RECORD' THEN 0.90
            WHEN 'PLANNING_RECORD' THEN 0.85
            WHEN 'OFFICIAL_COMPANY_DISCLOSURE' THEN 0.75
            WHEN 'GOVERNMENT_ANNOUNCEMENT' THEN 0.70
            ELSE 0.40
          END AS evidence_strength
        FROM standardized.private_investment_project
        WHERE verification_status = 'VERIFIED'
          AND project_status NOT IN ('CANCELLED')
        """
    )
    conn.execute(
        """
        CREATE OR REPLACE TABLE analytics.public_investment_map_pin AS
        SELECT *,
          CASE funding_status
            WHEN 'SPENT' THEN 1.00
            WHEN 'PARTIALLY_SPENT' THEN 0.90
            WHEN 'AWARDED' THEN 0.80
            WHEN 'APPROPRIATED' THEN 0.65
            WHEN 'BUDGETED' THEN 0.45
            WHEN 'PROPOSED' THEN 0.20
            ELSE 0.10
          END AS funding_certainty_signal
        FROM standardized.public_investment_project
        WHERE verification_status = 'VERIFIED'
          AND project_status NOT IN ('CANCELLED')
          AND latitude IS NOT NULL
          AND longitude IS NOT NULL
        """
    )
    conn.execute(
        """
        CREATE OR REPLACE TABLE analytics.county_investment_summary AS
        WITH evidence AS (
          SELECT county_geoid, 'PUBLIC' AS investment_class,
            coalesce(total_project_cost_usd, awarded_funding_usd, appropriated_funding_usd,
              budgeted_funding_usd, proposed_funding_usd) AS announced_value_usd,
            CASE WHEN funding_status IN ('APPROPRIATED', 'AWARDED', 'PARTIALLY_SPENT', 'SPENT')
              THEN coalesce(spent_funding_usd, awarded_funding_usd, appropriated_funding_usd,
                total_project_cost_usd) END AS committed_value_usd,
            funding_status IN ('APPROPRIATED', 'AWARDED', 'PARTIALLY_SPENT', 'SPENT')
              AS is_committed
          FROM standardized.public_investment_project
          WHERE verification_status = 'VERIFIED' AND project_status <> 'CANCELLED'
            AND county_geoid IS NOT NULL
          UNION ALL
          SELECT county_geoid, 'PRIVATE',
            capex_usd,
            CASE WHEN funding_status IN ('FINANCING_SECURED', 'COMPANY_COMMITTED',
              'PARTIALLY_FUNDED', 'FULLY_FUNDED')
              OR project_status IN ('FINANCED', 'UNDER_CONSTRUCTION', 'OPERATING', 'COMPLETED')
              THEN coalesce(committed_capex_usd, capex_usd) END,
            funding_status IN ('FINANCING_SECURED', 'COMPANY_COMMITTED',
              'PARTIALLY_FUNDED', 'FULLY_FUNDED')
              OR project_status IN ('FINANCED', 'UNDER_CONSTRUCTION', 'OPERATING', 'COMPLETED')
          FROM standardized.private_investment_project
          WHERE verification_status = 'VERIFIED' AND project_status <> 'CANCELLED'
        )
        SELECT county_geoid,
          count(*) FILTER (WHERE investment_class = 'PUBLIC') AS public_project_count,
          count(*) FILTER (WHERE investment_class = 'PRIVATE') AS private_project_count,
          count(*) FILTER (WHERE is_committed) AS committed_project_count,
          sum(announced_value_usd) AS announced_pipeline_usd,
          sum(committed_value_usd) AS committed_pipeline_usd,
          sum(committed_value_usd) FILTER (WHERE investment_class = 'PUBLIC')
            AS committed_public_usd,
          sum(committed_value_usd) FILTER (WHERE investment_class = 'PRIVATE')
            AS committed_private_usd,
          'ANNOUNCED_AND_COMMITTED_VALUES_REPORTED_SEPARATELY' AS interpretation_note
        FROM evidence
        GROUP BY county_geoid
        """
    )
    conn.execute(
        """
        CREATE OR REPLACE TABLE analytics.jurisdiction_regulatory_profile AS
        SELECT jurisdiction_type, state_fips, county_geoid, place_geoid, jurisdiction_name,
          policy_dimension, count(*) AS active_verified_policy_count,
          min(effective_date) AS earliest_effective_date,
          max(last_verified_date) AS last_verified_date,
          'POLICY_COUNTS_ARE_NOT_A_LANDLORD_FRIENDLINESS_SCORE' AS interpretation_note
        FROM standardized.regulatory_policy
        WHERE review_status = 'VERIFIED'
          AND (effective_date IS NULL OR effective_date <= current_date)
          AND (expiration_date IS NULL OR expiration_date >= current_date)
        GROUP BY ALL
        """
    )
    conn.execute(
        """
        CREATE OR REPLACE TABLE analytics.geography_risk_profile AS
        SELECT observation_id, geography_type, geography_id, geography_vintage,
          risk_category, metric_id, value_numeric, value_text, unit, observation_date,
          reference_period_start, reference_period_end, source_vintage, publication_date,
          source_url, assignment_method, confidence_level,
          'INDIVIDUAL_FACTOR_NO_COMPOSITE_RISK_SCORE' AS interpretation_note
        FROM standardized.environmental_risk_observation
        WHERE review_status = 'VERIFIED'
        """
    )


def export_phase67(conn: duckdb.DuckDBPyConnection, destination_dir: Path) -> list[Path]:
    destination_dir.mkdir(parents=True, exist_ok=True)
    exports = {
        "public_investment_map_pins.csv": "analytics.public_investment_map_pin",
        "private_investment_map_pins.csv": "analytics.private_investment_map_pin",
        "county_investment_summary.csv": "analytics.county_investment_summary",
        "jurisdiction_regulatory_profile.csv": "analytics.jurisdiction_regulatory_profile",
        "geography_risk_profile.csv": "analytics.geography_risk_profile",
    }
    destinations: list[Path] = []
    for file_name, relation in exports.items():
        destination = destination_dir / file_name
        destination.unlink(missing_ok=True)
        escaped = str(destination).replace("'", "''")
        conn.execute(f"COPY {relation} TO '{escaped}' (HEADER, DELIMITER ',')")
        destinations.append(destination)
    return destinations
