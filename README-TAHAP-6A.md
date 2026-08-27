# Tahap 6A — LKPD: Pengumpulan & Penilaian

Acuan: `KESEPAKATAN-SISTEM.md` v4.7 §5c, §6.2, §6.4

> Tahap 6 dipecah dua karena cakupannya besar (26 fungsi API).
> **6A = LKPD** (bagian ini) · **6B = Quiz internal** (berikutnya).

---

## Berkas

### Baru — 2 berkas

| Berkas | Jenis | Isi |
|---|---|---|
| `Lkpd.gs` | Script | Draf, pengumpulan, antrean, penilaian, umpan balik |
| `js_lkpd.html` | HTML | Layar murid & panel penilaian guru |

### Diperbarui — 4 berkas

| Berkas | Perubahan |
|---|---|
| `Code.gs` | v0.6.0, 9 API baru, `ujiTahap6A()` |
| `css.html` | +60 baris: editor tautan, status, antrean |
| `index.html` | Muat `js_lkpd` |
| `js_belajar.html` | Item LKPD kini dapat dibuka |
| `js_beranda.html` | Panel tindakan menuju `#/nilai-lkpd` |

Tidak ada kolom database baru — **tidak perlu migrasi**.

---

## Alur

```
MURID                              GURU
─────                              ────
buka LKPD
  ↓
tempel tautan (maks 5)
tulis catatan
  ↓
[Simpan Draf] ⟳ bebas diubah
  ↓
[Kumpulkan] ← titik komitmen
  ↓                                 notifikasi masuk
status: menunggu                    ↓
tautan terkunci                    buka antrean
  ↓                                 ↓
[Batalkan] masih bisa              [buka pekerjaan]
  ↓                                 ↓ status: dinilai_proses
  ✕ tombol batal hilang            beri nilai + catatan
                                    ↓
                          ┌─────────┴─────────┐
                     [Terima]            [Tolak]
                          ↓                   ↓
                   progress selesai    kembali ke draf
                   pertemuan lanjut    revisi_ke +1
```

---

## Yang Sudah Berjalan

### Sisi murid
- Editor tautan dinamis, maksimal 5, divalidasi format URL
- Simpan draf kapan saja tanpa menyerahkan
- Konfirmasi sebelum mengumpulkan
- Batalkan penyerahan selama guru belum membuka
- Catatan guru tampil begitu dinilai, otomatis ditandai terbaca
- Batas waktu opsional: lewat batas tetap bisa, ditandai **terlambat**

### Sisi guru

**Dua pintu masuk penilaian:**

| Jalur | Untuk apa |
|---|---|
| Beranda → ⚡ Perlu Tindakan | Antrean lintas kelas, kerjakan yang menumpuk |
| Pertemuan → item LKPD → **📥 Penilaian** | Satu LKPD, seluruh murid di kelas itu |

**Halaman penilaian per-LKPD** menampilkan seluruh murid kelas beserta
statusnya — termasuk yang **belum mengumpulkan sama sekali**:

```
📥 24/36 Mengumpulkan   ⏳ 5 Menunggu   ✅ 19 Diterima   📊 82 Rata-rata
████████████░░░░░░  67% murid sudah mengumpulkan · 12 belum menyentuh

[Semua 36] [⏳ Menunggu 5] [✅ Diterima 19] [↩ Revisi 2] [○ Belum 12]

⏳ Ahmad Fauzi      menunggu dinilai · 2 tautan · 2026-08-01 09:14
↩  Budi Santoso     perlu revisi · revisi 2
○  Citra Dewi       belum mengumpulkan
✅ Dedi Pratama     diterima                                    90
```

Urutan mendahulukan yang perlu tindakan; penyaring status di atas daftar.

- Antrean lintas kelas, terurut dari yang paling lama menunggu
- Panel penilaian menampilkan tautan yang dapat diklik langsung
- **Catatan wajib diisi saat menolak** — divalidasi di server
- Template umpan balik siap pakai (6 bawaan dari Tahap 1)
- Nilai opsional 0–100

### Integrasi
LKPD diterima → `progress` menjadi `selesai` → pertemuan berikutnya
terbuka bila seluruh item wajib sudah tuntas.

Status `menunggu` **tidak** dihitung selesai — pertemuan tetap terkunci
sampai guru menilai.

---

## Hasil Uji

```
node test/run9-lkpd.js  →  105 lolos, 0 gagal
```

Total seluruh tahap: **9 berkas uji, 0 gagal**.

### Uji keamanan & kasus tepi yang lolos

```
✅ LKPD kelas lain → DITOLAK
✅ LKPD terkunci sebelum materi selesai → DITOLAK
✅ tidak bisa mengubah setelah diserahkan
✅ tidak bisa membatalkan saat guru sedang menilai
✅ menolak tanpa catatan → DITOLAK
✅ nilai di luar 0–100 → DITOLAK
✅ tautan bukan URL → DITOLAK
✅ lebih dari 5 tautan → DITOLAK
✅ dua murid pada satu LKPD → draf terpisah
✅ simpan draf 5× → tetap satu baris
✅ siklus tolak-revisi 3× → revisi_ke konsisten
✅ guru hapus LKPD saat dikerjakan → tidak error
✅ argumen null/undefined/[] → tidak error
✅ daftar per-LKPD: 6 status terpetakan benar
✅ rekap & rata-rata nilai akurat
✅ murid dikeluarkan → hilang dari daftar & rekap
```

### Bug yang ditemukan

**Urutan daftar terbalik.** Bobot pengurutan dimulai dari `0`, sedangkan
kodenya memakai `bobot[status] || 9`. Dalam JavaScript `0 || 9` bernilai
`9`, sehingga status **menunggu** — yang paling perlu ditindak — justru
terlempar ke urutan terakhir. Bobot diubah agar dimulai dari `1`.

### Performa

`antrean()` dengan 500 submission: **9.383 sel, 20 ms**.
Kolom `links` dan `catatan_murid` sengaja tidak dibaca pada daftar.

---

## Memasang

1. Buat `Lkpd` (Script) dan `js_lkpd` (HTML)
2. Timpa `Code.gs`, `css.html`, `index.html`, `js_belajar.html`, `js_beranda.html`
3. Jalankan **`ujiTahap6A`** → **View → Logs**
4. **Deploy → Manage deployments → ✏️ → New version → Deploy**

> `ujiTahap6A` memerlukan LKPD yang sudah terbuka. Bila muncul
> "Tidak ada LKPD terbuka", selesaikan dahulu materi pada pertemuan
> tersebut sebagai murid.

---

## Bila Bermasalah

| Gejala | Penyebab |
|---|---|
| `Lkpd is not defined` | `Lkpd.gs` belum dibuat sebagai Script |
| Klik LKPD tidak bereaksi | `js_lkpd` belum dimuat di `index.html` |
| "LKPD masih terkunci" | Selesaikan materi wajib dahulu |
| Tombol Batalkan hilang | Guru sudah membuka pekerjaan Anda |
| Tidak bisa menolak | Catatan wajib diisi |
| Antrean kosong padahal ada | Periksa filter kelas |

---

## Berikutnya — Tahap 6B

Quiz internal: bank soal, pengerjaan dengan autosave, penilaian
otomatis, dan koreksi esai.
