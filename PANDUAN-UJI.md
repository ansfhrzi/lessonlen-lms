# Panduan Pengujian LessonLen

Untuk versi **0.7.2** (Tahap 6B + optimasi).

Selama ini seluruh uji berjalan di **Node.js** — simulasi Apps Script,
bukan Apps Script sungguhan. Dokumen ini menutup celah itu: cara menguji
di lingkungan asli sebelum murid memakainya.

---

## Ringkasan tiga lapis

| Lapis | Di mana | Siapa | Kapan |
|---|---|---|---|
| 1. Uji otomatis | Node.js | pengembang | tiap kode berubah |
| 2. Uji editor | Apps Script | guru | tiap selesai menyalin berkas |
| 3. Uji manual | browser | guru | sebelum dipakai murid |

Lapis 1 sudah berjalan (16 berkas, semuanya hijau). Lapis 2 & 3 di bawah.

---

# LAPIS 2 — Uji dari editor Apps Script

Setelah menyalin berkas, jalankan **tiga fungsi ini berurutan**.

## Langkah 1 — `cekKesehatan()`

Pilih `cekKesehatan` di toolbar → **Run** → **View → Logs**
(atau `Ctrl+Enter`).

Tidak mengubah data apa pun. Aman dijalankan kapan saja.

**Keluaran yang benar:**

```
=== CEK KESEHATAN LessonLen v0.9.0 ===

1. Modul
   ✅ Util          ✅ Db            ✅ Auth
   ✅ Notif         ✅ Kelas         ✅ Pertemuan
   ✅ Beranda       ✅ Belajar       ✅ Lkpd
   ✅ Quiz          ✅ Ai
   ✅ Setup.gs (migrasiStruktur, infoDatabase)

2. Fungsi Db (wajib ada setelah optimasi T6-OPT-5)
   ✅ Db.saringBaris()      ✅ Db.bacaBarisJika()
   ✅ Db.cariBarisCache()   ✅ Db.cariBarisCache2()
   ✅ Db.titipBaris2()      ✅ Db.tulisProgres()
   ✅ Db.epochProgres()

3. Sheet
   ✅ users (…)   ✅ kelas (…)   … 14 sheet …

4. Layanan
   ✅ CacheService berfungsi
   ✅ LockService berfungsi

5. Generator AI
   ✅ 10 key terpasang (10 siap)

6. Trigger harian
   ⚠️ tugasHarianQuiz BELUM dipasang

=====================================
✅ SEHAT — semua siap dipakai.
=====================================
```

### Bila ada ❌

| Pesan | Artinya | Tindakan |
|---|---|---|
| `❌ Quiz TIDAK ADA` | `Quiz.gs` belum disalin | salin `Quiz.gs` |
| `❌ Db.cariBarisCache()` | `Db.gs` versi lama | **salin `Db.gs`** — ini penyebab tersering |
| `❌ sheet soal` | struktur belum lengkap | jalankan `migrasiStruktur()` |
| `⚠️ API key BELUM dipasang` | generator AI mati | pasang lewat 🔑 Status API Key |
| `❌ Ai.gs bermasalah` | `Ai.gs` belum disalin | salin `Ai.gs` |
| `❌ CacheService error` | kuota/izin | tunggu, jalankan ulang |

> Kesalahan paling sering: menyalin `Quiz.gs` tetapi lupa `Db.gs`.
> Aplikasi lalu melempar *"Db.cariBarisCache is not a function"* saat
> murid membuka quiz. `cekKesehatan()` menangkap ini **sebelum** murid
> mengalaminya.

## Langkah 2 — `pasangTriggerHarian()`

Jalankan **sekali saja** (aman diulang — trigger lama dibuang dulu).

```
Trigger dipasang (sekitar pukul 01.00).
```

Gunanya: attempt yang ditinggalkan murid >24 jam ditandai kedaluwarsa
sehingga tidak menghanguskan kuota percobaannya.

Google akan meminta izin saat pertama kali — **Review permissions →
pilih akun → Advanced → Go to (nama proyek) → Allow**.

## Langkah 3 — `tesKoneksiAI()` *(Tahap 7)*

Jalankan **segera setelah memasang API key**. Hanya satu panggilan
Gemini, tidak menyentuh data sama sekali.

