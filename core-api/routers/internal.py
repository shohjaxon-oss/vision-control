import os
import uuid
import base64
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pgvector.sqlalchemy import Vector
from database import get_db
from models import (
    Camera, Employee, FaceEmbedding, AttendanceEvent,
    UnknownFace, Organization
)
from schemas import (
    InternalEventItem, InternalCameraHealthReport, InternalFrameAnalysisResponse
)
from deps import verify_internal_service
from errors import AppException
from config import settings

router = APIRouter(prefix="/internal", tags=["Internal Service Integration"])

COSINE_THRESHOLD = 0.363 # Recommended OpenCV SFace cosine similarity threshold

@router.post("/camera-health")
async def report_camera_health(
    report: InternalCameraHealthReport,
    authenticated: bool = Depends(verify_internal_service),
    db: AsyncSession = Depends(get_db)
):
    try:
        cam_uuid = uuid.UUID(report.camera_id)
    except ValueError:
        raise AppException(status_code=400, code="invalid_uuid", message="Noto'g'ri kamera ID")

    stmt = select(Camera).where(Camera.id == cam_uuid)
    cam = (await db.execute(stmt)).scalars().first()
    if cam:
        cam.status = report.status
        cam.fps = report.fps
        cam.latency_ms = report.latency_ms
        cam.last_frame_at = report.last_frame_at
        await db.commit()
    return {"status": "ok"}

@router.post("/events")
async def ingest_vision_events(
    events: List[InternalEventItem],
    authenticated: bool = Depends(verify_internal_service),
    db: AsyncSession = Depends(get_db)
):
    """
    Ingests detected face embeddings from vision-worker:
    1. Looks up camera & organization.
    2. Runs pgvector 1:N cosine similarity match strictly among employees with active consent ('granted').
    3. If match >= 0.363 -> AttendanceEvent is created.
    4. If no match -> UnknownFace is created (snapshot only, NO vector saved per Section 4.8).
    5. Notifies SSE broker.
    """
    processed = []
    from routers.stream import sse_broker

    for item in events:
        try:
            cam_uuid = uuid.UUID(item.camera_id)
        except ValueError:
            continue

        c_stmt = select(Camera).where(Camera.id == cam_uuid)
        camera = (await db.execute(c_stmt)).scalars().first()
        if not camera:
            continue

        org_id = camera.organization_id
        now = item.timestamp or datetime.now(timezone.utc)

        # Save snapshot if provided
        snapshot_rel_path = None
        if item.snapshot_base64:
            os.makedirs(settings.SNAPSHOT_STORAGE_PATH, exist_ok=True)
            filename = f"{uuid.uuid4().hex}.jpg"
            full_path = os.path.join(settings.SNAPSHOT_STORAGE_PATH, filename)
            try:
                img_data = base64.b64decode(item.snapshot_base64)
                with open(full_path, "wb") as f:
                    f.write(img_data)
                snapshot_rel_path = full_path
            except Exception:
                pass

        # 1:N Vector Cosine Search in PostgreSQL pgvector
        # Cosine distance: 1 - cosine_similarity. Similarity = 1 - distance.
        # So distance < (1 - 0.363) = 0.637
        vector_query = (
            select(FaceEmbedding, Employee)
            .join(Employee, FaceEmbedding.employee_id == Employee.id)
            .where(
                FaceEmbedding.organization_id == org_id,
                Employee.consent_status == "granted",
                Employee.is_active == True
            )
            .order_by(FaceEmbedding.embedding.cosine_distance(item.embedding))
            .limit(1)
        )
        match_result = await db.execute(vector_query)
        match_row = match_result.first()

        recognized_employee = None
        calc_confidence = 0.0

        if match_row:
            matched_embedding, employee = match_row
            # Compute cosine similarity
            # In pgvector: cosine distance = 1 - cosine_similarity
            # We can also compute directly using numpy dot product
            import numpy as np
            v1 = np.array(item.embedding, dtype=np.float32)
            v2 = np.array(matched_embedding.embedding, dtype=np.float32)
            dot = np.dot(v1, v2)
            norm = (np.linalg.norm(v1) * np.linalg.norm(v2))
            sim = float(dot / norm) if norm > 0 else 0.0

            if sim >= COSINE_THRESHOLD:
                recognized_employee = employee
                calc_confidence = sim

        if recognized_employee:
            # Create AttendanceEvent
            att_event = AttendanceEvent(
                organization_id=org_id,
                employee_id=recognized_employee.id,
                camera_id=camera.id,
                event_type=item.event_type,
                confidence=round(calc_confidence, 4),
                snapshot_path=snapshot_rel_path,
                occurred_at=now
            )
            db.add(att_event)
            await db.flush()

            # Emit SSE event
            await sse_broker.publish(str(org_id), {
                "event": "attendance",
                "data": {
                    "employee_id": str(recognized_employee.id),
                    "employee_name": f"{recognized_employee.first_name} {recognized_employee.last_name}",
                    "camera_id": str(camera.id),
                    "camera_name": camera.name,
                    "event_type": item.event_type,
                    "confidence": round(calc_confidence, 4),
                    "timestamp": now.isoformat()
                }
            })
            processed.append({"type": "recognized", "employee_id": str(recognized_employee.id)})
        else:
            # Unrecognized: Create UnknownFace (Snapshot only, NO vector saved!)
            if snapshot_rel_path:
                uf = UnknownFace(
                    organization_id=org_id,
                    camera_id=camera.id,
                    snapshot_path=snapshot_rel_path,
                    occurred_at=now,
                    resolution="pending"
                )
                db.add(uf)
                await db.flush()

                await sse_broker.publish(str(org_id), {
                    "event": "unknown_face",
                    "data": {
                        "id": str(uf.id),
                        "camera_id": str(camera.id),
                        "camera_name": camera.name,
                        "detected_at": now.isoformat()
                    }
                })
                processed.append({"type": "unknown", "unknown_face_id": str(uf.id)})

    await db.commit()
    return {"status": "ok", "processed_count": len(processed), "results": processed}
