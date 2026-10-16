# 🏢 Workforce Vision Platform (WVP)
### Sun'iy Intellekt Asosidagi Xodimlar Davomati, Joylashuvi va Xavfsizligini Real Vaqtda Boshqarish Tizimi

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb?logo=react)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python_3.11-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL_16-pgvector-336791?logo=postgresql)](https://github.com/pgvector/pgvector)
[![OpenCV](https://img.shields.io/badge/OpenCV-YuNet_%2B_SFace-5c3ee8?logo=opencv)](https://opencv.org/)
[![go2rtc](https://img.shields.io/badge/go2rtc-v1.9.4-orange)](https://github.com/AlexxIT/go2rtc)
[![Caddy](https://img.shields.io/badge/Caddy-2.8.4_Edge_Proxy-darkgreen?logo=caddy)](https://caddyserver.com/)
[![Compliance](https://img.shields.io/badge/Compliance-O'zbekiston_ZRU--1125_%26_ZRU--1115-darkred)](#-7-huquqiy-va-qonuniy-muvofiqlik-zru-1125-va-zru-1115)

---

## 📌 Mundarija
1. [Loyiha Haqida](#-1-loyiha-haqida)
2. [Tizim Arxitekturasi](#-2-tizim-arxitekturasi)
3. [Xavfsizlik va Audit Qoidalari (Zero Mocks)](#-3-xavfsizlik-va-audit-qoidalari-zero-mocks)
4. [Loyiha Tuzilmasi (Monorepo)](#-4-loyiha-tuzilmasi-monorepo)
5. [Tezkor Ishga Tushirish (Quickstart)](#-5-tezkor-ishga-tushirish-quickstart)
6. [Yagona API Shartnomasi (API Contract)](#-6-yagona-api-shartnomasi-api-contract)
7. [Huquqiy va Qonuniy Muvofiqlik (ZRU-1125 va ZRU-1115)](#-7-huquqiy-va-qonuniy-muvofiqlik-zru-1125-va-zru-1115)
8. [Litsenziyalar va Ochiq Manbalar Auditi](#-8-litsenziyalar-va-ochiq-manbalar-auditi)
9. [Ekspluatatsiya va Nosozliklarni Bartaraf Etish (Runbook)](#-9-ekspluatatsiya-va-nosozliklarni-bartaraf-etish-runbook)

---

## 📖 1. Loyiha Haqida

**Workforce Vision Platform (WVP)** — IP-kameralar (Hikvision, Dahua, ONVIF/RTSP) oqimini kompyuter ko'rishi (Computer Vision) va sun'iy intellekt orqali real vaqt rejimida tahlil qilib, korxona va tashkilotlarda:
- Xodimlar davomatini yuz orqali qayd etish (Face Check-in/Check-out);
- Ish zonalari va binolardagi mavjudligini uzluksiz monitoring qilish;
- Tanilmagan yuzlarni xavfsiz triaj qilish;
- Har bir harakat uchun vizual dalil (snapshot) taqdim etish;
- Tabiiy tilda xavfsiz savol-javob (`/ask`) interfeysi orqali tezkor hisobotlar olish imkonini beruvchi **On-Premise** platformadir.

---

## 🏗️ 2. Tizim Arxitekturasi

Tashqi tarmoqqa **FAQAT Caddy (80 va 443 portlar)** chiqadi. Barcha ma'lumotlar bazasi, video oqimlari va ichki hisoblash xizmatlari ichki tarmoqda izolyatsiyalangan.

```
Kamera (RTSP) ──► go2rtc ──► vision-worker ──(ichki, HMAC)──► core-api ◄──► PostgreSQL+pgvector
                    │                                           │  ▲
                    └─(autentifikatsiyali proksi)───────────────┘  └── SSE ──► Frontend (Caddy orqali)
```

- **Caddy (80 / 443):** Tashqi kirish shlyuzi. `/` frontend, `/api/` core-api (SSE va WebRTC proksi bilan).
- **core-api (FastAPI, async):** Yagona haqiqat manbai, pgvector kosinus qidiruvi, davomat xizmat qatlami, SSE brokeri.
- **vision-worker:** OpenCV YuNet (Detection) + SFace (128-d Embedding) + MiniFASNet (Anti-spoofing). Natijalarni core-api'ga `X-Service-Signature` (HMAC, vaqt tamg'asi) bilan yuboradi.
- **go2rtc (v1.9.4):** Ichki video oqim shlyuzi. Kameralar paroli `go2rtc.yaml` da emas, core-api tomonidan dinamik boshqariladi.

---

## 🛡️ 3. Xavfsizlik va Audit Qoidalari (Zero Mocks)

1. **Soxta narsalar yo'q:** Qattiq yozilgan parollar (`admin123`), mock 2FA (`123456`, `JBSWY3DPEHPK3PXP`), tasodifiy sifat (`random.random`), yoki soxta vektorlar (`np.random.seed`) koddan butunlay olib tashlangan.
2. **Kriptografiya:**
   - Parol xeshlash: `Argon2id` (RFC 9106, 64MB xotira narxi).
   - Sessiya tokenlari: `PyJWT` (Access 15 daqiqa, 2FA Challenge 5 daqiqa, Live stream ticket 30 soniya).
   - Refresh token rotation: HttpOnly, Secure, SameSite cookie; token qayta ishlatilsa butun oila bekor qilinadi.
   - Kamera parollari: `AES-256-GCM` bilan shifrlanadi. RTSP manzillar tashqariga parolsiz (`rtsp_masked`) beriladi.
3. **Immutabel Audit Jurnali:** Har bir o'zgartiruvchi harakat va snapshot ochilishi SHA-256 zanjirli xesh (`prev_hash`, `row_hash`) bilan yoziladi.
4. **Biometrik Rozilikni Bekor Qilish (ZRU-1125):** Rozilik bekor qilinganda bitta atomik tranzaksiyada barcha yuz vektorlari o'chadi, diskdagi snapshot fayllari jismonan o'chiriladi, `attendance_events.snapshot_path = NULL` qilinadi.

---

## 📂 4. Loyiha Tuzilmasi (Monorepo)

```
vision-control/
├── core-api/                  # FastAPI Asinxron Backend
│   ├── alembic/               # Ma'lumotlar bazasi migratsiyalari
│   ├── routers/               # API Routerlari (auth, employees, cameras, attendance, ask, stream...)
│   ├── tests/                 # Avtomatik xavfsizlik va API testlari
│   ├── config.py              # Pydantic Settings & Production sirlar validatori
│   ├── database.py            # Async SQLAlchemy PostgreSQL pool
│   ├── deps.py                # RBAC va Multi-tenancy bog'liqliklari
│   ├── errors.py              # Standart xato handlerlari {"code", "message", "details"}
│   ├── models.py              # SQLAlchemy + pgvector ma'lumotlar modellari
│   ├── schemas.py             # Pydantic request/response sxemalari
│   └── security.py            # Argon2id, PyJWT, AES-GCM, pyotp, HMAC
│
├── vision/                    # Kompyuter Ko'rishi Ishchisi (Worker)
│   ├── face_engine.py         # YuNet + SFace (alignCrop, sifat baholash)
│   ├── liveness.py            # MiniFASNet Anti-spoofing moduli
│   └── worker.py              # go2rtc oqimini qabul qilish va HMAC integratsiyasi
│
├── ingestion/                 # Video Oqimlari Qatlami
│   └── go2rtc.yaml            # go2rtc konfiguratsiyasi (parolsiz, dinamik)
│
├── deploy/                    # Production Deploy va Infratuzilma
│   ├── docker-compose.yml     # Konteynerlar arxitekturasi (Faqat Caddy portlari ochiq)
│   ├── Caddyfile              # Reverse proxy sozlamalari (SSE, buffering off)
│   ├── init-db.sql            # pgvector kengaytmasi va audit rollari
│   └── .env.example           # Sirlar shabloni (openssl buyruqlari bilan)
│
├── docs/                      # Qo'llanmalar va Litsenziyalar
│   ├── LICENSES.md            # CV modellari va ochiq manba litsenziyalari
│   └── runbook.md             # Shifrlangan zaxira (age), tiklash va ekspluatatsiya
│
└── src/                       # React 18 + Vite + Tailwind Frontend
    ├── components/            # UI komponentlar
    ├── pages/                 # Sahifalar (Bugun, Xodimlar, Kameralar, Sozlamalar...)
    └── lib/api.ts             # Backend bilan 100% mos API mijozi
```

---

## 🚀 5. Tezkor Ishga Tushirish (Quickstart)

### Frontendni Mahalliy Ishga Tushirish
```bash
npm.cmd install
npm.cmd run build
npm.cmd run dev
# Brauzerda oching: http://localhost:5173
```

### Backend Testlarini Ishga Tushirish
```bash
# Python 3.11 virtual muhitida:
.venv\Scripts\pytest.exe -v
# 12 ta xavfsizlik va endpoint testlari muvaffaqiyatli bajariladi
```

### Production Deploy (Docker & Caddy)
```bash
cd deploy
cp .env.example .env
# .env dagi sirlarni openssl orqali generatsiya qiling
docker compose up -d --build
```
> Tashqariga faqat `80` va `443` portlar chiqadi. Barcha ichki xizmatlar xavfsiz tarmoqda ishlaydi.

---

## 📡 6. Yagona API Shartnomasi (API Contract)

Barcha yo'llar prefiksi: `/api/v1`. Vaqt: UTC (ISO 8601).
Xato javoblari **doim** quyidagi formatda qaytariladi:
```json
{
  "code": "employee_not_found",
  "message": "Xodim topilmadi",
  "details": {}
}
```

| Usul | Yo'l | Rol | Izoh |
|---|---|---|---|
| POST | `/auth/login` | Ommaviy | 2FA bo'lsa `{requires_2fa:true, challenge_token}`, aks holda `{access_token, user}` + refresh cookie |
| POST | `/auth/2fa` | Ommaviy | `{challenge_token, code}` → `{access_token, user}` + cookie |
| POST | `/auth/refresh` | Ommaviy | Refresh cookie orqali token rotation; qayta ishlatilsa token oilasi bekor qilinadi |
| POST | `/auth/logout` | * | Sessiyani bekor qiladi va cookieni tozalaydi |
| POST | `/auth/2fa/setup` | * | QR URI (`otpauth://`) va zaxira kodlarini generatsiya qilish |
| POST | `/auth/2fa/confirm` | * | 6 xonali kod bilan 2FA ni tasdiqlash |
| GET | `/me` | * | Joriy foydalanuvchi va ruxsatlar |
| GET/POST | `/employees` | M+ | Qidiruv, filtr va ro'yxat |
| GET/PATCH | `/employees/{id}` | M+ | Xodim ma'lumotlarini ko'rish va yangilash |
| DELETE | `/employees/{id}` | O | Xodim va barcha biometrikasi butunlay o'chadi |
| POST | `/employees/{id}/consent` | M+ | Rozilik berish: `{granted, version, method: paper\|electronic}` |
| DELETE | `/employees/{id}/consent` | M+ | Rozilikni bekor qilish: vektorlar va snapshotlar bitta tranzaksiyada o'chadi |
| POST | `/employees/{id}/enrollment/capture` | M+ | Kameradan haqiqiy kadr olish va sifat baholash |
| DELETE | `/employees/{id}/enrollment` | M+ | Namunalar tarixini tozalash |
| GET/POST | `/cameras` | M+ / O | Javobda RTSP paroli yo'q (`rtsp_masked`) |
| PATCH/DELETE | `/cameras/{id}` | O | Kamera parametrlarini va 3D koordinatasini (`position`) o'zgartirish |
| POST | `/cameras/test` | O | Haqiqiy socket handshake orqali RTSP tekshiruvi |
| GET | `/cameras/{id}/health` | M+ | Haqiqiy FPS va kechikish ko'rsatkichlari |
| POST | `/cameras/{id}/live-ticket` | M+ | 30 soniyalik bir martalik WebRTC ko'rish bileti |
| GET | `/stream/live/{camera_id}` | Ticket | go2rtc WebRTC/MSE oqimiga xavfsiz proksi |
| GET | `/attendance?date=&employee_id=` | M+ | Tashkilot vaqt zonasida (Asia/Tashkent) davomat ro'yxati |
| GET | `/employees/{id}/timeline?date=` | M+ | Faqat shu kun va shu xodimning ko'rinishlar ketma-ketligi |
| GET | `/events/{id}/snapshot` | M+ | Autentifikatsiyali snapshot (Observer ko'ra olmaydi, har ochilish auditlanadi) |
| POST | `/events/{id}/feedback` | M+ | Tanib olish natijasiga fikr bildirish (`correct: true|false`) |
| GET | `/unknown-faces` | M+ | Noma'lum shaxslar ro'yxati |
| POST | `/unknown-faces/{id}/resolve` | M+ | Triaj: `link` (faqat faol roziligi bor xodimga), `guest`, yoki `ignore` |
| GET | `/reports/attendance?from=&to=&format=json\|csv` | M+ | Maksimal 92 kun, CSV formula injection himoyasi bilan |
| POST | `/ask` | M+ | Xavfsiz tabiiy tilda savol-javob (haqiqiy hodisa confidence bilan) |
| GET | `/stream/events` | * | Real-time SSE stream (`attendance`, `camera_status`, `unknown_face`, `heartbeat`) |
| GET/PATCH | `/organization` | O | Smena vaqtlari, vaqt zonasi va saqlash muddatlari sozlamalari |
| GET/POST/PATCH | `/users` | O | Foydalanuvchilar va rollarni boshqarish |
| GET | `/audit-logs` | O | SHA-256 zanjirli immutabel audit jurnali |
| GET | `/health`, `/ready` | – | Tizim salomatligi va DB ulanish probelari |
| POST | `/internal/events` | Worker | Faqat vision-worker uchun HMAC bilan himoyalangan hodisalar qabuli |

*Rollar:* `owner (O)`, `manager (M)`, `observer (V)`. `M+` = Manager va Owner.

---

## ⚖️ 7. Huquqiy va Qonuniy Muvofiqlik (ZRU-1125 va ZRU-1115)

O'zbekiston Respublikasining Shaxsga doir ma'lumotlar to'g'risidagi Qonuni (O'RQ-547 / O'RQ-1125, O'RQ-1115):
- Barcha biometrik ma'lumotlar O'zbekiston hududidagi serverlarda saqlanadi.
- Tashqi bulutli servislarga hech qanday yuz tasviri yoki biometrik vektor chiqmaydi.
- Xodim roziligi bekor qilinganda biometrik ma'lumotlar darhol tozalanishi kafolatlangan.

Batafsil ma'lumot: [docs/LICENSES.md](docs/LICENSES.md) va [docs/runbook.md](docs/runbook.md).
