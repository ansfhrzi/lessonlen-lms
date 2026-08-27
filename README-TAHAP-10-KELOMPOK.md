# Tugas Kelompok — LessonLen v1.7.0

Jenis kegiatan keempat, di samping Materi, LKPD, Quiz, dan Refleksi.
Isinya sama seperti LKPD, tetapi dikerjakan **berkelompok** dan yang
mengumpulkan hanya **ketua**.

Status: **Tahap 1 (backend) & Tahap 2 (UI guru) selesai.**
Tahap 3 (layar murid + AI) belum.

---

## 1. Berkas yang perlu disalin ke Apps Script

### Tahap 1 — backend

| Berkas | Keterangan |
|---|---|
| `Setup.gs` | sheet `kelompok` BARU, 2 kolom baru di `lkpd_submission`, enum `tipe` |
| `Util.gs` | prefix ID `KLP` |
| **`Kelompok.gs`** | **berkas BARU** — buat berkas Script bernama `Kelompok` |
| `Code.gs` | 11 API baru + versi + penanda |
| `Pertemuan.gs` | tipe item baru, batas waktu, hapus berantai |
| `Kelas.gs` | hapus berantai ikut membuang kelompok |
| `Rekap.gs` | nilai tugas kelompok masuk rekap |

### Tahap 2 — UI guru

| Berkas | Keterangan |
|---|---|
| **`js_kelompok.html`** | **berkas BARU** — buat berkas HTML bernama `js_kelompok` |
| `index.html` | menambah `include('js_kelompok')` |
| `js_core.html` | rute `nilai-kelompok` & `tugas-kelompok` |
| `js_editor.html` | ikon, nama tipe, tombol tambah item, tombol 👥 Kelompok |
| `css.html` | gaya kartu kelompok & kotak nilai anggota |

### Perbaikan v1.7.1 — wajib ikut disalin

| Berkas | Keterangan |
|---|---|
| `Db.gs` | `bacaKolom()` tidak lagi membuang baris ber-FK kosong |
| `Lkpd.gs` | menolak submission tugas kelompok di 5 jalur penilaian |
| `Beranda.gs` | penghitung tugas kelompok terpisah dari LKPD |
| `js_beranda.html` | tombol 👥 Tugas kelompok menunggu |

Tanpa `Db.gs` v1.7.1, beranda melaporkan **0 LKPD menunggu** padahal
ada. Tanpa `Lkpd.gs` v1.7.1, tugas kelompok bisa dinilai lewat layar
LKPD — dan hanya progres **ketua** yang terisi, anggota lain terkunci
selamanya.

### Urutan penerapan

1. Salin seluruh berkas di atas.
2. Jalankan **`migrasiStruktur()`** satu kali.
   Tanpa ini sheet `kelompok` tidak ada dan seluruh fiturnya gagal.
3. Jalankan **`cekBerkasUI()`** — harus melaporkan **52 penanda**.
4. Jalankan **`cekKesehatan()`** — modul `Kelompok` harus ✅.
5. Deploy ulang, lalu buka dengan Ctrl+Shift+R.

> Kalau langkah 3 melaporkan penanda basi, berkas HTML-nya belum
> tersalin — bukan masalah cache.

---

## 2. Alur guru

### Langkah 1 — buat itemnya

Buka pertemuan → tombol **👥 Tugas Kelompok**.

Isi seperti LKPD:

- **Judul** dan **tujuan pembelajaran**
- **Isi kegiatan** di editor konten: langkah kerja sampai pertanyaan
  kelompok
- **Batas waktu** (opsional). Lewat batas tetap bisa dikumpulkan,
  hanya ditandai "terlambat".

Simpan sebagai **draf** dulu — kelompoknya bisa disusun sebelum
diterbitkan.

### Langkah 2 — susun kelompok

Di daftar item, tekan **👥 Kelompok**.

Dua cara:

**Satu per satu** — tombol **+ Kelompok**. Ketik namanya sendiri
(bebas: nama tim, topik, atau "Kelompok 1"), centang anggotanya, pilih
ketuanya. Daftar ketua mengikuti anggota yang dicentang.

**Bagi Otomatis** — membagi rata seluruh murid yang **belum**
berkelompok. Kelompok yang sudah ada tidak diubah. Nama sementaranya
`Kelompok 1, 2, 3…` dan ketuanya anggota pertama; keduanya bisa
diganti lewat **Ubah**.

Aturan yang ditegakkan:

- satu murid hanya boleh di **satu** kelompok per tugas
- ketua wajib salah satu anggotanya
- maksimal 12 anggota per kelompok
- anggota wajib murid aktif di kelas itu

Murid yang belum masuk kelompok mana pun ditampilkan di bagian bawah
layar. Mereka **tetap bisa** membuka tugasnya, tetapi hanya melihat
pesan agar menghubungi Anda.

### Langkah 3 — terbitkan

Kembali ke item, ubah status menjadi **publish**. Selama masih draf,
layar kelompok memperingatkan bahwa murid belum bisa membukanya.

### Langkah 4 — nilai

Dua jalan masuk:

- **Dari beranda** — tombol **👥 Tugas kelompok menunggu** membuka
  antrean SELURUH tugas kelompok yang menunggu, dari semua kelas,
  dikelompokkan per tugas.
- **Dari pertemuan** — tombol **👥 Kelompok** pada itemnya.

Kelompok yang sudah mengumpulkan punya tombol **📥 Nilai**.

Panelnya berisi:

- tautan hasil kerja (dibuka di tab baru)
- catatan dari kelompok
- **Nilai kelompok (0–100)** — berlaku untuk semua anggota
- **Penyesuaian per anggota** — kosongkan bila anggota itu mengikuti
  nilai kelompok. **Kotak kosong bukan berarti nol.**
- **Catatan untuk kelompok** — dibaca semua anggota, wajib diisi bila
  meminta perbaikan

Dua tombol:

| Tombol | Akibat |
|---|---|
| **Terima** | nilai masuk ke rapor tiap anggota, progres jadi `selesai` |
| **Minta Perbaikan** | kembali ke kelompok, revisi bertambah, progres jadi `berjalan` |

Setelah diterima, tombolnya berganti **Perbarui Nilai** — nilai masih
bisa diubah.

### Bila ada murid pindah / keluar kelas

Keanggotaan kelompok **tidak ikut berubah otomatis** saat murid
dikeluarkan dari kelas. Itu disengaja: perubahan senyap membuat Anda
tidak tahu susunannya sudah berubah.

Yang terjadi:

- murid itu **tidak lagi menerima progres maupun nilai** dari tugas
  kelompok tersebut
- namanya **tetap tampil** di kartu kelompok, ditandai
  <b>keluar kelas</b> dengan garis putus-putus
- bila yang keluar adalah **ketua**, kartunya diberi peringatan merah:
  kelompok itu **tidak bisa mengumpulkan** sampai Anda menunjuk ketua
  baru

Cara membetulkan: tekan **Ubah**, lepas centang nama murid itu, lalu
pilih ketua dari anggota yang tersisa.

**Kelompok yang sudah dinilai tidak bisa diubah susunannya.** Tombol
Ubah & Bubarkan dikelabukan. Mengubah anggota setelah nilai keluar
membuat nilai menempel pada orang yang salah.

---

## 3. Alur murid (v1.7.7 — sudah jadi)

1. buka item dari daftar pertemuan atau sidebar
2. lihat daftar anggota kelompoknya; dirinya ditandai **(Anda)**,
   ketua ditandai 👑
3. baca isi kegiatan
4. **ketua** menempel tautan lalu mengumpulkan — seluruh anggota
   otomatis tercatat
5. tiap anggota melihat nilainya **sendiri** + catatan guru

### Yang berbeda per peran

**Ketua** mendapat kotak tautan, Simpan Draf, dan Kumpulkan. Selama
guru belum mulai menilai, ia masih bisa **Batalkan Penyerahan**.

**Anggota biasa** tidak mendapat kotak isian sama sekali — server
memang menolaknya. Ia diberi tahu siapa ketuanya, bisa melihat tautan
yang sudah dikumpulkan, dan ditegaskan bahwa ia tetap menerima nilai.

**Murid yang belum masuk kelompok** tetap bisa membuka dan membaca isi
kegiatannya, dengan pesan agar menghubungi Anda.

### Nilai yang dilihat murid

Bila Anda menyesuaikan nilai seorang anggota, murid melihat keduanya:

```
Nilai kelompok: 85 · nilai Anda disesuaikan guru menjadi 70
```

Tanpa keterangan itu ia akan mengira Anda salah menilai.

---

## 4. Bagaimana nilainya masuk Rekap

Progres **seluruh anggota** berubah saat ketua mengumpulkan, bukan
hanya ketua. Tanpa ini anggota lain terkunci selamanya di pertemuan
berurut-ketat — mereka tidak punya cara menyelesaikannya sendiri.

Nilai yang tercatat di `progress` tiap murid adalah nilai
**akhirnya**: penyesuaian bila ada, kalau tidak nilai kelompok. Jadi
angka di Rekap Nilai selalu sama dengan yang dilihat murid.

Contoh nyata dari uji:

```
nilai kelompok 85, Cici disesuaikan 70

REKAP:  Andi = 85    Budi = 85    Cici = 70
murid:  Andi lihat "kelompok 85 · saya 85"
        Cici lihat "kelompok 85 · saya 70"
```

---

## 5. Kapasitas

Tugas kelompok menambah kira-kira **2.160 baris `progress` per tahun**
(12 kelas × 36 murid × 5 tugas). Total proyeksi menjadi **±34.600**
dari ambang 40.000.

Pantau lewat **`infoDatabase()`**.

---

## 6. Yang tidak dilakukan, dan alasannya

**Kelompok tidak ikut tersalin** saat pertemuan disalin ke kelas lain.
Anggotanya murid kelas asal; menyalinnya akan mengulang bug v1.1.1
(data menunjuk lintas kelas). Kelompok harus dibentuk ulang di kelas
tujuan.

**Murid tidak boleh memilih kelompoknya sendiri.** Semua penyusunan
lewat guru — sesuai kesepakatan sistem: satu guru merangkap admin,
murid tidak punya wewenang tulis atas struktur.
