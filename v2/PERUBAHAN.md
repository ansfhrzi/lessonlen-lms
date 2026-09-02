# PERUBAHAN — LMS v2 (folder `v2/`)

Catatan perubahan berkas gaya v1: setiap rilis mencantumkan berkas yang
berubah dan prioritas penyalinan ulang ke project Apps Script.

---

## STATUS SAAT INI: BACKEND + UI TAHAP 3 SELESAI — 2 Sep 2026

Catatan riwayat di bawah: seluruh implementasi **tahap 3–4 lama**
dihapus karena UI/UX dinilai masih acak, lalu dibangun ulang bertahap
mengikuti kesepakatan §22D. Kini **backend Tahap 3 (3.1–3.5) dan UI
Tahap 3 tuntas**; lanjut ke rancangan Tahap 4 (konten course).

- Kondisi yang dipulihkan = pohon commit **`7cc93e9`** (tahap 2: skema
  23 sheet, `Auth.gs` lengkap, UI login + cangkang dasbor).
- **Kode tahap 3–4 tidak hilang** — arsip di riwayat git:
  | Yang dicari | Cara ambil |
  |---|---|
  | Tahap 3 utuh (Kelas.gs, Notif.gs, js_kelola, uji-kelas, …) | `git checkout a63527b -- v2/` |
  | Satu berkas versi tertentu | `git show <commit>:v2/<berkas>` |
  | Peta rilis tahap 4.1–4.9 | `git log --oneline a63527b..c1c0157` |
- Rancangan fitur & skema (§7.7/§7.8/§7.8b, keputusan v2.1 di
  `DOKUMENTASI_RANCANGAN_LMS_GAS_v2.md`) **tetap berlaku** — yang diulang
  hanyalah implementasi UI/UX-nya.

### Kesepakatan alur baru — 2 Sep 2026 (§22D dokumen rancangan)

Dashboard guru = **5 menu**: Kelola Kelas · Kelola Course · Kelola Murid ·
Rekap Nilai · Status API Key. Keputusan turunan yang menyentuh kode tahap 2:

- **Kata sandi murid = model v1 persis** (revisi hari itu juga):
  hash SHA-256 + salt; guru melihat **`pwd_awal`** (sandi sementara
  terakhir) sampai murid menggantinya — setelah itu perlu reset.
  **TIDAK ADA perubahan skema** — `Setup.gs`/`Auth.gs`/`Util.gs`/uji
  gate0 tidak tersentuh sama sekali.
- **"Course" = istilah UI** untuk sheet `Teaching_Assignments`; mapel
  diketik bebas → auto-dedupe ke `Subjects`.
- **Status API Key** = Script Properties (≤10 key, cooldown) — tanpa sheet.
- **Beranda ringkas** tetap ada; notifikasi cukup lonceng (tanpa menu).
- **Rekap Nilai** dibangun setelah quiz & tugas; sementara placeholder.
- 23 sheet: **tidak ada sheet baru yang ditambah/dihapus** selain kolom
  `Users` di atas.

### Prototipe tampilan — `desain/tampilan-v2.html` (2 Sep 2026)

Berkas **mockup interaktif** (HTML mandiri, data dummy) untuk KESEPAKATAN
TAMPILAN sebelum Tahap 3 dibangun: login, beranda guru ringkas, Kelola
Kelas + detail (+enroll/keluarkan + sandi sementara), Kelola Course
(kartu "KELAS - MAPEL" + dialog buat), Kelola Murid (tabel + detail sandi
+ reset + impor massal + pratinjau), Rekap Nilai (placeholder), Status
API Key (10 slot + status). Ada pengalih tema (Indigo/Biru/Hijau) dan
peta layar. **Bukan berkas Apps Script** — tidak disalin ke editor;
nanti dipecah menjadi partial sesuai hasil kesepakatan.

### Tahap 3.1 — backend Kelola Murid (2 Sep 2026)

Backend menu **Kelola Murid** (alur §22D) — port setia perilaku v1:

- **BARU `Murid.gs`** 🔴 wajib salin: `daftar` (cari/filter status + kelas
  diikuti), `detail` (+`pwd_awal` & `sudah_ganti`), `simpan`
  (tambah/edit sebagian; sandi sementara otomatis; nonaktif → sesi
  dicabut), `pratinjauImpor` & `impor` (format `nama, rombel, username,
  password`; dedupe username pakai akhiran; sandi kustom guru
  divalidasi aturan sama; maks 100 baris).
