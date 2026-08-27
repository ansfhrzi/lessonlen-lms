# Ceklis Uji Layar — v1.2.1

`ujiTahap9()` sudah membuktikan **backend**-nya benar (56/56). Yang
belum tersentuh sama sekali: **tampilan dan interaksi**. Bug UI tidak
mungkin ditangkap fungsi diagnostik — hanya mata Anda yang bisa.

Perkiraan: **15 menit**. Jangan lupa **Deploy → New version** dulu.

Beri tanda ❌ pada yang gagal, lalu kirimkan daftarnya ke saya.

---

## A. Guru — halaman isi kelas

Buka **Kelola Kelas → pilih satu kelas**.

- [ ] **A1** Tampil sebagai **kartu Materi Pokok**, bukan daftar
      pertemuan datar
- [ ] **A2** Klik judul bab → **melipat/membuka** daftar pertemuannya
- [ ] **A3** Bab yang terbuka **tetap terbuka** setelah Anda menyimpan
      sesuatu (tidak menutup sendiri)
- [ ] **A4** Nomor pertemuan **bertingkat**: `1.1`, `1.2`, `2.1`
- [ ] **A5** Tombol ↑ ↓ pada bab paling atas/bawah **kelabu** (disabled)
- [ ] **A6** Muncul tombol **🪞 Refleksi** di kanan atas

> Bila muncul kotak kuning **"N pertemuan belum masuk Materi Pokok"** —
> itu sisa data lama. Jalankan `migrasiHierarki()` sekali lagi.

## B. Guru — membuat isi

- [ ] **B1** **+ Materi Pokok** → isi judul → Simpan → kartunya muncul
      **dan langsung terbuka**
- [ ] **B2** **+ Pertemuan** di dalam bab → dropdown **Jenis** muncul
      paling atas dengan 3 pilihan
- [ ] **B3** Pilih **🧪 Ujian / UH** → Simpan → barisnya **bertepi
      kuning** dengan ikon 🧪
- [ ] **B4** Buat lagi, pilih **🪞 Refleksi Bab** → tepinya **ungu**
- [ ] **B5** Tombol **⇄** pada baris pertemuan → panel pindah muncul,
      berisi daftar bab tujuan
- [ ] **B6** Setelah dipindah, pertemuan itu **ada di bab tujuan** dan
      nomornya menyesuaikan

## C. Guru — menyusun refleksi

**Kelola Item** pada salah satu pertemuan.

- [ ] **C1** Ada tombol **🪞 Refleksi** di baris tombol tambah item
- [ ] **C2** Klik → editor terbuka, **editor konten kaya TERSEMBUNYI**
      (ini disengaja — kolom konten dipakai menyimpan pertanyaan)
- [ ] **C3** Muncul panel **Pertanyaan Refleksi** dengan satu baris
      kosong
- [ ] **C4** **+ Pertanyaan** menambah baris; maksimal berhenti di 6
- [ ] **C5** Tombol **✕** menghapus baris; baris terakhir **tidak bisa
      dihapus** (hanya dikosongkan)
- [ ] **C6** Coba **Simpan & Terbitkan** tanpa mengisi pertanyaan →
      ditolak dengan pesan
- [ ] **C7** Isi 2–3 pertanyaan (satu tanpa centang wajib) → Terbitkan
      → berhasil
- [ ] **C8** Buka lagi item itu → **pertanyaannya masih ada**, centang
      wajib sesuai yang disimpan

## D. Murid — daftar isi & sidebar

Masuk sebagai murid di kelas tersebut.

- [ ] **D1** Daftar isi **terkelompok per bab**, tiap bab punya bilah
      kemajuan sendiri
- [ ] **D2** Bab yang terkunci menampilkan **🔒** dan alasannya
- [ ] **D3** Judul pertemuan di dalam bab terkunci **TIDAK terlihat**
- [ ] **D4** Buka satu pertemuan → sidebar menampilkan **tiga lapis**:
      Materi Pokok → Pertemuan → Item
