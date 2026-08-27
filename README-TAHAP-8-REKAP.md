# Tahap 8 — Rekap Nilai & Ekspor (v1.5.0)

Satu tabel: seluruh murid satu kelas × seluruh item bernilai, plus
ekspor ke Google Sheet.

Ini menutup satu-satunya pekerjaan yang masih dikerjakan manual tiap
akhir semester.

> Berkas ini melengkapi `README-TAHAP-8-UI-HIERARKI.md`, yang membahas
> tampilan hierarki tiga tingkat (dinomori 8 juga pada rilis lama).

---

## Salin ke Apps Script — 7 berkas

```
Rekap.gs          ← BARU (file Script, beri nama "Rekap")
js_rekap.html     ← BARU (file HTML, beri nama "js_rekap")
Code.gs
index.html
js_core.html
js_beranda.html
css.html
```

Tidak ada perubahan skema — **tidak perlu migrasi**.
Setelah menyalin: **Deploy → New version**.

> Tulis nama berkas tanpa ekstensi. Apps Script menambahkan
> `.gs` / `.html` sendiri.

---

## Cara memakainya

**Beranda → 📊 Rekap Nilai → pilih kelas**

1. Pilih **Materi Pokok** bila kolomnya terlalu banyak
2. Baca tabelnya — kolom **Nama** dan **kepala tabel** membeku saat
   digulir, jadi Anda tidak kehilangan jejak
3. Arahkan kursor ke sel untuk melihat keterangannya
4. **📤 Ekspor ke Sheet** → berkas dibuat di Drive, tautannya muncul

---

## Yang masuk tabel

| Tipe item | Nilai yang dipakai |
|---|---|
| 📝 LKPD | nilai submission berstatus **diterima** |
| 🎯 Quiz | nilai **tertinggi** dari seluruh percobaan |

**Tidak** masuk:

- item **materi** — tidak bernilai
- item berstatus **draf** — murid belum pernah melihatnya
- item **refleksi** — bukan penilaian, lihat di bawah

Urutan kolom mengikuti jalannya pelajaran — bab, lalu pertemuan, lalu
item — bukan urutan baris di basis data.

---

## Tiga hal yang mudah disalahpahami

### 1. Refleksi tidak ada di sini — dan itu disengaja

Skala 1–5 pada refleksi adalah **penilaian diri murid** atas
pemahamannya sendiri, bukan nilai yang Anda berikan. Murid yang jujur
menulis "2" justru sedang membantu Anda, bukan sedang berprestasi
buruk — menaruhnya sebaris dengan nilai LKPD & Quiz membuatnya terbaca
sebagai komponen penilaian.

Rekap refleksi tetap ada, di tempatnya sendiri:

**Kelola Item → item refleksi → tombol Penilaian**

Di sana ada sebaran skala sekelas beserta seluruh jawaban terbukanya,
dan Anda bisa membalas tiap murid.

### 2. Sel kosong bukan nol

| Tampilan | Artinya |
|---|---|
| `—` | belum ada nilai |
| `0` | murid mengerjakan dan mendapat nol |

Sel kosong **tidak** dihitung sebagai nol dalam rata-rata. Murid yang
belum mengerjakan tidak sama dengan murid yang mendapat nol.

### 3. Kolom kosong belum tentu salah murid

Warna sel membedakan enam keadaan:

| Warna | Artinya |
|---|---|
| hijau | sudah tuntas / diterima |
| kuning | **menunggu tindakan Anda** — LKPD belum dinilai, esai belum dikoreksi |
| merah | di bawah KKM / ditolak |
| oranye | diterima tetapi terlambat |
| abu | murid belum mengerjakan |

Arahkan kursor ke sel untuk membaca keterangannya dalam teks.

**Kolom "Mencapai KKM"** hanya diisi untuk quiz — LKPD tidak punya
KKM, jadi menampilkan `—`.

---

## Berkas ekspor menumpuk di Drive

Tiap ekspor membuat **satu Spreadsheet baru**. Setelah satu semester
Drive bisa penuh berkas serupa.

Nama berkasnya seragam:

```
LessonLen Rekap — XI TJKT 1 — Semua Bab — 2026-08-07 1430
```

Pembersihnya sudah ada di backend:

```js
hapusEksporRekapLama(token, 30)   // buang yang lebih tua dari 30 hari
```

Hanya berkas berawalan `LessonLen Rekap — ` yang disentuh. Berkas
bernama *"Arsip LessonLen Rekap 2024 (jangan hapus)"* **tidak** ikut
terbuang — penjaganya memeriksa awalan, bukan sekadar memuat frasa.

> Fungsi UI `bersihkanEksporLama()` ada di `js_rekap.html` tetapi
> **belum diberi tombol**. Panggil dari konsol peramban bila perlu.

---

## Kenapa Google Sheet, bukan unduhan CSV

Apps Script yang di-deploy sebagai web app **tidak bisa memaksa
peramban mengunduh berkas** dari sisi server. Menulis Sheet juga
langsung bisa diolah (rumus, penyalinan ke format rapor sekolah) tanpa
langkah impor.

Konsekuensinya berkas menumpuk di Drive — lihat bagian di atas.

---

## Memastikan berhasil

Dari editor Apps Script:

```
ujiTahap11()
```

23 pemeriksaan, ~30 detik. Membuat kelas `ZZ Uji Rekap`, mengisi nilai
tiga murid, mengekspor, lalu **menghapus dirinya sendiri** — termasuk
membuang berkas Sheet hasil uji ke tong sampah. Aman diulang.

Bila `Rekap.gs` lupa disalin, `cekKesehatan()` akan menyebutnya.

---

## Pratinjau tanpa Apps Script

```bash
node test/buat-pratinjau-rekap.js
```

---

## Uji

```bash
node test/run42-rekap.js       # backend — 99 poin, 17 bagian
node test/run43-ui-rekap.js    # UI di DOM sungguhan — 84 poin, 14 bagian
```

`run42` memakai **`mock4.js`** — mock baru dengan Drive tiruan dan
spreadsheet yang **terpisah** dari basis data. `mock2.js` tidak bisa
dipakai: `SpreadsheetApp.create()` di sana mengembalikan spreadsheet
yang sama dengan DB, sehingga hasil ekspor akan menimpa sheet basis
data dan ujinya tampak "berhasil" karena membaca datanya sendiri.

mock4 juga **menegakkan** dua aturan Sheets yang di Apps Script
sungguhan melempar galat:

- `setValues()` — panjang tiap baris harus seragam
- `setFrozenColumns()` — garis beku tidak boleh memotong sel gabungan
  (bug v1.5.2: judul yang di-`merge()` selebar tabel membuat seluruh
  ekspor gagal, sementara 44 berkas uji tetap hijau)
