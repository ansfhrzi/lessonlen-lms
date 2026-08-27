# Refleksi Murid — v1.2.0

Item tipe keempat, melengkapi 📄 Materi · 📝 LKPD · 🎯 Quiz.

Acuan: `KESEPAKATAN-SISTEM.md` §6.5

---

## Cara guru memakainya

1. **Kelola Kelas → pilih kelas → buka Materi Pokok → Kelola Item**
2. Klik **🪞 Refleksi**
3. Isi judul, lalu susun **2–6 pertanyaan terbuka**
   - centang **wajib** bila pertanyaan harus dijawab
   - pertanyaan tanpa centang boleh dilewati murid
4. Simpan & Terbitkan

Editor konten kaya sengaja disembunyikan pada tipe ini — kolom `konten`
dipakai menyimpan JSON pertanyaan, bukan HTML.

### Membaca hasilnya

**Kelola Kelas → 🪞 Refleksi** menampilkan seluruh refleksi kelas beserta
rata-rata skalanya. Klik salah satu untuk membuka rekap.

Rekap dikelompokkan **per pertanyaan**, bukan per murid — 36 jawaban atas
satu pertanyaan terbaca sekali jalan. Setiap jawaban diberi lingkaran
skala berwarna: merah (1) sampai hijau (5), sehingga murid yang perlu
perhatian langsung terlihat.

Bila **rata-rata di bawah 3**, muncul peringatan bahwa materi sebaiknya
diulang sebelum melanjutkan.

Di bagian bawah ada daftar murid dengan tombol **Balas**. Murid mendapat
notifikasi dan membacanya di halaman refleksinya sendiri.

---

## Cara murid memakainya

Refleksi muncul di sidebar dan daftar item dengan ikon 🪞. Murid:

1. Menjawab pertanyaan (yang bertanda <span>*</span> wajib)
2. Memilih **skala pemahaman diri 1–5**
3. **Simpan Draf** untuk melanjutkan nanti, atau **Kirim Refleksi**

Setelah dikirim, jawaban **tidak dapat diubah** dan pertemuan berikutnya
**langsung terbuka** — refleksi tidak menunggu guru membaca.

| Skala | Arti yang ditampilkan |
|---|---|
| 1 | Belum paham sama sekali |
| 2 | Masih banyak yang bingung |
| 3 | Cukup paham, sebagian masih ragu |
| 4 | Paham, tinggal perlu latihan |
| 5 | Paham betul, bisa menjelaskan ke teman |

---

## Catatan teknis

**Tidak ada tabel baru.** Jawaban memakai ulang `lkpd_submission`:
`links` → JSON jawaban, `nilai` → skala 1–5, `catatan_guru` → balasan.

**Tidak ada perubahan skema sheet.** Satu-satunya tambahan adalah nilai
enum `refleksi_dibalas` pada `notifikasi.jenis`. Sheet lama tetap jalan.

**Jawaban disanitasi** sebelum disimpan dan dipotong pada 2.000 karakter.

**Refleksi ikut terhapus** bersama pertemuan/Materi Pokok/kelas induknya,
lewat jalur penghapusan berantai yang sama dengan LKPD.

---

## Berkas yang perlu disalin ke Apps Script

```
Refleksi.gs (BARU)    js_refleksi.html (BARU)
Code.gs   Setup.gs    index.html
js_editor.html   js_nav.html   js_belajar.html
v_editor.html    css.html
```

Tidak perlu migrasi. Setelah menyalin:
**Deploy → Manage deployments → ✏️ → New version → Deploy**

---

## Memastikan berhasil

Jalankan `cekKesehatan()` di editor — bagian Modul harus menampilkan
`✅ Refleksi` dan `✅ MateriPokok`.

Lalu dari layar aplikasi:

1. Buat item Refleksi dengan 2 pertanyaan → terbitkan
2. Masuk sebagai murid → isi → Kirim
3. Pertemuan berikutnya langsung terbuka
4. Kembali sebagai guru → **🪞 Refleksi** → rekap menampilkan jawaban itu
5. Balas → murid melihat notifikasi

---

## Pratinjau tanpa Apps Script

```bash
node test/buat-pratinjau-refleksi.js
```

Membuka `pratinjau-refleksi.html`: tampilan murid dan rekap guru
berdampingan dalam satu halaman.

---

## Uji

```bash
node test/run33-refleksi.js    # 69 poin — backend + UI
```

## Yang sengaja belum dibuat

- **Ekspor rekap refleksi ke CSV** — menyusul bersama rekap nilai (Tahap 8)
- **Tag Dimensi Profil Lulusan** (§6.5.6) — metadata opsional, belum diminta
- Refleksi tidak muncul di rekap nilai, karena bukan penilaian guru
