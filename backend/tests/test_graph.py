from collections import Counter

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.catalogue import PROGRAMMES, UNIVERSITIES, seed_catalogue
from app.database import Base
from app.graph import KnowledgeGraph
from app import graph as graph_module


class FakeResult:
    def consume(self):
        return None


class FakeTransaction:
    def __init__(self):
        self.calls = []

    def run(self, query, **parameters):
        self.calls.append((query, parameters))
        return FakeResult()


class FakeSession:
    def __init__(self, transaction):
        self.transaction = transaction

    def __enter__(self):
        return self

    def __exit__(self, _exc_type, _exc_value, _traceback):
        return False

    def execute_write(self, callback):
        return callback(self.transaction)


class FakeDriver:
    def __init__(self):
        self.transaction = FakeTransaction()

    def session(self):
        return FakeSession(self.transaction)


def test_catalogue_sync_preserves_status_and_provenance_relationships():
    engine = create_engine("sqlite://", poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    graph = KnowledgeGraph.__new__(KnowledgeGraph)
    graph.driver = FakeDriver()
    graph.error = None

    try:
        with Session(engine) as db:
            seed_catalogue(db)
            result = graph.sync_catalogue(db)

            assert result == {"universities": len(UNIVERSITIES), "programmes": len(PROGRAMMES)}
            university_query, university_params = graph.driver.transaction.calls[0]
            programme_query, programme_params = graph.driver.transaction.calls[1]

            assert "MERGE (u:University" in university_query
            assert "MERGE (source:SourceDocument" in university_query
            assert "HAS_SOURCE {scope: 'institution'}" in university_query
            assert "UNIVERSITY_OFFERS_PROGRAMME" in programme_query
            assert "HAS_SOURCE {scope: 'programme'}" in programme_query
            assert "HAS_SOURCE {scope: 'fees'}" in programme_query

            institution_rows = university_params["rows"]
            programme_rows = programme_params["rows"]
            assert Counter(row["verification_status"] for row in institution_rows) == {
                "PENDING_VERIFICATION": 19,
                "VERIFIED": 1,
            }
            assert Counter(row["verification_status"] for row in programme_rows) == {
                "PENDING_VERIFICATION": 16,
            }
            assert Counter(row["fee_verification_status"] for row in programme_rows) == {
                "PENDING_VERIFICATION": 16,
            }
            anna = next(row for row in institution_rows if row["name"] == "Anna University")
            assert anna["academic_year"] == "2026-27"
            assert anna["source_url"]
            assert all(row["source_url"] for row in institution_rows)
            assert all(row["source_url"] for row in programme_rows)
            assert all(row["criteria_complete"] is False for row in programme_rows)
            assert all(row["annual_fee"] is None or row["fee_verification_status"] != "VERIFIED" for row in programme_rows)
    finally:
        engine.dispose()


def test_catalogue_sync_skips_unavailable_graph_driver():
    graph = KnowledgeGraph.__new__(KnowledgeGraph)
    graph.driver = None
    graph.error = "Neo4j unavailable"
    engine = create_engine("sqlite://", poolclass=StaticPool)

    with Session(engine) as db:
        assert graph.sync_catalogue(db) is None
    engine.dispose()


def test_invalid_neo4j_address_is_reported_without_crashing(monkeypatch):
    class InvalidAddressDriver:
        closed = False

        def verify_connectivity(self):
            raise ValueError("unresolvable address")

        def close(self):
            self.closed = True

    driver = InvalidAddressDriver()
    monkeypatch.setattr(graph_module.GraphDatabase, "driver", lambda *args, **kwargs: driver)

    graph = KnowledgeGraph()

    assert graph.driver is None
    assert graph.error
    assert driver.closed
