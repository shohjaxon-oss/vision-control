import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import UnknownFace, Camera, AuditLog
from schemas import UnknownFaceResponse, ResolveUnknownFaceRequest

router = APIRouter(prefix="/unknown-faces", tags=["Unknown Faces"])

@router.get("", response_model=List[UnknownFaceResponse])
async def list_unknown_faces(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(UnknownFace, Camera.name)
        .outerjoin(Camera, UnknownFace.camera_id == Camera.id)
        .order_by(UnknownFace.occurred_at.desc())
    )
    rows = result.all()
    return [
        UnknownFaceResponse(
            id=str(face.id),
            snapshot_url=face.snapshot_path,
            detected_at=face.occurred_at,
            camera_id=str(face.camera_id) if face.camera_id else None,
            camera_name=cam_name or "Noma'lum kamera",
            resolution=face.resolution
        )
        for face, cam_name in rows
    ]

@router.post("/{id}/resolve")
async def resolve_unknown_face(id: str, req: ResolveUnknownFaceRequest, db: AsyncSession = Depends(get_db)):
    face_uuid = uuid.UUID(id)
    result = await db.execute(select(UnknownFace).where(UnknownFace.id == face_uuid))
    face = result.scalars().first()
    if not face:
        raise HTTPException(status_code=404, detail="Tanilmagan yuz topilmadi")

    if req.action not in ["link", "guest", "ignore"]:
        raise HTTPException(status_code=400, detail="Noto'g'ri amal turi. Ruxsat etilganlar: link, guest, ignore")

    face.resolution = "linked" if req.action == "link" else "guest" if req.action == "guest" else "ignored"
    face.resolved_at = datetime.now(timezone.utc)
    if req.action == "link" and req.employee_id:
        face.resolved_employee_id = uuid.UUID(req.employee_id)

    audit = AuditLog(
        action=f"unknown_face_resolved_{req.action}",
        entity="unknown_face",
        entity_id=str(face.id),
        details={"action": req.action, "employee_id": req.employee_id}
    )
    db.add(audit)
    await db.commit()

    return {"status": "success", "resolution": face.resolution}
