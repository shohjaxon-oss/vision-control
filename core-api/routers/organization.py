import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from database import get_db
from models import Organization, AuditLog, User
from schemas import OrganizationResponse, OrganizationUpdate, AuditLogResponse
from deps import require_owner, require_authenticated, get_current_org
from errors import AppException
from audit import log_audit_event

router = APIRouter(tags=["Organization & System"])

@router.get("/organization", response_model=OrganizationResponse)
async def get_organization_settings(
    org: Organization = Depends(get_current_org)
):
    return OrganizationResponse(
        id=str(org.id),
        name=org.name,
        timezone=org.timezone,
        shift_start=org.shift_start.strftime("%H:%M:%S") if org.shift_start else "09:00:00",
        shift_end=org.shift_end.strftime("%H:%M:%S") if org.shift_end else "18:00:00",
        retention_days=org.retention_days
    )

@router.patch("/organization", response_model=OrganizationResponse)
async def update_organization_settings(
    req: OrganizationUpdate,
    request: Request,
    current_user: User = Depends(require_owner),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db)
):
    if req.name is not None:
        org.name = req.name
    if req.timezone is not None:
        org.timezone = req.timezone
    if req.shift_start is not None:
        try:
            org.shift_start = datetime.strptime(req.shift_start, "%H:%M:%S").time()
        except ValueError:
            raise AppException(status_code=400, code="invalid_time", message="Smena boshlanish vaqti HH:MM:SS formatida bo'lishi kerak")
    if req.shift_end is not None:
        try:
            org.shift_end = datetime.strptime(req.shift_end, "%H:%M:%S").time()
        except ValueError:
            raise AppException(status_code=400, code="invalid_time", message="Smena tugash vaqti HH:MM:SS formatida bo'lishi kerak")
    if req.retention_days is not None:
        org.retention_days = req.retention_days

    await log_audit_event(
        db, org.id, "organization_updated", "organization", str(org.id),
        details=req.model_dump(exclude_unset=True), request=request,
        user_id=current_user.id, user_email=current_user.email
    )
    await db.commit()
    await db.refresh(org)

    return OrganizationResponse(
        id=str(org.id),
        name=org.name,
        timezone=org.timezone,
        shift_start=org.shift_start.strftime("%H:%M:%S"),
        shift_end=org.shift_end.strftime("%H:%M:%S"),
        retention_days=org.retention_days
    )

@router.get("/audit-logs", response_model=List[AuditLogResponse])
async def list_audit_logs(
    current_user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(AuditLog)
        .where(AuditLog.organization_id == current_user.organization_id)
        .order_by(desc(AuditLog.created_at))
        .limit(100)
    )
    result = await db.execute(stmt)
    logs = result.scalars().all()

    return [
        AuditLogResponse(
            id=str(log.id),
            user_email=log.user_email,
            action=log.action,
            entity=log.entity,
            entity_id=log.entity_id,
            details=log.details,
            ip_address=log.ip_address,
            created_at=log.created_at.isoformat()
        )
        for log in logs
    ]
