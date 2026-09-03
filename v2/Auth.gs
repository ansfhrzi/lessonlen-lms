/**
 * ============================================================
 *  LMS v2 — Auth.gs
 *  Login username + kata sandi, sesi, ganti/lupa/reset kata sandi
 *  Port setia dari LessonLen v1 (keputusan final v2.1 no. 1)
 * ------------------------------------------------------------
 *  KEAMANAN:
 *   - kata sandi tidak pernah plaintext & tidak pernah dikirim ke klien
 *   - respons "lupa kata sandi" SELALU sama apa pun hasilnya
 *   - 5x gagal dalam 15 menit → kunci 15 menit
 *   - role hanya 'guru' (admin) dan 'murid'
 * ============================================================
 */

var Auth = (function () {

  var TTL_SESI_JAM    = 12;
  var MAKS_GAGAL      = 5;
  var MENIT_KUNCI     = 15;
  var MAKS_RESET_HARI = 3;

  /* -------------------------------------------------- sesi */

  /**
   * Validasi token. Mengembalikan {user_id, username, nama, role} atau null.
   * Cache dulu (1 jam); bila kosong, jatuh ke sheet Session.
   */
  function validasiToken(token) {
    if (!token) return null;

    var cache = CacheService.getScriptCache();
    var c = cache.get('sesi_' + token);
    if (c) {
      try { return JSON.parse(c); } catch (e) { /* lanjut ke sheet */ }
    }

    var baris = Db.cari('Session', 'token', token);
    if (!baris) return null;
    if (Util.lewat(baris.expired_at)) { _hapusSesi(token); return null; }

    var u = Db.cari('Users', 'user_id', baris.user_id);
    if (!u || u.status !== 'aktif') { _hapusSesi(token); return null; }

    var sesi = {
      user_id: u.user_id, username: u.username,
      nama: u.nama, role: u.role,
      harus_ganti_password: u.harus_ganti_password === true ||
                            u.harus_ganti_password === 'TRUE'
    };
    try { cache.put('sesi_' + token, JSON.stringify(sesi), 3600); } catch (e) {}
    return sesi;
  }

  function _buatSesi(user) {
    var token = Util.buatToken();
    var now = Util.sekarang();
    Db.tambah('Session', {
      token: token, user_id: user.user_id,
      dibuat_at: now, expired_at: Util.tambahJam(now, TTL_SESI_JAM)
    });
    return token;
  }

  function _hapusSesi(token) {
    try { CacheService.getScriptCache().remove('sesi_' + token); } catch (e) {}
    var b = Db.cari('Session', 'token', token);
    if (b) Db.hapus('Session', b._baris);
  }

  /** Hapus seluruh sesi milik satu user (dipakai saat reset kata sandi). */
  function _hapusSesiUser(userId) {
    var semua = Db.saring('Session', { user_id: userId });
    if (!semua.length) return;
    var cache = CacheService.getScriptCache();
    semua.forEach(function (s) {
      try { cache.remove('sesi_' + s.token); } catch (e) {}
    });
    Db.hapusBanyak('Session', semua.map(function (s) { return s._baris; }));
  }

  /* -------------------------------------------------- percobaan gagal */

  function _kunciKey(username) { return 'gagal_' + username; }

  function _cekTerkunci(username) {
    var v = CacheService.getScriptCache().get(_kunciKey(username));
    if (!v) return 0;
    return Number(v) || 0;
  }

  function _tambahGagal(username) {
    var cache = CacheService.getScriptCache();
    var n = _cekTerkunci(username) + 1;
    cache.put(_kunciKey(username), String(n), MENIT_KUNCI * 60);
    return n;
  }

  function _resetGagal(username) {
    try { CacheService.getScriptCache().remove(_kunciKey(username)); } catch (e) {}
  }

  /* -------------------------------------------------- login */

  function login(username, password) {
    var u = Util.normalisasiUsername(username);

    if (Util.kosong(u) || Util.kosong(password)) {
      return { ok: false, error: 'VALIDASI_GAGAL',
               pesan: 'Nama pengguna dan kata sandi wajib diisi.' };
    }

    if (_cekTerkunci(u) >= MAKS_GAGAL) {
      return { ok: false, error: 'AKUN_TERKUNCI',
               pesan: 'Terlalu banyak percobaan gagal. Coba lagi dalam ' +
                      MENIT_KUNCI + ' menit.' };
    }

    var user = Db.cari('Users', 'username', u);

    /* pesan sengaja sama untuk user tak ada maupun kata sandi salah */
    if (!user || user.password_hash !== Util.hashPassword(password, user.salt)) {
      var n = _tambahGagal(u);
      Util.catatLog(user ? user.user_id : '', 'LOGIN', 'username=' + u +
                    ' percobaan=' + n, 'gagal');
      return { ok: false, error: 'LOGIN_GAGAL',
               pesan: 'Nama pengguna atau kata sandi salah.' +
                      (n >= 3 ? ' Sisa percobaan: ' + (MAKS_GAGAL - n) + '.' : '') };
    }

    if (user.status !== 'aktif') {
      return { ok: false, error: 'AKUN_NONAKTIF',
               pesan: 'Akun Anda dinonaktifkan. Hubungi guru.' };
    }

    _resetGagal(u);

    var token = _buatSesi(user);
    Db.perbarui('Users', user._baris, { last_login: Util.sekarang() });
    Util.catatLog(user.user_id, 'LOGIN', 'role=' + user.role, 'ok', user.role);

    var wajibGanti = user.harus_ganti_password === true ||
                     user.harus_ganti_password === 'TRUE';

    /* Hanya murid yang dimintai biodata (keputusan v1.10.0).
       Isi biodata yang sudah ada ikut dikirim supaya tidak diketik ulang. */
    var biodataKurang = user.role === 'murid' && !Util.biodataLengkap(user);
    var biodata = null;
    if (biodataKurang) {
      biodata = {
        nisn:          String(user.nisn || ''),
        email:         String(user.email || ''),
        no_wa:         String(user.no_wa || ''),
        tanggal_lahir: String(user.tanggal_lahir || '')
      };
    }

    return { ok: true, data: {
      token: token,
      user: { user_id: user.user_id, username: user.username,
              nama: user.nama, role: user.role },
      harus_ganti_password: wajibGanti,
      biodata_kurang: biodataKurang,
      biodata: biodata
    }};
  }

  /* -------------------------------------------------- login alternatif WA */

  /** §5.8 (keputusan 2026-09-03): murid masuk dengan No. WA + tgl lahir.
   *  · Hanya murid; akun aktif; biodata WA+tgl lahir harus terisi.
   *  · Langsung masuk — TIDAK memaksa ganti password (tanpa kecuali);
   *    `harus_ganti_password` tetap berlaku hanya di login username.
   *  · WA+tgl lahir cocok pada >1 akun → ditolak netral (anti akun orang).
   *  · Batas percobaan = login biasa (5x/15 menit, kunci per no WA).
   *  · Pesan gagal selalu netral — tidak membocorkan keberadaan akun. */
  function loginWa(noWa, tglLahir) {
    var wa = Util.normalisasiWa(noWa);
    var tgl = Util.tglLahirSah(tglLahir);
    if (!wa || !tgl) {
      return { ok: false, error: 'LOGIN_GAGAL',
               pesan: 'Data tidak cocok. Silakan hubungi guru Anda.' };
    }

    var kunci = _kunciKey('wa_' + wa);
    if (_cekTerkunci(kunci) >= MAKS_GAGAL) {
      return { ok: false, error: 'AKUN_TERKUNCI',
               pesan: 'Terlalu banyak percobaan gagal. Coba lagi dalam ' +
                      MENIT_KUNCI + ' menit.' };
    }

    var samaTanggal = function (u) {
      var t = u.tanggal_lahir;
      if (t instanceof Date) t = Util.formatTanggal(t).slice(0, 10);
      return String(t || '').trim() === tgl;
    };

    var cocok = Db.baca('Users').filter(function (u) {
      return u.role === 'murid' && u.status === 'aktif' &&
             Util.normalisasiWa(u.no_wa) === wa && samaTanggal(u);
    });

    var ekor = 'wa=…' + wa.slice(-3);
    var gagal = function (detail) {
      var n = _tambahGagal(kunci);
      Util.catatLog('', 'LOGIN_WA', ekor + ' ' + detail + ' percobaan=' + n, 'gagal');
      return { ok: false, error: 'LOGIN_GAGAL',
               pesan: 'Data tidak cocok. Silakan hubungi guru Anda.' +
                      (n >= 3 ? ' Sisa percobaan: ' + (MAKS_GAGAL - n) + '.' : '') };
    };

    if (!cocok.length) return gagal('tak_cocok');
    if (cocok.length > 1) {
      /* jangan pilih-memilih: tolak netral agar tak membuka akun orang lain */
      _resetGagal(kunci);
      Util.catatLog('', 'LOGIN_WA', ekor + ' duplikat=' + cocok.length, 'gagal');
      return { ok: false, error: 'LOGIN_GAGAL',
               pesan: 'Data tidak cocok. Silakan hubungi guru Anda.' };
    }

    var user = cocok[0];
    _resetGagal(kunci);

    var token = _buatSesi(user);
    Db.perbarui('Users', user._baris, { last_login: Util.sekarang() });
    Util.catatLog(user.user_id, 'LOGIN_WA', 'role=' + user.role, 'ok', user.role);

    return { ok: true, data: {
      token: token,
      user: { user_id: user.user_id, username: user.username,
              nama: user.nama, role: user.role },
      harus_ganti_password: false,     /* keputusan §5.8 poin 3 */
      biodata_kurang: false,
      biodata: null,
      via: 'wa'
    }};
  }

  /* -------------------------------------------------- ganti kata sandi */

  function gantiPassword(sesi, lama, baru) {
    var user = Db.cari('Users', 'user_id', sesi.user_id);
    if (!user) throw new Error('TIDAK_DITEMUKAN');

    if (user.password_hash !== Util.hashPassword(lama, user.salt)) {
      throw _err('VALIDASI_GAGAL', 'Kata sandi lama tidak cocok.');
    }
    var pesan = Util.periksaPassword(baru);
    if (pesan) throw _err('VALIDASI_GAGAL', pesan);
    if (lama === baru) {
      throw _err('VALIDASI_GAGAL', 'Kata sandi baru harus berbeda dari yang lama.');
    }

    var salt = Util.buatSalt();
    Db.perbarui('Users', user._baris, {
      password_hash: Util.hashPassword(baru, salt),
      salt: salt,
      pwd_awal: '',              /* murid sudah tahu sandinya sendiri */
      harus_ganti_password: false,
      updated_at: Util.sekarang()
    });
    Util.catatLog(sesi.user_id, 'GANTI_PASSWORD', '', 'ok', sesi.role);
    return { berhasil: true };
  }

  /* -------------------------------------------------- lupa kata sandi */

  /**
   * Diajukan tanpa login. Respons SELALU sama apa pun hasilnya,
   * agar tidak bisa dipakai menebak username yang valid.
   */
  function ajukanReset(inputUser) {
    var input = String(inputUser || '').trim();
    var balasan = { diterima: true };

    if (!input) return balasan;

    var u = Util.normalisasiUsername(input);
    var user = Db.cari('Users', 'username', u);
    if (!user && input.indexOf('@') !== -1) {
      user = Db.cari('Users', 'email', input.toLowerCase());
    }

    /* rate limit 3 permintaan / 24 jam */
    if (user) {
      var batas = new Date(Date.now() - 86400000);
      var jml = Db.saring('Permintaan_Reset', { user_id: user.user_id })
        .filter(function (r) { return new Date(r.dibuat_at) > batas; }).length;
      if (jml >= MAKS_RESET_HARI) {
        Util.catatLog(user.user_id, 'RESET_DITOLAK',
                      'melebihi batas harian', 'gagal');
        return balasan;
      }
    }

    Db.tambah('Permintaan_Reset', {
      request_id: Util.buatId('RST'),
      user_id: user ? user.user_id : '',
      input_user: input.slice(0, 100),
      status: 'antre',
      dibuat_at: Util.sekarang(),
      diproses_at: ''
    });

    if (user) {
      _notifGuru('permintaan_reset', 'Permintaan reset kata sandi',
                 user.nama + ' (' + user.username + ') meminta reset kata sandi.');
    } else {
      Util.catatLog('', 'RESET_USER_TIDAK_ADA', 'input=' + input.slice(0, 50), 'gagal');
    }
    return balasan;
  }

  /** Daftar permintaan reset yang masih antre — hanya guru. */
  function getPermintaanReset() {
    var users = Db.baca('Users');
    var peta = {};
    users.forEach(function (u) { peta[u.user_id] = u; });

    return Db.saring('Permintaan_Reset', { status: 'antre' })
      .filter(function (r) { return r.user_id; })
      .map(function (r) {
        var u = peta[r.user_id] || {};
        return {
          request_id: r.request_id, user_id: r.user_id,
          nama: u.nama || '(tidak dikenal)', username: u.username || '',
          dibuat_at: Util.formatTanggal(r.dibuat_at)
        };
      })
      .sort(function (a, b) { return a.dibuat_at < b.dibuat_at ? 1 : -1; });
  }

  /**
   * Guru mereset kata sandi murid.
   * Mengembalikan kata sandi sementara untuk ditampilkan SEKALI di layar guru.
   */
  function resetPasswordMurid(sesi, userId, requestId) {
    var user = Db.cari('Users', 'user_id', userId);
    if (!user) throw _err('TIDAK_DITEMUKAN', 'Pengguna tidak ditemukan.');
    if (user.role === 'guru' && user.user_id !== sesi.user_id) {
      throw _err('AKSES_DITOLAK', 'Tidak dapat mereset akun guru lain.');
    }

    var pwd = Util.passwordSementara();
    var salt = Util.buatSalt();

    Db.perbarui('Users', user._baris, {
      password_hash: Util.hashPassword(pwd, salt),
      salt: salt,
      pwd_awal: pwd,             /* tampil di daftar sampai murid menggantinya */
      harus_ganti_password: true,
      updated_at: Util.sekarang()
    });

    _hapusSesiUser(userId);

    if (requestId) {
      var req = Db.cari('Permintaan_Reset', 'request_id', requestId);
      if (req) {
        Db.perbarui('Permintaan_Reset', req._baris,
                    { status: 'selesai', diproses_at: Util.sekarang() });
      }
    }

    Util.catatLog(sesi.user_id, 'RESET_PASSWORD',
                  'target=' + userId + ' (' + user.username + ')', 'ok', sesi.role);

    /* Nomor WA murid ikut dikembalikan supaya guru dapat langsung
       mengirimkan sandi barunya lewat WhatsApp. */
    return { username: user.username, nama: user.nama,
             password_sementara: pwd,
             no_wa: Util.normalisasiWa(user.no_wa) };
  }

  /* -------------------------------------------------- bantu */

  function _err(kode, pesan) {
    var e = new Error(pesan);
    e.kode = kode;
    return e;
  }

  function _notifGuru(jenis, judul, pesan) {
    var guru = Db.saring('Users', { role: 'guru', status: 'aktif' });
    if (!guru.length) return;
    Db.tambah('Notifications', guru.map(function (g) {
      return {
        notif_id: Util.buatId('NTF'), user_id: g.user_id, jenis: jenis,
        judul: judul, pesan: pesan, link: '#/reset',
        dibaca: false, created_at: Util.sekarang()
      };
    }));
  }

  /* ------------------------------------------------ biodata murid */

  /**
   * Murid menyimpan/melengkapi biodatanya sendiri:
   * email, no WA, tanggal lahir WAJIB; NISN opsional (2026-09-02).
   * Biodata ini syarat alur lupa sandi/username mandiri.
   */
  function simpanBiodata(sesi, p) {
    if (sesi.role !== 'murid') {
      throw _err('AKSES_DITOLAK', 'Hanya murid yang memiliki biodata.');
    }
    var u = Db.cari('Users', 'user_id', sesi.user_id);
    if (!u) throw _err('TIDAK_DITEMUKAN', 'Pengguna tidak ditemukan.');

    var email = String(p && p.email || '').trim().toLowerCase();
    if (!Util.emailSah(email)) {
      throw _err('VALIDASI_GAGAL', 'Alamat email wajib diisi dengan benar.');
    }
    var wa = Util.normalisasiWa(p && p.no_wa);
    if (!wa) {
      throw _err('VALIDASI_GAGAL',
        'Nomor WhatsApp wajib diisi dengan benar. Contoh: 081234567890');
    }
    var tgl = Util.tglLahirSah(p && p.tanggal_lahir);
    if (!tgl) {
      throw _err('VALIDASI_GAGAL',
        'Tanggal lahir wajib diisi (format: HARI/BULAN/TAHUN).');
    }
    var nisn = String(p && p.nisn || '').trim();
    if (nisn && !Util.nisnSah(nisn)) {
      throw _err('VALIDASI_GAGAL', 'NISN hanya boleh angka (4–20 digit).');
    }

    Db.perbarui('Users', u._baris, {
      email: email, no_wa: wa, tanggal_lahir: tgl, nisn: nisn,
      updated_at: Util.sekarang()
    });
    Util.catatLog(sesi.user_id, 'SIMPAN_BIODATA', '', 'ok', sesi.role,
                  'Users', sesi.user_id);
    return { berhasil: true, biodata_kurang: false };
  }

  /* ------------------------------------- lupa sandi/username mandiri */

  /**
   * Pesan penolakan NETRAL — sama untuk "data tidak cocok", akun tak
   * ada, atau akun bukan murid, agar tidak bisa dipakai menebak data.
   */
  var _PESAN_LUPA_GAGAL = 'Data tidak cocok. Silakan hubungi guru Anda ' +
                          'untuk mereset akses.';

  function _lupaTerlaluSering(kunci) {
    try {
      var cache = CacheService.getScriptCache();
      var k = 'lupa_' + kunci;
      var n = Number(cache.get(k)) || 0;
      if (n >= 5) return true;
      cache.put(k, String(n + 1), 900);   /* jendela 15 menit */
      return false;
    } catch (e) { return false; }
  }

  function _lupaResetDanJawab(user) {
    var pwd = Util.passwordSementara();
    var salt = Util.buatSalt();
    Db.perbarui('Users', user._baris, {
      password_hash: Util.hashPassword(pwd, salt), salt: salt,
      pwd_awal: pwd,
      harus_ganti_password: true,
      updated_at: Util.sekarang()
    });
    _hapusSesiUser(user.user_id);
    Util.catatLog(user.user_id, 'LUPA_AKSES_OTOMATIS',
                  'reset mandiri ' + user.username, 'ok', 'murid',
                  'Users', user.user_id);
    return { diterima: true, username: user.username,
             password_sementara: pwd };
  }

  /**
   * LUPA PASSWORD (mandiri): verifikasi username + no WA + tanggal lahir
   * → sandi langsung direset, sandi sementara baru dikembalikan sekali.
   * Gagal apa pun → jawaban netral "hubungi guru" (keputusan 2026-09-02).
   */
  function lupaPassword(username, noWa, tglLahir) {
    var u = Util.normalisasiUsername(username);
    if (!u) return { diterima: false, pesan: _PESAN_LUPA_GAGAL };
    if (_lupaTerlaluSering(u)) {
      return { diterima: false, pesan: 'Terlalu banyak percobaan. ' +
               'Silakan hubungi guru Anda.' };
    }
    var user = Db.cari('Users', 'username', u);
    var cocok = !!user && user.role === 'murid' && user.status === 'aktif' &&
      !!user.tanggal_lahir &&
      Util.normalisasiWa(noWa) === Util.normalisasiWa(user.no_wa) &&
      Util.tglLahirSah(tglLahir) === String(user.tanggal_lahir);
    if (!cocok) return { diterima: false, pesan: _PESAN_LUPA_GAGAL };
    return _lupaResetDanJawab(user);
  }

  /**
   * LUPA USERNAME + PASSWORD (mandiri): verifikasi email + no WA +
   * tanggal lahir → username ditampilkan DAN sandi direset.
   */
  function lupaUsername(email, noWa, tglLahir) {
    var e = String(email || '').trim().toLowerCase();
    if (!e) return { diterima: false, pesan: _PESAN_LUPA_GAGAL };
    if (_lupaTerlaluSering('u:' + e)) {
      return { diterima: false, pesan: 'Terlalu banyak percobaan. ' +
               'Silakan hubungi guru Anda.' };
    }
    var kandidat = Db.saring('Users', { email: e })
      .filter(function (x) { return x.role === 'murid' && x.status === 'aktif'; });
    var user = null;
    kandidat.forEach(function (x) {
      if (x.tanggal_lahir &&
          Util.normalisasiWa(noWa) === Util.normalisasiWa(x.no_wa) &&
          Util.tglLahirSah(tglLahir) === String(x.tanggal_lahir)) user = x;
    });
    if (!user) return { diterima: false, pesan: _PESAN_LUPA_GAGAL };
    return _lupaResetDanJawab(user);
  }

  return {
    validasiToken: validasiToken,
    simpanBiodata: simpanBiodata,
    lupaPassword: lupaPassword,
    lupaUsername: lupaUsername,
    login: login,
    loginWa: loginWa,
    gantiPassword: gantiPassword,
    ajukanReset: ajukanReset,
    getPermintaanReset: getPermintaanReset,
    resetPasswordMurid: resetPasswordMurid,
    _hapusSesi: _hapusSesi,
    _hapusSesiUser: _hapusSesiUser,
    _buatSesi: _buatSesi
  };
})();


/* ============================================================
 *  DARURAT — hanya dijalankan dari Apps Script Editor.
 *  Dipakai bila akun guru terkunci atau lupa kata sandi.
 * ============================================================ */
function resetGuruDarurat() {
  var guru = Db.saring('Users', { role: 'guru' });
  if (!guru.length) { Logger.log('Tidak ada akun guru.'); return; }

  var pwd = Util.passwordSementara();
  var salt = Util.buatSalt();
  var g = guru[0];

  Db.perbarui('Users', g._baris, {
    password_hash: Util.hashPassword(pwd, salt),
    salt: salt,
    pwd_awal: pwd,
    status: 'aktif',
    harus_ganti_password: true,
    updated_at: Util.sekarang()
  });
  Auth._hapusSesiUser(g.user_id);
  try { CacheService.getScriptCache().remove('gagal_' + g.username); } catch (e) {}

  Logger.log('==========================================');
  Logger.log(' RESET DARURAT BERHASIL');
  Logger.log(' Username : ' + g.username);
  Logger.log(' Password : ' + pwd);
  Logger.log(' Wajib diganti saat login berikutnya.');
  Logger.log('==========================================');
}
