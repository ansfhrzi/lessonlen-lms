# Tahap 2 — Data, Autentikasi, Login

Acuan: `KESEPAKATAN-SISTEM.md` v4.5 · `KONVENSI-TEKNIS.md` v1.0

---

## Berkas Baru

| Berkas | Isi |
|---|---|
| `Db.gs` | Akses Sheets + cache + LockService |
| `Util.gs` | ID, hash, sanitasi HTML, acak berbenih, log |
| `Auth.gs` | Login, sesi, ganti & reset kata sandi |
| `Code.gs` | `doGet`, `include`, pembungkus `_bungkus()`, 10 fungsi API |
| `index.html` | Shell SPA |
| `css.html` | Seluruh gaya, palet hijau resmi |
| `js_core.html` | `State`, `callApi`, router, toast, dialog |
| `js_auth.html` | Layar login, ganti sandi, beranda, antrean reset |
| `v_login.html` · `v_ganti_password.html` · `v_dashboard.html` | Template layar |

---

## Cara Memasang

### 1. Salin berkas ke project Apps Script

Di editor, buat berkas sesuai daftar di atas. **Perhatikan jenisnya:**

- Berakhiran `.gs` → **Script**
- Berakhiran `.html` → **HTML**

> Nama berkas di editor **tanpa ekstensi**: tulis `Db`, bukan `Db.gs`.
> Untuk HTML tulis `index`, `css`, `js_core`, `js_auth`, `v_login`,
> `v_ganti_password`, `v_dashboard`.

### 2. Atur manifest

**Project Settings** → centang **Show `appsscript.json`**, lalu isi:

```json
{
  "timeZone": "Asia/Jakarta",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_ANONYMOUS"
  },
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/script.scriptapp"
  ]
}
```

### 3. Uji dari editor

Jalankan **`ujiTahap2`** → **View → Logs**. Harus muncul:

```
1. DB_ID  : 1AbC…
2. users  : 4 baris
3. login guru/guru123 : BERHASIL
4. cekSesi : Guru PKPJ (guru)
5. ringkasan : {...}
6. password salah ditolak : YA
7. notifikasi : 0 item
8. logout & sesi mati : YA
```

### 4. Deploy

**Deploy → New deployment → Web app**

| Kolom | Isi |
|---|---|
| Execute as | **Me** |
| Who has access | **Anyone** |

Salin **Web app URL**, buka di browser.

### 5. Masuk

| Peran | Pengguna | Sandi |
|---|---|---|
| Guru | `guru` | `guru123` |
| Murid | `siswa01` | `siswa123` |

---

## Yang Sudah Berjalan

**Login**
- Sesi 12 jam, token di `localStorage`
- 5× gagal dalam 15 menit → terkunci
- Pesan gagal seragam — tidak membocorkan username mana yang ada
- Sisa percobaan ditampilkan mulai kegagalan ke-3

**Ganti kata sandi**
- Wajib bila akun baru direset — seluruh halaman lain diblokir
- Minimal 6 karakter, harus memuat huruf dan angka
- Ganti kata sandi → salt baru dibuat ulang

**Lupa kata sandi**
- Murid mengajukan dari halaman login
- Respons selalu sama apa pun hasilnya
- Batas 3 permintaan per akun per 24 jam
- Guru melihat antrean, klik Reset → kata sandi sementara tampil sekali
- Seluruh sesi murid tersebut langsung diakhiri

**Beranda**
- Guru: jumlah kelas, murid, permintaan reset
- Murid: jumlah kelas, notifikasi
- Lonceng 🔔 dengan penghitung belum dibaca

**Darurat**
- `resetGuruDarurat()` dari editor bila akun guru terkunci

---

## Hasil Uji Otomatis

```
node test/run2.js     →  LOLOS: 63   GAGAL: 0
```

Cakupan:

| Kelompok | Poin |
|---|---|
| `Db.gs` | baca, cari, saring, tambah, perbarui, hapus, kunci |
| `Util.gs` | ID, hash, sanitasi, acak berbenih, validasi |
| Login | password salah, user tak ada, anti-enumerasi, kunci 5× |
| Kebocoran | `password_hash` & `salt` tidak ikut terkirim |
| Otorisasi | murid ditolak saat mengakses fitur guru |
| Reset | antrean, kata sandi sementara, flag wajib ganti |
| Sesi | logout mematikan sesi |

**Uji keamanan yang lolos:**

- Hash & salt tidak pernah masuk respons API
- Pesan "user tidak ada" identik dengan "password salah"
- Sanitasi membuang `<script>`, `onclick`, iframe asing
- Sanitasi mempertahankan `<!--bagian-->` dan `$$…$$` MathJax
- Token palsu ditolak
- Murid tidak dapat memanggil fungsi guru

---

## Bila Bermasalah

| Gejala | Penyebab |
|---|---|
| Halaman kosong | Berkas HTML dibuat sebagai Script. Hapus, buat ulang sebagai HTML |
| `Template tidak ada: tpl-login` | `v_login` belum dibuat atau salah nama |
| `DB_ID belum diset` | Jalankan `setupDatabase()` dari Tahap 1 |
| Login selalu gagal | Seed belum diisi — jalankan `isiSeedData()` |
| Terkunci saat uji coba | Tunggu 15 menit, atau jalankan `resetGuruDarurat()` |
| Perubahan tidak muncul | Deploy → **Manage deployments** → edit → **New version** |

---

## Berikutnya — Tahap 3

Kerangka SPA penuh, dashboard guru & murid, notifikasi in-app, MathJax.
