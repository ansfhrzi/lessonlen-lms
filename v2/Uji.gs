/**
 * ============================================================
 *  LMS v2 — Uji.gs
 *  Rangkaian uji TAHAPAN yang dijalankan dari EDITOR Apps Script.
 *  Padanan dari test/uji-auth-gate0.js, uji-kelas.js, uji-tahap4.js
 *  yang biasa dijalankan dengan Node.
 * ------------------------------------------------------------
 *  CARA PAKAI:
 *    1. Database harus sudah disiapkan — jalankan setupLengkap()
 *       sekali bila belum.
 *    2. Pilih fungsi di atas editor, lalu Run:
 *         ujiGate0()    → Gate 0 : login, sesi, kunci, reset  (~18 uji)
 *         ujiTahap3()   → kelas, murid, enrollment              (~40 uji)
 *         ujiTahap4()   → mapel, penugasan, topik, item         (~80 uji)
 *         ujiSemua()    → ketiganya berurutan
 *    3. Buka logExecutionLogs (View → Logs) — hasilnya per baris:
 *         OK  <nama uji>   /   GAGAL <nama uji> → <info>
 *       dan ringkasan di akhir.
 *
 *  KEAMANAN DATA:
 *    - Seluruh data uji memakai penanda unik (mis. username
 *      "k3x9q2budi01") dan DIHAPUS OTOMATIS di akhir uji — juga
 *      bila ada uji yang gagal.
 *    - Nomor ID di sheet Counters ikut maju — itu normal, tidak
 *      berpengaruh apa pun.
 *    - Jalankan saat aplikasi TIDAK sedang dipakai orang lain,
 *      karena pembersihan log/notifikasi memakai garis air baris.
 *    - Tetap disarankan mencoba dulu di spreadsheet DB tiruan.
 * ============================================================
 */

/* ============================================================
 *  KERANGKA UJI
 * ============================================================ */

var UJI = { jumlah: 0, gagal: 0, stamp: '', tokens: [], ids: {}, air: {} };

function _ujiMulai(judul) {
  if (!PropertiesService.getScriptProperties().getProperty('DB_ID')) {
    throw new Error('DB belum disiapkan. Jalankan setupLengkap() dulu.');
  }
  UJI = { jumlah: 0, gagal: 0,
          stamp: 'u' + Utilities.getUuid().replace(/[^a-z0-9]/gi, '')
                     .slice(0, 6).toLowerCase(),
          tokens: [], ids: {}, air: {} };

  var t0 = Date.now();
  console.log('====================================================');
  console.log(' ' + judul + '  (penanda data uji: ' + UJI.stamp + ')');
  console.log('====================================================');
  return t0;
}

function _ujiCek(nama, kondisi, info) {
  UJI.jumlah++;
  if (kondisi) {
    console.log('  OK  ' + nama);
  } else {
    UJI.gagal++;
    console.log('  GAGAL ' + nama + (info ? ' → ' + info : ''));
  }
}

function _ujiSelesai(judul, t0) {
  var detik = Math.round((Date.now() - t0) / 100) / 10;
  console.log('----------------------------------------------------');
  console.log(' ' + judul + ': ' + (UJI.jumlah - UJI.gagal) + '/' +
              UJI.jumlah + ' lulus, ' + UJI.gagal + ' gagal (' +
              detik + ' dtk)');
  console.log('====================================================');
  return { lulus: UJI.jumlah - UJI.gagal, gagal: UJI.gagal };
}

/** Jalankan isi uji + pastikan pembersihan tetap jalan. */
function _ujiPesta(judul, isi) {
  var t0 = _ujiMulai(judul);
  try {
    isi();
  } catch (e) {
    UJI.gagal++;
    console.log('  GAGAL (suite terhenti) → ' + e.message +
                (e.stack ? '\n' + e.stack : ''));
  } finally {
    _ujiBersihkan();
  }
  return _ujiSelesai(judul, t0);
}

/* ------------------------------------------------ data uji */

function _ujiBuatUser(username, nama, role, password) {
  var salt = Util.buatSalt();
  var id = Util.buatId('USR');
  Db.tambah('Users', {
    user_id: id, username: username,
    password_hash: Util.hashPassword(password, salt), salt: salt,
    pwd_awal: password, nama: nama, role: role, rombel: '', email: '',
    nisn: '', no_wa: '', status: 'aktif', harus_ganti_password: false,
    last_login: '', created_at: Util.sekarang(), updated_at: Util.sekarang()
  });
  UJI.ids.Users.push(id);
  return id;
}

function _ujiLogin(username, password) {
  var r = Auth.login(username, password);
  if (r.ok) UJI.tokens.push(r.data.token);
  return r;
}

/** Simpan garis air (baris terakhir) sebelum uji — utk pembersihan. */
function _ujiAir(namaSheet) {
  UJI.air[namaSheet] = Db.sheet(namaSheet).getLastRow();
}

/** Hapus semua baris yang bertambah setelah garis air. */
function _ujiBersihkanAir(namaSheet) {
  var wm = UJI.air[namaSheet];
  if (!wm) return;
  var sh = Db.sheet(namaSheet);
  var akhir = sh.getLastRow();
  if (akhir > wm) sh.deleteRows(wm + 1, akhir - wm);
  Db.invalidasi(namaSheet);
}

/** Hapus baris berdasar ID di kolom pertama. */
function _ujiHapusId(namaSheet, id) {
  if (!id) return;
  var b = Db.cari(namaSheet, Db.header(namaSheet)[0], id);
  if (b) Db.hapus(namaSheet, b._baris);
}

