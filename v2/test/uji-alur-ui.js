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

  // --- §5.8: masuk pakai Nomor WA (murid) ---
  d.getElementById('btn-mode-wa').click();
  await tunggu(200);
  cek('WA: mode ganti — form WA tampil, form username hilang',
      d.getElementById('form-login-wa').style.display !== 'none' &&
      d.getElementById('form-login').style.display === 'none' &&
      d.getElementById('btn-mode-wa').textContent.includes('nama pengguna'));
  d.getElementById('in-wa').value = '081234567003';
  d.getElementById('in-wa-tgl').value = '1999-01-01';
  d.getElementById('btn-masuk-wa').click();
  await tunggu(500);
  cek('WA: salah tgl lahir → pesan netral, tetap di login',
      d.getElementById('salah-wa').textContent.includes('tidak cocok') &&
      !!d.getElementById('form-login-wa'));
  d.getElementById('in-wa-tgl').value = '2009-05-10';
  d.getElementById('btn-masuk-wa').click();
  await tunggu(700);
  cek('WA: benar → langsung masuk sbg murid (tanpa ganti sandi/biodata)',
      !d.getElementById('form-login-wa') &&
      d.getElementById('layar').textContent.includes('Citra Maharani') &&
      !d.getElementById('layar').textContent.includes('Ganti Kata Sandi'));
  cek('WA: sidebar murid (5 menu guru tersembunyi)', (() => {
    const rute = ['kelas', 'course', 'murid', 'rekap', 'apikey'];
    return rute.every(r => {
      const a = d.querySelector('#menu-utama a[data-rute="' + r + '"]');
      return a && a.style.display === 'none';
    });
  })());

  // kembali ke login utk alur guru berikutnya
  dom.window.close();
  dom = buatDom(); w = dom.window; d = w.document;
  await tunggu(400);

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

  // --- Perlu Tindakan: baris bisa diklik → reset langsung ---
  cek('beranda: 2 baris tindakan bisa diklik',
      d.querySelectorAll('#layar .tindak-baris').length === 2);
  d.querySelectorAll('#layar .tindak-baris')[0].click();
  await tunggu(250);
  cek('beranda: klik siswa → konfirmasi reset',
      d.querySelector('.kotak-dialog') &&
      d.querySelector('.kotak-dialog').textContent.includes('Reset kata sandi?'));
  d.querySelector('.kotak-dialog [data-aksi="ya"]').click();
  await tunggu(500);
  cek('beranda: reset sukses → dialog sandi sementara',
      d.querySelector('.kotak-dialog') &&
      d.querySelector('.kotak-dialog').textContent.includes('sandi sementara baru'));
  d.querySelector('.kotak-dialog [data-aksi="ya"]').click();
  await tunggu(600);
  cek('beranda: antrean berkurang 2 → 1 setelah reset',
      d.querySelectorAll('#layar .tindak-baris').length === 1 &&
      d.getElementById('layar').textContent.includes('1 permintaan reset'));

  // --- tombol Lihat → daftar lengkap yang bisa digulir ---
  d.getElementById('btn-pt-lihat').click();
  await tunggu(500);
  cek('beranda: "Lihat" → daftar lengkap (1 sisa) + catatan jenis lain',
      d.querySelector('.kotak-dialog') &&
      d.querySelectorAll('#tindak-list .tindak-baris').length === 1 &&
      d.querySelector('.kotak-dialog').textContent.includes('Tahap 4–5'));
  d.querySelector('.kotak-dialog [data-aksi="ya"]').click();
  await tunggu(250);
  await tunggu(500);
  cek('beranda: 4 course terdaftar', d.querySelectorAll('#wadah-course .barang-course').length === 4);
  cek('beranda: course pertama = aktif teratas', d.querySelector('#wadah-course .barang-course .badge').textContent.includes('Aktif'));
  d.querySelector('#wadah-course .barang-course').click();
  await tunggu(400);
  cek('klik course beranda → LANGSUNG buka course (Kelola Topik & Item)',
      d.getElementById('layar').textContent.includes('Susunan course') &&
      d.getElementById('jd-c').textContent === 'Bahasa Indonesia' &&
      !!d.getElementById('wadah-susunan'));
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

  // tanggal lahir kini bisa diisi guru (dipakai login WA & pemulihan akses)
  d.querySelector('#wadah-tabel [data-edit]').click();
  await tunggu(300);
  cek('murid: form edit punya input tanggal lahir', !!d.getElementById('in-m-tgl'));
  d.getElementById('in-m-tgl').value = '2009-04-17';
  d.querySelector('.kotak-dialog [data-aksi="ya"]').click();
  await tunggu(500);
  cek('murid: tanggal lahir tersimpan (toast "Perubahan tersimpan")',
      d.getElementById('toast-wadah').textContent.includes('Perubahan tersimpan'));

  // --- Kelola Kelas: DROPDOWN kelas + tabel siswa (permintaan) ---
  d.querySelector('#menu-utama a[data-rute="kelas"]').click();
  await tunggu(500);
  cek('kelas: dropdown terisi (3 kelas + opsi kosong)',
      d.getElementById('sel-kelas') &&
      d.getElementById('sel-kelas').options.length === 4);
  cek('kelas: tombol Arsipkan ada & mati sebelum memilih',
      !!d.getElementById('btn-arsip-kelas') &&
      d.getElementById('btn-arsip-kelas').disabled);
  cek('kelas: tombol aksi mati sebelum memilih',
      d.getElementById('btn-enroll').disabled === true &&
      d.getElementById('btn-edit-kelas').disabled === true);
  cek('kelas: sebelum memilih → pesan "Pilih kelas"',
      d.getElementById('wadah-tabel').textContent.includes('Pilih kelas'));
  d.getElementById('sel-kelas').value = 'k1';
  d.getElementById('sel-kelas').dispatchEvent(new w.Event('change'));
  await tunggu(500);
  cek('kelas: tabel siswa muncul setelah memilih (3 baris)',
      d.querySelectorAll('#wadah-tabel tbody tr').length === 3 &&
      d.getElementById('info-kelas').textContent.includes('XI TKJ 1'));
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
  cek('kelas: enroll sukses → tabel siswa bertambah (4 baris)',
      !d.querySelector('.kotak-dialog') &&
      d.querySelectorAll('#wadah-tabel tbody tr').length === 4 &&
      d.getElementById('info-kelas').textContent.includes('4 siswa terdaftar'));

  // --- Arsip kelas (FR-011) ---
  const selK = d.getElementById('sel-kelas');
  selK.value = 'k3';
  selK.dispatchEvent(new w.Event('change', { bubbles: true }));
  await tunggu(500);
  d.getElementById('btn-arsip-kelas').click();
  await tunggu(300);
  cek('kelas: konfirmasi arsip tampil',
      d.querySelector('.kotak-dialog').textContent.includes('Arsipkan'));
  d.querySelector('.kotak-dialog [data-aksi="ya"]').click();
  await tunggu(500);
  cek('kelas: k3 diarsipkan → dropdown tersisa 2 kelas (+opsi kosong)',
      d.getElementById('sel-kelas').options.length === 3 &&
      d.getElementById('toast-wadah').textContent.includes('diarsipkan'));

  // --- Kelola Course: kisi kartu → layar Kelola Topik & Item (poin 1) ---
  d.querySelector('#menu-utama a[data-rute="course"]').click();
  await tunggu(500);
  cek('course: kartu course tampil (4)',
      d.querySelectorAll('#wadah-kisi .kartu-barang').length === 4);
  d.querySelector('#wadah-kisi [data-buka]').click();
  await tunggu(500);
  cek('detail = layar Kelola Topik & Item (jd-c terisi)',
      d.getElementById('jd-c').textContent === 'Matematika' &&
      d.getElementById('jd-c-sub').textContent.includes('murid') &&
      d.getElementById('layar').textContent.includes('Susunan course') &&
      d.getElementById('layar').textContent.includes('Refleksi mandiri'));
  cek('susunan: 4 baris gabungan bernomor 1..4',
      d.querySelectorAll('#wadah-susunan .baris-susunan').length === 4 &&
      [...d.querySelectorAll('#wadah-susunan .nomor-sus')].map(x => x.textContent).join('') === '1234');
  cek('topik pertama terbuka dgn 3 item',
      d.querySelectorAll('.isi-topik .baris-item-sus').length === 3 &&
      d.querySelector('.isi-topik').textContent.includes('Materi'));
  cek('baris terjadwal ber-badge 🕐', !!d.querySelector('#wadah-susunan .badge-jadwal'));

  // klik area baris topik → buka/tutup
  d.querySelector('.baris-susunan.buka-toggle .sus-tengah').click();
  await tunggu(300);
  cek('klik baris topik → tutup (isi hilang)', d.querySelectorAll('.isi-topik').length === 0);
  d.querySelector('.baris-susunan.buka-toggle .sus-judul').click();
  await tunggu(300);
  cek('klik lagi → terbuka', d.querySelectorAll('.isi-topik').length === 1);

  // ＋ Topik = FORM buat (pola "+ Pertemuan" v1) → draf di dasar
  d.getElementById('btn-buat-topik').click();
  await tunggu(300);
  cek('dialog "Buat Topik" terbuka (jenis terkunci)',
      !!d.getElementById('in-s-judul') &&
      d.querySelector('.kotak-dialog h3').textContent.includes('Buat Topik') &&
      !!d.querySelector('.kotak-dialog input[disabled]'));
  d.getElementById('in-s-judul').value = 'Aliran data';
  d.querySelector('.kotak-dialog [data-aksi="ya"]').click();
  await tunggu(500);
  let baris5 = d.querySelectorAll('#wadah-susunan .baris-susunan')[4];
  cek('topik baru = baris 5 paling dasar (draf)',
      d.querySelectorAll('#wadah-susunan .baris-susunan').length === 5 &&
      baris5.textContent.includes('Aliran data') &&
      baris5.querySelector('.badge-draf') !== null);

  // ＋ Item = form dgn pilihan 5 jenis §7.8
  d.querySelector('.isi-topik [data-aksi="tambah-item"]').click();
  await tunggu(300);
  cek('dialog "Buat Item" + select 5 jenis',
      d.querySelector('.kotak-dialog h3').textContent.includes('Buat Item') &&
      d.getElementById('in-s-jenis').options.length === 5);
  d.getElementById('in-s-jenis').value = 'tugas_kelompok';
  d.getElementById('in-s-judul').value = 'Proyek kelompok';
  d.querySelector('.kotak-dialog [data-aksi="ya"]').click();
  await tunggu(500);
  cek('item baru muncul dlm topik (Tugas Kelompok)',
      d.querySelector('.isi-topik').textContent.includes('Proyek kelompok') &&
      d.querySelector('.isi-topik').textContent.includes('Tugas Kelompok'));

  // ▼ tukar tetangga + renumber
  d.querySelector('#wadah-susunan .baris-susunan [data-aksi="bawah"]').click();
  await tunggu(400);
  cek('▼ menukar posisi (baris 1 kini Tryout terjadwal)',
      d.querySelector('#wadah-susunan .baris-susunan').textContent.includes('Tryout operasi hitung'));
  cek('nomor tetap 1..5',
      [...d.querySelectorAll('#wadah-susunan .nomor-sus')].map(x => x.textContent).join('') === '12345');

  // 🙈 pada terjadwal → jadwal dibatalkan
  d.querySelector('#wadah-susunan .baris-susunan [data-aksi="status"]').click();
  await tunggu(400);
  cek('🙈 → jadwal DIBATALKAN (badge 🕐 hilang + toast)',
      !d.querySelector('#wadah-susunan .badge-jadwal') &&
      d.getElementById('toast-wadah').textContent.includes('DIBATALKAN'));

  // 🕐 jadwalkan ulang
  d.querySelector('#wadah-susunan .baris-susunan [data-aksi="jadwal"]').click();
  await tunggu(300);
  cek('dialog jadwal (datetime-local) terbuka', !!d.getElementById('in-s-jadwal'));
  d.getElementById('in-s-jadwal').value = '2026-09-15T07:30';
  d.querySelector('.kotak-dialog [data-aksi="ya"]').click();
  await tunggu(400);
  cek('🕐 jadwal terpasang kembali', !!d.querySelector('#wadah-susunan .badge-jadwal'));

  // ✏️ ubah judul (jenis terkunci)
  d.querySelector('#wadah-susunan .baris-susunan [data-aksi="ubah"]').click();
  await tunggu(300);
  cek('dialog "Ubah — Quiz mandiri" + jenis disabled',
      d.querySelector('.kotak-dialog h3').textContent.includes('Ubah — Quiz mandiri') &&
      !!d.querySelector('.kotak-dialog input[disabled]'));
  d.getElementById('in-s-judul').value = 'Tryout operasi hitung v2';
  d.querySelector('.kotak-dialog [data-aksi="ya"]').click();
  await tunggu(400);
  cek('✏️ judul berubah', d.querySelector('#wadah-susunan .baris-susunan').textContent.includes('v2'));

  // 🗑 hapus dgn konfirmasi
  d.querySelector('#wadah-susunan .baris-susunan [data-aksi="hapus"]').click();
  await tunggu(300);
  cek('🗑 dialog konfirmasi hapus', d.querySelector('.kotak-dialog h3').textContent.includes('Hapus'));
  d.querySelector('.kotak-dialog [data-aksi="ya"]').click();
  await tunggu(400);
  cek('baris terhapus → 4 baris, nomor 1..4',
      d.querySelectorAll('#wadah-susunan .baris-susanan, #wadah-susunan .baris-susunan').length === 4 &&
      [...d.querySelectorAll('#wadah-susunan .nomor-sus')].map(x => x.textContent).join('') === '1234');

  // kembali → kisi; buat course baru (5 kartu)
  d.getElementById('btn-kembali-c').click();
  await tunggu(300);
  cek('course: kembali ke kisi (4 kartu)',
      d.querySelectorAll('#wadah-kisi .kartu-barang').length === 4);
  d.getElementById('btn-tambah').click();
  await tunggu(400);
  cek('course: dialog buat (pilih kelas — k3 terarsip, tersisa 2)',
      d.getElementById('in-c-kelas').options.length === 3);
  d.getElementById('in-c-kelas').value = 'k1';
  d.getElementById('in-c-mapel').value = 'Informatika';
  d.querySelector('.kotak-dialog [data-aksi="ya"]').click();
  await tunggu(500);
  cek('course: jadi 5 kartu', d.querySelectorAll('#wadah-kisi .kartu-barang').length === 5);

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
  d.getElementById('btn-lonceng').click();   // tutup
  await tunggu(250);
  d.getElementById('btn-lonceng').click();   // buka lagi
  await tunggu(500);
  cek('lonceng: buka kedua kali → semua dibaca (tanpa titik belum)',
      d.querySelectorAll('#lonceng-isi .notif-item.belum').length === 0);

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
