/* ============================================================
 * Uji UI tambahan (statis):
 *  B) kecocokan id= (di HTML template) vs getElementById/$(id)
 *  C) pemanggilan Core.api('namaFn') vs fungsi global Code.gs
 *  D) kelas CSS yang dipakai di partial UI vs yang didefinisikan css.html
 * Jalankan: node v2/test/uji-ui-extra.js   (exit 1 bila ada masalah)
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const DIR = __dirname + '/..';
const berkasHtml = fs.readdirSync(DIR).filter(f => /\.html$/.test(f) && f !== 'index.html');
const baca = f => fs.readFileSync(path.join(DIR, f), 'utf8');

let masalah = 0;
const lapor = t => { console.log('  ✘ ' + t); masalah++; };

/* ---------- kumpulkan sumber gabungan ---------- */
const skrip = {};           // berkas → kode <script>
const htmlMentah = {};      // berkas → seluruh isi
for (const f of berkasHtml) {
  htmlMentah[f] = baca(f);
  skrip[f] = (htmlMentah[f].match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [])
    .join('\n').replace(/<\/?script[^>]*>/g, '\n');
}
const semuaSkrip = Object.values(skrip).join('\n');
const semuaHtml = Object.values(htmlMentah).join('\n');
const kodeGs = ['Code.gs', 'Auth.gs', 'Db.gs', 'Util.gs', 'Murid.gs',
  'Kelas.gs', 'Course.gs', 'ApiKey.gs'].map(baca).join('\n');

/* ---------- B) ID: definisi vs pemakaian ---------- */
const idTerdefinisi = new Set();
let m;
const reId = /\bid="([\w-]+)"/g;
while ((m = reId.exec(semuaHtml))) idTerdefinisi.add(m[1]);
/* id di index.html (cangkang #app) ikut dihitung */
const htmlIndex = baca('index.html');
while ((m = reId.exec(htmlIndex))) idTerdefinisi.add(m[1]);

/* id yang dibuat lewat createElement saat runtime (bukan template) */
const ID_DINAMIS = new Set(['toast-wadah']);

const pemakaiId = {};   // id → [berkas]
for (const [f, kode] of Object.entries(skrip)) {
  let mm;
  const re = /(?:getElementById|\$)\(\s*'([\w-]+)'\s*\)/g;
  while ((mm = re.exec(kode))) {
    (pemakaiId[mm[1]] = pemakaiId[mm[1]] || []).push(f);
  }
}
for (const [id, dari] of Object.entries(pemakaiId).sort()) {
  if (idTerdefinisi.has(id) || ID_DINAMIS.has(id)) continue;
  lapor('ID "' + id + '" dipakai di ' +
    [...new Set(dari)].join(',') + ' tapi tidak pernah didefinisikan di template mana pun.');
}

/* ---------- C) Core.api('fn') vs global Code.gs ---------- */
const fnGs = new Set();
const reFnGs = /\bfunction\s+([A-Za-z_][\w]*)\s*\(/g;
while ((m = reFnGs.exec(kodeGs))) fnGs.add(m[1]);

const reApi = /Core\.api\(\s*'([\w]+)'/g;
while ((m = reApi.exec(semuaSkrip))) {
  if (!fnGs.has(m[1])) lapor('Core.api("' + m[1] + ') — fungsi tidak ada di .gs.');
}

/* ---------- D) kelas CSS: dipakai vs didefinisikan ---------- */
const css = baca('css.html');
const kelasCss = new Set();
const reKelas = /\.([a-z][a-z0-9-]*)/g;
const cssTanpaKomentar = css.replace(/\/\*[\s\S]*?\*\//g, '');
while ((m = reKelas.exec(cssTanpaKomentar))) kelasCss.add(m[1]);

const htmlTpl = berkasHtml.filter(f => /^v_/.test(f))
  .map(f => htmlMentah[f]).join('\n');
const jsKlien = berkasHtml.filter(f => /^js_/.test(f))
  .map(f => skrip[f]).join('\n');

const kelasDipakai = new Set();
for (const sumber of [htmlTpl, jsKlien]) {
  const re = /class(?:Name)?\s*=\s*["']([^"']+)["']|className\s*=\s*'([^']*)'|classList\.(?:add|toggle|remove)\('([^']+)'/g;
  let mm;
  while ((mm = re.exec(sumber))) {
    const nilai = mm[1] || mm[2] || mm[3] || '';
    nilai.split(/\s+/).forEach(k => { if (k) kelasDipakai.add(k); });
  }
  /* kelas di string html JS: '... class="a b" ...' tertangkap regex pertama */
}
const DIKECUALIKAN = new Set(['tampil', 'belum', 'aktif', 'merah', 'mt-8', 'mt-16',
  'kecil', 'wajib', 'penuh', 'toast', 'sukses', 'bahaya']);
for (const k of [...kelasDipakai].sort()) {
  if (kelasCss.has(k) || DIKECUALIKAN.has(k)) continue;
  lapor('Kelas CSS "' + k + '" dipakai UI tapi tidak ada di css.html.');
}

/* ---------- E) scriptlet "<?" hanya boleh di index.html ---------- */
/* Berkas include dimuat lewat HtmlService.createHtmlOutputFromFile()
   yang TIDAK mengevaluasi scriptlet — teks "<?=" akan terkirim mentah
   ke browser (pun bisa memicu escaping blok <script> di pembungkus
   iframe GAS → "Unexpected token '&lt;'"). */
for (const f of berkasHtml) {
  if (f !== 'index.html' && /<\?/.test(htmlMentah[f])) {
    lapor('Scriptlet "<?" ditemukan di ' + f +
          ' — hanya index.html yang dievaluasi scriptlet-nya.');
  }
}
for (const f of fs.readdirSync(DIR).filter(f => /\.gs$/.test(f))) {
  const isi = baca(f);
  if (/createHtmlOutputFromFile\(['"][\w]+['"]\)/.test(isi) &&
      /'<script>'/.test(isi)) {
    lapor(f + ' merakit tag <script> sebagai string — pola ini pernah ' +
          'memicu blok ter-escape di pembungkus iframe GAS.');
  }
}

/* ---------- F) include() di index.html menunjuk berkas yang ada ---------- */
{
  const idx = baca('index.html');
  let mm; const reInc = /include\(['"]([\w]+)['"]\)/g;
  while ((mm = reInc.exec(idx))) {
    if (!fs.existsSync(path.join(DIR, mm[1] + '.html'))) {
      lapor('index.html meng-include "' + mm[1] + '" yang tidak ada di v2/.');
    }
  }
}

/* ---------- ringkasan ---------- */
console.log('ID terdefinisi: ' + idTerdefinisi.size +
  ' · kelas CSS terdefinisi: ' + kelasCss.size +
  ' · kelas dipakai: ' + kelasDipakai.size);
if (!masalah) {
  console.log('UJI UI-EXTRA LULUS ✔ — id/endpoint/kelas CSS konsisten.');
} else {
  console.log('\nUJI UI-EXTRA GAGAL ✘ — ' + masalah + ' masalah.');
  process.exit(1);
}
