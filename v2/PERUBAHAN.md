# Catatan Perubahan — LMS v2

Dipakai untuk mengetahui berkas mana yang perlu disalin ulang ke editor
Apps Script setelah ada pembaruan. Konvensi commit: `tahap N v2: …`;
semua uji logika di `test/` harus hijau sebelum commit.

Angka uji terakhir: **Gate 0 = 18 · Tahap 3 = 42 · Tahap 4 = 113 → 173 total**.

---

## Perubahan sejak rilis Tahap 4 (`8e443c0`)

Gabungan commit `9d8ee6f` … `a70119c` (tahap 4.1–4.8 + dokumen).
Bila Anda memasang versi Tahap 4 lama, **salin ulang seluruh daftar 🔴 di
bawah** lalu jalankan `migrasiStruktur()`.

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Setup.gs` | 🔴 **Wajib + migrasi** | Skema: `Topics.publish_at`, `Items.publish_at`, `Items.ta_id`; status enum + `scheduled` |
| `Util.gs` | 🔴 **Wajib** | Helper `terlihatMurid(status, publish_at)` — aturan "terlihat murid" |
| `Mapel.gs` | 🔴 **Wajib** | Item mandiri, jadwal terbit, penyaringan terlihat, `topikDaftar` + `mandiri[]`, `topikMurid` + `item[]`/`mandiri[]`/`urutan[]`, `itemDetail`, `coursePindah` (renumber 1..N lintas sheet), `_urutBerikutCourse` |
| `Kelas.gs` | 🔴 **Wajib** | `kelasSaya`: `mapel[].jml_topik` (terlihat murid) untuk kartu course |
| `Code.gs` | 🔴 **Wajib** | Endpoint baru `getItemGuru`, `getBiodataSaya`, `coursePindah`; `topikUbahStatus`/`itemUbahStatus` bertambah argumen `publishAt` |
| `css.html` | 🔴 **Wajib** | Port design system v1 + editor konten, `baris-pertemuan`/`nomor-pertemuan`, `blok-pertemuan`/`item-ptm`, `bingkai-video`, `pv-gulir`, `rayakan`, `code.salin` |
| `index.html` | 🔴 **Wajib** | Shell baru + include `v_editor`, `js_beranda` |
| `v_login.html` · `v_dashboard.html` | 🔴 **Wajib** | `tpl-login`/`tpl-lupa` gradient v1; cangkang `topbar-slot + isi-halaman` |
| `v_editor.html` | 🔴 **BARU — wajib** | Cangkang editor item (toolbar, mode HTML, bar-aksi + ⏰ Jadwalkan) |
| `js_core.html` | 🔴 **Wajib** | `callApi` (unwrap `{ok,data}`), router hash, topbar+lonceng, sidebar menu + laci, dialog global, toast, `salinTeks`, `namaKelasLengkap`, `mulai()` |
| `js_auth.html` | 🔴 **Wajib** | Login/ganti sandi/lupa/profil/biodata gaya v1 |
| `js_beranda.html` | 🔴 **BARU — wajib** | Beranda guru (kartu course `KELAS - MAPEL` + jml draf) & murid, notifikasi, antrean reset |
| `js_kelola.html` | 🔴 **Wajib** | Kelola kelas/murid gaya v1, impor pratinjau, `dialogHasilSandi`, `code.salin` |
| `js_mapel.html` | 🔴 **Wajib** | Layar course (susunan gabungan bernomor, 👁/🙈, ⏰, `+ isi`), editor item, daftar isi murid campuran ala guru, pembaca |
| `README.md` | 🟡 Opsional | Skema, API, langkah pasang |
| `test/mock.js` · `test/uji-tahap4.js` | 🟡 Opsional* | HEAD mock + 29 uji baru (84 → 113) |
| `DOKUMENTASI_RANCANGAN_LMS_GAS_v2.md` | 🟡 Opsional | §7.7/§7.8 dikoreksi + §7.8b adendum alur course + riwayat no. 19 |

\* Wajib bila memakai `Uji.gs`/uji node di editor.

**Tidak berubah**: `Auth.gs` · `Db.gs` · `Notif.gs` ·
`test/uji-auth-gate0.js` · `test/uji-kelas.js`.

### Tambahan 4.9 — uji editor untuk laporan "quiz mandiri → topik baru error"

`Uji.gs` bertambah suite **`ujiCourse()`** (terdaftar di `ujiSemua`, bisa
dijalankan sendiri dari editor: `ujiCourse()`). Ia mereproduksi persis
skenario yang dilaporkan — buat quiz mandiri, lalu buat topik baru —
langkah demi langkah di DB nyata, PLUS pra-cek yang menunjuk penyebab
paling mungkin bila error masih terjadi:

| Uji prasyarat | Artinya bila GAGAL |
|---|---|
| `SKEMA: Items punya kolom "ta_id"` / `"publish_at"` | Kolom belum ada → jalankan `migrasiStruktur()` dari editor |
| `SKEMA: Topics punya kolom "publish_at"` | sama seperti di atas |
| `BERKAS: coursePindah ada` | `Code.gs`/`Mapel.gs` belum tersalin versi baru |

Hasil pada kode terbaru: **18/18 lulus** — skenario tidak bisa
direproduksi; bila di editor Anda uji ini berhenti di LANGKAH 2 atau
prasyarat, petunjuk di kolom pesan menunjukkan perbaikannya.

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Uji.gs` | 🔴 **Wajib** (untuk yang memakai uji editor) | + suite `ujiCourse()` 18 uji; terdaftar di `ujiSemua` |