- `Code.gs` 🔴 wajib salin: +5 endpoint `muridDaftar / muridDetail /
  muridSimpan / muridPratinjauImpor / muridImpor` (semua `_bungkus`
  role `guru`).
- `Auth.gs` **tidak berubah** — `resetPasswordMurid` sudah ada dari
  tahap 2; `pwd_awal` dikosongkan otomatis saat murid ganti sandi.
- Uji node **`test/uji-murid.js` — 65 kasus lulus** (tambah/edit/filter/
  detail/impor/pratinjau/pencabutan sesi/endpoint); `test/mock.js` +
  header sheet baru & `cariCepat`/`getValue` (untuk uji saja — tidak
  disalin ke editor).
- Total uji node kini: gate0 18 + murid 65 = **83**, plus `uji-ui.js`.

### Tahap 3.1b — Uji.gs (uji dari editor Apps Script)

**BARU `Uji.gs`** 🔴 wajib salin (bersama berkas server). Dijalankan dari
editor terhadap DB sungguhan — pasangan uji node:

- `ujiSemua()` = `ujiGate0()` (21 cek: login seed, token, pesan seragam,
  ganti sandi + `pwd_awal` kosong, kunci 5×/15 mnt, ajukan reset → antre →
  reset guru → sandi sementara, nonaktif ditolak) + `ujiMurid()` (20 cek:
  tambah/duplikat/daftar/detail/edit-sebagian/nonaktif-cabut-sesi/
  pratinjau=impor/endpoint role).
- Pra-cek berkas & skema dengan petunjuk perbaikan eksplisit
  ("salin Murid.gs", "salin ulang Code.gs", "jalankan setupLengkap()").
- Aman diulang: data uji berpenanda `uXXXXXX`, diakhiri pembersihan
  otomatis (Users/Session/Permintaan_Reset/kunci cache); akun seed
  tidak pernah diubah; akun seed dibuat otomatis bila DB kosong.
- Terverifikasi: 41/41 lulus (mock harness lokal).

### Tahap 3.1c — lupa sandi/username mandiri (keputusan 2026-09-02)

Alur baru (§5.5 dokumen): murid membuktikan biodata → sandi direset
otomatis. **PERUBAHAN SKEMA: kolom `Users.tanggal_lahir`** — bila DB
sudah dipasang, jalankan **`migrasiStruktur()`** sekali setelah salin
berkas.

- `Setup.gs` 🔴 — SKEMA Users +`tanggal_lahir` (teks `YYYY-MM-DD`).
- `Util.gs` 🔴 — +`tglLahirSah()` (terima `YYYY-MM-DD`/`DD/MM/YYYY`,
  bakukan, tolak tanggal nyata-tak-sah & masa depan); biodata lengkap =
  email + no WA + tanggal lahir (**NISN opsional**).
- `Auth.gs` 🔴 — +`simpanBiodata` (murid isi biodatanya), `lupaPassword`
  (username + no WA + tgl lahir → sandi baru), `lupaUsername` (email +
  no WA + tgl lahir → username tampil + sandi baru); jawaban gagal
  netral anti-enumerasi; batas 5×/15 menit; sesi lama tercabut;
  hanya murid aktif.
- `Code.gs` 🔴 — +3 endpoint: `simpanBiodata`, `lupaPassword` (publik),
  `lupaUsername` (publik).
- Uji: node `test/uji-lupa-akses.js` **32 kasus**; editor `ujiLupaAkses()`
  **14 cek** (pra-cek kolom → petunjuk `migrasiStruktur()`); `Uji.gs`
  kini `ujiSemua()` = 55 cek.

### Tahap 3.2 — backend Kelola Kelas (2 Sep 2026)

- **BARU `Kelas.gs`** 🔴 wajib salin: `daftar` (+jml murid/course),
  `simpan` (buat/edit; nama dedupe tak-peka-huruf; tahun ajaran otomatis),
  `arsip` (soft delete; **ditolak** bila masih dipakai course aktif),
  `detail` (murid ter-enroll + `pwd_awal`/`sudah_ganti`),
  `muridTersedia` (bahan dialog enroll + kelas lain yang diikuti),
  `enroll` (proses persis v1: aktif→dilewati, keluar→reaktivasi;
  notif `enroll_kelas` hanya ke yang berubah), `keluarkan`.
- `Code.gs` 🔴 wajib salin: +7 endpoint `kelasDaftar / kelasDetail /
  kelasSimpan / kelasArsip / kelasMuridTersedia / kelasEnroll /
  kelasKeluarkan` (semua role `guru`).
