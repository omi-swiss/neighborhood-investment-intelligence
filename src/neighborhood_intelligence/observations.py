from __future__ import annotations

from datetime import date
from typing import Sequence

import duckdb


def latest_observations_as_of(
    conn: duckdb.DuckDBPyConnection,
    as_of: date,
    geography_type: str,
    geography_ids: Sequence[str] | None = None,
) -> list[tuple[object, ...]]:
    """Return the latest value known on an as-of date without backfilling a newer vintage."""
    parameters: list[object] = [geography_type, as_of]
    id_clause = ""
    if geography_ids:
        id_clause = " AND geography_id IN (" + ", ".join("?" for _ in geography_ids) + ")"
        parameters.extend(geography_ids)
    query = f"""
        SELECT * EXCLUDE (preference_rank)
        FROM (
          SELECT *, row_number() OVER (
            PARTITION BY geography_type, geography_id, metric_id
            ORDER BY reference_period_end DESC,
                     CASE observation_type WHEN 'OBSERVED' THEN 0 WHEN 'NOWCAST' THEN 1 ELSE 2 END,
                     available_at DESC
          ) AS preference_rank
          FROM analytics.observation_as_of
          WHERE geography_type = ?
            AND (available_at IS NULL OR available_at <= ?)
            {id_clause}
        )
        WHERE preference_rank = 1
        ORDER BY geography_id, metric_id
    """
    return conn.execute(query, parameters).fetchall()
