# PERUBAHAN — LMS v2 (folder `v2/`)

Catatan perubahan berkas gaya v1: setiap rilis mencantumkan berkas yang
berubah dan prioritas penyalinan ulang ke project Apps Script.

---

## STATUS SAAT INI: ROLLBACK KE TAHAP 2 (fondasi) — 2 Sep 2026

Seluruh implementasi **tahap 3** (kelas/murid/enrollment + UI kelola) dan
**tahap 4** (mapel/penugasan/topik/course/editor + port UI/UX gaya v1)
**DIHAPUS** — UI/UX dinilai masih acak dan akan dibangun ulang dengan
rancangan tampilan yang lebih matang.

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
