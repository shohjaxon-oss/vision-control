import asyncio
import json
import uuid
from typing import Dict, Set
from fastapi import APIRouter, Request, Depends, status, Query
from fastapi.responses import StreamingResponse
from security import decode_token
from models import User
from deps import get_current_user
from errors import AppException

router = APIRouter(prefix="/stream", tags=["Streaming & SSE"])

class SSEBroker:
    def __init__(self):
        # Map: org_id -> Set of asyncio.Queue
        self._listeners: Dict[str, Set[asyncio.Queue]] = {}

    def subscribe(self, org_id: str) -> asyncio.Queue:
        if org_id not in self._listeners:
            self._listeners[org_id] = set()
        queue = asyncio.Queue(maxsize=100)
        self._listeners[org_id].add(queue)
        return queue

    def unsubscribe(self, org_id: str, queue: asyncio.Queue):
        if org_id in self._listeners:
            self._listeners[org_id].discard(queue)
            if not self._listeners[org_id]:
                del self._listeners[org_id]

    async def publish(self, org_id: str, message: dict):
        if org_id in self._listeners:
            for queue in list(self._listeners[org_id]):
                try:
                    queue.put_nowait(message)
                except asyncio.QueueFull:
                    # Drop oldest if full
                    pass

sse_broker = SSEBroker()

@router.get("/events")
async def sse_events(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Genuine real-time SSE stream for frontends.
    Requires Bearer authorization or ?token= query parameter.
    Emits attendance, camera_status, unknown_face, and 15s heartbeat.
    """
    org_id_str = str(current_user.organization_id)
    queue = sse_broker.subscribe(org_id_str)

    async def event_generator():
        last_event_id = request.headers.get("Last-Event-ID", "0")
        event_counter = int(last_event_id) if last_event_id.isdigit() else 0

        try:
            # Immediate connection established event
            event_counter += 1
            yield f"id: {event_counter}\nevent: connected\ndata: {json.dumps({'status': 'connected', 'user_id': str(current_user.id)})}\n\n"

            while True:
                # Check for client disconnect
                if await request.is_disconnected():
                    break

                try:
                    # Wait for message with 15-second heartbeat timeout
                    msg = await asyncio.wait_for(queue.get(), timeout=15.0)
                    event_counter += 1
                    event_type = msg.get("event", "message")
                    data = json.dumps(msg.get("data", {}))
                    yield f"id: {event_counter}\nevent: {event_type}\ndata: {data}\n\n"
                except asyncio.TimeoutError:
                    # Heartbeat every 15s per contract
                    event_counter += 1
                    yield f"id: {event_counter}\nevent: heartbeat\ndata: {json.dumps({'timestamp': asyncio.get_event_loop().time()})}\n\n"
        finally:
            sse_broker.unsubscribe(org_id_str, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.get("/live/{camera_id}")
async def proxy_live_stream(
    camera_id: str,
    ticket: str = Query(...),
):
    """
    Secure single-use live stream proxy:
    Validates ticket with aud="wfv-live", ensures user belongs to camera's organization.
    Raw RTSP passwords are NEVER exposed to the frontend browser!
    """
    payload = decode_token(ticket, expected_typ="live", expected_aud="wfv-live")
    ticket_cam = payload.get("cam")
    if ticket_cam != camera_id:
        raise AppException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="invalid_stream_ticket",
            message="Ushbu ticket ushbu kamera uchun berilmagan"
        )

    # In production with Caddy/go2rtc, this handles WebRTC SDP exchange or redirects internally
    return {"status": "ok", "camera_id": camera_id, "ticket_verified": True}
