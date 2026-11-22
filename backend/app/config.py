from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./admitwise.db"
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "admitwise-change-me"
    jwt_secret: str = "development-only-secret"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440
    cors_origins: str = "http://localhost:5173"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()

