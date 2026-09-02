/* ============================================================
 *  LMS v2 — uji-murid.js
 *  Uji logika Kelola Murid (modul Murid.gs + endpoint Code.gs)
 *  dengan Db/Cache/Utilities tiruan.
 *  Jalankan:  node v2/test/uji-murid.js
 * ============================================================ */
require('./mock.js');
const fs = require('fs');
const path = require('path');
['Util', 'Auth', 'Murid', 'Code'].forEach(function (n) {
  (0, eval)(fs.readFileSync(path.join(__dirname, '..', n + '.gs'), 'utf8'));
});

let gagal = 0, no = 0;
function cek(nama, kondisi, info) {
  no++;
  if (kondisi) console.log('  OK  ' + nama);
  else { console.log('  GAGAL ' + nama + (info ? ' → ' + info : '')); gagal++; }
}
function jml(n) { return Db.baca(n).length; }
/* panggilan langsung modul: error yang dilempar diubah jadi objek
   bentuk yang sama seperti respons endpoint */
function cobalah(fn) {
  try { return fn(); }
  catch (e) { return { error: e.kode || 'GALAT', pesan: e.message }; }
}
const SESI_GURU = { user_id: 'USR-GURU', role: 'guru' };

/* ---- seed: guru + satu kelas ---- */
const saltG = Util.buatSalt();
Db.tambah('Users', { user_id: 'USR-GURU', username: 'guru',
  password_hash: Util.hashPassword('guru123', saltG), salt: saltG, pwd_awal: '',
  nama: 'Guru Uji', role: 'guru', rombel: '', email: '', nisn: '', no_wa: '',
  status: 'aktif', harus_ganti_password: false, last_login: '',
  created_at: new Date(), updated_at: new Date() });

Db.tambah('Classes', { class_id: 'CLS-0001', name: 'XI TKJ 1',
  academic_year: '2026/2027', status: 'aktif',
  created_at: new Date(), updated_at: new Date() });

const USERS_AWAL = jml('Users');

console.log('\n== TAMBAH MURID ==');

/* --- tambah: sandi sementara otomatis --- */
let r = Murid.simpan(SESI_GURU, { nama: 'Rina Andini', username: 'Rina.Andini',
  nisn: '0091234501', no_wa: '081234567890' });
cek('murid dibuat, user_id dikembalikan', r.baru === true && !!r.user_id, JSON.stringify(r));
cek('password_sementara dikembalikan (8 kar.)', (r.password_sementara || '').length === 8);
const RINA = r.user_id, PWD_RINA = r.password_sementara;

let u = Db.cari('Users', 'user_id', RINA);
cek('username dinormalisasi lowercase', u.username === 'rina.andini');
cek('sandi tersimpan sebagai hash (bukan teks)', u.password_hash !== PWD_RINA &&
    u.password_hash.length === 64);
cek('pwd_awal terisi (terlihat guru)', u.pwd_awal === PWD_RINA);
cek('harus_ganti_password = true', u.harus_ganti_password === true);
cek('no_wa dirapikan ke 62…', u.no_wa === '6281234567890');
cek('nisn tersimpan sebagai teks', u.nisn === '0091234501');
cek('audit buat_murid tercatat',
    Db.saring('Audit_Logs', { action: 'buat_murid' }).length === 1);

/* --- tambah: sandi kustom dari guru --- */
r = Murid.simpan(SESI_GURU, { nama: 'Dimas Wijaya', username: 'dimas.wijaya',
  password: 'SandiKuat99' });
u = Db.cari('Users', 'user_id', r.user_id);
cek('sandi kustom guru dipakai', u.pwd_awal === 'SandiKuat99' &&
    u.password_hash === Util.hashPassword('SandiKuat99', u.salt));