/** Pembersihan total — selalu dipanggil di finally. */
function _ujiBersihkan() {
  var cache = CacheService.getScriptCache();

  try {
    var setUser = {};
    (UJI.ids.Users || []).forEach(function (uid) { setUser[uid] = true; });

    /* sapu user berpenanda (hasil impor, ID tak tercatat) */
    Db.bacaKolom('Users', ['user_id', 'username', 'nama'])
      .forEach(function (u) {
        if (String(u.username).indexOf(UJI.stamp) !== -1 ||
            String(u.nama).indexOf(UJI.stamp) !== -1) setUser[u.user_id] = true;
      });

    var setIdKelas = {};
    (UJI.ids.Classes || []).forEach(function (cid) { setIdKelas[cid] = true; });

    /* sesi: token uji + sesi milik user uji — kumpulkan dulu,
       hapus SEKALI (hapus per baris menggeser nomor baris) */
    var barisSesi = [];
    UJI.tokens.forEach(function (t) {
      try { cache.remove('sesi_' + t); } catch (e) {}
    });
    Db.baca('Session').forEach(function (s) {
      if (setUser[s.user_id] || UJI.tokens.indexOf(s.token) !== -1) {
        try { cache.remove('sesi_' + s.token); } catch (e) {}
        barisSesi.push(s._baris);
      }
    });
    Db.hapusBanyak('Session', barisSesi);

    /* entitas anak → induk (per ID, dicari ulang tiap kali) */
    (UJI.ids.Items    || []).forEach(function (id) { _ujiHapusId('Items', id); });
    (UJI.ids.Topics   || []).forEach(function (id) { _ujiHapusId('Topics', id); });
    (UJI.ids.TA       || []).forEach(function (id) {
      _ujiHapusId('Teaching_Assignments', id); });
    (UJI.ids.Subjects || []).forEach(function (id) { _ujiHapusId('Subjects', id); });

    /* enrollment milik kelas/user uji */
    var barisEnr = [];
    Db.baca('Enrollment').forEach(function (e) {
      if (setIdKelas[e.class_id] || setUser[e.user_id]) barisEnr.push(e._baris);
    });
    Db.hapusBanyak('Enrollment', barisEnr);

    (UJI.ids.Classes || []).forEach(function (cid) {
      _ujiHapusId('Classes', cid);
    });

    /* user uji */
    var barisUser = [];
    Db.baca('Users').forEach(function (u) {
      if (setUser[u.user_id]) {
        try { cache.remove('gagal_' + u.username); } catch (e) {}
        barisUser.push(u._baris);
      }
    });
    Db.hapusBanyak('Users', barisUser);

    /* baris tambahan pada sheet append-only */
    _ujiBersihkanAir('Permintaan_Reset');
    _ujiBersihkanAir('Notifications');
    _ujiBersihkanAir('Audit_Logs');

    console.log('  ~ pembersihan data uji (' + UJI.stamp + ') selesai');
  } catch (e) {
    console.log('  !! pembersihan bermasalah: ' + e.message +
                ' — sisa data uji memakai penanda "' + UJI.stamp + '"');
  }
}

/** Init daftar pelacak ID — panggil di awal tiap suite. */
function _ujiLacak() {
  UJI.ids = { Users: [], Classes: [], Subjects: [], TA: [],
              Topics: [], Items: [] };
  _ujiAir('Permintaan_Reset');
  _ujiAir('Notifications');
  _ujiAir('Audit_Logs');
}

/** Hitung notif milik sekumpulan user (agar tak tercampur data nyata). */
function _ujiHitungNotif(userIds, jenis) {
  var set = {};
  userIds.forEach(function (u) { set[u] = true; });
  return Db.bacaKolom('Notifications',
                      ['notif_id', 'user_id', 'jenis'])
    .filter(function (n) { return set[n.user_id] && n.jenis === jenis; })
    .length;
}

/* ============================================================
 *  GATE 0 — LOGIN & SESI
 * ============================================================ */

function ujiGate0() {
  return _ujiPesta('GATE 0 — LOGIN & SESI', function () {
    _ujiLacak();

    var G = UJI.stamp + 'guru',  M = UJI.stamp + 'siswa01';
    _ujiBuatUser(G, 'Guru Uji Gate0', 'guru', 'guru123');
    _ujiBuatUser(M, 'Murid Uji Gate0', 'murid', 'siswa123');
    var GID_M = Db.cari('Users', 'username', M).user_id;

    /* --- login benar / salah --- */
    var r = _ujiLogin(M, 'siswa123');
    _ujiCek('login murid sukses', r.ok === true, JSON.stringify(r));
    _ujiCek('murid ditandai biodata_kurang', r.ok && r.data.biodata_kurang === true);
    var TOKEN_M = r.ok ? r.data.token : '';

    r = _ujiLogin('  ' + G.toUpperCase() + ' ', 'guru123');
    _ujiCek('login guru sukses + normalisasi username', r.ok === true);

    r = Auth.login(M, 'salah');
    _ujiCek('password salah ditolak', r.ok === false && r.error === 'LOGIN_GAGAL');

    var a = Auth.login('tidakada' + UJI.stamp, 'x'), b = Auth.login(M, 'salah');
    _ujiCek('pesan seragam anti-enumerasi', a.pesan === b.pesan);

    /* --- token --- */
    var sesi = Auth.validasiToken(TOKEN_M);
    _ujiCek('token valid → sesi murid', !!sesi && sesi.role === 'murid');
    _ujiCek('token sampah ditolak', Auth.validasiToken('xxx') === null);

    /* --- kunci 5x gagal --- */
    for (var i = 0; i < 4; i++) Auth.login(M, 'salah');
    r = Auth.login(M, 'siswa123');
    _ujiCek('terkunci setelah 5x gagal',
      r.ok === false && r.error === 'AKUN_TERKUNCI');
    CacheService.getScriptCache().remove('gagal_' + M);

    /* --- ganti password --- */
    sesi = Auth.validasiToken(TOKEN_M);
    try {
      Auth.gantiPassword(sesi, 'siswa123', 'sandibaru1');
      r = _ujiLogin(M, 'sandibaru1');
      _ujiCek('ganti password lalu login baru', r.ok === true);
      try {
        Auth.gantiPassword(Auth.validasiToken(TOKEN_M), 'salah', 'x');
        _ujiCek('ganti dgn sandi lama salah → gagal', false);
      } catch (e) {
        _ujiCek('ganti dgn sandi lama salah → gagal',
                e.kode === 'VALIDASI_GAGAL');
      }
    } catch (e) { _ujiCek('ganti password lalu login baru', false, e.message); }

    /* --- lupa & reset password --- */
    var resp = Auth.ajukanReset(M);
    _ujiCek('ajukanReset diterima (respons seragam)', resp.diterima === true);
    var antre = Auth.getPermintaanReset()
      .filter(function (x) { return x.username === M; });
    _ujiCek('permintaan masuk antrean', antre.length === 1);

    var TOKEN_G = _ujiLogin(G, 'guru123').data.token;
    var hasil = resetPasswordMurid(TOKEN_G, GID_M,
                                   antre.length ? antre[0].request_id : '');
    var PWD = (hasil.ok && hasil.data) ? hasil.data.password_sementara : '';
    _ujiCek('reset → sandi sementara 8 karakter',
      typeof PWD === 'string' && PWD.length === 8, JSON.stringify(hasil));

    CacheService.getScriptCache().remove('gagal_' + M);
    r = _ujiLogin(M, PWD);
    _ujiCek('login dgn sandi sementara + wajib ganti',
      r.ok === true && r.data.harus_ganti_password === true);
    var TOKEN_M2 = r.ok ? r.data.token : '';
    _ujiCek('permintaan reset selesai',
      Auth.getPermintaanReset()
        .filter(function (x) { return x.username === M; }).length === 0);

    /* --- peran: murid tidak boleh API guru (token baru, sesi lama
           sudah dicabut oleh reset) --- */
    r = resetPasswordMurid(TOKEN_M2, GID_M, '');
    _ujiCek('murid TIDAK boleh reset sandi',
      r.ok === false && r.error === 'AKSES_DITOLAK');
    r = getPermintaanReset(TOKEN_M2);
    _ujiCek('murid TIDAK boleh lihat antre reset',
      r.ok === false && r.error === 'AKSES_DITOLAK');
    r = cekSesi('token-palsu-' + UJI.stamp);
    _ujiCek('token palsu → SESI_INVALID', r.ok === false && r.error === 'SESI_INVALID');

    /* --- nonaktif ditolak --- */
    var u2 = Db.cari('Users', 'username', M);
    Db.perbarui('Users', u2._baris, { status: 'nonaktif' });
    r = Auth.login(M, PWD);
    _ujiCek('user nonaktif ditolak',
      r.ok === false && r.error === 'AKUN_NONAKTIF');
  });
}