```
=== TES KONEKSI GEMINI ===
10 key terpasang. Menghubungi Gemini…
✅ BERHASIL — key#2, model gemini-3.6-flash, 1.4 detik
   Balasan: {"pesan":"halo"}
   Format JSON terbaca. Generator AI siap dipakai.
```

**Perhatikan tiga hal:**

| Tanda | Wajar | Bila menyimpang |
|---|---|---|
| Waktu | 1–3 detik | > 10 detik → mode berpikir menyala, log memperingatkan |
| Model | `gemini-3.6-flash` | model lain → utama tidak tersedia, log memberi tahu |
| Balasan | `{"pesan":"halo"}` | teks terpotong → log menyatakannya |

Bila gagal, log menyebutkan tiga hal yang perlu diperiksa:

| Sebab | Perbaikan |
|---|---|
| Key salah tempel / dicabut | pasang ulang lewat 🔑 Status API Key |
| **Generative Language API belum aktif** | aktifkan di Google Cloud Console project key itu |
| Kuota harian habis | tunggu, atau tambah key dari project lain |

> Penyebab tersering pada pemasangan pertama adalah yang **kedua** —
> key sudah benar tetapi API-nya belum diaktifkan di project tersebut.

## Langkah 4 — `ujiTahap7()` *(Tahap 7)*

Siklus penuh generator: menyusun materi sungguhan lewat Gemini, lalu
memeriksa guard "AI wajib ditinjau".

Memakai 1 panggilan API, berlangsung 20–60 detik. Aman diulang.

```
=====================================
  LOLOS: 14   GAGAL: 0
=====================================
✅ Generator AI berfungsi di Apps Script.
```

Yang diperiksa: konten terisi & terpecah bagian, deskripsi & saran soal
ada, hasil sudah disanitasi, durasi wajar, **publish tanpa ditinjau
ditolak**, dan riwayat tidak memuat key.

## Langkah 5 — `ujiTahap6B()`

Menjalankan **satu siklus quiz penuh** dengan data sungguhan:
guru menyusun 4 soal → murid mengerjakan → nilai otomatis → koreksi
esai → pembahasan.

**Keluaran yang benar berakhir dengan:**

```
=====================================
  LOLOS: 25   GAGAL: 0
=====================================
✅ Tahap 6B berfungsi di Apps Script.
```

Yang diperiksa (25 poin), antara lain:

- kunci jawaban **tidak ikut terkirim** saat murid mengerjakan
- murid ditolak membuka bank soal
- skor otomatis benar (4 dari 10)
- soal esai memicu status `menunggu_koreksi`
- nilai akhir 90 setelah guru mengoreksi
- **capaian tidak turun** saat murid mengulang quiz yang sudah lulus

Fungsi ini membuat kelas `ZZ Uji Quiz` (sekali saja) dan menghapus
pertemuan ujinya di akhir. Aman dijalankan berulang.

> **Prasyarat:** akun seed `guru/guru123` dan `siswa01/siswa123` masih
> ada. Bila sudah dihapus lewat `hapusSeedData()`, lewati langkah ini
> dan langsung ke Lapis 3.

## Uji tahap lainnya

Masih tersedia bila ingin memastikan modul lama tetap jalan:

```
ujiTahap2()   login, sesi, reset kata sandi
ujiTahap3()   dashboard, notifikasi, unlock
ujiTahap4()   CRUD kelas & pertemuan
ujiTahap5()   baca materi per bagian
ujiTahap6A()  LKPD
ujiTahap6B()  Quiz
ujiTahap7()   Generator AI    ← baru (memanggil Gemini sungguhan)
tesKoneksiAI()  tes cepat 1 panggilan
infoDatabase()  jumlah baris & peringatan ambang
```

---

# LAPIS 3 — Uji manual di browser

Jalankan sekali sebelum murid memakainya. Perkiraan **20 menit**.

Buka URL aplikasi (**Deploy → Manage deployments → Web app URL**),
bukan tombol Preview di editor.

## A. Guru menyusun quiz

