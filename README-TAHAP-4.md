# Tahap 4 — CRUD Kelas, Murid, Pertemuan, Item + Editor

Acuan: `KESEPAKATAN-SISTEM.md` v4.6 · `KONVENSI-TEKNIS.md` v1.0

---

## Berkas

### Baru — 4 berkas

| Berkas | Jenis | Isi |
|---|---|---|
| `Kelas.gs` | Script | CRUD kelas, murid, enrollment, impor massal |
| `Pertemuan.gs` | Script | CRUD pertemuan & item, urutan, salin antar kelas |
| `js_kelola.html` | HTML | Layar kelola kelas & murid, panel geser |
| `js_editor.html` | HTML | Layar pertemuan, item, editor konten kaya |
| `v_editor.html` | HTML | Template editor |

### Diperbarui — 4 berkas

| Berkas | Perubahan |
|---|---|
| `Code.gs` | v0.4.0, **21 fungsi API baru**, `ujiTahap4()` |
| `css.html` | +180 baris: tab, tabel, editor, panel geser |
| `index.html` | Muat 3 berkas baru, tambah `#tirai-panel` |
| `js_beranda.html` | Pintasan "Kelola Kelas" & "Kelola Murid" |
| `Setup.gs` | Komentar pengecualian pada `_buatSheet()` |

---

## Memasang

1. Buat **5 berkas baru** — `Kelas`, `Pertemuan` sebagai **Script**;
   `js_kelola`, `js_editor`, `v_editor` sebagai **HTML**
2. Timpa **5 berkas** yang diperbarui
3. Jalankan **`ujiTahap4`** → **View → Logs**
4. **Deploy → Manage deployments → ✏️ → New version → Deploy**

---

## Yang Sudah Berjalan

### Kelola Kelas (`#/kelas`)
- Buat, ubah, hapus kelas
- Isian lengkap: mapel, jenjang, fase, tingkat, kompetensi keahlian,
  capaian pembelajaran, catatan gaya AI
- Hapus kelas menghapus **seluruh turunan**: pertemuan, item, soal,
  progres, enrollment

### Kelola Murid (`#/murid`)
- Tabel dengan pencarian langsung
- Tambah satuan — kata sandi sementara ditampilkan sekali
- Ubah nama, email, status aktif/nonaktif
- Nonaktif otomatis mengakhiri seluruh sesi murid
- Reset kata sandi langsung dari tabel

### Enrollment
- Panel murid per kelas
- Pilih ganda dengan pencarian
- **Impor massal** — tempel daftar nama, username dibuat otomatis
  (bentrok disufiks angka), langsung terdaftar ke kelas
- Tabel kredensial hasil impor untuk disalin

### Pertemuan (`#/kelas/{id}`)
- Buat, ubah, hapus, ubah urutan (tombol ↑ ↓)
- Tanda draf vs terbit
- Cacah item: berapa materi, LKPD, quiz
- Publish otomatis mengirim notifikasi ke seluruh murid kelas

### Item (`#/pertemuan/{id}`)
- Tiga jenis: 📄 Materi · 📝 LKPD · 🎯 Quiz
- LKPD dan Quiz dibatasi **maksimal satu per pertemuan**
- Ubah urutan, hapus berantai

### Editor Konten
- Bilah alat: tebal, miring, garis bawah, H3, H4, daftar, tautan,
  gambar, tabel, blok kode, rumus MathJax
- **⁃ Pisah Bagian** — pemisah visual bergaris putus-putus, disimpan
  sebagai `<!--bagian-->`
- Penghitung bagian langsung
- Pratinjau per bagian dengan rumus ter-render
- Simpan sebagai draf atau langsung terbit
- Sanitasi HTML otomatis di server

### Salin Pertemuan Antar Kelas
Fitur penghemat waktu terbesar untuk 12 kelas.

- Pilih beberapa pertemuan × beberapa kelas tujuan sekaligus
- Item **dan soal** ikut tersalin
- Hasil selalu berstatus **draf** — ditinjau dulu sebelum terbit
- Urutan menyambung otomatis di kelas tujuan
- Menolak menyalin ke kelas asal sendiri

---

## Hasil Uji

