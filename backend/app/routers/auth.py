from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User
from ..schemas import RegisterRequest, LoginRequest, TokenResponse
from ..auth import hash_password, verify_password, create_token

router = APIRouter(prefix="/api/auth", tags=["authentication"])


@router.post("/register", response_model=TokenResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email.lower()).first():
        raise HTTPException(409, "Email is already registered")
    user = User(email=payload.email.lower(), full_name=payload.full_name, password_hash=hash_password(payload.password), role="student")
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"access_token": create_token(user.id), "token_type": "bearer", "role": user.role}


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")
    return {"access_token": create_token(user.id), "token_type": "bearer", "role": user.role}