/* ============================================================
 *  TAHAP 3 — KELAS, MURID, ENROLLMENT
 * ============================================================ */

function ujiTahap3() {
  return _ujiPesta('TAHAP 3 — KELAS, MURID, ENROLLMENT', function () {
    _ujiLacak();
    var S = UJI.stamp;

    var G = S + 'guru';
    _ujiBuatUser(G, 'Guru Uji Tahap3', 'guru', 'guru123');
    var TOKEN_G = _ujiLogin(G, 'guru123').data.token;

    /* ---------- KELAS ---------- */
    var r = kelasSimpan(TOKEN_G, { name: 'XI TJKT 1', academic_year: '2026/2027' });
    _ujiCek('buat kelas sukses', r.ok === true && r.data.baru === true, JSON.stringify(r));
    var KLS = r.data.class_id;
    UJI.ids.Classes.push(KLS);

    r = kelasSimpan(TOKEN_G, { name: 'X', academic_year: 'salah-tahun' });
    _ujiCek('tahun ajaran salah ditolak', r.ok === false && r.error === 'VALIDASI_GAGAL');

    r = kelasSimpan(TOKEN_G, { name: '' });
    _ujiCek('kelas tanpa nama ditolak', r.ok === false && r.error === 'VALIDASI_GAGAL');

    r = kelasSimpan(TOKEN_G, { class_id: KLS, name: 'XI TJKT 1 (PKPJ)' });
    _ujiCek('edit kelas sukses', r.ok === true && r.data.baru === false);

    /* ---------- MURID ---------- */
    r = muridSimpan(TOKEN_G, { nama: 'Budi Santoso', username: S + 'budi01' });
    _ujiCek('tambah murid → sandi sementara 8 karakter',
      r.ok === true && r.data.password_sementara.length === 8, JSON.stringify(r));
    var BUDI = r.data.user_id;
    UJI.ids.Users.push(BUDI);
    var SANDI_BUDI = r.data.password_sementara;

    r = muridSimpan(TOKEN_G, { nama: 'Budi Kedua', username: S + 'budi01' });
    _ujiCek('username duplikat ditolak', r.ok === false && r.error === 'DUPLIKAT');

    /* username pendek tidak mungkin dipakai user lain — selalu ditolak */
    r = muridSimpan(TOKEN_G, { nama: 'Anak Baru', username: 'ab' });
    _ujiCek('username < 3 karakter ditolak',
      r.ok === false && r.error === 'VALIDASI_GAGAL');

    r = muridSimpan(TOKEN_G, { user_id: BUDI, no_wa: '0812-3456-7890' });
    _ujiCek('edit murid menormalkan WA ke 62xxx',
      r.ok === true && Db.cari('Users', 'user_id', BUDI).no_wa === '6281234567890');

    r = muridSimpan(TOKEN_G, { user_id: BUDI, no_wa: '099' });
    _ujiCek('WA tidak sah ditolak saat edit',
      r.ok === false && r.error === 'VALIDASI_GAGAL');

    /* ---------- IMPOR ---------- */
    r = muridImporPratinjau(TOKEN_G,
      'Budi Santoso, XI TKJ 1\nCitra Dewi, XI TKJ 1, citra01, citra123\nX');
    _ujiCek('pratinjau: 2 siap 1 bermasalah',
      r.ok === true && r.data.siap.length === 2 && r.data.masalah.length === 1);

    r = muridImporPratinjau(TOKEN_G, 'Citra Dewi\nCitra Dewi');
    _ujiCek('pratinjau: nama kembar → username digeser',
      r.ok === true && r.data.siap[1].diubah === true);

    r = muridImpor(TOKEN_G, '',
      'Citra Dewi, XI TKJ 1, ' + S + 'citra01, citra123\n' +
      'Eko Prasetyo, XI TKJ 1, ' + S + 'eko01\nX');
    _ujiCek('impor 2 murid, 1 gagal',
      r.ok === true && r.data.berhasil === 2 && r.data.gagal.length === 1,
      JSON.stringify(r.data && { b: r.data.berhasil, g: r.data.gagal }));
    var CITRA = Db.cari('Users', 'username', S + 'citra01').user_id;
    _ujiCek('impor: sandi sendiri → tidak wajib ganti',
      Db.cari('Users', 'user_id', CITRA).harus_ganti_password === false);

    r = muridImpor(TOKEN_G, '', 'Eko Prasetyo, X, ' + S + 'eko01, pendek');
    _ujiCek('impor: sandi lemah ditolak per baris',
      r.ok === false && r.error === 'VALIDASI_GAGAL');

    /* ---------- ENROLLMENT ---------- */
    r = muridDaftarkan(TOKEN_G, KLS, [BUDI, CITRA]);
    _ujiCek('enroll 2 murid', r.ok === true && r.data.ditambah === 2, JSON.stringify(r));
    _ujiCek('notif enroll_kelas terbuat',
      _ujiHitungNotif([BUDI, CITRA], 'enroll_kelas') === 2);

    r = muridDaftarkan(TOKEN_G, KLS, [BUDI, CITRA]);
    _ujiCek('enroll ulang tidak menduplikasi',
      r.ok === true && r.data.ditambah === 0 && r.data.diaktifkan === 0);
    _ujiCek('baris enrollment tetap 2',
      Db.baca('Enrollment').filter(function (e) {
        return e.class_id === KLS; }).length === 2);

    r = kelasMurid(TOKEN_G, KLS);
    _ujiCek('muridDiKelas berisi 2', r.ok === true && r.data.length === 2);

    r = muridTersedia(TOKEN_G, KLS);
    _ujiCek('murid terdaftar tidak muncul di tersedia',
      r.ok === true && r.data.every(function (m) { return m.user_id !== BUDI; }));

    r = muridKeluarkan(TOKEN_G, KLS, BUDI);
    _ujiCek('keluarkan murid', r.ok === true);
    r = muridTersedia(TOKEN_G, KLS);
    _ujiCek('murid keluar muncul lagi di tersedia',
      r.data.some(function (m) { return m.user_id === BUDI; }));

    r = muridDaftarkan(TOKEN_G, KLS, [BUDI]);
    _ujiCek('daftar ulang → reaktivasi, bukan baris baru',
      r.ok === true && r.data.diaktifkan === 1 && r.data.ditambah === 0);

    /* ---------- KELAS SAYA ---------- */
    var SBK = Util.buatId('SBK');
    UJI.ids.Subjects.push(SBK);
    Db.tambah('Subjects', { subject_id: SBK, name: 'PKPJ', code: 'PKPJ',
      owner_teacher_id: UJI.ids.Users[0], status: 'aktif',
      created_at: Util.sekarang(), updated_at: Util.sekarang() });
    var TA = Util.buatId('TA');
    UJI.ids.TA.push(TA);
    Db.tambah('Teaching_Assignments', { teaching_assignment_id: TA,
      class_id: KLS, teacher_id: UJI.ids.Users[0], subject_id: SBK,
      academic_year: '2026/2027', status: 'aktif',
      created_at: Util.sekarang(), updated_at: Util.sekarang() });

    var TOKEN_B = _ujiLogin(S + 'budi01', SANDI_BUDI).data.token;
    r = kelasSaya(TOKEN_B);
    _ujiCek('kelasSaya murid memuat kelas + mapel',
      r.ok === true && r.data.length === 1 &&
      r.data[0].mapel.length === 1 && r.data[0].mapel[0].nama === 'PKPJ',
      JSON.stringify(r.data));

    /* ---------- ARSIP ---------- */
    r = kelasUbahStatus(TOKEN_G, KLS, 'arsip');
    _ujiCek('arsipkan kelas', r.ok === true);
    _ujiCek('kelas arsip tidak tampil di daftar default',
      kelasDaftar(TOKEN_G, false).data.length === 0);
    r = kelasSaya(TOKEN_B);
    _ujiCek('kelas arsip hilang dari kelasSaya', r.data.length === 0);
    kelasUbahStatus(TOKEN_G, KLS, 'aktif');

    /* ---------- PENJAGA PERAN ---------- */
    r = muridDaftarkan(TOKEN_B, KLS, [CITRA]);
    _ujiCek('murid TIDAK boleh enroll', r.ok === false && r.error === 'AKSES_DITOLAK');
    r = muridDaftar(TOKEN_B, {});
    _ujiCek('murid TIDAK boleh lihat kelola murid',
      r.ok === false && r.error === 'AKSES_DITOLAK');
    r = kelasDaftar(TOKEN_B, false);
    _ujiCek('murid TIDAK boleh daftar kelas guru',
      r.ok === false && r.error === 'AKSES_DITOLAK');
    r = resetPasswordMurid(TOKEN_B, CITRA, '');
    _ujiCek('murid TIDAK boleh reset sandi',
      r.ok === false && r.error === 'AKSES_DITOLAK');

    /* ---------- BIODATA ---------- */
    r = simpanBiodataSaya(TOKEN_B, { email: 'budi@contoh.id',
                                     no_wa: '081234567890' });
    _ujiCek('murid simpan biodata', r.ok === true, JSON.stringify(r));
    r = muridDaftar(TOKEN_G, { cari: S + 'budi01' });
    _ujiCek('biodata tercatat lengkap di daftar murid',
      r.data.length === 1 && r.data[0].biodata_lengkap === true &&
      r.data[0].no_wa === '6281234567890');

    r = simpanBiodataSaya(TOKEN_B, { email: 'bukan-email',
                                     no_wa: '081234567890' });
    _ujiCek('biodata email salah ditolak',
      r.ok === false && r.error === 'VALIDASI_GAGAL');

    /* ---------- NONAKTIF & NOTIFIKASI ---------- */
    r = muridSimpan(TOKEN_G, { user_id: CITRA, status: 'nonaktif' });
    _ujiCek('nonaktifkan murid', r.ok === true);
    r = Auth.login(S + 'citra01', 'citra123');
    _ujiCek('login murid nonaktif ditolak',
      r.ok === false && r.error === 'AKUN_NONAKTIF');

    r = daftarNotifikasi(TOKEN_B);
    _ujiCek('murid punya notif enroll', r.ok === true && r.data.length >= 1);
    var NID = r.data[0].notif_id;
    notifTandaiDibaca(TOKEN_B, NID);
    r = daftarNotifikasi(TOKEN_B);
    _ujiCek('tandai dibaca bekerja',
      r.data.filter(function (n) { return n.notif_id === NID; })[0].dibaca === true);
  });
}

