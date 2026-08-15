from __future__ import annotations

from pathlib import Path
import duckdb


def connect(database_path: Path, read_only: bool = False) -> duckdb.DuckDBPyConnection:
    if not read_only:
        database_path.parent.mkdir(parents=True, exist_ok=True)
    return duckdb.connect(str(database_path), read_only=read_only)


def migrate(conn: duckdb.DuckDBPyConnection, migrations_dir: Path) -> None:
    conn.execute("CREATE SCHEMA IF NOT EXISTS meta")
    conn.execute("CREATE TABLE IF NOT EXISTS meta.schema_migration (version VARCHAR PRIMARY KEY, applied_at TIMESTAMP NOT NULL)")
    for migration in sorted(migrations_dir.glob("*.sql")):
        applied = conn.execute("SELECT 1 FROM meta.schema_migration WHERE version = ?", [migration.name]).fetchone()
        if applied:
            continue
        conn.execute("BEGIN TRANSACTION")
        try:
            conn.execute(migration.read_text(encoding="utf-8"))
            conn.execute("INSERT INTO meta.schema_migration VALUES (?, current_timestamp)", [migration.name])
            conn.execute("COMMIT")
        except Exception:
            conn.execute("ROLLBACK")
            raise
