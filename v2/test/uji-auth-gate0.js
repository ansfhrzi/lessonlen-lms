/* ============================================================
 *  LMS v2 — uji-auth-gate0.js
 *  Uji logika Auth v2 (Gate 0) dengan Db/Cache/Utilities tiruan.
 *  Jalankan:  node v2/test/uji-auth-gate0.js
 *  (tidak membutuhkan Apps Script — murni logika)
 * ============================================================ */
require('./mock.js');
const fs = require('fs');
const path = require('path');
(0, eval)(fs.readFileSync(path.join(__dirname, '..', 'Util.gs'), 'utf8'));
(0, eval)(fs.readFileSync(path.join(__dirname, '..', 'Auth.gs'), 'utf8'));

let gagal = 0;
function cek(nama, kondisi, info) {
  if (kondisi) console.log('  OK  ' + nama);
  else { console.log('  GAGAL ' + nama + (info ? ' → ' + info : '')); gagal++; }
}

/* seed dua user */
const saltG = Util.buatSalt();
Db.tambah('Users', { user_id:'USR-0001', username:'guru',
  password_hash: Util.hashPassword('guru123', saltG), salt: saltG, pwd_awal:'guru123',
  nama:'Guru Uji', role:'guru', rombel:'', email:'', nisn:'', no_wa:'',
  status:'aktif', harus_ganti_password:false, last_login:'', created_at:new Date(), updated_at:new Date() });

const saltM = Util.buatSalt();
Db.tambah('Users', { user_id:'USR-0002', username:'siswa01',
  password_hash: Util.hashPassword('siswa123', saltM), salt: saltM, pwd_awal:'siswa123',
  nama:'Murid Uji', role:'murid', rombel:'X-1', email:'', nisn:'', no_wa:'',
  status:'aktif', harus_ganti_password:false, last_login:'', created_at:new Date(), updated_at:new Date() });

/* --- login benar --- */
let r = Auth.login('siswa01','siswa123');
cek('login murid sukses', r.ok === true, JSON.stringify(r));
cek('murid ditandai biodata_kurang', r.ok && r.data.biodata_kurang === true);
const TOKEN_M = r.ok ? r.data.token : '';

r = Auth.login('  GURU ','guru123');   /* normalisasi username */
cek('login guru sukses + normalisasi username', r.ok === true, JSON.stringify(r));
cek('guru tidak diminta biodata', r.ok && r.data.biodata_kurang === false);

/* --- login salah --- */
r = Auth.login('siswa01','salah');
cek('password salah ditolak', r.ok === false && r.error === 'LOGIN_GAGAL');

/* --- pesan seragam user tak ada --- */
const a = Auth.login('tidakada','x'), b = Auth.login('siswa01','salah');
cek('pesan seragam anti-enumerasi', a.pesan === b.pesan);

/* --- validasi token --- */
let sesi = Auth.validasiToken(TOKEN_M);
cek('token valid → sesi murid', !!sesi && sesi.role === 'murid');
cek('token sampah ditolak', Auth.validasiToken('xxx') === null);

/* --- kunci otomatis 5x --- */
for (let i=0;i<4;i++) Auth.login('siswa01','salah');   /* total 5 dgn yg tadi */
r = Auth.login('siswa01','siswa123');
cek('terkunci setelah 5x gagal', r.ok === false && r.error === 'AKUN_TERKUNCI');

/* --- kunci dibuka (simulasi 15 menit berlalu) --- */
__bukaKunci('siswa01');

/* --- ganti password --- */
sesi = Auth.validasiToken(TOKEN_M);
try {
  Auth.gantiPassword(sesi, 'siswa123', 'sandibaru1');
  r = Auth.login('siswa01','sandibaru1');
  cek('ganti password lalu login baru', r.ok === true, JSON.stringify(r));
  try { Auth.gantiPassword(sesi,'salah','x'); cek('ganti dgn sandi lama salah → gagal', false); }
  catch(e){ cek('ganti dgn sandi lama salah → gagal', e.kode === 'VALIDASI_GAGAL'); }
} catch(e) { cek('ganti password lalu login baru', false, e.message); }

/* --- lupa password --- */
const resp = Auth.ajukanReset('siswa01');
cek('ajukanReset diterima (respons seragam)', resp.diterima === true);
const antre = Auth.getPermintaanReset();
cek('permintaan masuk antrean', antre.length === 1 && antre[0].username === 'siswa01');

/* --- reset oleh guru --- */
const sesiGuru = Auth.validasiToken(Auth.login('guru','guru123').data.token);
const hasil = Auth.resetPasswordMurid(sesiGuru, 'USR-0002', antre[0].request_id);
cek('reset → sandi sementara', typeof hasil.password_sementara === 'string' && hasil.password_sementara.length === 8);
__bukaKunci('siswa01');
r = Auth.login('siswa01', hasil.password_sementara);
cek('login dgn sandi sementara + wajib ganti', r.ok === true && r.data.harus_ganti_password === true, JSON.stringify(r));
cek('permintaan reset selesai', Auth.getPermintaanReset().length === 0);

/* --- murid tidak boleh reset (dilakukan _bungkus di Code.gs; di sini cek role) --- */
__bukaKunci('siswa01');
cek('sesi murid role=murid', Auth.validasiToken(Auth.login('siswa01', hasil.password_sementara).data.token).role === 'murid');

/* --- nonaktif ditolak --- */
Db.perbarui('Users', 2+0, {}); // noop
const u2 = Db.cari('Users','username','siswa01');
Db.perbarui('Users', u2._baris, { status:'nonaktif' });
r = Auth.login('siswa01', hasil.password_sementara);
cek('user nonaktif ditolak', r.ok === false && r.error === 'AKUN_NONAKTIF');

console.log(gagal === 0 ? '\nSEMUA UJI LULUS ✔' : '\nADA ' + gagal + ' UJI GAGAL ✘');
process.exit(gagal ? 1 : 0);
