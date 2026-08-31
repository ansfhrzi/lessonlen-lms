/* ============================================================
   LessonLen — uji pramuat materi (v1.19.0)

   Dijalankan dengan Node:   node uji/materi.js

   Menjalankan `Belajar.gs` ASLI di atas mock Db. Yang diuji:

     A. pramuatMateriPokok() — isi, pemecahan bagian, penyaringan
     B. status kunci ikut terkirim dan benar
     C. 🔴 penjaga kunci di jalur TULIS (tandaiBagianSelesai) —
        celah yang ditutup v1.19.0
     D. urutan bagian tetap ditolak bila melompat (regresi v1.16.1)
     E. klien: materiAmbil() tidak melayani item terkunci
   ============================================================ */
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');

let lolos = 0, gagal = 0;
function cek(nama, sah, rinci) {
  if (sah) { lolos++; console.log('  \u2705 ' + nama); }
  else { gagal++; console.log('  \u274c ' + nama + (rinci ? '  \u2192 ' + rinci : '')); }
}
function judul(t) { console.log('\n=== ' + t + ' ==='); }

/* ---------------------------------------------- data uji */
const BAG = '<!--bagian-->';
function data() {
  return {
    kelas: [
      { kelas_id: 'KLS-1', nama_kelas: '7A', tahun_ajaran: '2026/2027',
        aktif: true, status: 'aktif' }
    ],
    users: [
      { user_id: 'U-1', role: 'murid', status: 'aktif', nama: 'Andi' }
    ],
    enrollment: [
      { enroll_id: 'E-1', kelas_id: 'KLS-1', user_id: 'U-1', status: 'aktif' }
    ],
    materi_pokok: [
      { mp_id: 'MP-1', kelas_id: 'KLS-1', urutan: 1, judul: 'Bab Satu',
        wajib: true, urut_ketat: true, status: 'publish' },
      { mp_id: 'MP-DRAF', kelas_id: 'KLS-1', urutan: 2, judul: 'Draf',
        wajib: true, urut_ketat: true, status: 'draft' }
    ],
    pertemuan: [
      { pertemuan_id: 'P-1', mp_id: 'MP-1', kelas_id: 'KLS-1', urutan: 1,
        judul: 'Pertemuan 1', jenis: 'biasa', wajib: true,
        urut_ketat: true, status: 'publish' },
      { pertemuan_id: 'P-2', mp_id: 'MP-1', kelas_id: 'KLS-1', urutan: 2,
        judul: 'Pertemuan 2', jenis: 'biasa', wajib: true,
        urut_ketat: true, status: 'publish' }
    ],
    item: [
      /* materi wajib, 3 bagian — terbuka (pertemuan pertama) */
      { item_id: 'I-1', pertemuan_id: 'P-1', mp_id: 'MP-1', kelas_id: 'KLS-1',
        tipe: 'materi', urutan: 1, judul: 'Materi A', wajib: true,
        min_durasi_detik: 0, status: 'publish',
        konten: 'satu' + BAG + 'dua' + BAG + 'tiga' },
      /* quiz — harus TERSARING */
      { item_id: 'I-Q', pertemuan_id: 'P-1', mp_id: 'MP-1', kelas_id: 'KLS-1',
        tipe: 'quiz', urutan: 2, judul: 'Kuis', wajib: false,
        status: 'publish', konten: '' },
      /* materi draf — harus TERSARING */
      { item_id: 'I-D', pertemuan_id: 'P-1', mp_id: 'MP-1', kelas_id: 'KLS-1',
        tipe: 'materi', urutan: 3, judul: 'Draf', wajib: false,
        status: 'draft', konten: 'jangan terkirim' },
      /* materi di pertemuan 2 — TERKUNCI selama P-1 belum tuntas */
      { item_id: 'I-2', pertemuan_id: 'P-2', mp_id: 'MP-1', kelas_id: 'KLS-1',
        tipe: 'materi', urutan: 1, judul: 'Materi B', wajib: true,
        min_durasi_detik: 0, status: 'publish',
        konten: 'rahasia minggu depan' }
    ],
    progress: []
  };
}