### Rincian

**Skema & migrasi — `Setup.gs`**

Tiga kolom baru: `Topics.publish_at`, `Items.publish_at` (jadwal terbit),
`Items.ta_id` (penghubung item mandiri ke course). Status `Topics`/`Items`
menjadi `draft | publish | scheduled`. DB lama menyesuaikan dengan
**menjalankan `migrasiStruktur()` sekali dari editor** — kolom disisipkan
otomatis, data lama utuh, aman diulang.

**Item mandiri — `Mapel.gs`, `Code.gs`**

Quiz & refleksi boleh berdiri langsung di course tanpa topik
(`topic_id` kosong + `ta_id` terisi). Materi & tugas tetap wajib bertopik
(ditolak `VALIDASI_GAGAL` bila mencoba mandiri). Item mandiri baru
mendapat `sort_order` di tingkat course; `itemPindah` mereka berurut
dalam kelompok mandiri, bukan topik.

**Jadwal terbit — `Util.gs` + `Mapel.gs`**

`scheduled` + `publish_at` → otomatis terlihat murid tepat saat waktunya;
dievaluasi saat murid membuka (lazy, `Util.terlihatMurid`) — tanpa trigger
waktu Apps Script dan tanpa notifikasi. Notifikasi `pertemuan_baru` tetap
hanya untuk publish eksplisit. Menyembunyikan (🙈) yang terjadwal
membatalkan jadwalnya.

**Satu susunan course — `coursePindah`**

Topik dan item mandiri berbagi satu daftar bernomor per course
(`sort_order` bersama; baris baru selalu di dasar). `coursePindah(token,
jenis, id, arah)` menukar baris dengan tetangganya lintas sheet lalu
menomori ulang 1..N. Item bertopik ditolak di tingkat course.

**Murid melihat urutan yang sama — `topikKelasSaya`**

Respons kini membawa `topik[]` (+ `item[]` per topik, tanpa konten),
`mandiri[]`, dan `urutan[]` — susunan campuran yang identik dengan layar
guru, difilter hanya baris yang terlihat saat itu. Draf dan terjadwal
pra-waktu tidak pernah bocor.

**UI/UX — port gaya v1 (tahap 4.1–4.5)**

Router hash + `callApi` (pola v1), topbar + lonceng, sidebar menu dengan
daftar kelas, dialog global & toast, editor konten contenteditable
(tabel dinamis, YouTube nocookie, mode HTML, pratinjau), kartu course
`KELAS - MAPEL`, daftar isi dengan item menempel di topik + tombol lipat,
salin kata sandi sekali ketuk.

---

## Riwayat rilis sebelumnya

| Rilis | Commit | Isi singkat | Uji |
|---|---|---|---|
| Gate 0 | — | PoC login & sesi, 23 sheet | 18 |
| Tahap 1–2 | — | DB initializer, core security (port v1) | — |
| Tahap 3 | `a63527b` | Kelas, murid, enrollment (port v1) + UI kelola | 42 |
| Tahap 4 | `8e443c0` | Mapel, penugasan, topik, item + bacaan murid | 84 |
| Uji editor | `cd2b6bf`+`c3bf3b4` | `Uji.gs` — gate0/tahap3/tahap4 dari editor; asersi ter-scope ID | — |
| 4.1 | `9d8ee6f` | Port UI/UX v1 ke seluruh klien + `getBiodataSaya` | — |
| 4.2 | `9500b44` | Editor item gaya v1 + salin sandi + CSS editor | — |
| 4.3 | `29ebb7c` | `getItemGuru` (baca konten item untuk editor) | 87 |
| 4.4 | `f740f2d` | Kartu course `KELAS - MAPEL` + jml draf/murid/topik | 90 |
| 4.5 | `eebbc7d` | Daftar isi murid: item menempel di topik + lipat | 92 |
| 4.6 | `f89554c` | Item mandiri, jadwal terbit, tombol course ala alur baru | 105 |
| 4.7 | `fc97787`+`a80822c` | Satu susunan course gabungan bernomor | 111 |
| 4.8 | `8c7e583` | Urutan murid = campuran guru (`urutan[]`) | 113 |
| dok | `a70119c` | Adendum rancangan §7.8b | — |
| 4.9 | — | `Uji.gs`: suite `ujiCourse()` — repro quiz mandiri → topik baru (18 uji) | 18 |
| dok | — | `PERUBAHAN.md` dibuat | — |
