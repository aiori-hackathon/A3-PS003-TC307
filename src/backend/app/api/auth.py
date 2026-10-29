import secrets
import uuid
import re
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.database import User, PasswordResetToken

def _utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)
from backend.app.schemas.schemas import (
    UserRegisterRequest,
    UserLoginRequest,
    UserResponse,
    AuthTokenResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
)
from backend.app.services.auth import (
    hash_password,
    verify_password,
    hash_reset_token,
    create_access_token,
    get_current_user,
    seed_demo_user,
    RESET_TOKEN_EXPIRE_MINUTES,
    ALLOW_DEMO_LOGIN,
    ENVIRONMENT,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def validate_email_format(email: str):
    email_regex = r"^[\w\.-]+@[\w\.-]+\.\w+$"
    if not re.match(email_regex, email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a valid email address.",
        )


@router.post("/register", response_model=AuthTokenResponse, status_code=status.HTTP_201_CREATED)
def register_user(req: UserRegisterRequest, db: Session = Depends(get_db)):
    """Registers a new user account with validated credentials and Argon2 password hashing."""
    normalized_email = req.email.strip().lower()
    validate_email_format(normalized_email)

    if req.confirm_password and req.password != req.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match.",
        )

    if len(req.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long.",
        )

    # Check for existing email
    existing_user = db.query(User).filter(User.email == normalized_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists.",
        )

    user_id = f"usr_{uuid.uuid4().hex[:12]}"
    hashed_pwd = hash_password(req.password)

    new_user = User(
        id=user_id,
        full_name=req.full_name.strip(),
        email=normalized_email,
        hashed_password=hashed_pwd,
        role="citizen",
        is_active=True,
        is_demo=False,
        created_at=_utc_now(),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token(new_user)

    return AuthTokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=new_user.id,
            full_name=new_user.full_name,
            email=new_user.email,
            role=new_user.role,
            is_active=new_user.is_active,
            is_demo=new_user.is_demo,
            created_at=new_user.created_at.isoformat(),
        ),
    )


@router.post("/login", response_model=AuthTokenResponse)
def login_user(req: UserLoginRequest, db: Session = Depends(get_db)):
    """Authenticates credentials and returns a secure JWT access token."""
    normalized_email = req.email.strip().lower()

    user = db.query(User).filter(User.email == normalized_email).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email address or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated. Please contact support.",
        )

    # If remember_me, token valid for 7 days, else 24 hours
    expires = timedelta(days=7) if req.remember_me else timedelta(hours=24)
    token = create_access_token(user, expires_delta=expires)

    return AuthTokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            full_name=user.full_name,
            email=user.email,
            role=user.role,
            is_active=user.is_active,
            is_demo=user.is_demo,
            created_at=user.created_at.isoformat(),
        ),
    )


@router.post("/demo-login", response_model=AuthTokenResponse)
def demo_login(role: str = "authority", db: Session = Depends(get_db)):
    """
    One-click demo authentication passing through real backend security flow.
    Accessible for evaluation demos when ALLOW_DEMO_LOGIN is enabled.
    """
    if not ALLOW_DEMO_LOGIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo authentication is disabled.",
        )

    seed_demo_user(db)
    target_email = "admin@trafficfl.gov.in" if role in ("authority", "admin") else "citizen@trafficflow.ai"
    demo_user = db.query(User).filter(User.email == target_email).first()
    if not demo_user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Demo user account could not be initialized.",
        )

    token = create_access_token(demo_user)
    return AuthTokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=demo_user.id,
            full_name=demo_user.full_name,
            email=demo_user.email,
            role=demo_user.role,
            is_active=demo_user.is_active,
            is_demo=demo_user.is_demo,
            created_at=demo_user.created_at.isoformat(),
        ),
    )


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Returns the authenticated profile of the user making the request."""
    return UserResponse(
        id=current_user.id,
        full_name=current_user.full_name,
        email=current_user.email,
        role=current_user.role,
        is_active=current_user.is_active,
        is_demo=current_user.is_demo,
        created_at=current_user.created_at.isoformat(),
    )


@router.post("/logout")
def logout():
    """Confirms user logout."""
    return {"message": "Logged out successfully."}


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Generates a cryptographically secure, time-limited, single-use password reset token."""
    normalized_email = req.email.strip().lower()
    user = db.query(User).filter(User.email == normalized_email).first()

    raw_token = None
    if user and user.is_active:
        # Invalidate previous unused tokens for this user
        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.is_used == False,
        ).update({"is_used": True})

        raw_token = secrets.token_urlsafe(32)
        token_hash = hash_reset_token(raw_token)
        expires_at = _utc_now() + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)

        reset_record = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
            is_used=False,
            created_at=_utc_now(),
        )
        db.add(reset_record)
        db.commit()

    # Generic response that does not leak account presence
    message = (
        "If an account with that email exists, password reset instructions have been generated."
    )

    # Include raw_token in response for development convenience
    return ForgotPasswordResponse(message=message, reset_token=raw_token)


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Validates single-use token and updates user password."""
    if len(req.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters long.",
        )

    if req.confirm_password and req.new_password != req.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match.",
        )

    token_hash = hash_reset_token(req.token.strip())

    reset_token = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.is_used == False,
            PasswordResetToken.expires_at > _utc_now(),
        )
        .first()
    )

    if not reset_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid, expired, or already-used password reset link.",
        )

    user = db.query(User).filter(User.id == reset_token.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account no longer exists.",
        )

    # Update password
    user.hashed_password = hash_password(req.new_password)
    reset_token.is_used = True
    db.commit()

    return {"message": "Password has been successfully reset. You can now sign in."}
