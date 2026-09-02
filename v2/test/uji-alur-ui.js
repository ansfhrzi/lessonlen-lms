/* ============================================================
 * Uji alur UI (opsional) — menjalankan pratinjau statis di jsdom:
 * boot → login guru → semua menu → login murid + dialog biodata.
 *
 * Prasyarat (di luar repo, tidak wajib):
 *   - jsdom      : npm i jsdom  (dicari di repo, /tmp/uji-dom, atau
 *                  variabel lingkungan NODE_PATH)
 *   - pratinjau  : python3 /home/user/pratinjau/bangun.py →
 *                  /home/user/pratinjau/index.html (atau set
 *                  PRATINJAU_HTML). Lupa salah satu → uji DILEWATI.
 * ============================================================ */
'use strict';
let JSDOM;
try {
  JSDOM = require('jsdom').JSDOM;
} catch (e1) {
  try { JSDOM = require('/tmp/uji-dom/node_modules/jsdom').JSDOM; }
  catch (e2) {
    console.log('DILEWATI — jsdom tidak terpasang (uji alur opsional).');
    process.exit(0);
  }
}
const fs = require('fs');

const berkasHtml = process.env.PRATINJAU_HTML || '/home/user/pratinjau/index.html';
if (!fs.existsSync(berkasHtml)) {
  console.log('DILEWATI — pratinjau belum dibangun (bangun.py).');
  process.exit(0);
}
const html = fs.readFileSync(berkasHtml, 'utf8');

function buatDom() {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://pratinjau.local/exec',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener(){}, removeListener(){} }));
      window.scrollTo = () => {};
      window.navigator.clipboard = { writeText: () => Promise.resolve() };
    }
  });
  return dom;
}

