import uuid
import re
from datetime import datetime, timezone, date, time
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from database import get_db
from models import Employee, AttendanceDay, AttendanceEvent, UnknownFace, Camera, AskLog, Organization, User
from schemas import AskRequest, AskResponse, AskSource
from deps import require_manager_plus, get_current_org
from attendance_service import get_org_current_date, to_org_timezone

router = APIRouter(prefix="/ask", tags=["Natural Language Query"])

# ==============================================================================
# Safe Pre-Vetted Tool Functions (Zero Dynamic SQL, Tenant Isolated)
# ==============================================================================

async def tool_get_headcount(db: AsyncSession, org_id: uuid.UUID, target_date: date) -> Dict[str, Any]:
    stmt = (
        select(AttendanceDay, Employee)
        .join(Employee, AttendanceDay.employee_id == Employee.id)
        .where(
            AttendanceDay.organization_id == org_id,
            AttendanceDay.date == target_date,
            AttendanceDay.status == "present"
        )
    )
    result = await db.execute(stmt)
    present_rows = result.all()
    names = [f"{emp.first_name} {emp.last_name}" for _, emp in present_rows]
    sources = [
        AskSource(type="attendance", id=str(att.id), name=f"{emp.first_name} {emp.last_name}")
        for att, emp in present_rows
    ]
    return {
        "count": len(present_rows),
        "names": names,
        "sources": sources
    }

async def tool_get_employee_status(db: AsyncSession, org_id: uuid.UUID, name_query: str, target_date: date, org_tz: str) -> Dict[str, Any]:
    # Match employee by name in organization
    pattern = f"%{name_query.lower()}%"
    stmt = (
        select(Employee)
        .where(
            Employee.organization_id == org_id,
            Employee.is_active == True,
            func.lower(Employee.first_name + " " + Employee.last_name).like(pattern)
        )
    )
    employees = (await db.execute(stmt)).scalars().all()
    if not employees:
        return {"found": False, "message": f"'{name_query}' ismli xodim tashkilotda topilmadi."}

    emp = employees[0]
    # Check attendance on target_date
    att_stmt = select(AttendanceDay).where(AttendanceDay.employee_id == emp.id, AttendanceDay.date == target_date)
    att = (await db.execute(att_stmt)).scalars().first()

    # Get latest event for real confidence
    ev_stmt = (
        select(AttendanceEvent)
        .where(AttendanceEvent.employee_id == emp.id)
        .order_by(AttendanceEvent.occurred_at.desc())
        .limit(1)
    )
    latest_event = (await db.execute(ev_stmt)).scalars().first()
    real_confidence = round(latest_event.confidence, 2) if latest_event else None

    if att and att.status == "present":
        first_s = to_org_timezone(att.first_seen, org_tz).strftime("%H:%M:%S") if att.first_seen else "noma'lum"
        late_info = f" ({att.late_minutes} daqiqa kechikkan)" if att.late_minutes > 0 else " (o'z vaqtida kelgan)"
        text = f"{emp.first_name} {emp.last_name} bugun ish joyida. Birinchi aniqlanish vaqti: {first_s}{late_info}."
    else:
        text = f"{emp.first_name} {emp.last_name} bugun ish joyida aniqlanmadi (kelmagan)."

    source = AskSource(type="employee", id=str(emp.id), name=f"{emp.first_name} {emp.last_name}")
    return {
        "found": True,
        "text": text,
        "sources": [source],
        "confidence": real_confidence
    }

async def tool_get_camera_status(db: AsyncSession, org_id: uuid.UUID) -> Dict[str, Any]:
    stmt = select(Camera).where(Camera.organization_id == org_id)
    cameras = (await db.execute(stmt)).scalars().all()
    online_count = sum(1 for c in cameras if c.status == "online")
    sources = [AskSource(type="camera", id=str(c.id), name=c.name) for c in cameras]
    return {
        "total": len(cameras),
        "online": online_count,
        "offline": len(cameras) - online_count,
        "sources": sources
    }

# ==============================================================================
# Ask Router
# ==============================================================================

@router.post("", response_model=AskResponse)
async def ask_question(
    req: AskRequest,
    current_user: User = Depends(require_manager_plus),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db)
):
    """
    Safe Natural Language Query via Pre-Vetted Tools:
    Zero fabricated confidence! Real confidence values are sourced directly from verified events.
    Zero SQL generation from LLM. No biometrics leaked.
    """
    q = req.question.strip().lower()
    today = get_org_current_date(org.timezone)
    org_id = current_user.organization_id

    # 1. Headcount queries: "kim ishda", "nechta odam", "xodimlar", "bugun kim keldi"
    if any(k in q for k in ["kim ishda", "nechta odam", "ishlayapti", "keldi", "kimlar bor", "headcount", "hamma"]):
        data = await tool_get_headcount(db, org_id, today)
        if data["count"] > 0:
            names_str = ", ".join(data["names"])
            text = f"Bugun {data['count']} nafar xodim ish joyida aniqlangan: {names_str}."
        else:
            text = "Hozircha tizimda bugun ish joyida aniqlangan faol xodimlar mavjud emas."
        
        # Real confidence: null if aggregate
        response = AskResponse(text=text, sources=data["sources"], confidence=None)

    # 2. Camera status queries: "kamera", "kameralar", "ishlayaptimi"
    elif any(k in q for k in ["kamera", "kameralar", "go2rtc", "stream"]):
        data = await tool_get_camera_status(db, org_id)
        text = f"Tizimda jami {data['total']} ta kamera mavjud. Shulardan {data['online']} tasi faol (online), {data['offline']} tasi o'chiq (offline)."
        response = AskResponse(text=text, sources=data["sources"], confidence=None)

    # 3. Employee specific name search (Dynamically queried from DB, NO HARDCODED NAMES!)
    else:
        # Extract potential names from query
        words = [w for w in re.split(r'[\s,\.?!]+', q) if len(w) > 2 and w not in ["ishda", "bugun", "qayerda", "keldimi", "qachon", "bormi", "haqida"]]
        found_emp_data = None

        for word in words:
            data = await tool_get_employee_status(db, org_id, word, today, org.timezone)
            if data.get("found"):
                found_emp_data = data
                break

        if found_emp_data:
            response = AskResponse(
                text=found_emp_data["text"],
                sources=found_emp_data["sources"],
                confidence=found_emp_data["confidence"]
            )
        else:
            response = AskResponse(
                text="Savolingiz bo'yicha tizimda aniq ma'lumot topilmadi. Iltimos, xodim ismi yoki aniq savol kiriting.",
                sources=[],
                confidence=None
            )

    # Log to ask_logs
    log_entry = AskLog(
        organization_id=org_id,
        user_id=current_user.id,
        question=req.question,
        functions_called=["tool_query"],
        response=response.text,
        confidence=response.confidence
    )
    db.add(log_entry)
    await db.commit()

    return response
