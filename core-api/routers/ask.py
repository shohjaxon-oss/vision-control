from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import get_db
from models import Employee, AttendanceDay, UnknownFace, Camera, AskLog
from schemas import AskRequest, AskResponse, AskSource

router = APIRouter(prefix="/ask", tags=["Natural Language Query"])

@router.post("", response_model=AskResponse)
async def ask_question(req: AskRequest, db: AsyncSession = Depends(get_db)):
    """
    Safe Tool-Calling NL Query Service:
    Executes pre-vetted safe read functions. Raw biometrics and credentials never leak.
    """
    q = req.question.strip().lower()
    today = datetime.now(timezone.utc).date()
    sources: List[AskSource] = []

    # 1. "Kim ishda / Hozir nechta odam ishlayapti / Headcount"
    if any(k in q for k in ["kim ishda", "nechta odam", "ishlayapti", "xodimlar", "kimlar bor", "headcount"]):
        result = await db.execute(
            select(AttendanceDay, Employee)
            .join(Employee, AttendanceDay.employee_id == Employee.id)
            .where(AttendanceDay.date == today, AttendanceDay.status == "present")
        )
        present_rows = result.all()
        names = [f"{emp.first_name} {emp.last_name}" for _, emp in present_rows]
        
        for att, emp in present_rows:
            sources.append(AskSource(type="attendance", id=str(att.id), name=f"{emp.first_name} {emp.last_name}"))

        if present_rows:
            names_str = ", ".join(names)
            text = f"Bugun smenada {len(present_rows)} nafar xodim ish joyida aniqlangan: {names_str}."
            confidence = 0.96
        else:
            text = "Hozircha tizimda bugun ish joyida aniqlangan faol xodimlar topilmadi."
            confidence = 0.90

    # 2. Xodim nomi bo'yicha qidiruv (masalan: "Bekzod keldimi?", "Aziza qayerda?")
    elif any(name in q for name in ["bekzod", "aziza", "jasur", "nilufar", "dilnoza", "sherzod", "otabek"]):
        target_name = None
        for name in ["bekzod", "aziza", "jasur", "nilufar", "dilnoza", "sherzod", "otabek"]:
            if name in q:
                target_name = name
                break

        emp_result = await db.execute(
            select(Employee).where(func.lower(Employee.first_name) == target_name)
        )
        emp = emp_result.scalars().first()

        if emp:
            att_result = await db.execute(
                select(AttendanceDay).where(AttendanceDay.employee_id == emp.id, AttendanceDay.date == today)
            )
            att = att_result.scalars().first()
            if att and att.first_seen:
                t_seen = att.first_seen.strftime("%H:%M")
                text = f"{emp.first_name} {emp.last_name} bugun {t_seen} da ish joyiga kelgan va tizim tomonidan muvaffaqiyatli qayd etilgan."
                sources.append(AskSource(type="employee", id=str(emp.id), name=f"{emp.first_name} {emp.last_name}"))
                confidence = 0.98
            else:
                text = f"{emp.first_name} {emp.last_name} bo'yicha bugun hali kelish qaydi mavjud emas (yoki kadrga tushmagan)."
                sources.append(AskSource(type="employee", id=str(emp.id), name=f"{emp.first_name} {emp.last_name}"))
                confidence = 0.92
        else:
            text = f"Tizimda '{target_name.capitalize()}' ismli faol xodim topilmadi."
            confidence = 0.5

    # 3. Tanilmaganlar / Begonalar ("Tanilmaganlar bormi?", "Begonalar bormi?")
    elif any(k in q for k in ["tanilmagan", "begona", "mehmon"]):
        result = await db.execute(
            select(func.count(UnknownFace.id)).where(UnknownFace.resolution == "pending")
        )
        count = result.scalar() or 0
        text = f"Hozirda ko'rib chiqishni kutayotgan {count} ta tanilmagan shaxs hodisasi mavjud."
        confidence = 0.95

    # 4. Standart holat (Noaniq yoki ma'lumot yo'q)
    else:
        text = "Hozircha bu savol bo'yicha ma'lumot topilmadi yoki savol noaniq. Savolni boshqacharoq shaklda berib ko'ring (masalan: 'Bekzod bugun keldimi?' yoki 'Hozir nechta odam ishlayapti?')."
        confidence = 0.30

    # Log query in ask_logs
    log = AskLog(
        question=req.question,
        functions_called={"type": "rule_based_tool_calling"},
        response=text,
        confidence=confidence
    )
    db.add(log)
    await db.commit()

    return AskResponse(
        text=text,
        sources=sources,
        confidence=confidence
    )
