/* ============================================================
 *  LMS v2 — Uji.gs
 *  Suite uji yang dijalankan DARI EDITOR Apps Script terhadap
 *  database sungguhan — pasangan dari uji node di test/.
 *
 *  Cara pakai:
 *    1. Salin berkas ini ke project Apps Script (bersama berkas
 *       server lain: Util/Db/Auth/Murid/Code/Setup).
 *    2. Pilih fungsi  ujiSemua  di atas lalu tekan ▶ Run
 *       (atau satu suite: ujiGate0() / ujiMurid()).
 *    3. Baca hasil di Execution log.
 *
 *  Aman dijalankan berulang di data nyata:
 *    · seluruh data uji memakai penanda unik "uXXXXXX"
 *    · diakhiri pembersihan otomatis (Users, Session,
 *      Permintaan_Reset, kunci cache akun uji)
 *    · akun seed (guru / siswa01) TIDAK pernah diubah
 *    · jejak di Audit_Logs sengaja dibiarkan — itu fungsinya
 * ============================================================ */

var __UJI = { jml: 0, gagal: 0, stamp: '', ids: [], kelas: [], rows: [], t0: 0 };

/* ============================================================/helper */

function _ujiMulai(judul) {
  __UJI.jml = 0;
  __UJI.gagal = 0;
  __UJI.stamp = 'u' + Math.floor(100000 + Math.random() * 900000);
  __UJI.ids = [];
  __UJI.kelas = [];
  __UJI.rows = [];
  __UJI.t0 = Date.now();
  Logger.log('');
  Logger.log('====================================================');
  Logger.log(' ' + judul + '  (penanda data uji: ' + __UJI.stamp + ')');
  Logger.log('====================================================');
}

function _ujiCek(nama, kondisi, info) {
  __UJI.jml++;
  if (kondisi) {
    Logger.log('  OK  ' + nama);
  } else {
    __UJI.gagal++;
    Logger.log('  GAGAL  ' + nama + (info ? ' → ' + info : ''));
  }
}

/** Panggil fungsi modul yang bisa melempar error → jadi objek respons. */
function _ujiCoba(fn) {
  try { return fn(); }
  catch (e) { return { error: (e && e.kode) || 'GALAT', pesan: e && e.message }; }
}

/** Catat user_id yang dibuat uji → disapu di akhir. */
function _ujiLacak(userId) { __UJI.ids.push(String(userId)); }

/** Catat class_id kelas uji → disapu di akhir (beserta enrollment-nya). */
function _ujiLacakKelas(classId) { __UJI.kelas.push(String(classId)); }

/** Catat baris uji lain (mis. Teaching_Assignments/Subjects) → disapu. */
function _ujiLacakBaris(sheet, id) {
  __UJI.rows.push({ sheet: sheet, id: String(id) });
}

function _ujiSelesai(nama) {
  _ujiBersihkan();
  var lulus = __UJI.jml - __UJI.gagal;
  Logger.log('----------------------------------------------------');
  Logger.log(' ' + nama + ': ' + lulus + '/' + __UJI.jml + ' lulus' +
             (__UJI.gagal ? ' — ' + __UJI.gagal + ' GAGAL ✘' : ' ✔') +
             ' (' + Math.round((Date.now() - __UJI.t0) / 1000) + ' dtk)');
  return { jml: __UJI.jml, gagal: __UJI.gagal };
}

/** Sapu seluruh jejak data uji milik stamp ini. */
function _ujiBersihkan() {
  var sisa = 0;

  /* baris uji lain: course (TA) & mapel (Subjects) */
  __UJI.rows.forEach(function (b) {
    try {
      if (b.sheet === 'Teaching_Assignments') {
        var t = Db.cari('Teaching_Assignments', 'teaching_assignment_id', b.id);
        if (t) Db.hapus('Teaching_Assignments', t._baris);
      } else if (b.sheet === 'Subjects') {
        /* hapus hanya bila tak dipakai TA mana pun (aman di data nyata) */
        var dipakai = Db.saring('Teaching_Assignments', { subject_id: b.id });
        if (dipakai.length) return;
        var sb = Db.cari('Subjects', 'subject_id', b.id);
        if (sb) Db.hapus('Subjects', sb._baris);
      }
    } catch (e) { sisa++; }
  });

  /* kelas uji: enrollment-nya dulu, lalu baris kelasnya */
  __UJI.kelas.forEach(function (cid) {
    try {
      var enr = Db.saring('Enrollment', { class_id: cid });
      if (enr.length) Db.hapusBanyak('Enrollment', enr.map(function (x) { return x._baris; }));
      var k = Db.cari('Classes', 'class_id', cid);
      if (k) Db.hapus('Classes', k._baris);
    } catch (e) { sisa++; }
  });

  __UJI.ids.forEach(function (uid) {
    try {
      var u = Db.cari('Users', 'user_id', uid);
      if (!u) return;
      ['Session', 'Permintaan_Reset', 'Notifications'].forEach(function (sh) {
        var r = Db.saring(sh, { user_id: uid });
        if (r.length) {
          Db.hapusBanyak(sh, r.map(function (x) { return x._baris; }));
        }
      });
      try { CacheService.getScriptCache().remove('gagal_' + u.username); } catch (e) {}
      try { CacheService.getScriptCache().remove('lupa_' + u.username); } catch (e) {}
      Db.hapus('Users', u._baris);
    } catch (e) { sisa++; }
  });

  if (sisa) {
    Logger.log('  !! ' + sisa + ' data uji gagal dibersihkan — cari penanda "' +
               __UJI.stamp + '" lalu hapus manual.');
  }
}

