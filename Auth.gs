/**
 * LessonLen v2 — Auth.gs
 * Login, sesi 30 hari, ganti sandi. 5 gagal / 15 menit = kunci.
 */

var Auth = (function () {

  var TTL_JAM = 720;
  var MAKS_GAGAL = 5;
  var MENIT_KUNCI = 15;

  function validasiToken(token) {
    if (!token) return null;
    var cache = CacheService.getScriptCache();
    var c = cache.get('sesi_' + token);
    if (c) {
      try { return JSON.parse(c); } catch (e) {}
    }
    var baris = Db.cari('session', 'token', token);
    if (!baris) return null;
    var exp = Util.parseWaktu(baris.expired_at);
    if (exp && Date.now() > exp) { _hapusSesi(token); return null; }

    var u = Db.cari('users', 'user_id', baris.user_id);
    if (!u || u.status !== 'aktif') { _hapusSesi(token); return null; }

    var sesi = {
      user_id: u.user_id, username: u.username,
      nama: u.nama, role: u.role,
      harus_ganti_password: Util.ya(u.harus_ganti_password)
    };
    try { cache.put('sesi_' + token, JSON.stringify(sesi), 3600); } catch (e) {}
    return sesi;
  }

  function _buatSesi(user) {
    var basi = Db.saring('session', { user_id: user.user_id }).filter(function (s) {
      var exp = Util.parseWaktu(s.expired_at);
      return exp && Date.now() > exp;
    });
    if (basi.length) Db.hapusBanyak('session', basi.map(function (s) { return s._baris; }));

    var token = Util.buatToken();
    var now = new Date();
    var exp = new Date(now.getTime() + TTL_JAM * 3600000);
    Db.tambah('session', {
      token: token, user_id: user.user_id,
      dibuat_at: Util.sekarang(),
      expired_at: Utilities.formatDate(exp, 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss')
    });
    return token;
  }

  function _hapusSesi(token) {
    try { CacheService.getScriptCache().remove('sesi_' + token); } catch (e) {}
    var b = Db.cari('session', 'token', token);
    if (b) Db.hapus('session', b._baris);
  }

  function _hapusSesiUser(userId) {
    var semua = Db.saring('session', { user_id: userId });
    if (!semua.length) return;
    var cache = CacheService.getScriptCache();
    semua.forEach(function (s) {
      try { cache.remove('sesi_' + s.token); } catch (e) {}
    });
    Db.hapusBanyak('session', semua.map(function (s) { return s._baris; }));
  }

  function _kunciKey(u) { return 'gagal_' + u; }

  function login(username, password) {
    var u = Util.normalisasiUsername(username);
    if (Util.kosong(u) || Util.kosong(password)) {
      return { ok: false, error: 'VALIDASI_GAGAL',
               pesan: 'Nama pengguna dan kata sandi wajib diisi.' };
    }
    var cache = CacheService.getScriptCache();
    var nGagal = Number(cache.get(_kunciKey(u)) || 0);
    if (nGagal >= MAKS_GAGAL) {
      return { ok: false, error: 'AKUN_TERKUNCI',
               pesan: 'Terlalu banyak percobaan gagal. Coba lagi dalam ' + MENIT_KUNCI + ' menit.' };
    }

    var user = Db.cari('users', 'username', u);
    if (!user || user.password_hash !== Util.hashPassword(password, user.salt)) {
      nGagal++;
      cache.put(_kunciKey(u), String(nGagal), MENIT_KUNCI * 60);
      return { ok: false, error: 'LOGIN_GAGAL',
               pesan: 'Nama pengguna atau kata sandi salah.' +
                      (nGagal >= 3 ? ' Sisa percobaan: ' + (MAKS_GAGAL - nGagal) + '.' : '') };
    }
    if (user.status !== 'aktif') {
      return { ok: false, error: 'AKUN_NONAKTIF', pesan: 'Akun dinonaktifkan. Hubungi guru.' };
    }

    try { cache.remove(_kunciKey(u)); } catch (e) {}
    var token = _buatSesi(user);
    Db.perbarui('users', user._baris, { last_login: Util.sekarang() });

    return { ok: true, data: {
      token: token,
      user: { user_id: user.user_id, username: user.username, nama: user.nama, role: user.role },
      harus_ganti_password: Util.ya(user.harus_ganti_password)
    }};
  }

  function gantiPassword(sesi, lama, baru) {
    var user = Db.cari('users', 'user_id', sesi.user_id);
    if (!user) throw Util.err('TIDAK_DITEMUKAN', 'Pengguna tidak ditemukan.');
    if (user.password_hash !== Util.hashPassword(lama, user.salt)) {
      throw Util.err('VALIDASI_GAGAL', 'Kata sandi lama tidak cocok.');
    }
    var pesan = Util.periksaPassword(baru);
    if (pesan) throw Util.err('VALIDASI_GAGAL', pesan);
    if (lama === baru) throw Util.err('VALIDASI_GAGAL', 'Kata sandi baru harus berbeda.');
    var salt = Util.buatSalt();
    Db.perbarui('users', user._baris, {
      password_hash: Util.hashPassword(baru, salt),
      salt: salt, pwd_awal: '', harus_ganti_password: false
    });
    return { berhasil: true };
  }

  function resetPasswordMurid(sesi, userId) {
    var user = Db.cari('users', 'user_id', userId);
    if (!user) throw Util.err('TIDAK_DITEMUKAN', 'Pengguna tidak ditemukan.');
    if (user.role === 'guru' && user.user_id !== sesi.user_id) {
      throw Util.err('AKSES_DITOLAK', 'Tidak dapat mereset akun guru lain.');
    }
    var pwd = Util.passwordSementara();
    var salt = Util.buatSalt();
    Db.perbarui('users', user._baris, {
      password_hash: Util.hashPassword(pwd, salt),
      salt: salt, pwd_awal: pwd, harus_ganti_password: true
    });
    _hapusSesiUser(userId);
    return { username: user.username, nama: user.nama, password_sementara: pwd };
  }

  return {
    validasiToken: validasiToken,
    login: login,
    gantiPassword: gantiPassword,
    resetPasswordMurid: resetPasswordMurid,
    _hapusSesi: _hapusSesi,
    _hapusSesiUser: _hapusSesiUser
  };
})();
