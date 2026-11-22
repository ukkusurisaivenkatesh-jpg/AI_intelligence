from pathlib import Path

import pytest
from pydantic import ValidationError

from app import config
from app.catalogue import seed_catalogue
from app.config import Settings, require_staging_database
from app.seed import seed


class FakeResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class FakeConnection:
    def __init__(self, branch_id):
        self.branch_id = branch_id
        self.called = False

    def execute(self, statement):
        self.called = True
        return FakeResult(self.branch_id)


class NoQueryDatabase:
    def query(self, model):
        raise AssertionError("database must not be queried")


def test_env_file_is_absolute_backend_path():
    env_file = Path(Settings.model_config["env_file"])
    assert env_file.is_absolute()
    assert env_file == Path(__file__).resolve().parents[1] / ".env"


def test_database_url_is_required():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, _env_prefix="UNSET_")


def test_test_database_configuration_has_no_graph_service_requirements():
    settings = Settings(_env_file=None, app_env="test", database_url="sqlite://")

    assert not hasattr(settings, "neo4j_uri")
    assert not hasattr(settings, "neo4j_user")
    assert not hasattr(settings, "neo4j_password")


def test_production_requires_postgres():
    with pytest.raises(ValidationError, match="requires a PostgreSQL"):
        Settings(_env_file=None, app_env="production", database_url="sqlite://")


def test_staging_requires_distinct_branch_ids():
    with pytest.raises(ValidationError, match="branch IDs must differ"):
        Settings(
            _env_file=None,
            app_env="staging",
            database_url="postgresql://db",
            jwt_secret="s" * 40,
            staging_neon_branch_id="br-same",
            production_neon_branch_id="br-same",
        )


def test_staging_rejects_short_jwt_secret():
    with pytest.raises(ValidationError, match="JWT_SECRET of at least 32 bytes"):
        Settings(
            _env_file=None,
            app_env="staging",
            database_url="postgresql://db",
            jwt_secret="short",
            staging_neon_branch_id="br-staging",
            production_neon_branch_id="br-production",
        )


def test_staging_write_guard_checks_actual_branch(monkeypatch):
    monkeypatch.setattr(config.settings, "app_env", "staging")
    monkeypatch.setattr(config.settings, "staging_neon_branch_id", "br-staging")
    monkeypatch.setattr(config.settings, "production_neon_branch_id", "br-production")
    connection = FakeConnection("br-production")

    with pytest.raises(RuntimeError, match="does not match"):
        require_staging_database(connection)

    assert connection.called


def test_production_write_guard_refuses_before_query(monkeypatch):
    monkeypatch.setattr(config.settings, "app_env", "production")
    connection = FakeConnection("br-production")

    with pytest.raises(RuntimeError, match="APP_ENV=staging"):
        require_staging_database(connection)

    assert not connection.called


def test_production_seed_and_import_are_refused_before_database_access(monkeypatch):
    monkeypatch.setattr(config.settings, "app_env", "production")
    db = NoQueryDatabase()

    with pytest.raises(RuntimeError, match="only in development or test"):
        seed(db)
    with pytest.raises(RuntimeError, match="only in development, test, or verified staging"):
        seed_catalogue(db)
