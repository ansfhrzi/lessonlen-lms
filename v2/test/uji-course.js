/* ============================================================
 *  LMS v2 — uji-course.js
 *  Uji logika Kelola Course (modul Course.gs + endpoint):
 *  buat = kelas + mapel bebas (dedupe Subjects), duplikat ditolak,
 *  daftar + label + hitungan murid, edit, hapus → reaktivasi.
 *  Jalankan:  node v2/test/uji-course.js
 * ============================================================ */
require('./mock.js');
const fs = require('fs');
const path = require('path');
['Util', 'Auth', 'Kelas', 'Course', 'Code'].forEach(function (n) {
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

/* ---- seed: guru, 2 kelas, 2 murid (1 ter-enroll di K1) ---- */
const saltG = Util.buatSalt();
Db.tambah('Users', { user_id: 'USR-GURU', username: 'guru',
  password_hash: Util.hashPassword('guru123', saltG), salt: saltG, pwd_awal: '',
  nama: 'Guru Uji', role: 'guru', rombel: '', email: '', nisn: '', no_wa: '',
  tanggal_lahir: '', status: 'aktif', harus_ganti_password: false,
  last_login: '', created_at: new Date(), updated_at: new Date() });
Db.tambah('Classes', { class_id: 'CLS-0001', name: 'XI TKJ 1',
  academic_year: '2026/2027', status: 'aktif',
  created_at: new Date(), updated_at: new Date() });
Db.tambah('Classes', { class_id: 'CLS-0002', name: 'XI TKJ 2',
  academic_year: '2026/2027', status: 'aktif',
  created_at: new Date(), updated_at: new Date() });
const saltM = Util.buatSalt();
Db.tambah('Users', { user_id: 'USR-M1', username: 'rina.andini',
  password_hash: Util.hashPassword('Rina12345', saltM), salt: saltM, pwd_awal: '',
  nama: 'Rina Andini', role: 'murid', rombel: '', email: '', nisn: '', no_wa: '',
  tanggal_lahir: '', status: 'aktif', harus_ganti_password: false,
  last_login: '', created_at: new Date(), updated_at: new Date() });
Db.tambah('Enrollment', { enroll_id: 'ENR-0001', class_id: 'CLS-0001',
  user_id: 'USR-M1', tanggal_daftar: new Date(), status: 'aktif' });

console.log('\n== BUAT COURSE ==');

let r = cobalah(function () { return Course.simpan(SESI_GURU, { name: 'PKPJ' }); });
cek('tanpa kelas ditolak', r.error === 'VALIDASI_GAGAL');
r = cobalah(function () {
  return Course.simpan(SESI_GURU, { class_id: 'CLS-0001', name: 'P' });
});
cek('mapel 1 karakter ditolak', r.error === 'VALIDASI_GAGAL');
r = cobalah(function () {
  return Course.simpan(SESI_GURU, { class_id: 'CLS-XX', name: 'PKPJ' });
});
cek('kelas tak ada ditolak', r.error === 'TIDAK_DITEMUKAN');

r = Course.simpan(SESI_GURU, { class_id: 'CLS-0001', name: '  PKPJ  ' });
cek('course dibuat + label "KELAS - MAPEL"',
    r.baru === true && r.label === 'XI TKJ 1 - PKPJ', JSON.stringify(r));
const TA1 = r.teaching_assignment_id, SBK1 = r.subject_id;
cek('teaching_assignment_id berawalan TA-', /^TA-/.test(TA1));
cek('Subjects baris baru dibuat',
    Db.cari('Subjects', 'subject_id', SBK1).name === 'PKPJ');
cek('TA tersimpan status aktif milik guru',
    Db.cari('Teaching_Assignments', 'teaching_assignment_id', TA1).status === 'aktif');
cek('audit BUAT_COURSE tercatat',
    Db.saring('Audit_Logs', { action: 'BUAT_COURSE' }).length === 1);

console.log('\n== DEDUPE MAPEL & COURSE ==');

const jmlSbk = jml('Subjects');
r = Course.simpan(SESI_GURU, { class_id: 'CLS-0002', name: 'pkpj' });
cek('mapel sama (kelas beda, beda huruf) → SBK LAMA dipakai',
    r.baru === true && r.subject_id === SBK1, JSON.stringify(r));
const TA2 = r.teaching_assignment_id;
cek('Subjects tidak bertambah (dedupe)', jml('Subjects') === jmlSbk);

r = cobalah(function () {
  return Course.simpan(SESI_GURU, { class_id: 'CLS-0001', name: 'PKPJ' });
});
cek('pasangan kelas+mapel sama ditolak DUPLIKAT', r.error === 'DUPLIKAT',
    JSON.stringify(r));

console.log('\n== DAFTAR ==');

r = Course.daftar(SESI_GURU);
cek('daftar 2 course urut kelas lalu mapel',
    r.length === 2 && r[0].label === 'XI TKJ 1 - PKPJ' &&
    r[1].label === 'XI TKJ 2 - PKPJ', JSON.stringify(r.map(function (x) { return x.label; })));
cek('jml_murid dari enrollment kelas',
    r[0].jml_murid === 1 && r[1].jml_murid === 0);
cek('status aktif terbawa', r.every(function (x) { return x.status === 'aktif'; }));

r = Course.detail(SESI_GURU, TA1);
cek('detail memuat kelas & mapel', r.class_name === 'XI TKJ 1' &&
    r.subject_name === 'PKPJ' && r.jml_murid === 1);
r = cobalah(function () { return Course.detail(SESI_GURU, 'TA-XX'); });
cek('detail tak ada ditolak', r.error === 'TIDAK_DITEMUKAN');

console.log('\n== EDIT COURSE ==');

r = cobalah(function () {
  return Course.simpan(SESI_GURU, { teaching_assignment_id: TA1, name: 'P' });
});
cek('edit ke nama mapel pendek ditolak', r.error === 'VALIDASI_GAGAL');

r = Course.simpan(SESI_GURU, { teaching_assignment_id: TA1, name: 'Matematika' });
cek('edit ganti mapel sukses', r.baru === false && r.subject_id !== SBK1,
    JSON.stringify(r));
const sbkMtk = r.subject_id;
cek('mapel baru (Matematika) dibuat',
    Db.cari('Subjects', 'subject_id', sbkMtk).name === 'Matematika');

r = cobalah(function () {
  return Course.simpan(SESI_GURU, { teaching_assignment_id: TA1,
    class_id: 'CLS-0002', name: 'pkpj' });
});
cek('edit ke pasangan yang sudah ada ditolak DUPLIKAT', r.error === 'DUPLIKAT');

r = Course.simpan(SESI_GURU, { teaching_assignment_id: TA1, class_id: 'CLS-0002' });
cek('edit ganti kelas saja (mapel tak dikirim) sukses',
    r.baru === false, JSON.stringify(r));
const taKini = Db.cari('Teaching_Assignments', 'teaching_assignment_id', TA1);
cek('TA kini kelas 2 + Matematika',
    taKini.class_id === 'CLS-0002' && taKini.subject_id === sbkMtk);

console.log('\n== HAPUS & REAKTIVASI ==');

r = cobalah(function () { return Course.hapus(SESI_GURU, 'TA-XX'); });
cek('hapus course tak ada ditolak', r.error === 'TIDAK_DITEMUKAN');

r = Course.hapus(SESI_GURU, TA1);
cek('hapus sukses', r.dihapus === true);
cek('hilang dari daftar', Course.daftar(SESI_GURU).length === 1);
cek('baris TA masih ada (nonaktif — soft delete)',
    Db.cari('Teaching_Assignments', 'teaching_assignment_id', TA1).status === 'nonaktif');
r = cobalah(function () { return Course.hapus(SESI_GURU, TA1); });
cek('hapus dua kali ditolak', r.error === 'VALIDASI_GAGAL');

const jmlTA = jml('Teaching_Assignments');
r = Course.simpan(SESI_GURU, { class_id: 'CLS-0002', name: 'Matematika' });
cek('buat ulang pasangan sama → REAKTIVASI TA lama',
    r.baru === true && r.reaktivasi === true &&
    r.teaching_assignment_id === TA1, JSON.stringify(r));
cek('tidak ada baris TA baru', jml('Teaching_Assignments') === jmlTA);
cek('TA kembali aktif',
    Db.cari('Teaching_Assignments', 'teaching_assignment_id', TA1).status === 'aktif');

console.log('\n== KELAS ARSIP ==');

r = cobalah(function () { return Kelas.arsip(SESI_GURU, 'CLS-0002'); });
cek('arsip kelas ditolak bila masih dipakai course aktif',
    r.error === 'VALIDASI_GAGAL', JSON.stringify(r));

Course.hapus(SESI_GURU, TA1);
Course.hapus(SESI_GURU, TA2);
r = Kelas.arsip(SESI_GURU, 'CLS-0002');
cek('arsip kelas sukses setelah course-nya dihapus', r.diarsipkan === true);
r = cobalah(function () {
  return Course.simpan(SESI_GURU, { class_id: 'CLS-0002', name: 'Sejarah' });
});
cek('course baru di kelas terarsip ditolak', r.error === 'TIDAK_DITEMUKAN');

console.log('\n== ENDPOINT (Code.gs) ==');

const TOKEN_G = Auth.login('guru', 'guru123').data.token;
r = courseDaftar(TOKEN_G);
cek('endpoint courseDaftar OK (kosong — semua dihapus/diarsip di uji atas)',
    r.ok === true && r.data.length === 0, JSON.stringify(r));
r = courseSimpan(TOKEN_G, { class_id: 'CLS-0001', name: ' Basis Data ' });
cek('endpoint courseSimpan OK (nama dirapikan)',
    r.ok === true && r.data.label === 'XI TKJ 1 - Basis Data', JSON.stringify(r));
const TA3 = r.data.teaching_assignment_id;
r = courseDetail(TOKEN_G, TA3);
cek('endpoint courseDetail OK', r.ok === true &&
    r.data.label === 'XI TKJ 1 - Basis Data');
r = courseHapus(TOKEN_G, TA3);
cek('endpoint courseHapus OK', r.ok === true);

const TOKEN_M = Auth.login('rina.andini', 'Rina12345').data.token;
['courseDaftar', 'courseSimpan', 'courseHapus'].forEach(function (fn, i) {
  const hasil = global[fn].apply(null,
    i === 1 ? [TOKEN_M, { class_id: 'CLS-0001', name: 'X' }] : [TOKEN_M, 'TA-1']);
  cek('endpoint ' + fn + ' ditolak utk murid',
      hasil.ok === false && hasil.error === 'AKSES_DITOLAK');
});
r = courseDaftar('token-sampah');
cek('endpoint tanpa sesi ditolak', r.ok === false && r.error === 'SESI_INVALID');

/* ============ hasil ============ */
console.log('\n----------------------------------------------------');
if (gagal === 0) console.log('SEMUA ' + no + ' UJI COURSE LULUS ✔');
else { console.log('UJI COURSE GAGAL ✘ — ' + gagal + ' dari ' + no + '.'); process.exit(1); }
