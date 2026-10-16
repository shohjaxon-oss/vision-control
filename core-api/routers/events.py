import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import FileResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import AttendanceEvent, User
from schemas import EventFeedbackRequest
from deps import require_manager_plus, get_current_user
from errors import AppException
from audit import log_audit_event

router = APIRouter(prefix="/events", tags=["Events & Snapshots"])

def parse_uuid(id_str: str) -> uuid.UUID:
    try:
        return uuid.UUID(id_str)
    except (ValueError, TypeError):
        raise AppException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="invalid_uuid",
            message="Noto'g'ri hodisa identifikatori (UUID)"
        )

@router.get("/{id}/snapshot")
async def get_event_snapshot(
    id: str,
    request: Request,
    current_user: User = Depends(require_manager_plus), # Observer blocked!
    db: AsyncSession = Depends(get_db)
):
    """
    Authenticated snapshot access:
    - Observers are forbidden (403).
    - Every single access is strictly audited in AuditLog with IP and user credentials.
    """
    event_uuid = parse_uuid(id)
    stmt = (
        select(AttendanceEvent)
        .where(
            AttendanceEvent.id == event_uuid,
            AttendanceEvent.organization_id == current_user.organization_id
        )
    )
    event = (await db.execute(stmt)).scalars().first()
    if not event or not event.snapshot_path:
        raise AppException(
            status_code=404,
            code="snapshot_not_found",
            message="Ushbu hodisaga tegishli snapshot fayli topilmadi yoki o'chirilgan"
        )

    if not os.path.exists(event.snapshot_path):
        raise AppException(
            status_code=404,
            code="snapshot_file_missing",
            message="Snapshot fayli saqlash tizimida mavjud emas"
        )

    # Audit snapshot access
    await log_audit_event(
        db, current_user.organization_id, "snapshot_viewed", "attendance_event", str(event.id),
        details={"snapshot_path": event.snapshot_path},
        request=request, user_id=current_user.id, user_email=current_user.email
    )
    await db.commit()

    return FileResponse(event.snapshot_path, media_type="image/jpeg")

@router.post("/{id}/feedback")
async def submit_feedback(
    id: str,
    req: EventFeedbackRequest,
    request: Request,
    current_user: User = Depends(require_manager_plus),
    db: AsyncSession = Depends(get_db)
):
    event_uuid = parse_uuid(id)
    stmt = (
        select(AttendanceEvent)
        .where(
            AttendanceEvent.id == event_uuid,
            AttendanceEvent.organization_id == current_user.organization_id
        )
    )
    event = (await db.execute(stmt)).scalars().first()
    if not event:
        raise AppException(status_code=404, code="event_not_found", message="Hodisa topilmadi")

    event.reviewed = True
    event.feedback = req.correct

    await log_audit_event(
        db, current_user.organization_id, "event_feedback_submitted", "attendance_event", str(event.id),
        details={"correct": req.correct},
        request=request, user_id=current_user.id, user_email=current_user.email
    )
    await db.commit()
    return {"status": "success", "message": "Fikr-mulohaza qabul qilindi"}
