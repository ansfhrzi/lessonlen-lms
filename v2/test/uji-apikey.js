/* ============================================================
 *  LMS v2 — uji-apikey.js
 *  Uji Status API Key (modul ApiKey.gs + endpoint):
 *  simpan (maks 10, bentuk key, timpa), status (ekor 4 digit,
 *  siap/istirahat/bermasalah), reset cooldown, endpoint role guru.
 *  Jalankan:  node v2/test/uji-apikey.js
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

/* ---- seed guru ---- */
const saltG = Util.buatSalt();
Db.tambah('Users', { user_id: 'USR-GURU', username: 'guru',
  password_hash: Util.hashPassword('guru123', saltG), salt: saltG, pwd_awal: '',
  nama: 'Guru Uji', role: 'guru', rombel: '', email: '', nisn: '', no_wa: '',
  tanggal_lahir: '', status: 'aktif', harus_ganti_password: false,
  last_login: '', created_at: new Date(), updated_at: new Date() });

const K1 = 'AIza' + 'A'.repeat(35) + '1111';
const K2 = 'AIza' + 'B'.repeat(35) + '2222';

console.log('\n== STATUS AWAL ==');

let r = ApiKey.status(SESI_GURU);
cek('belum ada key: jml 0, terpasang false',
    r.jml === 0 && r.terpasang === false, JSON.stringify(r));
cek('maks = 10 terbawa di respons', r.maks === 10);
cek('model bawaan terbawa (kompatibel modul AI)', Array.isArray(r.model) &&
    r.model.length >= 5 && r.model_aktif === r.model[0]);

console.log('\n== SIMPAN: VALIDASI ==');

r = cobalah(function () { return ApiKey.simpan(SESI_GURU, 'bukan-larik'); });
cek('bukan larik ditolak', r.error === 'VALIDASI_GAGAL');
r = cobalah(function () { return ApiKey.simpan(SESI_GURU, ['pendek']); });
cek('key terlalu pendek ditolak (ke-1)', r.error === 'VALIDASI_GAGAL' &&
    /ke-1/.test(r.pesan), JSON.stringify(r));
r = cobalah(function () { return ApiKey.simpan(SESI_GURU,
  [K1, K2, 'AIza ' + 'C'.repeat(31)]); });
cek('key berisi spasi ditolak (ke-3)', r.error === 'VALIDASI_GAGAL' &&
    /ke-3/.test(r.pesan), JSON.stringify(r));
const ELEVEN = [];
for (let i = 0; i < 11; i++) ELEVEN.push('AIza' + 'X'.repeat(31) + ('0' + i).slice(-2));
r = cobalah(function () { return ApiKey.simpan(SESI_GURU, ELEVEN); });
cek('11 key ditolak (maks 10)', r.error === 'VALIDASI_GAGAL' &&
    /Maksimal 10/.test(r.pesan), JSON.stringify(r));
r = ApiKey.status(SESI_GURU);
cek('penolakan tidak meninggalkan jejak', r.jml === 0);

console.log('\n== SIMPAN: SUKSES & TIMPA ==');

r = ApiKey.simpan(SESI_GURU, ['  ' + K1 + '  ', '', K2]);
cek('2 key tersimpan (trim + buang kosong)', r.jml === 2, JSON.stringify(r));
cek('tersimpan di Script Properties (bukan sheet)',
    JSON.parse(PropertiesService.getScriptProperties()
      .getProperty('GEMINI_KEYS')).length === 2 &&
    Db.baca('Audit_Logs').every(function (l) {
      return String(l.detail || '').indexOf(K1.slice(0, 20)) === -1;
    }));
cek('audit SIMPAN_API_KEY tercatat',
    Db.saring('Audit_Logs', { action: 'SIMPAN_API_KEY' }).length === 1);

r = ApiKey.status(SESI_GURU);
cek('status: 2 key siap', r.jml === 2 && r.jml_siap === 2 && r.terpasang === true);
cek('panel hanya melihat 4 digit terakhir',
    r.key[0].ekor === '1111' && r.key[1].ekor === '2222');
cek('key utuh TIDAK pernah keluar dari server',
    JSON.stringify(r).indexOf(K1) === -1 && JSON.stringify(r).indexOf('AAAA') === -1,
    JSON.stringify(r.key));
cek('cursor terhitung terhadap jumlah key', r.cursor === 0);

r = ApiKey.simpan(SESI_GURU, [K1]);
cek('simpan lagi = MENIMPA seluruh daftar', r.jml === 1 &&
    ApiKey.status(SESI_GURU).jml === 1);

