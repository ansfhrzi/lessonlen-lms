# Tahap 7 — Generator AI + Rotasi 10 API Key

Versi aplikasi **0.9.0**. Acuan: `docs/KESEPAKATAN-SISTEM.md` §8, §10.

---

## Berkas

| Berkas | Status | Isi |
|---|---|---|
| `Ai.gs` | **baru** | 817 baris — rotasi key, 3 generator, riwayat |
| `Code.gs` | diubah | +8 fungsi API, versi 0.9.0 |
| `js_editor.html` | diubah | tombol ✨ Generate, panel API key |
| `v_editor.html` | diubah | panel generator di editor materi |
| `js_beranda.html` | diubah | pintasan 🔑 Status API Key |
| `Pertemuan.gs` | **diperbaiki** | bug guard AI (lihat bawah) |

Tidak ada perubahan skema — sheet `materi_ai` sudah ada sejak Tahap 1.
**`migrasiStruktur()` tidak perlu dijalankan.**

---

## Tiga generator

| Fungsi | Guna | Keluaran |
|---|---|---|
| `generateMateri()` | susun materi satu item (§8.2 Cara A) | HTML sudah terpisah `<!--bagian-->`, deskripsi, saran soal & LKPD |
| `generateSoal()` | isi bank soal quiz (§9.9) | larik soal siap `Quiz.simpanSoalTerpilih()` |
| `generateKerangka()` | susun daftar pertemuan (§8.2 Cara B) | usulan judul + tujuan + saran item |

`terapkanKerangka()` mewujudkan usulan jadi pertemuan + item — **semuanya
berstatus draf**.

### Konteks yang dikirim ke AI

Prompt menyertakan jenjang, fase, tingkat, mapel, kompetensi keahlian,
capaian pembelajaran kelas, catatan gaya, judul pertemuan, tujuan
pembelajaran, serta **judul materi sebelum & sesudah** agar AI
menyambung dan tidak mendahului.

---

## Model yang dipakai

Dicoba berurutan; yang gagal karena kuota otomatis dilewati:

```
gemini-3.6-flash → gemini-3.5-flash → gemini-3.5-flash-lite
→ gemini-2.5-flash-lite → gemini-2.5-flash → gemini-2.0-flash
```

Kuota gratis dihitung per **(project × model)**, jadi merotasi model
melipatgandakan kapasitas tanpa menambah key. Model yang dijawab 404
dibuang 24 jam, dan model yang menolak `responseSchema` otomatis
dikirim ulang secara polos.

Guru dapat mengunci satu model lewat `simpanModelAI()`.

### Mematikan mode berpikir

Gemini 2.5+ menyalakan *thinking* secara bawaan, dan token berpikir
memotong `maxOutputTokens` yang sama — jawaban jadi terpotong dan
lambat. Bentuk parameternya berbeda per seri:

| Seri | Parameter | Nilai |
|---|---|---|
| 3.x | `thinkingLevel` | `"low"` (huruf kecil) |
| 2.5 | `thinkingBudget` | `0` |

Keduanya **tidak boleh dikirim bersamaan**. Sistem menebak dari nama
model, mengoreksi diri bila ditolak server, lalu mengingatnya 24 jam.

**Terukur:** tes koneksi `{"pesan":"halo"}` turun dari **27,9 detik**
(thinking menyala) menjadi **1,4 detik** setelah `thinkingLevel: "low"`
diterima. Bila suatu saat kembali > 10 detik, `tesKoneksiAI()` akan
memperingatkan.

## Rotasi 10 key (§10.3)

```
untuk percobaan 1..jumlah_key:
    cursor = (cursor + 1) mod jumlah_key     ← selalu maju
    bila key cooldown → lewati
    panggil Gemini
      200      → sukses
      429      → cooldown 60 detik, key berikutnya
      400/403  → cooldown 24 jam, tandai bermasalah
      500/503  → jeda 2 detik, key berikutnya
      jaringan → key berikutnya
semua gagal → SEMUA_KEY_HABIS
```

- **Round-robin, bukan acak** — beban merata & mudah ditelusuri
- Cursor tetap maju walau key dilewati
- Maksimal **satu putaran** per permintaan
- Berhenti bila akumulasi > 90 detik (batas GAS 6 menit)
- Cooldown di `CacheService`, kedaluwarsa otomatis
- Lebih dari 5 key bermasalah → notifikasi in-app ke guru

---

## Keamanan key (§10.1b)

Key **tidak pernah** masuk kode, sheet, log, atau browser.

