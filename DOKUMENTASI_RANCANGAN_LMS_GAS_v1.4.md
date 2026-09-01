# 📚 Dokumentasi Rancangan LMS dengan Google Apps Script

**Versi:** 1.4  
**Tanggal:** 31 Agustus 2026  
**Status:** Draft integrasi — basis finalisasi teknis dan PoC sebelum implementasi MVP  
**Proyek:** LMS sederhana — fase MVP  
**Target MVP:** 1–10 guru, sekitar 500 siswa, satu sekolah/organisasi

---

## 1. Ringkasan Eksekutif

Sistem ini adalah LMS sederhana berbasis Google Apps Script dengan fitur:

- Pengguna dengan role admin, guru, dan siswa.
- Login menggunakan akun Google.
- Manajemen kelas, keanggotaan siswa, dan penugasan guru-mapel-kelas.
- Topic dan item pembelajaran: materi, tugas individu, tugas kelompok, quiz, dan refleksi.
- Kontrol buka/tutup topic dan item.
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

### Keputusan utama versi 1.4

1. Arsitektur single project dan single spreadsheet dipertahankan.
2. `Session.getActiveUser().getEmail()` tidak dipakai sebagai mekanisme login utama.
3. Login Gmail lintas-domain menggunakan OAuth 2.0/OpenID Connect custom dengan validasi token yang benar.
4. Session token tidak disimpan permanen dalam URL.
5. Keanggotaan kelas, penugasan mapel, dan anggota kelompok tidak lagi disimpan sebagai JSON Array dalam satu sel.
6. Hak akses tidak hanya mengandalkan `teacher_id`, tetapi menggunakan pemeriksaan kepemilikan resource dan keanggotaan kelas.
7. Monitoring kuota diubah menjadi monitoring kesehatan sistem dan metrik pemakaian internal; bukan klaim kuota Apps Script per guru.
8. WhatsApp dan otomatisasi copy file siswa bukan bagian dari MVP inti.
9. Database final terdiri atas **21 sheet**, yaitu 17 sheet utama versi sebelumnya ditambah `Class_Members`, `Teaching_Assignments`, `Group_Members`, dan `Audit_Logs`.

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
| Admin | Mengelola guru, monitoring sistem, backup, dan konfigurasi |
| Guru | Mengelola kelas, siswa, mapel, materi, tugas, quiz, kelompok, nilai, dan progres |
| Siswa | Melihat materi, mengerjakan quiz/tugas, mengisi refleksi, dan melihat progres/nilai |

### 2.3 Yang termasuk MVP

- Satu sekolah/organisasi.
- 1–10 guru.
- Sekitar 500 siswa.
- Akun Google untuk seluruh pengguna.
- Akses melalui Web App, bukan aplikasi Android/iOS.
- Data utama di satu Spreadsheet.
- File pembelajaran di Google Drive.
- Email sebagai notifikasi tambahan dengan batas kuota.
- Quiz dan tugas dengan alur submit yang sederhana.

### 2.4 Yang tidak termasuk MVP

