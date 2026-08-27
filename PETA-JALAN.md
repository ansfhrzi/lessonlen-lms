# Peta Jalan LessonLen — setelah v1.12.2

Keadaan sekarang: **100 berkas uji hijau**, aplikasi dipakai mengajar,
dan **seluruh butir peta jalan lama SELESAI.**

Sejak v1.9.0 pekerjaan bergeser dari menambah fitur ke **memperbaiki
apa yang ditemukan saat mengajar**. Semua bug terparah proyek ini —
tanpa kecuali — datang dari pemakaian nyata, bukan dari daftar ini.

---

## ✅ Tiga butir lama: SELESAI

| # | Pekerjaan | Hasil |
|---|---|---|
| 1 | Verifikasi quiz 36 murid | ✅ **lapangan: "aman lancar"** |
| 2 | `resetTahunAjaran()` | ✅ v1.12.0 |
| 3 | Tombol pembersih ekspor Drive | ✅ v1.12.1 |

### Butir 1 — yang paling lama menggantung

Keluhan aslinya: *"mengerjakan quiz sangat lama, banyak yang gagal,
server sibuk, data tidak tersimpan"* — 36 murid serentak.

| Perubahan | Versi | Angka |
|---|---|---|
| Quiz offline `localStorage` | 1.9.0 | 288 → **72 permintaan** |
| Kunci selektif + reentrant | 1.9.1 | 3 → **1 kunci/murid** |
| `tryLock` 10 → 45 detik | 1.9.1 | antrean lebih sabar |

Angkanya dulu hanya estimasi mock. Kini terbukti di kelas sungguhan,
dan rencana cadangan (antrian di sisi klien) **tidak jadi diperlukan**.

### Butir 2 — siap dipakai Juni

Dua langkah dari editor Apps Script:

```js
resetTahunAjaran()                  // hanya MELIHAT
resetTahunAjaran('YA SAYA YAKIN')   // menjalankan
```

Arsip ke Drive dulu, baru hapus. Materi & bank soal tetap utuh.

---

## Yang berikutnya

**Tidak ada daftar.** Ini disengaja.

Riwayat proyek ini menunjukkan pola yang sangat konsisten: fitur yang
lahir dari peta jalan jarang menemukan bug penting, sementara **setiap
bug terparah datang dari Bapak memakai aplikasinya untuk mengajar** —

- quiz 36 murid gagal → v1.9.0–1.9.1
- pratinjau "Tanpa Judul" → v1.9.3
- quiz terkunci padahal tidak wajib → v1.9.5
- sulit membuat tabel → v1.9.9
- tombol Visual tidak terlihat → v1.9.11
- kolom biodata tersimpan kosong → v1.10.2–1.10.4
- tombol WA tidak muncul → v1.11.5–1.11.7

Jadi butir berikutnya menunggu pemakaian, bukan perencanaan.

---

## Bila suatu saat dibutuhkan

Bukan rencana — hanya catatan agar tidak dipikirkan dari nol:

| Kemungkinan | Catatan |
|---|---|
| **Biodata Tahap 3** | wali kelas / orang tua ikut dihubungi |
| **Rekap lintas semester** | perlu penanda semester di `progress` |
| **Bank soal bersama** | soal dipakai ulang antar kelas tanpa disalin |
| **`_progresMurid()`** | memindai 33.648 sel pada sekolah penuh; cache 300 detik menutupinya, murid pertama tiap sesi membayar penuh (dijaga `perf16` bagian F) |

Tiga yang pertama **belum tentu diperlukan** — jangan dikerjakan
sebelum Bapak sendiri merasa kekurangannya.

---

## Untuk yang melanjutkan

**Mulai dari `BRIEFING-AI.md` di akar proyek** — satu pintu masuk
yang merangkai seluruh dokumen, ditulis khusus untuk AI penerus.

Baca `docs/KONVENSI-TEKNIS.md` §6.2 — **123 aturan**, seluruhnya lahir
dari kesalahan nyata di proyek ini. Yang paling sering menyelamatkan:

- **no. 5** — tiap uji baru wajib dibuktikan bisa MERAH
- **no. 7** — bedakan bug nyata dari cacat uji sebelum "memperbaiki"
- **no. 49** — uji lewat jalur yang benar-benar dipakai pengguna
- **no. 61** — baca bentuk kembalian API, jangan menebak dari namanya
- **no. 85** — bila dua kali menebak meleset, buat alat diagnosis
