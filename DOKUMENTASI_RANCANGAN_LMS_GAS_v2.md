# 📚 Dokumentasi Rancangan LMS dengan Google Apps Script

**Versi:** 2.1 — revisi keputusan final  
**Tanggal:** 2 September 2026  
**Status:** Blueprint final siap implementasi — Gate 0 = PoC Login & Sesi  
**Proyek:** LMS sederhana — fase MVP  
**Target MVP:** 1–10 guru, sekitar 500 siswa, satu sekolah/organisasi

> **KEPUTUSAN FINAL V2.1 (menggantikan bagian rancangan OAuth lama):**
>
> 1. **Login sama seperti LessonLen v1** — nama pengguna + kata sandi (hash SHA-256 + salt, sesi token, kunci otomatis, reset oleh guru). Google OAuth/OpenID Connect **dihapus** dari rancangan.
> 2. **Role tetap dua: `guru` (sekaligus admin) dan `murid`.** Tidak ada role admin terpisah.
> 3. **Proses enrollment sama seperti v1** — sheet `Enrollment` (enroll_id, kelas_id, user_id, tanggal_daftar, status aktif/keluar), guru mendaftarkan murid, notifikasi `enroll_kelas`.
> 4. **Sistem AI generate sama seperti v1** — Gemini dengan rotasi API key, hasil selalu **draf** yang wajib ditinjau guru. AI adalah bagian MVP inti, bukan Phase 2.

---

## 1. Ringkasan Eksekutif

Sistem ini adalah LMS sederhana berbasis Google Apps Script dengan fitur:

- Pengguna dengan role guru (sekaligus admin) dan murid.
- Login menggunakan nama pengguna dan kata sandi — sama seperti LessonLen v1.
- Manajemen kelas, keanggotaan siswa, dan penugasan guru-mapel-kelas.
- Topic dan item pembelajaran: materi, tugas individu, tugas kelompok, quiz, dan refleksi.
- Kontrol buka/tutup topic dan item.
- Generator AI (Gemini) untuk menyusun **draf** materi, LKPD/kegiatan, refleksi, soal, dan kerangka — wajib ditinjau guru sebelum dipublikasikan (sama seperti v1).
- Tracking progres siswa.
- Quiz dengan pilihan ganda, benar-salah, jawaban singkat, dan uraian.
- Pengumpulan tugas melalui Google Drive.
- Kelompok dan ketua kelompok.
- Rekap nilai dan progres.
- Notifikasi dalam aplikasi dan email terbatas.
- Backup database dan file.

Arsitektur yang dipilih untuk MVP:

```text
1 Project Google Apps Script
1 Spreadsheet database tunggal
1 URL Web App
1 folder Drive induk
Semua dimiliki dan dijalankan oleh akun Admin
```

Data guru, kelas, dan aktivitas dipisahkan secara **logis melalui relasi dan authorization server-side**, bukan dengan spreadsheet fisik terpisah per guru.

### Keputusan utama versi 2.1

1. Arsitektur single project dan single spreadsheet dipertahankan.
2. Login menggunakan nama pengguna + kata sandi, **sama seperti LessonLen v1**: hash SHA-256 + salt per user, sesi token TTL 12 jam, kunci otomatis 5× gagal dalam 15 menit, ganti kata sandi mandiri, lupa kata sandi → permintaan reset → guru mereset.
3. Role hanya dua: `guru` (sekaligus admin) dan `murid`. Seluruh fungsi admin (kelola murid, reset kata sandi, backup, monitoring) dipegang guru.
4. Keanggotaan kelas, penugasan mapel, dan anggota kelompok tidak lagi disimpan sebagai JSON Array dalam satu sel.
5. Proses enrollment sama seperti v1: guru mendaftarkan murid ke kelas melalui sheet `Enrollment` dengan status `aktif`/`keluar`, disertai notifikasi `enroll_kelas`.
6. Sistem AI generate sama seperti v1 (`Ai.gs`): Gemini via UrlFetch, rotasi ≤10 API key di Script Properties, fallback model + cooldown, hasil draf wajib ditinjau (`ai_ditinjau`).
7. Hak akses tidak hanya mengandalkan `teacher_id`, tetapi menggunakan pemeriksaan kepemilikan resource dan keanggotaan kelas.
8. Monitoring kuota diubah menjadi monitoring kesehatan sistem dan metrik pemakaian internal; bukan klaim kuota Apps Script per guru.
9. WhatsApp dan otomatisasi copy file siswa bukan bagian dari MVP inti.
10. Database final terdiri atas **23 sheet**: 21 sheet rancangan awal dengan `Class_Members` → `Enrollment` dan `Sessions` → `Session`, ditambah `Materi_AI` (riwayat generate) dan `Permintaan_Reset` (alur lupa kata sandi).

---

## 2. Tujuan dan Batasan

### 2.1 Tujuan

1. Menyediakan LMS sederhana yang dapat dikelola sekolah tanpa server sendiri.
2. Memanfaatkan Apps Script, Google Sheets, dan Google Drive.
3. Menyediakan satu URL yang dapat digunakan oleh admin, guru, dan siswa.
4. Mendukung seorang guru mengajar banyak mapel di kelas yang sama.
5. Menyediakan akses data yang terkontrol antar-guru dan antar-kelas.
6. Memungkinkan implementasi bertahap dengan biaya infrastruktur rendah.

### 2.2 Target pengguna

| Role | Tanggung jawab utama |
|---|---|
| Guru (admin) | Mengelola murid, kelas, enrollment, mapel, materi, tugas, quiz, kelompok, nilai, dan progres; sekaligus memegang fungsi admin: reset kata sandi, backup, konfigurasi, monitoring |
| Murid | Melihat materi, mengerjakan quiz/tugas, mengisi refleksi, dan melihat progres/nilai |

### 2.3 Yang termasuk MVP

- Satu sekolah/organisasi.
- 1–10 guru.
- Sekitar 500 siswa.
- Nama pengguna + kata sandi untuk seluruh pengguna — tanpa akun Google (sama seperti v1).
- Akses melalui Web App, bukan aplikasi Android/iOS.
- Data utama di satu Spreadsheet.
- File pembelajaran di Google Drive.
- Email sebagai notifikasi tambahan dengan batas kuota.
- Quiz dan tugas dengan alur submit yang sederhana.
- Generator AI Gemini untuk draf materi/soal/LKPD/refleksi/kerangka (sama seperti v1).

### 2.4 Yang tidak termasuk MVP

- WebSocket atau real-time update.
- Video conference.
- Chat/forum.
- Payment gateway.
- Mobile app native.
- Self-registration guru.
- Otomatisasi penuh WhatsApp.
- Sistem ujian dengan anti-cheating tingkat tinggi.
- Otomatisasi copy file siswa yang kompleks.
- AI penilai (AI grading) sebagai dependensi utama — AI pada MVP hanya menghasilkan draf konten, bukan menilai.
- Multi-sekolah dalam satu database.

---

## 3. Kesesuaian dengan Google Apps Script

| Fitur | Status | Catatan implementasi |
|---|---:|---|
| Web App HTML | ✅ | Menggunakan `doGet()` dan HTML Service |
| Dashboard berdasarkan role | ✅ | Role ditentukan dari session server-side |
| CRUD Spreadsheet | ✅ | Gunakan batch read/write dan cache referensi |
| Manajemen Drive | ✅ | Gunakan `DriveApp` atau Advanced Drive Service jika diperlukan |
| Topic dan item | ✅ | Cocok untuk GAS |
| Progres siswa | ✅ | Wajib composite key dan idempotency |
| Quiz PG/benar-salah | ✅ | Dapat dinilai otomatis |
| Jawaban singkat/uraian | ⚠️ | Perlu aturan pencocokan atau penilaian manual |
| Tugas Google Docs/Slides/Sheets | ⚠️ | Perlu aturan ownership dan permission yang jelas |
| Import CSV | ✅ | Dapat diproses dari form HTML |
| Import Excel | ⚠️ | Perlu konversi melalui Drive/API atau proses eksternal |
| Generator AI (Gemini) | ✅ | UrlFetch + rotasi API key + fallback model; hasil draf wajib ditinjau guru (sama seperti v1) |
| Email | ⚠️ | Kuota tergabung pada akun pemilik script |
| WhatsApp | ⚠️ | Hanya melalui API eksternal dan bukan fitur native |
| Monitoring kuota per guru | ❌ | Tidak tersedia sebagai data kuota resmi per guru |
| Backup spreadsheet | ✅ | Dapat menyalin file database melalui Drive |
| Transaksi database | ❌ | Sheets tidak menyediakan transaction/rollback native |
| Real-time | ❌ | Gunakan refresh manual atau polling terbatas |

