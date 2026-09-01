# TAHAP RANCANGAN LMS GAS

**Nama Proyek:** LMS Sekolah Berbasis Google Apps Script  
**Versi:** 2  
**Tanggal:** 31 Agustus 2026  
**Status:** Tahap Rancangan / Blueprint Implementasi  
**Platform:** Google Apps Script + Google Sheets + Google Drive

---

## 1. Tujuan Dokumen

Dokumen ini menjadi acuan utama sebelum proses coding LMS dimulai.

Tujuannya:

1. Menentukan arsitektur sistem.
2. Menentukan struktur database.
3. Menentukan alur autentikasi dan authorization.
4. Menentukan pembagian fitur Admin, Guru, dan Siswa.
5. Menentukan batas kemampuan LMS pada Google Apps Script.
6. Menentukan tahapan implementasi dan pengujian.
7. Mencegah perubahan arsitektur yang tidak terkontrol ketika proses coding berlangsung.

Prinsip utama:

> **Rancang → Uji fondasi → Implementasi bertahap → Uji → Pilot → Rollout**

---

# 2. Prinsip Arsitektur

Untuk MVP digunakan:

```text
1 Google Apps Script Project
        │
        ├── Web App
        │
        ├── 1 Spreadsheet Database
        │
        └── Google Drive
```

Semua pengguna mengakses satu Web App.

Data dipisahkan secara logis menggunakan:

- `user_id`
- `teacher_id`
- `class_id`
- `subject_id`
- `teaching_assignment_id`
- `item_id`
- `assignment_id`
- `quiz_id`
- `group_id`

Tidak dibuat satu project atau spreadsheet untuk setiap guru.

---

# 3. Target MVP

Target MVP:

- 1 Admin
- 1–10 Guru
- Beberapa kelas
- Siswa sesuai kapasitas hasil pengujian
- Multi-mapel
- Multi-kelas
- Materi
- Quiz
- Tugas
- Tugas kelompok
- Progress
- Nilai
- Notifikasi dasar

MVP bukan ditujukan untuk trafik besar atau kebutuhan real-time.

---

# 4. Batas Kemampuan Google Apps Script

## 4.1 Cocok untuk MVP

| Fitur | Status |
|---|---|
| CRUD data | 🟢 |
| Dashboard | 🟢 |
| Materi | 🟢 |
| Quiz | 🟢 |
| Progress | 🟢 |
| Tugas | 🟢 |
| Nilai | 🟢 |
| Kelompok | 🟢 |
| Google Drive | 🟢 |
| Email | 🟢 |
| Chart.js | 🟢 |

## 4.2 Bisa, tetapi perlu perhatian

| Fitur | Status |
|---|---|
| Custom OAuth | 🟠 |
| Jawaban singkat | 🟡 |
| Essay | 🟡 |
| Google Docs/Sheets/Slides automation | 🟡 |
| Email notification skala besar | 🟡 |
| Concurrency tinggi | 🟠 |

## 4.3 Tidak menjadi bagian MVP

| Fitur | Status |
|---|---|
| WebSocket | 🔴 |
| Chat real-time | 🔴 |
| Mobile app native | 🔴 |
| Payment gateway | 🔴 |
| AI grading sebagai dependency utama | 🔴 |
| WhatsApp API | 🟡 Phase 2 |

---

# 5. Arsitektur Aplikasi

```text
Browser
   │
   ▼
Web App GAS
   │
   ├── Authentication
   ├── Session
   ├── Authorization
   ├── Controllers
   ├── Services
   └── Database Layer
          │
          ├── Google Sheets
          └── Google Drive
```

Pola request:

```text
Client
  ↓
google.script.run
  ↓
Controller
  ↓
Session Validation
  ↓
Role Validation
  ↓
Ownership / Scope Validation
  ↓
Service / Database
  ↓
Response
```

---

# 6. Pembagian Layer

## Authentication

Bertanggung jawab terhadap:

