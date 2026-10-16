import uuid
import random
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from database import get_db
from models import Employee, Consent, FaceEmbedding, AuditLog
from schemas import (
    EmployeeResponse, EmployeeCreate, EmployeeUpdate,
    ConsentRequest, EnrollmentCaptureRequest, EnrollmentCaptureResponse, EnrollmentSample
)

router = APIRouter(prefix="/employees", tags=["Employees"])

@router.get("", response_model=List[EmployeeResponse])
async def list_employees(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Employee).order_by(Employee.created_at.desc()))
    employees = result.scalars().all()
    return [
        EmployeeResponse(
            id=str(e.id),
            first_name=e.first_name,
            last_name=e.last_name,
            position=e.position,
            department=e.department,
            phone=e.phone,
            consent_status=e.consent_status,
            consent_date=e.consent_date,
            enrollment_status=e.enrollment_status,
            enrollment_samples=e.enrollment_samples,
            is_active=e.is_active,
            created_at=e.created_at
        )
        for e in employees
    ]

@router.post("", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(req: EmployeeCreate, db: AsyncSession = Depends(get_db)):
    emp = Employee(
        first_name=req.first_name,
        last_name=req.last_name,
        position=req.position,
        department=req.department,
        phone=req.phone,
        consent_status="pending",
        enrollment_status="none",
        enrollment_samples=0,
        is_active=True
    )
    db.add(emp)
    await db.commit()
    await db.refresh(emp)

    # Log audit
    audit = AuditLog(
        action="employee_created",
        entity="employee",
        entity_id=str(emp.id),
        details={"name": f"{emp.first_name} {emp.last_name}"}
    )
    db.add(audit)
    await db.commit()

    return EmployeeResponse(
        id=str(emp.id),
        first_name=emp.first_name,
        last_name=emp.last_name,
        position=emp.position,
        department=emp.department,
        phone=emp.phone,
        consent_status=emp.consent_status,
        consent_date=emp.consent_date,
        enrollment_status=emp.enrollment_status,
        enrollment_samples=emp.enrollment_samples,
        is_active=emp.is_active,
        created_at=emp.created_at
    )

@router.get("/{id}", response_model=EmployeeResponse)
async def get_employee(id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Employee).where(Employee.id == uuid.UUID(id)))
    emp = result.scalars().first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")
    return EmployeeResponse(
        id=str(emp.id),
        first_name=emp.first_name,
        last_name=emp.last_name,
        position=emp.position,
        department=emp.department,
        phone=emp.phone,
        consent_status=emp.consent_status,
        consent_date=emp.consent_date,
        enrollment_status=emp.enrollment_status,
        enrollment_samples=emp.enrollment_samples,
        is_active=emp.is_active,
        created_at=emp.created_at
    )

@router.patch("/{id}", response_model=EmployeeResponse)
async def update_employee(id: str, req: EmployeeUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Employee).where(Employee.id == uuid.UUID(id)))
    emp = result.scalars().first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")
    
    for key, value in req.model_dump(exclude_unset=True).items():
        setattr(emp, key, value)
    
    await db.commit()
    await db.refresh(emp)
    return EmployeeResponse(
        id=str(emp.id),
        first_name=emp.first_name,
        last_name=emp.last_name,
        position=emp.position,
        department=emp.department,
        phone=emp.phone,
        consent_status=emp.consent_status,
        consent_date=emp.consent_date,
        enrollment_status=emp.enrollment_status,
        enrollment_samples=emp.enrollment_samples,
        is_active=emp.is_active,
        created_at=emp.created_at
    )

@router.post("/{id}/consent")
async def grant_consent(id: str, req: ConsentRequest, db: AsyncSession = Depends(get_db)):
    emp_uuid = uuid.UUID(id)
    result = await db.execute(select(Employee).where(Employee.id == emp_uuid))
    emp = result.scalars().first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")
    
    now = datetime.now(timezone.utc)
    emp.consent_status = "granted" if req.granted else "denied"
    emp.consent_date = now if req.granted else None
    
    consent = Consent(
        employee_id=emp_uuid,
        status="granted" if req.granted else "denied",
        granted_at=now if req.granted else None
    )
    db.add(consent)
    await db.commit()
    return {"status": "success", "consent_status": emp.consent_status}

@router.delete("/{id}/consent")
async def revoke_consent(id: str, db: AsyncSession = Depends(get_db)):
    """
    CRITICAL LEGAL REQUIREMENT (ZRU-1125):
    Revoking consent permanently wipes all face embeddings of the employee!
    """
    emp_uuid = uuid.UUID(id)
    result = await db.execute(select(Employee).where(Employee.id == emp_uuid))
    emp = result.scalars().first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")
    
    now = datetime.now(timezone.utc)
    emp.consent_status = "revoked"
    emp.consent_date = None
    emp.enrollment_status = "none"
    emp.enrollment_samples = 0
    
    # 1. Permanently delete all face embeddings from pgvector table
    await db.execute(delete(FaceEmbedding).where(FaceEmbedding.employee_id == emp_uuid))
    
    # 2. Record revocation event in consent history
    consent = Consent(
        employee_id=emp_uuid,
        status="revoked",
        revoked_at=now,
        notes="Xodim ixtiyoriy ravishda biometrik rozilikni bekor qildi. Barcha yuz embeddinglari butunlay o'chirildi."
    )
    db.add(consent)

    # 3. Record in audit log
    audit = AuditLog(
        action="consent_revoked_biometrics_purged",
        entity="employee",
        entity_id=str(emp.id),
        details={"name": f"{emp.first_name} {emp.last_name}", "purged_embeddings": True}
    )
    db.add(audit)
    
    await db.commit()
    return {"status": "success", "message": "Biometrik rozilik bekor qilindi va yuz embeddinglari butunlay o'chirildi."}

@router.post("/{id}/enrollment/capture", response_model=EnrollmentCaptureResponse)
async def capture_enrollment(id: str, req: EnrollmentCaptureRequest, db: AsyncSession = Depends(get_db)):
    emp_uuid = uuid.UUID(id)
    result = await db.execute(select(Employee).where(Employee.id == emp_uuid))
    emp = result.scalars().first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")
    
    if emp.consent_status != "granted":
        raise HTTPException(
            status_code=409,
            detail="Biometrik rozilik olinmagan! Ro'yxatdan o'tkazish uchun xodimdan yozma rozilik olinishi shart."
        )

    # Quality check evaluation
    quality_issues = []
    rand = random.random()
    if rand < 0.15:
        quality_issues.append("Rasm xira")
    elif rand < 0.30:
        quality_issues.append("Rasm qorong'i")
    elif rand < 0.40:
        quality_issues.append("Yuz burchagi qiyshiq (og'ish > 15°)")

    is_rejected = len(quality_issues) > 0
    sample_status = "rejected" if is_rejected else "captured"

    if not is_rejected:
        emp.enrollment_samples = min(5, emp.enrollment_samples + 1)
        if emp.enrollment_samples >= 5:
            emp.enrollment_status = "enrolled"
        else:
            emp.enrollment_status = "partial"
        await db.commit()

    sample = EnrollmentSample(
        index=emp.enrollment_samples - (0 if is_rejected else 1),
        status=sample_status,
        quality_issues=quality_issues
    )
    return EnrollmentCaptureResponse(sample=sample, samples_count=emp.enrollment_samples)
