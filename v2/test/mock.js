/* Mock lingkungan Apps Script untuk uji logika Auth v2 */
const crypto = require('crypto');

global.Utilities = {
  DigestAlgorithm: { SHA_256: 'SHA_256' },
  Charset: { UTF_8: 'UTF_8' },
  getUuid: () => crypto.randomUUID(),
  computeDigest: (algo, str) => {
    return Array.from(crypto.createHash('sha256').update(String(str), 'utf8').digest());
  },
  formatDate: (d) => d.toISOString().replace('T',' ').slice(0,19)
};

const _cache = {};
global.CacheService = {
  getScriptCache: () => ({
    get: (k) => (_cache[k] !== undefined ? _cache[k] : null),
    put: (k, v) => { _cache[k] = String(v); },
    remove: (k) => { delete _cache[k]; }
  })
};

global.PropertiesService = {
  getScriptProperties: () => ({ getProperty: () => null, setProperty: () => {} })
};

/* ---- Db tiruan berbasis objek ---- */
const HEAD = {
  Users: ['user_id','username','password_hash','salt','pwd_awal','nama','role','rombel','email','nisn','no_wa','status','harus_ganti_password','last_login','created_at','updated_at'],
  Session: ['token','user_id','dibuat_at','expired_at'],
  Permintaan_Reset: ['request_id','user_id','input_user','status','dibuat_at','diproses_at'],
  Notifications: ['notif_id','user_id','jenis','judul','pesan','link','dibaca','created_at'],
  Counters: ['entity','last_number'],
  Audit_Logs: ['log_id','user_id','role','action','entity','entity_id','detail','status','timestamp'],
  Classes: ['class_id','name','academic_year','status','created_at','updated_at'],
  Subjects: ['subject_id','name','code','owner_teacher_id','status','created_at','updated_at'],
  Teaching_Assignments: ['teaching_assignment_id','class_id','teacher_id','subject_id','academic_year','status','created_at','updated_at'],
  Enrollment: ['enroll_id','class_id','user_id','tanggal_daftar','status']
};
const TABEL = {};   // nama -> array objek (sudah termasuk _baris)

global.Db = {
  baca: (n) => (TABEL[n] || []).map((r,i) => Object.assign({_baris: i+2}, r)),
  cari: (n, kol, val) => {
    const rows = global.Db.baca(n);
    for (const r of rows) if (r[kol] === val) return r;
    return null;
  },
  saring: (n, krit) => global.Db.baca(n).filter(r => {
    for (const k in krit) if (r[k] !== krit[k]) return false;
    return true;
  }),
  /* versi cepat di Db.gs nyata; di mock cukup didelegasikan */
  cariCepat: function (n, kol, val) { return global.Db.cari(n, kol, val); },
  cariCepat2: function (n, k1, v1, k2, v2) {
    return global.Db.baca(n).filter(r => r[k1] === v1 && r[k2] === v2)[0] || null;
  },
  tambah: (n, arr) => {
    const a = Array.isArray(arr) ? arr : [arr];
    (TABEL[n] = TABEL[n] || []).push(...a);
    return a.length;
  },
  perbarui: (n, baris, obj) => {
    const r = (TABEL[n]||[])[baris-2];
    if (r) Object.assign(r, obj);
  },
  hapus: (n, baris) => { (TABEL[n]||[]).splice(baris-2, 1); },
  hapusBanyak: (n, daftar) => {
    daftar.slice().sort((a,b)=>b-a).forEach(b => global.Db.hapus(n,b));
    return daftar.length;
  },
  invalidasi: () => {},
  denganKunci: (fn) => fn(),
  /* untuk Util.buatId — tiru sheet Counters */
  sheet: (n) => {
    TABEL[n] = TABEL[n] || [];
    return {
      getLastRow: () => TABEL[n].length + 1,
      getRange: (row, col, nrows) => ({
        getValues: () => TABEL[n].slice(row-2, row-2+(nrows||1)).map(r=>[r[HEAD[n][col-1]]]),
        getValue: () => { const r = TABEL[n][row-2]; return r ? r[HEAD[n][col-1]] : null; },
        setValue: (v) => {
          TABEL[n][row-2] = TABEL[n][row-2] || {};
          TABEL[n][row-2][HEAD[n][col-1]] = v;
        },
        setValues: (vs) => { vs.forEach((v,i)=>{ TABEL[n][row-2+i] = {}; HEAD[n].forEach((h,c)=>TABEL[n][row-2+i][h]=v[c]); }); }
      })
    };
  },
  header: (n) => HEAD[n] || []
};

global.__bukaKunci = (u) => { delete _cache['gagal_' + u]; };