- Google OAuth
- validasi identity token
- state
- nonce
- session
- logout

## Authorization

Bertanggung jawab terhadap:

- role
- ownership
- scope kelas
- scope mapel
- scope assignment

## Controller

Bertanggung jawab terhadap:

- menerima request
- validasi input
- memanggil service
- mengembalikan response

## Service

Bertanggung jawab terhadap:

- business logic
- Drive
- Email
- Notification
- grading

## Database

Bertanggung jawab terhadap:

- read
- insert
- update
- soft delete
- query sederhana

---

# 7. Struktur Database

Database MVP menggunakan 21 sheet:

1. `Users`
2. `Classes`
3. `Class_Members`
4. `Subjects`
5. `Teaching_Assignments`
6. `Topics`
7. `Items`
8. `Progress`
9. `Quizzes`
10. `Quiz_Questions`
11. `Quiz_Submissions`
12. `Assignments`
13. `Groups`
14. `Group_Members`
15. `Submissions`
16. `Grades`
17. `Reflections`
18. `Notifications`
19. `Sessions`
20. `Counters`
21. `Audit_Logs`

---

# 8. Relasi Utama Database

```text
Users
 │
 ├── Classes
 ├── Class_Members
 ├── Teaching_Assignments
 ├── Progress
 ├── Quiz_Submissions
 ├── Submissions
 ├── Grades
 └── Reflections

Classes
 ├── Class_Members
 └── Teaching_Assignments

Subjects
 └── Teaching_Assignments

Teaching_Assignments
 └── Topics

Topics
 └── Items

Items
 ├── Progress
 ├── Quizzes
 ├── Assignments
 └── Reflections

Quizzes
 ├── Quiz_Questions
 └── Quiz_Submissions

Assignments
 ├── Groups
 └── Submissions

Groups
 └── Group_Members
```

---

# 9. Users

Field utama:

```text
user_id
email
google_sub
name
role
phone
nisn
status
last_login
created_at
updated_at
```

Aturan:

- `user_id` adalah primary key.
- `google_sub` menjadi identitas Google utama.
- Email digunakan sebagai informasi akun dan komunikasi.
- Password lokal tidak digunakan pada MVP.
- User inactive tidak boleh menggunakan sistem.

---

# 10. Classes

Field:

```text
class_id
name
year
teacher_id
status
created_at
updated_at
```

Akses guru tetap harus ditentukan melalui scope yang tervalidasi.

Relasi siswa tidak disimpan sebagai JSON Array di `Classes`.

---

# 11. Class_Members

Field:

```text
class_member_id
class_id
student_id
status
joined_at
```

Unique:

```text
class_id + student_id
```

Tujuan:

- menghubungkan siswa dengan kelas;
- mencegah duplicate membership;
- mempermudah query;
- mengurangi ketergantungan JSON Array.

---

# 12. Subjects

Field:

```text
subject_id
name
code
teacher_id
status
created_at
updated_at
```

---

# 13. Teaching_Assignments

Relasi penting:

```text
Guru + Kelas + Mapel
```

Field:

```text
teaching_assignment_id
teacher_id
class_id
subject_id
status
created_at
updated_at
```

Unique:

```text
teacher_id + class_id + subject_id
```

Contoh:

```text
Guru A + XI TKJ 1 + Jaringan
Guru B + XI TKJ 1 + Linux
Guru C + XI TKJ 1 + KKA
```

---

# 14. Topics

Field:

```text
topic_id
teaching_assignment_id
title
description
status
sort_order
created_at
updated_at
```

Topic harus selalu mempunyai `teaching_assignment_id` yang valid.

---

# 15. Items

Field:

```text
item_id
topic_id
type
title
description
status
related_id
sort_order
created_at
updated_at
```

Type:

```text
materi
quiz
tugas
refleksi
```

`related_id` menunjuk ke entitas terkait sesuai tipe item.

---

# 16. Progress

