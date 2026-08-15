from pathlib import Path

from neighborhood_intelligence.config import load_settings


def test_environment_overrides_yaml_configuration(tmp_path: Path, monkeypatch) -> None:
    config = tmp_path / "settings.yaml"
    config.write_text("database_path: data/from-yaml.duckdb\n", encoding="utf-8")
    monkeypatch.setenv("NII_DATABASE_PATH", "data/from-environment.duckdb")

    settings = load_settings(config)

    assert settings.database_path == Path("data/from-environment.duckdb")
