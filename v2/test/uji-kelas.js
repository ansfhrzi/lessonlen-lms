/* ============================================================
 *  LMS v2 — uji-kelas.js (Tahap 3)
 *  Uji logika Kelas/Murid/Enrollment + penjaga peran API.
 *  Jalankan:  node v2/test/uji-kelas.js
 * ============================================================ */
require('./mock.js');
const fs = require('fs');
const path = require('path');
(0, eval)(fs.readFileSync(path.join(__dirname, '..', 'Util.gs'), 'utf8'));
(0, eval)(fs.readFileSync(path.join(__dirname, '..', 'Auth.gs'), 'utf8'));
(0, eval)(fs.readFileSync(path.join(__dirname, '..', 'Notif.gs'), 'utf8'));
(0, eval)(fs.readFileSync(path.join(__dirname, '..', 'Kelas.gs'), 'utf8'));
(0, eval)(fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8'));

let gagal = 0;
function cek(nama, kondisi, info) {
  if (kondisi) console.log('  OK  ' + nama);
  else { console.log('  GAGAL ' + nama + (info ? ' → ' + info : '')); gagal++; }
}

/* ---------- seed guru & murid ---------- */
const saltG = Util.buatSalt();
const GURU_ID = Util.buatId('USR');
Db.tambah('Users', { user_id: GURU_ID, username: 'guru',
  password_hash: Util.hashPassword('guru123', saltG), salt: saltG,
  pwd_awal: 'guru123', nama: 'Guru Uji', role: 'guru', rombel: '',
  email: '', nisn: '', no_wa: '', status: 'aktif',
  harus_ganti_password: false, last_login: '', created_at: new Date(),
  updated_at: new Date() });

const TOKEN_G = Auth.login('guru', 'guru123').data.token;

/* ---------- KELAS ---------- */
let r = kelasSimpan(TOKEN_G, { name: 'XI TJKT 1', academic_year: '2026/2027' });
cek('buat kelas sukses', r.ok === true && r.data.baru === true, JSON.stringify(r));
const KLS = r.data.class_id;

r = kelasSimpan(TOKEN_G, { name: 'X', academic_year: 'salah-tahun' });
cek('tahun ajaran salah ditolak', r.ok === false && r.error === 'VALIDASI_GAGAL');

r = kelasSimpan(TOKEN_G, { name: '' });
cek('kelas tanpa nama ditolak', r.ok === false && r.error === 'VALIDASI_GAGAL');

r = kelasSimpan(TOKEN_G, { class_id: KLS, name: 'XI TJKT 1 (PKPJ)' });
cek('edit kelas sukses', r.ok === true && r.data.baru === false);
cek('daftar memuat nama baru',
  kelasDaftar(TOKEN_G, true).data.some(k => k.name === 'XI TJKT 1 (PKPJ)'));

/* ---------- MURID ---------- */
r = muridSimpan(TOKEN_G, { nama: 'Budi Santoso', username: 'budi01' });
cek('tambah murid → sandi sementara 8 karakter',
  r.ok === true && r.data.password_sementara.length === 8, JSON.stringify(r));
const BUDI = r.data.user_id;

r = muridSimpan(TOKEN_G, { nama: 'Budi Kedua', username: 'budi01' });
cek('username duplikat ditolak', r.ok === false && r.error === 'DUPLIKAT');

r = muridSimpan(TOKEN_G, { nama: 'Anak Baru', username: 'ab' });
cek('username < 3 karakter ditolak', r.ok === false && r.error === 'VALIDASI_GAGAL');

r = muridSimpan(TOKEN_G, { user_id: BUDI, no_wa: '0812-3456-7890' });
cek('edit murid menormalkan WA ke 62xxx',
  r.ok === true && Db.cari('Users', 'user_id', BUDI).no_wa === '6281234567890');

r = muridSimpan(TOKEN_G, { user_id: BUDI, no_wa: '099' });
cek('WA tidak sah ditolak saat edit', r.ok === false && r.error === 'VALIDASI_GAGAL');

/* ---------- IMPOR ---------- */
r = muridImporPratinjau(TOKEN_G, 'Budi Santoso, XI TKJ 1\nCitra Dewi, XI TKJ 1, citra01, citra123\nX');
cek('pratinjau: 2 siap 1 bermasalah',
  r.ok === true && r.data.siap.length === 2 && r.data.masalah.length === 1,
  JSON.stringify(r.data && { s: r.data.siap.length, m: r.data.masalah.length }));
cek('pratinjau: username otomatis dari nama',
  r.ok === true && r.data.siap[0].username === 'budis' && r.data.siap[0].diubah === false);

r = muridImporPratinjau(TOKEN_G, 'Citra Dewi\nCitra Dewi');
cek('pratinjau: nama kembar → username digeser',
  r.ok === true && r.data.siap[1].username === 'citrad2' &&
  r.data.siap[1].diubah === true, JSON.stringify(r.data && r.data.siap.map(x=>x.username)));

r = muridImpor(TOKEN_G, '', 'Citra Dewi, XI TKJ 1, citra01, citra123\nEko Prasetyo\nX');
cek('impor 2 murid, 1 gagal', r.ok === true && r.data.berhasil === 2 &&
  r.data.gagal.length === 1, JSON.stringify(r.data && { b: r.data.berhasil, g: r.data.gagal }));
const CITRA = Db.cari('Users', 'username', 'citra01').user_id;
cek('impor: sandi sendiri → tidak wajib ganti',
  Db.cari('Users', 'user_id', CITRA).harus_ganti_password === false);

r = muridImpor(TOKEN_G, '', 'Eko Prasetyo, X, eko01, pendek');
cek('impor: sandi lemah ditolak per baris', r.ok === false && r.error === 'VALIDASI_GAGAL');

/* ---------- ENROLLMENT ---------- */
r = muridDaftarkan(TOKEN_G, KLS, [BUDI, CITRA]);
cek('enroll 2 murid', r.ok === true && r.data.ditambah === 2, JSON.stringify(r));
cek('notif enroll_kelas terbuat',
  Db.saring('Notifications', { jenis: 'enroll_kelas' }).length === 2);

r = muridDaftarkan(TOKEN_G, KLS, [BUDI, CITRA]);
cek('enroll ulang tidak menduplikasi',
  r.ok === true && r.data.ditambah === 0 && r.data.diaktifkan === 0);
cek('baris enrollment tetap 2',
  Db.baca('Enrollment').filter(e => e.class_id === KLS).length === 2);

r = kelasMurid(TOKEN_G, KLS);
cek('muridDiKelas berisi 2', r.ok === true && r.data.length === 2);

r = muridTersedia(TOKEN_G, KLS);
cek('murid terdaftar tidak muncul di tersedia',
  r.ok === true && r.data.every(m => m.user_id !== BUDI));

r = muridKeluarkan(TOKEN_G, KLS, BUDI);
cek('keluarkan murid', r.ok === true);
r = muridTersedia(TOKEN_G, KLS);
cek('murid keluar muncul lagi di tersedia',
  r.data.some(m => m.user_id === BUDI));

r = muridDaftarkan(TOKEN_G, KLS, [BUDI]);
cek('daftar ulang → reaktivasi, bukan baris baru',
  r.ok === true && r.data.diaktifkan === 1 && r.data.ditambah === 0);
cek('total baris enrollment tetap 2',
  Db.baca('Enrollment').filter(e => e.class_id === KLS).length === 2);

/* ---------- KELAS SAYA (murid) ---------- */
r = Auth.login('budi01', Db.cari('Users', 'user_id', BUDI).pwd_awal);
const TOKEN_B = r.data.token;
cek('login murid impor wajib ganti sandi', r.data.harus_ganti_password === true);

/* mapel + teaching assignment utk kelasSaya */
Db.tambah('Subjects', { subject_id: 'SBK-0001', name: 'PKPJ', code: 'PKPJ',
  owner_teacher_id: 'USR-0001', status: 'aktif', created_at: new Date(),
  updated_at: new Date() });
Db.tambah('Teaching_Assignments', { teaching_assignment_id: 'TA-0001',
  class_id: KLS, teacher_id: 'USR-0001', subject_id: 'SBK-0001',
  academic_year: '2026/2027', status: 'aktif', created_at: new Date(),
  updated_at: new Date() });

r = kelasSaya(TOKEN_B);
cek('kelasSaya murid memuat kelas + mapel',
  r.ok === true && r.data.length === 1 && r.data[0].mapel.length === 1 &&
  r.data[0].mapel[0].nama === 'PKPJ', JSON.stringify(r.data));

/* ---------- ARSIP ---------- */
r = kelasUbahStatus(TOKEN_G, KLS, 'arsip');
cek('arsipkan kelas', r.ok === true);
cek('kelas arsip tidak tampil di daftar default',
  kelasDaftar(TOKEN_G, false).data.length === 0);
r = kelasSaya(TOKEN_B);
cek('kelas arsip hilang dari kelasSaya', r.data.length === 0);
kelasUbahStatus(TOKEN_G, KLS, 'aktif');

/* ---------- PENJAGA PERAN ---------- */
r = muridDaftarkan(TOKEN_B, KLS, [CITRA]);
cek('murid TIDAK boleh enroll', r.ok === false && r.error === 'AKSES_DITOLAK');
r = muridDaftar(TOKEN_B, {});
cek('murid TIDAK boleh lihat kelola murid', r.ok === false && r.error === 'AKSES_DITOLAK');
r = kelasDaftar(TOKEN_B, false);
cek('murid TIDAK boleh daftar kelas guru', r.ok === false && r.error === 'AKSES_DITOLAK');
r = resetPasswordMurid(TOKEN_B, CITRA, '');
cek('murid TIDAK boleh reset sandi', r.ok === false && r.error === 'AKSES_DITOLAK');

/* ---------- BIODATA MURID ---------- */
r = simpanBiodataSaya(TOKEN_B, { email: 'budi@contoh.id', no_wa: '081234567890' });
cek('murid simpan biodata', r.ok === true, JSON.stringify(r));
r = muridDaftar(TOKEN_G, { cari: 'budi' });
cek('biodata tercatat lengkap di daftar murid',
  r.data.length === 1 && r.data[0].biodata_lengkap === true &&
  r.data[0].no_wa === '6281234567890');

r = simpanBiodataSaya(TOKEN_B, { email: 'bukan-email', no_wa: '081234567890' });
cek('biodata email salah ditolak', r.ok === false && r.error === 'VALIDASI_GAGAL');

/* ---------- NONAKTIF ---------- */
r = muridSimpan(TOKEN_G, { user_id: CITRA, status: 'nonaktif' });
cek('nonaktifkan murid', r.ok === true);
r = Auth.login('citra01', 'citra123');
cek('login murid nonaktif ditolak', r.ok === false && r.error === 'AKUN_NONAKTIF');

/* ---------- NOTIFIKASI ---------- */
r = daftarNotifikasi(TOKEN_B);
cek('murid punya notif enroll', r.ok === true && r.data.length >= 1);
const NID = r.data[0].notif_id;
notifTandaiDibaca(TOKEN_B, NID);
r = daftarNotifikasi(TOKEN_B);
cek('tandai dibaca bekerja', r.data[0].dibaca === true);

console.log(gagal === 0 ? '\nSEMUA UJI TAHAP 3 LULUS ✔' : '\nADA ' + gagal + ' UJI GAGAL ✘');
process.exit(gagal ? 1 : 0);