- WebSocket atau real-time update.
- Video conference.
- Chat/forum.
- Payment gateway.
- Mobile app native.
- Self-registration guru.
- AI/ML.
- Otomatisasi penuh WhatsApp.
- Sistem ujian dengan anti-cheating tingkat tinggi.
- Otomatisasi copy file siswa yang kompleks.
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
│ 21 sheet                    │   │ LMS_Utama/                  │
│ data terstruktur             │   │ folder guru/kelas/item      │
└──────────────────────────────┘   └───────────────────────────┘
```

### 4.2 Deployment

| Pengaturan | Nilai |
|---|---|
| Deployment | Web App |
| Execute as | Me — akun Admin/pemilik script |
| Access | Anyone with Google account, sesuai kebutuhan rollout |
| Database | Satu Spreadsheet milik Admin |
| Drive | Folder induk milik Admin atau Shared Drive jika tersedia |
| URL | Satu URL `/exec` untuk semua pengguna |
| Lingkungan | Pisahkan development/staging dan production |

Spreadsheet database **tidak boleh dibagikan langsung** kepada guru maupun siswa. Akses mereka hanya melalui Web App.

### 4.3 Struktur file project

```text
LMS_Utama/
├── Code.gs
├── Config.gs
├── Auth.gs
├── Authorization.gs
├── SessionService.gs
├── ErrorHandler.gs
├── Helpers.gs
├── LockHelper.gs
├── Database/
│   ├── SheetRepository.gs
│   ├── Users.gs
│   ├── Classes.gs
│   ├── Subjects.gs
│   ├── TeachingAssignments.gs
│   ├── ClassMembers.gs
│   ├── Topics.gs
│   ├── Items.gs
│   ├── Progress.gs
│   ├── Quizzes.gs
│   ├── QuizQuestions.gs
│   ├── QuizSubmissions.gs
│   ├── Assignments.gs
│   ├── Groups.gs
│   ├── GroupMembers.gs
│   ├── Submissions.gs
│   ├── Grades.gs
│   ├── Reflections.gs
│   ├── Notifications.gs
│   ├── Sessions.gs
│   ├── Counters.gs
│   └── AuditLogs.gs
├── Controllers/
│   ├── AdminController.gs
│   ├── TeacherController.gs
│   ├── StudentController.gs
│   ├── ClassController.gs
│   ├── SubjectController.gs
│   ├── TopicController.gs
│   ├── ItemController.gs
│   ├── QuizController.gs
│   ├── AssignmentController.gs
│   ├── GroupController.gs
│   ├── ProgressController.gs
│   ├── GradeController.gs
│   └── ReflectionController.gs
├── Services/
│   ├── DriveService.gs
│   ├── EmailService.gs
│   ├── ImportService.gs
│   └── NotificationService.gs
└── Views/
    ├── Login.html
    ├── Admin.html
    ├── Teacher.html
    ├── Student.html
    ├── Components.html
    └── Assets.html
```

Nama folder di atas adalah struktur logis pengembangan. Jika editor Apps Script tidak mendukung folder project seperti IDE lokal, gunakan penamaan file yang konsisten atau kelola source dengan `clasp` dan repository Git.

---

## 4A. Persiapan Google Cloud, Apps Script, dan API

### 4A.1 Cloud Project

Gunakan satu **standard Google Cloud Project** yang terhubung dengan Apps
Script production. Buat project development/staging terpisah agar pengujian
OAuth dan perubahan schema tidak mengganggu pengguna production.

### 4A.2 OAuth Client

- Buat OAuth Client tipe Web Application.
- Daftarkan redirect URI Web App production secara persis, termasuk scheme dan
  trailing slash jika ada.
- Simpan `client_id` dan `client_secret` pada Script Properties.
- Jangan menaruh secret di HTML, JavaScript client, atau Spreadsheet.
- OAuth untuk login hanya meminta scope identitas minimal:
  `openid email profile`.

### 4A.3 Google services

`SpreadsheetApp`, `DriveApp`, dan `MailApp` adalah layanan Apps Script yang
dapat dipakai langsung sesuai scope script. Advanced Drive/Sheets API hanya
diaktifkan jika fitur memang membutuhkan kemampuan tambahan. Jika memakai
Advanced Service atau REST API dari standard Cloud Project, API terkait harus
diaktifkan pada Cloud Project.

`People API` tidak diperlukan jika identitas dan profil minimal sudah diperoleh
dari ID token OpenID Connect.

### 4A.4 Scope harus dipisahkan

Bedakan dua jenis scope:

1. **Scope OAuth login** untuk mengenali pengguna.
2. **Scope Apps Script** yang digunakan oleh akun Admin untuk mengakses Sheets,
   Drive, dan Mail.

Pengguna akhir tidak boleh diminta mengotorisasi akses Admin ke seluruh database
karena Web App dijalankan sebagai Admin.

## 5. Strategi Autentikasi

### 5.1 Keputusan

Karena pengguna dapat menggunakan akun Gmail pribadi atau domain yang berbeda, sistem tidak menggunakan email dari `Session.getActiveUser()` sebagai mekanisme login.

Pada deployment `Execute as: Me`, email pengguna aktif dapat kosong karena script berjalan di bawah otorisasi developer/pemilik. [Dokumentasi Session](https://developers.google.com/apps-script/reference/base/session)

Sistem menggunakan:

```text
Google OAuth 2.0 Authorization Code Flow
+ OpenID Connect ID Token
+ session aplikasi sendiri
```

OAuth ini hanya digunakan untuk mengenali identitas Google pengguna. Akses Apps Script ke Spreadsheet dan Drive tetap menggunakan otorisasi akun Admin sebagai effective user.

### 5.2 Alur login yang disetujui

```text
1. Pengguna membuka Web App.
2. Jika belum memiliki session, sistem menampilkan halaman Login.
3. Pengguna menekan tombol Login dengan Google.
4. Browser diarahkan ke Google melalui navigasi top-level.
5. Google mengembalikan authorization code ke URL callback Web App.
6. doGet(e) memvalidasi state satu kali.
7. Server menukarkan code dengan token.
8. Server memvalidasi ID token:
   - signature
   - iss
   - aud
   - exp
   - iat
   - nonce
   - email_verified
   - sub
