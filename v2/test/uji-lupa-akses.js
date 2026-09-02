/* ============================================================
 *  LMS v2 — uji-lupa-akses.js
 *  Uji alur biodata + lupa sandi/username mandiri
 *  (keputusan 2026-09-02): tanggal lahir wajib, NISN opsional,
 *  verifikasi 3 data → reset otomatis; gagal → hubungi guru.
 *  Jalankan:  node v2/test/uji-lupa-akses.js
 * ============================================================ */
require('./mock.js');
const fs = require('fs');
const path = require('path');
['Util', 'Auth', 'Code'].forEach(function (n) {
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

/* ---- seed: guru + 2 murid ---- */
function buatUser(id, username, password, role, ekstra) {
  const salt = Util.buatSalt();
  Db.tambah('Users', Object.assign({
    user_id: id, username: username,
    password_hash: Util.hashPassword(password, salt), salt: salt,
    pwd_awal: '', nama: 'Uji ' + username, role: role,
    rombel: '', email: '', nisn: '', no_wa: '', tanggal_lahir: '',
    status: 'aktif', harus_ganti_password: false, last_login: '',
    created_at: new Date(), updated_at: new Date()
  }, ekstra || {}));
  return password;
}
const PWD_GURU = buatUser('USR-GURU', 'guru', 'guru123', 'guru');
let PWD1 = buatUser('USR-M1', 'budi.siswa', 'Budi12345', 'murid');
let PWD2 = buatUser('USR-M2', 'ani.siswa', 'Ani123456', 'murid', {
  email: 'ani@sekolah.sch.id', no_wa: '6281122334455',
  tanggal_lahir: '2009-11-30'
});
const SESI_GURU = { user_id: 'USR-GURU', role: 'guru' };

console.log('\n== BIODATA SAAT LOGIN ==');

let r = Auth.login('budi.siswa', PWD1);
cek('murid tanpa biodata → biodata_kurang=true',
    r.ok === true && r.data.biodata_kurang === true, JSON.stringify(r));
cek('biodata terbawa dgn tanggal_lahir kosong',
    r.data.biodata && r.data.biodata.tanggal_lahir === '' &&
    'nisn' in r.data.biodata);
const TOK1 = r.data.token;

r = Auth.login('ani.siswa', PWD2);
cek('murid dgn biodata lengkap → biodata_kurang=false',
    r.ok === true && r.data.biodata_kurang === false);

console.log('\n== SIMPAN BIODATA (NISN OPSIONAL) ==');

const SESI1 = { user_id: 'USR-M1', role: 'murid' };
r = cobalah(function () { return Auth.simpanBiodata(SESI1, {
  email: 'email-salah', no_wa: '081234567890', tanggal_lahir: '17/05/2010' }); });
cek('email salah ditolak', r.error === 'VALIDASI_GAGAL');
r = cobalah(function () { return Auth.simpanBiodata(SESI1, {
  email: 'budi@sekolah.sch.id', no_wa: 'abc', tanggal_lahir: '17/05/2010' }); });
cek('no WA salah ditolak', r.error === 'VALIDASI_GAGAL');
r = cobalah(function () { return Auth.simpanBiodata(SESI1, {
  email: 'budi@sekolah.sch.id', no_wa: '081234567890', tanggal_lahir: '31/02/2010' }); });
cek('tanggal tidak nyata (31/02) ditolak', r.error === 'VALIDASI_GAGAL');
r = cobalah(function () { return Auth.simpanBiodata(SESI1, {
  email: 'budi@sekolah.sch.id', no_wa: '081234567890', tanggal_lahir: '01/01/2030' }); });
cek('tanggal lahir di masa depan ditolak', r.error === 'VALIDASI_GAGAL');

r = Auth.simpanBiodata(SESI1, {
  email: 'Budi@Sekolah.sch.id', no_wa: '081234567890',
  tanggal_lahir: '17/05/2010' });          /* NISN TIDAK diisi — sah */
cek('simpan biodata TANPA NISN sukses (opsional)',
    r.berhasil === true && r.biodata_kurang === false, JSON.stringify(r));
const budi = Db.cari('Users', 'user_id', 'USR-M1');
cek('email lowercase, WA 62…, tgl baku YYYY-MM-DD',
    budi.email === 'budi@sekolah.sch.id' && budi.no_wa === '6281234567890' &&
    budi.tanggal_lahir === '2010-05-17', JSON.stringify(budi));

r = Auth.login('budi.siswa', PWD1);
cek('login berikutnya tidak lagi diminta biodata',
    r.ok === true && r.data.biodata_kurang === false);

r = cobalah(function () { return Auth.simpanBiodata(SESI_GURU, {
  email: 'g@x.id', no_wa: '081234567890', tanggal_lahir: '01/01/1990' }); });
cek('guru tidak punya biodata (ditolak)', r.error === 'AKSES_DITOLAK');

console.log('\n== LUPA PASSWORD (username + WA + tgl lahir) ==');

const GAGAL_TEKS = 'hubungi guru';
r = Auth.lupaPassword('budi.siswa', '628999999999', '2010-05-17');
cek('WA salah → diterima=false', r.diterima === false, JSON.stringify(r));
const PESAN_NETRAL = r.pesan;
cek('sandi LAMA masih berlaku saat gagal',
    Auth.login('budi.siswa', PWD1).ok === true);

r = Auth.lupaPassword('budi.siswa', '6281234567890', '2009-05-17');
cek('tgl lahir salah → diterima=false', r.diterima === false);
r = Auth.lupaPassword('tak.ada', '6281234567890', '2010-05-17');
cek('username tak dikenal → pesan sama (anti-enumerasi)',
    r.diterima === false && r.pesan === PESAN_NETRAL);
r = Auth.lupaPassword('guru', PWD_GURU.slice(0, 6), '1990-01-01');
cek('akun guru tidak bisa lewat lupa murid',
    r.diterima === false && r.pesan === PESAN_NETRAL);

/* ambil sesi aktif dulu → harus tercabut setelah reset mandiri */
const TOK_SEBELUM = Auth.login('budi.siswa', PWD1).data.token;

r = Auth.lupaPassword('budi.siswa', '081234567890', '17/05/2010');
cek('lupa password sukses (input campuran 08xx & DD/MM/YYYY)',
    r.diterima === true && (r.password_sementara || '').length === 8,
    JSON.stringify(r));
const SANDI_BARU1 = r.password_sementara;
cek('login dgn sandi baru sukses',
    Auth.login('budi.siswa', SANDI_BARU1).ok === true);
cek('sandi lama mati', Auth.login('budi.siswa', PWD1).ok === false);
cek('sesi lama tercabut', Auth.validasiToken(TOK_SEBELUM) === null);
const budiKini = Db.cari('Users', 'user_id', 'USR-M1');
cek('harus_ganti_password aktif + pwd_awal sandi baru',
    (budiKini.harus_ganti_password === true) && budiKini.pwd_awal === SANDI_BARU1);
cek('audit LUPA_AKSES_OTOMATIS tercatat',
    Db.saring('Audit_Logs', { action: 'LUPA_AKSES_OTOMATIS' }).length === 1);
PWD1 = SANDI_BARU1;

console.log('\n== LUPA USERNAME & PASSWORD (email + WA + tgl lahir) ==');

r = Auth.lupaUsername('salah@x.id', '6281122334455', '2009-11-30');
cek('email salah → diterima=false & pesan netral',
    r.diterima === false && r.pesan === PESAN_NETRAL);
r = Auth.lupaUsername('ani@sekolah.sch.id', '6281122334455', '2009-12-30');
cek('tgl lahir salah → diterima=false', r.diterima === false);

r = Auth.lupaUsername('ani@sekolah.sch.id', '081122334455', '30/11/2009');
cek('lupa username sukses → username terlihat + sandi baru',
    r.diterima === true && r.username === 'ani.siswa' &&
    (r.password_sementara || '').length === 8, JSON.stringify(r));
cek('login dgn sandi baru dari lupa-username sukses',
    Auth.login('ani.siswa', r.password_sementara).ok === true);
PWD2 = r.password_sementara;

console.log('\n== BATAS PERCOBAAN (5×/15 mnt) ==');

for (let i = 0; i < 5; i++) {
  Auth.lupaPassword('ani.siswa', '628000000000', '2009-11-30');
}
r = Auth.lupaPassword('ani.siswa', '6281122334455', '2009-11-30');
cek('percobaan ke-6 diblokir walaupun data benar',
    r.diterima === false && /Terlalu banyak/.test(r.pesan), JSON.stringify(r));
cek('sandi tidak berubah saat diblokir',
    Auth.login('ani.siswa', PWD2).ok === true);

console.log('\n== ENDPOINT (Code.gs) ==');

/* token lama mati karena reset mandiri (perilaku benar) — pakai sesi segar */
const TOK1B = Auth.login('budi.siswa', PWD1).data.token;
r = simpanBiodata(TOK1B, { email: 'budi@sekolah.sch.id',
  no_wa: '081234567890', tanggal_lahir: '17/05/2010', nisn: '0091234501' });
cek('endpoint simpanBiodata OK + NISN diisi', r.ok === true &&
    Db.cari('Users', 'user_id', 'USR-M1').nisn === '0091234501', JSON.stringify(r));
r = lupaPassword('', 'budi.siswa', '081234567890', '17/05/2010');
cek('endpoint lupaPassword (publik) OK', r.ok === true &&
    r.data.diterima === true, JSON.stringify(r));
r = lupaUsername('', 'budi@sekolah.sch.id', '081234567890', '2010-05-17');
cek('endpoint lupaUsername OK', r.ok === true &&
    r.data.diterima === true && r.data.username === 'budi.siswa');
r = lupaPassword('token-sampah', 'budi.siswa', '081234567890', '2010-05-17');
cek('endpoint publik tidak butuh sesi (token apa pun diterima)',
    r.ok === true);

/* ============ hasil ============ */
console.log('\n----------------------------------------------------');
if (gagal === 0) console.log('SEMUA ' + no + ' UJI LUPA-AKSES LULUS ✔');
else { console.log('UJI LUPA-AKSES GAGAL ✘ — ' + gagal + ' dari ' + no + '.'); process.exit(1); }
