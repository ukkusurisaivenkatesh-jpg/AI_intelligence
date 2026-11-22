from pydantic import BaseModel, EmailStr, Field
from typing import Optional


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8)
    full_name: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str


class ProfileRequest(BaseModel):
    qualification: Optional[str] = None
    aggregate_marks: Optional[float] = None
    subject_marks: dict = {}
    entrance_scores: dict = {}
    interests: list[str] = []
    aptitude: dict = {}
    skills: list[str] = []
    preferred_location: Optional[str] = None
    annual_budget: Optional[float] = None
    profile: dict = {}