/* ---------------------------------------------- mock Db */
function mockDb(sheet) {
  const cari = (nama, pred) => {
    const arr = sheet[nama] || [];
    for (let i = 0; i < arr.length; i++) if (pred(arr[i])) return Object.assign({ _baris: i + 2 }, arr[i]);
    return null;
  };
  const proyeksi = (r, kolom) => {
    const o = { _baris: r._baris };
    kolom.forEach(k => { o[k] = r[k] === undefined ? '' : r[k]; });
    return o;
  };
  const semua = (nama, kolom) => (sheet[nama] || [])
    .map((r, i) => proyeksi(Object.assign({ _baris: i + 2 }, r), kolom));

  return {
    bacaKolom: (nama, kolom) => semua(nama, kolom),
    /* Menyaring pada baris MENTAH lalu memproyeksikan — seperti
       Db.gs:341. Versi pertama mock ini memproyeksikan lebih dulu,
       sehingga kolom kunci hilang dan hasilnya selalu kosong. */
    saringBaris: (nama, kolomKunci, nilai, kolom) =>
      (sheet[nama] || [])
        .map((r, i) => Object.assign({ _baris: i + 2 }, r))
        .filter(r => String(r[kolomKunci]) === String(nilai))
        .map(r => proyeksi(r, kolom)),
    /* Meniru Db.gs:408-414 — kolom kriteria DITAMBAHKAN ke proyeksi.
       Versi pertama mock ini tidak melakukannya, sehingga penyaringan
       selalu kosong dan _cekEnroll menolak murid yang sah. */
    saringKolom: (nama, kriteria, kolom) => {
      const perlu = kolom.slice();
      Object.keys(kriteria).forEach(k => { if (perlu.indexOf(k) === -1) perlu.push(k); });
      return semua(nama, perlu).filter(r => {
        for (const k in kriteria) if (r[k] !== kriteria[k]) return false;
        return true;
      });
    },
    cariBarisCache: (nama, kolom, nilai) => cari(nama, r => String(r[kolom]) === String(nilai)),
    cariBarisCache2: (nama, k1, v1, k2, v2) =>
      cari(nama, r => String(r[k1]) === String(v1) && String(r[k2]) === String(v2)),
    cariCepat2: (nama, k1, v1, k2, v2) =>
      cari(nama, r => String(r[k1]) === String(v1) && String(r[k2]) === String(v2)),
    bacaBarisJika: (nama, nomor, cocok) => {
      const r = (sheet[nama] || [])[nomor - 2];
      if (!r) return null;
      for (const k in cocok) if (r[k] !== cocok[k]) return null;
      return Object.assign({ _baris: nomor }, r);
    },
    tambah: (nama, obj) => { (sheet[nama] = sheet[nama] || []).push(obj); return 1; },
    perbarui: (nama, baris, obj) => {
      const r = (sheet[nama] || [])[baris - 2];
      if (r) Object.assign(r, obj);
    },
    titipBaris2: () => {},
    invalidasi: () => {},
    epochProgres: () => 1,
    sheet: () => null,
    /* Jalankan fn apa adanya — kunci tidak relevan untuk uji ini. */
    tulisProgres: (userId, fn) => fn()
  };
}

function muat(sheet, opts) {
  opts = opts || {};
  const cache = {};
  const props = { DB_ID: 'SPREADSHEET-UJI' };
  const ctx = {
    console, JSON, Math, Object, Array, String, Number, Date, isFinite,
    CacheService: { getScriptCache: () => ({
      get: k => (k in cache ? cache[k] : null),
      put: (k, v) => { cache[k] = v; },
      remove: k => { delete cache[k]; }
    }) },
    /* dipakai Util.buatId() untuk penghitung ID */
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => (k in props ? props[k] : null),
      setProperty: (k, v) => { props[k] = String(v); }
    }) },
    Db: mockDb(sheet),
    Beranda: { invalidasiProgres: () => {} }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'Util.gs'), 'utf8'), ctx, { filename: 'Util.gs' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'Belajar.gs'), 'utf8'), ctx, { filename: 'Belajar.gs' });
  return ctx;
}

