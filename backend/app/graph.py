import json

from neo4j import GraphDatabase
from neo4j.exceptions import DriverError, Neo4jError
from sqlalchemy.orm import Session

from .config import settings
from .models import Programme, University


_SYNC_UNIVERSITIES = """
UNWIND $rows AS row
MERGE (u:University {id: row.id})
SET u.name = row.name,
    u.location = row.location,
    u.state = row.state,
    u.city = row.city,
    u.website = row.website,
    u.institution_type = row.institution_type,
    u.recognition_info = row.recognition_info,
    u.data_status = row.data_status,
    u.verification_status = row.verification_status,
    u.academic_year = row.academic_year,
    u.verified_at = row.verified_at,
    u.last_updated = row.last_updated,
    u.data_notes = row.data_notes
FOREACH (source_row IN CASE WHEN row.source_url IS NULL OR trim(row.source_url) = '' THEN [] ELSE [row] END |
    MERGE (source:SourceDocument {url: source_row.source_url, evidence_scope: 'institution'})
    SET source.name = source_row.source_title
    MERGE (u)-[evidence:HAS_SOURCE {scope: 'institution'}]->(source)
    SET evidence.verification_status = source_row.verification_status,
        evidence.academic_year = source_row.academic_year,
        evidence.verified_at = source_row.verified_at,
        evidence.last_updated = source_row.last_updated,
        evidence.notes = source_row.data_notes
)
"""

_SYNC_PROGRAMMES = """
UNWIND $rows AS row
MATCH (u:University {id: row.university_id})
MERGE (p:Programme {id: row.id})
SET p.name = row.name,
    p.discipline = row.discipline,
    p.degree_type = row.degree_type,
    p.specialization = row.specialization,
    p.duration_years = row.duration_years,
    p.duration_text = row.duration_text,
    p.minimum_qualification = row.minimum_qualification,
    p.minimum_percentage = row.minimum_percentage,
    p.required_subjects = row.required_subjects,
    p.subject_minimums_json = row.subject_minimums_json,
    p.additional_admission_conditions_json = row.additional_admission_conditions_json,
    p.entrance_exams = row.entrance_exams,
    p.entrance_requirements_json = row.entrance_requirements_json,
    p.admission_route = row.admission_route,
    p.counselling_authority = row.counselling_authority,
    p.criteria_complete = row.criteria_complete,
    p.verification_status = row.verification_status,
    p.academic_year = row.academic_year,
    p.annual_fee = row.annual_fee,
    p.fee_verification_status = row.fee_verification_status,
    p.fee_academic_year = row.fee_academic_year,
    p.other_academic_fees_json = row.other_academic_fees_json,
    p.last_updated = row.last_updated,
    p.fee_last_updated = row.fee_last_updated,
    p.data_notes = row.data_notes,
    p.fee_data_notes = row.fee_data_notes
MERGE (u)-[:UNIVERSITY_OFFERS_PROGRAMME]->(p)
FOREACH (source_row IN CASE WHEN row.source_url IS NULL OR trim(row.source_url) = '' THEN [] ELSE [row] END |
    MERGE (source:SourceDocument {url: source_row.source_url, evidence_scope: 'programme'})
    SET source.name = source_row.source_title
    MERGE (p)-[evidence:HAS_SOURCE {scope: 'programme'}]->(source)
    SET evidence.verification_status = source_row.verification_status,
        evidence.academic_year = source_row.academic_year,
        evidence.verified_at = source_row.verified_at,
        evidence.last_updated = source_row.last_updated,
        evidence.notes = source_row.data_notes
)
FOREACH (source_row IN CASE WHEN row.fee_source_url IS NULL OR trim(row.fee_source_url) = '' THEN [] ELSE [row] END |
    MERGE (source:SourceDocument {url: source_row.fee_source_url, evidence_scope: 'fees'})
    SET source.name = source_row.fee_source_title
    MERGE (p)-[evidence:HAS_SOURCE {scope: 'fees'}]->(source)
    SET evidence.verification_status = source_row.fee_verification_status,
        evidence.academic_year = source_row.fee_academic_year,
        evidence.verified_at = source_row.fee_verified_at,
        evidence.last_updated = source_row.fee_last_updated,
        evidence.notes = source_row.fee_data_notes
)
"""


def _isoformat(value):
    return value.isoformat() if value is not None else None


def _json_text(value):
    return json.dumps(value, ensure_ascii=False) if value is not None else None


