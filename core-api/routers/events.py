import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import AttendanceEvent, AuditLog
from schemas import EventFeedbackRequest

router = APIRouter(prefix="/events", tags=["Events"])

@router.post("/{id}/feedback")
async def submit_feedback(id: str, req: EventFeedbackRequest, db: AsyncSession = Depends(get_db)):
    event_uuid = uuid.UUID(id)
    result = await db.execute(select(AttendanceEvent).where(AttendanceEvent.id == event_uuid))
    event = result.scalars().first()
    if not event:
        raise HTTPException(status_code=404, detail="Hodisa topilmadi")

    event.reviewed = True
    event.feedback = req.correct

    audit = AuditLog(
        action="event_feedback_submitted",
        entity="attendance_event",
        entity_id=str(event.id),
        details={"correct": req.correct, "confidence": event.confidence}
    )
    db.add(audit)
    await db.commit()

    return {"status": "success", "recorded_feedback": req.correct}
