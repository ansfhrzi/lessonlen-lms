# LMS v2 — Fondasi (Tahap 1 + Gate 0)

> **⚠️ STATUS 2 Sep 2026 — ROLLBACK KE TAHAP 2.** Seluruh UI/UX & fungsi
> tahap 3 (kelas/murid/enrollment) dan tahap 4 (mapel/course/editor)
> **dihapus** dari folder ini dan akan dibangun ulang dengan rancangan
> tampilan yang lebih matang. Kode lama diarsipkan di git: tahap 3 =
> commit `a63527b`, tahap 4 = rentang `a63527b..c1c0157`
> (`git checkout <commit> -- v2/`). Rincian: lihat `PERUBAHAN.md`.

Implementasi rancangan **v2.1** (`../DOKUMENTASI_RANCANGAN_LMS_GAS_v2.md`).
Folder ini adalah **satu project Apps Script baru** — terpisah dari LessonLen v1
yang ada di akar repositori.

## Keputusan yang dipegang (v2.1)

1. **Login sama seperti v1** — nama pengguna + kata sandi (SHA-256 + salt),
   sesi token TTL 12 jam, kunci otomatis 5× gagal/15 menit, reset oleh guru.
2. **Role dua saja** — `guru` (sekaligus admin) dan `murid`.
3. **Proses enrollment sama seperti v1** — sheet `Enrollment`
   (aktif/keluar), guru mendaftarkan murid, notifikasi `enroll_kelas`.
4. **Sistem AI generate sama seperti v1** — akan dipindahkan dari `Ai.gs` v1
   pada tahap berikutnya (rotasi key Gemini, draf wajib ditinjau guru).

## Isi folder

