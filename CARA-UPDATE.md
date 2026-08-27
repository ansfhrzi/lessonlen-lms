# Cara Memperbarui LessonLen

Panduan singkat setiap kali ada berkas yang berubah.

---

## Pembaruan Terkini — Tag Kelas, Lihat Sandi, Ekspor CSV

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
