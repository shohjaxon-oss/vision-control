# Workforce Vision Platform — Kamera O'rnatish va Sozlash Qo'llanmasi (`camera-guide.md`)

> **Versiya:** 1.0  
> **Sana:** 2026-10-15  

---

## 1. Kamera turlari va vazifalari
1. **Checkpoint (Kirish/Chiqish) Kameralari:**
   - **Vazifasi:** Yuzni 1:N aniqlash va davomat (Face ID) qayd etish.
   - **Balandlik:** 1.6 m – 2.0 m (odam ko'zi darajasiga yaqin, past burchak).
   - **Burchak:** Gorizontal og'ish ≤ 15°, vertikal og'ish ≤ 15°.
   - **Yoritish:** Kamida 300 lux, orqa yorug'lik (backlight) bo'lmasligi, WDR funksiyasi yoqilgan bo'lishi lozim.
2. **General (Zal/Umumiy) Kameralari:**
   - **Vazifasi:** Hududiy mavjudlik (occupancy), odamlarni hisoblash, zonalarda vaqt o'tkazish.
   - **Balandlik:** 2.8 m – 3.5 m (shiftda keng burchak ostida).

---

## 2. Hikvision Kameralarini Sozlash Standartlari
- **RTSP Oqim manzillari:**
  - Asosiy oqim (klip/arxiv uchun): `rtsp://<user>:<password>@<ip>:554/Streaming/Channels/101`
  - Sub-oqim (AI tahlili uchun): `rtsp://<user>:<password>@<ip>:554/Streaming/Channels/102`
- **Kodek:** Sub-oqimda qat'iy **H.264** (H.265 ba'zi brauzer va tezkor dekoderlarda kechikish beradi).
- **FPS:** 15–25 FPS (kirish uchun 25 FPS, zallar uchun 15 FPS yetarli).
- **Vaqt sinxronizatsiyasi:** Kamerada **NTP** mantiqiy server bilan sinxron qilinishi shart (vaqt farqi ±1 s dan oshmasligi lozim).
- **Tarmoq xavfsizligi:** Kameralar alohida izolyatsiyalangan VLAN tarmog'iga o'tkaziladi.
