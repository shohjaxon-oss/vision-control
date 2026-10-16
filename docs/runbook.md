# Workforce Vision Platform — Ekspluatatsiya va Nosozliklarni Bartaraf Etish (Runbook)

> **Versiya:** 1.0  
> **Sana:** 2026-10-15  

---

## 1. Ishga tushirish (Deployment)
Tizim to'liq Docker Compose yordamida bir buyruq bilan ishga tushiriladi:
```bash
cd deploy
docker compose up -d
```

Xizmatlar:
- `postgres`: PostgreSQL 16 + pgvector (port 5432)
- `go2rtc`: RTSP/WebRTC shlyuzi (port 1984, 8554, 8555)
- `api`: FastAPI Core API (port 8000)
- `vision-worker`: AI deteksiya va yuz tanish xizmati
- `web`: Frontend Web Dashboard (port 3000)

---

## 2. Tipik Nosozliklar va Ularni Yechish

### 2.1 Kamera uzilib qolsa (Offline)
1. Ping tekshiruvi: `ping <kamera_ip>`
2. RTSP oqimini test qilish: `docker compose logs go2rtc` yoki `/cameras/test` API orqali.
3. go2rtc 30 soniya ichida eksponensial kutish bilan avtomatik qayta ulanadi.

### 2.2 Bazani zaxiralash (Backup) va Tiklash (Restore)
- Zaxira nusxa olish:
```bash
docker exec -t deploy-postgres-1 pg_dump -U wfv_user wfv_db > backup_$(date +%Y%m%d).sql
```
- Tiklash:
```bash
cat backup_*.sql | docker exec -i deploy-postgres-1 psql -U wfv_user -d wfv_db
```

### 2.3 Rozilik qaytarilganda biometrik ma'lumotni o'chirish tekshiruvi
Xodim rozilikni bekor qilganda:
```sql
SELECT count(*) FROM face_embeddings WHERE employee_id = '<id>';
-- Natija 0 bo'lishi shart.
```