9. Sistem mencari pengguna berdasarkan google_sub atau email terverifikasi.
10. Sistem membuat one-time login ticket.
11. Ticket ditukarkan menjadi session aplikasi.
12. Parameter ticket dihapus dari URL.
13. Setiap google.script.run mengirim session token.
14. Server memvalidasi session dan authorization pada setiap request.
```

### 5.3 Persyaratan keamanan OAuth

Implementasi wajib memiliki:

- `state` acak dan sekali pakai untuk perlindungan CSRF.
- `nonce` acak untuk perlindungan replay/substitusi ID token.
- PKCE jika flow dijalankan dengan komponen browser.
- `client_secret` di `PropertiesService.getScriptProperties()`.
- Validasi signature ID token, bukan hanya Base64 decode.
- Validasi issuer Google.
- Validasi audience sama dengan OAuth Client ID aplikasi.
- Validasi waktu kedaluwarsa.
- Validasi `email_verified = true`.
- Penyimpanan `sub` sebagai identitas Google utama.
- Penolakan authorization code yang sudah pernah digunakan.

Dokumentasi OpenID Connect Google mensyaratkan validasi signature, issuer, dan audience ID token. [Dokumentasi OpenID Connect](https://developers.google.com/identity/protocols/oauth2/openid-connect)

### 5.4 Session aplikasi

Session aplikasi menggunakan token acak yang tidak bermakna. Raw token tidak disimpan di URL secara permanen.

Pola yang digunakan:

```text
OAuth callback
→ one-time login_ticket dengan TTL singkat
→ tukar ticket
→ session token disimpan di sessionStorage
→ URL dibersihkan dengan history.replaceState()
```

Sheet `Sessions` menyimpan hash token, bukan raw token, dengan field:

- `session_id_hash`
- `user_id`
- `created_at`
- `expires_at`
- `last_active`
- `revoked_at`
- `user_agent_hash` opsional

`CacheService` hanya digunakan sebagai cache cepat. Jika cache hilang, server dapat mencari sesi pada Sheet `Sessions` selama sesi belum kedaluwarsa dan belum dicabut.

Role dan status pengguna harus dibaca kembali dari `Users` secara berkala atau pada setiap request sensitif. Role yang tersimpan ketika login tidak boleh membuat akses tetap aktif setelah pengguna dinonaktifkan.

### 5.5 Data Users untuk identitas

Field yang digunakan:

- `google_sub` — identitas Google utama.
- `email` — email terverifikasi untuk informasi dan pencarian awal.
- `status` — `active` atau `inactive`.

Jika guru/siswa sudah dimasukkan oleh Admin berdasarkan email tetapi belum pernah login, `google_sub` dapat diisi saat login pertama setelah email terverifikasi cocok.

Field `password_hash` dihapus karena sistem tidak menyediakan login password.

### 5.6 OAuth consent dan test user

Jika OAuth Client benar-benar hanya meminta scope identitas:

```text
openid
email
profile
```

maka aturan test user Google memiliki pengecualian untuk scope identitas dasar. Penggunaan lebih dari 100 pengguna tidak otomatis berarti seluruh siswa harus dimasukkan satu per satu sebagai test user. Tetap lakukan konfigurasi production, branding, privacy policy, dan pemeriksaan kebijakan Google sebelum rollout.

Jika ditambahkan scope lain seperti Drive, Gmail, atau data pengguna tambahan melalui OAuth Client, evaluasi ulang persyaratan verifikasi dan batas pengguna.

---

### 5.7 OAuth Proof of Concept sebagai Gate

Sebelum modul LMS dibuat, implementasikan PoC pada deployment Web App aktual.
PoC harus lulus seluruh pemeriksaan berikut:

```text
[ ] Login dari akun Gmail pribadi berhasil
[ ] Callback kembali ke URL /exec
[ ] Authorization code hanya dapat dipakai sekali
[ ] state salah/kedaluwarsa ditolak
[ ] nonce diverifikasi
[ ] ID token invalid/expired ditolak
[ ] Signature, iss, aud, dan email_verified diverifikasi
[ ] sub dipetakan ke Users
[ ] Pengguna tidak terdaftar ditolak
[ ] One-time ticket dibuat dan kedaluwarsa
[ ] Session dapat dibuat dan divalidasi
[ ] Logout/revoke berhasil
[ ] User inactive tidak dapat mengakses aplikasi
[ ] Role tidak dapat diubah melalui browser
[ ] Navigasi OAuth bekerja pada iframe HTML Service
```

**Gate:** Jika PoC belum lulus, implementasi controller LMS tidak dilanjutkan.
Alternatif seperti Firebase Authentication atau backend autentikasi terpisah
hanya dipertimbangkan jika custom OAuth GAS terlalu rapuh untuk production.

---

## 6. Authorization dan Isolasi Data

### 6.0 Authorization Matrix

| Aksi | Admin | Guru | Siswa |
|---|:---:|:---:|:---:|
| Kelola guru | ✅ | ❌ | ❌ |
| Lihat monitoring seluruh sistem | ✅ | ❌ | ❌ |
| Kelola mapel dalam scope | sesuai kebijakan | ✅ | ❌ |
| Buat/kelola kelas | sesuai kebijakan | ✅ | ❌ |
| Kelola anggota kelas | sesuai kebijakan | ✅ | ❌ |
| Buat/edit topic dan item | ❌ | ✅ | ❌ |
| Lihat materi yang diizinkan | ✅ | ✅ | ✅ |
| Tandai item selesai | ❌ | ❌ | ✅ |
| Buat dan nilai quiz | ❌ | ✅ | ❌ |
| Kerjakan quiz | ❌ | ❌ | ✅ |
| Buat tugas/kelompok | ❌ | ✅ | ❌ |
| Submit tugas | ❌ | ❌ | ✅ |
| Submit tugas kelompok | ❌ | ❌ | Ketua |
| Lihat nilai siswa | ✅ | Scope kelas/mapel | ❌ |
| Lihat nilai sendiri | sesuai kebijakan | ❌ | ✅ |

Role hanya lapisan pertama. Semua aksi guru dan siswa tetap harus memeriksa
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

## 7. Struktur Database Final — 21 Sheet

Semua sheet berada dalam satu Spreadsheet `LMS_DB_Utama`. Header harus didefinisikan dalam konfigurasi agar repository tidak bergantung pada nomor kolom tetap.

### 7.1 Daftar sheet

| No | Sheet | Fungsi | Primary key |
|---:|---|---|---|
| 1 | `Users` | Admin, guru, siswa | `user_id` |
| 2 | `Classes` | Data kelas | `class_id` |
| 3 | `Subjects` | Daftar mapel milik guru/organisasi | `subject_id` |
| 4 | `Class_Members` | Relasi siswa-kelas | `membership_id` |
| 5 | `Teaching_Assignments` | Relasi guru-kelas-mapel | `teaching_assignment_id` |
| 6 | `Topics` | Bab/topic pembelajaran | `topic_id` |
| 7 | `Items` | Materi, tugas, quiz, refleksi | `item_id` |
| 8 | `Progress` | Status progres siswa | `progress_id` |
| 9 | `Quizzes` | Detail quiz | `quiz_id` |
| 10 | `Quiz_Questions` | Soal quiz | `question_id` |
| 11 | `Quiz_Submissions` | Jawaban quiz siswa | `submission_id` |
| 12 | `Assignments` | Detail tugas | `assignment_id` |
| 13 | `Groups` | Kelompok tugas | `group_id` |
| 14 | `Group_Members` | Relasi siswa-kelompok | `group_membership_id` |
| 15 | `Submissions` | Pengumpulan tugas | `submission_id` |
| 16 | `Grades` | Nilai | `grade_id` |
| 17 | `Reflections` | Refleksi siswa | `reflection_id` |
| 18 | `Notifications` | Notifikasi dalam aplikasi/email | `notification_id` |
| 19 | `Sessions` | Session login | `session_id_hash` |
| 20 | `Counters` | Generator ID | `entity_name` |
| 21 | `Audit_Logs` | Audit perubahan dan aktivitas penting | `log_id` |

**Catatan:** `Class_Members`, `Teaching_Assignments`, dan `Group_Members` adalah sumber kebenaran relasi. Jangan mempertahankan kolom JSON Array lama sebagai sumber utama. `Audit_Logs` adalah sheet operasional; jika sekolah memilih log eksternal, sheet ini boleh diganti dengan layanan log yang setara setelah keputusan disetujui.

### 7.2 `Users`

| Field | Required | Keterangan |
|---|---:|---|
| `user_id` | ✅ | ID internal, misalnya `U0001` |
| `google_sub` | ❌ | ID stabil dari Google, unique jika sudah terikat |
| `email` | ✅ | Email terverifikasi, normalized lowercase |
| `name` | ✅ | Nama pengguna |
| `role` | ✅ | `admin`, `guru`, `siswa` |
| `phone` | ❌ | Nomor WhatsApp, jika diperlukan |
| `nisn` | ❌ | NISN siswa |
| `status` | ✅ | `active`, `inactive` |
| `last_login` | ❌ | Login terakhir |
| `created_at` | ✅ | Waktu dibuat |
| `updated_at` | ✅ | Waktu diubah |

`email` unique berdasarkan kebijakan sekolah. Jika menggunakan alias email, Admin harus menentukan aturan pemetaan.

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

### 7.5 `Class_Members`

| Field | Required | Keterangan |
|---|---:|---|
| `membership_id` | ✅ | ID membership |
| `class_id` | ✅ | Foreign key ke `Classes` |
| `user_id` | ✅ | Foreign key ke `Users` |
| `status` | ✅ | `active`, `inactive` |
| `joined_at` | ✅ | Waktu masuk kelas |
| `left_at` | ❌ | Waktu keluar kelas |

**Composite key:** `class_id + user_id` untuk membership aktif.

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
| `status` | ✅ | `open`, `closed` |
| `created_at` | ✅ | Waktu dibuat |
| `updated_at` | ✅ | Waktu diubah |

`teacher_id`, `class_id`, dan `subject_id` dapat diperoleh melalui `Teaching_Assignments`. Jika didenormalisasi untuk performa, nilainya harus diisi dan divalidasi server-side.

### 7.8 `Items`

| Field | Required | Keterangan |
|---|---:|---|
| `item_id` | ✅ | ID item |
| `topic_id` | ✅ | Topic induk |
| `type` | ✅ | `materi`, `tugas_individu`, `tugas_kelompok`, `quiz`, `refleksi` |
| `title` | ✅ | Judul item |
| `description` | ❌ | Deskripsi/instruksi |
| `status` | ✅ | `open`, `closed` |
| `related_id` | ❌ | ID quiz/tugas/refleksi |
| `created_at` | ✅ | Waktu dibuat |
| `updated_at` | ✅ | Waktu diubah |

`related_id` adalah polymorphic relation sehingga validasinya wajib dilakukan oleh server berdasarkan `type`. Jika sistem membesar, gunakan field FK terpisah atau satu tabel aktivitas terpadu.

### 7.9 `Progress`

| Field | Required | Keterangan |
|---|---:|---|
| `progress_id` | ✅ | ID progres |
| `user_id` | ✅ | Siswa |
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
| `user_id` | ✅ | Siswa |
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
| `user_id` | ✅ | Siswa |
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
| `user_id` | ✅ | Siswa |
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

### 7.20 `Sessions`


```text
session_id_hash
user_id
created_at
expires_at
last_active
revoked_at
user_agent_hash (opsional)
```

### 7.21 `Counters`

```text
entity_name
last_number
```

Generator ID harus menggunakan lock dan update counter atomik. Prefix ID sebaiknya konsisten, misalnya:

```text
U0001   user
C0001   class
S0001   subject
TA0001  teaching assignment
T0001   topic
I0001   item
Q0001   quiz
A0001   assignment
GR0001  grade
SUB0001 submission
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