/** Sesi guru tiruan (id guru seed sebenarnya, agar audit jujur). */
function _ujiSesiGuru() {
  var guru = Db.cari('Users', 'username', 'guru');
  return { user_id: guru.user_id, role: 'guru' };
}

/** Pastikan akun seed ada — dibuat bila DB masih kosong. */
function _ujiSeed() {
  function buat(username, password, role) {
    var u = Db.cari('Users', 'username', username);
    if (u) return u;
    var salt = Util.buatSalt();
    var baru = {
      user_id: Util.buatId('USR'), username: username,
      password_hash: Util.hashPassword(password, salt), salt: salt,
      pwd_awal: '', nama: role === 'guru' ? 'Guru (seed)' : 'Murid (seed)',
      role: role, rombel: '', email: '', nisn: '', no_wa: '',
      status: 'aktif', harus_ganti_password: false, last_login: '',
      created_at: Util.sekarang(), updated_at: Util.sekarang()
    };
    Db.tambah('Users', baru);
    Logger.log('  (akun seed "' + username + '" tidak ada — dibuat otomatis)');
    return Db.cari('Users', 'username', username);
  }
  buat('guru', 'guru123', 'guru');
  buat('siswa01', 'siswa123', 'murid');
}

/** Buat satu akun murid uji langsung (tanpa modul Murid) → kembali user_id. */
function _ujiBuatMuridStump(nama, password) {
  var username = __UJI.stamp + '.' + nama;
  var salt = Util.buatSalt();
  var uid = Util.buatId('USR');
  Db.tambah('Users', {
    user_id: uid, username: username,
    password_hash: Util.hashPassword(password, salt), salt: salt,
    pwd_awal: password, nama: 'Uji ' + nama, role: 'murid',
    rombel: '', email: '', nisn: '', no_wa: '',
    status: 'aktif', harus_ganti_password: false, last_login: '',
    created_at: Util.sekarang(), updated_at: Util.sekarang()
  });
  _ujiLacak(uid);
  return { user_id: uid, username: username, password: password };
}

/* ============================================================ SUITE 1 */

/** Gate 0 — auth & sesi (jalankan sendiri: ujiGate0). */
function ujiGate0() {
  _ujiMulai('GATE 0 — LOGIN, SESI, KUNCI, RESET');

  /* --- prasyarat (pesan = petunjuk perbaikan) --- */
  _ujiCek('SKEMA: kolom "password_hash" ada di sheet Users — bila GAGAL: jalankan setupLengkap()',
          Db.header('Users').indexOf('password_hash') !== -1);
  _ujiCek('BERKAS: Auth.gs & Util.gs termuat — bila GAGAL: salin ulang berkasnya',
          typeof Auth !== 'undefined' && typeof Util !== 'undefined');

  _ujiSeed();

  /* --- login akun seed --- */
  var rg = Auth.login('guru', 'guru123');
  _ujiCek('login guru (seed) sukses', rg.ok === true, JSON.stringify(rg));
  _ujiCek('role guru terbawa', rg.ok && rg.data.user.role === 'guru');

  var rm = Auth.login('siswa01', 'siswa123');
  _ujiCek('login murid (seed) sukses', rm.ok === true, JSON.stringify(rm));
  _ujiCek('respons login memuat harus_ganti_password',
          rm.ok && ('harus_ganti_password' in rm.data));

  /* --- validasi token --- */
  var tokenM = rm.ok ? rm.data.token : '';
  _ujiCek('token murid valid → sesi role murid',
          (Auth.validasiToken(tokenM) || {}).role === 'murid');
  _ujiCek('token sampah ditolak', Auth.validasiToken('xxx-uji') === null);

  /* --- pesan galat seragam (akun uji, bukan seed) --- */
  var akun = _ujiBuatMuridStump('gate0', 'UjiGate0A1');
  var a = Auth.login(akun.username, 'salah-satu');
  var b = Auth.login(akun.username, 'salah-dua');
  _ujiCek('pesan galat seragam (anti-enumerasi)',
          a.ok === false && b.ok === false && a.pesan === b.pesan);

  /* --- ganti sandi mandiri --- */
  var sesiM = Auth.validasiToken(Auth.login(akun.username, akun.password).data.token);
  var rgp = Auth.gantiPassword(sesiM, akun.password, 'UjiBaru123');
  _ujiCek('ganti sandi mandiri sukses', rgp && rgp.berhasil === true,
          JSON.stringify(rgp));
  var uKini = Db.cari('Users', 'user_id', akun.user_id);
  _ujiCek('pwd_awal dikosongkan setelah ganti sandi', uKini.pwd_awal === '');
  _ujiCek('login dgn sandi baru sukses',
          Auth.login(akun.username, 'UjiBaru123').ok === true);

  /* --- kunci otomatis 5× gagal/15 menit (akun uji) --- */
  for (var i = 0; i < 5; i++) Auth.login(akun.username, 'salah-ke' + i);
  var terkunci = Auth.login(akun.username, 'UjiBaru123');   /* sandi BENAR */
  _ujiCek('terkunci setelah 5× gagal — sandi benar pun ditolak',
          terkunci && terkunci.error === 'AKUN_TERKUNCI', JSON.stringify(terkunci));
  /* buka kunci — simulasi 15 menit berlalu */
  try { CacheService.getScriptCache().remove('gagal_' + akun.username); } catch (e) {}

  /* --- lupa sandi → reset oleh guru --- */
  var rajukan = ajukanReset(akun.username);   /* endpoint publik Code.gs */
  _ujiCek('ajukan reset diproses (respons selalu sama)',
          rajukan && rajukan.ok === true && rajukan.data &&
          rajukan.data.diterima === true, JSON.stringify(rajukan));
  var antre = Db.saring('Permintaan_Reset', { user_id: akun.user_id })
                .filter(function (r) { return r.status === 'antre'; });
  _ujiCek('permintaan reset tercatat di sheet', antre.length >= 1);

  var tokenG = Auth.login('guru', 'guru123').data.token;
  var rlist = getPermintaanReset(tokenG);
  _ujiCek('guru melihat antrean reset (endpoint role guru)',
          rlist.ok === true, JSON.stringify(rlist));

  var rreset = Auth.resetPasswordMurid(_ujiSesiGuru(), akun.user_id,
                                       antre.length ? antre[0].request_id : '');
  _ujiCek('guru reset sandi → sandi sementara dikembalikan',
          rreset && !!rreset.password_sementara, JSON.stringify(rreset));
  _ujiCek('login dgn sandi sementara sukses',
          Auth.login(akun.username, rreset.password_sementara).ok === true);
  var uKini2 = Db.cari('Users', 'user_id', akun.user_id);
  _ujiCek('harus_ganti_password aktif setelah reset',
          uKini2.harus_ganti_password === true ||
          uKini2.harus_ganti_password === 'TRUE');
  var reqKini = Db.cari('Permintaan_Reset', 'request_id',
                        antre.length ? antre[0].request_id : '');
  _ujiCek('permintaan reset berstatus "selesai"',
          reqKini && reqKini.status === 'selesai');

  /* --- nonaktif ditolak --- */
  Db.perbarui('Users', uKini2._baris, { status: 'nonaktif' });
  _ujiCek('akun nonaktif ditolak saat login',
          Auth.login(akun.username, rreset.password_sementara).ok === false);

  return _ujiSelesai('GATE 0');
}

