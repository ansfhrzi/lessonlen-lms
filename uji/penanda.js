/* ============================================================
   LessonLen — uji penanda UI

   Dijalankan dengan Node:   node uji/penanda.js

   Menjalankan `cekBerkasUI()` ASLI dari Code.gs — bukan menyalin
   logikanya. `include()` diganti pembaca berkas lokal, karena
   `HtmlService` tidak ada di luar Apps Script.

   Gunanya: distribusi proyek ini salin-tempel manual. Bila guru
   menyalin Code.gs tetapi lupa satu berkas HTML, layarnya rusak
   dengan cara yang sulit dikenali. `cekBerkasUI()` mendeteksi itu —
   tetapi hanya bila daftarnya ikut diperbarui setiap rilis.
   Pelajaran v1.11.7 dan v1.12.7: penanda yang lupa ditambah
   membuat alat ini MELAPORKAN SUKSES PALSU.
   ============================================================ */
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');

const src = fs.readFileSync(path.join(ROOT, 'Code.gs'), 'utf8');

/* Potong fungsi cekBerkasUI() apa adanya. */
const awal = src.indexOf('function cekBerkasUI()');
if (awal < 0) { console.log('\u274c cekBerkasUI() tidak ditemukan di Code.gs'); process.exit(1); }
let i = src.indexOf('{', awal), dalam = 0, akhir = -1;
for (; i < src.length; i++) {
  if (src[i] === '{') dalam++;
  else if (src[i] === '}') { dalam--; if (!dalam) { akhir = i + 1; break; } }
}
const kode = src.slice(awal, akhir);

const keluaran = [];
const ctx = {
  Logger: { log: s => keluaran.push(String(s)) },
  /* Penjaga editor dimatikan: uji ini memang dijalankan di luar editor. */
  _hanyaEditor: () => {},
  APP_VERSI: (src.match(/var APP_VERSI = '([^']+)'/) || [])[1],
  /* Pengganti HtmlService — baca berkas lokal apa adanya. */
  include: nama => fs.readFileSync(path.join(ROOT, nama + '.html'), 'utf8')
};
vm.createContext(ctx);
vm.runInContext(kode, ctx, { filename: 'Code.gs:cekBerkasUI' });

let gagal = 0;
try { ctx.cekBerkasUI(); }
catch (e) { console.log('\u274c cekBerkasUI() melempar: ' + e.message); process.exit(1); }

const teks = keluaran.join('\n');
console.log(teks);
console.log('');

const versi = (teks.match(/LessonLen v([\d.]+)/) || [])[1];
if (versi !== ctx.APP_VERSI) {
  console.log('\u274c versi yang diperiksa (' + versi + ') != APP_VERSI (' + ctx.APP_VERSI + ')');
  gagal++;
}
if (/BERKAS TIDAK ADA/.test(teks)) {
  console.log('\u274c ada berkas yang tidak ditemukan'); gagal++;
}
if (/PENANDA TIDAK DITEMUKAN|ADA \d+ PENANDA/.test(teks)) {
  console.log('\u274c ada penanda yang basi — tambahkan penanda baru atau salin berkasnya');
  gagal++;
}
if (!/SELURUH BERKAS UI SUDAH VERSI TERBARU/.test(teks)) {
  console.log('\u274c tidak melaporkan sukses'); gagal++;
}

process.exit(gagal ? 1 : 0);
