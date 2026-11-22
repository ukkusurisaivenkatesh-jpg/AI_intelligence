from neo4j import GraphDatabase
from neo4j.exceptions import DriverError, Neo4jError
from .config import settings


class KnowledgeGraph:
    def __init__(self):
        self.driver = None
        self.error = None
        driver = None
        try:
            driver = GraphDatabase.driver(settings.neo4j_uri, auth=(settings.neo4j_user, settings.neo4j_password))
            driver.verify_connectivity()
            self.driver = driver
        except (DriverError, Neo4jError, OSError):
            if driver:
                driver.close()
            self.driver = None
            self.error = "Neo4j is unavailable or authentication failed. Verify the configured URI, credentials, and network access."

    def close(self):
        if self.driver:
            self.driver.close()

    def sync_programme(self, p):
        if not self.driver:
            return False
        query = """
        MERGE (u:University {id:$uid}) SET u.name=$uname,u.location=$ulocation
        MERGE (p:Programme {id:$pid}) SET p.name=$pname,p.discipline=$discipline,p.annual_fee=$fee
        MERGE (u)-[:UNIVERSITY_OFFERS_PROGRAMME]->(p)
        """
        params = {"uid": p.university_id, "pid": p.id, "uname": p.university.name if p.university else "", "ulocation": p.university.location if p.university else "", "pname": p.name, "discipline": p.discipline or "", "fee": p.annual_fee or 0}
        with self.driver.session() as session:
            session.run(query, params)
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