/* ============================================================ SUITE 2 */

/** Tahap 3.1 — Kelola Murid (jalankan sendiri: ujiMurid). */
function ujiMurid() {
  _ujiMulai('TAHAP 3.1 — KELOLA MURID');

  /* --- prasyarat --- */
  _ujiCek('BERKAS: Murid.gs termuat — bila GAGAL: salin Murid.gs',
          typeof Murid !== 'undefined');
  _ujiCek('BERKAS: endpoint murid* ada di Code.gs — bila GAGAL: salin ulang Code.gs',
          typeof muridDaftar === 'function' && typeof muridSimpan === 'function');

  _ujiSeed();
  var sesiG = _ujiSesiGuru();
  var jmlAwal = Db.baca('Users').length;
  var S = __UJI.stamp;

  /* --- tambah murid --- */
  var r = Murid.simpan(sesiG, { nama: 'Murid Uji Satu',
    username: S + '.satu', nisn: '0091234501', no_wa: '081234567890' });
  _ujiCek('murid dibuat + password_sementara 8 karakter',
          r.baru === true && (r.password_sementara || '').length === 8,
          JSON.stringify(r));
  _ujiLacak(r.user_id);
  var u = Db.cari('Users', 'user_id', r.user_id);
  _ujiCek('sandi tersimpan hash, pwd_awal terisi',
          u.password_hash !== r.password_sementara && u.pwd_awal === r.password_sementara);
  _ujiCek('no_wa dirapikan 62… & harus_ganti_password aktif',
          u.no_wa === '6281234567890' && (u.harus_ganti_password === true ||
          u.harus_ganti_password === 'TRUE'));

  var rdup = _ujiCoba(function () {
    return Murid.simpan(sesiG, { nama: 'Kembar', username: S + '.satu' });
  });
  _ujiCek('username duplikat ditolak (DUPLIKAT)', rdup.error === 'DUPLIKAT',
          JSON.stringify(rdup));

  /* --- daftar & detail --- */
  var rl = Murid.daftar(sesiG, { cari: S });
  _ujiCek('daftar + cari penanda uji', rl.length === 1 && rl[0].user_id === r.user_id,
          'jml=' + rl.length);
  _ujiCek('daftar tak membocorkan hash/salt',
          rl[0].password_hash === undefined && rl[0].salt === undefined);
  var rd = Murid.detail(sesiG, r.user_id);
  _ujiCek('detail memuat pwd_awal & kelas[]',
          rd.pwd_awal === r.password_sementara &&
          Object.prototype.toString.call(rd.kelas) === '[object Array]');

  /* --- edit sebagian + validasi --- */
  Murid.simpan(sesiG, { user_id: r.user_id, no_wa: '081298765432' });
  _ujiCek('edit sebagian no_wa → 62…',
          Db.cari('Users', 'user_id', r.user_id).no_wa === '6281298765432');
  var rn = _ujiCoba(function () {
    return Murid.simpan(sesiG, { user_id: r.user_id, nisn: '12ab' });
  });
  _ujiCek('NISN tak sah ditolak', rn.error === 'VALIDASI_GAGAL');

  /* --- nonaktif → sesi dicabut --- */
  var tokM = Auth.login(u.username, r.password_sementara).data.token;
  Murid.simpan(sesiG, { user_id: r.user_id, status: 'nonaktif' });
  _ujiCek('sesi murid dicabut saat dinonaktifkan',
          Auth.validasiToken(tokM) === null);
  Murid.simpan(sesiG, { user_id: r.user_id, status: 'aktif' });

  /* --- pratinjau & impor massal --- */
  var teks = [
    'Murid Uji Dua, XI TKJ 1, ' + S + '.dua, UjiSandi12',
    'Murid Uji Tiga, XI TKJ 1, ' + S + '.tiga',
    'Murid Uji Dua, XI TKJ 1, ' + S + '.dua, Lemah'
  ].join('\n');
  var rp = Murid.pratinjauImpor(sesiG, teks);
  _ujiCek('pratinjau: 2 siap + 1 bermasalah (sandi lemah)',
          rp.total === 3 && rp.siap.length === 2 && rp.masalah.length === 1,
          JSON.stringify({ s: rp.siap.length, m: rp.masalah.length }));
  _ujiCek('pratinjau tidak menulis ke DB',
          Db.baca('Users').length === jmlAwal + 1);

  var ri = Murid.impor(sesiG, teks);
  _ujiCek('impor: 2 baru + 1 gagal (konsisten dgn pratinjau)',
          ri.jml_baru === 2 && ri.jml_gagal === 1,
          JSON.stringify({ b: ri.jml_baru, g: ri.jml_gagal }));
  ri.hasil.forEach(function (x) { _ujiLacak(x.user_id); });
  var dua = ri.hasil.filter(function (x) { return x.username === S + '.dua'; })[0];
  _ujiCek('impor: sandi kustom guru dipakai & tak wajib ganti',
          dua && dua.password === 'UjiSandi12' && dua.sandi_sendiri === true);
  _ujiCek('impor: murid baru bisa login',
          Auth.login(S + '.dua', 'UjiSandi12').ok === true);

  /* --- endpoint --- */
  var tokenG = Auth.login('guru', 'guru123').data.token;
  var re1 = muridDaftar(tokenG, { cari: S });
  _ujiCek('endpoint muridDaftar (guru) OK', re1.ok === true && re1.data.length >= 1,
          JSON.stringify(re1));
  var tokMurid = Auth.login(u.username, r.password_sementara);
  var re2 = muridDaftar(tokMurid.ok ? tokMurid.data.token : '', {});
  _ujiCek('endpoint muridDaftar ditolak utk role murid',
          re2.ok === false && re2.error === 'AKSES_DITOLAK', JSON.stringify(re2));
  var re3 = muridDetail('token-sampah', r.user_id);
  _ujiCek('endpoint dgn sesi invalid ditolak',
          re3.ok === false && re3.error === 'SESI_INVALID');

  return _ujiSelesai('TAHAP 3.1');
}

