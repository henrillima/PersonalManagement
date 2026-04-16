import os
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from auth import create_token, check_password

router = APIRouter(tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    token: str


@router.post("/auth/login", response_model=LoginResponse)
def login(body: LoginRequest):
    admin_email = os.environ.get("ADMIN_EMAIL", "")
    if body.email != admin_email or not check_password(body.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas",
        )
    return LoginResponse(token=create_token(body.email))