| # | Langkah | Yang harus terjadi |
|---|---|---|
| A1 | Masuk sebagai guru | Dashboard tampil |
| A2 | Kelas → pilih kelas → pertemuan | Daftar item tampil |
| A3 | **+ Tambah → 🎯 Quiz** | Form terbuka: KKM, maks percobaan, batas waktu, acak soal, acak opsi, tampilkan pembahasan |
| A4 | Simpan, lalu klik **🎯 Soal** | Halaman bank soal terbuka |
| A5 | **+ Tambah Soal** | Dialog berisi **dropdown tipe, kotak pertanyaan, bobot, tingkat, area jawaban, pembahasan** — bukan dialog kosong |
| A5b | Ganti tipe soal di dropdown | Kotak jawaban ikut berubah (PG → 5 opsi; B/S → dropdown; Isian → 1 kotak; Uraian → keterangan) |
| A6 | Isi 4 opsi, tandai kunci, simpan | Soal muncul, kunci bertanda ✓ hijau |
| A7 | Tambah soal **Benar/Salah** | Kunci berupa dropdown |
| A8 | Tambah soal **Isian**, kunci `802.1Q \| dot1q` | Tersimpan, tampil "atau" |
| A9 | Tambah soal **Uraian** | Tidak ada kotak kunci; tertulis "dinilai manual" |
| A10 | Klik ↑ ↓ pada soal | Nomor berubah urut |
| A11 | Hapus satu soal → tekan **Batal** | Soal **TIDAK** terhapus |
| A11b | Hapus satu soal → tekan **Hapus** | Terhapus, penomoran rapat kembali (1,2,3…) |
| A12 | **📥 Impor dari Quiz Lain** | Daftar quiz lain yang punya soal |

**Uji rumus (bila dipakai):** tulis pertanyaan memuat `\(x^2\)` →
setelah disimpan harus tampil sebagai rumus, bukan teks mentah.

## B. Murid mengerjakan

Masuk di **jendela penyamaran** agar dua sesi tidak bertabrakan.

| # | Langkah | Yang harus terjadi |
|---|---|---|
| B1 | Buka pertemuan → klik item Quiz | Layar pembuka: jumlah soal, KKM, batas waktu, sisa percobaan |
| B2 | **Mulai Kerjakan** | Soal 1 tampil, jam mundur berjalan |
| B3 | Pilih jawaban | Muncul "✓ tersimpan" di kanan bawah |
| B4 | **Lanjut ›** lalu **‹ Sebelumnya** | Jawaban sebelumnya masih terpilih |
| B5 | Klik **☆ Ragu** | Titik peta soal jadi kuning |
| B6 | Klik angka di peta soal | Langsung lompat ke soal itu |
| B7 | **Muat ulang halaman (F5)** | Kembali ke quiz, **jawaban tidak hilang** |
| B8 | Isi soal uraian panjang | Tersimpan setelah berhenti mengetik ±1 detik |
| B9 | **Kumpulkan Jawaban** | Konfirmasi menyebut jumlah soal belum dijawab |
| B9b | Tekan **Batal** pada konfirmasi | Kembali ke soal, **belum** terkumpul |
| B10 | Ulangi → setujui | Halaman hasil tampil |

**Yang wajib diperiksa di B10:**

- Bila ada soal uraian → **"Menunggu koreksi guru"**, nilai belum keluar
- Bila tanpa uraian → nilai & lencana Lulus/Belum lulus langsung tampil

## B2. Sidebar navigasi

| # | Langkah | Yang harus terjadi |
|---|---|---|
| S1 | Buka pertemuan sebagai murid | Sidebar kiri: daftar pertemuan + item |
| S2 | Perhatikan pertemuan yang sedang dibuka | Tersorot; itemnya tampil |
| S3 | Klik judul pertemuan yang sedang dibuka | Daftar item **melipat**; klik lagi → **terbuka kembali** |
| S4 | Klik pertemuan lain yang terbuka | Berpindah ke pertemuan itu |
| S5 | Klik pertemuan **terkunci** | Muncul pesan, tidak berpindah |
| S6 | Klik item di sidebar | Langsung membuka materi/LKPD/quiz |
| S7 | Buka materi, selesaikan satu bagian | Sidebar **ikut memperbarui** tanda progres |
| S8 | Perkecil jendela < 900px | Sidebar hilang, muncul tombol **☰ Daftar Isi** |
| S9 | Tekan ☰ | Laci muncul dari kiri + latar gelap |
| S10 | Tekan latar gelap / ✕ | Laci tertutup |
| S11 | Kumpulkan LKPD / quiz | Sidebar **langsung** memperbarui tanda status |
| S12 | Keluar, masuk sebagai murid **lain** | Sidebar menampilkan kelas murid baru — **bukan** milik murid sebelumnya |
| S13 | Daftar pertemuan → klik satu pertemuan | Sidebar tampil **tanpa jeda** (indeks sudah dipramuat) |
| S14 | Tekan **F5** di halaman item | Sidebar tampil seketika dari cache sesi |
| S15 | Pindah antar bagian materi | Sidebar tidak berkedip kosong |

