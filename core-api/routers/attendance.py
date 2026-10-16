import uuid
import pytz
from datetime import datetime, date, time, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from database import get_db
from models import AttendanceDay, AttendanceEvent, Employee, Camera, Organization, User
from schemas import AttendanceRecordResponse, TimelineEventResponse
from deps import require_authenticated, get_current_org, get_current_user
from errors import AppException
from attendance_service import get_org_current_date, to_org_timezone

router = APIRouter(tags=["Attendance"])

def parse_uuid(id_str: str) -> uuid.UUID:
    try:
        return uuid.UUID(id_str)
    except (ValueError, TypeError):
        raise AppException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="invalid_uuid",
            message="Noto'g'ri identifikator (UUID)"
        )

@router.get("/attendance", response_model=List[AttendanceRecordResponse])
async def get_attendance(
    date_str: Optional[str] = Query(None, alias="date"),
    employee_id: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(require_authenticated),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns daily attendance records for the given date (default: today in org timezone).
    """
    if date_str:
        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            raise AppException(status_code=400, code="invalid_date", message="Sana YYYY-MM-DD formatida bo'lishi kerak")
    else:
        target_date = get_org_current_date(org.timezone)

    stmt = (
        select(AttendanceDay, Employee)
        .join(Employee, AttendanceDay.employee_id == Employee.id)
        .where(
            AttendanceDay.organization_id == current_user.organization_id,
            AttendanceDay.date == target_date
        )
    )

    if employee_id:
        emp_uuid = parse_uuid(employee_id)
        stmt = stmt.where(AttendanceDay.employee_id == emp_uuid)

    if status_filter:
        stmt = stmt.where(AttendanceDay.status == status_filter)

    result = await db.execute(stmt)
    records = result.all()

    out = []
    for att, emp in records:
        first_s = to_org_timezone(att.first_seen, org.timezone).strftime("%H:%M:%S") if att.first_seen else None
        last_s = to_org_timezone(att.last_seen, org.timezone).strftime("%H:%M:%S") if att.last_seen else None
        out.append(
            AttendanceRecordResponse(
                id=str(att.id),
                employee_id=str(emp.id),
                employee_name=f"{emp.first_name} {emp.last_name}",
                date=att.date.strftime("%Y-%m-%d"),
                first_seen=first_s,
                last_seen=last_s,
                status=att.status,
                late_minutes=att.late_minutes,
                total_present_minutes=att.total_present_minutes
            )
        )
    return out

@router.get("/employees/{id}/timeline", response_model=List[TimelineEventResponse])
async def get_employee_timeline(
    id: str,
    date_str: Optional[str] = Query(None, alias="date"),
    current_user: User = Depends(require_authenticated),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns timeline of detection events for the employee strictly on the specified date.
    Fixes Flaw #18: Date parameter is now strictly enforced!
    """
    emp_uuid = parse_uuid(id)
    if date_str:
        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            raise AppException(status_code=400, code="invalid_date", message="Sana YYYY-MM-DD formatida bo'lishi kerak")
    else:
        target_date = get_org_current_date(org.timezone)

    tz = pytz.timezone(org.timezone or "Asia/Tashkent")
    day_start = tz.localize(datetime.combine(target_date, time(0, 0, 0))).astimezone(timezone.utc)
    day_end = tz.localize(datetime.combine(target_date, time(23, 59, 59, 999999))).astimezone(timezone.utc)

    stmt = (
        select(AttendanceEvent, Camera)
        .outerjoin(Camera, AttendanceEvent.camera_id == Camera.id)
        .where(
            AttendanceEvent.employee_id == emp_uuid,
            AttendanceEvent.organization_id == current_user.organization_id,
            AttendanceEvent.occurred_at >= day_start,
            AttendanceEvent.occurred_at <= day_end
        )
        .order_by(AttendanceEvent.occurred_at.asc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    out = []
    for ev, cam in rows:
        local_dt = to_org_timezone(ev.occurred_at, org.timezone)
        out.append(
            TimelineEventResponse(
                id=str(ev.id),
                employee_id=str(ev.employee_id),
                camera_id=str(cam.id) if cam else None,
                camera_name=cam.name if cam else "Noma'lum kamera",
                timestamp=local_dt.strftime("%H:%M:%S"),
                event_type=ev.event_type,
                confidence=round(ev.confidence, 2)
            )
        )
    return out