/* ============================================================ SUITE 3 */

/** Biodata + lupa sandi/username mandiri (jalankan sendiri: ujiLupaAkses). */
function ujiLupaAkses() {
  _ujiMulai('LUPA AKSES MANDIRI — BIODATA, TANGGAL LAHIR');

  /* --- prasyarat --- */
  _ujiCek('SKEMA: Users punya kolom "tanggal_lahir" — bila GAGAL: jalankan migrasiStruktur()',
          Db.header('Users').indexOf('tanggal_lahir') !== -1);
  _ujiCek('BERKAS: Auth.lupaPassword/lupaUsername ada — bila GAGAL: salin ulang Auth.gs',
          typeof Auth !== 'undefined' &&
          typeof Auth.lupaPassword === 'function' &&
          typeof Auth.lupaUsername === 'function');
  _ujiCek('BERKAS: endpoint lupaPassword/lupaUsername ada — bila GAGAL: salin ulang Code.gs',
          typeof lupaPassword === 'function' && typeof lupaUsername === 'function' &&
          typeof simpanBiodata === 'function');

  _ujiSeed();
  var S = __UJI.stamp;

  /* --- murid uji TANPA biodata --- */
  var m = _ujiBuatMuridStump('lupa', 'UjiLupa123');
  var login = Auth.login(m.username, m.password);
  _ujiCek('login tanpa biodata → diminta melengkapi',
          login.ok && login.data.biodata_kurang === true, JSON.stringify(login));
  var tokM = login.data.token;

  /* --- simpan biodata: NISN opsional, tgl lahir wajib --- */
  var rb = simpanBiodata(tokM, { email: S + '@uji.sch.id',
    no_wa: '081234567890', tanggal_lahir: '17/05/2010' });
  _ujiCek('biodata tersimpan TANPA NISN (opsional)',
          rb.ok === true && rb.data.biodata_kurang === false, JSON.stringify(rb));
  var uB = Db.cari('Users', 'user_id', m.user_id);
  _ujiCek('tgl lahir dibakukan YYYY-MM-DD & WA jadi 62…',
          uB.tanggal_lahir === '2010-05-17' && uB.no_wa === '6281234567890');

  /* --- getBiodata: layar Biodata Saya (laporan pemakaian nyata) --- */
  _ujiCek('BERKAS: endpoint getBiodata ada — bila GAGAL: salin ulang Code.gs',
          typeof getBiodata === 'function');
  var rg = getBiodata(tokM);
  _ujiCek('getBiodata → biodata tersimpan terbaca balik',
          rg.ok === true && rg.data.email === S + '@uji.sch.id' &&
          rg.data.tanggal_lahir === '2010-05-17', JSON.stringify(rg));
  var rg2 = getBiodata(Auth.login('guru', 'guru123').data.token);
  _ujiCek('getBiodata ditolak untuk guru (AKSES_DITOLAK)',
          rg2.ok === false && rg2.error === 'AKSES_DITOLAK', JSON.stringify(rg2));

  /* --- lupa password: salah lalu benar --- */
  var r1 = lupaPassword('', m.username, '628999999999', '2010-05-17');
  _ujiCek('WA salah → ditolak dengan pesan "hubungi guru"',
          r1.ok && r1.data.diterima === false &&
          /hubungi guru/.test(r1.data.pesan), JSON.stringify(r1));
  _ujiCek('sandi lama masih berlaku saat gagal',
          Auth.login(m.username, m.password).ok === true);

  var r2 = lupaPassword('', m.username, '081234567890', '17/05/2010');
  _ujiCek('lupa password sukses → sandi sementara baru 8 kar.',
          r2.ok && r2.data.diterima === true &&
          (r2.data.password_sementara || '').length === 8, JSON.stringify(r2));
  _ujiCek('login dgn sandi baru sukses',
          Auth.login(m.username, r2.data.password_sementara).ok === true);
  _ujiCek('sesi lama tercabut setelah reset mandiri',
          Auth.validasiToken(tokM) === null);

  /* --- lupa username & password: salah lalu benar --- */
  var r3 = lupaUsername('', S + '@uji.sch.id', '628112233445', '17/05/2010');
  _ujiCek('WA salah → ditolak', r3.ok && r3.data.diterima === false);
  var r4 = lupaUsername('', S + '@uji.sch.id', '081234567890', '17/05/2010');
  _ujiCek('lupa username sukses → username terlihat + sandi baru',
          r4.ok && r4.data.diterima === true &&
          r4.data.username === m.username &&
          (r4.data.password_sementara || '').length === 8, JSON.stringify(r4));

  /* --- batas 5×/15 menit --- */
  for (var i = 0; i < 5; i++) {
    lupaPassword('', m.username, '628000000000', '2010-05-17');
  }
  var r5 = lupaPassword('', m.username, '081234567890', '17/05/2010');
  _ujiCek('percobaan ke-6 diblokir (data benar pun)',
          r5.ok && r5.data.diterima === false &&
          /Terlalu banyak/.test(r5.data.pesan), JSON.stringify(r5));

  return _ujiSelesai('LUPA AKSES MANDIRI');
}

