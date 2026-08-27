# Tahap 1 — Pembuatan Database

Berkas: `Setup.gs` · Acuan: `KESEPAKATAN-SISTEM.md` v4.5 §11

---

## Cara Menjalankan

### 1. Buat project Apps Script

Buka [script.google.com](https://script.google.com) → **New project** → beri nama **LessonLen**.

### 2. Tempel kode

Hapus isi `Code.gs` bawaan, ganti dengan seluruh isi `Setup.gs`.
(Nama berkasnya boleh tetap `Code.gs` untuk sementara — nanti dirapikan di Tahap 2.)

### 3. Jalankan

Pilih fungsi **`setupLengkap`** pada kotak dropdown di toolbar → klik **Run**.

Saat pertama kali dijalankan Google meminta izin:

```
Authorization required  →  Review permissions
Pilih akun Google Anda
"Google hasn't verified this app"  →  Advanced
                                   →  Go to LessonLen (unsafe)
Allow
```

> Peringatan "unsafe" itu normal untuk script pribadi yang belum diverifikasi Google.

### 4. Salin DB_ID

Buka **View → Logs** (atau `Ctrl+Enter`). Akan tampil:

```
==================================================
 SETUP LENGKAP SELESAI
 DB_ID: 1AbC...xyz
 URL  : https://docs.google.com/spreadsheets/d/1AbC...xyz

 Login contoh:
   guru  → username: guru     password: guru123
   murid → username: siswa01  password: siswa123
==================================================
```

`DB_ID` sudah otomatis tersimpan di Script Properties — tidak perlu ditempel manual.
Buka URL-nya untuk memeriksa hasilnya.

---

## Yang Terbentuk

**Spreadsheet `DB_LESSONLEN`** berisi **14 sheet**:

| # | Sheet | Isi seed |
|---|---|---|
| 1 | `users` | 1 guru + 3 murid |
| 2 | `kelas` | 1 kelas PKPJ XI TJKT |
| 3 | `enrollment` | 3 baris |
| 4 | `pertemuan` | 2 pertemuan |
| 5 | `item` | 4 item (2 materi, 1 LKPD, 1 quiz) |
| 6 | `progress` | kosong |
| 7 | `soal` | 5 soal pilihan ganda |
| 8 | `quiz_attempt` | kosong |
| 9 | `lkpd_submission` | kosong |
| 10 | `materi_ai` | kosong |
| 11 | `notifikasi` | 3 baris |
| 12 | `permintaan_reset` | kosong |
| 13 | `session` | kosong |
| 14 | `log` | kosong |

Setiap sheet sudah dilengkapi:

- Header hijau tua `#4E9A4A`, huruf putih, tebal
- Baris 1 dibekukan + dilindungi (peringatan bila diubah)
- Lebar kolom disesuaikan isi
- **Validasi dropdown** pada kolom enum — `role`, `tipe`, `status`, `jenjang`, `fase`, dll
- Format tanggal `yyyy-mm-dd hh:mm:ss` otomatis
- Baris selang-seling agar mudah dibaca
- Kolom berlebih dihapus

Selain itu, `PropertiesService` diisi:
- `DB_ID` — ID spreadsheet
- `CTR_*` — 13 counter ID
- `TEMPLATE_FEEDBACK` — 6 template umpan balik bawaan (§6.4.4)

---

## Isi Seed Data

Kelas contoh memakai data PKPJ sungguhan (§16b kesepakatan):

| Kolom | Nilai |
|---|---|
| Mapel | Pemasangan dan Konfigurasi Peralatan Jaringan (PKPJ) |
| Jenjang · Fase · Tingkat | SMK · F · XI |
| Kompetensi keahlian | TJKT |
| Capaian pembelajaran | teks CP lengkap |

**Pertemuan 1 — Konsep Dasar VLAN**
- 📄 Materi "Apa itu VLAN" — 3 bagian (dipisah `<!--bagian-->`), lengkap dengan tabel dan penanda saran gambar
- 📝 LKPD "Identifikasi Kebutuhan VLAN" — petunjuk kerja + kriteria penilaian
- 🎯 Quiz "Konsep VLAN" — 5 soal PG, KKM 75, 15 menit, 3 percobaan

**Pertemuan 2 — Konfigurasi dan Pengujian VLAN**
- 📄 Materi "Langkah Konfigurasi VLAN" — 2 bagian, berisi contoh perintah Cisco

Semua data contoh ditandai `[CONTOH]` pada nama supaya mudah dikenali dan dihapus.

---

## Fungsi Lain

| Fungsi | Kegunaan |
|---|---|
| `setupLengkap()` | Buat database + seed **(paling sering dipakai)** |
| `setupDatabase()` | Buat struktur saja, tanpa seed |
| `isiSeedData()` | Tambahkan seed ke database yang sudah ada |
| `infoDatabase()` | Tampilkan ringkasan jumlah baris tiap sheet |
| `hapusSeedData()` | Hapus semua baris `[CONTOH]` beserta turunannya |
| `resetTotal()` | ⚠️ Kosongkan **seluruh** data, struktur tetap |

### Saat siap dipakai sungguhan

```
1. Jalankan  hapusSeedData()
2. Buka sheet `users`, ganti password_hash akun "guru"
   (atau tunggu Tahap 2 — fitur ganti password dari UI)
3. Buat kelas asli lewat UI (Tahap 4)
```

> `hapusSeedData()` **tidak** menghapus akun `guru` — itu akun kerjamu. Yang dihapus hanya baris bertanda `[CONTOH]`.

---

## Verifikasi

Uji otomatis sudah dijalankan dengan simulasi Apps Script API:

```
✅ Sintaks valid
✅ 14 sheet terbentuk, kolom cocok dengan §11 kesepakatan
✅ Hash SHA-256 menghasilkan 64 karakter heksadesimal
✅ jml_bagian (3) cocok dengan jumlah <!--bagian--> pada konten
✅ Counter ID berurutan tanpa tabrakan
✅ Opsi soal tersimpan sebagai JSON array yang sah
✅ Kolom umpan balik (catatan_guru, dibaca_murid) ada di quiz & LKPD
✅ TEMPLATE_FEEDBACK terpasang 6 entri
```

Uji dapat diulang kapan saja:

```bash
node test/run.js
```

### Periksa manual

Buka spreadsheet, lalu pastikan:

- [ ] Ada 14 tab dengan urutan sesuai daftar di atas
- [ ] Header berwarna hijau tua dan tidak ikut ter-scroll
- [ ] Klik sel `role` di sheet `users` → muncul dropdown `guru` / `murid`
- [ ] Sheet `item` kolom `konten` berisi HTML dengan `<!--bagian-->`
- [ ] Sheet `soal` kolom `opsi` berisi JSON array
- [ ] Kolom tanggal tampil sebagai `2026-07-29 08:40:00`

---

## Bila Bermasalah

| Gejala | Sebab & solusi |
|---|---|
| `DB_ID belum ada` | Jalankan `setupDatabase()` lebih dulu |
| `Data sudah ada — seed dilewati` | Normal. Pakai `resetTotal()` bila ingin mengulang |
| Izin ditolak | Ulangi, pilih **Advanced → Go to LessonLen (unsafe)** |
| Ingin mulai dari nol | Hapus spreadsheet di Drive, hapus properti `DB_ID` di **Project Settings → Script Properties**, jalankan lagi |
| Eksekusi > 30 detik | Wajar pada pembuatan pertama (banyak pemformatan) |

---

## Berikutnya — Tahap 2

`Db.gs` · `Util.gs` · `Auth.gs` + halaman login.

Setelah itu kamu sudah bisa masuk memakai `guru` / `guru123` dan melihat dashboard kosong pertama.
