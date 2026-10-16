import uuid
import pytz
from datetime import datetime, date, time, timedelta, timezone
from typing import Optional, List, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from models import AttendanceEvent, AttendanceDay, Employee, Organization, Camera

def get_org_current_date(org_tz_name: str = "Asia/Tashkent") -> date:
    tz = pytz.timezone(org_tz_name or "Asia/Tashkent")
    return datetime.now(tz).date()

def to_org_timezone(dt: datetime, org_tz_name: str = "Asia/Tashkent") -> datetime:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    tz = pytz.timezone(org_tz_name or "Asia/Tashkent")
    return dt.astimezone(tz)

async def recalculate_attendance_day(
    db: AsyncSession,
    org: Organization,
    employee: Employee,
    target_date: date
) -> AttendanceDay:
    """
    Idempotent calculation of attendance_days record for a given employee and date.
    Calculated strictly in Organization's local timezone (e.g. Asia/Tashkent).
    1. Entrance camera first detection -> first_seen
    2. Exit camera last detection -> last_seen
    3. Late minutes relative to org.shift_start
    """
    tz = pytz.timezone(org.timezone or "Asia/Tashkent")
    # Date bounds in org local timezone converted to UTC for DB filtering
    local_day_start = tz.localize(datetime.combine(target_date, time(0, 0, 0)))
    local_day_end = tz.localize(datetime.combine(target_date, time(23, 59, 59, 999999)))
    utc_start = local_day_start.astimezone(timezone.utc)
    utc_end = local_day_end.astimezone(timezone.utc)

    # Fetch all events of this employee on this date ordered by occurred_at
    stmt = (
        select(AttendanceEvent, Camera)
        .outerjoin(Camera, AttendanceEvent.camera_id == Camera.id)
        .where(
            AttendanceEvent.employee_id == employee.id,
            AttendanceEvent.occurred_at >= utc_start,
            AttendanceEvent.occurred_at <= utc_end
        )
        .order_by(AttendanceEvent.occurred_at.asc())
    )
    result = await db.execute(stmt)
    events_with_cams = result.all()

    # Find or create AttendanceDay record
    day_stmt = select(AttendanceDay).where(
        AttendanceDay.employee_id == employee.id,
        AttendanceDay.date == target_date
    )
    att_day = (await db.execute(day_stmt)).scalars().first()
    if not att_day:
        att_day = AttendanceDay(
            organization_id=org.id,
            employee_id=employee.id,
            date=target_date,
            status="absent",
            late_minutes=0,
            total_present_minutes=0
        )
        db.add(att_day)

    if not events_with_cams:
        att_day.status = "absent"
        att_day.first_seen = None
        att_day.last_seen = None
        att_day.late_minutes = 0
        att_day.total_present_minutes = 0
        return att_day

    # 1. Determine first_seen and last_seen
    # Preference: first seen at entrance camera, else earliest event
    entrance_events = [ev for ev, cam in events_with_cams if cam and cam.type == "entrance"]
    first_event = entrance_events[0] if entrance_events else events_with_cams[0][0]

    exit_events = [ev for ev, cam in events_with_cams if cam and cam.type == "exit"]
    last_event = exit_events[-1] if exit_events else events_with_cams[-1][0]

    att_day.first_seen = first_event.occurred_at
    att_day.last_seen = last_event.occurred_at if len(events_with_cams) > 1 else first_event.occurred_at
    att_day.status = "present"

    # 2. Late minutes calculation
    shift_start_local = tz.localize(datetime.combine(target_date, org.shift_start or time(9, 0, 0)))
    first_seen_local = to_org_timezone(first_event.occurred_at, org.timezone)

    if first_seen_local > shift_start_local:
        late_delta = first_seen_local - shift_start_local
        att_day.late_minutes = int(late_delta.total_seconds() / 60)
    else:
        att_day.late_minutes = 0

    # 3. Present duration calculation
    if att_day.last_seen and att_day.first_seen:
        duration = att_day.last_seen - att_day.first_seen
        att_day.total_present_minutes = max(0, int(duration.total_seconds() / 60))
    else:
        att_day.total_present_minutes = 0

    return att_day
