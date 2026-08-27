# Tahap 3 — Kerangka SPA, Dashboard, Notifikasi, MathJax

Acuan: `KESEPAKATAN-SISTEM.md` v4.5 · `KONVENSI-TEKNIS.md` v1.0

---

## Berkas

### Baru

| Berkas | Jenis | Isi |
|---|---|---|
| `Notif.gs` | Script | Notifikasi in-app — kirim massal satu tulis, waktu relatif |
| `Beranda.gs` | Script | Data dashboard guru & murid + perhitungan unlock |
| `js_beranda.html` | HTML | Layar beranda, daftar pertemuan, halaman notifikasi |

### Diperbarui

| Berkas | Perubahan |
|---|---|
| `Code.gs` | Versi 0.3.0, `getBeranda()`, notifikasi lewat `Notif`, `ujiTahap3()` |
| `css.html` | +175 baris: kisi statistik, bilah progres, baris pertemuan, gaya konten materi |
| `index.html` | Muat `js_beranda`, pasang MathJax dari CDN |
| `js_core.html` | Lonceng menuju `#/notifikasi`, logo dapat diklik, `State.beranda` |
| `js_auth.html` | Beranda lama dipindah ke `js_beranda`, layar reset disesuaikan |
| `v_dashboard.html` | Disederhanakan jadi kerangka `#isi-halaman` |

---

## Memasang

1. **Buat 3 berkas baru** di editor — `Notif`, `Beranda` sebagai **Script**; `js_beranda` sebagai **HTML**
2. **Timpa 5 berkas** yang diperbarui
3. Jalankan **`ujiTahap3`** → **View → Logs**
4. **Deploy → Manage deployments → ✏️ → New version → Deploy**

Keluaran `ujiTahap3` yang diharapkan:

```
1. Beranda GURU
   kelas        : 1
   murid        : 3
   pertemuan    : 2
   - [CONTOH] XI TJKT 1 | 3 murid | 2 pertemuan | 0%
2. Beranda MURID
   - [CONTOH] XI TJKT 1 (0%)
       [AKTIF] 1. Konsep Dasar VLAN  (0/3 item)
       [KUNCI] 2. Konfigurasi dan Pengujian VLAN  (0/1 item)
```

Baris `[KUNCI]` itu buktinya unlock logic bekerja.

---

## Yang Sudah Berjalan

### Dashboard Guru
- Empat kartu statistik: kelas, murid, pertemuan, item
- Panel **Perlu Tindakan** — muncul hanya bila ada LKPD/quiz/reset menunggu
- Daftar kelas dengan bilah progres dan penanda jumlah draf

### Dashboard Murid
- Progres keseluruhan lintas kelas
- Kartu **Lanjutkan** — langsung menuju pertemuan aktif
- Daftar pertemuan dengan tiga keadaan:

| Keadaan | Tampilan |
|---|---|
| Selesai | Garis hijau, nomor bulat hijau, ✅ |
| Berjalan | Garis hijau muda, persentase |
| Terkunci | Abu-abu, 🔒, tidak bisa diklik |

Menekan pertemuan terkunci memunculkan pesan *"Selesaikan pertemuan sebelumnya dahulu."*

### Notifikasi
- Halaman penuh di `#/notifikasi`
- Ikon per jenis, waktu relatif (*baru saja*, *2 jam lalu*)
- Titik oranye untuk yang belum dibaca
- Tandai satu atau semua sekaligus
- Menekan notifikasi membuka tautan terkait

### MathJax
- Dimuat dari CDN dengan `defer`, `startup.typeset: false`
- `renderRumus(el)` dipanggil setiap konten dirender
- Rumus: `$$…$$` (blok) atau `\(…\)` (sebaris)

---

## Hasil Uji

```
node test/run.js    →  Tahap 1  : 12 lolos
node test/run2.js   →  Tahap 2  : 63 lolos
node test/run3.js   →  Tahap 3  : 50 lolos
                       ────────────────────
                       total    : 125 lolos, 0 gagal
```

### Uji unlock logic

Bagian terpenting Tahap 3 — dibuktikan bertahap:

```
✅ P1 TERBUKA (pertemuan pertama selalu terbuka)
✅ P2 TERKUNCI (P1 belum selesai)
   → tandai 3 item wajib P1 sebagai selesai
✅ P1 kini SELESAI, progres 100%
✅ P2 kini TERBUKA
✅ progres kelas naik 50%
✅ kartu "Lanjutkan" pindah ke P2
✅ murid lain TETAP terkunci di P2   ← isolasi antar murid
```

### Bug yang ditemukan & diperbaiki

Notifikasi massal dibuat dalam stempel waktu yang sama persis, sehingga
urutannya tidak menentu. Ditambahkan tie-break memakai `notif_id`
supaya urutan selalu konsisten.

---

## Bila Bermasalah

| Gejala | Penyebab |
|---|---|
| Beranda kosong terus | `js_beranda` belum dibuat / salah jenis berkas |
| `Beranda is not defined` | `Beranda.gs` belum dibuat sebagai Script |
| Pertemuan tidak muncul | Statusnya masih `draft`, ubah ke `publish` di sheet |
| Semua pertemuan terkunci | Normal bila pertemuan pertama belum selesai |
| Rumus tampil sebagai teks | CDN MathJax terblokir — halaman tetap berfungsi |
| Perubahan tidak terlihat | Belum deploy versi baru |

---

## Berikutnya — Tahap 4

CRUD kelas, murid, enrollment, pertemuan, item, dan editor konten kaya.
Setelah itu Anda sudah bisa menyusun materi PKPJ sungguhan.
