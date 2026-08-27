# Tampilan tidak berubah setelah menyalin kode?

Panduan ini lahir dari laporan nyata: *"kok masih tetap tidak ada yang
berubah seperti di pratinjau"* — padahal berkas sudah disalin dan
sudah Deploy.

Kerjakan berurutan. **Berhenti** begitu ketemu sebabnya.

---

## Langkah 1 — Jalankan `cekBerkasUI()`  ⏱ 5 detik

Dari editor Apps Script, pilih fungsi **`cekBerkasUI`** lalu **Run**.

Fungsi ini membaca isi berkas HTML/CSS Anda yang **sesungguhnya** dan
mencari penanda khas tiap rilis.

> **Kenapa `cekKesehatan()` tidak cukup?**
> Ia hanya memeriksa berkas `.gs` (`typeof Util`, `typeof Rekap`).
> Tidak ada cara memeriksa CSS dengan cara itu — jadi guru yang lupa
> menyalin `css.html` tetap dilapori **"sehat"**.

### Hasilnya ❌ menyebut berkas tertentu

Berkas itu **belum tersalin**. Salin ulang dari `src/`, lalu ulangi
dari Langkah 1. Log-nya menyebutkan persis apa yang rusak, misalnya:

```
📄 css.html — masih versi lama (perlu v1.6.0 atau lebih baru)
     • v1.6.0: tombol hapus tampil HIJAU seperti tombol biasa
```

### Hasilnya ✅ "SELURUH BERKAS UI SUDAH VERSI TERBARU"

Kodenya benar. Sebabnya ada di **penerapan** — lanjut ke Langkah 2.

---

## Langkah 2 — Anda membuka URL yang mana?  ⏱ 10 detik

Ini penyebab paling sering setelah kode benar.

| URL | Isinya |
|---|---|
| `…/exec` | versi **deployment** — hanya berubah setelah *New version* |
| `…/dev` | kode **terbaru** — langsung berubah tiap simpan |

Apps Script punya **dua** alamat. Bila Anda membuka `/exec` tetapi
belum membuat versi baru, yang tampil adalah kode **lama** — meskipun
editor sudah berisi kode baru.

**Cara memastikan:** buka URL `…/dev`. Kalau di situ tampilannya
**sudah benar**, berarti kodenya beres dan yang kurang hanya
deployment — lanjut Langkah 3.

---

## Langkah 3 — Deploy versi BARU, bukan sekadar simpan  ⏱ 30 detik

**Deploy → Manage deployments → ✏️ (edit) → Version: New version →
Deploy**

Kesalahan yang sering terjadi:

- ❌ menekan **Deploy → New deployment** → membuat URL **baru**, URL
  lama Anda tetap versi lama
- ❌ hanya **Ctrl+S** → menyimpan kode, tidak mengubah `/exec`
- ✅ **Manage deployments → ✏️ → New version** → URL tetap, isi
  diperbarui

> Setelah ini URL `/exec` Anda tidak berubah — yang berubah versinya.

---

## Langkah 4 — Cache peramban  ⏱ 5 detik

Apps Script menyajikan HTML lewat iframe yang **agresif di-cache**.

- **Windows:** `Ctrl` + `Shift` + `R`
- **Mac:** `Cmd` + `Shift` + `R`
- **Ponsel:** tutup tab sepenuhnya, buka lagi

Bila masih sama, buka di **jendela Penyamaran/Incognito**. Kalau di
sana benar, berarti murni cache — bersihkan cache peramban biasa.

---

## Langkah 5 — Tab lama yang belum dimuat ulang

Aplikasi ini SPA: sekali dimuat, ia tidak mengambil ulang CSS. Tab
yang sudah terbuka **sejak sebelum** Deploy akan tetap memakai gaya
lama meski Anda berpindah halaman di dalamnya.

Tutup semua tab LessonLen, lalu buka baru.

---

## Masih belum berubah?

Kirimkan ke saya:

1. **Seluruh log `cekBerkasUI()`** — ini yang paling menentukan
2. URL yang Anda buka, cukup bagian akhirnya: `/exec` atau `/dev`
3. Tangkapan layar bagian yang menurut Anda belum berubah

---

## Lampiran A: halaman bisa digeser ke samping di ponsel?

Jalankan di **Console** peramban (F12 → Console) saat aplikasi
terbuka:

```js
document.documentElement.scrollWidth - document.documentElement.clientWidth
```

- `0` → lebar halaman pas ✅
- lebih dari 0 → ada yang meluber sebanyak itu (piksel)

Untuk menemukan **elemen mana** yang meluber:

```js
[...document.querySelectorAll('body *')]
  .filter(e => e.getBoundingClientRect().right >
               document.documentElement.clientWidth + 1)
  .slice(0, 5)
  .map(e => e.tagName + '.' + e.className)
```

Atau buka **`pratinjau-lebar.html`** di HP — ia mengukur sendiri dan
menyebut nama elemennya.

---

## Lampiran B: memastikan CSS benar-benar termuat

Dari peramban, buka aplikasinya lalu tekan **F12 → Console**, tempel:

```js
getComputedStyle(document.querySelector('.btn')).minHeight
```

- `"44px"` → `css.html` termuat ✅
- `"0px"` atau kosong → CSS tidak termuat sama sekali; periksa apakah
  berkasnya bernama tepat **`css`** (bukan `css.html` atau `style`)

Untuk memastikan v1.6.0 khususnya:

```js
getComputedStyle(document.querySelector('.baris-antara')).flexWrap
```

- `"wrap"` → v1.6.0 sudah masuk ✅
- `"nowrap"` → `css.html` masih versi lama
