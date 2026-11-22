import re
import math
from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator


_EMAIL_PATTERN = re.compile(r"^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$", re.IGNORECASE)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class EmailRequest(StrictModel):
    email: str = Field(min_length=5, max_length=254)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not _EMAIL_PATTERN.fullmatch(normalized):
            raise ValueError("A valid email address is required")
        return normalized


class RegisterRequest(EmailRequest):
    password: str = Field(min_length=12, max_length=72)
    full_name: str = Field(min_length=1, max_length=100)

    @field_validator("password")
    @classmethod
    def validate_password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 UTF-8 bytes")
        return value

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if not normalized:
            raise ValueError("Full name cannot be empty")
        return normalized


class LoginRequest(EmailRequest):
    password: str = Field(min_length=1, max_length=72)

    @field_validator("password")
    @classmethod
    def validate_password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 UTF-8 bytes")
        return value


class TokenResponse(StrictModel):
    access_token: str
    token_type: str = "bearer"
    role: str


class ProfileRequest(StrictModel):
    qualification: str | None = Field(default=None, max_length=100)
    aggregate_marks: float | None = Field(default=None, ge=0, le=100)
    subject_marks: dict[str, Annotated[float, Field(ge=0, le=100)]] = Field(default_factory=dict, max_length=100)
    entrance_scores: dict[str, float | dict[str, float]] = Field(default_factory=dict, max_length=50)
    interests: list[str] = Field(default_factory=list, max_length=50)
    aptitude: dict[str, Annotated[float, Field(ge=1, le=10)]] = Field(default_factory=dict, max_length=50)
    skills: list[str] = Field(default_factory=list, max_length=100)
    preferred_location: str | None = Field(default=None, max_length=200)
    annual_budget: float | None = Field(default=None, ge=0, le=1_000_000_000)
    profile: dict[str, Any] = Field(default_factory=dict, max_length=50)

    @field_validator("subject_marks", "entrance_scores", "aptitude")
    @classmethod
    def validate_map_keys(cls, value: dict) -> dict:
        if any(not isinstance(key, str) or not key.strip() or len(key) > 100 for key in value):
            raise ValueError("Map keys must be non-empty strings of at most 100 characters")
        return {key.strip(): item for key, item in value.items()}

    @field_validator("entrance_scores")
    @classmethod
    def validate_exam_values(cls, value: dict[str, float | dict[str, float]]) -> dict[str, float | dict[str, float]]:
        for exam, result in value.items():
            if isinstance(result, dict):
                if not result or set(result) - {"score", "rank"} or any(mark < 0 for mark in result.values()):
                    raise ValueError(f"{exam} must contain a non-negative score and/or rank")
            elif result < 0:
                raise ValueError(f"{exam} must be non-negative")
        return value

    @field_validator("interests", "skills")
    @classmethod
    def normalize_list_values(cls, value: list[str]) -> list[str]:
        normalized = list(dict.fromkeys(item.strip() for item in value if item.strip()))
        if any(len(item) > 100 for item in normalized):
            raise ValueError("List values must be at most 100 characters")
        return normalized

    @field_validator("profile")
    @classmethod
    def validate_custom_profile_facts(cls, value: dict[str, Any]) -> dict[str, Any]:
        def validate_node(node: Any, depth: int) -> None:
            if isinstance(node, dict):
                if depth >= 3 or len(node) > 50:
                    raise ValueError("Additional profile facts are too deeply nested or contain too many fields")
                if any(not isinstance(key, str) or not key.strip() or len(key) > 100 for key in node):
                    raise ValueError("Additional profile fact keys must be non-empty strings of at most 100 characters")
                for child in node.values():
                    validate_node(child, depth + 1)
            elif isinstance(node, list):
                if len(node) > 50:
                    raise ValueError("Additional profile fact lists may contain at most 50 values")
                for child in node:
                    validate_node(child, depth + 1)
            elif isinstance(node, str):
                if len(node) > 500:
                    raise ValueError("Additional profile fact text must be at most 500 characters")
            elif isinstance(node, float):
                if not math.isfinite(node):
                    raise ValueError("Additional profile numbers must be finite")
            elif node is not None and not isinstance(node, (int, bool)):
                raise ValueError("Additional profile facts must contain only JSON scalar, object, or list values")

        validate_node(value, 0)
        return value


class ProfileChanges(ProfileRequest):
    academic_year: str | None = Field(default=None, min_length=4, max_length=20)


class CompareRequest(StrictModel):
    programme_ids: list[int] = Field(min_length=2, max_length=4)
    academic_year: str | None = Field(default=None, min_length=4, max_length=20)

    @field_validator("programme_ids")
    @classmethod
    def validate_programme_ids(cls, value: list[int]) -> list[int]:
        if any(programme_id < 1 for programme_id in value):
            raise ValueError("Programme IDs must be positive")
        if len(set(value)) != len(value):
            raise ValueError("Programme IDs must be unique")
        return value


class CounsellorRequest(StrictModel):
    message: str = Field(min_length=1, max_length=2000)
    academic_year: str | None = Field(default=None, min_length=4, max_length=20)
    profile_changes: ProfileChanges | None = None

    @field_validator("message")
    @classmethod
    def normalize_message(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("A non-empty message is required")
        return value


class UniversityCreateRequest(StrictModel):
    name: str = Field(min_length=1, max_length=255)
    location: str | None = Field(default=None, max_length=255)
    region: str | None = Field(default=None, max_length=100)
    website: HttpUrl | None = None
    institution_type: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    city: str | None = Field(default=None, max_length=100)
    recognition_info: str | None = Field(default=None, max_length=4000)
    source_url: HttpUrl | None = None
    source_title: str | None = Field(default=None, max_length=255)
    academic_year: str | None = Field(default=None, max_length=20)
    data_notes: str | None = Field(default=None, max_length=4000)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Institution name cannot be empty")
        return value


class RuleCreateRequest(StrictModel):
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=4000)
    conditions: dict[str, Any]
    result: dict[str, Any]
    priority: int = Field(default=100, ge=0, le=10000)
    source: str | None = Field(default=None, max_length=1000)
    active: bool = True
