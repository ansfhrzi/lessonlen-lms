# Cara Memperbarui LessonLen

Panduan singkat setiap kali ada berkas yang berubah.

---

## Pembaruan Terkini — v1.18.0: Lupa Nama Pengguna, Sesi 30 Hari, Tambalan Keamanan

### Langkah 1 — Salin 6 berkas

| Berkas | Jenis di editor |
|---|---|
| `Setup.gs` | Script |
| `Auth.gs` | Script |
| `Kelas.gs` | Script |
| `Code.gs` | Script |
| `js_auth.html` | HTML |
| `v_login.html` | HTML |

Buka tiap berkas → `Ctrl+A` → tempel isi baru → `Ctrl+S`.

> ⚠️ **`js_auth` dan `v_login` wajib tersalin BERSAMA.**
> Bila `v_login` tertinggal, tombolnya tidak ada — murid tetap harus
> bertemu guru, tidak ada yang rusak. Bila `js_auth` yang tertinggal,
> tombolnya **ADA tetapi tidak melakukan apa-apa** — murid mengira
> sudah meminta lalu menunggu. Yang kedua jauh lebih buruk.

> ⚠️ **`Setup.gs` memuat tambalan keamanan.** Tanpa berkas ini, murid
> yang paham `google.script.run` bisa membuat akun guru untuk dirinya
> sendiri. Rinciannya di `PERUBAHAN.md` bagian v1.17.1.

### Langkah 2 — Tidak ada migrasi

Rilis ini **tidak mengubah struktur sheet**. Jangan jalankan
`setupLengkap()` maupun `migrasiStruktur()` — tidak diperlukan.

Yang dipakai hanya kolom `email` dan `no_wa` yang sudah ada sejak
v1.10.0.

### Langkah 3 — Deploy

**Deploy → Manage deployments → ✏️ (edit) → Version: New version → Deploy**

Tanpa langkah ini, perubahan hanya berlaku saat dijalankan dari editor,
bukan di aplikasi yang dibuka murid.

### Langkah 4 — Verifikasi

**Di editor Apps Script**, jalankan **`cekBerkasUI`**. Harus tampil:

```
✅ SELURUH BERKAS UI SUDAH VERSI TERBARU
   158 penanda ditemukan.
```

Bila ada penanda v1.17.0 yang disebut basi, salin ulang berkas itu.

**Di aplikasi** (keluar dulu bila sedang masuk):

1. Layar masuk menampilkan **dua** tautan: *Lupa kata sandi?* dan
   *Lupa nama pengguna?*
2. Tekan **Lupa nama pengguna?** → isi email + nomor WA seorang murid
   yang **sudah** melengkapi biodata → username-nya muncul.
3. Ulangi dengan nomor WA yang salah → harus muncul *"Data Tidak
   Ditemukan"*, **bukan** pesan yang berbeda. Bila pesannya berbeda,
   ada kebocoran — jangan dipakai dulu.
4. Ulangi 6 kali dengan email yang sama → harus muncul *"Terlalu
   Banyak Percobaan"*.
5. Tekan **Lupa kata sandi?** → isi username yang **tidak ada** →
   harus muncul *"Tidak Dapat Diproses — Nama pengguna tidak
   ditemukan atau akun Anda nonaktif"*, **bukan** "Permintaan
   Diterima".
6. Isi username murid yang **nonaktif** → pesannya harus **sama persis**
   dengan langkah 5. Bila berbeda, ada kebocoran status akun.
7. Isi username murid aktif → "Permintaan Diterima", dan permintaannya
   muncul di layar **Permintaan Reset**.

**Catatan penting untuk guru:** murid hanya bisa memulihkan username
sendiri bila dia **sudah mengisi biodata** (email + nomor WA). Yang
belum, tetap harus menemui Anda — dan itu disengaja, sekaligus jadi
alasan bagi murid untuk melengkapi biodatanya.

Lihat `cekNomorWa()` di editor untuk mengetahui berapa banyak murid
yang nomornya sudah terisi dan terbaca.