Audit log harus ditulis secara ringkas. Raw OAuth token, raw session token,
client secret, password, dan isi data sensitif yang tidak diperlukan tidak
boleh dicatat.

---

## 8. Kebutuhan Fungsional

### 8.1 Manajemen pengguna

| ID | Fitur | Aktor |
|---|---|---|
| FR-001 | Login/logout Google | Semua pengguna |
| FR-002 | Admin menambah guru | Admin |
| FR-003 | Import/upsert siswa | Guru |
| FR-004 | Melihat profil | Semua pengguna |
| FR-005 | Menonaktifkan guru/siswa | Admin |
| FR-006 | Mengubah role/status | Admin |

### 8.2 Mata pelajaran, kelas, dan relasi pengajaran

| ID | Fitur | Aktor |
|---|---|---|
| FR-010 | Membuat kelas | Guru |
| FR-011 | Mengarsipkan kelas | Guru/Admin |
| FR-012 | Menambahkan siswa melalui `Class_Members` | Guru |
| FR-013 | Melihat anggota kelas | Guru/Siswa sesuai akses |
| FR-014 | Membuat/mengelola mapel | Guru/Admin |
| FR-015 | Menugaskan guru-mapel-kelas | Guru/Admin sesuai kebijakan |
| FR-016 | Mendukung banyak mapel dalam satu kelas | Sistem |
| FR-017 | Filter aktivitas berdasarkan mapel | Guru/Siswa |

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
| FR-030 | Melihat materi yang boleh diakses | Siswa |
| FR-031 | Menandai item selesai | Siswa |
| FR-032 | Melihat progres per topic/mapel/kelas | Guru |
| FR-033 | Melihat progres pribadi | Siswa |