## B3. Tombol Sebelumnya / Berikutnya

| # | Langkah | Yang harus terjadi |
|---|---|---|
| N1 | Buka halaman pertemuan | Bawah halaman: **← Pertemuan 1** dan **Pertemuan 3 →** |
| N2 | Pertemuan berikutnya masih terkunci | Tampil "🔒 Pertemuan 3 terkunci", tidak bisa diklik |
| N3 | Buka satu materi | Bawah halaman: tombol item sebelumnya/berikutnya + "3 dari 12" |
| N4 | Klik Berikutnya di **item terakhir** suatu pertemuan | Lompat ke item pertama **pertemuan berikutnya** |
| N5 | Item pertama seluruh kelas | Tidak ada tombol kiri |
| N6 | Item terakhir seluruh kelas | Tertulis "Item terakhir" |

## A2. Generator AI (Tahap 7)

Prasyarat: API key sudah dipasang lewat 🔑 Status API Key.

| # | Langkah | Yang harus terjadi |
|---|---|---|
| G1 | Beranda → **🔑 Status API Key** | Daftar key, hanya 4 digit terakhir terlihat |
| G2 | Editor Materi baru, belum disimpan | Tombol Generate nonaktif + keterangan |
| G3 | Simpan draf, buka lagi, isi Tujuan Pembelajaran | Tombol **✨ Generate** aktif |
| G4 | Tekan Generate | Penghitung detik berjalan; 20–60 detik |
| G5 | Draf muncul | Terpisah beberapa bagian; kotak "sudah meninjau" muncul |
| G6 | Tekan **Terbit** tanpa mencentang | **Ditolak** — "harus ditandai sudah ditinjau" |
| G7 | Centang lalu Terbit | Berhasil |
| G8 | Generate lagi saat editor sudah berisi | Minta konfirmasi timpa dulu |
| G9 | Cabut internet lalu Generate | Pesan jelas, tetap bisa menulis manual |

## C. Keamanan (penting)

| # | Langkah | Yang harus terjadi |
|---|---|---|
| C1 | Saat mengerjakan, tekan **F12 → Network**, klik satu soal | Data yang lewat **tidak memuat kunci jawaban** |
| C2 | Ubah alamat jadi `#/soal/ITM-xxxx` sebagai murid | Ditolak / dilempar ke beranda |
| C3 | Ubah alamat jadi `#/koreksi-quiz` sebagai murid | Ditolak |
| C4 | Buka quiz pertemuan yang belum dibuka | Pesan "Quiz masih terkunci" |

> C1 adalah janji utama sistem ini. Bila kunci terlihat di sana,
> **hentikan pemakaian** dan laporkan.

## D. Guru mengoreksi

| # | Langkah | Yang harus terjadi |
|---|---|---|
| D1 | Beranda guru | Panel "⚡ Perlu Tindakan" menampilkan "Quiz menunggu koreksi" |
| D2 | Klik panel itu | Halaman antrean koreksi (**bukan halaman kosong**) |
| D3 | Klik **Koreksi** | Jawaban murid + kunci tampil; soal uraian bertanda kuning |
| D4 | Isi nilai uraian melebihi bobot | Ditolak dengan pesan jelas |
| D5 | Isi nilai wajar + catatan → **Simpan Nilai** | Nilai akhir muncul, kembali ke antrean |
| D6 | Buka **📊 Penilaian** dari bank soal | Seluruh murid tampil — **termasuk yang belum mengerjakan** |
| D7 | Klik penyaring status | Tabel tersaring |
| D8 | Klik **↺ Reset** pada satu murid | Minta alasan; setelah disimpan murid dapat mengulang |

## E. Murid melihat hasil