| Berkas | Fungsi |
|---|---|
| `Code.gs` | `doGet`, `include` (satu-satunya jalur sisip berkas klien), pembungkus API `_bungkus`, endpoint auth + dasbor + `getBiodata` (biodata murid sendiri utk layar Biodata Saya) |
| `Setup.gs` | Skema **23 sheet**, `setupLengkap()`, seed, migrasi, `infoDatabase()` |
| `Db.gs` | Lapisan akses Sheets: baca/tulis batch, cache, `LockService` |
| `Util.gs` | Generator ID (sheet `Counters` + lock), hash kata sandi, sanitasi, audit log |
| `Auth.gs` | Login, sesi, ganti/lupa/reset kata sandi (port v1) + biodata murid (email, no WA, **tanggal lahir**; NISN opsional) + **lupa sandi/username mandiri** (verifikasi 3 data → reset otomatis; gagal → hubungi guru) |
| `Murid.gs` | **Tahap 3.1** — Kelola Murid: daftar/cari/filter, tambah/edit (sandi sementara), detail (+`pwd_awal`), impor massal + pratinjau (dedupe username) |
| `Kelas.gs` | **Tahap 3.2** — Kelola Kelas: CRUD + arsip (ditolak bila dipakai course aktif), detail + murid ter-enroll, murid tersedia utk enroll, enroll (dedupe + reaktivasi + notif `enroll_kelas`), keluarkan, **`kelasSaya`** (endpoint murid: kelas yang diikuti + mapel aktif — kartu Kelas Saya) |
| `Course.gs` | **Tahap 3.3** — Kelola Course: "Course" = Teaching_Assignments (label `KELAS - MAPEL`); buat = kelas + mapel bebas (auto-dedupe `Subjects`), duplikat ditolak, edit ganti kelas/mapel, hapus = lepas relasi; buat ulang → reaktivasi |
| `ApiKey.gs` | **Tahap 3.4** — Status API Key: pasang ≤10 key Gemini (Script Properties `GEMINI_KEYS`, menimpa daftar lama), panel hanya melihat 4 digit terakhir, status siap/istirahat/bermasalah, reset cooldown — mekanisme & nama kunci identik v1 (siap dipakai modul AI) |
| `Uji.gs` | **Uji dari editor Apps Script** ke DB nyata: `ujiSemua()` (atau `ujiGate0()` / `ujiMurid()`); data uji berpenanda `uXXXXXX` + pembersihan otomatis; akun seed tak diubah |
| `index.html` + `css.html` | Cangkang UI; **scriptlet `<? ?>` hanya di index.html** (berkas include tak dievaluasi scriptlet); `css.html` = sistem desain (token tema `:root` hijau `#2F6B2B` — ganti tema cukup ubah variabel; responsif 4 breakpoint: 1024/900/700/380 — ponsel: sidebar off-canvas, dialog bottom-sheet) |
| `v_login.html`, `v_dashboard.html` | Layar masuk + cangkang dasbor (sidebar/topbar/lonceng/toast) |
| `js_core.html` | Pembungkus `google.script.run`, token sesi, router `Core.pergiKe`, dialog & toast global, lonceng notifikasi |
| `js_auth.html` | Login, keluar, wajib ganti sandi, **lupa akses §5.5** (2 jalur mandiri + jalur guru; sandi sementara tampil sekali; gagal → pesan netral) + layar **Biodata Saya** (murid: lihat/edit) |
| `js_beranda.html` | **UI Tahap 3** — beranda §22D: guru (4 angka + perlu tindakan + **Course saya**) & murid (stat + **kartu Kelas Saya** dgn daftar mapel + pengingat biodata) |
| `js_murid.html` | **UI Tahap 3** — Kelola Murid: daftar+cari/filter, tambah (dialog sandi + kirim WA), detail (+`pwd_awal`, reset), edit, nonaktif, impor massal + pratinjau |
| `js_kelas.html` | **UI Tahap 3** — Kelola Kelas: kisi kartu, form buat/edit, detail (murid + tambah/keluarkan), arsip |
| `js_course.html` | **UI Tahap 3** — Kelola Course: tabel, buat/edit (kelas + mapel), hapus = nonaktif |
| `js_rekap.html` | **UI Tahap 3** — Rekap Nilai placeholder "menyusul" |
| `js_apikey.html` | **UI Tahap 3** — Status API Key: 10 slot + status, timpa daftar, reset cooldown |
| `test/` | Uji node: `uji-auth-gate0.js` (18) + `uji-murid.js` (65) + `uji-lupa-akses.js` (35) + `uji-kelas.js` (55) + `uji-course.js` (41) + `uji-apikey.js` (31) + `uji-beranda.js` (18) + `uji-ui.js` (audit statis fungsi klien; daftar berkas auto) + `uji-ui-extra.js` (audit id/endpoint/CSS/rute) + `uji-alur-ui.js` (opsional: alur klik di jsdom, dilewati bila jsdom/pratinjau tak ada) |

## Cara pasang (sekali saja)

1. Buat **project Apps Script baru** (script.google.com → New project).
2. Salin seluruh berkas folder ini ke project (nama file harus sama persis,
   tanpa awalan folder). Untuk berkas HTML, nama file di Apps Script adalah
   `index`, `css`, `v_login`, `v_dashboard`, `js_core`, `js_auth`,
   `js_beranda`, `js_murid`, `js_kelas`, `js_course`, `js_rekap`,
   `js_apikey`.
3. Jalankan fungsi **`setupLengkap`** dari editor → izinkan akses.
   Spreadsheet `DB_LMS_V2` (23 sheet) dibuat otomatis dan `DB_ID`
   tersimpan di Script Properties.
4. Deploy → **New deployment** → tipe *Web app*:
   - Execute as: **Me**
   - Who has access: **Anyone** (murid tidak butuh akun Google)
5. Buka URL `/exec`. Login contoh:
   - guru → `guru` / `guru123`
   - murid → `siswa01` / `siswa123`
6. Sebelum dipakai sungguhan: jalankan `hapusSeedData()`, lalu ganti kata
   sandi guru.

## Database (23 sheet)

