from __future__ import annotations

from datetime import datetime, timezone
from enum import StrEnum
from uuid import uuid4


class Reliability(StrEnum):
    RELIABLE = "RELIABLE"
    CAUTION = "CAUTION"
    UNRELIABLE = "UNRELIABLE"
    NOT_AVAILABLE = "NOT_AVAILABLE"


def relative_moe(estimate: float | None, moe: float | None) -> float | None:
    if estimate is None or moe is None or estimate == 0:
        return None
    return abs(moe / estimate)


def reliability_flag(estimate: float | None, moe: float | None, caution: float, unreliable: float) -> Reliability:
    ratio = relative_moe(estimate, moe)
    if ratio is None:
        return Reliability.NOT_AVAILABLE
    if ratio >= unreliable:
        return Reliability.UNRELIABLE
    if ratio >= caution:
        return Reliability.CAUTION
    return Reliability.RELIABLE


def validate_geoid(geoid: str) -> bool:
    return len(geoid) == 11 and geoid.isdigit()


def record_profile_quality_results(conn: object) -> int:
    """Persist only actionable profile quality findings for observability."""
    profiles = conn.execute(
        """
        SELECT tract_geoid, reporting_year, geography_vintage, metric_coverage,
          population_reliability, income_reliability
        FROM analytics.tract_year_profile
        WHERE data_completeness <> 'COMPLETE'
           OR population_reliability IN ('UNRELIABLE', 'NOT_AVAILABLE')
           OR income_reliability IN ('UNRELIABLE', 'NOT_AVAILABLE')
        """
    ).fetchall()
    now = datetime.now(timezone.utc)
    rows: list[tuple[object, ...]] = []
    for tract_geoid, year, vintage, coverage, population_flag, income_flag in profiles:
        entity_id = f"tract:{tract_geoid}:{vintage}:year:{year}"
        if coverage < 1:
            rows.append(
                (
                    str(uuid4()), None, "tract_year_profile", entity_id,
                    "metric_completeness", "WARNING", "FAILED",
                    f"ACS metric coverage is {coverage:.1%}.", now,
                )
            )
        for metric_id, flag in (("population", population_flag), ("median_household_income", income_flag)):
            if flag in {"UNRELIABLE", "NOT_AVAILABLE"}:
                rows.append(
                    (
                        str(uuid4()), None, "tract_year_profile", entity_id,
                        f"{metric_id}_reliability", "WARNING", "FAILED",
                        f"ACS relative-MOE reliability is {flag}.", now,
                    )
                )
    if rows:
        conn.executemany("INSERT INTO quality.data_quality_result VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", rows)
    return len(rows)