/* --- tambah: penolakan --- */
r = cobalah(function () { return Murid.simpan(SESI_GURU, { nama: 'Tanpa User' }); });
cek('username kosong ditolak', r.error === 'VALIDASI_GAGAL', JSON.stringify(r));
r = cobalah(function () { return Murid.simpan(SESI_GURU, { nama: 'Pendek', username: 'ab' }); });
cek('username <3 kar. ditolak', r.error === 'VALIDASI_GAGAL');
r = cobalah(function () { return Murid.simpan(SESI_GURU, { nama: 'Rina Kembar', username: 'rina.andini' }); });
cek('username duplikat ditolak (DUPLIKAT)', r.error === 'DUPLIKAT', JSON.stringify(r));
r = cobalah(function () { return Murid.simpan(SESI_GURU, { username: 'tanpanama' }); });
cek('nama kosong ditolak', r.error === 'VALIDASI_GAGAL');

console.log('\n== DAFTAR & DETAIL ==');

/* --- daftar --- */
r = Murid.daftar(SESI_GURU, {});
cek('daftar memuat seluruh murid', r.length === 2, 'jml=' + r.length);
cek('urut nama (alami)', r[0].nama === 'Dimas Wijaya' && r[1].nama === 'Rina Andini');
cek('baris daftar memuat pwd_awal + sudah_ganti',
    r[1].pwd_awal === PWD_RINA && r[1].sudah_ganti === false);
cek('hash/salt TIDAK dibocorkan di daftar', r[0].password_hash === undefined &&
    r[0].salt === undefined);

r = Murid.daftar(SESI_GURU, { cari: 'rina' });
cek('cari nama cocok', r.length === 1 && r[0].user_id === RINA);
r = Murid.daftar(SESI_GURU, { cari: '0091234501' });
cek('cari NISN cocok', r.length === 1 && r[0].user_id === RINA);

/* --- murid masuk kelas → daftar menampilkan kelasnya --- */
Db.tambah('Enrollment', { enroll_id: 'ENR-0001', class_id: 'CLS-0001',
  user_id: RINA, tanggal_daftar: new Date(), status: 'aktif' });
r = Murid.daftar(SESI_GURU, {});
const rina = r.filter(function (m) { return m.user_id === RINA; })[0];
cek('kelas diikuti ikut di daftar', rina.kelas.length === 1 &&
    rina.kelas[0].name === 'XI TKJ 1', JSON.stringify(rina.kelas));

/* --- detail --- */
r = Murid.detail(SESI_GURU, RINA);
cek('detail memuat biodata + sandi', r.nama === 'Rina Andini' &&
    r.pwd_awal === PWD_RINA && r.no_wa === '6281234567890');
r = cobalah(function () { return Murid.detail(SESI_GURU, 'USR-TAKADA'); });
cek('detail user tak ada ditolak', r.error === 'TIDAK_DITEMUKAN');
r = cobalah(function () { return Murid.detail(SESI_GURU, 'USR-GURU'); });
cek('detail guru ditolak (bukan murid)', r.error === 'TIDAK_DITEMUKAN');

console.log('\n== EDIT MURID ==');

/* --- login murid dulu agar uji pencabutan sesi berarti --- */
let loginM = Auth.login('rina.andini', PWD_RINA);
cek('murid login dgn sandi sementara', loginM.ok === true, JSON.stringify(loginM));
cek('harus ganti sandi terbawa di login',
    loginM.ok && loginM.data.harus_ganti_password === true);

r = Murid.simpan(SESI_GURU, { user_id: RINA, no_wa: '081298765432' });
cek('edit sebagian (hanya no_wa) sukses', r.baru === false);
u = Db.cari('Users', 'user_id', RINA);
cek('no_wa baru dirapikan', u.no_wa === '6281298765432');
cek('nama tidak ikut berubah (edit sebagian)', u.nama === 'Rina Andini');

r = cobalah(function () { return Murid.simpan(SESI_GURU, { user_id: RINA, nisn: '12ab' }); });
cek('NISN tak sah ditolak', r.error === 'VALIDASI_GAGAL');
r = cobalah(function () { return Murid.simpan(SESI_GURU, { user_id: RINA, no_wa: 'abc' }); });
cek('no_wa tak sah ditolak', r.error === 'VALIDASI_GAGAL');
r = cobalah(function () { return Murid.simpan(SESI_GURU, { user_id: RINA, nama: '   ' }); });
cek('nama dikosongkan ditolak saat edit', r.error === 'VALIDASI_GAGAL');
r = cobalah(function () { return Murid.simpan(SESI_GURU, { user_id: 'USR-GURU', nama: 'Jadi Guru' }); });
cek('edit akun guru lewat modul murid ditolak', r.error === 'TIDAK_DITEMUKAN' ||
    r.error === 'AKSES_DITOLAK');