### 8.5 Tugas individu dan kelompok

| ID | Fitur | Aktor |
|---|---|---|
| FR-040 | Membuat tugas individu | Guru |
| FR-041 | Membuat tugas kelompok | Guru |
| FR-042 | Menyediakan template Drive | Guru |
| FR-043 | Melihat instruksi dan template | Siswa |
| FR-044 | Mengirim link/file submission | Siswa |
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
| FR-063 | Mengerjakan quiz | Siswa |
| FR-064 | Submit quiz dengan validasi deadline | Siswa/Sistem |
| FR-065 | Auto-grade PG dan benar-salah | Sistem |
| FR-066 | Menilai jawaban singkat/uraian | Guru/Sistem sesuai aturan |
| FR-067 | Mencegah submit duplikat | Sistem |

### 8.7 Refleksi, nilai, laporan, dan notifikasi

| ID | Fitur | Aktor |
|---|---|---|
| FR-070 | Menulis refleksi | Siswa |
| FR-071 | Melihat refleksi | Guru |
| FR-080 | Rekap progres kelas | Guru |
| FR-081 | Rekap nilai kelas | Guru |
| FR-082 | Melihat nilai pribadi | Siswa |
| FR-083 | Filter laporan per kelas/mapel/topic | Guru |
| FR-084 | Rekap semua guru | Admin |
| FR-090 | Notifikasi deadline in-app | Sistem |
| FR-091 | Email notifikasi terbatas | Sistem |
| FR-092 | Menandai notifikasi dibaca | Pengguna |

