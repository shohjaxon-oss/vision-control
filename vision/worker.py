import os
import time
import asyncio
import httpx
import numpy as np
from face_engine import FaceEngine
from liveness import MiniFASNetLiveness

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000/api/v1")
GO2RTC_RTSP_URL = os.getenv("GO2RTC_RTSP_URL", "rtsp://localhost:8554")

class VisionWorker:
    def __init__(self):
        self.face_engine = FaceEngine()
        self.liveness = MiniFASNetLiveness()
        self.is_running = True

    async def run(self):
        print(f"[VisionWorker] Ishga tushirildi. API manzili: {API_BASE_URL}")
        async with httpx.AsyncClient(base_url=API_BASE_URL, timeout=10.0) as client:
            while self.is_running:
                try:
                    # 1. Fetch active cameras from API
                    res = await client.get("/cameras")
                    if res.status_code == 200:
                        cameras = res.json()
                        online_cams = [c for c in cameras if c.get("status") == "online"]
                        # Process checkpoint entrance/exit cameras
                        for cam in online_cams:
                            await self.process_camera(client, cam)
                except Exception as e:
                    print(f"[VisionWorker] Tarmoq xatosi: {e}")
                
                await asyncio.sleep(2.0)

    async def process_camera(self, client: httpx.AsyncClient, camera: dict):
        # Simulated continuous frame ingestion & processing loop
        cam_id = camera.get("id")
        cam_name = camera.get("name")
        # In live deployment, OpenCV VideoCapture consumes RTSP stream here
        pass

if __name__ == "__main__":
    worker = VisionWorker()
    asyncio.run(worker.run())