Google Apps Script Web App dapat dijalankan sebagai pemilik script atau sebagai pengguna yang mengaksesnya. Pada rancangan ini digunakan **Execute as: Me**, sehingga layanan Sheets dan Drive berjalan menggunakan otorisasi akun Admin. [Dokumentasi Web Apps](https://developers.google.com/apps-script/guides/web)

---

## 4. Arsitektur Sistem

### 4.1 Diagram arsitektur

```text
┌──────────────────────────────────────────────────────────────┐
│                    PENGGUNA                                  │
│       Admin       Guru       Siswa                            │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│             Google Apps Script Web App                        │
│                                                              │
│  doGet() / HTML Service                                       │
│  Authentication & Session                                    │
│  Authorization                                                │
│  Controllers                                                  │
│  Database Services                                            │
│  Drive Service / Email Service                                │
└──────────────────────┬───────────────────────┬───────────────┘
                       │                       │
                       ▼                       ▼
┌──────────────────────────────┐   ┌───────────────────────────┐
│ Google Sheets Database       │   │ Google Drive                │
│ 23 sheet                    │   │ LMS_Utama/                  │
│ data terstruktur             │   │ folder guru/kelas/item      │
└──────────────────────────────┘   └───────────────────────────┘
```

### 4.2 Deployment

| Pengaturan | Nilai |
|---|---|
| Deployment | Web App |
| Execute as | Me — akun guru/pemilik script |
| Access | **Anyone (anonim)** — autentikasi ditangani aplikasi sendiri lewat login nama pengguna + kata sandi, sehingga murid tidak perlu akun Google |
| Database | Satu Spreadsheet milik Admin |
| Drive | Folder induk milik Admin atau Shared Drive jika tersedia |
| URL | Satu URL `/exec` untuk semua pengguna |
| Lingkungan | Pisahkan development/staging dan production |

Spreadsheet database **tidak boleh dibagikan langsung** kepada guru maupun siswa. Akses mereka hanya melalui Web App.

### 4.3 Struktur file project

Rancangan v2 dikembangkan dalam folder `v2/` pada repositori, sebagai project Apps Script baru yang terpisah dari LessonLen v1:

```text
v2/
├── Code.gs          doGet, include(), pembungkus API (_bungkus)
├── Setup.gs         skema 23 sheet, setup, seed, migrasi, info DB
├── Db.gs            lapisan akses Sheets: baca/tulis batch, cache, LockService
├── Util.gs          generator ID (Counters), hash kata sandi, tanggal, sanitasi, audit log
├── Auth.gs          login, sesi, ganti/lupa/reset kata sandi (port v1)
├── Kelas.gs         (tahap berikut) kelas, murid, enrollment
├── MateriPokok.gs   (tahap berikut) topic, item
├── Quiz.gs          (tahap berikut) soal, attempt, penilaian
├── Ai.gs            (tahap berikut) generator Gemini — dipindahkan dari v1
├── index.html       cangkang UI
├── css.html         gaya visual
├── v_login.html     layar masuk (nama pengguna + kata sandi)
├── v_dashboard.html dasbor guru/murid
├── js_core.html     pembungkus google.script.run, token sesi, router
└── js_auth.html     logika layar masuk & kata sandi
```

Kelola source dengan `clasp` dan repositori Git bila editor Apps Script tidak mendukung folder project.

---

## 4A. Persiapan Apps Script

### 4A.1 Project

Buat **satu project Apps Script baru** untuk LMS v2 (dipisahkan dari project
LessonLen v1). Siapkan project development/staging terpisah bila pengujian
perubahan schema tidak boleh mengganggu data sungguhan.

### 4A.2 Script Properties

Konfigurasi disimpan di `PropertiesService.getScriptProperties()`:

```text
DB_ID        ID spreadsheet database (diisi otomatis setupDatabase())
GEMINI_KEYS  JSON array ≤10 API key Gemini (sama seperti v1 — Ai.gs)
GEMINI_MODEL pilihan model guru (opsional)
TEMPLATE_FEEDBACK  template umpan balik penilaian
CTR_*        tidak dipakai lagi — generator ID v2 memakai sheet Counters
```

Secret tidak boleh ditaruh di HTML, JavaScript client, atau Spreadsheet.

### 4A.3 Google services

`SpreadsheetApp`, `DriveApp`, `MailApp`, dan `UrlFetchApp` (untuk Gemini)
dipakai sesuai scope script. Advanced Service tidak diperlukan pada MVP.
Karena login ditangani aplikasi sendiri, **tidak ada OAuth Client**, Cloud
Console consent screen, maupun test user yang perlu dikonfigurasi.

## 5. Strategi Autentikasi

### 5.1 Keputusan

Login **sama seperti LessonLen v1**: nama pengguna + kata sandi milik aplikasi sendiri. Tidak ada Google OAuth, tidak ada `Session.getActiveUser()`, dan murid tidak memerlukan akun Google.

Mekanisme yang dipakai (port `Auth.gs` v1):

```text
username + password
→ hash SHA-256 dengan salt per user
→ sesi token acak 32 karakter (TTL 12 jam)
→ token disimpan di sessionStorage browser, dikirim pada tiap google.script.run
→ server memvalidasi token → user → status aktif pada setiap request
```

### 5.2 Alur login

```text
1. Pengguna membuka Web App.
2. Bila belum ada sesi, sistem menampilkan halaman Login.
3. Pengguna memasukkan nama pengguna dan kata sandi.
4. Server menormalkan username (lowercase, tanpa spasi).
5. Server memeriksa kunci otomatis: 5× gagal dalam 15 menit → akun terkunci 15 menit.
6. Server mencari user, membandingkan password_hash.
7. Pesan galat SELALU sama untuk "user tak ada" maupun "sandi salah"
   agar tidak bisa dipakai menebak username valid.
8. User nonaktif ditolak.
9. Server membuat sesi token (TTL 12 jam) + cache 1 jam.
10. last_login dicatat; login dicatat di Audit_Logs.
11. Murid dengan biodata belum lengkap (email + no WA) diminta melengkapinya.
12. User dengan harus_ganti_password = true dipaksa mengganti kata sandi.
```

### 5.3 Keamanan kata sandi

- Kata sandi TIDAK PERNAH disimpan plaintext maupun dikirim ke klien.
- `password_hash` = SHA-256(`salt` + `password`); `salt` acak 16 karakter per user.
- Kata sandi baru minimal 6 karakter, memuat huruf dan angka.
- Kata sandi sementara 8 karakter tanpa karakter ambigu (0 O 1 I L),
  disimpan pada `pwd_awal` sehingga tetap terlihat guru sampai murid
  menggantinya sendiri (perilaku v1 — revisi §22D, 2026-09-02).
- Batas percobaan gagal 5×/15 menit memakai CacheService.

### 5.4 Sesi aplikasi

Sesi menggunakan token acak 32 karakter yang tidak bermakna (`Util.buatToken()`).

Pola yang digunakan (sama seperti v1):

```text
login berhasil
→ token dibuat, disimpan pada sheet Session (token, user_id, dibuat_at, expired_at)
→ token dikembalikan ke browser, disimpan di sessionStorage
→ CacheService 'sesi_<token>' berisi snapshot user (TTL 1 jam)
→ setiap google.script.run mengirim token sebagai parameter pertama
```

Bila cache hilang, server jatuh ke sheet `Session` selama belum kedaluwarsa. Role dan status user selalu dibaca ulang dari `Users`; sesi otomatis dihapus bila user menjadi nonaktif, dan seluruh sesi milik satu user dicabut saat kata sandinya direset.

### 5.5 Data Users untuk identitas

Field yang digunakan (sama seperti v1):

- `username` — identitas login, normalized lowercase, unik.
- `password_hash` + `salt` — verifikasi kata sandi.
- `pwd_awal` — kata sandi sementara terakhir (untuk ditampilkan guru sampai diganti).
- `harus_ganti_password` — paksa ganti kata sandi pada login berikutnya.
- `status` — `aktif` atau `nonaktif`.
- `nama`, `rombel`, `email`, `nisn`, `no_wa` — biodata (murid diminta melengkapi email + no WA).

### 5.6 Alur lupa kata sandi

```text
Murid mengajukan reset dari layar login (username atau email)
→ respons SELALU sama apa pun hasilnya (anti user-enumeration)
→ rate limit 3 permintaan / 24 jam per user
→ baris baru di sheet Permintaan_Reset (status: antre)
→ notifikasi ke seluruh guru
→ guru membuka daftar permintaan → mereset
→ kata sandi sementara tampil SEKALI di layar guru
→ seluruh sesi murid dicabut; murid wajib ganti kata sandi saat login
```

Tersedia pula `resetGuruDarurat()` yang hanya bisa dijalankan dari editor Apps Script bila akun guru sendiri terkunci.

---

### 5.7 PoC Login & Sesi sebagai Gate 0

Sebelum modul LMS dibuat, fondasi auth harus lulus seluruh pemeriksaan berikut pada deployment Web App aktual:

```text
[ ] Login guru berhasil (username + kata sandi)
[ ] Login murid berhasil
[ ] Kata sandi salah → pesan seragam, tidak membocorkan keberadaan username
[ ] 5× gagal dalam 15 menit → akun terkunci 15 menit
[ ] User nonaktif tidak dapat masuk
[ ] harus_ganti_password memaksa penggantian sebelum lanjut
[ ] Sesi token valid dipakai pada google.script.run
[ ] Sesi kedaluwarsa (TTL 12 jam) ditolak
[ ] Logout menghapus sesi + cache
[ ] Reset kata sandi murid oleh guru berjalan (sandi sementara tampil sekali)
[ ] Reset mencabut seluruh sesi murid
[ ] Role tidak dapat diubah melalui browser
[ ] Murid tidak dapat memanggil API khusus guru
```

**Gate:** Jika PoC belum lulus, implementasi modul LMS tidak dilanjutkan.

---

## 6. Authorization dan Isolasi Data

### 6.0 Authorization Matrix

Hanya ada dua role: **guru** (sekaligus admin) dan **murid**.

| Aksi | Guru (admin) | Murid |
|---|:---:|:---:|
| Kelola murid (tambah/import/nonaktifkan) | ✅ | ❌ |
| Reset kata sandi murid | ✅ | ❌ |
| Monitoring sistem & backup | ✅ | ❌ |
| Kelola mapel dalam scope | ✅ | ❌ |
| Buat/kelola kelas | ✅ | ❌ |
| Kelola enrollment kelas | ✅ | ❌ |
| Buat/edit topic dan item | ✅ | ❌ |
| Lihat materi yang diizinkan | ✅ | ✅ |
| Tandai item selesai | ❌ | ✅ |
| Buat dan nilai quiz | ✅ | ❌ |
| Kerjakan quiz | ❌ | ✅ |
| Buat tugas/kelompok | ✅ | ❌ |
| Submit tugas | ❌ | ✅ |
| Submit tugas kelompok | ❌ | Ketua |
| Generate draf AI (materi/soal/LKPD/refleksi) | ✅ | ❌ |
| Tinjau & publikasikan draf AI | ✅ | ❌ |
| Lihat nilai murid | Scope kelas/mapel | ❌ |
| Lihat nilai sendiri | ❌ | ✅ |

Role hanya lapisan pertama. Semua aksi guru dan murid tetap harus memeriksa
kepemilikan resource, membership kelas, status item, dan deadline.

### 6.1 Prinsip utama

Tidak boleh ada fungsi server yang mempercayai:

- `role` dari client.
- `user_id` dari client sebagai identitas pengguna.
- `teacher_id` dari client.
- `class_id` dari client tanpa pemeriksaan akses.
- `file_id` dari client tanpa validasi kepemilikan/relasi.

Semua identitas berasal dari session yang sudah divalidasi server.

### 6.2 Helper authorization wajib

```text
requireSession(sessionToken)
requireActiveUser(session)
requireRole(session, role)
requireAdmin(session)
requireTeacherCanManageClass(session, classId)
requireTeacherCanManageAssignment(session, teachingAssignmentId)
requireTeacherOwnsTopic(session, topicId)
requireStudentBelongsToClass(session, classId)
requireStudentCanAccessItem(session, itemId)
requireStudentCanSubmitQuiz(session, quizId)
requireStudentCanSubmitAssignment(session, assignmentId)
requireGroupLeader(session, groupId)
requireSubmissionResourceIsAllowed(session, fileId)
```

### 6.3 Model akses

- Admin dapat mengelola seluruh data.
- Guru dapat mengelola `Teaching_Assignments` miliknya.
- Guru dapat mengelola topic/item yang berada di bawah `Teaching_Assignments` miliknya.
- Siswa hanya dapat melihat kelas yang memiliki membership aktif.
- Siswa hanya dapat melihat item yang open dan berada di kelasnya.
- Ketua kelompok dapat submit untuk kelompok yang membership-nya aktif.
- Guru hanya dapat melihat refleksi, progres, dan nilai dari kelas/teaching assignment yang menjadi kewenangannya.

### 6.4 Pengujian isolasi data

Sebelum produksi, harus ada automated test dengan minimal:

```text
Guru A + Kelas A + Siswa A
Guru B + Kelas B + Siswa B
Satu siswa yang sengaja berada di dua kelas untuk menguji membership
```

Pengujian harus memastikan Guru A tidak dapat:

- Melihat daftar siswa Guru B.
- Membaca atau mengubah topic Guru B.
- Membaca nilai kelas Guru B.
- Membuka file Drive milik kelas Guru B melalui aplikasi.

---

## 7. Struktur Database Final — 23 Sheet

Semua sheet berada dalam satu Spreadsheet `DB_LMS_V2`. Header harus didefinisikan dalam konfigurasi agar repository tidak bergantung pada nomor kolom tetap.

### 7.1 Daftar sheet

| No | Sheet | Fungsi | Primary key |
|---:|---|---|---|
| 1 | `Users` | Guru (admin) dan murid | `user_id` |
| 2 | `Classes` | Data kelas | `class_id` |
| 3 | `Subjects` | Daftar mapel milik guru/organisasi | `subject_id` |
| 4 | `Teaching_Assignments` | Relasi guru-kelas-mapel | `teaching_assignment_id` |
| 5 | `Enrollment` | Relasi murid-kelas (proses sama seperti v1) | `enroll_id` |
| 6 | `Topics` | Bab/topic pembelajaran | `topic_id` |
| 7 | `Items` | Materi, tugas, quiz, refleksi | `item_id` |
| 8 | `Progress` | Status progres murid | `progress_id` |
| 9 | `Quizzes` | Detail quiz | `quiz_id` |
| 10 | `Quiz_Questions` | Soal quiz | `question_id` |
| 11 | `Quiz_Submissions` | Jawaban quiz murid | `submission_id` |
| 12 | `Assignments` | Detail tugas | `assignment_id` |
| 13 | `Groups` | Kelompok tugas | `group_id` |
| 14 | `Group_Members` | Relasi murid-kelompok | `group_member_id` |
| 15 | `Submissions` | Pengumpulan tugas | `submission_id` |
| 16 | `Grades` | Nilai | `grade_id` |
| 17 | `Reflections` | Refleksi murid | `reflection_id` |
| 18 | `Notifications` | Notifikasi dalam aplikasi/email | `notif_id` |
| 19 | `Materi_AI` | Riwayat generate AI (sama seperti v1) | `ai_id` |
| 20 | `Permintaan_Reset` | Antrean lupa kata sandi (sama seperti v1) | `request_id` |
| 21 | `Session` | Sesi login (sama seperti v1) | `token` |
| 22 | `Counters` | Generator ID | `entity` |
| 23 | `Audit_Logs` | Audit perubahan dan aktivitas penting | `log_id` |

**Catatan:** `Enrollment`, `Teaching_Assignments`, dan `Group_Members` adalah sumber kebenaran relasi. Jangan mempertahankan kolom JSON Array lama sebagai sumber utama. `Audit_Logs` adalah sheet operasional; jika sekolah memilih log eksternal, sheet ini boleh diganti dengan layanan log yang setara setelah keputusan disetujui.

### 7.2 `Users`

Struktur sama seperti v1 (nama field mengikuti `Setup.gs` LessonLen).

| Field | Required | Keterangan |
|---|---:|---|
| `user_id` | ✅ | ID internal, misalnya `USR-0001` |
| `username` | ✅ | Identitas login, unik, normalized lowercase |
| `password_hash` | ✅ | SHA-256(salt + password) |
| `salt` | ✅ | Salt acak 16 karakter per user |
| `pwd_awal` | ❌ | Kata sandi sementara terakhir (tampil bagi guru sampai diganti) |
| `nama` | ✅ | Nama pengguna |
| `role` | ✅ | `guru`, `murid` |
| `rombel` | ❌ | Label rombongan belajar murid |
| `email` | ❌ | Email (murid diminta mengisi; dipakai pengajuan reset) |
| `nisn` | ❌ | NISN murid (boleh kosong, disimpan sebagai teks) |
| `no_wa` | ❌ | Nomor WA ternormalisasi `62xxxxxxxxxx` |
| `status` | ✅ | `aktif`, `nonaktif` |
| `harus_ganti_password` | ✅ | Paksa ganti kata sandi pada login berikutnya |
| `last_login` | ❌ | Login terakhir |
| `created_at` | ✅ | Waktu dibuat |
| `updated_at` | ✅ | Waktu diubah |

Tidak ada `google_sub` — identitas login adalah `username` + `password_hash`.

### 7.3 `Classes`

| Field | Required | Keterangan |
|---|---:|---|
| `class_id` | ✅ | ID kelas |
| `name` | ✅ | Nama kelas |
| `academic_year` | ✅ | Misalnya `2026/2027` |
| `status` | ✅ | `active`, `archived` |
| `created_at` | ✅ | Waktu dibuat |
| `updated_at` | ✅ | Waktu diubah |

`teacher_id`, `students`, `subject`, dan `subjects` tidak disimpan di sheet ini. Hubungan tersebut disimpan pada sheet relasi.

### 7.4 `Subjects`

| Field | Required | Keterangan |
|---|---:|---|
| `subject_id` | ✅ | ID mapel |
| `name` | ✅ | Nama mapel |
| `code` | ❌ | Kode mapel |
| `owner_teacher_id` | ✅ | Guru pemilik mapel, atau Admin jika global |
| `status` | ✅ | `active`, `inactive` |
| `created_at` | ✅ | Waktu dibuat |
| `updated_at` | ✅ | Waktu diubah |

Jika beberapa guru boleh menggunakan satu mapel global, ubah model menjadi mapel organisasi dan gunakan `Teaching_Assignments` sebagai sumber akses.

### 7.5 `Enrollment`

Proses enrollment **sama seperti v1**: guru mendaftarkan murid ke kelas; mendaftarkan ulang murid yang pernah keluar berarti mengaktifkan kembali baris lama, bukan membuat baris baru; `keluarkan()` mengubah status menjadi `keluar`; setelah enroll berhasil sistem mengirim notifikasi `enroll_kelas`.

| Field | Required | Keterangan |
|---|---:|---|
| `enroll_id` | ✅ | ID enrollment, misalnya `ENR-0001` |
| `class_id` | ✅ | Foreign key ke `Classes` |
| `user_id` | ✅ | Foreign key ke `Users` (murid) |
| `tanggal_daftar` | ✅ | Waktu didaftarkan |
| `status` | ✅ | `aktif`, `keluar` |

**Composite key:** `class_id + user_id` untuk enrollment aktif.

### 7.6 `Teaching_Assignments`

Sheet ini menggantikan `Classes.teacher_id` dan `Classes.subjects`.

| Field | Required | Keterangan |
|---|---:|---|
| `teaching_assignment_id` | ✅ | ID relasi |
| `class_id` | ✅ | Kelas |
| `teacher_id` | ✅ | Guru pengampu |
| `subject_id` | ✅ | Mapel |
| `academic_year` | ✅ | Tahun ajaran |
| `status` | ✅ | `active`, `inactive` |
| `created_at` | ✅ | Waktu dibuat |

**Composite key:** `class_id + teacher_id + subject_id + academic_year`.

Struktur ini mendukung:

- Satu guru mengajar banyak mapel di satu kelas.
- Banyak guru mengajar mapel berbeda di satu kelas.
- Satu guru mengajar mapel yang sama di beberapa kelas.

### 7.7 `Topics`

| Field | Required | Keterangan |
|---|---:|---|
| `topic_id` | ✅ | ID topic |
| `teaching_assignment_id` | ✅ | Relasi guru-kelas-mapel |
| `title` | ✅ | Judul topic |
| `description` | ❌ | Deskripsi topic |
| `status` | ✅ | `draft`, `publish`, `scheduled` (adendum 2026-09) |
| `publish_at` | ❌ | Jadwal terbit — wajib bila `scheduled` (adendum 2026-09) |
| `sort_order` | ✅ | Urutan dalam susunan course gabungan (adendum 2026-09) |
| `created_at` | ✅ | Waktu dibuat |
| `updated_at` | ✅ | Waktu diubah |

`teacher_id`, `class_id`, dan `subject_id` dapat diperoleh melalui `Teaching_Assignments`. Jika didenormalisasi untuk performa, nilainya harus diisi dan divalidasi server-side. Lihat juga **§7.8b** (adendum alur course 2026-09).

### 7.8 `Items`

| Field | Required | Keterangan |
|---|---:|---|
| `item_id` | ✅ | ID item |
| `topic_id` | ⚠️ kondisional | Topic induk — **wajib** untuk semua jenis KECUALI quiz/refleksi mandiri (adendum 2026-09) |
| `ta_id` | ⚠️ kondisional | Course (Teaching Assignment) — **wajib khusus item mandiri** (quiz/refleksi tanpa topik); kosong untuk item bertopik (adendum 2026-09) |
| `type` | ✅ | `materi`, `tugas_individu`, `tugas_kelompok`, `quiz`, `refleksi` |
| `title` | ✅ | Judul item |
| `description` | ❌ | Deskripsi/instruksi |
| `status` | ✅ | `draft`, `publish`, `scheduled` (adendum 2026-09) |
| `publish_at` | ❌ | Jadwal terbit — wajib bila `scheduled` (adendum 2026-09) |
| `related_id` | ❌ | ID quiz/tugas/refleksi |
| `sort_order` | ✅ | Urutan: dalam topik (item bertopik) atau susunan course gabungan (item mandiri) |
| `created_at` | ✅ | Waktu dibuat |
| `updated_at` | ✅ | Waktu diubah |

`related_id` adalah polymorphic relation sehingga validasinya wajib dilakukan oleh server berdasarkan `type`. Jika sistem membesar, gunakan field FK terpisah atau satu tabel aktivitas terpadu. Lihat juga **§7.8b** (adendum alur course 2026-09).

### 7.8b Alur course: item mandiri, jadwal terbit, susunan gabungan (ADENDUM 2026-09)

Keputusan yang disetujui pemilik proyek saat porting UI/UX v1 → v2
(diimplementasikan pada commit tahap 4.6–4.8 `v2/`):

1. **Quiz & refleksi mandiri.** Sesuai alur v1, quiz/refleksi dapat
   berdiri LANGSUNG di course tanpa topik (materi & tugas tetap wajib
   bertopik). Item mandiri menulis `ta_id` dan membiarkan `topic_id`
   kosong; server menolak jenis lain yang mencoba mandiri.
2. **View/hide.** Istilah untuk guru: 👁 *terlihat* / 🙈 *draf* —
   padatan langsung `publish` / `draft`. Menyembunyikan item yang
   terjadwal sekaligus membatalkan jadwalnya (`publish_at` dikosongkan).
3. **Jadwal terbit (`scheduled` + `publish_at`).** Item/topik otomatis
   terlihat murid TEPAT pada waktunya — dievaluasi saat murid membuka
   (lazy, `Util.terlihatMurid`), TANPA trigger waktu Apps Script dan
   TANPA notifikasi. Notifikasi `pertemuan_baru` hanya untuk publish
   eksplisit (seketika), seperti semula.
4. **Satu susunan course gabungan.** Topik dan item mandiri berbagi
   satu daftar bernomor per course (`sort_order` bersama; baris baru
   selalu di dasar). `coursePindah(token, jenis, id, arah)` menukar
   baris dengan tetangganya lintas sheet lalu menomori ulang 1..N.
   Item bertopik diurut di dalam topiknya (`itemPindah`), bukan di
   tingkat course.
5. **Murid melihat urutan campuran yang sama** dengan guru:
   `topikKelasSaya` mengembalikan `topik[]`, `mandiri[]`, `item[]`
   per topik (semua tanpa konten) plus `urutan[]` — susunan gabungan
   yang difilter hanya baris yang terlihat saat itu. Draf dan
   terjadwal-pra-waktu tidak pernah bocor ke murid.
6. **Migrasi.** DB lama menyesuaikan lewat `migrasiStruktur()`
   (menambah kolom `Topics.publish_at`, `Items.publish_at`,
   `Items.ta_id`; data lama utuh).

### 7.9 `Progress`

| Field | Required | Keterangan |
|---|---:|---|
| `progress_id` | ✅ | ID progres |
| `user_id` | ✅ | Murid |
| `item_id` | ✅ | Item |
| `status` | ✅ | `completed`, `not_completed` |
| `completed_at` | ❌ | Waktu selesai |
| `updated_at` | ✅ | Waktu update |

**Composite key:** `user_id + item_id`.

Absence of row dapat dianggap `not_completed`, tetapi menyimpan row eksplisit diperbolehkan jika laporan membutuhkan status awal. Pilih satu aturan dan gunakan konsisten.

### 7.10 `Quizzes`

| Field | Required | Keterangan |
|---|---:|---|
| `quiz_id` | ✅ | ID quiz |
| `item_id` | ✅ | Item quiz |
| `deadline` | ✅ | Batas waktu |
| `max_attempts` | ✅ | Default 1 |
| `show_score` | ✅ | Apakah nilai langsung terlihat |
| `status` | ✅ | `active`, `inactive` |
| `created_at` | ✅ | Waktu dibuat |
| `updated_at` | ✅ | Waktu diubah |

### 7.11 `Quiz_Questions`

| Field | Required | Keterangan |
|---|---:|---|
| `question_id` | ✅ | ID soal |
| `quiz_id` | ✅ | Quiz induk |
| `order_no` | ✅ | Urutan soal |
| `type` | ✅ | `pg`, `true_false`, `short_answer`, `essay` |
| `question` | ✅ | Isi soal |
| `options_json` | ❌ | Pilihan jawaban |
| `answer_key` | ❌ | Jawaban benar, tidak dikirim ke siswa |
| `rubric` | ❌ | Pedoman penilaian uraian |
| `points` | ✅ | Bobot soal |

`answer_key` tidak boleh masuk response endpoint siswa.

### 7.12 `Quiz_Submissions`

| Field | Required | Keterangan |
|---|---:|---|
| `submission_id` | ✅ | ID submission |
| `quiz_id` | ✅ | Quiz |
| `user_id` | ✅ | Murid |
| `answers_json` | ✅ | Jawaban siswa |
| `submitted_at` | ✅ | Waktu submit server |
| `status` | ✅ | `submitted`, `graded` |
| `score` | ❌ | Nilai otomatis/manual |
| `graded_at` | ❌ | Waktu nilai |

**Composite key:** `quiz_id + user_id + attempt_no` sesuai kebijakan resubmission. Waktu submit ditentukan server, bukan client.

### 7.13 `Assignments`

| Field | Required | Keterangan |
|---|---:|---|
| `assignment_id` | ✅ | ID tugas |
| `item_id` | ✅ | Item tugas |
| `type` | ✅ | `individual`, `group` |
| `instructions` | ❌ | Instruksi |
| `deadline` | ✅ | Batas waktu |
| `template_file_id` | ❌ | File template Drive |
| `allow_resubmit` | ✅ | Izin kirim ulang |
| `status` | ✅ | `active`, `inactive` |
| `created_at` | ✅ | Waktu dibuat |
| `updated_at` | ✅ | Waktu diubah |

### 7.14 `Groups`

| Field | Required | Keterangan |
|---|---:|---|
| `group_id` | ✅ | ID kelompok |
| `assignment_id` | ✅ | Tugas kelompok |
| `name` | ✅ | Nama kelompok |
| `leader_id` | ✅ | Ketua kelompok |
| `status` | ✅ | `active`, `inactive` |
| `created_at` | ✅ | Waktu dibuat |
| `updated_at` | ✅ | Waktu diubah |

### 7.15 `Group_Members`

| Field | Required | Keterangan |
|---|---:|---|
| `group_membership_id` | ✅ | ID relasi |
| `group_id` | ✅ | Kelompok |
| `user_id` | ✅ | Murid |
| `status` | ✅ | `active`, `inactive` |
| `joined_at` | ✅ | Waktu bergabung |

**Composite key:** `group_id + user_id` untuk membership aktif.

### 7.16 `Submissions`

| Field | Required | Keterangan |
|---|---:|---|
| `submission_id` | ✅ | ID submission |
| `assignment_id` | ✅ | Tugas |
| `group_id` | ❌ | Diisi untuk tugas kelompok |
| `user_id` | ✅ | Pengirim atau ketua kelompok |
| `file_id` | ❌ | File Drive yang divalidasi |
| `submitted_url` | ❌ | URL jika MVP menerima link |
| `attempt_no` | ✅ | Nomor percobaan |
| `submitted_at` | ✅ | Waktu server |
| `status` | ✅ | `submitted`, `graded`, `returned` |
| `updated_at` | ✅ | Waktu update |

Aturan unique harus berbeda untuk tugas individu dan kelompok:

```text
Individual: assignment_id + user_id + attempt_no
Group:     assignment_id + group_id + attempt_no
```

### 7.17 `Grades`

| Field | Required | Keterangan |
|---|---:|---|
| `grade_id` | ✅ | ID nilai |
| `item_id` | ✅ | Item sumber nilai |
| `source_type` | ✅ | `quiz`, `assignment`, `reflection`, `manual` |
| `source_id` | ✅ | ID submission/aktivitas |
| `user_id` | ✅ | Siswa yang menerima nilai |
| `group_id` | ❌ | Untuk nilai kelompok |
| `score` | ✅ | Nilai, dapat decimal |
| `max_score` | ✅ | Nilai maksimum |
| `notes` | ❌ | Catatan guru |
| `graded_by` | ✅ | Guru/admin penilai |
| `graded_at` | ✅ | Waktu penilaian |
| `updated_at` | ✅ | Waktu update |

`subject_id`, `class_id`, dan `teacher_id` tidak perlu disimpan ulang karena dapat diturunkan dari `item_id`. Jika disimpan untuk performa laporan, server harus menjaga konsistensinya.

### 7.18 `Reflections`

| Field | Required | Keterangan |
|---|---:|---|
| `reflection_id` | ✅ | ID refleksi |
| `item_id` | ✅ | Item refleksi |
| `user_id` | ✅ | Murid |
| `content` | ✅ | Isi refleksi |
| `created_at` | ✅ | Waktu dibuat |
| `updated_at` | ✅ | Waktu diubah |

**Composite key:** `item_id + user_id` jika satu refleksi per item diperbolehkan.

### 7.19 `Notifications`

| Field | Required | Keterangan |
|---|---:|---|
| `notification_id` | ✅ | ID notifikasi |
| `user_id` | ✅ | Penerima |
| `entity_type` | ✅ | `quiz`, `assignment`, `grade`, `announcement` |
| `entity_id` | ❌ | ID aktivitas |
| `type` | ✅ | Jenis notifikasi |
| `channel` | ✅ | `in_app`, `email`, `wa` |
| `title` | ✅ | Judul |
| `message` | ✅ | Isi |
| `is_read` | ✅ | Boolean |
| `dedupe_key` | ✅ | Kunci anti-notifikasi duplikat |
| `sent_at` | ❌ | Waktu email/WA dikirim |
| `created_at` | ✅ | Waktu dibuat |

`dedupe_key` wajib digunakan untuk mencegah trigger harian mengirim notifikasi yang sama berulang kali.

Contoh:

```text
user_id + entity_type + entity_id + type + deadline_date
```

### 7.20 `Session`

Sama seperti v1 — token disimpan utuh (bukan hash), dicabut dengan menghapus barisnya.

```text
token       token sesi acak 32 karakter (primary key)
user_id     pemilik sesi
dibuat_at   waktu dibuat
expired_at  batas kedaluwarsa (12 jam)
```

CacheService menyimpan snapshot `sesi_<token>` selama 1 jam untuk mempercepat validasi; cache tidak pernah menjadi satu-satunya sumber kebenaran.

### 7.20A `Materi_AI`

Riwayat generate AI — sama seperti v1 (`materi_ai`):

```text
ai_id, item_id, class_id, prompt_ringkas, konten_hasil,
saran_soal, saran_lkpd, model, key_index, token_terpakai,
durasi_ms, status (sukses/gagal/antre), error, dibuat_at
```

Key TIDAK PERNAH dicatat — hanya indeksnya (`key_index`, mis. `key#3`).

### 7.20B `Permintaan_Reset`

Antrean lupa kata sandi — sama seperti v1 (`permintaan_reset`):

```text
request_id, user_id, input_user, status (antre/selesai/kedaluwarsa),
dibuat_at, diproses_at
```

### 7.21 `Counters`

```text
entity
last_number
```

Generator ID harus menggunakan lock (`LockService`) dan update counter atomik. Prefix ID konsisten format `<PREFIX>-0000`:

```text
USR-0001   user
KLS-0001   class
SBK-0001   subject (mapel)
TA-0001    teaching assignment
ENR-0001   enrollment
TPC-0001   topic
ITM-0001   item
PRG-0001   progress
QIZ-0001   quiz
QQA-0001   quiz question
QSB-0001   quiz submission
ASG-0001   assignment
KLP-0001   kelompok
KLM-0001   anggota kelompok
SBM-0001   submission tugas
GRD-0001   grade
RFL-0001   refleksi
NTF-0001   notifikasi
AIG-0001   riwayat AI
RST-0001   permintaan reset
LOG-0001   audit log
```

---

### 7.22 `Audit_Logs`

Sheet ini menyimpan aktivitas penting untuk troubleshooting, keamanan, dan
rekonsiliasi data. Audit log bukan tempat menyimpan token atau data rahasia.

| Field | Required | Keterangan |
|---|---:|---|
| `log_id` | ✅ | ID audit |
| `request_id` | ✅ | ID korelasi request |
| `user_id` | ❌ | Pengguna terkait |
| `role_snapshot` | ❌ | Role saat aksi terjadi |
| `action` | ✅ | `LOGIN`, `CREATE`, `UPDATE`, `DELETE`, `SUBMIT`, `GRADE` |
| `entity_type` | ✅ | Jenis objek |
| `entity_id` | ❌ | ID objek |
| `result` | ✅ | `SUCCESS` atau `FAILURE` |
| `detail_json` | ❌ | Detail non-rahasia |
| `created_at` | ✅ | Waktu server |

Audit log harus ditulis secara ringkas. Raw session token, API key Gemini,
kata sandi (termasuk hash/salt), dan isi data sensitif yang tidak diperlukan
tidak boleh dicatat.

---

## 8. Kebutuhan Fungsional

### 8.1 Manajemen pengguna

| ID | Fitur | Aktor |
|---|---|---|
| FR-001 | Login/logout nama pengguna + kata sandi | Semua pengguna |
| FR-002 | Ganti kata sandi mandiri | Semua pengguna |
| FR-003 | Ajukan lupa kata sandi (tanpa login) | Murid |
| FR-004 | Reset kata sandi murid (sandi sementara tampil sekali) | Guru |
| FR-005 | Menambah murid manual / import upsert | Guru |
| FR-006 | Melihat profil & biodata | Semua pengguna |
| FR-007 | Menonaktifkan murid | Guru |

### 8.2 Mata pelajaran, kelas, dan relasi pengajaran

| ID | Fitur | Aktor |
|---|---|---|
| FR-010 | Membuat kelas | Guru |
| FR-011 | Mengarsipkan kelas | Guru |
| FR-012 | Mendaftarkan murid melalui `Enrollment` | Guru |
| FR-013 | Melihat anggota kelas | Guru/Murid sesuai akses |
| FR-014 | Membuat/mengelola mapel | Guru |
| FR-015 | Menugaskan guru-mapel-kelas | Guru |
| FR-016 | Mendukung banyak mapel dalam satu kelas | Sistem |
| FR-017 | Filter aktivitas berdasarkan mapel | Guru/Murid |

### 8.3 Topic dan item

| ID | Fitur | Aktor |
|---|---|---|
| FR-020 | Membuat topic | Guru |
| FR-021 | Mengedit topic | Guru |
| FR-022 | Menghapus/mengarsipkan topic | Guru |
| FR-023 | Membuka/menutup topic | Guru |
| FR-024 | Membuat item | Guru |
| FR-025 | Mengedit item | Guru |
| FR-026 | Menghapus/mengarsipkan item | Guru |
| FR-027 | Membuka/menutup item | Guru |

### 8.4 Materi dan progres

| ID | Fitur | Aktor |
|---|---|---|
| FR-030 | Melihat materi yang boleh diakses | Murid |
| FR-031 | Menandai item selesai | Murid |
| FR-032 | Melihat progres per topic/mapel/kelas | Guru |
| FR-033 | Melihat progres pribadi | Murid |

### 8.5 Tugas individu dan kelompok

| ID | Fitur | Aktor |
|---|---|---|
| FR-040 | Membuat tugas individu | Guru |
| FR-041 | Membuat tugas kelompok | Guru |
| FR-042 | Menyediakan template Drive | Guru |
| FR-043 | Melihat instruksi dan template | Murid |
| FR-044 | Mengirim link/file submission | Murid |
| FR-045 | Membuat kelompok | Guru |
| FR-046 | Menentukan ketua kelompok | Guru |
| FR-047 | Submit hanya oleh ketua | Sistem |
| FR-048 | Menilai tugas individu/kelompok | Guru |
| FR-049 | Mengizinkan atau menolak resubmit | Guru |

### 8.6 Quiz

| ID | Fitur | Aktor |
|---|---|---|
| FR-060 | Membuat quiz | Guru |
| FR-061 | Menambah dan mengurutkan soal | Guru |
| FR-062 | Menampilkan soal tanpa answer key | Sistem |
| FR-063 | Mengerjakan quiz | Murid |
| FR-064 | Submit quiz dengan validasi deadline | Murid/Sistem |
| FR-065 | Auto-grade PG dan benar-salah | Sistem |
| FR-066 | Menilai jawaban singkat/uraian | Guru/Sistem sesuai aturan |
| FR-067 | Mencegah submit duplikat | Sistem |

### 8.7 Refleksi, nilai, laporan, dan notifikasi

| ID | Fitur | Aktor |
|---|---|---|
| FR-070 | Menulis refleksi | Murid |
| FR-071 | Melihat refleksi | Guru |
| FR-080 | Rekap progres kelas | Guru |
| FR-081 | Rekap nilai kelas | Guru |
| FR-082 | Melihat nilai pribadi | Murid |
| FR-083 | Filter laporan per kelas/mapel/topic | Guru |
| FR-084 | Rekap semua guru | Admin |
| FR-090 | Notifikasi deadline in-app | Sistem |
| FR-091 | Email notifikasi terbatas | Sistem |
| FR-092 | Menandai notifikasi dibaca | Pengguna |

### 8.8 Admin dan operasional (dipegang guru)

| ID | Fitur | Aktor |
|---|---|---|
| FR-100 | Menambah/nonaktifkan akun guru lain | Guru |
| FR-101 | Backup database | Guru |
| FR-102 | Melihat metrik pemakaian internal | Guru |
| FR-103 | Melihat log error dan eksekusi | Guru |
| FR-104 | Menjalankan pemeriksaan integritas data | Guru |

### 8.9 Generator AI (sama seperti v1)

| ID | Fitur | Aktor |
|---|---|---|
| FR-110 | Menyimpan & merotasi API key Gemini (≤10, Script Properties) | Guru |
| FR-111 | Generate draf materi dari konteks kelas/topic/item | Guru |
| FR-112 | Generate draf LKPD/kegiatan individu & kelompok | Guru |
| FR-113 | Generate pertanyaan refleksi | Guru |
| FR-114 | Generate soal (pg/benar-salah/isian/esai, maks 20 sekali generate) | Guru |
| FR-115 | Generate kerangka topic+pertemuan+item | Guru |
| FR-116 | Semua hasil AI berstatus DRAFT hingga ditinjau (`ai_ditinjau`) | Sistem |
| FR-117 | Riwayat generate tercatat di `Materi_AI` tanpa menyimpan key | Sistem |

---

## 9. Alur Kerja Utama

### 9.1 Guru menambah murid & reset kata sandi

```text
Guru login
→ buka halaman Kelola Murid
→ isi nama/username/rombel (atau import massal)
→ server membuat Users role murid + kata sandi sementara
→ sandi sementara tampil di daftar murid sampai diganti
→ murid login → dipaksa ganti kata sandi → melengkapi biodata (email + no WA)
```

Alur lupa kata sandi: murid mengajukan dari layar login → `Permintaan_Reset` → notifikasi guru → guru mereset → sandi sementara tampil sekali. Tidak ada pembuatan project atau spreadsheet baru.

### 9.2 Guru membuat kelas dan penugasan mapel

```text
Guru membuat kelas
→ memilih mapel
→ server membuat Teaching_Assignment
→ guru dapat mendaftarkan murid melalui Enrollment
→ guru membuat topic di bawah Teaching_Assignment
```

### 9.3 Import siswa

Import harus menggunakan aturan upsert:

1. Normalisasi email.
2. Cari `Users` berdasarkan email.
3. Jika belum ada, buat siswa baru.
4. Jika sudah ada, jangan membuat user duplikat.
5. Buat baris `Enrollment` baru, atau aktifkan kembali baris `keluar`.
6. Validasi NISN sesuai kebijakan sekolah.
7. Catat baris yang gagal dan alasannya.

### 9.4 Membuat topic dan item

```text
Guru memilih Teaching_Assignment
→ membuat topic
→ server memvalidasi bahwa guru memiliki assignment tersebut
→ guru menambah item
→ item mewarisi relasi mapel/kelas melalui topic
```

### 9.5 Submit quiz

Server wajib memeriksa ulang:

- Session aktif.
- Siswa anggota kelas.
- Item dan quiz berstatus aktif/open.
- Deadline belum lewat.
- Jumlah attempt belum melebihi batas.
- Soal berasal dari quiz yang benar.
- Jawaban tidak memuat field yang tidak dikenal.
- Submission belum tersimpan untuk composite key yang sama.

Setelah lolos validasi, simpan submission dan progres secara idempotent dalam critical section.

### 9.6 Submit tugas

MVP menggunakan alur sederhana:

```text
Guru mengunggah/menentukan template
→ siswa membuka template
→ siswa membuat salinan atau mengerjakan file yang disediakan
→ siswa mengirim file_id atau link
→ server memvalidasi format dan relasi file sesuai kebijakan
→ submission disimpan
```

Jika belum dapat memvalidasi ownership file, sistem harus menandai submission sebagai `pending_verification`, bukan langsung menganggap aman.

### 9.7 Tugas kelompok

```text
Guru membuat assignment group
→ membuat Groups
→ menambah Group_Members
→ menentukan leader_id
→ semua anggota dapat melihat tugas
→ hanya leader yang dapat submit
→ nilai dapat diterapkan ke semua anggota atau diubah individual
```

### 9.8 Notifikasi deadline

Time-driven trigger dijalankan secara berkala, tetapi tidak dianggap tepat pada menit tertentu.

Proses:

```text
Trigger harian
→ cari quiz/tugas dengan deadline mendekat
→ cari penerima yang berhak
→ cek dedupe_key
→ buat Notifications
→ kirim email jika kuota cukup
→ simpan status pengiriman
```

Jika email gagal atau kuota habis, notifikasi in-app tetap dibuat.

---

## 10. Google Drive dan File

### 10.1 Struktur Drive

```text
LMS_Utama/
├── Guru_[id]/
│   ├── Kelas_[id]/
│   │   ├── Template/
│   │   ├── Submissions/
│   │   └── Materials/
```

Folder per guru/kelas hanya membantu kerapian. Folder tersebut bukan pengganti authorization aplikasi.

### 10.2 Aturan file

- Database menyimpan `file_id`, bukan hanya URL.
- Server mengambil metadata file berdasarkan ID.
- Server memeriksa nama, mime type, parent folder, dan status file sesuai kebutuhan.
- File template tidak boleh otomatis diberi akses edit kepada semua pengguna.
- Database dan folder induk tidak dibagikan langsung kepada siswa.
- Pembuatan salinan file oleh server dilakukan di luar lock database.
- Bila ownership file tidak dapat divalidasi, submission harus masuk status review.

`DriveApp` mendukung operasi seperti `makeCopy()` untuk membuat salinan file. [Dokumentasi Drive File](https://developers.google.com/apps-script/reference/drive/file)

### 10.3 Import CSV/Excel

- CSV: dapat diunggah dari form HTML dan diproses server.
- Excel: dapat diunggah ke Drive lalu dikonversi, atau diproses dengan library/API tambahan.
- Batas ukuran file dan lama proses harus diuji.
- Import besar harus diproses dalam batch dan tidak dilakukan di dalam lock global.

---

## 11. Concurrency, Locking, dan Idempotency

### 11.1 Operasi yang menggunakan lock

Gunakan `LockService.getScriptLock()` untuk critical section pendek:

- Membuat ID dari `Counters`.
- Check-then-insert submission.
- Update progress.
- Update membership.
- Update group membership.
- Membuat session/revoke session.
- Menghapus mapel setelah pengecekan relasi.

### 11.2 Pola implementasi

```text
Siapkan input dan validasi format di luar lock
→ acquire ScriptLock
→ baca ulang data terbaru
→ validasi ownership/composite key
→ tulis batch perubahan
→ release lock dalam finally
→ lakukan Drive/email di luar lock
```

### 11.3 Idempotency

Lock saja tidak cukup. Setiap operasi submit harus memiliki aturan idempotent. Misalnya:

```text
quiz_id + user_id + attempt_no
assignment_id + user_id + attempt_no
assignment_id + group_id + attempt_no
user_id + item_id
class_id + user_id
```

Jika request diulang karena retry, server mengembalikan hasil submission sebelumnya atau pesan yang aman, bukan membuat row duplikat.

### 12 Retry client

`google.script.run` adalah asynchronous dan pemanggilan dapat berjalan tidak sesuai urutan jika dipanggil bersamaan. API tersebut juga membatasi maksimal 10 call bersamaan dari satu halaman. [Dokumentasi google.script.run](https://developers.google.com/apps-script/guides/html/communication)

Client harus:

- Menampilkan loading state.
- Menonaktifkan tombol submit selama request berjalan.
- Menggunakan `withSuccessHandler()` dan `withFailureHandler()`.
- Retry paling banyak 1–2 kali untuk error sementara.
- Menggunakan random backoff.
- Tidak mengulang operasi submit tanpa idempotency key.

---

## 12. Kuota dan Performa

### 12.1 Kuota yang perlu diperhatikan

Menurut dokumentasi kuota Apps Script, batas yang relevan mencakup:

- Runtime 6 menit per eksekusi.
- 30 eksekusi simultan per user.
- 1.000 eksekusi simultan per script.
- Email recipient per hari: 100 untuk consumer account dan 1.500 untuk Workspace account.
- UrlFetch per hari: 20.000 untuk consumer account dan 100.000 untuk Workspace account.

Kuota dapat berubah. [Dokumentasi Quota Apps Script](https://developers.google.com/apps-script/guides/services/quotas)

Karena Web App dijalankan sebagai Admin, penggunaan layanan akan terkonsentrasi pada akun eksekusi tersebut. Jumlah guru bukan unit isolasi kuota.

### 12.2 Monitoring yang realistis

Dashboard Admin boleh menampilkan:

- Total request aplikasi yang dicatat sistem.
- Total email yang dicoba/dikirim.
- Sisa email melalui `MailApp.getRemainingDailyQuota()`.
- Jumlah error.
- Durasi fungsi yang dicatat sendiri.
- Jumlah UrlFetch yang dicatat wrapper aplikasi.
- Jumlah request per role/guru untuk observasi internal.

Dashboard tidak boleh mengklaim mengetahui secara akurat:

- Kuota UrlFetch resmi yang tersisa.
- Kuota Apps Script resmi per guru.
- Kuota eksekusi resmi yang digunakan setiap guru.
- Isolasi kuota antar-guru.

### 12.3 Strategi performa

- Baca range besar satu kali, lalu filter di memory.
- Tulis dalam batch.
- Hindari `getRange()` dan `setValue()` berulang-ulang.
- Gunakan header map, bukan nomor kolom hardcode.
- Cache data referensi yang jarang berubah.
- Jangan memuat seluruh database untuk setiap halaman siswa.
- Gunakan filter `class_id`, `teaching_assignment_id`, atau `user_id` sedini mungkin.
- Jangan membuat file Drive dan mengirim email dalam lock.
- Batasi polling; refresh manual adalah default MVP.

Untuk target 1–10 guru, arsitektur ini layak diuji. Namun, angka tersebut bukan jaminan performa. Lakukan load test dengan skenario 30–50 siswa mengirim request pada waktu berdekatan.

---

## 13. Email dan WhatsApp

### 13.1 Email

Email digunakan untuk:

- Undangan guru.
- Notifikasi deadline penting.
- Pemberitahuan nilai jika diperlukan.

Prioritas notifikasi:

1. Simpan notifikasi in-app.
2. Kirim email jika kuota tersedia.
3. Jika kuota tidak tersedia, jangan membuat request berulang tanpa batas.
4. Simpan status kegagalan.

Untuk pengiriman sederhana, `MailApp` dapat dipilih karena dapat mengembalikan sisa recipient email. [Dokumentasi MailApp](https://developers.google.com/apps-script/reference/mail/mail-app)

### 13.2 WhatsApp

WhatsApp ditunda dari MVP inti. Implementasi berikutnya memerlukan:

- Meta WhatsApp Business API atau provider seperti Twilio.
- Token API di Script Properties.
- Template message jika diwajibkan.
- Opt-in pengguna.
- Penanganan retry dan rate limit.
- Anggaran provider.
- Pengamanan nomor telepon siswa.

---

## 14. Keamanan dan Privasi

Data yang disimpan mencakup nama, email, NISN, nomor telepon, progres, refleksi, dan nilai. Karena itu:

- Spreadsheet database hanya dimiliki/diakses guru/pemilik.
- Kata sandi hanya disimpan sebagai hash + salt; kata sandi sementara tidak dikirim lewat email/WhatsApp otomatis.
- Token sesi tidak dituliskan permanen di URL.
- Jangan menaruh secret API (mis. `GEMINI_KEYS`) di HTML atau JavaScript client.
- Semua input pengguna divalidasi server-side.
- Semua output teks pengguna di-escape untuk mencegah XSS.
- Isi refleksi dan deskripsi tidak boleh dimasukkan langsung ke `innerHTML` tanpa sanitasi.
- File upload dan link submission harus divalidasi.
- Aktifkan 2-Step Verification pada akun Admin.
- Sediakan akun pemulihan/administrator cadangan.
- Lakukan backup rutin dan uji restore.
- Simpan log audit untuk perubahan role, nilai, dan penghapusan data.
- Tentukan kebijakan retensi data siswa.
- Jangan membagikan database melalui link “Anyone with the link”.

Soft delete adalah default. Penghapusan permanen hanya boleh dilakukan oleh Admin setelah konfirmasi dan backup.

---

## 15. UI/UX Utama

### 15.1 Dashboard Guru (admin)

- Ringkasan jumlah murid/kelas/mapel.
- Daftar murid aktif/nonaktif + permintaan reset kata sandi.
- Monitoring error dan metrik sistem.
- Status backup terakhir.
- Rekap progres/nilai dengan filter kelas dan mapel.

### 15.2 Dashboard Guru

- Pilihan kelas dan teaching assignment.
- Daftar topic per mapel.
- Ringkasan jumlah siswa, progres, dan nilai.
- Menu kelas, siswa, mapel, topic, item, tugas, quiz, kelompok, refleksi, progres, nilai.

### 15.3 Dashboard Siswa

- Daftar kelas aktif.
- Filter mapel.
- Topic dan item yang berstatus open.
- Progress pribadi.
- Tugas/quiz yang mendekati deadline.
- Nilai yang sudah dipublikasikan.

### 15.4 Prinsip frontend

- Gunakan Bootstrap atau CSS lokal/HTTPS.
- Semua pemanggilan `google.script.run` asynchronous.
- Tampilkan spinner dan pesan error yang ramah.
- Jangan mengirim answer key quiz ke client.
- Jangan menaruh role sebagai satu-satunya sumber keputusan UI.
- UI boleh menyembunyikan tombol, tetapi server tetap wajib menolak request ilegal.

Apps Script HTML Service berjalan dalam iframe sandbox. Navigasi top-level harus menggunakan link/tombol dengan aktivasi pengguna, dan resource aktif harus diakses melalui HTTPS. [Dokumentasi HTML Service Restrictions](https://developers.google.com/apps-script/guides/html/restrictions)

---

## 16. Backup, Audit, dan Operasional

### 16.1 Backup

- Backup database tunggal secara mingguan.
- Backup tambahan sebelum perubahan schema besar.
- Simpan timestamp, file ID, dan status backup.
- Uji restore secara berkala.
- Pastikan backup tidak berada hanya pada akun Admin yang sama jika risiko kehilangan akun menjadi perhatian.

### 16.2 Audit log

MVP minimal mencatat:

- Login berhasil/gagal.
- Perubahan role/status.
- Pembuatan dan penghapusan topic/item.
- Perubahan nilai.
- Submit dan resubmit.
- Perubahan membership kelas/kelompok.
- Aksi Admin.

Jika audit log akan dibuat sebagai sheet tambahan, masukkan secara resmi ke schema; jangan menulis log secara informal ke sheet produksi tanpa kebijakan retensi.

### 16.3 Trigger

Trigger yang diperlukan:

- Pembersihan session kedaluwarsa.
- Notifikasi deadline.
- Backup terjadwal, jika dipilih.
- Rekonsiliasi data opsional.

Trigger harus idempotent dan tidak mengirim notifikasi yang sama berulang kali.

---

## 17. Roadmap Implementasi Revisi

### Tahap 0 — Finalisasi keputusan teknis

- Tetapkan apakah satu kelas boleh diajar beberapa guru.
- Tetapkan aturan siswa dapat berada di banyak kelas atau tidak.
- Tetapkan aturan resubmit.
- Tetapkan ownership file Drive.
- Tetapkan kebijakan data pribadi dan retensi.
- Tetapkan kebijakan kata sandi (panjang minimal, rotasi, sandi sementara).

### Tahap 1 — Fondasi

- Buat Apps Script project dan Spreadsheet 23 sheet.
- Isi konfigurasi header dan Spreadsheet ID.
- Buat folder Drive induk.
- Buat repository baca/tulis batch.
- Buat `Counters` dan `withScriptLock()`.
- Buat logging dasar.

### Tahap 2 — Autentikasi dan authorization

- Implementasi `Auth.gs` v1: login username+kata sandi, hash+salt.
- Implementasi kunci otomatis 5×/15 menit.
- Implementasi `Session` + cache sesi.
- Implementasi ganti/lupa/reset kata sandi.
- Implementasi `requireSession()` dan helper authorization.
- Uji akses dengan dua guru dan dua kelas.

### Tahap 3 — Fitur inti guru/siswa

- Classes.
- Users/import siswa.
- Enrollment.
- Subjects.
- Teaching_Assignments.
- Topics.
- Items.
- Progress.

### Tahap 4 — Quiz dan laporan

- Quiz PG dan benar-salah terlebih dahulu.
- Submit dengan deadline dan idempotency.
- Auto-grading.
- Grades.
- Rekap progres dan nilai.

### Tahap 5 — Tugas dan refleksi

- Tugas dengan template Drive.
- Submission link/file.
- Penilaian manual.
- Reflections.
- Group dan Group_Members.

### Tahap 6 — Notifikasi, backup, dan hardening

- Notifications in-app.
- Email terbatas.
- Trigger dedupe.
- Backup.
- Audit log.
- Error handling.
- Load test.
- Security test.

### Tahap 7 — Pilot

Target pilot:

- 1–2 guru.
- 1–2 kelas.
- 20–50 siswa.
- Minimal 2 minggu.

Ukuran keberhasilan pilot:

- Login stabil.
- Tidak ada kebocoran lintas-guru.
- Tidak ada submission duplikat.
- Progres dan nilai dapat direkonsiliasi.
- Guru dapat melakukan tugas utama tanpa bantuan developer.

Fitur WhatsApp dan otomatisasi copy file siswa hanya ditambahkan setelah pilot berhasil.

---

## 18. Rencana Pengujian

### 18.1 Functional test

- Login guru/murid.
- Login dengan akun yang tidak terdaftar.
- 5× gagal dalam 15 menit → akun terkunci 15 menit.
- Reset kata sandi murid oleh guru (sandi sementara tampil sekali).
- Lupa kata sandi: rate limit 3/24 jam, notifikasi guru.
- Logout dan session kedaluwarsa.
- Tambah/nonaktifkan pengguna.
- Import siswa duplikat.
- Buat kelas dan membership.
- Banyak mapel dalam satu kelas.
- Topic/item buka-tutup.
- Tandai progres dua kali.
- Submit quiz bersamaan.
- Submit setelah deadline.
- Submit tugas individu/kelompok.
- Ketua dan bukan ketua kelompok.
- Nilai dan koreksi nilai.
- Filter laporan.
- Notifikasi dedupe.
- Backup dan restore.

### 18.2 Security test

- Modifikasi `user_id` pada request.
- Modifikasi `teacher_id` pada request.
- Akses topic milik guru lain.
- Akses kelas yang bukan membership siswa.
- Akses `answer_key` quiz.
- Submit file milik pengguna lain.
- Token sesi palsu/dipalsukan.
- Murid memanggil API khusus guru (reset kata sandi, generate AI).
- User enumeration lewat pesan login/lupa kata sandi.
- XSS pada nama, deskripsi, dan refleksi.
- Direct sharing database.

### 18.3 Load test

- 30–50 submit berdekatan.
- Banyak halaman dashboard dibuka serentak.
- Import 500 siswa.
- Rekap progres dengan puluhan ribu row.
- Trigger deadline untuk ratusan siswa.
- Cache miss pada session.

---

## 19. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Kebocoran data antar-guru | Kritis | Authorization terpusat, test dua tenant, database tidak dibagikan |
| Kata sandi lemah/bocor | Tinggi | Kebijakan sandi (minimal 6 karakter huruf+angka), salt per user, kunci otomatis 5×/15 menit, wajib ganti sandi sementara, reset hanya oleh guru |
| Akun pemilik hilang/terkunci | Kritis | 2FA pada akun Google pemilik, `resetGuruDarurat()` dari editor, akun guru cadangan, backup lintas akun |
| Kuota email habis | Sedang | In-app notification, batching, cek remaining quota |
| Sheet lambat | Sedang | Batch read/write, filter awal, cache, load test |
| Race condition submission | Tinggi | Script lock, composite key, idempotency |
| File submission palsu | Tinggi | Validasi file ID/metadata, status pending review |
| Notifikasi duplikat | Sedang | `dedupe_key` dan status pengiriman |
| Trigger tidak tepat waktu | Rendah/sedang | Tampilkan waktu perkiraan dan gunakan in-app notification |
| Data JSON rusak | Sedang | Hilangkan JSON Array untuk relasi inti |
| Perubahan schema sulit | Sedang | Header registry, migration script, versioning |
| WhatsApp gagal/berbiaya | Rendah untuk MVP | Tunda dari MVP, gunakan email/in-app |

---

## 20. Metrik Keberhasilan MVP

| Metrik | Target |
|---|---:|
| Guru pilot berhasil login | 100% |
| Siswa pilot berhasil login | ≥95% |
| Kebocoran data lintas-guru | 0 |
| Submission duplikat | 0 |
| Error kritis pada alur utama | 0 |
| Response halaman normal | ≤2–3 detik pada dataset pilot |
| Rata-rata progres siswa | Diukur setelah periode belajar |
| Email gagal karena kuota | Dipantau dan dilaporkan |
| Backup berhasil | 100% jadwal backup |
| Restore test berhasil | Minimal 1 kali sebelum produksi |
| Kepuasan guru pilot | ≥80% |

Target performa harus ditetapkan dari hasil pengujian dataset nyata, bukan hanya dari angka kuota Apps Script.

---

## 21. Checklist Persetujuan Sebelum Coding

Sebelum implementasi, Admin/developer harus menyetujui jawaban atas pertanyaan berikut:

1. Apakah satu kelas dapat memiliki beberapa guru pengampu?
2. Apakah satu siswa boleh berada di beberapa kelas?
3. Apakah kode mapel unik global atau hanya unik per guru?
4. Apakah siswa boleh resubmit quiz/tugas?
5. Siapa pemilik file salinan tugas?
6. Bagaimana validasi link file submission?
7. Apakah email hanya fitur tambahan jika kuota tersedia?
8. Apakah WhatsApp ditunda dari MVP?
9. Siapa guru cadangan jika akun utama bermasalah?
10. Apakah database akan benar-benar tidak dibagikan langsung?
11. Apakah kebijakan kata sandi (minimal 6 karakter huruf+angka, kunci otomatis 5×/15 menit) disetujui?
12. Apakah tersedia staging environment terpisah dari production?
13. Apakah ada prosedur backup dan restore?
14. Apakah ada test isolasi data dengan dua guru?
15. Apakah struktur 23 sheet sudah disetujui?

---

## 22. Riwayat Perubahan Versi 1.2 ke Versi 1.3

1. Memperbaiki klaim autentikasi: masalah `Session.getActiveUser()` dikaitkan dengan mode deployment dan security context, bukan semata-mata jenis Gmail.
2. Menambahkan validasi signature, issuer, audience, nonce, dan `sub` pada ID token.
3. Menambahkan PKCE dan one-time login ticket sebagai rekomendasi keamanan.
4. Menghapus penggunaan `password_hash` karena tidak ada login password.
5. Mengubah session agar tidak menggunakan session ID permanen di URL.
6. Mengubah model `Classes.students` menjadi `Class_Members`.
7. Mengubah model `Classes.subjects` menjadi `Teaching_Assignments`.
8. Mengubah `Groups.members` menjadi `Group_Members`.
9. Mengubah relasi topic agar menggunakan `teaching_assignment_id`.
10. Menambahkan `Users.status`, `Topics.description`, `Items.updated_at`, dan field operasional lain yang sebelumnya hilang.
11. Menghapus ketergantungan `subject_id` yang redundant dari `Items` dan `Grades`; subject diturunkan melalui relasi authoritative.
12. Memperbaiki struktur soal quiz dan memastikan answer key tidak dikirim kepada siswa.
13. Menambahkan aturan composite key untuk submission, progress, membership, dan refleksi.
14. Mengubah monitoring kuota menjadi metrik internal dan kesehatan sistem.
15. Menambahkan aturan quota email consumer/Workspace dan peringatan bahwa seluruh penggunaan terkonsentrasi pada akun eksekusi Admin.
16. Menambahkan batas `google.script.run`, asynchronous call, retry, dan idempotency.
17. Menunda WhatsApp dan otomatisasi copy file kompleks dari MVP inti.
18. Memperbaiki roadmap, testing, keamanan, backup, audit, dan operasional.
19. (Adendum 2026-09, penerapan tahap 4.6–4.8 di folder `v2/`) Status `Topics`/`Items` menjadi `draft|publish|scheduled` + kolom `publish_at`; quiz/refleksi dapat mandiri tanpa topik via `Items.ta_id`; satu susunan course gabungan (`coursePindah`, renumber 1..N); murid menerima `urutan[]` campuran yang sama dengan guru. Lihat §7.8b.
20. (Rollback 2026-09-02) Implementasi **tahap 3** (kelas/murid/enrollment + UI kelola) dan **tahap 4** (mapel/penugasan/topik/course/editor, port UI/UX gaya v1) dihapus dari folder `v2/` — UI/UX dinilai masih acak dan akan dibangun ulang dengan rancangan tampilan yang lebih matang. Kondisi kembali ke **tahap 2** (fondasi: skema 23 sheet, Auth lengkap, UI login + cangkang dasbor). Skema dan keputusan §7.7/§7.8/§7.8b TETAP menjadi acuan pembangunan ulang. Arsip kode tahap 3: commit `a63527b`; tahap 4: rentang `a63527b..c1c0157`.
21. (Keputusan 2026-09-02, §22D; direvisi hari itu juga) Alur dashboard guru: lima menu (Kelola Kelas, Kelola Course, Kelola Murid, Rekap Nilai, Status API Key). Kata sandi murid tetap model v1 — hash+salt, `pwd_awal` terlihat guru sampai murid mengganti; skema `Users` tidak berubah.
19. Menetapkan database final menjadi 21 sheet dengan `Audit_Logs`.
20. Membersihkan konsep arsitektur lama “1 project/spreadsheet per guru”.

---

## 22A. Keputusan Integrasi v2

Rancangan v2 menggabungkan keputusan terbaik dari dua rancangan v1.3:

| Keputusan | Status |
|---|---|
| 1 Project + 1 Spreadsheet | Disetujui untuk MVP |
| Login username + kata sandi (sama seperti v1) | **Keputusan final v2.1 — menggantikan OAuth** |
| Role `guru` (admin) + `murid` | **Keputusan final v2.1** |
| `Enrollment` proses v1 sebagai relasi murid-kelas | **Keputusan final v2.1** |
| Sistem AI generate v1 (Gemini + rotasi key + draf wajib tinjau) | **Keputusan final v2.1 — bagian MVP inti** |
| `Teaching_Assignments` sebagai relasi guru-kelas-mapel | Disarankan |
| `Group_Members` sebagai relasi kelompok | Wajib |
| `Audit_Logs` | Disarankan dan dimasukkan sebagai sheet ke-21 |
| Email | Kanal tambahan dengan kuota |
| WhatsApp | Phase 2 |
| Direct sharing database | Dilarang |
| Real-time WebSocket | Di luar MVP |

Jika sekolah memastikan bahwa satu kelas hanya akan memiliki satu guru,
`Class_Subjects` dapat menjadi alternatif lebih sederhana. Namun, untuk
mendukung model sekolah yang umum, `Teaching_Assignments` tetap menjadi desain
yang direkomendasikan.

## 22B. Catatan Perubahan dari v1.3 ke v2

1. Menggabungkan rancangan teknis v1.3 alternatif dengan rancangan v1.3 utama.
2. Menetapkan **21 sheet** dan menambahkan `Audit_Logs` secara resmi.
3. Menambahkan `google_sub` pada `Users`.
4. Menetapkan OAuth PoC sebagai gate sebelum implementasi LMS.
5. Menambahkan validasi signature, issuer, audience, nonce, expiry, dan
   `email_verified` pada ID token.
6. Menambahkan persiapan Cloud Project, OAuth Client, redirect URI, dan aturan
   Advanced API.
7. Menambahkan authorization matrix.
8. Menetapkan `Teaching_Assignments` sebagai relasi guru-kelas-mapel yang
   lebih fleksibel daripada hanya `Class_Subjects`.
9. Memperjelas one-time login ticket, hashed session, dan revocation.
10. Menetapkan `dedupe_key` pada notifikasi dan aturan audit non-rahasia.
11. Memperjelas quota, `google.script.run`, iframe navigation, Drive permission,
    idempotency, dan load testing.
12. Mengubah status dokumen menjadi siap dilanjutkan setelah gate PoC, security
    test, dan finalisasi schema lulus.

## 22C. Revisi v2 → v2.1 (Keputusan Final)

Empat keputusan pemilik produk, 2 September 2026:

1. **Sistem login sama seperti versi lama.** OAuth 2.0/OpenID Connect custom dihapus seluruhnya (§4A, §5 lama, Gate PoC OAuth). Diganti port `Auth.gs` v1: username + kata sandi (SHA-256 + salt), sesi token TTL 12 jam, kunci otomatis 5× gagal/15 menit, ganti/lupa/reset kata sandi. Konsekuensi: `Users` memakai field v1 (tanpa `google_sub`), sheet `Sessions` diganti `Session` sederhana, ditambah sheet `Permintaan_Reset`. Web App di-deploy dengan Access **Anyone**.
2. **Role tetap `guru` sebagai admin dan `murid`.** Role `admin` dan `siswa` dihapus dari seluruh dokumen; authorization matrix menjadi dua kolom; seluruh fungsi operasional (backup, monitoring, kelola user) dipegang guru.
3. **Proses enrollment sama seperti v1.** Sheet `Class_Members` diganti `Enrollment` dengan field & alur v1 (enroll/reaktivasi/keluarkan + notifikasi `enroll_kelas`).
4. **Sistem AI generate sama seperti v1.** AI keluar dari daftar "di luar MVP" dan menjadi bagian inti (§8.9): Gemini, rotasi ≤10 key, fallback model, cooldown, hasil draf wajib ditinjau; riwayat di sheet `Materi_AI`.

Perubahan turunan: database final menjadi **23 sheet**; Gate 0 berubah dari "OAuth PoC" menjadi "PoC Login & Sesi"; roadmap, pengujian, risiko, dan checklist persetujuan disesuaikan.

## 22D. Keputusan Alur Dashboard Guru (2026-09-02)

Keputusan pemilik produk menyusul rollback ke tahap 2 (§22B no. 20).
Dashboard guru memakai **lima menu utama**; pembangunan ulang UI mengikuti
alur ini:

1. **Kelola Kelas** — buat kelas; detail kelas memuat daftar murid dalam
   kelas, enroll murid (dari murid aktif yang belum terdaftar), keluarkan
   murid, dan lihat data siswa termasuk kata sandinya.
2. **Kelola Course** — "Course" adalah istilah UI untuk relasi
   guru-kelas-mapel (`Teaching_Assignments`); nama sheet tidak berubah.
   Tampilan: `XI TKJ 1 - PKPJ`. Buat course = pilih kelas (dropdown) +
   tulis nama mapel (bebas); server memakai baris `Subjects` yang sudah
   ada bila namanya sama (dedupe) atau membuat baris baru. Konten di
   dalam course (materi/quiz/tugas) dirancang dan dibangun terpisah
   setelah ini.
3. **Kelola Murid** — tambah satu-satu, impor massal (dedupe username),
   edit, nonaktifkan, lihat data termasuk kata sandi.
4. **Rekap Nilai** — rekap nilai per course + export Excel (mekanisme ala
   v1: Google Sheet sementara yang dapat diunduh sebagai .xlsx). Dibangun
   **setelah** quiz & tugas tersedia sebagai sumber nilai; sebelum itu
   menunya menampilkan keterangan "menyusul".
5. **Status API Key** — pasang daftar API key maksimal 10 dan lihat
   statusnya (aktif/dipakai/cooldown) — mekanisme v1 persis: disimpan di
   **Script Properties** (bukan sheet); menu boleh dibangun lebih awal,
   port penuh menyusul bersama `Ai.gs`.

Keputusan turunan:

- **Beranda guru tetap ada** (ringkas): ringkasan jumlah + kartu pintasan
  ke lima menu. Notifikasi tidak menjadi menu — cukup ikon lonceng pada
  bilah atas.
- **Kata sandi murid mengikuti v1 persis** (revisi hari itu juga,
  mengembalikan keputusan awal "sandi teks"): hash SHA-256 + salt;
  guru dapat melihat **`pwd_awal`** — sandi sementara terakhir — di
  Kelola Murid/Kelas **sampai murid menggantinya sendiri**; setelah itu
  guru perlu mereset sandi untuk melihatnya lagi. Skema `Users` persis
  §7.2 — **tidak ada perubahan skema**. Alur lupa sandi/reset guru tidak
  berubah; `harus_ganti_password` tetap.
- **Tidak ada sheet baru** — 23 sheet tetap.

---

## 23. Kesimpulan

Google Apps Script cukup sesuai untuk membangun LMS MVP ini, dengan syarat:

- Target tetap pada skala MVP.
- Single Spreadsheet tidak dibagikan langsung.
- Login username + kata sandi diimplementasikan setia pada pola v1 (salt per user, kunci otomatis, reset terkendali oleh guru).
- Authorization dilakukan pada setiap resource.
- Relasi kelas, mapel, dan kelompok tidak disimpan sebagai JSON Array inti.
- Operasi tulis menggunakan lock, composite key, dan idempotency.
- Email dan WhatsApp dianggap layanan terbatas, bukan jalur utama sistem.
- Database dan deployment diuji dengan data dan beban yang mendekati kondisi nyata.

Arsitektur v2 dapat dilanjutkan ke tahap implementasi setelah seluruh pertanyaan pada checklist persetujuan dijawab dan schema 23 sheet disetujui.