### 8.8 Admin dan operasional

| ID | Fitur | Aktor |
|---|---|---|
| FR-100 | Menambah/nonaktifkan guru | Admin |
| FR-101 | Backup database | Admin |
| FR-102 | Melihat metrik pemakaian internal | Admin |
| FR-103 | Melihat log error dan eksekusi | Admin |
| FR-104 | Menjalankan pemeriksaan integritas data | Admin |

---

## 9. Alur Kerja Utama

### 9.1 Admin menambah guru

```text
Admin login
→ buka halaman Guru
→ isi email/nama/nomor telepon
→ server validasi role Admin
→ upsert Users dengan role guru dan status active
→ kirim email undangan jika kuota tersedia
→ guru login melalui URL yang sama
```

Tidak ada pembuatan project atau spreadsheet baru.

### 9.2 Guru membuat kelas dan penugasan mapel

```text
Guru membuat kelas
→ memilih mapel
→ server membuat Teaching_Assignment
→ guru dapat menambahkan siswa melalui Class_Members
→ guru membuat topic di bawah Teaching_Assignment
```

### 9.3 Import siswa

Import harus menggunakan aturan upsert:

1. Normalisasi email.
2. Cari `Users` berdasarkan email.
3. Jika belum ada, buat siswa baru.
4. Jika sudah ada, jangan membuat user duplikat.
5. Buat atau aktifkan row `Class_Members`.
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

