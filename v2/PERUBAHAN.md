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
| desain Tahap 4 — poin 1 | (commit ini) | prototipe interaktif `desain/tahap4-kelola-topik.html` — layar **Kelola Topik & Item** (guru, per course): daftar bernomor GABUNGAN topik + quiz/refleksi mandiri (§7.8b), ▲▼ tukar tetangga + renumber 1..N (item dlm topik pakai urutan dalem sendiri), 👁/🙈 draf (sembunyikan terjadwal = jadwal dibatalkan), 🕐 jadwal terbit (datetime; murid melihat tepat pada waktunya, tanpa notifikasi; publish eksplisit = notifikasi `pertemuan_baru`), ＋ Topik/Quiz mandiri/Refleksi mandiri selalu masuk PALING DASAR, edit judul; item di dalam topik menjorok garis putus (pola `.item-ptm` v1) | smoke jsdom 8/8 ✔ |
| revisi prototipe poin 1 | (commit ini) | arahan pemilik: klik **Topik / Quiz mandiri / Refleksi mandiri** = **BUAT** — membuka form (jenis terkunci, Judul*, Deskripsi, Status draf/terlihat), pola form "+ Pertemuan" v1; ＋ Item di dalam topik membuka form dgn pilihan jenis (5 jenis §7.8); ✏️ = form "Ubah" (judul/deskripsi/status, jenis terkunci); validasi judul wajib; perbaikan teknis: baris `<div>` (bukan `<button>` bersarang), selector CSS liar dihapus, klik baris topik buka/tutup digarisbawahi lewat delegasi | smoke jsdom 19/19 ✔ |
| audit rancangan poin 1 | (commit ini) | audit prototipe vs DOKUMENTASI_RANCANGAN_LMS_GAS_v2.md: ditemukan celah **FR-022/FR-026 "Menghapus/mengarsipkan topic/item"** — ditambahkan 🗑 hapus per baris & per item, SELALU lewat dialog konfirmasi (topik: menyebut jumlah item di dalamnya; kosong: "masih kosong"); gaya hover merah; petunjuk kaki layar disebut | smoke jsdom 23/23 ✔ |
| **Tahap 4 poin 1 — Kelola Topik & Item** | (commit ini) | detail course kini LANGSUNG layar kelola (klik kartu = susunan gabungan; rute `course_topik` dihapus): **backend `Topik.gs`** (13 fn: susunan gabungan, buat/ubah/hapus baris & item, status 👁/🙈 dgn jadwal batal, jadwal `scheduled`+`publish_at` lazy, `pindahBaris`/`pindahItem` tukar tetangga + renumber 1..N, notifikasi `pertemuan_baru` hanya publish eksplisit; topik terhapus = item di dalamnya ikut) + **13 endpoint `course*`** di `Code.gs`; **UI `js_course.html`** ditulis ulang — ＋ Topik/Quiz mandiri/Refleksi mandiri = **form Buat** (jenis terkunci), ＋ Item = form pilih 5 jenis §7.8, ✏️ form Ubah, 🕐 datetime, 🗑 konfirmasi (FR-022/026); css += kelas susunan (`.baris-susunan` dll, `.kisi-item`/`.item-course` dihapus); mock pratinjau mirror 13 endpoint; **bug tertangkap uji: toggle 👁/🙈 pada baris terjadwal salah arah (scheduled dianggap publish)** — diperbaiki | node 157/157 ✔ (uji-topik baru 44), alur UI 79/79 ✔, uji-ui ✔, uji-ui-extra ✔ (107 id/98 kelas) |
| audit rancangan tahap 1–3 + poin 1 | (commit ini) | audit FR & aturan rancangan vs implementasi — **5 celah ditemukan, 5 diperbaiki**: (1) **SKEMA `Setup.gs` belum §7.8/§7.8b** — Topics/Items tanpa `publish_at`, Items tanpa `ta_id`, enum tanpa `scheduled` (DB nyata tak akan menyimpan jadwal/mandiri; seed ikut disesuaikan; `migrasiStruktur()` kini menambah kolom tsb); (2) **audit log §16.2** — `BUAT/HAPUS_TOPIK`, `BUAT/HAPUS_ITEM` di `Topik.gs` (+3 cek uji-topik); (3) **FR-092** tandai notifikasi dibaca — endpoint `notifTandaiDibaca` ('' = semua) + lonceng menandai saat panel dibuka; (4) **FR-011** tombol **🗑 Arsipkan** kelas di Kelola Kelas (backend `kelasArsip` sudah ada sejak Tahap 3, UI/mock/uji menyusul sekarang; ditolak bila masih ada course aktif); (5) **§16.3** `sesiBersihkan()` + `pasangTriggerSesi()` di `Setup.gs`. **Dibuka utk keputusan pemilik:** FR-091 email notifikasi belum diimplement sama sekali; FR-013 murid melihat anggota kelas juga belum | uji-topik 47, alur UI 83/83 ✔, uji-ui & extra ✔ |
| keputusan 2026-09-03 | (commit ini) | 3 keputusan pemilik tercatat di rancangan: **§5.8 login alternatif murid pakai No. WA + tgl lahir** (rancangan), **FR-091 email = dikirim manual oleh guru**, **FR-013 murid lihat anggota kelas = tidak perlu**; rencana "Ingat saya" dibatalkan | — |
| **§5.8 login pakai Nomor WA** | (commit ini) | **WAJIB salin ulang: `Auth.gs`, `Code.gs`, `v_login.html`, `js_auth.html`** — murid lupa username/sandi tapi biodata terisi dapat masuk dengan No. WA + tgl lahir: normalisasi 62…, hanya murid aktif, **langsung masuk TANPA ganti sandi & tanpa arahan biodata** (`harus_ganti_password` tetap hanya di login username), WA+tgl ganda pada >1 akun → ditolak netral, batas 5x/15 mnt per WA, audit `LOGIN_WA` (ekor nomor saja), endpoint publik `loginWa`; UI: tombol mode di layar login (form WA ⇄ username); mock: citra `081234567003/2009-05-10`, biodata_ok kini per-pengguna | uji-login-wa 21/21 (baru), node 178/178, alur UI 87/87 ✔, uji-ui & extra ✔ |
| struktur isi course dikoreksi | (commit ini) | permintaan pemilik produk — detail course kini **3 item: Topik · Quiz mandiri · Refleksi mandiri** (bukan 4) — sesuai §7.8b poin 1 (quiz/refleksi boleh mandiri); **di dalam Topik** ada **5 item persis enum §7.8 `Items.type`**: 📖 Materi · 👤 Tugas Individu · 👥 Tugas Kelompok · ❓ Quiz · 🪞 Refleksi (awalnya 4 dgn istilah v1 "LKPD" — dikoreksi ke penamaan rancangan) via rute baru `course_topik` (kembali → detail course); Quiz/Refleksi mandiri masih placeholder Tahap 4; catatan layar topik mengutip §7.8/§7.8b (materi & tugas wajib bertopik; bernomor ↑↓, 👁/🙈, jadwal tayang = Tahap 4) | alur UI 64/64 ✔ |
| Perlu Tindakan bisa diproses | (commit ini) | permintaan pemilik produk — beranda guru: tiap baris **Perlu tindakan** kini BISA DIKLIK → langsung reset sandi siswa (`requestId` ikut dikirim → server menandai permintaan selesai, antrean berkurang otomatis; beranda di-segarkan); tombol diganti **"Lihat"** → dialog **daftar lengkap** (endpoint `getPermintaanReset`, menggulir bila panjang — jawaban utk >20 item: beranda cukup 5 terbaru + hitungan, sisanya lewat "Lihat"); hitungan judul & baris terhapus langsung saat diproses; dialog mencantumkan bahwa jenis lain (nilai tugas individu/kelompok, uraian quiz) otomatis muncul saat fiturnya aktif; `js_murid` mengekspor `resetSandi`/`tampilSandiReset` (dipakai lintas layar); css += `button.tindak-baris`; mock pratinjau antrean stateful | alur UI 62/62 ✔ |
| bentuk baru Kelola Kelas & Course | (commit ini) | permintaan pemilik produk — **Kelola Kelas**: kisi kartu diganti **dropdown pilih kelas + tabel daftar siswa** di bawahnya; tombol Edit/Tambah murid aktif setelah kelas dipilih; kelas baru otomatis terpilih; dropdown segar setelah enroll/keluarkan (rute `kelas_detail` dihapus — semuanya satu layar). **Kelola Course**: tabel diganti **kartu course** (gaya kartu kelas dulu; Buka →/Edit/Hapus per kartu); dibuka → layar **detail 4 item pilihan** (📖 Materi · 📝 LKPD · ❓ Quiz · 🪞 Refleksi — pola pertemuan v1, konten menyusul Tahap 4; rute baru `course_detail`); css += `.kisi-item`/`.item-course` | alur UI 57/57 ✔ |
| urutan sidebar | (commit ini) | menu guru diurut ulang: **Kelola Murid di atas Kelola Kelas** (`v_dashboard`) — selaras urutan kesepakatan §22D (Beranda → Murid → Kelas → Course → Rekap → API Key) | — |
| dialog tambah murid: list + filter rombel | (commit ini) | permintaan pemilik produk — dialog "＋ Tambah murid ke kelas" diganti **daftar nama** (`.pilih-list`/`.pilih-baris`: checkbox + avatar inisial + nama + username · rombel · info "sudah di kelas X") dengan **filter rombel** (dropdown dari `Users.rombel` unik, terurut alami) + penghitung "N tersedia · M dipilih"; keadaan centang bertahan lintas penyaringan; backend `Kelas.muridTersedia` kini membawa `rombel`; css += gaya list; mock pratinjau ikut; +5 cek alur, +1 uji node/editor | node 113/113 ✔ (uji-kelas 56), alur UI 54/54 ✔ |
| perbaikan tambah murid ke kelas | (commit ini) | **WAJIB salin ulang: `js_kelas.html`** — 2 ketidakcocokan kontrak yang membuat "＋ Tambah murid" di detail kelas tidak berfungsi di app nyata: (1) `kelasMuridTersedia` dipanggil TANPA `classId` (padahal wajib) → `TIDAK_DITEMUKAN` → dialog tak terbuka; (2) `kelasEnroll` dikirim array OBJEK `{user_id,nama}` padahal kontraknya array STRING user_id → semua "dilewati" tanpa pesan; kini sesuai uji node; label "sudah di kelas X" dibaca dari objek `m.kelas[].name`; mock pratinjau ikut kontrak nyata (mengecualikan terdaftar); +2 cek alur (dialog terbuka dgn daftar, enroll → detail bertambah) | alur UI 51/51 ✔ |
| css digayakan v1 | (commit ini) | `css.html` ditulis ulang memakai bahasa desain v1 (KESEPAKATAN-SISTEM.md §1) — palet `--hijau #7BC96F`/`--hijau-tua #4E9A4A`/`--hijau-muda #D9F2D4`/`--permukaan #F6FBF5`, font Plus Jakarta Sans, baris 1.6, radius 12/8px, bayangan lembut; tombol `min-height:44px` (kecil 36px) + `:active` turun 1px; isian 44px fokus ring `rgba(123,201,111,.22)` + placeholder `#9AAB9B`; lencana gaya `.lencana` v1; login gradien terang `hijau-muda→permukaan` ikon emoji 2.6rem; sidebar kini PUTIH ber-tepi `--garis` (menu aktif `hijau-muda`/`hijau-tua` — gaya tab v1), bukan gelap; tabel `th` v1 (tanpa kapital); dialog gaya v1 (aksi sticky menempel semua ukuran; ponsel hampir selebar layar); toast animasi `naik` + lebar v1; jaring pengaman `overflow-x:hidden` v1.6.6; sukses-sandi = `.kotak-kode` v1; titik notif belum-baca = `--peringatan`. Nama kelas & struktur TIDAK berubah — js/template tak tersentuh; `index.html`: theme-color `#4E9A4A` | semua uji ✔ (node 112/112, alur 49/49) |
| menu akun di profil | (commit ini) | klik blok profil di bawah sidebar → popover **menu akun** (atas blok profil): **Biodata Saya** (hanya murid; guru tidak melihatnya) + **Keluar**; item "Biodata Saya" dikeluarkan dari nav utama (bukan lagi menu tingkat atas); rute `biodata` & arahan otomatis saat biodata kurang tetap; tombol ⏻ keluar cepat tetap ada; tutup: pilih item / klik di luar / pindah rute | alur UI 49/49 ✔ |
| kartu Kelas Saya (murid) | (commit ini) | backend: `Kelas.kelasSaya(sesi)` + endpoint **`kelasSaya`** (role murid) — kelas yang diikuti aktif + daftar mapel dari course aktif, kelas terarsip tak tampil; UI: beranda murid += seksi **"Kelas saya"** (kartu per kelas: nama, TA, jml course + nama mapel; kosong → ajak hubungi guru); **WAJIB salin ulang: `Kelas.gs`, `Code.gs`, `js_beranda.html`**; sekalian: `js_course.html` kini mengirim `{name}` sesuai kontrak `Course.simpan` (sebelumnya `subject_name` → buat/edit course di app nyata gagal — tertangkap saat menguji kelasSaya); `pratinjau/bangun.py` dipindah ke dalam repo (awet reset lingkungan), hasil build di-`.gitignore` | node 112/112 ✔ (uji-kelas 55), alur UI 47/47 ✔ |
| perbaikan laporan pemakaian nyata | (commit ini) | 3 perbaikan: **(1) sidebar per role** — murid tidak lagi melihat menu guru; menu murid = Beranda + **Biodata Saya** (`v_dashboard` data-role, `js_core` sembunyikan milik role lain, boot biodata_kurang → layar biodata); **(2) alur lupa akses §5.5 dibenarkan** — sebelumnya UI hanya memanggil `ajukanReset`; kini 2 jalur mandiri (`lupaPassword` username+WA+tgl lahir; `lupaUsername` email+WA+tgl lahir → username ikut tampil), sandi sementara tampil SEKALI + salin, gagal → pesan netral + tawaran jalur guru, dialog form memakai `saatYa` return-false (tetap terbuka saat gagal); **(3) layar Biodata Saya** — murid bisa lihat/edit biodata setelah lengkap (endpoint baru **`getBiodata`**, role murid); +3 uji node & +3 uji editor | node 106/106 ✔, uji-lupa-akses 35 ✔, alur UI 44/44 ✔ |
| beranda: pintasan → Course saya | (commit ini) | `js_beranda.html`: seksi "Pintasan menu" (5 tautan statis) diganti **"Course saya"** — daftar course nyata milik guru via `courseDaftar` (urut aktif dulu lalu label; baris: mapel + kelas · TA · jml murid + badge status; kosong → ajak buat course; klik → Kelola Course; tautan "Kelola semua →"); `css.html` += `.judul-seksi.aksi`, `.barang-course`, `.barang-tengah` | uji alur 34/34 ✔ |
| responsif menyeluruh | (commit ini) | `css.html`: 4 breakpoint (1024/900/700/380) — ponsel: target sentuh ≥42px, isian 16px (anti zoom iOS), tabel ringkas + gulir halus, dialog jadi lembar bawah (bottom sheet) dgn aksi menempel di dasar, kisi-stat 2 kolom, kepala-aksi penuh; sidebar off-canvas melebar min(280px, 84vw) + body terkunci saat terbuka + auto-tutup saat layar melebar; safe-area iOS; + `theme-color`. Perbaikan: `var(--garis)` tak terdefinisi → `--tepi`; kelas `boleh-kembali` menimpa `display` `.kepala` dihapus dari markup & css | semua uji ✔ |
| perbaikan deploy GAS | (commit ini) | **WAJIB salin ulang: `index.html`, `js_core.html`, `Code.gs`** — akar masalah `Uncaught SyntaxError: Unexpected token '&lt;'`: (1) scriptlet `<?= appNama ?>` ditaruh di js_core.html, padahal berkas include via `createHtmlOutputFromFile` tak dievaluasi → teks `<?=` mentah terkirim; (2) `muatJs()` merakit tag `<script>` sebagai string dinamis → blok ikut ter-escape di pembungkus iframe GAS. Sekarang: scriptlet HANYA di index.html (TYDATA + include statis per berkas, pola v1), `muatCss/muatJs` dihapus, `uji-ui-extra` +2 pengawet (larang `<?` di luar index; validasi daftar `include`) | semua uji ✔ |
| perbaikan dialog + uji alur | (commit ini) | `js_core`: dialog tak lagi menghapus DOM sebelum penelepon membaca isian form (bug tertangkap uji alur jsdom); + `test/uji-alur-ui.js` — 31 cek alur klik nyata (login guru/murid, semua menu, dialog, lonceng, logout) di atas pratinjau statis; dilewati otomatis bila jsdom/pratinjau tidak ada | 31/31 alur ✔ |