| # | Langkah | Yang harus terjadi |
|---|---|---|
| E1 | Buka lonceng notifikasi | Ada "Quiz Anda sudah dikoreksi" |
| E2 | Klik notifikasi itu | Menuju halaman quiz, **bukan halaman kosong** |
| E3 | Lihat hasil | Nilai, catatan guru, umpan balik per butir |
| E4 | Periksa pembahasan | Tampil bila guru mengizinkan; **tidak tampil** bila tidak |
| E5 | Bila lulus → buka pertemuan berikutnya | Sudah terbuka |
| E6 | **Klik "Ulangi Quiz"** lalu tutup tanpa selesai | **Status lulus TIDAK hilang**, pertemuan berikutnya tetap terbuka |

> E6 menguji bug yang ditemukan pada audit. Bila status lulus hilang di
> sini, berarti `Quiz.gs` belum versi 0.7.1+.

## F. Batas waktu (bila dipakai)

| # | Langkah | Yang harus terjadi |
|---|---|---|
| F1 | Buat quiz batas 1 menit, mulai kerjakan | Jam mundur dari 01:00 |
| F2 | Tunggu sampai <1 menit | Angka jam berubah merah & berdenyut |
| F3 | Biarkan habis | Otomatis dikumpulkan, muncul pesan "Waktu habis" |
| F4 | Coba lanjut mengerjakan | Ditolak |

---

# LAPIS 4 — Uji beban nyata (disarankan)

Simulasi Node menunjukkan 36 murid serentak butuh ~51.500 sel/murid.
Angka itu perkiraan; kondisi nyata dipengaruhi jaringan sekolah.

**Cara paling murah:** pada quiz sungguhan pertama, minta **satu kelas
penuh mulai bersamaan**, lalu amati:

- Adakah murid melihat pesan **"Sistem sedang sibuk"**?
  → normal bila sesekali; sering berarti perlu ditinjau
- Berapa lama halaman soal muncul? (wajar < 3 detik)
- Setelah selesai, buka **📊 Penilaian** → jumlah murid yang
  mengerjakan harus **sama persis** dengan yang hadir

Bila ada keluhan lambat, kirimkan saya:
`Executions` di editor Apps Script (kolom Duration) — dari situ terlihat
fungsi mana yang lambat.

---

# Menjalankan uji otomatis (pengembang)

```bash
cd /home/user/lms-gas
for t in run run2 run3 run4 run5-regresi run6-belajar run7-tepi \
         run8-cache run9-lkpd run10-integrasi run11-quiz run12-audit \
         run13-cache-quiz run21-ai perf7-serentak perf9-quiz-serentak; do
  printf "  %-20s " "$t"
  node test/$t.js 2>&1 | grep -oE "LOLOS: [0-9]+   GAGAL: [0-9]+|SEMUA LOLOS|BUG AKHIR: [0-9]+|BUG: [0-9]+|TOTAL BUG: [0-9]+" | tail -1
done
for t in run14-editor run15-ui run16-form-soal run17-nav run18-indeks \
         run19-nav-audit run20-nav-cepat run22-ai-editor; do
  printf "  %-20s " "$t"
  node test/$t.js >/dev/null 2>&1 && echo "OK" || echo "GAGAL"
done
```

| Berkas | Cakupan |
|---|---|
| `run` … `run4` | Tahap 1–4 |
| `run5-regresi` | audit menyeluruh |
| `run6-belajar` `run7-tepi` `run8-cache` | Tahap 5, kasus tepi, cache |
| `run9-lkpd` | Tahap 6A |
| `run10-integrasi` | tautan & rute (audit statis) |
| `run11-quiz` | Tahap 6B — 161 poin |
| `run12-audit` | bug capaian turun, pergeseran baris |
| `run13-cache-quiz` | kesegaran cache |
| `run14-editor` | fungsi diagnostik editor |
| `run15-ui` | audit statis berkas UI (opsi dialog, handler) |
| `run16-form-soal` | form Tambah Soal di DOM tiruan |
| `run17-nav` | sidebar navigasi di DOM tiruan |
| `run18-indeks` | backend indeks kelas (kebocoran konten, rantai) |
| `run19-nav-audit` | ketahanan navigasi & kebersihan keadaan |
| `run20-nav-cepat` | cache sesi & prapemuatan sidebar |
| `run21-ai` | generator AI & rotasi 10 key |
| `run22-ai-editor` | jalur gagal fungsi diagnostik AI |
| `perf7` `perf9` | beban serentak |

**Aturan:** setiap perubahan kode → jalankan **seluruhnya**. Optimasi
tanpa uji regresi sudah terbukti melahirkan bug berkali-kali di proyek ini.