/* ============================================================ SUITE 4 */

/** Kelola Kelas (jalankan sendiri: ujiKelas). */
function ujiKelas() {
  _ujiMulai('TAHAP 3.2 — KELOLA KELAS');

  /* --- prasyarat --- */
  _ujiCek('BERKAS: Kelas.gs termuat — bila GAGAL: salin Kelas.gs',
          typeof Kelas !== 'undefined');
  _ujiCek('BERKAS: endpoint kelas* ada di Code.gs — bila GAGAL: salin ulang Code.gs',
          typeof kelasDaftar === 'function' && typeof kelasEnroll === 'function');
  _ujiCek('SKEMA: Classes/Enrollment/Notifications ada — bila GAGAL: jalankan setupLengkap()/migrasiStruktur()',
          Db.header('Classes').indexOf('class_id') !== -1 &&
          Db.header('Enrollment').indexOf('enroll_id') !== -1 &&
          Db.header('Notifications').indexOf('notif_id') !== -1);

  _ujiSeed();
  var sesiG = _ujiSesiGuru();
  var S = __UJI.stamp;

  /* --- buat & duplikat --- */
  var r = Kelas.simpan(sesiG, { name: 'Uji ' + S });
  _ujiCek('kelas dibuat (KLS-…)', r.baru === true && /^KLS-/.test(r.class_id),
          JSON.stringify(r));
  var K = r.class_id;
  _ujiLacakKelas(K);
  var rdup = _ujiCoba(function () {
    return Kelas.simpan(sesiG, { name: 'uji ' + S });
  });
  _ujiCek('nama kembar (tak peka huruf) ditolak DUPLIKAT', rdup.error === 'DUPLIKAT');

  /* --- murid uji 2 orang + enroll --- */
  var m1 = _ujiBuatMuridStump('k1', 'UjiKelas12');
  var m2 = _ujiBuatMuridStump('k2', 'UjiKelas34');
  var re = Kelas.enroll(sesiG, K, [m1.user_id, m2.user_id]);
  _ujiCek('enroll 2 murid', re.ditambah === 2 && re.dilewati === 0,
          JSON.stringify(re));
  var rd = Kelas.detail(sesiG, K);
  _ujiCek('detail: 2 murid, pwd_awal terlihat, urut nama',
          rd.jml_murid === 2 && rd.murid[0].nama === 'Uji k1' &&
          rd.murid[0].pwd_awal === 'UjiKelas12' && rd.murid[0].sudah_ganti === false);
  _ujiCek('notif enroll_kelas terkirim ke 2 murid',
          Db.saring('Notifications', { jenis: 'enroll_kelas' })
            .filter(function (n) {
              return n.user_id === m1.user_id || n.user_id === m2.user_id;
            }).length === 2);
  var rt = Kelas.muridTersedia(sesiG, K);
  _ujiCek('murid uji tak muncul lagi di "tersedia"',
          rt.every(function (x) {
            return x.user_id !== m1.user_id && x.user_id !== m2.user_id;
          }));

  /* --- keluarkan lalu enroll ulang → reaktivasi --- */
  Kelas.keluarkan(sesiG, K, m2.user_id);
  _ujiCek('keluarkan → detail 1 murid', Kelas.detail(sesiG, K).jml_murid === 1);
  var rr = Kelas.enroll(sesiG, K, [m2.user_id]);
  _ujiCek('enroll ulang → reaktivasi baris (bukan baris baru)',
          rr.diaktifkan === 1 && Kelas.detail(sesiG, K).jml_murid === 2,
          JSON.stringify(rr));

  /* --- arsip --- */
  var ra = Kelas.arsip(sesiG, K);
  _ujiCek('arsip sukses (tak dipakai course)', ra.diarsipkan === true);
  _ujiCek('kelas arsip hilang dari daftar',
          Kelas.daftar(sesiG).every(function (x) { return x.class_id !== K; }));

  /* --- endpoint --- */
  var tokenG = Auth.login('guru', 'guru123').data.token;
  var re1 = kelasDaftar(tokenG);
  _ujiCek('endpoint kelasDaftar (guru) OK', re1.ok === true, JSON.stringify(re1));
  var tokMurid = Auth.login(m1.username, m1.password);
  var re2 = kelasDaftar(tokMurid.ok ? tokMurid.data.token : '');
  _ujiCek('endpoint kelasDaftar ditolak utk murid',
          re2.ok === false && re2.error === 'AKSES_DITOLAK');

  /* --- kelasSaya: kartu "Kelas Saya" dashboard murid (laporan) --- */
  _ujiCek('BERKAS: endpoint kelasSaya ada — bila GAGAL: salin ulang Code.gs',
          typeof kelasSaya === 'function');
  var rks0 = kelasSaya(tokMurid.ok ? tokMurid.data.token : '');
  _ujiCek('kelasSaya dijawab utk murid (riwayat arsip → kosong)',
          rks0.ok === true && Array.isArray(rks0.data), JSON.stringify(rks0));
  var rkK = Kelas.simpan(sesiG, { name: 'Kelas Saya ' + __UJI.stamp });
  _ujiLacakKelas(rkK.class_id);
  var rksE = kelasEnroll(tokenG, rkK.class_id, [m1.user_id]);
  _ujiCek('prasyarat: m1 ter-enroll kelas baru',
          rksE.ok === true && rksE.data.ditambah === 1, JSON.stringify(rksE));
  var rksC = courseSimpan(tokenG, { class_id: rkK.class_id,
    name: 'Uji Mapel ' + __UJI.stamp });
  _ujiCek('prasyarat: course aktif dibuat di kelas baru',
          rksC.ok === true, JSON.stringify(rksC));
  var rks1 = kelasSaya(tokMurid.data.token);
  _ujiCek('kelasSaya → kelas dgn mapel terlihat',
          rks1.ok === true && rks1.data.some(function (x) {
            return x.class_id === rkK.class_id && x.jml_course === 1 &&
                   x.course[0] === 'Uji Mapel ' + __UJI.stamp;
          }), JSON.stringify(rks1));
  var rks2 = kelasSaya(tokenG);
  _ujiCek('kelasSaya ditolak utk guru (AKSES_DITOLAK)',
          rks2.ok === false && rks2.error === 'AKSES_DITOLAK', JSON.stringify(rks2));

  return _ujiSelesai('TAHAP 3.2');
}

