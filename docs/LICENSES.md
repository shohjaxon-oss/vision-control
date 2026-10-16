# Workforce Vision Platform — Litsenziyalar Ro'yxati va Auditi (`LICENSES.md`)

> **Sana:** 2026-10-15  
> **Qat'iy qoida:** Tijorat yopiq dasturiy ta'minot (proprietary) uchun mos bo'lmagan AGPL-3.0 yoki faqat tadqiqot uchun (Non-Commercial Research Only) berilgan modellar ishlatilmaydi.

---

## 1. Ruxsat etilgan va Tasdiqlangan Komponentlar

| Komponent / Model | Vazifasi | Litsenziya | Holati |
|---|---|---|---|
| **OpenCV YuNet** | Yuzni aniqlash (Face Detection) | Apache 2.0 | Tasdiqlangan |
| **OpenCV SFace** | Yuz embeddingi (128-d Face Recognition) | Apache 2.0 | Tasdiqlangan |
| **MiniFASNet** | Anti-spoofing / Liveness tekshiruvi | Apache 2.0 | Tasdiqlangan |
| **FastAPI** | REST API asosiy backend | MIT | Tasdiqlangan |
| **SQLAlchemy** | Async ORM | MIT | Tasdiqlangan |
| **PostgreSQL + pgvector** | RDBMS & Vektor qidiruvi | PostgreSQL / Apache 2.0 | Tasdiqlangan |
| **go2rtc** | RTSP / WebRTC oqim shlyuzi | MIT | Tasdiqlangan |
| **React, Vite, TypeScript** | Frontend platforma | MIT / Apache 2.0 | Tasdiqlangan |
| **Tailwind CSS & Radix UI** | Dizayn tizimi komponentlari | MIT | Tasdiqlangan |
| **Lucide React** | Ikonkalar to'plami | ISC / MIT | Tasdiqlangan |

---

## 2. Ishlatilishi TAQIQLANGAN Modellar va Sabablari

1. **InsightFace rasmiy modellari (`buffalo_l`, `buffalo_s`, `antelopev2`):**
   - Kod qismi MIT bo'lsa-da, rasmiy pre-trained model og'irliklari **faqat nokommersial tadqiqotlar uchun** (Non-commercial research only). Maxsus tijorat litsenziyasi bo'lmasa, yopiq tijorat mahsulotiga kiritish taqiqlanadi.
2. **Ultralytics YOLO (YOLOv8, YOLOv9, YOLOv11):**
   - **AGPL-3.0** litsenziyasi ostida. Enterprise litsenziya sotib olinmasa, butun loyiha kodini ochiq qilishga majbur qiladi.
   - Alternativa: RT-DETR yoki YOLOX (Apache 2.0).
3. **BoxMOT:**
   - **AGPL-3.0** litsenziyasi. Alternativa: ByteTrack (MIT) yoki Norfair.
