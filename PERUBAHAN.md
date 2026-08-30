# Catatan Perubahan Berkas

Dipakai untuk mengetahui berkas mana yang perlu disalin ulang ke editor
Apps Script setelah ada pembaruan.

---

## Setelah Tahap 3 dirilis

Tiga berkas berubah. **Ralat 36 murid per kelas tidak mengubah kode**
— hanya angka di dokumen.

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Db.gs` | 🔴 **Wajib** | `perbaruiBanyak()` jadi batch — 62 → 6 panggilan API |
| `Notif.gs` | 🔴 **Wajib** | Tie-break urutan saat stempel waktu sama persis |
| `Setup.gs` | 🟡 Opsional | `infoDatabase()` + pemantauan ambang kapasitas |

Berkas **tidak berubah**: `Util.gs` · `Auth.gs` · `Beranda.gs` · `Code.gs` ·
seluruh berkas `.html`.

### Rincian

**`Db.gs` — `perbaruiBanyak()`**

Melanggar `KONVENSI-TEKNIS.md §6.2` aturan 1: `getRange()` di dalam loop.

```js
// SEBELUM — 2 panggilan API per baris
items.forEach(function (it) {
  var lama = sh.getRange(it._baris, ...).getValues()[0];
  sh.getRange(it._baris, ...).setValues([lama]);
});

// SESUDAH — baca sekali, ubah di memory, tulis sekali
var blok = sh.getRange(min, 1, tinggi, head.length).getValues();
items.forEach(function (it) { /* ubah blok[idx][i] */ });
sh.getRange(min, 1, tinggi, head.length).setValues(blok);
```

Terukur pada 31 notifikasi: **62 → 6 panggilan**, 3–6 detik → < 0,5 detik.

Fungsi ini akan dipakai lagi di Tahap 5 (tandai progres massal) dan
Tahap 6 (penilaian LKPD massal), jadi perbaikan lebih awal mencegah
cacat pola menyebar.

**`Notif.gs` — urutan daftar**

Notifikasi massal dibuat dalam satu operasi, stempel waktunya sama persis,
sehingga urutan tampil tidak menentu. Ditambahkan tie-break memakai
`notif_id`.

**`Setup.gs` — `infoDatabase()`**

Menampilkan peringatan bila sebuah sheet mendekati atau melewati ambang,
serta memproyeksikan jumlah baris `progress` bila seluruh murid tuntas.
Proyeksi dihitung **per kelas** (murid hanya mengerjakan item di kelasnya),
bukan murid × seluruh item.

---

## Setelah Tahap 4

| Berkas | Status |
|---|---|
| `Kelas.gs` · `Pertemuan.gs` | 🆕 baru (Script) |
| `js_kelola.html` · `js_editor.html` · `v_editor.html` | 🆕 baru (HTML) |
| `Code.gs` | 🔴 v0.4.0 + 21 API baru |
| `css.html` · `index.html` · `js_beranda.html` | 🔴 wajib |
| `Setup.gs` | 🟡 komentar saja |

### Audit Menyeluruh — 14 bug "edit parsial menghapus data"

Audit dijalankan setelah menemukan satu bug di `simpanItem()`. Ternyata
itu hanya satu dari **satu keluarga bug yang sama** di empat fungsi.

**Berkas yang perlu disalin ulang:**

| Berkas | Perubahan |
|---|---|
| `Util.gs` | 🔴 Helper baru `isiBilaAda()`, `teks()`, `angka()`, `boolean()` |
| `Kelas.gs` | 🔴 `simpan()` dan `simpanMurid()` |
| `Pertemuan.gs` | 🔴 `simpan()` dan `simpanItem()` |

**14 bug yang diperbaiki:**

| Fungsi | Kolom yang terhapus saat edit parsial |
|---|---|
| `Kelas.simpan()` | `capaian_pembelajaran`, `kompetensi_keahlian`, `catatan_gaya`, `jenjang`, `fase`, `alokasi_jp` |
| `Pertemuan.simpan()` | `deskripsi`, `tujuan_pembelajaran`, `wajib`, `urut_ketat` |
| `Pertemuan.simpanItem()` | `wajib`, `kkm`, `max_percobaan` |
| `Kelas.simpanMurid()` | `email` |

**Yang paling berbahaya:** `wajib` dan `urut_ketat` kembali ke `TRUE`
saat pertemuan diedit. Artinya pertemuan yang sengaja ditandai opsional
diam-diam berubah jadi wajib — **mengunci seluruh pertemuan berikutnya**
bagi murid, tanpa peringatan apa pun.

**Akar masalah.** Pola `String(p.kolom || '')` selalu menghasilkan nilai
walau `p.kolom` tidak dikirim, sehingga menimpa data lama dengan string
kosong. Diganti helper `Util.isiBilaAda()` yang hanya menyentuh kolom
yang benar-benar ada di payload.

**Uji baru:** `test/run5-regresi.js` — 41 poin audit mencakup edit parsial,
keamanan, integritas hapus berantai, kasus tepi, normalisasi username,
XSS, dan konsistensi urutan.

Tidak berubah: `Db.gs` · `Util.gs` · `Auth.gs` · `Notif.gs` · `Beranda.gs` ·
`js_core.html` · `js_auth.html` · `v_login.html` · `v_ganti_password.html` ·
`v_dashboard.html`

---

## Optimasi Performa — T4-OPT-2

Diukur pada data skala penuh (432 murid, 900 item, 32.400 progress).

| Berkas | Perubahan |
|---|---|
| `Db.gs` | 🔴 `bacaKolom()` + `saringKolom()`, invalidasi cache berbasis epoch |
| `Beranda.gs` | 🔴 Pakai `bacaKolom`, cache progres per murid |

**Hasil:**

| Operasi | Sebelum | Sesudah |
|---|---|---|
| Beranda murid — buka pertama | 254.923 sel | **111.823 sel** (−56%) |
| Beranda murid — buka berikutnya | 254.923 sel | **10.324 sel** (−96%) |
| Beranda guru | 130.086 sel | 114.786 sel (−12%) |

Di Apps Script, 254.923 sel ≈ 3–8 detik. Setelah optimasi, kunjungan
ulang praktis seketika.

---

## Perbaikan UI — Halaman Latar Basi

| Berkas | Perubahan |
|---|---|
| `js_kelola.html` | 🔴 `tutupPanel(segarkan)` + penanda `_panelKotor` |
| `js_editor.html` | 🔴 Segarkan setelah salin pertemuan |

**Gejala.** Setelah mendaftarkan murid ke kelas lewat panel geser, angka
"👥 N murid" pada kartu kelas tidak berubah sampai halaman dimuat ulang.

**Penyebab.** Panel geser menggambar ulang dirinya sendiri, tetapi
halaman di belakangnya dibiarkan apa adanya. Data server sudah benar
(sudah diverifikasi) — hanya tampilannya yang basi.

**Perbaikan.** `tutupPanel()` kini menerima argumen `segarkan`. Operasi
yang mengubah data halaman latar memanggil `tandaiPanelKotor()`, sehingga
panel yang ditutup dengan cara apa pun — tombol ✕, klik di luar, atau
Batal — tetap menyegarkan halaman.

Kasus yang ikut diperbaiki: keluarkan murid, impor massal, dan salin
pertemuan antar kelas (jumlah pertemuan pada kartu kelas asal).

---

## Fitur — Impor Murid dengan Pratinjau

| Berkas | Perubahan |
|---|---|
| `Kelas.gs` | 🔴 `pratinjauImpor()`, pemecah kolom lebih pintar |
| `Code.gs` | 🔴 API `pratinjauImpor()` |
| `js_kelola.html` | 🔴 Panel Impor + tombol di halaman Kelola Murid |

**Sebelumnya** impor tersembunyi di dalam panel "Daftarkan Murid" pada
kelas, dan langsung menulis tanpa pratinjau — berisiko untuk 100 baris
sekaligus.

**Sekarang:**

- Tombol **⬆ Impor** di halaman Kelola Murid
- Alur dua langkah: **Periksa** dahulu, baru **Impor**
- Pratinjau menampilkan tabel nama + nama pengguna hasil, baris
  bermasalah, dan peringatan bila nama pengguna disesuaikan karena bentrok
- Pilih kelas tujuan langsung dari panel
- Hasil impor dapat diunduh sebagai CSV

**Format yang dikenali:**

| Masukan | Hasil |
|---|---|
| `Budi Santoso` | pengguna otomatis `budis` |
| `Budi Santoso;budi01` | pengguna `budi01` |
| `Budi Santoso<TAB>budi01` | dipisah TAB |
| `1. Budi Santoso` | nomor urut dibuang |
| `1) Budi` · `2 - Budi` · `03. Budi` | semua varian dikenali |
| `1,Budi Santoso,budi01` | salinan dari spreadsheet |

Bentrok nama pengguna ditangani otomatis dengan sufiks angka, baik
terhadap murid lama maupun sesama baris dalam satu impor.

---

## Fitur — Kelola Kelas Ditingkatkan

| Berkas | Perubahan |
|---|---|
| `Kelas.gs` | 🔴 `duplikat()`, pengurutan alami `_bandingAlami()` |
| `Code.gs` | 🔴 API `duplikatKelas()` |
| `js_kelola.html` | 🔴 Panel Duplikat, pencarian, filter tingkat |

### 1. Duplikat Kelas

Untuk 12 kelas dengan mata pelajaran dan capaian pembelajaran yang sama,
menempel ulang CP sebelas kali itu melelahkan sekaligus rawan salah.

- Salin seluruh pengaturan: mapel, jenjang, fase, tingkat, kompetensi
  keahlian, capaian pembelajaran, catatan gaya AI, alokasi JP
- Pilihan **sertakan pertemuan & materi** (opsional, hasilnya draf)
- Duplikat massal 3 / 5 / 11 kelas sekaligus dengan penomoran otomatis
- Penomoran melewati nama yang sudah dipakai:
  bila `XII AKL 8` dan `9` sudah ada, salinan berikutnya menjadi `10`

### 2. Pengurutan Alami

Sebelumnya kelas diurut sebagai teks biasa:

```
XI TJKT 1 → XI TJKT 10 → XI TJKT 11 → XI TJKT 2   ❌
```

Sekarang angka dibaca sebagai angka:

```
XI TJKT 1 → XI TJKT 2 → XI TJKT 10 → XI TJKT 11   ✅
```

Berlaku juga untuk daftar murid dan daftar murid dalam kelas.

### 3. Pencarian & Filter

Muncul otomatis bila kelas lebih dari 3: kotak cari (nama kelas atau
mapel) dan dropdown filter tingkat. Penghitung berubah menjadi
"N kelas ditampilkan" saat menyaring.

---

## Tahap 5 — Belajar (inti sistem)

| Berkas | Status |
|---|---|
| `Belajar.gs` | 🆕 baru (Script) |
| `js_belajar.html` · `v_baca.html` | 🆕 baru (HTML) |
| `Code.gs` | 🔴 v0.5.0 + 5 API |
| `css.html` · `index.html` · `js_beranda.html` | 🔴 wajib |
| `Db.gs` | 🟡 komentar saja |

Tidak ada kolom baru — tidak perlu migrasi.

Murid kini dapat membaca materi per bagian, menandai selesai, dan
penguncian bertingkat bekerja sungguhan. 43 uji lolos, termasuk
10 pemeriksaan keamanan.

---

## Audit Tahap 5 — 3 Bug Diperbaiki

| Berkas | Perubahan |
|---|---|
| `Belajar.gs` | 🔴 Tiga perbaikan di bawah |
| `Beranda.gs` | 🔴 Aturan "pertemuan tanpa item wajib" disamakan |

### 🔴 1. Pertemuan kosong mengunci selamanya — PALING BERBAHAYA

**Gejala.** Guru membuat 5 pertemuan tetapi Pertemuan 3 belum diisi item.
Murid menuntaskan P1 dan P2, lalu **mentok**: P4 dan P5 terkunci permanen
walau isinya lengkap.

```
P1  ✅ selesai
P2  ✅ selesai
P3  ▶  terbuka   ← 0 item, tak pernah bisa "selesai"
P4  🔒 TERKUNCI  ← macet selamanya
P5  🔒 TERKUNCI
```

**Sebab.** `selesai = wajib.length > 0 && beres === wajib` — pertemuan
tanpa item wajib selalu bernilai `false`.

**Perbaikan.** `selesai = wajib.length === 0 || beres === wajib`.
Pertemuan tanpa item wajib dianggap selesai dan dilewati. Berlaku juga
untuk pertemuan yang seluruh itemnya opsional.

Ditambah penanda `kosong: true` agar antarmuka dapat membedakannya.

### 🔴 2. Nomor bagian pecahan ditolak

`bagianKe = 1.7` memicu `ITEM_TERKUNCI`, bukan dibulatkan. Bisa terjadi
bila nilai berasal dari perhitungan di klien.

Ditambah `_nomorBagian()` yang membulatkan ke bawah lalu menjepit ke
rentang 1..total. Kini menerima `0`, `-5`, `"abc"`, `null`, `1.7` tanpa
error.

### 🔴 3. Menandai selesai tanpa membuka lebih dulu ditolak

Terjadi bila murid menyegarkan halaman tepat setelah membuka materi —
baris progres belum sempat tertulis.

Kini baris progres dibuat otomatis. Aman karena pemeriksaan akses
(`_cekEnroll`, status publish, unlock logic) sudah dilakukan sebelumnya.

### Uji baru

`test/run7-tepi.js` — 12 kelompok kasus tepi: pertemuan kosong, materi
tanpa konten, guru mengubah jumlah bagian setelah murid membaca, item
dijadikan draf, murid dikeluarkan saat belajar, argumen tidak wajar,
penandaan berulang, dan `urut_ketat = false`.

---

## Optimasi Tahap 5 — Alur Belajar −85%

| Berkas | Perubahan |
|---|---|
| `Db.gs` | 🔴 `cariCepat()`, `cariCepat2()`, epoch anti-tabrakan |
| `Belajar.gs` | 🔴 Pakai `cariCepat`, cache progres murid |
| `Beranda.gs` | 🔴 Pembatalan cache per-kunci |
| `Util.gs` · `Setup.gs` | 🟡 Perbaikan huruf **L** pada sandi sementara |

### Hasil terukur

Alur nyata: buka daftar → buka pertemuan → baca & tandai 3 bagian,
pada data skala penuh (432 murid, 900 item, 32.400 progress).

| | Sebelum | Sesudah |
|---|---|---|
| Total | 3.518.632 sel | **530.883 sel** |
| | | **−85%** |

### Empat bug yang ditemukan sepanjang optimasi

**1. Huruf L pada sandi sementara.** Bug lama sejak Tahap 1 — huruf `L`
masih ada di daftar karakter padahal mirip angka `1`. Sandi seperti
`LCF3EHS3` rawan salah didiktekan. Sudah dibuang.

**2. Epoch bertabrakan.** `Date.now()` saja tidak cukup: dua penulisan
dalam milidetik yang sama menghasilkan epoch identik sehingga cache lama
tetap terpakai. Ditambah penghitung `_epochSeq`.

**3. Cache tidak batal saat penulisan langsung.** Penulisan ke sheet
`progress` dari luar `Belajar.gs` tidak memajukan epoch. Pembatalan
dipindahkan ke `Db.invalidasi()` agar berlaku menyeluruh.

**4. Salinan cache usang.** Upaya menyalin cache lama ke kunci epoch baru
sempat memuat status yang sudah kedaluwarsa — akibatnya LKPD tidak
terbuka meski seluruh materi sudah selesai. Diperbaiki dengan mengambil
salinan **sebelum** penulisan, lalu menimpa hanya entri yang berubah.

Bug keempat paling berbahaya karena tidak memunculkan error apa pun —
murid hanya melihat gembok yang seharusnya sudah terbuka.

Alat ukur: `node test/perf5.js`

---

## Audit Pasca-Optimasi — 2 Temuan

| Berkas | Perubahan |
|---|---|
| `Belajar.gs` | 🔴 Cache disimpan di kunci epoch yang benar + pembersihan kunci lama |

Audit 40 poin pada area yang disentuh optimasi: perilaku `cariCepat`,
pembatalan cache, isolasi antar murid, ketahanan saat CacheService mati.

### 🟡 1. Cache tersimpan kosong lalu langsung basi

`bukaMateri()` memanggil `_progresMurid()` **sebelum** menulis baris
progres baru. Cache jadi menyimpan keadaan kosong, lalu penulisan
memajukan epoch sehingga cache itu tidak pernah terpakai.

Akibatnya operasi berikutnya membaca sheet lagi — bukan salah hasil,
tetapi optimasinya sia-sia pada pembukaan materi pertama kali.

**Perbaikan.** Setelah menulis, peta disimpan ulang di kunci epoch baru.

### 🟡 2. Kunci cache lama menumpuk

Setiap kali epoch maju, kunci lama tetap tertinggal di CacheService
sampai TTL 5 menit habis. Untuk 432 murid × beberapa penulisan, ini
memenuhi cache dengan data mati.

**Perbaikan.** Kunci epoch lama dihapus saat menulis kunci baru.

### Yang terbukti sudah benar

```
✅ cariCepat identik dengan Db.cari (20 sampel lintas sheet)
✅ nilai duplikat → ambil baris pertama, konsisten
✅ boolean & angka dibandingkan dengan tipe yang benar
✅ guru tambah/hapus item → murid langsung melihat perubahan
✅ unlock paksa langsung berlaku, tanpa menunggu cache kedaluwarsa
✅ murid dikeluarkan → ditolak walau cache masih ada
✅ progres satu murid tidak bocor ke murid lain
✅ beranda dan layar belajar selalu konsisten
✅ CacheService mati total → seluruh fungsi tetap berjalan
✅ cache di-flush di tengah jalan → data tetap benar
✅ 5 penulisan beruntun → urutan konsisten
✅ 5 pertemuan berantai → terbuka berurutan
✅ dua murid menulis bersamaan → tidak ada baris ganda
```

Poin ketiga dari bawah penting: bila Google membersihkan CacheService
sewaktu-waktu, sistem hanya menjadi lebih lambat — tidak pernah salah.

Uji baru: `test/run8-cache.js` (40 poin).

---

## Tahap 6A — LKPD

| Berkas | Status |
|---|---|
| `Lkpd.gs` | 🆕 baru (Script) |
| `js_lkpd.html` | 🆕 baru (HTML) |
| `Code.gs` | 🔴 v0.6.0 + 9 API |
| `css.html` · `index.html` · `js_belajar.html` · `js_beranda.html` | 🔴 wajib |

Tidak ada kolom baru — tidak perlu migrasi.

Alur lengkap: draf → kumpulkan → antrean guru → nilai → terima/tolak.
Menolak mengembalikan pekerjaan ke draf dan menaikkan `revisi_ke`.
Catatan wajib diisi saat menolak — divalidasi di server.

### Tambahan — Daftar Penilaian per-LKPD

| Berkas | Perubahan |
|---|---|
| `Lkpd.gs` | 🔴 `daftarKelas()` + perbaikan urutan |
| `Code.gs` | 🔴 API `getDaftarLkpdKelas()` |
| `js_lkpd.html` | 🔴 Rute `#/lkpd-kelas/{itemId}` + penyaring status |
| `js_editor.html` | 🔴 Tombol **📥 Penilaian** pada kartu item LKPD |

Semula hanya ada antrean global berisi status `menunggu`. Guru tidak
dapat melihat siapa yang **belum mengumpulkan sama sekali** — padahal
itu justru yang perlu ditagih.

Kini tersedia halaman per-LKPD: seluruh murid kelas beserta statusnya,
rekap jumlah dan rata-rata nilai, serta penyaring status.

**Bug ditemukan:** bobot pengurutan dimulai `0`, sedangkan kodenya
`bobot[x] || 9`. Karena `0 || 9` bernilai `9`, status *menunggu* justru
diurutkan paling akhir. Diperbaiki dengan memulai bobot dari `1`.

105 uji lolos, termasuk 24 kasus tepi.

---

## Audit Integrasi — Tautan Notifikasi Rusak

| Berkas | Perubahan |
|---|---|
| `Lkpd.gs` · `Auth.gs` · `Belajar.gs` · `Pertemuan.gs` · `Kelas.gs` · `Setup.gs` | 🔴 Perbaikan tautan notifikasi |

### 🔴 Notifikasi menuju halaman kosong

Enam tautan notifikasi menunjuk rute yang **tidak pernah didaftarkan**
di frontend. Mengklik notifikasi tersebut membawa pengguna ke halaman
kosong tanpa pesan apa pun.

| Jenis notifikasi | Tautan lama | Diperbaiki menjadi |
|---|---|---|
| `lkpd_masuk` | `#/guru/lkpd` | `#/nilai-lkpd` |
| `permintaan_reset` | `#/guru/reset` | `#/reset` |
| `feedback_baru` | `#/murid/pertemuan/…` | `#/belajar/…` |
| `pertemuan_baru` | `#/murid/pertemuan/…` | `#/belajar/…` |
| `enroll_kelas` | `#/murid/kelas/…` | `#/kelas-saya/…` |

Penyebabnya: penamaan rute berubah sepanjang Tahap 3–6A, tetapi tautan
notifikasi di sisi backend tidak ikut disesuaikan. Tidak terdeteksi uji
sebelumnya karena seluruh uji memanggil fungsi secara langsung — tidak
ada yang menelusuri tautan.

**Uji baru:** `test/run10-integrasi.js` memicu keenam jenis notifikasi
lalu memeriksa setiap tautan terhadap daftar rute yang terdaftar.

> Bila menambah rute baru di frontend, perbarui juga larik `RUTE` pada
> berkas uji tersebut.

---

## Optimasi pasca-Tahap 6A — T6-OPT-4 (cache per murid)

**Empat berkas berubah.** Tidak ada perubahan skema sheet, jadi
**tidak perlu** menjalankan `migrasiStruktur()`.

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Db.gs` | 🔴 **Wajib** | epoch 2 tingkat, `saringBaris()`, `bacaBarisJika()`, `tulisProgres()`, memo per eksekusi, `cariCepat2()` 1 kolom |
| `Belajar.gs` | 🔴 **Wajib** | cache progres simpan `_baris`, pakai epoch per murid, `barisProgresCache()` |
| `Beranda.gs` | 🔴 **Wajib** | `saringBaris()` + epoch per murid |
| `Lkpd.gs` | 🔴 **Wajib** | `_tulisProgres()` pakai nomor baris cache, `daftarKelas()` pakai `saringBaris()` |

Berkas **tidak berubah**: `Setup.gs` · `Util.gs` · `Auth.gs` · `Notif.gs` ·
`Kelas.gs` · `Pertemuan.gs` · `Code.gs` · seluruh berkas `.html`.

> Urutan salin bebas, tetapi **salin keempatnya sekaligus**. `Belajar.gs`,
> `Beranda.gs`, dan `Lkpd.gs` memanggil fungsi baru di `Db.gs`; bila
> `Db.gs` tertinggal, aplikasi akan melempar *"Db.saringBaris is not a
> function"*.

### Masalah yang diperbaiki

Seluruh pengukuran performa sebelumnya memakai **satu murid sendirian**.
Diukur ulang dengan **36 murid bergantian di satu kelas** — kondisi nyata
saat jam pelajaran — biayanya membengkak 8,7× lipat: 39.438 →
**342.662 sel per murid**.

Penyebabnya: setiap penulisan `progress` memajukan **satu epoch global**,
sehingga satu murid menandai satu bagian selesai membatalkan cache
progres **431 murid lain**. Cache dibatalkan lebih cepat daripada dipakai.

Sekarang `progress` memajukan epoch **per murid** (`pe_{user_id}`),
sementara `item`/`pertemuan`/`enrollment` tetap memajukan epoch global
karena perubahan struktur kelas memang memengaruhi perhitungan semua murid.

### Hasil

| Ukuran | Sebelum | Sesudah |
|---|---|---|
| 36 murid serentak, per murid | 342.662 sel | **36.805 sel** (−89%) |
| cache hangat setelah murid lain menulis | 236.971 sel | **24 sel** |
| alur baca 1 materi 3 bagian | 530.883 sel | **40.607 sel** (−92%) |
| `daftarKelas()` per-LKPD | 46.594 sel | **4.668 sel** (−90%) |

### Cara memastikan berhasil

```bash
node test/perf7-serentak.js     # harus BUG: 0
```

**Uji baru:** `test/perf7-serentak.js` — mengunci biaya kelas serentak,
isolasi cache antar murid, **dan** memastikan pembatalan cache global
tetap terjadi saat guru menyunting item. Yang terakhir itu penting:
mudah sekali "mengoptimasi" dengan membuat cache tidak pernah batal.


---

## Tahap 6B — Quiz Internal (v0.7.0)

**Dua berkas baru, enam berkas diubah.** Tidak ada perubahan skema sheet
(`soal` & `quiz_attempt` sudah ada sejak Tahap 1) — **`migrasiStruktur()`
tidak perlu dijalankan**.

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Quiz.gs` | 🔴 **BARU** | bank soal, pengerjaan, penilaian, koreksi |
| `js_quiz.html` | 🔴 **BARU** | 4 rute: `quiz` `soal` `koreksi-quiz` `nilai-quiz` |
| `Code.gs` | 🔴 **Wajib** | +18 fungsi API, versi 0.7.0 |
| `index.html` | 🔴 **Wajib** | tambah `include('js_quiz')` |
| `css.html` | 🔴 **Wajib** | gaya quiz — tanpa ini tampilan berantakan |
| `js_belajar.html` | 🔴 **Wajib** | klik item quiz → `#/quiz/{id}` (dulu toast "Tahap 6B") |
| `js_editor.html` | 🔴 **Wajib** | tombol 🎯 Soal & 📊 Penilaian pada item quiz |
| `js_beranda.html` | 🔴 **Wajib** | perbaikan tautan antrean koreksi |

Berkas **tidak berubah**: `Setup.gs` · `Util.gs` · `Auth.gs` · `Notif.gs` ·
`Db.gs` · `Kelas.gs` · `Pertemuan.gs` · `Beranda.gs` · `Belajar.gs` ·
`Lkpd.gs` · seluruh `v_*.html` lain.

> **Penting:** `index.html` wajib ikut disalin. Tanpa baris
> `include('js_quiz')`, seluruh rute quiz tidak terdaftar dan murid
> mendapat dashboard kosong saat mengeklik item quiz.

### Dua bug yang ditemukan & diperbaiki

**1. `bersihkanAttemptBasi()` — `TypeError`**
Memakai `Db.bacaKolom()` yang tidak mengembalikan `_baris`, padahal
`perbaruiBanyak()` membutuhkannya. Diganti `Db.saringBaris()`.

**2. Tautan `#/guru/quiz` → halaman kosong**
Panel "Perlu Tindakan" di beranda guru menaut ke rute yang tidak pernah
ada. Backend sudah mengirim `quiz_menunggu` sejak Tahap 3; tautannya
salah sejak awal. Diperbaiki ke `#/koreksi-quiz`.

Ini kelas bug yang **sama** dengan 6 tautan notifikasi rusak di Tahap 6A.
Karena berulang dua kali, sekarang dicegah otomatis.

### Audit statis baru (`run10-integrasi.js`)

```
✓ setiap #/tautan punya daftarRute
✓ larik RUTE uji sudah lengkap
✓ setiap callApi punya fungsi di Code.gs
✓ tidak ada google.script.run langsung
```

Audit dibuktikan bisa gagal: bug `#/guru/quiz` disisipkan ulang, uji
berubah merah, lalu dipulihkan.

### Performa (432 murid, 1.800 soal, 3.024 attempt)

| Ukuran | Hasil |
|---|---|
| 36 murid quiz 10 soal serentak | 74.417 sel/murid · 1.065 ms |
| autosave (cache hangat) | **975 sel** |
| autosave setelah murid lain menulis | **975 sel** |
| alur murid 10 soal | 133.648 → **70.893 sel** (−47%) |

### Cara memastikan berhasil

```bash
node test/run11-quiz.js            # 161 lolos
node test/perf9-quiz-serentak.js   # BUG: 0
node test/run10-integrasi.js       # BUG: 0
```

Dari editor Apps Script, pasang trigger harian ke `tugasHarianQuiz()`
untuk menandai attempt terbengkalai >24 jam sebagai kedaluwarsa.


---

## Audit pasca-Tahap 6B — 3 bug capaian turun (v0.7.1)

**Satu berkas berubah: `Quiz.gs`.** Tidak ada perubahan skema.

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Quiz.gs` | 🔴 **Wajib** | `_hitungProgresQuiz()` + `_selaraskanProgresQuiz()`; 4 pemanggil diperbaiki |

### Bug: capaian murid bisa TURUN

Ketiganya satu akar: status progres **dipaksa** oleh satu peristiwa,
bukan diturunkan dari keadaan data.

**Bug 1 — mengulang quiz yang sudah lulus (paling parah).**
Murid lulus KKM → pertemuan berikutnya terbuka. Murid menekan
**"Ulangi Quiz"** untuk memperbaiki nilai → `mulaiQuiz()` memaksa
progres jadi `berjalan` → status lulus **hilang** dan **pertemuan
berikutnya terkunci kembali**. Murid dihukum karena berusaha lebih baik.

**Bug 2 — attempt kedaluwarsa 24 jam.**
Murid membuka quiz lalu menutup tab. Keesokan harinya trigger harian
menandai attempt `kedaluwarsa`, tetapi baris `progress` tetap
`berjalan` — capaian lulus sebelumnya ikut hilang.

**Bug 3 — reset percobaan oleh guru.**
`resetPercobaanQuiz()` menulis progres `berjalan` dengan nilai kosong.
Guru yang bermaksud *memberi kesempatan tambahan* justru **menghapus
nilai yang sudah diraih**.

### Perbaikan

`_hitungProgresQuiz()` menurunkan status dari SELURUH attempt:

```
nilai tertinggi >= KKM  → selesai      (menang sekali, menang selamanya)
ada attempt berjalan    → berjalan
ada menunggu koreksi    → menunggu
sudah pernah selesai    → gagal
```

Attempt `kedaluwarsa` **tetap dihitung nilainya** — nilai yang sudah
diraih adalah fakta; kedaluwarsa hanya soal kuota percobaan.

Keempat pemanggil (`mulaiQuiz`, `kumpulkanQuiz`, `koreksiQuiz`,
`resetPercobaanQuiz`) kini memakai `_selaraskanProgresQuiz()`.
`bersihkanAttemptBasi()` juga menyelaraskan progres murid yang
attempt-nya baru kedaluwarsa.

> **Prinsip:** capaian yang sudah diraih tidak boleh turun karena
> peristiwa yang bukan kegagalan murid. §9.7 sudah menyatakan yang
> dipakai adalah nilai **tertinggi** — kode kini benar-benar menaatinya.

### Uji baru

`test/run12-audit.js` — **40 poin**: capaian tidak turun, pergeseran
nomor baris, penghapusan berantai, kasus tepi `saringBaris`, dan
penyuntingan quiz saat murid mengerjakan.

Diverifikasi bisa merah: bug 1 dikembalikan → 2 poin gagal → dipulihkan.

### Dampak performa

36 murid serentak: 74.417 → **110.100 sel/murid** (+48%). Penyelarasan
memang menambah pembacaan attempt, tetapi `kumpulkanQuiz()` dioptimasi
memakai **satu** pembacaan untuk tiga keperluan. Masih jauh di bawah
ambang 250.000, dan kebenaran data lebih penting daripada selisih ini.

### Cara memastikan

```bash
node test/run12-audit.js    # 40 lolos
```


---

## Optimasi T6-OPT-5 — Quiz serentak (v0.7.2)

**Empat berkas berubah.** Tidak ada perubahan skema.

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Db.gs` | 🔴 **Wajib** | `cariBarisCache()` `cariBarisCache2()` `titipBaris2()`; invalidasi `id_guru` & `soal_epoch` |
| `Quiz.gs` | 🔴 **Wajib** | cache bank soal per item; lookup pakai cache baris |
| `Belajar.gs` | 🔴 **Wajib** | titip nomor baris progres; lookup pakai cache baris |
| `Lkpd.gs` | 🔴 **Wajib** | lookup pakai cache baris |
| `Notif.gs` | 🔴 **Wajib** | cache daftar id guru |

> Salin **kelimanya sekaligus**. `Quiz`, `Belajar`, `Lkpd`, dan `Notif`
> memanggil fungsi baru di `Db.gs`; bila `Db.gs` tertinggal, aplikasi
> melempar *"Db.cariBarisCache is not a function"*.

### Sasaran: satu kelas mengerjakan quiz bersamaan

Beban puncak nyata sistem — 36 murid × 10 soal, autosave tiap pindah
soal. Titik awal 110.100 sel/murid.

| Ukuran | Sebelum | Sesudah |
|---|---|---|
| **36 murid quiz serentak, per murid** | 110.100 | **51.489** (−53%) |
| autosave (cache hangat) | 975 | **75** (−92%) |
| `kumpulkanQuiz` | 44.004 | **6.878** (−84%) |
| baca 1 materi 3 bagian | 40.607 | **35.015** |
| tandai bagian selesai | 1.151 | **71** |
| guru menilai LKPD | 109.368 | **101.326** |

### Cara kerjanya

**Cache nomor baris.** Lookup berulang pada sheet besar mengingat nomor
barisnya, lalu membaca **satu baris** dan **memverifikasi isinya**. Bila
nomor meleset (baris di atasnya terhapus), hasilnya null dan sistem
jatuh ke pemindaian penuh. Cache basi hanya membuang satu pembacaan —
tidak pernah salah data.

**Berbagi nomor baris antar modul.** `Belajar` sudah tahu nomor baris
progres murid saat membangun petanya; nomor itu dititipkan agar `Quiz`
dan `Lkpd` ikut memakainya. Ini menutup celah terbesar:
`kumpulkanQuiz()` dulu memindai 32.505 sel hanya untuk satu baris.

**Cache bank soal & daftar guru.** Keduanya praktis beku selama jam
pelajaran tetapi dibaca puluhan kali.

### Uji baru

`test/run13-cache-quiz.js` — membuktikan tidak ada cache yang basi:
tambah/sunting/hapus/urut/impor soal langsung terlihat, penilaian
memakai kunci terbaru, guru baru langsung menerima notifikasi.

Ambang `perf9-quiz-serentak.js` diperketat (70.000 sel/murid, 300 sel
autosave) supaya penurunan performa langsung ketahuan.

### Dua percobaan yang gagal

Diukur dan dibatalkan: menyaring `item_id` lalu membuang (59.686) dan
`saringBaris2` dua kolom (68.288). Ternyata `user_id` & `item_id` tidak
bersebelahan di sheet, sehingga rentangnya lebar. Fungsi `saringBaris2`
yang sempat ditulis **dihapus** agar tidak jadi kode mati.

### Cara memastikan

```bash
node test/run13-cache-quiz.js      # TOTAL BUG: 0
node test/perf9-quiz-serentak.js   # BUG: 0
```


---

## Alat pengujian di Apps Script (v0.7.3)

**Satu berkas berubah: `Code.gs`.** Tambahan tiga fungsi diagnostik yang
dijalankan langsung dari editor Apps Script.

| Fungsi | Guna | Aman diulang |
|---|---|---|
| `cekKesehatan()` | periksa modul, fungsi `Db` baru, 14 sheet, cache, lock, trigger | ya (tidak mengubah data) |
| `ujiTahap6B()` | satu siklus quiz penuh, 25 pemeriksaan | ya (membersihkan sendiri) |
| `pasangTriggerHarian()` | pasang trigger `tugasHarianQuiz` | ya (trigger lama dibuang) |

### Mengapa perlu

Seluruh uji selama ini berjalan di **Node.js** — simulasi, bukan Apps
Script sungguhan. Beda lingkungan bisa menyembunyikan masalah: kuota,
izin, `LockService`, atau berkas yang lupa disalin.

`cekKesehatan()` khusus menangkap kesalahan tersering: menyalin
`Quiz.gs` tetapi lupa `Db.gs`, sehingga aplikasi melempar
*"Db.cariBarisCache is not a function"* saat murid membuka quiz.
Sekarang ketahuan **sebelum** murid mengalaminya.

### Dokumen baru

`src/PANDUAN-UJI.md` — panduan pengujian 4 lapis:

1. uji otomatis Node (16 berkas)
2. uji dari editor Apps Script (3 fungsi di atas)
3. **uji manual di browser** — 30+ langkah bertabel, termasuk
   pemeriksaan keamanan lewat DevTools
4. uji beban nyata satu kelas serentak

### Uji baru

`test/run14-editor.js` memastikan ketiga fungsi diagnostik tidak error
dan aman dijalankan berulang — jangan sampai guru yang menemukan
`TypeError`-nya. Dua kesalahan memang tertangkap di sini saat ditulis:
`Kelas.tambahMurid` (nama salah, seharusnya `Kelas.enroll`) dan `Setup`
yang bukan objek modul.


---

## Perbaikan UI — dialog "Tambah Soal" kosong (v0.7.4)

**Dua berkas berubah:** `js_quiz.html` · `css.html`

### Bug: dialog tampil kosong

Guru mengeklik **+ Tambah Soal** → dialog terbuka tanpa isian apa pun.

Penyebabnya saya sendiri: `js_quiz.html` memakai opsi dialog yang
**tidak pernah dibaca** `js_core.html`.

| Saya pakai | Yang sah |
|---|---|
| `badan:` | `html:` |
| `saatBuka:` | — (panggil setelah `dialog()`) |
| `saatYa:` | `.then(function (ya) {…})` |
| `lebar:` | kelas CSS `dialog-lebar` |
| `jenis: 'bahaya'` | `bahaya: true` |

Karena `badan:` diabaikan, dialog hanya berisi judul dan dua tombol.
`saatYa:` juga tidak pernah dipanggil — tombol Simpan tidak melakukan
apa-apa.

### Bug ikutan yang lebih berbahaya

`dialog()` mengembalikan **boolean** (`true` = Ya, `false` = Batal),
tetapi tiga tempat menjalankan aksi tanpa memeriksanya:

```js
// SALAH — menghapus walau guru menekan Batal
konfirmasi('Hapus soal ini?', …).then(function () { hapus(); });

// BENAR
konfirmasi('Hapus soal ini?', …).then(function (ya) {
  if (!ya) return;
  hapus();
});
```

Terdampak: **hapus soal**, **kumpulkan jawaban**, **reset percobaan** —
ketiganya berjalan meski tombol Batal ditekan. Yang paling parah,
murid menekan Batal saat konfirmasi pengumpulan tetap terkumpul.

### Perbaikan lain

- Dialog form dilebarkan 420px → 620px + dapat digulir (5 baris opsi
  tidak muat di 420px). Memakai kelas `dialog-lebar`, **bukan** `:has()`
  yang belum didukung browser lama.
- Menambah gaya `.wajib` (tanda bintang merah) yang dipakai tetapi
  belum pernah didefinisikan.

### Dua uji baru

`test/run15-ui.js` — audit statis seluruh berkas UI:

```
A. opsi dialog() yang tidak dikenal js_core
B. hasil dialog dua-tombol tidak diperiksa
C. handler onclick/onchange menunjuk fungsi yang tidak ada
```

`test/run16-form-soal.js` — menjalankan `dialog()` dan `_bukaFormSoal()`
yang **sebenarnya** di atas DOM tiruan, lalu memeriksa isian benar-benar
terbentuk: dropdown tipe, 5 kotak opsi, radio kunci, dan perubahan
kotak jawaban saat tipe soal diganti.

Keduanya dibuktikan bisa merah: bug asli disisipkan ulang → uji gagal →
dipulihkan.

> **Pelajaran:** backend diuji 161 poin, tetapi UI sama sekali tidak.
> Semua uji sebelumnya memanggil fungsi backend langsung, tidak pernah
> lewat lapisan tampilan — sehingga ketidakcocokan kontrak seperti ini
> lolos begitu saja.

### Cara memastikan

```bash
node test/run15-ui.js         # TOTAL BUG: 0
node test/run16-form-soal.js  # TOTAL BUG: 0
```

Di browser: **+ Tambah Soal** → form lengkap tampil; ganti tipe soal →
kotak jawaban ikut berubah; tekan **Batal** pada "Hapus soal" →
soal **tidak** terhapus.


---

## Sidebar navigasi kelas + tombol Sebelumnya/Berikutnya (v0.8.0)

**Satu berkas baru, tujuh berubah.** Tidak ada perubahan skema.

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_nav.html` | 🔴 **BARU** | komponen sidebar + rantai navigasi |
| `index.html` | 🔴 **Wajib** | tambah `include('js_nav')` |
| `css.html` | 🔴 **Wajib** | tata letak 2 kolom + laci ponsel |
| `Belajar.gs` | 🔴 **Wajib** | `indeksKelas()` `tetanggaItem()`; `bukaMateri` kirim `kelas_id` |
| `Code.gs` | 🔴 **Wajib** | API `getIndeksKelas()` |
| `v_baca.html` | 🔴 **Wajib** | kerangka sidebar pada halaman baca |
| `js_belajar.html` | 🔴 **Wajib** | sidebar + Prev/Next antar pertemuan |
| `js_lkpd.html` · `js_quiz.html` | 🔴 **Wajib** | sidebar + Prev/Next antar item |
| `Lkpd.gs` · `Quiz.gs` | 🔴 **Wajib** | kirim `kelas_id` untuk sidebar |

> `index.html` wajib ikut — tanpa `include('js_nav')` seluruh halaman
> murid melempar *"navRangka is not defined"* dan tampil kosong.

### Yang didapat murid

**Sidebar bergaya course index** — tampil di halaman pertemuan, baca
materi, LKPD, dan quiz:

- seluruh pertemuan + item di dalamnya, dapat dilipat per pertemuan
- penanda status: ✅ selesai · ⏳ menunggu nilai · 🔒 terkunci
- keterangan ringkas: "bagian 2/4", "nilai 90", "opsional"
- kemajuan kelas dalam persen di bagian atas
- item & pertemuan yang sedang dibuka disorot
- pada layar < 900px berubah jadi laci (tombol **☰ Daftar Isi**)

**Tombol Sebelumnya / Berikutnya:**

- di halaman pertemuan → berpindah antar **pertemuan**
- di halaman item → berpindah antar **item**, dan **melintasi pertemuan**
  (item terakhir Pertemuan 1 → item pertama Pertemuan 2)
- hanya item yang **sudah terbuka** masuk rantai; posisi ditampilkan
  sebagai "3 dari 12"

### Keamanan

`indeksKelas()` mengirim judul & status, **tidak pernah** mengirim
`konten`. Item pada pertemuan terkunci tidak disertakan sama sekali —
hanya jumlahnya. Diuji di `run18-indeks.js`.

### Performa

| Ukuran | Hasil |
|---|---|
| `indeksKelas` cache dingin | 49.996 sel · 83 ms |
| `indeksKelas` cache hangat | **12 sel · 1 ms** |
| payload | 14,4 KB (15 pertemuan · rantai 40 item) |

Sidebar memakai cache progres murid yang sama dengan `daftarPertemuan()`,
sehingga saat berpindah antar item biayanya nyaris nol. Indeks disimpan
di sisi klien (`Nav.data`) dan hanya dimuat ulang setelah progres berubah.

### Bug yang ditemukan saat pembuatan

Pertemuan yang dilipat **tidak bisa dibuka kembali** — `navKlikPtm`
mengosongkan `Nav.aktifPtm` saat melipat, sehingga cabang lipat/buka
tidak pernah tercapai lagi. Tertangkap `run17-nav.js` sebelum sampai
ke pengguna.

### Dua uji baru

- `test/run17-nav.js` — 40 poin, menjalankan `js_nav.html` sungguhan di
  DOM tiruan: penggambaran, penanda aktif, pelipatan, laci, rantai
  Prev/Next lintas pertemuan, cache indeks
- `test/run18-indeks.js` — backend: pertemuan draf disembunyikan,
  konten tidak bocor, rantai tumbuh saat item diselesaikan, otorisasi

### Pratinjau

`pratinjau-sidebar.html` — buka di browser untuk melihat tampilannya
tanpa perlu menyalin ke Apps Script. Perkecil jendela di bawah 900px
untuk mencoba mode laci.


---

## Audit navigasi — 4 bug (v0.8.1)

**Empat berkas berubah:** `js_nav.html` · `js_core.html` ·
`js_lkpd.html` · `js_quiz.html` · `js_belajar.html`

Audit pasca-rilis sidebar. Semua di sisi frontend; backend bersih
(29 pemeriksaan `indeksKelas` lolos tanpa temuan).

### Bug 1 — sidebar murid sebelumnya bocor 🔴 paling serius

`Nav.data` hidup di memori halaman dan **tidak** ikut terhapus oleh
`simpanToken('')`. Di **komputer lab yang dipakai bergantian**, murid
yang masuk berikutnya melihat daftar pertemuan, judul item, dan
kemajuan milik murid sebelumnya sampai halaman dimuat ulang.

Ditambahkan `navReset()`, dipanggil di **tiga** jalur keluar:
`keluarAkun()`, sesi kedaluwarsa (`SESI_INVALID` di `callApi`), dan
kegagalan saat startup. Dua jalur terakhir sempat terlewat.

> Ini bukan kebocoran data lintas-akun di server — API tetap menolak
> akses. Yang bocor adalah sisa tampilan di layar. Tetap tidak pantas.

### Bug 2 — sidebar basi setelah mengumpulkan

Menyelesaikan materi sudah menyegarkan sidebar, tetapi **mengumpulkan
LKPD**, **membatalkan pengumpulan**, dan **mengumpulkan quiz** tidak.
Murid melihat item masih bertanda "belum" padahal sudah dikerjakan, dan
item berikutnya yang baru terbuka tidak muncul.

Menariknya `navSegarkan()` sudah ditulis sejak awal tetapi **tidak
pernah dipanggil** — terdeteksi saat memeriksa fungsi yang tidak
terpakai. Kini dipakai di keempat titik.

### Bug 3 — status lipat menumpuk antar kelas

`Nav.lipat` menyimpan pertemuan mana yang dilipat, tetapi tidak
dikosongkan saat berpindah kelas. Kebocoran memori kecil, tidak fatal,
tetap dirapikan.

### Bug 4 — sidebar pecah bila payload tidak lengkap

`p.item.length` melempar `TypeError` bila sebuah pertemuan tidak punya
larik `item` — seluruh sidebar gagal digambar. Backend saat ini selalu
mengirimnya, tetapi satu medan hilang tidak boleh merusak seluruh
tampilan. Ditambah pengaman pada `pertemuan`, `item`, dan `rantai`.

### Yang diperiksa dan ternyata AMAN

- Kunci jawaban / konten materi **tidak pernah** masuk payload indeks
- Item & pertemuan berstatus draf tidak bocor ke sidebar
- Status item di sidebar **identik** dengan halaman pertemuan
- Judul mengandung `<script>` di-escape dengan benar
- Kelas diarsipkan & murid dikeluarkan → indeks ditolak
- Rantai navigasi ikut tumbuh setelah unlock paksa guru
- Kegagalan jaringan → sidebar kosong, tidak error

Sempat dicurigai: `esc()` di dalam atribut `onclick` bisa merusak
sintaks bila ID memuat kutip satu. **Tidak terpicu** — `Util.buatId()`
selalu menghasilkan pola `PRE-0001`, dan judul (yang bebas diketik guru)
tidak pernah masuk ke dalam `onclick`.

### Uji baru

`test/run19-nav-audit.js` — 25 poin. Keempat bug dibuktikan bisa merah:
tiap perbaikan dibatalkan satu per satu, uji gagal, lalu dipulihkan.

### Cara memastikan

```bash
node test/run19-nav-audit.js   # LOLOS: 25  GAGAL: 0
```

Di browser: masuk sebagai murid A → buka pertemuan → keluar → masuk
sebagai murid B → sidebar harus menampilkan kelas **murid B**, bukan A.


---

## Optimasi kecepatan sidebar (v0.8.2)

**Empat berkas berubah:** `js_nav.html` · `js_belajar.html` ·
`js_lkpd.html` · `js_quiz.html` · `css.html`

### Masalah: sidebar menunggu DUA round-trip berurutan

Penyebabnya bukan kueri yang berat — `indeksKelas()` hanya 12 sel saat
cache hangat. Yang lambat adalah **polanya**:

```
callApi('bukaLkpd')          ~1,2 detik
   └── selesai → baru mulai:
       callApi('getIndeksKelas')  ~1,2 detik   → sidebar muncul di detik 2,4
```

Di Apps Script setiap `google.script.run` memakan sekitar 0,8–1,5 detik
**berapa pun ringannya kueri**. Yang menentukan rasa cepat adalah jumlah
panggilan berurutan, bukan jumlah sel yang dibaca. Saya sebelumnya
mengoptimalkan jumlah sel — ukuran yang salah untuk masalah ini.

### Tiga perbaikan

**1. Cache `sessionStorage` + penyegaran diam-diam**

Indeks disimpan di `sessionStorage` (umur 5 menit). Sidebar digambar
dari cache **sebelum** jaringan menjawab, lalu versi terbaru diambil di
latar dan sidebar diperbarui **hanya bila benar-benar berubah** — tanpa
kedipan kosong. Menutup kasus F5, tautan notifikasi, dan tombol Back.

**2. Panggilan diparalelkan**

`navMuat()` tidak lagi menunggu data halaman. Pada halaman LKPD/quiz
kerangka + sidebar digambar lebih dulu, lalu isi menyusul.

**3. Prapemuatan dari daftar pertemuan**

Saat murid membuka daftar pertemuan, indeks kelas dimuat lebih awal.
Begitu ia mengeklik satu pertemuan, indeksnya sudah siap di memori.

Ditambah **kerangka abu-abu beranimasi** selagi memuat, jadi kolom
sidebar tidak pernah kosong menganga.

### Hasil (round-trip ≈ 1,2 detik)

| Keadaan | Sebelum | Sesudah |
|---|---|---|
| buka pertemuan dari daftar | 2,4 s | **0 s** |
| buka LKPD/quiz dari pertemuan | 2,4 s | **0 s** |
| pindah antar bagian materi | 1,2 s | **0 s** |
| muat ulang halaman (F5) | 2,4 s | **0 s** |
| kunjungan pertama, cache kosong | 2,4 s | **1,2 s** |

Kasus yang paling sering dialami murid — menyusuri item satu per satu —
turun dari 2,4 detik menjadi **tidak ada jeda sama sekali**.

### Keamanan cache

`sessionStorage` hanya memuat judul & status yang memang tampil di
layar, otomatis hilang saat tab ditutup, dan **dibuang saat logout**
lewat `navReset()`. Bila `sessionStorage` diblokir (mode privat),
sistem tetap berjalan normal — hanya kehilangan percepatannya.

### Uji baru

`test/run20-nav-cepat.js` — 20 poin: cache dipakai, penyegaran latar
memperbarui data basi, `navSegarkan()` menembus cache, logout membuang
cache, cache kedaluwarsa diabaikan, cache antar kelas tidak tertukar,
dan aman tanpa `sessionStorage`.

Dibuktikan bisa merah: cache sesi dan pembuangan-saat-logout dibatalkan
satu per satu → uji gagal (termasuk mendeteksi kebocoran antar akun) →
dipulihkan.

### Cara memastikan

```bash
node test/run20-nav-cepat.js   # TOTAL BUG: 0
```

Di browser: buka daftar pertemuan → klik satu pertemuan → sidebar harus
tampil **tanpa jeda**. Tekan F5 → tetap tanpa jeda.


---

## Tahap 7 — Generator AI + rotasi 10 key (v0.9.0)

**Satu berkas baru, lima berubah.** Tidak ada perubahan skema
(`materi_ai` sudah ada sejak Tahap 1) — **`migrasiStruktur()` tidak perlu**.

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Ai.gs` | 🔴 **BARU** | rotasi key, generate materi/soal/kerangka |
| `Code.gs` | 🔴 **Wajib** | +8 API, `pasangApiKeysManual()`, versi 0.9.0 |
| `js_editor.html` | 🔴 **Wajib** | tombol ✨ Generate + rute `#/api-key` |
| `v_editor.html` | 🔴 **Wajib** | panel generator di editor materi |
| `js_beranda.html` | 🔴 **Wajib** | pintasan 🔑 Status API Key |
| `Pertemuan.gs` | 🔴 **Wajib** | **perbaikan bug guard AI** |

### 🔴 Bug lama yang ditemukan: guard "AI wajib ditinjau" bisa dilewati

`Pertemuan.simpanItem()` hanya menyimpan `sumber_ai` saat item **dibuat**,
tidak saat **disunting** — padahal alur generator justru: item dibuat
kosong dahulu, lalu diisi hasil AI lewat edit.

Akibatnya penanda tidak pernah tersimpan, sehingga **materi hasil AI
dapat langsung diterbitkan ke murid tanpa ditinjau guru** — persis yang
dilarang §8.1. Bug ini ada sejak Tahap 4 dan tidak terdeteksi karena
belum ada yang memakai jalur tersebut.

### Tiga generator

| Fitur | Keluaran |
|---|---|
| ✨ Generate Materi | HTML terpisah `<!--bagian-->` + saran soal & LKPD |
| Generate Soal | larik soal siap masuk bank soal quiz |
| Susun Kerangka | usulan daftar pertemuan (API siap, tombol belum) |

### Rotasi key

Round-robin **bukan acak**, maksimal satu putaran, cooldown 60 detik
(429) / 24 jam (key ditolak), pemutus 90 detik agar tidak menabrak batas
6 menit Apps Script.

### Keamanan key

Key hanya di Script Properties. Panel guru menampilkan **4 digit
terakhir** saja. Diuji harfiah: key bertanda `AIzaKEYRAHASIA…` dipasang,
lalu dipastikan tidak muncul di respons API, riwayat, maupun sheet.

### Memasang key

**Lewat aplikasi:** Beranda → 🔑 Status API Key → Pasang API Key.

**Lewat editor:** `pasangApiKeysManual()` — tempel key, jalankan,
lalu **kosongkan kembali** sebelum menyimpan berkas.

### Uji baru

`test/run21-ai.js` — **85 poin**. `UrlFetchApp` ditiru sehingga seluruh
cabang rotasi teruji tanpa memanggil Gemini: 200/429/403/503/jaringan
putus, key cooldown dilewati, semua gagal berhenti **tepat satu putaran**.

### Cara memastikan

```bash
node test/run21-ai.js       # 85 lolos
```

Di aplikasi: buka editor Materi → simpan sebagai draf → **✨ Generate** →
draf muncul di editor → centang "sudah meninjau" → baru bisa Terbit.
Tanpa mencentang, tombol Terbit **ditolak backend**.


---

## Alat uji Tahap 7 di Apps Script (v0.9.1)

**Satu berkas berubah: `Code.gs`.**

| Fungsi | Guna | Panggilan Gemini |
|---|---|---|
| `tesKoneksiAI()` | tes cepat setelah memasang key | 1 |
| `ujiTahap7()` | siklus penuh generator + guard tinjau | 1 |
| `cekKesehatan()` | kini juga memeriksa `Ai.gs` & status key | 0 |

### Mengapa perlu

`run21-ai.js` (85 poin) memakai **UrlFetchApp tiruan** — membuktikan
logika rotasi benar, tetapi **tidak** membuktikan key Anda sah, kuotanya
hidup, atau Generative Language API sudah aktif di project-nya.

Hanya panggilan sungguhan yang bisa membuktikan itu, dan itulah yang
dilakukan kedua fungsi baru ini.

`cekKesehatan()` juga diperluas: sebelumnya tidak tahu `Ai.gs` ada, jadi
guru yang lupa menyalinnya baru sadar ketika menekan tombol Generate.

### Uji baru

`test/run22-ai-editor.js` — menguji **jalur gagal**, karena itulah yang
paling mungkin dialami saat pemasangan pertama: key ditolak 403 →
tidak crash, pesan menyebut tiga kemungkinan sebab, pertemuan uji tetap
dibersihkan, key tidak bocor ke log.

`test/run14-editor.js` diperluas: `ujiTahap7()` & `tesKoneksiAI()`
dijalankan tanpa key, lalu dengan key, lalu diulang — memastikan tidak
menumpuk data sampah.

### Cara memastikan

```bash
node test/run22-ai-editor.js   # TOTAL BUG: 0
node test/run14-editor.js      # exit 0
```

Di editor Apps Script, setelah memasang key:

```
tesKoneksiAI()   → ✅ BERHASIL — key#3, 1.4 detik
ujiTahap7()      → LOLOS: 14   GAGAL: 0
```


---

## Rotasi model AI — perbaikan "kuota habis (429)" (v0.9.2)

**Dua berkas berubah:** `Ai.gs` · `Code.gs` · `js_editor.html`

### Penyebab sebenarnya

Kuota gratis Gemini dihitung per **(project × MODEL)**, bukan per key
saja. Kode lama hanya memakai satu model (`gemini-2.0-flash`), sehingga
begitu model itu kehabisan jatah harian, **seluruh 10 key ikut mati**
padahal model lain di project yang sama masih punya jatah sendiri.

Ini ide berharga dari script "Buku Kerja Guru" yang dikirim guru:
merotasi **model**, bukan hanya key.

### Yang diadopsi & yang tidak

| Ide dari script itu | Putusan |
|---|---|
| Rotasi model saat kuota habis | ✅ **diadopsi** — inti perbaikan ini |
| Membaca `result.error.message` | ✅ **diadopsi** — pesan asli jauh lebih berguna |
| Jitter acak sebelum mencoba ulang | ✅ **diadopsi** pada kasus 429 |
| Nama model `gemini-3.5-flash` dll. | ❌ diverifikasi ke dokumentasi Google: sebagian **tidak free-tier** atau salah tulis. Dipakai daftar yang terkonfirmasi gratis |
| Shuffle acak key | ❌ tetap round-robin — lebih merata & mudah ditelusuri (§10.3) |
| Key disimpan di sheet `Pengaturan` | ❌ tetap Script Properties — key tidak boleh masuk spreadsheet (§10.1b) |

Model yang dipakai, berurutan dari kuota harian paling longgar:

```
gemini-2.5-flash-lite → gemini-2.5-flash
→ gemini-2.0-flash → gemini-2.0-flash-lite
```

Model yang dijawab 404 otomatis dibuang 24 jam, jadi daftar ini aman
bila Google mengubah nama model.

### Dua bug yang ditemukan sekaligus

**1. Pesan error kosong.** Saat semua key masih cooldown, tidak ada
percobaan yang dilakukan sehingga pesannya berbunyi
`Semua API key sedang tidak dapat dipakai ()` — tanda kurung kosong.
Kini dibedakan: *"sedang istirahat, tunggu beberapa menit"* vs
*"sudah dicoba, gagal karena X"*.

**2. Pesan asli Google dibuang.** Kode lama hanya menyimpan nomor kode,
sehingga guru tidak tahu apakah yang habis kuota **harian** (pulih
tengah malam Pasifik) atau kuota **per menit** (pulih 60 detik).
Sekarang keduanya dibedakan — harian istirahat 1 jam, per-menit 60 detik.

### Perbaikan lain

- Cooldown kini per **(key × model)**, bukan per key. Satu model habis
  tidak lagi mematikan key untuk model lain.
- `403`/`401` → key bermasalah. `400` dengan pesan bukan-key →
  dilaporkan sebagai masalah permintaan, key sehat tidak ikut dihukum.
- Tombol **↺ Coba Lagi Sekarang** di panel API key untuk membuang
  seluruh masa istirahat.
- Panel API key menampilkan urutan model yang dicoba.

### Uji baru

`test/run23-rotasi-model.js` — membuktikan pada skenario nyata (2 model
kuota harian habis di semua key) sistem **tetap berhasil** lewat model
lain, panggilan berikutnya langsung ke model yang hidup, dan 404
dicoba sekali saja.

`test/run21-ai.js` diperbarui: 85 → **88 poin**.

### Cara memastikan

```bash
node test/run23-rotasi-model.js   # TOTAL BUG: 0
node test/run21-ai.js             # 88 lolos
```

Di aplikasi: Beranda → 🔑 Status API Key → **↺ Coba Lagi Sekarang**,
lalu ulangi Generate.


---

## Model AI diganti ke Gemini 3.5 Flash (v0.9.3)

**Satu berkas berubah: `Ai.gs`.**

### Urutan model baru

```
gemini-3.5-flash          ← terverifikasi guru masih gratis
gemini-3.5-flash-lite
gemini-2.5-flash-lite
gemini-2.5-flash
gemini-2.0-flash
```

Sebelumnya saya menaruh seri 2.5 di depan berdasarkan blog pihak ketiga
yang menyebut seri 3.x sudah berbayar. Guru punya **project yang
berjalan** dengan 3.5 dan masih gratis — bukti langsung lebih kuat
daripada artikel, jadi urutannya diubah.

Empat model lain tetap ada sebagai cadangan. Bila suatu saat 3.5
benar-benar ditutup untuk free tier, sistem otomatis turun ke 2.5 tanpa
perlu menyunting kode.

### 🔴 Bug yang ditemukan saat penggantian

Model yang lebih baru **belum tentu menerima `responseSchema`**. Kode
lama memperlakukan penolakan 400 sebagai "masalah permintaan" lalu
**menyerah total** — satu penolakan membuat seluruh generate gagal,
padahal modelnya sanggup bila dikirim tanpa skema.

Sekarang: bila pesan Google menyebut `responseSchema` /
`responseMimeType` / `Unknown name`, permintaan **diulang polos** pada
model yang sama, dengan tambahan instruksi *"balas HANYA JSON valid"*.
`_parseJson()` yang sudah ada menangani pagar ```json.

Model yang menolak skema **diingat 24 jam**, sehingga panggilan
berikutnya langsung dikirim polos — tanpa ini setiap generate
memboroskan satu percobaan gagal.

### Uji baru

`test/run24-skema-fallback.js` — membuktikan penolakan skema tidak
menggagalkan generate, model yang sama tetap dipakai, dan panggilan
kedua hanya butuh **1 percobaan**.

`run21-ai.js` & `run23-rotasi-model.js` diperbaiki agar membaca
`Ai.MODEL_BAWAAN` alih-alih menulis nama model secara tetap — supaya
tidak pecah lagi setiap kali daftar model diubah.

### Cara memastikan

```bash
node test/run24-skema-fallback.js   # TOTAL BUG: 0
node test/run23-rotasi-model.js     # TOTAL BUG: 0
```

Di Apps Script: `tesKoneksiAI()` — log menampilkan model yang berhasil
dipakai.


---

## 🔴 Token "thinking" memotong jawaban AI (v0.9.4)

**Dua berkas berubah:** `Ai.gs` · `Code.gs`

### Ditemukan dari log guru

```
✅ BERHASIL — key#8, 1.4 detik
   Balasan: Here is
```

Tesnya "berhasil", tetapi balasannya hanya dua kata. Itu bukan
keanehan log — itu gejala bug yang akan membuat **setiap generate
materi gagal**.

### Sebabnya

Gemini 2.5 ke atas menyalakan mode berpikir (*thinking*) secara
**bawaan**, dan token berpikir itu dipotong dari `maxOutputTokens`
yang sama. Proses berpikir memakan hampir seluruh jatah, menyisakan
ruang terlalu sedikit untuk jawaban — hasilnya terpotong di tengah
dengan `finishReason: MAX_TOKENS`.

Untuk `tesKoneksiAI()` (jatah 100 token) gejalanya jelas. Untuk
`generateMateri()` materi 900 kata akan terpotong, lalu `_parseJson`
gagal dengan pesan menyesatkan *"Jawaban AI tidak dapat dibaca"* —
guru akan mengira AI-nya bermasalah, bukan pengaturannya.

### Perbaikan

1. **Thinking dimatikan** — `thinkingConfig: { thinkingBudget: 0,
   thinkingLevel: 'MINIMAL' }`. Dua bentuk dikirim sekaligus karena
   seri 2.5 memakai `thinkingBudget` sedangkan 3.x memakai
   `thinkingLevel`. Menyusun materi ajar tidak butuh penalaran berlapis.

2. **Balasan terpotong tidak lagi dianggap sukses.** `finishReason
   MAX_TOKENS` memicu percobaan ulang tanpa `thinkingConfig`, lalu
   pindah model bila masih terpotong.

3. **Model yang menolak `thinkingConfig`** (400 `Unknown name`)
   otomatis dikirim ulang tanpa medan itu, dan diingat 24 jam.

4. **`tesKoneksiAI()` diperketat** — jatah token dinaikkan ke 2048 dan
   balasannya diperiksa benar-benar JSON. Log kini juga menyebut model
   yang dipakai.

### Uji baru

`test/run25-thinking.js` — thinkingConfig terkirim, balasan terpotong
ditolak, pulih di model lain, dan tetap jalan pada model yang tidak
mengenal thinkingConfig.

### Cara memastikan

Jalankan ulang `tesKoneksiAI()`. Keluaran yang benar:

```
✅ BERHASIL — key#8, model gemini-3.5-flash, 1.4 detik
   Balasan: {"pesan":"halo"}
   Format JSON terbaca. Generator AI siap dipakai.
```

Bila masih muncul balasan terpotong, log akan menyatakannya terang-terangan.


---

## thinkingBudget & thinkingLevel saling eksklusif (v0.9.5)

**Satu berkas berubah: `Ai.gs`.**

### Kesalahan saya

Pada v0.9.4 saya mengirim **dua** medan sekaligus dengan alasan
"medan yang tidak dikenal akan diabaikan". Ternyata salah — Gemini
menolaknya:

```
❌ GAGAL: You can only set only one of thinking budget
   and thinking level.
```

Akibatnya generator AI **mati total**, lebih buruk daripada sebelum
diperbaiki.

### Dua kesalahan sekaligus

**1. Mengirim dua medan yang saling eksklusif.** Seri 2.5 memakai
`thinkingBudget`, seri 3.x memakai `thinkingLevel` — harus dipilih
salah satu.

**2. Pola deteksi terlalu sempit.** Kode pemulihan mencari
`thinkingConfig|thinkingBudget|thinkingLevel` (camelCase), sedangkan
Google menulisnya dengan **spasi**: *"thinking budget"*. Pola tidak
cocok → pemulihan tidak pernah berjalan → seluruh generate gagal.

Kesalahan kedua ini yang membuat kegagalannya total. Seandainya polanya
benar, sistem akan pulih sendiri meski bentuknya keliru.

### Perbaikan

- Bentuk thinkingConfig **dipilih per model**: ditebak dari namanya
  (`gemini-3*` → level, sisanya → budget), dikoreksi oleh jawaban
  server, lalu **diingat 24 jam**
- Pesan *"only one of"* → tukar bentuk, ulangi model yang sama
- Pesan lain seputar thinking → buang medannya sama sekali
- Pola deteksi dilonggarkan: `thinking[ _]?(config|budget|level)`
  sehingga mengenali tulisan berspasi maupun camelCase

### Uji baru

`test/run26-gaya-thinking.js` — meniru **persis** error yang dialami
guru, lalu memastikan sistem menukar bentuk dan berhasil. Juga menguji
arah sebaliknya dan model yang tidak mengenal thinkingConfig sama sekali.

### Pelajaran

Asumsi "medan tak dikenal akan diabaikan" tidak berlaku untuk API ini.
Yang menyelamatkan seharusnya adalah jalur pemulihan — tetapi jalur itu
sendiri tidak teruji terhadap **kalimat asli** dari server, hanya
terhadap tebakan saya tentang bentuk kalimatnya.

### Cara memastikan

```bash
node test/run26-gaya-thinking.js   # TOTAL BUG: 0
```

Di editor: `tesKoneksiAI()` harus menampilkan
`Balasan: {"pesan":"halo"}` dan `Format JSON terbaca.`


---

## Nilai thinkingLevel & batas waktu (v0.9.6)

**Dua berkas berubah:** `Ai.gs` · `js_editor.html`

### Petunjuk dari log guru

```
✅ BERHASIL — key#1, model gemini-3.5-flash, 27.9 detik
   Balasan: { "pesan": "halo" }
```

Hasilnya benar, tetapi **27,9 detik** untuk permintaan sesederhana
`{"pesan":"halo"}` tidak wajar — tanda bahwa mode berpikir masih
berjalan penuh meski sudah kita matikan.

### Sebabnya

Dokumentasi REST Google menulis nilai `thinkingLevel` dengan **huruf
kecil** (`"low"`, `"minimal"`). Kode mengirim `'MINIMAL'` huruf besar.
Nilai yang tidak dikenal tampaknya **diabaikan diam-diam** — tidak ada
error, tetapi pengaturannya tidak berlaku.

Ini kesalahan yang sama polanya dengan v0.9.4: saya menebak bentuk yang
diterima API alih-alih mengikuti dokumentasinya.

### Perbaikan

1. **Nilai jadi huruf kecil** — `thinkingLevel: 'minimal'`
2. **Bertingkat bila ditolak** — `minimal` → `low`, lalu diingat 24 jam.
   Seri Pro tidak menerima `minimal`, hanya `low` ke atas
3. **`BATAS_TOTAL_MS` 90 → 240 detik.** Satu panggilan saja bisa 30
   detik; batas lama membuat rotasi berhenti setelah ~2 percobaan.
   240 detik masih aman dari batas 6 menit Apps Script
4. **Perkiraan di layar** disesuaikan 20–60 → 30–90 detik

### Uji baru

`test/run27-level-thinking.js` — nilai huruf kecil, kenaikan
`minimal`→`low` saat ditolak, nilai diingat, dan seri 2.5 tetap
memakai `thinkingBudget`.

### Cara memastikan

Jalankan ulang `tesKoneksiAI()` dan perhatikan **waktunya**:

| Waktu | Artinya |
|---|---|
| 2–8 detik | ✅ thinking benar-benar mati |
| 25–30 detik | ⚠️ masih berpikir penuh — kirimkan lognya |


---

## Gemini 3.6 Flash jadi model utama (v0.9.7)

**Tiga berkas berubah:** `Ai.gs` · `Code.gs` · `test/mock2.js` `test/mock.js`

### Urutan model

```
gemini-3.6-flash     ← terbaru, dipakai guru
gemini-3.5-flash
gemini-3.5-flash-lite
gemini-2.5-flash-lite
gemini-2.5-flash
gemini-2.0-flash
```

### Catatan tentang dokumentasi yang dikirim

Contoh resmi dari AI Studio memakai **Interactions API**:

```js
client.interactions.create({
  generation_config: { thinking_level: "low" }
})
```

Kode kita memakai **generateContent**, yang menaruhnya bersarang:

```js
generationConfig: { thinkingConfig: { thinkingLevel: "low" } }
```

Keduanya sah — beda endpoint, beda bentuk. Yang diadopsi adalah
**nilainya**: `"low"` huruf kecil kini didahulukan (sebelumnya
`minimal`), mengikuti contoh resmi.

### Dua temuan

**1. Pesan penolakan tanpa kata "thinking".** Sebagian balasan berbunyi
*"Invalid value: allowed values are minimal, high"* tanpa menyebut
`thinkingLevel` sama sekali. Pola lama tidak mengenalinya sehingga
seluruh generate gagal. Kini: selama kita memang sedang mengirim
thinkingConfig, keluhan soal nilai/enum dicurigai berasal dari situ.

**2. `deleteProperty` tidak ada di mock.** Apps Script asli
menyediakannya, mock kita tidak — sehingga jalur "kembalikan model ke
bawaan" tidak pernah benar-benar teruji. Mock dilengkapi
`deleteProperty` dan `getProperties`.

### Peringatan baru di `tesKoneksiAI()`

- Bila model yang berhasil **bukan** pilihan pertama → diberi tahu
  (endpoint mungkin belum mengenal 3.6, atau kuotanya habis)
- Bila permintaan sepele memakan **> 15 detik** → diberi tahu bahwa
  mode berpikir kemungkinan masih aktif

Keduanya tidak menggagalkan apa pun, hanya membuat penurunan diam-diam
menjadi terlihat.

### Uji baru

`test/run28-model36.js` — 3.6 dipakai lebih dulu, turun aman bila
endpoint belum mengenalnya (404 dicoba sekali saja), nilai level
menyesuaikan bila ditolak, seri 2.5 tetap `thinkingBudget`.


---

## Penyesuaian setelah 3.6 terukur (v0.9.8)

**Dua berkas berubah:** `Code.gs` · `js_editor.html`

### Hasil terukur di Apps Script

```
✅ BERHASIL — key#2, model gemini-3.6-flash, 1.4 detik
   Balasan: {"pesan":"halo"}
   Format JSON terbaca.
```

| | Sebelum | Sesudah |
|---|---|---|
| Waktu | 27,9 detik | **1,4 detik** |
| Model | 3.5 (cadangan) | **3.6 (utama)** |
| Balasan | JSON berpagar | JSON bersih |

Ini mengonfirmasi `thinkingLevel: "low"` huruf kecil benar-benar
diterima — sebelumnya `'MINIMAL'` huruf besar diabaikan diam-diam
sehingga model tetap berpikir penuh.

### Penyesuaian

- Perkiraan di layar 30–90 → **15–45 detik**
- Ambang peringatan `tesKoneksiAI()` 15 → **10 detik**, karena 1,4 detik
  kini terbukti sebagai patokan normal

Angka terukur dicatat di `README-TAHAP-7.md` dan `PANDUAN-UJI.md`
sebagai acuan bila suatu saat melambat lagi.


---

## 🔴 Penghapusan pertemuan/kelas sangat lambat (v0.9.9)

**Tiga berkas berubah:** `Pertemuan.gs` · `Kelas.gs` · `Code.gs` · `js_editor.html`

### Ditemukan dari log `ujiTahap7()`

Uji lolos 14/14, tetapi linimasanya janggal:

```
19:34:18  guard + riwayat selesai
19:36:44  Pertemuan uji dihapus     ← 146 detik!
```

Panggilan Gemini hanya 17 detik. Menghapus **satu pertemuan kosong**
memakan 146 detik — hampir setengah batas 6 menit Apps Script.

### Sebabnya

`Pertemuan.hapus()` dan `Kelas.hapus()` memakai `Db.baca()` /
`Db.saring()` yang **memindahkan seluruh sheet**. Untuk `progress`
32.400 baris itu 486.000 sel, hanya untuk menemukan beberapa baris.

Ini bukan sekadar masalah uji — **guru yang menghapus pertemuan
sungguhan mengalami hal yang sama**, dan pada kelas besar berisiko
menabrak batas eksekusi.

### Perbaikan

Memakai `Db.saringBaris()` yang sudah ada sejak T6-OPT-4: membaca satu
kolom kunci lalu mengambil baris yang cocok saja. `progress` disaring
lewat `pertemuan_id`/`kelas_id` (satu pemindaian), sheet lain lewat
`item_id` per item — jumlah item sedikit sehingga tetap murah.

| Operasi | Sebelum | Sesudah |
|---|---|---|
| Hapus 1 pertemuan | 650.299 sel | **114.647 sel** (−82%) |
| Hapus 1 kelas | — | **229.344 sel** |

### Temuan kedua: "7 key siap dipakai"

Bukan bug. Tiga key kuota hariannya habis di seluruh model, sehingga
berstatus *istirahat*. Sistem tetap berjalan memakai 7 key lain.

Yang diperbaiki adalah **penjelasannya** — `ujiTahap7()` dan panel
🔑 Status API Key kini menerangkan bahwa key istirahat akan pulih
sendiri (per menit ~60 detik; harian tengah malam Pasifik ≈ 14.00 WIB).

### Uji baru

`test/perf10-hapus.js` — biaya penghapusan berantai beserta pemeriksaan
tidak ada baris yatim yang tertinggal.


---

## 🏗️ Restrukturisasi hierarki — Materi Pokok (v1.0.0)

**Berkas baru:** `MateriPokok.gs`
**Diubah:** `Setup.gs` · `Util.gs` · `Pertemuan.gs` · `Belajar.gs` · `Code.gs`

> ⚠️ **Perubahan skema.** Wajib menjalankan `migrasiStruktur()`
> **lalu** `migrasiHierarki()` setelah menyalin berkas.

### Struktur baru

```
KELAS
 └── 1. MATERI POKOK 1
       ├── 1.1 Pertemuan 1          jenis: biasa
       │      ├── 📄 submateri 1
       │      ├── 📄 submateri 2
       │      ├── 📝 LKPD
       │      ├── 🎯 Quiz
       │      └── 🪞 Refleksi
       ├── 1.2 Pertemuan 2          jenis: biasa
       ├── 1.3 Ujian / UH           jenis: ujian
       └── 1.4 Refleksi Bab         jenis: refleksi
 └── 2. MATERI POKOK 2 …
```

### Keputusan rancangan

**Ujian & Refleksi Bab = pertemuan dengan `jenis` khusus**, bukan
entitas baru. Kolom `pertemuan.jenis` (`biasa`/`ujian`/`refleksi`)
cukup — unlock logic tetap dua tingkat di dalam materi pokok, tidak
bercabang.

**Refleksi = tipe item keempat** (`item.tipe`), versi ringkas dulu:
pertanyaan terbuka tersimpan JSON pada `item.konten`. Skala pemahaman
diri 1–5 dan balasan guru menyusul.

### Perubahan skema

| Sheet | Perubahan |
|---|---|
| `materi_pokok` | **BARU** — 11 kolom, ±60 baris/tahun |
| `pertemuan` | +`mp_id` +`jenis` |
| `item` | +`mp_id` (diwarisi dari pertemuan) |
| `progress` | +`mp_id` (agar penghapusan berantai tetap murah) |
| `item.tipe` | +`refleksi` |

### Unlock kini TIGA tingkat

```
Materi Pokok 2  terkunci sampai Materi Pokok 1 tuntas
  └── Pertemuan  terkunci sampai pertemuan sebelumnya tuntas
        └── Item terkunci sampai item sebelumnya tuntas (urut_ketat)
```

Materi pokok yang **tidak wajib** atau **kosong** tidak pernah
mengunci penerusnya — aturan yang sama dengan pertemuan (pelajaran
bug Tahap 3).

### Kompatibilitas

`Pertemuan.simpan()` tetap menerima `kelas_id` saja tanpa `mp_id`:
pertemuan otomatis masuk ke Materi Pokok pertama kelas itu, dibuatkan
bila belum ada. Guru yang belum butuh pengelompokan bab tidak
terganggu.

### Migrasi data lama

`migrasiHierarki()` membuat "Materi Pokok 1" per kelas lalu memasukkan
seluruh pertemuan yatim, menyesuaikan `mp_id` pada `item` dan
`progress`. **Aman dijalankan berulang** — pertemuan yang sudah punya
`mp_id` dilewati.

### Bug yang ditemukan saat pengerjaan

**Dua pembacaan `pertemuan` tidak menyertakan `mp_id`**, sehingga
pengelompokan gagal dan `bukaMateri()` menolak pertemuan yang
seharusnya terbuka. Ditemukan uji unlock, diperbaiki dengan
menyeragamkan lewat helper `_bacaPtm()`.

**Uji `run.js` memakai indeks kolom tetap** (`it[0][8]`) yang bergeser
saat skema berubah. Diperbaiki mencari lewat header — supaya tidak
pecah lagi setiap kali ada kolom baru.

### Uji baru

`test/run29-hierarki.js` — **48 poin**: migrasi data lama (termasuk
diulang), pewarisan `mp_id`, penomoran ulang tiap materi pokok, unlock
tiga tingkat, serta materi pokok opsional/kosong yang tidak mengunci.

### Cara memperbarui

```
1. Salin berkas (MateriPokok.gs BARU, Util/Setup/Pertemuan/Belajar/Code)
2. Jalankan migrasiStruktur()    → sheet & kolom baru
3. Jalankan migrasiHierarki()    → pertemuan lama masuk MP bawaan
4. Jalankan cekKesehatan()       → pastikan 15 sheet
```

### Yang BELUM dikerjakan

UI belum menyesuaikan — halaman guru masih menampilkan pertemuan
secara datar, dan sidebar murid belum menampilkan lapisan Materi
Pokok. Backend sudah siap penuh; tampilan menyusul.


---

## Cara Memperbarui di Apps Script

1. Buka berkas yang bersangkutan di editor
2. Pilih seluruh isi (`Ctrl+A`), timpa dengan versi baru
3. Simpan (`Ctrl+S`)
4. **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**

> Tanpa langkah 4, perubahan hanya berlaku saat dijalankan dari editor,
> bukan di aplikasi yang diakses murid.

### Memastikan berhasil

Jalankan dari editor:

```
ujiTahap3()     → daftar pertemuan tampil, P2 bertanda [KUNCI]
infoDatabase()  → muncul baris "Proyeksi progress…"
```

---

---

## v1.0.1 — Audit hierarki: 3 bug integritas data

Restrukturisasi v1.0.0 lolos seluruh 30 berkas uji, tetapi uji yang ada
hanya memeriksa **pembuatan** dan **unlock**. Tidak satu pun memeriksa apa
yang **tertinggal setelah penghapusan**, dan tidak satu pun memeriksa efek
samping dari jalur pemanggilan baru yang hanya mengirim `mp_id`.
Tiga bug bersembunyi persis di dua celah itu.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Db.gs` | 🔴 **Wajib** | `saringBarisBanyak()` BARU — satu pemindaian untuk banyak nilai |
| `Belajar.gs` | 🔴 **Wajib** | 3 jalur tulis `progress` kini mengisi `mp_id` |
| `Lkpd.gs` | 🔴 **Wajib** | tulis `progress` mengisi `mp_id` |
| `Quiz.gs` | 🔴 **Wajib** | tulis `progress` mengisi `mp_id` |
| `Pertemuan.gs` | 🔴 **Wajib** | notifikasi terbit memakai `kelasIdMp` |
| `Kelas.gs` | 🔴 **Wajib** | hapus kelas ikut membersihkan `materi_pokok` |
| `MateriPokok.gs` | 🔴 **Wajib** | hapus tahan baris progres lama tanpa `mp_id` |
| `Code.gs` | 🟡 Opsional | nomor versi 1.0.1 |

Berkas **tidak berubah**: seluruh `.html` · `Setup.gs` · `Util.gs` ·
`Auth.gs` · `Notif.gs` · `Beranda.gs` · `Ai.gs`.

### B1 — lima jalur tulis `progress` tidak mengisi `mp_id`

Skema v1.0.0 menambahkan kolom `mp_id` pada `progress`, dan
`MateriPokok.hapus()` menyaring justru lewat kolom itu. Tetapi tidak
satu pun dari lima jalur penulisan diperbarui, sehingga setiap baris
progres baru lahir dengan `mp_id` kosong.

Akibatnya menghapus satu Materi Pokok meninggalkan **seluruh** baris
progres muridnya. Baris yatim itu tetap terbaca `_progresMurid()`, jadi
bila `item_id` terpakai ulang murid bisa tampak sudah menyelesaikan
materi yang belum pernah dibukanya.

`migrasiHierarki()` tidak menutupi ini — migrasi memperbaiki data yang
sudah ada, sedangkan bug ini merusak data **baru**.

```js
// SEBELUM
Db.tambah('progress', {
  pertemuan_id: item.pertemuan_id, kelas_id: p.kelas_id, ...

// SESUDAH
Db.tambah('progress', {
  pertemuan_id: item.pertemuan_id, mp_id: item.mp_id || '',
  kelas_id: p.kelas_id, ...
```

`MateriPokok.hapus()` juga dibuat tahan banting: ia kini memindai
`pertemuan_id` selain `mp_id`, sehingga baris progres lama yang terlanjur
kosong tetap ikut terhapus.

### B2 — murid tidak diberi tahu pertemuan baru terbit

```js
// SEBELUM — p.kelas_id undefined bila pemanggil hanya mengirim mp_id
if (isi.status === 'publish') _notifTerbit(p.kelas_id, ...);

// SESUDAH — kelas diturunkan dari materi pokok
if (isi.status === 'publish') _notifTerbit(kelasIdMp, ...);
```

Komentar di atas blok itu sudah menyatakan "kelas_id diturunkan dari
materi pokok, bukan dikirim klien", dan baris `isi.kelas_id = kelasIdMp`
memang mengikutinya — hanya panggilan notifikasi yang terlewat.

Bug ini **diam**: tidak ada error, tidak ada log, pertemuan tetap terbit
dengan benar. Yang hilang hanya notifikasinya. Karena UI hierarki belum
dibuat, jalur ini belum pernah dipakai guru sungguhan.

### B3 — hapus kelas meninggalkan materi pokok yatim

`Kelas.hapus()` menghapus tujuh sheet berantai, tetapi daftarnya ditulis
sebelum sheet `materi_pokok` ada dan tidak pernah diperbarui. Hasilnya
`Kelas.hapus()` juga melaporkan `materi_pokok: 0` yang menyesatkan.

### Optimasi ikutan — `Db.saringBarisBanyak()`

Perbaikan B1 menambah pemindaian per pertemuan. Dijalankan apa adanya,
menghapus satu Materi Pokok berisi 15 pertemuan berarti memindai kolom
`progress` 15 kali. `saringBarisBanyak()` mencocokkan seluruh nilai dalam
**satu** pemindaian; pola yang sama dipakai juga untuk `item_id` di
`Pertemuan.hapus()` dan `Kelas.hapus()`.

Terukur pada data skala penuh (**432 murid**, 900 item, 32.400 baris
`progress`, 3.024 attempt), tanpa pengguna lain aktif:

| Operasi | Sebelum | Sesudah | Selisih |
|---|---|---|---|
| hapus 1 pertemuan | 114.647 sel | **84.485 sel** | −26% |
| hapus 1 kelas | 229.344 sel | **48.870 sel** | −79% |

### Uji

`test/run30-audit-hierarki.js` BARU — 22 poin, lima bagian: `mp_id` pada
tiap jalur tulis, kebersihan setelah hapus MP (termasuk baris lama tanpa
`mp_id`), notifikasi terbit, kebersihan setelah hapus kelas, dan
pemindaian yatim menyeluruh.

Uji ini **dibuktikan bisa merah**: ketiga bug disisipkan ulang ke kode,
uji menangkapnya dengan 11 poin gagal, lalu kode dipulihkan. Seluruh 31
berkas uji hijau tanpa regresi.

---

---

## v1.1.0 — UI hierarki tiga tingkat

Backend hierarki selesai di v1.0.0–1.0.1, tetapi UI masih menampilkan
pertemuan datar: guru tidak punya cara membuat Materi Pokok dari layar,
dan murid tidak melihat pengelompokan bab sama sekali. Versi ini menutup
jarak itu.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `MateriPokok.gs` | 🔴 **Wajib** | `struktur()` BARU — pohon lengkap untuk guru |
| `Pertemuan.gs` | 🔴 **Wajib** | `pindah()` BARU — antar Materi Pokok |
| `Code.gs` | 🔴 **Wajib** | API `getStrukturKelas` + `pindahPertemuan`, versi 1.1.0 |
| `js_editor.html` | 🔴 **Wajib** | halaman guru bertingkat + form Materi Pokok + pilihan `jenis` |
| `js_nav.html` | 🔴 **Wajib** | sidebar murid berlapis Materi Pokok |
| `js_belajar.html` | 🔴 **Wajib** | daftar isi murid dikelompokkan per bab |
| `css.html` | 🔴 **Wajib** | gaya `kartu-mp`, `sisi-mp`, `nomor-ptm`, penanda jenis |

Berkas **tidak berubah**: `Db.gs` · `Setup.gs` · `Util.gs` · `Auth.gs` ·
`Notif.gs` · `Beranda.gs` · `Belajar.gs` · `Lkpd.gs` · `Quiz.gs` ·
`Kelas.gs` · `Ai.gs` · `js_kelola.html` · seluruh `v_*.html`.

**Tidak ada rute baru** — hierarki muncul di dalam rute `#/kelas/{id}` dan
`#/kelas-saya/{id}` yang sudah ada, jadi larik `RUTE` di
`run10-integrasi.js` tidak berubah.

### Halaman guru

`MateriPokok.struktur(kelasId)` mengembalikan pohon lengkap dalam **satu**
panggilan, menggantikan dua panggilan terpisah. Berbeda dari
`Belajar.daftarPertemuan()`: draf ikut tampil (guru harus melihat yang
belum terbit) dan tidak ada perhitungan unlock sama sekali.

Tampilannya akordeon: Materi Pokok bisa dilipat, pertemuan menjorok
dengan garis penghubung, dan nomornya bertingkat (`1.2`, `1.3`). Ujian dan
Refleksi Bab diberi warna tepi serta ikon berbeda supaya langsung dikenali.

Materi pokok mana yang terbuka disimpan di `MP_TERBUKA` dan bertahan antar
penggambaran ulang — tanpa itu guru kehilangan tempatnya setiap kali
menyimpan.

**Pertemuan yatim tidak disembunyikan.** Bila ada pertemuan yang `mp_id`-nya
tidak menunjuk materi pokok mana pun (data belum termigrasi), ia muncul di
kotak peringatan berikut tombol Pindahkan. Menyembunyikannya akan membuat
guru mengira isinya hilang.

### `Pertemuan.pindah()` — kenapa bukan lewat `simpan()`

`mp_id` sengaja **tidak** bisa diubah lewat `simpan()`. Kepindahan bukan
sekadar mengganti satu kolom: `item` dan `progress` ikut membawa `mp_id`
demi penghapusan berantai yang murah, jadi ketiganya harus berubah
bersama-sama. Bila hanya kolom pertemuan yang diubah, menghapus materi
pokok tujuan akan meninggalkan item dan progres yatim — persis bug v1.0.1.

Pindah **lintas kelas ditolak**: `kelas_id` pada item dan progress tidak
ikut diperbarui, dan murid kelas tujuan tidak ter-enroll di sana.

### Sidebar murid

Sidebar kini tiga lapis. Materi Pokok terkunci menampilkan alasannya dan
**tidak membocorkan judul pertemuan di dalamnya** — hal yang diperiksa
khusus oleh uji, karena judul bab berikutnya kadang memuat bocoran materi
ujian.

Pelipatan Materi Pokok punya keadaannya sendiri (`Nav.lipatMp`), ikut
dikosongkan oleh `navReset()` saat logout — mengikuti pelajaran v0.8.1
soal sidebar bocor antar akun.

**Payload lama tetap jalan.** Bila `materi_pokok` tidak ada di data —
kelas yang belum dimigrasi, atau cache `sessionStorage` yang dibuat versi
sebelumnya — sidebar menggambar pertemuan datar seperti dulu alih-alih
tampil kosong. Hal yang sama berlaku pada daftar isi murid.

### Performa

Terukur pada data skala penuh (**432 murid**, 900 item, 32.400 baris
`progress`), satu guru aktif:

| Operasi | Biaya |
|---|---|
| `struktur()` 1 kelas, cache dingin | **1.154 sel** |
| `struktur()` 1 kelas, cache hangat | **1.104 sel** |

Murah karena seluruhnya memakai `Db.saringBaris()` dan cacah item dihitung
sekali jalan, bukan per pertemuan.

### Pratinjau

Dua berkas pratinjau kini **dihasilkan**, bukan ditulis tangan:

```bash
node test/buat-pratinjau.js        # pratinjau-sidebar.html (murid)
node test/buat-pratinjau-guru.js   # pratinjau-guru.html
```

Keduanya menyalin `css.html` dan berkas JS yang sebenarnya, sehingga tidak
mungkin basi. Pratinjau lama ditulis manual dan diam-diam menampilkan
tampilan yang sudah tidak ada lagi di aplikasi.

### Uji

`test/run31-ui-hierarki.js` BARU — 48 poin, dua bagian: backend
(`struktur`, `pindah`, penolakan lintas kelas, perapian urutan) dan
sidebar yang dijalankan di atas DOM tiruan (lapisan MP, penomoran
bertingkat, kerahasiaan bab terkunci, pelipatan, payload lama).

Uji ini **dibuktikan bisa merah**: tiga cacat disisipkan (pindah tidak
memperbarui `progress`, sidebar mengabaikan lapisan MP, `struktur`
menyembunyikan draf) dan tertangkap dengan 16 poin gagal.

Saat pembuktian itu ditemukan **cacat pada ujinya sendiri**: satu poin
merah di awal menyebabkan `TypeError` yang menghentikan seluruh berkas,
sehingga puluhan poin sesudahnya tidak pernah dijalankan — pembuktian
"bisa merah" jadi tidak sahih. Helper `B()` sekarang menerima fungsi dan
menghitung galat sebagai GAGAL, bukan sebagai penghenti.

Seluruh 32 berkas uji hijau tanpa regresi.

---

---

## v1.1.1 — Salin & duplikat pada hierarki

`Pertemuan.salin()` ditulis di Tahap 4, jauh sebelum kolom `mp_id` ada.
Ketika hierarki ditambahkan di v1.0.0, fungsi itu tidak ikut disisir —
dan tidak satu pun dari 32 berkas uji pernah menjalankannya di atas
struktur berbab. Empat bug bersembunyi di sana, satu di antaranya
menyebabkan **kehilangan data lintas kelas**.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Pertemuan.gs` | 🔴 **Wajib** | `salin()` mengisi `mp_id` & `jenis`, mode cermin struktur |
| `Kelas.gs` | 🔴 **Wajib** | `duplikat()` mewarisi pembagian bab |
| `Setup.gs` | 🔴 **Wajib** | `migrasiHierarki()` memulihkan `mp_id` silang kelas |
| `Code.gs` | 🟡 Opsional | nomor versi 1.1.1 |

Berkas **tidak berubah**: seluruh `.html` · `Db.gs` · `Util.gs` ·
`Auth.gs` · `Notif.gs` · `Beranda.gs` · `Belajar.gs` · `Lkpd.gs` ·
`Quiz.gs` · `MateriPokok.gs` · `Ai.gs`.

### B3 — kehilangan data lintas kelas (paling parah)

`salin()` menyalin seluruh kolom item apa adanya, termasuk `mp_id`.
Akibatnya item di kelas **tujuan** menunjuk Materi Pokok milik kelas
**asal**. Karena `MateriPokok.hapus()` menyaring lewat kolom itu:

> Guru menghapus satu Materi Pokok di kelas XI-1 → item di kelas XI-2,
> XI-3, dan seterusnya ikut terhapus.

Terbukti di uji: kelas tujuan berisi 1 item, setelah menghapus materi
pokok di kelas asal menjadi 0.

```js
// SEBELUM — mp_id ikut tersalin apa adanya
salinan.pertemuan_id = idPtmBaru;
salinan.kelas_id = kid;

// SESUDAH
salinan.pertemuan_id = idPtmBaru;
salinan.mp_id = mpIni;      // WAJIB — kalau tidak, hapus lintas kelas
salinan.kelas_id = kid;
```

### B1 — salinan lahir yatim

Pertemuan hasil salin tidak diberi `mp_id` sama sekali, sehingga tidak
muncul di Materi Pokok mana pun dan **tidak terlihat murid**. Halaman
guru menampilkannya di kotak peringatan "belum masuk Materi Pokok" —
yang justru menjadi petunjuk pertama adanya bug ini.

### B2 — jenis pertemuan hilang

Ujian/UH yang disalin ke kelas lain berubah menjadi pertemuan biasa.
Kolom `jenis` tidak ikut dalam daftar kolom yang disalin.

### B4 — duplikat kelas meratakan bab

`Kelas.duplikat()` memanggil `salin()`, yang menaruh semua pertemuan ke
satu Materi Pokok bawaan. Kelas dengan 5 bab diduplikasi menjadi kelas
dengan 1 bab berisi semua pertemuan.

Diperbaiki dengan parameter baru `cerminStruktur`: Materi Pokok asal
direplikasi di kelas tujuan dan tiap pertemuan mendarat di bab
padanannya. Hanya dipakai `duplikat()`; salin manual antar kelas tetap
menaruh ke bab bawaan, karena guru memilih sendiri pertemuan mana yang
disalin dan belum tentu ingin membawa seluruh strukturnya.

Materi Pokok bawaan kini dibuat **malas** — hanya saat benar-benar
dipakai. Tanpa itu setiap kelas hasil duplikat mendapat "Materi Pokok 1"
kosong yang tidak pernah terisi.

### Dua celah pemulihan di `migrasiHierarki()`

**Silang kelas tidak terdeteksi.** Migrasi hanya mencari `mp_id` yang
kosong, padahal data korup keluaran `salin()` lama punya `mp_id` yang
*terisi* — hanya saja menunjuk kelas lain. Sekarang migrasi
membandingkan pemilik materi pokok dengan `kelas_id` pertemuan.

**Nomor bentrok.** Penomoran ulang dimulai dari 1, padahal Materi Pokok
target bisa sudah berisi pertemuan sehat. Empat pertemuan bernomor
`1,1,2,2` membuat urutan tampil tak menentu. Sekarang penomoran
dilanjutkan dari nomor tertinggi yang ada.

> **Bila Anda pernah memakai Salin atau Duplikat**, jalankan
> `migrasiHierarki()` sekali setelah memperbarui berkas. Fungsi itu
> memulihkan data yang terlanjur korup dan aman diulang.

### Performa

Data skala penuh (**432 murid**, 900 item, 32.400 baris `progress`),
satu guru aktif:

| Operasi | Biaya |
|---|---|
| duplikat kelas + isi (15 pertemuan, cermin struktur) | **2.490 sel** |
| `struktur()` 1 kelas | **1.180 sel** |

### Uji

`test/run32-salin-hierarki.js` BARU — 34 poin, delapan bagian: salin
antar kelas, pembuktian tidak ada kehilangan data lintas kelas,
duplikat menjaga bab, pemulihan data korup lewat migrasi, perbaikan
`mp_id` silang kelas, nomor tidak bentrok, murid benar-benar melihat
hasil salin, dan pemindaian yatim menyeluruh.

Dibuktikan bisa merah: enam cacat disisipkan ulang, tertangkap dengan
**24 poin gagal**, lalu kode dipulihkan. Seluruh 33 berkas uji hijau.

---

---

## v1.2.0 — Refleksi murid

Item tipe keempat: **refleksi**. Sebelumnya `refleksi` sudah diterima
skema dan bisa dipilih guru sebagai jenis pertemuan, tetapi tidak ada
logika maupun layar pengisiannya — murid tidak bisa berbuat apa-apa
dengannya. Versi ini melengkapinya.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Refleksi.gs` | 🔴 **BARU** | seluruh logika refleksi |
| `js_refleksi.html` | 🔴 **BARU** | halaman murid + rekap guru |
| `index.html` | 🔴 **Wajib** | menyertakan `js_refleksi` |
| `Code.gs` | 🔴 **Wajib** | 6 API baru, versi 1.2.0, cekKesehatan |
| `Setup.gs` | 🔴 **Wajib** | jenis notifikasi `refleksi_dibalas` |
| `js_editor.html` | 🔴 **Wajib** | tombol + penyusun pertanyaan refleksi |
| `js_nav.html` | 🔴 **Wajib** | rute & ikon refleksi di sidebar |
| `js_belajar.html` | 🔴 **Wajib** | klik item refleksi |
| `v_editor.html` | 🔴 **Wajib** | pembungkus `ed-blok-konten` |
| `css.html` | 🔴 **Wajib** | gaya skala, sebaran, penyusun pertanyaan |

**Tidak ada perubahan skema sheet** — refleksi memakai ulang
`lkpd_submission`. Tidak perlu `migrasiStruktur()`.

Satu-satunya perubahan struktur adalah nilai enum baru pada kolom
`notifikasi.jenis`. Sheet lama tetap berjalan; validasi enum hanya
memengaruhi baris baru.

### Bentuk data — tanpa tabel baru

Pertanyaan disimpan guru sebagai JSON pada `item.konten`:

```json
[{"t":"Apa yang paling menantang?","wajib":true},
 {"t":"Di mana dipakai di dunia kerja?","wajib":false}]
```

Jawaban murid memakai ulang `lkpd_submission` (§6.5.3):

| Kolom | Dipakai untuk |
|---|---|
| `links` | JSON larik jawaban |
| `nilai` | skala pemahaman diri 1–5 |
| `catatan_guru` · `dibaca_murid` | balasan guru |
| `status` | `draft` selagi diisi, `diterima` setelah dikirim |

### Tiga keputusan (dikonfirmasi user)

**Skala 1–5 disertakan sekarang**, bukan menyusul. Kolom `nilai` sudah
ada, jadi tanpa biaya skema — dan menundanya berarti menyentuh UI
refleksi dua kali.

**Guru dapat membalas**, memakai mekanisme `catatan_guru` +
`dibaca_murid` yang sudah berjalan di LKPD dan Quiz. Murid mendapat
notifikasi in-app.

**Refleksi langsung `selesai` begitu dikirim** — tidak menunggu guru.
Bila menunggu seperti LKPD, 432 murid bisa tertahan hanya karena guru
belum sempat membaca. Refleksi juga tidak dinilai benar/salah: skala
1–5 adalah penilaian diri murid.

### Rekap guru dikelompokkan per PERTANYAAN

Bukan per murid. Guru membaca refleksi untuk menemukan **pola** —
36 jawaban atas satu pertanyaan terbaca sekali jalan, sedangkan per
murid berarti melompat-lompat antar topik.

Rata-rata skala ditampilkan sebagai penanda dini (§6.5.4): bila
**< 3**, muncul peringatan bahwa materi perlu diulang sebelum
melanjutkan. Sebaran 1–5 digambar sebagai grafik batang kecil, dengan
warna merah→hijau supaya murid berskala rendah langsung terlihat.

### Performa

Data skala penuh (**432 murid**, 900 item, 32.400 baris `progress`),
satu guru aktif:

| Operasi | Biaya |
|---|---|
| rekap refleksi 36 jawaban | **6.037 sel** |

Memakai `Db.saringBaris()` untuk isian dan `saringBarisBanyak()` pada
daftar kelas — bukan membaca seluruh sheet.

### Rute baru

`#/refleksi/{itemId}` (murid) · `#/refleksi-kelas/{kelasId}` (guru) ·
`#/rekap-refleksi/{itemId}` (guru)

Ketiganya sudah ditambahkan ke larik `RUTE` di `run10-integrasi.js`
sesuai aturan yang berlaku.

### Uji

`test/run33-refleksi.js` BARU — 69 poin, sebelas bagian: pembacaan
pertanyaan (termasuk bentuk lama berupa larik string), pengisian,
validasi, penyelesaian seketika, penguncian setelah kirim, sanitasi,
rekap, balasan, penjagaan akses, penghapusan berantai, dan UI di atas
DOM tiruan.

Dibuktikan bisa merah. Pembuktian pertama **tidak sahih**: cacat
"refleksi menunggu guru" hanya saya sisipkan di satu dari dua jalur
tulis (`perbarui` dan `tambah`), sehingga bagian D tetap hijau. Setelah
cacat disisipkan menyeluruh, ternyata uji **kurang mengunci status
submission** — progress ditulis `selesai` tetapi baris submission
tertinggal `menunggu`, dan rekap guru diam-diam kehilangan jawaban itu.
Dua poin ditambahkan untuk menutupnya; cacat kini tertangkap 12 poin.

Seluruh 34 berkas uji hijau.

### Pratinjau

```bash
node test/buat-pratinjau-refleksi.js   # pratinjau-refleksi.html
```

Menampilkan tampilan murid dan rekap guru berdampingan.

---

---

## v1.2.1 — Validasi dropdown ikut termigrasi

**Ditemukan di Apps Script sungguhan**, bukan di uji. `ujiTahap9()`
melaporkan:

```
❌ notifikasi refleksi_dibalas terkirim → 0 notifikasi
❌ tautan notifikasi benar
```

54 dari 56 lolos. Padahal 34 berkas uji hijau semua.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Setup.gs` | 🔴 **Wajib** | `migrasiStruktur()` memperbarui validasi enum |
| `Code.gs` | 🟡 Opsional | nomor versi 1.2.1 |

Berkas lain **tidak berubah**.

> Setelah menyalin, jalankan **`migrasiStruktur()`** sekali lagi. Log
> akan menampilkan `~ notifikasi  validasi dropdown diperbarui`.
> Baru setelah itu `ujiTahap9()` lolos 56/56.

### Sebab — berlapis tiga

**1. Sheets menolak dalam diam.** Setiap kolom ber-enum dipasangi
validasi dropdown dengan `setAllowInvalid(false)`. Ketika Apps Script
menulis nilai di luar daftar, Sheets menolaknya — dan penolakan itu
**tidak melempar galat**. `Db.tambah()` mengembalikan sukses, barisnya
diam-diam tidak tersimpan.

**2. Migrasi melewatkan enum.** `migrasiStruktur()` hanya memanggil
`_formatUlang()` bila ada **kolom** baru:

```js
// SEBELUM
if (ditambah.length) { _formatUlang(sh, def); … }
// tidak ada cabang lain — enum baru tak pernah sampai ke sheet
```

Sheet `notifikasi` tidak mendapat kolom baru di v1.2.0, hanya nilai enum
baru `refleksi_dibalas`. Jadi validasinya tetap versi lama.

**3. Mock mengabaikan validasi.** `mock2.js` menjadikan
`setDataValidation()` sebagai no-op, sehingga penulisan itu "berhasil"
di seluruh uji.

### Perbaikan

```js
// SESUDAH
if (ditambah.length) {
  _formatUlang(sh, def);
} else if (_enumBerubah(sh, def)) {
  _pasangValidasi(sh, def);          // enum bertambah tanpa kolom baru
}
```

`_enumBerubah()` membandingkan daftar terpasang di sheet
(`getDataValidation()`) dengan SKEMA. Bila API itu tidak tersedia,
mengembalikan `true` — memasang ulang selalu aman, jauh lebih murah
daripada risiko nilai tertolak dalam diam.

Blok validasi di `_formatUlang()` diganti pemanggilan `_pasangValidasi()`
supaya tidak ada dua salinan logika yang bisa menyimpang.

### `mock3.js` BARU — menegakkan validasi

Menolak nilai enum di luar daftar dan mencatatnya ke larik
`pelanggaran`, meniru perilaku Sheets. Juga menyediakan
`getDataValidation()` supaya `_enumBerubah()` teruji dengan setia.

Selama pembuatan uji, mock ini sempat **kekurangan `getDataValidation()`**
sehingga `_enumBerubah()` selalu `true` dan migrasi melaporkan 13
perubahan palsu setiap dijalankan. Diverifikasi sebagai **cacat mock,
bukan bug kode**, lalu mock dilengkapi.

### Uji

`test/run34-enum-validasi.js` BARU — 18 poin, enam bagian:

- mock benar-benar menegakkan validasi (kalau tidak, sisanya tak berarti)
- bug asli: `refleksi_dibalas` diterima setelah migrasi
- migrasi aman diulang, tanpa perubahan palsu
- **seluruh 118 nilai enum di SKEMA** dapat ditulis — menutup kelas bug
  ini untuk semua sheet, bukan hanya `notifikasi`
- audit statis: setiap jenis yang dikirim `Notif.kirim*` terdaftar di
  SKEMA, menyebut berkas asalnya bila tidak
- tipe `refleksi` ada di `item`, `progress`, dan `pertemuan.jenis`

Dibuktikan bisa merah dua kali: bug asli disisipkan ulang (2 poin
gagal), lalu penyebab akarnya — `refleksi_dibalas` dihapus dari SKEMA —
tertangkap bagian E dengan menyebut `refleksi_dibalas (Refleksi)`.

Seluruh 35 berkas uji hijau.

### Terbukti di Apps Script (11.23, v1.2.1)

```
F. Refleksi — rekap guru
  ✅ balasan sampai ke murid
  ✅ notifikasi refleksi_dibalas terkirim  1 notifikasi
  ✅ tautan notifikasi benar  #/refleksi/ITM-0031
  …
  LOLOS: 56   GAGAL: 0   (171 detik)
✅ Hierarki tiga tingkat & Refleksi berfungsi di Apps Script.
```

Dua jalankan berturut-turut: **131 detik** (v1.2.0, 54/56) dan
**171 detik** (v1.2.1, 56/56). Selisih 30% itu **variasi beban Google,
bukan regresi** — perbaikan enum hanya berjalan di `migrasiStruktur()`,
tidak disentuh `ujiTahap9()` sama sekali. Setiap kelompok operasi naik
merata (buat pertemuan 10→17 dtk, bersih-bersih 16→20 dtk), pola yang
khas untuk fluktuasi latensi API, bukan satu operasi yang melambat.

Angka kasarnya: **±3 detik per operasi tulis** pada Apps Script. Itu
sebabnya guru merasakan jeda 2–5 detik saat menyimpan pertemuan — batas
bawah platform, bukan sesuatu yang bisa dioptimasi dari sisi kode.

### Pelajaran

Uji yang memakai mock hanya sekuat kesetiaan mock-nya. `setDataValidation()`
diabaikan sejak Tahap 1 dan baru terasa akibatnya di v1.2.0 — bug pertama
dalam proyek ini yang **hanya bisa ditemukan di Apps Script sungguhan**.

Waktu `ujiTahap9()` di Apps Script: **131 detik** untuk 56 pemeriksaan,
tersebar merata (hapus Materi Pokok 14 dtk, bersih-bersih 16 dtk) —
tidak ada satu operasi yang meledak seperti kasus 146 detik di Tahap 7.

---

---

## v1.2.2 — Perbaikan hasil uji layar

Uji layar v1.2.1 oleh guru menemukan **3 bug UI** dan **1 permintaan
revisi**. Semuanya di sisi tampilan — tidak satu pun tertangkap 35
berkas uji, karena uji UI sebelumnya memakai DOM tiruan yang hanya
menyimpan `innerHTML` sebagai string.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_editor.html` | 🔴 **Wajib** | A2 pelipatan bab · A5 tombol ↑↓ item · A6 tombol Penilaian |
| `js_refleksi.html` | 🔴 **Wajib** | payload dijaga · tombol kembali ke item |
| `js_kelola.html` | 🔴 **Wajib** | tombol 🪞 Refleksi pada kartu kelas |
| `Refleksi.gs` | 🟡 Disarankan | pengurutan nomor tanpa `localeCompare` beropsi |
| `Code.gs` | 🟡 Disarankan | `diagRefleksi()` BARU, versi 1.2.2 |

### A2 — bab pertama tidak bisa dilipat

Aturan "buka bab pertama otomatis" memeriksa apakah **ada** bab yang
terbuka. Begitu guru melipat bab terakhir yang terbuka, seluruh nilai
menjadi `false` — dan penggambaran ulang langsung membukanya kembali.
Bab pertama tampak mustahil dilipat.

```js
// SEBELUM — tidak bisa membedakan "baru dibuka" dari "sengaja dilipat semua"
if (mp.length && !Object.keys(MP_TERBUKA).some(function (id) {
  return MP_TERBUKA[id];
})) MP_TERBUKA[mp[0].mp_id] = true;

// SESUDAH — penanda kelas yang sedang digambar
if (MP_DISENTUH !== kelasId) {
  MP_DISENTUH = kelasId;
  MP_TERBUKA = {};
  if (mp.length) MP_TERBUKA[mp[0].mp_id] = true;
}
```

Efek samping yang ikut beres: berpindah kelas kini menyetel ulang
pelipatan, tidak membawa keadaan kelas sebelumnya.

### A5 — tombol ↑ ↓ pada item tidak dikelabukan

`barisItemGuru()` tidak pernah menerima indeks, jadi tidak bisa tahu
mana item pertama/terakhir. Daftar pertemuan sudah benar sejak v1.1.0 —
daftar item terlewat. Guru menekan ↑ pada item teratas dan tidak terjadi
apa-apa, tampak seperti kerusakan.

### A6 — tombol Penilaian refleksi dipindah *(permintaan guru)*

Semula 🪞 Refleksi ada di kepala halaman kelas. Guru meminta tombolnya
berada **pada item refleksi itu sendiri**, sejajar dengan 📥 Penilaian
LKPD dan 📊 Penilaian Quiz. Lebih konsisten: semua penilaian diakses
dari itemnya.

Rekap kini kembali ke **Kelola Item**, bukan ke daftar refleksi.
Halaman daftar refleksi sekelas tetap ada — jalan masuknya dipindah ke
tombol **🪞 Refleksi** pada kartu kelas di Kelola Kelas, supaya rute
`#/refleksi-kelas/` tidak menjadi yatim.

### Payload rekap dijaga

`gambarRekapRefleksi()` langsung memanggil `d.sebaran_skala.concat()`.
Satu properti hilang — balasan terpotong, atau payload versi lama —
membuat seluruh halaman gagal digambar dan guru melihat "terjadi
kesalahan". Sekarang seluruh properti diberi nilai bawaan.

### F2 — belum dapat direproduksi

Guru melaporkan rekap refleksi gagal terbuka. Backend diuji bersih:
`getRekapRefleksi` lewat jalur API lolos, termasuk untuk konten
mengandung `< >`, apostrof, ampersand, dan tag HTML. Frontend juga tahan
seluruh bentuk payload wajar.

Yang bisa diperbaiki tanpa menebak sudah dikerjakan (penjagaan payload,
`localeCompare` beropsi diganti pembanding numerik biasa — modul lain
memakai bentuk sederhana, hanya `Refleksi.gs` menyimpang).

Ditambahkan **`diagRefleksi()`**: menelusuri setiap item refleksi di
database sungguhan, melaporkan isi kolom `konten`, jumlah isian murid,
JSON yang rusak, dan **galat asli** berikut baris kodenya bila rekap
gagal. Jujur: penyebab F2 belum diketahui, dan menambal secara menebak
justru menyembunyikannya.

### `run35-ui-dom.js` BARU — DOM sungguhan

41 poin memakai **jsdom**, bukan DOM tiruan. Menutup tiga celah yang
membuat A2 dan A5 lolos:

| Celah | Contoh yang kini teruji |
|---|---|
| keadaan antar penggambaran ulang | bab tetap terlipat setelah simpan |
| atribut `disabled` | ↑ item pertama, ↓ item terakhir |
| hasil klik sungguhan | `.click()` pada judul bab, tombol ✕, + Pertanyaan |

Dibuktikan bisa merah: A2 dan A5 disisipkan ulang, tertangkap **8 poin
gagal**.

Uji ini melewatkan dirinya sendiri dengan pesan jelas bila `jsdom`
belum terpasang, jadi tidak memecahkan regresi di lingkungan lain.

### Perkakas

- `package.json` — mencatat `jsdom` sebagai devDependency
- `test/jalankan-semua.sh` — satu perintah regresi penuh
  (`npm run uji`), menggantikan dua blok `for` yang disalin manual

Seluruh **36 berkas uji hijau**.

---

---

## v1.2.3 — Balasan API aman diserialkan

Guru melaporkan tombol **Ubah** pada Materi Pokok tetap gagal setelah
v1.2.2, dengan console peramban hanya menampilkan:

```
Uncaught (in promise) Object
```

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `MateriPokok.gs` | 🔴 **Wajib** | `detail()` menyusun balasan eksplisit |
| `Pertemuan.gs` | 🔴 **Wajib** | `detail()` diperkuat dengan cara sama |
| `js_core.html` | 🔴 **Wajib** | `callApi()` mencatat galat ke console |
| `Code.gs` | 🟡 Disarankan | `diagUbahMateriPokok()` BARU, versi 1.2.3 |

### Sebab yang diperbaiki

`MateriPokok.detail()` meneruskan **baris sheet mentah** ke peramban:

```js
// SEBELUM
var m = Db.cariBarisCache('materi_pokok', 'mp_id', mpId);
delete m._baris;
return m;                 // membawa created_at & updated_at
```

Kedua kolom itu berisi objek `Date` dari Sheets. Bila selnya rusak —
`#REF!`, teks bebas, atau `Date` invalid akibat impor/salin-tempel —
`google.script.run` gagal menyerialkan balasan. Galatnya sampai ke
peramban **tanpa pesan**, tepat seperti gejala yang dilaporkan.

Form Ubah tidak memerlukan kolom tanggal sama sekali, jadi kini
balasannya disusun eksplisit dan tanggal tidak ikut dikirim.
`Pertemuan.detail()` punya kerapuhan yang sama dan ikut diperkuat.

### Console tidak lagi buram

`callApi()` kini mencetak nama fungsi dan pesan aslinya:

```
[LessonLen] getDetailMateriPokok() gagal: KESALAHAN_SERVER — Terjadi kesalahan.
  argumen : ["MP-0003"]
  respons : {"ok":false,…}
```

Ditambah jaring `unhandledrejection`: penolakan yang sudah ditangani
`callApi()` (sudah memunculkan toast dan mencatat rinciannya) tidak lagi
memenuhi console dengan objek buram.

> **Jujur:** bug ini tidak dapat direproduksi di lingkungan uji.
> Backend lolos untuk seluruh bentuk data yang dicoba, termasuk tanggal
> rusak, kolom hilang, dan cache basi; alur klik pun berhasil di DOM
> sungguhan. Perbaikan ini menghilangkan **kerapuhan yang nyata dan
> terbukti** (serialisasi Date), tetapi belum tentu penyebab persisnya.
> Karena itu pelaporan console diperkuat — supaya kegagalan berikutnya
> menyebut sendiri sumbernya.

Ditambahkan **`diagUbahMateriPokok()`**: memeriksa setiap Materi Pokok
di database sungguhan, melaporkan tipe nilai kolom tanggal, hasil uji
serialisasi, galat asli berikut baris kodenya, dan 10 catatan galat
terakhir dari sheet `log`.

### Uji

`test/run36-payload-aman.js` BARU — 48 poin, lima bagian:

- `detail()` tidak mengirim kolom tanggal maupun `_baris`
- tahan **empat bentuk tanggal rusak** (`Date` invalid, `#REF!`,
  angka mentah, kosong) pada Materi Pokok dan Pertemuan
- **sepuluh balasan API** yang mengisi form lolos
  `JSON.parse(JSON.stringify(...))` — tiruan terdekat dari apa yang
  dilakukan `google.script.run`
- `callApi()` mencatat ke console dan memasang jaring penolakan
- `detail()` tetap menolak id tak dikenal dengan pesan terbaca

Dibuktikan bisa merah dua kali: bentuk lama `detail()` dikembalikan
(2 poin gagal), lalu pelaporan console dilumpuhkan (2 poin gagal).

Seluruh **37 berkas uji hijau**.

---

---

## v1.2.4 — Akar masalah: objek Date dari getValues()

Console peramban akhirnya menyebutkan penyebabnya:

```
[LessonLen] getRekapRefleksi() gagal: GALAT — tanpa pesan
  argumen : ["ITM-0034"]
  respons : null
```

`respons : null` — bukan `{ok:false}`. Server **tidak** melempar galat;
balasannya yang **gagal diserialkan**.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Db.gs` | 🔴 **Wajib** | helper `_aman()` pada SELURUH jalur baca |
| `Code.gs` | 🟡 Disarankan | versi 1.2.4 |

Satu berkas inti. Perbaikan v1.2.3 (`MateriPokok.gs`, `Pertemuan.gs`,
`js_core.html`) tetap berlaku dan tidak perlu diubah lagi.

### Akar masalahnya

`getValues()` mengembalikan **objek `Date`** untuk sel bertipe tanggal.
Objek Date tidak dapat diserialkan `google.script.run` bila nilainya
rusak — dan kegagalannya **senyap**: peramban menerima `null`, bukan
pesan galat.

Yang membuatnya sulit dilacak: `Db.baca()` **kebetulan aman**, karena
hasilnya melewati `JSON.stringify` untuk cache — Date terlanjur menjadi
string di sana. Jalur yang **tidak** lewat cache meneruskan Date apa
adanya:

| Jalur | Lewat cache JSON? | Aman? |
|---|---|---|
| `Db.baca` / `Db.cari` / `Db.saring` | ya | ✅ kebetulan |
| `cariCepat` · `cariBarisCache` | tidak | ❌ |
| `saringBaris` · `saringBarisBanyak` | tidak | ❌ |
| `bacaKolom` · `bacaBarisJika` | tidak | ❌ |
| sheet dalam `TANPA_CACHE` | tidak pernah | ❌ |

Itulah sebabnya **Ubah Pertemuan berhasil** (`Db.cari`, lewat cache)
sementara **rekap refleksi gagal** (`saringBaris`, membawa
`waktu_kumpul` mentah) — sheet setara, jalur baca berbeda.

Ini menjelaskan seluruh gejala sekaligus: mengapa hanya sebagian tombol
gagal, mengapa tidak dapat direproduksi di mock (mock menyimpan tanggal
sebagai objek JS biasa yang selalu bisa diserialkan), dan mengapa
tambalan per-fungsi di v1.2.3 tidak menyelesaikannya.

### Perbaikan — satu tempat

```js
function _aman(v) {
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return '';       // tanggal rusak
    try {
      return Utilities.formatDate(v, 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
    } catch (e) { return ''; }               // di luar jangkauan
  }
  return v;
}
```

Dipasang pada **sepuluh** titik penyusunan objek di `Db.gs`, termasuk
`Db.baca()` sendiri. Menyeragamkan di satu tempat, bukan menambal tiap
fungsi yang mengembalikan data.

### Regresi yang ditangkap uji sendiri

Perbaikan pertama hanya menyentuh jalur non-cache. `run8-cache` langsung
merah:

```
🔴 cariCepat identik dgn cari (20 sampel) → item.item_id=ITM-0005
```

`Db.cari` menghasilkan `"2026-08-05T07:40:37.475Z"` (ISO, dari
`JSON.stringify`) sedangkan `cariCepat` `"2026-08-05 07:40:37"`. Dua
jalur baca yang seharusnya identik jadi berbeda bentuk — persis kelas
bug yang membuat perbandingan dan cache meleset diam-diam.

Diperbaiki dengan memasang `_aman()` di `Db.baca()` juga. Uji lama
menyelamatkan perbaikan baru.

### Performa

Tidak berubah. `_aman()` hanya operasi memori, bukan panggilan API.
Diukur ulang pada 432 murid: rekap refleksi **6.037 sel**, hapus
pertemuan **88.046 sel**, duplikat kelas **2.490 sel** — sama persis
dengan v1.2.3.

### Uji

`run36-payload-aman.js` diperluas menjadi **71 poin**, dua bagian baru:

- **delapan jalur baca `Db`** diperiksa bebas Date sekaligus lolos
  serialisasi, termasuk sheet `TANPA_CACHE`
- `Db.cari` dan `cariCepat` wajib **sepakat soal format tanggal**
- rekap refleksi: `waktu_kumpul` berupa teks, bukan Date

Dibuktikan bisa merah: `_aman()` dilepas dari jalur non-cache →
**7 poin gagal**, termasuk `waktu_kumpul` yang menjadi gejala asli.

### Perkakas

`test/jalankan-semua.sh` kini membedakan **dilewati** dari **gagal**.
`run35-ui-dom` melewatkan dirinya bila `jsdom` belum terpasang —
`node_modules` tidak ikut tersimpan di snapshot, jadi kondisi itu wajar
dan tidak boleh dihitung sebagai kegagalan.

Seluruh **37 berkas uji hijau**.

---

---

## v1.2.5 — Kesegaran sidebar & beranda ringkas

Dua bug dari uji layar, keduanya soal data basi.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_nav.html` | 🔴 **Wajib** | cache memori disegarkan di latar |
| `Beranda.gs` | 🔴 **Wajib** | memakai ulang `Belajar.daftarPertemuan()` |
| `js_beranda.html` | 🔴 **Wajib** | kartu kelas ringkas: judul + progres |
| `Code.gs` | 🟡 Opsional | nomor versi 1.2.5 |

### B1 — status LKPD tidak berubah di sidebar

Guru menilai, murid menerima notifikasi — tetapi sidebar tetap menulis
"menunggu nilai".

`navMuat()` mengembalikan `Nav.data` dari memori **tanpa pernah
menyegarkan**:

```js
// SEBELUM
if (!paksa && Nav.data && Nav.kelasId === kelasId) {
  return Promise.resolve(Nav.data);          // selamanya basi
}
```

Jalur `sessionStorage` tepat di bawahnya sudah benar — ia memanggil
`_navSegarkanLatar()`. Jalur memori terlewat.

`navSegarkan()` memang ada, tetapi hanya dipanggil setelah **murid**
bertindak (mengumpulkan LKPD, mengirim quiz). Perubahan yang datang dari
**guru** tidak pernah memicunya. Sekarang cache memori tetap dipakai agar
sidebar tampil seketika, lalu disegarkan diam-diam di latar.

### B2 — beranda mengabaikan hierarki *(lebih serius dari laporannya)*

Guru menyunting isi kelas, kartu di beranda tidak ikut berubah.

Sebabnya lebih dalam: `Beranda.untukMurid()` **menyalin unlock logic
sendiri** dan tidak ikut diperbarui saat hierarki tiga tingkat
ditambahkan di v1.0. Beranda tidak pernah melihat `materi_pokok`.

Akibatnya bukan sekadar angka basi — **pertemuan di dalam bab DRAF ikut
tampil di beranda**, membocorkan judul yang belum boleh dilihat murid.
Terbukti di uji: halaman kelas menampilkan 1 pertemuan, beranda 2,
termasuk judul dari bab yang masih draf.

Diperbaiki dengan memakai ulang `Belajar.daftarPertemuan()` — satu
sumber kebenaran. Duplikasi logika unlock di dua tempat adalah akar
masalahnya, bukan cache.

### Beranda kini ringkas *(permintaan guru)*

Kartu kelas hanya menampilkan **judul kelas, mapel, dan progres**.
Rincian pertemuan tidak lagi dikirim maupun digambar — isinya sudah ada
di halaman kelas, dan menampilkannya dua kali membuat beranda panjang
tanpa menambah informasi.

Payload beranda murid: **584 karakter** untuk kelas berisi 5 pertemuan.
Kartu "Lanjutkan belajar" tetap ada.

Fungsi `barisPertemuan()` di `js_beranda.html` ikut dihapus karena tidak
lagi dipanggil.

### Performa

Data skala penuh (**432 murid**, 900 item, 32.400 baris `progress`),
satu murid aktif:

| Operasi | Biaya |
|---|---|
| beranda murid, cache dingin | **47.280 sel** |
| beranda murid, cache hangat | **35.784 sel** |

Memakai ulang `Belajar` berarti ikut menikmati cache progres per murid
dan memo per-eksekusi yang sudah ada di sana.

### Uji

`test/run37-segar-beranda.js` BARU — 28 poin, enam bagian: status LKPD
segar setelah guru menilai, audit statis penyegaran latar `navMuat()`,
beranda sepakat dengan halaman kelas, kebocoran judul bab draf, payload
ringkas, progres yang ikut berubah, dan kelas diarsip.

Dibuktikan bisa merah dua kali: penyegaran latar dilepas (1 poin gagal),
lalu unlock logic lama dikembalikan (4 poin gagal, termasuk kebocoran
judul bab draf).

### Uji lama yang ikut disesuaikan

Empat berkas memuat `Beranda` tanpa `Belajar`, dan tiga memeriksa
rincian pertemuan yang kini sengaja tidak dikirim:

- `run2` · `run3` · `bench` — daftar modul dilengkapi
- `run3` · `run5-regresi` — pemeriksaan unlock dialihkan ke `Belajar`,
  ditambah poin baru **"beranda sepakat dengan halaman kelas"**
- `run3` — kini memanggil `migrasiHierarki()`; seed sengaja membuat
  pertemuan tanpa `mp_id` sebagai bahan uji migrasi
- `run17-nav` — mengunci perilaku cache lama; diperbarui menjadi
  "tampil dari cache **dan** disegarkan di latar", plus poin baru bahwa
  penanda item aktif tidak hilang

Seluruh **38 berkas uji hijau**.

---

---

## v1.2.6 — Router tidak lagi mati pada rute tak dikenal

```
Uncaught ReferenceError: isiDashboard is not defined
    at router (…:227:39)
```

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_core.html` | 🔴 **Wajib** | router menangani rute tak dikenal |
| `Code.gs` | 🟡 Opsional | nomor versi 1.2.6 |

### Sebabnya

`router()` memanggil `isiDashboard()` — fungsi yang **tidak pernah ada
di berkas mana pun**. Sisa kode dari kerangka awal yang tidak pernah
terpakai karena semua rute selama ini terdaftar.

```js
// SEBELUM — cabang ini mematikan seluruh aplikasi
if (!fn) { render('tpl-dashboard'); isiDashboard(); return; }
```

Cabang itu hanya tercapai bila hash menunjuk rute yang tidak terdaftar:
tautan lama, salah ketik, atau — yang paling mungkin di sini — sebuah
berkas JS belum tersalin ke editor sehingga `daftarRute()`-nya tidak
pernah dijalankan.

Akibatnya berat: `ReferenceError` menghentikan `router()` seluruhnya,
dan aplikasi membeku di layar kosong tanpa jalan kembali.

### Perbaikan

Rute tak dikenal kini dialihkan ke beranda (atau login bila belum
masuk). Bila beranda sendiri yang hilang, tampil layar "Halaman tidak
ditemukan" berikut tombol kembali — bukan layar kosong.

Console juga menyebutkan rutenya:

```
[LessonLen] rute tidak dikenal: "rekap-refleksi"
  rute tersedia : api-key, baca, belajar, beranda, …
```

Bila sebuah rute yang **seharusnya ada** muncul di situ, berkas JS-nya
belum tersalin — pesannya langsung menunjuk penyebab.

### Uji

`run35-ui-dom.js` diperluas menjadi **46 poin**, satu bagian baru untuk
router. Pemeriksaannya sengaja **generik**, bukan sekadar mencari nama
`isiDashboard`: seluruh fungsi yang dipanggil di dalam `router()`
diaudit keberadaannya. Kelas bug "memanggil fungsi yang tidak ada" kini
tertutup untuk pemanggil mana pun, bukan hanya yang satu ini.

Dibuktikan bisa merah: baris lama dikembalikan → **5 poin gagal**,
dengan audit generik menyebut sendiri nama fungsi yang hilang.

Seluruh **38 berkas uji hijau**.

---

---

## v1.2.7 — Satu berkas gagal tidak lagi mematikan aplikasi

Log console mengungkap kejadian sebenarnya:

```
[LessonLen] rute tidak dikenal: "beranda"
  rute tersedia : api-key, baca, belajar, ganti-password, kelas, …
Uncaught ReferenceError: kosongkan is not defined
```

Yang hilang dari daftar: **`beranda`** dan **`notifikasi`**. Ditambah
fungsi **`kosongkan`**. Ketiganya berasal dari berkas yang sama —
`js_beranda.html` gagal dimuat di editor Apps Script.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_core.html` | 🔴 **Wajib** | `kosongkan()` & `rangkaMuat()` pindah ke sini; router tahan berkas hilang |
| `js_beranda.html` | 🔴 **Wajib** | definisi ganda dihapus |
| `Code.gs` | 🟡 Opsional | nomor versi 1.2.7 |

### Kegagalan berantai

1. `js_beranda.html` gagal dimuat → rute `beranda` tidak terdaftar
2. `router()` masuk cabang "rute tak dikenal"
3. Cabang itu memanggil `kosongkan()` — yang **juga** dari berkas itu
4. `ReferenceError` → aplikasi mati total, tanpa jalan kembali

Perbaikan v1.2.6 sudah menghapus `isiDashboard()`, tetapi
menggantinya dengan `kosongkan()` — pola yang sama persis. Penangan
galat tidak boleh bergantung pada berkas yang mungkin ikut gagal.

### Tiga perbaikan

**`kosongkan()` dan `rangkaMuat()` pindah ke `js_core.html`.** Sembilan
berkas memakainya; fungsi yang dipakai bersama harus tinggal di berkas
inti yang pasti termuat. Isinya identik, tampilan tidak berubah.

**Cabang darurat menulis HTML langsung** — tanpa memanggil helper apa
pun — dan menyediakan tombol Muat Ulang.

**Pengalihan dijaga agar tidak berulang.** Sebelumnya `RUTE.beranda`
diperiksa apa adanya; kini `typeof … === 'function'`, dan pengalihan
selalu diikuti `return`. Mengalihkan ke rute yang tidak ada akan
memicu loop `hashchange`.

### Pesan kini menunjuk berkasnya

```
[LessonLen] rute tidak dikenal: "beranda"
  rute tersedia : kelas, login, quiz, soal
  ⚠️ Rute ini seharusnya ada. Berkas "js_beranda.html"
     kemungkinan belum tersalin atau gagal dimuat.
```

Peta rute → berkas asal juga tampil di layar, jadi guru tahu berkas
mana yang harus disalin ulang tanpa perlu membuka console.

### Uji

`run35-ui-dom.js` diperluas menjadi **55 poin**, satu bagian baru:
`kosongkan`/`rangkaMuat` ada di `js_core` dan tidak dirangkap di
`js_beranda`, cabang darurat tidak memanggil helper luar, pengalihan
dijaga, dan **peta ASAL wajib mencakup seluruh rute yang benar-benar
terdaftar** — bila ada rute baru yang lupa dimasukkan, pesannya akan
diam saat rute itu yang hilang.

Dibuktikan bisa merah: keadaan v1.2.6 dikembalikan → **6 poin gagal**.

Seluruh **38 berkas uji hijau**.

### Catatan untuk guru

Berkas `js_beranda.html` di repositori ini **sehat** — sintaksnya lolos,
tag `<script>` seimbang, tidak ada karakter tersembunyi. Kegagalannya
terjadi saat penyalinan ke editor Apps Script (isi terpotong, atau
berkasnya belum sempat tersimpan). Menyalin ulang berkas itu menutup
masalahnya; perbaikan di atas memastikan kejadian serupa tidak lagi
melumpuhkan seluruh aplikasi.

---

---

## v1.3.0 — Generator Soal AI

Audit v1.2.7 menemukan sembilan API dengan backend lengkap dan teruji
tetapi **tanpa tombol di layar** — tidak bisa dipakai guru sama sekali.
Yang paling terasa: `generateSoalAI`. Lolos 88 poin uji sejak Tahap 7,
kuota Gemini sudah terpasang, tetapi guru tidak punya cara memakainya.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_soal_ai.html` | 🔴 **BARU** | seluruh UI generator soal |
| `index.html` | 🔴 **Wajib** | menyertakan `js_soal_ai` |
| `js_quiz.html` | 🔴 **Wajib** | tombol "✨ Buat dengan AI" |
| `css.html` | 🔴 **Wajib** | gaya kartu tinjau |
| `Code.gs` | 🟡 Disarankan | `ujiTahap10()` BARU, versi 1.3.0 |

**Tidak ada perubahan skema maupun API baru** — seluruh backend sudah
ada sejak Tahap 7. Tidak perlu migrasi.

### Alur tiga langkah

```
komposisi → tinjau → simpan terpilih
```

Guru menentukan berapa soal per tipe (PG, benar-salah, isian, uraian),
tingkat kesulitan, dan catatan opsional. AI menyusun berdasarkan judul
pertemuan, tujuan pembelajaran, dan **materi yang sudah ada di
pertemuan itu**.

Hasilnya masuk layar tinjau — **bukan langsung ke bank soal**. Ini
aturan yang sama dengan materi AI (§8.4 "AI wajib ditinjau"), hanya di
sini peninjauannya **per butir**: guru membuang soal yang keliru tanpa
membuang seluruh hasil.

Semua soal tercentang di awal. Guru menghapus centang, bukan memilih
satu per satu dari nol — lebih cepat untuk kasus yang lazim.

### Kunci jawaban ditandai jelas

Opsi yang benar diberi latar hijau dan lencana "kunci". AI paling
sering keliru justru di situ, jadi kunci tidak boleh tersembunyi saat
ditinjau.

Soal yang centangnya dilepas **tetap terlihat**, hanya diredupkan —
guru masih bisa membacanya dan berubah pikiran.

### Penjagaan

- Komposisi kosong dan lebih dari 20 soal ditolak **sebelum** menyentuh
  server: guru tidak menunggu 20 detik untuk ditolak
- Membatalkan tinjauan tidak menyimpan apa pun
- Kegagalan AI mengembalikan guru ke bank soal, bukan meninggalkannya
  di layar tunggu
- Penanda waktu berjalan selama AI bekerja (15–45 detik), supaya tidak
  terlihat menggantung
- Validasi server menolak satu soal → hasil generate **tidak dibuang**,
  guru bisa membetulkan pilihannya

### Uji

`test/run38-soal-ai.js` BARU — 46 poin di DOM sungguhan (jsdom),
sembilan bagian: panel komposisi, validasi, layar tinjau, pemilihan per
butir, penyimpanan selektif, pembatalan, hasil kosong, kegagalan AI,
dan pemasangan di halaman bank soal.

Dibuktikan bisa merah: tiga cacat disisipkan (simpan semua soal
mengabaikan centang, kunci tidak ditandai, kegagalan AI meninggalkan
layar tunggu) → **6 poin gagal**, termasuk pelanggaran "AI wajib
ditinjau".

`ujiTahap10()` BARU di editor Apps Script — memanggil Gemini sungguhan,
memeriksa bentuk hasilnya, menyimpan sebagian, lalu menghapus seluruh
data uji. Aman diulang.

### Cacat uji lama yang ikut ditemukan

`run15-ui.js` melaporkan bug palsu pada berkas baru. Regexnya mencari
`dialog({...});` dengan pola malas — berhenti di `});` **pertama**,
lalu menyapu kode sesudahnya. Objek `komposisi` di bawah blok dialog
ikut terbaca sebagai opsi dialog.

Diperbaiki dengan menghitung kurung dan membuang string/komentar
terlebih dahulu. Diverifikasi masih tajam: menyisipkan opsi asing
(`badan`, `lebar` — bug asli Tahap 6B) tetap tertangkap.

Seluruh **39 berkas uji hijau**.

---

---

## v1.4.0 — Kelompok soal berbagi teks bacaan

Untuk pelajaran bahasa (wacana, dialog, puisi) dan soal berbasis kasus:
beberapa soal memakai **satu** teks bacaan.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Setup.gs` | 🔴 **Wajib** | kolom `grup_id` & `stimulus` pada sheet `soal` |
| `Util.gs` | 🔴 **Wajib** | prefix ID `GRP` |
| `Quiz.gs` | 🔴 **Wajib** | satukan/lepas kelompok, acak berkelompok |
| `Code.gs` | 🔴 **Wajib** | API `satukanGrupSoal` & `lepasGrupSoal`, versi 1.4.0 |
| `js_quiz.html` | 🔴 **Wajib** | UI guru + tampilan bacaan ke murid |
| `css.html` | 🔴 **Wajib** | gaya kotak bacaan |

> **Jalankan `migrasiStruktur()`** setelah menyalin — dua kolom baru
> ditambahkan ke sheet `soal`. Data lama utuh; soal tanpa kelompok
> tetap berjalan seperti sebelumnya.

### Bacaan disimpan SEKALI

Pilihan yang tampak paling mudah — menempel bacaan di kolom
`pertanyaan` tiap soal — punya dua biaya:

- wacana 2.000 karakter × 5 soal = **10.000 karakter** untuk isi yang
  sama, terkirim ke tiap murid tiap percobaan
- menyunting bacaan berarti menyuntingnya lima kali

Karena itu bacaan disimpan pada soal bernomor terkecil dalam kelompok;
anggota lain mewarisinya lewat `grup_id`. Helper `_rapikanStimulus()`
menjaga aturan ini setiap kali susunan soal berubah — termasuk
membersihkan bacaan yang tertinggal di soal mandiri.

Terukur pada wacana 1.657 karakter × 5 soal:

| | Payload quiz |
|---|---|
| bacaan ditempel tiap soal | ~9.383 karakter |
| **disimpan sekali** | **2.755 karakter** |
| hemat | **71%** · 233 KB untuk 36 murid serentak |

### Acak menjaga kelompok utuh

Yang diacak adalah **blok**, bukan soal satuan: tiap kelompok dianggap
satu blok, soal mandiri jadi blok berisi satu. Urutan di dalam kelompok
tidak diacak — soal bacaan biasanya disusun mengikuti alur teks.

Tanpa ini murid membaca ulang wacana yang sama di posisi acak, dan
bacaan yang tersimpan pada soal pertama tidak lagi muncul lebih dulu.

`satukanGrup()` juga **merapatkan** anggota yang tersebar: soal 1, 3, 5
yang disatukan akan dinomori ulang berdampingan. Tanpa itu, "acak antar
kelompok" tidak punya arti yang jelas.

### Murid melihat satu soal per layar

Bacaan hanya tersimpan di soal pertama, tetapi klien mencarinya ulang
dari anggota kelompok mana pun dan menampilkannya di **setiap** soal
sekelompok — lengkap dengan penanda "untuk 3 soal · soal ke-2".

Tanpa itu, soal kedua dan seterusnya tampil tanpa wacananya.

### Impor & AI tidak menyatukan bacaan asing

`imporSoal()` dan `simpanSoalTerpilih()` memetakan `grup_id` sumber ke
id baru. Membawa id lama apa adanya berisiko: bila quiz tujuan
kebetulan punya kelompok dengan id sama, dua bacaan berbeda akan
menyatu.

### Bug yang ditangkap uji sendiri

`_soalItem()` membaca daftar kolom **eksplisit**. Menambah kolom ke
skema tidak otomatis membuatnya terbaca — `grup_id` dan `stimulus`
tersimpan benar di sheet tetapi selalu terbaca kosong. Seluruh fitur
tampak "tidak berfungsi" padahal penyimpanannya sudah betul.

Ditangkap `run39` bagian B pada jalankan pertama.

### Uji

`test/run39-grup-soal.js` BARU — 48 poin, sebelas bagian: skema,
penyatuan, perapatan anggota tersebar, penjagaan, pelepasan,
pengacakan (40 benih), sisi murid, impor & AI, rekap guru,
`_rapikanStimulus`, dan pemasangan UI.

Dibuktikan bisa merah: tiga cacat disisipkan → **8 poin gagal**.

Pembuktian itu menemukan **celah pada uji saya sendiri**: bagian F
menguji `_acakJagaGrup()` langsung, sehingga cacat "`_susunUrutan` lupa
memanggilnya" lolos. Bagian G juga memakai kelompok 2 anggota — dengan
dua anggota, urutan acak apa pun berpeluang besar kebetulan
berdampingan. Diperbaiki: 3 anggota, dan menguji jalur nyata
`_susunUrutan()` sebanyak 30 benih.

Satu cacat uji lama ikut ketahuan: `run.js` memakai indeks kolom tetap
`_rows[0][6]` untuk memeriksa opsi soal — pecah begitu kolom baru
menggeser posisinya. Diganti pencarian lewat nama kolom.

Seluruh **40 berkas uji hijau**.

---

---

## v1.4.1 — Audit kelompok soal: 4 bug

Audit v1.4.0 dengan fokus pada **operasi yang mengubah susunan soal**
setelah kelompok terbentuk. Semua lolos 40 berkas uji, karena `run39`
hanya menguji pembentukan kelompok — bukan apa yang terjadi sesudahnya.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Quiz.gs` | 🔴 **Wajib** | 4 perbaikan + `ubahStimulusGrup()` |
| `Code.gs` | 🔴 **Wajib** | API `ubahStimulusGrupSoal`, versi 1.4.1 |
| `js_quiz.html` | 🔴 **Wajib** | "Ubah bacaan" memakai API khusus |

Tidak ada perubahan skema. Tidak perlu migrasi.

### B1 — menghapus pemegang bacaan melenyapkan wacana *(paling parah)*

Bacaan hanya tersimpan pada **satu** anggota kelompok. Menghapus soal
itu membuat anggota lain kehilangan wacananya **permanen**, tanpa pesan
galat apa pun. Guru baru sadar saat murid bertanya.

Perbaikan pertama saya — memanggil `_rapikanStimulus()` setelah hapus —
**tidak cukup**, dan `run39` bagian M langsung menangkapnya: fungsi itu
membaca ulang dari sheet, yang saat itu sudah kehilangan teksnya.

Teks kini diselamatkan **sebelum** baris dihapus, lalu dititipkan ke
anggota tersisa.

### B2 — susun ulang memecah kelompok

`aturUrutanSoal()` menerima urutan mentah dari klien. Menyeret satu
soal ke tengah kelompok memecah anggota yang harus berdampingan —
`1,2,3` menjadi `1,3,4`.

Urutan kini diterjemahkan menjadi urutan **blok**: posisi kelompok
ditentukan anggota pertamanya, seluruh anggotanya ikut. Guru tidak
perlu memikirkan aturan ini.

### B3 — satu soal bisa masuk dua kelompok

`satukanGrup()` tidak memeriksa apakah soal sudah bergrup. Memasukkan
soal ke kelompok baru diam-diam menyusutkan kelompok lama — bisa
menyisakan "kelompok" beranggota satu.

Kini ditolak dengan pesan yang menyuruh melepas kelompok lama dahulu.
Ditambah: `_rapikanStimulus()` membubarkan kelompok yang tersisa satu
anggota, dari sebab apa pun.

### B4 — susunan berubah saat murid mengerjakan

Attempt menyimpan `urutan_soal` saat dimulai. Guru yang melepas
kelompok di tengah jalan membuat murid **kehilangan teks bacaan di
layar** — soal tetap ada, wacananya lenyap.

`hapusSoal()` sudah punya penjagaan ini sejak Tahap 6B; empat fungsi
lain terlewat. Penjaganya diangkat jadi helper bersama
`_tolakBilaAdaYangMengerjakan()` dan dipasang di `satukanGrup`,
`lepasGrup`, `aturUrutanSoal`, dan `ubahStimulusGrup`.

### `ubahStimulusGrup()` — akibat wajar dari B3

UI "Ubah bacaan" memakai ulang `satukanGrupSoal` dengan anggota yang
sama. Setelah B3 diperbaiki, jalur itu ditolak penjaganya sendiri.

Dibuatkan API khusus: mengubah teks tanpa menyusun ulang anggota.

### Uji

`run39-grup-soal.js` diperluas dari 48 menjadi **78 poin**, enam bagian
baru (L–Q): susun ulang, hapus pemegang bacaan, pembubaran kelompok
beranggota satu, penolakan soal ganda, penjagaan attempt berjalan, dan
penyuntingan bacaan.

Dibuktikan bisa merah: keempat bug dikembalikan → **8 poin gagal**.

Seluruh **40 berkas uji hijau**.

### Pelajaran

Uji fitur baru cenderung menguji **pembentukan**, bukan **perubahan
sesudahnya**. Pola yang sama pernah terjadi pada hierarki v1.0.0 —
lolos 30 berkas, lalu tiga bug muncul justru di penghapusan dan
penyalinan.

Aturan baru §6.2 nomor 19 mencatatnya.

---

## v1.4.2 — Kelompok soal jadi terlihat di layar guru

**Laporan lapangan:** *"Di UI saya tidak bisa melihat soal mana yang
sudah dikelompokkan."*

### Sebab

Kelompok soal v1.4.0 memang punya penanda, tetapi penandanya terlalu
lemah untuk menjawab pertanyaan yang sebenarnya dimiliki guru.

| Penanda lama | Kenapa tidak cukup |
|---|---|
| Garis kiri 3px `--hijau-muda` (#D9F2D4) | Nyaris sewarna latar putih kartu — hampir tak terlihat |
| Lencana 📖 tanpa teks | Menunjukkan *bahwa* soal bergrup, bukan grup yang **mana** |
| Kotak bacaan menempel di soal pertama | Batas bawah kelompok tidak pernah digambar |

Akibat gabungannya: **dua kelompok berurutan tampak sebagai satu
deretan panjang yang sama**. Tidak ada cara membaca dari layar bahwa
soal 1–3 satu kelompok sedangkan 5–6 kelompok lain.

Ada pula kebutaan kedua di dialog **Kelompokkan**: daftar pilihan
hanya memuat soal bebas (`d.soal.filter(s => !s.grup_id)`). Soal yang
sudah bergrup **hilang begitu saja** dari daftar, tanpa keterangan.
Guru tidak bisa membedakan "soal itu tidak ada" dari "soal itu sudah
dipakai kelompok lain".

### Perbaikan

**1. Bingkai kelompok (`_daftarSoalGuru()`, BARU)**

Penggambaran bank soal tidak lagi per-kartu. Soal sekelompok kini
dibungkus satu elemen `.blok-grup` bergaris `2px solid var(--hijau)`,
sehingga awal dan **akhir** kelompok sama-sama terbaca.

**2. Kepala kelompok**

Tiap blok dibuka dengan baris keterangan:

```
📖 Kelompok 1   3 soal berbagi satu teks bacaan · tetap berurutan
                saat diacak      [✏️ Ubah bacaan] [Lepas kelompok]
```

Nomor kelompok mengikuti urutan kemunculan — memberi guru sebutan
yang bisa dipakai ("kelompok 2 bacaannya salah"). Tombol Ubah &
Lepas pindah ke sini dari dalam kotak bacaan.

**3. Lencana per soal menyebut kelompoknya**

`📖` → `📖 Kelompok 1`. Berguna saat blok panjang dan kepalanya sudah
tergulung ke atas layar.

**4. Bacaan dicari dari SEMUA anggota**

Blok digambar dari data kelompok, bukan dari soal pertama. Bila
`_rapikanStimulus()` sempat menaruh bacaan di anggota lain — mungkin
setelah impor atau susun ulang — blok tetap menampilkannya, tidak
lagi kosong. Ini persis cacat yang sama dengan yang sudah diperbaiki
di sisi murid pada v1.4.0.

**5. Dialog Kelompokkan jujur soal terpakai**

Soal bergrup tetap terdaftar, diredupkan, tidak bisa dicentang, dan
diberi keterangan `— 📖 sudah dalam kelompok 2`. Aturan bahwa satu
soal hanya boleh masuk satu kelompok (v1.4.1 B3) tidak berubah —
hanya kini kelihatan alasannya.

**6. Kontras garis anggota**

`.kartu-soal.dalam-grup` memakai `--hijau` (bukan `--hijau-muda`) dan
latar `#FCFEFB`.

### Berkas berubah

| Berkas | Perubahan |
|---|---|
| `js_quiz.html` | `_daftarSoalGuru()` BARU, `_kartuSoal()` menerima parameter `grup`, dialog Kelompokkan menampilkan soal terpakai |
| `css.html` | `.blok-grup` `.kepala-grup` `.pilih-baris.baris-terpakai`; `.kartu-soal.dalam-grup` dipertegas |
| `Code.gs` | versi → 1.4.2 |

Tidak ada perubahan backend, skema, maupun API. **Tidak perlu
migrasi.**

### Uji

`test/run40-tampilan-grup.js` (**35 poin**) — menggambar bank soal di
atas DOM sungguhan (jsdom) dan memeriksa keterlihatan secara
struktural: jumlah blok, isi tiap blok, soal bebas di luar blok,
bacaan tidak bocor antar kelompok, lencana menyebut nomor benar,
quiz tanpa kelompok tetap bersih, dan dialog menampilkan soal
terpakai.

Seluruh **41 berkas uji hijau**.

Dibuktikan bisa MERAH dengan menyisipkan ulang tiap bug asli:
5 poin gagal saat blok dihapus, 6 poin gagal saat dialog kembali
menyaring soal bergrup + warna dikembalikan + bacaan dicari hanya
dari anggota pertama.

### Pelajaran

Fitur yang **benar secara data** bisa tetap tidak terpakai bila
keadaannya tidak bisa dibaca dari layar. v1.4.1 mengaudit seluruh
perilaku kelompok soal — hapus, susun ulang, impor, saat dikerjakan —
dan semuanya benar. Yang tidak diaudit: apakah guru bisa **melihat**
kelompok itu ada.

Aturan baru §6.2 nomor 20: **setiap keadaan tersembunyi yang
memengaruhi perilaku sistem wajib punya penanda visual yang menyebut
keadaan itu secara eksplisit** — bukan sekadar perbedaan gaya. Warna
atau ikon tanpa teks hanya memberi tahu *ada sesuatu*, tidak memberi
tahu *apa*.


---

## v1.4.3 — Pengumpulan quiz tidak lagi "diam"

**Laporan lapangan:** *"Saat klik kumpulkan jawaban, jeda dengan
animasi loading agak lama, user bingung apakah tombol sudah proses
atau belum, sehingga mengklik lebih dari satu kali."*

### Sebab

Pengumpulan adalah operasi **paling mahal** di seluruh aplikasi murid:
dua panggilan Apps Script berurutan, masing-masing mengambil kunci
dokumen.

| Tahap | Pekerjaan server |
|---|---|
| `simpanJawaban` | `Db.denganKunci` → validasi attempt → tulis `quiz_attempt` |
| `kumpulkanQuiz` | `Db.denganKunci` → hitung skor → tulis attempt → selaraskan progres → notifikasi guru |

Totalnya 4–10 detik. Tiga cacat membuat rentang itu terasa seperti
aplikasi menggantung:

**1. Jendela mati.** `simpanJawabanSekarang()` dipanggil dengan
`{diam: true}` — sengaja, karena autosave tidak boleh mengedipkan
tirai tiap ketukan. Tetapi pada jalur pengumpulan hal itu berarti
tirai muat **baru muncul saat panggilan KEDUA**. Sesudah dialog
tertutup, layar benar-benar tidak berubah selama beberapa detik.
Justru di jendela inilah murid mengklik lagi.

**2. Pemutar tanpa teks.** Setelah tirai akhirnya muncul pun, isinya
hanya lingkaran berputar. Tidak ada keterangan bahwa jawabannya
sedang dikumpulkan.

**3. Tidak ada penjaga klik ganda.** Tombolnya tidak pernah dikunci.
Setiap klik yang lolos memicu `kumpulkanQuiz` baru. Server memang
menolak yang kedua (`status !== 'berjalan'` → *"Pengerjaan sudah
dikumpulkan"*), tetapi penolakan itu muncul sebagai **toast merah** —
murid yang jawabannya justru berhasil masuk malah melihat pesan
kesalahan.

### Perbaikan

**Penjaga `QZ.sedangKumpul`** — klik kedua dan seterusnya diabaikan
diam-diam, tidak peduli keadaan tirai.

**Tirai dinyalakan lebih awal, dengan teks bertahap:**

```
Menyimpan jawaban terakhir…      → tahap 1
Mengumpulkan & menghitung nilai… → tahap 2
```

`tampilkanMuat()` kini menerima parameter kedua, dan `callApi()`
meneruskan `opsi.pesanMuat`. Tirai **tidak berkedip** di antara dua
panggilan karena keduanya memakai `{diam: true}` sementara tirainya
dikendalikan manual.

**Kendali dikunci** — seluruh tombol dan kotak jawaban di layar kerja
dinonaktifkan selama proses berjalan.

**Dialog konfirmasi memperingatkan** bahwa prosesnya butuh beberapa
detik dan halaman jangan ditutup.

**Galat "sudah dikumpulkan" ditangani khusus** — bila klik ganda
sempat menembus (atau kumpul otomatis mendahului), murid diarahkan ke
halaman hasil dengan toast hijau *"Jawaban Anda sudah terkumpul"*,
bukan toast merah yang menakutkan.

**Jalur pengumpulan disatukan** (`_kumpulkan()`). Sebelumnya tombol
murid dan waktu habis menyalin logika masing-masing —
`kumpulkanOtomatis()` bahkan **tidak menyimpan jawaban terakhir lebih
dulu**, sehingga ketikan esai dalam 900 ms terakhir (jeda
`tundaSimpan`) bisa hilang saat waktu habis. Bug kedua yang ikut
tertangkap audit ini.

**Kegagalan jaringan tidak mengunci murid** — penjaga dilepas, layar
kerja digambar ulang, tombolnya hidup lagi.

`bereskan()` di `callApi` juga dibuat kebal dipanggil dua kali.

### Berkas berubah

| Berkas | Perubahan |
|---|---|
| `js_quiz.html` | `_kumpulkan()` BARU (jalur tunggal), penjaga `sedangKumpul`, `_kunciLayarKerja()`, penanganan "sudah dikumpulkan" |
| `js_core.html` | `tampilkanMuat(tampil, pesan)`, `callApi` meneruskan `opsi.pesanMuat`, `bereskan()` sekali jalan |
| `index.html` | wadah `#pesan-muat` di dalam tirai |
| `css.html` | `.kotak-muat` `.pesan-muat` (+ `:empty`) |
| `Code.gs` | versi → 1.4.3 |

Tidak ada perubahan backend, skema, maupun API. **Tidak perlu
migrasi.**

### Uji

`test/run41-kumpul-quiz.js` (**35 poin**) — menjalankan alur
pengumpulan di DOM sungguhan (jsdom) dengan `callApi` yang **sengaja
lambat**, lalu mengklik tombolnya lima kali beruntun. Delapan bagian:
penjaga klik ganda, ketiadaan jendela mati, penguncian kendali,
peringatan dialog, kegagalan jaringan, keadaan "sudah terkumpul",
waktu habis, dan pemasangan di berkas.

Dibuktikan bisa MERAH dengan menyisipkan ulang tiap bug asli:
**3 poin gagal** tanpa penjaga (5 klik → 5 pengumpulan, persis gejala
yang dilaporkan), **4 poin gagal** saat jendela mati dikembalikan,
**8 poin gagal** saat penguncian, jalur tunggal, dan penanganan galat
dicabut.

Seluruh **42 berkas uji hijau**.

### Pelajaran

Umpan balik "sedang bekerja" harus menyala **pada klik**, bukan pada
panggilan jaringan pertama yang kebetulan tidak diam. Operasi
bertahap sangat rawan: tiap tahap yang memakai `{diam: true}`
menciptakan jendela tanpa umpan balik, dan murid mengisi jendela itu
dengan klik.

Aturan baru §6.2 nomor 21: **operasi yang memicu lebih dari satu
panggilan server wajib punya penjaga anti-ulang di sisi klien dan
tirai yang menyala sejak klik pertama sampai tahap terakhir selesai.**
Menolak duplikat di server saja tidak cukup — penolakan itu sampai ke
pengguna sebagai pesan kesalahan atas perbuatan yang sebenarnya
berhasil.


---

## v1.5.0 — Rekap Nilai & ekspor (Tahap 8)

Satu-satunya pekerjaan yang masih dikerjakan manual tiap akhir
semester. Backend belum ada sama sekali sebelum ini — `getRekapKelas`
hanya tercatat di dokumen kesepakatan §14, tidak pernah ditulis.

### Keputusan (disepakati lewat pertanyaan)

| Topik | Pilihan | Alasan |
|---|---|---|
| Cakupan | satu kelas, **dipilih per Materi Pokok** | satu kelas penuh lintas bab bisa 20–40 kolom; per bab membuatnya terbaca |
| Refleksi | **ikut**, memakai angka skala 1–5 | guru ingin melihatnya sebaris dengan nilai lain |
| Quiz | nilai **tertinggi** | konsisten dengan layar Penilaian Quiz yang sudah ada |
| Ekspor | **Google Sheet baru** | Apps Script web app tidak bisa memaksa unduhan; Sheet langsung bisa diolah |

### Yang paling menentukan: rata-rata TIDAK mencampur skala

Skala refleksi 1–5 bukan nilai 0–100. Menjumlahkannya begitu saja
membaca "4" sebagai 4 dari 100 dan menjatuhkan rata-rata secara
keliru:

```
Andi — LKPD 80, Quiz 100, Refleksi 4
  benar : (80 + 100) / 2     = 90
  salah : (80 + 100 + 4) / 3 = 61,3
```

`_rataNilai()` hanya menghitung kolom LKPD & Quiz. Kolom refleksi
tetap tampil apa adanya sebagai skala.

### Sel kosong ≠ nol

Murid yang **belum mengerjakan** tidak sama dengan murid yang
mengerjakan lalu **mendapat nol** — keduanya perlu dibedakan guru,
dan mencampurnya menghancurkan rata-rata. Sel kosong tidak dihitung
sebagai nol; di layar ia tampil `—`, sedangkan nol tampil `0`.

Tiap sel juga membawa `catatan` yang membedakan enam keadaan:
`belum` · `menunggu` (penilaian guru) · `menunggu_koreksi` ·
`berjalan` · `ditolak` · `diterima`/`lulus`. Kolom kosong karena
guru belum menilai bukan salah muridnya.

### Bug tertangkap saat membangun

**KKM 0 dianggap tuntas.** KKM hanya diatur pada quiz —
`Pertemuan.simpanItem()` mengisinya hanya bila `tipe === 'quiz'`.
Untuk LKPD `kkm = 0`, sehingga `a >= it.kkm` benar untuk SEMUA nilai
termasuk nol, dan guru membaca "36/36 mencapai KKM" yang palsu.
Diperbaiki dengan penjaga `punyaKkm`; kolom tanpa KKM menampilkan
`—`, bukan angka.

**Item mengikuti bab PERTEMUANnya, bukan `item.mp_id`.** Pelajaran
v1.1.1 terulang: `mp_id` pada item bisa basi setelah pertemuan
dipindah antar bab. Penapis memakai `mp_id` pertemuan.

### Berkas baru

| Berkas | Isi |
|---|---|
| `Rekap.gs` | **BARU** — `kelas()` `pilihanBab()` `ekspor()` `hapusEksporLama()` |
| `js_rekap.html` | **BARU** — tabel, penapis bab, tombol ekspor |

### Berkas berubah

| Berkas | Perubahan |
|---|---|
| `Code.gs` | 4 API baru + `ujiTahap11()`, versi → 1.5.0 |
| `index.html` | include `js_rekap` |
| `js_core.html` | peta `ASAL` + rute `rekap` |
| `js_beranda.html` | tombol 📊 Rekap Nilai |
| `css.html` | tabel beku dua arah, warna sel, legenda |

Tidak ada perubahan skema. **Tidak perlu migrasi.**

### Membaca tabel yang padat

36 baris × sampai 25 kolom tidak muat di layar mana pun. Kolom
**Nama** dibekukan di kiri dan **kepala tabel** dibekukan di atas,
sehingga guru tidak kehilangan jejak baris siapa dan kolom apa yang
sedang dibacanya. Sudut kiri-atas diberi `z-index` tertinggi supaya
tidak tertimpa saat digulir dua arah.

Warna sel **selalu** disertai teks pada `title` (§6.2 no. 20) —
rona sendirian tidak bisa membedakan "menunggu penilaian saya" dari
"murid belum mengerjakan".

### Konsekuensi ekspor: berkas menumpuk di Drive

Tiap ekspor membuat satu Spreadsheet baru. Setelah satu semester
Drive guru bisa penuh berkas serupa. `hapusEksporLama()` membuang
yang lebih tua dari 30 hari — **hanya** berkas berawalan
`LessonLen Rekap — `. Penjaganya memakai `indexOf(...) === 0`, bukan
`contains`, supaya berkas guru bernama *"Arsip LessonLen Rekap 2024
(jangan hapus)"* tidak ikut terbuang.

### Uji

| Berkas | Poin | Isi |
|---|---|---|
| `test/run42-rekap.js` | 99 | backend, 17 bagian; memakai **`mock4.js` BARU** |
| `test/run43-ui-rekap.js` | 84 | UI di DOM sungguhan (jsdom), 14 bagian |

**`mock4.js`** dibutuhkan karena `mock2.js` punya satu `ssObj`
tunggal: `SpreadsheetApp.create()` mengembalikan spreadsheet yang
SAMA dengan basis data. Menguji ekspor di atasnya berbahaya — hasil
ekspor akan menimpa sheet DB dan ujinya tampak "berhasil" karena
membaca datanya sendiri. mock4 juga **menegakkan** aturan
`setValues()` bahwa panjang tiap baris harus seragam.

Dibuktikan bisa MERAH dengan menyisipkan sembilan bug asli:
6 poin gagal saat skala ikut rata-rata (tepat 61,3 seperti
diprediksi), 15 poin saat quiz memakai percobaan terakhir + item draf
ikut + mp_id basi + KKM 0, dan mock4 menangkap bug lebar baris
`setValues` yang akan menggagalkan ekspor di Apps Script sungguhan.

Dua **celah uji** ditemukan dan ditutup saat pembuktian merah:
- pembersihan Drive tetap hijau walau penjaga awalan dicabut →
  ditambah berkas jebakan bernama frasa di tengah
- `tombol.disabled` sudah menahan `.click()` di jsdom, jadi penjaga
  `_sedangEkspor` tak pernah teruji → fungsinya dipanggil langsung

### Verifikasi di Apps Script

```
ujiTahap11()      20 poin, ~30 detik
```

Membuat kelas `ZZ Uji Rekap`, mengisi nilai tiga murid, mengekspor,
lalu membersihkan dirinya sendiri — termasuk **membuang berkas Sheet
hasil uji** ke tong sampah. Aman diulang.

Seluruh **44 berkas uji hijau**.

### Pelajaran

Angka yang salah diam-diam lebih berbahaya daripada galat. Rekap
tidak pernah melempar error — ia hanya menampilkan 61,3 alih-alih 90,
atau "36/36 tuntas" yang tidak pernah terjadi. Guru memakainya untuk
rapor.

Aturan baru §6.2 nomor 22: **agregasi wajib menyatakan satuan apa
yang dijumlahkan, dan menolak nilai bersatuan lain.** Kolom berskala
berbeda (1–5 vs 0–100), nilai kosong, dan nol adalah tiga hal
berlainan; memperlakukannya sama menghasilkan angka yang terlihat
wajar tetapi keliru.


---

## v1.5.1 — Ralat: refleksi bukan penilaian

**Ralat guru:** *"Nilai refleksi hanya untuk rekapan refleksi saja,
bukan untuk penilaian."*

v1.5.0 memasukkan skala refleksi 1–5 sebagai kolom di rekap nilai —
memang itu yang dipilih saat saya bertanya, tetapi keputusannya
diralat setelah melihat hasilnya.

### Kenapa ralatnya benar

Skala 1–5 adalah **penilaian diri murid** atas pemahamannya sendiri,
bukan nilai yang diberikan guru. Menaruhnya sebaris dengan LKPD & Quiz
membuatnya terbaca sebagai komponen penilaian — padahal murid yang
jujur menulis "2" justru sedang **membantu gurunya**, bukan sedang
berprestasi buruk.

v1.5.0 sudah mengeluarkannya dari perhitungan rata-rata, tapi itu
setengah jalan: kolomnya tetap ada, tetap berdampingan dengan nilai,
dan tetap ikut terekspor ke berkas yang dipakai menyusun rapor.

### Perubahan

Refleksi **hilang sepenuhnya** dari rekap nilai:

| Tempat | Sebelum | Sesudah |
|---|---|---|
| `_itemBernilai()` | `{lkpd, quiz, refleksi}` | `{lkpd, quiz}` |
| kolom tabel | 💭 Refleksi (skala 1–5) | tidak ada |
| `rekap.jml_refleksi` | ada | dihapus dari payload |
| berkas ekspor | satu kolom skala | tidak ada |
| `pilihanBab()` | bab refleksi tercacah | tercacah **0** item |

Rekap refleksi **tetap utuh** di tempatnya sendiri: `Refleksi.rekap()`
dan layar `#/rekap-refleksi/:itemId` (v1.2.0) — sebaran skala sekelas
beserta jawaban terbukanya.

Halaman rekap nilai kini menyebutkannya terang-terangan:

> 💭 Item refleksi **tidak termasuk penilaian** — skalanya penilaian
> diri murid. Lihat sebarannya lewat tombol Penilaian pada item
> refleksi.

Tanpa kalimat itu, guru yang mencari kolom refleksi akan mengira
rekapnya rusak.

### Penyederhanaan ikutan

Karena tinggal satu satuan (0–100), tiga cabang khusus refleksi hilang
dari `Rekap.gs`: penanganan sel, penjagaan `punyaKkm`, dan label kolom.

`_rataNilai()` **tetap** memeriksa tipe lewat `SKALA_100`, sekalipun
sekarang semua kolom pasti berskala sama. Itu jaring pengaman §6.2
no. 22: bila suatu saat tipe bernilai baru ditambahkan dengan skala
berbeda, ia harus didaftarkan secara sadar, bukan diam-diam ikut
terjumlah.

### Berkas berubah

| Berkas | Perubahan |
|---|---|
| `Rekap.gs` | refleksi keluar dari `TIPE_NILAI`, sel, label, `jml_refleksi` |
| `js_rekap.html` | kolom & lencana 💭 hilang, keterangan baru, `CATATAN_SEL` diringkas |
| `Code.gs` | `ujiTahap11()` membalik arah pemeriksaan, versi → 1.5.1 |

Tidak ada perubahan skema. **Tidak perlu migrasi.**

### Uji — arahnya dibalik

Yang dulu memastikan skala **masuk**, sekarang memastikan skala
**tidak bocor**. Item refleksi **tetap dibuat dan diisi** di data uji —
justru supaya kebocorannya terdeteksi. Menghapusnya akan membuat
pemeriksaan hijau palsu.

Poin baru di `run42`:
- skala 1–5 tidak muncul di sel mana pun
- tidak ada kolom bertipe refleksi
- bab berisi refleksi saja → **nol** kolom bernilai
- skala tidak ikut tertulis ke berkas ekspor
- payload tidak lagi mengirim `jml_refleksi`
- **skala tetap hidup di `Refleksi.rekap()`** — memastikan fiturnya
  tidak ikut mati

Dibuktikan bisa MERAH dengan mengembalikan perilaku v1.5.0:
**14 poin gagal** di run42 (kolom, sel, penapis bab, ekspor) dan
**2 poin** di run43 saat keterangan dicabut.

Satu **cacat uji** ikut ketahuan: `run43` memakai indeks tetap
`children[5]` untuk kolom rata-rata, yang patah begitu jumlah kolom
berubah. Diganti menjadi "kolom terakhir".

`ujiTahap11()` naik dari 20 → **23 poin**.

Seluruh **44 berkas uji hijau**.

### Pelajaran

Menanyakan keputusan tidak menjamin keputusan itu benar. Saya bertanya
"refleksi ikut rekap?" dan menerima jawabannya apa adanya, padahal
pertanyaan yang lebih berguna adalah **"skala 1–5 ini nilai dari guru
atau penilaian diri murid?"** — jawabannya menentukan jawaban
pertanyaan pertama dengan sendirinya.

Pertanyaan tentang **bentuk** ("mau ditampilkan di mana?") sebaiknya
didahului pertanyaan tentang **hakikat** ("ini sebenarnya apa?").


---

## v1.5.2 — Ekspor gagal di Apps Script: sel gabungan vs kolom beku

**Ditemukan user** menjalankan `ujiTahap11()` di Apps Script sungguhan:

```
E. Ekspor ke Google Sheet
  ❌ GALAT: Maaf, Anda tidak dapat membekukan kolom yang berisi hanya
     sebagian dari sel gabungan. Coba pecahkan sel gabungan atau
     bekukan lebih banyak kolom untuk mencakup seluruh sel gabungan.
         at Object.ekspor (Rekap:493:8)
  LOLOS: 14   GAGAL: 1   (159 detik)
```

Empat belas pemeriksaan pertama lolos — tabel rekapnya benar. Yang
gagal **hanya penulisan berkasnya**, dan gagalnya total: tidak ada
Sheet yang jadi.

### Sebab

Dua baris perias saling bertabrakan:

```js
sh.getRange(1, 1, 1, lebar).merge()   // judul selebar tabel
sh.setFrozenColumns(2);               // bekukan # + Nama
```

Judul digabung melintasi **seluruh** kolom, lalu garis beku ditarik
setelah kolom ke-2 — tepat **di tengah** sel gabungan itu. Sheets
menolaknya, dan penolakannya berupa galat yang menggagalkan seluruh
`ekspor()`.

### Perbaikan

`merge()` dibuang. Pembekuan kolom Nama jauh lebih berguna daripada
judul yang rapi di tengah — dan tanpa merge, teks A1 tetap terbaca
karena meluber ke sel kanannya yang kosong.

### Kenapa 44 berkas uji tetap hijau

Karena `mock4.js` **mengabaikan** `merge()` dan `setFrozenColumns()`
sepenuhnya — keduanya fungsi kosong yang selalu berhasil. Persis pola
yang sama dengan bug v1.2.1: mock2 mengabaikan `setDataValidation()`,
sehingga enum yang ditolak Sheets tetap hijau di uji.

mock4 kini **menegakkan** aturannya: `merge()` mencatat rentang
gabungan, dan `setFrozenColumns()` melempar galat dengan pesan yang
sama persis bila garis beku memotong salah satunya.

### Cacat uji ikutan

Bagian L `run42` memanggil `Rekap.ekspor()` tanpa `try`, jadi begitu
mock diperbaiki, galatnya **menghentikan seluruh berkas uji** —
bagian M sampai Q tidak pernah jalan. Sekarang dibungkus: satu poin
merah, sisanya tetap berjalan, dan bagian yang bergantung padanya
dilewati dengan pesan jelas.

### Berkas berubah

| Berkas | Perubahan |
|---|---|
| `Rekap.gs` | `merge()` dibuang dari baris judul |
| `test/mock4.js` | `merge()` + `setFrozenColumns()` menegakkan aturan Sheets |
| `test/run42-rekap.js` | bagian L tahan galat; 2 poin baru di bagian M |
| `Code.gs` | versi → 1.5.2 |

Tidak ada perubahan skema. **Tidak perlu migrasi.**

### Uji

Dibuktikan bisa MERAH dengan menyisipkan `merge()` kembali — mock
mereproduksi pesan galat Apps Script **kata per kata**, dan poin
"judul TIDAK di-merge" ikut merah.

`ujiTahap11()` tetap 23 poin, kini **23/23 di Apps Script sungguhan**.
Seluruh **44 berkas uji hijau**.

### Pelajaran

Ini ketiga kalinya mock yang terlalu permisif menyembunyikan bug
lapangan: `setDataValidation()` (v1.2.1), lebar baris `setValues()`
(v1.5.0, tertangkap karena sudah ditegakkan), kini `merge()` +
`setFrozenColumns()`.

Aturan baru §6.2 nomor 23: **setiap API Apps Script yang punya aturan
penolakan wajib ditegakkan di mock, bukan di-stub kosong.** Fungsi
perias yang "hanya kosmetik" tetap bisa menggagalkan seluruh operasi
— dan justru itu yang tidak pernah diuji karena hasilnya tidak
diperiksa siapa pun.

Turunan: uji yang memanggil operasi berisiko wajib membungkusnya
`try`, supaya satu galat menghasilkan satu poin merah, bukan
mematikan sisa berkas uji.


---

## v1.5.3 — `ujiTahap11()` tidak aman diulang

**Ditemukan user** pada jalankan KEDUA, tepat setelah perbaikan
v1.5.2 disalin:

```
A. Struktur rekap
  ✅ item draf & refleksi tidak jadi kolom  2 kolom
  ✅ urutan kolom mengikuti pelajaran
  ❌ GALAT: Nama pengguna "zzrekapa" sudah dipakai.
         at _err (Kelas:675:13)
  LOLOS: 2   GAGAL: 1   (42 detik)
```

Jalankan pertama 23/23, jalankan kedua mati di murid pertama.

### Sebab

`Kelas.hapus()` **sengaja** tidak menghapus baris `users` — murid bisa
terdaftar di beberapa kelas sekaligus, jadi menghapus satu kelas tidak
boleh menghapus orangnya. Itu perilaku yang benar.

Tetapi `ujiTahap11()` mengandalkannya untuk bersih-bersih. Kelasnya
hilang, muridnya tertinggal, dan `simpanMurid()` menolak nama yang
sama pada jalankan berikutnya.

`ujiTahap9()` sudah menangani ini sejak v1.0 (menghapus
`zzujihierarki` terpisah); `ujiTahap11()` yang baru ditulis
melewatkannya.

### Kenapa ini penting

Diagnostik yang hanya bisa dijalankan **sekali** praktis tidak
berguna. Guru menjalankannya justru berulang kali: sebelum perbaikan,
sesudah perbaikan, setelah menyalin berkas baru. Persis yang terjadi
di sini — v1.5.2 disalin, uji diulang, dan gagal karena sisa jalankan
sebelumnya.

### Perbaikan

Bersih-bersih dipusatkan pada satu fungsi `bersihkanSisaUji()` yang
menghapus **kelas DAN username murid**, dipanggil di **awal maupun
akhir**. Daftar `MURID_UJI` ditulis sekali, tidak disalin dua kali.

Memakai fungsi yang sama di kedua tempat penting: bersih-bersih awal
dan akhir yang ditulis terpisah cenderung menyimpang — persis yang
membuat versi pertama hanya menghapus kelas di satu sisi.

### Berkas berubah

| Berkas | Perubahan |
|---|---|
| `Code.gs` | `bersihkanSisaUji()` di `ujiTahap11()`, versi → 1.5.3 |

Tidak ada perubahan skema, tidak ada perubahan aplikasi — hanya
diagnostik. **Tidak perlu migrasi.**

### Uji

`test/run44-diagnostik-ulang.js` **BARU (26 poin)** — menjalankan tiap
diagnostik **tiga kali berturut-turut** di atas basis data yang sama,
lalu membandingkan cacah baris sepuluh sheet sebelum dan sesudah.
Enam bagian: pengulangan `ujiTahap11`, sisa murid, berkas ekspor
dibuang, pola yang sama pada `ujiTahap9`, urutan berselang-seling
(11→9→11), dan pemasangan di berkas.

Dibuktikan bisa MERAH dengan mencabut penghapusan username:
**12 poin gagal**, dan ujinya mereproduksi log lapangan kata per kata
— `LOLOS 2 GAGAL 1` beserta galat *"Nama pengguna zzrekapa sudah
dipakai"*.

Seluruh **45 berkas uji hijau**.

### ✅ Terverifikasi di Apps Script sungguhan

```
E. Ekspor ke Google Sheet
  ✅ berkas dibuat  1ux9_on8nlck0aOdw_iPWdxtkbWnffxnJfumU2G_4fRw
  ✅ skala refleksi tidak ikut ke berkas  [1,"zzrekapa","zzrekapa",80,100,90]
  ✅ rata-rata tertulis 90  90

Membersihkan data uji…
  Kelas & murid uji dihapus.
  Berkas ekspor uji dibuang ke tong sampah.

  LOLOS: 23   GAGAL: 0   (162 detik)
✅ Rekap nilai & ekspor berfungsi di Apps Script.
```

Baris murid `[1,"zzrekapa","zzrekapa",80,100,90]` membuktikan tiga
keputusan sekaligus: skala refleksi 4 **tidak ada** di berkas, nilai
quiz yang dipakai **100** (tertinggi, bukan 0 dari percobaan kedua),
dan rata-rata **90** (bukan 61,3).

Waktu 162 detik wajar untuk ±50 operasi tulis Apps Script.

### Pelajaran

Dua sesi berturut-turut bug lolos ke lapangan bukan dari fitur, tapi
dari **perkakas di sekitarnya**: v1.5.2 perias spreadsheet, v1.5.3
bersih-bersih diagnostik. Keduanya bagian yang hasilnya tidak
diperiksa siapa pun.

Aturan baru §6.2 nomor 24: **fungsi diagnostik wajib diuji dijalankan
BERULANG, bukan sekali.** Jaminan "membersihkan dirinya sendiri" harus
dibuktikan dengan membandingkan keadaan basis data sebelum dan
sesudah — bukan diasumsikan dari adanya blok `finally`.

Turunan: bila penghapusan berantai suatu entitas **sengaja** tidak
menyentuh tabel tertentu (seperti `Kelas.hapus()` yang tidak menghapus
`users`), setiap pemanggilnya yang butuh kebersihan penuh harus
melengkapinya sendiri — dan itu wajib dicatat di tempat pemanggilan.


---

## v1.5.4 — `ujiTahap12()`: celah verifikasi kelompok soal

Bukan perbaikan bug, melainkan menutup **lubang verifikasi** yang baru
ketahuan saat menyiapkan uji lapangan.

### Yang ketahuan

Peta jalan menulis *"v1.4.0–1.4.1 kelompok soal — jalankan
`ujiTahap9()`"*. Itu **keliru**: `ujiTahap9()` menguji hierarki tiga
tingkat & refleksi, dan tidak menyentuh kelompok soal sama sekali —
nol kemunculan `grup_id`, `stimulus`, maupun `satukanGrup` di seluruh
badan fungsinya.

Artinya v1.4.0–1.4.3 **tidak punya jalur verifikasi lapangan sama
sekali**, padahal v1.4.0 mengubah **skema** (dua kolom baru pada sheet
`soal`) dan butuh `migrasiStruktur()`.

Ini persis kelas bug yang paling sering lolos di proyek ini: yang gagal
bukan logikanya, melainkan **apakah kolomnya benar-benar ada di Sheets
sungguhan** dan **apakah nilainya terbaca kembali**.

### `ujiTahap12()` — 30 poin, 9 bagian

| Bagian | Yang dibuktikan |
|---|---|
| A | kolom `grup_id` & `stimulus` ADA — berhenti dengan pesan jelas bila belum dimigrasi |
| B | disatukan → **terbaca kembali** (bug v1.4.0), bacaan disimpan sekali |
| C | susun ulang tidak memecah kelompok (v1.4.1 B2) |
| D | soal tidak bisa masuk dua kelompok (B3), kelompok beranggota 1 ditolak |
| E | `ubahStimulusGrup()` — API khusus v1.4.1 |
| F | hapus pemegang bacaan → teks **diselamatkan** (B1) |
| G | murid mengerjakan: acak menjaga kelompok, bacaan sampai, kunci tidak bocor |
| H | perubahan ditolak saat murid mengerjakan (B4) |
| I | lepas kelompok — soalnya sendiri tidak ikut terhapus |

Bagian A berhenti lebih awal bila skema belum dimigrasi, dengan pesan
`"Jalankan migrasiStruktur() lalu ulangi"` — tanpa itu, 26 poin
sesudahnya akan gagal beruntun dan menyembunyikan sebab aslinya.

### Aman diulang sejak awal

Mengikuti §6.2 no. 24 yang baru: satu `bersihkanSisaUji()` menghapus
kelas **dan** username murid, dipanggil di awal maupun akhir. Terbukti
tiga kali berturut-turut 30/30 dengan **nol sisa baris**.

### Berkas berubah

| Berkas | Perubahan |
|---|---|
| `Code.gs` | `ujiTahap12()` BARU, versi → 1.5.4 |
| `test/run44-diagnostik-ulang.js` | bagian D2 + urutan `11→9→12→11` |
| `src/CEKLIS-UJI-LAYAR-v1.4.md` | **BARU** — uji layar v1.4.2 & v1.4.3 |

Tidak ada perubahan aplikasi maupun skema. **Tidak perlu migrasi.**

### Uji

Dibuktikan bisa MERAH dengan menyisipkan ulang bug asli ke `Quiz.gs`:

| Bug disisipkan | Poin merah |
|---|---|
| daftar kolom `_soalItem()` tanpa `grup_id`/`stimulus` (v1.4.0) | **7** — termasuk *"0 anggota terbaca"* |
| bacaan tidak diselamatkan sebelum hapus (v1.4.1 B1) | **4** |
| penjaga "sedang dikerjakan" dicabut (B4) | ikut dalam 4 di atas |

`run44` naik dari 26 → **40 poin**.
Seluruh **45 berkas uji hijau**.

### Pelajaran

Peta jalan mencatat *"belum diverifikasi"* untuk empat versi, tetapi
tidak memeriksa apakah **alat verifikasinya ada**. Daftar pekerjaan
yang menyebut cara mengerjakannya harus ikut diverifikasi — kalimat
"jalankan `ujiTahap9()`" terbaca meyakinkan selama tidak ada yang
membuka isinya.

Aturan baru §6.2 nomor 25: **setiap versi yang mengubah skema wajib
punya diagnostik lapangannya sendiri.** Migrasi bisa gagal separuh,
kolom bisa tidak terbentuk, dan nilai bisa tersimpan tetapi tidak
terbaca — tiga hal yang **tidak mungkin** ditangkap uji lokal berapa
pun jumlahnya.


---

## v1.5.5 — Generator AI membuat soal bercerita

**Permintaan guru:** *"Untuk generator soal AI tambahkan buat soal
cerita untuk beberapa soal, misal buat soal cerita untuk 4 soal."*

Menyambungkan dua fitur yang selama ini terpisah: generator AI
(v1.3.0) dan kelompok soal berbagi bacaan (v1.4.0).

### Keputusan (disepakati lewat pertanyaan)

| Topik | Pilihan | Konsekuensi |
|---|---|---|
| Cakupan | **bagian dari** komposisi | 8 PG dengan 4 bercerita = tetap 8 soal |
| Jumlah wacana | **satu** per sekali generate | ulangi generate untuk wacana kedua |
| Jenis | **dipilih guru** | kasus · narasi · data · dialog · kutipan |
| Layar tinjau | wacana **sekali di atas** kelompoknya | sama seperti bank soal & tampilan murid |

### Yang sudah ada, yang perlu dibuat

`Quiz.simpanSoalTerpilih()` **sudah** menangani `grup_id` dan
`stimulus` sejak v1.4.0 — termasuk memetakan nama grup dari klien ke
`GRP-xxxx` yang sesungguhnya. Jadi yang dibangun hanya sisi AI-nya.

### Wacana diminta sebagai medan TERPISAH

`SKEMA_SOAL` mendapat `stimulus` di tingkat atas, bukan properti tiap
soal. Kalau dijadikan properti soal, model cenderung **menyalin ulang**
teks panjang ke setiap butir — memboroskan token keluaran sekaligus
melanggar aturan "bacaan disimpan sekali" (§9.10).

Tiap soal hanya membawa `pakai_stimulus: boolean`.

### Prompt harus sangat eksplisit

Tiga hal yang mudah dilanggar model, masing-masing diberi larangan
tersendiri:

1. **jumlah bertambah** — dikira wacana itu soal tambahan
2. **wacana disalin** ke dalam medan `pertanyaan`
3. **wacana jadi hiasan** — soal bisa dijawab tanpa membacanya

Yang ketiga paling halus. Prompt menuntut tiap soal bercerita
*"MUSTAHIL dijawab benar tanpa membaca wacananya"* dan wacananya memuat
*"rincian konkret (angka, nama alat, kondisi) yang DIPERLUKAN untuk
menjawab"*.

### AI melanggar? Dirapikan, lalu DILAPORKAN

Model tidak selalu menurut. `_pasangGrupCerita()` menangani lima
penyimpangan — semuanya **dilaporkan ke guru**, tidak ada yang
diperbaiki diam-diam:

| Penyimpangan | Tindakan | Pesan ke guru |
|---|---|---|
| menandai terlalu banyak | semua dikelompokkan | *"AI menandai 6 soal, diminta 3"* |
| terlalu sedikit | tetap dibentuk | *"hanya membuat 2 dari 4"* |
| tidak menandai sama sekali | N soal pertama ditebak | *"periksa apakah benar-benar merujuk wacananya"* |
| lupa wacananya | kelompok dibatalkan | *"AI tidak menyertakan teks wacana"* |
| hanya 1 soal ditandai | dibatalkan | *"kelompok butuh minimal 2"* |

Anggota yang tersebar juga **dirapatkan** agar berdampingan — aturan
v1.4.0 yang tetap berlaku.

### Dua bug tertangkap uji sendiri

**5 soal berubah jadi 8.** Pada jalur tebakan (AI tidak menandai apa
pun), `idx` diisi sendiri sementara penanda `_cerita` seluruhnya
`false`. Menghitung "sisanya" dari `_cerita` membuat anggota **tersalin
dua kali**. `idx` kini satu-satunya sumber kebenaran.

**Wacana 8.006 karakter ditolak Quiz.** Pemangkasan terjadi sebelum
pembungkusan `<p>`, sehingga hasil akhirnya melewati batas 8.000 —
penyimpanan gagal justru setelah guru menunggu AI 30 detik. Kini
dipangkas dengan margin 200 karakter, dipotong di batas kata, plus
jaring pengaman terakhir.

### Berkas berubah

| Berkas | Perubahan |
|---|---|
| `Ai.gs` | `SKEMA_SOAL` +`stimulus`, `JENIS_STIMULUS`, `_bagianStimulus()`, `_rapikanStimulusAI()`, `_pasangGrupCerita()` |
| `js_soal_ai.html` | kotak "Soal bercerita", panel peringatan, `_daftarTinjauAI()` membungkus kelompok |
| `css.html` | `.kotak-cerita` `.kotak-peringatan` `.kartu-soal-ai.dalam-grup` |
| `Code.gs` | `ujiTahap10()` 12 → **25 poin**, versi → 1.5.5 |

Tidak ada perubahan skema — `grup_id` & `stimulus` sudah ada sejak
v1.4.0. **Tidak perlu migrasi.**

### Uji

`test/run45-soal-cerita.js` **BARU (71 poin, 9 bagian)** — Gemini
ditiru sehingga seluruh penyimpangan model bisa diuji tanpa memanggil
API sungguhan. Termasuk: isi prompt, lima jenis wacana, perapatan
anggota tersebar, lima jalur pelanggaran, pemangkasan wacana panjang,
dan **tersimpan lalu terbaca kembali** dari sheet.

Dibuktikan bisa MERAH: anggota tidak dirapatkan + stimulus disalin ke
semua → **5 poin**; penjagaan parameter & pelaporan dicabut →
**3 poin**.

`ujiTahap10()` diperluas untuk verifikasi lapangan: total tidak
bertambah, wacana sekali, anggota berdampingan, `grup_id` dipetakan ke
`GRP-xxxx`, dan wacana terbaca kembali dari sheet.

Seluruh **46 berkas uji hijau**.

### Pelajaran

Keluaran model bahasa adalah **masukan tak tepercaya**, sama seperti
masukan pengguna. Bedanya, model gagal dengan cara yang *terlihat
masuk akal* — 8 soal yang rapi padahal diminta 5, atau wacana yang
indah tetapi tidak diperlukan untuk menjawab.

Aturan baru §6.2 nomor 26: **hasil AI wajib dinormalisasi terhadap
aturan domain, dan setiap penyimpangan wajib dilaporkan ke pengguna —
bukan diperbaiki diam-diam.** Merapikan tanpa memberi tahu membuat
guru mengira AI selalu menurut, lalu berhenti memeriksa.


---

## v1.5.6 — Tabel tampil sebagai tabel, bukan teks bertanda `|`

**Laporan guru:** wacana AI berisi tabel muncul di layar seperti ini —

```
| Lokasi Area | Perangkat Pengguna | Jumlah Unit |
|---|---|---|
| Kantor Utama | PC Staf Administrative | 10 unit |
```

— bukan sebagai tabel.

### Empat bug, satu gejala

**1. Prompt tidak pernah meminta HTML.** Bagian soal bercerita
menyebut panjang dan isi wacana, tetapi tidak sepatah kata pun tentang
formatnya. Model memilih Markdown karena itulah bentuk yang paling
sering dilatihkan padanya.

**2. `escapeHtml()` merusak HTML yang sudah benar.** Ini bug yang
**saya buat sendiri di v1.5.5**. Pemeriksaannya hanya
`t.indexOf('<p') === -1`, sehingga wacana yang dibuka `<table>`
dianggap teks polos lalu di-escape — `<table>` berubah jadi
`&lt;table&gt;` dan tampil sebagai kode mentah.

**3. Layar tinjau meng-escape pertanyaan.** `esc(s.pertanyaan)` di
`js_soal_ai.html`, padahal bank soal dan tampilan murid sudah memakai
`konten-kaya`. Guru melihat kode, murid melihat tabel — dua layar
menampilkan hal berbeda dari data yang sama.

**4. `.konten-kaya` tidak punya CSS sama sekali.** Kelas ini dipasang
di sembilan tempat tanpa satu pun aturan gaya. Seandainya tiga bug di
atas beres pun, tabelnya tampil **tanpa garis** — terbaca sebagai
deretan kata yang menempel.

### Perbaikan

**Prompt tegas.** Bagian `FORMAT WACANA — HTML, BUKAN Markdown`
menyebut `<table><thead>…`, melarang baris ber-`|`, dan menjelaskan
akibatnya: *"akan tampil sebagai teks mentah di layar murid"*.

**`_tabelMarkdownKeHtml()` — jaring pengaman.** Prompt saja tidak
cukup; model tetap bisa membalas Markdown. Pengubah ini mengenali
baris pemisah `|---|---|`, menjadikan baris sebelumnya `<thead>`, dan
**menyamakan jumlah sel** tiap baris dengan kepalanya supaya tabel
tidak rusak bila model kurang atau lebih satu sel.

Dipasang di **dua** tempat: wacana soal **dan** konten materi
(`generateMateri` punya risiko sama, hanya belum dilaporkan).

**Deteksi HTML diperluas** ke seluruh tag blok yang diizinkan
(`p|table|ul|ol|h2|h3|h4|blockquote|pre|div`), bukan `<p>` saja.
Blok campuran ditangani per blok: yang diawali `<` dibiarkan utuh,
teks telanjang dibungkus `<p>`.

**Pemangkasan memotong di batas TAG.** Sebelumnya memotong di batas
kata; kalau jatuh di tengah `<table>`, markup rusak itu dibuang
sanitasi dan **seluruh tabel lenyap**.

**CSS `.konten-kaya`** — tabel bergaris, kepala berlatar hijau, baris
selang-seling, dan `overflow-x: auto` supaya tabel 5 kolom tetap
terbaca di ponsel. Sekaligus melengkapi `ul` `ol` `img` `code` `pre`
`blockquote` yang selama ini juga tanpa gaya.

### Berkas berubah

| Berkas | Perubahan |
|---|---|
| `Ai.gs` | prompt format HTML, `_tabelMarkdownKeHtml()`, deteksi HTML diperluas, pemangkasan di batas tag |
| `js_soal_ai.html` | pertanyaan dirender sebagai `konten-kaya`, bukan `esc()` |
| `css.html` | `.konten-kaya` + tabel, daftar, gambar, kode, kutipan |
| `Code.gs` | versi → 1.5.6 |

Tidak ada perubahan skema. **Tidak perlu migrasi.**

### Uji

`run45-soal-cerita.js` diperluas 71 → **96 poin**, tiga bagian baru:
tabel Markdown → HTML (termasuk baris bersel tidak seragam), HTML yang
sudah benar tidak dirusak, dan pemangkasan tidak memotong tag.

Dibuktikan bisa MERAH: mencabut pengubah + mengembalikan deteksi `<p>`
saja → **8 poin gagal**, dan salah satunya mencetak gejala persis
seperti laporan — `<p>| Lokasi Area | Perangkat |…`. Mengembalikan
`esc()` + mencabut CSS → **6 poin**.

Seluruh **46 berkas uji hijau**.

### Pelajaran

Satu keluhan, empat sebab di empat lapis berbeda: prompt, normalisasi,
render, gaya. Memperbaiki satu saja tidak akan mengubah apa pun yang
dilihat guru — tabel tetap salah, hanya salahnya berpindah bentuk.

Aturan baru §6.2 nomor 27: **konten kaya wajib diuji ujung ke ujung —
dari permintaan ke model, normalisasi, penyimpanan, hingga gaya
tampilan.** Kelas CSS yang dipasang di banyak tempat tetapi tidak
pernah didefinisikan adalah cacat senyap: markup-nya benar, datanya
benar, dan tetap tidak terbaca.

Turunan: bila satu data ditampilkan di beberapa layar (tinjau AI, bank
soal, layar murid), **semuanya wajib memakai jalur render yang sama**.
Perbedaan `esc()` di satu layar membuat guru dan murid melihat hal
berbeda dari sumber yang sama.


---

## v1.6.0 — Audit responsif: 7 cacat, semuanya senyap

**Permintaan guru:** *"perbaiki UI agar responsif."*

Permintaannya luas, jadi saya audit dulu keadaan nyatanya alih-alih
menebak. Hasilnya: kerangka responsifnya **sudah baik** — 12 titik
henti, sidebar jadi laci di tablet, kisi `auto-fit`, tombol 44px.
Yang rusak justru hal-hal kecil yang **tidak kelihatan rusak**.

### Tujuh temuan

**1. Enam kelas tombol yatim** — `btn-utama` `btn-sukses` `btn-mini`
`btn-bahaya-hantu` `judul-kartu`, dipakai **30 kali** di sembilan
berkas, tidak pernah didefinisikan. Cacatnya senyap karena tombolnya
tetap muncul (mewarisi `.btn`): **`btn-bahaya-hantu` tampil HIJAU**
seperti tombol biasa — padahal dipakai untuk "Lepas kelompok" dan 🗑.

**2. `class="input"` dipakai 16 kali, kelasnya bernama `.isian`.**
Seluruh kotak itu — termasuk **kotak jawaban esai murid** dan form
nilai esai guru — tampil tanpa tepi, tanpa tinggi sentuh 44px.
Diperbaiki sebagai **alias** (`.isian, .input`), bukan menyunting 16
tempat, supaya tidak ada yang terlewat.

**3. `mt-4` `mt-12` `mb-12` tidak ada** — 19 pemakaian tanpa efek.
Elemen menempel, dan cacatnya sulit terlihat karena hanya "agak
rapat".

**4. `.baris` & `.baris-antara` tanpa `flex-wrap`.** Judul panjang +
tombol berdesakan di 360px. Gejalanya selama ini ditambal
`style="flex-wrap:wrap"` inline — **sebelas kali di enam berkas**, dan
tetap tidak menutup semua kasus.

**5. `.tumbuh` tanpa `min-width: 0`.** Anak flex tidak bisa menyusut
di bawah lebar isinya, jadi judul panjang mendorong tetangganya keluar
layar — penyebab paling sering gulir mendatar yang tak diinginkan.

**6. Empat tabel tanpa pembungkus penggulir** — tiga di `js_quiz`
(riwayat, antrean koreksi 7 kolom, penilaian 6 kolom), satu di
`js_editor`. Di 360px tabel-tabel itu mendorong **seluruh halaman**
melebar.

**7. Isian ber-font 14px.** iOS Safari **memperbesar halaman
otomatis** saat pengguna menyentuh isian < 16px, lalu tidak
mengembalikannya. Murid yang mengetik jawaban esai di ponsel terjebak
pada tampilan zoom. Diperbaiki hanya di `@media (max-width: 640px)`
supaya desktop tidak berubah.

### Yang TIDAK diubah

Kerangka responsifnya sudah benar dan tidak disentuh. `index.html`
juga sengaja tetap tanpa `<meta viewport>` — Apps Script memasangnya
lewat `addMetaTag()` di `Code.gs`; memasang manual di HTML tidak
berpengaruh pada halaman yang di-serve `HtmlService`.

### Berkas berubah

| Berkas | Perubahan |
|---|---|
| `css.html` | 6 kelas tombol, alias `.input`, 3 kelas jarak, `flex-wrap`, `min-width:0`, font 16px di ponsel |
| `js_quiz.html` | 3 tabel dibungkus `.tabel-gulir` |
| `js_editor.html` | 1 tabel dibungkus |
| `Code.gs` | versi → 1.6.0 |

Tidak ada perubahan skema maupun backend. **Tidak perlu migrasi.**

### Uji

`test/run46-responsif.js` **BARU (38 poin, 7 bagian)** — menguji hal
yang **bisa diukur**, bukan selera tata letak:

- **A** — sisir SELURUH kelas di 12 berkas UI, bandingkan dengan CSS.
  Kait JS (`querySelectorAll`) dibedakan dari kelas gaya lewat
  pemeriksaan apakah namanya dipakai sebagai selektor di JS; delapan
  kait sah dilaporkan terpisah, bukan disembunyikan.
- **D** — setiap `<table>` wajib punya pembungkus ber-`overflow-x`.
  Template editor (`insertHTML`) dikecualikan karena dirender di
  `.editor-isi` / `.konten-kaya`.
- **E** — merender `gambarPembukaQuiz()` dan `gambarDaftarKelasQuiz()`
  di **DOM sungguhan**, lalu memeriksa pohonnya: tabel harus berada
  di dalam `.tabel-gulir`, dan pembungkus itu **hanya boleh memuat
  tabelnya**. Inilah bukti `</div>` tidak lupa — kalau kurang satu,
  kartu sesudahnya ikut tersedot ke dalam pembungkus.

Dibuktikan bisa MERAH bertahap: mencabut kelas tombol + `flex-wrap` +
alias `.input` → **11 poin**; mencabut font 16px → **3 poin**;
mencabut satu pembungkus tabel → **2 poin** (termasuk bagian E yang
membaca DOM).

Seluruh **47 berkas uji hijau**.

### Pelajaran

Tiga sesi berturut-turut, kelas CSS yang **dipakai tetapi tidak
pernah didefinisikan**: `.konten-kaya` (v1.5.6), lalu tujuh kelas
lagi di sini. Pola yang sama, dan selalu senyap — markup benar, data
benar, elemennya muncul, hanya tampilannya salah dengan cara yang
tidak mencolok.

Aturan §6.2 no. 27 sudah menyuruh memeriksa hal ini dengan `grep`.
Yang kurang adalah **penegakannya**: `run46` bagian A kini
menyisirnya otomatis tiap kali regresi dijalankan, jadi kelas yatim
berikutnya ketahuan pada hari ia ditulis — bukan tiga versi kemudian.

Tambahan pada no. 27: **bila satu cacat berulang di tiga rilis, yang
salah bukan ketelitian melainkan tidak adanya alat ukur.**


---

## v1.6.1 — `cekBerkasUI()`: memastikan berkas UI benar-benar tersalin

**Laporan guru:** *"kok masih tetap tidak ada yang berubah seperti di
pratinjau"* — setelah menyalin berkas dan Deploy.

### Yang ketahuan

Tidak ada satu pun cara memastikan berkas **HTML/CSS** sudah tersalin.

`cekKesehatan()` memeriksa `typeof Util`, `typeof Rekap`, dan
sejenisnya — itu mustahil dilakukan pada CSS. Jadi guru yang lupa
menyalin `css.html`, atau yang deployment-nya belum diperbarui, tetap
dilapori **"sehat"** lalu bingung kenapa tampilannya sama saja.

Sembilan rilis terakhir menyentuh berkas UI (`css.html` empat kali),
dan tiap kali satu-satunya cara memverifikasi adalah **melihat dengan
mata** — yang justru sedang tidak bisa diandalkan karena gejalanya
"tidak ada yang berubah".

### `cekBerkasUI()`

Membaca isi berkas HTML/CSS yang sesungguhnya lewat `include()`, lalu
mencari **penanda** khas tiap rilis — 19 penanda dari v1.4.2 sampai
v1.6.0.

Bila penanda tidak ditemukan, berkas itu masih versi lama, dan
laporannya menyebut **akibatnya**, bukan sekadar nama berkas:

```
📄 css.html — masih versi lama (perlu v1.6.0 atau lebih baru)
     • v1.6.0: kotak jawaban esai murid tampil tanpa tepi
     • v1.6.0: tombol hapus tampil HIJAU seperti tombol biasa
```

Bila semuanya cocok, ia **tidak berhenti di situ** — sebabnya berarti
penerapan, jadi log-nya langsung menyebut tiga tersangka berikutnya:
cache peramban, URL `/exec` vs `/dev`, dan tab lama yang belum dimuat
ulang.

### `KENAPA-TAMPILAN-TIDAK-BERUBAH.md`

Panduan lima langkah berurutan, berhenti begitu ketemu sebabnya.
Memuat kesalahan yang paling sering terjadi:

- **Deploy → New deployment** membuat URL **baru**; URL lama tetap
  versi lama. Yang benar: **Manage deployments → ✏️ → New version**
- `Ctrl+S` menyimpan kode tetapi **tidak** mengubah `/exec`
- SPA tidak mengambil ulang CSS — tab yang terbuka sejak sebelum
  Deploy tetap memakai gaya lama

Plus cara memastikan dari Console peramban:

```js
getComputedStyle(document.querySelector('.baris-antara')).flexWrap
// "wrap" → v1.6.0 masuk · "nowrap" → css.html masih lama
```

### Berkas berubah

| Berkas | Perubahan |
|---|---|
| `Code.gs` | `cekBerkasUI()` BARU, versi → 1.6.1 |
| `KENAPA-TAMPILAN-TIDAK-BERUBAH.md` | **BARU** |

Tidak ada perubahan aplikasi. **Tidak perlu migrasi.**

### Uji

`run46-responsif.js` diperluas 38 → **48 poin**, bagian H baru.

Yang paling penting: **setiap penanda diverifikasi benar-benar ada di
berkasnya**. Penanda salah ketik membuat diagnostik melapor "belum
tersalin" selamanya — lebih buruk daripada tidak punya diagnostik
sama sekali.

Dibuktikan bisa MERAH: satu huruf diubah (`.inputt`) → 1 poin gagal
menyebut penanda mana yang salah; mencabut fungsinya → 9 poin.
Diagnostiknya sendiri diuji dengan menyalin `css.html` versi lama ke
folder terpisah — ia menunjuk `css.html` dan `js_quiz.html` dengan
tepat.

Seluruh **47 berkas uji hijau**.

### Pelajaran

Selama sembilan rilis saya menulis "salin berkas ini, lalu Deploy"
tanpa pernah menyediakan cara **membuktikan** langkah itu berhasil.
Ketika akhirnya gagal, tidak ada yang bisa dilakukan selain menebak.

Aturan baru §6.2 nomor 28: **setiap instruksi penerapan wajib punya
pasangan verifikasinya.** Bila sistem meminta pengguna menyalin
berkas, harus ada fungsi yang menjawab *"sudah tersalin belum?"* —
dan jawabannya harus menyebut akibat, bukan sekadar nama berkas.

Turunan: verifikasi wajib membedakan **kode salah** dari **penerapan
salah**. Keduanya bergejala identik bagi pengguna, tetapi
perbaikannya sama sekali berbeda.


---

## v1.6.2 — Dialog terpotong dan tidak bisa digulir

**Laporan guru:** *"saat klik buat soal dengan AI, isi kotak halaman
terpotong dan tidak bisa di scrol"*.

### Sebab

`.dialog` **tidak punya `max-height` maupun `overflow`** sama sekali.
Yang punya hanya `.dialog-lebar` — dan kelas itu dipasang **manual
dari JS**, cuma pada **1 dari 24 dialog** (form soal, `js_quiz:897`).

Dua puluh tiga dialog lainnya, termasuk "Buat Soal dengan AI" yang
berisi **8 medan**, meluber melewati tinggi layar tanpa cara apa pun
untuk menggulirnya. Di layar 568px, kotak "Soal bercerita", catatan
tambahan, dan tombol **Buat Soal** semuanya di luar jangkauan.

Audit responsif v1.6.0 melewatkan ini karena hanya memeriksa halaman
— dialog baru muncul setelah diklik.

### Perbaikan — di akar, bukan per dialog

Batas tinggi & gulir dipindah dari `.dialog-lebar` ke **`.dialog`
sendiri**, sehingga berlaku untuk **seluruh 24 dialog** sekaligus:

```css
.dialog {
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;   /* momentum iOS */
}
```

`.dialog-lebar` kini hanya mengatur lebar.

**Tombol aksi menempel di dasar** (`position: sticky`) supaya
Simpan/Batal selalu terlihat tanpa harus menggulir sampai bawah —
tanpa ini, dialog panjang memaksa guru menggulir dua kali.

**Tirai ikut menggulir** (`overflow-y: auto`) sebagai jaring pengaman
bila dialognya masih lebih tinggi dari layar, misalnya ponsel
mendatar dengan tinggi < 400px.

**Di ponsel** padding tirai dikecilkan 20px → 10px, dialog dirapatkan
ke atas (`align-items: flex-start`), dan tombolnya memenuhi lebar
agar mudah disentuh.

### Berkas berubah

| Berkas | Perubahan |
|---|---|
| `css.html` | `.dialog` batas tinggi + gulir, `.dialog-aksi` sticky, `.tirai-dialog` gulir, penyesuaian ponsel |
| `Code.gs` | 2 penanda v1.6.2 di `cekBerkasUI()`, versi → 1.6.2 |

Hanya CSS — **tidak perlu migrasi**, tidak ada perubahan perilaku.

### Uji

`run46-responsif.js` diperluas 48 → **63 poin**, bagian G2 baru.

Selain memeriksa aturan CSS, bagian ini **membuka dialog AI yang
sungguhan** di DOM: memanggil `dialog()` asli dari `js_core.html` dan
`dialogGenerateSoal()` asli dari `js_soal_ai.html`, lalu memastikan
kedelapan medannya tergambar — termasuk `#ai-catatan` yang paling
bawah, yang justru terpotong sebelum perbaikan ini.

Dibuktikan bisa MERAH: mengembalikan keadaan v1.6.1 (batas tinggi
hanya di `.dialog-lebar`) → **4 poin gagal**; mencabut sticky pada
tombol → **1 poin**.

`cekBerkasUI()` naik jadi **21 penanda** sehingga guru bisa memastikan
`css.html` versi ini sudah tersalin.

Seluruh **47 berkas uji hijau**.

### Pelajaran

Audit v1.6.0 menyisir halaman dengan teliti dan tetap melewatkan
dialog — karena dialog **tidak ada di DOM sampai diklik**. Sisi
aplikasi yang hanya muncul setelah interaksi tidak akan pernah
tertangkap audit statis.

Aturan baru §6.2 nomor 29: **audit tampilan wajib mencakup keadaan
yang MUNCUL SETELAH INTERAKSI** — dialog, panel, laci, menu, tirai.
Bukanya dalam uji, lalu periksa DOM-nya.

Turunan: bila sebuah aturan gaya dipasang lewat kelas tambahan dari
JS (seperti `.dialog-lebar`), itu tanda aturannya **sebenarnya milik
kelas dasar**. Kelas tambahan yang harus diingat dipasang manual akan
terlewat — di sini 23 dari 24 kali.


---

## v1.6.3 — Daftar pilih murid menyebut kelasnya

**Laporan guru:** *"ketika saya bikin kelas baru dengan kelas yang
sama misal XII TKJ 1 dengan mapel yang berbeda, saya kesulitan
mendaftarkan siswa karena tidak ada penanda kelas."*

Saya sempat salah tangkap — mengira yang kurang penanda pada **nama
kelas** di dropdown. Guru meluruskan:

> *"data murid yang akan saya masukkan ke kelas misal XII TKJ 1 tidak
> ada, jadi hanya nama murid saja, kan bisa saja si A adalah kelas
> XII TKJ 2"*

Yang kurang adalah penanda pada tiap **murid** di daftar pilih.

### Sebab

`Kelas.muridTersedia()` hanya mengirim
`{user_id, nama, username}` — tidak pernah menyertakan kelas murid.

Nama murid **tidak unik**. Dua "Ahmad Fauzi" dari XII TKJ 1 dan
XII TKJ 2 tampil identik di panel "Daftarkan Murid"; satu-satunya
pembeda adalah username otomatis (`ahmadf` / `ahmadf2`) yang tidak
menyiratkan kelas apa pun.

Kesalahannya **senyap**: tidak ada galat, murid hanya masuk ke kelas
orang lain — dan baru ketahuan saat nilainya muncul di rekap yang
salah.

### Perbaikan — di backend, bukan ditambal di UI

`muridTersedia()` kini menyertakan `kelas`: daftar kelas lain yang
sudah diikuti murid, lengkap dengan `nama_kelas` dan `mapel`.

Satu pemindaian `enrollment` dipakai untuk **dua** keperluan
sekaligus — menyaring yang sudah terdaftar dan mengumpulkan kelas
tiap murid — jadi tidak ada tambahan biaya baca.

Di UI, tiap baris murid kini menampilkan pil kelasnya. Mapel ikut
tampil supaya kelas bernama sama tetap terbedakan:

```
Ahmad Fauzi                    Ahmad Fauzi
ahmadf                         ahmadf2
[XII TKJ 1 · PKPJ]             [XII TKJ 2 · PKPJ]
```

Murid **tanpa kelas** ditandai `belum punya kelas` — justru merekalah
yang paling mungkin perlu didaftarkan, jadi tidak boleh terlihat
seperti data rusak.

**Pencarian ikut menyaring nama kelas.** Guru bisa mengetik `TKJ 2`
untuk melihat murid kelas itu saja — jalan pintas untuk mendaftarkan
satu rombongan sekaligus.

### Kasus tepi yang ditangani

Enrollment bisa menunjuk kelas yang sudah dihapus. Kelas hantu itu
**dibuang**, bukan ditampilkan sebagai `undefined`.

### Berkas berubah

| Berkas | Perubahan |
|---|---|
| `Kelas.gs` | `muridTersedia()` menyertakan daftar kelas murid |
| `js_kelola.html` | pil kelas per murid, pencarian mencakup kelas |
| `css.html` | `.baris-pil` |
| `Code.gs` | 2 penanda v1.6.3, versi → 1.6.3 |

Tidak ada perubahan skema. **Tidak perlu migrasi.**

### Uji

`test/run47-penanda-kelas.js` **BARU (27 poin, 7 bagian)** — memakai
data yang meniru laporan guru persis: dua murid bernama sama di kelas
berbeda, plus kelas bernama sama dengan mapel berbeda.

Mencakup murid tanpa kelas, murid lintas kelas, murid yang sudah
terdaftar (harus tersaring), kelas terhapus, keamanan payload (tidak
membocorkan `password_hash`), dan pemasangan di UI.

Dibuktikan bisa MERAH: mengembalikan `muridTersedia()` versi lama →
**8 poin**; mengembalikan baris UI versi lama → **5 poin**.

Satu **cacat uji** ikut diperbaiki: hilangnya medan `kelas` membuat
berkas uji berhenti di poin pertama karena `a1.kelas[0]` undefined —
sisa kerusakan jadi tak terlihat. Aksesnya kini lewat pembungkus
aman, sehingga semua poin tetap dievaluasi.

Seluruh **48 berkas uji hijau**.

### Pelajaran

Saya salah tangkap di percobaan pertama: guru bilang "penanda kelas",
saya membacanya sebagai penanda **pada nama kelas** padahal
maksudnya penanda **kelas milik murid**. Sudah menulis satu helper
dan hampir menyunting empat dropdown sebelum diluruskan.

Aturan baru §6.2 nomor 30: **saat keluhan menyebut sesuatu "tidak
ada", pastikan dulu DI LAYAR MANA** sebelum memperbaiki. Satu kata
yang sama bisa menunjuk dua tempat berbeda, dan memperbaiki tempat
yang salah menghabiskan waktu sekaligus membuat pengguna mengulang
penjelasannya.

Turunan: keluhan yang berbunyi *"sudah pernah saya minta tapi tidak
muncul"* hampir selalu berarti perbaikan sebelumnya **mengenai layar
yang berbeda** — bukan gagal diterapkan.


---

## v1.6.4 — Label rombel & format impor baru

Tiga permintaan guru sekaligus, setelah **dua kali** saya salah
tangkap.

### Duduk perkaranya

Di LessonLen satu baris `kelas` sebenarnya **kelas-mapel**. Rombel
`XII TKJ 1` yang mengambil tiga mapel = **tiga baris kelas terpisah**,
semuanya bernama sama. Rombelnya sendiri tidak punya wujud di sistem.

### A — Dropdown pemilih kelas tidak menyebut mapel

**Ini keluhan aslinya**, dan v1.6.3 sempat salah sasaran ke daftar
pilih murid.

Empat dropdown (`impor murid`, `filter murid`, `unduh CSV`,
`form murid`) hanya menampilkan `nama_kelas`, sehingga muncul dua
pilihan tertulis persis `XII TKJ 1`. Datanya sudah dikirim server —
UI-nya yang membuang `mapel`.

Diperbaiki lewat **satu helper** `labelKelas()` di `js_core`, bukan
ditambal empat kali:

```
XII TKJ 1 · PKPJ
XII TKJ 1 · Basis Data
```

### B — Kolom `rombel` pada `users`

Guru meluruskan dengan tegas:

> *"rombel itu hanya label saja, untuk memfilter nama-nama murid pada
> rombel yang sama. jadi kolom kelas pada impor itu tidak memasukkan
> murid ke kelas-mapel, tapi hanya label saja"*

Saya sempat merancangnya sebagai **pendaftaran otomatis** — mengetik
`XII TKJ 1` akan mendaftarkan murid ke semua kelas-mapel bernama itu.
Salah. Rombel adalah **label murni** pada murid.

Alurnya jadi dua langkah yang terpisah bersih:

1. **Impor** → murid masuk sistem, berlabel rombel
2. **Daftarkan** → saring rombel, centang semua, masukkan ke satu
   kelas-mapel

Label dinormalisasi (`xii  tkj  1` → `XII TKJ 1`) supaya salah ketik
tidak memecah filternya. Penyaring rombel ditambahkan di layar Kelola
Murid **dan** panel Daftarkan Murid.

> Perlu **`migrasiStruktur()`** — kolom baru pada sheet `users`.

### C — Format impor `nama, kelas, username, password`

Hanya **nama** yang wajib.

```
Budi Santoso, XII TKJ 1, budi01, budi123
Citra Dewi, XII TKJ 1          → username & sandi otomatis
Eko Prasetyo                   → nama saja
```

**Password opsional.** Bila diisi, dipakai apa adanya dan murid
**tidak** dipaksa menggantinya — guru memegang daftar sandinya
sendiri (keputusan guru). Bila kosong, sandi acak dibuat dan wajib
diganti seperti sebelumnya.

Sandi divalidasi dengan aturan yang **sama** seperti saat murid
menggantinya sendiri (min 6 karakter, huruf + angka). Baris yang
gagal **ditolak beserta alasannya**, bukan diam-diam diganti sandi
acak — guru sudah memegang daftarnya, dan mengganti tanpa memberi
tahu membuat murid tidak bisa masuk.

### Kompatibilitas format lama

Kolom ke-2 dulu **username**, sekarang **rombel**. Daftar lama guru
tidak boleh rusak.

Pembedanya pada bentuk 2 kolom: rombel hampir selalu berspasi
(`XII TKJ 1`), username tidak pernah — `normalisasiUsername()`
membuang spasi. Jadi `Kiki;kikil` tetap dibaca sebagai username,
`Nanda, XII TKJ 3` sebagai rombel.

### Berkas berubah

| Berkas | Perubahan |
|---|---|
| `Setup.gs` | kolom `rombel` pada `users` |
| `Kelas.gs` | `_normRombel()`, `_petakanKolomImpor()`, impor 4 kolom, filter rombel |
| `js_core.html` | `labelKelas()` |
| `js_kelola.html` | 4 dropdown, isian & filter rombel, kolom tabel, bantuan impor |
| `Code.gs` | 3 penanda v1.6.4, versi → 1.6.4 |

> **Jalankan `migrasiStruktur()`** setelah menyalin.

### Uji

`test/run48-rombel-impor.js` **BARU (66 poin, 12 bagian)** — mencakup
migrasi kolom pada sheet lama, normalisasi label, bukti bahwa rombel
**tidak** membuat enrollment, password opsional, penolakan sandi
lemah per baris, dan kompatibilitas format lama.

Dibuktikan bisa MERAH bertahap: dropdown tanpa mapel → **2 poin**;
kolom skema dicabut → **8 poin**; rombel dijadikan enrollment →
**1 poin**; sandi dipaksa ganti + lemah diganti diam-diam →
**5 poin**; kompatibilitas dicabut → **2 poin**.

Regresi menangkap satu **cacat uji** di `run47`: regex menuntut
`cari` dan `data-nama` berdekatan <300 karakter, patah begitu
`data-rombel` menyisip. Diperbaiki dengan memeriksa **sifatnya** —
isi pernyataan `var cari` harus memuat `k.nama_kelas`. Longgaran
pertama sempat kebablasan sampai tidak menangkap apa pun; diperketat
lalu dibuktikan merah lagi.

Seluruh **49 berkas uji hijau**.

### Pelajaran

Dua kali salah tangkap pada satu keluhan. Pertama mengira "penanda
kelas" berarti penanda pada nama kelas; kedua mengira kolom rombel
mendaftarkan murid. Keduanya baru terkoreksi karena guru menjelaskan
ulang.

Yang menyelamatkan: pada putaran ketiga saya **berhenti menulis kode**
dan merangkum pemahaman dulu — dan rangkuman itulah yang membuat
kesalahan kedua ketahuan sebelum sempat dibangun.

Aturan baru §6.2 nomor 31: **untuk permintaan yang menyentuh model
data, tuliskan rangkuman pemahaman DAN konsekuensinya sebelum
menulis kode.** Satu paragraf yang salah lebih murah diperbaiki
daripada satu fitur yang salah.

Turunan: bila pengguna sudah mengoreksi sekali, jangan langsung
membangun koreksinya — pastikan dulu koreksi itu sudah dipahami
seutuhnya. Kesalahan kedua v1.6.4 lahir justru dari terburu-buru
memperbaiki kesalahan pertama.


---

## v1.6.5 — Dua sisa v1.6.4 yang saya lewatkan

**Laporan guru**, dua hal sekaligus.

### Bug 1 — "Periksa" membaca rombel sebagai nama pengguna

```
suherman, XII TKJ 2, siswa001, suher123
wowo,     XII TKJ 2, siswa002, wowo123
joko,     XII TKJ 2, siswa003, joko123
```

Hasil tombol **Periksa**:

```
1  suherman   xiitkj2
2  wowo       xiitkj22   Nama pengguna "xiitkj2" sudah dipakai
3  joko       xiitkj23   Nama pengguna "xiitkj2" sudah dipakai
```

Dugaan guru tepat: *"kayaknya kelas dibaca sebagai nama pengguna"*.

**Sebabnya:** ada **dua** fungsi impor — `imporMurid()` yang menulis,
dan `pratinjauImpor()` yang melayani tombol Periksa. v1.6.4 hanya
memperbaiki yang pertama. `pratinjauImpor()` masih membaca `kolom[1]`
sebagai username.

Impornya sendiri sebenarnya **benar** — tetapi guru tidak akan pernah
tahu, karena pratinjau menakutinya lebih dulu. Pratinjau yang berbeda
dari hasil sebenarnya lebih buruk daripada tidak ada pratinjau.

Kini keduanya memakai `_petakanKolomImpor()` yang **sama**. Sandi
lemah juga sudah dilaporkan saat Periksa, bukan setelah separuh baris
ditolak.

### Bug 2 — Kolom "Kelas-Mapel" tidak menampilkan mapel

v1.6.4 mengganti judul kolomnya, tetapi `daftarMurid()` hanya membaca
`nama_kelas` dari sheet — mapelnya tidak pernah diambil. Jadi judulnya
berubah, isinya tidak.

Ditambahkan medan `kelas_mapel`; medan `kelas` lama tetap ada demi
pemakai lain. Ikut diperbaiki: **form edit murid** dan **CSV unduhan**
(sekalian diberi kolom Rombel).

### Berkas berubah

| Berkas | Perubahan |
|---|---|
| `Kelas.gs` | `pratinjauImpor()` memakai `_petakanKolomImpor()`, `daftarMurid()` +`kelas_mapel`, CSV +Rombel & mapel |
| `js_kelola.html` | layar Periksa +kolom Rombel & asal sandi, tabel & form edit memakai `kelas_mapel` |
| `Code.gs` | 2 penanda v1.6.5, versi → 1.6.5 |

Tidak ada perubahan skema. **Tidak perlu migrasi** (kolom `rombel`
sudah dari v1.6.4).

### Uji

`run48-rombel-impor.js` diperluas 66 → **88 poin**, dua bagian baru.

Bagian J2 memakai **data guru persis**, dan yang terpenting:
membandingkan hasil `pratinjauImpor()` dengan `imporMurid()` —
keduanya wajib meramalkan username yang sama.

Dibuktikan bisa MERAH: mengembalikan `kolom[1]` → **4 poin**, dan
salah satunya mencetak `xiitkj2,xiitkj22,xiitkj23` persis seperti
laporan; mencabut `kelas_mapel` → **5 poin**.

Satu poin lama ikut diperbaiki: `empat dropdown memakai labelKelas`
mematok angka **4**, padahal pil kelas kini juga memakainya. Diganti
pemeriksaan sifat — "tidak ada pil kelas ber-`esc` telanjang" — lalu
**dibuktikan merah lagi**, mengikuti §6.2 no. 31 turunan kedua.

Pembungkus aman dipasang di bagian J3 supaya hilangnya medan
menghasilkan 5 poin merah, bukan menghentikan berkas uji di poin
pertama.

Seluruh **49 berkas uji hijau**.

### Pelajaran

Dua fungsi melayani satu perilaku: satu menulis, satu meramalkan.
Memperbaiki yang menulis saja membuat ramalannya berbohong — dan
justru ramalan itulah yang dilihat guru sebelum memutuskan.

Aturan baru §6.2 nomor 32: **fungsi pratinjau/simulasi wajib memakai
jalur logika yang SAMA dengan fungsi yang dijalankannya, dan wajib
diuji dengan membandingkan hasil keduanya** — bukan diuji sendiri.
Pratinjau yang menyimpang lebih berbahaya daripada tidak ada
pratinjau, karena ia menghentikan tindakan yang sebenarnya benar.

Turunan: saat mengubah format masukan, `grep` seluruh fungsi yang
mengurai format itu. v1.6.4 mengubah arti kolom tetapi hanya
menyisir satu dari dua penguraiannya.


---

## v1.6.6 — Halaman bisa digeser ke samping di ponsel

**Laporan guru:** *"lebar halaman masih belum menyesuaikan di layar
mobile"* — di **semua** halaman, dan halamannya **bisa digeser** ke
kiri-kanan. `cekBerkasUI()` bersih, jadi kodenya memang sudah
tersalin.

### Sebab

```css
.tabel-gulir { overflow-x: auto; margin: 0 -16px; padding: 0 16px; }
```

Margin negatif itu trik lama agar tabel "menembus" padding induknya
sehingga terasa penuh selebar layar. Tetapi ia melebarkan elemen
**32px melewati induknya**.

Selama induknya berpadding tepat 16px, kelebihannya pas tertutup.
Begitu induknya berpadding lebih kecil — kartu tabel murid memakai
`padding:6px` — sisanya **meluber 10px per sisi** dan mendorong
seluruh halaman.

Gejalanya muncul di **semua** halaman karena pembungkus ini dipakai
**delapan kali di lima berkas**.

### Kenapa audit v1.6.0 melewatkannya

Audit itu memeriksa apakah tiap `<table>` **punya** pembungkus
penggulir. Pertanyaan yang tidak pernah diajukan: apakah pembungkusnya
sendiri **muat di layar**.

### Perbaikan

**1. Margin negatif dibuang.** `.tabel-gulir` kini
`overflow-x: auto; max-width: 100%` — menggulir di dalam kotaknya
tanpa melebar keluar.

**2. Jaring pengaman halaman.** `overflow-x: hidden` pada `html`
**dan** `body` (sebagian peramban seluler abai bila hanya salah satu).
Satu elemen meluber cukup untuk merusak seluruh halaman, dan sebabnya
nyaris mustahil ditemukan dengan mata.

Ini **tidak** mematikan penggulir yang disengaja — `.tabel-gulir` dan
`.konten-kaya` punya overflow sendiri.

**3. Media dibatasi.** `img, video, iframe, svg, canvas { max-width: 100% }`
— penyebab overflow paling sering setelah margin negatif.

### Bug ikutan yang ditemukan uji

`.konten-kaya` punya `overflow-x: auto` **tanpa `max-width`**. Elemen
ber-overflow tanpa batas lebar tetap melebar mengikuti isinya —
overflow-nya **tidak pernah aktif**. Jadi tabel lebar dari AI ikut
mendorong halaman, bukan menggulir di dalam kotaknya.

Saya tidak menyadarinya; bagian F `run49` yang menemukannya.

### Berkas berubah

| Berkas | Perubahan |
|---|---|
| `css.html` | `.tabel-gulir` tanpa margin negatif, jaring pengaman html/body, batas media, `.konten-kaya` +max-width |
| `Code.gs` | 2 penanda v1.6.6, versi → 1.6.6 |

Hanya CSS. **Tidak perlu migrasi.**

### Uji

`test/run49-lebar-mobile.js` **BARU (20 poin, 8 bagian)** — memakai
`getComputedStyle()` jsdom untuk **mengukur**, bukan mencocokkan teks
CSS.

Bagian B menyisir **seluruh** berkas CSS untuk margin negatif
mendatar, jadi kelas apa pun yang mengulanginya ketahuan — bukan
hanya yang sudah dikenal. Bagian F memastikan tiap elemen
ber-`overflow-x` punya `max-width`; itulah yang menangkap
`.konten-kaya`.

Dibuktikan bisa MERAH: margin negatif dikembalikan → **5 poin**
(lengkap dengan nomor barisnya); jaring pengaman dicabut →
**8 poin**; `.konten-kaya` tanpa batas → **1 poin**.

**`pratinjau-lebar.html` BARU** — dibuka langsung di ponsel, mengukur
lebar layar sungguhan lalu **menyebut nama elemen** yang meluber bila
ada. Berbeda dari pratinjau lain yang memakai iframe berlebar tetap.

Seluruh **50 berkas uji hijau**.

### Pelajaran

Trik CSS yang bergantung pada nilai padding induknya adalah bom
waktu: ia benar hari ini, dan salah begitu ada induk dengan padding
berbeda. `.tabel-gulir` menganggap semua induknya berpadding 16px —
asumsi yang tidak pernah ditulis di mana pun.

Aturan baru §6.2 nomor 33: **jangan memakai margin negatif mendatar.**
Bila sebuah elemen perlu tampil lebih lebar dari induknya, ubah
struktur atau padding induknya — jangan menariknya keluar. Efeknya
bergantung pada induk, sehingga benar di satu layar dan merusak di
layar lain.

Turunan: setiap elemen ber-`overflow-x` **wajib punya `max-width`**.
Tanpa itu ia melebar mengikuti isinya dan penggulirnya tidak pernah
aktif — tampak benar di kode, tidak berfungsi di layar.

Turunan kedua: pasang `overflow-x: hidden` di `html`/`body` sebagai
jaring pengaman. Bukan pengganti perbaikan yang benar, tetapi
mencegah satu kesalahan kecil merusak seluruh aplikasi.


---

## Tugas Kelompok — Tahap 1: backend (v1.7.0-tahap1)

Jenis kegiatan baru: **tugas kelompok**. Isinya sama seperti LKPD,
tetapi dikerjakan berkelompok dan yang mengumpulkan hanya **ketua**.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Setup.gs` | 🔴 **Wajib** | sheet `kelompok` BARU · 2 kolom baru di `lkpd_submission` · enum `tipe` di 2 tempat |
| `Util.gs` | 🔴 **Wajib** | prefix ID `KLP` |
| `Kelompok.gs` | 🔴 **BARU** | seluruh logika tugas kelompok |
| `Code.gs` | 🔴 **Wajib** | 10 API baru · `cekKesehatan()` mengenal modul `Kelompok` |
| `Pertemuan.gs` | 🔴 **Wajib** | `TIPE` + `tugas_kelompok` · batas waktu · 2 jalur hapus berantai |
| `Kelas.gs` | 🔴 **Wajib** | hapus berantai ikut membuang sheet `kelompok` |
| `Rekap.gs` | 🔴 **Wajib** | nilai tugas kelompok masuk rekap; dibaca lewat anggota, bukan pemilik submission |

Setelah menyalin, **wajib** menjalankan `migrasiStruktur()` sekali.
Tanpa itu sheet `kelompok` tidak ada dan seluruh fiturnya gagal.

### Keputusan rancangan

**Progres SELURUH anggota berubah saat ketua mengumpulkan.** Bila
hanya ketua yang tercatat, anggota lain terkunci selamanya di
pertemuan berurut-ketat — mereka tidak punya cara menyelesaikannya
sendiri.

**Nilai dua tingkat.** Nilai kelompok berlaku untuk semua, lalu guru
boleh menyesuaikan per anggota. Yang ditulis ke `progress.nilai` tiap
murid adalah nilai **akhirnya**, supaya Rekap Nilai konsisten dengan
yang dilihat murid.

**Murid tanpa kelompok tetap boleh membuka.** Ia melihat pesan
"belum dimasukkan ke kelompok", bukan halaman galat.

**Pengumpulan menumpang sheet `lkpd_submission`.** Status, penilaian,
dan umpan baliknya identik dengan LKPD. Kolom pembedanya `kelompok_id`
dan `nilai_anggota`.

### Empat celah ditemukan sebelum jadi bug

1. Tiga jalur hapus (item / pertemuan / kelas) melewatkan sheet
   `kelompok` — barisnya jadi yatim.
2. `Pertemuan.salin()` — kelompok **sengaja tidak disalin**.
   Anggotanya murid kelas asal; menyalinnya mengulang bug v1.1.1.
3. `Rekap._nilaiLkpd()` mencari per `user_id`, padahal submission
   hanya milik ketua — anggota lain kosong di rekap.
4. `Pertemuan.simpanItem()` masih membatasi `TIPE` ke 4 nilai.

`test/run50-tugas-kelompok.js` BARU — 80 poin, 14 bagian.


---

## Tugas Kelompok — Tahap 2: UI guru (v1.7.0-tahap2)

Layar guru untuk menyusun kelompok dan menilainya.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_kelompok.html` | 🔴 **BARU** | seluruh layar guru: susunan, bagi otomatis, penilaian |
| `index.html` | 🔴 **Wajib** | `include('js_kelompok')` — tanpa ini layarnya tidak pernah dimuat |
| `js_core.html` | 🔴 **Wajib** | rute `nilai-kelompok` & `tugas-kelompok` di peta `ASAL` |
| `js_editor.html` | 🔴 **Wajib** | `IKON_TIPE`/`NAMA_TIPE` + `tugas_kelompok` · tombol tambah item · tombol 👥 Kelompok |
| `css.html` | 🔴 **Wajib** | `.kartu-kelompok` `.isian-nilai` `.ikon-tipe.tugas_kelompok` |
| `Code.gs` | 🔴 **Wajib** | API `getDetailKelompok` · 8 penanda baru `cekBerkasUI()` · versi `1.7.0-tahap2` |
| `Kelompok.gs` | 🔴 **Wajib** | `Kelompok.detail()` — payload layar penilaian |

Verifikasinya: jalankan **`cekBerkasUI()`** — sekarang **40 penanda**.

### Nama kelompok diketik guru

Keputusan guru. Kotak isiannya bebas: nama tim, topik, atau sekadar
"Kelompok 1". **Bagi Otomatis** hanya memberi nama sementara
`Kelompok 1, 2, 3…` dan menetapkan anggota pertama sebagai ketua
sementara — keduanya boleh diubah lewat tombol Ubah, dan dialognya
menyebutkan itu.

### Yang dijaga di layar ini

**Panel Ubah menggabungkan anggota kelompok itu sendiri** dengan
daftar murid yang belum berkelompok. Tanpa penggabungan itu, membuka
Ubah lalu Simpan akan **mengosongkan kelompok** — anggotanya tidak
pernah muncul untuk dipertahankan.

**Dropdown ketua dibangun ulang dari centang anggota.** Bila statis,
guru bisa menyimpan ketua yang bukan anggota; backend menolaknya
dengan pesan yang tidak menjelaskan apa-apa.

**Kotak penyesuaian yang dikosongkan berarti "ikut nilai kelompok",
bukan nol** (KONVENSI §6.2 no. 22). Placeholder-nya berbunyi
`ikut kelompok` dan keterangannya menyebut itu dengan huruf tebal.
Mengirim 0 untuk kotak kosong akan menurunkan nilai seluruh anggota
diam-diam.

**Kelompok yang sudah dinilai terkunci susunannya** — backend
menolaknya sejak Tahap 1. Tombol Ubah & Bubarkan dikelabukan **dan**
sebabnya ditulis: "🔒 sudah dinilai — susunan terkunci" (no. 20).

**Tombol 👥 Kelompok tidak menunggu status publish**, tidak seperti
Penilaian LKPD & Quiz. Guru menyiapkan susunan dulu, baru menerbitkan
itemnya. Bila itemnya masih draf, layarnya memperingatkan bahwa murid
belum bisa membukanya.

### Berkas uji

`test/run51-ui-kelompok.js` BARU — **150 poin, 14 bagian**, di atas
DOM sungguhan (jsdom). Dibuktikan MERAH pada 7 cabang: panel Ubah
tanpa penggabungan anggota (7 poin), dropdown ketua statis (14),
kotak kosong dikirim sebagai nol (1), penguncian setelah dinilai (3),
`IKON_TIPE` tanpa entri (1), `.isian-nilai` kelas yatim (3), penanda
`cekBerkasUI()` dihapus (6).

`test/buat-pratinjau-kelompok.js` BARU — menghasilkan
`pratinjau-kelompok.html` untuk diperiksa di ponsel. Sesuai §6.2
no. 32, pratinjaunya **menjalankan `js_kelompok.html` yang sungguhan**
di jsdom lalu memotret hasilnya, bukan menulis ulang HTML-nya.

### Belum dikerjakan (Tahap 3)

Layar murid (rute `tugas-kelompok`), generator AI untuk isi kegiatan,
dan `ujiTahap13()` untuk verifikasi di Apps Script sungguhan.


---

## 🔴 LKPD & tugas kelompok saling bocor (v1.7.1)

Ditemukan saat audit pasca-Tahap 2. **Dua bug, satu di antaranya
merusak data** — bukan sekadar tampilan.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Db.gs` | 🔴 **Wajib** | `bacaKolom()` memakai PRIMARY KEY sebagai penanda baris terisi |
| `Lkpd.gs` | 🔴 **Wajib** | 5 jalur menolak / menyaring baris milik kelompok |
| `Beranda.gs` | 🔴 **Wajib** | penghitung `kelompok_menunggu` terpisah + `kelompok_item_id` |
| `js_beranda.html` | 🔴 **Wajib** | tombol 👥 Tugas kelompok menunggu |
| `Code.gs` | 🟡 | versi `1.7.1` + 1 penanda baru (total **41**) |

### Bug 1 — sheet bersama tidak disaring

Sheet `lkpd_submission` dipakai bertiga: LKPD, refleksi (v1.2.0), dan
tugas kelompok (v1.7.0). Refleksi tidak pernah bocor karena statusnya
tidak pernah `menunggu`. **Tugas kelompok bocor** — bentuk datanya
identik dengan LKPD.

Terukur sebelum diperbaiki:

```
Lkpd.antrean()          → memuat tugas kelompok, atas nama KETUA saja
Beranda lkpd_menunggu   → 1 (mengirim guru ke layar yang tak memuatnya)
Lkpd.nilai() pada       → BERHASIL. progres:
  submission kelompok       ketua = selesai/99
                            anggota B = menunggu   ← terkunci selamanya
                            anggota C = menunggu   ← terkunci selamanya
```

Gejala ketiga adalah **kerusakan data**: di pertemuan berurut-ketat
kedua anggota terkunci permanen, dan tidak ada jalur di UI untuk
memperbaikinya.

Perbaikan: helper `_milikKelompok()` + `_tolakBilaKelompok()`. Lima
jalur dijaga — `antrean` `daftarKelas` `detail` `mulaiMenilai` `nilai`
`beriFeedback`. Penolakannya **mengarahkan**, bukan sekadar menolak:
*"Ini pengumpulan tugas kelompok. Nilai lewat layar Tugas Kelompok
agar seluruh anggota ikut tercatat."*

Beranda kini menghitungnya **terpisah** dengan tombolnya sendiri —
menggabungkannya membuat guru menekan "LKPD menunggu" lalu menemukan
antrean kosong.

### Bug 2 — `bacaKolom()` membuang baris diam-diam (bug LAMA)

Terlihat hanya karena kolom `kelompok_id` ditambahkan. `bacaKolom()`
memilih kolom penanda "baris terisi" dari `*_id` **mana pun** yang
lebih dulu ditemukan lewat `for..in` — termasuk **foreign key yang sah
bila kosong**.

```js
Db.bacaKolom('lkpd_submission', ['status'])                  → 2 baris
Db.bacaKolom('lkpd_submission', ['status','kelompok_id'])    → 0 baris  ⛔
Db.bacaKolom('soal',            ['grup_id','soal_id'])       → 0 dari 5 ⛔
```

Menambahkan satu kolom ke daftar bacaan bisa **mengosongkan seluruh
hasil**. Urutan `for..in` tidak dijamin, jadi gejalanya bahkan bisa
berbeda antar mesin — kelas bug yang paling sulit dilacak.

Perbaikan: hanya **kolom pertama sheet** (primary key) yang boleh jadi
penanda. Baris yang benar-benar hampa tetap dibuang.

Tiga FK opsional yang terdampak: `kelompok_id` · `mp_id` · `grup_id`.

### Berkas uji

`test/run52-pisah-lkpd-kelompok.js` BARU — **51 poin, 11 bagian**.
Dibuktikan MERAH pada 4 cabang: antrean tanpa penapis (3 poin),
`Lkpd.nilai()` tanpa penolakan (3), beranda menggabungkan hitungan
(1), `bacaKolom` memindai `*_id` sembarangan (6).


---

## Antrean gabungan tugas kelompok (v1.7.2)

Menutup keterbatasan yang tersisa dari v1.7.1: tombol beranda hanya
bisa menunjuk **satu** item, sehingga tugas kelompok di kelas lain
tidak pernah terlihat. Angkanya benar, tapi tidak semuanya bisa
dijangkau.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Kelompok.gs` | 🔴 **Wajib** | `antreanSemua()` — seluruh tugas kelompok menunggu, batch |
| `Code.gs` | 🔴 **Wajib** | API `getAntreanKelompokSemua` · versi `1.7.2` · penanda ke-42 |
| `js_kelompok.html` | 🔴 **Wajib** | layar antrean saat rute dibuka tanpa item_id |
| `js_beranda.html` | 🔴 **Wajib** | tombol menuju `#/nilai-kelompok` (tanpa item_id) |
| `Beranda.gs` | 🟡 | `kelompok_item_id` dibuang — payload mati |
| `Pertemuan.gs` | 🟡 | pesan galat tidak lagi menulis `TUGAS_KELOMPOK` |

### Bentuknya

`#/nilai-kelompok` tanpa argumen kini menampilkan seluruh tugas
kelompok yang menunggu, **dikelompokkan per tugas** — bukan daftar
rata per kelompok. Penilaian memang dikerjakan per tugas: guru membuka
satu layar lalu menilai seluruh kelompoknya sekaligus.

Tiap kartu menyebut kelas + mapel (lewat `labelKelas()`), nomor
pertemuan, berapa kelompok menunggu, dan nama tiap kelompoknya.
Kelompok yang terlambat atau sedang dibuka ditandai dengan **kata**,
bukan warna (§6.2 no. 20). Diurutkan per kelas lalu per pertemuan.

Dibaca secara **batch**, bukan memanggil `daftar()` per item: dengan
12 kelas, pola per-item berarti puluhan pembacaan sheet berulang
(§6.2 no. 1).

### Dua cacat kecil yang ikut tertangkap

**Pesan galat membocorkan nama enum.** Menambah tugas kelompok kedua
di satu pertemuan menghasilkan *"Pertemuan ini sudah memiliki
TUGAS_KELOMPOK."* — istilah yang tidak dikenal guru. Kini
*"…sudah memiliki Tugas Kelompok."*

**Payload mati.** `kelompok_item_id` yang dibuat v1.7.1 tidak lagi
dipakai setelah tombolnya menunjuk antrean; dibuang daripada
ditinggalkan sebagai bidang yang tidak berarti.

### Berkas uji

`run52` bertambah menjadi **67 poin** (bagian I2 baru: lintas kelas,
beberapa kelompok per tugas, kelompok terhapus, konsistensi dengan
angka beranda). `run51` bertambah menjadi **179 poin** (bagian L2 & L3:
layar antrean dan keadaan kosongnya).

Dibuktikan MERAH pada 3 cabang: rute tanpa item_id dialihkan ke
beranda (13 poin), `antreanSemua()` tanpa penapis status (5), tombol
beranda kembali menunjuk satu item (1).

Satu **cacat uji** ikut diperbaiki: `labelKelas()` tidak tersedia di
lingkungan jsdom sehingga layarnya melempar dan jatuh ke `.catch`.
Helper aslinya kini dimuat dari `js_core`, bukan di-stub — men-stub-nya
akan menyembunyikan justru cacat yang dijaga §6.2 no. 30.


---

## 🔴 Anggota kelompok yang keluar kelas (v1.7.3)

Ditemukan saat audit ketiga. Keanggotaan kelompok disimpan sebagai
JSON larik `user_id` — itu **salinan, bukan relasi**.
`Kelas.keluarkan()` hanya menyetel `enrollment.status = 'keluar'` dan
tidak pernah menyentuh sheet `kelompok`.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Kelompok.gs` | 🔴 **Wajib** | `_muridAktif()` `_anggotaAktif()`; penyaringan di `_tulisProgresAnggota()`; `daftar()` menandai; pesan galat menyebut nama |
| `js_kelompok.html` | 🔴 **Wajib** | penanda anggota keluar, peringatan ketua buntu, penanda di panel Ubah |
| `css.html` | 🔴 **Wajib** | `.pil-keluar` |
| `Code.gs` | 🟡 | versi `1.7.3` + 2 penanda (total **44**) |

### Yang rusak

Murid yang sudah keluar/pindah kelas tetap dianggap anggota:

```
ketua mengumpulkan → murid yang SUDAH KELUAR ikut menerima progress
guru menilai       → ia ikut menerima NILAI 85
guru menilai       → ia dikirimi notifikasi "Nilai Anda: 85"
                     untuk kelas yang tidak lagi ia lihat
```

Nilai menempel pada orang yang bukan lagi murid kelas itu.

Kasus paling buntu: **ketua** yang dikeluarkan. Tidak ada seorang pun
yang bisa mengumpulkan, dan pesan galatnya dulu hanya berbunyi
*"1 orang bukan murid aktif kelas ini"* — tanpa menyebut siapa maupun
cara membetulkannya. Guru menekan Simpan berulang kali tanpa tahu
sebabnya.

### Perbaikan

Penyaringan diletakkan **di dalam `_tulisProgresAnggota()`**, satu
titik yang dilewati kelima jalur (kumpul, batal, nilai, hapus).
Menambal per pemanggil berarti jalur ke-enam nanti pasti terlewat —
itu persis pola bug v1.0.1 (lima jalur tulis kebobolan).

Anggota yang keluar **tidak dihapus diam-diam** dari kelompok. Ia
tetap ditampilkan dengan penanda "keluar kelas", karena menghapusnya
otomatis membuat jumlah anggota berubah sendiri tanpa jejak — guru
tidak akan tahu susunannya perlu dibenahi.

Payload `daftar()` bertambah: `anggota[].keluar`, `jml_aktif`,
`ketua_keluar`. Kartu kelompok memperingatkan dua tingkat:

- **ketua keluar** → kotak merah, "Kelompok ini tidak dapat
  mengumpulkan tugas. Tekan Ubah, lepas centang namanya, lalu tunjuk
  ketua baru."
- **anggota biasa keluar** → catatan "N anggota sudah keluar dari
  kelas dan tidak lagi menerima nilai."

Pesan penolakan kini menyebut **nama**: *"Murid DA bukan lagi murid
aktif kelas ini. Hapus centangnya untuk mengeluarkannya dari
kelompok."*

### Berkas uji

`test/run53-anggota-keluar.js` BARU — **39 poin, 8 bagian**.
Dibuktikan MERAH pada 5 cabang: progres tanpa penyaringan (4 poin),
`daftar()` tanpa penandaan (2), pesan galat hanya menghitung (2),
`.pil-keluar` kelas yatim (2), UI tanpa peringatan ketua (1).


---

## Pratinjau keadaan tepi + 3 cacat uji (v1.7.4)

Tidak ada bug aplikasi di sini. Yang diperbaiki adalah **alat
verifikasinya sendiri** — dan salah satunya sempat menutupi
ketidakcocokan sungguhan.

### Berkas yang perlu disalin ulang

**Tidak ada.** Seluruh perubahan ada di `test/` dan `docs/`.

### Pratinjau memperagakan keadaan tepi

`pratinjau-kelompok.html` sebelumnya hanya berisi kelompok normal,
sehingga penanda v1.7.3 tidak pernah terlihat. Ditambah dua kelompok
contoh:

- **Tim Pengkabelan** — satu anggota biasa keluar kelas
- **Tim Wireless** — KETUA keluar kelas, kelompok buntu

Panel Ubah kini memotret Tim Wireless, bukan kelompok normal: di
situlah penandanya muncul dan di situlah guru paling butuh panduan.

### Cacat uji 1 — pemeriksaan yang mustahil merah

Pola `return kondisi ? true : 'keterangan'` dipakai di **5 tempat, 3
berkas**. String non-kosong itu **truthy**, jadi ujinya hijau justru
saat gagal.

Terbukti nyata: penjaga konsistensi `jml_aktif` tidak menggigit sama
sekali saat data pratinjau sengaja dirusak.

Diperbaiki di helper `B()`, bukan di tiap pemanggil — hanya `true`
telanjang yang dianggap lulus; string diperlakukan sebagai kegagalan
berikut keterangannya. Kini jadi **KONVENSI §6.2 no. 34**.

### Cacat uji 2 — regex menangkap nama yang memuatnya

`/keluar:\s*true/` ikut mencocokkan `ketua_keluar: true`. Muncul
**dua kali** dalam satu berkas: sekali menuduh data contoh yang
sebenarnya benar, sekali membuat penjaga tidak menggigit.

Diperbaiki dengan `(?<!ketua_)`, dan regex-nya kini **diuji sendiri**
terhadap contoh yang memuat kedua nama. Jadi **§6.2 no. 35**.

### Cacat uji 3 — data pratinjau tidak terikat backend

§6.2 no. 32 mewajibkan pratinjau memakai jalur logika yang sama,
tetapi DATA-nya ditulis tangan. Bila backend menambah medan,
pratinjaunya tetap tampak benar sementara aplikasi menampilkan
`undefined`.

Bagian G2 baru membandingkan `Object.keys()` payload
`Kelompok.daftar()` sungguhan dengan kunci di berkas pembuat
pratinjau, **dua arah** — medan backend yang belum dicontohkan, dan
medan karangan yang tidak pernah dikirim. Jadi **§6.2 no. 36**.

### Pelajaran pembuktian merah

Ketiga cacat ini lolos padahal aturan "setiap uji baru wajib
dibuktikan bisa MERAH" sudah dijalankan — pembuktiannya menyasar
**cabang lain**. Pembuktian merah harus mengenai cabang yang persis
diuji, bukan sekadar "ada yang merah". Ditambahkan ke §6.2 no. 34.

`run53` kini **49 poin**.


---

## 🔴 `undefined` di layar untuk tugas kelompok (v1.7.5)

**Dilaporkan guru.** Membuat tugas kelompok, lalu yang muncul di layar
`undefined`.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_nav.html` | 🔴 **Wajib** | `IKON_ITEM` + `tugas_kelompok`; 2 rantai navigasi |
| `js_belajar.html` | 🔴 **Wajib** | peta ikon & nama kartu murid; rantai klik item |
| `js_kelompok.html` | 🔴 **Wajib** | rute murid `tugas-kelompok` didaftarkan |
| `Code.gs` | 🔴 **Wajib** | **`ujiTahap13()` BARU** · versi `1.7.5` · 3 penanda (total **47**) |

### Sebabnya

Menambah nilai enum `tipe` mengharuskan **semua** peta tampilan
diperbarui. Peta itu tersebar di empat berkas dan tidak ada yang
saling mengingatkan. v1.7.0 hanya memperbarui `js_editor`.

Enam titik tertinggal:

```
js_nav     IKON_ITEM[i.tipe]      → undefined        (sidebar)
js_nav     bukaItem()  rantai if  → klik tidak berbuat apa-apa
js_nav     navKe()     rantai if  → tombol Berikutnya buntu
js_belajar peta ikon              → '📌'
js_belajar peta nama              → 'tugas_kelompok' (enum mentah)
js_belajar rantai klik            → klik tidak berbuat apa-apa
```

Peta JavaScript mengembalikan `undefined` **diam-diam** untuk kunci
yang tidak ada — tanpa galat, tanpa jejak, langsung tampil di layar.

Bug ketujuh: rute murid `tugas-kelompok` ada di peta `ASAL` tetapi
tidak pernah didaftarkan. Murid yang menekan notifikasi penilaian
mendapat pesan *"berkas js_kelompok.html kemungkinan belum tersalin"* —
menyesatkan, sebab berkasnya ADA dan yang belum ada adalah layarnya.
Kini didaftarkan sebagai penampung jujur: *"Tugas Kelompok belum
tersedia."*

### Kenapa 53 berkas uji tidak menangkapnya

Seluruh uji UI memeriksa **layar guru**. Tidak satu pun memeriksa
apakah peta tampilan memuat seluruh nilai enum.

`test/run54-enum-tipe-ui.js` BARU — **27 poin**. Membaca daftar tipe
dari SATU sumber kebenaran (`var TIPE` di `Pertemuan.gs`), lalu
memaksa setiap peta memuat semuanya. Termasuk sapuan menyeluruh:
setiap literal `{ materi: … }` di berkas UI mana pun wajib lengkap —
jadi peta baru yang ditulis nanti otomatis ikut terjaga.

Menambah tipe ke-6 akan membuat berkas ini merah sampai seluruh UI
menyusul.

Dibuktikan MERAH pada 8 cabang.

### `ujiTahap13()` — diagnostik lapangan

**53 poin, 9 bagian**, aman diulang (dibuktikan 3× berturut-turut).
Menutup §6.2 no. 25: versi yang mengubah SKEMA wajib punya diagnostik
lapangannya sendiri.

Bagian B menguji persis kegagalan yang dilaporkan: apakah item
bertipe `tugas_kelompok` **bisa disimpan**. Bila enum belum
dimigrasikan, Log langsung menulis `JALANKAN migrasiStruktur()`.

`run44-diagnostik-ulang` bertambah menjadi 3× jalan + pemeriksaan sisa
data. Dibuktikan merah dengan menyisipkan ulang pola bug v1.5.3
(bersih-bersih tidak menghapus `users`).

`src/CARA-PASANG-TUGAS-KELOMPOK.md` BARU — panduan dari nol, termasuk
penjelasan mengapa migrasi diperlukan.


---

## Generator AI untuk LKPD & Tugas Kelompok (v1.7.6)

**Permintaan guru.** Sampai v1.7.5 hanya tipe `materi` punya tombol
✨ Generate. LKPD dan tugas kelompok tidak.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Ai.gs` | 🔴 **Wajib** | `generateKegiatan()` BARU + `SKEMA_KEGIATAN` |
| `Code.gs` | 🔴 **Wajib** | API `generateKegiatanAI` · versi `1.7.6` · 3 penanda (total **50**) |
| `js_editor.html` | 🔴 **Wajib** | `BISA_AI`, panel menyesuaikan tipe, `jalankanGenerateKegiatan()` |
| `v_editor.html` | 🔴 **Wajib** | `id` pada judul & bantuan panel AI |

> **Tidak perlu migrasi.** Hasilnya masuk kolom `konten` yang sudah
> ada — sama seperti LKPD yang ditulis tangan.

### Kesepakatan dengan guru

| Topik | Keputusan |
|---|---|
| Struktur LKPD | **Lengkap**: Tujuan · Alat & Bahan · Langkah Kerja · Pertanyaan/Tugas · Kesimpulan |
| Rubrik penilaian | **Tidak dibuat** — guru menilai dengan pertimbangannya sendiri |
| Pembeda tugas kelompok | **Diskusi & keputusan bersama**, BUKAN pembagian peran formal |

Keputusan ketiga ditulis eksplisit di prompt sebagai larangan:
*"JANGAN membagi peran formal (koordinator, pencatat, dsb.) — seluruh
anggota memikirkan seluruh persoalan."* Pembagian peran cenderung
membuat anggota bekerja sendiri-sendiri, dan itu justru menghilangkan
inti kerja kelompok.

### Satu fungsi untuk dua tipe

`generateKegiatan()` melayani `lkpd` dan `tugas_kelompok`. Strukturnya
sama; yang berbeda hanya cara mengerjakannya. Memisahkannya jadi dua
fungsi berarti dua prompt yang harus dijaga selaras — dan pengalaman
v1.6.5 (dua fungsi impor, hanya satu yang diperbaiki) menunjukkan
cabang kembar seperti itu selalu ada yang tertinggal.

Refleksi **tidak** ikut: `konten`-nya menyimpan JSON pertanyaan, bukan
HTML.

### Konteks yang dibaca AI

- Tujuan Pembelajaran item (wajib — ditolak bila kosong)
- **Judul materi di pertemuan yang sama**, dengan perintah tegas
  bahwa kegiatan wajib melatih materi itu, bukan topik lepas
- Kompetensi keahlian, CP, dan catatan gaya kelas
- Untuk tugas kelompok: **jumlah anggota sungguhan** bila kelompok
  sudah dibentuk. Bila belum, asumsi 3–4 orang **disebutkan terbuka**
  di dalam prompt — bukan angka karangan yang disembunyikan.

### Penyimpangan AI dilaporkan, bukan didiamkan

Sesuai §6.2 no. 26, hasil dinormalisasi tetapi penyimpangannya
ditampilkan ke guru:

- **bagian yang hilang** — bila AI melewatkan Langkah Kerja atau
  Alat & Bahan, guru diberi tahu sebelum menerbitkan
- **pemisah `<!--bagian-->`** — milik tipe Materi; bila lolos, murid
  melihat komentar HTML mentah. Dibuang, lalu dilaporkan.
- tabel Markdown tetap diubah jadi `<table>` (jaring pengaman v1.5.6)

Tombol juga **dikelabukan bila Tujuan Pembelajaran kosong**, beserta
alasannya — server pasti menolak, jadi guru tidak perlu menunggu
panggilan yang sia-sia.

### Berkas uji

`test/run55-ai-kegiatan.js` BARU — **71 poin, 11 bagian**.

Prompt diperlakukan sebagai **kontrak yang diuji**, bukan sekadar
teks. Alasannya: prompt tidak pernah gagal keras. Bila satu instruksi
hilang, hasilnya tetap "masuk akal" — hanya salah bentuk, dan baru
ketahuan setelah dipakai murid.

Dibuktikan MERAH pada 5 cabang: larangan rubrik hilang, larangan
pembagian peran hilang, penyimpangan tidak dilaporkan, ukuran kelompok
nyata diabaikan, panel AI tidak menyala untuk LKPD.

**Satu cacat uji** ikut diperbaiki: sapuan peta tipe di `run54` ikut
menangkap `BISA_AI` — padahal itu penanda kemampuan AI, bukan peta
tampilan, dan refleksi/quiz memang sengaja tidak ada di situ.
Penyaringnya kini mengenali nilai penanda (`materi: 1`), dan run54
dibuktikan masih menggigit setelah perubahan itu.


---

## Tahap 3 — layar murid Tugas Kelompok (v1.7.7)

Layar terakhir yang belum ada. Backend sudah siap sejak v1.7.0;
sampai v1.7.6 murid hanya melihat placeholder *"belum tersedia"*.
**Fitur Tugas Kelompok kini utuh.**

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_kelompok.html` | 🔴 **Wajib** | layar murid `gambarTugasKelompok()` menggantikan placeholder |
| `Kelompok.gs` | 🔴 **Wajib** | payload `buka()` +`pertemuan_judul` +`maks_link` +`terkunci` +`bisa_batalkan`; payload "belum" dilengkapi |
| `Code.gs` | 🔴 **Wajib** | `ujiTahap13()` 53 → **60 poin** · versi `1.7.7` · 2 penanda (total **52**) |

> **Tidak perlu migrasi.** Tidak ada perubahan skema.

### Tiga keadaan yang mudah tertukar

| Peran | Yang dilihat |
|---|---|
| **Ketua** | kotak tautan + Simpan Draf + Kumpulkan |
| **Anggota** | TANPA kotak isian; diberi tahu siapa ketuanya |
| **Tanpa kelompok** | pesan + isi kegiatan tetap bisa dibaca |

Anggota biasa **tidak diberi kotak isian sama sekali** — bukan
sekadar dikelabukan. Server pasti menolaknya; memberi kotak berarti
murid mengetik, menekan Kumpulkan, lalu kehilangan pekerjaannya tanpa
tahu sebabnya. Ia diberi tahu nama ketuanya dan ditegaskan bahwa ia
**tetap ikut menerima nilai**.

Murid tanpa kelompok tetap boleh membaca isi kegiatan — ia bisa
bersiap sambil menunggu dimasukkan.

### Nilai dua tingkat ditampilkan jujur

Nilai kelompok dan nilai murid bisa berbeda karena penyesuaian guru.
Menampilkan satu angka saja membuat murid mengira gurunya salah
menilai.

```
Nilai kelompok: 85 · nilai Anda disesuaikan guru menjadi 70
```

Bila sama, yang tertulis: *"berlaku sama untuk seluruh anggota"*.
Angka besar selalu memakai nilai **murid itu**.

### Keadaan tombol dihitung SERVER

`terkunci`, `bisa_batalkan`, dan `maks_link` kini datang dari server,
bukan dihitung ulang di klien. Aturannya sama dengan yang ditegakkan
`simpanDraf()` dan `batalkan()`; dua salinan aturan selalu berakhir
berbeda — pola bug v1.4.3.

Payload saat belum ada pengumpulan juga dilengkapi seluruh medannya.
Tanpa itu layarnya menampilkan `undefined`, persis kegagalan lapangan
v1.7.5.

### Berkas uji

`test/run56-ui-murid-kelompok.js` BARU — **92 poin, 11 bagian**, di
atas DOM sungguhan (jsdom).

Dibuktikan MERAH pada 5 cabang: anggota diberi kotak isian, hanya
nilai kelompok ditampilkan, draf tidak disimpan sebelum kumpul (pola
v1.4.3), payload "belum" tidak lengkap, batas tautan ditulis ulang di
klien.

`ujiTahap13()` bertambah 7 poin untuk medan payload layar murid —
dibuktikan stabil 3× jalan berturut-turut.

`run54` disesuaikan: penjaga placeholder diganti penjaga layar
sungguhan. `pratinjau-kelompok.html` bertambah 3 bagian (ketua,
anggota, sudah dinilai).

### Sisa pekerjaan

Tidak ada. Tugas Kelompok lengkap: guru menyusun & menilai, AI
membantu isi kegiatan, murid mengerjakan.


---

## ✅ Verifikasi lapangan v1.7.x — `ujiTahap13()` 60/60

Dijalankan guru di Apps Script sungguhan, **135 detik, tanpa satu pun
kegagalan pada percobaan pertama.**

```
=== UJI TAHAP 13 — TUGAS KELOMPOK (v1.7.7) ===
A. Skema & modul            13/13   sheet, kolom, prefix KLP, antreanSemua
B. Membuat item              2/2    ✅ item bertipe tugas_kelompok BISA disimpan
C. Payload layar guru        8/8    jml_aktif, ketua_keluar, penanda keluar
D. Alur murid               13/13   bukan ketua ditolak · SELURUH anggota menunggu
E. Tidak bocor ke LKPD       5/5    antrean 0 entri · Lkpd.nilai() MENOLAK
F. Nilai dua tingkat         7/7    85/85 · disesuaikan 70 · murid lihat 85/70
G. Rekap                     3/3    terbaca lewat kelompok, bukan pemilik submission
H. Anggota keluar kelas      4/4    jml_aktif 2/3 · penolakan menyebut nama
I. Penghapusan berantai      4/4    kelompok, pengumpulan, progres ikut terbuang

  LOLOS: 60   GAGAL: 0   (135 detik)
✅ Tugas kelompok berfungsi di Apps Script.
```

### Yang terbukti sekaligus

Ini rantai terpanjang yang pernah diverifikasi dalam satu jalan:
skema baru (v1.7.0), pemisahan dari LKPD (v1.7.1), antrean gabungan
(v1.7.2), anggota keluar kelas (v1.7.3), enum tipe di seluruh UI
(v1.7.5), dan payload layar murid (v1.7.7).

Termasuk **`Db.bacaKolom()` v1.7.1** — perbaikan yang menyentuh
seluruh aplikasi, bukan hanya tugas kelompok. Bagian E membuktikannya
di lapangan: `beranda kelompok=1 lkpd=0`, angka yang sebelum
perbaikan selalu `0` untuk keduanya.

### Kenapa kali ini mulus

Dua verifikasi lapangan sebelumnya gagal walau uji lokal hijau:

| Versi | Hasil lapangan pertama | Sebab |
|---|---|---|
| v1.5.2 | **14 lolos / 1 gagal** | mock tidak menegakkan aturan sel gabungan Sheets |
| v1.5.3 | **2 lolos / 1 gagal** | bersih-bersih diagnostik tidak diuji berulang |

Keduanya melahirkan aturan §6.2 no. 23 (mock wajib menegakkan aturan
penolakan API Apps Script) dan no. 24 (diagnostik wajib diuji
dijalankan BERULANG). `ujiTahap13()` dibangun mengikuti keduanya sejak
awal — dan hasilnya 60/60 tanpa perbaikan.

Catatan waktu: 135 detik untuk ±90 operasi tulis. Bagian C sendiri
memakan 30 detik karena membuat 4 murid uji berturut-turut.


---

## Buka Kunci untuk murid tertentu (v1.8.0)

`unlockPaksa()` sudah ada sejak **Tahap 5** tetapi tidak pernah punya
tombol — API yatim selama sepuluh versi. v1.8.0 melengkapinya menjadi
fitur utuh, dan di sepanjang jalan menemukan **dua bug perilaku** yang
membuat fitur itu sebenarnya tidak berfungsi.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Belajar.gs` | 🔴 **Wajib** | 4 fungsi baru + **2 perbaikan penjaga unlock** |
| `js_kunci.html` | 🔴 **BARU** | buat berkas HTML bernama `js_kunci` |
| `index.html` | 🔴 **Wajib** | `include('js_kunci')` |
| `js_editor.html` | 🔴 **Wajib** | tombol 🔓 pada baris item (pintu ITEM) |
| `js_kelola.html` | 🔴 **Wajib** | tombol 🔓 pada daftar murid (pintu MURID) |
| `Code.gs` | 🔴 **Wajib** | 4 API · **`ujiTahap14()` BARU** · versi `1.8.0` · 5 penanda (total **57**) |

> **Tidak perlu migrasi.** Kolom `dibuka_paksa` & `alasan_paksa` sudah
> ada di sheet `progress` sejak Tahap 5.

### Kesepakatan guru

| Topik | Keputusan |
|---|---|
| Pintu masuk | **Dua arah** — dari murid DAN dari item |
| Pembatalan | **Perlu** tombol Kunci Ulang |
| Massal | **Perlu** centang beberapa murid sekaligus |

Ketiganya pilihan maksimal, sehingga pekerjaannya menjadi 4 fungsi
backend baru — bukan sekadar tombol seperti perkiraan awal.

### 🔴 Bug 1 — membuka kunci tidak berpengaruh apa pun

Penjaga pertemuan di `detailPertemuan()` dan `bukaMateri()` tidak
melihat `dibuka_paksa`. Akibatnya membuka item di pertemuan yang belum
terbuka **tidak berpengaruh sama sekali**: guru menekan tombol, murid
tetap ditolak, dan tidak ada yang tahu sebabnya.

Justru itulah kasus tersering — murid tertinggal SATU PERTEMUAN penuh,
jadi pertemuannya pasti masih terkunci.

Bug ini sudah ada sejak Tahap 5 dan tidak pernah terlihat karena
API-nya tidak pernah dipakai.

### 🔴 Bug 2 — membuka satu item membuka SELURUH pertemuan

Muncul saat memperbaiki bug 1. Setelah pertemuan boleh dibuka,
`_statusItem()` tidak tahu bahwa pertemuannya sendiri masih terkunci —
sehingga aturan biasa berlaku dan seluruh item ikut terbuka.

Guru bermaksud membuka satu LKPD susulan; yang terjadi murid mendapat
akses ke seluruh pertemuan. Diperbaiki dengan penanda
`pertemuan.terkunci` pada ketiga pemanggil `_statusItem()`.

### Yang dijaga

**Kunci Ulang tidak menghapus pekerjaan.** Nilai yang sudah masuk itu
sah; yang dicabut hanya penandanya.

**Gagal sebagian tidak membatalkan sisanya.** Satu id basi (murid
sudah keluar) tidak boleh menggagalkan pembukaan untuk murid lain.
Kegagalannya dilaporkan lewat dialog, bukan didiamkan.

**Perhitungan unlock tidak diduplikasi.** `kunciMurid()` dan
`kunciItem()` memakai `indeksKelas()` — jalur yang sama dengan layar
murid. Uji membuktikan kedua pintu masuk memberi jawaban identik.

### Berkas uji

`test/run57-buka-kunci.js` BARU — **85 poin, 11 bagian**. Dibuktikan
MERAH pada 5 cabang.

`ujiTahap14()` BARU — **34 poin**, stabil 3× jalan berturut-turut.
Wajib karena v1.8.0 mengubah **perilaku unlock**, jalur yang dipakai
seluruh tipe item (§6.2 no. 25).

### 🔴 Cacat uji — §6.2 no. 34 belum tuntas

v1.7.4 memperbaiki pola `return kondisi ? true : 'keterangan'` di
**3 berkas**. Ternyata pola yang sama masih ada di **20 berkas
lain** — string non-kosong itu truthy, jadi ujinya hijau justru saat
gagal.

Terbukti nyata di sini: penjaga ES5 baru saya tidak menggigit sama
sekali saat polanya sengaja dirusak. Seluruh 20 berkas kini
diperbaiki, dan langsung menangkap satu positif palsu yang sebelumnya
tersembunyi.

Dua cacat uji lain ikut diperbaiki:

- **uji crash alih-alih melapor merah.** Panggilan telanjang di
  `run57` membuat seluruh berkas mati saat bug disisipkan — tidak ada
  satu pun kegagalan yang terbaca. Kini dibungkus `pesanGagal()`.
- **penjaga yang mustahil diuji.** Menyisipkan sintaks ES6 sungguhan
  membuat `eval(Code.gs)` gagal duluan. Polanya kini diuji **langsung
  terhadap contoh**, termasuk yang tidak boleh cocok (`>=`, panah
  dalam teks, backtick di dalam string).


---

## ✅ Verifikasi lapangan v1.8.0 — `ujiTahap14()` 34/34

Dijalankan guru di Apps Script sungguhan, **106 detik, tanpa satu pun
kegagalan pada percobaan pertama.**

```
=== UJI TAHAP 14 — BUKA KUNCI (v1.8.0) ===
A. Modul & API              7/7   4 fungsi baru + kolom dibuka_paksa
B. Menyiapkan panggung      1/1   kelas berurut-ketat, 2 pertemuan, 3 murid
C. Daftar item terkunci     5/5   dua pintu masuk SEPAKAT
D. Membuka massal           6/6   duplikat dibuang · id basi tidak membatalkan
E. Menembus kunci pertemuan 6/6   ← inti v1.8.0
F. Membatalkan pembukaan    5/5   progres TIDAK dihapus
G. Penjagaan masukan        4/4   alasan wajib · murid luar kelas ditolak

  LOLOS: 34   GAGAL: 0   (106 detik)
✅ Buka Kunci berfungsi di Apps Script.
```

### Bagian E — dua bug yang terbukti tertutup

Inilah yang paling perlu dibuktikan, sebab keduanya baru ditemukan
saat membangun fiturnya:

```
✅ pertemuan 2 mula-mula terkunci
✅ pertemuan terkunci kini boleh dibuka        ← bug 1 tertutup
✅ LKPD-nya benar-benar terbuka
✅ item LAIN di pertemuan itu TETAP terkunci   ← bug 2 tertutup
✅ murid dapat MEMBUKA LKPD-nya
✅ jalur bukaMateri() juga menembus
```

Baris ketiga dan keempat saling menjaga: membuka **cukup longgar**
untuk menembus kunci pertemuan, tetapi **cukup ketat** sehingga item
lain tidak ikut terbuka. Salah satu saja meleset, fiturnya rusak ke
arah yang berlawanan.

### Catatan

`unlockPaksa()` ada sejak Tahap 5 dan **tidak pernah benar-benar
berfungsi** — bug 1 membuatnya sia-sia untuk kasus tersering.
Verifikasi ini adalah pertama kalinya API itu terbukti bekerja di
Apps Script sungguhan, sepuluh versi setelah ditulis.

Pelajarannya: **API tanpa tombol tidak pernah teruji.** Sepuluh versi
uji lokal hijau tidak menangkapnya, karena tidak ada satu pun uji yang
memakai jalur itu sampai ujung.

Waktu 106 detik untuk ±60 operasi tulis. Bagian B sendiri 39 detik
(membuat kelas + 3 murid).


---

## Generator AI untuk Refleksi (v1.8.1)

Tipe terakhir yang belum punya tombol ✨. Setelah ini **keempat tipe
item** — Materi, LKPD, Tugas Kelompok, Refleksi — semuanya bisa
disusun AI.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Ai.gs` | 🔴 **Wajib** | `generateRefleksi()` + `SKEMA_REFLEKSI` |
| `Code.gs` | 🔴 **Wajib** | API `generateRefleksiAI` · versi `1.8.1` · 2 penanda (total **59**) |
| `js_editor.html` | 🔴 **Wajib** | `BISA_AI` + refleksi · `jalankanGenerateRefleksi()` |

> **Tidak perlu migrasi.** Hasilnya masuk `item.konten` yang sudah ada.

### Kesepakatan guru

| Topik | Keputusan |
|---|---|
| Arah pertanyaan | **Kesadaran belajar** (Permendikdasmen 13/2025, §6.5) — bukan penguasaan materi |
| Jumlah | **3 pertanyaan** sekali Generate |

Arah itu diterjemahkan menjadi larangan eksplisit di prompt, sebab
dua hal paling mudah dilanggar model:

```
DILARANG KERAS:
  - pertanyaan yang punya jawaban BENAR/SALAH — itu quiz
  - pertanyaan ya/tidak — dijawab satu kata, tidak menggali
  - meminta murid mengulang definisi atau menyebutkan langkah
  - menanyakan nilai, peringkat, atau perbandingan dengan teman
```

Larangan pertama menegakkan §6.5: **refleksi bukan penilaian**. Murid
yang jujur menulis "masih bingung" sedang membantu gurunya, bukan
sedang gagal.

### Yang membuatnya berbeda dari tiga generator lain

**Keluarannya JSON, bukan HTML.** `item.konten` pada tipe refleksi
menyimpan larik pertanyaan, dan editor kontennya memang disembunyikan.
Karena itu `jalankanGenerateRefleksi()` mengisi **panel penyusun**,
bukan editor.

**Hasil AI MENAMBAH, bukan menimpa.** Guru yang sudah menulis satu-dua
pertanyaan sendiri tidak boleh kehilangannya. Sisa kuota dihitung
sebelum meminta (`6 − yang sudah ada`), dan tombolnya berubah menjadi
**✨ Tambah Lagi**.

**Tujuan Pembelajaran tidak diwajibkan.** Berbeda dari LKPD: bahan
utamanya adalah **isi pertemuan** — materi, LKPD, dan quiz yang baru
dipelajari murid. Item refleksi sengaja tidak menyebut dirinya sendiri
dalam daftar itu.

### Penyimpangan dilaporkan, bukan didiamkan

Sesuai §6.2 no. 26:

| Penyimpangan | Tindakan |
|---|---|
| pertanyaan ya/tidak | **dilaporkan**, tidak dibuang — guru yang menilai |
| jumlah meleset | dilaporkan |
| melebihi 6 | dipotong + dilaporkan |
| pertanyaan terakhir wajib | dijadikan opsional + dilaporkan |
| AI menomori sendiri ("1. …") | dibuang diam-diam — panel sudah menomorinya |

Deteksi ya/tidak memakai kata pembuka (`apakah`, `sudahkah`,
`bisakah`, …). Sengaja **tidak** membuang pertanyaannya: kadang
pertanyaan tertutup masih berguna sebagai pembuka, dan gurulah yang
tahu konteks kelasnya.

### Berkas uji

`test/run58-ai-refleksi.js` BARU — **75 poin, 10 bagian**.

Bagian H menguji hal yang mudah terlewat: hasil AI harus **bertahan
utuh** lewat `Refleksi.susunPertanyaan()` → `bacaPertanyaan()`. Bila
bentuknya menyimpang, guru menekan Simpan dan pertanyaannya hilang.
Batas 6 juga diperiksa selaras di tiga tempat: `Ai.gs`, `Refleksi.gs`,
dan `js_editor.html`.

Dibuktikan MERAH pada 5 cabang: arah kesadaran belajar hilang,
larangan dihapus, penyimpangan didiamkan, hasil menimpa pekerjaan
guru, nomor bawaan AI tidak dibuang.

`run55` disesuaikan — penjaga lama "refleksi TIDAK ikut menyala"
diganti penjaga jalur tersendiri.


---

## Kerangka Semester dengan AI (v1.8.2)

`generateKerangka()` + `terapkanKerangka()` ditulis di **Tahap 7
(v0.9.0)** dan tidak pernah punya tombol — API yatim selama sembilan
versi, pola yang sama persis dengan `unlockPaksa()`.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_kerangka.html` | 🔴 **BARU** | buat berkas HTML bernama `js_kerangka` |
| `index.html` | 🔴 **Wajib** | `include('js_kerangka')` |
| `js_editor.html` | 🔴 **Wajib** | tombol ✨ Kerangka AI di layar struktur kelas |
| `css.html` | 🔴 **Wajib** | gaya baris usulan `.krg-*` |
| `Ai.gs` | 🟡 | membuang kode mati penomoran |
| `Code.gs` | 🟡 | versi `1.8.2` + 5 penanda (total **64**) |

> **Tidak perlu migrasi.**

### Alur dua langkah — disengaja

```
1. AI mengusulkan N pertemuan  → guru MENINJAU & MENYUNTING
2. guru menekan Terapkan       → pertemuan + item dibuat
```

Langkah 2 adalah **operasi terbesar di seluruh aplikasi**: satu tekan
bisa membuat 15 pertemuan dan 50-an item. Tidak ada tombol urungkan;
yang tidak jadi dipakai harus dihapus satu per satu.

Karena itu tabel usulannya **bisa disunting** — judul, tujuan, jumlah
materi, dan penanda LKPD/Quiz. Menyuntingnya sekarang jauh lebih murah
daripada setelah 15 pertemuan terlanjur terbuat.

Sebelum menerapkan, guru melihat ringkasan **"N pertemuan · M item
akan dibuat"**, dan konfirmasinya menyebut dua hal: hasilnya
**draf** (belum terlihat murid) dan tindakannya **tidak dapat
diurungkan sekaligus**.

### Yang diperiksa sampai ujung

Uji lama (`run21`) hanya memeriksa angka kembalian: *"2 pertemuan
dibuat"*. Yang tidak pernah diperiksa: apakah pertemuan itu sampai ke
murid.

`run59` menelusurinya sampai habis — `mp_id` terisi (pertemuan yatim
tidak muncul di mana pun), tampil di struktur kelas guru, lalu
setelah diterbitkan **benar-benar terlihat murid** beserta seluruh
itemnya, dengan urut-ketat yang bekerja.

Hasilnya bersih. Berbeda dari `unlockPaksa()`, API ini ternyata
memang berfungsi sejak awal.

### Kode mati yang menyesatkan

Satu temuan: `terapkanKerangka()` menghitung `urutan: maks + i + 1`
dari seluruh kelas lalu mengirimkannya ke `Pertemuan.simpan()`.

Nilai itu **tidak pernah dipakai** — `Pertemuan.simpan()` menghitung
urutan sendiri, DALAM materi pokok. Rumus yang dikirim pun keliru
(per-kelas, bukan per-bab).

Perilakunya benar, jadi bukan bug. Tetapi kode mati yang tampak benar
lebih berbahaya daripada tidak ada: pembaca berikutnya akan mengira
penomoran ditangani di situ, lalu "memperbaikinya" ke arah yang salah.
Dibuang, dan dijaga uji agar tidak kembali.

### Berkas uji

`test/run59-kerangka-ai.js` BARU — **71 poin, 9 bagian**. Dibuktikan
MERAH pada 5 cabang: suntingan tidak dibaca balik, konfirmasi tanpa
peringatan, `mp_id` tidak diwariskan, hasil langsung publish, dan
kode mati penomoran kembali.

**Satu cacat uji** ikut diperbaiki: panggilan telanjang di bagian E,
G, dan H membuat seluruh berkas **crash** saat bug disisipkan —
merah yang tidak terbaca sama saja dengan tidak menggigit. Kini
dibungkus `pesanGagal()`, pola yang sama seperti perbaikan `run57`.


---

## 🔴 "Capaian Pembelajaran belum diisi" padahal sudah (v1.8.3)

**Dilaporkan guru**, sehari setelah v1.8.2 dipakai.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `MateriPokok.gs` | 🔴 **Wajib** | payload `struktur()` membawa penanda `ada_capaian` |
| `js_kerangka.html` | 🔴 **Wajib** | penjaga memakai `ada_capaian`, bukan medan yang tak dikirim |
| `Code.gs` | 🟡 | versi `1.8.3` + 1 penanda (total **65**) |

### Sebabnya

`MateriPokok.struktur()` hanya mengirim tiga medan:

```js
kelas: { kelas_id, nama_kelas, mapel }
```

Panel Kerangka AI memeriksa `KRG.kelas.capaian_pembelajaran` — medan
yang **tidak pernah dikirim**. Nilainya selalu `undefined`, tanpa
galat, tanpa jejak. Tombolnya mati selamanya.

**Server menerima, klien memblokir.** Backend `generateKerangka()`
sebenarnya siap: CP tersimpan benar di sheet, dan bila dipanggil
langsung ia berjalan tanpa keluhan.

### Perbaikan

Payload kini membawa **penanda**, bukan isinya:

```js
ada_capaian: String(kelas.capaian_pembelajaran || '').trim() !== ''
```

Penanda, bukan teksnya — CP bisa ribuan karakter dan payload ini
dimuat **setiap kali** layar struktur kelas dibuka.

Klien menerima bentuk lama juga, supaya panel tidak memblokir guru
bila `MateriPokok.gs` belum tersalin.

### Aturan baru: §6.2 no. 39

**Penjaga di klien wajib memakai medan yang benar-benar ada di
payload**, dan penjaga klien-server harus **diuji sepakat**:

```
server menolak  → klien memblokir
server menerima → klien mengizinkan
```

Kerabat dekat no. 37 (API tanpa tombol). Sama-sama lolos karena tidak
ada uji yang menelusuri satu jalur dari ujung ke ujung. Bedanya di
sini backend-nya **benar** — yang salah justru penjaga yang saya
tambahkan untuk "membantu" guru.

Saya juga memeriksa enam medan kelas lain yang dibaca UI
(`catatan_gaya`, `alokasi_jp`, `kompetensi_keahlian`, `fase`,
`tingkat`, `jenjang`). Semuanya dipakai `js_kelola` yang memuat
payload berbeda — tidak ada kebocoran serupa.

### Berkas uji

`run59` bertambah bagian H2 — **77 poin**. Dibuktikan MERAH dengan
mengembalikan payload ke bentuk lama (4 poin gagal) dan dengan
membuat klien memeriksa medan yang tak dikirim (1 poin).


---

## 🔴 Kerangka AI tidak mengelompokkan ke Materi Pokok (v1.8.4)

**Dilaporkan guru** — keluhan kedua atas fitur yang sama.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Ai.gs` | 🔴 **Wajib** | medan `bab` di skema & prompt · `mpUntuk()` membuat Materi Pokok |
| `js_kerangka.html` | 🔴 **Wajib** | kolom bab bisa disunting · pilihan penempatan |
| `js_editor.html` | 🔴 **Wajib** | mengirim daftar bab yang sudah ada |
| `css.html` | 🔴 **Wajib** | `.krg-bab` |
| `Code.gs` | 🔴 **Wajib** | `ujiTahap15()` 28 → **36 poin** · versi `1.8.4` · 3 penanda (total **68**) |

> **Tidak perlu migrasi.**

### Sebabnya

`terapkanKerangka()` **tidak pernah membuat Materi Pokok**. Ia
memanggil `Pertemuan.simpan()` tanpa `mp_id`, lalu `_mpBawaan()`
melemparkan **seluruh** pertemuan ke bab pertama yang kebetulan ada:

```
📚 Materi Pokok 1 → 15 pertemuan   ← semuanya menumpuk
```

Uji lama memeriksa *"pertemuan tidak yatim"* — dan memang tidak
yatim, hanya **salah tempat**. Pemeriksaan yang benar tetapi terlalu
longgar.

### Perbaikan

**AI kini mengusulkan bab.** Medan `bab` diminta per-pertemuan, bukan
sebagai daftar terpisah: model jauh lebih taat mengelompokkan bila
tiap butir menyebut babnya sendiri, dan pemetaan "bab ke-N berisi
pertemuan mana" gampang meleset.

```
📚 Jaringan VLAN    → 3 pertemuan
📚 Routing          → 2 pertemuan
📚 NAT dan Gateway  → 1 pertemuan
```

**Bab dibuat sekali per judul unik**, lalu dipakai ulang. Judul yang
sama persis dengan bab yang sudah ada dipakai kembali (abaikan
besar-kecil huruf), sehingga menjalankan kerangka dua kali tidak
melahirkan bab kembar.

**Kolom bab bisa disunting** di tabel tinjau, sejajar dengan judul dan
tujuan. Ringkasan dan konfirmasi kini menyebut **jumlah bab** juga.

### Keputusan guru

| Topik | Keputusan |
|---|---|
| Penentu bab | **AI**, dengan judul yang bisa disunting guru |
| Kelas sudah punya bab | **Ditanyakan** — gabung ke bab yang ada, atau buat bab baru |

Pilihan kedua muncul sebagai dropdown, hanya bila kelas memang sudah
punya Materi Pokok. Menebak salah satunya berisiko: menggabung
merusak susunan yang sudah rapi, membuat bab baru bisa menghasilkan
bab kembar.

### Penyimpangan dilaporkan

Bila AI melewatkan medan `bab`, seluruhnya jatuh ke satu bab
cadangan — perilaku lama, **tetapi tidak didiamkan**. `bab_kosong`
memberi tahu guru mengapa hasilnya tidak terkelompok, lewat kotak
peringatan kuning.

Awalan nomor dari AI (`"Bab 1: VLAN"`) dibuang — sistem yang
menomori bab, dan tanpa ini muncul `"Bab 1: Bab 1: VLAN"` di layar.

### Berkas uji

`run59` bertambah bagian G2 & G3 — **103 poin**. `ujiTahap15()`
bertambah bagian D2 — **36 poin**, stabil 3× jalan.

Dibuktikan MERAH pada 3 cabang: `mp_id` tidak dikirim (7 poin gagal),
bab digandakan tiap kali (5), awalan nomor tidak dibuang (3).


---

## ⚡ Penerapan kerangka 16,5 → di bawah 3 detik/pertemuan (v1.8.5)

**Ditemukan `ujiTahap15()` di Apps Script sungguhan** — bukan oleh
mock, dan bukan oleh keluhan. Diagnostik yang mengukur waktu bekerja
persis seperti maksudnya.

```
8 pertemuan + 40 item  →  132 detik  (16,5 detik/pertemuan)
proyeksi 20 pertemuan  →  330 detik
batas eksekusi          →  360 detik      ← terlalu dekat
```

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Pertemuan.gs` | 🔴 **Wajib** | `simpanItem()` — pembacaan terarah, bukan seluruh sheet |
| `Code.gs` | 🟡 | `ujiTahap15()` melaporkan proyeksi lambat sebagai peringatan · versi `1.8.5` |

> **Tidak perlu migrasi.**

### Sebabnya bukan menulis, melainkan MEMBACA

`Pertemuan.simpanItem()` memanggil tiga pembacaan **penuh** per item:

| Panggilan | Yang dibaca |
|---|---|
| `Db.saring('item', …)` cek duplikat | SELURUH sheet `item`, termasuk kolom `konten` |
| `Db.saring('item', …)` hitung urutan | SELURUH sheet `item`, sekali lagi |
| `Db.cari('pertemuan', …)` | SELURUH sheet `pertemuan` |

Kolom `konten` bisa puluhan ribu karakter per baris. Makin banyak item
di kelas, makin lambat pembuatan item **berikutnya** — biayanya
kuadratik.

### Perbaikan

- dua `Db.saring()` → **satu** `Db.saringBaris()` dengan kolom
  eksplisit (`item_id`, `tipe`, `urutan`), hasilnya dipakai ulang
- `Db.cari('pertemuan')` → `Db.cariBarisCache()` yang mengingat nomor
  barisnya

Terukur pada 20 pertemuan + 100 item:

```
pembacaan penuh sheet `item`      : 56 → 0
pembacaan penuh sheet `pertemuan` : 100 → 0
biaya per item                     : TETAP, tidak naik saat kelas membesar
```

### Proyeksi lambat bukan kegagalan

`ujiTahap15()` sebelumnya menandai proyeksi >240 detik sebagai ❌.
Itu keliru: kecepatan bergantung ukuran spreadsheet guru, bukan
kebenaran kode. Kini dilaporkan sebagai **peringatan yang tetap
lolos**, beserta angka aman dan saran memeriksa versi `Pertemuan.gs`.

### Berkas uji

`test/perf11-kerangka.js` BARU — **15 poin, 4 bagian**. Menghitung
pembacaan penuh dengan menyisipkan penghitung ke DALAM `Db.baca()`,
satu-satunya cara melihatnya sebab `saring()` memanggilnya internal.

Bagian B menjaga hal yang paling mudah kembali: **biaya per item tidak
boleh naik** saat kelas membesar.

Dibuktikan MERAH pada 3 cabang: `Db.saring` kembali (4 poin gagal),
`Db.cari` kembali (1), pembacaan dua kali (2).

---

## 🔴 Kerangka AI kini membuat KELIMA tipe item (v1.8.6)

**Dilaporkan guru:**

> kurang item tugas kelompok yang tidak muncul di kerangka AI

Benar. Kerangka Semester hanya pernah membuat tiga tipe: **materi,
LKPD, quiz**. Padahal enum `tipe` sudah punya lima anggota —
`tugas_kelompok` sejak v1.7.0 dan `refleksi` sejak v1.0.0. Guru yang
memakai kerangka untuk 15 pertemuan tetap harus menambahkan Tugas
Kelompok dan Refleksi satu per satu, persis pekerjaan yang ingin
dihindari dengan memakai kerangka.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Ai.gs` | 🔴 **Wajib** | `SKEMA_KERANGKA` +3 medan · prompt membimbing pemilihan kegiatan · `terapkanKerangka()` membuat Tugas Kelompok & Refleksi · `_skemaKerangka()` dibuka untuk diagnostik |
| `js_kerangka.html` | 🔴 **Wajib** | dua centang baru + pembacaan baliknya · hitungan item dipusatkan di `_cacahItem()` |
| `css.html` | 🟡 | `.krg-kelompok` `.krg-refleksi` ikut dirapatkan |
| `Code.gs` | 🟡 | `ujiTahap16()` BARU (17 poin) · versi `1.8.6` · 4 penanda (total **73**) |

> **Tidak perlu migrasi** — enum `tipe` sudah memuat kelimanya sejak
> v1.7.0. Bila `ujiTahap16()` menolak `tugas_kelompok`, barulah
> jalankan `migrasiStruktur()`.

### Bug kedua, yang jauh lebih parah

Ditemukan saat memperbaiki yang pertama: **medan `bab` tidak pernah
terdaftar di `SKEMA_KERANGKA`.**

Prompt memintanya panjang lebar sejak v1.8.4 — enam baris instruksi
tentang cara mengelompokkan pertemuan. Tetapi keluaran terstruktur
Gemini (`responseSchema`) **hanya memuat medan yang terdaftar di
skema**; apa pun di luar itu dibuang diam-diam, tanpa galat.

Artinya sejak v1.8.4 dirilis, `bab` **selalu kosong** dari AI
sungguhan, `bab_kosong` **selalu menyala**, dan seluruh pertemuan
jatuh ke satu bab cadangan — persis keluhan yang v1.8.4 klaim sudah
diperbaiki. Yang bekerja hanyalah kolom bab yang diketik guru sendiri.

**Mengapa 103 pemeriksaan `run59` tetap hijau?** Karena `UrlFetchApp`
tiruan mengembalikan JSON yang **ditulis tangan**. Mock tidak
menyaring medan seperti Gemini menyaringnya; ia patuh mengembalikan
apa pun yang ditulis penguji — termasuk medan yang model sungguhan
tidak akan pernah kirim.

Pelajarannya masuk `KONVENSI-TEKNIS.md §6.2` sebagai **aturan 40**:
skema wajib diuji sebagai kontrak, langsung pada objek yang dikirim ke
API, dua arah.

### Apa yang berubah bagi guru

Tabel usulan kini punya empat centang, bukan dua:

```
Item yang dibuat:  [2] materi   📝 LKPD   👥 Kelompok   🎯 Quiz   💭 Refleksi
```

AI yang memilih centangnya — guru tetap bisa mengubah. Prompt
membimbing dengan aturan yang eksplisit, sebab AI yang dibiarkan bebas
cenderung mencentang semuanya:

- **Tugas Kelompok** hanya untuk tugas yang benar-benar menuntut
  diskusi dan keputusan bersama; **bukan** pertemuan pengantar teori.
  Sasaran ±1 dari 4 pertemuan.
- **Refleksi** di pertemuan **terakhir tiap bab** — sasaran 1 per bab
  (§6.5: kesadaran belajar, bukan penguasaan materi).
- Satu pertemuan sebaiknya **tidak** memuat LKPD dan Tugas Kelompok
  sekaligus.

Urutan item mengikuti alur pembelajaran:

```
materi → LKPD → Tugas Kelompok → Quiz → Refleksi
```

Refleksi selalu terakhir: murid menimbang cara belajarnya **setelah**
menjalani kegiatannya, bukan sebelum.

Item Refleksi lahir **tanpa pertanyaan** — itu disengaja.
Pertanyaannya disusun guru lewat tombol ✨ di editor Refleksi (v1.8.1),
bukan ditebak di sini.

### Cacat ketiga: hitungan yang disalin

Jumlah item dihitung di **dua** tempat — ringkasan dan dialog
konfirmasi — dengan kode yang disalin. Menambah tipe berarti salah
satu pasti tertinggal, dan angka yang dijanjikan guru berbeda dengan
yang benar-benar dibuat. Kini terpusat di `_cacahItem()`, dan `run60`
membandingkan hitungan klien dengan hasil server yang sungguhan.

### Berkas uji

`test/run60-kerangka-kegiatan.js` BARU — **56 poin, 8 bagian**.

| Bagian | Yang dijaga |
|---|---|
| A | skema JSON sebagai kontrak, **dua arah** |
| B | prompt membimbing, bukan membiarkan AI mencentang semua |
| C | `'false'` dan `1` tidak dianggap `true` |
| D | item benar-benar tersimpan dengan tipe & judul yang benar |
| E | urutan materi → lkpd → kelompok → quiz → refleksi |
| F | itemnya **BISA DIPAKAI** — kelompok bisa dibagi, rekap refleksi tidak rusak |
| G | duplikat ditolak dengan nama manusiawi, bukan `TUGAS_KELOMPOK` |
| H | centang dibaca balik; hitungan klien = hasil server |

Dibuktikan MERAH pada tiga cabang: medan dibuang dari skema (4 poin
gagal), pembuatan item dihapus (21 poin gagal), pembacaan balik
centang dihapus (1 poin gagal). Cabang kedua semula **crash** dan
harus diperkuat lebih dulu — merah yang tidak terbaca sama saja dengan
tidak menggigit.

`run44` bertambah bagian **D6**: `ujiTahap16()` dijalankan dua kali,
dipastikan tidak meninggalkan sisa data.

### Cacat uji yang ikut ketahuan

`run51-ui-kelompok` merah bukan karena Tugas Kelompok rusak, melainkan
karena `APP_VERSI` naik ke 1.8.6 sedangkan ujinya mengunci `'1.8.5'`
persis. Merah palsu semacam ini melatih pembaca mengabaikan kegagalan.
Kini yang dijaga adalah versi tidak **mundur** di bawah 1.8.5
(§6.2 aturan 42).

### Verifikasi lapangan

Jalankan `ujiTahap16()` di editor Apps Script — 17 poin. Bagian F
memakai AI sungguhan bila `GEMINI_KEYS` sudah terpasang, dan itulah
satu-satunya cara membuktikan `bab` dan dua medan baru benar-benar
sampai ke model.
---

## ⚡ 40 → 21 panggilan API per pertemuan (v1.8.7)

**Ditemukan dari log lapangan Anda.** `ujiTahap15()` setelah v1.8.5
melaporkan **13,8 detik/pertemuan** — turun dari 16,5, tetapi panduan
v1.8.5 menjanjikan **2–3 detik**. Klaim itu keliru dan sudah diralat.

`Pertemuan.gs` memang sudah versi terbaru. `perf11` juga hijau: nol
pembacaan penuh. Yang tidak pernah diukur siapa pun adalah **jumlah
panggilan Spreadsheet API** — dan di Apps Script itulah yang menjadi
detik.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Db.gs` | 🔴 **Wajib** | `invalidasi()` tidak lagi membuang memo header |
| `Util.gs` | 🔴 **Wajib** | `mulaiTumpukLog()` + `siramTumpukLog()` |
| `Ai.gs` | 🔴 **Wajib** | `terapkanKerangka()` menumpuk log · `generateKerangka()` mengembalikan `model` |
| `Code.gs` | 🟡 | saran versi di `ujiTahap15()` · versi `1.8.7` |

> **Tidak perlu migrasi.**

### Yang terukur

Penghitung disisipkan ke `Db.sheet()` — gerbang tunggal yang dilewati
setiap operasi Spreadsheet API:

```
SEBELUM — 1 pertemuan + 5 item = 40 panggilan
  log         14      ← catatLog() satu penulisan per item
  item        15
  pertemuan    8
  materi_pokok 2

SESUDAH — 21 panggilan
  item        10
  pertemuan    7
  materi_pokok 2
  log          1      ← ditumpuk, disiram sekali
```

### Sebab 1 — header dibuang percuma

`Db.invalidasi()` melakukan `delete _memo[nama]`. Tetapi `_memo`
menyimpan **dua hal berbeda**: hasil `bacaKolom()` yang memang basi
setelah menulis, dan `__head` yang hanya berubah saat
`migrasiStruktur()`.

Polanya jadi: `tambah()` membaca header → `invalidasi()` membuangnya →
`tambah()` berikutnya membacanya lagi. Satu pembacaan sia-sia per
penulisan, di **seluruh aplikasi** — bukan hanya kerangka.

### Sebab 2 — log sebanyak data

`catatLog()` menulis satu baris per pemanggilan. `simpanItem()`
memanggilnya sekali per item, jadi menerapkan 20 pertemuan berisi 5
item = **120+ penulisan** ke sheet `log`, sebanyak penulisan data yang
sebenarnya.

Kini `terapkanKerangka()` menumpuk log ke memori dan menyiramnya dalam
**satu** panggilan. Disiram di blok `finally` — bila penerapan gagal
di tengah, jejak pertemuan yang terlanjur dibuat tetap tersimpan.

> **Log tidak berkurang satu baris pun.** Yang berubah hanya cara
> menulisnya. `perf12` bagian D memeriksa jumlah baris, keunikan
> `log_id`, dan `user_id` — sebab optimasi yang menelan jejak audit
> lebih buruk daripada lambat.

### `model -` juga diperbaiki

`generateKerangka()` tidak pernah mengembalikan `model`, padahal
`key_index` dan `durasi_ms` ikut. Diagnostik melaporkan `model -`.
Dengan rotasi model, hasil bisa berbeda antar percobaan — tanpa jejak
ini tidak ada yang bisa ditelusuri.

### Berkas uji

`test/perf12-panggilan-api.js` BARU — **16 poin, 5 bagian**.

| Bagian | Yang dijaga |
|---|---|
| A | anggaran ≤26 panggilan/pertemuan; sheet `log` ≤2 penulisan |
| B | biaya per pertemuan **tetap** saat kelas membesar |
| C | menulis 10× hanya membaca header sekali |
| D | log tetap utuh: jumlah, `log_id` unik, `user_id`, penumpuk dilepas |
| E | `siramTumpukLog()` di `finally`; aman dipanggil tanpa penumpuk |

Dibuktikan MERAH pada tiga cabang: `delete _memo` polos dikembalikan
(3 gagal), penumpuk dilepas (2 gagal), `finally` dihapus (**5 gagal** —
`0 baris buat_item` dan *"penumpuk masih menyala"*).

### Cacat uji yang ikut ketahuan

`run44` mengunci teks `'versi 1.8.5'` — pola yang sama dengan `run51`
di v1.8.6, dan pelanggaran aturan 42 yang baru saja saya tulis
sendiri. Kini memeriksa polanya, bukan angkanya.

### Terverifikasi lapangan

`ujiTahap15()` — **36/36**, dan untuk pertama kalinya proyeksi 20
pertemuan lolos **tanpa peringatan**:

```
waktu: 72 detik untuk 8 pertemuan (9,1 detik/pertemuan)
proyeksi 20 pertemuan: 181 detik
✅ proyeksi 20 pertemuan AMAN  181 detik < 240
```

| Versi | detik/pertemuan | proyeksi 20 ptm |
|---|---|---|
| v1.8.4 | 16,5 | 330 detik ⚠ |
| v1.8.5 | 13,8 | 276 detik ⚠ |
| **v1.8.7** | **9,1** | **181 detik** ✅ |

**45% lebih cepat** daripada titik awal.

Catatan untuk diri sendiri: panggilan API turun 48% tetapi waktu turun
34%. Selisihnya adalah biaya tetap di luar `sheet()` — `LockService`,
`CacheService`, dan serialisasi JSON. Menghitung panggilan adalah
petunjuk yang baik, **bukan** peramal yang tepat.
---

## 🔴 Uji beban 432 murid — dan enam berkas uji yang ternyata RUSAK (v1.8.8)

Peta jalan §D meminta satu hal: *"berapa lama 36 murid mengerjakan
quiz bersamaan, dan apakah `LockService` menahan beban itu."*

Menjawabnya membongkar sesuatu yang lebih penting daripada
jawabannya.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Code.gs` | 🟡 | `ujiTahap17()` BARU (14 poin) · versi `1.8.8` |

> **Tidak ada perubahan kode produk.** Seluruh temuan ada di berkas
> uji. Itu kabar baik: yang rusak adalah alat ukurnya, bukan yang
> diukur.

### Enam berkas uji beban tidak pernah dijalankan — dan rusak

`perf`, `perf5`–`perf9` menyusun barisnya dengan **nomor indeks**:

```js
const r = new Array(24).fill('');
r[3] = 'materi';        // dimaksudkan: tipe
r[21] = 'publish';      // dimaksudkan: status
```

Ketika `item` mendapat kolom `mp_id` di **v1.0.0**, seluruh indeks
bergeser satu. `r[3]` mendarat di `kelas_id`; `tipe` menjadi kosong.

```
perf9 → Error: Item ini bukan Quiz.   (CRASH)
perf7 → ✗ baca 3 bagian → Materi tidak ditemukan.
```

Keduanya diam **sejak v1.0.0** karena tak satu pun terdaftar di
`jalankan-semua.sh`. Aturan 37 yang saya tulis sendiri — *"API tanpa
tombol tidak pernah teruji"* — ternyata berlaku juga untuk **berkas
uji tanpa pemanggil**.

### Perbaikannya: skema dibaca, bukan ditebak

`test/bebandata.js` BARU. Skema dibaca langsung dari `Setup.gs`,
baris disusun per **nama kolom**, dan nama yang tidak ada di skema
**dilempar**.

Penjaga itu langsung berguna: ia menangkap enam nama yang saya tulis
dari ingatan — `enrollment_id` (asli `enroll_id`), `urutan` pada
`soal` (asli `nomor`), `pertemuan_id` pada `lkpd_submission` (tidak
ada).

Dibuktikan dengan menyisipkan kolom baru ke tengah skema: seluruh uji
beban **tetap hijau**. Tidak akan basi lagi karena alasan yang sama.

### Ambang yang terlalu longgar = tidak ada ambang

Saat cache `bacaKolom` sengaja dimatikan, `perf9` merah 4 pemeriksaan
sementara **`perf7` diam**. Ambangnya disetel hampir 5× di atas
angka terukur:

| Pemeriksaan | Ambang lama | Terukur | Ambang baru |
|---|---|---|---|
| 36 murid alur penuh | 6.000.000 | 1.242.742 | **1.750.000** |
| rata per murid | 170.000 | 34.521 | **48.000** |
| cache hangat | 2.000 | 12 | **300** |

Setelah dirapatkan, regresi yang sama membuat `perf7` merah 4.

### `perf13-lock-serentak.js` — menjawab pertanyaan §D

Seluruh mock selama ini memakai `tryLock: () => true`. Dengan kunci
yang tidak pernah gagal, `SISTEM_SIBUK` tidak pernah dilempar dan
jalur penanganannya tidak pernah dijalani.

Berkas baru ini memakai lock yang **berperilaku seperti aslinya** —
eksklusif, mencatat ambil/tolak/lepas, bisa dipaksa gagal. **23 poin,
5 bagian:**

| Bagian | Yang dijaga |
|---|---|
| A | tidak pernah ada dua pemegang; setiap kunci dilepas |
| B | `SISTEM_SIBUK` dilempar; **lock tetap dilepas walau operasi galat** |
| C | `mulaiQuiz` `kumpulkanQuiz` `Lkpd.kumpulkan` `Kelompok.kumpulkan` memakai kunci |
| D | 36 murid: 36 attempt, nol ganda, nol menggantung |
| E | murid melihat kalimat, bukan kode `SISTEM_SIBUK` |

Yang paling berbahaya ternyata bukan gagal mengambil kunci, melainkan
**kunci yang tidak dilepas setelah galat** — satu kegagalan mengunci
seluruh sekolah sampai skrip di-deploy ulang. `Db.denganKunci()`
sudah benar memakai `finally`; sekarang ada yang menjaganya.

### Pemeriksaan yang menyamar hijau

Saat bug disisipkan ke `mulaiQuiz()`, seluruh 36 attempt hilang —
tetapi dua pemeriksaan tetap ✅:

```
✅ BUG — tidak ada murid dengan DUA attempt
✅ seluruh attempt punya status akhir
```

`[].every(...)` bernilai `true`. Kegagalan total menyamar jadi
keberhasilan. Kini didahului penjaga jumlah (aturan 47).

### `ujiTahap17()` — yang hanya bisa diukur di lapangan

Node satu utas hanya menguji **perilaku** lock. Waktu nyata pada
spreadsheet Anda sendiri hanya terlihat di Apps Script:

- 36 murid dibuat, mengerjakan quiz, mengumpulkan
- waktu **per murid** dilaporkan — itu yang dirasakan murid, bukan total
- rekap nilai & antrean koreksi dibuka pada data penuh
- kapasitas `progress` dilaporkan terhadap ambang 40.000
- `MURID` dapat diturunkan ke 12 bila 6 menit tidak cukup

Bersih-bersih sendiri, termasuk **menghapus username** murid uji —
pelajaran v1.5.3 yang dulu membuat jalankan kedua gagal.

### Bukti merah

| Bug disisipkan | Akibat |
|---|---|
| skema `item` tanpa `mp_id` | penjaga `bebandata` melempar |
| kolom baru di tengah `Setup.gs` | **tetap hijau** ✅ (yang diinginkan) |
| cache `cariBarisCache` mati | perf9 merah 4 |
| memo `bacaKolom` mati | perf7 merah 4, perf9 merah 2 |
| `finally` lock dihapus | perf13 merah 2 |
| `mulaiQuiz` tanpa kunci | perf13 merah 5 |
| pesan `SISTEM_SIBUK` mentah | perf13 merah 1 |

### Hasil

**70 berkas uji hijau** — naik dari 63, sebab enam berkas beban
akhirnya masuk regresi dan satu berkas baru ditambahkan.

Jawaban untuk §D masih menunggu Anda: jalankan **`ujiTahap17()`**.
---

## 🔴 Mendaftarkan murid 4,6 detik → jalur yang benar (v1.8.9)

**Ditemukan `ujiTahap17()` di lapangan — dengan cara GAGAL:**

```
✅ kelas + quiz + 5 soal siap        25 detik
✅ 36 murid terdaftar               166 detik (4,6 detik/murid)
B. Seluruh kelas mengerjakan quiz
❌ Exceeded maximum execution time
```

Eksekusi habis **sebelum quiz dimulai**. Yang memakannya bukan quiz —
melainkan mendaftarkan murid.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Kelas.gs` | 🔴 **Wajib** | `simpanMurid()` & `enroll()` — nol pembacaan penuh |
| `Code.gs` | 🟡 | `ujiTahap17()` memakai Impor · versi `1.8.9` |

> **Tidak perlu migrasi.**

### Temuan 1 — empat pembacaan penuh per murid

`simpanMurid()` membaca seluruh sheet **empat kali** untuk menambah
satu murid:

| Panggilan | Yang dibaca |
|---|---|
| `Db.cari('users','username')` | SELURUH sheet users, 13 kolom |
| `Db.cari('kelas', …)` di `enroll()` | SELURUH sheet kelas |
| `Db.cari('kelas', …)` **lagi**, untuk nama kelas | SELURUH sheet kelas |
| `Db.saring('enrollment', …)` | SELURUH sheet enrollment |

Yang paling berbahaya yang pertama: **makin banyak murid terdaftar,
makin mahal mendaftarkan murid berikutnya.** Hari ini dengan 30 murid
tidak terasa; dengan 432 murid ia menjadi dinding.

Perbaikan: `cariCepat` (memindai satu kolom), `cariBarisCache` yang
hasilnya dipakai ulang, dan `saringBaris`. Terukur **nol pembacaan
penuh**, dan biaya per murid tetap 8 panggilan baik pada murid ke-1
maupun ke-60.

### Temuan 2 — ujinya sendiri memakai jalur yang salah

Ini yang lebih penting, dan saya yang keliru.

Guru **tidak pernah** mendaftarkan 432 murid satu per satu. Ia memakai
**Impor**. Dan `imporMurid()` sudah borongan sejak awal:

```
simpanMurid × 36 : 290 panggilan API
imporMurid(36)   :   8 panggilan API      ← 36× lebih hemat
```

Uji yang menempuh jalan yang tidak pernah dipakai guru mengukur
sesuatu yang tidak penting, lalu gagal pada hal yang tidak perlu
terjadi. `ujiTahap17()` kini memakai Impor.

Kegagalan itu tetap berharga — ia membongkar empat pembacaan penuh
yang nyata. Tetapi angka **4,6 detik/murid bukan gambaran pemakaian
sesungguhnya.**

### Berkas uji

`test/perf14-daftar-murid.js` BARU — **22 poin, 6 bagian**.

| Bagian | Yang dijaga |
|---|---|
| A | nol pembacaan penuh; ≤12 panggilan per murid |
| B | **biaya per murid TETAP** saat sekolah 3× lebih besar |
| C | impor ≥5× lebih hemat; 36 murid ≤20 panggilan |
| D | username kembar tetap ditolak; impor memberi akhiran unik |
| E | `Db.cari` tidak kembali ke `enroll()` maupun cek username |
| F | `ujiTahap17` memakai jalur Impor |

Dibuktikan MERAH pada tiga cabang: `Db.cari` username dikembalikan
(3 gagal), `enroll` membaca kelas dua kali (4 gagal), `ujiTahap17`
kembali ke `simpanMurid` (2 gagal).

### Cacat uji yang ikut ketahuan

Batas blok fungsi diambil dari nama yang **ditebak**
(`keluarkanMurid` — tidak ada). `indexOf` mengembalikan −1, dan
`slice(i, -1)` diam-diam memotong sampai akhir berkas, sehingga
pemeriksaan memindai fungsi lain dan merah tanpa sebab. Kini batas
diambil dari deklarasi berikutnya.

### Yang perlu Anda lakukan

Salin `Kelas.gs` dan `Code.gs`, lalu jalankan **`ujiTahap17()`**
lagi. Pendaftaran murid seharusnya turun dari 166 detik ke hitungan
detik, dan bagian B–E akhirnya terjangkau.
---

## ⚡ Quiz: 36 → 30 panggilan per murid, dan uji yang salah arah (v1.8.10)

**Dua laporan lapangan Anda, dua masalah berbeda.**

```
✅ 36 murid terdaftar lewat Impor   18 detik (0,49 detik/murid)   ← v1.8.9 berhasil
B. Seluruh kelas mengerjakan quiz
❌ Exceeded maximum execution time                                ← masalah baru
```

Dan jawaban Anda atas pertanyaan saya: **"ya, 7 detik terasa lambat."**

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Quiz.gs` | 🔴 **Wajib** | `mulaiQuiz()` & `_quizTerbuka()` — pemeriksaan berulang dibuang |
| `Belajar.gs` | 🔴 **Wajib** | `detailPertemuan()` membaca sheet `item` sekali |
| `Code.gs` | 🟡 | `ujiTahap17()` mengukur 8 murid · versi `1.8.10` |

> **Tidak perlu migrasi.**

### Masalah 1 — uji saya salah arah (lagi)

36 murid dalam satu eksekusi butuh ~252 detik. Tetapi di dunia nyata
**36 murid = 36 eksekusi terpisah**, masing-masing berjatah 360 detik
sendiri. Satu murid hanya perlu ~7 detik.

Saya memaksa seluruh kelas ke satu jatah — mengukur sesuatu yang tidak
pernah terjadi. Ini pengulangan aturan 49 yang saya tulis **satu rilis
sebelumnya**, kali ini pada uji buatan sendiri.

`ujiTahap17()` kini mengukur **8 murid** lalu memproyeksikan, dan
menyatakan dengan jelas bahwa tiap murid punya eksekusi sendiri.

### Masalah 2 — 7 detik memang terlalu lambat

Yang dirasakan murid bukan total sekelas, melainkan **satu aksi**:

| Aksi | Sebelum | Sesudah |
|---|---|---|
| klik "Mulai Quiz" | 13 | **11** |
| klik "Kumpulkan" | 8 | 8 |
| buka halaman quiz | 6 | 6 |
| jawab 1 soal (autosave) | 3 | 3 |
| **total satu alur (5 soal)** | **36** | **30** |

Dua pemborosan:

**`mulaiQuiz()` membaca daftar attempt dua kali.** Dan
`_selaraskanProgresQuiz()` sudah lama menerima parameter `daftar` yang
tidak pernah diisi pemanggilnya — kini disambungkan.

**`_quizTerbuka()` mengulang pemeriksaan.** Ia memeriksa status
pertemuan dan keanggotaan, lalu memanggil `Belajar.detailPertemuan()`
yang melakukan **keduanya lagi**. Pengulangan dibuang.

> **Penjaganya tidak berkurang.** Yang dibuang pengulangan, bukan
> pemeriksaannya. `perf15` bagian C menguji tiga arah: murid kelas
> lain ditolak, quiz di pertemuan draf ditolak, dan murid yang sah
> **tetap boleh**. Dibuktikan dengan menghapus `_cekEnroll()` —
> langsung merah *"murid luar kelas BISA mengerjakan quiz"*.

Ditambah `detailPertemuan()` yang memanggil `bacaKolom('item')` dua
kali dengan daftar kolom berbeda, sehingga memo tidak pernah berbagi.

### Berkas uji

`test/perf15-quiz-per-aksi.js` BARU — **21 poin, 5 bagian**.

| Bagian | Yang dijaga |
|---|---|
| A | anggaran tiap aksi; **autosave paling ketat** (≤4) sebab paling sering |
| B | biaya murid terakhir sama dengan murid pertama |
| C | penjaga akses tiga arah setelah optimasi |
| D | pemeriksaan berulang tidak kembali |
| E | `ujiTahap17` mengukur satu alur, bukan sekelas |

Dibuktikan MERAH pada empat cabang — yang terpenting: menghapus
`_cekEnroll()` dari `detailPertemuan()`.

### Cacat uji: penjaga yang menghitung komentarnya sendiri

Pemeriksaan "hanya boleh satu `bacaKolom('item')`" merah karena
**komentar saya sendiri** menyebut pola itu: *"Versi lama memanggil
`bacaKolom('item', …)` DUA KALI"*. Kini komentar dibuang sebelum
memindai (aturan 53).

### Yang jujur

30 panggilan masih belum ringan. Sisanya tersebar merata — tidak ada
lagi satu titik yang boros. Memangkas lebih jauh berarti membongkar
struktur unlock, dan saya tidak menyarankannya sebelum Anda merasakan
apakah perbaikan ini sudah cukup.
---

## 📏 11 detik: bukan volume, melainkan biaya per panggilan (v1.8.11)

**Angka lapangan Anda:**

```
11,0 detik untuk SATU alur (buka → jawab 5 soal → kumpulkan)
✅ di bawah 15 detik (dapat dipakai)
❌ di bawah 8 detik (nyaman)
```

Anda benar sejak awal: ini terasa lambat. Tetapi penyebabnya bukan
yang saya duga.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Quiz.gs` | 🟡 | `_quizTerbuka()` memakai ulang baris pertemuan |
| `Belajar.gs` | 🟡 | `detailPertemuan()` mengembalikan `_barisPertemuan` · catatan biaya |
| `Code.gs` | 🟡 | versi `1.8.11` |

> **Tidak perlu migrasi.** Perubahan kecil — 11 → 10 panggilan.

### Temuan yang mengubah cara membaca angka itu

Kelas uji `ujiTahap17()` **kosong** — dibuat, dipakai, dihapus. Jadi
11 detik itu **bukan** akibat volume data:

```
11,0 detik ÷ 34 panggilan = 0,32 detik per panggilan Apps Script
```

Itu biaya tetap, dan sebagian besar di luar kendali kode.

**Yang benar-benar ditunggu murid lebih kecil lagi.** Autosave sudah
non-blocking (`js_quiz.html` memakai `{ diam: true }` + penundaan 900
ms), jadi 5 kali autosave terjadi saat murid membaca soal berikutnya.
Yang ditunggu hanya dua tombol:

| Aksi | Panggilan | Perkiraan |
|---|---|---|
| klik "Mulai Quiz" | 10 | ~3,2 detik |
| klik "Kumpulkan" | 8 | ~2,6 detik |

### Yang jauh lebih penting: volume pada sekolah penuh

`perf15` menghitung PANGGILAN dan hijau. Tetapi panggilan tidak
memberi tahu berapa banyak yang dibaca. Diukur dalam **sel** pada 12
kelas · 900 item · 32.400 progress:

```
mulaiQuiz       53.634 sel
  progress      33.648   ← pindai kolom user_id 32.400 baris demi 75
  item          14.450
kumpulkanQuiz    1.442 sel
simpanJawaban       60 sel
```

**Dua pertiga biaya membuka quiz** habis memindai `progress`. Cache
300 detik menutupinya pada pemanggilan kedua — yang membayar penuh
adalah murid pertama tiap sesi, dan itu terjadi serentak saat jam
pelajaran dimulai.

### Yang TIDAK saya perbaiki, dan alasannya

Memperbaikinya butuh kolom indeks atau memisah sheet `progress` per
semester (§OPT-E) — perubahan skema yang menyentuh seluruh modul.
Terlalu besar untuk disisipkan di sela-sela.

Yang dilakukan sebagai gantinya:

- biayanya **ditulis di komentar** `_progresMurid()` lengkap dengan
  angka dan penunjuk rencana perbaikan
- `perf16` bagian F **menguji keberadaan catatan itu** — menghapusnya
  membuat uji merah

Kekurangan yang terdokumentasi dan terjaga lebih aman daripada
perbaikan tergesa yang tidak dipahami.

### Berkas uji

`test/perf16-volume-sekolah.js` BARU — **16 poin, 6 bagian**, mengukur
**sel** pada sekolah penuh.

| Bagian | Yang dijaga |
|---|---|
| A | mulaiQuiz <75.000 sel · autosave <200 sel |
| B | cache progres bekerja; cache murid lain tidak tertukar |
| C | murid kelas ke-12 tidak lebih mahal daripada kelas ke-1 |
| D | kolom `konten` tidak pernah ikut terbaca |
| E | kebenaran tetap pada data penuh |
| F | catatan kekurangan ada di kode |

Dibuktikan MERAH pada tiga cabang: cache progres dimatikan (2 gagal),
`konten` ikut dibaca (1), catatan dihapus (2).

### Jujur soal hasilnya

Perubahan rilis ini kecil: 11 → 10 panggilan, mungkin 0,3 detik.
**Tidak akan membawa 11 detik ke bawah 8.**

Yang berharga dari rilis ini adalah **memahami angkanya**: 11 detik
adalah 34 × biaya tetap Apps Script, bukan kelambatan yang bisa
dioptimasi habis. Menurunkannya secara berarti perlu mengurangi
JUMLAH panggilan bolak-balik — misalnya menggabungkan
`mulaiQuiz` + soal pertama dalam satu permintaan.

Itu pekerjaan tersendiri, dan saya ingin Anda memutuskannya setelah
memakai quiz ini di kelas nyata.
---

## 🔴 Quiz dikerjakan OFFLINE — 288 → 72 permintaan sekelas (v1.9.0)

**Laporan lapangan, 36 murid mengerjakan bersamaan:**

> mengerjakan quiz sangat lama, banyak yang gagal, server sibuk,
> data tidak tersimpan

Dan pertanyaan Anda yang langsung menemukan akarnya: *"apa setiap
siswa klik 1 jawaban langsung memanggil server?"*

**Ya.** Dan itu penyebabnya.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Setup.gs` | 🔴 **Wajib** | kolom `terlambat` di `quiz_attempt` |
| `Quiz.gs` | 🔴 **Wajib** | jawaban borongan · penanda terlambat · kedaluwarsa 7 hari |
| `js_quiz.html` | 🔴 **Wajib** | localStorage · timer dihapus |
| `js_editor.html` | 🔴 **Wajib** | tenggat tanggal menggantikan timer menit |
| `Code.gs` | 🟡 | API + `ujiTahap17()` + 4 penanda (total **77**) · versi `1.9.0` |

> ⚠️ **WAJIB jalankan `migrasiStruktur()` sekali** — ada kolom baru.

### Akar masalahnya: satu kunci untuk seluruh sekolah

`LockService.getScriptLock()` adalah **satu** kunci untuk seluruh
aplikasi. Bukan per murid, bukan per quiz.

```
36 murid × 5 soal            = 180 permintaan autosave
tiap permintaan memegang kunci ~0,6 detik
antrean                       ~108 detik
batas tunggu tryLock          =  10 detik  →  SISTEM_SIBUK
```

Mayoritas murid **pasti** gagal. Bukan kebetulan — matematika.

Padahal kuncinya tidak pernah diperlukan untuk autosave: tiap murid
menulis baris attempt-nya sendiri. Dua murid tidak pernah
bertabrakan.

### Alur baru

```
1. Klik "Kerjakan"    → 1 permintaan   (soal, TANPA kunci jawaban)
2. Mengerjakan        → 0 permintaan   ← localStorage
3. Klik "Kumpulkan"   → 1 permintaan   (seluruh jawaban sekaligus)
```

| | Sebelum | Sesudah |
|---|---|---|
| Permintaan per murid | 8 | **2** |
| Sekelas 36 murid | 288 | **72** |
| Panggilan API internal | 34 | **19** |

**Bonus:** quiz tetap jalan saat WiFi putus-putus. Murid boleh
menutup tab lalu kembali — jawabannya dipulihkan.

### Yang TIDAK ikut pindah ke HP

Anda mengusulkan kunci jawaban & penilaian ikut dikirim ke
localStorage. Saya menolak, dan Anda menyetujui alasannya:

> §13 no. 10 — kunci jawaban tidak pernah dikirim ke klien; nilai
> dihitung ulang di server

Murid SMK TJKT belajar jaringan dan komputer. `F12 → Application →
Local Storage` adalah **materi pelajaran mereka sendiri**.

`run61` bagian B menguji ini secara harfiah: isi localStorage
diperiksa, kata `kunci`, `nilai`, dan `skor` **tidak boleh ada**.

### Timer dihapus — ini tugas, bukan ujian

Keputusan Anda. `batas_waktu_menit` (hitung mundur) diganti
`batas_waktu` (tenggat tanggal), persis LKPD:

- lewat tenggat **tetap boleh** mengumpulkan
- nilai **tetap penuh**, tidak dikurangi
- guru melihat penanda **terlambat** di antrean & rekap
- murid diberi tahu **sebelum** mulai, bukan dikejutkan setelah selesai

Data lama `batas_waktu_menit` diabaikan, sesuai pilihan Anda.

### Kedaluwarsa 24 jam → 7 hari

Dulu 24 jam masuk akal karena jawaban ada di server, jadi
"melanjutkan attempt" berarti melanjutkan pekerjaan sungguhan.
Sekarang attempt `berjalan` hanyalah penanda; isinya di HP murid.

Yang perlu ditegaskan — **kedaluwarsa tidak menghukum**:
kesempatan tidak berkurang, nilai yang sudah diraih tidak hilang,
pertemuan berikutnya tetap terbuka bila KKM tercapai.

### Berkas uji

`test/run61-quiz-lokal.js` BARU — **36 poin, 8 bagian**, memuat
`js_quiz.html` sungguhan di jsdom dengan localStorage nyata.

| Bagian | Yang dijaga |
|---|---|
| A | **nol** panggilan server saat menjawab |
| B | isi localStorage benar; **kunci & nilai tidak ada di sana** |
| C | pulih setelah tab ditutup; attempt lain tidak tercampur |
| D | tepat satu `kumpulkanQuiz` membawa larik jawaban |
| E | simpanan dibersihkan **setelah** server menerima |
| F | **gagal jaringan tidak menghapus pekerjaan** |
| G | timer benar-benar hilang dari kode |
| H | dialog menyebut soal kosong; Batal tidak mengirim |

Dibuktikan MERAH pada tiga cabang: autosave dikembalikan (5 gagal),
localStorage dihapus sebelum server menjawab (1), kunci ikut
disimpan (1).

`run11` bertambah bagian tenggat & borongan — **172 poin**.

### Yang belum selesai — jujur

72 permintaan masih memegang `LockService` global:

```
72 × 0,6 detik = 43 detik antrean
batas tunggu   = 10 detik
```

Turun drastis dari 129 detik, tetapi **belum tentu cukup** bila
seluruh 36 murid menekan Kumpulkan dalam menit yang sama.

Perbaikan berikutnya bila masih terjadi: kunci global diganti kunci
**per murid** (`mulai_at` + `user_id` sebagai penanda), sebab yang
dilindungi memang baris milik satu murid — bukan seluruh sheet.
Saya menunggu hasil lapangan Anda sebelum membongkar itu.
---

## 🔴 Kunci selektif — 3 → 1 kunci per murid saat mengumpulkan (v1.9.1)

Lanjutan v1.9.0. Jawaban sudah pindah ke localStorage, tetapi momen
paling serentak tetap ada: **36 murid menekan Kumpulkan dalam menit
yang sama.**

Anda mengusulkan sistem antrian di klien. Setelah ditelusuri,
akarnya lebih dalam — dan hasilnya lebih baik daripada mengatur
giliran.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Db.gs` | 🔴 **Wajib** | kunci pindah ke `tambah()` · reentrant · batas tunggu 45 dtk |
| `Quiz.gs` | 🔴 **Wajib** | `kumpulkanQuiz` & `simpanJawaban` tanpa kunci global · log ditumpuk |
| `Lkpd.gs` | 🔴 **Wajib** | `kumpulkan` `batalkan` `mulaiMenilai` `nilai` tanpa kunci global |
| `Kelompok.gs` | 🔴 **Wajib** | `kumpulkan` `batalkan` tanpa kunci global |
| `Code.gs` | 🟡 | versi `1.9.1` |

> **Tidak perlu migrasi.**

### Apa yang sebenarnya rebutan

Hanya satu hal: `Db.tambah()` memakai `getLastRow() + 1`.

```
A: getLastRow() → 100, tulis baris 101
B: getLastRow() → 100, tulis baris 101   ← menimpa A
```

`Db.perbarui()` **tidak** punya masalah ini — nomor barisnya sudah
pasti, dan dua murid tidak pernah menulis baris `quiz_attempt` yang
sama.

Kunci global di `kumpulkanQuiz`, `tulisProgres`, `Lkpd.kumpulkan`
dan kerabatnya **tidak melindungi apa pun** — ia hanya membuat murid
mengantre.

### Perubahannya

- Kunci **pindah ke dalam `Db.tambah()`**, tempat rebutan yang
  sesungguhnya. Blok yang dikunci jadi sesingkat mungkin: baca nomor
  baris, tulis, selesai.
- `denganKunci()` jadi **reentrant** — `Db.tambah()` sering dipanggil
  dari dalam blok yang sudah berkunci. Tanpa penghitung kedalaman,
  `mulaiQuiz` **deadlock seketika**.
- `mulaiQuiz` **tetap** berkunci: ia membuat attempt baru, dan dua
  tab bisa membuat dua attempt bila tidak dijaga.

### Batas tunggu 10 → 45 detik

Temuan yang mengubah cara saya melihat masalah ini:

> Yang membuat murid gagal bukan lamanya operasi, melainkan
> **panjang antrean**.

Kunci dipegang <1 detik. Tetapi murid ke-36 menunggu di belakang 35
orang — ±21 detik — dan `tryLock(10000)` menyerah di detik ke-10.

Menunggu 21 detik dengan tirai yang jelas jauh lebih baik daripada
gagal di detik ke-10 dan kehilangan pekerjaan.

### Hasil terukur

| Momen 36 murid mengumpulkan | Sebelum | Sesudah |
|---|---|---|
| Kunci per murid | 3 | **1** |
| Total pengambilan | 108 | **36** |
| Estimasi antrean | ~65 detik | **~22 detik** |
| Batas tunggu | 10 detik ❌ | **45 detik** ✅ |

Digabung dengan v1.9.0 (autosave dihapus), perjalanan lengkapnya:

```
v1.8.11 : 216 pengambilan kunci sekelas  →  129 detik antrean
v1.9.0  :  72                            →   43 detik
v1.9.1  :  36                            →   22 detik, batas tunggu 45 dtk
```

### Mengapa tidak antrian di klien

Usulan Anda tetap valid dan bisa ditambahkan nanti. Tetapi kunci
selektif lebih baik untuk tiga hal:

| | Antrian klien | Kunci selektif |
|---|---|---|
| Murid menunggu | ~30 detik (dijadwalkan) | ~0–21 detik (nyata) |
| Dua kelas bersamaan | tidak saling tahu | tetap aman |
| Kerja server | tetap 108 kunci | **36 kunci** |

Antrian klien mengatur giliran; kunci selektif **menghapus
antreannya**.

### Berkas uji

`test/perf17-kunci-selektif.js` BARU — **29 poin, 6 bagian**, memakai
lock yang **bisa menolak** (§6.2 no. 48).

| Bagian | Yang dijaga |
|---|---|
| A | ≤1,5 kunci/murid saat 36 murid mengumpulkan |
| B | batas tunggu 30–60 detik |
| C | `tambah` berkunci · `perbarui` tidak · `mulaiQuiz` tetap |
| D | **kunci bersarang tidak melepas terlalu awal** |
| E | 36 attempt, nol ganda, kumpul dua kali tetap ditolak |
| F | log tetap utuh; penumpuk dilepas |

Dibuktikan MERAH pada tiga cabang: kunci dibuang dari `Db.tambah`
(1 gagal), penghitung bersarang dihapus (**deadlock** — 2 gagal),
batas tunggu kembali 10 detik (1 gagal).

Cabang kedua semula **crash** dan harus diperkuat lebih dulu —
merah yang tidak terbaca sama saja dengan tidak menggigit.

### Yang masih perlu Anda buktikan

22 detik adalah estimasi dari mock. Angka nyatanya hanya terlihat
saat 36 murid Anda mengerjakan bersamaan.

Kalau `SISTEM_SIBUK` masih muncul, barulah antrian klien layak
ditambahkan di atas ini — keduanya tidak saling meniadakan.
---

## 👁 Pratinjau item di layar guru (v1.9.2)

**Permintaan Anda:** *"pada halaman guru, tambahkan preview pada
semua item di pertemuan"*

Sebelumnya pratinjau hanya ada **di dalam editor** dan hanya untuk
konten HTML. Untuk memeriksa 5 item, Anda harus membuka-tutup editor
lima kali — dan setelah Kerangka AI membuat belasan item sekaligus,
itu melelahkan.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_editor.html` | 🔴 **Wajib** | `pratinjauItem()` + tombol 👁 di tiap baris |
| `Code.gs` | 🟡 | 3 penanda (total **80**) · versi `1.9.2` |

> **Tidak perlu migrasi**, dan **tidak ada API baru** —
> `getDetailItem` & `getSoalQuizGuru` sudah ada.

### Tombol 👁 di setiap baris item

Tersedia untuk **kelima tipe** dan **segala status**. Item draf justru
yang paling perlu diperiksa sebelum diterbitkan.

| Tipe | Yang ditampilkan |
|---|---|
| 📄 Materi | isi, **dipecah per bagian** dengan nomornya |
| 📝 LKPD | isi utuh (tujuan · alat · langkah · kesimpulan) |
| 👥 Tugas Kelompok | isi utuh, sama seperti LKPD |
| 🪞 Refleksi | daftar pertanyaan — JSON diubah jadi teks terbaca |
| 🎯 Quiz | ringkasan + tiap soal & opsinya |

Kepala pratinjau menandai: **draf**, **✨ AI belum ditinjau**,
**opsional**, dan tujuan pembelajaran.

### Kunci jawaban quiz disembunyikan

Layar guru sering terlihat murid saat mengajar (§9.8). Kunci dan
pembahasan ada di dialog tetapi **tersembunyi** sampai tombol
🔑 **Lihat kunci** ditekan.

### Item kosong diberi tahu, bukan dialog hampa

```
⚠ Isi masih kosong. Tekan Ubah lalu tulis sendiri,
  atau pakai tombol ✨ untuk menyusunnya dengan AI.
```

Berlaku juga untuk refleksi tanpa pertanyaan dan quiz tanpa soal —
yang terakhir menunjuk tombol 🎯 Soal.

### Keputusan rancangan

Menampilkan **isi apa adanya**, bukan tiruan layar murid. Tiruan
tampak lebih meyakinkan tetapi melenceng begitu salah satu layar
berubah — dan kemelencengan itu justru menyesatkan.

### Bug yang tertangkap saat membangun

Saya memanggil `getSoalGuru` (nama fungsi di `Quiz.gs`) padahal
API-nya bernama `getSoalQuizGuru`. `run10` menangkapnya seketika:

```
🔴 setiap callApi punya fungsi di Code.gs → getSoalGuru (js_editor.html)
```

Penjaga yang ditulis untuk kesalahan orang lain, kali ini menangkap
kesalahan saya sendiri.

### Berkas uji

`test/run62-pratinjau-item.js` BARU — **41 poin, 8 bagian**, memuat
`js_editor.html` sungguhan di jsdom.

| Bagian | Yang dijaga |
|---|---|
| A | tombol ada di **kelima tipe** dan item draf |
| B | materi dipecah per bagian, bernomor |
| C | LKPD **tidak** dipecah |
| D | **JSON refleksi tidak bocor** ke layar |
| E | soal quiz tampil; **kunci tersembunyi** |
| F | item kosong diberi keterangan yang berguna |
| G | penanda AI & opsional diteruskan |
| H | tiap `callApi` punya pasangannya di `Code.gs` |

Dibuktikan MERAH pada tiga cabang: kunci tidak disembunyikan (1),
refleksi dianggap HTML sehingga JSON bocor (4), tombol hilang dari
item draf (2).

`test/buat-pratinjau-item.js` BARU → **`pratinjau-item.html`**,
memperagakan kelima tipe. Dibuat dari `js_editor.html` yang sungguhan
(§6.2 no. 32), jadi ia ikut berubah bila layarnya berubah.
---

## 🔴 Pratinjau tampil "Tanpa Judul" — salah membaca lapisan payload (v1.9.3)

**Dilaporkan guru, sehari setelah v1.9.2 terbit:**

```
Tanpa Judul
draf — belum terlihat murid
⚠ Isi masih kosong. Tekan Ubah lalu tulis sendiri…
```

Padahal itemnya sudah terisi dan sudah terbit.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_editor.html` | 🔴 **Wajib** | `pratinjauItem()` membaca `d.item` |
| `Code.gs` | 🟡 | versi `1.9.3` |

> Perbaikannya **satu baris**. Tidak perlu migrasi.

### Sebabnya

`getDetailItem` tidak mengembalikan item — ia mengembalikan
**pembungkus**:

```js
return { item: i, pertemuan: Pertemuan.detail(i.pertemuan_id) };
```

Saya membaca `d.judul` pada pembungkus itu. Seluruh medan
`undefined` — tanpa satu pun galat, sebab membaca properti yang tidak
ada di JavaScript memang diam saja.

Akibatnya `judul` kosong → *"Tanpa Judul"*, `status` kosong → dianggap
draf, `konten` kosong → *"Isi masih kosong"*. Tiga gejala, satu sebab.

### Yang paling mengganggu: jawabannya ada empat baris di atasnya

Pemanggil lama di berkas yang **sama** sudah benar:

```js
callApi('getDetailItem', [itemId], { diam: true })
  .then(function (d) { return d.item; })      // ← baris 740
```

Kode saya di baris 1144 mengabaikannya.

### Mengapa 41 pemeriksaan tidak menangkapnya

Karena **data contoh saya tulis dari ingatan**, berbentuk item polos:

```js
BALASAN.getDetailItem = { item_id: 'I1', tipe: 'materi', … };   // salah
BALASAN.getDetailItem = { item: { item_id: 'I1', … } };         // benar
```

Uji dan kode sama-sama salah, jadi keduanya sepakat. Ini pelanggaran
§6.2 no. 36 — *"data contoh wajib diikat ke payload sungguhan"* —
pada uji buatan saya sendiri.

### Perbaikan pada ujinya

`run62` kini **43 poin** (dari 41), dengan dua penjaga baru:

| Penjaga | Yang dijaga |
|---|---|
| bentuk payload | membaca `getDetailItem` dari `Code.gs` **sungguhan**, lalu memastikan klien memakai `d.item` |
| data contoh | seluruh `BALASAN.getDetailItem` berbentuk `{ item: … }` |

Penjaga pertama juga berbunyi bila **bentuk servernya** yang berubah
kelak — bukan hanya bila klien yang keliru.

Dibuktikan dengan menyisipkan ulang bug aslinya: **12 pemeriksaan
merah**, dan yang pertama berbunyi persis seperti laporan Anda —
`👁 Tanpa Judul`.

Aturan baru §6.2 no. 61: *baca bentuk kembalian API, jangan menebak
dari namanya.*

### Diperiksa juga

Seluruh `Code.gs` disisir — hanya `getDetailItem` yang berpola
membungkus seperti ini. Tidak ada tempat lain dengan kesalahan serupa.
---

## 📐 Kotak pratinjau dilebarkan — lebar jadi bagian kontrak (v1.9.4)

**Laporan Anda:** *"kotak pratinjau kurang lebar"*

Benar. Dialog bawaan **420px** dirancang untuk konfirmasi
("Yakin hapus?"), bukan untuk membaca materi berisi tabel dan daftar.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_core.html` | 🔴 **Wajib** | `dialog()` menerima opsi `lebar` |
| `css.html` | 🔴 **Wajib** | `.dialog-penuh` + `.pv-gulir` |
| `js_editor.html` | 🔴 **Wajib** | pratinjau meminta `lebar: 'penuh'` |
| `js_quiz.html` | 🟡 | form soal ikut kontrak baru |
| `Code.gs` | 🟡 | 3 penanda (total **83**) · versi `1.9.4` |

> **Tidak perlu migrasi.**

### Lebar kini bagian dari kontrak `dialog()`

```js
dialog({ …, lebar: 'penuh' })     // 900px — membaca konten
dialog({ …, lebar: 'sedang' })    // 620px — form panjang
dialog({ … })                     // 420px — konfirmasi biasa
```

Sebelumnya pemanggil harus menambah class `.dialog-lebar` **sendiri**
lalu **melepasnya** di `.then()`. Bila lupa melepas, dialog berikutnya
ikut melebar. `js_quiz.html` memakai pola lama itu — kini ikut
kontrak, dan dua baris manipulasi class-nya hilang.

### Tetap menyusut di layar sempit

```css
max-width: min(900px, 100%);
```

Tanpa `min()`, dialog 900px di ponsel memaksa gulir mendatar. Uji
menjaganya secara khusus.

### Tabel bergulir sendiri, bukan seluruh dialog

```css
.pv-gulir table { display: block; overflow-x: auto; }
```

Materi TJKT sering memuat tabel konfigurasi yang lebar. Tanpa ini,
satu tabel membuat **seluruh** isi dialog tergulir mendatar.

Gaya gulir juga dipindah dari gaya sebaris di `js_editor.html` ke
CSS — supaya bisa disesuaikan per lebar layar.

### Berkas uji

`run62` kini **50 poin** (dari 43), dengan bagian G2 baru:

| Yang dijaga |
|---|
| pratinjau meminta `lebar: 'penuh'` |
| class benar-benar terpasang di `#isi-dialog` |
| `.dialog-penuh` ada di CSS dan ≥700px |
| memakai `min()` — menyusut di layar sempit |
| wadah gulir di CSS, bukan gaya sebaris |

Dialog tiruan di uji juga diperbaiki: kini **meniru perilaku
`js_core`** dalam memasang class, supaya jalur yang diuji sama dengan
yang dijalankan (§6.2 no. 36).

Dibuktikan MERAH pada tiga cabang: opsi `lebar` dihapus (2 gagal),
`.dialog-penuh` dihapus dari CSS (3), lebar tetap tanpa `min()` (1).

`pratinjau-item.html` diperbarui memakai lebar yang sama, jadi apa
yang Anda lihat di sana mewakili layar sungguhan.
---

## 🔴 "Quiz terkunci, pertemuan tidak ditemukan" — wadahnya belum terbit (v1.9.5)

**Laporan Anda:**

> kenapa quiz terkunci pertemuan tidak ditemukan. padahal sudah dibuat
> tidak wajib. dan batas pengumpulan masih lama

Dugaan Anda masuk akal, tetapi bukan itu sebabnya. `wajib` dan tenggat
tidak ada hubungannya.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Belajar.gs` | 🔴 **Wajib** | pesan menunjuk sebab sesungguhnya |
| `Pertemuan.gs` | 🔴 **Wajib** | payload membawa `mp_status` & `mp_judul` |
| `js_editor.html` | 🔴 **Wajib** | peringatan di layar kelola item |
| `Code.gs` | 🟡 | 1 penanda (total **84**) · versi `1.9.5` |

> **Tidak perlu migrasi.**

### Tiga tingkat harus terbit

```
Materi Pokok (bab)  →  Pertemuan  →  Item
```

Murid hanya melihat quiz bila **ketiganya** `publish`. Menerbitkan
quiz saja tidak cukup.

Kemungkinan besar yang terjadi: quiz Anda terbit, tetapi
**pertemuannya masih draf** — sangat mudah terjadi setelah Kerangka
AI, sebab seluruh hasilnya sengaja dibuat draf.

### Dua kegagalan yang saling menyembunyikan

**1. Layar guru diam saja.** Hanya status ITEM yang ditampilkan. Quiz
bertanda "terbit" terlihat beres, tanpa satu pun tanda bahwa
wadahnya menahan.

**2. Pesannya menyesatkan.** *"Pertemuan tidak ditemukan"* menyiratkan
data hilang — Anda jadi mencari bug yang tidak ada.

### Perbaikan

**Di layar guru**, peringatan muncul tepat di atas daftar item:

```
⚠ Item terbit, tetapi murid belum dapat melihatnya
Pertemuan ini masih draf. Murid akan melihat pesan
"Pertemuan tidak ditemukan" bila membuka tautannya.
Terbitkan Pertemuan lewat tombol Ubah di atas.
```

Menyebut **pesan yang dilihat murid**, supaya Anda bisa langsung
menghubungkan keluhan mereka dengan sebabnya.

Peringatan ini **diam** bila tidak ada item terbit yang tertahan —
pertemuan draf berisi item draf adalah keadaan normal saat menyusun.

**Di sisi murid**, tiga keadaan kini dibedakan:

| Keadaan | Pesan |
|---|---|
| Pertemuan draf | "Pertemuan ini belum diterbitkan guru. Coba lagi nanti." |
| Bab draf | "Materi Pokok pertemuan ini belum diterbitkan guru." |
| Benar-benar hilang | "Pertemuan tidak ditemukan." |

Yang ketiga sengaja dipertahankan — kalau semuanya berbunyi sama, bug
data sungguhan jadi tersamar.

### Berkas uji

`test/run63-terbit-bertingkat.js` BARU — **18 poin, 6 bagian**.
Bagian A meniru keadaan Anda persis: quiz tidak wajib, tenggat 7 hari
lagi, pertemuan draf.

Dibuktikan MERAH pada tiga cabang: pesan lama dikembalikan (2 gagal),
peringatan guru dihapus (1), `mp_status` tidak dikirim (3).

### Cacat uji yang ikut ketahuan

Pemeriksaan "peringatan dipasang di layar" semula **mustahil merah**
dua kali berturut-turut:

1. ditambatkan ke `callApi('getDetailPertemuan')` — padahal
   `formPertemuan` memanggilnya lebih dulu, jadi jendelanya meleset
2. rentangnya mencakup **definisi fungsinya sendiri**, sehingga
   definisi itu terhitung sebagai "pemanggilan"

Keduanya hanya ketahuan karena aturan §6.2 no. 5 mewajibkan setiap
uji dibuktikan bisa merah. Tanpa langkah itu, dua penjaga palsu akan
lolos ke dalam berkas uji.
---

## ✏️ Kartu kelas: "Kelas - Mapel" (v1.9.6)

**Permintaan Anda:** *edit tampilan nama card kelas menjadi
"Kelas - Mapel", contoh "XII TKJ 1 - PKPJ"*

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_core.html` | 🔴 **Wajib** | helper `namaKelasLengkap()` |
| `js_kelola.html` | 🔴 **Wajib** | kartu Kelola Kelas |
| `js_beranda.html` | 🔴 **Wajib** | kartu beranda guru **dan** murid |
| `Code.gs` | 🟡 | 1 penanda (total **85**) · versi `1.9.6` |

> **Tidak perlu migrasi**, tidak ada perubahan backend.

### Sebelum & sesudah

```
sebelum:  XII TKJ 1              sesudah:  XII TKJ 1 - PKPJ
          PKPJ            ←dua baris
```

### Ada TIGA kartu kelas, bukan satu

Mudah terlewat: Kelola Kelas, beranda guru, dan beranda murid
masing-masing menyusun judulnya sendiri. Tiga salinan berarti tiga
kesempatan melenceng.

Karena itu dibuat satu helper bersama di `js_core.html`, dan uji
memeriksa **ketiganya** memakai helper yang sama.

### Keadaan tepi

| Data | Tampil |
|---|---|
| nama + mapel | `XII TKJ 1 - PKPJ` |
| tanpa mapel | `XII TKJ 1` — tanpa strip menggantung |
| mapel spasi saja | `XII TKJ 1` |
| tanpa nama kelas | `PKPJ` — tanpa strip di depan |

### Mapel bernama panjang

Data seed Anda memuat *"Pemasangan dan Konfigurasi Peralatan Jaringan
(PKPJ)"* — digabung menjadi 73 karakter dan terlipat 2–3 baris di
ponsel.

Anda memilih **menampilkannya utuh**, bukan dipotong: nama lengkap
selalu terbaca, kartu boleh lebih tinggi. Uji menjaga keputusan itu —
bila suatu saat ada yang menambahkan pemotongan `…`, ujinya merah.

### Pencarian tetap bekerja

Atribut `data-cari` masih memuat nama **dan** mapel, jadi mengetik
"PKPJ" tetap menemukan kelasnya. Diuji khusus, sebab ini yang paling
mudah ikut terhapus saat merapikan tampilan.

### Berkas uji

`test/run64-nama-kelas-kartu.js` BARU — **18 poin, 5 bagian**, memuat
`js_core.html` sungguhan (helper diuji, bukan disalin ke uji).

Dibuktikan MERAH pada tiga cabang: helper kembali ke nama saja
(4 gagal), satu kartu beranda lupa diubah (2), pencarian mapel dibuang
(1).

Cabang kedua itu yang paling berharga — persis kelalaian yang mungkin
terjadi bila saya hanya mengubah dua dari tiga kartu.

`pratinjau-kartu-kelas.html` BARU — memperagakan keempat keadaan,
termasuk mapel panjang di layar 360px.
---

## ✅ Kartu kelas: dua tempat lagi yang terlewat (v1.9.7)

**Pertanyaan Anda:** *"tampilan card kelas di beranda siswa apa juga
sama?"*

Jawabannya **ya** — beranda murid sudah ikut sejak v1.9.6. Tetapi
pertanyaan itu membuat saya menyisir ulang seluruh layar, dan **dua
tempat lain ternyata terlewat.**

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_rekap.html` | 🔴 **Wajib** | kartu pilih kelas di Rekap Nilai |
| `js_editor.html` | 🔴 **Wajib** | daftar kelas tujuan panel Salin |
| `Code.gs` | 🟡 | versi `1.9.7` |

> **Tidak perlu migrasi.**

### Yang terlewat

| Layar | Mengapa berbahaya |
|---|---|
| **Rekap Nilai** — kartu pilih kelas | guru memilih kelas dari nama yang ambigu |
| **Panel Salin** — daftar kelas tujuan | salah pilih = pertemuan tersalin ke kelas yang keliru |

Yang kedua paling berisiko: menyalin belasan pertemuan ke kelas yang
salah tidak bisa diurungkan sekaligus.

### Kini lima tempat memakai helper yang sama

```
Kelola Kelas · beranda guru · beranda murid
Rekap Nilai · panel Salin
```

### Yang SENGAJA tidak diubah

Judul halaman, tautan balik, dan sidebar tetap menampilkan mapel
**terpisah** — di sana mapel sudah berdampingan dengan keterangan lain
("PKPJ · 3 materi pokok · 15 pertemuan"), dan menggabungkannya justru
menggandakan. Uji menjaga keputusan itu supaya tidak "dirapikan"
keliru kelak.

### Berkas uji

`run64` kini **22 poin** (dari 18), dengan bagian C2 baru. Dibuktikan
MERAH pada dua cabang: kartu Rekap dan panel Salin masing-masing
dikembalikan ke nama saja.

### Catatan

Pertanyaan sederhana Anda menemukan dua kelalaian yang tidak
tertangkap uji manapun — uji v1.9.6 hanya memeriksa tiga kartu yang
saya tahu, bukan seluruh layar yang menampilkan nama kelas.

Ini pola yang berulang di proyek ini: **yang paling sering menemukan
kekurangan adalah pemakaian nyata, bukan daftar periksa saya.**
---

## ▶ Video YouTube di materi — dan 🔴 lubang keamanan yang ikut ketahuan (v1.9.8)

**Permintaan Anda:** menyisipkan video YouTube ke materi, dengan
pemutar yang bisa fullscreen.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Util.gs` | 🔴 **Wajib — keamanan** | penjaga domain iframe diperbaiki |
| `v_editor.html` | 🔴 **Wajib** | tombol ▶ Video di toolbar |
| `js_editor.html` | 🔴 **Wajib** | pengurai tautan + pembangun iframe |
| `css.html` | 🔴 **Wajib** | `.bingkai-video` |
| `Code.gs` | 🟡 | 3 penanda (total **88**) · versi `1.9.8` |

> **Tidak perlu migrasi.**

### Ternyata separuhnya sudah ada

Saya menduga ini pekerjaan besar. Ternyata tidak:

| Bagian | Keadaan sebelum rilis ini |
|---|---|
| YouTube di daftar iframe izin | ✅ ada sejak awal |
| Rasio 16:9 layar guru & murid | ✅ ada di CSS |
| **Fullscreen** | ✅ bawaan pemutar YouTube |

Yang belum ada hanya **jalan mudah menyisipkannya**.

### Tombol ▶ Video

Di toolbar editor, sejajar 🖼 Gambar. Tempel tautan YouTube bentuk
apa pun — sembilan bentuk dikenali:

```
youtube.com/watch?v=ABC     youtu.be/ABC        youtube.com/shorts/ABC
youtube.com/embed/ABC       youtube.com/live/ABC
m.youtube.com/watch?v=ABC   tanpa https://      ID-nya saja
youtu.be/ABC?t=90           ← penanda waktu ikut terbawa
```

Yang bukan YouTube ditolak dengan pesan jelas, bukan menyisipkan
iframe rusak diam-diam.

### Dua keputusan kecil yang berdampak

**`youtube-nocookie.com`**, bukan `youtube.com` — murid tidak
ditandai untuk iklan personal.

**`rel=0`** — menahan saran video dari kanal lain setelah selesai.
Tanpa itu murid bisa terlempar ke video yang tidak ada hubungannya
dengan pelajaran.

### Pencarian video: tidak dikerjakan, dan itu disengaja

Permintaan awal Anda memuat pencarian rekomendasi. Setelah
ditelusuri bersama, Anda memilih penyisipan saja. Alasannya tetap
berlaku:

- YouTube Data API butuh **key baru** dengan kuota **100
  pencarian/hari**
- Yang benar-benar menghemat waktu adalah **menyisipkan**, bukan
  mencari — Anda tetap harus menonton videonya lebih dulu

Bila kelak berpindah tab terasa mengganggu, pencarian bisa
ditambahkan di atas ini tanpa membongkar apa pun.

### 🔴 Lubang keamanan yang ditemukan saat membangunnya

Penjaga iframe memakai pencocokan longgar:

```js
src.indexOf(domain) !== -1        // ← lolos
```

Sehingga alamat berikut **diterima** sebagai YouTube:

```
https://youtube.com.jahat.id/x      domain lain, kata cocok
https://jahat.id/?a=youtube.com     hanya di parameter
```

Penyerang cukup menaruh nama domain izin di mana pun pada alamatnya.
Bug ini ada **sejak Tahap 4** dan tidak pernah tertangkap — uji yang
ada hanya mencoba domain yang jelas-jelas berbeda, tidak pernah yang
berakhiran palsu.

Kini host-nya diurai dan dicocokkan **sama persis atau subdomain
sah**. `https://` juga diwajibkan.

> **Siapa yang bisa memanfaatkannya?** Hanya guru — murid tidak
> pernah menulis HTML. Jadi risikonya rendah dalam pemakaian Anda.
> Tetapi penjaga yang bocor tetap harus ditutup: ia satu-satunya
> yang berdiri antara konten dan peramban murid.

Aturan baru §6.2 no. 66.

### Berkas uji

`test/run65-video-youtube.js` BARU — **50 poin, 7 bagian**, memuat
`js_editor.html` sungguhan (fungsi diuji, bukan disalin).

| Bagian | Yang dijaga |
|---|---|
| A | sembilan bentuk tautan dikenali |
| B | yang bukan YouTube ditolak |
| C | penanda waktu (`?t=90`, `1m30s`, `1h2m3s`) |
| D | nocookie · fullscreen · rel=0 · lazy |
| E | iframe bertahan melewati sanitasi server |
| F | **12 pemeriksaan penjaga domain** |
| G | tombol terpasang; rasio 16:9 di kedua layar |

Dibuktikan MERAH pada tiga cabang: penjaga kembali ke `indexOf`
(**4 gagal** — termasuk domain berakhiran palsu), `youtube.com` biasa
dipakai (1), tombol dihapus (1).
---

## ▦ Tabel: ukuran dapat ditentukan (v1.9.9)

**Laporan Anda:** *"pada kotak isi konten, saya kesulitan membuat
tabel, tidak bisa menentukan jumlah kolom dan baris"*

Benar. Tombol ▦ menyisipkan tabel yang **dipaku 2×2**, dan tidak ada
cara mengubahnya sesudahnya. Untuk tabel 4 kolom, Anda harus
menyunting HTML mentah — yang memang tidak pernah dirancang untuk
dilakukan.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_editor.html` | 🔴 **Wajib** | dialog ukuran + alat baris/kolom |
| `v_editor.html` | 🔴 **Wajib** | 4 tombol baru di toolbar |
| `css.html` | 🔴 **Wajib** | `.alat-tabel`, sel kosong dapat diklik |
| `Code.gs` | 🟡 | 3 penanda (total **91**) · versi `1.9.9` |

> **Tidak perlu migrasi.**

### 1. Dialog ukuran sebelum menyisipkan

Menekan ▦ kini menanyakan: **berapa baris**, **berapa kolom**, dan
**pakai baris kepala atau tidak**. Maksimal 12×12 — di atas itu tabel
tidak terbaca di ponsel murid.

### 2. Empat tombol untuk tabel yang sudah ada

| Tombol | Kerjanya |
|---|---|
| **+↓** | tambah baris di bawah kursor |
| **−↓** | hapus baris tempat kursor |
| **+→** | tambah kolom di kanan kursor |
| **−→** | hapus kolom tempat kursor |

Klik di sel mana pun, lalu tekan tombolnya. Bekerja juga pada **tabel
lama** yang sudah terlanjur 2×2 dan **tabel hasil AI** — keduanya
tidak punya penanda khusus, jadi alatnya sengaja tidak bergantung
pada apa pun selain struktur tabelnya.

### Penjaga supaya tabel tidak jadi rusak

| Keadaan | Yang terjadi |
|---|---|
| Menghapus baris isi terakhir | ditolak — *"minimal satu baris isi"* |
| Menghapus kolom terakhir | ditolak |
| Menghapus baris kepala | ditolak — Anda akan mengira tabelnya rusak |
| Melewati 12 baris/kolom | ditolak dengan alasannya |
| Kursor di luar tabel | *"Klik dulu di dalam tabel"* — bukan diam saja |

### Satu jebakan yang mudah terlewat

Membuka dialog **memindahkan fokus keluar dari editor**, sedangkan
penyisipan terjadi di posisi kursor. Tanpa penanganan khusus, tabel
mendarat di **awal dokumen** — bukan di tempat Anda menaruh kursor.

Posisi kursor kini disimpan sebelum dialog dibuka dan dipulihkan
sesudahnya. Uji menjaganya secara khusus.

### Berkas uji

`test/run66-tabel-editor.js` BARU — **52 poin, 8 bagian**, menjalankan
tabel sungguhan di DOM (bukan memeriksa teks kode).

| Bagian | Yang dijaga |
|---|---|
| A | ukuran mengikuti permintaan; kepala opsional |
| B | angka tak masuk akal dijepit |
| C | dialog menanyakan ukuran; Batal tidak menyisipkan |
| D | tambah/hapus baris & kolom benar-benar bekerja |
| E | lima penjaga anti-rusak |
| F | kursor di luar tabel diberi tahu |
| G | **tabel lama & tabel tanpa kepala tetap bisa diubah** |
| H | tombol terpasang; jangkar kursor ada |

Dibuktikan MERAH pada tiga cabang: tabel dipaku 2×2 lagi (2 gagal),
penjaga baris terakhir dibuang (2), jangkar kursor dihapus (1).

### Yang ikut ketahuan dari ujinya

Bagian B menangkap kelemahan pada versi pertama saya: mengetik `0`
menghasilkan **3**, bukan **1**. Guru yang mengetik 0 bermaksud
"sekecil mungkin"; mengembalikan 3 terasa seperti isiannya diabaikan.
Kini bawaan hanya dipakai bila isiannya benar-benar kosong.

`pratinjau-tabel.html` BARU — memperagakan toolbar, dialog, dan hasil
di layar guru maupun murid.
---

## &lt;/&gt; Mode sunting HTML (v1.9.10)

**Permintaan Anda:** *"tambahkan menu edit html"*

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `v_editor.html` | 🔴 **Wajib** | tombol `</> HTML` + textarea |
| `js_editor.html` | 🔴 **Wajib** | pengalih mode + penyamaan isi |
| `css.html` | 🔴 **Wajib** | `.editor-html`, `.btn-alat.aktif` |
| `Code.gs` | 🟡 | 3 penanda (total **94**) · versi `1.9.10` |

> **Tidak perlu migrasi.**

### Pengalih tampilan, bukan dialog

Tombol **`</> HTML`** di ujung kanan toolbar. Textarea menggantikan
editor visual **di tempat yang sama** — bukan dialog terpisah.

Dialog memaksa menyalin-tempel bolak-balik, dan pekerjaan mudah
hilang bila lupa menekan Terapkan. Di sini cukup menekan tombolnya
lagi (berubah jadi **👁 Visual**) untuk kembali.

### Yang dijaga

**Menekan Simpan saat masih di mode HTML tetap aman.** Ini bahaya
terbesarnya: bila isi textarea tidak disamakan lebih dulu, seluruh
suntingan hilang tanpa pesan apa pun. Penyamaan dipasang pada jalur
**Simpan** dan **Pratinjau**.

**Tombol format dikelabukan** di mode HTML — menekan Tebal pada teks
mentah tidak melakukan apa-apa, dan Anda akan mengira editornya rusak
(§6.2 no. 20).

**Penanda `<!--bagian-->` tampil apa adanya**, jadi Anda bisa
memindahkan pemisah materi lewat kode. Cacah bagian ikut diperbarui
saat mengetik.

### Keamanan tidak berubah

Kode yang Anda ketik **tetap melewati `Util.sanitasi()`** di server.
Mode ini memberi kendali lebih, bukan melewati penjaga — tag
berbahaya dan iframe dari domain tak dikenal tetap dibuang
(lihat v1.9.8).

### Dua bug yang ditemukan ujinya sendiri

**1. Selektor toolbar salah.** Saya menulis `.editor-alat`, padahal
kelasnya `editor-bar` dengan id `ed-alat`. Akibatnya tombol format
**tidak pernah benar-benar dikelabukan** — fitur yang saya kira sudah
jalan.

**2. Galat diam di penangan klik.** `ReferenceError` di dalam
`onclick` tidak menggagalkan uji — ia hanya tercetak ke stderr,
sementara ujinya tetap "hijau". Ditambahkan penangkap
`uncaughtException` supaya galat semacam itu menjadi **merah yang
terbaca**.

Yang kedua ini pola berbahaya: uji hijau sambil menyembunyikan
kerusakan.

### Berkas uji

`test/run67-mode-html.js` BARU — **39 poin, 9 bagian**, memuat
toolbar dari `v_editor.html` sungguhan.

| Bagian | Yang dijaga |
|---|---|
| A | tombol & textarea terpasang, tersembunyi bawaan |
| B | berpindah mode dua arah |
| C | suntingan HTML benar-benar masuk |
| D | **Simpan saat di mode HTML tidak kehilangan apa pun** |
| E | penanda bagian utuh dua arah |
| F | tombol format dikelabukan |
| G | cacah bagian diperbarui |
| H | penyamaan terpasang di Simpan & Pratinjau |
| I | tidak ada galat diam di penangan |

Dibuktikan MERAH pada tiga cabang: penyamaan Simpan dibuang,
pengelabuan tombol dihapus, tombol HTML dihapus dari toolbar.

`pratinjau-mode-html.html` BARU.

---

## 🔴 Tombol "Visual" tidak kelihatan (v1.9.11)

**Laporan Anda:** *"tombol visual tidak kelihatan"*

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `css.html` | 🔴 **Wajib** | 3 warna diperbaiki — hanya itu |
| `Code.gs` | 🟡 | versi `1.9.11` (penanda tetap **94**) |

> **Tidak perlu migrasi.** Cukup satu berkas: `css.html`.

### Sebab: warna yang tidak pernah ada

```css
.btn-alat.aktif {
  background: var(--utama);   /* --utama TIDAK ADA → dibuang */
  color: #fff;                /* TETAP BERLAKU               */
}
```

Palet LessonLen bernama `--hijau`, `--hijau-tua`, `--hijau-muda`.
**`--utama` tidak pernah ada di `:root`.**

Variabel CSS yang tidak terdefinisi tidak melahirkan galat dan tidak
membatalkan seluruh aturan — peramban hanya membuang deklarasi yang
memakainya, lalu meneruskan sisanya. Jadi latarnya tetap tembus
pandang sementara `color: #fff` tetap berlaku: **tulisan putih di
atas toolbar putih**.

Tombolnya sebenarnya masih ada dan masih bisa diklik selama ini —
hanya tidak terlihat begitu mode HTML menyala.

### Dua korban lain dari salah ketik yang sama

Uji menemukan lebih banyak daripada yang Anda laporkan:

| Tempat | Semula | Akibat |
|---|---|---|
| `.btn-alat.aktif` | `--utama` | tombol **👁 Visual** lenyap |
| `.editor-html` | `--latar-lembut` | kotak kode HTML rata putih, tak beda dari editor biasa |
| `table *:focus` | `--utama` | **sel tabel aktif tidak pernah tersorot** — sejak v1.9.9 |

Yang ketiga paling merugikan: tombol `+↓ −↓ +→ −→` bekerja pada sel
tempat kursor berada, dan penanda sel itu **belum pernah sekali pun
tampil sejak dibuat**. Menambah baris jadi menebak-nebak.

Ketiganya kini memakai `--hijau-tua` / `--permukaan`.

### Penjaga baru

`test/run68-variabel-css.js` — **15 penanda**. Mengumpulkan seluruh
definisi di `:root`, lalu memastikan setiap `var(--x)` menunjuk salah
satunya. Bentuk `var(--x, #f1f5f9)` yang punya nilai cadangan
dikecualikan — itu sah, dan memang dipakai `.jam-quiz`, `.huruf-opsi`,
`.kotak-jawaban`.

Dibuktikan MERAH dua kali: `--utama` disisipkan ulang ke
`.btn-alat.aktif` (4 penanda merah, nomor baris tepat), lalu ke sorot
sel tabel.

Dua temuan pertama uji ini justru **cacat uji, bukan bug** — nomor
baris meleset karena komentar diruntuhkan, dan `var(--x, cadangan)`
salah dituduh. Keduanya diperbaiki sebelum uji dipakai.

`pratinjau-tombol-aktif.html` BARU — toolbar sebelum & sesudah
berdampingan, memakai palet asli dari `css.html`.

**Aturan §6.2 no. 67** ditambahkan: nama variabel CSS adalah kontrak,
salah ketik gagal diam-diam.

---

## ↩️ Kuis Mandiri dibatalkan + perbaikan diagnostik (v1.9.11)

**Permintaan Anda:** *"kembalikan semua kode ke versi sebelum penambahan
kuis mandiri"*

Seluruh Kuis Mandiri dicabut. Kode kembali ke **v1.9.11**.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Setup.gs` | 🔴 **Wajib** | kolom `bebas_urutan` dicabut dari skema |
| `Belajar.gs` `MateriPokok.gs` | 🔴 **Wajib** | buka-kunci kembali seperti semula |
| `Pertemuan.gs` `Rekap.gs` `Util.gs` | 🔴 **Wajib** | pencabutan yang sama |
| `js_editor.html` | 🔴 **Wajib** | tombol 🎯 Kuis Mandiri dihapus |
| `Auth.gs` | 🔴 **Wajib** | ekspor `_buatSesi` untuk diagnostik |
| `Code.gs` | 🔴 **Wajib** | API & `ujiTahap18()` dicabut · perbaikan diagnostik · versi `1.9.11` |

**Hapus dari editor Apps Script:** file `KuisMandiri.gs`.

Setelah disalin, `cekBerkasUI()` → **95 penanda**.

### ❓ Apakah struktur database perlu dikembalikan?

**Tidak perlu.** Biarkan saja kolom `bebas_urutan` yang terlanjur ada di
sheet `materi_pokok` dan `pertemuan`.

`Db.header()` membaca nama kolom dari **baris header**, lalu seluruh
operasi memetakan lewat nama itu — bukan lewat nomor kolom. Kolom yang
tidak dikenal hanya terbaca sebagai medan kosong dan diabaikan.

Menghapus kolom secara manual justru **lebih berisiko**: satu kolom
salah hapus akan menggeser seluruh data di sebelahnya.

Dijaga `test/run69-kolom-sisa.js` (**10 penanda**) yang meniru persis
kondisi spreadsheet Anda — kolom sisa ada, kode tidak mengenalnya —
lalu memastikan daftar bab, buka-kunci, Rekap, dan Beranda tetap benar.

### 🔴 Bug diagnostik dari log lapangan Anda

```
=== UJI TAHAP 18 ===
❌ Login guru gagal — hentikan.
```
> *"tapi saya coba login di web berhasil"*

Betul, dan aplikasinya memang sehat. Yang rusak **alat ukurnya**.

**17 fungsi diagnostik** memanggil `Auth.login('guru', 'guru123')` —
password **seed**. Anda sudah lama menggantinya (memang diwajibkan
sistem), jadi sejak saat itu **seluruh `ujiTahapN()` mati di baris
pertama**. Gejalanya berbunyi seperti kerusakan berat padahal bukan.

Diperbaiki dengan `_sesiGuruDiagnostik()` yang membuat sesi langsung
dari baris `users`, tanpa menyentuh password. Aman: fungsi diagnostik
hanya dapat dijalankan dari editor Apps Script.

Dijaga `test/run70-diagnostik-tanpa-sandi.js` (**19 penanda**) — sandi
guru sungguh diganti di tengah uji, lalu dipastikan diagnostik tetap
jalan. Dibuktikan merah dengan mengembalikan `Auth.login()` lama.

### 🔴 `cekKesehatan()` melewatkan 2 sheet

Daftar sheet ditulis harfiah dan lupa memuat **`materi_pokok`** dan
**`kelompok`** — dua sheet yang justru paling sering bermasalah. Kini
dibaca dari `URUTAN_SHEET`, jadi tidak bisa basi lagi.

Pesan galatnya juga diperjelas: *"modul Kelompok TIDAK ADA"* sekarang
disertai petunjuk bahwa artinya berkas `Kelompok.gs` belum ada di
editor Apps Script.

> **Catatan:** modul `Kelompok` yang hilang di log Anda berasal dari
> fitur Tugas Kelompok (v1.7.x), **bukan** dari Kuis Mandiri.

---

## 🩪 Biodata murid — NISN, email, WhatsApp (v1.10.0) — TAHAP 1

**Permintaan Anda:** *"saya ingin agar murid melengkapi biodatanya
meliputi: NISN, email, dan nomer WA"*

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `v_biodata.html` | 🔴 **BARU** | buat file baru di editor |
| `Setup.gs` | 🔴 **Wajib** | kolom `nisn` & `no_wa` di `users` |
| `Util.gs` | 🔴 **Wajib** | `normalisasiWa` `emailSah` `nisnSah` `biodataLengkap` |
| `Auth.gs` | 🔴 **Wajib** | login mengirim `biodata_kurang` |
| `Kelas.gs` | 🔴 **Wajib** | `biodataSaya()` `simpanBiodata()` |
| `js_auth.html` | 🔴 **Wajib** | rute `#/biodata` + penundaan |
| `js_beranda.html` | 🔴 **Wajib** | spanduk pengingat |
| `js_core.html` `index.html` | 🔴 **Wajib** | pendaftaran rute & template |
| `Code.gs` | 🔴 **Wajib** | 2 API · `ujiTahap18()` · versi `1.10.0` |

> ⚠️ **Jalankan `migrasiStruktur()` sekali** setelah menyalin. Tanpa itu
> kolom `nisn` & `no_wa` belum ada, dan penyimpanan gagal **diam-diam**.

Setelah disalin: `cekBerkasUI()` → **98 penanda**, lalu `ujiTahap18()`.

### Keputusan Anda yang diterapkan

| Hal | Pilihan |
|---|---|
| Paksaan | diingatkan, **boleh ditunda** |
| Validasi | email & WA ketat, **NISN longgar** |
| Guru | lihat, ubah, + ekspor *(Tahap 2)* |
| Untuk siapa | **murid saja** |

### Alurnya (diperbarui v1.10.1)

```
Login → (ganti sandi bila perlu) → BERANDA
                                      │
                    biodata belum lengkap?
                                      │ ya
                          ┌───────────▼────────────┐
                          │ DIALOG muncul otomatis │
                          │  [Nanti Saja] [Simpan] │
                          └───────────┬────────────┘
                                      │ ditunda
                    ┌─────────────────▼──────────────────┐
                    │ 🪪 spanduk di beranda              │
                    │              [Lengkapi]  [Nanti ×] │
                    └────────────────────────────────────┘
```

Spanduk memakai `.panel-tindakan` yang **sudah ada** (dipakai antrean
koreksi di beranda guru), jadi tidak ada gaya baru yang perlu dirawat.

### Nomor WhatsApp dirapikan otomatis

Murid boleh mengetik sekenanya; yang tersimpan selalu satu bentuk:

| Diketik | Tersimpan |
|---|---|
| `081234567890` · `+62 812-3456-7890` · `(0812) 3456 7890` · `81234567890` | `6281234567890` |
| `12345` | ditolak — bukan nomor HP |

Perapian dilakukan di **server**, bukan klien. Kalau di klien, ekspor
Anda nanti berisi campuran `08xx` dan `62xx` yang tidak bisa dijadikan
tautan `wa.me`.

### Tiga keputusan rancangan

1. **Tidak ada kolom `biodata_lengkap`.** Statusnya *dihitung* dari
   terisinya email + WA. Menyimpan sesuatu yang bisa dihitung membuatnya
   cepat tidak sinkron — begitu Anda membetulkan email murid lewat
   Kelola Murid, penandanya akan tertinggal.
2. **`cekSesi` membaca status segar dari sheet.** Sesi di-cache satu
   jam; kalau statusnya ikut disimpan di sana, murid yang baru mengisi
   tetap dianggap kurang sampai cache kedaluwarsa — spanduknya muncul
   terus dan terasa seperti simpanannya gagal.
3. **Penundaan di `localStorage`, bukan server.** Bila di server, murid
   yang menekan "Nanti" sekali tidak akan pernah diingatkan lagi.

### Keamanan

`simpanBiodata` **hanya menyentuh baris milik pemanggil** — ia tidak
menerima `user_id` dari klien. Tanpa itu, murid mana pun bisa menimpa
data temannya hanya dengan mengubah satu nilai di DevTools. Dijaga
penanda tersendiri di bagian G `run71`.

### Pengujian

`run71-biodata-murid.js` (**55 penanda**) · `run72-ui-biodata.js`
(**43 penanda**) · `ujiTahap18()` untuk Apps Script sungguhan.

Dibuktikan MERAH pada lima cabang: `user_id` klien dipercaya (lubang
keamanan), WA tidak dinormalkan server, `cekSesi` membaca cache basi,
tombol Nanti mengeluarkan akun, spanduk muncul untuk guru.

`pratinjau-biodata.html` BARU.

### ⏳ Tahap 2 — belum dikerjakan

Sesuai kesepakatan bertahap: kolom NISN & No. WA di layar **Kelola
Murid** (guru bisa mengedit) dan tombol **Ekspor Biodata** sekelas.
Dikerjakan setelah Anda mencoba Tahap 1 di Apps Script.

---

## 🩪 Dialog biodata muncul saat login (v1.10.1)

**Permintaan Anda:** *"buat pada saat login, langsung menampilkan kotak
dialog lengkapi biodata"*

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_auth.html` | 🔴 **Wajib** | `dialogBiodata()` + dipanggil saat login |
| `Auth.gs` | 🔴 **Wajib** | login membawa isi biodata yang sudah ada |
| `js_core.html` | 🔴 **Wajib** | status bertahan setelah muat ulang halaman |
| `js_beranda.html` | 🔴 **Wajib** | tombol spanduk membuka dialog yang sama |
| `Code.gs` | 🟡 | versi `1.10.1` (penanda tetap **98**) |

> Tidak perlu migrasi lagi bila `migrasiStruktur()` sudah dijalankan.

### Yang berubah

Dialog muncul **otomatis 350 ms setelah beranda tergambar**. Jeda itu
disengaja: `pergiKe()` memicu router yang menimpa isi halaman, jadi
dialog yang dibuka lebih awal akan berkedip di atas layar login yang
sedang berganti.

Menekan **Nanti Saja** hanya menutup dialog — murid tetap di beranda,
tidak dikeluarkan. Spanduk lama tetap ada sebagai pengingat kedua bila
ditunda.

Tombol **Lengkapi** di spanduk kini membuka **dialog yang sama**, bukan
pindah halaman. Satu bentuk isian saja yang perlu dirawat; layar penuh
`#/biodata` tetap ada sebagai cadangan bila dialognya gagal dimuat.

### Ketikan murid tidak hilang

`dialog()` menutup begitu tombol ditekan. Bila email atau nomor WA
belum benar, dialog **dibuka kembali beserta isinya** — baik saat
ditolak di klien maupun oleh server.

Ini penting justru karena dialognya muncul otomatis: kalau isinya
hilang, murid tidak punya cara mudah memunculkannya lagi
(§6.2 no. 57 — jangan hapus pekerjaan orang sebelum dipastikan
tersimpan).

### Nol panggilan API tambahan

Isi biodata yang sudah ada **ikut dikirim bersama respons login**.
Barisnya toh sudah dibaca server untuk memeriksa kata sandi, jadi tidak
ada biaya tambahan.

Bila dialog memanggil `getBiodataSaya` sendiri, setiap murid menambah
satu permintaan tepat saat login — dan 36 murid masuk bersamaan adalah
kasus nyata di sekolah ini (§6.2 no. 51). Payload itu hanya dikirim
bila biodatanya memang belum lengkap.

### Pengujian

`run71` **58 penanda** · `run72` **65 penanda**.

Dibuktikan MERAH pada dua cabang: dialog tidak dibuka ulang saat gagal
(ketikan murid lenyap), dan dialog tidak dipanggil setelah login.

Dua temuan pertama uji ini ternyata **cacat uji, bukan bug** — saya
memeriksa `id="in-email"` di berkas yang salah, dan satu penanda lama
sudah usang karena tombol spanduk sengaja diubah perilakunya. Keduanya
dibetulkan sebelum uji dipakai.

---

## 🔴 Kolom baru tersimpan kosong setelah migrasi (v1.10.2)

**Laporan Anda:** *"sudah migrasi struktur, tapi uji tahap 18 ada 4
gagal"* — `nisn` dan `no_wa` selalu berisi `""`.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Db.gs` | 🔴 **Wajib** | `invalidasiHeader()` BARU |
| `Setup.gs` | 🔴 **Wajib** | `migrasiStruktur()` memanggilnya |
| `Code.gs` | 🔴 **Wajib** | `ujiTahap18()` menunjuk sebab · versi `1.10.2` |

> **Tidak perlu migrasi ulang** — kolomnya sudah benar terbentuk.
> Cukup salin tiga berkas ini, lalu jalankan `ujiTahap18()` lagi.

### Sebabnya bukan migrasinya — migrasi Anda sudah benar

Petunjuk terpenting ada di log Anda sendiri: **`email` tersimpan
normal**, padahal ketiganya ditulis oleh satu panggilan
`Db.perbarui()` yang sama.

`Db.invalidasi()` sengaja **mempertahankan memo header** demi
kecepatan (optimasi v1.8.7):

```js
var head = _memo[nama] && _memo[nama].__head;
delete _memo[nama];
if (head) _memo[nama] = { __head: head };   // header LAMA tetap
```

Alasannya masuk akal — header hanya berubah saat `migrasiStruktur()`.
Yang terlupa: **tidak ada yang memberi tahu memo itu ketika migrasi
benar-benar mengubahnya.**

Jadi `Db` terus memakai susunan kolom lama:

```
header sesungguhnya : … email, nisn, no_wa, status …
header dipakai Db   : … email, status …          ← dua kolom hilang
```

`tambah()` dan `perbarui()` memetakan objek ke daftar header itu, jadi
kolom yang tidak ada di sana **dibuang diam-diam** — tanpa galat apa
pun. Kolom lama seperti `email` tetap masuk, dan justru itulah yang
membuat gejalanya membingungkan.

### Seberapa parah

Lebih parah dari yang terlihat. Saat saya menyisipkan ulang bug ini
untuk membuktikan uji bisa merah, **login guru pun ikut mati** —
bukan hanya biodata. Anda beruntung hanya menemuinya di
`ujiTahap18()`.

Kelas bug ini juga **tidak khusus sheet `users`**: kolom baru apa pun,
di sheet mana pun, akan mengalami hal yang sama.

### Diagnostik diperbaiki juga

`ujiTahap18()` dulu berkata *"jalankan migrasiStruktur() dulu"* —
nasihat yang **salah**, sebab migrasi Anda memang sudah benar. Kini ia
membaca header dari **dua sumber** dan membandingkannya:

```
✅ kolom `nisn` ada di spreadsheet
❌ header yang DIPAKAI Db sama dengan isi spreadsheet
   → memo header basi — salin ulang Db.gs & Setup.gs
```

### Pengujian

`run73-migrasi-header.js` (**19 penanda**) — meniru persis kondisi
Anda: sheet lama, ada yang membacanya lebih dulu, baru dimigrasi.

Dibuktikan MERAH dengan mencabut perbaikannya: 2 penanda merah,
termasuk "login guru tetap bekerja".

Satu penanda sempat merah karena **cacat uji, bukan bug** — mock tidak
punya `getDataValidation()`, sehingga `migrasiStruktur()` melaporkan
13 perubahan palsu (tepat sejumlah sheet ber-enum). Ujinya diperbaiki
untuk memeriksa jumlah KOLOM, bukan angka kembalian.

**Aturan §6.2 no. 68–69** ditambahkan.

---

## 🔴 Sebab KEDUA: kolom baru mewarisi dropdown (v1.10.3)

**Laporan Anda:** header sudah cocok, kolom sudah ada, tetapi
`nisn` & `no_wa` **tetap** tersimpan `""`.

Diagnosis v1.10.2 benar tetapi **belum lengkap**. Ada dua penyebab
terpisah, dan yang kedua ini yang tersisa.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Setup.gs` | 🔴 **Wajib** | bersihkan validasi kolom baru + pemulih |
| `Code.gs` | 🟡 | versi `1.10.3` |

> ⚠️ **Jalankan `migrasiStruktur()` sekali lagi** setelah menyalin.
> Kali ini bukan untuk menambah kolom — melainkan **memulihkan** kolom
> yang terlanjur rusak di spreadsheet Anda.
>
> Laporannya akan berbunyi seperti:
> `~ users   2 kolom dibebaskan dari dropdown warisan`

### Sebabnya

`insertColumnBefore()` di Google Sheets **mewarisi format dan
validasi** dari kolom tetangganya. Pada sheet `users`:

```
… rombel, email, [nisn], [no_wa], status, …
                                  ^^^^^^ enum ['aktif','nonaktif']
```

Kedua kolom baru disisipkan **tepat sebelum `status`**, sehingga ikut
mewarisi dropdown-nya lengkap dengan `setAllowInvalid(false)`.

Sheets lalu menolak setiap nilai di luar `aktif`/`nonaktif` — dan
penolakan itu **tidak melempar galat apa pun**. Selnya diam-diam tetap
kosong. Itulah sebabnya `Kelas.simpanBiodata()` melaporkan berhasil
sementara selnya kosong.

`email` selamat karena posisinya di kiri, di luar jangkauan warisan.

### Ini pengulangan bug lama

Kelas bug yang sama pernah menghilangkan notifikasi `refleksi_dibalas`
di v1.2.0 — dan catatannya bahkan **sudah tertulis di dalam
`migrasiStruktur()` sendiri**. Catatan itu tidak mencegah pengulangan
karena hanya bicara tentang enum yang *bertambah*, bukan kolom baru
yang *mewarisi*.

### Perbaikan: mencegah DAN memulihkan

1. **Mencegah** — setiap kolom yang baru disisipkan dibersihkan
   validasinya sebelum dipakai.
2. **Memulihkan** — setiap kali migrasi dijalankan, semua kolom
   non-enum dipastikan bebas dropdown. Tanpa ini Anda harus
   membersihkan dropdown manual di spreadsheet, sebab menyalin kode
   tidak menyentuh data yang sudah terlanjur salah.

Kolom yang **memang** ber-enum (`role`, `status`,
`harus_ganti_password`) tetap terjaga — ada penanda khusus untuk itu.

### Kenapa uji lama tidak menangkapnya

`mock2` mengabaikan `setDataValidation()` sepenuhnya, jadi seluruh
akibat validasi tidak pernah teruji — dua bug lapangan lolos karena
ini.

`test/mock5.js` **BARU**: meniru penolakan diam-diam Google Sheets,
termasuk pewarisan validasi saat kolom disisipkan.

### Pengujian

`run74-validasi-kolom.js` (**29 penanda**) dengan `mock5`.

Dibuktikan MERAH dua kali: pencegahnya dicabut (6 penanda merah,
gejalanya persis `sel berisi: ""`), lalu pemulihnya dicabut (2 merah).

Versi pertama uji ini sempat **hijau palsu** walau perbaikannya
dicabut — validasi terpasang di indeks yang salah karena memakai
posisi skema baru pada sheet lama. Cacat itu dibetulkan sebelum uji
dipakai (§6.2 no. 5).

**Aturan §6.2 no. 70–72** ditambahkan.

---

## 🔴 Sebab KETIGA: nol di depan NISN hilang (v1.10.4)

**Laporan Anda:** `❌ NISN tersimpan → sel berisi: "98765432"` —
padahal yang dikirim `0098765432`.

Dua nol di depan hilang. Sisanya sudah hijau.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Setup.gs` | 🔴 **Wajib** | medan `teks:` + `_pasangFormatTeks()` |
| `Code.gs` | 🟡 | `ujiTahap18()` menunjuk sebab · versi `1.10.4` |

> ⚠️ **Jalankan `migrasiStruktur()` sekali lagi** — untuk memasang
> format teks pada kolom yang sudah terlanjur berformat bilangan.

### Sebabnya

Google Sheets menafsirkan string yang seluruhnya angka sebagai
**bilangan**. `"0098765432"` menjadi `98765432` — nol terdepan tidak
punya arti pada bilangan, jadi dibuang.

Tidak ada galat, tidak ada peringatan. Nilainya sekadar berubah.

Nomor WA lolos hanya karena kebetulan diawali `62`. Nomor 13 digit
sebenarnya juga berisiko berubah jadi notasi ilmiah.

### Perbaikan

SKEMA kini punya medan `teks:` — daftar kolom yang isinya angka tetapi
harus diperlakukan sebagai teks:

```js
teks: ['nisn','no_wa','username','pwd_awal','rombel']
```

`_pasangFormatTeks()` memasang `setNumberFormat('@')` pada kolom itu,
dan dipasang ulang setiap migrasi — sama seperti pembersihan dropdown
v1.10.3, sebab kolom yang terlanjur dibuat versi lama masih berformat
bilangan.

Daftarnya **eksplisit, bukan ditebak dari nama kolom**. Lebih mudah
ditelusuri saat suatu saat kolom baru ditambahkan.

### ⚠️ Satu hal yang perlu Anda tahu

Format hanya berlaku untuk penulisan **berikutnya**. NISN yang
terlanjur kehilangan nol **tidak dapat dipulihkan otomatis** — nol
yang hilang tidak meninggalkan jejak.

Untungnya belum ada murid sungguhan yang mengisi NISN; yang terkena
hanya data uji, dan itu dihapus sendiri oleh `ujiTahap18()`.

### Pengujian

`run74` naik ke **33 penanda** — bagian E3 khusus menguji nol di
depan, memakai `mock5` yang kini meniru penafsiran angka Sheets.

Dibuktikan MERAH dengan mengosongkan daftar `teks:` — 3 penanda merah
dengan gejala persis log Anda: `sel berisi: "98765432"`.

Ada pembanding hidup di dalamnya: kolom `nama` yang TIDAK berformat
teks memang harus kehilangan nol. Tanpa penanda itu, mock yang tidak
meniru apa-apa akan lolos diam-diam.

**Aturan §6.2 no. 73** ditambahkan.

---

## ✅ Biodata TERVERIFIKASI di lapangan + log dirapikan (v1.10.5)

**Laporan Anda:** *"sudah berhasil"* — `ujiTahap18()` **18/18 hijau**
di Apps Script sungguhan.

Biodata murid resmi bekerja: kolom terbentuk, nilai tersimpan utuh,
NISN mempertahankan nol depannya, dan status biodata segar.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Code.gs` | 🟢 **Opsional** | log diagnostik dirapikan · versi `1.10.5` |

> Tidak ada perubahan perilaku aplikasi. Salin bila Anda ingin log
> `ujiTahapN()` yang lebih bersih.

### Cacat kecil yang saya temukan di log Anda

Log yang seluruhnya hijau itu berbunyi:

```
✅ kolom `nisn` ada di spreadsheet  jalankan migrasiStruktur() lebih dulu
✅ cekSesi tidak lagi meminta biodata  spanduk akan muncul terus walau sudah diisi
```

**Nasihat kegagalan tercetak di samping tanda ✅.** Semuanya benar,
tetapi log-nya berbunyi seperti masih ada masalah. Pembaca yang
menyapu sekilas bisa salah paham — dan itu menurunkan kepercayaan pada
seluruh laporan.

Sebabnya `cek(label, syarat, info)` mencetak `info` di kedua keadaan,
sementara isinya ditulis sebagai nasihat.

Kini dipisah:

```js
cek(label, syarat, data, sebab)
//   data  — fakta terukur, dicetak SELALU   'sel berisi: "62812…"'
//   sebab — nasihat, HANYA saat gagal       'ulangi migrasiStruktur()'
```

Angka yang memang berguna dilihat saat hijau — isi sel, lama detik —
tetap tampil.

### Pengujian

`run75-pesan-diagnostik.js` (**12 penanda**) mengurai argumen ketiga
tiap panggilan `cek()` dan menolak yang berbentuk kalimat perintah
atau ramalan akibat.

Uji ini langsung menangkap satu kebocoran yang saya lewatkan sendiri
pada pemeriksa NISN. Dibuktikan MERAH dengan mengembalikan `cek()`
satu parameter — 4 penanda merah.

**Aturan §6.2 no. 74** ditambahkan.

---

## Rangkuman: biodata murid selesai

Empat versi, tiga di antaranya bug lapangan yang muncul berlapis:

| Versi | Lapisan | Gejala |
|---|---|---|
| 1.10.0 | fitur | kolom + layar + spanduk |
| 1.10.1 | UI | dialog muncul saat login |
| 1.10.2 | 🔴 memo header basi | kolom baru dibuang saat menulis |
| 1.10.3 | 🔴 dropdown warisan | nilai ditolak diam-diam |
| 1.10.4 | 🔴 format bilangan | nol depan NISN hilang |
| 1.10.5 | log | nasihat gagal muncul di baris hijau |

Ketiga bug punya sifat yang sama: **gagal tanpa galat**. Tidak satu
pun tertangkap uji lama karena `mock2` tidak meniru satu pun perilaku
Sheets tersebut. `mock5.js` kini meniru ketiganya.

### ⏳ Tahap 2 biodata — belum dikerjakan

Kolom NISN & No. WA di layar **Kelola Murid** (guru dapat mengedit)
dan tombol **Ekspor Biodata** sekelas, sesuai kesepakatan bertahap.

---

## 🩪 Biodata Tahap 2 — sisi guru (v1.11.0)

**Kesepakatan Anda:** *"lihat, ubah, + bisa diekspor"*

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Kelas.gs` | 🔴 **Wajib** | biodata di `daftarMurid` · guru dapat mengedit · `csvBiodata()` |
| `js_kelola.html` | 🔴 **Wajib** | kolom Biodata · medan NISN/WA di form · tombol Ekspor |
| `Code.gs` | 🔴 **Wajib** | API `unduhCsvBiodata` · `ujiTahap18()` bagian G · versi `1.11.0` |

> **Tidak perlu migrasi.** Kolomnya sudah ada sejak v1.10.0.

Setelah disalin: `cekBerkasUI()` → **100 penanda**, lalu `ujiTahap18()`.

### 1. Kolom Biodata di Kelola Murid

| Nama | Rombel | Pengguna | **Biodata** | Status |
|---|---|---|---|---|
| Ahmad Fauzi | XI TJKT 1 | `siswa01` | 🟢 lengkap 💬 WA | aktif |
| Bella Kusuma | XI TJKT 1 | `siswa02` | 🟡 belum | aktif |

Sekilas terlihat siapa yang belum mengisi, dan tombol **💬 WA** langsung
membuka percakapan WhatsApp.

NISN & email selengkapnya sengaja **tidak** ditaruh di tabel — akan
terlalu lebar di ponsel. Keduanya ada di form **Ubah**.

### 2. Guru dapat membetulkan

Form Ubah Murid kini punya medan **NISN** dan **Nomor WhatsApp**.
Aturannya sengaja **lebih longgar** daripada layar murid:

| | Murid | Guru |
|---|---|---|
| Email & WA | wajib | boleh dikosongkan |
| Nomor dirapikan server | ✅ | ✅ |

Guru perlu bisa **menghapus** data yang salah ketik; murid tidak boleh
mengosongkan miliknya sendiri. Nomor tetap dirapikan di server dari
jalur mana pun — kalau tidak, ekspor berisi campuran `08xx` dan `62xx`.

### 3. Tombol 🪪 Biodata

Menghasilkan CSV berisi: No · Nama · Rombel · Kelas-Mapel · NISN ·
Email · No. WhatsApp · **Tautan WhatsApp** · Kelengkapan.

Dua hal yang saya jaga khusus:

1. **Tanpa kata sandi.** Sengaja dipisah dari tombol **⬇ CSV**. Berkas
   biodata sering dibagikan atau dibuka di ponsel; menggabungkannya
   berarti setiap kali Anda butuh nomor WA, seluruh kata sandi murid
   ikut terbawa.
2. **NISN diawali apostrof** (`'0012345678`) supaya Excel dan Sheets
   membacanya sebagai teks. Tanpa itu nol depannya hilang saat berkas
   dibuka — pengulangan bug v1.10.4, kali ini di sisi pembaca berkas.

Setelah unduh, notifikasinya menyebut berapa yang sudah lengkap.

### 🔴 Bug yang ikut ketahuan

`simpanMurid()` mewajibkan `nama` **juga saat mengedit**, padahal edit
memakai `Util.isiBilaAda()` yang justru dirancang untuk pembaruan
sebagian. Akibatnya guru yang hanya ingin membetulkan nomor WA ditolak
dengan pesan membingungkan: *"Nama wajib diisi"* — padahal namanya
tidak diapa-apakan.

Kini nama wajib hanya saat **membuat** murid baru. Saat mengedit, ia
tetap tidak boleh **dikosongkan**, tapi boleh tidak dikirim.

Ditemukan oleh uji, bukan di lapangan.

### Pengujian

`run76-biodata-guru.js` (**45 penanda**) · `run77-ui-biodata-guru.js`
(**37 penanda**) · `ujiTahap18()` bagian G.

Dibuktikan MERAH pada tiga cabang: `<th>` ditambah tanpa `<td>`
(seluruh tabel bergeser), medan NISN tidak ikut payload, dan tautan WA
menembus klik baris.

Percobaan merah pertama untuk tautan WA sempat **gagal menyisipkan
bug** — polanya tidak cocok karena kutip di sumber sudah lolos.
Diulang dengan pola yang benar sampai sungguh merah (§6.2 no. 5).

---

## 🔧 Cacat uji di ujiTahap18 — bukan bug (v1.11.1)

**Laporan Anda:** `❌ guru dapat membetulkan nomor WA` pada
`ujiTahap18()` v1.11.0.

**Kodenya benar. Yang salah angka harapan di ujinya.**

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Code.gs` | 🔴 **Wajib** | angka harapan dihitung, bukan diketik · versi `1.11.1` |

### Sebabnya

```js
no_wa: '0899-8888-7777'        →  6289988887777   (13 digit)
saya tulis di uji              →  628998887777    (12 digit)
```

Satu digit `8` terlewat saat saya mengetik. Fungsi normalisasi bekerja
dengan benar sepanjang waktu; yang merah hanyalah pembandingnya.

Ini jenis kesalahan yang paling menyesatkan: **yang tampak rusak
justru bagian yang benar**, dan Bapak sempat mengira ada bug baru
padahal tidak ada.

### Perbaikan

```js
var waMasuk = '0899-8888-7777';
var waHarap = Util.normalisasiWa(waMasuk);      // dihitung
cek('…', String(uG.no_wa) === waHarap && waHarap !== '');
```

Penjaga `waHarap !== ''` sengaja ditambahkan: tanpa itu, fungsi yang
rusak dan selalu mengembalikan kosong justru akan membuat uji hijau.

### Penjaga baru

`run76` bagian **A2** memastikan setiap nomor harfiah di
`ujiTahap18()` sungguh berasal dari salah satu masukan di fungsi itu.

Versi pertama penjaga ini **terlalu ketat** — ia menolak semua angka
harfiah, termasuk `6281234567890` yang sah dan mudah diperiksa mata.
Dipertajam agar hanya menolak yang tidak berasal dari mana pun.

Dibuktikan MERAH dengan mengembalikan angka ketik tangan.

**Aturan §6.2 no. 77** ditambahkan.

---

## 👤 Profil Saya & tombol Hubungi Guru (v1.11.2)

**Permintaan Anda:** *"murid apakah bisa merubah datanya? … datanya
bisa diklik di nama murid di pojok kanan atas. lalu tambahkan tombol
untuk menghubungi guru lewat WA"*

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Kelas.gs` | 🔴 **Wajib** | `kontakGuru()` `profilGuru()` `simpanProfilGuru()` |
| `js_auth.html` | 🔴 **Wajib** | dialog Profil Saya & Profil Guru |
| `js_core.html` | 🔴 **Wajib** | nama di topbar jadi tombol |
| `css.html` | 🔴 **Wajib** | `.tombol-profil` + `a.btn` |
| `Code.gs` | 🔴 **Wajib** | 3 API · `ujiTahap18()` bagian H · versi `1.11.2` |

> **Tidak perlu migrasi.** Kolom `no_wa` sudah ada sejak v1.10.0.

Setelah disalin: `cekBerkasUI()` → **102 penanda**, lalu `ujiTahap18()`.

### Jawaban singkat: sudah bisa, tapi tak ada pintunya

Murid **memang** sudah bisa mengubah datanya sejak v1.10.0 —
`simpanBiodata()` menerima pembaruan berulang. Masalahnya dialog itu
hanya muncul otomatis saat login; begitu ditutup, tidak ada satu pun
cara membukanya lagi.

Sekarang **nama di pojok kanan atas menjadi tombol**.

### Yang dilihat murid

Dialog **👤 Profil Saya** menampilkan NISN, email, dan nomor WA yang
tersimpan, lalu dua jalan keluar:

- **Ubah Biodata** → membuka dialog yang sama dengan saat login, nilai
  lamanya sudah terisi
- **💬 Hubungi Guru** → WhatsApp dengan pesan pembuka terisi otomatis:

> *"Assalamualaikum Pak/Bu, saya **Ahmad Fauzi (XI TJKT 1)** ingin
> bertanya tentang …"*

Nama & rombel disusun di server, jadi Anda langsung tahu siapa yang
menghubungi.

### 🔴 Lubang yang ketahuan saat mengerjakan

Nomor guru diambil dari akun guru sendiri — sesuai pilihan Anda. Tetapi
`daftarMurid()` menyaring `role:'murid'`, sehingga **akun guru tidak
muncul di Kelola Murid**. Tidak ada satu pun layar untuk mengisi nomor
itu, jadi tombol "Hubungi Guru" tidak akan pernah muncul.

Karena itu tombol profil dipasang untuk **kedua peran**. Guru
mendapat dialog **👤 Profil Guru** berisi nama, email, dan nomor WA.

Nomor boleh dikosongkan — bila kosong, tombol di layar murid hilang
dengan sendirinya, bukan menampilkan tautan rusak `wa.me/`.

### Yang dijaga khusus

- Nomor rusak di sheet (mis. `12345`) diperlakukan seperti kosong —
  tidak pernah menghasilkan tautan yang tidak bisa dibuka.
- `simpanProfilGuru` hanya menyentuh baris pemanggilnya; `user_id`
  dari klien diabaikan.
- Peran dikunci dua arah: murid tidak dapat membaca atau mengubah
  profil guru, guru tidak memakai jalur biodata murid.
- Satu panggilan API untuk dialog murid — biodata dan kontak guru
  dikirim bersamaan.

### Pengujian

`run78-profil-kontak.js` (**35 penanda**) · `run79-ui-profil.js`
(**42 penanda**) · `ujiTahap18()` bagian H.

Dibuktikan MERAH pada lima cabang: nomor tidak sah tetap dibuatkan
tautan, `user_id` klien dipercaya, tombol tanpa penangan, tombol
Hubungi Guru digambar tanpa memeriksa `guru.ada`, dan dialog guru
tertukar dengan dialog murid.

Satu penanda sempat merah karena **cacat uji**: bagian G sah mengubah
nomor guru, lalu bagian H membandingkannya dengan nilai lama. Urutan
bagian tidak saya pikirkan — nomornya kini dipulihkan sebelum lanjut.

---

## 💬 Kirim sandi reset lewat WhatsApp (v1.11.3)

**Permintaan Anda:** *"pada menu reset password, ketika di reset
tambahkan tombol WA untuk mengirim password baru ke siswa tersebut.
dan juga kirim otomatis ke email siswa"*

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Auth.gs` | 🔴 **Wajib** | reset mengembalikan `no_wa` murid |
| `Kelas.gs` | 🔴 **Wajib** | `tautanResetWa()` |
| `js_core.html` | 🔴 **Wajib** | `dialogHasilReset()` bersama |
| `js_kelola.html` `js_auth.html` | 🔴 **Wajib** | memakai dialog bersama |
| `Code.gs` | 🔴 **Wajib** | tautan disusun server · versi `1.11.3` |

> **Tidak perlu migrasi.**

Setelah disalin: `cekBerkasUI()` → **103 penanda**.

### Yang terjadi setelah reset

Dialog kata sandi sementara kini punya tombol
**💬 Kirim lewat WhatsApp**. Pesannya sudah tersusun:

> Halo **Ahmad Fauzi**, kata sandi LessonLen Anda telah direset.
>
> Nama pengguna: **siswa01**
> Kata sandi baru: **QNQ6X65A**
>
> Silakan masuk dan segera ganti kata sandi Anda sendiri. Jangan
> bagikan pesan ini kepada siapa pun.

Bila murid **belum mengisi nomor WA**, tombolnya tidak digambar —
diganti keterangan bahwa sandi perlu diberikan langsung. Sandi tetap
ditampilkan untuk dicatat manual.

Berlaku di **dua layar** sekaligus: Kelola Murid dan Permintaan Reset.

### ❌ Email tidak dipakai — dan ini disengaja

Anda memilih **WA saja** setelah saya sampaikan bahwa kesepakatan
sendiri melarangnya. Alasannya saya catat di §13 no. 11 supaya tidak
terulang jadi pertanyaan:

| Alasan | Rincian |
|---|---|
| Kuota | Gmail konsumen 100 email/hari — reset dua kelas sehari sudah mepet |
| Keandalan | Kirim gagal dapat menyeret reset yang sebenarnya berhasil |
| Keamanan | Sandi di kotak masuk tersimpan permanen; pesan WA masih bisa dihapus |

`test/run80` bagian A memindai **seluruh** `src/` dan menolak
`MailApp`/`GmailApp` di berkas mana pun. Bila suatu saat email
diaktifkan, kesepakatan harus diperbarui lebih dulu — bukan dilanggar
diam-diam.

### Dialog dipakai bersama, bukan disalin

Dua layar memakai reset, dan sebelumnya masing-masing punya salinan
dialognya sendiri. Menambahkan tombol ke keduanya berarti dua tempat
yang harus dirawat dan mudah berbeda kalimat.

Kini `dialogHasilReset()` tinggal di `js_core.html`. Ada penanda
khusus yang menolak bila salinan lama tertinggal.

### Pengujian

`run80-reset-wa.js` (**36 penanda**).

Penanda yang paling saya andalkan: sandi di dalam pesan WhatsApp
**diambil kembali lalu dipakai untuk login sungguhan**. Kalau pesannya
salah, murid menerima sesuatu yang tidak menolong — dan itu tidak
akan ketahuan hanya dengan memeriksa teksnya.

Dibuktikan MERAH pada tiga cabang: tautan dibuat walau nomor tidak
sah, `MailApp` disisipkan ke `Auth.gs`, dan tombol digambar tanpa
memeriksa tautannya.

---

## 💬 "Minta Perbaikan" lewat WhatsApp (v1.11.4)

**Permintaan Anda:** *"pesan 'minta perbaikan' pada LKPD dan tugas
Kelompok juga bisa dikirim lewat WA, tapi untuk 'Tugas kelompok' yang
menerima WA adalah ketua kelompok"*

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Kelas.gs` | 🔴 **Wajib** | `tautanPerbaikanWa()` |
| `Lkpd.gs` | 🔴 **Wajib** | kembalikan data penerima saat ditolak |
| `Kelompok.gs` | 🔴 **Wajib** | data KETUA saat ditolak |
| `js_core.html` | 🔴 **Wajib** | `dialogPerbaikanWa()` bersama |
| `js_lkpd.html` `js_kelompok.html` | 🔴 **Wajib** | memakai dialog bersama |
| `Code.gs` | 🔴 **Wajib** | `_lengkapiTautanWa()` · versi `1.11.4` |

> **Tidak perlu migrasi.**

Setelah disalin: `cekBerkasUI()` → **104 penanda**.

### Yang terjadi setelah "Minta Perbaikan"

Muncul tawaran mengirim lewat WhatsApp. Pesannya sudah tersusun
**beserta catatan Anda**:

> Halo **Ahmad Fauzi**, LKPD "Subnetting" perlu diperbaiki.
>
> Catatan guru:
> Perbaiki bagian VLSM.
>
> Silakan buka LessonLen untuk memperbaiki dan mengumpulkan ulang.

Catatan sengaja ikut. Tanpa itu murid hanya tahu pekerjaannya ditolak
lalu tetap harus membuka aplikasi untuk mencari tahu apa yang salah —
dan tombol ini kehilangan gunanya.

### Tugas Kelompok → KETUA

Sesuai permintaan Anda, penerimanya **ketua kelompok** — dialah yang
mengumpulkan, jadi dialah yang memperbaiki. Pesannya menyebut nama
kelompoknya, dan dialog memberi tahu Anda siapa yang akan dihubungi:

> *Ingin memberi tahu ketua kelompok **Ahmad Fauzi** (Kelompok 1)
> lewat WhatsApp?*

**Seluruh anggota tetap menerima notifikasi in-app** seperti
sebelumnya. WhatsApp hanya jalur tambahan, bukan pengganti.

### Yang dijaga khusus

| Keadaan | Perilaku |
|---|---|
| Pekerjaan **diterima** | tidak ada tawaran WA — tidak perlu ditindaklanjuti |
| Murid/ketua belum isi nomor | tidak ada dialog sama sekali, langsung lanjut |
| Nomor rusak di sheet | diperlakukan seperti kosong |
| **Ketua sudah keluar kelas** | tidak dikirimi — ia tak lagi melihat kelas ini |

### 🔴 Regresi yang ikut ketahuan

`run51` langsung merah: layar Tugas Kelompok memanggil
`dialogPerbaikanWa` yang tinggal di `js_core.html`. Bila berkas itu
belum tersalin ke editor, **seluruh layar mati padahal nilainya sudah
tersimpan di server**.

Kini dijaga `typeof` di keempat tempat — termasuk dua tempat reset
sandi v1.11.3 yang punya kelemahan sama.

### Pengujian

`run81-perbaikan-wa.js` (**48 penanda**).

Dibuktikan MERAH pada empat cabang: penerima diganti anggota pertama,
tawaran muncul saat diterima, catatan guru dihapus dari pesan, dan
panggilan dialog dicabut.

Percobaan pertama untuk cabang "penerimanya ketua" **tidak merah** —
ketua kebetulan saya taruh sebagai anggota pertama, jadi
`anggota[0]` sama dengan ketuanya. Susunannya diubah supaya
perbedaannya nyata (§6.2 no. 5).

---

## 🔴 Tombol WA "tidak muncul" — sebabnya nomor kosong (v1.11.5)

**Laporan Anda:** *"minta perbaikan pada tugas kelompok, dan Tolak pada
LKPD masih tidak muncul kirim WA"*

**Fiturnya tidak rusak. Murid Anda belum mengisi nomor WhatsApp.**

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_core.html` | 🔴 **Wajib** | dialog tetap muncul + menjelaskan sebabnya |
| `Code.gs` | 🟡 | versi `1.11.5` |

### Sebabnya — dan ini kesalahan rancangan saya

Tombol WhatsApp hanya bisa dibuat bila muridnya punya nomor. Bila
kosong, versi kemarin **melewati dialognya diam-diam** — tanpa jejak
apa pun.

Akibatnya Anda tidak bisa membedakan dua hal yang sangat berbeda:

| Yang Anda lihat | Kemungkinan sebabnya |
|---|---|
| tidak ada apa-apa | murid belum isi nomor ✅ |
| tidak ada apa-apa | berkas belum tersalin ❌ |
| tidak ada apa-apa | fiturnya rusak ❌ |

Diam bukan jawaban. Yang perlu diberi tahu justru **mengapa**
tombolnya tidak ada.

### Sekarang

Dialog **tetap muncul**, dengan keterangan:

> ↩ **Dikembalikan untuk Diperbaiki**
> Catatan Anda sudah tersimpan dan notifikasi terkirim. Namun
> **Ahmad Fauzi** tidak dapat dihubungi lewat WhatsApp.
>
> 📵 **Belum ada nomor WhatsApp**
> Murid ini belum melengkapi biodatanya. Nomor dapat diisikan lewat
> **Kelola Murid → Ubah**, atau minta murid mengisinya sendiri dari
> menu **👤 Profil Saya**.

Untuk tugas kelompok kalimatnya menyebut **ketua kelompok**, supaya
Anda tidak mengira yang belum mengisi adalah anggota biasa.

### Cara memastikan di kelas Anda

Buka **Kelola Murid** dan lihat kolom **Biodata**. Murid bertanda
🟡 **belum** tidak akan memunculkan tombol WhatsApp. Isikan nomornya
lewat **Ubah**, atau minta murid melengkapi sendiri lewat 👤 di pojok
kanan atas.

### Pengujian

`run81` naik ke **51 penanda** — empat di antaranya khusus memastikan
dialog tetap muncul dan menjelaskan sebabnya.

Dibuktikan MERAH dengan mengembalikan perilaku diam-diam itu.

**Aturan §6.2 no. 84** ditambahkan.

---

## 🔍 cekNomorWa() — cari tahu kenapa tombol WA tidak muncul (v1.11.6)

**Laporan Anda:** *"sudah ada nomornya"* — tetapi tombol WhatsApp
tetap tidak muncul.

Saya berhenti menebak dan membuat alat untuk melihat isi spreadsheet
Anda apa adanya.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Code.gs` | 🔴 **Wajib** | `cekNomorWa()` BARU · versi `1.11.6` |

### Cara memakainya

Buka editor Apps Script → pilih fungsi **`cekNomorWa`** → Run.
Tidak mengubah data apa pun, aman diulang.

Keluarannya kira-kira begini:

```
1. Kolom di sheet `users`
   ✅ kolom `no_wa` ada di posisi 11

2. Akun guru
   ⚠️  Guru PKPJ  sel=""  → KOSONG/TIDAK SAH

3. Murid — 36 akun
   ✅ nomor sah      : 12
   ⚪ belum diisi    : 23
   ❌ terisi TAPI tidak terbaca : 1

   INILAH yang membuat tombol WhatsApp tidak muncul
   walau selnya kelihatan berisi:
     • Cici Rusak (siswa14)
       sel   : "0812-abc"
       tipe  : string
       digit : 0812

4. Uji satu tautan sungguhan
   murid  : Ahmad Fauzi
   tautan : https://wa.me/6281234567890?text=Halo%20Ahmad…
   ✅ jalur tautan BEKERJA
```

### Tiga keadaan yang gejalanya SAMA

Inilah sebab kita berputar kemarin — ketiganya terlihat identik dari
layar, padahal sebabnya berbeda:

| Keadaan | Yang Anda lihat di sheet | Tombol muncul? |
|---|---|---|
| belum diisi | sel kosong | tidak |
| **terisi tapi tidak terbaca** | **sel berisi angka** | **tidak** |
| sah | sel berisi angka | ya |

Keadaan tengah itulah yang membuat Anda menyimpulkan *"sudah ada
nomornya"* — dan Anda benar melihatnya. Bagi kode, nomor itu tidak
terbaca.

Contoh yang menyebabkannya: `0812-abc`, `0812 3456` (kurang digit),
`021-5551234` (telepon rumah), atau sel yang tanpa sengaja berisi
teks lain.

### Yang TETAP terbaca — supaya Anda tidak salah curiga

Nomor yang diketik langsung di Spreadsheet biasanya tersimpan sebagai
**angka** dan nol depannya hilang: `081234567890` → `81234567890`.

Itu **tetap terbaca** — sudah saya uji. Jadi bukan itu sebabnya.

### Kalau semuanya sah tapi tombol tetap tidak muncul

Bagian penutup akan menyuruh Anda menjalankan `cekBerkasUI()` —
berarti sebabnya berkas UI belum tersalin, bukan datanya.

### Pengujian

`run82-diagnosa-wa.js` (**23 penanda**), termasuk penjaga bahwa
fungsi ini tidak mengubah data apa pun.

Dibuktikan MERAH dengan menghapus pemisahan "terisi tapi tidak
terbaca" — persis kelemahan yang membuat kita berputar.

**Aturan §6.2 no. 85** ditambahkan.

---

## 🔴 cekBerkasUI() berbohong — 2 rilis tanpa penanda (v1.11.7)

**Laporan Anda:** hasil `cekNomorWa()` + `cekBerkasUI()` yang keduanya
tampak baik, tetapi tombol WhatsApp tetap tidak muncul.

Log Anda menyingkap **dua** hal.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Code.gs` | 🔴 **Wajib** | 3 penanda yang terlupa · versi `1.11.7` |

Setelah disalin: `cekBerkasUI()` → **107 penanda**.

### 1️⃣ Sebab tombol WA tidak muncul — datanya

```
✅ nomor sah   : 1        ← [CONTOH] Ahmad Fauzi (data seed)
⚪ belum diisi : 217      ← seluruh murid sungguhan
```

**Nol dari 217 murid asli punya nomor WhatsApp.** Yang punya hanya
satu akun contoh bawaan. Tombol memang tidak akan muncul untuk murid
mana pun — dan itu perilaku yang benar.

Dua cara mengisinya:

| Cara | Untuk |
|---|---|
| **Kelola Murid → Ubah** → isi Nomor WhatsApp | satuan, oleh Anda |
| Murid klik **👤** di pojok kanan atas → **Ubah Biodata** | massal, oleh murid sendiri |

Cara kedua jauh lebih hemat waktu untuk 217 murid. Dialognya sudah
muncul otomatis saat mereka login.

### 2️⃣ 🔴 `cekBerkasUI()` tidak dapat dipercaya — ini kesalahan saya

Ia berkata *"SELURUH BERKAS UI SUDAH VERSI TERBARU"*, padahal
**dua rilis tidak punya penanda sama sekali**:

| Versi | Berkas yang diubah | Akibat |
|---|---|---|
| **1.10.1** | `js_auth` `js_core` `js_beranda` | dialog biodata saat login tidak terdeteksi |
| **1.11.5** | `js_core` | penjelasan "nomor kosong" tidak terdeteksi |

Selama penandanya tidak ada, `cekBerkasUI()` tetap berkata "terbaru"
walau berkas Anda masih versi lama. Alat diagnosis yang bisa berbohong
lebih berbahaya daripada tidak ada alat — ia mengarahkan pencarian ke
tempat yang salah.

Ketiga penanda sudah ditambahkan.

### Penjaga baru

`run83-penanda-lengkap.js` (**11 penanda**) memeriksa:

1. **Tiap versi yang menyentuh berkas UI punya penandanya** —
   dibaca dari riwayat di `PERUBAHAN.md`, jadi tidak bisa terlupa lagi
2. **Tiap penanda sungguh ada di berkas yang disebutnya** — penanda
   salah ketik membuat berkas dilaporkan usang selamanya, kebalikan
   dari bug ini tetapi sama merusaknya
3. Tidak ada penanda untuk versi yang belum dirilis

Dibuktikan MERAH dua kali: penanda v1.11.5 dihapus (persis kondisi
lapangan Anda), lalu satu penanda disalahketik.

Satu temuan awalnya cacat uji — pengurai saya tidak menerjemahkan
`\"` di dalam penanda, sehingga penanda v1.7.0 yang benar dituduh
salah ketik. Diperbaiki sebelum uji dipakai.

**Aturan §6.2 no. 86** ditambahkan.

---

## 🗓️ resetTahunAjaran() — pergantian tahun ajaran (v1.12.0)

Butir peta jalan yang tertunda sejak lama. Ditulis **sekarang** justru
karena belum dibutuhkan: kalau menunggu Juni saat Bapak sedang buru-buru,
tidak ada ruang untuk salah.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `ResetTahun.gs` | 🔴 **BARU** | buat file baru di editor |
| `Db.gs` | 🔴 **Wajib** | `kosongkanSheet()` |
| `Code.gs` | 🔴 **Wajib** | `resetTahunAjaran()` · versi `1.12.0` |

> **Tidak perlu migrasi.**

### Cara pakai — dua langkah

Dari editor Apps Script:

```js
resetTahunAjaran()                  // hanya MELIHAT, tidak mengubah
resetTahunAjaran('YA SAYA YAKIN')   // menjalankan
```

Langkah pertama menampilkan berapa kelas, berapa murid, dan berapa
baris yang akan terkena — **tanpa menyentuh apa pun**. Baca dulu,
baru jalankan yang kedua.

### Yang dikerjakan

```
1. ARSIPKAN     rekap nilai tiap kelas → Spreadsheet di Drive
2. HAPUS        progress · quiz_attempt · lkpd_submission · kelompok
3. NONAKTIFKAN  seluruh murid (akunnya TIDAK dihapus)
4. ARSIPKAN     kelas → status 'arsip'
5. BERSIHKAN    notifikasi · session · permintaan_reset
```

### Yang TIDAK disentuh

**`materi_pokok` · `pertemuan` · `item` · `soal` · `users` ·
`enrollment`**

Materi dan bank soal yang Bapak susun berbulan-bulan tetap utuh.
Kelas hanya diarsipkan — materinya masih bisa disalin ke kelas baru
lewat **Kelola Kelas → Salin ke Kelas Lain**.

Akun murid dinonaktifkan, bukan dihapus: nama, NISN, dan nomor WA
masih berguna bila ada murid mengulang atau urusan administrasi.

### Tiga penjaga keselamatan

Operasi ini **tidak dapat diurungkan** — Sheets tidak punya tempat
sampah untuk baris. Karena itu:

1. **Arsip gagal → reset dibatalkan seluruhnya.** Kalau kuota Drive
   habis di tengah jalan, tidak ada satu baris pun yang dihapus.
2. **Tanpa frasa → tidak ada yang berubah.** Frasa `YA SAYA YAKIN`
   harus diketik tangan.
3. **Tidak ada tombol di aplikasi.** Hanya dari editor — tombol yang
   hidup sepanjang tahun di layar mengajar tidak sepadan risikonya.

### Kecepatan

`Db.kosongkanSheet()` BARU: `deleteRows(2, n)` sekali jalan, bukan
`deleteRow()` per baris. Untuk `progress` yang bisa puluhan ribu baris,
cara lama pasti menabrak batas 6 menit Apps Script.

### Pengujian

`run84-reset-tahun.js` (**54 penanda**).

Dibuktikan MERAH pada tiga cabang paling berbahaya: frasa tidak
diperiksa (11 penanda merah), penghapusan jalan terus walau arsip
gagal, dan akun murid ikut terhapus.

Tiga temuan awal ternyata **cacat uji**: nama fungsi Quiz ditebak,
mock kurang `Session`, dan penimpaan `SpreadsheetApp.create` dipasang
sebelum `setupDatabase()` sempat memakainya. Semuanya diperbaiki
sebelum uji dipakai.

### Langkah Bapak nanti di bulan Juni

1. Pastikan rapor sudah dibagikan
2. `resetTahunAjaran()` → baca laporannya
3. `resetTahunAjaran('YA SAYA YAKIN')`
4. Salin materi ke kelas baru, impor murid baru

---

## 🧹 Tombol pembersih ekspor Drive (v1.12.1)

**Permintaan Anda:** *"sekarang buatkan tombol pembersih"*

Butir **terakhir** peta jalan.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_rekap.html` | 🔴 **Wajib** | tombol 🧹 Bersihkan |
| `Code.gs` | 🟡 | penanda + versi `1.12.1` |

Setelah disalin: `cekBerkasUI()` → **108 penanda**.

### Fungsi yatim yang akhirnya punya tombol

`Rekap.hapusEksporLama()` sudah lengkap sejak lama, tetapi **tidak ada
satu pun yang memanggilnya** — jadi Drive Anda terus menumpuk berkas
tiap kali mengekspor rekap.

Tombolnya kini ada di layar Rekap Nilai, berdampingan dengan
**📤 Ekspor ke Sheet** — di situlah berkasnya dibuat, jadi di situ pula
tempat paling masuk akal untuk membereskannya.

### Yang dibuang

Hanya berkas berawalan **`LessonLen Rekap — `** yang **lebih dari 30
hari**. Dipindahkan ke tong sampah Drive, masih dapat dipulihkan dari
sana selama 30 hari.

**Dokumen lain milik Anda tidak tersentuh.** Ini yang paling saya jaga:
`searchFiles` memakai pencocokan longgar, jadi berkas seperti
*"RPP LessonLen Rekap Bab 1"* atau *"Catatan LessonLen Rekapitulasi"*
ikut terjaring pencarian — tetapi ditolak penjaga awalan.

Saya buktikan dengan mencabut penjaga itu: **4 dokumen pribadi
langsung tersapu**.

### Pesan yang membedakan tiga keadaan

Nol berkas bukan kegagalan, tetapi *"0 berkas dipindahkan"* terbaca
seperti tombol rusak. Karena itu dibedakan:

| Keadaan | Pesan |
|---|---|
| ada yang dibuang | "3 berkas lama dipindahkan (5 dipertahankan)" |
| semua masih baru | "Tidak ada berkas lebih dari 30 hari" |
| Drive kosong | "Belum ada berkas ekspor di Drive Anda" |

### Pengujian

`run85-bersih-ekspor.js` (**34 penanda**) dengan DriveApp tiruan.

Dibuktikan MERAH dua kali: tombol dicabut (kondisi sebelum hari ini),
dan penjaga awalan dicabut.

---

## ✅ Quiz 36 murid serentak — TERVERIFIKASI LAPANGAN

**Laporan Anda:** *"sudah di pakai 36 murid, aman lancar."*

Ini butir **#1 peta jalan sejak v1.9.0** — akhirnya terbukti di kelas
sungguhan, bukan estimasi mock.

Yang terverifikasi:

| Perubahan | Versi | Angka |
|---|---|---|
| Quiz offline `localStorage` | 1.9.0 | 288 → **72 permintaan** |
| Kunci selektif + reentrant | 1.9.1 | 3 → **1 kunci/murid** |
| `tryLock` 10 dtk → 45 dtk | 1.9.1 | antrean lebih sabar |

Keluhan asli yang memicunya — *"mengerjakan quiz sangat lama, banyak
yang gagal, server sibuk, data tidak tersimpan"* — tidak terulang.

Rencana cadangan (antrian di sisi klien) **tidak jadi diperlukan**.

---

## 📘 BRIEFING-AI.md — dokumen untuk AI penerus (v1.12.2)

**Permintaan Anda:** dokumen final yang bila diupload ke AI lain,
AI itu dapat melanjutkan proyek ini dengan standar yang sama.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Code.gs` | 🟡 | versi `1.12.2` saja |

Dokumen ini untuk **Anda dan AI lain**, bukan untuk Apps Script.
Tidak ada perubahan perilaku aplikasi.

### Yang dibuat

**`BRIEFING-AI.md`** di akar proyek — satu pintu masuk yang merangkai
dokumen yang sudah ada:

| Bagian | Isi |
|---|---|
| §1 | urutan membaca + jalankan uji lebih dulu |
| §2 | **cara berkomunikasi dengan Anda** — singkat, sering meralat, log lapangan menang atas mock |
| §3 | 9 aturan pola kerja yang mengikat |
| §4 | peta 18 modul + 16 sheet |
| §5 | **10 jebakan yang sudah memakan korban** |
| §6 | 5 aturan yang paling sering menyelamatkan |
| §7 | langkah menambah fitur, urut |
| §8 | yang dilarang + alasannya |
| §9 | fungsi diagnostik yang sudah ada |
| §10 | **batas kejujuran** — apa yang bisa & tidak bisa dijamin |

### Satu hal yang harus saya luruskan

Permintaan Anda berbunyi *"AI lain akan membuat sama persis"*.

**Itu tidak bisa saya janjikan.** Kode proyek ini 33.500 baris; tidak
ada dokumen yang membuat AI lain menghasilkan baris yang identik.
Menjanjikannya berarti berbohong.

Yang dijamin dokumen ini:

| Bisa | Tidak bisa |
|---|---|
| melanjutkan dengan standar sama | menghasilkan kode identik |
| memahami tiap keputusan + alasannya | menebak yang belum pernah dibahas |
| menghindari 88 kelas bug yang sudah terjadi | menjamin tak ada bug baru |

Batas itu ditulis eksplisit di §10 dokumennya, dan ada penanda uji
yang **menolak bila kalimat kejujuran itu dihapus**.

### Penjaga agar dokumennya tidak basi

Dokumen semacam ini penuh angka — jumlah berkas, API, uji, aturan,
penanda, versi. Semuanya berubah tiap rilis, dan **dokumen yang
angkanya salah lebih berbahaya daripada tidak ada dokumen**: AI baru
akan mempercayainya.

`run86-briefing.js` (**34 penanda**) mengikat tiap angka ke sumbernya:

```
versi     → APP_VERSI di Code.gs
berkas    → hitung isi src/
API       → hitung function di Code.gs
uji       → hitung isi test/
aturan    → nomor tertinggi di KONVENSI-TEKNIS.md
penanda   → hitung isi PENANDA
```

Uji ini langsung menangkap satu kesalahan saya: jumlah berkas uji
tertulis 99 padahal `run86` sendiri membuatnya jadi 100.

Dibuktikan MERAH tiga kali: versi dibuat basi, rujukan diganti berkas
hantu, dan bagian kejujuran dihapus.

Percobaan kedua sempat **tidak merah** — pemeriksa hanya mengecek
berkas yang disebut, jadi mengganti namanya justru membuat penjaganya
diam. Diperbaiki menjadi dua arah: tiap rujukan wajib ada, DAN dokumen
inti wajib disebut.

**Aturan §6.2 no. 89** ditambahkan.

---

## 📊 Tombol Rekap di tiap kartu kelas (v1.12.3)

**Permintaan Anda:** *"tampilkan tombol rekap nilai di tiap kelas"*

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_kelola.html` | 🔴 **Wajib** | tombol `📊 Rekap` + cabang kliknya |
| `Code.gs` | 🟡 | 2 penanda baru + versi `1.12.3` |

Berkas **tidak berubah**: seluruh `.gs` lain, `js_rekap.html`, `css.html`.

### Yang berubah

Rekap Nilai sudah ada sejak v1.5.0, tetapi satu-satunya pintu masuknya
adalah tombol di beranda guru — yang menurunkan Anda di layar *pilih
kelas* lebih dulu. Padahal saat Anda berada di **Kelola Kelas**, kelas
yang dimaksud sudah ada di depan mata. Dua klik hanya untuk menyebutkan
ulang kelas yang sama.

Kini tiap kartu kelas punya deret tombol:

```
Pertemuan   Murid   📊 Rekap   🪞 Refleksi   Ubah   ⧉ Duplikat   Hapus
```

`📊 Rekap` menuju `#/rekap/<kelas_id>` — **langsung ke tabel nilainya**,
tanpa layar pemilih. Bergaya `btn-hantu` (sekunder) agar `Pertemuan`
tetap menjadi tombol utama kartu.

**Tidak ada backend baru.** Rute `rekap` sudah menerima `kelas_id` lewat
`arg[0]` sejak v1.5.0; jalur itu selama ini hanya tak pernah dipakai
dari Kelola Kelas. Tombol di beranda tetap ada dan tetap bekerja.

### Uji

**`run87-tombol-rekap-kelas.js`** — 34 pemeriksaan, 5 bagian. Lima bug
disisipkan ulang untuk membuktikan ujinya bisa merah:

| Bug disisipkan | Merah |
|---|---|
| tombol dihapus seluruhnya (keadaan v1.12.2) | 8 |
| tombol ada, penangan klik lupa | 3 |
| `data-rekap` dibaca `dataset.rekapNilai` | 2 |
| `kelas_id` tidak ikut di tautan | 2 |
| penanda `cekBerkasUI()` lupa dititipkan | 4 |

Percobaan ketiga awalnya hanya memerahkan **satu** butir — cacat uji:
`b.dataset.rekapNilai` memuat `b.dataset.rekap` sebagai awalan sehingga
penjaganya lolos. Ditambahkan `\b` pada pola. Ini gejala aturan §6.2
no. 83 pada bentuk lain: pemeriksa berbasis pencocokan awalan rapuh
terhadap nama yang lebih panjang.

### 🔴 Temuan sampingan: `npm run uji` bisa berbohong

`run87` sudah hijau bila dijalankan sendiri, tetapi **tidak ikut
terpanggil** oleh `npm run uji` — namanya belum masuk daftar tangan di
`test/jalankan-semua.sh`. Runner tetap mencetak *"✅ SEMUA BERKAS UJI
HIJAU"*.

Kelas kegagalan yang sama dengan `cekBerkasUI()` v1.11.7: alat penjaga
memberi rasa aman palsu. Bedanya, di sini **seluruh** berkas uji baru
bisa lenyap dari peredaran tanpa satu pun tanda merah.

`test/jalankan-semua.sh` kini membandingkan `test/run*.js` &
`test/perf*.js` dengan isi kedua daftar, lalu gagal bila ada yang
yatim. Percobaan pertama penjaga ini justru **menuduh 20-an berkas yang
sudah terdaftar** — daftarnya dipisah newline + indentasi, sedangkan
polanya mencari spasi literal. Diratakan dengan `$(echo $VAR)`.

**Aturan §6.2 no. 90** ditambahkan: daftar yang ditulis tangan wajib
punya penjaga yang membandingkannya dengan isi direktori.

### Pratinjau

**`pratinjau-kartu-rekap.html`** — deret tombol sebelum & sesudah, di
lebar laptop dan ponsel 380px. Deret diambil dengan menjalankan
potongan pembangun HTML yang sungguhan dari `js_kelola.html`, jadi
pratinjaunya tidak bisa basi.

### 🔴 Pratinjau menyarangkan kartu — dilaporkan Anda

> *"seperti kelas dalam kelas: [XI TKJ 1 [XI TKJ 2 [XII TKJ 1]]]"*

**Ini bug pratinjau, bukan bug aplikasi.** `js_kelola.html` sendiri
benar — yang salah adalah cara saya mengambil potongannya.

Potongan berhenti tepat sebelum `'</div></div>'` di berkas aslinya
(satu menutup deret tombol, satu menutup kartu). Akibatnya tiap kartu
meninggalkan `<div>` menganga, dan peramban diam-diam memperbaikinya
dengan menyarangkan kartu berikutnya ke dalam kartu sebelumnya.

Ironisnya justru muncul karena niat mengambil kode sungguhan agar
pratinjau tidak berbohong — tetapi diambil **setengah**. Potongan
separuh membuatnya berbohong dengan cara baru, dan lebih meyakinkan.

Gejalanya **tidak terlihat pada satu kartu**; hanya muncul saat
beberapa ditumpuk. Tiga bagian pertama pratinjau tampak normal.

| Perbaikan | |
|---|---|
| `buat-pratinjau-kartu-rekap.js` | penutup `</div>` dikembalikan; `periksaSeimbang()` menolak terbit bila tag menganga |
| `run87` bagian F | 6 pemeriksaan baru dengan **jsdom**: tidak boleh ada `.kartu` yang punya leluhur `.kartu` |

Dibuktikan merah dengan menerbitkan pratinjau rusak: `2 kartu
bersarang — hanya 1 kartu jadi anak langsung .kolom`, persis yang
Anda lihat. `run87` kini **40 pemeriksaan**.

Judul bagian terakhir juga diperjelas menjadi *"Daftar beberapa kelas
— seperti tampilan sesungguhnya"*, sebab "beberapa kelas berurutan"
tidak menjelaskan apa yang sedang diperiksa.

**Aturan §6.2 no. 91** ditambahkan: kode sungguhan yang diambil untuk
pratinjau wajib diambil utuh, dan hasilnya diperiksa keseimbangan
tagnya dengan DOM — bukan pencocokan teks.

---

## ⚡ Beranda guru 51.041 → 625 sel (v1.12.4)

**Laporan Anda:** *"kenapa loadingnya lama, setiap tekan tombol selalu
loading lama"* — disertai log eksekusi Apps Script 19 Agu 2026.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Beranda.gs` | 🔴 **Wajib** | `untukGuru()` berhenti membaca `progress` |
| `js_beranda.html` | 🔴 **Wajib** | lencana % & bilah progres dibuang dari kartu |
| `Code.gs` | 🟡 | penanda + versi `1.12.4` |

⚠️ **`Beranda.gs` dan `js_beranda.html` harus disalin BERSAMA.** Bila
hanya `.gs` yang tersalin, kartu kelas menampilkan `undefined%`.
Dijaga penanda `cekBerkasUI()`.

### Tiga sebab yang ditemukan dari log Anda

**1. Biaya lantai ±0,9 detik — tidak bisa dihilangkan.**

`getDaftarKelas` memakan 0,87 detik sambil membaca **0 sel** (terukur).
Itu biaya memuat & mem-parse 760 KB kode tiap eksekusi, membuka
spreadsheet, memvalidasi sesi. Tidak ada optimasi query yang menembus
lantai ini.

Catatan: **24% dari seluruh kode `.gs` adalah fungsi diagnostik**
(`ujiTahap2`…`ujiTahap18`, 184 KB) yang tak pernah dipakai aplikasi
web, tetapi tetap ikut di-parse tiap kali murid menekan tombol.

**2. `getBeranda` membaca `progress` penuh — DIPERBAIKI.**

Terukur pada volume nyata (8 kelas · 218 murid · 16.200 baris):

| | sel | panggilan |
|---|---|---|
| sebelum | 51.041 | 7 |
| **sesudah** | **625** | **2** |

**95% biaya beranda guru** habis untuk satu angka persen per kartu.
Lebih buruk lagi: `progress` ada dalam `TANPA_CACHE`, jadi **cache
tidak pernah menyala** — dibayar penuh setiap kali, termasuk tiap kali
kembali dari layar lain. Itulah sebabnya terasa *"setiap tekan
tombol"*.

**3. Satu layar memicu beberapa panggilan.** `getRekapKelas` (8,5 dtk)
dan `getPilihanBabRekap` (4,5 dtk) berangkat pada detik yang sama.
Belum disentuh.

### Yang berubah di layar

Kartu kelas beranda guru **tidak lagi menampilkan lencana % dan bilah
progres**. Sisanya tetap: nama kelas, jumlah murid, jumlah pertemuan,
lencana draf.

Anda memutuskan angka itu jarang dilihat. Rekap Nilai per kelas jauh
lebih berguna, dan sejak v1.12.3 sudah satu klik dari Kelola Kelas.

**Progres MURID tidak ikut terbuang** — murid tetap melihat kemajuannya
sendiri; itu inti pembelajaran bertahap. Dijaga `perf18` bagian D.

### Uji

**`perf18-beranda-guru.js`** — 17 pemeriksaan pada volume lapangan.
Dibuktikan merah dengan mengembalikan perhitungan aslinya: `51041 sel
— progress=48616`, `7 panggilan`, `masih dikirim: 100%` — persis angka
sebelum perbaikan.

`run3` dua butirnya **dibalik**, bukan dihapus: kini menjaga bahwa
`progres` justru TIDAK ada di kartu guru, sehingga biayanya tidak
kembali diam-diam.

**Aturan §6.2 no. 92** ditambahkan: angka hiasan di layar yang sering
dibuka wajib diukur biayanya — dan sering lebih baik dibuang daripada
dioptimalkan. Tanyakan kepada pengguna lebih dulu; optimasi terbaik
adalah pekerjaan yang tidak jadi dilakukan.

### Belum dikerjakan

`nilaiKelompok` **16,7 detik** adalah angka terburuk di log Anda dan
belum saya ukur sama sekali.

---

## ⚡ nilaiKelompok 99.603 → 272 sel (v1.12.5)

**Angka terburuk di log Anda:** `nilaiKelompok` **16,669 detik**.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Db.gs` | 🔴 **Wajib** | `cariBarisBanyak2()` BARU + `perbaruiBanyak()` pilih strategi |
| `Kelompok.gs` | 🔴 **Wajib** | `_tulisProgresAnggota()` borongan |
| `Code.gs` | 🟡 | versi `1.12.5` |

Tidak ada perubahan UI, tidak ada migrasi.

### Sebab

`_tulisProgresAnggota()` memanggil `Db.cariBarisCache2()` **sekali per
anggota** di dalam loop. Tiap panggilan memindai kolom `user_id` sheet
`progress` sepenuhnya — enam pemindaian penuh untuk menemukan enam
baris. **97.858 dari 99.603 sel (98%)**.

Yang paling berbahaya bukan angkanya, melainkan **pertumbuhannya**:

| | 6 anggota | 12 anggota |
|---|---|---|
| sebelum | 99.603 sel | 197.447 sel |
| sesudah (dingin) | 30.443 | 32.271 |
| **sesudah (hangat)** | **272** | **466** |

Kelompok dua kali lebih besar dulu berbiaya dua kali lipat. Kini
praktis rata — dan penilaian kedua dan seterusnya hampir gratis, yang
penting karena Anda menilai beberapa kelompok berturut-turut.

### Tiga perbaikan

1. **`Db.cariBarisBanyak2()`** — satu pemindaian untuk seluruh
   anggota, cocokkan semua dalam satu lintasan memori.
2. **`perbaruiBanyak()` memilih strategi.** Baris anggota tersebar
   (terukur: 6, 81, 156, 231, 306, 381 — rentang 376 baris untuk 6
   yang diubah). Blok lebar bukan cuma boros, tapi **menulis ulang 370
   baris murid lain**. Bila rentang > 4× jumlah baris, tulis per baris.
3. **Satu kunci** untuk seluruh anggota, bukan satu per anggota.

### Kejujuran: dua kesalahan saya sendiri

**Cacat uji.** Butir `perf19` mula-mula menuntut *"progress ditulis
SEKALI"* dan **menuduh perbaikan yang benar sebagai kemunduran**.
Menghitung panggilan saja menyesatkan sama seperti menghitung sel
saja. Ambangnya dipindah ke biaya.

**Nyaris memindahkan biaya, bukan menghapusnya.** Penulisan borongan
di luar `tulisProgres(uid, …)` menaikkan epoch **global** —
membatalkan cache progres seluruh 218 murid, bukan hanya 6 anggota.
Guru merasa cepat, murid berikutnya membayar. Tertangkap sebelum
dirilis; kini epoch dinaikkan per murid.

### Uji

**`perf19-nilai-kelompok.js`** — 21 pemeriksaan. Dibuktikan merah
dengan mengembalikan ketiga bug: loop per anggota (`99603 sel`,
12 anggota `197447`), strategi kerapatan dilumpuhkan, epoch global.

Bagian D menjaga kebenaran tidak dikorbankan: nilai kelompok, nilai
penyesuaian per anggota, `mp_id` tidak yatim, dan menilai ulang tidak
menggandakan baris.

**Aturan §6.2 no. 93, 94, 95** ditambahkan.

### Belum dikerjakan

- `getDetailKelompok` masih **31.325 sel** (`progress` 17.416)
- `getRekapKelas` + `getPilihanBabRekap` — 2 panggilan untuk 1 layar
- Biaya lantai ±0,9 dtk — 184 KB fungsi diagnostik ikut di-parse

---

## ⚡ Layar Rekap: 2 panggilan → 1 (v1.12.6)

**Dari log Anda 19 Agu:**

```
10.34.36  getRekapKelas        8,474 dtk
10.34.36  getPilihanBabRekap   4,534 dtk   ← detik yang SAMA
```

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Rekap.gs` | 🔴 **Wajib** | `kelasLengkap()` BARU |
| `Code.gs` | 🔴 **Wajib** | API `getRekapLengkap` + penanda + versi `1.12.6` |
| `js_rekap.html` | 🔴 **Wajib** | satu `callApi`, bukan `Promise.all` |

Aman satu arah: **kedua API lama sengaja dipertahankan**, jadi
`js_rekap.html` versi lama tetap bekerja — hanya tetap lambat.

### Sebab

`Promise.all` terasa benar: di peramban biasa dua panggilan berjalan
paralel dan yang terlama menentukan. Tetapi di Apps Script **tiap
panggilan adalah eksekusi terpisah** — masing-masing mem-parse 760 KB
kode, membuka spreadsheet, memvalidasi sesi sendiri-sendiri, lalu
keduanya berebut sumber daya yang sama.

Besar biaya lantai itu terukur dari log Anda sendiri: `getDaftarKelas`
**0,868 detik sambil membaca NOL sel**.

| | sel | baca | biaya lantai |
|---|---|---|---|
| sebelum | 7.302 | 28 | **2×** |
| sesudah | 7.253 | 25 | **1×** |

Hematnya hanya **49 sel** — dan itu memang bukan intinya. Yang dihapus
±0,9 detik biaya lantai, yang **tidak terlihat sama sekali** bila
hanya menghitung sel. Kebalikan dari v1.12.4, di mana sel adalah
segalanya.

Bonus: `_itemBernilai()` cukup dihitung sekali. Dulu `pilihanBab()`
memakai `'semua'` sedangkan `kelas()` memakai bab terpilih, sehingga
memo per-eksekusi tidak pernah berbagi.

### 🔴 Dua cacat uji yang jauh lebih penting daripada fiturnya

**1. `run43` hijau padahal UI diubah total.**

Mock-nya mengembalikan `DATA[fn]` apa adanya — untuk API tak terdaftar
hasilnya `undefined`, dan layar tetap "berhasil" digambar dengan data
kosong. Saya sempat mengubah `js_rekap.html` memanggil API yang sama
sekali berbeda dan **seluruh berkas tetap hijau**.

Kini mock menolak API tak dikenal lewat `reject` (bukan `throw`, agar
gagal bersih), dan mengumpulkannya jadi butir tersendiri di bagian L.

**2. `perf20` buta terhadap bug penapis bab.**

`bebandata.js` hanya membuat SATU bab per kelas. Dengan satu bab,
menapis mustahil dibedakan dari tidak melakukan apa-apa. Bug "daftar
bab ikut menyempit" saya sisipkan — **uji tetap hijau**. Baru setelah
bab kedua dibuat di dalam berkas ujinya, merah (`1 vs 2 bab`).

**3. Angka harapan dipatok tangan.** `run43` menuntut `=== 4` API
rekap dijaga peran guru; API kelima membuatnya merah padahal semuanya
sudah benar. Kini dihitung, bukan diketik (§6.2 no. 77).

### Uji

**`perf20-rekap-satu-panggilan.js`** — 21 pemeriksaan. Dibuktikan
merah dengan mengembalikan `Promise.all`, melepas penjaga peran guru,
dan menyempitkan daftar bab.

**Aturan §6.2 no. 96, 97, 98** ditambahkan.

### Belum dikerjakan

- Biaya lantai ±0,9 dtk — 184 KB fungsi diagnostik ikut di-parse
- `getDetailKelompok` 31.325 sel
- `getStrukturKelas` 3,9 dtk — terukur hanya 2.890 sel, jadi bukan
  masalah data

---

## 🔴 Penanda cekBerkasUI() rapuh & 9 tak pernah diperiksa (v1.12.7)

**Laporan Anda:**

```
❌ ADA 1 PENANDA TIDAK DITEMUKAN
📄 js_beranda.html — masih versi lama (perlu v1.12.4 atau lebih baru)
```

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_beranda.html` | 🔴 **Wajib** | inilah yang dilaporkan usang — belum tersalin |
| `Code.gs` | 🔴 **Wajib** | 5 penanda diperbaiki + versi `1.12.7` |

### Diagnosisnya BENAR

`js_beranda.html` di editor Anda memang masih versi lama. Selama belum
disalin, kartu kelas guru menampilkan `undefined%` karena `Beranda.gs`
sudah berhenti mengirim `progres`.

### Tetapi laporan itu membongkar dua cacat

**1. Penanda v1.12.4 hidup di dalam KOMENTAR.**

Penanda yang saya pasang adalah `'Lencana % dan bilah progres DIHAPUS
v1.12.4'` — sepotong teks di dalam `/* */`. Komentar bisa dihapus
siapa pun tanpa mengubah perilaku sebaris pun; sesudah itu alat
diagnosis akan berteriak "versi lama" pada berkas yang sudah benar.

Audit menemukan **5 dari 112 penanda** punya cacat ini (`css`
v1.6.6, `js_editor` v1.6.0, `js_kunci` v1.8.0, `js_kerangka` v1.8.3,
`js_beranda` v1.12.4). Kelimanya kini menunjuk kode nyata.

**2. Sembilan penanda TIDAK PERNAH diperiksa sama sekali.**

Lebih parah. Pola pengurai hanya mengenali string ber-**kutip
tunggal**; sembilan penanda memakai kutip ganda karena isinya memuat
apostrof. Termasuk dua yang baru saya buat sendiri di v1.12.3 dan
v1.12.6.

Yang berbahaya: penjaganya tetap mencetak angka meyakinkan — *"103
penanda"* — padahal daftarnya **112**. Tidak ada yang tampak salah.

`run46` bahkan punya pola sendiri yang lebih longgar lagi (90
penanda), dan tidak memulihkan escape `\n` sehingga menuduh penanda
sah tidak ada. Kini `run46` dan `run83` memakai pola identik, dan
keduanya membaca **112**.

### Uji

`run83` bertambah dua penjaga, keduanya dibuktikan merah:

| Bug disisipkan | Pesan merah |
|---|---|
| penanda komentar dikembalikan | `1 penanda rapuh: js_beranda v1.12.4` |
| pola kutip-tunggal dikembalikan | `103 terbaca dari 112 baris` |

**Aturan §6.2 no. 99 & 100** ditambahkan.

---

## ⚡ Beranda tidak dipanggil ulang tiap kembali (v1.12.8)

**Dari log Anda 24 Agu — 82 detik pemakaian nyata:**

```
09.16.27  getBeranda        4,686
09.16.52  getDaftarKelas    2,531
09.16.58  getBeranda        2,755   ← kembali
09.17.06  getDaftarMurid    3,169
09.17.12  getBeranda        5,517   ← kembali
09.17.29  getBeranda        5,056   ← kembali
09.17.49  getBeranda        2,859   ← kembali

5 panggilan · 20,9 detik · 57% SELURUH waktu
```

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_beranda.html` | 🔴 **Wajib** | cache 30 detik + `bataliBeranda()` |
| `js_lkpd.html` | 🔴 **Wajib** | batalkan sesudah menilai LKPD |
| `js_quiz.html` | 🔴 **Wajib** | batalkan sesudah mengoreksi quiz |
| `js_kelompok.html` | 🔴 **Wajib** | batalkan sesudah menilai kelompok |
| `js_core.html` | 🟡 | logout & sesi mati ikut membatalkan |
| `js_belajar.html` | 🟡 | murid selesai item ikut membatalkan |
| `Code.gs` | 🟡 | 2 penanda + versi `1.12.8` |

⚠️ **`js_beranda.html` paling menentukan.** Tanpa itu `bataliBeranda()`
tidak ada, seluruh pembatal di berkas lain diam (dijaga `typeof`), dan
cache tidak pernah dibuang.

### Koreksi klaim saya sebelumnya

Saya pernah menyebut `getBeranda` **0,86 detik**. Angka itu berstatus
**"Berjalan"** — potret saat log diambil, bukan waktu akhir. Saya
memperlakukannya sebagai hasil final. **Itu keliru.**

Perbandingan yang jujur memakai `getDaftarKelas` sebagai termometer
(ia membaca **0 sel**, jadi murni biaya lantai):

| | biaya lantai | getBeranda |
|---|---|---|
| 19 Agu | 0,87 dtk | **12,3×** lantai |
| 24 Agu | 1,03–2,53 dtk | **2,5×** lantai |

Mesin Google sendiri ~1,9× lebih lambat pada 24 Agu. Perbaikannya
nyata; yang tidak nyata adalah janji dalam detik.

### Sebab & perbaikan

Beranda **sudah** semurah mungkin (625 sel). Yang mahal adalah
**jumlah kunjungannya** — tiap kembali membayar biaya lantai penuh.

Temuan yang mengejutkan: `State.beranda` **sudah** disimpan sejak lama
dan **sudah** punya tiga pembatal — tetapi tidak pernah ada satu baris
pun yang MEMBACANYA. Semua ongkos perawatan dibayar, nol manfaat.

Jalur bacanya kini dibuat, dengan umur **30 detik**. Antrean koreksi
dibatalkan **seketika** oleh aksi yang mengubahnya, jadi angka basi
tidak mungkin terjadi.

**5 kunjungan → 1 panggilan.**

### Uji

**`run88-cache-beranda.js`** — 24 pemeriksaan dengan jsdom, rute
beranda sungguhan dijalankan. Dibuktikan merah:

| Bug disisipkan | Merah |
|---|---|
| jalur baca dihapus (keadaan v1.12.7) | 5 — `5 panggilan untuk 5 kunjungan` |
| menilai LKPD lupa membatalkan | 2 |
| pembatal lupa mengosongkan stempel | 1 |

Percobaan ketiga awalnya **tidak merah**: pola `/_berandaDiisi = 0/`
ikut cocok dengan deklarasi `var` di kepala berkas. Cacat uji —
kini hanya isi fungsinya yang diperiksa.

**Aturan §6.2 no. 101 & 102** ditambahkan.

### Belum dikerjakan

- **`cekBerkasUI()`** belum Anda kirim lagi — saya belum tahu apakah
  `js_beranda.html` v1.12.4 sudah tersalin
- `getDaftarKelas` + `getDaftarMurid` berangkat pada detik yang sama
  (09.17.06) — pola yang sama dengan Rekap di v1.12.6
- 184 KB fungsi diagnostik ikut di-parse tiap eksekusi

---

## 🧭 Sidebar menu guru + daftar kelas (v1.13.0)

**Usul Anda:** *"mungkin perlu di buat side bar, supaya tidak bolak
balik ke beranda"* · *"di side bar kiri tetap, dan daftar kelas saya
juga ditampilkan di sidebar"*

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| **`js_menu.html`** | 🔴 **BARU — buat berkas baru** | seluruh sidebar |
| `index.html` | 🔴 **Wajib** | `include('js_menu')` |
| `css.html` | 🔴 **Wajib** | gaya `.menu-tautan` |
| `js_beranda.html` | 🔴 **Wajib** | pasang sidebar (guru saja) |
| `js_kelola.html` | 🔴 **Wajib** | 2 layar + 3 pembatal |
| `js_rekap.html` | 🔴 **Wajib** | pasang sidebar |
| `js_core.html` | 🟡 | logout mengosongkan daftar kelas |
| `Code.gs` | 🟡 | 4 penanda + versi `1.13.0` |

⚠️ **`js_menu.html` berkas BARU** — buat file HTML baru di editor
Apps Script dengan nama persis `js_menu`, lalu tempel isinya.

### Mengapa cache 30 detik gagal

Log Anda memberi angka yang menentukan. Jarak antar kunjungan beranda:

```
46 · 55 · 48 · 39 detik
```

**Semuanya di atas 30 detik.** Cache v1.12.8 selalu keburu
kedaluwarsa. Kodenya bekerja persis seperti dirancang — **angkanya
yang saya tebak, dan tebakannya meleset.**

### Yang Anda tunjukkan lebih dalam daripada pengukuran saya

Anda tidak bolak-balik ke beranda karena ingin melihatnya. Anda lewat
sana karena beranda **satu-satunya jalan** ke Kelola Kelas, Kelola
Murid, dan Rekap.

Menaikkan umur cache hanya membuat singgah itu lebih murah. Sidebar
menghilangkannya: **5 kunjungan → 0**.

### Yang dibuat

Sidebar kiri tetap, berisi 7 pintasan + daftar 8 kelas Anda:

```
🏠 Beranda          📘 XI TJKT 1 - PKPJ
📚 Kelola Kelas     📘 XI TJKT 2 - PKPJ
👥 Kelola Murid     📘 XI TJKT 3 - PKPJ
✏️ Nilai LKPD        ⋮
👨‍👩‍👦 Tugas Kelompok
🎯 Koreksi Quiz
📊 Rekap Nilai
```

- Tiap kelas menuju **langsung** ke layar pertemuannya
- Menu yang sedang dibuka ditandai garis hijau
- Di ponsel jadi laci `☰ Menu`
- Daftar kelas dipakai ulang antar layar — berpindah menu **nol
  panggilan**
- **Guru saja.** Murid sudah punya sidebar isi kelas (`js_nav`)

Tidak ada tata letak CSS baru: seluruhnya menumpang `.tata-nav` dan
`.sisi-nav` milik `js_nav`.

### Uji

**`run89-sidebar-menu.js`** — 45 pemeriksaan dengan jsdom. Dibuktikan
merah dengan lima bug: sidebar bocor ke murid · hapus kelas lupa
membatalkan · `js_menu` lupa didaftarkan di index · daftar kelas tidak
dipakai ulang (`3 panggilan`) · menu aktif tidak ditandai.

Bagian H khusus menjaga `js_menu` dan `js_nav` **tidak pernah
terpasang bersamaan** — keduanya memakai grid yang sama.

**`pratinjau-sidebar-menu.html`** — laptop & ponsel 390px, dibentuk
dengan menjalankan `_menuIsi()` yang sungguhan.

**Aturan §6.2 no. 103 & 104** ditambahkan.

### Catatan kejujuran

`run89` sempat mencetak nasihat perbaikan di samping tanda lolos
(§6.2 no. 74). Diperbaiki di **helper `B()`**, satu titik — menambal
per butir berarti butir berikutnya pasti terlupa.

### Belum dikerjakan

- `getStrukturKelas` 6× = 30% waktu — Anda memilih "nanti dulu"
- 184 KB fungsi diagnostik ikut di-parse tiap eksekusi

---

## 🔴 Menu sidebar membawa ke URL asing (v1.13.1)

**Laporan Anda:** mengeklik menu di sidebar jadi:

```
…googleusercontent.com/userCodeAppPanel?createOAuthDialog=true#/kelas/KLS-0056
```

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_menu.html` | 🔴 **Wajib** | `<button>` + `menuPergi()` |
| `css.html` | 🔴 **Wajib** | bersihkan bawaan tombol |
| `Code.gs` | 🟡 | penanda + versi `1.13.1` |

### Sebab

Aplikasi berjalan di dalam **iframe sandbox** Apps Script. Alamat
iframe itu (`userCodeAppPanel`) berbeda dari alamat aplikasi, jadi
`<a href="#/kelas/…">` menavigasi **iframe-nya sendiri** — bukan
mengubah rute.

Yang membuat ini murni kesalahan saya: **seluruh aplikasi sudah
memakai pola yang benar** sejak awal — `<button data-tautan="#/…">`
+ `pergiKe()`. Dari 20 berkas UI, `js_menu` yang saya buat kemarin
satu-satunya yang memakai `<a href>`. Hanya itu yang rusak.

Pelajarannya: pola yang sudah dipakai 20 berkas bukan kebetulan.

### Perbaikan

Menu kini `<button>` + `menuPergi()` yang memanggil `pergiKe()`.
Bawaan tombol dibersihkan di CSS (`border: 0`, `background: none`,
`width: 100%`, `text-align: left`) — tanpa itu menu tampil sebagai
tombol abu-abu yang menciut di tengah.

### Uji

`run89` bertambah **bagian H2** (8 pemeriksaan), memindai **seluruh
berkas UI** — bukan js_menu saja — supaya kelas bug ini tidak pernah
masuk lagi lewat berkas mana pun. Kini 53 pemeriksaan.

**Cacat uji yang tertangkap saat membuktikan merah:** penjaga pertama
mencari `href="#/` literal, padahal kode menyusun rutenya lewat
variabel (`href="' + m.tautan + '"`). Saat bug asli disisipkan ulang,
8 butir lain merah tetapi penjaga yang KHUSUS untuk bug ini justru
**hijau**. Polanya diperbaiki; sekarang ikut merah dengan pesan
`melanggar: js_menu.html`.

**Aturan §6.2 no. 105** ditambahkan.

---

## 🔴 Sidebar hilang di layar tujuan (v1.13.2)

**Laporan Anda:** *"saat klik nilai LKPD, nilai tugas kelompok,
koreksi kuis, kelas saya lalu side bar hilang."*

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_lkpd.html` | 🔴 | Nilai LKPD + LKPD per kelas |
| `js_quiz.html` | 🔴 | Koreksi Quiz + Bank Soal + Nilai Quiz |
| `js_kelompok.html` | 🔴 | Tugas Kelompok |
| `js_editor.html` | 🔴 | layar kelas + pertemuan + API Key |
| `js_refleksi.html` | 🔴 | Refleksi kelas + rekapnya |
| `js_auth.html` | 🟡 | antrean reset sandi |
| `Code.gs` | 🟡 | 5 penanda + versi `1.13.2` |

### Sebab

v1.13.0 memasang sidebar di 4 layar yang "terasa utama". Sisanya
terlewat — termasuk **layar yang justru dijangkau dari sidebar itu
sendiri**.

Alat navigasi yang lenyap tepat setelah dipakai lebih membingungkan
daripada tidak ada sama sekali: Anda terlempar dan harus kembali ke
beranda — persis masalah yang hendak dihapus.

### Audit menemukan 7 layar lagi

Alih-alih menambal empat yang Anda sebut, saya memindai **seluruh**
`daftarRute()`. Hasilnya ada 7 layar guru lain yang belum ketahuan:

```
reset · api-key · lkpd-kelas · soal · nilai-quiz
refleksi-kelas · rekap-refleksi
```

Tidak satu pun terpikirkan saat memasang manual. Sekarang **nol layar
guru tanpa sidebar**.

Rute murid diperiksa terpisah dan tidak tersentuh — mereka tetap
memakai `js_nav` (sidebar isi kelas).

### 🔴 Cacat uji yang MENGHALANGI perbaikan

`run89` bagian H melarang satu **berkas** memuat dua sidebar. Itu
keliru: `js_lkpd` memang berisi dua rute — `lkpd` (murid,
`navRangka`) dan `nilai-lkpd` (guru, `menuRangka`).

Jadi begitu saya memasang sidebar dengan benar, uji saya sendiri
berubah **merah**. Larangan yang benar berlaku per **rute**, bukan
per berkas.

Kini bagian H memindai tiap `daftarRute()` dan menjaga tiga hal
sekaligus: tidak ada rute berisi dua sidebar · murid tidak kebagian
sidebar guru · **setiap layar guru punya sidebar**.

Dibuktikan merah dengan melepas sidebar dari dua layar:
`sidebar hilang di: nilai-lkpd, koreksi-quiz`.

**Aturan §6.2 no. 106** ditambahkan.

---

## ⚡ Daftar kelas dipanggil dua kali (v1.13.3)

**Log Anda sesudah sidebar dipakai** — dan kabar baiknya lebih dulu:

| | sebelum sidebar | sesudah sidebar |
|---|---|---|
| `getBeranda` | **5×** (22,4 dtk) | **1×** (4,8 dtk) |

**Sidebar bekerja.** Kunjungan beranda yang sekadar numpang lewat
benar-benar hilang.

### Tetapi ada bug baru — buatan saya sendiri

```
11.24.29  getBeranda      +  getDaftarKelas   ← detik SAMA
11.24.51  getDaftarMurid  +  getDaftarKelas   ← detik SAMA

getDaftarKelas 4× = 8,1 detik
```

Sidebar memuat daftar kelas untuk dirinya, sementara layar Kelola
Kelas / Kelola Murid / Rekap memuat daftar yang **sama** untuk isinya.
Dua eksekusi Apps Script terpisah, dua kali biaya lantai, data identik.

Kelas bug ini **lahir dari sidebarnya** — sebelum v1.13.0 hanya ada
satu pemanggil.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_menu.html` | 🔴 | `daftarKelasBersama()` |
| `js_kelola.html` | 🔴 | 4 tempat pakai sumber bersama |
| `js_rekap.html` · `js_editor.html` | 🔴 | 1 tempat masing-masing |
| `Code.gs` | 🟡 | 2 penanda + versi `1.13.3` |

### Perbaikan

Satu pintu: `daftarKelasBersama()`. Hasilnya disimpan 5 menit, **dan**
permintaan yang datang selagi yang pertama berjalan ikut menunggu
janji yang sama.

Bagian kedua itu yang mudah terlupa: menyimpan hasil saja tidak cukup,
karena dua pemanggil pada milidetik yang sama sama-sama melihat cache
kosong lalu menembak sendiri-sendiri — persis yang terlihat di
11.24.29 dan 11.24.51.

Galat **diteruskan** ke pemanggil: layar yang memakai daftar itu untuk
isinya harus tahu, jangan dikira daftarnya memang kosong.

Jalur lama tetap ada di balik penjaga `typeof` — bila `js_menu` belum
tersalin, semua layar tetap bekerja seperti sebelumnya.

### Uji

`run89` bertambah **bagian H3** (7 pemeriksaan) — kini 60. Dibuktikan
merah dengan dua bug: layar memanggil sendiri
(`memanggil langsung: js_kelola.html`) dan janji serentak dilepas.

Penjaga memindai **seluruh** berkas `js_*`, bukan yang teringat saja.

**Aturan §6.2 no. 107** ditambahkan.

---

## ⚡ Sidebar dibenihi dari beranda (v1.13.4)

**Log Anda** — v1.13.3 bekerja: `getDaftarKelas` turun **4× → 1×**.

Tetapi satu yang tersisa itu pun ternyata tidak perlu:

```
11.38.50  getBeranda      5,615 dtk
11.38.50  getDaftarKelas  3,011 dtk   ← detik yang SAMA
```

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_menu.html` | 🔴 | `benihiKelasSidebar()` + tunda di beranda |
| `js_beranda.html` | 🔴 | membenihi sidebar di 2 jalur |
| `Code.gs` | 🟡 | 2 penanda + versi `1.13.4` |

### Sebab

`getBeranda` **sudah** mengirim `d.kelas` berisi `kelas_id`,
`nama_kelas`, dan `mapel` — persis yang dibutuhkan sidebar. Panggilan
kedua itu murni pemborosan.

Ini jebakan optimasi bertahap: setelah v1.13.3 menggabungkan pemanggil
yang sama, saya berhenti — lupa bertanya apakah panggilan itu perlu
**sama sekali**.

### Perbaikan

Sidebar dibenihi dari jawaban beranda. Di layar beranda ia sengaja
**menunggu 1,2 detik** — tanpa itu keduanya tetap berangkat bersamaan
dan benihnya datang terlambat.

Tiga penjagaan:

- **Benih tidak menimpa data lengkap.** Beranda kirim 3 kolom;
  `getDaftarKelas` kirim 10 (termasuk `fase`, `kompetensi_keahlian`
  yang dipakai layar Kelola Kelas).
- Layar Kelola Kelas tetap memanggil sendiri — ia butuh kolom itu.
- Jalur lama tetap ada di balik penjaga `typeof`.

**Harapan: `getDaftarKelas` hilang sama sekali dari log saat login.**

### Uji

`run89` kini **69 pemeriksaan** (+bagian C2). Dibuktikan merah dengan
dua bug: sidebar langsung menembak di beranda, dan beranda tidak
membenihi.

**Cacat uji yang tertangkap:** percobaan kedua awalnya **tidak merah**
— uji memanggil `benihiKelasSidebar()` sendiri, jadi tidak peduli
apakah `js_beranda` benar-benar memanggilnya. Fungsi yang ada tidak
berarti dipakai. Ditambah penjaga yang membaca pemanggilnya dari kode.

Bagian D juga dibuat mandiri: bagian C2 mengosongkan cache di akhir,
dan D mewarisi keadaan itu (§6.2 no. 79).

**Aturan §6.2 no. 108** ditambahkan.

---

## 🎓 Item tampil di Daftar Isi murid (v1.14.0)

**Permintaan Anda:** *"dalam tampilan kelas pada bagian daftar isi,
pada bagian pertemuan tampilkan item nya. jadi alurnya lebih singkat
tidak terlalu banyak klik"*

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Belajar.gs` | 🔴 **Wajib** | daftar item ikut dikirim |
| `js_belajar.html` | 🔴 **Wajib** | `daftarItemMurid()` + klik item |
| `css.html` | 🔴 **Wajib** | gaya `.item-baris` |
| `Code.gs` | 🟡 | 2 penanda + versi `1.14.0` |

⚠️ **`js_belajar.html` dan `css.html` harus disalin BERSAMA** — tanpa
CSS, daftar item tampil berpeluru tanpa gaya.

### Yang berubah

| | sebelum | sesudah |
|---|---|---|
| Sampai ke satu materi | Daftar Isi → pertemuan → item = **2 klik** | **1 klik** |

Tiap pertemuan kini langsung memperlihatkan isinya:

```
Pertemuan 1.2  Pengalamatan IP dan Subnetting        40%
   ✅ Kelas IP address
   📄 Menghitung subnet mask · bagian 2/4
   ⏳ LKPD 2 — Perhitungan subnetting · menunggu nilai
   👥 Rancang skema IP sekolah              opsional
   🎯 Quiz Subnetting
```

Sesuai pilihan Anda, item pada pertemuan yang **masih terkunci tetap
ditampilkan bergembok** — murid tahu apa yang menanti, tetapi tidak
bisa membukanya.

### Kunci bertahap tetap utuh

Ini yang paling saya jaga. Server menghitung `terbuka: terbuka &&
i.terbuka` — item pada pertemuan terkunci **selalu** tertutup, apa pun
keadaan itemnya sendiri. Tanpa `&&` itu, seluruh mekanik pembelajaran
bertahap runtuh dan gejalanya baru terlihat setelah ada murid yang
mencoba.

Payload sengaja ramping: `deskripsi` dan `tujuan_pembelajaran` **tidak**
ikut dikirim — satu kelas bisa ratusan item.

### Uji

**`run90-item-daftar-isi.js`** — 38 pemeriksaan. Dibuktikan merah
dengan tiga bug:

| Bug disisipkan | Merah |
|---|---|
| item tidak dikirim (keadaan v1.13.4) | `4 pertemuan tanpa larik item` |
| **item terkunci ikut terbuka** | `murid dapat melompati urutan belajar` |
| klik item diperiksa sesudah pertemuan | `klik item selalu tertangkap sebagai klik pertemuan` |

**`pratinjau-item-daftar-isi.html`** — sebelum/sesudah + ponsel 390px.

Penjaga keseimbangan tag pratinjau sempat salah tuduh: ia menghitung
`<button>` yang muncul sebagai **teks** di dalam selektor CSS. Blok
`<style>` kini dibuang lebih dulu.

**Aturan §6.2 no. 109** ditambahkan.

---

## ⚡ Sidebar murid menyegarkan terlalu sering (v1.14.1)

**Log Anda** — kabar baik dulu: **v1.14.0 terbukti bekerja.**

```
14.11.57  getPertemuanMurid  1,570   ← buka kelas
14.11.57  getIndeksKelas     1,590
14.12.11  bukaMateri         5,519   ← klik item LANGSUNG
```

`getDetailPertemuanMurid` **hilang dari log** — murid tidak singgah
di layar pertemuan lagi. Dua klik jadi satu, persis yang diminta.

### Tetapi

```
14.11.57  getIndeksKelas  1,590 dtk
14.12.16  getIndeksKelas  5,773 dtk   ← 19 detik kemudian
```

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_nav.html` | 🔴 **Wajib** | `JEDA_SEGAR_NAV` |
| `Code.gs` | 🟡 | penanda + versi `1.14.1` |

### Sebab

`_navSegarkanLatar()` dipanggil **setiap kali sidebar dipasang** — dan
sidebar dipasang ulang di tiap layar murid: daftar pertemuan, buka
materi, pindah bagian, LKPD, quiz.

Cache-nya bekerja dengan benar. Yang tidak dibatasi adalah
**penyegarannya**.

Tujuannya sah: perubahan dari guru (LKPD baru dinilai) harus terlihat
tanpa memuat ulang halaman. Yang keliru hanya frekuensinya.

### Perbaikan

Jeda minimum **30 detik** antar penyegaran latar — jauh di bawah
ambang yang bisa disadari murid.

Dua hal tetap dijaga:

- `navSegarkan()` (dipanggil setelah murid menyelesaikan item)
  **memaksa** dan tidak tertahan jeda;
- pengambilan penuh ikut memperbarui stempel, supaya tidak langsung
  disusul penyegaran beberapa milidetik kemudian.

### Uji

`run90` bertambah **bagian G** — kini 44 pemeriksaan. Dibuktikan
merah dengan dua bug: jeda dilepas, dan penyegaran dihapus total.

**Cacat uji:** percobaan kedua awalnya **tidak merah** — pola
`/_navSegarkanLatar\(kelasId\)/` juga cocok dengan **definisi**
fungsinya, jadi tetap hijau walau seluruh pemanggilnya dihapus. Kini
menghitung pemanggilan di dalam `navMuat()`.

Dua uji lama (`run17`, `run20`) ikut disesuaikan: keduanya memanggil
`navMuat()` dua kali dalam hitungan milidetik — keadaan yang di
lapangan tidak pernah terjadi. Stempelnya dimundurkan agar yang diuji
tetap perilaku aslinya, bukan jedanya.

**Aturan §6.2 no. 110** ditambahkan.

---

## 📚 Pertemuan dapat dilipat (v1.14.2)

**Permintaan Anda:** *"tampilkan item pada pertemuan yang sedang
dikerjakan, untuk pertemuan yang selesai dan dikunci di lipat"*

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_belajar.html` | 🔴 **Wajib** | `ptmTerlipat()` + tombol lipat |
| `css.html` | 🔴 **Wajib** | gaya `.btn-lipat-ptm` |
| `Code.gs` | 🟡 | 2 penanda + versi `1.14.2` |

⚠️ **Dua berkas pertama harus disalin BERSAMA** — tanpa CSS, panah
lipat menimpa nomor pertemuan.

### Yang berubah

v1.14.0 memenuhi permintaan sebelumnya secara harfiah: seluruh item
semua pertemuan. Pada kelas Anda itu 8 × 5 = **40 baris** sekaligus.

Terukur di pratinjau dengan 3 pertemuan contoh:

| | item tampil |
|---|---|
| v1.14.0 | **12** |
| v1.14.2 | **5** (hanya yang berjalan) |

Bawaan sekarang:

| Status pertemuan | Item |
|---|---|
| **berjalan** | terbuka |
| selesai | dilipat |
| terkunci | dilipat |

Panah **›** di kiri tiap pertemuan membukanya kembali — murid sering
mengulang materi yang sudah tuntas, jadi melipat tidak boleh berarti
menyembunyikan.

Pilihan murid mengesampingkan bawaan, tetapi hanya selama halaman
terbuka. Saat kelas dibuka lagi, yang terbentang tetap pertemuan yang
sedang dikerjakan.

### Rincian yang dijaga

- **Tombol lipat adalah `<button>` tersendiri**, bukan anak tombol
  pertemuan — `<button>` di dalam `<button>` tidak sah dan tidak dapat
  dijangkau papan ketik.
- **Diperiksa paling dulu** saat diklik; kalau tidak, panah tertangkap
  sebagai klik pertemuan dan layar malah berpindah.
- **Hanya daftar isi yang digambar ulang** — menggambar ulang seluruh
  halaman membuatnya melompat ke atas.
- `aria-expanded` diisi untuk pembaca layar.

### Uji

`run90` bertambah **bagian F2** (15 pemeriksaan) — kini 59.
Dibuktikan merah dengan tiga bug: semua pertemuan terbuka (keadaan
v1.14.0), item tetap tampil walau terlipat, dan tombol lipat
diperiksa sesudah pertemuan.

**Aturan §6.2 no. 111** ditambahkan.

---

## ↻ Tombol Segarkan pada layar penilaian (v1.14.3)

**Permintaan Anda:** *"tambahkan menu penyegaran pada penilaian quiz,
lkpd, dan tugas kelompok"*

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_core.html` | 🔴 **Wajib** | `btnSegarkan()` + `pasangSegarkan()` |
| `js_lkpd.html` | 🔴 **Wajib** | tombol di Penilaian LKPD |
| `js_quiz.html` | 🔴 **Wajib** | tombol di Koreksi Quiz |
| `js_kelompok.html` | 🔴 **Wajib** | tombol di Tugas Kelompok |
| `Code.gs` | 🟡 | 4 penanda + versi `1.14.3` |

Bila `js_core` belum tersalin, tombolnya **tidak muncul** — ketiga
layar tetap bekerja seperti sebelumnya (dijaga `typeof`).

### Mengapa justru tiga layar itu

Ketiganya menampilkan antrean yang berubah karena **murid**
mengumpulkan, bukan karena Anda. Layar guru lain (Kelola Kelas,
Rekap) berubah karena perbuatan Anda sendiri, jadi selalu tergambar
ulang sesudahnya — tombol di sana hanya menambah kebisingan.

Sebelumnya satu-satunya cara melihat pekerjaan yang baru masuk adalah
berpindah layar lalu kembali.

### Sengaja manual

Bukan penyegaran otomatis. Dua tebakan jeda saya sebelumnya meleset
(30 detik vs ritme Anda 32–37 detik), dan daftar yang menyusun ulang
dirinya sendiri selagi dibaca justru membingungkan. Anda yang
memutuskan kapan daftarnya berubah.

### Rincian yang dijaga

- **Penangan dipasang di setiap jalur keluar** — termasuk saat antrean
  kosong, keadaan yang justru paling sering Anda lihat.
- **Tombol dilumpuhkan selagi memuat** (`↻ Memuat…`), supaya klik
  berulang tidak memicu beberapa pemuatan sekaligus.
- **Cache beranda ikut dibuang** — angka "N menunggu" di beranda tidak
  boleh bertentangan dengan daftar yang baru Anda segarkan.
- Fungsinya hidup di `js_core` saja; tiga salinan pasti melenceng.

### Uji

**`run91-tombol-segarkan.js`** — 28 pemeriksaan. Dibuktikan merah
dengan tiga bug: penangan jalur kosong lupa dipasang, cache beranda
tidak dibuang, dan tombol tidak dilumpuhkan.

**Cacat uji:** penjaga pertama menuntut "≥ 2 pemasangan" di tiap
berkas dan **menuduh `js_quiz` keliru** — padahal `js_quiz` benar, ia
menyusun satu string lalu menulisnya sekali di akhir. Kini dihitung
dari jumlah jalur keluar yang sesungguhnya.

**Aturan §6.2 no. 112** ditambahkan.

---

## ↻ Segarkan pada layar penilaian PER ITEM (v1.14.4)

**Ralat Anda:** *"maksud saya tombol refresh di penilaian dalam item
quiz, lkpd, tugas kelompok dalam pertemuan"*

v1.14.3 saya pasang di layar **antrean** (dibuka dari sidebar).
Yang Anda maksud layar **per item** — dibuka dari dalam pertemuan.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_lkpd.html` | 🔴 | tombol di LKPD per item |
| `js_quiz.html` | 🔴 | tombol di Quiz per item |
| `js_kelompok.html` | 🔴 | tombol di Tugas Kelompok per item |
| `Code.gs` | 🟡 | 3 penanda + versi `1.14.4` |

`js_core.html` **tidak berubah** — fungsinya sudah ada sejak v1.14.3.

### Anda benar, dan itu memang layar yang lebih penting

Layar per item justru **paling lama ditunggui**: Anda membuka satu
LKPD, menilai murid satu per satu, sementara murid lain masih
mengumpulkan. Di layar antrean Anda hanya lewat.

Sekarang tombolnya ada di **enam layar**:

| | dari sidebar | dari dalam pertemuan |
|---|---|---|
| LKPD | ✅ v1.14.3 | ✅ **v1.14.4** |
| Quiz | ✅ v1.14.3 | ✅ **v1.14.4** |
| Tugas Kelompok | ✅ v1.14.3 | ✅ **v1.14.4** |

Letaknya sama: pojok kanan atas sejajar judul.

### Uji

`run91` diperluas dari 3 layar jadi **6** — kini 40 pemeriksaan.
Dibuktikan merah: tombol quiz-per-item dihapus, dan penangan
kelompok-per-item lupa dipasang.

**Cacat uji:** penghitung jalur keluar menghitung per **berkas**,
padahal tiap berkas kini memuat dua layar — layar per item dituduh
kurang satu pemasangan. Kini dipotong per layar.

**Aturan §6.2 no. 112** diperluas: pasang di seluruh layar sekelas,
buktikan dengan memindai — bukan mengingat.

---

## 🌳 Sidebar dibentangkan sampai item (v1.15.0)

**Permintaan Anda:** *"pada side bar kelas saya, tampilkan semua sub
bagiannya sampai di daftar itemnya. tapi buat lipatan. biar gak bolak
balik kembali ke halaman utama kelas. buka lipatan untuk kelas yang
sedang di akses"*

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `MateriPokok.gs` | 🔴 **Wajib** | `struktur()` mengirim daftar item |
| `js_menu.html` | 🔴 **Wajib** | bentangan + lipatan |
| `css.html` | 🔴 **Wajib** | gaya empat tingkat |
| `Code.gs` | 🟡 | 2 penanda + versi `1.15.0` |

⚠️ **`js_menu.html` dan `css.html` harus disalin BERSAMA** — tanpa
CSS, keempat tingkat tampil rata tanpa jorokan.

### Yang berubah

```
📘 XI TJKT 1 - PKPJ                    ← panah › membentangkan
  DASAR JARINGAN KOMPUTER
  › 1.1 Pengenalan Jaringan
      📄 Apa itu jaringan               (abu — lewat editor)
      📄 Topologi jaringan              (abu)
      📝 LKPD 1 - Menggambar topologi   → daftar pengumpulan
      🎯 Quiz Pengenalan                → bank soal
  › 1.2 Pengalamatan IP
      📝 LKPD 2 - Subnetting
      👥 Rancang skema IP sekolah  draf
  KONFIGURASI PERANGKAT
  › 2.1 Router dan Switch  draf
      belum ada item
```

**Kelas yang sedang Anda buka terbentang sendiri** — dibaca dari
alamat, dengan cadangan dari `State.kelasAktif` (layar penilaian per
item tidak memuat kelas_id di alamatnya).

### Yang dijaga

- **Satu kelas saja yang terbentang.** Membuka kelas lain menutup yang
  sebelumnya — delapan kelas sekaligus akan mengembalikan masalah
  "terlalu panjang" yang justru dihindari v1.14.2.
- **Pertemuan dapat dilipat sendiri** di dalam bentangan.
- **Panah terpisah dari judul**: panah membentangkan, judul berpindah
  ke layar kelas. Anda sering ingin melihat isinya tanpa meninggalkan
  layar yang sedang dikerjakan.
- **Item `materi` tampil abu-abu dan tidak dapat diklik** — guru
  mengelolanya lewat editor pertemuan, tidak ada layar penilaian
  tersendiri. Tetap ditampilkan supaya susunannya utuh.
- **Buka-tutup lipatan tidak memanggil server.** Struktur disimpan per
  kelas 5 menit, dengan janji bersama untuk permintaan serentak.
- Tautan tiap item menuju layar **guru** (`#/lkpd-kelas/`, `#/soal/`,
  `#/nilai-kelompok/`, `#/rekap-refleksi/`) — bukan layar murid.

### Uji

**`run92-sidebar-bentang.js`** — 46 pemeriksaan, dijalankan sungguhan
dengan jsdom. Dibuktikan merah dengan tiga bug: backend tidak mengirim
item, semua kelas terbentang sekaligus, dan kelas aktif tidak
terbentang otomatis.

**Cacat uji:** di Node `location` bukan variabel global — hanya
`window.location`. Penjaga `typeof location !== 'undefined'` diam-diam
jatuh ke jalur cadangan, sehingga cabang "baca dari alamat" **tidak
pernah teruji** dan tampak gagal padahal kodenya benar. Dijembatani di
berkas ujinya.

**Aturan §6.2 no. 113** ditambahkan.

---

## 🔴 Dua bug sidebar dari lapangan (v1.15.1)

**Laporan Anda:** *"tidak bisa klik item materi di sidebar, lalu
sidebar menghilang saat klik item LKPD dan tugas kelompok"*

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_kelompok.html` | 🔴 **Wajib** | sidebar di layar penilaian kelompok |
| `js_quiz.html` | 🔴 **Wajib** | sidebar di layar koreksi |
| `js_menu.html` | 🔴 **Wajib** | item materi dapat diklik |
| `Code.gs` | 🟡 | 2 penanda + versi `1.15.1` |

### Bug 1 — sidebar menghilang

Anda benar, dan ini kesalahan saya yang **ketiga kali dengan pola
sama**. Audit v1.13.2 memindai tiap `daftarRute(` lalu menyatakan
tuntas. Tetapi sebagian rute hanya menyalurkan:

```js
daftarRute('nilai-kelompok', function (arg) {
  muatLayarKelompok(id);        // ← INI yang menggambar layar
});
```

Penjaganya bahkan **sengaja mengecualikan** rute yang mendelegasikan
— jadi `muatLayarKelompok()` dan `gambarKoreksi()` lolos selama dua
versi.

Kini yang dipindai adalah **setiap fungsi yang memanggil
`render('tpl-dashboard')`** — penanda sesungguhnya bahwa sebuah layar
sedang digambar. Audit menemukan tepat dua yang tertinggal, keduanya
yang Anda laporkan.

Tiga layar tetap tanpa sidebar, masing-masing beralasan: `router`
(bukan layar), beranda murid, dan murid mengerjakan quiz (layar fokus).

### Bug 2 — item materi tidak bisa diklik

Ini **keputusan saya yang keliru**, bukan kelalaian. v1.15.0 sengaja
membuat materi `disabled` karena guru tidak punya layar penilaian
untuk materi.

Yang saya lewatkan: Anda tidak membedakan *"tidak punya layar
penilaian"* dari *"rusak"*. Yang terlihat hanyalah satu baris yang
tidak bereaksi.

Materi memang dikelola lewat editor di layar pertemuan — jadi
tautannya kini menuju **pertemuannya**. Bukan tujuan sempurna, tapi
satu klik ke sana tetap lebih dekat daripada kembali ke halaman utama
kelas.

### Uji

`run92` kini **52 pemeriksaan** (+bagian I). Dua butir yang menjaga
keputusan lama **dibalik** jadi penjaga keputusan baru — bukan
dihapus.

Dibuktikan merah dengan kedua bug lapangan:
`sidebar hilang di: muatLayarKelompok` dan `materi menuju layar
pertemuannya → tujuan: null`.

**Aturan §6.2 no. 114 & 115** ditambahkan.

---

## ⚡ Sidebar menunggu sinyal, bukan detik (v1.15.2)

**Log Anda** — v1.15.1 terkonfirmasi bekerja. Tetapi:

```
09.27.18  getBeranda      6,748 dtk
09.27.19  getDaftarKelas  4,447 dtk   ← timer keburu habis
```

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_menu.html` | 🔴 **Wajib** | menunggu sinyal, bukan timer |
| `js_beranda.html` | 🔴 **Wajib** | melepas penungguan saat gagal |
| `Code.gs` | 🟡 | 2 penanda + versi `1.15.2` |

### Sebab

v1.13.4 membuat sidebar menunda pemuatan **1200 ms**, menunggu
`getBeranda` membenihinya. Hari ini `getBeranda` butuh **6,7 detik** —
timer habis enam detik sebelum benihnya datang, jadi panggilan kedua
tetap terjadi.

Ini kali **keempat** saya menebak angka waktu dan meleset:

| tebakan | ritme nyata |
|---|---|
| cache beranda 30 dtk | 39–55 dtk |
| jeda sidebar murid 30 dtk | 32–37 dtk |
| tunda sidebar 1200 ms | getBeranda 6,7 dtk |

Pada Apps Script satu panggilan bisa 1 detik atau 7. Sebaran itu jauh
lebih lebar daripada tebakan mana pun.

### Perbaikan

Sidebar kini menunggu **sinyal**: beranda memanggil
`benihiKelasSidebar()` saat datanya tiba — berapa lama pun itu.

Dan yang wajib menyertainya: **jalur pelepasan**. Bila `getBeranda`
gagal, benihnya tidak akan pernah datang; tanpa `lepasBenihSidebar()`
di cabang `catch`, daftar kelas kosong selamanya.

### Uji

`run89` kini **76 pemeriksaan**. Dibuktikan merah dengan dua bug:
timer dikembalikan (`1 panggilan sesudah 1,5 detik — timer masih
ada`) dan jalur gagal dihapus.

**Aturan §6.2 no. 116** ditambahkan: tunggu sinyal, jangan tunggu
detik — dan menunggu sinyal wajib punya jalur pelepasan.

---

## ⚡ getStrukturKelas dipanggil dua kali (v1.15.3)

**Log Anda** — v1.15.2 bekerja: `getDaftarKelas` **hilang** dari
alur login. Tetapi saat mengeklik kelas di sidebar:

```
09.48.46  getStrukturKelas  3,219 dtk
09.48.46  getStrukturKelas  3,223 dtk   ← detik yang SAMA
```

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_menu.html` | 🔴 **Wajib** | `strukturKelasBersama()` + pembatal |
| `js_editor.html` | 🔴 **Wajib** | memakai sumber bersama |
| `Code.gs` | 🟡 | 2 penanda + versi `1.15.3` |

### Sebab — pola yang sama, ketiga kalinya

Sidebar memuat struktur untuk bentangannya; `layarPertemuan()` memuat
struktur **yang sama persis** untuk isinya.

Sidebar guru menggandakan dua API, dan keduanya baru ketahuan dari log
Anda — satu per rilis:

| API | diperbaiki |
|---|---|
| `getDaftarKelas` | v1.13.3 |
| `getStrukturKelas` | **v1.15.3** |

Yang seharusnya saya lakukan sejak v1.13.0: begitu sidebar dipasang,
**daftar semua API yang ia panggil lalu cari siapa lagi yang memanggil
API itu.** Bukan menunggu log lapangan menemukannya satu per satu.

### Perbaikan

Satu pintu `strukturKelasBersama()` — hasil disimpan 5 menit,
permintaan serentak berbagi satu janji, galat diteruskan.

Sesudah Anda **menyimpan** pertemuan/bab/item, cache dibuang supaya
perubahannya langsung terlihat. Sembilan aksi simpan menandainya
`segar`; masuk lewat sidebar tetap memakai cache.

### ⚠️ getBeranda 6 detik — belum terjawab

Saya ukur ulang: **625 sel, 2 pembacaan.** Praktis tidak ada apa-apa
di sana. Angka 6,7 detik itu hampir seluruhnya biaya lantai Apps
Script, bukan kode.

Satu-satunya sasaran tersisa adalah **184 KB fungsi diagnostik** (24%
kode) yang ikut di-parse tiap eksekusi — dan itu menyentuh SEMUA
panggilan, bukan beranda saja. Belum dikerjakan.

### Uji

`run92` kini **61 pemeriksaan** (+bagian H2). Dibuktikan merah:
layar memanggil sendiri, dan aksi simpan tidak membuang cache.

**Aturan §6.2 no. 117** ditambahkan.

---

## 📍 Sidebar menggulir ke kelas yang aktif (v1.15.4)

**Ralat Anda:** *"bukan dipindahkan di atas daftar tapi posisi
scrolnya sesuai kelas yang aktif, selama ini saya klik kelas yang
paling bawah, lalu saya harus scroll ke bawah lagi"*

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_menu.html` | 🔴 **Wajib** | `_menuGulirKeAktif()` |
| `Code.gs` | 🟡 | penanda + versi `1.15.4` |

Hanya satu berkas UI — tidak ada perubahan CSS maupun backend.

### Sebab

Sidebar punya penggulirnya sendiri (`overflow-y: auto`) dan **digambar
ulang dari nol** setiap kali Anda berpindah layar. Gulirnya kembali ke
atas.

Akibatnya, kelas yang **baru saja Anda klik** justru hilang dari
pandangan tepat setelah diklik. Dengan 8 kelas, kelas paling bawah
paling terasa.

### Perbaikan

Sesudah daftar tergambar, sidebar menggulir sendiri ke blok kelas yang
sedang terbentang.

Tiga hal yang saya jaga supaya tidak mengganggu:

- **Hanya menggulir bila kelasnya di luar pandangan.** Yang sudah
  terlihat dibiarkan — kalau tidak, sidebar tersentak tiap kali Anda
  melipat satu pertemuan.
- **Ditempatkan di atas wilayah pandang**, bukan di tengah: isinya
  terbentang ke bawah, jadi ruang di bawahnya yang berguna.
- **Tanpa animasi** — `smooth` terlihat sebagai kedipan saat halaman
  baru digambar, dan tidak seragam didukung WebView Apps Script.

Sebelumnya ada **tiga tempat** menulis daftar kelas; memasang gulir di
salah satunya hanya menutup sebagian keadaan. Ketiganya disatukan
lewat `_menuGambarKelas()`.

### Uji

`run92` kini **71 pemeriksaan** (+bagian H3). Dibuktikan merah dengan
tiga bug: penggambar tidak menggulir, menggulir walau sudah terlihat,
dan jalur masuk layar menggambar sendiri.

**Cacat uji:** percobaan pertama memanggil `_menuGulirKeAktif()`
sendiri — jadi tetap hijau ketika penggambar berhenti memanggilnya,
dan **bug lapangan aslinya lolos**. Kini jalur sungguhannya yang
dipanggil, dengan geometri dipalsukan lewat
`Element.prototype.getBoundingClientRect`.

**Aturan §6.2 no. 118** ditambahkan.

---

## 🚫 "184 KB diagnostik" — klaim saya TERBANTAH (v1.15.5)

**Permintaan Anda:** garap yang 184 KB.

**Hasilnya: tidak jadi dikerjakan — karena klaim saya salah.**

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Code.gs` | 🟡 | versi `1.15.5` saja |

**Tidak ada perubahan perilaku aplikasi.** Yang bertambah hanya satu
berkas uji dan satu aturan.

### Apa yang saya klaim

Sejak 19 Agustus saya menyebut **lima kali** bahwa 189 KB fungsi
diagnostik (`ujiTahap2`…`ujiTahap18`, `cekBerkasUI`, dll — 25%
seluruh kode) *"ikut di-parse tiap eksekusi"* dan merupakan
*"satu-satunya yang menurunkan SEMUA panggilan sekaligus"*.

### Yang terjadi ketika diukur

| | |
|---|---|
| parse + eksekusi seluruh kode (761 KB) | **0,54 ms** |
| tanpa 189 KB diagnostik (572 KB) | **0,42 ms** |
| **hemat** | **0,12 ms** |

`getBeranda` Anda **6.500 ms**. Yang akan dihemat: **0,002%** — satu
bagian dari 54.000.

Perubahannya berisiko nyata: seluruh `ujiTahapN()` pindah berkas,
`Code.gs` harus Anda salin ulang utuh, plus membuat berkas baru. Untuk
keuntungan yang tidak akan pernah Anda rasakan.

### Pengulangan bukan bukti

Saya mengucapkannya lima kali tanpa sekali pun mengukurnya. Itu tetap
dugaan — hanya terdengar masuk akal karena angkanya besar.

Aturan §6.2 no. 85 yang saya tulis sendiri berbunyi: *bila dugaan
jarak jauh sudah dua kali meleset, berhenti menebak — buat alat
diagnosis.* Saya membuat alat untuk mengukur sel dan panggilan API,
tetapi tidak pernah untuk klaim ini.

### Lalu biaya lantai itu dari mana?

`getDaftarKelas` membaca **NOL sel** namun memakan 868–2.531 detik-mili.
Sisanya bukan parse kode, melainkan:

- membuka koneksi Spreadsheet (`SpreadsheetApp.openById`)
- membangun sandbox V8 & memuat pustaka Apps Script
- memvalidasi sesi
- serialisasi `google.script.run` bolak-balik

**Tidak satu pun dapat disentuh dari kode aplikasi.** Itu milik
infrastruktur Google.

### Yang sudah kita kerjakan justru satu-satunya jalan yang benar

Karena satu panggilan berbiaya ~1–2,5 detik apa pun isinya, jalan
satu-satunya adalah mengurangi **jumlah panggilan**:

| | sebelum | sekarang |
|---|---|---|
| login → beranda | 19,1 s | ~7,5 s |
| `getBeranda` per sesi | 5× | 1× |
| `getDaftarKelas` saat login | 4× | **0×** |
| `getStrukturKelas` buka kelas | 2× | 1× |

Log terakhir Anda tinggal empat panggilan, semuanya perlu. Pekerjaan
ini sudah hampir habis.

### Uji

**`perf21-biaya-parse.js`** — 17 pemeriksaan. Mengukur parse +
eksekusi dengan V8 (mesin yang sama dengan Apps Script), dan menjaga
agar diagnostik **tidak dipisah** tanpa mengukur ulang.

Bila kelak kode tumbuh sampai pemisahan itu benar-benar berarti,
ambang 5 ms di bagian B yang akan memberi tahu — bukan dugaan.

**Aturan §6.2 no. 119** ditambahkan.

---

## 🌱 Ikon aplikasi dari satu baris (v1.15.6)

**Pertanyaan Anda:** cara ganti ikon LessonLen.

Jawaban jujurnya waktu itu: **ubah di tiga berkas.** Jadi saya
pusatkan dulu, baru menjawab.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Code.gs` | 🔴 **Wajib** | `APP_IKON` + versi `1.15.6` |
| `index.html` | 🔴 **Wajib** | favicon + teruskan ke peramban |
| `js_core.html` | 🔴 **Wajib** | ikon & nama topbar |
| `js_auth.html` | 🔴 **Wajib** | isi layar masuk |
| `v_login.html` | 🔴 **Wajib** | id untuk diisi |

⚠️ Kelimanya harus disalin **bersama**. Bila `index.html`
tertinggal, favicon tetap ikon lama walau topbar sudah berubah —
gejala yang membingungkan karena separuh benar.

### Cara menggantinya sekarang

Satu baris di **`Code.gs`**:

```js
var APP_IKON = '\uD83C\uDF31';        /* 🌱 tunas */
```

Ganti jadi `'\uD83D\uDCDA'` untuk 📚, `'\uD83C\uDF93'` untuk 🎓,
`'\uD83C\uDF10'` untuk 🌐. Tabel lengkap ada di
**`CARA-PAKAI-IKON.md`**.

Nama aplikasi dua baris di atasnya (`APP_NAMA`) — itu sudah terpusat
sejak awal.

### Yang ikut berubah sekaligus

| Tempat | Terlihat di |
|---|---|
| Favicon | ikon kecil di tab peramban |
| Topbar | pojok kiri atas, semua layar |
| Layar masuk | ikon besar di atas kotak login |

### Mengapa ditulis `'\uD83C\uDF31'` dan bukan emoji langsung

Emoji mentah berisiko rusak saat disalin ke editor Apps Script —
sebagian penyalinan mengubahnya jadi `?`. Bentuk escape selalu aman;
yang tampil di layar tetap emoji.

### Catatan favicon

Peramban menyimpan favicon jauh lebih lama daripada berkas lain. Bila
ikon tab masih yang lama padahal topbar sudah berubah, buka di jendela
**Penyamaran** — kalau di situ sudah benar, itu hanya cache Anda.

### Uji

**`run93-ikon-terpusat.js`** — 31 pemeriksaan. Bagian E benar-benar
**mengganti** ikonnya lalu memastikan tidak ada nilai lama tertinggal,
bukan sekadar mencocokkan pola.

Dibuktikan merah dengan tiga bug: topbar diketik tangan, favicon
terlewat, dan `APP_IKON` tidak diteruskan ke template. Yang pertama
memerahkan 6 butir sekaligus.

**Aturan §6.2 no. 120** ditambahkan: pertanyaan *"cara ganti X?"*
yang dijawab *"ubah di tiga tempat"* adalah tanda X belum punya sumber
tunggal — perbaiki dulu, baru jawab.

---

## 🔴 "undefined murid" di Kelola Kelas (v1.15.7)

**Laporan Anda:** kartu kelas menampilkan
`👥 undefined murid 📅 undefined pertemuan`

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_menu.html` | 🔴 **Wajib** | penanda `Menu.ringkas` |
| `Code.gs` | 🟡 | penanda + versi `1.15.7` |

### Sebab — buatan saya sendiri di v1.13.4

`benihiKelasSidebar()` mengisi daftar kelas dari jawaban
`getBeranda` supaya tidak perlu memanggil `getDaftarKelas` lagi.
Tetapi benih itu hanya memuat **tiga kolom**:

```js
{ kelas_id, nama_kelas, mapel }
```

Cukup untuk sidebar. Tidak cukup untuk layar Kelola Kelas, yang juga
butuh `jml_murid`, `jml_pertemuan`, `fase`, `kompetensi_keahlian`,
`status`.

Sejak keduanya berbagi `daftarKelasBersama()`, layar itu menggambar
dari data separuh — dan kolom yang tidak ada menjadi `undefined`.

Terdampak juga: **Rekap Nilai** dan **panel salin pertemuan** (17
rujukan ke kolom di luar benih).

### Perbaikan

Benih kini menandai dirinya `Menu.ringkas = true`.
`daftarKelasBersama()` menolak menyajikan cache yang ringkas dan
tetap mengambil daftar utuh dari server.

Sidebar tetap memakai benih seketika — itulah gunanya. Yang berubah
hanya: layar yang butuh data lengkap tidak lagi tertipu.

### ⚠️ 109 berkas uji tidak menangkapnya

Ini yang paling perlu saya catat. Seluruh uji memeriksa apa yang
**tampil di sidebar**; tidak satu pun memeriksa apa yang **diterima
layar** dari sumber bersama.

`run89` kini punya bagian C3 (8 pemeriksaan) yang menguji dari sisi
pemakai — kini **84 pemeriksaan**. Dibuktikan merah dengan tiga bug,
salah satunya berpesan persis gejala Anda:
`layar menerima benih 3 kolom → "undefined murid"`.

**Aturan §6.2 no. 121** ditambahkan: cache yang diisi dari sumber
ringkas wajib menandai dirinya — dan saat membuat sumber bersama,
uji **tiap pemakainya**, bukan hanya pemilik datanya.

---

## 🔴 v1.16.0 DIBATALKAN — materi tidak pernah bisa selesai (v1.16.1)

**Laporan Anda:** *"tidak bisa lanjut ke item berikutnya setelah baca
materi, tandaiBagianSelesai di akhir bagian materi tidak ada"*

Log Anda memang tidak memuat satu pun `tandaiBagianSelesai`. Itu
bukan gejala sampingan — itu bug-nya sendiri, dan itu **kesalahan
saya di v1.16.0**.

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `js_belajar.html` | 🔴 **Wajib** | kembali menandai tiap bagian |
| `Belajar.gs` | 🔴 **Wajib** | `semua_bagian` dibuang dari payload |
| `Code.gs` | 🟡 | penanda + versi `1.16.1` |

⚠️ `js_belajar.html` adalah yang benar-benar memperbaiki keluhan.
Salin itu lebih dulu bila hanya sempat satu.

### Apa yang rusak

v1.16.0 mencatat bagian 1 & 2 **hanya di memori peramban**, lalu
memanggil server sekali saja di bagian terakhir. Tetapi server
menyimpan `bagian_terakhir` di sheet `progress` dan menolak lompatan.
Karena bagian 1 & 2 tidak pernah dikirim, panggilan bagian 3 ditolak:

```
ITEM_TERKUNCI  "Selesaikan bagian 1 terlebih dahulu."
```

Ditolak dalam mode `diam`, jadi tidak ada pesan galat di layar — dan
tidak ada baris di log eksekusi. Materi tidak pernah berstatus
`selesai`, sehingga item berikutnya tidak pernah terbuka.

Saya memutarnya ulang di uji sebelum menyentuh kode apa pun, jadi ini
bukan dugaan.

### Mengapa 32 pemeriksaan run94 tidak menangkapnya

Ini bagian yang paling perlu saya akui. `run94` lama menguji:

- bagian C: *server menolak lompatan bagian* → hijau, dan benar
- bagian E: *klien tidak memanggil server di bagian tengah* → hijau,
  dan benar

Keduanya benar sendiri-sendiri. Yang rusak adalah **gabungannya** —
dan tidak ada satu butir pun yang menjalankan keduanya berurutan
sampai keadaan akhir. Uji saya memeriksa potongan, bukan perjalanan.

### Yang dikembalikan

Tiap bagian materi kembali menandai selesai ke server, persis seperti
sebelum v1.16.0. Membaca materi 3 bagian kembali ~9 panggilan.

Itu memang lambat, dan saya tidak menutupinya. Tetapi cepat sambil
tidak bisa menyelesaikan materi bukan perbaikan apa pun.

Permintaan asli Anda — *"jadikan 1 panggilan API"* — masih mungkin
dikerjakan, hanya saja server harus ikut diubah supaya menerima
penandaan sekaligus. Itu menyentuh aturan kunci bertahap, jadi saya
tidak mengerjakannya diam-diam.

### Uji

**`run94-baca-satu-panggilan.js`** ditulis ulang — 20 pemeriksaan,
kini beralur utuh:

- bagian A menjalankan baca materi 3 bagian **dari awal sampai
  habis**, lalu membaca ULANG sheet `progress` untuk memastikan
  statusnya benar-benar `selesai`
- bagian B memutar ulang bug v1.16.0 secara permanen: langsung
  menandai bagian terakhir **harus ditolak**

Dibuktikan merah dengan menyisipkan kembali jalur v1.16.0 — 2 butir
gagal, bukan crash.

**Aturan §6.2 no. 124** ditambahkan.

---

## 📖 Baca materi: 9 panggilan → 2 (v1.16.0) — DIBATALKAN di v1.16.1

> ⚠️ **Bagian di bawah ini sudah TIDAK BERLAKU.** Perubahan ini
> membuat materi tidak pernah bisa diselesaikan dan dicabut di
> v1.16.1. Disimpan sebagai catatan supaya tidak diulang.

**Permintaan Anda:** *"bisa gak dijadikan 1 panggilan api ... data
semua materi di kirim, lalu tandai selesai itu saat selesai membaca
materi bagian terakhir"*

### Berkas yang perlu disalin ulang

| Berkas | Prioritas | Perubahan |
|---|---|---|
| `Util.gs` | 🔴 **Wajib** | `semuaBagian()` |
| `Belajar.gs` | 🔴 **Wajib** | `bukaMateri` kirim seluruh bagian |
| `js_belajar.html` | 🔴 **Wajib** | pindah bagian lokal + jaring pengaman |
| `Code.gs` | 🟡 | 2 penanda + versi `1.16.0` |

⚠️ `Belajar.gs` dan `js_belajar.html` harus **bersama**. Payload
baru tanpa layar baru = tidak ada yang berubah; layar baru tanpa
payload = jalur lokal tidak pernah aktif.

### Yang log Anda tunjukkan

Membaca **satu materi 3 bagian** = **14 panggilan, 65 detik**:

| | |
|---|---|
| `getIndeksKelas` | 4x, 18,6 dtk |
| `bukaMateri` | 3x, 12,7 dtk |
| `tandaiBagianSelesai` | 3x, 12,7 dtk |

### Usul Anda tepat, dan nol biaya

`bukaMateri` **sudah** membaca `item.konten` utuh dari sheet, lalu
membuang semua bagian kecuali satu. Mengirim seluruhnya tidak
menambah biaya server sama sekali.

Untuk materi 3 bagian:

| | sebelum | sesudah |
|---|---|---|
| `bukaMateri` | 3x | **1x** |
| `tandaiBagianSelesai` | 3x | **1x** |
| `getIndeksKelas` | 3x | **0x** |
| **total** | **9** | **2** |

Pindah bagian kini **seketika** — tidak menunggu jaringan sama
sekali.

### Keputusan Anda & risikonya

Anda memilih *"terakhir saja + simpan saat murid pergi"*. Itu tepat,
karena mencatat di akhir saja punya risiko nyata: murid berhenti di
bagian 2 dari 5, HP mati atau sinyal putus — progresnya hilang.

Jaring pengamannya dipasang pada **dua** peristiwa:

- `pagehide` — menutup tab (lebih andal daripada `beforeunload` di
  ponsel)
- `visibilitychange` — berpindah aplikasi, yang sering tidak memicu
  `pagehide` sama sekali

### Yang TIDAK saya longgarkan

Penjaga server tetap utuh. Justru karena kontennya kini ada di tangan
murid, penjaga urutan makin penting — dan `run94` bagian C
membuktikan server tetap menolak murid yang melompat ke bagian 3.

Klien ikut memeriksa hanya supaya tidak menggambar layar yang akan
ditolak, **bukan** sebagai pengganti.

### Uji

**`run94-baca-satu-panggilan.js`** — 32 pemeriksaan. Dibuktikan merah
dengan tiga bug: backend tidak kirim `semua_bagian`, jaring pengaman
dihapus, dan klien melompati kunci bagian.

**Aturan §6.2 no. 122 & 123** ditambahkan.

---

## v1.19.0 — Pramuat materi satu materi pokok

**Permintaan guru:** *"untuk klik materi pokok saja, semua materi
terdownload tapi tetap di lock sesuai urutan. jadi saat siswa membaca
materi tidak perlu memuat materi satu persatu, tinggal tandai selesai
aja yang aktif."*

### Bedanya dengan v1.16.0 yang dibatalkan

v1.16.0 juga mengirim seluruh bagian sekaligus, dan **gagal** — bukan
karena pramuatnya, tetapi karena kliennya berhenti memanggil
`tandaiBagianSelesai()` untuk bagian tengah. Server menyimpan
`bagian_terakhir` dan menolak lompatan, jadi panggilan bagian terakhir
ditolak `ITEM_TERKUNCI` dan materi tidak pernah bisa selesai.

Yang dihemat di sini **hanya panggilan `bukaMateri()`**. Pelaporan per
bagian tetap dikirim, dan itu dijaga oleh uji (`uji/materi.js` bagian
E: melompat ke bagian 3 tetap ditolak, berurutan 1→2→3 tetap berhasil).

### 🔴 Celah lama yang wajib ditutup lebih dulu

Sebelum mengerjakan pramuat, saya menemukan bahwa penjaga kunci hanya
ada di `bukaMateri()` — jalur **baca**. `tandaiBagianSelesai()` — tempat
progres benar-benar **ditulis** — hanya memeriksa enroll, status
publish, durasi minimum, dan urutan bagian. **Tidak** memeriksa kunci
pertemuan atau item.

Artinya murid yang memanggil `google.script.run.tandaiBagianSelesai(…)`
langsung, tanpa membuka materinya, bisa menandai pertemuan terkunci
sebagai selesai. Celah ini **sudah ada sebelum v1.19.0**, tersembunyi
karena alur normal selalu lewat `bukaMateri()` lebih dulu.

Begitu materi dipramuat, `bukaMateri()` tidak lagi dipanggil di alur
normal — jadi celah yang laten akan menjadi tidak terjaga sama sekali.
Karena itu penjaga kunci dipisah jadi `_statusBukaItem()` dan dipasang
di **kedua** jalur. Biayanya netral: perhitungan kunci ini sebelumnya
dilakukan `bukaMateri()` sekali per bagian juga, ia hanya berpindah.

Uji membuktikan: materi di pertemuan terkunci **ditolak** saat
menandai, dan tidak ada baris progres yang tertulis.

### Kunci tetap terasa di layar

Konten materi terkunci **ikut terkirim** — itu keputusan guru, dibuat
sadar setelah diberitahu bahwa murid bisa membacanya lewat DevTools:
*"gakpapa murid membuka di devtool, tidak masalah."*

Tetapi klien **tidak merendernya**. `materiAmbil()` mengembalikan null
untuk item yang `terbuka: false`, sehingga pemanggil jatuh ke
`bukaMateri()` dan ditolak seperti biasa — layar "Materi terkunci"
tetap muncul. Jadi "semua terdownload **tapi** tetap di lock" benar
berlaku, bukan sekadar kontennya ada. Dan logika kuncinya tidak
disalin ke klien: satu sumber, di server.

`Belajar.gs` baris 11 diubah: *"konten item terkunci TIDAK PERNAH
dikirim ke klien"* kini berlaku untuk **quiz**, dengan pengecualian
materi yang dijelaskan di tempat.

### Penyimpanan: memori saja

Bukan sessionStorage, dan itu bukan kebetulan. Konten basi ditangani
manual — guru menyuruh murid menyegarkan halaman. Itu hanya bekerja
bila penyegarannya membuang datanya, dan sessionStorage **selamat dari
refresh** (`js_nav.html:50` memakainya justru untuk itu). Dengan
sessionStorage, perintah "refresh" tidak menyembuhkan apa pun dan guru
harus menyuruh murid menutup tab.

Konsekuensinya: tanpa TTL, tanpa kuota, tanpa yang perlu dibersihkan —
kecuali saat keluar, lewat `materiReset()` di kedua jalur keluar.

### Gagal = kembali ke jalur lama

Pramuat berjalan di latar dan tidak ditunggu. Bila gagal, `mpId`
dikosongkan dan murid membaca lewat `bukaMateri()` seperti sebelumnya.
Tidak ada keadaan di mana murid kehilangan akses karena pramuat.

### Berkas

`Belajar.gs` (`_statusBukaItem`, `pramuatMateriPokok`, penjaga di jalur
tulis) · `Code.gs` (API + versi + 2 penanda) · `js_belajar.html`
(cache memori) · `js_core.html` (`materiReset` di jalur keluar) ·
`uji/materi.js` (baru). **Tanpa migrasi.**

### Uji

34 pemeriksaan, `Belajar.gs` asli di atas mock Db:

- pramuat: hanya tipe materi & publish; konten dipecah di server;
  konten mentah tidak ikut; materi kosong tetap 1 bagian
- penolakan: murid tak terdaftar, mp draf, mp tak dikenal
- status kunci: pertemuan pertama terbuka, kedua terkunci, kontennya
  tetap ada
- **`detailPertemuan` benar-benar mengirim `mp_id`** — tanpa ini pramuat
  tidak pernah terpicu dan fitur ini mati tanpa suara
- **penjaga jalur tulis: materi terkunci ditolak, nol progres tertulis**
- regresi v1.16.1: lompat bagian ditolak, 1→2→3 berhasil, durasi minimum
- klien: item terkunci tidak dilayani, bentuk setara `bukaMateri()`,
  progres ikut maju, `materiReset()` mengosongkan

Dibuktikan merah tiga kali: penjaga jalur tulis dibuang (2 gagal),
klien melayani item terkunci (1), pramuat tidak menyaring quiz (2).

### Yang belum terverifikasi

Tidak ada deployment Apps Script di lingkungan ini, jadi **perilaku di
peramban sungguhan belum diuji** — termasuk apakah pramuat benar-benar
terasa lebih cepat. Yang teruji adalah logika server dan fungsi klien
yang dipotong dari berkas yang dikirim.

---

## v1.18.5 — Jumlah murid & pertemuan di kartu kelas tidak diperbarui


**Laporan guru:** *"waktu menambahkan murid dan tambah pertemuan,
informasi jumlah murid dan jumlah pertemuan pada card kelas pada kelola
kelas tidak meng-update. 👥 2 murid 📅 10 pertemuan. di tekan refresh
dulu baru berubah."*

### Akarnya sama dengan v1.18.4, tetapi lebih dalam

Angka di kartu kelas berasal dari `getDaftarKelas`, yang disimpan di
`Menu.kelas` selama `UMUR_MENU_KELAS` (5 menit, `js_menu.html:47`).
**Tujuh aksi yang mengubah isi kelas tidak pernah membuangnya:**

| Berkas | Aksi | Yang dilakukan handler |
|---|---|---|
| `js_kelola.html:1129` | `simpanMurid` | `tutupPanel(false)` + `router()` |
| `js_kelola.html:656` | `imporMurid` | `tutupPanel(true)` |
| `js_kelola.html:555` | `enrollMurid` | `tandaiPanelKotor()` |
| `js_kelola.html:442` | `keluarkanMurid` | `tandaiPanelKotor()` |
| `js_editor.html:507` | `simpanPertemuan` | `layarPertemuan(…, true)` |
| `js_editor.html:524` | `hapusPertemuan` | `layarPertemuan(…, true)` |
| `js_editor.html:581` | `salinPertemuan` | `layarPertemuan(…, true)` |

`enrollMurid` bahkan sudah punya komentar *"jumlah murid di kartu kelas
berubah"* dan memanggil `tandaiPanelKotor()`. Tidak menolong:
`tutupPanel(true)` hanya **menggambar ulang**; yang dibaca tetap
`daftarKelasBersama()`, yang mengembalikan cache. **Menandai halaman
perlu disegarkan tidak ada gunanya bila penyegaran itu membaca data
yang sama.**

### Kenapa tidak ditambal di tujuh tempat itu

Karena itulah yang sudah terjadi tiga kali — v1.18.4 menambal dua
tempat, sekarang ketemu tujuh. Aksi ke-delapan akan melupakannya lagi.

Dipasang terpusat di `callApi()`:

```js
var API_UBAH_KELAS = {
  simpanKelas:1, duplikatKelas:1, hapusKelas:1,
  simpanMurid:1, imporMurid:1, enrollMurid:1, keluarkanMurid:1,
  simpanPertemuan:1, hapusPertemuan:1, salinPertemuan:1
};
```

Bila menambah API baru yang mengubah murid/pertemuan/kelas, tambahkan
namanya di satu daftar itu. Tidak ada tempat lain yang perlu disentuh.

### Klaim saya sendiri yang dikoreksi oleh sabotase

Saya menulis bahwa jaminan urutannya berasal dari pembatalan dipasang
**sebelum** `resolve()`. **Salah.** Sabotase membuktikan: memindahkannya
ke sesudah `resolve()` tidak mengubah hasil sama sekali.

| Sabotase | Hasil | Kenapa |
|---|---|---|
| dipindah sesudah `resolve()` | tidak berubah | keduanya sinkron |
| ditunda `Promise.resolve().then(…)` | tidak berubah | mikro-task FIFO |
| ditunda `setTimeout(…, 0)` | **merah, 11 gagal** | makro-task belakangan |

Alasan yang benar: `resolve()` hanya **menjadwalkan** mikro-task, tidak
menjalankannya; seluruh isi `withSuccessHandler` selesai lebih dulu
secara sinkron. Yang benar-benar dilarang hanya menundanya ke
makro-task. Komentar di kode sudah diluruskan.

### Biaya, terbuka

`getDaftarKelas` ≈ 3,0 detik dan `getStrukturKelas` ≈ 3,6 detik (log
lapangan 24 Agu 2026, `js_menu.html:6-12`). Setiap aksi di daftar itu
membuat sidebar memanggil keduanya lagi. Itu harga angka yang benar —
dan persis biaya yang sudah dibayar guru saat menekan refresh manual.

`pindahPertemuan` **sengaja tidak ikut**: server membatasinya pada satu
kelas (`Pertemuan.gs:286-289`), jadi jumlah di kartu tidak berubah dan
3 detik itu akan terbuang percuma.

### 🔴 Uji pindah ke dalam repo

Seluruh suite uji selama ini hidup di `/tmp/uji/`, dan **`/tmp` tidak
dipertahankan antar sesi** — semuanya hilang. Mulai versi ini uji
disimpan di `uji/` supaya tidak perlu ditulis ulang, dan supaya bisa
dijalankan siapa pun dengan `node uji/<nama>.js` tanpa dependensi.

Suite server (`run.js`, `run2.js`, `reset.js`, `penjaga.js`, `editor.js`)
**belum dibangun ulang** — harness-nya ikut hilang. Kode server tidak
berubah di versi ini kecuali nomor versi dan satu penanda.

### Uji

18 pemeriksaan (`uji/kartu.js`), menjalankan `callApi()` **asli** dari
`js_core.html` di atas `bataliMenuKelas()` **asli** dari `js_menu.html`:

- 10 aksi pengubah isi kelas → cache dibuang
- 6 aksi lain (`pindahPertemuan`, `getDaftarKelas`, …) → cache utuh
- `res.ok = false` → cache tidak dibuang
- **saat handler berjalan, cache sudah null** — jaminan urutannya

Dibuktikan merah: `simpanMurid` dikeluarkan dari daftar (2 gagal),
pembatalan ditunda `setTimeout` (11 gagal). Sabotase penundaan sempat
**tidak tertangkap** karena mock tidak menyediakan `setTimeout` sehingga
kode crash — celah harness, bukan uji lolos; diperbaiki dulu.

### Berkas

`js_core.html` · `Code.gs` (versi + 1 penanda) · `uji/kartu.js` (baru).
**Tanpa perubahan `.gs` berperilaku, tanpa migrasi.**

---

## v1.18.4 — Kelas baru tidak muncul sampai halaman dimuat ulang


**Laporan guru:** *"saat saya membuat kelas baru, di UI belum muncul
kelas baru, saat saya refresh baru muncul kelas baru."*

### Bukan cache yang lupa dibuang

Dugaan pertama saya salah dan perlu dicatat: `Db.tambah()` **sudah**
memanggil `invalidasi(nama)` (`Db.gs:796`), dan klien **sudah**
memanggil `bataliMenuKelas()` setelah menyimpan. Keduanya ada. Yang
salah adalah **urutannya**.

```js
callApi('simpanKelas', [p], …)
  .then(function (r) {
    _panelKotor = false;
    tutupPanel(true);                       /* ← router() → gambar layar */
    if (typeof bataliMenuKelas === 'function') bataliMenuKelas();  /* ← TERLAMBAT */
    toast(…);
  });
```

`tutupPanel(true)` menjalankan `router()`, yang langsung memanggil
`daftarKelasBersama()` **tanpa** `paksa`. Saat itu `Menu.kelas` masih
berisi daftar lama dan umurnya belum lewat `UMUR_MENU_KELAS` (5 menit,
`js_menu.html:47`), jadi layar digambar dari cache basi. Baru
sesudahnya cache dibuang — sudah tidak ada yang membacanya lagi.

Refresh menyembuhkannya karena halaman dimuat dari nol dan `Menu.kelas`
mulai dari `null`.

### Kenapa hanya "membuat" yang terasa rusak

| Aksi | Urutan | |
|---|---|---|
| buat / ubah kelas (`formKelas`) | render → batali | ❌ |
| duplikat kelas (`panelDuplikat`) | render → batali | ❌ |
| hapus kelas (`hapusKelasKonfirmasi`) | batali → render | ✅ |

`hapusKelas()` sudah benar sejak awal. Itu sebabnya menghapus kelas
langsung terlihat, tetapi membuat tidak — dan kenapa bug duplikat
belum pernah dilaporkan: menduplikat jauh lebih jarang daripada
membuat kelas.

Dua pemanggil lain di `js_core.html:78` dan `:659` juga sudah benar —
keduanya jalur keluar, invalisasi sebelum `router()`.

### Perbaikan

Dua baris ditukar di `formKelas()` dan `panelDuplikat()`. Aturannya
ditulis di komentar: **buang dulu, gambar kemudian.**

### Uji

7 pemeriksaan (`/tmp/uji/urut.js`), dua lapis:

**Statis** — pada `js_kelola.html` yang benar-benar dikirim, komentar
dibuang lebih dulu (teks penjelasan menyebut nama kedua fungsi dan
akan ikut terhitung), lalu tiap fungsi sasaran dipotong dan dipastikan
`bataliMenuKelas` muncul sebelum `tutupPanel(true)`/`router()`.
Ketiganya terperiksa.

**Eksekusi** — `daftarKelasBersama()` dan `bataliMenuKelas()` **asli**
dari `js_menu.html` dijalankan di atas mock. Ini yang membuktikan
urutan memang menentukan hasil, bukan sekadar gaya:

- urutan salah → **1 kelas** (cache basi)
- urutan benar → **2 kelas**, dan kelas barunya ada di hasilnya

Dibuktikan merah dua kali. Sabotase kedua **sempat tidak menggigit** —
saya membuang `Menu.kelas = null` tetapi `Menu.diisi = 0` saja sudah
cukup memaksa muat ulang, jadi perilaku tidak berubah dan uji lolos
dengan sah. Diulang dengan melumpuhkan keduanya (2 gagal). Sabotase
pertama: urutan dikembalikan (1 gagal).

### Berkas

`js_kelola.html` · `Code.gs` (versi + 1 penanda). **Tanpa perubahan
`.gs` berperilaku, tanpa migrasi.**

---

## v1.18.3 — 🔴 Penjaga editor memblokir guru dari editornya sendiri


**Laporan guru:**

```
Error: Hanya dijalankan dari editor Apps Script.
_hanyaEditor @ Util.gs:428
hapusSeedData @ Setup.gs:808
```

Ini **regresi yang saya perkenalkan di `f2959b1`**, bukan bug lama.

### Apa yang salah

Penjaga versi lama hanya membandingkan dua email:

```js
if (!aktif || aktif !== efektif) throw new Error('Hanya dijalankan dari
editor Apps Script.');
```

Asumsinya tertulis di komentarnya sendiri: *"Dari editor Apps Script:
ActiveUser = EffectiveUser = pemilik."* **Asumsi itu tidak selalu
benar.** `Session.getActiveUser().getEmail()` mengembalikan string
kosong bila email pengguna tidak diungkapkan ke skrip — misalnya akun
di luar domain pemilik, atau skrip dibagikan sebagai editor bukan
sebagai pemilik. Bila kosong, `!aktif` langsung melempar.

Jadi guru yang memang duduk di editor Apps Script ditolak oleh penjaga
yang dibuat untuk melindunginya.

### Cakupannya bukan satu fungsi

42 pemanggilan, **25 fungsi admin terkunci**:

`cekKesehatan` · `setupLengkap` · `setupDatabase` · `cekBerkasUI` ·
`cekNomorWa` · `resetTahunAjaran` · `hapusSeedData` · `isiSeedData` ·
`resetTotal` · `migrasiStruktur` · `migrasiHierarki` · `infoDatabase` ·
`pasangTriggerHarian` · `pasangApiKeysManual` · `tesKoneksiAI` ·
`resetGuruDarurat` · `_sesiGuruDiagnostik` · `diagRefleksi` ·
`diagUbahMateriPokok` · `_db` · `_buatId` · `_salt` · `_hash` ·
`_tambah` · `_pasangCounter`

### Yang TIDAK rusak, dan sudah diverifikasi

Saya sempat khawatir seluruh aplikasi murid ikut mati karena `_db()`
berpenjaga dan dipanggil setiap permintaan. **Tidak.** Diperiksa:

- `Db.gs:45` memakai `SpreadsheetApp.openById(idDb())`, **bukan** `_db()`
- `_db()` hanya dipanggil dari dalam `Setup.gs` (6 tempat)
- `_hash()` dan `_salt()` hanya dipanggil dari `Setup.gs` (7 tempat);
  jalur login memakai hash di `Util.gs`

Jadi yang rusak murni perkakas admin, bukan aplikasi murid. Klaim ini
pernah saya ucapkan terbalik di percakapan dan sudah dikoreksi.

### Perbaikannya

Email tidak bisa diandalkan, jadi ditambah satu saklar yang **hanya
bisa dipasang guru sendiri, tanpa menjalankan kode apa pun**:

```js
if (PropertiesService.getScriptProperties()
      .getProperty('IZIN_EDITOR') === 'YA') return;
```

Dipasang dari **Project Settings → Script Properties → `IZIN_EDITOR` =
`YA`**. Murid di browser tidak bisa memasang Script Property, jadi
penjaga tetap berlaku penuh selama properti itu tidak ada — dan
`PropertiesService` yang gagal dianggap **tidak memberi izin** (fail
closed).

Pesan error juga ditulis ulang. Versi lama hanya bilang *"Hanya
dijalankan dari editor Apps Script"* kepada orang yang memang sedang
berada di editor — tidak memberi jalan keluar apa pun. Versi baru
menyebut penyebabnya, lima langkah memperbaikinya, dan perintah
menghapus properti setelah selesai.

### Trade-off yang diterima

Selama `IZIN_EDITOR = YA` terpasang, penjaga **mati untuk semua**. Bila
guru lupa menghapusnya, murid bisa memanggil fungsi editor. Diterima
karena alternatifnya adalah guru tidak bisa mengelola aplikasinya sama
sekali. `_hanyaEditor()` mencatat peringatan ke `Logger` setiap kali
saklar ini dipakai, supaya ada jejak.

### Uji

16 pemeriksaan baru (`/tmp/uji/editor.js`), `Util.gs` asli:

- browser tetap ditolak: email kosong, email murid, `IZIN_EDITOR`
  bernilai `TIDAK`/kosong, dan `PropertiesService` yang meledak
- editor normal (aktif = efektif) tetap diizinkan
- **saklar: skenario persis laporan guru ditolak tanpa saklar, lolos
  dengan saklar**
- pesan error menyebut `IZIN_EDITOR`, Project Settings, dan perintah
  menghapus properti
- `hapusSeedData()` masih memanggil `_hanyaEditor()`

**Dibuktikan merah** dengan tiga sabotase: saklar dibuang (2 gagal),
penjaga dibuat selalu lolos (10), pesan lama dikembalikan (5). Sabotase
ketiga sempat **hijau palsu** karena `perl` menyisipkan teks tanpa
mengganti pesan — diulang dengan benar setelah keadaan berkas
diperiksa. Suite penjaga lama tetap 15/15.

### Berkas

`Util.gs` · `Code.gs` (versi). **Tanpa migrasi, tanpa perubahan HTML.**

---

## v1.18.2 — v1.18.0 dibatalkan


**Keputusan guru:** perubahan reset di v1.18.0 ditolak setelah risiko
oracle keberadaan username dijelaskan.

### Yang dikembalikan

`Auth.ajukanReset()` kembali persis seperti sebelum v1.18.0 —
diverifikasi identik byte-per-byte dengan `83b0bc8` (v1.17.1) lewat
`git show 83b0bc8:Auth.gs | diff - Auth.gs`:

- semua pengajuan dibalas `{diterima:true}`, apa pun hasilnya
- baris `permintaan_reset` tetap dibuat, termasuk dengan `user_id`
  kosong bila akun tidak ditemukan
- batas 3 permintaan/24 jam kembali hanya berlaku bila akun ditemukan
- `MAKS_CARI_RESET` dan `_kunciCariReset()` dihapus
- penanda `'Tidak Dapat Diproses'` di `cekBerkasUI()` dihapus
- dialog di `js_auth.html` kembali ke bentuk semula

### Pertukaran yang dipilih, secara jujur

Yang dihindari: fungsi publik yang bisa dipakai memastikan username
mana yang ada.

Yang diterima kembali: **jalan buntu yang senyap.** Murid yang salah
mengetik username melihat "Permintaan Diterima" lalu menunggu
selamanya — tidak ada baris yang sampai ke antrean guru, tidak ada
kabar. Dan baris yatim ber-`user_id` kosong kembali menumpuk di sheet.

Ini keputusan yang sah. `Auth.login()` sudah membocorkan keberadaan
akun sejak lama, jadi v1.18.0 bukan membuka kelas kebocoran baru —
tetapi memperluasnya ke endpoint tanpa autentikasi dengan batas
pencobaan yang jauh lebih longgar adalah lain soal.

### Bagian v1.18.0 tetap ada di dokumen ini

Sengaja tidak dihapus, hanya diberi tanda ⛔. Analisisnya tidak salah;
pertukarannya yang tidak diterima.

### Berkas

`Auth.gs` · `js_auth.html` · `Code.gs` (versi, penanda v1.18.0
dibuang). **`v_login.html` dan `js_kelola.html` dari v1.18.1 tidak
tersentuh** — perbaikan placeholder tetap berlaku.

---

## v1.18.1 — Placeholder layar masuk mengiklankan akun seed


**Laporan guru:** *"hapus tulisan contoh siswa01 pada form login, itu
membocorkan username."*

Benar, dan lebih serius dari sekadar contoh yang kurang pantas.

### `siswa01` bukan nama karangan

`Setup.isiSeedData()` membuatnya sebagai akun nyata (`Setup.gs:576-587`):

```js
['Ahmad Fauzi','Bella Kusuma','Candra Wijaya'].forEach(function (nm, i) {
  murid.push({
    username: 'siswa0' + (i + 1),
    password_hash: _hash('siswa123', s), salt: s,
    pwd_awal: 'siswa123',
    nama: '[CONTOH] ' + nm, role: 'murid',
    status: 'aktif', harus_ganti_password: false,
    ...
```

Tiga akun murid — `siswa01`, `siswa02`, `siswa03` — semuanya bersandi
`siswa123`, semuanya `status: 'aktif'`, dan **`harus_ganti_password:
false`** sehingga tidak pernah dipaksa mengganti sandinya. Ditambah
akun `guru` / `guru123` (`Setup.gs:525-526`).

Placeholder di layar masuk — yang terlihat oleh **siapa pun tanpa
login** — mengiklankan salah satu username itu.

### Yang dihapus

| Berkas | Layar | Siapa yang melihat |
|---|---|---|
| `v_login.html:18` | isian nama pengguna | **siapa pun, tanpa login** |
| `v_login.html:50` | dialog Lupa Kata Sandi | **siapa pun, tanpa login** |
| `js_kelola.html:1011` | form Murid Baru | guru saja |

Yang ketiga ikut dibersihkan walau risikonya jauh lebih kecil — contoh
yang sama di dua tempat berarti dua tempat yang harus diingat saat
membersihkannya (§6.2 no. 120).

Sengaja **tidak diganti contoh lain**. Format username asli dibuat
`Kelas._usernameDari()` (nama depan + huruf awal nama belakang), jadi
contoh apa pun yang mirip nama akan mengajarkan pola itu. Label isian
sudah cukup.

### Nama akunnya tidak diulang di komentar

Komentar HTML **tetap terkirim ke peramban**. Versi pertama perbaikan
ini menjelaskan alasannya dengan menyebut nama akunnya — yang berarti
memindahkan bocorannya dari `placeholder` ke `<!-- -->`. Nama dan sandi
seed kini hanya ada di `Setup.gs` dan `PERUBAHAN.md`, tidak di berkas
HTML mana pun.

Diverifikasi: `grep -rn "siswa01\|siswa123\|guru123" *.html` → **nol
kemunculan**.

### 🔴 Yang belum dikerjakan dan lebih penting

**`cekKesehatan()` tidak memeriksa akun seed yang tersisa.** Ia
memeriksa modul, sheet, cache, `LockService`, dan `Ai.gs` — tidak
pernah melihat apakah `siswa01` masih hidup.

Artinya: guru yang menjalankan `setupLengkap()` lalu lupa menjalankan
`hapusSeedData()` punya empat akun bersandi baku yang aktif permanen,
dan tidak ada satu pun alat diagnostik yang memberi tahu. Menghapus
placeholder menutup satu jalan menemukan username itu; **akunnya
sendiri masih ada.**

`hapusSeedData()` sudah ada dan aman (`Setup.gs:765`) — ia hanya
menghapus baris bertanda `[CONTOH]`. Yang belum ada adalah peringatan
otomatis.

### Penanda berbasis komentar

Perubahan ini **menghapus** teks, jadi tidak ada string baru yang bisa
dijadikan penanda kecuali komentarnya. Penanda berbasis komentar rapuh
— bisa terhapus tanpa mengubah perilaku (pelajaran v1.12.7). Diterima
di sini karena akibatnya kecil: placeholder kembali muncul, bukan layar
yang rusak. Dibuktikan tetap menggigit dengan mengembalikan
placeholdernya.

### Berkas

`v_login.html` · `js_kelola.html` · `Code.gs` (versi + 2 penanda).
**Tidak ada perubahan `.gs` berperilaku, tidak ada migrasi.**

---

## v1.18.0 — Reset kata sandi menolak akun yang tidak ada atau nonaktif

> ### ⛔ DIBATALKAN di v1.18.2
>
> Guru memutuskan menolak perubahan ini setelah risiko oracle
> keberadaan username dijelaskan. Perilakunya sudah dikembalikan
> persis seperti sebelumnya.
>
> Bagian ini **sengaja tidak dihapus** (§7.4: tulis juga kegagalan).
> Isinya tetap berguna — analisisnya tidak salah, hanya
> pertukarannya yang tidak diterima. Bila suatu saat masalah "murid
> menunggu permintaan yang tidak pernah terkirim" muncul lagi, ini
> titik awalnya.

**Permintaan guru:** *"jika akun siswa nonaktif atau tidak ada
usernamenya, tidak bisa mengirim permintaan reset. Cek dulu apakah ada
username yang cocok di database, baru kirim permintaan."*

### Jalan buntu yang senyap

Sebelumnya `ajukanReset()` membalas `{diterima:true}` **apa pun**
hasilnya. Murid yang salah mengetik username melihat dialog
*"Permintaan Diterima"*, lalu menunggu selamanya — tidak ada baris yang
sampai ke antrean guru, tidak ada notifikasi, tidak ada kabar.

Sekarang akun diperiksa lebih dulu. Tidak ditemukan atau nonaktif →
ditolak dengan pesan, dan **tidak ada baris `permintaan_reset` yang
dibuat**.

### Keputusan: satu pesan untuk dua sebab

Guru meminta pesan *"username nonaktif atau tidak ada"*. Dipakai satu
pesan gabungan untuk keduanya, bukan dua pesan terpisah:

> Nama pengguna tidak ditemukan atau akun Anda nonaktif. Silakan
> hubungi guru Anda untuk mendapatkan nama pengguna dan kata sandi.

Memisahkannya akan memberi tahu orang luar bahwa murid tertentu sudah
dikeluarkan dari kelas — bocoran yang tidak perlu, dan murid yang
bersangkutan tetap harus melakukan hal yang sama: menemui guru.

### Syarat mutlak yang ikut dipasang

**Batas 5 pencarian per nilai input per 15 menit** (`MAKS_CARI_RESET`).

Sebelumnya batas 3 permintaan/24 jam hanya berlaku **bila akun
ditemukan** — `if (user) { … }`. Pencarian yang tidak cocok tidak
dibatasi sama sekali. Selama balasannya seragam itu tidak berbahaya.
Begitu balasannya berbeda, fungsi ini jadi alat memastikan username
mana yang ada, dan tanpa batas orang bisa menebak ribuan kali dalam
sejam.

Ini bukan hiasan. **Perubahan yang diminta guru tidak aman tanpa ini.**

### Risiko yang diterima, secara terbuka

Perubahan ini memang membuka oracle keberadaan username. Tiga hal yang
membuatnya lebih kecil dari kelihatannya di aplikasi ini:

1. `Auth.login()` **sudah** membocorkan hal yang sama sejak lama —
   akun nonaktif dibalas *"Akun Anda dinonaktifkan"*, yang tidak ada
   dibalas *"Nama pengguna atau kata sandi salah"* (`Auth.gs:166`).
2. Username dibuat dari nama oleh `Kelas._usernameDari()` — nama depan
   + huruf awal nama belakang. Sudah sangat mudah ditebak tanpa
   bantuan aplikasi.
3. Yang bocor hanya keberadaan akun. Kata sandi tidak, dan login tetap
   dikunci 5 percobaan / 15 menit.

Keputusan ini **berlawanan arah** dengan `pulihkanAkun()` (v1.17.0)
yang justru menjaga satu bentuk kegagalan. Bedanya disengaja:
`pulihkanAkun()` menerima **satu** masukan murah (username), sedangkan
pemulihan username menuntut **dua** data (email + nomor WA). Yang murah
harus dibatasi ketat.

### Efek samping: baris yatim berhenti menumpuk

Sebelumnya baris `permintaan_reset` tetap dibuat dengan `user_id`
kosong lalu disembunyikan `getPermintaanReset()`
(`.filter(r => r.user_id)`) dan `Beranda.untukGuru()`. Baris-baris itu
mengendap di sheet selamanya dengan status `antre`.

Sekarang baris hanya dibuat bila akunnya ada dan aktif. Saringan di
kedua tempat itu **sengaja dibiarkan** — sheet produksi masih memuat
baris yatim dari versi sebelumnya.

### Batas harian kini dijelaskan

Permintaan ke-4 dalam 24 jam dulunya dibalas `{diterima:true}` dan
diam — jalan buntu senyap yang sama. Sekarang:

> Anda sudah meminta reset 3 kali dalam 24 jam terakhir. Silakan
> hubungi guru Anda langsung.

### Berkas

`Auth.gs` · `Code.gs` (versi + 1 penanda) · `js_auth.html`.
**Tidak ada migrasi.**

### Uji

28 pemeriksaan, `Auth.gs` asli di atas mock `Db`:

- akun sah → diterima, baris ber-`user_id`, notifikasi menyebut nama
- email dan username beda kapital tetap cocok
- tidak ada / nonaktif → ditolak, **nol baris**, **nol notifikasi**
- pesan "tak ada" dan "nonaktif" **identik**
- batas pencarian: input berbeda tidak saling blokir, input sama ke-6
  ditolak, berhasil setelah 3 kali gagal
- batas harian: ke-4 ditolak tanpa menambah baris
- regresi rantai v1.17.0 (`pulihkanAkun` → `ajukanReset`)
- 5 pengajuan dengan 4 salah → hanya 1 baris, semua ber-`user_id`

**Dibuktikan merah** dengan empat sabotase: pemeriksaan nonaktif
dibuang (4 gagal), batas pencarian dimatikan (1), pesan dipisah (2),
pembuatan baris yatim dikembalikan (5).

---

## v1.17.1 — `_tambah()`: celah eskalasi hak yang lolos dari v1.16.x

Audit lanjutan dari penjaga `_hanyaEditor()` (commit `f2959b1`).

### Yang dicari hanya satu, yang ditemukan dua

`migrasiHierarki()` (`Setup.gs`) adalah satu-satunya fungsi setup yang
terlewat saat penjaga dipasang — saudaranya di berkas yang sama
(`setupLengkap`, `setupDatabase`, `isiSeedData`, `hapusSeedData`,
`resetTotal`, `migrasiStruktur`, `infoDatabase`) semuanya sudah
berpenjaga.

Tetapi saat seluruh fungsi top-level diaudit ulang berdasarkan
**apakah argumennya bisa diserialkan peramban**, muncul yang jauh
lebih parah:

### 🔴 `_tambah(nama, objArr)`

```js
function _tambah(nama, objArr) {
  if (!objArr || !objArr.length) return;
  var sh = _db().getSheetByName(nama);
  ...
  sh.getRange(sh.getLastRow() + 1, 1, baris.length, head.length).setValues(baris);
}
```

Kedua argumennya — nama sheet (string) dan larik baris (objek biasa)
— **bisa dikirim dari peramban**. Jadi ini benar-benar berjalan:

```js
google.script.run._tambah('users',
  [{ user_id:'USR-9999', username:'penyusup', role:'guru', status:'aktif', … }])
```

Satu panggilan, dan murid punya akun guru. Seluruh penjaga peran di
`_bungkus()` menjadi tidak relevan karena akunnya **memang** guru.

Rantainya lengkap dari peramban tanpa alat bantu apa pun:
`_salt()` memberi salt → `_hash(sandi, salt)` memberi hash yang sah →
`_tambah()` menanam barisnya. Ketiganya fungsi global, ketiganya
menerima argumen yang bisa diserialkan.

### Kapan sebuah fungsi terjangkau dari peramban

Awalan garis bawah adalah **konvensi manusia, bukan pembatas akses**.
`google.script.run` memanggil fungsi global apa pun. Yang menentukan
keterjangkauan adalah bentuk argumennya:

| Argumen | Terjangkau? | Contoh |
|---|---|---|
| string, angka, boolean, larik, objek biasa | **ya** | `_tambah`, `_hash`, `_buatId` |
| objek `Spreadsheet` / `Sheet` | tidak | `_buatSheet`, `_formatUlang` |
| tanpa argumen | **ya** | `migrasiHierarki`, `_pasangCounter` |

Enam fungsi terakhir tidak dijaga karena menuntut objek Spreadsheet/Sheet
sebagai argumen pertama, dan `_pad()` karena murni merapikan teks untuk
Logger. Alasannya ditulis sebagai komentar di blok "UTILITAS INTERNAL"
supaya keputusan ini tidak perlu diambil ulang dari nol.

### Pertahanan berlapis

Menariknya, serangan di atas **sudah** terbendung bahkan sebelum
`_tambah()` dijaga — karena `_tambah()` memanggil `_db()`, dan begitu
`_db()` berpenjaga, rantai itu putus. Penjaga `_tambah()` adalah
lapisan kedua, bukan satu-satunya.

Ini justru alasan penjaga dipasang di keduanya: mengandalkan satu
lapisan berarti satu refactor yang tidak berhati-hati bisa membuka
kembali lubang yang sama.

### Uji — dan satu hijau palsu yang harus diakui

15 pemeriksaan, memuat `Setup.gs` + `Util.gs` **asli** dengan `Session`
yang bisa diatur:

- ketujuh fungsi ditolak dari konteks browser (`ActiveUser` kosong)
- ketujuhnya lulus dari konteks editor (`ActiveUser == EffectiveUser`)
- serangan `_tambah('users',[{role:'guru'}])` diblokir, nol baris tertulis
- `_pad()` tetap bebas

**Versi pertama uji ini HIJAU PALSU.** Penjaga `_tambah()` dihapus
sungguh-sungguh, uji tetap lolos 22/22 — karena yang melempar adalah
`_db()` di dalamnya, bukan `_tambah()` sendiri. Uji itu mengukur
penjaga yang salah (§6.2 no. 7: bedakan bug nyata dari cacat uji).

Diperbaiki dengan melumpuhkan **semua penjaga lain** sebelum menguji
satu fungsi, sehingga yang tersisa hanya penjaga milik fungsi itu.
Setelah itu dibuktikan merah: buang penjaga `_tambah()` → 2 gagal;
buang penjaga `migrasiHierarki()` → 1 gagal.

### Cakupan penjaga

35 → **42 fungsi** berpenjaga. Tujuh penambahan: `migrasiHierarki`,
`_tambah`, `_db`, `_buatId`, `_salt`, `_hash`, `_pasangCounter`.

### Yang TIDAK berubah

`Setup.gs` dan `Code.gs` saja. **Tidak ada berkas HTML yang berubah**,
jadi tidak ada penanda `cekBerkasUI` baru dan tidak ada migrasi.

---

## v1.17.0 — Pemulihan username + sesi 30 hari

**Laporan lapangan:** *"banyak siswa yang lupa user dan password."*

### Akarnya bukan sandinya

`Auth.gs` memakai `TTL_SESI_JAM = 12`. Sesi mati tiap 12 jam, jadi
murid **wajib mengetik ulang kredensialnya setiap hari sekolah**.
Lupa dalam kondisi itu kepastian statistik, bukan kecelakaan.

`TTL_SESI_JAM` dinaikkan ke **720 (30 hari)**.

Efek samping yang menguntungkan: sheet `session` justru tumbuh lebih
lambat. Setiap login menambah satu baris, dan token lama yang
tertimpa di `localStorage` tidak pernah dibaca lagi sehingga tidak
pernah dibersihkan `validasiToken()`. Dengan 12 jam satu murid
menyumbang ±20 baris/bulan; dengan 30 hari ±1 baris/bulan.

Pembersihan sesi kedaluwarsa dipindahkan ke `_buatSesi()` — satu-satunya
tempat yang pasti dijalankan — karena token yatim tidak akan pernah
dibaca lagi.

### Lupa username kini selesai tanpa guru

Jalur baru di layar masuk: **"Lupa nama pengguna?"** Murid memasukkan
email + nomor WhatsApp yang sudah dia daftarkan di biodata. Bila
cocok, username-nya ditampilkan.

**Ini pemulihan, BUKAN login.** Tidak ada sesi yang dibuat. Yang
dikembalikan hanya username; kata sandi tetap direset guru lewat
jalur `#/reset` yang sudah ada. Karena itu membocorkan username bukan
membocorkan akun — dan syaratnya cukup dua data yang dikumpulkan
murid sendiri.

Bila keduanya juga lupa sandinya, dialog menawarkan tombol yang
membuka `ajukanReset()` **sudah terisi username yang baru ditemukan**.
Seluruh mesin reset lama dipakai ulang tanpa diubah — tidak ada UI
baru di sisi guru sama sekali.

### Tiga aturan keamanan

**1. Satu bentuk kegagalan untuk semua sebab.** Pasangan salah,
biodata belum lengkap, akun tidak ada, akun nonaktif, format input
salah — semuanya dibalas `{ketemu:false}` yang identik. Membedakannya
membuat fungsi ini jadi alat memastikan apakah sebuah email dan
sebuah nomor HP milik orang yang sama, dan orang itu murid di sini.
Itu bocoran privasi walau tanpa username.

Aturan guru menolong di sini: murid yang datanya belum lengkap
**memang** harus bertemu guru, jadi satu pesan itu sudah benar.

**2. Batas 5 percobaan per email per 15 menit** (`MAKS_PULIH`),
mengikuti pola `_tambahGagal()` yang sudah dipakai penguncian login.
Tanpa ini aturan 1 bisa dibongkar dengan menebak berulang kali.
Catatan jujur: `google.script.run` tidak memberi alamat IP
pengunjung, jadi batasnya hanya bisa per nilai input.

**3. Email dan nomor WA harus cocok pada BARIS YANG SAMA.** Email
baris A + nomor baris B ditolak.

### Satu email bisa cocok dua kali

`imporMurid()` membuat `user_id` baru per baris dan hanya menghindari
tabrakan username (`andi`, `andis2`, …). Murid yang ikut dua kelas
punya DUA baris `users`, dan `simpanBiodata()` menulis email + WA per
baris. Jadi pasangan yang sama bisa cocok dua kali.

**Semuanya dikembalikan** beserta label kelas + mapelnya. Menampilkan
yang pertama saja akan membuat murid memulihkan akun yang salah dan
kehilangan kelasnya yang lain.

### WhatsApp: murid yang menekan

Aplikasi ini **tidak bisa mengirim WhatsApp** — tidak ada gateway di
seluruh kode. `Kelas.tautanPulihWa()` mengembalikan tautan `wa.me`
untuk MURID: dia menekan, WhatsApp-nya terbuka dengan pesan tersusun,
dia yang mengirim. Guru menerima dari **nomor murid itu sendiri** dan
bisa langsung membalas.

Pencarian guru bernomor diangkat dari `kontakGuru()` ke
`_guruBergWa()`, karena `kontakGuru()` wajib menerima sesi sementara
pemulihan username berjalan SEBELUM login. `kontakGuru()` kini
memakainya — bukan salinan kedua.

### Yang sengaja TIDAK dikerjakan

- **Tidak ada baris `permintaan_reset`** di jalur ini. Murid yang
  hanya lupa username tidak butuh reset; membuat permintaan akan
  menaruh pekerjaan palsu di antrean guru.
- **Login Google tidak dikerjakan.** Perlu proyek Google Cloud, layar
  persetujuan, dan memaksa keputusan model data per-orang vs
  per-kelas. Lihat catatan sesi: `imporMurid()` membuat satu baris
  `users` per (murid, kelas), jadi satu email tidak bisa dipetakan ke
  satu identitas tanpa migrasi.
- **`harus_ganti_password` setelah reset guru tetap ada.** Murid masih
  dipaksa mengarang sandi baru — lingkaran yang memproduksi insiden
  berikutnya. Belum disentuh.

### Uji

42 pemeriksaan di atas `Auth.gs`, `Kelas.gs`, `Util.gs` **asli**
(mock hanya `Db` + layanan Apps Script):

- jalur bahagia, dua akun, label kelas memuat mapel
- normalisasi `Andi@Gmail.COM` + spasi, `0812…`, `+62 812 …`
- **anti-oracle**: enam sebab kegagalan berbeda menghasilkan JSON
  yang identik, dan `Object.keys()`-nya hanya `ketemu`
- silang baris ditolak
- batas percobaan: ke-6 dibatasi, email lain tidak ikut, berhasil
  setelah 3 kali gagal
- tautan WA: nomor baku, pesan memuat nama + username, kosong bila
  guru tak bernomor
- TTL 720 jam; sesi basi terhapus per murid, sesi hidup dan milik
  murid lain tidak tersentuh
- regresi `kontakGuru()` sesudah refactor
- regresi `ajukanReset()` tetap utuh

**Dibuktikan merah** dengan tiga sabotase: syarat nomor WA dibuang
(8 gagal), sebab kegagalan dibocorkan (1 gagal), batas percobaan
dimatikan (1 gagal).

`cekBerkasUI()` dijalankan terhadap berkas HTML nyata: **158 penanda
ditemukan, nol basi** — termasuk 3 penanda v1.17.0 yang dibuktikan
menggigit dengan membuang tombolnya.

---

## Riwayat Versi Aplikasi

| Versi | Tahap | Isi |
|---|---|---|
| 0.1.0 | 1 | `Setup.gs` — 14 sheet + seed PKPJ |
| 0.2.0 | 2 | `Db` `Util` `Auth` `Code` + login, sesi, reset kata sandi |
| 0.3.0 | 3 | `Notif` `Beranda` `js_beranda` + dashboard, unlock logic, MathJax |
| 1.19.0 | ⚡ **pramuat materi satu bab** | `Belajar` `Code` `js_belajar` `js_core` `uji/` — seluruh materi materi pokok dimuat sekali, murid tidak menunggu tiap bagian; kunci tetap terasa di layar walau konten terkunci ikut terkirim (keputusan guru); **menutup celah lama**: penjaga kunci kini juga di jalur TULIS; pelaporan per bagian TETAP ada (yang membunuh v1.16.0) |
| 1.18.5 | 🔢 **jumlah murid/pertemuan di kartu basi** | `js_core` `Code` `uji/` — 7 aksi pengubah isi kelas tidak pernah membuang `Menu.kelas`; dipasang terpusat di `callApi()` lewat `API_UBAH_KELAS`, bukan ditambal per-handler; klaim urutan saya dikoreksi sabotase; uji pindah ke `uji/` karena `/tmp` hilang |
| 1.18.4 | 🔄 **kelas baru tak muncul sampai refresh** | `js_kelola` `Code` — bukan cache lupa dibuang: `tutupPanel(true)` menggambar layar SEBELUM `bataliMenuKelas()`; dua baris ditukar di `formKelas` & `panelDuplikat`; `hapusKelas` sudah benar sejak awal; diuji statis + eksekusi kode asli |
| 1.18.3 | 🔴 **penjaga editor mengunci guru** | `Util` `Code` — regresi f2959b1: 25 fungsi admin tak bisa dijalankan dari editor karena `getActiveUser()` bisa kosong; ditambah saklar `IZIN_EDITOR` yang dipasang guru tanpa menjalankan kode; pesan error kini menjelaskan jalan keluar; aplikasi murid tidak terpengaruh (diverifikasi) |
| 1.18.2 | ⛔ **v1.18.0 dibatalkan** | `Auth` `js_auth` `Code` — atas keputusan guru; `ajukanReset()` dikembalikan byte-per-byte ke v1.17.1; jalan buntu senyap & baris yatim diterima kembali demi menghindari oracle username; v1.18.1 tetap berlaku |
| 1.18.1 | 🔴 **layar masuk mengiklankan akun seed** | `v_login` `js_kelola` `Code` — placeholder `siswa01` dibuang dari 3 tempat; akun seed itu nyata, bersandi `siswa123`, `harus_ganti_password: false`; nama akun tidak diulang di komentar HTML karena komentar tetap terkirim; **`cekKesehatan()` masih belum memeriksa seed yang tersisa** |
| 1.18.0 | 🚫 **reset menolak akun tak ada / nonaktif** | `Auth` `Code` `js_auth` — cek akun dulu baru kirim permintaan; tidak ada lagi baris yatim; **syarat mutlak:** batas 5 pencarian/input karena balasannya kini berbeda; satu pesan untuk dua sebab; batas harian tak lagi diam |
| 1.17.1 | 🔴 **`_tambah()` — eskalasi hak** | `Setup` `Code` — murid bisa memanggil `_tambah('users',[{role:'guru'}])` dari browser dan membuat akun guru; 7 fungsi Setup berpenjaga (35 → 42); uji penjaga terisolasi, satu hijau palsu diakui & diperbaiki |
| 1.17.0 | 🔑 **lupa username selesai tanpa guru** | `Auth` `Kelas` `Code` `js_auth` `v_login` — pemulihan username lewat email + nomor WA (bukan login); sesi 12 jam → 30 hari; satu bentuk kegagalan untuk semua sebab; batas 5 percobaan/email; akun ganda dikembalikan semua |
| 1.16.1 | 🔴 **v1.16.0 dibatalkan — materi tidak pernah selesai** | `js_belajar` `Belajar` `Code` — melewatkan `tandaiBagianSelesai` bagian tengah membuat panggilan terakhir ditolak `ITEM_TERKUNCI`; tiap bagian kembali menandai ke server |
| 1.16.0 | 📖 ~~baca materi 9 panggilan → 2~~ **DIBATALKAN** | `Util` `Belajar` `js_belajar` `Code` — seluruh bagian dikirim sekaligus; pindah bagian tanpa server; tandai selesai di bagian terakhir + saat murid pergi |
| 1.15.7 | 🔴 **"undefined murid" di Kelola Kelas** | `js_menu` `Code` — benih 3 kolom dari beranda dipakai layar sebagai daftar utuh; ditandai `Menu.ringkas` |
| 1.15.6 | 🌱 **ikon dari satu baris** | `Code` `index` `js_core` `js_auth` `v_login` — `APP_IKON` mengatur favicon, topbar, dan layar masuk sekaligus; + `CARA-PAKAI-IKON.md` |
| 1.15.5 | 🚫 **klaim "184 KB" TERBANTAH** | `Code` — diukur: memisahkan diagnostik hanya menghemat 0,12 ms dari 6.500 ms (0,002%); tidak jadi dikerjakan, `perf21` menjaga keputusannya |
| 1.15.4 | 📍 **gulir sidebar ke kelas aktif** | `js_menu` `Code` — sidebar kembali ke atas tiap pindah layar; kelas yang baru diklik hilang dari pandangan |
| 1.15.3 | ⚡ **getStrukturKelas 2x** | `js_menu` `js_editor` `Code` — sidebar & layar kelas menembak API yang sama pada detik yang sama; `strukturKelasBersama()` + pembatal per kelas |
| 1.15.2 | ⚡ **sidebar menunggu sinyal** | `js_menu` `js_beranda` `Code` — timer 1200 ms keburu habis saat getBeranda 6,7 dtk; diganti bendera keadaan + jalur pelepasan |
| 1.15.1 | 🔴 **dua bug sidebar dari lapangan** | `js_kelompok` `js_quiz` `js_menu` `Code` — sidebar hilang di layar yang digambar lewat DELEGASI; item materi dimatikan tanpa alasan yang dipahami guru |
| 1.15.0 | 🌳 **sidebar dibentangkan sampai item** | `MateriPokok` `js_menu` `css` `Code` — kelas → bab → pertemuan → item dengan lipatan; kelas yang sedang diakses terbentang sendiri |
| 1.14.4 | ↻ **Segarkan di layar PER ITEM** | `js_lkpd` `js_quiz` `js_kelompok` `Code` — layar penilaian yang dibuka dari dalam pertemuan; kini 6 layar |
| 1.14.3 | ↻ **tombol Segarkan penilaian** | `js_core` `js_lkpd` `js_quiz` `js_kelompok` `Code` — antrean berubah karena murid; manual, bukan otomatis; cache beranda ikut dibuang |
| 1.14.2 | 📚 **pertemuan dapat dilipat** | `js_belajar` `css` `Code` — hanya pertemuan BERJALAN yang terbuka; selesai & terkunci dilipat, tetap dapat dibuka lewat panah |
| 1.14.1 | ⚡ **jeda penyegaran sidebar murid** | `js_nav` `Code` — `getIndeksKelas` ditembak tiap kali sidebar dipasang ulang (2x dalam 19 detik); jeda 30 detik, jalur paksa tetap lewat |
| 1.14.0 | 🎓 **item tampil di Daftar Isi murid** | `Belajar` `js_belajar` `css` `Code` — item langsung terlihat di bawah tiap pertemuan; 2 klik → 1 klik; item terkunci tetap tampil bergembok |
| 1.13.4 | ⚡ **sidebar dibenihi dari beranda** | `js_menu` `js_beranda` `Code` — `getBeranda` sudah mengirim daftar kelas; panggilan `getDaftarKelas` kedua dihapus sama sekali |
| 1.13.3 | ⚡ **daftar kelas dipanggil 2x** | `js_menu` `js_kelola` `js_rekap` `js_editor` `Code` — sidebar & layar menembak `getDaftarKelas` pada detik yang sama; `daftarKelasBersama()` + janji berbagi |
| 1.13.2 | 🔴 **sidebar hilang di layar tujuan** | `js_lkpd` `js_quiz` `js_kelompok` `js_editor` `js_refleksi` `js_auth` `Code` — 11 layar guru tertinggal; audit rute menemukan 7 yang tak terpikirkan; cacat uji per-berkas menghalangi perbaikan |
| 1.13.1 | 🔴 **menu sidebar ke URL asing** | `js_menu` `css` `Code` — `<a href="#/…">` menavigasi iframe sandbox Apps Script; diganti `<button>` + `pergiKe()` seperti 20 berkas lainnya |
| 1.13.0 | 🧭 **sidebar menu guru** | `js_menu`(BARU) `index` `css` `js_beranda` `js_kelola` `js_rekap` `js_core` `Code` — 7 pintasan + daftar 8 kelas; kunjungan beranda yang sekadar numpang lewat jadi NOL |
| 1.12.8 | ⚡ **cache beranda 30 detik** | `js_beranda` `js_lkpd` `js_quiz` `js_kelompok` `js_core` `js_belajar` `Code` — 5 kunjungan → 1 panggilan; `State.beranda` ternyata ditulis & dibatalkan sejak lama tapi TIDAK PERNAH dibaca |
| 1.12.7 | 🔴 **penanda cekBerkasUI rapuh** | `js_beranda` `Code` — 5 penanda hidup di komentar (bisa dihapus tanpa ubah perilaku); 9 penanda ber-kutip-ganda TIDAK PERNAH diperiksa `run46`/`run83` (103 vs 112) |
| 1.12.6 | ⚡ **layar Rekap 2 panggilan → 1** | `Rekap` `Code` `js_rekap` — `getRekapLengkap` BARU; `Promise.all` membayar biaya lantai Apps Script dua kali; 🔴 dua cacat uji: mock menjawab API apa pun, data uji hanya 1 bab |
| 1.12.5 | ⚡ **nilaiKelompok 99.603 → 272 sel** | `Db` `Kelompok` `Code` — `cariBarisBanyak2()` BARU; pencarian per anggota jadi borongan; `perbaruiBanyak()` pilih strategi menurut kerapatan; epoch dibatalkan per murid |
| 1.12.4 | ⚡ **beranda guru 51.041 → 625 sel** | `Beranda` `js_beranda` `Code` — `progress` tidak lagi dipindai penuh (95% biaya, sheet tanpa cache); lencana % dibuang dari kartu guru; progres murid tetap |
| 1.12.3 | 📊 **tombol Rekap per kelas** | `js_kelola` `Code` — tiap kartu kelas menuju `#/rekap/<kelas_id>` langsung, tanpa layar pemilih kelas; rute lama dari beranda tetap ada |
| 1.12.2 | 📘 **BRIEFING-AI.md** | dokumen pintu masuk untuk AI penerus; `run86` mengikat tiap angkanya ke sumber sesungguhnya agar tidak basi |
| 1.12.1 | 🧹 **tombol pembersih ekspor** | `js_rekap` `Code` — fungsi yatim `hapusEksporLama` akhirnya punya tombol; hanya berkas berawalan "LessonLen Rekap — " yang disentuh |
| 1.12.0 | 🗓️ **resetTahunAjaran()** | `ResetTahun`(BARU) `Db` `Code` — arsip ke Drive lalu hapus pekerjaan; murid dinonaktifkan; kelas diarsipkan; materi & bank soal TETAP |
| 1.11.7 | 🔴 **cekBerkasUI berbohong** | `Code` — v1.10.1 & v1.11.5 mengubah berkas UI tanpa penanda; alat diagnosis menyatakan "terbaru" walau berkasnya lama |
| 1.11.6 | 🔍 **cekNomorWa()** | `Code` — diagnostik isi kolom `no_wa` apa adanya; memisahkan "belum diisi" dari "terisi tapi tidak terbaca" |
| 1.11.5 | 🔴 **tombol WA "tidak muncul"** | `js_core` `Code` — dialog dilewati diam-diam saat murid belum punya nomor; kini tetap muncul dan menjelaskan sebab + cara memperbaikinya |
| 1.11.4 | 💬 **minta perbaikan via WA** | `Kelas` `Lkpd` `Kelompok` `js_core` `js_lkpd` `js_kelompok` `Code` — tombol WhatsApp sesudah Minta Perbaikan; tugas kelompok → KETUA; 🔴 regresi js_core dijaga typeof |
| 1.11.3 | 💬 **kirim sandi reset via WA** | `Auth` `Kelas` `js_core` `js_kelola` `js_auth` `Code` — tombol WhatsApp sesudah reset; dialog dipakai bersama 2 layar; email TIDAK dipakai (§13 no.11) |
| 1.11.2 | 👤 **Profil Saya & Hubungi Guru** | `Kelas` `js_auth` `js_core` `css` `Code` — nama di topbar jadi tombol; murid dapat mengubah biodata kapan saja; tombol WA ke guru dengan pesan otomatis; 🔴 akun guru tak punya layar profil |
| 1.11.1 | 🔧 **cacat uji, bukan bug** | `Code` — angka harapan nomor WA di `ujiTahap18()` salah ketik satu digit; kini dihitung dengan `normalisasiWa()` |
| 1.11.0 | 🪪 **biodata Tahap 2 (guru)** | `Kelas` `js_kelola` `Code` — kolom Biodata + tombol WA; guru dapat mengedit; Ekspor Biodata tanpa sandi; 🔴 `simpanMurid` menolak edit sebagian |
| 1.10.5 | ✅ **biodata terverifikasi lapangan** | `Code` — `ujiTahap18()` 18/18 hijau di Apps Script; log diagnostik dipisah data vs nasihat |
| 1.10.4 | 🔴 **nol depan NISN hilang** | `Setup` `Code` — Sheets menafsirkan "0098765432" sebagai bilangan; medan `teks:` + `setNumberFormat('@')` |
| 1.10.3 | 🔴 **kolom baru mewarisi dropdown** | `Setup` `Code` `mock5`(BARU) — `insertColumnBefore` mewarisi validasi `status`; nilai ditolak diam-diam. Migrasi kini mencegah + memulihkan |
| 1.10.2 | 🔴 **kolom baru tersimpan kosong** | `Db` `Setup` `Code` — memo header tidak dibatalkan setelah `migrasiStruktur()`; `tambah`/`perbarui` membuang kolom baru diam-diam |
| 1.10.1 | 🪪 **Dialog biodata saat login** | `js_auth` `Auth` `js_core` `js_beranda` `Code` — dialog otomatis setelah login; isian tidak hilang saat gagal; data awal ikut respons login (0 API tambahan) |
| 1.10.0 | 🪪 **Biodata murid** | `v_biodata`(BARU) `Setup` `Util` `Auth` `Kelas` `js_auth` `js_beranda` `js_core` `index` `Code` — NISN/email/WA; spanduk pengingat; ⚠ wajib `migrasiStruktur()` |
| 1.9.11 | ↩️ **Kuis Mandiri dibatalkan** | seluruh v1.10.x dicabut; 🔴 17 fungsi diagnostik mati sejak guru ganti sandi (`guru123` mati di kode); `cekKesehatan` melewatkan 2 sheet |
| 1.9.11 | 🔴 **tombol Visual lenyap** | `css` `Code` — `var(--utama)` tak pernah ada di `:root`; teks putih di latar putih. Ikut memperbaiki latar mode HTML & sorot sel tabel yang belum pernah tampil sejak v1.9.9 |
| 1.9.10 | **mode sunting HTML** | `v_editor` `js_editor` `css` `Code` — tombol `</> HTML`; penyamaan isi saat Simpan agar suntingan tidak hilang |
| 1.9.9 | **tabel dapat diatur** | `js_editor` `v_editor` `css` `Code` — tombol ▦ dipaku 2×2; kini dialog ukuran + 4 tombol baris/kolom |
| 1.9.8 | **video YouTube** | `Util` `v_editor` `js_editor` `css` `Code` — tombol ▶ Video; 🔴 penjaga domain iframe bocor sejak Tahap 4 (`youtube.com.jahat.id` lolos) |
| 1.9.7 | **kartu kelas: 2 terlewat** | `js_rekap` `js_editor` `Code` — kartu Rekap Nilai & daftar tujuan panel Salin ikut "Kelas - Mapel" |
| 1.9.6 | **nama kartu kelas** | `js_core` `js_kelola` `js_beranda` `Code` — judul kartu jadi "Kelas - Mapel"; helper bersama untuk ketiga kartu |
| 1.9.5 | **terbit bertingkat** | `Belajar` `Pertemuan` `js_editor` `Code` — item terbit tertahan pertemuan/bab draf; guru tidak diberi tahu & pesan ke murid menyesatkan |
| 1.9.4 | **lebar dialog** | `js_core` `css` `js_editor` `js_quiz` `Code` — `dialog()` menerima opsi `lebar`; pratinjau 420 → 900px, tabel bergulir sendiri |
| 1.9.3 | **pratinjau "Tanpa Judul"** | `js_editor` `Code` — `getDetailItem` mengembalikan { item, pertemuan }; klien membaca lapisan yang salah sehingga semua medan undefined |
| 1.9.2 | **pratinjau item** | `js_editor` `Code` — tombol 👁 di tiap baris item, kelima tipe; kunci quiz disembunyikan di balik tombol |
| 1.9.1 | **kunci selektif** | `Db` `Quiz` `Lkpd` `Kelompok` `Code` — kunci pindah ke `Db.tambah()` (rebutan getLastRow), reentrant, batas tunggu 10 → 45 detik; 3 → 1 kunci/murid |
| 1.9.0 | **quiz offline (localStorage)** | `Setup` `Quiz` `js_quiz` `js_editor` `Code` — 36 murid serentak gagal SISTEM_SIBUK; autosave per klik dihapus, jawaban dikirim borongan; timer → tenggat tanggal |
| 1.8.11 | **volume pada sekolah penuh** | `Quiz` `Belajar` `Code` — 11 detik ternyata biaya tetap per panggilan, bukan volume; pemindaian progress 33.648 sel dicatat & dijaga uji |
| 1.8.10 | **kecepatan quiz murid** | `Quiz` `Belajar` `Code` — 36 → 30 panggilan/alur; `ujiTahap17()` mengukur 8 murid, bukan memaksa 36 ke satu eksekusi |
| 1.8.9 | **pendaftaran murid** | `Kelas` `Code` — 4 pembacaan penuh per murid; `ujiTahap17()` memakai Impor, bukan simpanMurid satu per satu |
| 1.8.8 | **uji beban 432 murid** | `Code` · `test/` — 6 berkas uji beban rusak sejak v1.0.0 (indeks kolom bergeser) & tak pernah masuk regresi; `bebandata.js` + `perf13` lock + `ujiTahap17()` |
| 1.8.7 | **panggilan API kerangka** | `Db` `Util` `Ai` `Code` — 40 → 21 panggilan/pertemuan; `invalidasi()` membuang memo header, `catatLog()` menulis sebanyak data |
| 1.8.6 | **kegiatan kerangka** | `Ai` `js_kerangka` `css` `Code` — kerangka tidak pernah membuat Tugas Kelompok & Refleksi; medan `bab` tak pernah terdaftar di skema JSON sehingga selalu dibuang Gemini |
| 1.8.5 | **kecepatan kerangka** | `Pertemuan` `Code` — `simpanItem()` membaca seluruh sheet 3× per item; 16,5 → <3 detik/pertemuan |
| 1.8.4 | **pengelompokan bab** | `Ai` `js_kerangka` `js_editor` `css` `Code` — kerangka AI menumpuk semua pertemuan di satu Materi Pokok; kini AI mengusulkan bab yang bisa disunting |
| 1.8.3 | **penanda CP di payload** | `MateriPokok` `js_kerangka` `Code` — panel Kerangka AI memblokir padahal CP sudah diisi; klien memeriksa medan yang tak pernah dikirim |
| 1.8.2 | **Kerangka Semester AI** | `js_kerangka` BARU `index` `js_editor` `css` `Ai` `Code` — API yatim sejak Tahap 7 akhirnya bertombol; alur dua langkah dengan tabel yang bisa disunting |
| 1.8.1 | **AI Refleksi** | `Ai` `Code` `js_editor` — tipe keempat & terakhir yang punya tombol ✨; arah kesadaran belajar sesuai §6.5 |
| 1.8.0 | **Buka Kunci** | `Belajar` `js_kunci` BARU `index` `js_editor` `js_kelola` `Code` — API yatim sejak Tahap 5 akhirnya berfungsi; 2 bug perilaku unlock diperbaiki |
| 1.7.7 | **Tahap 3: layar murid** | `js_kelompok` `Kelompok` `Code` — murid mengerjakan tugas kelompok; ketua mengumpulkan, anggota melihat nilainya sendiri |
| 1.7.6 | **AI untuk LKPD & kelompok** | `Ai` `Code` `js_editor` `v_editor` — generator isi kegiatan 5 bagian; tugas kelompok menekankan diskusi |
| 1.7.5 | **`undefined` di layar** | `js_nav` `js_belajar` `js_kelompok` `Code` — 6 peta tipe tertinggal + rute murid tak terdaftar; `ujiTahap13()` BARU (53 poin) |
| 1.7.4 | **alat uji & pratinjau** | `test/` `docs/` — pratinjau memperagakan keadaan tepi; 3 cacat uji (pemeriksaan mustahil merah, regex menangkap `ketua_keluar`, data contoh tak terikat backend) |
| 1.7.3 | **anggota keluar kelas** | `Kelompok` `js_kelompok` `css` `Code` — murid yang keluar tetap menerima progres & nilai; ketua keluar = kelompok buntu tanpa penjelasan |
| 1.7.2 | **antrean gabungan** | `Kelompok` `Code` `js_kelompok` `js_beranda` `Beranda` `Pertemuan` — layar seluruh tugas kelompok menunggu, lintas kelas |
| 1.7.1 | **pisah LKPD & kelompok** | `Db` `Lkpd` `Beranda` `js_beranda` `Code` — tugas kelompok bocor ke antrean LKPD & merusak progres anggota; `bacaKolom()` membuang baris ber-FK kosong |
| 1.7.0-tahap2 | **Tugas Kelompok: UI guru** | `js_kelompok` BARU · `index` `js_core` `js_editor` `css` `Code` `Kelompok` — susunan kelompok, bagi otomatis, nilai kelompok + penyesuaian anggota |
| 1.7.0-tahap1 | **Tugas Kelompok: backend** | `Kelompok` BARU · `Setup` `Util` `Code` `Pertemuan` `Kelas` `Rekap` — sheet `kelompok`, ketua mengumpulkan, progres seluruh anggota |
| 1.6.6 | lebar ponsel | `css` — margin negatif `.tabel-gulir` mendorong seluruh halaman; +jaring pengaman overflow |
| 1.6.5 | pratinjau impor & mapel | `Kelas` `js_kelola` — tombol Periksa membaca rombel sebagai username; kolom Kelas-Mapel tanpa mapel |
| 1.6.4 | **rombel & impor 4 kolom** | `Setup` `Kelas` `js_core` `js_kelola` `Code` — dropdown menyebut mapel, label rombel, impor `nama,kelas,username,password` |
| 1.6.3 | penanda kelas murid | `Kelas` `js_kelola` `css` — daftar pilih murid menyebut kelas tiap murid; murid senama tak lagi tertukar |
| 1.6.2 | dialog bisa digulir | `css` — 23 dari 24 dialog terpotong tanpa bisa digulir, termasuk generator soal AI |
| 1.6.1 | verifikasi penerapan | `Code` — `cekBerkasUI()` memeriksa berkas HTML/CSS sudah tersalin & ter-deploy |
| 1.6.0 | **audit responsif** | `css` `js_quiz` `js_editor` — 7 cacat senyap: kelas yatim, `class="input"` tanpa gaya, tabel tanpa penggulir, zoom iOS |
| 1.5.6 | tabel jadi tabel | `Ai` `js_soal_ai` `css` — tabel Markdown dari AI diubah jadi `<table>`, `.konten-kaya` akhirnya punya gaya |
| 1.5.5 | **soal cerita AI** | `Ai` `js_soal_ai` `css` `Code` — AI membuat satu wacana untuk beberapa soal sekaligus |
| 1.5.4 | uji lapangan grup soal | `Code` — `ujiTahap12()` BARU (30 poin); v1.4.x sebelumnya tanpa jalur verifikasi |
| 1.5.3 | diagnostik aman diulang | `Code` — `ujiTahap11()` menghapus username murid uji, bukan hanya kelasnya |
| 1.5.2 | ekspor bisa jalan | `Rekap` `mock4` `run42` `Code` — sel gabungan judul menggagalkan pembekuan kolom di Apps Script |
| 1.5.1 | ralat refleksi | `Rekap` `js_rekap` `Code` — skala 1–5 keluar dari rekap nilai; tetap ada di Rekap Refleksi |
| 1.5.0 | **Tahap 8: rekap nilai** | `Rekap` BARU · `js_rekap` BARU · `Code` `index` `js_core` `js_beranda` `css` — tabel murid × item, penapis bab, ekspor ke Google Sheet |
| 1.4.3 | kumpul quiz jelas | `js_quiz` `js_core` `index` `css` `Code` — penjaga klik ganda, tirai bertahap berteks, jalur kumpul tunggal |
| 1.4.2 | grup soal terlihat | `js_quiz` `css` `Code` — bingkai + kepala kelompok, lencana bernomor, dialog jujur soal terpakai |
| 1.4.1 | audit grup soal | `Quiz` `Code` `js_quiz` — 4 bug: bacaan lenyap saat hapus, kelompok pecah saat susun ulang |
| 1.4.0 | grup soal | `Setup` `Util` `Quiz` `Code` `js_quiz` `css` — beberapa soal berbagi satu teks bacaan, acak menjaga kelompok |
| 1.3.0 | soal AI | `js_soal_ai` BARU — komposisi → tinjau per butir → simpan terpilih |
| 1.2.7 | tahan berkas hilang | `js_core` `js_beranda` — helper bersama pindah ke inti, router menunjuk berkas yang gagal |
| 1.2.6 | router aman | `js_core` — rute tak dikenal dialihkan ke beranda, tidak lagi ReferenceError |
| 1.2.5 | segar & ringkas | `js_nav` `Beranda` `js_beranda` — sidebar disegarkan di latar, beranda pakai unlock yang sama |
| 1.2.4 | akar Date | `Db` — `_aman()` di seluruh jalur baca; objek Date tidak pernah lolos ke peramban |
| 1.2.3 | payload aman | `MateriPokok` `Pertemuan` `js_core` — detail() tanpa kolom Date, console melaporkan galat |
| 1.2.2 | perbaikan UI | `js_editor` `js_refleksi` `js_kelola` — pelipatan bab, tombol ↑↓ item, tombol Penilaian pindah ke item |
| 1.2.1 | enum migrasi | `Setup` — validasi dropdown ikut diperbarui; notifikasi jenis baru tidak lagi ditolak Sheets |
| 1.2.0 | refleksi | `Refleksi` BARU + `js_refleksi` BARU — pertanyaan terbuka, skala 1–5, rekap sekelas, balasan guru |
| 1.1.1 | salin hierarki | `Pertemuan` `Kelas` `Setup` — 4 bug salin/duplikat, termasuk kehilangan data lintas kelas |
| 1.1.0 | UI hierarki | `MateriPokok` `Pertemuan` `Code` `js_editor` `js_nav` `js_belajar` `css` — halaman guru & sidebar tiga tingkat |
| 1.0.1 | audit hierarki | `Db` `Belajar` `Lkpd` `Quiz` `Pertemuan` `Kelas` `MateriPokok` — 3 bug integritas data + penghapusan berantai −79% |
| 1.0.0 | hierarki | `MateriPokok` BARU + `jenis` pertemuan + item `refleksi` — struktur 3 tingkat |
| 0.9.9 | hapus cepat | `Pertemuan` `Kelas` — penghapusan berantai −82%, penjelasan key istirahat |
| 0.9.8 | patokan waktu | `Code` `js_editor` — perkiraan 15–45 detik, ambang peringatan 10 detik |
| 0.9.7 | model 3.6 | `Ai` `Code` — Gemini 3.6 Flash utama, nilai "low" didahulukan, mock dilengkapi |
| 0.9.6 | nilai level | `Ai` `js_editor` — thinkingLevel huruf kecil, batas waktu 240 detik |
| 0.9.5 | gaya thinking | `Ai` — thinkingBudget/thinkingLevel dipilih per model, pola deteksi diperlonggar |
| 0.9.4 | thinking | `Ai` `Code` — matikan token thinking yang memotong jawaban |
| 0.9.3 | model 3.5 | `Ai` — Gemini 3.5 Flash jadi utama, fallback bila model tolak responseSchema |
| 0.9.2 | rotasi model | `Ai` `Code` `js_editor` — rotasi model saat kuota habis, pesan error asli Google |
| 0.9.1 | alat uji 7 | `Code` — `ujiTahap7()` `tesKoneksiAI()`, cekKesehatan kenal Ai.gs |
| 0.9.0 | 7 | `Ai` + generator materi/soal/kerangka, rotasi 10 key, panel status key |
| 0.8.2 | kecepatan nav | `js_nav` `js_belajar` `js_lkpd` `js_quiz` `css` — cache sesi, paralel, pramuat (2,4 s → 0 s) |
| 0.8.1 | audit nav | `js_nav` `js_core` `js_lkpd` `js_quiz` `js_belajar` — kebocoran sidebar antar akun, sidebar basi, ketahanan payload |
| 0.8.0 | navigasi | `js_nav` + sidebar course index, tombol Prev/Next lintas pertemuan |
| 0.7.4 | perbaikan UI | `js_quiz` `css` — dialog Tambah Soal kosong; Batal ikut menjalankan aksi |
| 0.7.3 | alat uji | `Code` — `cekKesehatan()` `ujiTahap6B()` `pasangTriggerHarian()` + PANDUAN-UJI.md |
| 0.7.2 | 6B-OPT | `Db` `Quiz` `Belajar` `Lkpd` `Notif` — cache baris & bank soal (quiz serentak −53%) |
| 0.7.1 | audit | `Quiz` — perbaikan 3 bug "capaian turun" (ulangi quiz, kedaluwarsa, reset) |
| 0.7.0 | 6B | `Quiz` `js_quiz` + bank soal, 4 tipe soal, autosave, timer server, koreksi esai, penilaian per-Quiz |
| 0.6.1 | 6-OPT | `Db` `Belajar` `Beranda` `Lkpd` — epoch cache per murid, baca baris terarah (−89% pada kelas serentak) |
| 0.6.0 | 6A | `Lkpd` `js_lkpd` + pengumpulan tautan, antrean penilaian, umpan balik |
| 0.5.0 | 5 | `Belajar` `js_belajar` `v_baca` + baca materi per bagian, unlock 2 tingkat, unlock paksa |
| 0.4.0 | 4 | `Kelas` `Pertemuan` `js_kelola` `js_editor` `v_editor` + CRUD penuh, editor konten, salin antar kelas |
