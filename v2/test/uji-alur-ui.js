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

const berkasHtml = process.env.PRATINJAU_HTML || '/home/user/lessonlen-lms/pratinjau/index.html';
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

  // --- alur LUPA AKSES §5.5 ---
  d.getElementById('btn-lupa').click();
  await tunggu(250);
  cek('lupa: dialog pilihan jalur tampil',
      d.querySelector('.kotak-dialog').textContent.includes('Pilih yang Anda lupa'));
  d.querySelector('.kotak-dialog [data-aksi="sandi"]').click();
  await tunggu(250);
  cek('lupa: form lupa kata sandi (username+WA+tgl lahir)', !!d.getElementById('in-lp-user'));
  // salah data → pesan netral, dialog TETAP terbuka
  d.getElementById('in-lp-user').value = 'siswa02';
  d.getElementById('in-lp-wa').value = '089900000000';
  d.getElementById('in-lp-tgl').value = '2008-08-08';
  d.querySelector('.kotak-dialog [data-aksi="ya"]').click();
  await tunggu(500);
  cek('lupa: data salah → pesan netral "hubungi guru", dialog tetap',
      d.getElementById('salah-lupa').textContent.includes('hubungi guru') &&
      !!d.getElementById('in-lp-user'));
  cek('lupa: gagal → tawaran jalur guru tampil',
      d.getElementById('salah-lupa').textContent.includes('permintaan ke guru'));
  // data benar → sandi sementara tampil sekali
  d.getElementById('in-lp-wa').value = '081234567002';
  d.querySelector('.kotak-dialog [data-aksi="ya"]').click();
  await tunggu(500);
  cek('lupa: sukses → sandi sementara tampil SEKALI',
      d.querySelector('.kotak-dialog').textContent.includes('hanya ditampilkan sekali') &&
      d.querySelector('.kotak-dialog code') !== null);
  d.querySelector('.kotak-dialog [data-aksi="ya"]').click();   // Masuk sekarang
  await tunggu(300);
  cek('lupa: kembali ke layar login', !!d.getElementById('form-login'));

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
  cek('guru: nav tidak memuat Biodata Saya',
      !d.querySelector('#menu-utama a[data-rute="biodata"]'));
  d.getElementById('profil-akun').click();
  await tunggu(200);
  cek('guru: menu akun terbuka, Biodata tersembunyi, Keluar tampil', (() => {
    const bio = d.getElementById('btn-menu-biodata');
    const kel = d.getElementById('btn-menu-keluar');
    return bio && bio.style.display === 'none' && kel;
  })());
  d.getElementById('profil-akun').click();
  await tunggu(150);
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
  // --- tambah murid ke kelas: LIST + FILTER ROMBEL (permintaan) ---
  d.getElementById('btn-enroll').click();
  await tunggu(500);
  cek('kelas: dialog "Tambah murid" terbuka berupa daftar nama',
      d.querySelector('.kotak-dialog') &&
      d.querySelectorAll('#pilih-list .pilih-baris').length >= 2 &&
      d.querySelectorAll('#pilih-list .pilih-baris .avatar').length >= 2);
  cek('kelas: filter rombel tersedia dgn opsi terurut',
      d.getElementById('sel-rombel') &&
      d.getElementById('sel-rombel').options.length >= 3);
  d.getElementById('sel-rombel').value = 'XI RPL 1';
  d.getElementById('sel-rombel').dispatchEvent(new w.Event('change'));
  await tunggu(150);
  cek('kelas: filter "XI RPL 1" → hanya 1 murid',
      d.querySelectorAll('#pilih-list .pilih-baris').length === 1 &&
      d.getElementById('pilih-list').textContent.includes('Fajar'));
  d.getElementById('sel-rombel').value = 'XI TKJ 2';
  d.getElementById('sel-rombel').dispatchEvent(new w.Event('change'));
  await tunggu(150);
  d.querySelector('#pilih-list input[type="checkbox"]').checked = true;
  d.querySelector('#pilih-list input[type="checkbox"]').dispatchEvent(new w.Event('change'));
  cek('kelas: penghitung terpilih jalan',
      d.getElementById('hitung-pilih').textContent.includes('1 dipilih'));
  d.querySelector('.kotak-dialog [data-aksi="ya"]').click();
  await tunggu(600);
  cek('kelas: enroll sukses → dialog tertutup, detail dimuat ulang',
      !d.querySelector('.kotak-dialog') &&
      d.getElementById('jd-sub') &&
      d.getElementById('jd-sub').textContent.includes('murid terdaftar') &&
      d.querySelectorAll('#wadah-detail tbody tr').length >= 4);
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
  cek('murid: sidebar TANPA menu guru (5 menu tersembunyi)', (() => {
    const rute = ['kelas', 'course', 'murid', 'rekap', 'apikey'];
    return rute.every(r => {
      const a = d.querySelector('#menu-utama a[data-rute="' + r + '"]');
      return a && a.style.display === 'none';
    });
  })());
  // biodata kurang → langsung diarahkan ke layar Biodata Saya saat boot
  cek('murid: biodata kurang → layar Biodata Saya otomatis',
      d.getElementById('layar').textContent.includes('Biodata Saya') &&
      !!d.getElementById('in-bio-email'));
  d.getElementById('profil-akun').click();
  await tunggu(200);
  cek('murid: menu akun → Biodata Saya tampil', (() => {
    const bio = d.getElementById('btn-menu-biodata');
    return bio && bio.style.display !== 'none';
  })());
  d.getElementById('btn-menu-biodata').click();
  await tunggu(400);
  cek('murid: menu akun → layar Biodata Saya terbuka',
      d.getElementById('layar').textContent.includes('Biodata Saya') &&
      !!d.getElementById('in-bio-email'));
  d.getElementById('in-bio-email').value = 'rara@contoh.id';
  d.getElementById('in-bio-wa').value = '081234567001';
  d.getElementById('in-bio-tgl').value = '2009-04-17';
  d.getElementById('btn-simpan-bio').click();
  await tunggu(500);
  cek('murid: biodata tersimpan → kembali ke beranda',
      d.getElementById('layar').textContent.includes('Halo'));
  cek('murid: kartu "belum lengkap" hilang',
      !d.getElementById('layar').textContent.includes('belum lengkap'));
  // buka lagi lewat menu akun → form TERISI dari getBiodata
  d.getElementById('profil-akun').click();
  await tunggu(200);
  d.getElementById('btn-menu-biodata').click();
  await tunggu(500);
  cek('murid: biodata terbaca balik (email terisi)',
      d.getElementById('in-bio-email').value === 'rara@contoh.id' &&
      d.getElementById('in-bio-tgl').value === '2009-04-17');
  // kartu "Kelas saya" pada beranda murid
  d.querySelector('#menu-utama a[data-rute="beranda"]').click();
  await tunggu(600);
  cek('murid: seksi "Kelas saya" tampil',
      d.getElementById('layar').textContent.includes('Kelas saya'));
  cek('murid: kartu Kelas Saya = 1 kelas (XI TKJ 1)',
      d.querySelectorAll('#wadah-kelas-saya .kartu-barang').length === 1 &&
      d.getElementById('wadah-kelas-saya').textContent.includes('XI TKJ 1'));
  cek('murid: kartu memuat daftar mapel (Matematika)',
      d.getElementById('wadah-kelas-saya').textContent.includes('Matematika'));

  console.log('');
  console.log(gagal ? `ALUR UI GAGAL ✘ — ${gagal} cek` : 'SEMUA CEK ALUR UI LULUS ✔');
  process.exit(gagal ? 1 : 0);
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
