# LMS v2 — Fondasi (Tahap 1 + Gate 0)

Implementasi awal rancangan **v2.1** (`../DOKUMENTASI_RANCANGAN_LMS_GAS_v2.md`).
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
| `Code.gs` | `doGet`, `include`, pembungkus API `_bungkus`, endpoint auth + dasbor + kelas/murid/enrollment |
| `Setup.gs` | Skema **23 sheet**, `setupLengkap()`, seed, migrasi, `infoDatabase()` |
| `Db.gs` | Lapisan akses Sheets: baca/tulis batch, cache, `LockService` |
| `Util.gs` | Generator ID (sheet `Counters` + lock), hash kata sandi, sanitasi, audit log |
| `Auth.gs` | Login, sesi, ganti/lupa/reset kata sandi (port v1) |
| `Notif.gs` | Notifikasi in-app: `kirim`, `kirimKeKelas`, `daftar`, `tandaiDibaca` |
| `Kelas.gs` | CRUD kelas, murid + impor massal, enrollment (enroll/reaktivasi/keluarkan), kelas saya, biodata murid |
| `index.html` + `css.html` | Cangkang UI + gaya |
| `v_login.html`, `v_dashboard.html` | Layar masuk & dasbor bernavigasi (Beranda/Kelas/Murid/Notifikasi) |
| `js_core.html`, `js_auth.html`, `js_kelola.html` | Pembungkus `google.script.run`, token sesi, logika layar |
| `test/` | Uji logika: Gate 0 (18 kasus) + Tahap 3 (42 kasus) |

## Cara pasang (sekali saja)

1. Buat **project Apps Script baru** (script.google.com → New project).
2. Salin seluruh berkas folder ini ke project (nama file harus sama persis,
   tanpa awalan folder). Untuk berkas HTML, nama file di Apps Script adalah
   `index`, `css`, `v_login`, `v_dashboard`, `js_core`, `js_auth`.
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
- ✅ Tahap 2 (sebagian) — Auth + session + audit log
- ✅ Tahap 3 — Kelas, murid, enrollment:
  - Guru: CRUD kelas (buat/edit/arsip), kelola murid (tambah/edit/
    nonaktifkan/reset sandi), impor massal dengan pratinjau,
    daftarkan/keluarkan murid dari kelas
  - Murid: layar Kelas Saya (kelas + mapel), lengkapi biodata sendiri
  - Enrollment mengikuti v1: dedupe, reaktivasi baris `keluar`,
    notifikasi `enroll_kelas`
- ⬜ Tahap 4 — Subjects, Teaching_Assignments, Topics, Items
- ⬜ Tahap 5 — Quiz + soal + penilaian
- ⬜ Tahap 6 — Tugas individu & kelompok
- ⬜ Tahap 7 — Rekap nilai & progres
- ⬜ Tahap 8 — Porting `Ai.gs` v1 (generator Gemini, perilaku tidak berubah)
- ⬜ Tahap 9 — Notifikasi lengkap + email terbatas

### API Tahap 3 (semua lewat `_bungkus`, role diperiksa server-side)

| Endpoint | Peran | Fungsi |
|---|---|---|
| `kelasDaftar(token, semua)` | guru | daftar kelas + jumlah murid/mapel |
| `kelasSimpan(token, p)` | guru | buat/edit kelas |
| `kelasUbahStatus(token, id, status)` | guru | arsip/aktifkan kelas |
| `muridDaftar(token, filter)` | guru | daftar murid + filter cari/rombel/status/kelas |
| `muridSimpan(token, p)` | guru | tambah/edit murid |
| `muridImporPratinjau(token, teks)` | guru | pratinjau impor tanpa menulis |
| `muridImpor(token, classId, teks)` | guru | impor massal + enroll opsional |
| `kelasMurid(token, classId)` | guru | murid terdaftar di kelas |
| `muridTersedia(token, classId)` | guru | kandidat pendaftaran |
| `muridDaftarkan(token, classId, ids)` | guru | enroll (dedupe + reaktivasi) |
| `muridKeluarkan(token, classId, userId)` | guru | status enrollment `keluar` |
| `kelasSaya(token)` | semua | kelas diikuti murid / diajar guru |
| `simpanBiodataSaya(token, p)` | murid | lengkapi email + WA (+NISN opsional) |
| `daftarNotifikasi(token)` / `notifTandaiDibaca` | semua | notifikasi in-app |

## Darurat

Akun guru terkunci/lupa sandi → jalankan `resetGuruDarurat()` dari editor
Apps Script; kata sandi sementara tampil di log dan wajib diganti.
