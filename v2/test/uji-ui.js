/* ============================================================
 * Uji UI statis — fungsi klien yang DIPANGGIL tapi TAK PERNAH
 * DIDEFINISIKAN (ReferenceError saat runtime di browser).
 *
 * Latar: bug "dialogTopik is not defined" lolos semua uji node
 * karena seluruh uji lama hanya menyentuh kode server (.gs).
 * Uji ini memindai partial UI (js_*.html, v_*.html) secara
 * statis: kumpulkan semua `function nama(` sebagai definisi
 * global, lalu semua `nama(` sebagai pemanggilan; laporkan
 * yang dipanggil tapi tidak pernah didefinisikan di berkas
 * mana pun (dengan tokenizer string/komentar/regex yang benar).
 *
 * Jalankan:  node test/uji-ui.js
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const JS_FILES = ['js_core', 'js_auth', 'js_beranda', 'js_kelola', 'js_mapel'];
const VIEW_FILES = ['v_login', 'v_dashboard', 'v_editor'];

/* ---------- tokenizer: buang komentar & isi string/regex ---------- */
const KEYWORD_SEBELUM_REGEX = new Set([
  'return', 'typeof', 'case', 'in', 'of', 'delete', 'void', 'new',
  'do', 'else', 'instanceof', 'throw'
]);

function tokenizeKode(sumber, label) {
  const out = [];
  let prev = '';          // karakter bermakna terakhir yang keluar
  let prevWord = '';      // kata terakhir (untuk deteksi regex)
  let i = 0;
  const n = sumber.length;
  function tekan(teks) {
    for (const c of teks) {
      if (!/\s/.test(c)) { prev = c; }
      out.push(c);
    }
  }
  while (i < n) {
    const c = sumber[i], d = sumber[i + 1];
    if (c === '/' && d === '/') {           // komentar baris
      while (i < n && sumber[i] !== '\n') i++;
    } else if (c === '/' && d === '*') {    // komentar blok
      i += 2;
      while (i < n && !(sumber[i] === '*' && sumber[i + 1] === '/')) i++;
      i += 2;
    } else if (c === "'" || c === '"') {    // string
      i++;
      while (i < n && sumber[i] !== c) { if (sumber[i] === '\\') i++; i++; }
      i++; prev = '"';
    } else if (c === '`') {                 // template literal
      i++;
      while (i < n && sumber[i] !== '`') { if (sumber[i] === '\\') i++; i++; }
      i++; prev = '"';
    } else if (c === '/') {                 // regex vs pembagian
      const mulaiRegex = prev === '' || '(,=:[!&|?;{}+-*%<>~^'.includes(prev) ||
        KEYWORD_SEBELUM_REGEX.has(prevWord);
      if (mulaiRegex) {
        i++;
        let tutup = false;
        while (i < n) {
          if (sumber[i] === '\\') { i += 2; continue; }
          if (sumber[i] === '\n') break;          // bukan regex → berhenti
          if (sumber[i] === '/') { tutup = true; i++; break; }
          i++;
        }
        if (tutup) { while (i < n && /[a-z]/.test(sumber[i])) i++; } // flag
        out.push('/RE/');
        prev = '"'; prevWord = '';
      } else { tekan(c); i++; }
    } else if (/[A-Za-z0-9_$]/.test(c)) {
      let w = '';
      while (i < n && /[A-Za-z0-9_$]/.test(sumber[i])) w += sumber[i++];
      tekan(w); prevWord = w;
    } else { tekan(c); prevWord = ''; i++; }
  }
  return out.join('');
}

function kontenScript(namaBerkas) {
  let s = fs.readFileSync(path.join(ROOT, namaBerkas + '.html'), 'utf8');
  return s.replace(/<\/?script[^>]*>/g, '\n');
}

/* ---------- kumpulkan definisi & parameter ---------- */
const definisi = new Set();
const parameter = new Set();   // nama param/callback — diabaikan sebagai kandidat

for (const f of JS_FILES) {
  const kode = tokenizeKode(kontenScript(f), f);
  let m;
  const reDef = /function\s+([A-Za-z_$][\w$]*)\s*\(/g;
  while ((m = reDef.exec(kode))) definisi.add(m[1]);
  const reFn = /function\s*(?:[A-Za-z_$][\w$]*)?\s*\(([^)]*)\)/g;
  while ((m = reFn.exec(kode))) {
    m[1].split(',').forEach(function (p) {
      p = p.split('=')[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(p)) parameter.add(p);
    });
  }
}

/* ---------- builtin yang sah dipanggil tanpa definisi lokal ---------- */
const BUILTIN = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'typeof',
  'delete', 'new', 'void', 'do', 'else', 'case', 'in', 'of', 'await', 'async',
  'Promise', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'JSON',
  'Math', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'setTimeout',
  'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame',
  'encodeURIComponent', 'decodeURIComponent', 'alert', 'confirm', 'prompt',
  'console', 'Error',
  'RegExp', 'fetch', 'FormData', 'Blob', 'URL', 'URLSearchParams', 'Set',
  'Map', 'Intl', 'CustomEvent', 'Event', 'DOMParser', 'localStorage',
  'sessionStorage', 'navigator', 'location', 'history', 'document', 'window',
  'google', 'Symbol', 'Reflect', 'Proxy', 'escape', 'unescape', 'eval',
  'Function', 'arguments', 'this', 'event', 'super', 'import', 'export'
]);

/* ---------- kumpulkan pemanggilan ---------- */
const dipakai = {};   // nama → Set(berkas)
function catatPakai(teks, label) {
  let m;
  const re = /(^|[^\w$.])([A-Za-z_$][\w$]*)\s*\(/g;
  while ((m = re.exec(teks))) {
    const nama = m[2];
    if (BUILTIN.has(nama) || definisi.has(nama) || parameter.has(nama)) continue;
    (dipakai[nama] = dipakai[nama] || new Set()).add(label);
  }
}
function onclickHtml(sumber, label) {
  let m;
  const re = /on(?:click|change|submit|input|load)\s*=\s*"([^"]*)"/g;
  while ((m = re.exec(sumber))) catatPakai(m[1], label + ':onclick');
}

for (const f of JS_FILES) {
  const mentah = kontenScript(f);
  catatPakai(tokenizeKode(mentah, f), f);
  onclickHtml(mentah, f);   // onclick di dalam string HTML hasil render
}
for (const f of VIEW_FILES) {
  const mentah = fs.readFileSync(path.join(ROOT, f + '.html'), 'utf8');
  const skrip = mentah.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
  catatPakai(tokenizeKode(skrip.join('\n'), f), f);
  onclickHtml(mentah, f);
}

/* ---------- laporan ---------- */
let gagal = 0;
const daftar = Object.keys(dipakai).sort();
console.log('Definisi global terdeteksi: ' + definisi.size +
            ' · fungsi builtin/param dikecualikan.');
if (!daftar.length) {
  console.log('SEMUA UJI UI LULUS ✔ — tidak ada fungsi hilang.');
} else {
  console.log('');
  daftar.forEach(function (nama) {
    gagal++;
    console.log('  GAGAL  "' + nama + '" dipanggil tapi tidak didefinisikan → ' +
                [...dipakai[nama]].join(', '));
  });
  console.log('');
  console.log('UJI UI GAGAL ✘ — ' + gagal + ' fungsi hilang (ReferenceError di browser).');
  process.exit(1);
}
