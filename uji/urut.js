/* ============================================================
   LessonLen — uji urutan pembatalan cache (v1.18.4)

   Dijalankan dengan Node:   node uji/urut.js

   🔴 DILAPORKAN GURU: "saat saya membuat kelas baru, di UI belum
   muncul kelas baru, saat saya refresh baru muncul."

   Aturannya: BUANG DULU, GAMBAR KEMUDIAN. Bila `tutupPanel(true)`
   atau `router()` berjalan lebih dulu, layar digambar dari
   `daftarKelasBersama()` yang masih memegang cache lama.

   Sejak v1.18.5 pembatalan dipasang terpusat di `callApi()`, jadi
   urutan di dalam handler tidak lagi menentukan untuk aksi yang
   terdaftar di `API_UBAH_KELAS`. Uji ini tetap dipertahankan:
   ia menjaga tiga handler kelas, dan menjaga sifat
   `daftarKelasBersama()`/`bataliMenuKelas()` itu sendiri.

   Dua lapis:
     Z1 STATIS   — urutan pada sumber yang benar-benar dikirim
     Z2 EKSEKUSI — kode asli js_menu.html, membuktikan urutan
                   memang menentukan hasil
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
function baca(berkas) {
  return tanpaKomentar(fs.readFileSync(path.join(ROOT, berkas), 'utf8')
    .replace(/<script>/g, '').replace(/<\/script>/g, ''));
}

judul('Z1. STATIS \u2014 urutan pada sumber yang dikirim');
{
  const src = baca('js_kelola.html');
  const fnRe = /function\s+([A-Za-z0-9_]+)\s*\([^)]*\)\s*\{/g;
  const tanda = []; let m;
  while ((m = fnRe.exec(src))) tanda.push({ nama: m[1], awal: m.index });
  tanda.push({ nama: '<akhir>', awal: src.length });

  const sasaran = ['formKelas', 'panelDuplikat', 'hapusKelasKonfirmasi'];
  let diperiksa = 0;
  for (let k = 0; k < tanda.length - 1; k++) {
    const f = tanda[k];
    if (sasaran.indexOf(f.nama) === -1) continue;
    const badan = src.slice(f.awal, tanda[k + 1].awal);
    const b = badan.indexOf('bataliMenuKelas');
    const calon = [badan.indexOf('tutupPanel(true)'),
                   badan.search(/[^a-zA-Z]router\(\)/)].filter(x => x >= 0);
    const r = calon.length ? Math.min.apply(null, calon) : -1;
    if (b < 0 || r < 0) continue;
    diperiksa++;
    cek(f.nama + '(): batali SEBELUM render', b < r, 'batali@' + b + ' render@' + r);
  }
  cek('ketiga fungsi sasaran ikut terperiksa', diperiksa === 3, 'hanya ' + diperiksa);
}

judul('Z2. EKSEKUSI \u2014 urutan memang menentukan hasil');
{
  const ctx = {
    console, Promise, Date, JSON, Math, Object, Array, String, Number,
    setTimeout, clearTimeout,
    document: { getElementById: () => null },
    callApi: () => Promise.resolve([
      { kelas_id: 'KLS-0001', nama_kelas: 'XI A' },
      { kelas_id: 'KLS-0002', nama_kelas: 'XI B' }   /* kelas baru di server */
    ])
  };
  vm.createContext(ctx);
  vm.runInContext(baca('js_menu.html'), ctx, { filename: 'js_menu.html' });

  const awali = () => {
    ctx.Menu.kelas = [{ kelas_id: 'KLS-0001', nama_kelas: 'XI A' }];
    ctx.Menu.diisi = Date.now(); ctx.Menu.ringkas = false;
  };

  /* URUTAN SALAH: gambar dulu, batali kemudian (bug sebelum v1.18.4) */
  awali();
  ctx.daftarKelasBersama().then(lama => {
    const salah = lama.length;
    ctx.bataliMenuKelas();
    cek('urutan SALAH: layar tergambar dari cache basi (1 kelas)', salah === 1,
        salah + ' kelas');

    /* URUTAN BENAR: batali dulu, gambar kemudian */
    awali();
    ctx.bataliMenuKelas();
    return ctx.daftarKelasBersama();
  }).then(baru => {
    cek('urutan BENAR: layar memuat daftar segar (2 kelas)', baru.length === 2,
        baru.length + ' kelas');
    cek('kelas baru benar-benar ada di hasilnya',
        baru.some(k => k.nama_kelas === 'XI B'));
    console.log('\n' + (gagal ? '\u274c ' : '\u2705 ') + lolos + ' lolos, ' + gagal + ' gagal');
    process.exit(gagal ? 1 : 0);
  }).catch(e => { console.log('  \u274c eksekusi gagal: ' + e.message); process.exit(1); });
}
