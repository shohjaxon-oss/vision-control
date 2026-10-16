# Open-Source Licenses & Compliance

All core vision models, computer vision dependencies, and libraries integrated into the Workforce Vision Platform (WVP) operate strictly under permissive open-source licenses compatible with commercial deployment in the Republic of Uzbekistan.

## 1. Computer Vision & Biometric Models

| Component / Model | Project / Origin | License | Usage & Restrictions |
|---|---|---|---|
| **YuNet** | OpenCV Model Zoo (Detection & Landmarks) | **Apache 2.0** | Commercial use permitted. Redistribution with notice. |
| **SFace** | OpenCV Model Zoo (128-d Feature Embedding) | **Apache 2.0** | Commercial use permitted. Pre-trained on clean datasets. |
| **MiniFASNetV2** | Mini AI Live Anti-Spoofing | **Apache 2.0** | Commercial use permitted. ONNX mobile anti-spoofing. |

## 2. Core Backend Dependencies

| Library | License | Link / Notes |
|---|---|---|
| **FastAPI** | MIT License | High performance asynchronous web framework |
| **PyJWT** | MIT License | Standard compliant RFC 7519 JSON Web Tokens |
| **Argon2-cffi** | MIT License | IETF password hashing competition winner |
| **SQLAlchemy** | MIT License | Modern Python SQL toolkit & ORM |
| **pgvector** | PostgreSQL License | Vector similarity search for PostgreSQL |
| **Cryptography** | Apache 2.0 / BSD | AES-256-GCM authenticated encryption |
| **Caddy** | Apache 2.0 | Automated HTTPS edge ingress proxy |

## 3. Uzbekistan Regulatory Compliance

- **Law of the Republic of Uzbekistan on Personal Data (ZRU-547 / ZRU-1125, ZRU-1115)**:
  - All biometric databases (`face_embeddings`, `attendance_events`, `unknown_faces`) reside on dedicated on-premise infrastructure inside the Republic of Uzbekistan.
  - Zero biometric data, facial vectors, or video streams are routed through foreign cloud APIs or shared with external model providers.
  - Biometric consent revocation triggers immediate, atomic, physical erasure of vectors and snapshots from persistent storage.
