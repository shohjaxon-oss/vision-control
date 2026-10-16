import uuid
from typing import List, Optional
from fastapi import Depends, Request, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import User, Organization
from security import decode_token, verify_service_signature
from errors import AppException

security_scheme = HTTPBearer(auto_error=False)

async def get_current_user(
    request: Request,
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    # Also support query parameter token for SSE stream if Authorization header not available
    token = None
    if creds and creds.credentials:
        token = creds.credentials
    elif "token" in request.query_params:
        token = request.query_params["token"]

    if not token:
        raise AppException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="not_authenticated",
            message="Tizimga kirish talab etiladi (avtorizatsiya tokeni topilmadi)"
        )

    payload = decode_token(token, expected_typ="access", expected_aud="wfv-api")
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise AppException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="invalid_token",
            message="Token formati noto'g'ri"
        )

    try:
        user_uuid = uuid.UUID(user_id_str)
    except ValueError:
        raise AppException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="invalid_token",
            message="Yaroqsiz foydalanuvchi identifikatori"
        )

    result = await db.execute(select(User).where(User.id == user_uuid, User.is_active == True))
    user = result.scalars().first()
    if not user:
        raise AppException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="user_not_found",
            message="Foydalanuvchi topilmadi yoki hisob faol emas"
        )

    # Attach current user to request state for audit logs
    request.state.user = user
    return user

def require_role(allowed_roles: List[str]):
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise AppException(
                status_code=status.HTTP_403_FORBIDDEN,
                code="permission_denied",
                message=f"Ushbu amalni bajarish uchun ruxsat yetarli emas (Talab qilinadigan rol: {', '.join(allowed_roles)})"
            )
        return current_user
    return role_checker

# Predefined role shortcuts:
# M+ = Manager or Owner
require_manager_plus = require_role(["owner", "manager"])
# O = Owner only
require_owner = require_role(["owner"])
# Any active user
require_authenticated = get_current_user

async def get_current_org(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Organization:
    result = await db.execute(select(Organization).where(Organization.id == current_user.organization_id))
    org = result.scalars().first()
    if not org:
        raise AppException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="organization_not_found",
            message="Tashkilot ma'lumotlari topilmadi"
        )
    return org

async def verify_internal_service(
    request: Request,
    x_service_signature: Optional[str] = Header(None, alias="X-Service-Signature"),
    x_service_timestamp: Optional[str] = Header(None, alias="X-Service-Timestamp")
):
    if not x_service_signature or not x_service_timestamp:
        raise AppException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="service_auth_missing",
            message="Ichki servis autentifikatsiya sarlavhalari kiritilmadi"
        )

    body_bytes = await request.body()
    path = request.url.path
    method = request.method

    if not verify_service_signature(method, path, x_service_timestamp, x_service_signature, body_bytes):
        raise AppException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="invalid_service_signature",
            message="Ichki servis HMAC imzosi yaroqsiz yoki muddati o'tgan"
        )
    return True
