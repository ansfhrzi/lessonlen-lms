# UI Hierarki Tiga Tingkat — v1.1.0

Melengkapi restrukturisasi v1.0.0 (backend) dengan tampilannya.

```
KELAS
 └── 1. MATERI POKOK 1
       ├── 1.1 Pertemuan 1          jenis: biasa
       │      ├── 📄 submateri 1 · 📄 submateri 2
       │      ├── 📝 LKPD · 🎯 Quiz · 🪞 Refleksi
       ├── 1.2 Pertemuan 2          jenis: biasa
       ├── 1.3 Ujian / UH           jenis: ujian
       └── 1.4 Refleksi Bab         jenis: refleksi
 └── 2. MATERI POKOK 2
```

---

## Yang bisa dilakukan guru sekarang

| Tindakan | Letak |
|---|---|
| Buat / ubah / hapus Materi Pokok | tombol **+ Materi Pokok** di kepala halaman |
| Urutkan Materi Pokok | tombol ↑ ↓ pada kartunya |
| Tambah pertemuan **ke dalam** satu Materi Pokok | tombol **+ Pertemuan** di dalam kartu |
| Pilih jenis pertemuan (biasa / ujian / refleksi) | dropdown pertama di form pertemuan |
| Pindahkan pertemuan antar Materi Pokok | tombol **⇄** pada barisnya |
| Urutkan pertemuan dalam satu Materi Pokok | tombol ↑ ↓ pada barisnya |

Materi Pokok berstatus **draf** menyembunyikan seluruh pertemuan di
dalamnya dari murid, sekalipun pertemuannya sudah terbit. Ini cara
tercepat menyiapkan satu bab penuh tanpa terlihat murid.

---

## Yang dilihat murid

- Daftar isi kelas dikelompokkan per Materi Pokok, lengkap dengan
  bilah kemajuan tiap bab
- Sidebar tiga lapis: Materi Pokok → Pertemuan → Item
- Nomor bertingkat: `1.2`, `1.3` — bukan lagi nomor datar
- Ujian dan Refleksi Bab diberi ikon dan label sendiri
- Materi Pokok terkunci menampilkan alasan, **tanpa** membocorkan
  judul pertemuan di dalamnya

Unlock berlaku tiga tingkat: Materi Pokok berikutnya terkunci sampai
yang sebelumnya tuntas; di dalamnya pertemuan berurutan; di dalam
pertemuan item berurutan bila `urut_ketat`.

Materi Pokok yang **tidak wajib** atau **kosong** tidak pernah mengunci
penerusnya — bab kosong yang mengunci selamanya adalah bug yang pernah
terjadi di tingkat pertemuan (v0.5) dan sengaja dicegah berulang.

---

## Berkas yang perlu disalin ke Apps Script

```
MateriPokok.gs   Pertemuan.gs   Code.gs
js_editor.html   js_nav.html    js_belajar.html   css.html
```

Tidak ada perubahan skema, jadi **tidak perlu** menjalankan
`migrasiStruktur()` atau `migrasiHierarki()` lagi — kecuali database
Anda memang belum pernah dimigrasi.

Setelah menyalin: **Deploy → Manage deployments → ✏️ → New version → Deploy**.

---

## Memastikan berhasil

Dari layar aplikasi:

1. **Kelola Kelas → pilih kelas** — muncul kartu Materi Pokok yang bisa
   dilipat, bukan daftar pertemuan datar
2. **+ Materi Pokok** → isi judul → Simpan → kartunya muncul dan terbuka
3. **+ Pertemuan** di dalamnya → pilih jenis **Ujian / UH** → Simpan →
   barisnya bertepi kuning dengan ikon 🧪
4. Masuk sebagai murid → daftar isi kelas terkelompok per bab, sidebar
   menampilkan "Materi Pokok 1" di atas pertemuannya

Bila muncul kotak kuning **"N pertemuan belum masuk Materi Pokok"**,
jalankan `migrasiHierarki()` di editor Apps Script — itu sisa data lama.

---

## Pratinjau tanpa Apps Script

```bash
node test/buat-pratinjau.js        # pratinjau-sidebar.html  (tampilan murid)
node test/buat-pratinjau-guru.js   # pratinjau-guru.html     (tampilan guru)
```

Keduanya berkas HTML mandiri yang bisa dibuka langsung di browser.
Dihasilkan dari `css.html` dan berkas JS yang sebenarnya, jadi tidak
mungkin ketinggalan versi.

---

## Uji

```bash
node test/run31-ui-hierarki.js     # 48 poin — backend + sidebar
node test/run29-hierarki.js        # 48 poin — unlock tiga tingkat
node test/run30-audit-hierarki.js  # 22 poin — integritas data
```

## Belum dikerjakan

- **Halaman pengerjaan Refleksi murid** — tipe item `refleksi` sudah
  diterima backend dan bisa dibuat guru, tetapi belum ada layar
  pengisiannya. Ini pekerjaan berikutnya.
- Skala 1–5 dan balasan guru pada refleksi (kesepakatan: versi ringkas
  dulu, pertanyaan terbuka saja)