const SESI = { user_id: 'U-1', role: 'murid' };
const SESI_LUAR = { user_id: 'U-9', role: 'murid' };

/* ============================================================ */
judul('A. pramuatMateriPokok() — isi & penyaringan');
{
  const c = muat(data());
  const d = c.Belajar.pramuatMateriPokok(SESI, 'MP-1');

  cek('mengembalikan identitas materi pokok', d.mp_id === 'MP-1' && d.judul === 'Bab Satu');
  cek('hanya TIPE materi yang ikut (quiz tersaring)',
      d.materi.every(m => ['I-1', 'I-2'].indexOf(m.item_id) > -1),
      d.materi.map(m => m.item_id).join(','));
  cek('materi DRAF tidak ikut', !d.materi.some(m => m.item_id === 'I-D'));
  cek('dua materi terkirim', d.jml_materi === 2, String(d.jml_materi));

  const a = d.materi.filter(m => m.item_id === 'I-1')[0];
  cek('konten dipecah jadi 3 bagian di SERVER', a.bagian.length === 3 && a.jml_bagian === 3,
      JSON.stringify(a.bagian));
  cek('pemecahannya benar', a.bagian[0] === 'satu' && a.bagian[2] === 'tiga');
  cek('konten mentah TIDAK ikut dikirim (klien tidak perlu penanda)',
      a.konten === undefined);
  cek('judul pertemuan & urutan ikut', a.pertemuan_judul === 'Pertemuan 1' && a.pertemuan_urutan === 1);
  cek('materi pertemuan kedua ikut walau terkunci (keputusan guru)',
      d.materi.some(m => m.item_id === 'I-2'));

  /* materi kosong tetap punya satu bagian — Util.semuaBagian menjamin */
  const c2 = muat(data());
  c2.Db.tambah('item', { item_id: 'I-K', pertemuan_id: 'P-1', mp_id: 'MP-1',
    tipe: 'materi', urutan: 9, wajib: false, status: 'publish', konten: '' });
  const kosong = c2.Belajar.pramuatMateriPokok(SESI, 'MP-1')
    .materi.filter(m => m.item_id === 'I-K')[0];
  cek('materi kosong tetap punya 1 bagian', kosong && kosong.jml_bagian === 1,
      kosong ? String(kosong.jml_bagian) : 'tidak ada');
}

judul('B. Penolakan masukan');
{
  const c = muat(data());
  let e1 = null; try { c.Belajar.pramuatMateriPokok(SESI_LUAR, 'MP-1'); } catch (e) { e1 = e; }
  cek('murid tak terdaftar ditolak', !!e1, e1 ? e1.message : 'tidak melempar');

  let e2 = null; try { c.Belajar.pramuatMateriPokok(SESI, 'MP-DRAF'); } catch (e) { e2 = e; }
  cek('materi pokok draf ditolak', !!e2 && e2.kode === 'TIDAK_DITEMUKAN', e2 && e2.kode);

  let e3 = null; try { c.Belajar.pramuatMateriPokok(SESI, 'TAK-ADA'); } catch (e) { e3 = e; }
  cek('mp_id tak dikenal ditolak', !!e3 && e3.kode === 'TIDAK_DITEMUKAN');
}

