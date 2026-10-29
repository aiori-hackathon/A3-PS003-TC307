import os
import sys
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models.database import User, PasswordResetToken

# Environment & Hardening Configuration
# Safe development/testing modes that permit local fallback keys
SAFE_LOCAL_MODES = {"development", "dev", "local", "test", "testing"}

_raw_env = os.getenv("ENVIRONMENT", "").lower().strip()

# If running under pytest test runner, explicitly mark as testing environment
if not _raw_env and ("pytest" in sys.modules or os.getenv("PYTEST_CURRENT_TEST")):
    _raw_env = "testing"

ENVIRONMENT = _raw_env
ALLOW_DEMO_LOGIN = os.getenv("ALLOW_DEMO_LOGIN", "true").lower() in ("true", "1", "yes")
DEMO_ADMIN_PASSWORD = os.getenv("DEMO_ADMIN_PASSWORD", "TrafficFL@2026")
DEMO_CITIZEN_PASSWORD = os.getenv("DEMO_CITIZEN_PASSWORD", "Citizen@2026")

# Security & JWT Configuration
# Supports JWT_SECRET primary with SECRET_KEY backwards compatibility
_raw_secret = os.getenv("JWT_SECRET", "").strip() or os.getenv("SECRET_KEY", "").strip()

_INSECURE_PLACEHOLDERS = {
    "nexora-trafficfl-secure-token-secret-key-2026",
    "dev-trafficfl-secret-key-change-in-production-2026",
    "dev-trafficfl-jwt-secret-placeholder-change-in-production-2026",
    "dev-trafficfl-jwt-fallback-key-local-eval-only-2026",
    "secret",
    "changeme",
}

if ENVIRONMENT in SAFE_LOCAL_MODES:
    # Explicit development/testing setting: allow raw secret if provided, or explicit local dev fallback
    JWT_SECRET = _raw_secret or "dev-trafficfl-jwt-fallback-key-local-eval-only-2026"
else:
    # Production / Unset / Strict Mode:
    # Never allow an implicit development-mode fallback JWT secret.
    # Production must fail safely if ENVIRONMENT is missing or not explicitly set to a recognized safe mode.
    if not _raw_secret or _raw_secret in _INSECURE_PLACEHOLDERS or len(_raw_secret) < 16:
        env_display = f"'{ENVIRONMENT}'" if ENVIRONMENT else "UNSET"
        raise RuntimeError(
            f"CRITICAL SECURITY CONFIGURATION ERROR: ENVIRONMENT is {env_display} and JWT_SECRET is missing or insecure. "
            "Implicit development-mode fallback keys are strictly prohibited in production. "
            "For local development/evaluations, explicitly set ENVIRONMENT=development in your environment or backend/.env. "
            "For production, set ENVIRONMENT=production and provide a secure random JWT_SECRET (min 16 chars)."
        )
    JWT_SECRET = _raw_secret

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24
RESET_TOKEN_EXPIRE_MINUTES = 60

ph = PasswordHasher()
security_bearer = HTTPBearer(auto_error=False)


def _utc_now() -> datetime:
    """Helper to return current naive UTC timestamp without deprecation warnings."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def hash_password(password: str) -> str:
    """Hashes password using Argon2."""
    return ph.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies plaintext against Argon2 hashed password."""
    try:
        return ph.verify(hashed_password, plain_password)
    except (VerifyMismatchError, VerificationError):
        return False


def hash_reset_token(raw_token: str) -> str:
    """Computes SHA-256 hash of single-use reset token for database storage."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def create_access_token(user: User, expires_delta: Optional[timedelta] = None) -> str:
    """Generates a signed JWT access token."""
    expire = _utc_now() + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    payload = {
        "sub": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "is_demo": user.is_demo,
        "exp": expire,
        "iat": _utc_now(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decodes and validates JWT access token."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session token has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db),
) -> User:
    """Dependency that extracts user from Bearer token."""
    if not auth or not auth.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(auth.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account no longer exists.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated. Contact system administrator.",
        )
    return user


def require_roles(allowed_roles: List[str]):
    """
    FastAPI dependency to enforce role-based access control.
    Raises HTTP 403 Forbidden if current user role is not in allowed_roles.
    """
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: User role '{current_user.role}' lacks permission for this action. Required role: {', '.join(allowed_roles)}.",
            )
        return current_user
    return role_checker


def seed_demo_user(db: Session) -> Optional[User]:
    """
    Ensures standard demo accounts exist in database.
    Disables seeding if ALLOW_DEMO_LOGIN is false.
    """
    if not ALLOW_DEMO_LOGIN:
        return None

    # 1. Authority Demo Account
    admin_email = "admin@trafficfl.gov.in"
    demo_admin = db.query(User).filter(User.email == admin_email).first()
    if not demo_admin:
        demo_admin = User(
            id="usr_demo_admin",
            full_name="Municipal Traffic Director (Demo)",
            email=admin_email,
            hashed_password=hash_password(DEMO_ADMIN_PASSWORD),
            role="admin",
            is_active=True,
            is_demo=True,
            created_at=_utc_now(),
        )
        db.add(demo_admin)
        db.commit()
        db.refresh(demo_admin)

    # 2. Citizen Demo Account
    citizen_email = "citizen@trafficflow.ai"
    demo_citizen = db.query(User).filter(User.email == citizen_email).first()
    if not demo_citizen:
        demo_citizen = User(
            id="usr_demo_citizen",
            full_name="Smart City Resident",
            email=citizen_email,
            hashed_password=hash_password(DEMO_CITIZEN_PASSWORD),
            role="citizen",
            is_active=True,
            is_demo=True,
            created_at=_utc_now(),
        )
        db.add(demo_citizen)
        db.commit()
        db.refresh(demo_citizen)
    elif "demo" in (demo_citizen.full_name or "").lower():
        demo_citizen.full_name = "Smart City Resident"
        db.commit()
        db.refresh(demo_citizen)

    return demo_admin
