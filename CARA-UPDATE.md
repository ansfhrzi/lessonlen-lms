# Cara Memperbarui LessonLen

Panduan singkat setiap kali ada berkas yang berubah.

---

## Pembaruan Terkini — v1.19.0

### 🔴 MENDASAK: fungsi editor terkunci?

Bila menjalankan fungsi apa pun dari editor memberi:

```
Error: Hanya dijalankan dari editor Apps Script.
```

…padahal Anda memang di editor, itu regresi penjaga dari v1.16.x yang
diperbaiki di **v1.18.3**. Salin `Util.gs` terbaru, lalu:

1. **Project Settings** (ikon gerigi di panel kiri)
2. **Script Properties** → *Add script property*
3. Property: `IZIN_EDITOR` — Value: `YA`
4. Simpan, jalankan lagi fungsinya
5. **Hapus properti itu setelah selesai** — selama terpasang, penjaga
   mati untuk semua orang, termasuk murid

Saklar ini sengaja dirancang agar bisa dipasang **tanpa menjalankan
kode**, karena justru kode itulah yang sedang diblokir.


### Langkah 1 — Salin 4 berkas

Rilis v1.19.0 (pramuat materi) mengubah:

| Berkas | Jenis di editor |
|---|---|
| `Belajar.gs` | Script |
| `Code.gs` | Script |
| `js_belajar.html` | HTML |
| `js_core.html` | HTML |

Buka tiap berkas → `Ctrl+A` → tempel isi baru → `Ctrl+S`.

> ⚠️ **`Belajar.gs` dan `js_belajar.html` wajib tersalin BERSAMA.**
> Bila `js_belajar.html` tertinggal, tidak ada yang rusak — murid
> membaca seperti sebelumnya, hanya tetap menunggu tiap bagian. Bila
> `Belajar.gs` yang tertinggal, `pramuatMateriPokok` tidak ada; klien
> gagal memuat lalu **otomatis kembali ke jalur lama**, jadi murid
> tetap bisa membaca. Kedua arah aman, tetapi pramuatnya belum jalan
> sebelum keduanya tersalin.

> ⚠️ **`Belajar.gs` juga memuat perbaikan keamanan** — penjaga kunci
> kini ikut dipasang di jalur penulisan progres (`tandaiBagianSelesai`),
> bukan hanya di jalur baca. Tanpa berkas ini, murid yang memanggil
> fungsi itu langsung bisa menandai pertemuan terkunci sebagai selesai.
> Rinciannya di `PERUBAHAN.md` bagian v1.19.0.

> ⚠️ **Bila Anda belum menyalin sejak v1.17.1 atau lebih awal,** rilis
> itu memuat `Setup.gs`, `Auth.gs`, `Util.gs`, `Kelas.gs`, `js_auth.html`,
> `v_login.html`, dan `js_kelola.html`. Salin yang tertinggal lebih dulu —
> daftarnya ada di `PERUBAHAN.md`. Peringatan khususnya: `js_auth` dan
> `v_login` wajib bersama, dan `Setup.gs` memuat tambalan keamanan.

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
5. Lihat layar masuk: isian **Nama Pengguna** tidak boleh menampilkan
   teks contoh apa pun.

### ⚠️ Bila Anda pernah menjalankan `setupLengkap()`

Aplikasi membuat akun contoh: satu guru dan tiga murid, semuanya
bersandi baku dan **tidak pernah dipaksa menggantinya**. Placeholder
yang menyebut salah satunya sudah dibuang di v1.18.1, tetapi
**akunnya sendiri masih ada** dan `cekKesehatan()` belum
memeriksanya.

Bersihkan dari editor Apps Script:

```
hapusSeedData()
```

Aman — hanya menghapus baris bertanda `[CONTOH]`. Materi, kelas, dan
murid sungguhan tidak tersentuh.

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
