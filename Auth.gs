/**
 * ============================================================
 *  LessonLen — Auth.gs
 *  Login, sesi, ganti password, reset oleh guru
 * ------------------------------------------------------------
 *  Acuan: KESEPAKATAN-SISTEM.md v4.5 §4.1, §4.4
 *  KEAMANAN:
 *   - password tidak pernah plaintext & tidak pernah dikirim ke klien
 *   - respons "lupa password" SELALU sama apa pun hasilnya
 *   - 5x gagal dalam 15 menit → kunci 15 menit
 * ============================================================
 */

var Auth = (function () {

  var TTL_SESI_JAM   = 12;
  var MAKS_GAGAL     = 5;
  var MENIT_KUNCI    = 15;
  var MAKS_RESET_HARI = 3;

  /* -------------------------------------------------- sesi */

  /**
   * Validasi token. Mengembalikan {user_id, nama, role, username} atau null.
   * Cache dulu; bila kosong, jatuh ke sheet session.
   */
  function validasiToken(token) {
    if (!token) return null;

    var cache = CacheService.getScriptCache();
    var c = cache.get('sesi_' + token);
    if (c) {
      try { return JSON.parse(c); } catch (e) { /* lanjut ke sheet */ }
    }

    var baris = Db.cari('session', 'token', token);
    if (!baris) return null;
    if (Util.lewat(baris.expired_at)) { _hapusSesi(token); return null; }

    var u = Db.cari('users', 'user_id', baris.user_id);
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
    Db.tambah('session', {
      token: token, user_id: user.user_id,
      dibuat_at: now, expired_at: Util.tambahJam(now, TTL_SESI_JAM)
    });
    return token;
  }

  function _hapusSesi(token) {
    try { CacheService.getScriptCache().remove('sesi_' + token); } catch (e) {}
    var b = Db.cari('session', 'token', token);
    if (b) Db.hapus('session', b._baris);
  }

  /** Hapus seluruh sesi milik satu user (dipakai saat reset password). */
  function _hapusSesiUser(userId) {
    var semua = Db.saring('session', { user_id: userId });
    if (!semua.length) return;
    var cache = CacheService.getScriptCache();
    semua.forEach(function (s) {
      try { cache.remove('sesi_' + s.token); } catch (e) {}
    });
    Db.hapusBanyak('session', semua.map(function (s) { return s._baris; }));
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

    var user = Db.cari('users', 'username', u);

    /* pesan sengaja sama untuk user tak ada maupun password salah */
    if (!user || user.password_hash !== Util.hashPassword(password, user.salt)) {
      var n = _tambahGagal(u);
      Util.catatLog(user ? user.user_id : '', 'login_gagal',
                    'username=' + u + ' percobaan=' + n, 'gagal');
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
    Db.perbarui('users', user._baris, { last_login: Util.sekarang() });
    Util.catatLog(user.user_id, 'login', 'role=' + user.role);

    var wajibGanti = user.harus_ganti_password === true ||
                     user.harus_ganti_password === 'TRUE';

    /* Hanya murid yang dimintai biodata (keputusan guru v1.10.0).
       Dikirim saat login supaya beranda dapat menampilkan spanduk
       tanpa satu pun panggilan tambahan. */
    var biodataKurang = user.role === 'murid' &&
                        !Util.biodataLengkap(user);

    /* Isi biodata yang SUDAH ada ikut dikirim (v1.10.1).

       Dialog muncul langsung saat login, dan murid yang sudah
       mengisi sebagian — mis. email sudah, WA belum — tidak boleh
       disuruh mengetik ulang. Barisnya toh sudah dibaca di atas,
       jadi ini NOL panggilan API tambahan. Memanggil
       `getBiodataSaya` dari klien akan menambah satu permintaan per
       murid, dan 36 murid masuk bersamaan adalah kasus nyata di
       sini (§6.2 no. 51). */
    var biodata = null;
    if (biodataKurang) {
      biodata = {
        nisn:  String(user.nisn || ''),
        email: String(user.email || ''),
        no_wa: String(user.no_wa || '')
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

  /* -------------------------------------------------- ganti password */

  function gantiPassword(sesi, lama, baru) {
    var user = Db.cari('users', 'user_id', sesi.user_id);
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
    Db.perbarui('users', user._baris, {
      password_hash: Util.hashPassword(baru, salt),
      salt: salt,
      pwd_awal: '',            /* murid sudah tahu sandinya sendiri */
      harus_ganti_password: false
    });
    Util.catatLog(sesi.user_id, 'ganti_password', '');
    return { berhasil: true };
  }

  /* -------------------------------------------------- lupa password */

  /**
   * Diajukan tanpa login. Respons SELALU sama apa pun hasilnya,
   * agar tidak bisa dipakai menebak username yang valid.
   */
  function ajukanReset(inputUser) {
    var input = String(inputUser || '').trim();
    var balasan = { diterima: true };

    if (!input) return balasan;

    var u = Util.normalisasiUsername(input);
    var user = Db.cari('users', 'username', u);
    if (!user && input.indexOf('@') !== -1) {
      user = Db.cari('users', 'email', input.toLowerCase());
    }

    /* rate limit 3 permintaan / 24 jam */
    if (user) {
      var batas = new Date(Date.now() - 86400000);
      var jml = Db.saring('permintaan_reset', { user_id: user.user_id })
        .filter(function (r) { return new Date(r.dibuat_at) > batas; }).length;
      if (jml >= MAKS_RESET_HARI) {
        Util.catatLog(user.user_id, 'reset_ditolak', 'melebihi batas harian', 'gagal');
        return balasan;
      }
    }

    Db.tambah('permintaan_reset', {
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
      Util.catatLog('', 'reset_user_tidak_ada', 'input=' + input.slice(0, 50), 'gagal');
    }
    return balasan;
  }

  /** Daftar permintaan reset yang masih antre — hanya guru. */
  function getPermintaanReset() {
    var users = Db.baca('users');
    var peta = {};
    users.forEach(function (u) { peta[u.user_id] = u; });

    return Db.saring('permintaan_reset', { status: 'antre' })
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
   * Mengembalikan password sementara untuk ditampilkan SEKALI di layar guru.
   */
  function resetPasswordMurid(sesi, userId, requestId) {
    var user = Db.cari('users', 'user_id', userId);
    if (!user) throw _err('TIDAK_DITEMUKAN', 'Pengguna tidak ditemukan.');
    if (user.role === 'guru' && user.user_id !== sesi.user_id) {
      throw _err('AKSES_DITOLAK', 'Tidak dapat mereset akun guru lain.');
    }

    var pwd = Util.passwordSementara();
    var salt = Util.buatSalt();

    Db.perbarui('users', user._baris, {
      password_hash: Util.hashPassword(pwd, salt),
      salt: salt,
      pwd_awal: pwd,           /* tampil di daftar sampai murid menggantinya */
      harus_ganti_password: true
    });

    _hapusSesiUser(userId);

    if (requestId) {
      var req = Db.cari('permintaan_reset', 'request_id', requestId);
      if (req) {
        Db.perbarui('permintaan_reset', req._baris,
                    { status: 'selesai', diproses_at: Util.sekarang() });
      }
    }

    Util.catatLog(sesi.user_id, 'reset_password',
                  'target=' + userId + ' (' + user.username + ')');

    /* Nomor WA murid ikut dikembalikan (v1.11.3) supaya guru dapat
       langsung mengirimkan sandi barunya lewat WhatsApp.

       Yang dikirim hanya NOMOR — tautan beserta pesannya disusun
       `Kelas.tautanResetWa()`, satu tempat saja. Auth sengaja tidak
       ikut menyusun teks: ia tidak tahu apa-apa soal tampilan.

       Kosong bila murid belum mengisi biodata atau nomornya rusak;
       layar menyembunyikan tombolnya, bukan menampilkan tautan mati. */
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
    var guru = Db.saring('users', { role: 'guru', status: 'aktif' });
    if (!guru.length) return;
    Db.tambah('notifikasi', guru.map(function (g) {
      return {
        notif_id: Util.buatId('NTF'), user_id: g.user_id, jenis: jenis,
        judul: judul, pesan: pesan, link: '#/reset',
        dibaca: false, dibuat_at: Util.sekarang()
      };
    }));
  }

  return {
    validasiToken: validasiToken,
    login: login,
    gantiPassword: gantiPassword,
    ajukanReset: ajukanReset,
    getPermintaanReset: getPermintaanReset,
    resetPasswordMurid: resetPasswordMurid,
    _hapusSesi: _hapusSesi,
    _hapusSesiUser: _hapusSesiUser,
    /* Dipakai fungsi diagnostik di Code.gs untuk membuat sesi TANPA
       password (v1.9.11). Sebelumnya seluruh `ujiTahapN()` memakai
       password seed 'guru123' dan mati begitu guru menggantinya. */
    _buatSesi: _buatSesi
  };
})();


/* ============================================================
 *  DARURAT — hanya dijalankan dari Apps Script Editor
 *  Dipakai bila akun guru terkunci atau lupa kata sandi.
 * ============================================================ */
function resetGuruDarurat() {
  var guru = Db.saring('users', { role: 'guru' });
  if (!guru.length) { Logger.log('Tidak ada akun guru.'); return; }

  var pwd = Util.passwordSementara();
  var salt = Util.buatSalt();
  var g = guru[0];

  Db.perbarui('users', g._baris, {
    password_hash: Util.hashPassword(pwd, salt),
    salt: salt,
    pwd_awal: pwd,
    status: 'aktif',
    harus_ganti_password: true
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
