from datetime import datetime
from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship
from .database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, nullable=False)
    full_name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="student")
    created_at = Column(DateTime, default=datetime.utcnow)


class StudentProfile(Base):
    __tablename__ = "student_profiles"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    qualification = Column(String)
    aggregate_marks = Column(Float)
    subject_marks = Column(JSON, default=dict)
    entrance_scores = Column(JSON, default=dict)
    interests = Column(JSON, default=list)
    aptitude = Column(JSON, default=dict)
    skills = Column(JSON, default=list)
    preferred_location = Column(String)
    annual_budget = Column(Float)
    profile = Column(JSON, default=dict)
    user = relationship("User")


class University(Base):
    __tablename__ = "universities"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    location = Column(String)
    region = Column(String)
    website = Column(String)
    data_status = Column(String, default="demo")
    last_verified = Column(Date)


class Programme(Base):
    __tablename__ = "programmes"
    id = Column(Integer, primary_key=True)
    university_id = Column(Integer, ForeignKey("universities.id"))
    name = Column(String, nullable=False)
    discipline = Column(String)
    duration_years = Column(Float)
    annual_fee = Column(Float)
    minimum_percentage = Column(Float)
    required_subjects = Column(JSON, default=list)
    subject_minimums = Column(JSON, default=dict)
    entrance_exams = Column(JSON, default=list)
    entrance_requirements = Column(JSON, default=dict)
    career_ids = Column(JSON, default=list)
    data_status = Column(String, default="demo")
    source = Column(String)
    last_verified = Column(Date)
    university = relationship("University")


class Rule(Base):
    __tablename__ = "rules"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    conditions = Column(JSON, nullable=False)
    operators = Column(JSON, default=dict)
    result = Column(JSON, nullable=False)
    priority = Column(Integer, default=100)
    source = Column(String)
    effective_date = Column(Date)
    expiry_date = Column(Date)
    institution_id = Column(Integer)
    programme_id = Column(Integer)
    active = Column(Boolean, default=True)


class Career(Base):
    __tablename__ = "careers"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    technical_skills = Column(JSON, default=list)
    soft_skills = Column(JSON, default=list)
    certifications = Column(JSON, default=list)
    roadmap = Column(JSON, default=list)


class Shortlist(Base):
    __tablename__ = "shortlists"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    programme_id = Column(Integer, ForeignKey("programmes.id"))


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True)
    actor = Column(String)
    action = Column(String)
    entity_type = Column(String)
    entity_id = Column(String)
    payload = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(Text, nullable=False)
    response = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
