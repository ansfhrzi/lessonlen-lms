/* ============================================================
 *  LMS v2 — uji-login-wa.js
 *  Uji §5.8 (keputusan 2026-09-03): murid masuk pakai
 *  No. WA + tanggal lahir.
 *  Jalankan:  node v2/test/uji-login-wa.js
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
function tambahUser(o) {
  const salt = Util.buatSalt();
  Db.tambah('Users', Object.assign({
    password_hash: Util.hashPassword('Sandi12345', salt), salt, pwd_awal: '',
    rombel: '', email: '', nisn: '', no_wa: '', tanggal_lahir: '',
    status: 'aktif', harus_ganti_password: false, last_login: '',
    created_at: new Date(), updated_at: new Date()
  }, o, { password_hash: Util.hashPassword(o.sandi || 'Sandi12345', salt) }));
}

/* ---- seed ---- */
tambahUser({ user_id: 'USR-G', username: 'guru', nama: 'Guru', role: 'guru',
  no_wa: '081110000001', tanggal_lahir: '1985-01-01' });
tambahUser({ user_id: 'USR-M1', username: 'rina', nama: 'Rina', role: 'murid',
  no_wa: '081234567001', tanggal_lahir: '2008-03-15', harus_ganti_password: true });
tambahUser({ user_id: 'USR-M2', username: 'bayu', nama: 'Bayu', role: 'murid',
  no_wa: '081234567002', tanggal_lahir: '2008-03-15' });
/* duplikat: WA + tgl lahir sama dgn Rina → blok ganda */
tambahUser({ user_id: 'USR-M3', username: 'citra', nama: 'Citra', role: 'murid',
  no_wa: '081234567001', tanggal_lahir: '2008-03-15' });
/* nonaktif */
tambahUser({ user_id: 'USR-M4', username: 'dani', nama: 'Dani', role: 'murid',
  no_wa: '081234567004', tanggal_lahir: '2008-04-04', status: 'nonaktif' });
/* WA + tgl tapi biodata belum lengkap (email kosong — tetap boleh? YA:
   yang dibutuhkan hanya no_wa + tanggal_lahir) */
tambahUser({ user_id: 'USR-M5', username: 'eka', nama: 'Eka', role: 'murid',
  no_wa: '081234567005', tanggal_lahir: '2008-05-05', harus_ganti_password: true });

console.log('\n== VALIDASI ==');

let r = Auth.loginWa('', '');
cek('kosong ditolak netral', r.ok === false && r.error === 'LOGIN_GAGAL' &&
    r.pesan.indexOf('hubungi guru') >= 0);
r = Auth.loginWa('081234567001', 'bukan-tanggal');
cek('tanggal asing → netral (tidak membuka format lain)',
    r.ok === false && r.error === 'LOGIN_GAGAL');
r = Auth.loginWa('12345', '2008-03-15');
cek('nomor tak masuk akal → netral', r.ok === false && r.error === 'LOGIN_GAGAL');

console.log('\n== KECOCOKAN ==');

r = Auth.loginWa('081234567999', '2008-03-15');
cek('tidak cocok → netral', r.ok === false && r.pesan.indexOf('hubungi guru') >= 0);

r = Auth.loginWa('081110000001', '1985-01-01');
cek('GURU meski WA+tgl cocok → ditolak (hanya murid)',
    r.ok === false && r.pesan.indexOf('hubungi guru') >= 0);

r = Auth.loginWa('081234567004', '2008-04-04');
cek('akun nonaktif → netral', r.ok === false && r.error === 'LOGIN_GAGAL');

r = Auth.loginWa('081234567001', '2008-03-15');
cek('WA+tgl sama pada 2 akun → ditolak netral (anti akun orang)',
    r.ok === false && r.pesan.indexOf('hubungi guru') >= 0);

console.log('\n== SUKSES ==');

r = Auth.loginWa('6281234567005', '2008-05-05');
cek('format 62… diterima (normalisasi)',
    r.ok === true && r.data.user.username === 'eka', JSON.stringify(r));
cek('data user: role murid', r.data.user.role === 'murid');
cek('TANPA wajib ganti sandi (§5.8 poin 3) — meski penanda TRUE di DB',
    r.data.harus_ganti_password === false);
cek('TANPA arahan biodata', r.data.biodata_kurang === false && r.data.biodata === null);
cek('penanda via=wa', r.data.via === 'wa');
cek('penanda harus_ganti_password di DB TIDAK diubah',
    Db.cari('Users', 'user_id', 'USR-M5').harus_ganti_password === true);
cek('last_login terisi', !!Db.cari('Users', 'user_id', 'USR-M5').last_login);
cek('sesi dibuat & sah', !!Auth.validasiToken(r.data.token));
cek('audit LOGIN_WA sukses tercatat',
    Db.saring('Audit_Logs', { action: 'LOGIN_WA', status: 'ok' }).length === 1);

/* variasi format input yang sama */
r = Auth.loginWa('+62 812-3456-7005', '05/05/2008');
cek('variasi format (spasi/dash, dd/mm/yyyy) diterima',
    r.ok === true && r.data.user.username === 'eka', JSON.stringify(r));

console.log('\n== BATAS PERCOBAAN ==');

for (let i = 0; i < 4; i++) {
  r = Auth.loginWa('081234567005', '1999-12-31');
}
cek('percobaan ke-4 → pesan sisa 1', r.ok === false &&
    r.pesan.indexOf('Sisa percobaan: 1.') >= 0, r.pesan);
r = Auth.loginWa('081234567005', '1999-12-31');   /* ke-5: terakhir */
cek('percobaan ke-5 gagal juga', r.ok === false);
r = Auth.loginWa('081234567005', '2008-05-05');   /* data BENAR pun ditolak */
cek('terkunci meski data benar (AKUN_TERKUNCI)',
    r.ok === false && r.error === 'AKUN_TERKUNCI');

console.log('\n== ENDPOINT (publik, tanpa sesi) ==');

r = loginWa('081234567005', '2008-05-05');
/* masih terkunci dari seksi sebelumnya (CacheService nyata per proses) */
cek('endpoint loginWa merespons dengan kontrak yang sama',
    r.ok === false && (r.error === 'AKUN_TERKUNCI' || r.error === 'LOGIN_GAGAL'),
    JSON.stringify(r));

console.log('\n========================================');
console.log(no + ' cek, ' + gagal + ' gagal');
process.exit(gagal ? 1 : 0);