Field:

```text
progress_id
user_id
item_id
status
completed_at
updated_at
```

Unique:

```text
user_id + item_id
```

Progress dibuat atau diperbarui, bukan dibuat berulang.

---

# 17. Quiz

## Quizzes

```text
quiz_id
item_id
title
description
deadline
max_attempts
status
created_at
updated_at
```

## Quiz_Questions

```text
question_id
quiz_id
type
question
options
answer
points
sort_order
```

Jenis:

```text
pg
true_false
short_answer
essay
```

Kunci jawaban tidak boleh dikirim kepada siswa sebelum submission.

---

# 18. Quiz_Submissions

Field:

```text
submission_id
quiz_id
user_id
answers
submitted_at
status
score
attempt_no
```

Untuk satu kali pengerjaan:

```text
quiz_id + user_id
```

menjadi unique.

Jika retake digunakan:

```text
quiz_id + user_id + attempt_no
```

---

# 19. Assignments

Field:

```text
assignment_id
item_id
title
description
type
template_file_id
deadline
status
created_at
updated_at
```

Type:

```text
individual
group
```

---

# 20. Groups dan Group_Members

## Groups

```text
group_id
assignment_id
name
leader_id
status
created_at
```

## Group_Members

```text
group_member_id
group_id
student_id
joined_at
```

Unique:

```text
group_id + student_id
```

Server wajib memvalidasi keanggotaan kelompok.

---

# 21. Submissions

Field:

```text
submission_id
assignment_id
group_id
user_id
file_id
file_url
submitted_at
status
updated_at
```

Untuk tugas kelompok:

```text
user_id = ketua
```

Server wajib memvalidasi bahwa pengguna memang ketua kelompok.

---

# 22. Grades

Field:

```text
grade_id
user_id
item_id
assignment_id
quiz_id
group_id
score
notes
graded_by
graded_at
```

Nilai harus memiliki referensi yang jelas terhadap aktivitas asal.

---

# 23. Reflections

Field:

```text
reflection_id
user_id
item_id
content
created_at
updated_at
```

---

# 24. Notifications

Field:

```text
notification_id
user_id
title
message
type
channel
is_read
created_at
```

MVP:

```text
in_app
email
```

WhatsApp:

```text
Phase 2
```

---

# 25. Sessions

Field:

```text
session_id
user_id
created_at
expires_at
last_active
status
```

Session tidak boleh dipercaya hanya berdasarkan data client.

---

# 26. Counters

Field:

```text
entity_name
last_number
```

Digunakan untuk generator ID jika menggunakan ID berurutan.

Generator harus menggunakan `LockService`.

---

# 27. Audit_Logs

Field:

```text
log_id
user_id
role
action
entity
entity_id
detail
created_at
```

Operasi penting:

```text
LOGIN
LOGOUT
CREATE
UPDATE
DELETE
SUBMIT
GRADE
ROLE_CHANGE
```

---

# 28. Authentication Flow

```text
User
 ↓
Login Google
 ↓
OAuth
 ↓
Authorization Code
 ↓
Token Validation
 ↓
google_sub
 ↓
Users
 ↓
Status?
 ├── inactive → reject
 └── active
       ↓
Create Session
       ↓
Dashboard
```

---

# 29. OAuth PoC

OAuth menjadi **Gate 0**.

Sebelum coding LMS:

```text
[ ] Login Google berhasil
[ ] Callback berhasil
[ ] Token valid
[ ] state valid
[ ] nonce valid
[ ] iss valid
[ ] aud valid
[ ] exp valid
[ ] email_verified valid
[ ] google_sub diperoleh
[ ] User lookup berhasil
[ ] User inactive ditolak
[ ] Session dibuat
[ ] Logout berhasil
[ ] Session expired ditolak
[ ] Role tidak dapat diubah dari client
```

Jika Gate 0 gagal:

> Jangan lanjut membangun modul LMS.

---

