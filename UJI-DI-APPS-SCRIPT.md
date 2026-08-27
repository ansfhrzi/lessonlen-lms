# Panduan Uji di Apps Script — v1.2.1

> ✅ **Langkah 1–3 SUDAH LOLOS** (11.23) — `ujiTahap9()` 56/56, 171 detik.
> Lanjutkan ke **Langkah 4 (Deploy)** dan **Langkah 5 (uji layar)**.
> Bagian yang sudah lewat boleh dilompati.

Menguji tiga rilis sekaligus: **hierarki tiga tingkat** (v1.0–1.1) dan
**Refleksi** (v1.2). Perkiraan total: **20–30 menit**.

---

## Langkah 1 — Salin berkas

Berkas yang berubah sejak terakhir Anda salin (batch v1.0.0). Salin
**seluruhnya**, timpa isi lama (`Ctrl+A` lalu tempel):

### Berkas BARU — buat file baru di editor

| Berkas | Cara membuat |
|---|---|
| `Refleksi.gs` | ➕ → Script → beri nama `Refleksi` |
| `js_refleksi.html` | ➕ → HTML → beri nama `js_refleksi` |

> Saat membuat file HTML, Apps Script otomatis menambahkan `.html`.
> Tulis namanya **`js_refleksi`** saja, tanpa ekstensi.

> **Sudah menyalin batch v1.2.0 dan `ujiTahap9()` gagal 2 poin pada
> notifikasi?** Itu bug v1.2.0 yang sudah diperbaiki. Cukup salin ulang
> **`Setup.gs`** (+ `Code.gs` bila ingin nomor versi benar), jalankan
> **`migrasiStruktur()`** sekali lagi — log akan menampilkan
> `~ notifikasi  validasi dropdown diperbarui` — lalu ulangi
> `ujiTahap9()`. Seharusnya 56/56.

### Berkas yang DIUBAH — timpa yang sudah ada

```
Setup.gs        Kelas.gs        Pertemuan.gs    MateriPokok.gs
Code.gs         index.html      css.html        v_editor.html
js_editor.html  js_nav.html     js_belajar.html
```

**Total: 13 berkas** (2 baru + 11 diubah).

Berkas yang **tidak berubah** dan tidak perlu disentuh:
`Db.gs` · `Util.gs` · `Auth.gs` · `Notif.gs` · `Beranda.gs` ·
`Belajar.gs` · `Lkpd.gs` · `Quiz.gs` · `Ai.gs` · `js_core.html` ·
`js_auth.html` · `js_beranda.html` · `js_kelola.html` · `js_lkpd.html` ·
`js_quiz.html` · seluruh `v_*.html` lain.

---

## Langkah 2 — Migrasi

Jalankan dari editor, **berurutan**:

```
1. migrasiStruktur()     → menambah kolom baru bila belum ada
2. migrasiHierarki()     → menata pertemuan ke dalam Materi Pokok
3. cekKesehatan()        → memastikan semuanya siap
```

### Yang harus terlihat di log

`migrasiHierarki()` — aman diulang. Bila struktur sudah rapi:

```
=== MIGRASI HIERARKI (Materi Pokok) ===
  Tidak ada pertemuan tanpa Materi Pokok.
  Struktur sudah sesuai — tidak ada yang diubah.
```

`cekKesehatan()` — bagian **1. Modul** harus memuat baris ini:

```
   ✅ MateriPokok
   ✅ Refleksi
```

Bila salah satunya `❌ TIDAK ADA`, berkasnya belum tersalin atau nama
filenya salah.

> ⚠️ **Bila Anda pernah memakai tombol Salin atau Duplikat kelas**
> sebelum v1.1.1, `migrasiHierarki()` inilah yang memulihkan data yang
> terlanjur korup. Jalankan sebelum menghapus Materi Pokok apa pun.

---

## Langkah 3 — Uji otomatis

```
ujiTahap9()
```

**56 pemeriksaan**, 30–90 detik, **tidak** memanggil Gemini.

Seluruh data uji dibuat di kelas bernama `ZZ Uji Hierarki` dan
`ZZ Uji Salin`, lalu **dihapus sendiri** di akhir. Data asli Anda tidak
tersentuh. Aman dijalankan berulang kali.

