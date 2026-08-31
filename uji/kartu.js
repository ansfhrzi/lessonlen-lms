/* ============================================================
   LessonLen — uji kartu kelas (v1.18.5)

   Dijalankan dengan Node:   node uji/kartu.js
   Tidak ada dependensi, tidak ada package.json.

   Menguji `callApi()` ASLI dari js_core.html di atas
   `bataliMenuKelas()` ASLI dari js_menu.html.

   🔴 DILAPORKAN GURU: "waktu menambahkan murid dan tambah pertemuan,
   informasi jumlah murid dan jumlah pertemuan pada card kelas pada
   kelola kelas tidak meng-update. 👥 2 murid 📅 10 pertemuan.
   di tekan refresh dulu baru berubah."

   Yang diuji bukan hanya "cache dibuang", tetapi JAMINAN URUTAN:
   pembatalan harus sudah terjadi SEBELUM handler .then() sempat
   menggambar ulang — persis kelas bug yang menyebabkan v1.18.4.
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

/* Buang komentar agar teks penjelasan tidak ikut dieksekusi/dihitung. */
function tanpaKomentar(s) {
  let out = '', i = 0, blok = false, str = null;
  while (i < s.length) {
    const c = s[i], d = s[i + 1];
    if (str) {
      out += c;
      if (c === '\\') { out += d; i += 2; continue; }
      if (c === str) str = null;
      i++; continue;
    }
    if (blok) { if (c === '*' && d === '/') { blok = false; i += 2; } else i++; continue; }
    if (c === '/' && d === '*') { blok = true; i += 2; continue; }
    if (c === '/' && d === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === '"' || c === "'" || c === '`') { str = c; out += c; i++; continue; }
    out += c; i++;
  }
  return out;
}
function isiScript(berkas) {
  return tanpaKomentar(fs.readFileSync(path.join(ROOT, berkas), 'utf8')
    .replace(/<script>/g, '').replace(/<\/script>/g, ''));
}
/* Potong `var API_UBAH_KELAS` sampai akhir `function callApi` — supaya
   yang diuji kode callApi yang SUNGGUH-SUNGGUH dikirim, bukan tiruan. */
function potongCallApi(src) {
  const a = src.indexOf('var API_UBAH_KELAS');
  if (a < 0) throw new Error('API_UBAH_KELAS tidak ditemukan di js_core.html');
  const b = src.indexOf('function callApi(', a);
  let i = src.indexOf('{', b), dalam = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') dalam++;
    else if (src[i] === '}') { dalam--; if (!dalam) break; }
  }
  return src.slice(a, i + 1);
}

function bangun(jawabanServer) {
  const ctx = {
    console, Promise, Date, JSON, Math, Object, Array, String, Number,
    /* setTimeout WAJIB ada di konteks. Tanpanya, kode yang menunda
       pekerjaan crash dengan ReferenceError — dan crash itu terlihat
       seperti kegagalan uji, padahal yang rusak adalah mock-nya. */
    setTimeout, clearTimeout,
    document: { getElementById: () => null, addEventListener: () => {} },
    google: { script: { run: {} } },
    State: { token: 'T', user: { role: 'guru' }, ringkasan: null, beranda: null },
    tampilkanMuat: () => {}, simpanToken: () => {}, toast: () => {},
    pergiKe: () => {}, _lapor: () => {}, bataliBeranda: () => {}, navReset: () => {}
  };
  /* Tiru antarmuka rantai google.script.run yang dipakai callApi:
       google.script.run.withSuccessHandler(h).withFailureHandler(f)[nama](…)
     Kedua `with…` HARUS mengembalikan proxy-nya sendiri, bukan objek
     mentah — kalau tidak, akses `[nama]` di ujung rantai lolos dari
     proxy dan tidak menemukan fungsinya. */
  const run = { _s: null, _f: null };
  const proxy = new Proxy(run, {
    get(t, k) {
      if (k === 'withSuccessHandler') return function (h) { t._s = h; return proxy; };
      if (k === 'withFailureHandler') return function (h) { t._f = h; return proxy; };
      return function () { setTimeout(() => t._s(jawabanServer), 0); };
    }
  });
  ctx.google.script.run = proxy;
  vm.createContext(ctx);
  vm.runInContext(isiScript('js_menu.html'), ctx, { filename: 'js_menu.html' });
  vm.runInContext(potongCallApi(isiScript('js_core.html')), ctx, { filename: 'js_core.html' });
  return ctx;
}
const isiCache = c => {
  c.Menu.kelas = [{ kelas_id: 'K1', jml_murid: 2, jml_pertemuan: 10 }];
  c.Menu.diisi = Date.now(); c.Menu.ringkas = false;
};

const UBAAH = ['simpanMurid', 'imporMurid', 'enrollMurid', 'keluarkanMurid',
               'simpanPertemuan', 'hapusPertemuan', 'salinPertemuan',
               'simpanKelas', 'duplikatKelas', 'hapusKelas'];
const JANGAN = ['pindahPertemuan', 'getDaftarKelas', 'getBeranda',
                'getMuridKelas', 'aturUrutanPertemuan', 'simpanItem'];

judul('AA. Aksi pengubah isi kelas MEMBUANG cache kartu');
const janji = UBAAH.map(fn => {
  const c = bangun({ ok: true, data: { baru: true } }); isiCache(c);
  return c.callApi(fn, []).then(() =>
    cek(fn + ' \u2192 Menu.kelas dibuang', c.Menu.kelas === null,
        JSON.stringify(c.Menu.kelas)));
});

judul('AB. Aksi yang TIDAK mengubah isi kelas TIDAK membuang cache');
/* `pindahPertemuan` sengaja di sini: server membatasinya pada satu
   kelas (Pertemuan.gs:286-289), jadi jumlah di kartu tidak berubah
   dan memuat ulang getDaftarKelas (~3 dtk) akan sia-sia. */
JANGAN.forEach(fn => {
  const c = bangun({ ok: true, data: [] }); isiCache(c);
  janji.push(c.callApi(fn, []).then(() =>
    cek(fn + ' \u2192 cache tetap utuh',
        Array.isArray(c.Menu.kelas) && c.Menu.kelas.length === 1,
        JSON.stringify(c.Menu.kelas))));
});

judul('AC. Gagal dari server TIDAK membuang cache');
{
  const c = bangun({ ok: false, error: 'VALIDASI_GAGAL', pesan: 'x' }); isiCache(c);
  janji.push(c.callApi('simpanMurid', []).catch(() =>
    cek('res.ok=false \u2192 cache tidak dibuang (memang tidak ada yang berubah)',
        Array.isArray(c.Menu.kelas) && c.Menu.kelas.length === 1)));
}

judul('AD. JAMINAN URUTAN \u2014 pembatalan mendahului handler');
{
  const c = bangun({ ok: true, data: { baru: true } }); isiCache(c);
  janji.push(c.callApi('simpanMurid', []).then(() => {
    /* Inilah inti v1.18.4: handler menggambar ulang layar. Bila cache
       belum dibuang saat baris ini berjalan, layar tergambar dari data
       basi dan guru harus menekan refresh. */
    cek('saat handler berjalan, cache SUDAH null', c.Menu.kelas === null,
        JSON.stringify(c.Menu.kelas));
  }));
}

Promise.all(janji).then(() => {
  console.log('\n' + (gagal ? '\u274c ' : '\u2705 ') + lolos + ' lolos, ' + gagal + ' gagal');
  process.exit(gagal ? 1 : 0);
}).catch(e => { console.log('\u274c ' + e.stack); process.exit(1); });