# 30. Authorization

Setiap fungsi protected wajib melalui:

```text
requireSession()
      ↓
requireRole()
      ↓
requireScope()
      ↓
business logic
```

Contoh:

```text
Guru A
 ↓
meminta Topic
 ↓
server mengambil teacher_id dari session
 ↓
cek Topic
 ↓
cek teaching_assignment
 ↓
cek teacher_id
 ↓
boleh / ditolak
```

Client tidak boleh menentukan sendiri:

```text
teacher_id
role
user_id untuk akses data orang lain
```

---

# 31. Role

## Admin

- kelola guru;
- monitoring;
- konfigurasi;
- backup;
- audit.

## Guru

- kelola kelas;
- kelola siswa dalam scope;
- kelola mapel yang ditugaskan;
- membuat topic;
- membuat item;
- membuat quiz;
- membuat tugas;
- membuat kelompok;
- memberi nilai;
- melihat progress siswa dalam scope.

## Siswa

- melihat kelas;
- melihat materi;
- mengerjakan quiz;
- mengumpulkan tugas;
- mengikuti kelompok;
- melihat nilai sendiri;
- mengisi refleksi.

---

# 32. Google Drive

Google Drive digunakan sebagai file storage.

```text
LMS_Utama/
├── Materi/
├── Tugas/
│   ├── Template/
│   └── Submissions/
└── Guru/
```

Database hanya menyimpan metadata:

```text
file_id
file_url
```

Operasi Drive yang lambat tidak dilakukan di dalam lock.

---

# 33. Tugas Berbasis Google Workspace

MVP menggunakan alur sederhana:

```text
Guru
 ↓
menentukan template
 ↓
Siswa membuka template
 ↓
Siswa membuat salinan
 ↓
Siswa mengerjakan
 ↓
Siswa submit link/file
 ↓
Server validasi
 ↓
Submission tersimpan
```

Otomatisasi `makeCopy()` penuh dapat ditambahkan setelah alur dasar stabil.

---

# 34. Quiz Grading

## Otomatis

```text
PG
True/False
```

## Semi otomatis/manual

```text
Short Answer
Essay
```

Essay dinilai guru.

---

# 35. Concurrency

Gunakan `LockService` pada operasi:

- generate ID;
- insert unik;
- submit quiz;
- submit tugas;
- update progress;
- membuat kelompok;
- menambah anggota kelompok;
- relasi kelas;
- relasi teaching assignment.

Jangan menahan lock ketika melakukan operasi eksternal yang lambat.

Pola:

```text
Validate
 ↓
Acquire Lock
 ↓
Re-read
 ↓
Check
 ↓
Write
 ↓
Release
```

Gunakan `try/finally`.

---

# 36. Soft Delete

Data penting tidak langsung dihapus.

Contoh:

```text
Guru
 ↓
status = inactive
```

Data historis tetap ada.

Hard delete hanya untuk data yang memang aman dihapus.

---

# 37. Error Handling

Response standar:

```javascript
{
  success: true,
  data: {},
  message: "Berhasil"
}
```

Error:

```javascript
{
  success: false,
  code: "UNAUTHORIZED",
  message: "Anda tidak memiliki akses."
}
```

Stack trace tidak ditampilkan kepada pengguna.

---

# 38. Performance

Target:

> Response halaman umum < 2 detik sebagai target pengujian.

Optimasi:

- batch read;
- batch write;
- cache;
- query hanya data yang dibutuhkan;
- hindari `getDataRange()` berulang;
- hindari operasi Drive yang tidak diperlukan;
- minimalkan `google.script.run`.

Target tersebut bukan jaminan SLA.

---

# 39. Security Checklist

