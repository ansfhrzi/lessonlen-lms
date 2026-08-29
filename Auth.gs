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

  /* 720 jam = 30 hari, naik dari 12 (v1.17.0).

     LAPORAN LAPANGAN: "banyak siswa yang lupa user dan password."
     Akarnya bukan sandinya sulit — murid dipaksa mengetik ulang
     kredensialnya SETIAP HARI SEKOLAH, karena sesi mati tiap 12 jam.
     Lupa dalam kondisi itu kepastian statistik, bukan kecelakaan.

     Efek samping yang menguntungkan: sheet `session` justru tumbuh
     lebih LAMBAT. Setiap login menambah satu baris, dan token lama
     yang tertimpa di localStorage tidak pernah dibaca lagi sehingga
     tidak pernah dibersihkan. Dengan 12 jam, satu murid menyumbang
     ±20 baris/bulan; dengan 30 hari, ±1 baris/bulan.

     30 hari dipilih agar murid tidak kehilangan sesi di tengah
     minggu ujian, tetapi akun di perangkat yang berpindah tangan
     tetap berakhir sendiri dalam sebulan. */
  var TTL_SESI_JAM   = 720;
  var MAKS_GAGAL     = 5;
  var MENIT_KUNCI    = 15;
  var MAKS_RESET_HARI = 3;

  /* Percobaan pemulihan username per email dalam satu jendela kunci.
     Lihat `pulihkanAkun()` — tanpa batas ini pasangan email+WA bisa
     ditebak berulang kali tanpa konsekuensi. */
  var MAKS_PULIH     = 5;

  /* Percobaan pencarian akun pada `ajukanReset()` per nilai input
     dalam satu jendela kunci (v1.18.0).

     WAJIB sejak balasannya dibedakan: selama semua balasan identik,
     menebak username tidak memberi informasi apa pun dan tidak perlu
     dibatasi. Begitu "tidak ditemukan" dibalas berbeda, fungsi ini
     jadi alat memastikan username mana yang ada — tanpa batas, ribuan
     tebakan bisa dicoba dalam sejam. */
  var MAKS_CARI_RESET = 5;

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
    /* Bersihkan sesi kedaluwarsa milik murid ini lebih dulu (v1.17.0).

       `validasiToken()` hanya menghapus token saat token itu DIBACA.
       Token lama yang tertimpa di localStorage tidak pernah dibaca
       lagi, jadi tidak pernah terhapus — sheet `session` menumpuk
       selamanya. Dengan TTL 30 hari setiap baris tinggal lebih lama,
       sehingga pembersihan dipindahkan ke satu-satunya tempat yang
       pasti dijalankan: saat sesi baru dibuat.

       Murah karena login kini ±20x lebih jarang (lihat TTL_SESI_JAM). */
    var basi = Db.saring('session', { user_id: user.user_id })
      .filter(function (s) { return Util.lewat(s.expired_at); });
    if (basi.length) {
      Db.hapusBanyak('session', basi.map(function (s) { return s._baris; }));
    }

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

  function _kunciCariReset(input) { return 'carirset_' + input; }

  /**
   * Ajukan reset kata sandi. Dipanggil TANPA login.
   *
   * v1.18.0 — PERILAKU BERUBAH atas keputusan guru.
   *
   * SEBELUMNYA respons SELALU `{diterima:true}` apa pun hasilnya, agar
   * tidak bisa dipakai menebak username yang valid. Konsekuensinya:
   * murid yang salah mengetik username melihat "Permintaan Diterima",
   * lalu menunggu selamanya — tidak ada baris yang sampai ke guru,
   * tidak ada kabar. Jalan buntu yang senyap.
   *
   * SEKARANG akun diperiksa lebih dulu. Tidak ditemukan atau nonaktif
   * → ditolak dengan pesan, dan TIDAK ada baris `permintaan_reset`
   * yang dibuat.
   *
   * YANG HARUS DIKETAHUI TENTANG RISIKONYA
   *
   * Ini memang membuka oracle: orang bisa memastikan username mana
   * yang ada. Tiga hal yang membuat risikonya lebih kecil dari
   * kelihatannya di aplikasi ini:
   *
   *   1. `Auth.login()` SUDAH membocorkan hal yang sama — akun
   *      nonaktif dibalas "Akun Anda dinonaktifkan", yang tidak ada
   *      dibalas "Nama pengguna atau kata sandi salah" (baris 166).
   *      Jadi kebocoran ini bukan baru.
   *   2. Username dibuat dari nama oleh `Kelas._usernameDari()`
   *      (nama depan + huruf awal nama belakang). Sudah sangat
   *      mudah ditebak tanpa bantuan aplikasi.
   *   3. Yang bocor hanya keberadaan akun — bukan kata sandi, dan
   *      login tetap dikunci 5 percobaan / 15 menit.
   *
   * SYARAT MUTLAK: batas percobaan di bawah. Sebelumnya batas 3/24 jam
   * hanya berlaku BILA akun ditemukan (`if (user) {…}`), jadi pencarian
   * yang tidak cocok tidak dibatasi sama sekali. Selama balasannya
   * seragam itu tidak berbahaya. Begitu balasannya berbeda, tanpa
   * batas ini orang bisa menebak ribuan username dalam sejam.
   *
   * @returns {Object} { diterima } atau { diterima:false, error, pesan }
   */
  function ajukanReset(inputUser) {
    var input = String(inputUser || '').trim();

    if (!input) {
      return { diterima: false, error: 'VALIDASI_GAGAL',
               pesan: 'Isi nama pengguna atau email dulu.' };
    }

    /* Batas pencarian per nilai input. Lihat catatan di atas — ini
       bukan hiasan, ini syarat agar perubahan di atas aman. */
    var cache = CacheService.getScriptCache();
    var n = (Number(cache.get(_kunciCariReset(input)) || '0') + 1);
    cache.put(_kunciCariReset(input), String(n), MENIT_KUNCI * 60);
    if (n > MAKS_CARI_RESET) {
      return { diterima: false, error: 'TERLALU_BANYAK',
               pesan: 'Terlalu banyak percobaan. Coba lagi dalam ' +
                      MENIT_KUNCI + ' menit.' };
    }

    var u = Util.normalisasiUsername(input);
    var user = Db.cari('users', 'username', u);
    if (!user && input.indexOf('@') !== -1) {
      user = Db.cari('users', 'email', input.toLowerCase());
    }

    /* SATU pesan untuk dua sebab. Memisahkannya ("tidak ada" vs
       "nonaktif") akan memberi tahu orang luar bahwa murid tertentu
       sudah dikeluarkan dari kelas — bocoran yang tidak perlu, dan
       murid yang bersangkutan tetap harus melakukan hal yang sama:
       menemui guru. */
    if (!user || user.status !== 'aktif') {
      Util.catatLog('', 'reset_akun_tak_dapat_direset',
                    'input=' + input.slice(0, 50) +
                    (user ? ' sebab=nonaktif' : ' sebab=tidak_ada'), 'gagal');
      return { diterima: false, error: 'AKUN_TAK_DAPAT_DIRESET',
               pesan: 'Nama pengguna tidak ditemukan atau akun Anda ' +
                      'nonaktif. Silakan hubungi guru Anda untuk ' +
                      'mendapatkan nama pengguna dan kata sandi.' };
    }

    try { cache.remove(_kunciCariReset(input)); } catch (e) {}

    /* rate limit 3 permintaan / 24 jam */
    var batas = new Date(Date.now() - 86400000);
    var jml = Db.saring('permintaan_reset', { user_id: user.user_id })
      .filter(function (r) { return new Date(r.dibuat_at) > batas; }).length;
    if (jml >= MAKS_RESET_HARI) {
      /* Dulunya dibalas `{diterima:true}` dan diam — jalan buntu senyap
         yang sama. Sekarang dijelaskan. */
      return { diterima: false, error: 'BATAS_HARIAN',
               pesan: 'Anda sudah meminta reset ' + jml +
                      ' kali dalam 24 jam terakhir. Silakan hubungi ' +
                      'guru Anda langsung.' };
    }

    /* Baris HANYA dibuat bila akunnya ada dan aktif. Sebelumnya baris
       tetap dibuat dengan `user_id` kosong lalu disembunyikan
       `getPermintaanReset()` — mengendap selamanya di sheet. */
    Db.tambah('permintaan_reset', {
      request_id: Util.buatId('RST'),
      user_id: user.user_id,
      input_user: input.slice(0, 100),
      status: 'antre',
      dibuat_at: Util.sekarang(),
      diproses_at: ''
    });

    _notifGuru('permintaan_reset', 'Permintaan reset kata sandi',
               user.nama + ' (' + user.username + ') meminta reset kata sandi.');

    Util.catatLog(user.user_id, 'reset_diminta', '');
    return { diterima: true };
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

  /* -------------------------------------------------- pulihkan akun */

  function _kunciPulih(email) { return 'pulih_' + email; }

  /**
   * Cari username dari email + nomor WhatsApp (v1.17.0).
   *
   * INI PEMULIHAN, BUKAN LOGIN. Tidak ada sesi yang dibuat dan tidak
   * ada akun yang dimasuki. Yang dikembalikan hanya USERNAME — kata
   * sandi tetap harus direset guru lewat jalur `#/reset` yang sudah
   * ada. Karena itu membocorkan username bukan membocorkan akun, dan
   * syaratnya cukup dua data yang sudah dikumpulkan murid sendiri.
   *
   * KEAMANAN
   *   1. SATU bentuk kegagalan untuk SEMUA sebab. Pasangan salah,
   *      biodata belum lengkap, dan akun tidak ada dibalas identik.
   *      Membedakannya membuat fungsi ini jadi alat uji: orang bisa
   *      memastikan apakah sebuah email dan sebuah nomor HP milik
   *      satu orang yang sama dan orang itu murid di sini — bocoran
   *      privasi walau tanpa username.
   *      Konsekuensinya disengaja: murid yang datanya belum lengkap
   *      MEMANG harus bertemu guru, jadi pesannya sama saja.
   *   2. Batas MAKS_PULIH percobaan per email per 15 menit. Tanpa ini
   *      poin 1 bisa dibongkar dengan menebak berulang kali.
   *      Catatan: `google.script.run` tidak memberi alamat IP
   *      pengunjung, jadi batasnya hanya bisa per nilai input.
   *   3. Keduanya harus cocok pada BARIS YANG SAMA — bukan email di
   *      baris A dan nomor di baris B.
   *
   * KENAPA BISA LEBIH DARI SATU AKUN
   *   `imporMurid()` membuat `user_id` baru per baris dan hanya
   *   menghindari tabrakan username (andi, andis2, …). Murid yang
   *   ikut dua kelas punya DUA baris `users`, dan `simpanBiodata()`
   *   menulis email + WA per baris. Jadi pasangan yang sama bisa
   *   cocok dua kali. Semuanya dikembalikan beserta label kelasnya —
   *   menampilkan yang pertama saja akan membuat murid memulihkan
   *   akun yang salah dan kehilangan kelasnya yang lain.
   *
   * @returns {Object} { ketemu, akun?, tautan_wa_guru?, tunggu_menit? }
   */
  function pulihkanAkun(inputEmail, inputWa) {
    var email = String(inputEmail || '').trim().toLowerCase();
    var wa    = Util.normalisasiWa(inputWa);

    var tidak = { ketemu: false };

    /* Input tak sah dibalas sama seperti tak cocok — jangan beri
       penyerang umpan balik tentang bentuk data yang disimpan. */
    if (!Util.emailSah(email) || !wa) return tidak;

    var cache = CacheService.getScriptCache();
    var n = (Number(cache.get(_kunciPulih(email)) || '0') + 1);
    cache.put(_kunciPulih(email), String(n), MENIT_KUNCI * 60);
    if (n > MAKS_PULIH) {
      return { ketemu: false, tunggu_menit: MENIT_KUNCI };
    }

    /* Email disimpan sudah di-lowercase (Kelas.simpanBiodata) dan
       nomor WA sudah dinormalkan ke 62xxx (Util.normalisasiWa).
       Input diperlakukan sama persis, kalau tidak `Andi@Gmail.com`
       dan `0812…` gagal melawan data yang benar. */
    var cocok = Db.saring('users', { role: 'murid', status: 'aktif' })
      .filter(function (u) {
        return String(u.email || '').trim().toLowerCase() === email &&
               Util.normalisasiWa(u.no_wa) === wa;
      });

    if (!cocok.length) {
      Util.catatLog('', 'pulih_tidak_cocok',
                    'email=' + email + ' percobaan=' + n, 'gagal');
      return tidak;
    }

    try { cache.remove(_kunciPulih(email)); } catch (e) {}

    /* Label kelas disusun seperti Kelas.daftarMurid(): mapel WAJIB
       ikut, karena satu rombel bisa punya beberapa kelas bernama
       sama (pelajaran v1.6.4). */
    var petaKelas = {};
    Db.bacaKolom('kelas', ['kelas_id', 'nama_kelas', 'mapel'])
      .forEach(function (k) { petaKelas[k.kelas_id] = k; });

    var kelasPerMurid = {};
    Db.saring('enrollment', { status: 'aktif' }).forEach(function (e) {
      (kelasPerMurid[e.user_id] = kelasPerMurid[e.user_id] || [])
        .push(e.kelas_id);
    });

    var akun = cocok.map(function (u) {
      var label = (kelasPerMurid[u.user_id] || []).map(function (id) {
        var k = petaKelas[id];
        if (!k) return '';
        return k.nama_kelas + (k.mapel ? ' · ' + k.mapel : '');
      }).filter(function (s) { return !!s; }).join(', ');

      return { user_id: u.user_id, username: u.username,
               nama: u.nama, label_kelas: label };
    });

    var daftarUser = akun.map(function (a) { return a.username; });
    Util.catatLog(cocok[0].user_id, 'pulih_username',
                  'email=' + email + ' akun=' + daftarUser.join('/'));

    return {
      ketemu: true,
      akun: akun,
      /* Tautan WA disusun di Kelas — Auth sengaja tidak menyusun teks
         tampilan (lihat catatan yang sama di resetPasswordMurid). */
      tautan_wa_guru: Kelas.tautanPulihWa(cocok[0].nama,
                                          daftarUser.join(' / '))
    };
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
    pulihkanAkun: pulihkanAkun,
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
  _hanyaEditor();
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
