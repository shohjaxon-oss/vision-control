import uuid
from typing import List
from fastapi import APIRouter, Depends, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import User
from schemas import UserResponse, UserCreate, UserUpdate
from security import get_password_hash
from deps import require_authenticated, require_owner, get_current_user
from errors import AppException
from audit import log_audit_event

router = APIRouter(tags=["Users"])

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(require_authenticated)):
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        name=current_user.name,
        role=current_user.role,
        organization_id=str(current_user.organization_id),
        is_active=current_user.is_active
    )

@router.get("/users", response_model=List[UserResponse])
async def list_users(current_user: User = Depends(require_owner), db: AsyncSession = Depends(get_db)):
    stmt = (
        select(User)
        .where(User.organization_id == current_user.organization_id)
        .order_by(User.created_at.asc())
    )
    result = await db.execute(stmt)
    users = result.scalars().all()
    return [
        UserResponse(
            id=str(u.id),
            email=u.email,
            name=u.name,
            role=u.role,
            organization_id=str(u.organization_id),
            is_active=u.is_active
        )
        for u in users
    ]

@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    req: UserCreate,
    request: Request,
    current_user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db)
):
    # Check email uniqueness
    stmt = select(User).where(User.email == req.email)
    existing = (await db.execute(stmt)).scalars().first()
    if existing:
        raise AppException(
            status_code=status.HTTP_409_CONFLICT,
            code="user_email_exists",
            message="Ushbu elektron pochta manzili bilan ro'yxatdan o'tgan foydalanuvchi allaqachon mavjud"
        )

    new_user = User(
        organization_id=current_user.organization_id,
        email=req.email,
        password_hash=get_password_hash(req.password),
        name=req.name,
        role=req.role,
        is_active=True
    )
    db.add(new_user)
    await db.flush()

    await log_audit_event(
        db, current_user.organization_id, "user_created", "user", str(new_user.id),
        details={"email": new_user.email, "role": new_user.role}, request=request,
        user_id=current_user.id, user_email=current_user.email
    )
    await db.commit()
    await db.refresh(new_user)

    return UserResponse(
        id=str(new_user.id),
        email=new_user.email,
        name=new_user.name,
        role=new_user.role,
        organization_id=str(new_user.organization_id),
        is_active=new_user.is_active
    )

@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    req: UserUpdate,
    request: Request,
    current_user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db)
):
    try:
        target_uuid = uuid.UUID(user_id)
    except ValueError:
        raise AppException(status_code=400, code="invalid_uuid", message="Noto'g'ri foydalanuvchi ID formati")

    stmt = select(User).where(User.id == target_uuid, User.organization_id == current_user.organization_id)
    target_user = (await db.execute(stmt)).scalars().first()
    if not target_user:
        raise AppException(status_code=404, code="user_not_found", message="Foydalanuvchi topilmadi")

    if req.name is not None:
        target_user.name = req.name
    if req.role is not None:
        target_user.role = req.role
    if req.is_active is not None:
        target_user.is_active = req.is_active

    await log_audit_event(
        db, current_user.organization_id, "user_updated", "user", str(target_user.id),
        details=req.model_dump(exclude_unset=True), request=request,
        user_id=current_user.id, user_email=current_user.email
    )
    await db.commit()
    await db.refresh(target_user)

    return UserResponse(
        id=str(target_user.id),
        email=target_user.email,
        name=target_user.name,
        role=target_user.role,
        organization_id=str(target_user.organization_id),
        is_active=target_user.is_active
    )