```text
[ ] Session divalidasi
[ ] Role divalidasi
[ ] Scope divalidasi
[ ] Ownership divalidasi
[ ] teacher_id berasal dari server
[ ] user_id sensitif tidak dipercaya dari client
[ ] Input divalidasi
[ ] Unique constraint dicek
[ ] Lock digunakan jika diperlukan
[ ] Answer key tidak dikirim ke client
[ ] Drive access divalidasi
[ ] Error aman
[ ] Audit log dibuat untuk operasi penting
```

---

# 40. Struktur Project GAS

```text
LMS_Utama/
│
├── Code.gs
├── Config.gs
├── Auth.gs
├── Security.gs
├── ErrorHandler.gs
├── Helpers.gs
├── LockHelper.gs
│
├── Database/
│   ├── Users.gs
│   ├── Classes.gs
│   ├── ClassMembers.gs
│   ├── Subjects.gs
│   ├── TeachingAssignments.gs
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
│
├── Controllers/
│   ├── AdminController.gs
│   ├── TeacherController.gs
│   ├── StudentController.gs
│   ├── ClassController.gs
│   ├── TopicController.gs
│   ├── QuizController.gs
│   ├── AssignmentController.gs
│   ├── GroupController.gs
│   └── GradeController.gs
│
├── Services/
│   ├── DriveService.gs
│   ├── EmailService.gs
│   └── NotificationService.gs
│
└── Views/
    ├── Login.html
    ├── Admin/
    ├── Teacher/
    ├── Student/
    ├── Topic/
    ├── Quiz/
    ├── Assignment/
    ├── Group/
    ├── Progress/
    └── Grades/
```

---

# 41. Roadmap Implementasi

## Gate 0 — OAuth PoC

Output:

```text
OAuth bekerja
Session bekerja
Role bekerja
Authorization dasar bekerja
```

## Tahap 1 — Database Initializer

Membangun:

```text
Spreadsheet
Sheets
Headers
Config
Counters
```

Output:

```text
Database siap digunakan
```

## Tahap 2 — Core Security

Membangun:

```text
Session
Authorization
Scope validation
Error handling
Audit log
Lock helper
```

## Tahap 3 — Admin

```text
Login
Dashboard
Guru
Status user
Monitoring
```

## Tahap 4 — Guru

```text
Kelas
Siswa
Mapel
Teaching Assignment
Topic
Item
Materi
```

## Tahap 5 — Siswa

```text
Dashboard
Kelas
Mapel
Topic
Materi
Progress
```

## Tahap 6 — Quiz

```text
Quiz Builder
Question Builder
Take Quiz
Submit
Auto Grade
Manual Grade
Result
```

## Tahap 7 — Tugas

```text
Assignment
Template
Submit
Grading
Progress
```

## Tahap 8 — Kelompok

```text
Group
Member
Leader
Group Assignment
Submission
Grade
```

## Tahap 9 — Reporting

```text
Progress
Nilai
Dashboard
Chart
Export
```

## Tahap 10 — Notification

```text
In-App
Email
Deadline reminder
```

## Tahap 11 — Security + Concurrency Test

```text
Role tampering
Scope tampering
Duplicate submission
Concurrent submission
Cross-teacher access
Cross-student access
Session expiry
```

## Tahap 12 — Pilot

Pilot pertama:

```text
1 Admin
1 Guru
1 Kelas
10-20 Siswa
```

Setelah stabil:

```text
2-3 Guru
Beberapa kelas
50-100 siswa
```

---

# 42. Definition of Done

Sebuah modul dianggap selesai jika:

```text
[ ] Fungsi utama bekerja
[ ] Validasi input bekerja
[ ] Authorization bekerja
[ ] Scope bekerja
[ ] Error handling bekerja
[ ] Concurrency diperiksa
[ ] Audit log diterapkan jika diperlukan
[ ] UI dapat digunakan
[ ] Data tersimpan dengan benar
[ ] Tidak ada bug kritis
```

---

# 43. Kriteria Keberhasilan MVP

