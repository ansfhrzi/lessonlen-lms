# LMS v2 — Fondasi + Kelola (Tahap 1–4 + Gate 0)

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
| `Code.gs` | `doGet`, `include`, pembungkus API `_bungkus`, endpoint auth + dasbor + kelas/murid/enrollment + mapel/penugasan/topik/item |
| `Setup.gs` | Skema **23 sheet**, `setupLengkap()`, seed, migrasi, `infoDatabase()` |
| `Db.gs` | Lapisan akses Sheets: baca/tulis batch, cache, `LockService` |
| `Util.gs` | Generator ID (sheet `Counters` + lock), hash kata sandi, sanitasi, audit log |
| `Auth.gs` | Login, sesi, ganti/lupa/reset kata sandi (port v1) |
| `Notif.gs` | Notifikasi in-app: `kirim`, `kirimKeKelas`, `daftar`, `tandaiDibaca` |
| `Kelas.gs` | CRUD kelas, murid + impor massal, enrollment (enroll/reaktivasi/keluarkan), kelas saya, biodata murid |
| `Mapel.gs` | CRUD mapel, penugasan mengajar (unik per kelas+guru+mapel, reaktivasi), topik (urut, draft/publish, hapus kosong saja), item (jenis materi/quiz/tugas/refleksi, konten disanitasi), bacaan murid (publish + terdaftar) |
| `Uji.gs` | **Uji tahapan dari EDITOR Apps Script**: `ujiGate0()`, `ujiTahap3()`, `ujiTahap4()`, `ujiSemua()` — data uji dibuat & dihapus otomatis |
| `index.html` + `css.html` | Cangkang UI + sistem gaya **port dari v1** (Plus Jakarta Sans, palet hijau, topbar + lonceng, toast, tirai muat, dialog global, sidebar menu dengan laci HP, editor konten, baris pertemuan) |
| `v_login.html`, `v_dashboard.html`, `v_editor.html` | Layar masuk (gradient + kartu), cangkang dasbor `topbar-slot + isi-halaman`, dan cangkang editor item (toolbar + mode HTML + pratinjau) |
| `js_core.html` | `callApi`, **router hash** (`#/beranda`, `#/kelas/<id>`, …), topbar + lonceng, **sidebar menu** (pintasan layar + daftar kelas), toast, dialog global, laci HP |
| `js_auth.html` | Login, ganti sandi (layar terkunci ala v1), lupa sandi, profil, biodata (dialog, isian dipertahankan) |
| `js_beranda.html` | Beranda guru (kisi statistik + perlu tindakan + kartu kelas) & murid (spanduk biodata + mapel), antrean reset, notifikasi |
| `js_kelola.html` | Kelola kelas (daftar kartu + detail tabel), kelola murid (filter + tabel), impor massal dengan pratinjau |
| `js_mapel.html` | Mapel, penugasan, topik & item (guru, baris-pertemuan bernomor + baris-item); **editor item gaya v1**: contenteditable + toolbar (tabel dinamis, video YouTube nocookie, mode HTML, pratinjau); murid: Kelas Saya → Materi → Topik → pembaca `isi-materi` |
| `test/` | Uji logika: Gate 0 (18) + Tahap 3 (42) + Tahap 4 (84) |

## Cara pasang (sekali saja)

1. Buat **project Apps Script baru** (script.google.com → New project).
2. Salin seluruh berkas folder ini ke project (nama file harus sama persis,
   tanpa awalan folder). Untuk berkas HTML, nama file di Apps Script adalah
   `index`, `css`, `v_login`, `v_dashboard`, `v_editor`, `js_core`,
   `js_auth`, `js_beranda`, `js_kelola`, `js_mapel`.
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

## Uji di editor Apps Script

Selain uji Node (`test/`, jalankan dengan `node v2/test/<berkas>.js`),
seluruh tahapan bisa diuji langsung dari editor Apps Script memakai
`Uji.gs` — salin berkas ini ke project lalu jalankan salah satunya:

| Fungsi | Cakupan | Cakupan uji |
|---|---|---|
| `ujiGate0()` | login, sesi, kunci 5×, ganti/reset sandi, penjaga peran | 19 |
| `ujiTahap3()` | kelas, murid, impor, enrollment, biodata, notifikasi | 38 |
| `ujiTahap4()` | mapel, penugasan, topik, item, bacaan murid, audit | 82 |
| `ujiSemua()` | ketiganya berurutan + ringkasan | 139 |