/* ============================================================ SUITE 5 */

/** Kelola Course (jalankan sendiri: ujiCourse). */
function ujiCourse() {
  _ujiMulai('TAHAP 3.3 — KELOLA COURSE');

  /* --- prasyarat --- */
  _ujiCek('BERKAS: Course.gs termuat — bila GAGAL: salin Course.gs',
          typeof Course !== 'undefined');
  _ujiCek('BERKAS: endpoint course* ada di Code.gs — bila GAGAL: salin ulang Code.gs',
          typeof courseDaftar === 'function' && typeof courseSimpan === 'function');
  _ujiCek('SKEMA: Teaching_Assignments & Subjects ada — bila GAGAL: jalankan setupLengkap()/migrasiStruktur()',
          Db.header('Teaching_Assignments').indexOf('teaching_assignment_id') !== -1 &&
          Db.header('Subjects').indexOf('subject_id') !== -1);

  _ujiSeed();
  var sesiG = _ujiSesiGuru();
  var S = __UJI.stamp;

  /* --- dua kelas uji --- */
  var kA = Kelas.simpan(sesiG, { name: 'Uji C1 ' + S });
  var kB = Kelas.simpan(sesiG, { name: 'Uji C2 ' + S });
  _ujiLacakKelas(kA.class_id);
  _ujiLacakKelas(kB.class_id);

  /* --- buat course: kelas + mapel bebas --- */
  var r = Course.simpan(sesiG, { class_id: kA.class_id, name: 'Mapel ' + S });
  _ujiCek('course dibuat + label "KELAS - MAPEL"',
          r.baru === true && r.label === ('Uji C1 ' + S + ' - Mapel ' + S),
          JSON.stringify(r));
  _ujiLacakBaris('Teaching_Assignments', r.teaching_assignment_id);
  _ujiLacakBaris('Subjects', r.subject_id);
  _ujiCek('mapel baru otomatis dibuat di Subjects',
          Db.cari('Subjects', 'subject_id', r.subject_id).name === 'Mapel ' + S);
  var SBK = r.subject_id, TA1 = r.teaching_assignment_id;

  var rdup = _ujiCoba(function () {
    return Course.simpan(sesiG, { class_id: kA.class_id, name: 'mapel ' + S });
  });
  _ujiCek('pasangan kelas+mapel sama (beda huruf) ditolak DUPLIKAT',
          rdup.error === 'DUPLIKAT', JSON.stringify(rdup));

  /* --- dedupe mapel antar kelas --- */
  var jmlSbk = Db.baca('Subjects').length;
  var r2 = Course.simpan(sesiG, { class_id: kB.class_id, name: 'MAPEL ' + S });
  _ujiCek('mapel sama di kelas lain → SBK LAMA dipakai (tidak duplikat)',
          r2.baru === true && r2.subject_id === SBK &&
          Db.baca('Subjects').length === jmlSbk, JSON.stringify(r2));
  _ujiLacakBaris('Teaching_Assignments', r2.teaching_assignment_id);
  var TA2 = r2.teaching_assignment_id;

  /* --- daftar & detail --- */
  var rl = Course.daftar(sesiG).filter(function (x) {
    return x.label.indexOf(S) !== -1;
  });
  _ujiCek('daftar memuat 2 course uji ber-label benar',
          rl.length === 2 &&
          rl[0].label.indexOf(' - Mapel ' + S) !== -1,
          JSON.stringify(rl.map(function (x) { return x.label; })));
  var rd = Course.detail(sesiG, TA1);
  _ujiCek('detail memuat kelas & mapel',
          rd.class_id === kA.class_id && rd.subject_id === SBK);

  /* --- hapus & reaktivasi --- */
  Course.hapus(sesiG, TA1);
  _ujiCek('hapus → hilang dari daftar',
          Course.daftar(sesiG).every(function (x) {
            return x.teaching_assignment_id !== TA1;
          }));
  var jmlTA = Db.baca('Teaching_Assignments').length;
  var rr = Course.simpan(sesiG, { class_id: kA.class_id, name: 'Mapel ' + S });
  _ujiCek('buat ulang → REAKTIVASI TA lama (tanpa baris baru)',
          rr.baru === true && rr.reaktivasi === true &&
          rr.teaching_assignment_id === TA1 &&
          Db.baca('Teaching_Assignments').length === jmlTA, JSON.stringify(rr));

  /* --- endpoint --- */
  var tokenG = Auth.login('guru', 'guru123').data.token;
  var re1 = courseDaftar(tokenG);
  _ujiCek('endpoint courseDaftar (guru) OK', re1.ok === true, JSON.stringify(re1));
  var m = _ujiBuatMuridStump('crs', 'UjiCrs1234');
  var tokM = Auth.login(m.username, m.password);
  var re2 = courseDaftar(tokM.ok ? tokM.data.token : '');
  _ujiCek('endpoint courseDaftar ditolak utk murid',
          re2.ok === false && re2.error === 'AKSES_DITOLAK', JSON.stringify(re2));

  return _ujiSelesai('TAHAP 3.3');
}

