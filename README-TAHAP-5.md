# Tahap 5 — Belajar: Materi per Bagian & Penguncian Bertingkat

**Inti sistem.** Setelah tahap ini murid sudah bisa benar-benar belajar.

Acuan: `KESEPAKATAN-SISTEM.md` v4.7 §3.3, §4.3, §5

---

## Berkas

### Baru — 3 berkas

| Berkas | Jenis | Isi |
|---|---|---|
| `Belajar.gs` | Script | Unlock logic 2 tingkat, baca materi, tandai selesai |
| `js_belajar.html` | HTML | Layar murid: pertemuan, item, pembaca materi |
| `v_baca.html` | HTML | Template pembaca materi |

### Diperbarui — 4 berkas

| Berkas | Perubahan |
|---|---|
| `Code.gs` | v0.5.0, 5 API baru, `ujiTahap5()` |
| `css.html` | +120 baris: pembaca materi, jejak bagian, perayaan |
| `index.html` | Muat 2 berkas baru |
| `js_beranda.html` | Rute murid diarahkan ke layar belajar |
| `Db.gs` | Komentar pengecualian pada `bacaKolom` |

---

## Memasang

1. Buat 3 berkas baru — `Belajar` sebagai **Script**; `js_belajar`,
   `v_baca` sebagai **HTML**
2. Timpa 4 berkas yang diperbarui
3. Jalankan **`ujiTahap5`** → **View → Logs**
4. **Deploy → Manage deployments → ✏️ → New version → Deploy**

Tidak ada kolom database baru — tidak perlu migrasi.

---

## Yang Sudah Berjalan

### Alur murid

```
Beranda → kartu kelas → daftar pertemuan
  Pertemuan 1  ✅ selesai
  Pertemuan 2  ▶  40%
  Pertemuan 3  🔒 terkunci
     └─ buka Pertemuan 2 → daftar item
          📄 Materi 1  ✅ selesai
          📄 Materi 2  ▶  bagian 2 dari 4
          📝 LKPD      🔒 selesaikan materi dahulu
          🎯 Quiz      🔒
             └─ buka materi → baca per bagian
                  ●━━━●━━━○━━━○
                  [← Sebelumnya]  [✓ Selesai & Lanjut]
```

### Pembaca materi

- Satu bagian per layar, bukan satu halaman panjang
- Jejak titik menunjukkan posisi baca
- Rumus MathJax ter-render otomatis
- Tombol mundur untuk mengulang bagian sebelumnya
- Bagian yang sudah dibaca dapat dibuka kembali kapan saja

### Penguncian bertingkat

**Tingkat 1 — antar pertemuan.** Pertemuan N terbuka setelah seluruh
item wajib pada pertemuan sebelumnya selesai.

**Tingkat 2 — dalam pertemuan** (bila `urut_ketat` aktif):
materi dikerjakan berurutan, LKPD dan Quiz baru terbuka setelah
seluruh materi wajib tuntas.

Setiap penolakan disertai alasan yang jelas, bukan sekadar "terkunci".

### Durasi baca minimum

Bila guru menetapkan `min_durasi_detik`, tombol Selesai menampilkan
hitung mundur beserta bilah kemajuan. **Diverifikasi ulang di server** —
memanipulasi tampilan tidak membantu.

### Perayaan penyelesaian

Menyelesaikan materi memunculkan konfirmasi. Menuntaskan seluruh
pertemuan memunculkan 🎉 beserta tombol menuju pertemuan berikutnya
yang baru terbuka.

### Unlock paksa guru

`unlockPaksa(userId, itemId, alasan)` membuka satu item untuk satu murid.
Alasan wajib diisi, tercatat di log, dan murid menerima notifikasi.

---

## Hasil Uji

```
node test/run.js           Tahap 1  : 12 lolos
node test/run2.js          Tahap 2  : 63 lolos
node test/run3.js          Tahap 3  : 50 lolos
node test/run4.js          Tahap 4  : 71 lolos
node test/run5-regresi.js  audit    : 90 poin, 0 bug
node test/run6-belajar.js  Tahap 5  : 43 lolos
                           ──────────────────────
                           total    : 329 pemeriksaan, 0 gagal
```

### Uji keamanan yang lolos

```
✅ konten item TIDAK pernah dikirim pada daftar
✅ lompat ke bagian 3 tanpa membaca 1-2 → DITOLAK server
✅ buka materi terkunci → DITOLAK
✅ buka pertemuan terkunci → DITOLAK
✅ akses kelas yang bukan miliknya → DITOLAK
✅ akses materi kelas lain → DITOLAK
✅ item berstatus draf tidak terlihat murid
✅ durasi baca diverifikasi di server, bukan di layar
✅ progres satu murid tidak membuka kunci murid lain
✅ guru ditolak memakai API murid, murid ditolak unlock paksa
```

Poin ketiga dari bawah paling penting: pengecekan kunci dilakukan **di
server pada setiap permintaan**. Memanipulasi JavaScript di browser tidak
membuka materi apa pun.

---

## Catatan Performa

Daftar item **tidak pernah membawa kolom `konten`** — hanya metadata.
Konten diambil satu bagian saja, tepat ketika dibuka.

Untuk pertemuan berisi 5 materi @10 KB, ini berarti ±50 KB tidak
dipindahkan setiap kali daftar dibuka.

---

## Bila Bermasalah

| Gejala | Penyebab |
|---|---|
| `Belajar is not defined` | `Belajar.gs` belum dibuat sebagai Script |
| Layar baca kosong | `v_baca` belum dibuat / salah jenis berkas |
| Semua pertemuan terkunci | Normal — selesaikan pertemuan pertama |
| Item tidak muncul | Statusnya masih draf; terbitkan dari editor |
| "Selesaikan bagian N dahulu" | Benar — bagian tidak boleh dilompati |
| Tombol Selesai tidak aktif | Durasi baca minimum belum tercapai |
| Rumus tampil sebagai teks | CDN MathJax terblokir; halaman tetap berfungsi |

---

## Berikutnya — Tahap 6

LKPD (pengumpulan link + penilaian) dan Quiz internal (bank soal,
pengerjaan, penilaian otomatis).