def _university_row(university):
    return {
        "id": university.id,
        "name": university.name,
        "location": university.location,
        "state": university.state,
        "city": university.city,
        "website": university.website,
        "institution_type": university.institution_type,
        "recognition_info": university.recognition_info,
        "data_status": university.data_status,
        "verification_status": university.verification_status,
        "academic_year": university.academic_year,
        "verified_at": _isoformat(university.verified_at),
        "last_updated": _isoformat(university.last_updated),
        "data_notes": university.data_notes,
        "source_url": university.source_url,
        "source_title": university.source_title,
    }


def _programme_row(programme):
    return {
        "id": programme.id,
        "university_id": programme.university_id,
        "name": programme.name,
        "discipline": programme.discipline,
        "degree_type": programme.degree_type,
        "specialization": programme.specialization,
        "duration_years": programme.duration_years,
        "duration_text": programme.duration_text,
        "minimum_qualification": programme.minimum_qualification,
        "minimum_percentage": programme.minimum_percentage,
        "required_subjects": programme.required_subjects or [],
        "subject_minimums_json": _json_text(programme.subject_minimums),
        "additional_admission_conditions_json": _json_text(programme.additional_admission_conditions),
        "entrance_exams": programme.entrance_exams or [],
        "entrance_requirements_json": _json_text(programme.entrance_requirements),
        "admission_route": programme.admission_route,
        "counselling_authority": programme.counselling_authority,
        "criteria_complete": programme.criteria_complete,
        "verification_status": programme.verification_status,
        "academic_year": programme.academic_year,
        "annual_fee": programme.annual_fee,
        "fee_verification_status": programme.fee_verification_status,
        "fee_academic_year": programme.fee_academic_year,
        "other_academic_fees_json": _json_text(programme.other_academic_fees),
        "last_updated": _isoformat(programme.last_updated),
        "fee_last_updated": _isoformat(programme.fee_last_updated),
        "data_notes": programme.data_notes,
        "fee_data_notes": programme.fee_data_notes,
        "source_url": programme.source_url,
        "source_title": programme.source_title,
        "verified_at": _isoformat(programme.verified_at),
        "fee_source_url": programme.fee_source_url,
        "fee_source_title": programme.fee_source_title,
        "fee_verified_at": _isoformat(programme.fee_verified_at),
    }


class KnowledgeGraph:
    def __init__(self):
        self.driver = None
        self.error = None
        driver = None
        try:
            driver = GraphDatabase.driver(settings.neo4j_uri, auth=(settings.neo4j_user, settings.neo4j_password))
            driver.verify_connectivity()
            self.driver = driver
        except (DriverError, Neo4jError, OSError, ValueError):
            if driver:
                driver.close()
            self.driver = None
            self.error = "Neo4j is unavailable or authentication failed. Verify the configured URI, credentials, and network access."

    def close(self):
        if self.driver:
            self.driver.close()

    def _write_rows(self, university_rows, programme_rows):
        def write(transaction):
            if university_rows:
                transaction.run(_SYNC_UNIVERSITIES, rows=university_rows).consume()
            if programme_rows:
                transaction.run(_SYNC_PROGRAMMES, rows=programme_rows).consume()

        with self.driver.session() as session:
            session.execute_write(write)

    def sync_catalogue(self, db: Session):
        if not self.driver:
            return None

        universities = db.query(University).filter(University.source_url.isnot(None)).all()
        programmes = (
            db.query(Programme)
            .join(University)
            .filter(University.source_url.isnot(None), Programme.source_url.isnot(None))
            .all()
        )
        university_rows = [_university_row(university) for university in universities]
        programme_rows = [_programme_row(programme) for programme in programmes]
        self._write_rows(university_rows, programme_rows)
        return {"universities": len(university_rows), "programmes": len(programme_rows)}

    def sync_programme(self, programme):
        if not self.driver:
            return False
        university = programme.university
        if university is None:
            return False
        self._write_rows([_university_row(university)], [_programme_row(programme)])
        return True

    def explorer(self, limit=100):
        if not self.driver:
            return {"available": False, "nodes": [], "edges": [], "message": self.error or "Neo4j is not connected; configure a reachable Neo4j URI."}
        with self.driver.session() as session:
            records = session.run("""
            MATCH (a)-[r]->(b)
            RETURN labels(a)[0] AS a_label, elementId(a) AS a_id, properties(a) AS a, type(r) AS rel,
                   labels(b)[0] AS b_label, elementId(b) AS b_id, properties(b) AS b
            LIMIT $limit
            """, limit=limit)
            nodes, edges = {}, []
            for row in records:
                for side in ("a", "b"):
                    key = row[f"{side}_id"]
                    nodes[key] = {"id": key, "label": row[f"{side}_label"], "name": row[side].get("name", row[side].get("id", key))}
                edges.append({"source": row["a_id"], "target": row["b_id"], "label": row["rel"]})
        return {"available": True, "nodes": list(nodes.values()), "edges": edges}