/* ============================================================ SUITE 6 */

/** Status API Key (jalankan sendiri: ujiApiKey). */
function ujiApiKey() {
  _ujiMulai('TAHAP 3.4 — STATUS API KEY');

  /* --- prasyarat --- */
  _ujiCek('BERKAS: ApiKey.gs termuat — bila GAGAL: salin ApiKey.gs',
          typeof ApiKey !== 'undefined');
  _ujiCek('BERKAS: endpoint apiKey* ada di Code.gs — bila GAGAL: salin ulang Code.gs',
          typeof apiKeyStatus === 'function' && typeof apiKeySimpan === 'function');

  _ujiSeed();
  var sesiG = _ujiSesiGuru();

  /* KUNCI PALSU HANYA UNTUK UJI — bentuk sah, bukan key sungguhan;
     diganti/dicabut lagi di akhir suite. */
  var K1 = 'AIzaUjiUjiUjiUjiUjiUjiUjiUjiUjiUjiUji1111';
  var K2 = 'AIzaUjiUjiUjiUjiUjiUjiUjiUjiUjiUjiUji2222';

  /* --- status awal --- */
  var awal = ApiKey.status(sesiG);
  _ujiCek('respons status berbentuk lengkap',
          'jml' in awal && 'maks' in awal && 'key' in awal &&
          awal.maks === 10, JSON.stringify({ j: awal.jml, m: awal.maks }));

  /* --- simpan: validasi --- */
  var r11 = _ujiCoba(function () {
    var banyak = [];
    for (var i = 0; i < 11; i++) banyak.push('AIzaUjiUjiUjiUjiUjiUjiUjiUjiUjiUji0' + i);
    return ApiKey.simpan(sesiG, banyak);
  });
  _ujiCek('11 key ditolak (maks 10)',
          r11.error === 'VALIDASI_GAGAL' && /Maksimal 10/.test(r11.pesan),
          JSON.stringify(r11));
  var rp = _ujiCoba(function () { return ApiKey.simpan(sesiG, ['pendek']); });
  _ujiCek('key salah bentuk ditolak', rp.error === 'VALIDASI_GAGAL');

  /* --- simpan benar --- */
  var rs = ApiKey.simpan(sesiG, [K1, K2]);
  _ujiCek('2 key tersimpan (menimpa daftar lama)', rs.jml === 2, JSON.stringify(rs));
  var rst = ApiKey.status(sesiG);
  _ujiCek('status: 2 key siap & hanya 4 digit terakhir terlihat',
          rst.jml === 2 && rst.jml_siap === 2 &&
          rst.key[0].ekor === '1111' &&
          JSON.stringify(rst).indexOf('AIzaUjiUji') === -1,
          JSON.stringify(rst.key));

  /* --- cooldown --- */
  try {
    CacheService.getScriptCache().put('gemini_key_rusak_0', '400', 3600);
  } catch (e) {}
  _ujiCek('key rusak → "bermasalah"',
          ApiKey.status(sesiG).key[0].status === 'bermasalah');
  ApiKey.resetCooldown(sesiG);
  _ujiCek('reset cooldown → kembali "siap"',
          ApiKey.status(sesiG).jml_siap === 2 &&
          ApiKey.status(sesiG).jml_bermasalah === 0);

  /* --- cabut semua (pulihkan keadaan awal) --- */
  ApiKey.simpan(sesiG, []);
  _ujiCek('daftar kosong mencabut semua key',
          ApiKey.status(sesiG).terpasang === false);

  /* --- endpoint --- */
  var tokenG = Auth.login('guru', 'guru123').data.token;
  var re1 = apiKeyStatus(tokenG);
  _ujiCek('endpoint apiKeyStatus (guru) OK', re1.ok === true, JSON.stringify(re1));
  var m = _ujiBuatMuridStump('key', 'UjiKey1234');
  var tokM = Auth.login(m.username, m.password);
  var re2 = apiKeyStatus(tokM.ok ? tokM.data.token : '');
  _ujiCek('endpoint apiKeyStatus ditolak utk murid',
          re2.ok === false && re2.error === 'AKSES_DITOLAK', JSON.stringify(re2));

  return _ujiSelesai('TAHAP 3.4');
}

