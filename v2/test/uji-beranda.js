/* ============================================================
 *  LMS v2 — uji-beranda.js
 *  Uji Beranda ringkas §22D (ringkasDashboard):
 *  4 angka guru (kelas/course/murid/api_key) + perlu tindakan
 *  (antrean reset), ringkasan murid, endpoint dua role.
 *  Jalankan:  node v2/test/uji-beranda.js
 * ============================================================ */
require('./mock.js');
const fs = require('fs');
const path = require('path');
['Util', 'Auth', 'ApiKey', 'Code'].forEach(function (n) {
  (0, eval)(fs.readFileSync(path.join(__dirname, '..', n + '.gs'), 'utf8'));
});

let gagal = 0, no = 0;
function cek(nama, kondisi, info) {
  no++;
  if (kondisi) console.log('  OK  ' + nama);
  else { console.log('  GAGAL ' + nama + (info ? ' → ' + info : '')); gagal++; }
}
function cobalah(fn) {
  try { return fn(); }
  catch (e) { return { error: e.kode || 'GALAT', pesan: e.message }; }
}

const SESI_GURU = { user_id: 'USR-GURU', role: 'guru' };

/* ---- seed ---- */
const saltG = Util.buatSalt();
Db.tambah('Users', { user_id: 'USR-GURU', username: 'guru',
  password_hash: Util.hashPassword('guru123', saltG), salt: saltG, pwd_awal: '',
  nama: 'Guru Uji', role: 'guru', rombel: '', email: '', nisn: '', no_wa: '',
  tanggal_lahir: '', status: 'aktif', harus_ganti_password: false,
  last_login: '', created_at: new Date(), updated_at: new Date() });

function murid(id, nama, username, pwd) {
  const salt = Util.buatSalt();
  Db.tambah('Users', { user_id: id, username: username,
    password_hash: Util.hashPassword(pwd, salt), salt: salt, pwd_awal: pwd,
    nama: nama, role: 'murid', rombel: '', email: '', nisn: '', no_wa: '',
    tanggal_lahir: '', status: 'aktif', harus_ganti_password: false,
    last_login: '', created_at: new Date(), updated_at: new Date() });
}
murid('USR-M1', 'Rina Andini', 'rina.andini', 'Rina12345');
murid('USR-M2', 'Dimas Wijaya', 'dimas.wijaya', 'Dimas12345');

Db.tambah('Users', { user_id: 'USR-M3', username: 'siti.nonaktif',
  password_hash: 'x', salt: 'x', pwd_awal: '',
  nama: 'Siti Nonaktif', role: 'murid', rombel: '', email: '', nisn: '',
  no_wa: '', tanggal_lahir: '', status: 'nonaktif', harus_ganti_password: false,
  last_login: '', created_at: new Date(), updated_at: new Date() });

Db.tambah('Classes', { class_id: 'CLS-0001', name: 'XI TKJ 1',
  academic_year: '2026/2027', status: 'aktif',
  created_at: new Date(), updated_at: new Date() });
Db.tambah('Classes', { class_id: 'CLS-0002', name: 'Lama',
  academic_year: '2025/2026', status: 'arsip',
  created_at: new Date(), updated_at: new Date() });

Db.tambah('Teaching_Assignments', { teaching_assignment_id: 'TA-0001',
  class_id: 'CLS-0001', teacher_id: 'USR-GURU', subject_id: 'SBK-0001',
  academic_year: '2026/2027', status: 'aktif',
  created_at: new Date(), updated_at: new Date() });
Db.tambah('Teaching_Assignments', { teaching_assignment_id: 'TA-0002',
  class_id: 'CLS-0001', teacher_id: 'USR-GURU', subject_id: 'SBK-0002',
  academic_year: '2026/2027', status: 'aktif',
  created_at: new Date(), updated_at: new Date() });
Db.tambah('Teaching_Assignments', { teaching_assignment_id: 'TA-0003',
  class_id: 'CLS-0001', teacher_id: 'USR-GURU', subject_id: 'SBK-0003',
  academic_year: '2026/2027', status: 'nonaktif',
  created_at: new Date(), updated_at: new Date() });

Db.tambah('Enrollment', { enroll_id: 'ENR-0001', class_id: 'CLS-0001',
  user_id: 'USR-M1', tanggal_daftar: new Date(), status: 'aktif' });

console.log('\n== RINGKASAN GURU: ANGKA ==');

let r = ringkasDashboard(Auth.login('guru', 'guru123').data.token);
cek('endpoint OK & role guru', r.ok === true && r.data.role === 'guru',
    JSON.stringify(r));
let d = r.data;
cek('kelas_aktif = 1 (arsip tak dihitung)', d.kelas_aktif === 1);
cek('course_aktif = 2 (nonaktif tak dihitung)', d.course_aktif === 2);
cek('murid_aktif = 2 (nonaktif tak dihitung)', d.murid_aktif === 2);
cek('api_key: belum terpasang, maks 10',
    d.api_key.jml === 0 && d.api_key.maks === 10 && d.api_key.terpasang === false,
    JSON.stringify(d.api_key));
