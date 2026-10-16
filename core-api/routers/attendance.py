import uuid
from datetime import datetime, date as date_type, time, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import AttendanceDay, AttendanceEvent, Employee, Camera
from schemas import AttendanceRecordResponse, TimelineEventResponse

router = APIRouter(tags=["Attendance"])

@router.get("/attendance", response_model=List[AttendanceRecordResponse])
async def get_attendance(
    date: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    target_date = datetime.strptime(date, "%Y-%m-%d").date() if date else datetime.now(timezone.utc).date()
    
    # Query employees and attendance day records
    emp_result = await db.execute(select(Employee).where(Employee.is_active == True))
    employees = emp_result.scalars().all()
    
    att_result = await db.execute(select(AttendanceDay).where(AttendanceDay.date == target_date))
    records = {str(r.employee_id): r for r in att_result.scalars().all()}
    
    out = []
    for emp in employees:
        r = records.get(str(emp.id))
        if r:
            out.append(
                AttendanceRecordResponse(
                    id=str(r.id),
                    employee_id=str(emp.id),
                    employee_name=f"{emp.first_name} {emp.last_name}",
                    date=target_date,
                    first_seen=r.first_seen,
                    last_seen=r.last_seen,
                    status=r.status,
                    late_minutes=r.late_minutes,
                    total_present_minutes=r.total_present_minutes
                )
            )
        else:
            # Default placeholder state
            out.append(
                AttendanceRecordResponse(
                    id=f"att-{emp.id}",
                    employee_id=str(emp.id),
                    employee_name=f"{emp.first_name} {emp.last_name}",
                    date=target_date,
                    first_seen=None,
                    last_seen=None,
                    status="absent",
                    late_minutes=0,
                    total_present_minutes=0
                )
            )
    return out

@router.get("/employees/{id}/timeline", response_model=List[TimelineEventResponse])
async def get_timeline(
    id: str,
    date: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    emp_uuid = uuid.UUID(id)
    target_date = datetime.strptime(date, "%Y-%m-%d").date() if date else datetime.now(timezone.utc).date()
    
    result = await db.execute(
        select(AttendanceEvent, Camera.name)
        .outerjoin(Camera, AttendanceEvent.camera_id == Camera.id)
        .where(AttendanceEvent.employee_id == emp_uuid)
        .order_by(AttendanceEvent.occurred_at.asc())
    )
    rows = result.all()
    out = []
    for event, cam_name in rows:
        out.append(
            TimelineEventResponse(
                id=str(event.id),
                employee_id=str(event.employee_id),
                camera_id=str(event.camera_id) if event.camera_id else None,
                camera_name=cam_name or "Noma'lum kamera",
                timestamp=event.occurred_at,
                event_type=event.event_type,
                confidence=event.confidence
            )
        )
    return out
