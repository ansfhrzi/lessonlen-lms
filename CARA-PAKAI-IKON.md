# Cara Mengganti Ikon & Nama Aplikasi

Sejak **v1.15.6** ikon aplikasi diatur dari **satu baris**. Sebelumnya
ia diketik tangan di tiga berkas, dan yang terlupa baru ketahuan
berminggu-minggu kemudian.

---

## Cara cepat: ganti emoji

Buka **`Code.gs`** di editor Apps Script, cari baris ini di bagian
paling atas:

```js
var APP_IKON = '\uD83C\uDF31';        /* 🌱 tunas */
```

Ganti nilainya, **simpan**, lalu **Deploy → New deployment** (atau
*Manage deployments → Edit → New version*).

### Emoji siap pakai

Salin kode di kolom kanan apa adanya:

| Ikon | Nama | Kode |
|---|---|---|
| 🌱 | tunas *(sekarang)* | `'\uD83C\uDF31'` |
| 📚 | tumpukan buku | `'\uD83D\uDCDA'` |
| 🎓 | topi wisuda | `'\uD83C\uDF93'` |
| 📖 | buku terbuka | `'\uD83D\uDCD6'` |
| 🧩 | kepingan puzzle | `'\uD83D\uDCA1'` |
| 🖥️ | komputer | `'\uD83D\uDDA5'` |
| 🌐 | jaringan / globe | `'\uD83C\uDF10'` |
| ⚡ | kilat | `'\u26A1'` |
| 🔧 | kunci pas | `'\uD83D\uDD27'` |
| 🛠️ | perkakas | `'\uD83D\uDEE0'` |

Contoh mengganti ke 📚:

```js
var APP_IKON = '\uD83D\uDCDA';        /* 📚 buku */
```

### Mengapa `'\uD83D\uDCDA'` dan bukan `'📚'` langsung?

Emoji mentah **berisiko rusak** saat disalin ke editor Apps Script —
sebagian penyalinan mengubahnya jadi `?` atau kotak kosong. Bentuk
escape `\uXXXX` selalu aman.

Kalau Anda ingin memakai emoji yang tidak ada di tabel: cari kode
escape-nya di situs seperti *unicode-table.com* (kolom "UTF-16"), atau
kirimkan emojinya ke saya.

---

## Mengganti nama aplikasi

Di berkas yang sama, dua baris di atasnya:

```js
var APP_NAMA  = 'LessonLen';
```

Nama ini muncul di **judul tab peramban**, **topbar**, dan **layar
masuk** — semuanya sekaligus.

---

## Yang ikut berubah

Satu baris `APP_IKON` mengatur **tiga tempat**:

| Tempat | Terlihat di |
|---|---|
| Favicon | ikon kecil di tab peramban |
| Topbar | pojok kiri atas, semua layar |
| Layar masuk | ikon besar di atas kotak login |

---

## Setelah mengganti

1. **Salin ulang `Code.gs`** ke editor Apps Script
2. **Deploy versi baru** — perubahan tidak muncul tanpa ini
3. Buka aplikasi dengan **Ctrl+Shift+R** (Windows) atau
   **Cmd+Shift+R** (Mac)

> ⚠️ **Favicon paling keras kepala.** Peramban menyimpannya jauh lebih
> lama daripada berkas lain. Bila ikon tab masih yang lama padahal
> topbar sudah berubah, coba buka di jendela **Penyamaran/Incognito** —
> kalau di situ sudah benar, berarti hanya cache peramban Anda.

Jalankan `cekBerkasUI()` untuk memastikan seluruh berkas UI sudah
versi terbaru.

---

## Memakai gambar sendiri (bukan emoji)

Bisa, tetapi lebih rumit dan **tidak saya sarankan** kecuali Anda
memang punya logo sekolah.

Sebabnya: Apps Script tidak menyediakan tempat menaruh berkas gambar.
Gambarnya harus disandikan menjadi teks (data-URI base64) dan
ditempelkan ke dalam kode — dan berkas PNG kecil pun menjadi ribuan
karakter.

Bila tetap ingin:

1. Siapkan PNG **persegi**, maksimal 64×64 piksel, di bawah 10 KB
2. Ubah ke base64 lewat *base64-image.de* atau serupa
3. Kirimkan hasilnya ke saya — pemasangannya perlu mengubah tiga
   tempat sekaligus, dan `APP_IKON` yang sekarang berupa teks emoji
   harus diganti menjadi elemen `<img>`

Alternatif yang jauh lebih murah: **emoji + nama sekolah** di
`APP_NAMA`. Misalnya `'PKPJ SMK'` dengan ikon 🌐 sudah cukup
membedakan.
