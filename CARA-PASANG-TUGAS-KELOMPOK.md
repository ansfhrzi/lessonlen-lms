# Cara Memasang Tugas Kelompok — dari Tahap 1

Panduan lengkap untuk fitur **Tugas Kelompok** (v1.7.0 → v1.7.5),
termasuk perbaikan bug `undefined` yang Anda temukan.

---

## Jawaban singkat: ya, migrasi PERLU

**Wajib jalankan `migrasiStruktur()` satu kali.**

Alasannya ada tiga, dan ketiganya tidak bisa dilewati:

| Yang ditambahkan | Bila tidak dimigrasikan |
|---|---|
| Sheet **`kelompok`** (baru) | Seluruh fitur gagal — tidak ada tempat menyimpan susunan kelompok |
| 2 kolom di `lkpd_submission`: `kelompok_id`, `nilai_anggota` | Pengumpulan kelompok tidak bisa dibedakan dari LKPD; penyesuaian nilai per anggota hilang |
| Nilai enum **`tugas_kelompok`** pada kolom `tipe` | **Inilah yang Anda alami** — Google Sheets menolak nilai yang tidak ada di daftar validasi dropdown |

> `migrasiStruktur()` **aman dijalankan berulang**. Ia hanya menambah
> yang belum ada; data lama tidak disentuh.

---

## Kenapa muncul `undefined`?

Ada **dua sebab berbeda**. Periksa keduanya.

### Sebab 1 — berkas UI belum tersalin (paling sering)

Tampilan mengubah kode tipe menjadi ikon dan nama lewat sebuah peta:

```js
NAMA_TIPE[i.tipe]   // 'tugas_kelompok' → 'Tugas Kelompok'
```

Sampai v1.7.4, tiga berkas belum mengenal tipe baru itu. Peta JavaScript
mengembalikan `undefined` diam-diam untuk kunci yang tidak dikenal —
tanpa galat, tanpa jejak, langsung tampil di layar.

Diperbaiki v1.7.5 di `js_nav.html`, `js_belajar.html`, dan
`js_kelompok.html`.

### Sebab 2 — enum belum dimigrasikan

Bila `migrasiStruktur()` belum dijalankan, Sheets menolak menyimpan
`tugas_kelompok` pada kolom `tipe`. Itemnya gagal tersimpan, atau
tersimpan dengan tipe kosong — dan tipe kosong juga menghasilkan
`undefined`.

**Cara memastikan mana penyebabnya:** jalankan `ujiTahap13()`
(langkah 5 di bawah). Ia menunjuk langsung ke sebabnya.

---

## Langkah pemasangan

### Tahap 1 — salin berkas backend (`.gs`)

Buka editor Apps Script. Untuk berkas **BARU**, tekan **+ → Script**
dan beri nama persis seperti tertulis (tanpa `.gs`).

| # | Berkas | Keterangan |
|---|---|---|
| 1 | `Setup.gs` | sheet `kelompok`, 2 kolom baru, enum `tipe` |
| 2 | `Util.gs` | prefix ID `KLP` |
| 3 | **`Kelompok.gs`** | **BARU** — buat Script bernama `Kelompok` |
| 4 | `Db.gs` | perbaikan `bacaKolom()` (v1.7.1) |
| 5 | `Pertemuan.gs` | tipe item baru, hapus berantai |
| 6 | `Kelas.gs` | hapus berantai ikut membuang kelompok |
| 7 | `Lkpd.gs` | menolak pengumpulan kelompok (v1.7.1) |
| 8 | `Beranda.gs` | penghitung tugas kelompok terpisah |
| 9 | `Rekap.gs` | nilai tugas kelompok masuk rekap |
| 10 | `Code.gs` | API baru + `ujiTahap13()` + versi `1.7.5` |

### Tahap 2 — salin berkas tampilan (`.html`)

Untuk berkas **BARU**, tekan **+ → HTML** dan beri nama persis
seperti tertulis (tanpa `.html`).

| # | Berkas | Keterangan |
|---|---|---|
| 11 | **`js_kelompok.html`** | **BARU** — buat HTML bernama `js_kelompok` |
| 12 | `index.html` | menambah `include('js_kelompok')` |
| 13 | `js_core.html` | rute `nilai-kelompok` & `tugas-kelompok` |
| 14 | `js_editor.html` | ikon, nama tipe, tombol tambah item |
| 15 | `js_beranda.html` | tombol 👥 Tugas kelompok menunggu |
| 16 | **`js_nav.html`** | **v1.7.5** — perbaikan `undefined` di sidebar |
| 17 | **`js_belajar.html`** | **v1.7.5** — perbaikan nama enum mentah |
| 18 | `css.html` | gaya kartu kelompok, kotak nilai, penanda keluar |