/* ============================================================
 *  TAHAP 4 — MAPEL, PENUGASAN, TOPIK, ITEM
 * ============================================================ */

function ujiTahap4() {
  return _ujiPesta('TAHAP 4 — MAPEL, PENUGASAN, TOPIK, ITEM', function () {
    _ujiLacak();
    var S = UJI.stamp;

    /* ---------- seed guru + 3 murid + kelas ---------- */
    var G = S + 'guru';
    var GURU_ID = _ujiBuatUser(G, 'Guru Uji Tahap4', 'guru', 'guru123');
    var GURU2   = _ujiBuatUser(S + 'guru2', 'Guru Kedua Tahap4', 'guru', 'guru123');
    var TOKEN_G = _ujiLogin(G, 'guru123').data.token;

    var r = muridSimpan(TOKEN_G, { nama: 'Budi Santoso', username: S + 'budi01' });
    var BUDI = r.data.user_id; UJI.ids.Users.push(BUDI);
    var SANDI_BUDI = r.data.password_sementara;
    r = muridSimpan(TOKEN_G, { nama: 'Citra Dewi', username: S + 'citra01' });
    var CITRA = r.data.user_id; UJI.ids.Users.push(CITRA);
    r = muridSimpan(TOKEN_G, { nama: 'Dodi Pratama', username: S + 'dodi01' });
    var DODI = r.data.user_id; UJI.ids.Users.push(DODI);

    var TOKEN_B = _ujiLogin(S + 'budi01', SANDI_BUDI).data.token;
    var TOKEN_D = Auth.login(S + 'dodi01',
      Db.cari('Users', 'user_id', DODI).pwd_awal).data.token;

    r = kelasSimpan(TOKEN_G, { name: 'XI TJKT 1', academic_year: '2026/2027' });
    var KLS = r.data.class_id; UJI.ids.Classes.push(KLS);
    muridDaftarkan(TOKEN_G, KLS, [BUDI, CITRA]);

    /* ---------- MAPEL ---------- */
    console.log('--- MAPEL ---');

    r = mapelSimpan(TOKEN_G, { name: 'Jaringan Dasar', code: 'jd' });
    _ujiCek('buat mapel', r.ok === true && r.data.baru === true, JSON.stringify(r));
    var SBK = r.data.subject_id; UJI.ids.Subjects.push(SBK);
    _ujiCek('pemilik mapel = guru pembuat',
      Db.cari('Subjects', 'subject_id', SBK).owner_teacher_id === GURU_ID);

    r = mapelSimpan(TOKEN_G, { name: '   ' });
    _ujiCek('mapel tanpa nama ditolak',
      r.ok === false && r.error === 'VALIDASI_GAGAL');

    r = mapelSimpan(TOKEN_G, { subject_id: SBK, code: 'JRD' });
    _ujiCek('edit mapel parsial (kode saja)',
      r.ok === true && Db.cari('Subjects', 'subject_id', SBK).code === 'JRD' &&
      Db.cari('Subjects', 'subject_id', SBK).name === 'Jaringan Dasar');

    r = mapelSimpan(TOKEN_G, { subject_id: SBK, name: '' });
    _ujiCek('edit: nama dikosongkan ditolak',
      r.ok === false && r.error === 'VALIDASI_GAGAL');

    r = mapelDaftar(TOKEN_G);
    _ujiCek('daftar mapel: pemilik terisi',
      r.ok === true &&
      r.data.some(function (m) {
        return m.subject_id === SBK && m.jml_penugasan === 0 &&
               m.owner === 'Guru Uji Tahap4'; }), JSON.stringify(r.data));

    r = mapelUbahStatus(TOKEN_G, SBK, 'bekas');
    _ujiCek('status tidak sah ditolak', r.ok === false && r.error === 'VALIDASI_GAGAL');

    r = mapelUbahStatus(TOKEN_G, SBK, 'nonaktif');
    _ujiCek('nonaktifkan mapel', r.ok === true &&
      Db.cari('Subjects', 'subject_id', SBK).status === 'nonaktif');

    r = penugasanSimpan(TOKEN_G, { class_id: KLS, subject_id: SBK });
    _ujiCek('penugasan dengan mapel nonaktif ditolak',
      r.ok === false && r.error === 'VALIDASI_GAGAL');

    mapelUbahStatus(TOKEN_G, SBK, 'aktif');

    r = mapelSimpan(TOKEN_B, { name: 'Diretas' });
    _ujiCek('murid TIDAK boleh buat mapel',
      r.ok === false && r.error === 'AKSES_DITOLAK');
    r = mapelDaftar(TOKEN_B);
    _ujiCek('murid TIDAK boleh daftar mapel',
      r.ok === false && r.error === 'AKSES_DITOLAK');

    /* ---------- PENUGASAN ---------- */
    console.log('--- PENUGASAN ---');

    r = penugasanSimpan(TOKEN_G, { class_id: KLS, subject_id: SBK });
    _ujiCek('buat penugasan', r.ok === true && r.data.baru === true, JSON.stringify(r));
    var TA = r.data.teaching_assignment_id; UJI.ids.TA.push(TA);

    var taRow = Db.cari('Teaching_Assignments', 'teaching_assignment_id', TA);
    _ujiCek('tahun ajaran diambil dari kelas',
      taRow.academic_year === '2026/2027');
    _ujiCek('pengampu default = pembuat', taRow.teacher_id === GURU_ID);

    r = penugasanSimpan(TOKEN_G, { class_id: KLS, subject_id: SBK });
    _ujiCek('penugasan kembar ditolak', r.ok === false && r.error === 'DUPLIKAT');

    r = penugasanSimpan(TOKEN_G, { class_id: 'KLS-TIDAKADA', subject_id: SBK });
    _ujiCek('kelas tidak ditemukan', r.ok === false && r.error === 'TIDAK_DITEMUKAN');

    r = penugasanSimpan(TOKEN_G, { class_id: KLS, subject_id: 'SBK-TIDAKADA' });
    _ujiCek('mapel tidak ditemukan', r.ok === false && r.error === 'TIDAK_DITEMUKAN');

    r = penugasanSimpan(TOKEN_G, { class_id: KLS, subject_id: SBK, teacher_id: BUDI });
    _ujiCek('pengampu harus guru', r.ok === false && r.error === 'VALIDASI_GAGAL');

    r = penugasanDaftar(TOKEN_G, {});
    _ujiCek('daftar penugasan memuat nama terisi',
      r.ok === true && r.data.some(function (t) {
        return t.teaching_assignment_id === TA &&
               t.kelas === 'XI TJKT 1' && t.mapel === 'Jaringan Dasar' &&
               t.guru === 'Guru Uji Tahap4'; }), JSON.stringify(r.data));

    r = penugasanUbahStatus(TOKEN_G, TA, 'nonaktif');
    _ujiCek('nonaktifkan penugasan', r.ok === true);
    _ujiCek('penugasan nonaktif tak tampil default',
      penugasanDaftar(TOKEN_G, {}).data.length === 0);
    _ujiCek('penugasan nonaktif tampil bila semua',
      penugasanDaftar(TOKEN_G, { semua: true }).data.length === 1);
    _ujiCek('filter status nonaktif',
      penugasanDaftar(TOKEN_G, { status: 'nonaktif' }).data.length === 1);
    _ujiCek('filter class_id cocok',
      penugasanDaftar(TOKEN_G, { class_id: KLS, semua: true }).data.length === 1);
    _ujiCek('filter class lain kosong',
      penugasanDaftar(TOKEN_G, { class_id: 'KLS-x', semua: true }).data.length === 0);
    _ujiCek('filter subject_id cocok',
      penugasanDaftar(TOKEN_G, { subject_id: SBK, semua: true }).data.length === 1);
    _ujiCek('filter guru lain kosong',
      penugasanDaftar(TOKEN_G, { teacher_id: GURU2, semua: true }).data.length === 0);

    r = penugasanSimpan(TOKEN_G, { class_id: KLS, subject_id: SBK });
    _ujiCek('penugasan sama → baris nonaktif diaktifkan kembali',
      r.ok === true && r.data.diaktifkan === true && !r.data.baru, JSON.stringify(r));
    _ujiCek('jumlah baris penugasan tetap 1',
      Db.baca('Teaching_Assignments').filter(function (t) {
        return t.teaching_assignment_id === TA; }).length === 1);

    r = penugasanSimpan(TOKEN_G, { teaching_assignment_id: TA, teacher_id: GURU2 });
    _ujiCek('edit penugasan: ganti pengampu', r.ok === true &&
      Db.cari('Teaching_Assignments', 'teaching_assignment_id', TA)
        .teacher_id === GURU2);

    r = penugasanSimpan(TOKEN_G, { teaching_assignment_id: TA,
                                   academic_year: 'salah' });
    _ujiCek('edit penugasan: tahun salah ditolak',
      r.ok === false && r.error === 'VALIDASI_GAGAL');

    penugasanSimpan(TOKEN_G, { teaching_assignment_id: TA, teacher_id: GURU_ID });

    r = penugasanSimpan(TOKEN_B, { class_id: KLS, subject_id: SBK });
    _ujiCek('murid TIDAK boleh kelola penugasan',
      r.ok === false && r.error === 'AKSES_DITOLAK');
    r = guruDaftar(TOKEN_B);
    _ujiCek('murid TIDAK boleh daftar guru',
      r.ok === false && r.error === 'AKSES_DITOLAK');

    /* ---------- TOPIK ---------- */
    console.log('--- TOPIK ---');

    r = topikSimpan(TOKEN_G, { teaching_assignment_id: TA,
                               title: 'Bab 1 — Pengenalan' });
    _ujiCek('buat topik 1', r.ok === true && r.data.baru === true);
    var TPC1 = r.data.topic_id; UJI.ids.Topics.push(TPC1);
    r = topikSimpan(TOKEN_G, { teaching_assignment_id: TA, title: 'Bab 2' });
    var TPC2 = r.data.topic_id; UJI.ids.Topics.push(TPC2);
    r = topikSimpan(TOKEN_G, { teaching_assignment_id: TA, title: 'Bab 3' });
    var TPC3 = r.data.topic_id; UJI.ids.Topics.push(TPC3);

    _ujiCek('urutan topik otomatis 1,2,3',
      [TPC1, TPC2, TPC3].map(function (id) {
        return Number(Db.cari('Topics', 'topic_id', id).sort_order);
      }).join(',') === '1,2,3');

    r = topikSimpan(TOKEN_G, { teaching_assignment_id: 'TA-TIDAKADA', title: 'X' });
    _ujiCek('topik tanpa penugasan sah ditolak',
      r.ok === false && r.error === 'TIDAK_DITEMUKAN');
    r = topikSimpan(TOKEN_G, { teaching_assignment_id: TA, title: '' });
    _ujiCek('topik tanpa judul ditolak',
      r.ok === false && r.error === 'VALIDASI_GAGAL');

    r = topikSimpan(TOKEN_G, { topic_id: TPC1, description: 'Dasar-dasar jaringan' });
    _ujiCek('edit topik parsial', r.ok === true &&
      Db.cari('Topics', 'topic_id', TPC1).description === 'Dasar-dasar jaringan');

    r = topikDaftar(TOKEN_G, TA);
    _ujiCek('topikDaftar: 3 topik urut',
      r.ok === true && r.data.topik.length === 3 &&
      r.data.topik[0].topic_id === TPC1);

    r = topikUbahStatus(TOKEN_G, TPC1, 'publish');
    _ujiCek('terbitkan topik 1', r.ok === true &&
      Db.cari('Topics', 'topic_id', TPC1).status === 'publish');
    r = topikUbahStatus(TOKEN_G, TPC1, 'bekas');
    _ujiCek('status topik tidak sah ditolak',
      r.ok === false && r.error === 'VALIDASI_GAGAL');

    r = topikPindah(TOKEN_G, TPC3, 'atas');
    _ujiCek('pindah atas: Bab 3 naik ke urutan 2',
      r.ok === true && r.data.pindah === true &&
      Number(Db.cari('Topics', 'topic_id', TPC3).sort_order) === 2 &&
      Number(Db.cari('Topics', 'topic_id', TPC2).sort_order) === 3);
    r = topikPindah(TOKEN_G, TPC1, 'atas');
    _ujiCek('pindah di urutan teratas → no-op',
      r.ok === true && r.data.pindah === false &&
      Number(Db.cari('Topics', 'topic_id', TPC1).sort_order) === 1);

    r = topikHapus(TOKEN_G, TPC1);
    _ujiCek('hapus topik kosong berhasil',
      r.ok === true && r.data.dihapus === true);
    UJI.ids.Topics = UJI.ids.Topics.filter(function (x) { return x !== TPC1; });
    r = topikSimpan(TOKEN_G, { teaching_assignment_id: TA,
      title: 'Bab 1 — Pengenalan', description: 'Dasar-dasar jaringan' });
    var TPC1b = r.data.topic_id; UJI.ids.Topics.push(TPC1b);
    topikUbahStatus(TOKEN_G, TPC1b, 'publish');

    r = topikPindah(TOKEN_B, TPC2, 'atas');
    _ujiCek('murid TIDAK boleh kelola topik',
      r.ok === false && r.error === 'AKSES_DITOLAK');

    /* ---------- ITEM ---------- */
    console.log('--- ITEM ---');

    var KONTEN = '<p>Selamat belajar</p><script>alert(1)</script>' +
      '<iframe src="https://www.youtube.com/embed/abc"></iframe>' +
      '<iframe src="https://www.youtube.com.jahat.id/embed/x"></iframe>';

    r = itemSimpan(TOKEN_G, { topic_id: TPC1b, type: 'materi',
      title: 'Pengenalan LAN', content: KONTEN });
    _ujiCek('buat item materi', r.ok === true && r.data.baru === true, JSON.stringify(r));
    var ITM1 = r.data.item_id; UJI.ids.Items.push(ITM1);

    var isi = Db.cari('Items', 'item_id', ITM1).content;
    _ujiCek('konten: script dibuang', isi.indexOf('<script>') === -1);
    _ujiCek('konten: iframe youtube dipertahankan',
      isi.indexOf('https://www.youtube.com/embed/abc') !== -1);
    _ujiCek('konten: iframe domain asing dibuang',
      isi.indexOf('jahat.id') === -1);

    r = itemSimpan(TOKEN_G, { topic_id: TPC1b, type: 'quiz', title: 'Quiz Bab 1' });
    var ITMQ = r.data.item_id; UJI.ids.Items.push(ITMQ);
    r = itemSimpan(TOKEN_G, { topic_id: TPC1b, type: 'materi',
                              title: 'Perangkat Jaringan' });
    var ITM2 = r.data.item_id; UJI.ids.Items.push(ITM2);

    r = itemSimpan(TOKEN_G, { topic_id: TPC1b, type: 'salah', title: 'X' });
    _ujiCek('jenis item tidak dikenal ditolak',
      r.ok === false && r.error === 'VALIDASI_GAGAL');
    r = itemSimpan(TOKEN_G, { topic_id: 'TPC-TIDAKADA', type: 'materi', title: 'X' });
    _ujiCek('item tanpa topik sah ditolak',
      r.ok === false && r.error === 'TIDAK_DITEMUKAN');
    r = itemSimpan(TOKEN_G, { topic_id: TPC1b, type: 'materi', title: '' });
    _ujiCek('item tanpa judul ditolak',
      r.ok === false && r.error === 'VALIDASI_GAGAL');

    r = itemDaftar(TOKEN_G, TPC1b);
    _ujiCek('itemDaftar: 3 item urut + tanpa konten',
      r.ok === true && r.data.length === 3 &&
      r.data[0].item_id === ITM1 && r.data[0].content === undefined);

    r = itemSimpan(TOKEN_G, { item_id: ITM1, description: 'Materi pembuka.' });
    _ujiCek('edit item parsial: deskripsi, konten utuh',
      r.ok === true &&
      Db.cari('Items', 'item_id', ITM1).description === 'Materi pembuka.' &&
      Db.cari('Items', 'item_id', ITM1).content.indexOf('Selamat belajar') !== -1);

    r = itemPindah(TOKEN_G, ITM2, 'atas');
    _ujiCek('pindah item atas: tukar dengan tetangga',
      r.ok === true && r.data.pindah === true &&
      Number(Db.cari('Items', 'item_id', ITM2).sort_order) === 2 &&
      Number(Db.cari('Items', 'item_id', ITMQ).sort_order) === 3 &&
      Number(Db.cari('Items', 'item_id', ITM1).sort_order) === 1);

    r = itemUbahStatus(TOKEN_G, ITM1, 'publish');
    _ujiCek('terbitkan item', r.ok === true);
    _ujiCek('notif materi baru terkirim ke 2 murid',
      _ujiHitungNotif([BUDI, CITRA], 'pertemuan_baru') === 2);

    itemUbahStatus(TOKEN_G, ITM1, 'publish');
    _ujiCek('publish ulang tidak menggandakan notif',
      _ujiHitungNotif([BUDI, CITRA], 'pertemuan_baru') === 2);

    r = itemUbahStatus(TOKEN_G, ITM1, 'bekas');
    _ujiCek('status item tidak sah ditolak',
      r.ok === false && r.error === 'VALIDASI_GAGAL');

    Db.perbarui('Items', Db.cari('Items', 'item_id', ITMQ)._baris,
                { related_id: 'QIZ-UJI' });
    r = itemHapus(TOKEN_G, ITMQ);
    _ujiCek('item tertaut ditolak dihapus',
      r.ok === false && r.error === 'VALIDASI_GAGAL');

    r = itemHapus(TOKEN_B, ITM2);
    _ujiCek('murid TIDAK boleh hapus item',
      r.ok === false && r.error === 'AKSES_DITOLAK');
    r = itemSimpan(TOKEN_B, { topic_id: TPC1b, type: 'materi', title: 'X' });
    _ujiCek('murid TIDAK boleh buat item',
      r.ok === false && r.error === 'AKSES_DITOLAK');

    /* ---------- BACAAN MURID ---------- */
    console.log('--- BACAAN MURID ---');

    r = kelasSaya(TOKEN_B);
    _ujiCek('kelasSaya membawa ta_id pada mapel',
      r.ok === true && r.data.length === 1 &&
      r.data[0].mapel.length === 1 && r.data[0].mapel[0].ta_id === TA,
      JSON.stringify(r.data));

    r = topikKelasSaya(TOKEN_B, TA);
    _ujiCek('topikKelasSaya: konteks kelas/mapel/guru terisi',
      r.ok === true && r.data.kelas.name === 'XI TJKT 1' &&
      r.data.mapel.name === 'Jaringan Dasar' &&
      r.data.guru === 'Guru Uji Tahap4', JSON.stringify(r.data));
    _ujiCek('topikKelasSaya: hanya publish, hitung item publish saja',
      r.data.topik.length === 1 && r.data.topik[0].topic_id === TPC1b &&
      r.data.topik[0].jml_item === 1, JSON.stringify(r.data.topik));

    itemUbahStatus(TOKEN_G, ITM2, 'publish');
    r = topikKelasSaya(TOKEN_B, TA);
    _ujiCek('item kedua masuk hitungan setelah publish',
      r.data.topik[0].jml_item === 2);

    r = bukaTopik(TOKEN_B, TPC1b);
    _ujiCek('bukaTopik: 2 item publish tanpa konten',
      r.ok === true && r.data.item.length === 2 &&
      r.data.item.every(function (i) { return i.content === undefined; }));

    r = itemSimpan(TOKEN_G, { topic_id: TPC1b, type: 'materi',
                              title: 'Draf tersembunyi' });
    var ITMD = r.data.item_id; UJI.ids.Items.push(ITMD);
    r = bukaTopik(TOKEN_B, TPC1b);
    _ujiCek('item draft tersembunyi dari murid', r.data.item.length === 2);
    itemHapus(TOKEN_G, ITMD);
    UJI.ids.Items = UJI.ids.Items.filter(function (x) { return x !== ITMD; });

    r = bacaMateri(TOKEN_B, ITM1);
    _ujiCek('bacaMateri: konten tampil',
      r.ok === true && r.data.content.indexOf('Selamat belajar') !== -1 &&
      r.data.topik === 'Bab 1 — Pengenalan');

    itemUbahStatus(TOKEN_G, ITMQ, 'publish');   /* utk uji penjaga */
    r = bacaMateri(TOKEN_B, ITMQ);
    _ujiCek('bacaMateri quiz → FITUR_BELUM_ADA',
      r.ok === false && r.error === 'FITUR_BELUM_ADA');

    r = topikSimpan(TOKEN_G, { teaching_assignment_id: TA, title: 'Bab Draf' });
    var TPCD = r.data.topic_id; UJI.ids.Topics.push(TPCD);
    r = bukaTopik(TOKEN_B, TPCD);
    _ujiCek('topik draft ditolak untuk murid',
      r.ok === false && r.error === 'TIDAK_DITEMUKAN');
    r = topikKelasSaya(TOKEN_B, TA);
    _ujiCek('topik draft tidak masuk daftar murid', r.data.topik.length === 1);
    topikHapus(TOKEN_G, TPCD);
    UJI.ids.Topics = UJI.ids.Topics.filter(function (x) { return x !== TPCD; });

    r = topikKelasSaya(TOKEN_D, TA);
    _ujiCek('murid tak terdaftar ditolak',
      r.ok === false && r.error === 'AKSES_DITOLAK');
    r = bacaMateri(TOKEN_D, ITM1);
    _ujiCek('murid tak terdaftar tak bisa baca materi',
      r.ok === false && r.error === 'AKSES_DITOLAK');

    penugasanUbahStatus(TOKEN_G, TA, 'nonaktif');
    r = topikKelasSaya(TOKEN_B, TA);
    _ujiCek('penugasan nonaktif menutup bacaan',
      r.ok === false && r.error === 'TIDAK_DITEMUKAN');
    penugasanUbahStatus(TOKEN_G, TA, 'aktif');

    kelasUbahStatus(TOKEN_G, KLS, 'arsip');
    r = topikKelasSaya(TOKEN_B, TA);
    _ujiCek('kelas arsip menutup bacaan',
      r.ok === false && r.error === 'TIDAK_DITEMUKAN');
    kelasUbahStatus(TOKEN_G, KLS, 'aktif');

    /* ---------- AUDIT ---------- */
    console.log('--- AUDIT ---');
    var cocok = function (aksi, awalan) {
      return Db.bacaKolom('Audit_Logs', ['action', 'detail', 'entity_id'])
        .some(function (l) {
          return l.action === aksi &&
                 String(l.detail).indexOf(awalan) === 0;
        });
    };
    _ujiCek('audit: buat_mapel tercatat', cocok('CREATE', 'buat_mapel ' + SBK));
    _ujiCek('audit: buat_penugasan tercatat',
      cocok('CREATE', 'buat_penugasan ' + TA));
    _ujiCek('audit: buat_topik tercatat', cocok('CREATE', 'buat_topik ' + TPC1b));
    _ujiCek('audit: reaktivasi penugasan tercatat',
      cocok('UPDATE', 'reaktivasi_penugasan ' + TA));
    _ujiCek('audit: item_publish tercatat',
      cocok('UPDATE', 'item_publish'));

    r = penugasanDaftar(TOKEN_G, {});
    _ujiCek('sanity: penugasan aktif 1 dengan 3 topik',
      r.data.length === 1 && r.data[0].jml_topik === 3);
  });
}

/* ============================================================
 *  SEMUA
 * ============================================================ */

/** Jalankan seluruh tahapan berurutan — laporan ringkas di akhir. */
function ujiSemua() {
  var mulai = Date.now();
  var hasil = [
    { nama: 'Gate 0', h: ujiGate0() },
    { nama: 'Tahap 3', h: ujiTahap3() },
    { nama: 'Tahap 4', h: ujiTahap4() }
  ];

  console.log('####################################################');
  hasil.forEach(function (h) {
    console.log(' ' + h.nama + ': ' +
      (h.h.gagal === 0 ? 'LULUS ✔ (' + h.h.lulus + ' uji)'
                       : 'GAGAL ✘ (' + h.h.gagal + ' uji)'));
  });
  var totalGagal = hasil.reduce(function (a, h) { return a + h.h.gagal; }, 0);
  console.log(totalGagal === 0
    ? ' SEMUA TAHAPAN LULUS — ' + Math.round((Date.now() - mulai) / 100) / 10 + ' dtk'
    : ' ADA ' + totalGagal + ' UJI GAGAL — periksa log di atas');
  console.log('####################################################');
  return totalGagal === 0;
}