| Metrik | Target |
|---|---|
| Kebocoran data lintas guru | 0 |
| Kebocoran data lintas siswa | 0 |
| Duplicate submission | 0 |
| Kehilangan data | 0 |
| Bug kritis sebelum rollout | 0 |
| Login normal | Stabil |
| Guru dapat membuat materi | Berhasil |
| Siswa dapat mengakses materi | Berhasil |
| Siswa dapat mengerjakan quiz | Berhasil |
| Guru dapat melihat nilai | Berhasil |
| Backup dapat dipulihkan | Berhasil |

---

# 44. Backup dan Recovery

Backup minimal mencakup:

- database;
- konfigurasi;
- struktur sheet;
- data penting.

Recovery harus diuji.

```text
Backup
 ↓
Restore ke salinan
 ↓
Validasi data
 ↓
Test LMS
```

Backup yang tidak pernah diuji bukan recovery plan, melainkan harapan yang diberi nama folder.

---

# 45. Kapan Arsitektur Harus Dievaluasi Ulang?

Evaluasi kembali jika:

- jumlah guru melebihi target MVP;
- trafik bersamaan meningkat;
- spreadsheet menjadi bottleneck;
- operasi Drive terlalu lambat;
- kebutuhan real-time muncul;
- kebutuhan keamanan meningkat;
- kebutuhan transaksi menjadi kompleks;
- quota GAS menjadi masalah.

Alternatif masa depan:

```text
Firebase
Cloud SQL
Supabase
Cloud Run
Hybrid Architecture
```

Tidak diperlukan untuk MVP selama GAS masih memenuhi kebutuhan.

---

# 46. Fitur Phase 2

```text
[ ] WhatsApp API
[ ] Otomatisasi copy template
[ ] AI-assisted content
[ ] AI-assisted grading
[ ] Advanced analytics
[ ] Real-time features
[ ] Mobile/PWA enhancement
```

Fitur Phase 2 tidak boleh menjadi dependency untuk fungsi inti LMS.

---

# 47. Urutan Pengerjaan yang Dikunci

```text
0. OAuth PoC
      ↓
1. Database
      ↓
2. Security Core
      ↓
3. Admin
      ↓
4. Guru
      ↓
5. Siswa
      ↓
6. Quiz
      ↓
7. Tugas
      ↓
8. Kelompok
      ↓
9. Reporting
      ↓
10. Notification
      ↓
11. Security Test
      ↓
12. Pilot
```

---

# 48. Status Rancangan

**STATUS: READY FOR IMPLEMENTATION**

Rancangan ini digunakan sebagai blueprint coding.

Implementasi tidak dimulai dari seluruh LMS.

**Langkah pertama wajib: Gate 0 — OAuth PoC.**

Jika OAuth PoC berhasil, lanjut ke:

```text
Database Initializer
```

Jika OAuth PoC mengalami kendala, autentikasi diselesaikan terlebih dahulu sebelum modul lain dibangun.

---

# 49. Aturan Perubahan Rancangan

Setiap perubahan arsitektur selama coding harus:

1. dicatat;
2. memiliki alasan;
3. menyebutkan dampaknya terhadap database;
4. menyebutkan dampaknya terhadap keamanan;
5. menyebutkan dampaknya terhadap modul yang sudah dibuat.

Format:

```text
CHANGE REQUEST

ID:
Tanggal:
Bagian:
Perubahan:
Alasan:
Dampak Database:
Dampak Security:
Dampak Modul:
Keputusan:
```

---

# 50. Kesimpulan

LMS berbasis Google Apps Script ini layak dibangun sebagai MVP dengan pendekatan:

```text
Single Project
+
Single Spreadsheet
+
Google Drive
+
Server-side Authorization
+
Session
+
Relational Sheets
+
Incremental Development
```

Kunci keberhasilan:

```text
OAuth
→ Session
→ Authorization
→ Database
→ Data Integrity
```

harus benar terlebih dahulu.

Setelah fondasi stabil, fitur LMS dibangun satu per satu dengan pengujian pada setiap tahap.
