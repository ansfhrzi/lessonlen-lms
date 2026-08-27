# Tahap 6B — Quiz Internal

Versi aplikasi **0.7.0**. Acuan: `docs/KESEPAKATAN-SISTEM.md` §9.

Seluruh siklus quiz berjalan di dalam LessonLen — bank soal, pengerjaan,
penilaian otomatis, koreksi manual. Tanpa aplikasi eksternal.

---

## Berkas

| Berkas | Status | Isi |
|---|---|---|
| `Quiz.gs` | **baru** | 1.660 baris — bank soal, pengerjaan, koreksi |
| `js_quiz.html` | **baru** | 1.113 baris — 4 rute UI |
| `Code.gs` | diubah | +18 fungsi API, versi 0.7.0 |
| `css.html` | diubah | gaya quiz (jam, peta soal, opsi, hasil) |
| `index.html` | diubah | `include('js_quiz')` |
| `js_belajar.html` | diubah | murid klik item quiz → `#/quiz/{id}` |
| `js_editor.html` | diubah | tombol **🎯 Soal** & **📊 Penilaian** |
| `js_beranda.html` | diperbaiki | tautan antrean koreksi (bug, lihat bawah) |

Tidak ada perubahan skema — `soal` dan `quiz_attempt` sudah disiapkan
sejak Tahap 1. **`migrasiStruktur()` tidak perlu dijalankan.**

---

## Rute baru

| Rute | Peran | Fungsi |
|---|---|---|
| `#/quiz/{itemId}` | murid | layar pembuka → pengerjaan → hasil |
| `#/soal/{itemId}` | guru | bank soal (tambah, sunting, urut, impor) |
| `#/koreksi-quiz` | guru | antrean koreksi uraian |
| `#/nilai-quiz/{itemId}` | guru | penilaian per-Quiz seluruh murid |

---

## Empat tipe soal

| Tipe | Penilaian | Catatan |
|---|---|---|
| `pg` | otomatis | 2–5 opsi (A–E); kunci disimpan sebagai **huruf** |
| `benar_salah` | otomatis | opsi tetap Benar/Salah |
| `isian` | otomatis | abaikan besar-kecil & spasi; alternatif dipisah `\|` |
| `esai` | **manual** | attempt → `menunggu_koreksi` |

Kunci PG disimpan sebagai huruf, bukan teks, agar tetap sahih saat guru
menyunting teks opsi. Saat memeriksa, huruf diterjemahkan ke teks opsi
lalu dibandingkan dengan jawaban murid — inilah yang membuat penilaian
tetap benar meski **opsi diacak** per murid.

---

## Keamanan (§9.8) — semuanya diuji

| Risiko | Penangkal | Uji |
|---|---|---|
| Melihat kunci lewat DevTools | kunci & pembahasan **tidak pernah** masuk payload pengerjaan | §5 |
| Mengubah nilai dari frontend | nilai dihitung ulang di server; kiriman klien diabaikan | §9, §11 |
| Melewati batas waktu | `mulai_at + batas_waktu_menit` dihitung server | §19 |
| Menambah percobaan | dihitung dari baris `quiz_attempt` | §14 |
| Membuka quiz terkunci | `Belajar.detailPertemuan()` dipanggil ulang | §24 |
| Membuka attempt murid lain | `attempt.user_id` dicocokkan sesi | §6 |
| Murid mengakses API guru | `_bungkus(token,'guru',…)` | §26 |

Uji §5 memeriksa payload secara harfiah: `JSON.stringify(attempt)` tidak
boleh memuat `"kunci"`, `"pembahasan"`, maupun teks kunci itu sendiri.

---

## Alur nilai

```
nilai = (Σ bobot benar / Σ bobot) × 100
lulus = nilai >= item.kkm
```

- Soal esai dihitung **0 sementara** sampai guru menilai
- Ada esai → attempt `menunggu_koreksi`, `nilai` dikosongkan
- Yang dipakai untuk unlock = **nilai tertinggi** seluruh percobaan
- Percobaan yang nilainya lebih rendah **tidak merusak** capaian sebelumnya

`resetPercobaanQuiz()` menandai attempt lama `kedaluwarsa` — riwayat tetap
tersimpan, tetapi tidak lagi menghitung kuota.

