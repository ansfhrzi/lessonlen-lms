# Soal Berbasis Teks Bacaan — v1.4.0

Untuk Bahasa Indonesia, Bahasa Inggris, atau soal berbasis kasus:
beberapa soal memakai **satu** wacana.

---

## Salin ulang — 6 berkas

```
Setup.gs     Util.gs     Quiz.gs
Code.gs      js_quiz.html            css.html
```

Lalu jalankan **`migrasiStruktur()`** — dua kolom baru ditambahkan ke
sheet `soal`. Log akan menampilkan:

```
+ soal                 grup_id, stimulus
```

Data lama utuh. Soal yang sudah ada tetap berjalan seperti biasa.

**Deploy → New version.**

---

## Cara memakainya

**Kelola Item → 🎯 Soal**

1. Buat dulu soal-soalnya seperti biasa (belum perlu bacaan)
2. Klik **📖 Kelompokkan (teks bacaan)**
3. Tempel wacana pada kotak teks
4. Centang soal-soal yang memakai bacaan itu — minimal dua
5. **Satukan**

Soal yang dipilih otomatis dirapatkan berdampingan, dan bacaan muncul
di atasnya.

> Soal yang **sudah** masuk kelompok lain tetap tampil di daftar
> centang, tetapi diredupkan dan bertuliskan *"📖 sudah dalam kelompok
> 2"*. Lepaskan kelompok lamanya dulu bila ingin memindahkannya.

### Mengenali kelompok di bank soal

Setiap kelompok dibungkus **bingkai hijau** dengan kepala seperti ini:

> 📖 **Kelompok 1**  ·  3 soal berbagi satu teks bacaan · tetap
> berurutan saat diacak   [✏️ Ubah bacaan] [Lepas kelompok]

Di dalam bingkai: teks bacaannya sekali, lalu soal-soal anggotanya.
Tiap kartu soal anggota juga berlencana **📖 Kelompok 1**, berguna
saat bacaannya panjang dan kepalanya sudah tergulung ke atas layar.

Soal mandiri berada **di luar** bingkai mana pun — jadi batas awal
dan akhir tiap kelompok selalu terbaca, bahkan bila ada dua kelompok
berurutan.

### Mengubah atau membubarkan

Pada kepala kelompok ada dua tombol:

- **✏️ Ubah bacaan** — sunting wacananya; berlaku untuk seluruh anggota
- **Lepas kelompok** — bacaan dihapus, soalnya kembali berdiri sendiri
  (soalnya sendiri **tidak** dihapus)

---

## Yang dilihat murid

Bacaan tampil **di setiap soal** sekelompok, dengan penanda:

> 📖 Bacalah teks berikut *(untuk 3 soal · soal ke-2)*

Jadi murid tidak perlu kembali ke soal sebelumnya.

---

## Pengacakan

Dengan **"Acak urutan soal"** aktif:

- Kelompok tetap **utuh dan berurutan**
- Yang bergeser hanya **posisi kelompoknya**
- Soal mandiri diacak seperti biasa

Contoh: Bacaan A (soal 1–3) dan Bacaan B (soal 4–6) bisa bertukar
tempat, tapi soal di dalamnya tidak pernah terpisah.

---

## Kenapa tidak ditempel di tiap soal saja?

Itu pilihan yang tampak paling mudah, tapi ada dua biayanya:

**Boros.** Wacana 2.000 karakter × 5 soal = 10.000 karakter untuk isi
yang sama, terkirim ke tiap murid tiap percobaan. Terukur: menyimpannya
sekali **hemat 71%** — 233 KB untuk satu kelas 36 murid.

**Merepotkan.** Salah ketik satu kata berarti membetulkannya lima kali.

---

## Aturan yang dijaga sistem

Beberapa hal dijaga otomatis — Anda tidak perlu mengingatnya:

| Situasi | Yang terjadi |
|---|---|
| Menghapus soal pemegang bacaan | wacana **berpindah** ke anggota tersisa |
| Kelompok tinggal satu anggota | dibubarkan sendiri (tak lagi bermakna) |
| Menyeret soal ke tengah kelompok | kelompok bergerak **utuh**, tidak terpecah |
| Soal sudah ada di kelompok lain | ditolak — lepaskan dulu kelompok lamanya |
| Ada murid **sedang mengerjakan** | perubahan kelompok/urutan ditolak sementara |

Aturan terakhir penting: attempt menyimpan urutan soal saat dimulai.
Mengubahnya di tengah jalan membuat murid kehilangan wacana di layar.
Tunggu sampai mereka selesai.

---

## Batas

| | |
|---|---|
| Panjang bacaan | 8.000 karakter (± 1.200 kata) |
| Anggota kelompok | minimal 2, tanpa batas atas |
| Kelompok per quiz | tanpa batas |

Soal mandiri dan soal berkelompok boleh bercampur dalam satu quiz.

---

## Catatan teknis

Bacaan disimpan **sekali** pada soal bernomor terkecil dalam kelompok;
anggota lain mewarisinya lewat `grup_id`. Sistem merapikannya otomatis
setiap kali susunan soal berubah.

### Dibuatkan AI sekaligus (v1.5.5)

Alih-alih menulis wacananya sendiri, Anda bisa meminta AI:

**🎯 Soal → ✨ Buat dengan AI → kotak "📖 Soal bercerita"**

Isi *"Berapa soal memakai satu wacana"* dan pilih jenisnya (studi
kasus · narasi · data · dialog · kutipan).

> Angka itu diambil **dari** komposisi, bukan tambahan. Misal
> 8 pilihan ganda dengan 4 bercerita = tetap 8 soal, 4 di antaranya
> berbagi satu wacana.

Di layar tinjau, wacananya tampil sekali di atas kelompoknya. Bila AI
tidak menuruti permintaan — misalnya hanya membuat 2 dari 4 soal
bercerita — muncul **kotak peringatan kuning** yang menyebutkan
persisnya. Periksa apakah soal yang dikelompokkan benar-benar merujuk
wacananya; kalau tidak, hapus centangnya.

---

**Impor dari quiz lain** dan **soal buatan AI** yang berkelompok akan
mendapat `grup_id` baru — supaya tidak menyatu dengan kelompok yang
sudah ada di quiz tujuan.

---

## Pratinjau

```bash
node test/buat-pratinjau-grup-soal.js
```

Menampilkan tampilan murid (soal ke-1 dan ke-2), tampilan guru di bank
soal dengan **dua kelompok berurutan**, serta dialog Kelompokkan.

## Uji

```bash
node test/run39-grup-soal.js       # perilaku & data — 78 poin
node test/run40-tampilan-grup.js   # keterlihatan di UI — 35 poin
node test/run45-soal-cerita.js     # soal cerita buatan AI — 71 poin
```