- Uji: node `test/uji-kelas.js` **48 kasus**; editor `ujiKelas()` 15 cek
  → `ujiSemua()` kini **70 cek**. `test/mock.js` +`perbaruiBanyak`.

### Tahap 3.3 — backend Kelola Course (2 Sep 2026)

- **BARU `Course.gs`** 🔴 wajib salin: `daftar` (label `KELAS - MAPEL` +
  jml murid), `detail`, `simpan` (buat = pilih kelas + tulis nama mapel
  bebas → **auto-dedupe ke `Subjects`** milik guru; duplikat pasangan
  kelas+mapel ditolak `DUPLIKAT`; edit ganti kelas dan/atau mapel;
  buat ulang course yang pernah dihapus → **reaktivasi**, bukan baris
  baru; kelas terarsip ditolak), `hapus` (= lepas relasi, status
  nonaktif — kelas & mapel tidak terhapus).
- `Code.gs` 🔴 wajib salin: +4 endpoint `courseDaftar / courseDetail /
  courseSimpan / courseHapus` (role `guru`).
- Uji: node `test/uji-course.js` **41 kasus**; editor `ujiCourse()` 13 cek
  → `ujiSemua()` kini **83 cek**.

### Tahap 3.4 — backend Status API Key (2 Sep 2026)

- **BARU `ApiKey.gs`** 🔴 wajib salin: `status` (daftar key: ekor 4 digit
  terakhir saja + status `siap`/`istirahat`/`bermasalah`, cursor rotasi),
  `simpan` (MENIMPA seluruh daftar; **maks 10 key**; bentuk ≥30 karakter
  tanpa spasi; daftar kosong = mencabut semua; menghapus semua cooldown),
  `resetCooldown` (tombol "Coba Lagi Sekarang"). Key disimpan di
  **Script Properties `GEMINI_KEYS`** — bukan spreadsheet, tak pernah
  terkirim ke klien; nama properti & kunci cooldown identik v1
  (`gemini_cd_<i>_<model>`, `gemini_key_rusak_<i>`) sehingga port
  `Ai.gs` nanti kompatibel tanpa migrasi.
- `Code.gs` 🔴 wajib salin: +3 endpoint `apiKeyStatus / apiKeySimpan /
  apiKeyResetCooldown` (role `guru`).
- Uji: node `test/uji-apikey.js` **31 kasus**; editor `ujiApiKey()` 12 cek
  → `ujiSemua()` kini **95 cek**.

### Tahap 3.5 — backend Beranda ringkas (2 Sep 2026) — BACKEND TAHAP 3 TUNTAS

- `Code.gs` 🔴 wajib salin: `ringkasDashboard` guru dibentuk ulang ke
  §22D — 4 angka (`kelas_aktif`, `course_aktif`, `murid_aktif`,
  `api_key {jml, maks, jml_siap, terpasang}`) + **perlu tindakan**
  (antrean permintaan reset + identitas murid, daftar maks 5, jml utuh);
  murid + `biodata_kurang`.
- Uji: node `test/uji-beranda.js` **18 kasus**; editor `ujiBeranda()` 8 cek
  → `ujiSemua()` kini **103 cek**. `test/mock.js` +`bacaKolom` shim.

### Berkas yang harus ada di editor Apps Script (kondisi tahap 2)

| Berkas | Isi | Status |
|---|---|---|
| `Setup.gs` | pemasangan skema 23 sheet | = tahap 2 |
| `Db.gs` | akses sheet (header, cari, tambah, perbarui) | = tahap 2 |
| `Util.gs` | util (SHA-256, token, waktu, audit) | = tahap 2 |
| `Auth.gs` | login / ganti sandi / lupa sandi / reset, sesi | = tahap 2 |
| `Code.gs` | router endpoint + `doGet` | = tahap 2 |
| `css.html`, `index.html` | cangkang aplikasi | = tahap 2 |
| `v_login.html`, `v_dashboard.html` | layar login & dasbor | = tahap 2 |
| `js_core.html`, `js_auth.html` | inti klien (router hash, dialog) & logika auth | = tahap 2 |

**Dihapus dan JANGAN ditinggalkan di editor**: `Kelas.gs`, `Notif.gs`,
`Mapel.gs`, `Uji.gs` (suite editor lama menguji fungsi tahap 3–4 yang sudah
tidak ada — akan membuat error), `js_beranda.html`, `js_kelola.html`,
`js_mapel.html`, `v_editor.html`. Bila editor masih memuatnya lewat
`index.html` lama, salin ulang `index.html` versi tahap 2.