/* --- nonaktifkan → sesi dicabut --- */
cek('sesi murid ada sebelum nonaktif',
    Db.saring('Session', { user_id: RINA }).length >= 1);
Murid.simpan(SESI_GURU, { user_id: RINA, status: 'nonaktif' });
u = Db.cari('Users', 'user_id', RINA);
cek('status berubah nonaktif', u.status === 'nonaktif');
cek('sesi murid dicabut saat nonaktif',
    Db.saring('Session', { user_id: RINA }).length === 0);
cek('murid nonaktif ditolak saat login',
    Auth.login('rina.andini', PWD_RINA).ok === false);
r = Murid.daftar(SESI_GURU, { status: 'aktif' });
cek('filter status aktif menyingkirkan nonaktif',
    r.every(function (m) { return m.status === 'aktif'; }));
r = Murid.daftar(SESI_GURU, { status: 'nonaktif' });
cek('filter nonaktif', r.length === 1 && r[0].user_id === RINA);
Murid.simpan(SESI_GURU, { user_id: RINA, status: 'aktif' });
cek('diaktifkan kembali', Db.cari('Users', 'user_id', RINA).status === 'aktif');

console.log('\n== PWD_AWAL vs GANTI SANDI ==');

/* --- murid ganti sandi → pwd_awal terhapus (tak terlihat guru lagi) --- */
loginM = Auth.login('rina.andini', PWD_RINA);
r = Auth.gantiPassword(Auth.validasiToken(loginM.data.token), PWD_RINA, 'BaruKuat77');
cek('murid ganti sandi sukses', r.berhasil === true, JSON.stringify(r));
u = Db.cari('Users', 'user_id', RINA);
cek('pwd_awal dikosongkan setelah diganti', u.pwd_awal === '');
cek('login dgn sandi baru sukses',
    Auth.login('rina.andini', 'BaruKuat77').ok === true);
r = Murid.detail(SESI_GURU, RINA);
cek('sudah_ganti=true di daftar/detail', r.sudah_ganti === true);

console.log('\n== PRATINJAU IMPOR ==');

const TEKS_IMPOR = [
  '1. Rara Aisyah, XI TKJ 1, rara.aisyah, Rara12345',
  'Bayu Setiawan, XI TKJ 1, bayu.setiawan',          /* tanpa sandi → acak */
  'Citra Dewi, XI TKJ 1',                            /* 2 kolom dgn spasi → rombel */
  'Rina Andini, XI TKJ 1, rina.andini, Rina12345',   /* username duplikat → akhiran */
  'Rina Andini, XI TKJ 1, rina.andini, Lemah',       /* sandi lemah → masalah */
  'X'                                                /* nama pendek → masalah */
].join('\n');

r = Murid.pratinjauImpor(SESI_GURU, TEKS_IMPOR);
cek('pratinjau: total 6 baris', r.total === 6, JSON.stringify(r.total));
cek('pratinjau: 4 siap, 2 bermasalah', r.siap.length === 4 && r.masalah.length === 2,
    JSON.stringify({ siap: r.siap.length, masalah: r.masalah.length }));
cek('pratinjau: alasan sandi lemah tertulis',
    r.masalah.some(function (m) { return /huruf|angka|6 karakter/.test(m.alasan); }),
    JSON.stringify(r.masalah));
const rara = r.siap[0];
cek('pratinjau: kolom terpetakan (nama,rombel,username)',
    rara.nama === 'Rara Aisyah' && rara.rombel === 'XI TKJ 1' &&
    rara.username === 'rara.aisyah' && rara.sandi_sendiri === true);
cek('pratinjau: rina.andini duplikat diganti akhiran',
    r.siap.some(function (x) { return x.username === 'rina.andini2' && x.diubah; }),
    JSON.stringify(r.siap.map(function (x) { return x.username; })));
