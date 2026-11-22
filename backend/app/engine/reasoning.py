from .frames import FrameRegistry
from .rules import RuleEngine


class KnowledgeReasoner:
    def __init__(self, rules=None):
        self.frames = FrameRegistry()
        self.rules = RuleEngine(rules)

    def create_frame(self, frame_type, name, attributes=None, relationships=None):
        return self.frames.create(frame_type, name, attributes, relationships).to_dict()

    def forward_chain(self, facts):
        return self.rules.forward_chain(facts)

    def backward_chain(self, goal, facts):
        return self.rules.backward_chain(goal, facts)