### Uji (node)

| Uji | Isi |
|---|---|
| `test/uji-auth-gate0.js` | 18 uji fondasi auth — **lulus** |
| `test/uji-ui.js` | **BARU** — audit statis fungsi klien *dipanggil-tapi-tak-terdefinisi* (kelas bug `dialogTopik is not defined` yang dulu lolos); daftar berkas dideteksi otomatis dari isi `v2/`, jadi tetap sah saat tahap baru ditambahkan |
| `test/uji-ui-extra.js` | **BARU (UI Tahap 3)** — audit statis lanjutan: kecocokan `id=` vs `getElementById/$(…)`, `Core.api('fn')` vs fungsi global `.gs`, kelas CSS dipakai vs didefinisikan `css.html`, rute `data-rute`/`pergiKe` vs `daftarRute` |

---

## Riwayat

| Rilis | Commit | Isi | Uji |
|---|---|---|---|
| tahap 1–2 (fondasi) | `7cc93e9` | skema 23 sheet, auth lengkap, UI login + dasbor | gate0 18 |
| tahap 3 | `a63527b` | kelas/murid/enrollment + UI kelola | +42 |
| tahap 4 → 4.9 | `8e443c0` → `c1c0157` | mapel/penugasan/topik/course/editor + port UI/UX v1 (riwayat per sub-tahap: `git log --oneline a63527b..c1c0157`) | hingga 113+18 |
| **rollback ke tahap 2** | `f1d10e2` | hapus seluruh UI/UX & fungsi tahap 3–4; pohon = `7cc93e9`; + `test/uji-ui.js` | gate0 18 ✔, UI ✔ |
| keputusan alur | (commit ini) | §22D: 5 menu dashboard, sandi teks (`Users.password`), beranda ringkas, rekap menyusul — **dokumen saja** | — |
| revisi keputusan | (commit ini) | sandi murid kembali model v1 (hash+salt + `pwd_awal`) — §22D diperbarui; **nol perubahan skema** | — |
| desain | (commit ini) | prototipe tampilan interaktif `desain/tampilan-v2.html` — bahan kesepakatan UI Tahap 3 | — |
| tahap 3.1 | (commit ini) | backend Kelola Murid: `Murid.gs` baru + 5 endpoint + 65 uji node | +65 |
| tahap 3.1b | (commit ini) | `Uji.gs` — uji editor (`ujiGate0` + `ujiMurid`) | +41 |
| tahap 3.1c | (commit ini) | lupa akses mandiri: kolom `tanggal_lahir` + 3 endpoint + 32 uji node + `ujiLupaAkses()` | +32 node, +14 editor |
| tahap 3.2 | (commit ini) | backend Kelola Kelas: `Kelas.gs` + 7 endpoint + 48 uji node + `ujiKelas()` | +48 node, +15 editor |
| tahap 3.3 | (commit ini) | backend Kelola Course: `Course.gs` + 4 endpoint + 41 uji node + `ujiCourse()` | +41 node, +13 editor |
| tahap 3.4 | (commit ini) | backend Status API Key: `ApiKey.gs` + 3 endpoint + 31 uji node + `ujiApiKey()` | +31 node, +12 editor |
| tahap 3.5 | (commit ini) | backend Beranda ringkas (§22D) + 18 uji node + `ujiBeranda()` — **backend Tahap 3 selesai** | +18 node, +8 editor |
| **UI Tahap 3** | (commit ini) | klien lengkap ala prototipe: `css.html` sistem desain baru (tema hijau `#2F6B2B`, token `:root`), `v_login` restyle, `v_dashboard` cangkang sidebar+topbar+lonceng, `js_core` +router/dialog/toast, `js_auth` +ganti sandi & biodata, **5 modul layar baru** (`js_beranda`/`js_murid`/`js_kelas`/`js_course`/`js_rekap`/`js_apikey`), `Code.gs` +`muatCss`/`muatJs`; + `test/uji-ui-extra.js` (audit id/endpoint/CSS/rute) | uji node 103/103 ✔, uji-ui ✔, uji-ui-extra ✔ |
| perbaikan dialog + uji alur | (commit ini) | `js_core`: dialog tak lagi menghapus DOM sebelum penelepon membaca isian form (bug tertangkap uji alur jsdom); + `test/uji-alur-ui.js` — 31 cek alur klik nyata (login guru/murid, semua menu, dialog, lonceng, logout) di atas pratinjau statis; dilewati otomatis bila jsdom/pratinjau tidak ada | 31/31 alur ✔ |
