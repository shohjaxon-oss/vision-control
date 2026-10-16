# Workforce Vision Platform — Mahsulot Spetsifikatsiyasi (SRS)

> **Versiya:** 1.0  
> **Sana:** 2026-10-15  
> **Status:** Tasdiqlangan  

---

## 1. Umumiy ko'rinish
Workforce Vision Platform (WVP) — IP-kameralar (Hikvision, Dahua, RTSP/ONVIF) oqimini sun'iy intellekt orqali real vaqt rejimida tahlil qilib, korxona va tashkilotlarda xodimlar harakatini, davomatini, ish joyidagi mavjudligini hamda zonalardagi yuklamani nazorat qiluvchi on-prem platforma.

## 2. Asosiy muammolar va yechimlar
1. **Nazoratsiz davomat:** Biometrik barmoq izi yoki turniketlar faqat eshikda ishlaydi, ish joyida xodimning real mavjudligini ko'rsatmaydi. WVP kamera orqali kirish/chiqish va ish zonalarida bo'lish vaqtini uzluksiz kuzatadi.
2. **Qo'lda tekshirish yuklamasi:** Menejer soatlab kameralarni ko'rib chiqa olmaydi. WVP hodisalarni avtomatik qayd etadi va tabiiy tilda savollarga javob beradi.
3. **Dalilsiz xulosalar:** WVP har bir hodisa uchun snapshot va ishonch koeffitsientini taqdim etadi.

## 3. Asosiy rollar va foydalanuvchi huquqlari
- **Owner (Egasi):** Tizim sozlamalari, audit jurnali, barcha kameralar va xodimlar ma'lumotlari, hisobotlar.
- **Manager (Menejer):** Xodimlarni boshqarish, davomat va tanilmagan yuzlarni ko'rib chiqish, savol-javob paneli, bildirishnomalar.
- **Observer (Kuzatuvchi):** Faqat xodimlar mavjudligi holatini cheklangan ko'rinishda ko'rish (biometrik snapshotlar yopiq).

## 4. Asosiy funksional talablar
1. **Kirish/chiqish davomati:** Checkpoint kameralarda yuzni aniqlash (TAR ≥ 98%, FAR ≤ 0.1%).
2. **Kun chizig'i (Timeline):** Xodimning kun davomida ko'ringan vaqtlari va smenaga nisbatan holati.
3. **Tanilmagan yuzlar triaji:** Tizim tanimagan shaxslar ro'yxati, ularni xodimga biriktirish yoki mehmon deb belgilash.
4. **Rozilik va maxfiylik:** O'zbekiston Qonunchiligi (ZRU-1125) bo'yicha yozma/elektron roziliksiz biometrik ishlov bloklanadi.
5. **Tabiiy til (NL Query):** LLM tool-calling orqali xavfsiz so'rovlar ("Bekzod bugun keldimi?", "Hozir kimlar ishda?").