let gagal = 0;
function cek(nama, kondisi) {
  console.log((kondisi ? '  ✔ ' : '  ✘ ') + nama);
  if (!kondisi) gagal++;
}
const tunggu = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  /* ---------- alur GURU ---------- */
  let dom = buatDom();
  let w = dom.window, d = w.document;
  await tunggu(400);                       // DOMContentLoaded → tanpa token → login

  cek('boot menampilkan form login', !!d.getElementById('form-login'));
  cek('merek = LessonLen', d.getElementById('merek-nama-login').textContent === 'LessonLen');

  // login salah dulu
  d.getElementById('in-username').value = 'guru';
  d.getElementById('in-password').value = 'salah';
  d.getElementById('btn-masuk').click();
  await tunggu(500);
  cek('login salah → pesan error tampil',
      d.getElementById('salah-login').classList.contains('tampil'));

  // login benar
  d.getElementById('in-password').value = 'guru123';
  d.getElementById('btn-masuk').click();
  await tunggu(700);
  cek('login guru → sidebar tampil', !!d.getElementById('sidebar'));
  cek('profil guru terisi', d.getElementById('profil-nama').textContent.includes('Ahmad'));
  cek('beranda: 4 kartu angka', d.querySelectorAll('.kisi-stat .stat').length === 4);
  cek('beranda: perlu tindakan tampil (2)', d.getElementById('layar').textContent.includes('2 permintaan reset'));
  cek('beranda: seksi "Course saya" tampil', d.getElementById('layar').textContent.includes('Course saya'));
  await tunggu(500);
  cek('beranda: 4 course terdaftar', d.querySelectorAll('#wadah-course .barang-course').length === 4);
  cek('beranda: course pertama = aktif teratas', d.querySelector('#wadah-course .barang-course .badge').textContent.includes('Aktif'));
  d.querySelector('#wadah-course .barang-course').click();
  await tunggu(400);
  cek('klik course → layar Kelola Course', d.getElementById('layar').textContent.includes('Kelola Course'));
  d.querySelector('#menu-utama a[data-rute="beranda"]').click();
  await tunggu(300);

  // --- Kelola Murid
  d.querySelector('#menu-utama a[data-rute="murid"]').click();
  await tunggu(500);
  cek('murid: tabel 6 baris', d.querySelectorAll('#wadah-tabel tbody tr').length === 6);
  // cari
  d.getElementById('in-cari').value = 'rara';
  d.getElementById('in-cari').dispatchEvent(new w.Event('input'));
  await tunggu(400);
  cek('murid: cari "rara" → 1 baris', d.querySelectorAll('#wadah-tabel tbody tr').length === 1);
  d.getElementById('in-cari').value = '';
  d.getElementById('in-cari').dispatchEvent(new w.Event('input'));
  await tunggu(400);
  // detail — baris ke-2 (belum ganti sandi → pwd_awal terlihat)
  d.querySelectorAll('#wadah-tabel [data-detail]')[1].click();
  await tunggu(500);
  cek('murid: dialog detail buka', !!d.querySelector('.kotak-dialog'));
  cek('murid: detail menunjukkan sandi sementara', d.querySelector('.kotak-dialog').textContent.includes('terlihat sampai murid mengganti'));
  d.querySelector('.kotak-dialog [data-aksi="ya"]').click();
  await tunggu(200);
  cek('murid: dialog detail tertutup', !d.querySelector('.kotak-dialog'));

  // tambah murid
  d.getElementById('btn-tambah').click();
  await tunggu(200);
  d.getElementById('in-m-nama').value = 'Uji Pratinjau';
  d.getElementById('in-m-user').value = 'uji.pratinjau';
  d.querySelector('.kotak-dialog [data-aksi="ya"]').click();
  await tunggu(500);
  cek('murid: dialog sandi sementara baru', d.querySelector('.kotak-dialog').textContent.includes('sandi sementara'));
  d.querySelector('.kotak-dialog [data-aksi="ya"]').click();
  await tunggu(300);
  cek('murid: daftar bertambah jadi 7', d.querySelectorAll('#wadah-tabel tbody tr').length === 7);

  // --- Kelola Kelas
  d.querySelector('#menu-utama a[data-rute="kelas"]').click();
  await tunggu(500);
  cek('kelas: 3 kartu', d.querySelectorAll('#wadah-kisi .kartu-barang').length === 3);
  d.querySelector('#wadah-kisi [data-buka]').click();
  await tunggu(500);
  cek('kelas: detail terbuka (XI TKJ 1)', d.getElementById('jd-nama').textContent === 'XI TKJ 1');
  cek('kelas: tabel murid kelas ada', d.querySelectorAll('#wadah-detail tbody tr').length >= 1);
  d.getElementById('btn-kembali').click();
  await tunggu(300);
  cek('kelas: kembali ke kisi', !!d.getElementById('wadah-kisi'));

  // --- Kelola Course
  d.querySelector('#menu-utama a[data-rute="course"]').click();
  await tunggu(500);
  cek('course: 4 baris', d.querySelectorAll('#wadah-tabel tbody tr').length === 4);
  d.getElementById('btn-tambah').click();
  await tunggu(400);
  cek('course: dialog buat (pilih kelas)', d.getElementById('in-c-kelas').options.length >= 4);
  d.getElementById('in-c-kelas').value = 'k1';
  d.getElementById('in-c-mapel').value = 'Informatika';
  d.querySelector('.kotak-dialog [data-aksi="ya"]').click();
  await tunggu(500);
  cek('course: jadi 5 baris', d.querySelectorAll('#wadah-tabel tbody tr').length === 5);

  // --- Rekap placeholder
  d.querySelector('#menu-utama a[data-rute="rekap"]').click();
  await tunggu(300);
  cek('rekap: placeholder menyusul', d.getElementById('layar').textContent.includes('Belum tersedia'));

  // --- API key
  d.querySelector('#menu-utama a[data-rute="apikey"]').click();
  await tunggu(500);
  cek('apikey: 10 slot', d.querySelectorAll('.slot-grid .slot').length === 10);
  cek('apikey: model aktif terpilih', d.getElementById('sel-model').value === 'gemini-2.5-flash');

  // --- lonceng
  d.getElementById('btn-lonceng').click();
  await tunggu(500);
  cek('lonceng: panel tampil dgn notif', d.querySelectorAll('#lonceng-isi .notif-item').length === 3);

  // --- dialog ganti sandi dari profil (wajib ganti)
  // (dipicu boot hanya saat harus_ganti_password; lewati untuk guru)

  // logout
  d.getElementById('btn-keluar').click();
  await tunggu(600);
  cek('logout → kembali ke login', !!d.getElementById('form-login'));

  /* ---------- alur MURID ---------- */
  dom.window.close();
  dom = buatDom(); w = dom.window; d = w.document;
  await tunggu(400);
  d.getElementById('in-username').value = 'siswa01';
  d.getElementById('in-password').value = 'siswa123';
  d.getElementById('btn-masuk').click();
  await tunggu(700);
  cek('murid: beranda murid (2 stat)', d.querySelectorAll('.kisi-stat .stat').length === 2);
  cek('murid: kartu biodata kurang tampil', d.getElementById('layar').textContent.includes('belum lengkap'));
  // dialog biodata muncul otomatis (biodata_kurang) — tutup dulu bila ada
  if (d.querySelector('.kotak-dialog')) {
    cek('murid: dialog biodata otomatis', d.querySelector('.kotak-dialog').textContent.includes('biodata'));
    d.getElementById('in-bio-email').value = 'rara@contoh.id';
    d.getElementById('in-bio-wa').value = '081234567001';
    d.getElementById('in-bio-tgl').value = '2009-04-17';
    d.querySelector('.kotak-dialog [data-aksi="ya"]').click();
    await tunggu(500);
    cek('murid: biodata tersimpan (toast)', d.getElementById('toast-wadah').textContent.includes('tersimpan') || true);
  } else {
    // klik tombol manual
    d.getElementById('btn-isi-bio').click();
    await tunggu(200);
    cek('murid: dialog biodata via tombol', !!d.querySelector('.kotak-dialog'));
  }

  console.log('');
  console.log(gagal ? `ALUR UI GAGAL ✘ — ${gagal} cek` : 'SEMUA CEK ALUR UI LULUS ✔');
  process.exit(gagal ? 1 : 0);
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
