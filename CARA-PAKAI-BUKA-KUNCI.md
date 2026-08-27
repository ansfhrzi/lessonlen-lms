# Membuka Kunci untuk Murid Tertentu

Versi 1.8.0. Untuk murid yang sakit, ikut lomba, susulan, atau
tertinggal — Anda membuka akses satu item tanpa mengubah aturan
seluruh kelas.

---

## Perlu migrasi?

**Tidak.** Kolom `dibuka_paksa` dan `alasan_paksa` sudah ada di sheet
`progress` sejak Tahap 5.

---

## Berkas yang perlu disalin

| Berkas | Keterangan |
|---|---|
| `Belajar.gs` | 4 fungsi baru + 2 perbaikan penting |
| **`js_kunci.html`** | **BARU** — buat berkas HTML bernama `js_kunci` |
| `index.html` | menambah `include('js_kunci')` |
| `js_editor.html` | tombol 🔓 pada baris item |
| `js_kelola.html` | tombol 🔓 pada daftar murid |
| `Code.gs` | 4 API + `ujiTahap14()` + versi 1.8.0 |

Verifikasi:

1. **`cekBerkasUI()`** → harus **57 penanda**
2. **`ujiTahap14()`** → harus **34/34**
3. Deploy versi baru, lalu Ctrl+Shift+R

---

## Dua cara membukanya

Keduanya menuju pekerjaan yang sama — pilih yang sesuai cara Anda
berpikir saat itu.

### Cara 1 — dari sisi MURID

> *"Andi sakit dua minggu. Dia ketinggalan apa saja?"*

**Kelas → Murid di Kelas → tombol 🔓 di baris murid**

Panel menampilkan seluruh item yang terkunci untuknya, lengkap dengan
nomor pertemuan. Centang yang perlu dibuka, isi alasan, tekan **Buka
Akses**.

### Cara 2 — dari sisi ITEM

> *"Siapa saja yang belum bisa mengakses quiz ini?"*

**Pertemuan → tombol 🔓 di baris item**

Panel menampilkan ringkasan: berapa murid sudah terbuka, berapa Anda
buka, berapa masih terkunci. Centang murid yang perlu dibukakan, isi
alasan, tekan **Buka Akses**.

Ada kotak pencarian nama — berguna untuk kelas 36 murid.

> Tombol 🔓 pada item hanya muncul setelah item **diterbitkan**.
> Sebelum itu tidak ada murid yang bisa mengaksesnya sama sekali.

---

## Alasan wajib diisi

Bukan formalitas. Alasan itu:

- tercatat di sheet `log`
- **terlihat kembali** saat Anda membuka panel itu lagi

Tiga bulan kemudian Anda akan bertanya "kenapa Budi bisa akses quiz
ini?" — dan jawabannya ada di sana.

Contoh yang berguna: `sakit 2 minggu`, `ikut lomba LKS`,
`susulan 12 Agu`.

---

## Membatalkan pembukaan

Salah pilih murid pasti terjadi. Item yang sudah dibuka muncul di
bagian atas panel dengan tombol **Kunci Ulang**.

**Pekerjaan dan nilai yang sudah masuk TIDAK dihapus.** Yang dicabut
hanya izin aksesnya; nilai yang sudah diperoleh murid tetap sah dan
tetap masuk Rekap.

---

## Yang perlu diketahui

### Membuka satu item tidak membuka yang lain

Bila Anda membuka LKPD di Pertemuan 5, murid **hanya** bisa mengakses
LKPD itu. Materi dan Quiz di pertemuan yang sama tetap terkunci.

Ini disengaja: membuka satu item susulan tidak boleh berarti
melompati seluruh pertemuan.

### Menembus kunci pertemuan

Bila pertemuannya sendiri masih terkunci (murid belum menyelesaikan
pertemuan sebelumnya), membuka satu item di dalamnya **tetap
berhasil**. Murid bisa masuk ke pertemuan itu, tetapi hanya untuk item
yang Anda buka.

### Murid diberi tahu

Setiap pembukaan mengirim notifikasi ke murid yang bersangkutan.
Murid lain tidak menerima apa pun.

### Membuka untuk beberapa murid sekaligus

Centang beberapa nama, isi satu alasan, sekali tekan. Bila salah satu
gagal (misalnya murid sudah keluar kelas), yang lain **tetap
diproses** — dan kegagalannya dilaporkan lewat kotak dialog, bukan
didiamkan.

---

## Bila bermasalah

Jalankan **`ujiTahap14()`** dan salin Lognya. Ia memeriksa 34 hal,
termasuk yang paling sering keliru:

- apakah item yang dibuka benar-benar bisa diakses murid
- apakah item lain di pertemuan itu tetap terkunci
- apakah Kunci Ulang mengembalikan keadaan semula
- apakah notifikasi terkirim

Fungsi ini **aman diulang** — ia membersihkan data ujinya sendiri.
