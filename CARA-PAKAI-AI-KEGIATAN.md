# Menyusun Kegiatan & Refleksi dengan AI

Versi 1.8.1. Sejak versi ini **keempat tipe item** bisa disusun AI:
Materi, LKPD, Tugas Kelompok, dan Refleksi.

---

## Perlu migrasi?

**Tidak.** Hasil AI masuk ke kolom `konten` yang sudah ada — sama
persis seperti LKPD yang Anda tulis tangan.

Cukup salin 4 berkas, lalu deploy ulang.

---

## Berkas yang perlu disalin

| Berkas | Keterangan |
|---|---|
| `Ai.gs` | `generateKegiatan()` + `generateRefleksi()` |
| `Code.gs` | API `generateKegiatanAI` & `generateRefleksiAI` + versi 1.8.1 |
| `js_editor.html` | tombol ✨ untuk LKPD, Tugas Kelompok, & Refleksi |
| `v_editor.html` | judul panel yang menyesuaikan tipe |

Verifikasi: jalankan **`cekBerkasUI()`** → harus **59 penanda**.

---

## Cara memakai

### 1. Buat itemnya lebih dulu

Buka pertemuan → **📝 LKPD** atau **👥 Tugas Kelompok**.

### 2. Isi Tujuan Pembelajaran — wajib, kecuali Refleksi

Tombol ✨ **sengaja mati** sampai Tujuan Pembelajaran diisi, dan
alasannya tertulis di panel. Tujuan Pembelajaran adalah bahan utama
AI; tanpa itu hasilnya cuma tebakan.

**Refleksi dikecualikan.** Bahan utamanya adalah isi pertemuan —
materi, LKPD, dan quiz yang baru dipelajari murid.

### 3. Simpan sebagai draf

AI perlu membaca konteks pertemuan dari server, jadi itemnya harus
sudah tersimpan. Selama belum, panel berbunyi *"Simpan item ini
sebagai draf dahulu."*

### 4. Tekan ✨ Generate

Isi **Catatan tambahan** bila perlu mengarahkan, misalnya:

- LKPD → *"praktik di lab, alat terbatas 5 unit"*
- Tugas Kelompok → *"tiap kelompok bahas satu topologi berbeda"*

Butuh 15–45 detik. Penghitung detik berjalan supaya Anda tahu prosesnya
masih hidup.

### 5. Tinjau, centang, terbitkan

Hasil AI **selalu** masuk sebagai draf. Kotak *"sudah saya tinjau"*
harus dicentang sebelum bisa diterbitkan — ini penjaga yang sama
seperti pada Materi.

---

## Apa yang disusun AI

### LKPD — lima bagian

1. **Tujuan Kegiatan** — 2–3 butir, turunan Tujuan Pembelajaran
2. **Alat dan Bahan** — yang benar-benar dipakai
3. **Langkah Kerja** — 5–8 langkah, tiap langkah satu tindakan yang
   bisa dikerjakan dan diamati hasilnya
4. **Pertanyaan dan Tugas** — 3–5 pertanyaan analisis; yang terakhir
   menuntut penerapan pada situasi baru
5. **Kesimpulan** — instruksi bagi murid menuliskan simpulannya

### Tugas Kelompok — sama, plus diskusi

Bedanya ada pada **cara mengerjakan**, sesuai keputusan Anda:

- langkah kerja menuntut **musyawarah dan keputusan bersama**
- ada **titik-titik diskusi**: hal yang harus disepakati kelompok
- pertanyaan diarahkan pada **hasil kesepakatan**, bukan jawaban
  perorangan
- **tidak ada pembagian peran formal** (koordinator, pencatat, dsb.) —
  seluruh anggota memikirkan seluruh persoalan

Bila kelompok sudah Anda bentuk, AI memakai **jumlah anggota
sungguhan**. Bila belum, ia merancang untuk 3–4 orang.

### Refleksi — 3 pertanyaan kesadaran belajar

Berbeda dari dua di atas: hasilnya **bukan** teks kegiatan, melainkan
pertanyaan yang langsung mengisi panel penyusun.

Arahnya **cara murid belajar**, bukan penguasaan materi — sesuai
Pembelajaran Mendalam (Permendikdasmen 13/2025). Tiap pertanyaan
menggali salah satu dari:

- strategi belajar yang dipakai dan seberapa membantu
- bagian yang masih sulit, beserta dugaan sebabnya
- langkah untuk memperbaiki pemahamannya
- perubahan cara pandang setelah pertemuan ini

AI **dilarang** membuat pertanyaan berjawaban benar/salah atau
ya/tidak — refleksi bukan penilaian, dan pertanyaan tertutup tidak
menggali apa pun.

Hasilnya **ditambahkan**, bukan menimpa. Pertanyaan yang sudah Anda
tulis sendiri tetap aman, dan tombolnya berubah jadi **✨ Tambah
Lagi**. Bila panel sudah berisi 6 pertanyaan, Anda diminta menghapus
dahulu.

Bila AI menghasilkan pertanyaan yang berpotensi dijawab ya/tidak,
panel memberi peringatan kuning — pertanyaannya **tidak dibuang**,
Anda yang menilai apakah masih terpakai.

### Yang sengaja TIDAK dibuat

- **Rubrik penilaian** — sesuai keputusan Anda, penilaian memakai
  pertimbangan guru sendiri
- **Kunci jawaban** — tidak pernah ikut ke konten yang dibaca murid

---

## Bila hasilnya kurang pas

### AI melewatkan sebuah bagian

Panel menampilkan peringatan kuning yang menyebut bagian mana yang
hilang, misalnya *"AI tidak menuliskan bagian: Alat, Kesimpulan."*

Tambahkan sendiri, atau tekan **✨ Generate Ulang**.

### Isinya terlalu umum

Isi **Catatan tambahan** dengan konteks nyata Anda: alat yang
tersedia, kondisi lab, tingkat kemampuan kelas. Semakin konkret,
semakin terpakai hasilnya.

### AI mengarang topik lain

Pastikan **Materi di pertemuan yang sama** sudah dibuat. AI membaca
judul-judul materi itu dan diperintahkan melatih materi tersebut,
bukan topik lepas.

### Kuota AI habis

Pesannya diteruskan apa adanya dari Google. Isi editor **tidak
berubah** — Anda tetap bisa menulis manual, dan mencoba lagi nanti.

---

## Catatan

Semua hasil AI dicatat di sheet `materi_ai`: prompt ringkas, konten,
model yang dipakai, dan durasinya. Berguna bila Anda ingin menelusuri
hasil lama.

Sejak v1.8.1 **tidak ada lagi tipe item yang harus ditulis manual**.
Keempatnya punya tombol ✨, masing-masing dengan bentuk keluaran yang
sesuai: HTML untuk Materi/LKPD/Tugas Kelompok, dan daftar pertanyaan
untuk Refleksi.