| Tempat | Yang tersimpan |
|---|---|
| Script Properties | `GEMINI_KEYS` (JSON array) — satu-satunya tempat |
| Panel guru | 4 digit terakhir saja: `••••••••a1b2` |
| `materi_ai.key_index` | nomor urut key, bukan nilainya |
| Log | `key#3` |

Diuji harfiah: `run21-ai.js` memasang key bertanda `AIzaKEYRAHASIA…`
lalu memastikan string itu **tidak muncul** di `statusKeys()`, respons
API, riwayat, maupun sheet `materi_ai`.

### Cara memasang

**Lewat aplikasi:** Beranda → 🔑 Status API Key → Pasang API Key,
tempel satu key per baris.

**Lewat editor:** buka `pasangApiKeysManual()` di `Code.gs`, tempel key
di larik `KEYS`, jalankan, lalu **kosongkan kembali** dan simpan.

---

## AI selalu draf (§8.1)

Tidak ada jalur otomatis dari AI ke murid:

1. Hasil generate masuk **editor**, bukan langsung tersimpan
2. Item ditandai `sumber_ai = TRUE`
3. Publish **ditolak backend** sebelum `ai_ditinjau = TRUE`
4. Kerangka menghasilkan pertemuan & item berstatus **draf**

Isi editor yang sudah ada tidak pernah ditimpa diam-diam — guru diminta
konfirmasi dulu.

---

## Bug yang ditemukan saat Tahap 7

**`sumber_ai` diabaikan saat menyunting item** — bug sejak Tahap 4.

`Pertemuan.simpanItem()` hanya menyimpan `sumber_ai` ketika item
**dibuat**, tidak ketika disunting. Padahal alur generator justru:
item dibuat kosong dahulu → diisi hasil AI lewat **edit**.

Akibatnya penanda tidak pernah tersimpan, guard "AI wajib ditinjau"
tidak pernah aktif, dan **materi AI bisa langsung diterbitkan ke murid
tanpa ditinjau** — persis yang dilarang §8.1.

Tidak terdeteksi selama tiga tahap karena belum ada yang memakai jalur
itu. Diperbaiki dengan satu baris, dan dikunci uji §25.

---

## Uji

`test/run21-ai.js` — **85 poin, 25 kelompok**. `UrlFetchApp` ditiru
sehingga setiap cabang rotasi teruji tanpa memanggil Gemini sungguhan:

- 200 · 429 · 403 · 503 · jaringan putus · balasan tak terbaca
- round-robin maju berurutan, key cooldown dilewati
- semua key gagal → **tepat satu putaran** (10 panggilan, bukan lebih)
- key tidak bocor ke mana pun
- prompt memuat konteks yang benar
- hasil AI disanitasi (`<script>`, `onclick` dibuang)
- soal AI lolos validasi `Quiz.simpanSoalTerpilih()`
- kerangka menghasilkan semua draf, penomoran melanjutkan yang ada
- guard publish materi AI

```bash
node test/run21-ai.js         # 85 lolos — logika rotasi (UrlFetchApp tiruan)
node test/run22-ai-editor.js  # jalur gagal fungsi diagnostik
```

### Di Apps Script — memanggil Gemini sungguhan

Uji Node memakai `UrlFetchApp` tiruan, jadi **tidak** membuktikan key
Anda sah atau Generative Language API sudah aktif. Untuk itu:

```
tesKoneksiAI()   1 panggilan, tanpa menyentuh data — jalankan
                 segera setelah memasang key
ujiTahap7()      siklus penuh, 14 pemeriksaan, 20-60 detik
cekKesehatan()   memeriksa Ai.gs termuat & status key
```

Penyebab kegagalan tersering pada pemasangan pertama: key sudah benar
tetapi **Generative Language API belum diaktifkan** di project key
tersebut. Pesan `tesKoneksiAI()` menyebutkan hal ini.

---

## Catatan biaya & kuota

| Ukuran | Angka |
|---|---|
| Kuota 10 key (10 project, 10 akun) | ±15.000 permintaan/hari |
| Kebutuhan puncak (180 materi + 180 set soal) | ±400 panggilan |
| `UrlFetchApp` per hari | 20.000 (hanya dipakai Gemini) |
| Durasi wajar satu generate | 15–45 detik |
| Tes koneksi (terukur) | **1,4 detik** pada `gemini-3.6-flash` |

Sangat longgar. Yang perlu diperhatikan bukan kuota harian melainkan
**batas 6 menit per eksekusi Apps Script** — karena itu ada pemutus
90 detik.

---

## Yang belum dibuat

Antarmuka **Susun Kerangka** (Cara B) baru tersedia sebagai API
(`generateKerangkaAI` + `terapkanKerangkaAI`); tombolnya di halaman
kelas belum dipasang. Backend-nya sudah teruji penuh.
