/* ============================================================
 *  LMS v2 — uji-kelas.js
 *  Uji logika Kelola Kelas (modul Kelas.gs + endpoint Code.gs):
 *  CRUD + arsip, detail + pwd_awal, murid tersedia, enroll
 *  (dedupe/reaktivasi + notif), keluarkan.
 *  Jalankan:  node v2/test/uji-kelas.js
 * ============================================================ */
require('./mock.js');
const fs = require('fs');
const path = require('path');
['Util', 'Auth', 'Murid', 'Kelas', 'Course', 'Code'].forEach(function (n) {
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
function jml(n) { return Db.baca(n).length; }

const SESI_GURU = { user_id: 'USR-GURU', role: 'guru' };

/* ---- seed: guru + 3 murid (2 ber-biodata utk pwd_awal uji) ---- */
const saltG = Util.buatSalt();
Db.tambah('Users', { user_id: 'USR-GURU', username: 'guru',
  password_hash: Util.hashPassword('guru123', saltG), salt: saltG, pwd_awal: '',
  nama: 'Guru Uji', role: 'guru', rombel: '', email: '', nisn: '', no_wa: '',
  tanggal_lahir: '', status: 'aktif', harus_ganti_password: false,
  last_login: '', created_at: new Date(), updated_at: new Date() });

function murid(id, nama, username, pwdAwal) {
  const salt = Util.buatSalt();
  Db.tambah('Users', { user_id: id, username: username,
    password_hash: Util.hashPassword(pwdAwal, salt), salt: salt, pwd_awal: pwdAwal,
    nama: nama, role: 'murid', rombel: '', email: '', nisn: '', no_wa: '',
    tanggal_lahir: '', status: 'aktif', harus_ganti_password: false,
    last_login: '', created_at: new Date(), updated_at: new Date() });
}
murid('USR-M1', 'Rina Andini', 'rina.andini', 'Rina12345');
murid('USR-M2', 'Dimas Wijaya', 'dimas.wijaya', '');
murid('USR-M3', 'Siti Lestari', 'siti.lestari', 'Siti12345');

console.log('\n== BUAT & EDIT KELAS ==');

let r = cobalah(function () { return Kelas.simpan(SESI_GURU, { name: ' ' }); });
cek('nama kosong ditolak', r.error === 'VALIDASI_GAGAL');
r = cobalah(function () { return Kelas.simpan(SESI_GURU, { name: 'X' }); });
cek('nama 1 karakter ditolak', r.error === 'VALIDASI_GAGAL');

r = Kelas.simpan(SESI_GURU, { name: 'XI TKJ 1' });
cek('kelas dibuat + class_id KLS', r.baru === true && /^KLS-/.test(r.class_id),
    JSON.stringify(r));
const K1 = r.class_id;
const thn = new Date().getFullYear();
const thnAjaran = new Date().getMonth() >= 6
  ? thn + '/' + (thn + 1) : (thn - 1) + '/' + thn;
cek('academic_year otomatis tahun ajaran berjalan',
    r.academic_year === thnAjaran, r.academic_year);

r = cobalah(function () { return Kelas.simpan(SESI_GURU, { name: 'xi tkj 1' }); });
cek('nama kembar (tak peka huruf) ditolak DUPLIKAT', r.error === 'DUPLIKAT');

r = Kelas.simpan(SESI_GURU, { name: 'XI TKJ 2' });
const K2 = r.class_id;
r = Kelas.simpan(SESI_GURU, { class_id: K2, name: 'XI TKJ 2 B' });
cek('edit nama sukses', r.baru === false &&
    Db.cari('Classes', 'class_id', K2).name === 'XI TKJ 2 B');
r = cobalah(function () {
  return Kelas.simpan(SESI_GURU, { class_id: K2, name: 'XI TKJ 1' });
});
cek('edit ke nama kelas lain ditolak', r.error === 'DUPLIKAT');

console.log('\n== DAFTAR KELAS ==');

/* TA dummy: kelas 1 dipakai 2 course, kelas 2 kosong */
Db.tambah('Teaching_Assignments', { teaching_assignment_id: 'TA-0001',
  class_id: K1, teacher_id: 'USR-GURU', subject_id: 'SBK-0001',
  academic_year: thnAjaran, status: 'aktif',
  created_at: new Date(), updated_at: new Date() });
Db.tambah('Teaching_Assignments', { teaching_assignment_id: 'TA-0002',
  class_id: K1, teacher_id: 'USR-GURU', subject_id: 'SBK-0002',
  academic_year: thnAjaran, status: 'aktif',
  created_at: new Date(), updated_at: new Date() });
Db.tambah('Teaching_Assignments', { teaching_assignment_id: 'TA-0003',
  class_id: K1, teacher_id: 'USR-GURU', subject_id: 'SBK-0003',
  academic_year: thnAjaran, status: 'nonaktif',
  created_at: new Date(), updated_at: new Date() });

r = Kelas.daftar(SESI_GURU);
cek('daftar 2 kelas urut nama', r.length === 2 &&
    r[0].name === 'XI TKJ 1' && r[1].name === 'XI TKJ 2 B');
cek('jml_course menghitung yang aktif saja',
    r[0].jml_course === 2 && r[1].jml_course === 0,
    JSON.stringify(r.map(function (x) { return x.jml_course; })));
cek('jml_murid 0 sebelum enroll', r[0].jml_murid === 0);

console.log('\n== ENROLL: BARU, LEWAT, REAKTIVASI, NOTIF ==');

r = cobalah(function () { return Kelas.enroll(SESI_GURU, K1, []); });
cek('userIds kosong ditolak', r.error === 'VALIDASI_GAGAL');
r = cobalah(function () { return Kelas.enroll(SESI_GURU, 'KLS-TAKADA', ['USR-M1']); });
cek('kelas tak ada ditolak', r.error === 'TIDAK_DITEMUKAN');

r = Kelas.enroll(SESI_GURU, K1, ['USR-M1', 'USR-M2', 'USR-GURU']);
cek('enroll: 2 ditambah, guru (non-murid) dilewati',
    r.ditambah === 2 && r.dilewati === 1, JSON.stringify(r));
cek('baris Enrollment baru', jml('Enrollment') === 2);
cek('notif enroll_kelas ditulis hanya utk yang berubah',
    Db.saring('Notifications', { jenis: 'enroll_kelas' }).length === 2);

const jmlNotif = jml('Notifications');
r = Kelas.enroll(SESI_GURU, K1, ['USR-M1', 'USR-M2']);
cek('re-enroll yang sudah aktif → semua dilewati, tanpa notif baru',
    r.ditambah === 0 && r.dilewati === 0 && jml('Notifications') === jmlNotif,
    JSON.stringify(r));

r = Kelas.keluarkan(SESI_GURU, K1, 'USR-M2');
cek('keluarkan sukses', r.dikeluarkan === true);
cek('murid hilang dari hitungan kelas',
    Kelas.daftar(SESI_GURU)[0].jml_murid === 1);
r = cobalah(function () { return Kelas.keluarkan(SESI_GURU, K1, 'USR-M2'); });
cek('keluarkan dua kali ditolak (tak terdaftar aktif)',
    r.error === 'TIDAK_DITEMUKAN');

r = Kelas.enroll(SESI_GURU, K1, ['USR-M2']);
cek('enroll ulang → baris lama DIAKTIFKAN (reaktivasi)',
    r.diaktifkan === 1 && jml('Enrollment') === 2, JSON.stringify(r));
cek('notif reaktivasi terkirim', jml('Notifications') === jmlNotif + 1);
const m2 = Db.saring('Enrollment', { class_id: K1, user_id: 'USR-M2' })[0];
cek('tanggal_daftar diperbarui saat reaktivasi', m2.status === 'aktif' && !!m2.tanggal_daftar);

console.log('\n== DETAIL & MURID TERSEDIA ==');

r = Kelas.detail(SESI_GURU, K1);
cek('detail: 2 murid urut nama', r.jml_murid === 2 &&
    r.murid[0].nama === 'Dimas Wijaya' && r.murid[1].nama === 'Rina Andini');
cek('detail: pwd_awal & sudah_ganti benar',
    r.murid[0].sudah_ganti === true &&
    r.murid[1].pwd_awal === 'Rina12345' && r.murid[1].sudah_ganti === false);
cek('detail: jml_course terbawa', r.jml_course === 2);

/* Siti ikut kelas lain dulu → info "kelas lain" teruji bermakna */
Kelas.enroll(SESI_GURU, K2, ['USR-M3']);
r = Kelas.muridTersedia(SESI_GURU, K1);
cek('tersedia: hanya Siti (satu2nya yang belum di K1)',
    r.length === 1 && r[0].user_id === 'USR-M3', JSON.stringify(r.map(function (x) { return x.nama; })));
cek('tersedia: kelas lain (XI TKJ 2 B) terlihat utk membedakan nama sama',
    r[0].kelas.length === 1 && r[0].kelas[0].name === 'XI TKJ 2 B',
    JSON.stringify(r[0].kelas));
cek('tersedia: rombel (Users) terbawa utk filter dialog',
    r[0].rombel !== undefined, JSON.stringify(r[0]));
cek('tersedia: murid nonaktif tidak muncul', r.every(function (x) {
  return Db.cari('Users', 'user_id', x.user_id).status === 'aktif'; }));

r = cobalah(function () { return Kelas.detail(SESI_GURU, 'KLS-TAKADA'); });
cek('detail kelas tak ada ditolak', r.error === 'TIDAK_DITEMUKAN');

console.log('\n== ARSIP (SOFT DELETE) ==');

r = cobalah(function () { return Kelas.arsip(SESI_GURU, K1); });
cek('arsip ditolak bila masih dipakai course aktif',
    r.error === 'VALIDASI_GAGAL' && /course/.test(r.pesan), JSON.stringify(r));

Db.perbarui('Teaching_Assignments', 2, { status: 'nonaktif' });
Db.perbarui('Teaching_Assignments', 3, { status: 'nonaktif' });
r = Kelas.arsip(SESI_GURU, K1);
cek('arsip sukses setelah course nonaktif', r.diarsipkan === true);
cek('kelas arsip hilang dari daftar', Kelas.daftar(SESI_GURU).length === 1);
cek('baris kelas masih ada (soft delete)',
    Db.cari('Classes', 'class_id', K1).status === 'arsip');
r = Kelas.simpan(SESI_GURU, { name: 'XI TKJ 1' });
cek('nama kelas terarsip boleh dipakai lagi', r.baru === true);

console.log('\n== ENDPOINT (Code.gs) ==');

const TOKEN_G = Auth.login('guru', 'guru123').data.token;
r = kelasDaftar(TOKEN_G);
cek('endpoint kelasDaftar (guru) OK', r.ok === true && r.data.length === 2,
    JSON.stringify(r));
r = kelasDetail(TOKEN_G, K2);
cek('endpoint kelasDetail OK', r.ok === true && r.data.class_id === K2);
r = kelasSimpan(TOKEN_G, { name: 'X RPL 1' });
cek('endpoint kelasSimpan OK', r.ok === true && r.data.baru === true);
const K3 = r.data.class_id;
r = kelasEnroll(TOKEN_G, K3, ['USR-M1']);
cek('endpoint kelasEnroll OK', r.ok === true && r.data.ditambah === 1, JSON.stringify(r));
r = kelasKeluarkan(TOKEN_G, K3, 'USR-M1');
cek('endpoint kelasKeluarkan OK', r.ok === true, JSON.stringify(r));
r = kelasMuridTersedia(TOKEN_G, K2);
cek('endpoint kelasMuridTersedia OK', r.ok === true && Array.isArray(r.data));
r = cobalah(function () { return Kelas.simpan({ user_id: 'x', role: 'guru' }, {}); });
cek('validasi tetap jalan lewat modul', r.error === 'VALIDASI_GAGAL');

/* role murid ditolak di seluruh endpoint kelas */
const TOKEN_M = Auth.login('rina.andini', 'Rina12345').data.token;
['kelasDaftar', 'kelasDetail', 'kelasSimpan', 'kelasArsip',
 'kelasMuridTersedia', 'kelasEnroll', 'kelasKeluarkan'].forEach(function (fn) {
  const args = fn === 'kelasSimpan' ? [{ name: 'Y' }]
    : fn === 'kelasEnroll' ? ['KLS-x', []] : ['KLS-x'];
  const hasil = global[fn].apply(null, [TOKEN_M].concat(args));
  cek('endpoint ' + fn + ' ditolak utk murid',
      hasil.ok === false && hasil.error === 'AKSES_DITOLAK');
});

console.log('\n== KELAS SAYA (murid — kartu dashboard) ==');

/* endpoint baru: khusus murid */
r = kelasSaya(TOKEN_M);
cek('endpoint kelasSaya OK utk murid',
    r.ok === true && Array.isArray(r.data), JSON.stringify(r));

/* rina (USR-M1) enroll ke K2 + course aktif → terlihat dgn mapel */
r = kelasEnroll(TOKEN_G, K2, ['USR-M1']);
cek('prasyarat: rina ter-enroll ke K2',
    r.ok === true && r.data.ditambah === 1, JSON.stringify(r));
r = courseSimpan(TOKEN_G, { class_id: K2, name: 'Matematika' });
cek('prasyarat: course Matematika aktif di K2', r.ok === true, JSON.stringify(r));
r = kelasSaya(TOKEN_M);
const KS = r.data[0] || {};
cek('kelas terlihat dgn nama + TA + mapel terurut',
    r.ok === true && r.data.length === 1 &&
    KS.name === 'XI TKJ 2 B' && KS.jml_course === 1 &&
    KS.course[0] === 'Matematika', JSON.stringify(r));

/* kelas terarsip (enrollment lama masih ada) tidak muncul:
   rina punya riwayat enroll di K1 yang terarsip — hanya K2 yang tampil */
cek('kelas terarsip tidak muncul di kelasSaya', r.data.length === 1);

/* siti di-keluarkan dari K2 (dia enroll pada uji tersedia) → kosong */
Kelas.keluarkan(SESI_GURU, K2, 'USR-M3');
const TOKEN_S = Auth.login('siti.lestari', 'Siti12345').data.token;
r = kelasSaya(TOKEN_S);
cek('murid tanpa enrollment aktif → daftar kosong',
    r.ok === true && r.data.length === 0, JSON.stringify(r));

/* guru ditolak */
r = kelasSaya(TOKEN_G);
cek('kelasSaya ditolak utk guru (AKSES_DITOLAK)',
    r.ok === false && r.error === 'AKSES_DITOLAK', JSON.stringify(r));

/* ============ hasil ============ */
console.log('\n----------------------------------------------------');
if (gagal === 0) console.log('SEMUA ' + no + ' UJI KELAS LULUS ✔');
else { console.log('UJI KELAS GAGAL ✘ — ' + gagal + ' dari ' + no + '.'); process.exit(1); }
