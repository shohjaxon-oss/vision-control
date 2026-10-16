import os
import uuid
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Response, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from database import get_db
from models import User, Organization, LoginAttempt, RefreshToken
from schemas import (
    LoginRequest, LoginResponse, Verify2FARequest, UserResponse,
    Setup2FAResponse, Confirm2FARequest
)
from security import (
    verify_password, get_password_hash, create_access_token,
    create_2fa_challenge_token, decode_token,
    encrypt_data, decrypt_data, generate_totp_secret, get_totp_uri, verify_totp
)
from deps import get_current_user, require_authenticated
from errors import AppException
from audit import log_audit_event

router = APIRouter(prefix="/auth", tags=["Auth"])

LOCKOUT_THRESHOLD = 5
LOCKOUT_MINUTES = 5

async def check_login_attempts(db: AsyncSession, email: str, ip: str) -> None:
    now = datetime.now(timezone.utc)
    stmt = select(LoginAttempt).where(LoginAttempt.email == email, LoginAttempt.ip_address == ip)
    result = await db.execute(stmt)
    attempt = result.scalars().first()

    if attempt and attempt.locked_until:
        if attempt.locked_until > now:
            remaining = int((attempt.locked_until - now).total_seconds() / 60) + 1
            raise AppException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                code="account_locked",
                message=f"Xavfsizlik choralari tufayli hisobingiz bloklangan. Iltimos, {remaining} daqiqadan so'ng qayta urinib ko'ring."
            )
        else:
            # Lockout expired, reset
            attempt.failed_count = 0
            attempt.locked_until = None
            await db.commit()

async def record_login_failure(db: AsyncSession, email: str, ip: str) -> None:
    now = datetime.now(timezone.utc)
    stmt = select(LoginAttempt).where(LoginAttempt.email == email, LoginAttempt.ip_address == ip)
    result = await db.execute(stmt)
    attempt = result.scalars().first()

    if not attempt:
        attempt = LoginAttempt(
            email=email,
            ip_address=ip,
            failed_count=1,
            updated_at=now
        )
        db.add(attempt)
    else:
        attempt.failed_count += 1
        attempt.updated_at = now
        if attempt.failed_count >= LOCKOUT_THRESHOLD:
            attempt.locked_until = now + timedelta(minutes=LOCKOUT_MINUTES)
    await db.commit()

async def record_login_success(db: AsyncSession, email: str, ip: str) -> None:
    stmt = select(LoginAttempt).where(LoginAttempt.email == email, LoginAttempt.ip_address == ip)
    result = await db.execute(stmt)
    attempt = result.scalars().first()
    if attempt:
        attempt.failed_count = 0
        attempt.locked_until = None
        await db.commit()

async def issue_refresh_token(db: AsyncSession, user_id: uuid.UUID, family_id: Optional[uuid.UUID] = None) -> str:
    raw_token = os.urandom(32).hex()
    token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
    fam_id = family_id or uuid.uuid4()
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=30)

    db_token = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        family_id=fam_id,
        expires_at=expires_at,
        created_at=now
    )
    db.add(db_token)
    await db.commit()
    return raw_token

@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    await check_login_attempts(db, req.email, client_ip)

    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalars().first()

    if not user or not user.is_active or not verify_password(req.password, user.password_hash):
        await record_login_failure(db, req.email, client_ip)
        raise AppException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="invalid_credentials",
            message="Elektron pochta yoki parol noto'g'ri. 5 urinishdan keyin hisob 5 daqiqaga bloklanadi."
        )

    await record_login_success(db, req.email, client_ip)

    # If user has 2FA configured or is owner/manager without 2FA
    if user.two_factor_secret:
        challenge_token = create_2fa_challenge_token(str(user.id), str(user.organization_id))
        return LoginResponse(
            requires_2fa=True,
            challenge_token=challenge_token,
            access_token=None,
            refresh_token=None,
            user=None
        )

    # Standard login without 2FA (e.g. observer or pending 2FA setup)
    access_token = create_access_token(str(user.id), user.role, str(user.organization_id))
    refresh_token = await issue_refresh_token(db, user.id)

    response.set_cookie(
        key="wfv_refresh",
        value=refresh_token,
        httponly=True,
        secure=False, # Set to True when served over HTTPS/Caddy
        samesite="lax",
        max_age=30 * 24 * 3600
    )

    await log_audit_event(
        db, user.organization_id, "user_login", "user", str(user.id),
        details={"email": user.email, "role": user.role}, request=request,
        user_id=user.id, user_email=user.email
    )
    await db.commit()

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse(
            id=str(user.id),
            email=user.email,
            name=user.name,
            role=user.role,
            organization_id=str(user.organization_id),
            is_active=user.is_active
        ),
        requires_2fa=False,
        challenge_token=None
    )