Cara baca hasil: **View → Log** (atau ikon *Execution log*) — tiap uji
mencetak `OK <nama>` / `GAGAL <nama> → <info>`, diakhiri ringkasan
`xx/yy lulus`.

- Database harus sudah disiapkan (`setupLengkap()` sekali) — uji
  berjalan pada DB sungguhan tetapi **data uji dibuat dan dihapus
  otomatis** (juga saat ada uji yang gagal). Semua data uji memakai
  penanda unik (mis. username `k3x9q2budi01`).
- Nomor ID di sheet `Counters` ikut maju — normal, tidak berpengaruh.
- Jalankan saat aplikasi tidak sedang dipakai orang lain.
- Bila pembersihan terganggu (mis. eksekusi dihentikan paksa), sisa
  data uji mudah dicari: username/nama memuat penanda yang tercetak
  di awal log uji.

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
- ✅ Tahap 4 — Mapel, penugasan, topik, item:
  - Guru: CRUD mapel (pemilik = pembuat), penugasan mengajar
    (unik `kelas+guru+mapel` aktif, reaktivasi baris nonaktif,
    pengampu divalidasi server), topik (urutan otomatis + pindah
    atas/bawah, draft/publish, hapus hanya bila kosong), item
    (materi/quiz/tugas_individu/tugas_kelompok/refleksi, konten HTML
    disanitasi `Util.sanitasi`, publish → notifikasi kelas)
  - Murid: ketuk chip mapel di Kelas Saya → topik publish → isi
    topik → baca materi (quiz/tugas/refleksi menunggu tahap
    berikutnya); penugasan nonaktif & kelas arsip otomatis menutup
    bacaan
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

### API Tahap 4 (semua lewat `_bungkus`, role diperiksa server-side)

| Endpoint | Peran | Fungsi |
|---|---|---|
| `mapelDaftar(token)` | guru | daftar mapel + jumlah penugasan + pemilik |
| `mapelSimpan(token, p)` | guru | buat/edit mapel (pemilik otomatis pembuat) |
| `mapelUbahStatus(token, id, status)` | guru | aktif/nonaktif (soft delete) |
| `guruDaftar(token)` | guru | guru aktif — pilihan pengampu |
| `penugasanDaftar(token, filter)` | guru | daftar TA + nama kelas/mapel/guru, filter `class_id/subject_id/teacher_id/status/semua` |
| `penugasanSimpan(token, p)` | guru | buat/edit TA; unik `kelas+guru+mapel` aktif; reaktivasi baris nonaktif; pengampu wajib guru aktif |
| `penugasanUbahStatus(token, id, status)` | guru | aktif/nonaktif |
| `topikDaftar(token, taId)` | guru | topik satu penugasan + jumlah item |
| `topikSimpan(token, p)` | guru | buat/edit topik; `sort_order` otomatis |
| `topikUbahStatus(token, id, status)` | guru | draft/publish |
| `topikHapus(token, id)` | guru | hapus HANYA bila tanpa item |
| `topikPindah(token, id, arah)` | guru | naik/turun (tukar `sort_order`) |
| `itemDaftar(token, topicId)` | guru | item satu topik (tanpa konten) |
| `itemSimpan(token, p)` | guru | buat/edit item; jenis divalidasi; konten disanitasi; `related_id`/penanda AI tidak diterima dari klien |
| `itemUbahStatus(token, id, status)` | guru | draft/publish; publish → notif `pertemuan_baru` ke kelas |
| `itemHapus(token, id)` | guru | ditolak bila item sudah tertaut |
| `itemPindah(token, id, arah)` | guru | naik/turun dalam topik |
| `topikKelasSaya(token, taId)` | murid | topik publish; wajib terdaftar aktif + TA & kelas aktif |
| `bukaTopik(token, topicId)` | murid | isi topik — item publish tanpa konten |
| `bacaMateri(token, itemId)` | murid | konten materi publish; jenis lain → `FITUR_BELUM_ADA` |

## Darurat

Akun guru terkunci/lupa sandi → jalankan `resetGuruDarurat()` dari editor
Apps Script; kata sandi sementara tampil di log dan wajib diganti.
