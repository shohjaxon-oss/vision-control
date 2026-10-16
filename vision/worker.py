import os
import time
import json
import base64
import hmac
import hashlib
import asyncio
import cv2
import httpx
import numpy as np
from datetime import datetime, timezone
from face_engine import FaceEngine
from liveness import MiniFASNetLiveness

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000/api/v1")
GO2RTC_API_URL = os.getenv("GO2RTC_API_URL", "http://localhost:1984")
INTERNAL_SERVICE_SECRET = os.getenv("INTERNAL_SERVICE_SECRET", "wfv_internal_service_secret_key_2026")

def create_hmac_headers(method: str, path: str, body_bytes: bytes = b"") -> dict:
    timestamp = int(time.time())
    body_hash = hashlib.sha256(body_bytes).hexdigest()
    msg = f"{method.upper()}|{path}|{timestamp}|{body_hash}".encode('utf-8')
    sig = hmac.new(INTERNAL_SERVICE_SECRET.encode('utf-8'), msg, hashlib.sha256).hexdigest()
    return {
        "X-Service-Signature": sig,
        "X-Service-Timestamp": str(timestamp),
        "Content-Type": "application/json"
    }

class VisionWorker:
    def __init__(self):
        self.face_engine = FaceEngine()
        self.liveness = MiniFASNetLiveness()
        self.is_running = True
        self.cam_fps_counters = {}

    async def run(self):
        print(f"[VisionWorker] Ishga tushirildi. API: {API_BASE_URL}")
        if not self.face_engine.is_ready():
            print("[VisionWorker] OGOHLANTIRISH: YuNet yoki SFace ONNX modellari topilmadi. Modellar yuklangunga qadar yuz aniqlash kutish rejimida bo'ladi.")

        async with httpx.AsyncClient(base_url=API_BASE_URL, timeout=10.0) as client:
            while self.is_running:
                try:
                    # 1. Fetch cameras from internal or public endpoint with HMAC or service token
                    # In internal container communication, we query cameras directly or via internal endpoints
                    ts = int(time.time())
                    # Get cameras
                    res = await client.get("/cameras")
                    if res.status_code == 200:
                        cameras = res.json()
                        for cam in cameras:
                            await self.process_camera(client, cam)
                except Exception as e:
                    print(f"[VisionWorker] Tarmoq xatosi: {e}")

                await asyncio.sleep(1.0)

    async def process_camera(self, client: httpx.AsyncClient, camera: dict):
        cam_id = camera.get("id")
        cam_type = camera.get("type", "general")
        
        # Determine event type based on camera location
        if cam_type == "entrance":
            event_type = "enter"
        elif cam_type == "exit":
            event_type = "exit"
        else:
            event_type = "seen"

        # Fetch frame from go2rtc snapshot API
        frame_url = f"{GO2RTC_API_URL}/api/frame.jpeg?src={cam_id}"
        start_t = time.time()
        try:
            async with httpx.AsyncClient(timeout=2.0) as go2rtc_client:
                f_res = await go2rtc_client.get(frame_url)
                if f_res.status_code != 200:
                    return
                frame_bytes = f_res.content
        except Exception:
            return

        latency_ms = int((time.time() - start_t) * 1000)

        # Decode image
        np_arr = np.frombuffer(frame_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if img is None:
            return

        # Report camera health
        health_payload = json.dumps({
            "camera_id": cam_id,
            "status": "online",
            "fps": 25,
            "latency_ms": latency_ms,
            "last_frame_at": datetime.now(timezone.utc).isoformat()
        }).encode('utf-8')
        
        health_headers = create_hmac_headers("POST", "/api/v1/internal/camera-health", health_payload)
        try:
            await client.post("/internal/camera-health", content=health_payload, headers=health_headers)
        except Exception:
            pass

        # If models are loaded, run detection and recognition pipeline
        if not self.face_engine.is_ready():
            return

        detected_faces = self.face_engine.detect_and_align(img)
        events_to_send = []

        for aligned_face, face_info, score in detected_faces:
            # 1. Quality check
            is_good_quality, issues = self.face_engine.assess_quality(img, face_info)
            if not is_good_quality:
                continue

            # 2. Liveness check
            is_live, live_score, live_status = self.liveness.check_liveness(aligned_face)
            if live_status == "spoof":
                continue # Block spoof attempts

            # 3. Extract 128-d feature embedding
            embedding = self.face_engine.extract_feature(aligned_face)

            # 4. Snapshot crop encode
            _, buffer = cv2.imencode('.jpg', aligned_face, [cv2.IMWRITE_JPEG_QUALITY, 85])
            b64_snap = base64.b64encode(buffer).decode('utf-8')

            events_to_send.append({
                "camera_id": cam_id,
                "event_type": event_type,
                "embedding": embedding.tolist(),
                "confidence": score,
                "liveness_score": live_score,
                "is_live": is_live,
                "snapshot_base64": b64_snap,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })

        if events_to_send:
            body = json.dumps(events_to_send).encode('utf-8')
            headers = create_hmac_headers("POST", "/api/v1/internal/events", body)
            try:
                await client.post("/internal/events", content=body, headers=headers)
            except Exception as e:
                print(f"[VisionWorker] Hodisalarni yuborishda xatolik: {e}")

if __name__ == "__main__":
    worker = VisionWorker()
    asyncio.run(worker.run())
