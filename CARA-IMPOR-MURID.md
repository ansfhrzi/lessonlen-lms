# Impor Murid & Label Rombel (v1.6.4)

---

## Dua hal yang berbeda

| | **Rombel** | **Kelas-Mapel** |
|---|---|---|
| Contoh | `XII TKJ 1` | `XII TKJ 1 · PKPJ` |
| Apa | label pada **murid** | tempat murid **belajar** |
| Gunanya | menyaring daftar murid | pertemuan, LKPD, quiz, nilai |
| Diisi saat | impor / edit murid | Daftarkan Murid |

Rombel **tidak** mendaftarkan murid ke mana pun. Ia hanya penanda,
supaya satu rombongan bisa Anda pilih sekaligus.

> Rombel `XII TKJ 1` yang mengambil 3 mapel = **3 kelas-mapel**
> terpisah di LessonLen. Karena itu dropdown kini selalu menyebut
> mapelnya: `XII TKJ 1 · PKPJ`.

---

## Alur yang disarankan

**Sekali di awal semester:**

1. **Kelola Murid → ⬆ Impor** — tempel seluruh murid berikut rombelnya
2. Untuk tiap mapel: **Kelola Kelas → pilih kelas → + Daftarkan**
3. Saring rombelnya, **Pilih semua**, **Daftarkan**

Langkah 3 diulang per kelas-mapel — tapi hanya butuh tiga klik karena
rombelnya sudah tersaring.

---

## Format impor

```
nama, kelas, username, password
```

Hanya **nama** yang wajib.

```
Budi Santoso, XII TKJ 1, budi01, budi123
Citra Dewi, XII TKJ 1
Eko Prasetyo
```

| Baris | Hasil |
|---|---|
| Budi | rombel + username + sandi persis seperti Anda tulis |
| Citra | rombel terisi; username `citrad` & sandi acak dibuat sistem |
| Eko | nama saja; tanpa rombel |

**Pemisah** boleh koma, titik koma, atau TAB — jadi bisa disalin
langsung dari spreadsheet. Nomor urut di awal baris (`1.`, `2)`)
dibuang otomatis.

---

## Tentang password

**Dikosongkan** → sandi acak, murid **wajib menggantinya** saat login
pertama.

**Anda isi** → dipakai apa adanya, murid **tidak** diminta mengganti.

Syaratnya sama seperti sandi biasa:

- minimal **6 karakter**
- memuat **huruf dan angka**

Jadi `budi123` boleh; `budi` dan `123456` ditolak.

> Baris yang sandinya tidak memenuhi **ditolak beserta alasannya** —
> tidak diam-diam diganti sandi acak. Kalau diganti tanpa
> pemberitahuan, murid tidak akan bisa masuk dengan sandi yang sudah
> Anda bagikan.

**Yang perlu Anda sadari:** dengan menentukan sandi sendiri, Anda
memegang sandi murid dan murid tidak punya rahasia pribadi. Untuk
kelas sendiri ini wajar — tapi sandi awalnya memang tersimpan di
sheet `users` kolom `pwd_awal`.

---

## Selalu klik **Periksa** dulu

Tombol **Periksa** menampilkan rencana impor sebelum apa pun ditulis:
nama, **rombel**, nama pengguna, dan asal sandi.

Perhatikan kolom **Rombel**. Bila di situ malah muncul nama pengguna
(mis. `xiitkj2`), berarti urutan kolomnya belum sesuai — perbaiki
sebelum menekan Impor.

Sandi yang tidak memenuhi syarat juga dilaporkan di layar ini, jadi
Anda tidak perlu menunggu impor gagal separuh jalan.

---

## Format lama tetap jalan

```
Kiki Lama;kikil          → username (tidak berspasi)
Nanda Lama, XII TKJ 3    → rombel  (berspasi)
```

Kolom kedua dibedakan dari **ada tidaknya spasi**: username tidak
pernah berspasi, nama rombel hampir selalu.

Kalau ragu, tulis lengkap empat kolom.

---

## Label rombel dirapikan otomatis

`xii  tkj  1` · `XII TKJ 1` · `  xii tkj 1  ` → semuanya menjadi
**`XII TKJ 1`**.

Spasi dirapatkan, huruf dibesarkan. Tanpa ini satu salah ketik akan
memecah filter jadi dua rombel berbeda.

Saat mengetik rombel di form murid, LessonLen menawarkan rombel yang
sudah pernah Anda pakai — pilih dari situ agar seragam.

---

## Menyaring

**Kelola Murid** punya tiga penyaring yang bisa digabung:

- kotak cari — nama, username, **atau** rombel
- **Semua kelas-mapel** — murid pada satu kelas-mapel
- **Semua rombel** — murid pada satu rombel

**Panel Daftarkan Murid** juga punya penyaring rombel. Inilah yang
membuat mendaftarkan satu rombongan jadi cepat.

---

## Setelah menyalin berkas

Kolom `rombel` **baru** pada sheet `users`, jadi:

1. Salin: `Setup.gs` · `Kelas.gs` · `js_core.html` · `js_kelola.html` · `Code.gs`
2. **Jalankan `migrasiStruktur()`** ← wajib
3. Deploy → Manage deployments → ✏️ → New version
4. Jalankan **`cekBerkasUI()`** untuk memastikan semuanya tersalin

Murid lama akan berlabel rombel **kosong**. Isi lewat **Kelola Murid →
✏️** satu per satu, atau biarkan saja bila tidak diperlukan.
