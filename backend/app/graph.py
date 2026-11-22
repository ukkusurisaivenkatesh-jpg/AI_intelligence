from neo4j import GraphDatabase
from .config import settings


class KnowledgeGraph:
    def __init__(self):
        self.driver = None
        try:
            self.driver = GraphDatabase.driver(settings.neo4j_uri, auth=(settings.neo4j_user, settings.neo4j_password))
            self.driver.verify_connectivity()
        except Exception:
            self.driver = None

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
            return {"available": False, "nodes": [], "edges": [], "message": "Neo4j is not connected; start the Docker Neo4j service."}
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
