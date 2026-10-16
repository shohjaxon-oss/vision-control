import io
import csv
from datetime import datetime, date as date_type, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import AttendanceDay, Employee
from schemas import AttendanceRecordResponse

router = APIRouter(prefix="/reports", tags=["Reports"])

@router.get("/attendance")
async def get_attendance_report(
    from_date: str = Query(..., alias="from"),
    to_date: str = Query(..., alias="to"),
    format: str = Query("json"),
    db: AsyncSession = Depends(get_db)
):
    d_from = datetime.strptime(from_date, "%Y-%m-%d").date()
    d_to = datetime.strptime(to_date, "%Y-%m-%d").date()

    result = await db.execute(
        select(AttendanceDay, Employee)
        .join(Employee, AttendanceDay.employee_id == Employee.id)
        .where(AttendanceDay.date >= d_from, AttendanceDay.date <= d_to)
        .order_by(AttendanceDay.date.desc())
    )
    rows = result.all()

    records = [
        {
            "id": str(att.id),
            "employee_id": str(emp.id),
            "employee_name": f"{emp.first_name} {emp.last_name}",
            "department": emp.department,
            "date": str(att.date),
            "first_seen": att.first_seen.isoformat() if att.first_seen else "-",
            "last_seen": att.last_seen.isoformat() if att.last_seen else "-",
            "status": att.status,
            "late_minutes": att.late_minutes,
            "total_present_minutes": att.total_present_minutes
        }
        for att, emp in rows
    ]

    if format == "csv":
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=[
            "id", "employee_id", "employee_name", "department", "date",
            "first_seen", "last_seen", "status", "late_minutes", "total_present_minutes"
        ])
        writer.writeheader()
        writer.writerows(records)
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=davomat_hisoboti_{from_date}_{to_date}.csv"}
        )

    return records
