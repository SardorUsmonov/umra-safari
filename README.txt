UMRA SAFARI - VEB SAHIFA KODI

5 bosqich va 25 bandli interaktiv Umra cheklisti.
HTML, CSS, JavaScript, surat va tayyor A4 PDF arxiv ichida.
Belgilar tashrifchining brauzerida avtomatik saqlanadi.

IMKONIYATLAR
- Cheklist: 5 bosqich, 25 band, umumiy va bosqich bo'yicha jarayon.
- O'z bandlari: har bir bosqichga o'z bandingizni qo'shish, o'chirish
  va o'chirilganini "Qaytarish" bilan tiklash (bosqichga 30 tagacha).
- Safar rejasi: uchish va qaytish sanasi bo'yicha necha kun qolgani
  va hozir qaysi bosqich muhimligi ("Hozir" belgisi).
- Tavof hisoblagichi: 7 aylanish halqasi, tasodifiy ikki marta bosishdan
  himoya, "Bekor qilish" va "Qaytadan", sanoq paytida ekran o'chmaydi,
  yakunda cheklistdagi "Tavof" bandini bir bosishda belgilash.
- Katta shrift va tungi rejim: sarlavhadagi "A+" va oy tugmalari.
  Tanlov eslab qolinadi; tanlanmagan bo'lsa tizim rejimiga moslashadi.

ONLAYN MANZILLAR
Asosiy (GitHub Pages):  https://sardorusmonov.github.io/umra-safari/
Zaxira (Claude):        https://claude.ai/artifact/7hPxhdHRMFv2GBrouJQvrc
Kod (GitHub):           https://github.com/SardorUsmonov/umra-safari

Yangilash: fayllarni o'zgartirib, umra-safari papkasida
   git add -A
   git commit -m "o'zgarish tavsifi"
   git push
GitHub Pages 1-2 daqiqada yangilanadi.

ISHGA TUSHIRISH
1. ZIP arxivni oching.
2. Terminalda umra-safari papkasiga kiring.
3. Quyidagi buyruqni bajaring:

   python -m http.server 8080

4. Brauzerda http://localhost:8080 manzilini oching.

JavaScript modullari uchun HTTP server kerak. index.html faylini
ikki marta bosib ochish o'rniga yuqoridagi usuldan foydalaning.
VS Code Live Server orqali ham ishga tushirish mumkin.
Build bosqichi yoki npm paketlarini o'rnatish talab qilinmaydi.

TESTLAR
Node.js 22 yoki undan yangi versiya bilan, umra-safari papkasida:

   node --test

FAYLLAR
index.html          - sahifa tuzilishi
styles.css          - telefon, kompyuter va chop etish uslublari
app.js              - sahifadagi barcha interaktivlik
logic.js            - holatni o'qish/saqlash, safar rejasi hisobi (sof mantiq)
checklist-data.js   - barcha 25 band va rasmiy manbalar
tests/              - logic.js uchun avtomatik testlar
assets/             - surat, favicon va chop etiladigan PDF

HOSTING
Statik hostingga shu papka tarkibini joylashtiring.
Bosh sahifa: index.html. Server tomoni yoki ma'lumotlar bazasi kerak emas.
Google Fonts internet orqali yuklanadi; internet bo'lmasa zaxira
shriftlar ishlatiladi.

SURAT HUQUQLARI
Richard Mortel / Wikimedia Commons, CC BY 2.0.
Sahifada suratning kesilgan ko'rinishi ishlatilgan.
Manba:
https://commons.wikimedia.org/wiki/File:The_Kabah_in_the_Grand_Mosque_of_Makkah,_Saudi_Arabia_(52501405646).jpg
Litsenziya:
https://creativecommons.org/licenses/by/2.0/