### 11.4 Retry client

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

- Spreadsheet database hanya dimiliki/diakses Admin.
- Jangan menaruh raw OAuth token di Spreadsheet.
- Jangan menaruh secret API di HTML atau JavaScript client.
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

### 15.1 Dashboard Admin

- Ringkasan jumlah guru/siswa/kelas.
- Daftar guru aktif/nonaktif.
- Monitoring error dan metrik sistem.
- Status backup terakhir.
- Rekap progres/nilai dengan filter guru, kelas, mapel.

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
- Finalisasi OAuth Client dan redirect URI.

### Tahap 1 — Fondasi

- Buat Cloud Project dan Apps Script.
- Buat Spreadsheet 21 sheet.
- Isi konfigurasi header dan Spreadsheet ID.
- Buat folder Drive induk.
- Buat repository baca/tulis batch.
- Buat `Counters` dan `withScriptLock()`.
- Buat logging dasar.

### Tahap 2 — Autentikasi dan authorization

- Implementasi OAuth callback.
- Validasi state, nonce, PKCE, ID token.
- Implementasi `Users` dan `Sessions`.
- Implementasi login ticket.
- Implementasi `requireSession()` dan helper authorization.
- Uji akses dengan dua guru dan dua kelas.

### Tahap 3 — Fitur inti guru/siswa

- Classes.
- Users/import siswa.
- Class_Members.
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

- Login admin/guru/siswa.
- Login dengan akun yang tidak terdaftar.
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
- Replay OAuth code.
- State OAuth salah/kedaluwarsa.
- ID token invalid atau expired.
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
| OAuth custom salah implementasi | Kritis | Validasi signature/claim, nonce/state/PKCE, staging test |
| Akun Admin hilang | Kritis | 2FA, recovery, akun cadangan, backup lintas akun |
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
9. Siapa Admin cadangan jika akun utama bermasalah?
10. Apakah database akan benar-benar tidak dibagikan langsung?
11. Apakah penggunaan OAuth Client hanya meminta `openid email profile`?
12. Apakah tersedia staging environment terpisah dari production?
13. Apakah ada prosedur backup dan restore?
14. Apakah ada test isolasi data dengan dua guru?
15. Apakah struktur 21 sheet sudah disetujui?

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
19. Menetapkan database final menjadi 21 sheet dengan `Audit_Logs`.
20. Membersihkan konsep arsitektur lama “1 project/spreadsheet per guru”.

---

## 22A. Keputusan Integrasi v1.4

Rancangan v1.4 menggabungkan keputusan terbaik dari dua rancangan v1.3:

| Keputusan | Status |
|---|---|
| 1 Project + 1 Spreadsheet | Disetujui untuk MVP |
| OAuth custom Gmail | Disetujui dengan PoC sebagai gate |
| `google_sub` sebagai identitas Google | Wajib |
| Validasi signature/iss/aud/exp/nonce | Wajib |
| `Class_Members` sebagai relasi siswa-kelas | Wajib |
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

## 22B. Catatan Perubahan dari v1.3 ke v1.4

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

## 23. Kesimpulan

Google Apps Script cukup sesuai untuk membangun LMS MVP ini, dengan syarat:

- Target tetap pada skala MVP.
- Single Spreadsheet tidak dibagikan langsung.
- OAuth custom dibuat dengan standar keamanan yang benar.
- Authorization dilakukan pada setiap resource.
- Relasi kelas, mapel, dan kelompok tidak disimpan sebagai JSON Array inti.
- Operasi tulis menggunakan lock, composite key, dan idempotency.
- Email dan WhatsApp dianggap layanan terbatas, bukan jalur utama sistem.
- Database dan deployment diuji dengan data dan beban yang mendekati kondisi nyata.

Arsitektur v1.4 dapat dilanjutkan ke tahap implementasi setelah seluruh pertanyaan pada checklist persetujuan dijawab dan schema 21 sheet disetujui.