judul('C. Status kunci ikut terkirim');
{
  const c = muat(data());
  const d = c.Belajar.pramuatMateriPokok(SESI, 'MP-1');
  const a = d.materi.filter(m => m.item_id === 'I-1')[0];
  const b = d.materi.filter(m => m.item_id === 'I-2')[0];
  cek('materi pertemuan pertama terbuka', a.terbuka === true, String(a.terbuka));
  cek('materi pertemuan kedua TERKUNCI', b.terbuka === false, String(b.terbuka));
  cek('tapi kontennya tetap ada (keputusan guru)', b.bagian[0] === 'rahasia minggu depan');
}

/* ============================================================ */
judul('C2. Klien benar-benar punya mp_id untuk memicu pramuat');
{
  /* Rute `belajar` memanggil materiPramuat(p.mp_id). Bila detailPertemuan
     tidak mengirim mp_id, pramuat tidak pernah terpicu dan seluruh
     fitur ini diam-diam tidak jalan — tidak ada yang error. */
  const c = muat(data());
  const d = c.Belajar.detailPertemuan(SESI, 'P-1');
  cek('detailPertemuan mengirim mp_id', d.pertemuan.mp_id === 'MP-1',
      JSON.stringify(d.pertemuan.mp_id));
  cek('...dan kunci pertemuannya ikut', d.pertemuan.terbuka === true);
}

/* ============================================================ */
judul('D. 🔴 Penjaga kunci di jalur TULIS — celah yang ditutup');
{
  /* Sebelum v1.19.0, tandaiBagianSelesai() tidak memeriksa kunci
     pertemuan/item. Murid yang memanggilnya langsung bisa menandai
     materi di pertemuan terkunci sebagai selesai. */
  const c = muat(data());
  let e = null;
  try { c.Belajar.tandaiBagianSelesai(SESI, 'I-2', 1, 999); } catch (err) { e = err; }
  cek('materi di pertemuan TERKUNCI ditolak saat menandai',
      !!e && e.kode === 'ITEM_TERKUNCI', e ? e.kode + ': ' + e.message : 'TIDAK DITOLAK');
  cek('...dan tidak ada progres yang tertulis',
      (c.Db.saringBaris('progress', 'user_id', 'U-1', ['item_id'])).length === 0);

  /* pembanding: yang terbuka tetap boleh */
  const c2 = muat(data());
  let ok = null, e2 = null;
  try { ok = c2.Belajar.tandaiBagianSelesai(SESI, 'I-1', 1, 999); } catch (err) { e2 = err; }
  cek('materi TERBUKA tetap bisa ditandai', !!ok && ok.bagian_terakhir === 1,
      e2 ? e2.message : JSON.stringify(ok));
}

judul('E. Regresi v1.16.1 — urutan bagian tetap dijaga');
{
  const c = muat(data());
  let e = null;
  try { c.Belajar.tandaiBagianSelesai(SESI, 'I-1', 3, 999); } catch (err) { e = err; }
  cek('melompat ke bagian 3 ditolak', !!e && e.kode === 'ITEM_TERKUNCI',
      e ? e.message : 'TIDAK DITOLAK');

  const c2 = muat(data());
  c2.Belajar.tandaiBagianSelesai(SESI, 'I-1', 1, 999);
  c2.Belajar.tandaiBagianSelesai(SESI, 'I-1', 2, 999);
  const r3 = c2.Belajar.tandaiBagianSelesai(SESI, 'I-1', 3, 999);
  cek('berurutan 1→2→3 berhasil', r3.bagian_terakhir === 3);
  cek('bagian terakhir menandai item selesai', r3.item_selesai === true);

  /* min_durasi tetap ditegakkan */
  const c3 = muat(data());
  c3.Db.perbarui('item', 2, { min_durasi_detik: 60 });
  let e3 = null;
  try { c3.Belajar.tandaiBagianSelesai(SESI, 'I-1', 1, 5); } catch (err) { e3 = err; }
  cek('durasi minimum tetap ditolak', !!e3 && e3.kode === 'VALIDASI_GAGAL', e3 && e3.kode);
}