`Users`, `Classes`, `Subjects`, `Teaching_Assignments`, `Enrollment`,
`Topics`, `Items`, `Progress`, `Quizzes`, `Quiz_Questions`,
`Quiz_Submissions`, `Assignments`, `Groups`, `Group_Members`, `Submissions`,
`Grades`, `Reflections`, `Notifications`, `Materi_AI`, `Permintaan_Reset`,
`Session`, `Counters`, `Audit_Logs` — definisi kolom ada di `Setup.gs` (SKEMA).

## Gate 0 — PoC Login & Sesi (ceklist)

Sebelum modul berikutnya dibangun, pastikan seluruh butir ini lulus
di deployment `/exec` sungguhan:

```
[ ] Login guru berhasil
[ ] Login murid berhasil
[ ] User tak terdaftar → pesan seragam
[ ] 5× gagal → terkunci 15 menit
[ ] User nonaktif ditolak
[ ] harus_ganti_password memaksa ganti
[ ] Sesi kedaluwarsa ditolak; logout bersih
[ ] Reset kata sandi oleh guru berhasil + mencabut sesi murid
[ ] Murid tidak bisa memanggil API guru (resetPasswordMurid/getPermintaanReset)
```

## Status & tahap berikutnya

- ✅ Tahap 1 — Database initializer (23 sheet + seed + migrasi)
- ✅ Tahap 2 — Auth + session + audit log + UI login/dasbor
- ✅ Tahap 3.1 — backend Kelola Murid (`Murid.gs` + endpoint + 65 uji)
- ✅ Tahap 3.1c — **lupa sandi/username mandiri**: biodata murid +
  tanggal lahir (NISN opsional; kolom baru `Users.tanggal_lahir` —
  DB lama jalankan `migrasiStruktur()`); lupa password = username +
  no WA + tgl lahir; lupa keduanya = email + no WA + tgl lahir →
  username tampil + sandi baru; gagal → hubungi guru
- ✅ Tahap 3.2 — backend Kelola Kelas (`Kelas.gs` + 7 endpoint + 48 uji)
- ✅ Tahap 3.3 — backend Kelola Course (`Course.gs` + 4 endpoint + 41 uji)
- ✅ Tahap 3.4 — backend Status API Key (`ApiKey.gs` + 3 endpoint + 31 uji)
- ✅ Tahap 3.5 — backend Beranda ringkas (`ringkasDashboard` bentuk §22D:
  kelas/course/murid + api_key + perlu tindakan antrean reset; murid +
  biodata_kurang) — **backend Tahap 3 TUNTAS**

- ✅ UI Tahap 3 — klien lengkap sesuai prototipe `desain/tampilan-v2.html`:
  sistem desain baru (css.html), cangkang sidebar + router, beranda §22D,
  Kelola Murid/Kelas/Course + dialog lengkap, Status API Key, lonceng
  notifikasi, Rekap placeholder; audit statis `uji-ui.js` + `uji-ui-extra.js`
  (id/endpoint/kelas CSS/rute) semua lulus
- ↩️ **Rollback 2 Sep 2026** — UI/UX & fungsi tahap 3–4 lama dihapus
  (arsip: `a63527b..c1c0157`); keputusan alur baru: §22D dokumen rancangan
- ⬜ Tahap 3 (baru) — Dashboard 5 menu ala §22D, urutan bangun:
  **Beranda ringkas → Kelola Murid → Kelola Kelas → Kelola Course →
  Status API Key**; menu Rekap Nilai tampil sebagai placeholder "menyusul"
- ⬜ Tahap 4 — Konten course: topik, materi, quiz, tugas (rancangan UI
  disepakati lebih dulu)
- ⬜ Tahap 5 — Rekap nilai per course + export Excel
- ⬜ Tahap 6 — Porting `Ai.gs` v1 (Gemini, perilaku tak berubah); API key
  dari menu Status terhubung penuh ke generator

## Darurat

Akun guru terkunci/lupa sandi → jalankan `resetGuruDarurat()` dari editor
Apps Script; kata sandi sementara tampil di log dan wajib diganti.