### Hasil yang diharapkan

```
=====================================
  LOLOS: 56   GAGAL: 0   (n detik)
=====================================
✅ Hierarki tiga tingkat & Refleksi berfungsi di Apps Script.
```

Yang diperiksa:

| Bagian | Isi |
|---|---|
| A | skema & modul termuat |
| B | Materi Pokok: buat, urutkan, `struktur()` |
| C | penyusunan pertanyaan refleksi |
| D | unlock **tiga tingkat** dari sudut pandang murid |
| E | murid mengisi refleksi + validasi |
| F | rekap guru + balasan + notifikasi |
| G | pindah pertemuan antar Materi Pokok |
| H | salin antar kelas tidak merusak kelas lain |

Bila ada yang ❌, **salin seluruh log** dan kirimkan.

---

## Langkah 4 — Deploy

Tanpa langkah ini, perubahan hanya berlaku saat dijalankan dari editor —
bukan di aplikasi yang diakses murid.

```
Deploy → Manage deployments → ✏️ (edit)
       → Version: New version → Deploy
```

---

## Langkah 5 — Uji manual di layar

### Sebagai guru

1. **Kelola Kelas → pilih kelas**
   - tampilan berubah jadi **kartu Materi Pokok yang bisa dilipat**,
     bukan daftar pertemuan datar
   - klik judul bab untuk melipat/membuka

2. **+ Materi Pokok** → isi judul → Simpan
   - kartunya muncul dan langsung terbuka

3. **+ Pertemuan** di dalam bab → pilih jenis **🧪 Ujian / UH** → Simpan
   - barisnya bertepi kuning dengan ikon 🧪
   - nomornya bertingkat, mis. `1.3`

4. **Kelola Item → 🪞 Refleksi**
   - editor konten kaya **tersembunyi** (ini disengaja)
   - muncul penyusun pertanyaan; isi 2–3 pertanyaan
   - centang **wajib** pada yang harus dijawab
   - Simpan & Terbitkan

5. Tombol **⇄** pada baris pertemuan → pindahkan ke bab lain

### Sebagai murid

6. Buka kelas → daftar isi **terkelompok per bab**, tiap bab punya
   bilah kemajuan
7. Sidebar menampilkan **tiga lapis**: Materi Pokok → Pertemuan → Item
8. Buka refleksi (ikon 🪞) → jawab → pilih skala **1–5** → Kirim
9. Setelah kirim: jawaban terkunci, **pertemuan berikutnya langsung
   terbuka** (tidak menunggu guru)

### Kembali sebagai guru

10. **Kelola Kelas → 🪞 Refleksi** → daftar refleksi kelas
11. Klik salah satu → rekap: rata-rata, grafik sebaran 1–5, jawaban
    dikelompokkan **per pertanyaan**
12. **Balas** salah satu murid → murid mendapat notifikasi

---

## Bila ada masalah

| Gejala | Kemungkinan sebab |
|---|---|
| Kotak kuning "N pertemuan belum masuk Materi Pokok" | `migrasiHierarki()` belum dijalankan |
| `Refleksi is not defined` | `Refleksi.gs` belum tersalin |
| Halaman refleksi kosong / rute tak dikenal | `index.html` belum menyertakan `js_refleksi` |
| Tombol 🪞 Refleksi tidak ada di Kelola Item | `js_editor.html` belum tersalin |
| Tampilan berantakan | `css.html` belum tersalin |
| Perubahan tidak terlihat murid | belum **Deploy → New version** |
| `ujiTahap9()`: notifikasi 0 terkirim | `Setup.gs` versi lama — salin ulang lalu `migrasiStruktur()` |

---

## Pratinjau tanpa Apps Script

Bila ingin melihat tampilannya dulu sebelum menyalin:

```bash
node test/buat-pratinjau-guru.js       # pratinjau-guru.html
node test/buat-pratinjau.js            # pratinjau-sidebar.html
node test/buat-pratinjau-refleksi.js   # pratinjau-refleksi.html
```

Ketiganya berkas HTML mandiri, bisa dibuka langsung di browser.