- [ ] **D5** Klik judul Materi Pokok di sidebar → **melipat**
- [ ] **D6** Nomor di sidebar bertingkat (`Pertemuan 1.2`, `Ujian 1.3`)
- [ ] **D7** Perkecil jendela < 900px → tombol **☰ Daftar Isi** muncul,
      sidebar jadi laci

## E. Murid — mengisi refleksi

- [ ] **E1** Item refleksi tampil dengan ikon **🪞**
- [ ] **E2** Halaman menampilkan pertanyaan; yang wajib bertanda
      **merah \***
- [ ] **E3** Lima tombol skala **1–5**; klik salah satu → **berwarna
      hijau** dan keterangannya berubah
- [ ] **E4** **Simpan Draf** → keluar halaman → masuk lagi → **jawaban
      dan skala masih ada**
- [ ] **E5** **Kirim** tanpa mengisi pertanyaan wajib → ditolak, pesan
      menyebut **nomor** pertanyaannya
- [ ] **E6** Kirim tanpa memilih skala → ditolak
- [ ] **E7** Isi lengkap → Kirim → muncul konfirmasi → setuju
- [ ] **E8** Setelah terkirim: **tidak ada textarea lagi**, jawaban
      tampil terkunci, tidak ada tombol Kirim
- [ ] **E9** **Pertemuan berikutnya langsung terbuka** (tidak menunggu
      guru)
- [ ] **E10** Sidebar ikut memperbarui — item refleksi bertanda ✅

## F. Guru — membaca & membalas

- [ ] **F1** **Kelola Kelas → 🪞 Refleksi** → daftar refleksi kelas
      dengan rata-rata skala
- [ ] **F2** Klik salah satu → rekap terbuka
- [ ] **F3** Ada **grafik batang sebaran 1–5**
- [ ] **F4** Jawaban dikelompokkan **per pertanyaan**, bukan per murid
- [ ] **F5** Tiap jawaban punya **lingkaran skala berwarna** (merah
      untuk 1, hijau untuk 5)
- [ ] **F6** Bila rata-rata < 3 → muncul peringatan **"materi perlu
      diulang"**
- [ ] **F7** Tombol **Balas** → panel muncul → kirim balasan
- [ ] **F8** Baris murid itu berubah jadi **"💬 … · belum dibaca"**

## G. Murid — menerima balasan

- [ ] **G1** Lonceng notifikasi menampilkan angka baru
- [ ] **G2** Buka notifikasi → **klik tautannya** → mendarat di halaman
      refleksi yang benar
- [ ] **G3** Balasan guru tampil dalam **kotak hijau** di atas
- [ ] **G4** Buka ulang → notifikasi sudah **tidak** bertanda belum
      dibaca

## H. Tidak ada yang rusak (regresi)

Yang paling penting — fitur lama harus tetap jalan.

- [ ] **H1** Buka **materi biasa** → baca per bagian → tandai selesai
- [ ] **H2** Kumpulkan **LKPD** → guru menilai → murid melihat nilainya
- [ ] **H3** Kerjakan **Quiz** → nilai keluar
- [ ] **H4** Tombol **Prev/Next** di bawah item masih berpindah dengan
      benar
- [ ] **H5** Beranda guru & murid tampil normal
- [ ] **H6** **Salin ke Kelas Lain** → salinan muncul **di dalam bab**
      kelas tujuan, bukan di kotak kuning
- [ ] **H7** **Duplikat kelas** dengan isi → kelas baru punya **jumlah
      bab yang sama** dengan aslinya

---

## Bila ada yang gagal

Kirimkan ke saya:

1. **Kode ceklisnya** (mis. `E8`, `F4`)
2. Apa yang **terjadi** vs apa yang **diharapkan**
3. Bila ada pesan error di layar, salin teksnya
4. Bila layarnya kosong/aneh: buka **Konsol Peramban**
   (`F12` → tab Console) dan salin baris merahnya — itu paling
   menentukan untuk bug UI

Tangkapan layar sangat membantu untuk masalah tata letak.