const citra = r.siap.filter(function (x) { return x.nama === 'Citra Dewi'; })[0];
cek('pratinjau: 2 kolom ber-spasi = rombel, username otomatis',
    citra.rombel === 'XI TKJ 1' && citra.username === 'citrad' &&
    citra.sandi_sendiri === false, JSON.stringify(citra));
cek('pratinjau TIDAK menulis ke DB', jml('Users') === USERS_AWAL + 2);

/* pratinjau == hasil impor (pemetaan sama) */
r2 = Murid.impor(SESI_GURU, TEKS_IMPOR);
cek('impor: jumlah sama dgn pratinjau (4 baru, 2 gagal)',
    r2.jml_baru === 4 && r2.jml_gagal === 2, JSON.stringify({ b: r2.jml_baru, g: r2.jml_gagal }));
const rara2 = r2.hasil.filter(function (x) { return x.nama === 'Rara Aisyah'; })[0];
cek('impor: username konsisten dgn pratinjau', rara2.username === 'rara.aisyah');
cek('impor: sandi kustom guru dipakai, TIDAK wajib ganti',
    rara2.password === 'Rara12345' && rara2.sandi_sendiri === true);
const bayu2 = r2.hasil.filter(function (x) { return x.nama === 'Bayu Setiawan'; })[0];
cek('impor: sandi acak utk baris tanpa sandi + wajib ganti',
    bayu2.password.length === 8 && bayu2.sandi_sendiri === false);
const bayuRow = Db.cari('Users', 'user_id', bayu2.user_id);
cek('impor: pwd_awal terisi & hash tersimpan',
    bayuRow.pwd_awal === bayu2.password &&
    bayuRow.password_hash === Util.hashPassword(bayu2.password, bayuRow.salt));
cek('impor: duplikat in-batch akhiran benar',
    r2.hasil.some(function (x) { return x.username === 'rina.andini2'; }));
cek('impor: audit tercatat',
    Db.saring('Audit_Logs', { action: 'impor_murid' }).length === 1);

console.log('\n== BATAS IMPOR ==');

r = cobalah(function () { return Murid.pratinjauImpor(SESI_GURU, ''); });
cek('impor teks kosong ditolak', r.error === 'VALIDASI_GAGAL');
const seratus_satu = Array.apply(null, Array(101))
  .map(function (_, i) { return 'Murid ' + i + ', X-1, m' + i; }).join('\n');
r = cobalah(function () { return Murid.pratinjauImpor(SESI_GURU, seratus_satu); });
cek('pratinjau >100 baris ditolak', r.error === 'VALIDASI_GAGAL');
r = cobalah(function () { return Murid.impor(SESI_GURU, seratus_satu); });
cek('impor >100 baris ditolak', r.error === 'VALIDASI_GAGAL');

console.log('\n== ENDPOINT (Code.gs) ==');

const TOKEN_G = Auth.login('guru', 'guru123').data.token;
const TOKEN_M = Auth.login('dimas.wijaya', 'SandiKuat99').data.token;

r = muridDaftar(TOKEN_M, {});
cek('endpoint muridDaftar ditolak utk role murid', r.ok === false &&
    r.error === 'AKSES_DITOLAK', JSON.stringify(r));
r = muridDaftar(TOKEN_G, { cari: 'bayu' });
cek('endpoint muridDaftar utk guru OK', r.ok === true && r.data.length === 1);
r = muridSimpan(TOKEN_M, { nama: 'X' });
cek('endpoint muridSimpan ditolak utk murid', r.ok === false);
r = muridDetail('token-sampah', RINA);
cek('endpoint tanpa sesi valid ditolak', r.ok === false &&
    r.error === 'SESI_INVALID');

/* ============ hasil ============ */
console.log('\n----------------------------------------------------');
if (gagal === 0) console.log('SEMUA ' + no + ' UJI MURID LULUS ✔');
else { console.log('UJI MURID GAGAL ✘ — ' + gagal + ' dari ' + no + ' kasus.'); process.exit(1); }
