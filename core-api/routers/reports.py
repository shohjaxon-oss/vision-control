import csv
import io
import pytz
from datetime import datetime, date, timedelta, time, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from database import get_db
from models import AttendanceDay, Employee, Organization, User
from deps import require_manager_plus, get_current_org
from errors import AppException
from attendance_service import to_org_timezone

router = APIRouter(prefix="/reports", tags=["Reports"])

def sanitize_csv_cell(value: str) -> str:
    """
    Prevents CSV Formula Injection:
    If cell begins with =, +, -, @, tab, or newline, prepends single quote (').
    """
    if not value:
        return ""
    val_str = str(value)
    if val_str[0] in ("=", "+", "-", "@", "\t", "\r", "\n"):
        return f"'{val_str}"
    return val_str

@router.get("/attendance")
async def generate_attendance_report(
    from_date_str: str = Query(..., alias="from"),
    to_date_str: str = Query(..., alias="to"),
    format_type: str = Query("json", alias="format", pattern="^(json|csv)$"),
    current_user: User = Depends(require_manager_plus),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db)
):
    try:
        from_date = datetime.strptime(from_date_str, "%Y-%m-%d").date()
        to_date = datetime.strptime(to_date_str, "%Y-%m-%d").date()
    except ValueError:
        raise AppException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="invalid_date_format",
            message="Sana formati noto'g'ri (YYYY-MM-DD bo'lishi kerak)"
        )

    if from_date > to_date:
        raise AppException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="invalid_date_range",
            message="Boshlanish sanasi tugash sanasidan katta bo'lishi mumkin emas"
        )

    # Enforce maximum 92 days range per contract
    if (to_date - from_date).days > 92:
        raise AppException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="date_range_too_large",
            message="Hisobot oralig'i ko'pi bilan 92 kun bo'lishi mumkin"
        )

    stmt = (
        select(AttendanceDay, Employee)
        .join(Employee, AttendanceDay.employee_id == Employee.id)
        .where(
            AttendanceDay.organization_id == current_user.organization_id,
            AttendanceDay.date >= from_date,
            AttendanceDay.date <= to_date
        )
        .order_by(AttendanceDay.date.asc(), Employee.last_name.asc())
    )
    result = await db.execute(stmt)
    records = result.all()

    if format_type == "csv":
        output = io.StringIO()
        writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
        # Header
        writer.writerow(["Sana", "Xodim ID", "Familiya", "Ism", "Lavozim", "Bo'lim", "Holat", "Birinchi ko'rinish", "Oxirgi ko'rinish", "Kechikish (daq)", "Ishlagan vaqti (daq)"])
        
        for att, emp in records:
            first_s = to_org_timezone(att.first_seen, org.timezone).strftime("%H:%M:%S") if att.first_seen else ""
            last_s = to_org_timezone(att.last_seen, org.timezone).strftime("%H:%M:%S") if att.last_seen else ""
            writer.writerow([
                sanitize_csv_cell(att.date.strftime("%Y-%m-%d")),
                sanitize_csv_cell(str(emp.id)),
                sanitize_csv_cell(emp.last_name),
                sanitize_csv_cell(emp.first_name),
                sanitize_csv_cell(emp.position),
                sanitize_csv_cell(emp.department),
                sanitize_csv_cell(att.status),
                sanitize_csv_cell(first_s),
                sanitize_csv_cell(last_s),
                sanitize_csv_cell(str(att.late_minutes)),
                sanitize_csv_cell(str(att.total_present_minutes))
            ])

        csv_content = output.getvalue()
        return Response(
            content=csv_content,
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": f"attachment; filename=attendance_report_{from_date}_{to_date}.csv"
            }
        )

    # JSON response
    return [
        {
            "date": att.date.strftime("%Y-%m-%d"),
            "employee_id": str(emp.id),
            "employee_name": f"{emp.first_name} {emp.last_name}",
            "position": emp.position,
            "department": emp.department,
            "status": att.status,
            "first_seen": to_org_timezone(att.first_seen, org.timezone).strftime("%H:%M:%S") if att.first_seen else None,
            "last_seen": to_org_timezone(att.last_seen, org.timezone).strftime("%H:%M:%S") if att.last_seen else None,
            "late_minutes": att.late_minutes,
            "total_present_minutes": att.total_present_minutes
        }
        for att, emp in records
    ]
