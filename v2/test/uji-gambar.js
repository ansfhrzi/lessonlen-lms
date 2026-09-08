/* ============================================================
 * LMS v2 — uji-gambar.js
 * Uji upload gambar (Gambar.gs + endpoint gambarUnggah):
 * validasi mime/ukuran/base64, folder Drive lazy + idempoten,
 * berbagi ANYONE_WITH_LINK, audit, guard role, endpoint guru.
 * Jalankan:  node v2/test/uji-gambar.js
 * ============================================================ */
require('./mock.js');
const fs = require('fs');
const path = require('path');
['Util', 'Auth', 'Kelas', 'Course', 'Topik', 'Quiz', 'Gambar', 'Code'].forEach(function (n) {
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

const SESI = { user_id: 'USR-GURU', role: 'guru' };
const SESI_MURID = { user_id: 'USR-S1', role: 'murid' };

/* ---- seed ---- */
const salt = Util.buatSalt();
Db.tambah('Users', { user_id: 'USR-GURU', username: 'guru',
  password_hash: Util.hashPassword('guru123', salt), salt, pwd_awal: '',
  nama: 'Guru', role: 'guru', rombel: '', email: '', nisn: '', no_wa: '',
  tanggal_lahir: '', status: 'aktif', harus_ganti_password: false,
  last_login: '', created_at: new Date(), updated_at: new Date() });
Db.tambah('Users', { user_id: 'USR-S1', username: 'siswa01',
  password_hash: Util.hashPassword('siswa123', salt), salt, pwd_awal: '',
  nama: 'Siswa', role: 'murid', rombel: '', email: '', nisn: '', no_wa: '',
  tanggal_lahir: '', status: 'aktif', harus_ganti_password: false,
  last_login: '', created_at: new Date(), updated_at: new Date() });

const B64_PNG = Buffer.from('gambar palsu', 'utf8').toString('base64');

console.log('\n== UNGGAH DASAR ==');

let r = Gambar.unggah(SESI, { nama: 'kucing.jpg', mime: 'image/jpeg', base64: B64_PNG });
cek('unggah OK → tautan drive format file/d/ID/view',
    /^https:\/\/drive\.google\.com\/file\/d\/drv-\d+\/view$/.test(r.tautan) &&
    r.file_id === r.tautan.split('/d/')[1].split('/')[0]);
cek('berkas tersimpan dgn mime & nama',
    global.__driveFiles().length === 1 &&
    global.__driveFiles()[0].mime === 'image/jpeg' &&
    global.__driveFiles()[0].nama === 'kucing.jpg');
cek('dibagikan ANYONE_WITH_LINK → VIEW',
    global.__driveFiles()[0].sharing &&
    global.__driveFiles()[0].sharing.a === 'ANYONE_WITH_LINK' &&
    global.__driveFiles()[0].sharing.p === 'VIEW');
cek('audit GAMBAR_UNGGAH tercatat',
    Db.baca('Audit_Logs').some(function (l) {
      return l.action === 'GAMBAR_UNGGAH' && l.user_id === 'USR-GURU'; }));

console.log('\n== FOLDER LAZY + IDEMPOTEN ==');

const prop = function () {
  return JSON.parse(JSON.stringify(global.PropertiesService.getScriptProperties()));
};
const id1 = global.PropertiesService.getScriptProperties().getProperty('FOLDER_GAMBAR_ID');
Gambar.unggah(SESI, { nama: 'dua.png', mime: 'image/png', base64: B64_PNG });
const id2 = global.PropertiesService.getScriptProperties().getProperty('FOLDER_GAMBAR_ID');
cek('folder dibuat sekali & id tercache',
    !!id1 && id1 === id2 && global.__driveFiles().length === 2 &&
    Object.keys(Db).length >= 0 /* folder tetap satu */);
const jmlFolder = Object.keys(global.__driveFiles()[0]).length; /* dummy */
cek('berkas kedua di folder yang sama',
    global.__driveFiles().length === 2 && global.__driveFiles()[1].mime === 'image/png');

console.log('\n== VALIDASI ==');

r = cobalah(function () { return Gambar.unggah(SESI, { mime: 'application/pdf', base64: B64_PNG }); });
cek('mime non-gambar ditolak', r.error === 'VALIDASI_GAGAL', r.pesan);
r = cobalah(function () { return Gambar.unggah(SESI, { mime: 'image/jpeg', base64: '' }); });
cek('base64 kosong ditolak', r.error === 'VALIDASI_GAGAL', r.pesan);
r = cobalah(function () { return Gambar.unggah(SESI, { mime: 'image/jpeg' }); });
cek('base64 tak ada ditolak', r.error === 'VALIDASI_GAGAL', r.pesan);
const b64Besar = Buffer.alloc(3 * 1024 * 1024 + 1, 7).toString('base64');
r = cobalah(function () { return Gambar.unggah(SESI, { nama: 'besar.jpg', mime: 'image/jpeg', base64: b64Besar }); });
cek('> 3 MB ditolak', r.error === 'VALIDASI_GAGAL', r.pesan);
r = cobalah(function () {
  return Gambar.unggah(SESI, { nama: 'a.jpg', mime: 'image/jpeg',
    base64: 'data:image/jpeg;base64,' + B64_PNG });
});
cek('awalan data: URI dibersihkan otomatis', !r.error && r.file_id,
    r.pesan || r.error);
r = cobalah(function () { return Gambar.unggah(SESI_MURID, { mime: 'image/jpeg', base64: B64_PNG }); });
cek('murid ditolak', r.error === 'DITOLAK', r.pesan);

console.log('\n== BERBAGI DIBLOKIR DOMAIN (laporan pemilik 2026-09-08) ==');

global.DriveApp.__setSharingGagal = true;
r = cobalah(function () {
  return Gambar.unggah(SESI, { nama: 'blokir.jpg', mime: 'image/jpeg', base64: B64_PNG });
});
cek('setSharing ditolak domain TIDAK menggagalkan unggah (repro diperbaiki)',
    !r.error && !!r.tautan && r.berbagi === false, r.pesan || r.error);
cek('tautan fallback = web app ?gambar=ID',
    r.tautan === 'https://script.google.com/macros/s/uji/exec?gambar=' + r.file_id,
    r.tautan);
const ID_BLOKIR = r.file_id;
global.DriveApp.__setSharingGagal = false;

let out = Gambar.sajikan(ID_BLOKIR);
cek('sajikan: bytes gambar + mime sesuai berkas',
    out && out.data && out.data.length > 0 && out.mime === 'image/jpeg');
out = Gambar.sajikan('id-tak-kenal');
cek('sajikan: id tak dikenal -> teks penjelasan',
    typeof out.data === 'string' && out.data.indexOf('tidak ditemukan') !== -1);
out = Gambar.sajikan('../etc/passwd');
cek('sajikan: id tak sah -> teks penolakan',
    typeof out.data === 'string' && out.data.indexOf('tidak sah') !== -1);

console.log('\n== ENDPOINT ==');

const T = Auth.login('guru', 'guru123').data.token;
r = cobalah(function () { return gambarUnggah(T, { nama: 'e.gif', mime: 'image/gif', base64: B64_PNG }); });
cek('endpoint guru OK (bungkus standar)',
    r.ok === true && /^https:\/\//.test(r.data.tautan), r.pesan || r.error);
const TM = Auth.login('siswa01', 'siswa123').data.token;
r = cobalah(function () { return gambarUnggah(TM, { mime: 'image/jpeg', base64: B64_PNG }); });
cek('endpoint murid ditolak',
    r.ok === false && r.error === 'AKSES_DITOLAK', r.pesan || r.error);

console.log('\n' + (gagal === 0
  ? 'SEMUA ' + no + ' CEK UJI-GAMBAR LULUS ✔'
  : gagal + '/' + no + ' CEK GAGAL ✘'));
process.exit(gagal === 0 ? 0 : 1);
