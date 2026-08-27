# Menyusun Kerangka Semester dengan AI

Versi 1.8.6. Untuk menyiapkan kelas baru: AI mengusulkan urutan
pertemuan dari Capaian Pembelajaran, Anda tinjau dan sunting, lalu
terapkan sekaligus.

Sejak **v1.8.6** kerangka membuat **kelima tipe item** — termasuk
Tugas Kelompok dan Refleksi yang sebelumnya harus ditambahkan satu
per satu.

---

## Perlu migrasi?

**Tidak.**

---

## Berkas yang perlu disalin

| Berkas | Keterangan |
|---|---|
| **`js_kerangka.html`** | **BARU** — buat berkas HTML bernama `js_kerangka` |
| `index.html` | menambah `include('js_kerangka')` |
| `js_editor.html` | tombol ✨ Kerangka AI |
| `css.html` | gaya baris usulan |
| **`Ai.gs`** | **v1.8.6** — 3 medan baru di skema + Tugas Kelompok & Refleksi |
| **`Code.gs`** | **v1.8.6** — `ujiTahap16()` + versi |
| **`Pertemuan.gs`** | **v1.8.5** — penerapan jauh lebih cepat |
| **`MateriPokok.gs`** | **v1.8.3** — penanda CP di payload |

Untuk **v1.8.7** (kecepatan) salin juga: `Db.gs` · `Util.gs`.

Verifikasi: **`cekBerkasUI()`** → harus **73 penanda**.

Lalu jalankan **`ujiTahap16()`** — 17 poin. Ia membuktikan Tugas
Kelompok dan Refleksi benar-benar bisa dibuat di spreadsheet Anda.

---

## Syarat: Capaian Pembelajaran

AI menyusun kerangka **dari Capaian Pembelajaran kelas**. Tanpa itu
tidak ada bahan.

Isi lewat **Kelola Kelas → Ubah** pada kelas yang bersangkutan. Bila
belum diisi, panel akan memberi tahu dan tombolnya mati — Anda tidak
perlu menunggu galat.

Semakin lengkap CP, kompetensi keahlian, dan catatan gaya kelas,
semakin terpakai hasilnya.

---

## Cara memakai

### 1. Buka kelasnya

**Kelola Kelas → pilih kelas → ✨ Kerangka AI**

### 2. Tentukan jumlah pertemuan dan penempatan bab

1–20. Satu semester biasanya 15–18 pertemuan.

> Kalau ragu, mulai dari 5–6 dahulu. Anda bisa menjalankan Kerangka AI
> lagi nanti — penomoran otomatis melanjutkan yang sudah ada.

> **Berapa lama?** Terukur di lapangan pada v1.8.7:
> **9,1 detik/pertemuan**, jadi 20 pertemuan ±3 menit — aman dalam
> satu kali jalan.
>
> Riwayatnya: 16,5 (v1.8.4) → 13,8 (v1.8.5) → **9,1** (v1.8.7).
>
> Angka "2–3 detik" yang pernah tertulis di sini pada v1.8.5
> **keliru** — itu hitungan di atas kertas, bukan pengukuran. Maaf.
>
> Kecepatan bergantung ukuran spreadsheet Anda. Jalankan
> `ujiTahap15()` untuk angka Anda sendiri; ia menyebutkan berapa
> pertemuan yang aman sekali jalan.

Isi **Catatan tambahan** bila perlu mengarahkan, misalnya
*"dua pertemuan pertama untuk pengenalan alat"*.

Bila kelas **sudah punya Materi Pokok**, muncul pilihan tambahan:

| Pilihan | Akibat |
|---|---|
| **Buat bab baru sesuai usulan AI** | AI mengelompokkan sendiri; bab lama dibiarkan utuh |
| **Gabungkan ke bab yang sudah ada** | Semua hasil masuk ke bab pertama; Anda bisa memindahkan per baris |

### 3. Tinjau dan sunting — ini bagian terpenting

AI menampilkan tabel usulan. Untuk tiap pertemuan Anda bisa:

- **melepas centang** — pertemuan itu tidak dibuat
- **mengubah Materi Pokok (bab)** — pengelompokannya
- **mengubah judul** dan **tujuan pembelajaran**
- mengatur **berapa materi** (1–3)
- mencentang kegiatannya: **📝 LKPD** · **👥 Kelompok** · **🎯 Quiz** ·
  **💭 Refleksi**

Di bawah tabel ada ringkasan:
**"N bab · M pertemuan · K item"**.

> **Centang kegiatan** sudah diisi AI menurut isi pertemuannya —
> Tugas Kelompok untuk yang menuntut diskusi, Refleksi di penutup
> bab. Ubah sesuka Anda; yang tercentang saat menekan Terapkan itulah
> yang dibuat.

> **Kolom Materi Pokok** menentukan pengelompokan. Pertemuan dengan
> nama bab yang sama masuk ke satu Materi Pokok. Ubah namanya bila
> pembagian AI kurang sesuai — mengetik nama yang sama persis akan
> menggabungkannya.

> Menyunting di sini jauh lebih murah daripada setelah 15 pertemuan
> terlanjur terbuat. Luangkan waktu di langkah ini.

Bila hasilnya jauh meleset, tekan **✨ Susun Ulang**.

### 4. Terapkan

Konfirmasi menyebut angkanya sekali lagi. Perhatikan dua hal:

- semuanya berstatus **draf** — belum terlihat murid
- tindakan ini **tidak dapat diurungkan sekaligus**; pertemuan yang
  tidak jadi dipakai harus dihapus satu per satu

### 5. Isi materinya

Kerangka hanya membuat **wadah kosong** dengan judul dan tujuan.
Isinya Anda buat lewat tombol ✨ pada tiap item:

- **Materi** → ✨ Susun Materi dengan AI
- **LKPD** → ✨ Susun LKPD dengan AI
- **Tugas Kelompok** → ✨ Susun Kegiatan dengan AI, lalu bagi
  kelompoknya lewat **👥 Kelompok**
- **Quiz** → kelola soal, bisa dengan ✨ AI juga
- **Refleksi** → ✨ Susun Pertanyaan Refleksi dengan AI

> Item **Refleksi lahir tanpa pertanyaan** — itu disengaja.
> Pertanyaannya Anda susun lewat tombol ✨ di editor Refleksi, sebab
> pertanyaan yang baik bergantung pada apa yang benar-benar terjadi di
> kelas.

Lalu terbitkan satu per satu bila sudah siap.

---

## Apa yang dibuat

Untuk tiap pertemuan yang dicentang:

| Yang dibuat | Keterangan |
|---|---|
| Materi Pokok | satu per nama bab unik, status **draf** |
| 1 pertemuan | status **draf**, urut-ketat menyala |
| 1–3 materi | bila lebih dari satu, diberi "— bagian 1", "— bagian 2" |
| LKPD | bila dicentang, judul "LKPD — <nama pertemuan>" |
| Tugas Kelompok | bila dicentang, judul "Tugas Kelompok — …"; kelompoknya dibagi kemudian |
| Quiz | bila dicentang, KKM 75, maksimal 2 percobaan |
| Refleksi | bila dicentang, judul "Refleksi — …", **tanpa pertanyaan** |

Urutan item mengikuti alur pembelajaran:

```
materi → LKPD → Tugas Kelompok → Quiz → Refleksi
```

Refleksi selalu terakhir: murid menimbang cara belajarnya **setelah**
menjalani kegiatannya.

Pertemuan dikelompokkan ke Materi Pokok sesuai kolom **bab**.
Nomor pertemuan dihitung **di dalam bab** — tiap bab mulai dari 1.

Bab dengan nama yang sudah ada **dipakai ulang**, tidak digandakan.
Jadi menjalankan Kerangka AI dua kali dengan nama bab sama akan
menambah pertemuan ke bab itu, bukan membuat bab kembar.

---

## Yang perlu diketahui

### Penomoran melanjutkan, tidak mengulang

Menjalankan Kerangka AI dua kali tidak membuat nomor kembar.
Pertemuan baru melanjutkan dari yang terakhir.

### Baris tanpa judul dilewati

Bila Anda mengosongkan judul sebuah baris tetapi lupa melepas
centangnya, baris itu **dilewati** — bukan dibuat sebagai pertemuan
tanpa nama. Jumlah yang dilewati disebutkan di konfirmasi.

### Bagaimana AI memilih kegiatannya

AI diberi aturan yang cukup ketat, sebab AI yang dibiarkan bebas
cenderung mencentang semuanya:

| Kegiatan | Kapan dicentang |
|---|---|
| 📝 LKPD | kerja **mandiri** terpandu — langkah kerja, pengamatan, latihan konfigurasi |
| 👥 Kelompok | menuntut **diskusi & keputusan bersama** — merancang, membandingkan, menganalisis kasus. Bukan pertemuan pengantar teori. Sasaran ±1 dari 4 pertemuan |
| 🎯 Quiz | ada konsep yang layak diukur ketuntasannya |
| 💭 Refleksi | pertemuan **penutup bab** atau pertemuan berat. Sasaran 1 per bab |

Satu pertemuan sebaiknya tidak memuat LKPD **dan** Tugas Kelompok
sekaligus — pilih salah satu.

Ini tetap sekadar usulan. Kalau AI keliru menilai, ubah centangnya
sebelum menerapkan.

### Bila AI tidak mengelompokkan

Kadang AI melewatkan pembagian bab. Panel memberi peringatan kuning
dan semua pertemuan masuk satu bab. Ubah kolom **Materi Pokok** di
tabel sebelum menerapkan, atau tekan **✨ Susun Ulang**.

### Hasilnya usulan, bukan keputusan

AI tidak tahu kondisi lab Anda, jam mengajar yang tersisa, atau
kebiasaan kelas. Perlakukan hasilnya sebagai **draf awal yang
menghemat pengetikan**, bukan silabus jadi.

---

## Bila bermasalah

**Tombol ✨ Kerangka AI tidak muncul** → `js_kerangka.html` belum
tersalin, atau `index.html` belum diperbarui. Jalankan
`cekBerkasUI()`.

**Panel bilang CP belum diisi padahal sudah** → `MateriPokok.gs`
belum tersalin ke versi 1.8.3. Payload lama tidak membawa penanda CP,
jadi panel selalu mengira kosong. Salin ulang, lalu deploy versi baru.

**Panel bilang CP belum diisi (memang belum)** → isi lewat Kelola
Kelas → Ubah.

**AI gagal / kuota habis** → pesan aslinya diteruskan. Tidak ada
pertemuan yang terbuat; Anda bisa mencoba lagi nanti.

**Centang Kelompok/Refleksi tidak ada di tabel** → `js_kerangka.html`
masih versi lama. Salin ulang, deploy versi baru, lalu `cekBerkasUI()`
harus melaporkan **73 penanda**.

**Peringatan "AI tidak mengelompokkan" muncul terus, padahal
sebelumnya tidak** → `Ai.gs` masih di bawah v1.8.6. Sampai versi itu,
medan `bab` tidak pernah terdaftar di skema JSON sehingga selalu
dibuang model. Salin ulang `Ai.gs`.

**Item Tugas Kelompok ditolak saat dibuat** → jalankan
`migrasiStruktur()` sekali, lalu `ujiTahap16()` untuk memastikan.