---

## Bug yang ditemukan saat Tahap 6B

**1. `bersihkanAttemptBasi()` memakai `Db.bacaKolom()`**
`bacaKolom` tidak mengembalikan `_baris`, sedangkan `perbaruiBanyak()`
membutuhkannya → `TypeError`. Diganti `Db.saringBaris()`, sekaligus lebih
hemat karena hanya membaca baris berstatus `berjalan`.

**2. Tautan `#/guru/quiz` di panel Perlu Tindakan**
Rute itu tidak pernah ada — guru mengeklik "Quiz menunggu koreksi" dan
mendapat halaman kosong. Backend sudah mengirim `quiz_menunggu` sejak
Tahap 3, tetapi tautannya salah sejak awal. Diperbaiki ke `#/koreksi-quiz`.

Ini **kelas bug yang sama** dengan 6 tautan notifikasi rusak di Tahap 6A.
Karena berulang, sekarang dicegah otomatis — lihat bawah.

---

## Audit statis baru di `run10-integrasi.js`

Empat pemeriksaan yang membaca berkas sumber secara langsung:

```
✓ setiap #/tautan punya daftarRute        ← menangkap bug #2
✓ larik RUTE uji sudah lengkap
✓ setiap callApi punya fungsi di Code.gs  ← menangkap getDaftarQuizLain
✓ tidak ada google.script.run langsung
```

Audit ini **diverifikasi bisa gagal**: bug `#/guru/quiz` disisipkan ulang,
uji berubah merah, lalu dipulihkan. Uji yang tidak pernah bisa merah
tidak menjaga apa pun.

> Menambah rute baru kini cukup memperbarui larik `RUTE`; bila lupa,
> uji langsung memberi tahu.

---

## Performa (data skala penuh: 432 murid, 1.800 soal, 3.024 attempt)

**36 murid satu kelas mengerjakan quiz 10 soal serentak:**

| Ukuran | Hasil |
|---|---|
| Total | 2.679.010 sel · 1.065 ms |
| Rata per murid | **74.417 sel** |
| Autosave (cache hangat) | **975 sel** |
| Autosave setelah murid lain menulis | **975 sel** (isolasi terjaga) |

**Guru:**

| Operasi | Sel |
|---|---|
| `antreanKoreksi()` 336 menunggu | 34.779 |
| `daftarKelasQuiz()` | 9.770 |
| `detailAttempt()` | 6.402 |
| `getSoalGuru()` | 2.854 |

### Dua optimasi yang diterapkan sejak awal

**Cache nomor baris attempt.** Autosave dipanggil 10× per quiz — paling
sering di seluruh sistem. Tanpa cache, tiap panggilan memindai seluruh
kolom `attempt_id`. `bacaBarisJika()` memverifikasi ulang isi baris, jadi
pergeseran akibat penghapusan tetap aman. **4.000 → 975 sel.**

**Jangan menulis progres bila tidak berubah.** `mulaiQuiz()` dipanggil
setiap murid membuka halaman pengerjaan; menulis `progress` setiap kali
akan membatalkan cache murid itu tanpa alasan. Sekarang penulisan
dilewati bila status, nilai, dan percobaan semuanya sama.

Alur murid mengerjakan 10 soal: **133.648 → 70.893 sel (−47%)**.

---

## Uji

`test/run11-quiz.js` — **161 poin, 27 kelompok**, mencakup validasi soal,
sanitasi HTML, kebocoran kunci, otorisasi, penilaian tiap tipe, acak
berbenih, batas waktu, kedaluwarsa, batas percobaan, nilai tertinggi,
reset, impor, dan soal dihapus di tengah jalan.

`test/perf9-quiz-serentak.js` — beban 36 murid serentak + isolasi cache
+ kebenaran data setelah beban.

```bash
node test/run11-quiz.js            # 161 lolos
node test/perf9-quiz-serentak.js   # BUG: 0
```

---

## Yang belum dibuat

`generateSoalAI()` sengaja ditunda ke **Tahap 7** bersama rotasi 10 key
Gemini. `simpanSoalTerpilih()` sudah siap menerima hasilnya — tinggal
menyambungkan sumber soalnya.
