import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import UnknownFace, Camera, Employee, User
from schemas import UnknownFaceResponse, ResolveUnknownFaceRequest
from deps import require_manager_plus
from errors import AppException
from audit import log_audit_event

router = APIRouter(prefix="/unknown-faces", tags=["Unknown Faces"])

def parse_uuid(id_str: str) -> uuid.UUID:
    try:
        return uuid.UUID(id_str)
    except (ValueError, TypeError):
        raise AppException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="invalid_uuid",
            message="Noto'g'ri identifikator (UUID)"
        )

@router.get("", response_model=List[UnknownFaceResponse])
async def list_unknown_faces(
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(require_manager_plus),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(UnknownFace, Camera)
        .outerjoin(Camera, UnknownFace.camera_id == Camera.id)
        .where(UnknownFace.organization_id == current_user.organization_id)
        .order_by(UnknownFace.occurred_at.desc())
        .limit(50)
    )

    if status_filter:
        stmt = stmt.where(UnknownFace.resolution == status_filter)

    result = await db.execute(stmt)
    rows = result.all()

    return [
        UnknownFaceResponse(
            id=str(uf.id),
            snapshot_url=f"/api/v1/unknown-faces/{uf.id}/snapshot",
            detected_at=uf.occurred_at.strftime("%H:%M:%S"),
            camera_id=str(cam.id) if cam else None,
            camera_name=cam.name if cam else "Kamera",
            resolution=uf.resolution
        )
        for uf, cam in rows
    ]

@router.post("/{id}/resolve")
async def resolve_unknown_face(
    id: str,
    req: ResolveUnknownFaceRequest,
    request: Request,
    current_user: User = Depends(require_manager_plus),
    db: AsyncSession = Depends(get_db)
):
    uf_uuid = parse_uuid(id)
    stmt = (
        select(UnknownFace)
        .where(
            UnknownFace.id == uf_uuid,
            UnknownFace.organization_id == current_user.organization_id
        )
    )
    uf = (await db.execute(stmt)).scalars().first()
    if not uf:
        raise AppException(status_code=404, code="face_not_found", message="Noma'lum shaxs yuzi topilmadi")

    now = datetime.now(timezone.utc)

    if req.action == "link":
        if not req.employee_id:
            raise AppException(
                status_code=status.HTTP_400_BAD_REQUEST,
                code="employee_id_required",
                message="Shaxsni bog'lash uchun 'employee_id' ko'rsatilishi shart"
            )

        emp_uuid = parse_uuid(req.employee_id)
        e_stmt = (
            select(Employee)
            .where(Employee.id == emp_uuid, Employee.organization_id == current_user.organization_id)
        )
        emp = (await db.execute(e_stmt)).scalars().first()
        if not emp:
            raise AppException(status_code=404, code="employee_not_found", message="Ko'rsatilgan xodim topilmadi")

        if emp.consent_status != "granted":
            raise AppException(
                status_code=status.HTTP_409_CONFLICT,
                code="consent_not_granted",
                message="Xodim biometrik rozilik bermagan! Noma'lum shaxsni roziligi bo'lmagan xodimga bog'lash qonunan taqiqlanadi (ZRU-1125)."
            )

        uf.resolution = "linked"
        uf.resolved_employee_id = emp.id
        uf.resolved_at = now
    elif req.action == "guest":
        uf.resolution = "guest"
        uf.resolved_at = now
    elif req.action == "ignore":
        uf.resolution = "ignored"
        uf.resolved_at = now

    await log_audit_event(
        db, current_user.organization_id, f"unknown_face_resolved_{req.action}", "unknown_face", str(uf.id),
        details={"action": req.action, "employee_id": req.employee_id},
        request=request, user_id=current_user.id, user_email=current_user.email
    )
    await db.commit()
    return {"status": "success", "resolution": uf.resolution}