@router.post("/2fa")
async def verify_2fa(req: Verify2FARequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    if not req.challenge_token:
        raise AppException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="missing_challenge",
            message="2FA tekshirish uchun challenge_token taqdim etilishi shart"
        )

    payload = decode_token(req.challenge_token, expected_typ="challenge", expected_aud="wfv-2fa")
    user_id_str = payload.get("sub")
    user_uuid = uuid.UUID(user_id_str)

    result = await db.execute(select(User).where(User.id == user_uuid, User.is_active == True))
    user = result.scalars().first()
    if not user or not user.two_factor_secret:
        raise AppException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="2fa_not_configured",
            message="Ushbu hisobda ikki bosqichli autentifikatsiya sozlanmagan"
        )

    # Decrypt TOTP secret and verify
    totp_secret = decrypt_data(user.two_factor_secret)
    if not verify_totp(totp_secret, req.code):
        raise AppException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="invalid_2fa_code",
            message="Tasdiqlash kodi noto'g'ri yoki muddati o'tgan"
        )

    access_token = create_access_token(str(user.id), user.role, str(user.organization_id))
    refresh_token = await issue_refresh_token(db, user.id)

    response.set_cookie(
        key="wfv_refresh",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=30 * 24 * 3600
    )

    await log_audit_event(
        db, user.organization_id, "user_login_2fa", "user", str(user.id),
        details={"email": user.email}, request=request,
        user_id=user.id, user_email=user.email
    )
    await db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "organization_id": str(user.organization_id)
        }
    }

@router.post("/refresh")
async def refresh_tokens(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    # Read refresh token from HttpOnly cookie or Authorization header
    raw_token = request.cookies.get("wfv_refresh")
    if not raw_token:
        # Check authorization header fallback
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            raw_token = auth_header.split(" ")[1]

    if not raw_token:
        raise AppException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="refresh_token_missing",
            message="Refresh token topilmadi"
        )

    token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    db_token = result.scalars().first()

    now = datetime.now(timezone.utc)
    if not db_token:
        raise AppException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="invalid_refresh_token",
            message="Refresh token yaroqsiz"
        )

    # Token Reuse Detection (Security: if already used, revoke entire token family!)
    if db_token.used_at is not None or db_token.is_revoked:
        # Revoke whole family
        await db.execute(
            update(RefreshToken)
            .where(RefreshToken.family_id == db_token.family_id)
            .values(is_revoked=True)
        )
        await db.commit()
        response.delete_cookie("wfv_refresh")
        raise AppException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="token_reused_attack_detected",
            message="Xavfsizlik ogohlantirishi: Token qayta ishlatilishi aniqlandi. Sessiya bekor qilindi."
        )

    if db_token.expires_at < now:
        db_token.is_revoked = True
        await db.commit()
        raise AppException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="refresh_token_expired",
            message="Sessiya muddati tugadi. Qaytadan tizimga kiring."
        )

    # Mark current token as used
    db_token.used_at = now
    
    # Load user
    u_result = await db.execute(select(User).where(User.id == db_token.user_id, User.is_active == True))
    user = u_result.scalars().first()
    if not user:
        raise AppException(status_code=401, code="user_inactive", message="Foydalanuvchi hisobi faol emas")

    # Issue new rotated refresh token with the same family_id
    new_refresh = await issue_refresh_token(db, user.id, family_id=db_token.family_id)
    new_access = create_access_token(str(user.id), user.role, str(user.organization_id))

    response.set_cookie(
        key="wfv_refresh",
        value=new_refresh,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=30 * 24 * 3600
    )

    return {
        "access_token": new_access,
        "refresh_token": new_refresh
    }

@router.post("/logout")
async def logout(response: Response, request: Request, current_user: User = Depends(require_authenticated), db: AsyncSession = Depends(get_db)):
    raw_token = request.cookies.get("wfv_refresh")
    if raw_token:
        token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
        await db.execute(
            update(RefreshToken)
            .where(RefreshToken.token_hash == token_hash)
            .values(is_revoked=True)
        )
        await db.commit()

    response.delete_cookie("wfv_refresh")
    await log_audit_event(
        db, current_user.organization_id, "user_logout", "user", str(current_user.id),
        request=request, user_id=current_user.id, user_email=current_user.email
    )
    await db.commit()
    return {"message": "Muvaffaqiyatli chiqildi"}

@router.post("/2fa/setup", response_model=Setup2FAResponse)
async def setup_2fa(current_user: User = Depends(require_authenticated)):
    secret = generate_totp_secret()
    otpauth_url = get_totp_uri(secret, current_user.email)
    # Generate 5 backup codes
    backup_codes = [os.urandom(4).hex() for _ in range(5)]
    return Setup2FAResponse(
        secret=secret,
        otpauth_url=otpauth_url,
        backup_codes=backup_codes
    )

@router.post("/2fa/confirm")
async def confirm_2fa(req: Confirm2FARequest, request: Request, current_user: User = Depends(require_authenticated), db: AsyncSession = Depends(get_db)):
    if not verify_totp(req.secret, req.code):
        raise AppException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="invalid_2fa_code",
            message="Kiritilgan 6 xonali tasdiqlash kodi noto'g'ri"
        )

    # Encrypt TOTP secret before saving to DB
    encrypted_secret = encrypt_data(req.secret)
    current_user.two_factor_secret = encrypted_secret
    await log_audit_event(
        db, current_user.organization_id, "2fa_enabled", "user", str(current_user.id),
        request=request, user_id=current_user.id, user_email=current_user.email
    )
    await db.commit()
    return {"message": "Ikki bosqichli autentifikatsiya muvaffaqiyatli faollashtirildi"}
