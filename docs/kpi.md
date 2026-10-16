# Workforce Vision Platform — Sifat Mezonlari va KPI Ko'rsatkichlari (`kpi.md`)

> **Versiya:** 1.0  
> **Sana:** 2026-10-15  

---

## 1. Asosiy AI va Tizim Metrikalari

| Mezon | Maqsad | O'lchash uslubi |
|---|---|---|
| **Kirish nuqtasida yuz bilan check-in (TAR)** | ≥ 98% | Ground-truth belgilangan 20+ soatlik video asosida |
| **Noto'g'ri odamni qabul qilish (FAR)** | ≤ 0.1% | 1:N qidiruvda begona shaxsni xodim deb tanish holati |
| **Fotosurat/ekran bilan aldash (Liveness)** | ≤ 1% | MiniFASNet anti-spoofing testi |
| **Ogohlantirishlarning xatolik ulushi (False Positive)** | ≤ 10% | Menejerning "to'g'ri / noto'g'ri" qayta aloqasi orqali |
| **Hodisadan foydalanuvchiga xabar yetib borishi** | < 5 soniya | Vision Worker → Event Bus → SSE / Bot kechikishi |
| **Tabiiy tilda savol-javob javob berish tezligi** | < 3 soniya | `/ask` API so'rovi vaqti |
| **Kamera uzilganda avtomatik qayta ulanish** | < 30 soniya | Tarmoq uzilishi va tiklanish testi |
| **Tizim ishonchliligi (Uptime)** | ≥ 99.5% | 72 soatlik va 7 kunlik soak test sinovida |
| **Xotira/GPU resurs oqishi (Leakage)** | 0% | 72 soat uzluksiz oqimda barqaror RAM/VRAM |
