# LessonLen v2.0

LMS di **Google Apps Script + Spreadsheet**. Dibangun ulang dari nol.

Tidak ada kunci urutan. Guru yang membuka materi (saklar atau jadwal). Murid menandai selesai sendiri. Satu bab = satu muat.

## Yang berubah dari v1

| Lama | Baru |
|---|---|
| Bab/pertemuan/item terkunci sampai yang sebelumnya tuntas | Guru buka / tutup / jadwalkan |
| Baca bagian terakhir = otomatis selesai | Tombol **Tandai selesai** pada materi |
| 6–10 panggilan API untuk sampai ke bagian 2 | Beranda 1x, buka bab 1x, tulis hanya saat aksi |
| Halaman pertemuan + sidebar + pembaca | Satu layar bab: daftar kiri, isi kanan |
| Unlock paksa, AI, kelompok, refleksi | Belum. Inti dulu. |

## Panggilan API (murid)

```
login
getBeranda          ← daftar kelas + bab, tanpa HTML materi
bukaBab(babId)      ← SELURUH bab: item, konten materi/LKPD, meta quiz
tandaiSelesai       ← 1 tulis kecil, mengembalikan rekap baru
kumpulkanLkpd       ← 1 tulis
mulaiQuiz           ← soal TANPA kunci
kumpulkanQuiz       ← nilai di server
```

Pindah item/bagian di dalam bab **tanpa** panggilan. Jawaban quiz menumpuk di perangkat sampai dikumpulkan.

## Akses

**Bab**
- Draf — murid tidak melihat
- Buka — semua item `ikut_bab` langsung bisa dikerjakan
- Tutup — judul boleh terlihat, tidak bisa dikerjakan
- Jadwal — `buka_at` / `tutup_at`

**Item** default `ikut_bab`. Bisa override manual atau jadwal sendiri (mis. quiz Sabtu pagi).

## Data (Spreadsheet)

`users kelas enrollment bab item soal progress quiz_attempt lkpd_submission session log`

Tidak ada tabel pertemuan. Pengelompokan “Pertemuan 1” hanya teks `grup` pada item.

## Pasang di Apps Script

1. Project baru di [script.google.com](https://script.google.com)
2. Salin berkas `.gs` sebagai Script (nama tanpa ekstensi: `Code`, `Db`, `Util`, `Auth`, `Akses`, `Setup`, `Belajar`, `Guru`)
3. Salin berkas `.html` sebagai HTML (`index`, `css`, `v_login`, `v_app`, `js_core`, `js_auth`, `js_murid`, `js_guru`, `js_mock`)
4. `appsscript.json` sesuai repo
5. Jalankan **`setupLengkap`** → izinkan → catat DB_ID di log
6. Deploy → Web app → Execute as **Me**, Who has access **Anyone**

Masuk: `guru` / `guru123` · `siswa01` / `siswa123`

`js_mock` tidak melakukan apa-apa di GAS (`google.script.run` sudah ada).

## Pratinjau tanpa Google

```bash
node preview-server.js
```

Data contoh di memori peramban. Refresh = ulang dari seed.

## Keputusan yang dikunci di v2

1. Buka/tutup **dan** jadwal, keduanya
2. Saklar di **bab**; item ikut bab kecuali di-override
3. Tandai selesai **hanya materi**; LKPD/quiz selesai karena dikerjakan
4. Tanda boleh dibatalkan
5. Materi satu gulungan (pemisah `<!--bagian-->` hanya visual)
6. Item tertutup tampil abu-abu, bukan hilang
