# Ceklis Uji Layar — v1.4.2 & v1.4.3

`ujiTahap12()` sudah membuktikan **backend** kelompok soal benar
(30/30). Yang belum tersentuh: **tampilan dan interaksi**. Bug UI tidak
mungkin ditangkap fungsi diagnostik — hanya mata Anda yang bisa.

Dua hal yang diuji di sini justru **lahir dari laporan Anda sendiri**:

- v1.4.2 — *"tidak bisa melihat soal mana yang sudah dikelompokkan"*
- v1.4.3 — *"jeda saat klik kumpulkan, jadi mengklik lebih dari satu kali"*

Perkiraan: **12 menit**. Jangan lupa **Deploy → New version** dulu.

Beri tanda ❌ pada yang gagal, lalu kirimkan daftarnya ke saya.

---

## Persiapan (3 menit)

1. Buka satu kelas → satu pertemuan → buat item **🎯 Quiz**
2. Tambahkan **6 soal** pilihan ganda sederhana (isi seadanya)
3. Buka **Kelola Item → 🎯 Soal**

---

## A. Melihat kelompok — bug yang Anda laporkan

- [ ] **A1** Tombol **📖 Kelompokkan (teks bacaan)** muncul di baris
      tombol atas
- [ ] **A2** Klik → dialog terbuka, ada kotak teks bacaan + daftar
      centang berisi **semua 6 soal**
- [ ] **A3** Tempel wacana apa saja, centang **soal 1, 2, 3** →
      **Satukan**
- [ ] **A4** ⭐ Ketiga soal itu kini **dibungkus satu bingkai hijau**
      yang jelas — bukan sekadar garis tipis di kiri
- [ ] **A5** ⭐ Di atas bingkai ada kepala:
      **📖 Kelompok 1 · 3 soal berbagi satu teks bacaan · tetap
      berurutan saat diacak**
- [ ] **A6** Teks bacaannya tampil **satu kali** di dalam bingkai,
      bukan diulang tiap soal
- [ ] **A7** Tiap kartu soal anggota berlencana **📖 Kelompok 1**
      (bukan cuma ikon 📖 tanpa keterangan)
- [ ] **A8** Soal 4, 5, 6 berada **di luar** bingkai

> ⭐ = inti perbaikan v1.4.2. Bila salah satu gagal, sebutkan nomornya.

## B. Dua kelompok berurutan — kasus yang dulu melebur

- [ ] **B1** Klik **📖 Kelompokkan** lagi
- [ ] **B2** ⭐ Soal 1–3 **tetap terdaftar** tapi **redup dan tidak bisa
      dicentang**, bertuliskan *"— 📖 sudah dalam kelompok 1"*
      (dulu hilang begitu saja tanpa penjelasan)
- [ ] **B3** Centang **soal 5 dan 6**, isi bacaan lain → **Satukan**
- [ ] **B4** ⭐ Sekarang ada **dua bingkai terpisah** — batas antara
      Kelompok 1 dan Kelompok 2 terbaca jelas
- [ ] **B5** Soal 4 tetap di luar, di antara kedua bingkai
- [ ] **B6** Kepala kelompok kedua bertuliskan **📖 Kelompok 2 · 2 soal**

## C. Ubah & lepas

- [ ] **C1** Klik **✏️ Ubah bacaan** pada Kelompok 1 → dialog muncul
      berisi teks lama
- [ ] **C2** Ubah teksnya → Simpan → teks baru tampil di bingkai
- [ ] **C3** Klik **Lepas kelompok** pada Kelompok 2 → konfirmasi muncul
- [ ] **C4** Setelah dilepas: bingkainya hilang, **soal 5 & 6 tetap ada**
      (tidak ikut terhapus)
- [ ] **C5** Kelompok 1 **tidak terpengaruh**

## D. Tampilan murid

Masuk sebagai murid, kerjakan quiz itu.

- [ ] **D1** Bacaan tampil **di atas pertanyaan**, dengan penanda
      *"📖 Bacalah teks berikut (untuk 3 soal · soal ke-1)"*
- [ ] **D2** Klik **Lanjut ›** → bacaan **tetap tampil** di soal ke-2,
      penandanya berubah jadi *"soal ke-2"*
- [ ] **D3** Bila "Acak urutan soal" aktif: ketiga soal sekelompok
      **tetap berurutan**, hanya posisinya bergeser

---

## E. Mengumpulkan jawaban — bug yang Anda laporkan

Masih sebagai murid, di soal terakhir.

- [ ] **E1** Klik **Kumpulkan Jawaban** → dialog konfirmasi muncul
- [ ] **E2** ⭐ Dialognya memperingatkan *"Proses ini butuh beberapa
      detik. Mohon tunggu, jangan menutup halaman."*
