from __future__ import annotations

import csv
from datetime import date
from pathlib import Path
from typing import Iterator

STATUSES = {
    "ANNOUNCED",
    "ENTITLED",
    "PERMITTED",
    "FINANCED",
    "UNDER_CONSTRUCTION",
    "OPERATING",
    "COMPLETED",
    "DELAYED",
    "CANCELLED",
}
FUNDING_STATUSES = {
    "UNKNOWN",
    "ANNOUNCED",
    "SEEKING_FINANCING",
    "FINANCING_SECURED",
    "COMPANY_COMMITTED",
    "PARTIALLY_FUNDED",
    "FULLY_FUNDED",
}
EVIDENCE_TYPES = {
    "OFFICIAL_COMPANY_DISCLOSURE",
    "SEC_FILING",
    "PERMIT",
    "PLANNING_RECORD",
    "FINANCING_RECORD",
    "PROPERTY_RECORD",
    "CONSTRUCTION_RECORD",
    "GOVERNMENT_ANNOUNCEMENT",
    "NEWS_REPORT",
    "OTHER",
}
COORDINATE_PRECISIONS = {"SITE", "PARCEL", "ADDRESS", "EXACT", "APPROXIMATE", "COUNTY_CENTROID"}
STATUS_EVIDENCE = {
    "PERMITTED": {"PERMIT"},
    "FINANCED": {"FINANCING_RECORD"},
    "UNDER_CONSTRUCTION": {"CONSTRUCTION_RECORD"},
    "OPERATING": {"CONSTRUCTION_RECORD", "PROPERTY_RECORD"},
    "COMPLETED": {"CONSTRUCTION_RECORD", "PROPERTY_RECORD"},
}
VERIFICATION = {"VERIFIED", "NEEDS_REVIEW"}
CONFIDENCE = {"LOW", "MEDIUM", "HIGH"}


def _date(value: str | None) -> date | None:
    return date.fromisoformat(value) if value else None


def _number(value: str | None) -> float | None:
    return float(value) if value else None


def _integer(value: str | None) -> int | None:
    return int(value) if value else None


def _required(row: dict[str, str], field: str) -> str:
    value = (row.get(field) or "").strip()
    if not value:
        raise ValueError(f"Private-project field {field} is required.")
    return value


def iter_projects(path: Path, run_id: str) -> Iterator[tuple[object, ...]]:
    with path.open(encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source):
            status = _required(row, "status").upper()
            verification = _required(row, "verification_status").upper()
            evidence_type = _required(row, "evidence_type").upper()
            funding_status = _required(row, "funding_status").upper()
            confidence = _required(row, "confidence_level").upper()
            coordinate_precision = _required(row, "coordinate_precision").upper()
            county = _required(row, "county_geoid")
            primary_source = _required(row, "primary_source_url")
            latitude, longitude = float(_required(row, "latitude")), float(_required(row, "longitude"))
            last_verified = _date(row.get("last_verified_date"))
            if (
                status not in STATUSES
                or verification not in VERIFICATION
                or evidence_type not in EVIDENCE_TYPES
                or funding_status not in FUNDING_STATUSES
                or confidence not in CONFIDENCE
                or coordinate_precision not in COORDINATE_PRECISIONS
                or len(county) != 5
                or not county.isdigit()
                or not -90 <= latitude <= 90
                or not -180 <= longitude <= 180
            ):
                raise ValueError("Private-project evidence fields are invalid.")
            if verification == "VERIFIED" and (not last_verified or evidence_type == "NEWS_REPORT"):
                raise ValueError(
                    "Verified private projects need a verification date and non-news primary evidence."
                )
            if status in STATUS_EVIDENCE and evidence_type not in STATUS_EVIDENCE[status]:
                raise ValueError(
                    f"Private-project status {status} requires evidence type one of "
                    f"{sorted(STATUS_EVIDENCE[status])}; announcements must remain ANNOUNCED."
                )
            yield (
                _required(row, "project_id"),
                _required(row, "company_name"),
                row.get("project_name") or None,
                _required(row, "investment_type"),
                status,
                _date(row.get("announcement_date")),
                _date(row.get("expected_open_date")),
                _number(row.get("capex_usd")),
                _integer(row.get("expected_jobs")),
                county,
                latitude,
                longitude,
                coordinate_precision,
                primary_source,
                verification,
                run_id,
                evidence_type,
                funding_status,
                _number(row.get("committed_capex_usd")),
                row.get("financing_status") or None,
                _date(row.get("actual_open_date")),
                row.get("secondary_source_url") or None,
                _date(row.get("source_document_date")),
                last_verified,
                confidence,
            )
