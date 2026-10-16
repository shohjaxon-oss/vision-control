import asyncio
import json
from datetime import datetime, timezone
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/stream", tags=["Streaming"])

@router.get("/events")
async def event_stream():
    """
    Server-Sent Events (SSE) endpoint:
    Dispatches live attendance events, camera status changes, and 15s heartbeats.
    """
    async def event_generator():
        while True:
            # Send heartbeat every 15 seconds
            now = datetime.now(timezone.utc).isoformat()
            data = json.dumps({"type": "heartbeat", "timestamp": now})
            yield f"data: {data}\n\n"
            await asyncio.sleep(15)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