cek('perlu_tindakan: kosong dulu', d.perlu_tindakan.jml === 0 &&
    d.perlu_tindakan.daftar.length === 0);

console.log('\n== API KEY IKUT TERBACA ==');

const K1 = 'AIza' + 'A'.repeat(35) + '1111';
const K2 = 'AIza' + 'B'.repeat(35) + '2222';
ApiKey.simpan(SESI_GURU, [K1, K2]);
d = ringkasDashboard(Auth.login('guru', 'guru123').data.token).data;
cek('api_key jml 2 (tanpa membocorkan key)',
    d.api_key.jml === 2 && d.api_key.jml_siap === 2 &&
    JSON.stringify(d).indexOf('AIza') === -1, JSON.stringify(d.api_key));

console.log('\n== PERLU TINDAKAN: ANTREAN RESET ==');

let ajuk = Auth.ajukanReset('rina.andini');
cek('murid mengajukan reset', ajuk.diterima === true, JSON.stringify(ajuk));
d = ringkasDashboard(Auth.login('guru', 'guru123').data.token).data;
cek('perlu_tindakan jml 1 + identitas murid di daftar',
    d.perlu_tindakan.jml === 1 &&
    d.perlu_tindakan.daftar[0].username === 'rina.andini' &&
    d.perlu_tindakan.daftar[0].nama === 'Rina Andini' &&
    !!d.perlu_tindakan.daftar[0].request_id,
    JSON.stringify(d.perlu_tindakan));

/* isi antrean hingga 6 langsung (bypass batas ajukan) → daftar max 5 */
for (let i = 0; i < 5; i++) {
  Db.tambah('Permintaan_Reset', { request_id: 'RST-UJI-' + i,
    user_id: 'USR-M2', input_user: 'dimas.wijaya', status: 'antre',
    dibuat_at: new Date(Date.now() + i * 1000).toISOString(),
    diproses_at: '' });
}
d = ringkasDashboard(Auth.login('guru', 'guru123').data.token).data;
cek('jml 6 tapi daftar dipangkas 5 teratas',
    d.perlu_tindakan.jml === 6 && d.perlu_tindakan.daftar.length === 5,
    JSON.stringify({ j: d.perlu_tindakan.jml, d: d.perlu_tindakan.daftar.length }));

/* setelah guru mereset, permintaan selesai → keluar dari antrean */
const sesiG = SESI_GURU;
Auth.resetPasswordMurid(sesiG, 'USR-M1',
  d.perlu_tindakan.daftar.filter(function (x) {
    return x.user_id === 'USR-M1'; })[0].request_id);
d = ringkasDashboard(Auth.login('guru', 'guru123').data.token).data;
cek('permintaan yang selesai keluar dari hitungan',
    d.perlu_tindakan.jml === 5, JSON.stringify(d.perlu_tindakan.jml));

console.log('\n== RINGKASAN MURID ==');

let lm = Auth.login('dimas.wijaya', 'Dimas12345');
cek('murid tanpa biodata → biodata_kurang di login',
    lm.ok && lm.data.biodata_kurang === true);
r = ringkasDashboard(lm.data.token);
cek('endpoint utk murid OK & bentuk murid',
    r.ok === true && r.data.role === 'murid', JSON.stringify(r));
cek('kelas_diikuti = 0 (belum enroll)', r.data.kelas_diikuti === 0);
cek('biodata_kurang = true terbawa', r.data.biodata_kurang === true);

Kelas_tambahNotif('USR-M2');
r = ringkasDashboard(Auth.login('dimas.wijaya', 'Dimas12345').data.token);
cek('notif_baru terhitung', r.data.notif_baru === 1, JSON.stringify(r.data));

Db.tambah('Enrollment', { enroll_id: 'ENR-0002', class_id: 'CLS-0001',
  user_id: 'USR-M2', tanggal_daftar: new Date(), status: 'aktif' });
r = ringkasDashboard(Auth.login('dimas.wijaya', 'Dimas12345').data.token);
cek('kelas_diikuti terhitung setelah enroll', r.data.kelas_diikuti === 1);

/* helper kecil: tulis satu notifikasi belum dibaca */
function Kelas_tambahNotif(uid) {
  Db.tambah('Notifications', { notif_id: 'NTF-UJI-1', user_id: uid,
    jenis: 'enroll_kelas', judul: 'Anda didaftarkan ke kelas XI TKJ 1.',
    pesan: 'Anda didaftarkan ke kelas XI TKJ 1.', link: '',
    dibaca: false, created_at: new Date() });
}

console.log('\n== PENJAGA ==');

r = ringkasDashboard('token-sampah');
cek('sesi invalid ditolak', r.ok === false && r.error === 'SESI_INVALID');

/* ============ hasil ============ */
console.log('\n----------------------------------------------------');
if (gagal === 0) console.log('SEMUA ' + no + ' UJI BERANDA LULUS ✔');
else { console.log('UJI BERANDA GAGAL ✘ — ' + gagal + ' dari ' + no + '.'); process.exit(1); }
