"""Auth request/response schemas."""
from pydantic import BaseModel, Field
from typing import Optional


class RegisterRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=1, max_length=128)
    role: str = Field(pattern="^(tourist|guide)$")
    display_name: str = Field(min_length=1, max_length=80)
    locale: str = "en-US"
    country: Optional[str] = None      # ISO 3166-1 alpha-2 (e.g. "US", "GB")
    preferred_currency: Optional[str] = None  # ISO 4217 (e.g. "USD", "EUR")


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str
    user_id: str