---

## Pembaruan Sebelumnya — Tag Kelas, Lihat Sandi, Ekspor CSV

### Langkah 1 — Salin 6 berkas

| Berkas | Jenis di editor |
|---|---|
| `Setup.gs` | Script |
| `Auth.gs` | Script |
| `Kelas.gs` | Script |
| `Code.gs` | Script |
| `js_kelola.html` | HTML |
| `css.html` | HTML |

Buka tiap berkas → `Ctrl+A` → tempel isi baru → `Ctrl+S`.

### Langkah 2 — Jalankan migrasi

> **Jangan jalankan `setupLengkap()`** — itu untuk instalasi baru dan
> akan membuat spreadsheet kedua.

Pilih fungsi **`migrasiStruktur`** di toolbar → **Run** → **View → Logs**.

Keluaran yang diharapkan:

```
=== MIGRASI STRUKTUR ===
  + users               pwd_awal

  1 kolom/sheet ditambahkan. Data lama utuh.
========================
```

Bila muncul `Struktur sudah sesuai`, berarti kolom sudah ada — tidak
masalah, lanjut saja.

### Langkah 3 — Deploy

**Deploy → Manage deployments → ✏️ (edit) → Version: New version → Deploy**

Tanpa langkah ini, perubahan hanya berlaku saat dijalankan dari editor,
bukan di aplikasi yang dibuka murid.

### Langkah 4 — Verifikasi

Buka aplikasi → **Kelola Murid**. Harus terlihat:

- Kolom **Kelas** dengan tag hijau
- Dropdown filter kelas
- Centang **Tampilkan kata sandi**
- Tombol **⬇ Unduh CSV**

---

## Tentang `migrasiStruktur()`

Fungsi ini menyesuaikan struktur sheet dengan skema terbaru **tanpa
menghapus data**.

| Sifat | Keterangan |
|---|---|
| Aman diulang | Kolom yang sudah ada dilewati |
| Data utuh | Kolom disisipkan, isi baris tetap sejajar |
| Sheet baru | Dibuat otomatis bila belum ada |
| Format ikut | Lebar kolom, validasi, format tanggal diterapkan ulang |

Sudah diuji dengan mensimulasikan database lama: kolom `pwd_awal`
disisipkan di posisi 5, dan seluruh data (nama, sandi, kelas) tetap
sejajar dengan kolomnya.

### Catatan sandi setelah migrasi

Murid **lama** akan menampilkan kolom sandi kosong — wajar, karena
sandi mereka tidak pernah disimpan dalam bentuk terbaca.

Untuk memunculkannya, tekan **Reset** pada murid tersebut. Sandi baru
akan tampil di daftar sampai murid menggantinya sendiri.

Murid **baru** otomatis punya sandi yang terbaca sejak dibuat.

---

## Kapan Memakai Fungsi Mana

| Fungsi | Kapan |
|---|---|
| `setupLengkap()` | **Sekali saja** saat pertama memasang |
| `migrasiStruktur()` | Setiap kali ada kolom/sheet baru |
| `infoDatabase()` | Memeriksa jumlah baris & kapasitas |
| `hapusSeedData()` | Membuang data contoh saat mulai dipakai sungguhan |
| `resetTotal()` | ⚠️ Mengosongkan **seluruh** data |
| `resetGuruDarurat()` | Akun guru terkunci atau lupa sandi |

---

## Bila Bermasalah

| Gejala | Solusi |
|---|---|
| Kolom sandi selalu kosong | Wajar untuk murid lama — tekan Reset |
| `pwd_awal is not defined` | `migrasiStruktur()` belum dijalankan |
| Tabel murid tidak berubah | Belum deploy versi baru |
| Muncul spreadsheet kedua | Terlanjur menjalankan `setupLengkap()` — hapus yang baru, periksa `DB_ID` di **Project Settings → Script Properties** |
| Tombol unduh tidak bereaksi | Pemblokir pop-up browser aktif |