/* ============================================================ */
judul('F. Klien — materiAmbil() tidak melayani item terkunci');
{
  /* Potong blok klien dari js_belajar.html supaya yang diuji kode
     yang benar-benar dikirim, bukan tiruan. */
  const src = fs.readFileSync(path.join(ROOT, 'js_belajar.html'), 'utf8')
    .replace(/<script>/g, '').replace(/<\/script>/g, '');
  const a = src.indexOf('var Materi = {');
  const b = src.indexOf('function materiReset()');
  /* Pencocokan kurung, bukan indexOf('}') pertama — badan materiReset
     memuat `{}` di tengah baris, jadi pemotongan naif berhenti di situ
     dan menghasilkan kode terpenggal. */
  let i = src.indexOf('{', b), dalam = 0, akhir = -1;
  for (; i < src.length; i++) {
    if (src[i] === '{') dalam++;
    else if (src[i] === '}') { dalam--; if (!dalam) { akhir = i + 1; break; } }
  }
  if (a < 0 || akhir < 0) { console.log('\u274c blok Materi tidak ditemukan'); process.exit(1); }
  const kode = src.slice(a, akhir);

  const ctx = { console, JSON, Math, Object, Array, String, Number, Date,
                callApi: () => Promise.resolve(null) };
  vm.createContext(ctx);
  vm.runInContext(kode, ctx, { filename: 'js_belajar.html:Materi' });

  ctx.Materi.mpId = 'MP-1';
  ctx.Materi.peta = {
    'I-1': { item_id: 'I-1', judul: 'A', pertemuan_id: 'P-1',
             pertemuan_judul: 'Pertemuan 1', pertemuan_urutan: 1,
             kelas_id: 'KLS-1', min_durasi_detik: 0, wajib: true,
             bagian: ['satu', 'dua', 'tiga'], jml_bagian: 3,
             bagian_terakhir: 0, sudah_selesai: false, terbuka: true },
    'I-2': { item_id: 'I-2', judul: 'B', pertemuan_id: 'P-2',
             pertemuan_judul: 'Pertemuan 2', pertemuan_urutan: 2,
             kelas_id: 'KLS-1', min_durasi_detik: 0, wajib: true,
             bagian: ['rahasia'], jml_bagian: 1,
             bagian_terakhir: 0, sudah_selesai: false, terbuka: false }
  };

  cek('item terbuka dilayani dari cache', ctx.materiAmbil('I-1', 2) !== null);
  cek('...dengan konten bagian yang diminta',
      ctx.materiAmbil('I-1', 2).konten === 'dua');
  cek('...dan bentuknya setara bukaMateri()',
      ctx.materiAmbil('I-1', 1).bagian_ke === 1 &&
      ctx.materiAmbil('I-1', 1).jml_bagian === 3);
  cek('🔴 item TERKUNCI TIDAK dilayani dari cache',
      ctx.materiAmbil('I-2', 1) === null);
  cek('item tak dikenal → null (jatuh ke jalur lama)',
      ctx.materiAmbil('TAK-ADA', 1) === null);
  cek('bagian di luar rentang → null', ctx.materiAmbil('I-1', 9) === null);

  /* progres harus ikut maju di cache */
  ctx.materiPerbaruiProgres('I-1', { bagian_terakhir: 2, item_selesai: false });
  cek('materiPerbaruiProgres memajukan cache',
      ctx.materiAmbil('I-1', 1).bagian_terakhir === 2);
  ctx.materiPerbaruiProgres('I-1', { bagian_terakhir: 3, item_selesai: true });
  cek('...dan menandai item selesai',
      ctx.materiAmbil('I-1', 1).sudah_selesai === true);

  ctx.materiReset();
  cek('materiReset mengosongkan semuanya',
      ctx.Materi.mpId === null && Object.keys(ctx.Materi.peta).length === 0);
}

console.log('\n' + (gagal ? '\u274c ' : '\u2705 ') + lolos + ' lolos, ' + gagal + ' gagal');
process.exit(gagal ? 1 : 0);
