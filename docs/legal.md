# Workforce Vision Platform — Huquqiy va Qonuniy Muvofiqlik Hujjati

> **Sana:** 2026-10-15  
> **Normativ asos:** O'zbekiston Respublikasi Qonunlari (ZRU-1125, ZRU-1115) va tegishli qonunosti hujjatlari  

---

## 1. O'zbekiston Respublikasi Qonunchiligi Talablari

### 1.1 Biometrik ma'lumotlarni mahalliylashtirish (ZRU-1125)
"Shaxsga doir ma'lumotlar to'g'risida"gi O'zbekiston Respublikasi Qonuniga muvofiq:
- O'zbekiston fuqarolarining biometrik va shaxsiy ma'lumotlari (yuz embeddinglari, fotosuratlar, davomat qaydlari) **O'zbekiston Respublikasi hududida joylashgan jismoniy serverlarda** saqlanishi va qayta ishlanishi shart.
- **Tizim arxitekturasi qoidasi:** Tashqi xorijiy bulut xizmatlariga (AWS, Google Cloud, Supabase, Vercel va boshqalar) xodimlarning yuz vektorlari, snapshotlari yoki shaxsiy ma'lumotlari yuborilishi qat'iyan man etiladi. WVP to'liq **on-premise** yoki O'zbekiston ichidagi ma'lumotlar markazlarida ishga tushiriladi.

### 1.2 Yozma rozilik talabi
- Har bir xodimdan biometrik ma'lumotlarni yig'ish va qayta ishlashdan oldin **yozma yoki elektron shaklda ixtiyoriy rozilik** olinishi shart.
- **Rozilikni qaytarib olish:** Xodim istalgan vaqtda roziligini qaytarib olish huquqiga ega. Tizimda rozilik qaytarib olingan zahoti xodimning barcha yuz embeddinglari bazadan to'liq va qaytarib bo'lmaydigan qilib o'chiriladi.

### 1.3 Maxfiy hududlar va shaxsiy daxlsizlik
- Kameralar faqat ishlab chiqarish, ofis, savdo va xizmat ko'rsatish zonalariga o'rnatiladi.
- Hojatxona, kiyinish xonalari, tibbiy xonalar va dam olish xonalarida videokuzatuv o'rnatish qat'iyan taqiqlanadi.
- Maxfiy zonalarni yopish uchun "privacy-masking" usullari qo'llaniladi.

### 1.4 Sun'iy Intellekt tartibga solinishi (ZRU-1115)
- Sun'iy intellekt qaror qabul qiluvchi yakuniy organ bo'la olmaydi. Tizim faqat "dalil va ko'rsatkich" taqdim etuvchi ko'makchi vosita hisoblanadi.
- Mehnat intizomiga oid barcha qarorlar inson (menejer/rahbar) tomonidan qabul qilinadi.