- [ ] **E3** Klik **Ya, kumpulkan**
- [ ] **E4** ⭐ Tirai muat langsung menyala **seketika**, tidak ada jeda
      layar diam
- [ ] **E5** ⭐ Tirainya **bertuliskan** *"Menyimpan jawaban terakhir…"*
      — bukan lingkaran berputar tanpa keterangan
- [ ] **E6** ⭐ Teksnya lalu **berganti** jadi *"Mengumpulkan &
      menghitung nilai…"*
- [ ] **E7** Tirai **tidak berkedip** di antara kedua tahap
- [ ] **E8** Halaman hasil muncul dengan nilainya

## F. Klik berkali-kali — inti perbaikan v1.4.3

Kerjakan quiz sekali lagi (percobaan kedua).

- [ ] **F1** Di dialog konfirmasi, klik **Ya, kumpulkan**
- [ ] **F2** ⭐ Segera **klik berkali-kali** di area tombol —
      seharusnya **tidak terjadi apa-apa**, hanya satu pengumpulan
- [ ] **F3** ⭐ Tidak muncul toast **merah** *"Pengerjaan sudah
      dikumpulkan"* (dulu muncul, padahal jawabannya justru berhasil)
- [ ] **F4** Hanya **satu** percobaan bertambah di daftar riwayat —
      bukan dua atau tiga
- [ ] **F5** Cek sebagai guru di **📊 Lihat Penilaian**: jumlah
      percobaan murid itu **sesuai** yang Anda lakukan

## G. Waktu habis (opsional, 3 menit)

Hanya bila quiz Anda punya batas waktu.

- [ ] **G1** Atur batas waktu **1 menit**, kerjakan, ketik jawaban
      esai lalu **diamkan** sampai waktu habis
- [ ] **G2** Jawaban dikumpulkan otomatis, dan **ketikan terakhir
      Anda ikut tersimpan** (dulu bisa hilang)

---

## H. Layar ponsel (v1.6.0) — buka di HP sungguhan

Buka aplikasi di ponsel, atau di peramban desktop tekan **F12 →
ikon ponsel** dan pilih lebar **360px**.

- [ ] **H1** Judul panjang + tombol di kanan atas **turun ke baris
      berikutnya**, tidak bergencetan sampai tulisannya terpotong
- [ ] **H2** ⭐ Tabel penilaian quiz (6 kolom) **digulir mendatar di
      dalam kartunya** — halaman TIDAK ikut melebar ke samping
- [ ] **H3** ⭐ Tombol 🗑 dan **Lepas kelompok** berwarna **merah**,
      bukan hijau seperti tombol biasa
- [ ] **H4** ⭐ Saat mengetik jawaban esai, halaman **tidak
      memperbesar sendiri** (khusus iPhone/iPad — dulu terjebak zoom)
- [ ] **H5** Kotak jawaban punya **tepi jelas** dan cukup tinggi
      untuk disentuh
- [ ] **H6** Sidebar berubah jadi **laci** yang dibuka lewat tombol
- [ ] **H7** Coba geser halaman ke kiri-kanan: **tidak ada bagian
      yang menggantung** di luar layar
- [ ] **H8** ⭐ Klik **✨ Buat dengan AI** → dialognya **bisa digulir**
      sampai bawah, dan tombol **Buat Soal** selalu terlihat menempel
      di dasar kotak (v1.6.2)
- [ ] **H9** Coba juga dialog lain yang panjang — **📖 Kelompokkan**
      dan **+ Tambah Soal**: semuanya bisa digulir

---

## Kalau ada yang ❌

Kirimkan:

1. **Nomor**nya (mis. `A5`, `F2`)
2. Apa yang **Anda lihat** — sekalimat cukup
3. Bila ada pesan galat: buka **Console peramban** (F12 → Console),
   salin barisnya

Poin bertanda ⭐ adalah inti perbaikan; kalau salah satunya gagal,
perbaikannya belum benar-benar sampai ke layar Anda.

---

## Berkas yang harus sudah tersalin

Bila banyak poin gagal sekaligus, kemungkinan besar ada berkas yang
belum tersalin ke Apps Script:

| Versi | Berkas |
|---|---|
| v1.4.0 | `Setup.gs` `Util.gs` `Quiz.gs` `Code.gs` `js_quiz.html` `css.html` + **`migrasiStruktur()`** |
| v1.4.1 | `Quiz.gs` `Code.gs` `js_quiz.html` |
| v1.4.2 | `js_quiz.html` `css.html` `Code.gs` |
| v1.4.3 | `js_quiz.html` `js_core.html` `index.html` `css.html` `Code.gs` |

Jalankan **`cekKesehatan()`** untuk memastikan seluruh modul termuat,
dan **`ujiTahap12()`** untuk memastikan skema `grup_id` + `stimulus`
sudah ada.