console.log('\n== COOLDOWN & STATUS ==');

ApiKey.simpan(SESI_GURU, [K1, K2]);   /* pastikan 2 key utk uji ini */
/* key 0 rusak (mis. 400/403 dari server AI) → cooldown 24 jam semua model */
CacheService.getScriptCache().put('gemini_key_rusak_0', '400', 86400);
r = ApiKey.status(SESI_GURU);
cek('key rusak → status "bermasalah"', r.key[0].status === 'bermasalah' &&
    r.jml_bermasalah === 1, JSON.stringify(r.key));

/* key 1 cooldown di SEMUA model → "istirahat" */
ApiKey.MODEL_BAWAAN.forEach(function (m) {
  CacheService.getScriptCache().put(ApiKey._cd(1, m), '429', 60);
});
r = ApiKey.status(SESI_GURU);
cek('semua model cooldown → status "istirahat"',
    r.key[1].status === 'istirahat' && r.jml_siap === 0, JSON.stringify(r.key));

r = ApiKey.resetCooldown(SESI_GURU);
cek('reset cooldown sukses', r.direset === true);
r = ApiKey.status(SESI_GURU);
cek('setelah reset semua kembali "siap"',
    r.jml_siap === 2 && r.jml_bermasalah === 0, JSON.stringify(r.key));
cek('audit RESET_COOLDOWN_AI tercatat',
    Db.saring('Audit_Logs', { action: 'RESET_COOLDOWN_AI' }).length === 1);

/* simpan daftar baru juga menghapus cooldown */
ApiKey.MODEL_BAWAAN.forEach(function (m) {
  CacheService.getScriptCache().put(ApiKey._cd(0, m), '429', 60);
});
ApiKey.simpan(SESI_GURU, [K1, K2]);
r = ApiKey.status(SESI_GURU);
cek('simpan daftar baru menghapus cooldown', r.jml_siap === 2,
    JSON.stringify(r.key));

/* daftar kosong = mencabut semua */
r = ApiKey.simpan(SESI_GURU, []);
cek('daftar kosong mencabut semua key', r.jml === 0 &&
    ApiKey.status(SESI_GURU).terpasang === false);

console.log('\n== ENDPOINT (Code.gs) ==');

const TOKEN_G = Auth.login('guru', 'guru123').data.token;
r = apiKeySimpan(TOKEN_G, [K1, K2]);
cek('endpoint apiKeySimpan (guru) OK', r.ok === true && r.data.jml === 2,
    JSON.stringify(r));
r = apiKeyStatus(TOKEN_G);
cek('endpoint apiKeyStatus OK', r.ok === true && r.data.jml === 2);
r = apiKeyResetCooldown(TOKEN_G);
cek('endpoint apiKeyResetCooldown OK', r.ok === true);

/* batas 10 lewat endpoint */
const ELEVEN2 = ELEVEN;
r = apiKeySimpan(TOKEN_G, ELEVEN2);
cek('endpoint menolak 11 key', r.ok === false && /Maksimal 10/.test(r.pesan));

/* role murid & sesi invalid */
const saltM = Util.buatSalt();
Db.tambah('Users', { user_id: 'USR-M1', username: 'rina.andini',
  password_hash: Util.hashPassword('Rina12345', saltM), salt: saltM, pwd_awal: '',
  nama: 'Rina Andini', role: 'murid', rombel: '', email: '', nisn: '', no_wa: '',
  tanggal_lahir: '', status: 'aktif', harus_ganti_password: false,
  last_login: '', created_at: new Date(), updated_at: new Date() });
const TOKEN_M = Auth.login('rina.andini', 'Rina12345').data.token;
['apiKeyStatus', 'apiKeySimpan', 'apiKeyResetCooldown'].forEach(function (fn) {
  const hasil = global[fn].apply(null, fn === 'apiKeySimpan'
    ? [TOKEN_M, [K1]] : [TOKEN_M]);
  cek('endpoint ' + fn + ' ditolak utk murid',
      hasil.ok === false && hasil.error === 'AKSES_DITOLAK');
});
r = apiKeyStatus('token-sampah');
cek('endpoint tanpa sesi ditolak', r.ok === false && r.error === 'SESI_INVALID');

/* ============ hasil ============ */
console.log('\n----------------------------------------------------');
if (gagal === 0) console.log('SEMUA ' + no + ' UJI API-KEY LULUS ✔');
else { console.log('UJI API-KEY GAGAL ✘ — ' + gagal + ' dari ' + no + '.'); process.exit(1); }
