from copy import deepcopy


FRAME_TEMPLATES = {
    "Student": {"qualification": None, "aggregate_marks": None, "subject_marks": {}, "entrance_scores": {}, "interests": [], "aptitude": {}, "skills": [], "preferred_location": None, "annual_budget": None},
    "University": {"name": "", "location": "", "region": "", "website": None, "institution_type": None, "state": None, "city": None, "recognition_info": None, "source_url": None, "source_title": None, "verification_status": "PENDING_VERIFICATION", "verified_at": None, "academic_year": None, "last_updated": None, "data_notes": None},
    "Programme": {"programme_name": "", "duration_years": None, "duration_text": None, "required_subjects": [], "minimum_percentage": None, "minimum_qualification": None, "entrance_exams": [], "annual_fee": None, "degree_type": None, "specialization": None, "admission_route": None, "counselling_authority": None, "criteria_complete": False, "verification_status": "PENDING_VERIFICATION", "academic_year": None, "source_url": None, "source_title": None, "verified_at": None, "last_updated": None, "data_notes": None, "fee_academic_year": None, "fee_source_url": None, "fee_source_title": None, "fee_verification_status": "PENDING_VERIFICATION", "career_paths": []},
    "Eligibility": {"minimum_percentage": None, "required_subjects": [], "subject_minimums": {}, "entrance_requirements": {}, "academic_year": None, "verification_status": "PENDING_VERIFICATION", "annual_fee": None},
    "EntranceExam": {"name": "", "minimum_score": None, "maximum_rank": None},
    "Career": {"name": "", "required_skills": [], "soft_skills": [], "certifications": [], "related_qualifications": [], "roadmap": [], "source_url": None, "source_title": None, "verification_status": "PENDING_VERIFICATION", "academic_year": None, "verified_at": None, "last_updated": None, "data_notes": None},
    "Skill": {"name": "", "level": "beginner", "category": "general"},
}


class Frame:
    def __init__(self, frame_type: str, name: str, attributes=None, relationships=None):
        if frame_type not in FRAME_TEMPLATES:
            raise ValueError("Unknown frame type")
        self.frame_type = frame_type
        self.name = name
        self.attributes = deepcopy(FRAME_TEMPLATES[frame_type])
        self.attributes.update(attributes or {})
        self.relationships = relationships or {}
        self.constraints = {}

    def to_dict(self):
        return {"frame_type": self.frame_type, "name": self.name, "attributes": self.attributes, "relationships": self.relationships}


class FrameRegistry:
    def __init__(self):
        self.frames = {}

    def create(self, frame_type: str, name: str, attributes=None, relationships=None):
        frame = Frame(frame_type, name, attributes, relationships)
        self.frames[f"{frame_type}:{name}"] = frame
        return frame

    def get(self, frame_type: str, name: str):
        frame = self.frames.get(f"{frame_type}:{name}")
        return frame.to_dict() if frame else None