```
node test/run.js    →  Tahap 1  : 12 lolos
node test/run2.js   →  Tahap 2  : 63 lolos
node test/run3.js   →  Tahap 3  : 50 lolos
node test/run4.js   →  Tahap 4  : 71 lolos
                       ─────────────────────
                       total    : 196 lolos, 0 gagal
```

Cakupan Tahap 4: CRUD kelas · CRUD murid · impor massal · enrollment ·
CRUD pertemuan · urutan · CRUD item · pengaman AI · salin antar kelas ·
hapus berantai · otorisasi · regresi.

### Uji pengaman yang lolos

```
✅ tolak nama kelas kosong, jenjang tidak sah
✅ tolak username duplikat
✅ nonaktifkan murid → seluruh sesinya dihapus
✅ LKPD/Quiz maksimal 1 per pertemuan
✅ materi AI belum ditinjau → TOLAK publish
✅ <script> dibuang saat menyimpan konten
✅ murid ditolak mengakses seluruh fungsi CRUD
✅ hapus kelas/pertemuan menghapus seluruh turunan
✅ salin tidak menggandakan ke kelas asal
```

### Bug yang ditemukan & diperbaiki

**1. `jml_bagian` tidak konsisten.** Tidak dikembalikan saat membuat item
baru, padahal saat mengedit dikembalikan. Sudah disamakan.

**2. 🔴 Edit parsial menghapus konten.** `simpanItem()` selalu menimpa
kolom `konten`, `deskripsi`, `tujuan_pembelajaran`, dan `min_durasi_detik`
— walau tidak dikirim pemanggil.

Akibatnya, setiap pemanggilan yang hanya mengirim sebagian kolom —
misalnya mencentang "materi AI sudah ditinjau" — akan **menghapus seluruh
materi yang sudah ditulis**. Kehilangan data permanen tanpa peringatan.

Perbaikan: hanya kolom yang benar-benar dikirim yang diperbarui
(`if (p.konten !== undefined)`). Konten masih bisa dikosongkan dengan
sengaja dengan mengirim string kosong. Ditambahkan 6 uji khusus agar
tidak terulang.

### Audit optimasi

`getRange()` di dalam loop: **bersih**, kecuali `Setup._buatSheet()` yang
ditetapkan sebagai pengecualian sah (pemformatan kolom, sekali jalan)
dan sudah diberi komentar penjelas.

Bench tetap **6 panggilan API** untuk menandai 31 notifikasi.

---

## Alur Kerja Menyusun Materi PKPJ

Sekarang sudah bisa dikerjakan sungguhan:

```
1. #/kelas → + Kelas
   Nama: XI TJKT 1
   Mapel: Pemasangan dan Konfigurasi Peralatan Jaringan
   Jenjang SMK · Fase F · Tingkat XI · Keahlian TJKT
   Tempel Capaian Pembelajaran

2. Klik "Pertemuan" → + Pertemuan
   Judul: Konsep Dasar VLAN
   Tujuan: Peserta didik mampu menjelaskan konsep VLAN…

3. Klik "Kelola Item" → 📄 Materi
   Tulis konten, tekan ⁃ Pisah Bagian tiap ganti topik
   Pratinjau → Simpan & Terbitkan

4. Tambah 📝 LKPD dan 🎯 Quiz bila perlu

5. Ulangi untuk 15 pertemuan

6. Kembali ke daftar pertemuan → "Salin ke Kelas Lain"
   Pilih semua pertemuan × 11 kelas lain
   → seluruh struktur tersalin sebagai draf
```

---

## Bila Bermasalah

| Gejala | Penyebab |
|---|---|
| `Kelas is not defined` | `Kelas.gs` belum dibuat sebagai Script |
| Panel tidak muncul | `#tirai-panel` belum ada di `index.html` |
| Editor kosong | `v_editor` belum dibuat / salah jenis berkas |
| Pemisah bagian hilang | Normal — disimpan sebagai `<!--bagian-->` di HTML |
| "sudah memiliki LKPD" | Benar, satu pertemuan maksimal satu LKPD |
| Materi AI tidak bisa terbit | Centang "sudah saya tinjau" dulu |

---

## Berikutnya — Tahap 5

Tampilan murid: baca materi per bagian, tombol tandai selesai,
penguncian bertingkat. Ini inti sistemnya.