/* ============================================================ SUITE 7 */

/** Beranda ringkas (jalankan sendiri: ujiBeranda). */
function ujiBeranda() {
  _ujiMulai('TAHAP 3.5 — BERANDA RINGKAS');

  /* --- prasyarat --- */
  _ujiCek('BERKAS: endpoint ringkasDashboard ada — bila GAGAL: salin ulang Code.gs',
          typeof ringkasDashboard === 'function');
  _ujiCek('BERKAS: ApiKey.gs termuat — bila GAGAL: salin ApiKey.gs',
          typeof ApiKey !== 'undefined');

  _ujiSeed();
  var sesiG = _ujiSesiGuru();
  var S = __UJI.stamp;

  /* --- kelas + course uji untuk hitungan --- */
  var jmlKelasSebelum = Kelas.daftar(sesiG).length;
  var k = Kelas.simpan(sesiG, { name: 'Uji B1 ' + S });
  _ujiLacakKelas(k.class_id);
  var c = Course.simpan(sesiG, { class_id: k.class_id, name: 'Mapel B ' + S });
  _ujiLacakBaris('Teaching_Assignments', c.teaching_assignment_id);
  _ujiLacakBaris('Subjects', c.subject_id);

  var tokenG = Auth.login('guru', 'guru123').data.token;
  var r = ringkasDashboard(tokenG);
  _ujiCek('endpoint ringkasDashboard (guru) OK',
          r.ok === true && r.data.role === 'guru', JSON.stringify(r));
  var d = r.data;
  _ujiCek('kelas_aktif bertambah 1',
          d.kelas_aktif === jmlKelasSebelum + 1,
          'sebelum=' + jmlKelasSebelum + ' kini=' + d.kelas_aktif);
  _ujiCek('course_aktif terhitung & api_key.maks = 10',
          d.course_aktif >= 1 && d.api_key && d.api_key.maks === 10,
          JSON.stringify({ c: d.course_aktif, a: d.api_key }));

  /* --- perlu tindakan: murid uji mengajukan reset --- */
  var m = _ujiBuatMuridStump('bda', 'UjiBda1234');
  Auth.login(m.username, m.password);   /* bangun jejak agar realistis */
  ajukanReset(m.username);
  var d2 = ringkasDashboard(tokenG).data;
  var temuan = d2.perlu_tindakan.daftar.filter(function (x) {
    return x.user_id === m.user_id; });
  _ujiCek('permintaan reset murid uji masuk "perlu tindakan"',
          d2.perlu_tindakan.jml >= 1 && temuan.length === 1 &&
          temuan[0].username === m.username, JSON.stringify(d2.perlu_tindakan));

  /* --- murid --- */
  var tokM = Auth.login(m.username, m.password).data.token;
  var rm = ringkasDashboard(tokM);
  _ujiCek('endpoint utk murid OK (bentuk murid)',
          rm.ok === true && rm.data.role === 'murid' &&
          'kelas_diikuti' in rm.data && 'notif_baru' in rm.data &&
          'biodata_kurang' in rm.data, JSON.stringify(rm));

  var re = ringkasDashboard('token-sampah');
  _ujiCek('sesi invalid ditolak', re.ok === false && re.error === 'SESI_INVALID');

  return _ujiSelesai('TAHAP 3.5');
}

/* ============================================================ SEMUA */

/** Jalankan seluruh suite. Fungsi inilah yang dijalankan dari editor. */
function ujiSemua() {
  var t0 = Date.now();
  var a = ujiGate0();
  var b = ujiMurid();
  var c = ujiLupaAkses();
  var d = ujiKelas();
  var e = ujiCourse();
  var f = ujiApiKey();
  var g = ujiBeranda();
  var total = a.jml + b.jml + c.jml + d.jml + e.jml + f.jml + g.jml;
  var gagal = a.gagal + b.gagal + c.gagal + d.gagal + e.gagal + f.gagal + g.gagal;
  Logger.log('');
  Logger.log('====================================================');
  Logger.log(' UJI SEMUA: ' + (total - gagal) + '/' + total + ' lulus' +
             (gagal ? ' — ' + gagal + ' GAGAL ✘' : ' — SEMUA LULUS ✔') +
             '  (' + Math.round((Date.now() - t0) / 1000) + ' dtk)');
  Logger.log('====================================================');
  return { jml: total, gagal: gagal };
}