> Nomor 16 dan 17 adalah **perbaikan bug yang Anda laporkan**. Tanpa
> keduanya, `undefined` tetap muncul walaupun migrasi sudah jalan.

### Tahap 3 — jalankan migrasi

Di editor Apps Script, pilih fungsi **`migrasiStruktur`** lalu
**Run**.

Yang harus terlihat di Log:

```
Sheet `kelompok` dibuat.
Kolom `kelompok_id` ditambahkan ke lkpd_submission.
Kolom `nilai_anggota` ditambahkan ke lkpd_submission.
Validasi enum diperbarui.
```

Bila Log menyebut *"sudah ada"* untuk semuanya, berarti migrasi sudah
pernah dijalankan — itu normal dan tidak merusak apa pun.

### Tahap 4 — verifikasi berkas tersalin

Jalankan **`cekBerkasUI()`**.

Harus melaporkan:

```
✅ SELURUH BERKAS UI SUDAH VERSI TERBARU
   47 penanda ditemukan.
```

Bila ada penanda basi, Log menyebut **berkas mana** dan **apa
akibatnya**. Salin ulang berkas itu — ini bukan masalah cache.

Lalu jalankan **`cekKesehatan()`**: modul `Kelompok` harus ✅.

### Tahap 5 — uji fungsional di Apps Script

Jalankan **`ujiTahap13()`**.

Harus berakhir dengan:

```
  LOLOS: 53   GAGAL: 0
✅ Tugas kelompok berfungsi di Apps Script.
```

Fungsi ini **aman diulang** — ia membersihkan datanya sendiri di awal
dan akhir, jadi boleh dijalankan berkali-kali tanpa menumpuk sampah.

Yang diperiksanya, 9 bagian:

| Bagian | Isi |
|---|---|
| A | sheet & kolom baru, prefix `KLP`, modul termuat |
| B | **item bertipe `tugas_kelompok` bisa disimpan** ← penyebab `undefined` |
| C | payload layar guru, termasuk medan `jml_aktif` & `ketua_keluar` |
| D | alur murid: bukan-ketua ditolak, seluruh anggota dapat progres |
| E | tidak bocor ke antrean & penilaian LKPD |
| F | nilai kelompok + penyesuaian per anggota |
| G | keduanya masuk Rekap dengan benar |
| H | anggota keluar kelas ditandai, bukan disembunyikan |
| I | hapus item ikut membuang kelompok & pengumpulannya |

**Bila gagal di bagian A atau B**, Log akan menulis
`JALANKAN migrasiStruktur()`. Jalankan, lalu ulangi `ujiTahap13()`.

### Tahap 6 — deploy ulang & muat ulang

1. **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**
2. Buka aplikasi dengan **Ctrl+Shift+R** (atau jendela Penyamaran)

Melewatkan langkah 1 adalah sebab tersering "kode sudah disalin tapi
tampilan tidak berubah" — URL `/exec` masih menyajikan versi lama.

---

## Ringkasan urutan

```
salin 10 berkas .gs   →  salin 8 berkas .html
        ↓
migrasiStruktur()     →  cekBerkasUI()  →  cekKesehatan()
        ↓
ujiTahap13()          →  harus 53/53
        ↓
Deploy versi baru     →  Ctrl+Shift+R
```

---

## Bila masih bermasalah

Jalankan ketiganya dan **salin seluruh Log** apa adanya:

```
cekKesehatan()     modul .gs mana yang belum tersalin
cekBerkasUI()      berkas HTML/CSS mana yang masih versi lama
ujiTahap13()       fungsi mana yang gagal, beserta sebabnya
```

Ketiganya sengaja menyebutkan **akibat** tiap kegagalan, bukan hanya
namanya — jadi Lognya bisa dibaca langsung tanpa menebak.

### Yang belum ada (Tahap 3)

Layar **murid** untuk mengerjakan tugas kelompok belum dibuat.
Backend-nya sudah siap.

Untuk sementara, murid yang menekan notifikasi penilaian akan melihat
pesan jujur *"Tugas Kelompok belum tersedia"* — bukan galat teknis.
Guru tetap bisa menyusun kelompok dan menilai sepenuhnya.
