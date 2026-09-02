/* ============================================================
 *  LMS v2 — Murid.gs
 *  Kelola Murid (menu dashboard guru — keputusan §22D):
 *  daftar + cari/filter, tambah/edit (sandi sementara otomatis),
 *  impor massal + pratinjau (dedupe username), detail murid.
 *
 *  Port perilaku v1 (Kelas.simpanMurid / pratinjauImpor /
 *  imporMurid / daftarMurid) setia apa adanya:
 *   · Pemetaan kolom impor & heuristiknya identik (_petakanKolomImpor)
 *   · Pratinjau WAJIB memakai pemetaan yang sama dengan impor
 *   · Sandi kustom dari guru divalidasi dengan aturan yang sama
 *     seperti saat murid mengganti sandi sendiri
 *   · `pwd_awal` terlihat guru sampai murid menggantinya sendiri
 *     (Auth.gantiPassword mengosongkannya)
 *
 *  Yang TIDAK di sini (alur §22D): enrollment — milik modul Kelas
 *  (Kelola Kelas). Menu Kelola Murid murni akun murid.
 * ============================================================ */

var Murid = (function () {

  /* -------------------------------------------------- bantu */

  function _err(kode, pesan) {
    var e = new Error(pesan);
    e.kode = kode;
    return e;
  }

  function _normRombel(v) {
    return String(v == null ? '' : v)
      .replace(/\s+/g, ' ').trim().toUpperCase().slice(0, 40);
  }

  /** Banding nama secara alami (angka ikut urut: 1, 2, 10). */
  function _bandingAlami(a, b) {
    a = String(a || ''); b = String(b || '');
    return a.localeCompare(b, 'id', { numeric: true });
  }

  /** Username awal dari nama: depan + inisial kedua — "Budi Santoso" → budis. */
  function _usernameDari(nama) {
    var bersih = String(nama).toLowerCase()
      .replace(/[^a-z0-9\s]/g, '').trim().split(/\s+/);
    return (bersih[0] || 'murid') + (bersih[1] ? bersih[1].charAt(0) : '');
  }

  function _pecahBaris(teks) {
    return String(teks || '').split(/\r?\n/)
      .map(function (b) { return b.trim(); })
      .filter(function (b) { return b.length > 0; });
  }

  /** Pisahkan kolom: tab, titik koma, koma, atau pipa.
      Nomor urut di awal baris dibuang (warisan tempelan Word/Excel). */
  function _pecahKolom(b) {
    var t = String(b).trim();

    /* "1. Budi" / "12) Budi" / "3 Budi" — nomor urut tanpa pemisah kolom */
    t = t.replace(/^\d{1,3}\s*[.)\-]\s+/, '')
         .replace(/^\d{1,3}\s{2,}/, '');

    var k = t.split(/[\t;,|]/).map(function (x) { return x.trim(); });

    /* "1<TAB>Budi<TAB>budi" — nomor urut sebagai kolom tersendiri */
    if (k.length > 1 && /^\d{1,3}[.)]?$/.test(k[0])) k.shift();

    return k.filter(function (x, i) { return i === 0 || x !== ''; });
  }

  /** Petakan kolom baris impor: `nama, rombel, username, password`.
      HEURISTIK SAMA PERSIS dengan v1 — pratinjau = hasil sebenarnya. */
  function _petakanKolomImpor(bagian) {
    var k2 = bagian[1] || '';
    var k3 = bagian[2] || '';
    var k4 = bagian[3] || '';

    /* 3 kolom atau lebih → urutan baru sudah pasti */
    if (k3) return { rombel: k2, username: k3, password: k4 };

    /* tepat 2 kolom → tebak dari ada/tidaknya spasi */
    if (k2 && /\s/.test(k2.trim())) return { rombel: k2, username: '', password: '' };
    return { rombel: '', username: k2, password: '' };
  }

  /** Peta userId → [{class_id,name}] dari enrollment aktif. */
  function _petaKelasMurid() {
    var petaKelas = {};
    Db.baca('Classes').forEach(function (k) { petaKelas[k.class_id] = k; });
    var peta = {};
    Db.saring('Enrollment', { status: 'aktif' }).forEach(function (e) {
      var k = petaKelas[e.class_id];
      if (!k) return;
      (peta[e.user_id] = peta[e.user_id] || []).push({
        class_id: k.class_id, name: k.name
      });
    });
    return peta;
  }

  function _bentukBaris(u, petaKelas) {
    return {
      user_id: u.user_id,
      username: u.username,
      nama: u.nama,
      rombel: u.rombel || '',
      email: u.email || '',
      nisn: u.nisn || '',
      no_wa: u.no_wa || '',
      status: u.status,
      /* Sandi sementara terakhir — terlihat guru sampai murid mengganti. */
      pwd_awal: u.pwd_awal || '',
      sudah_ganti: !u.pwd_awal,
      harus_ganti_password: u.harus_ganti_password === true ||
                            u.harus_ganti_password === 'TRUE',
      last_login: u.last_login ? String(u.last_login) : '',
      created_at: String(u.created_at || ''),
      kelas: (petaKelas && petaKelas[u.user_id]) || []
    };
  }

  /* -------------------------------------------------- daftar & detail */

  /**
   * Daftar seluruh murid untuk Kelola Murid (guru).
   * filter: { status: 'aktif'|'nonaktif'|'' (semua),
   *           cari:   potongan nama / username / NISN }
   */
  function daftar(sesi, filter) {
    filter = filter || {};
    var petaKelas = _petaKelasMurid();

    var hasil = Db.saring('Users', { role: 'murid' })
      .map(function (u) { return _bentukBaris(u, petaKelas); });

    if (filter.status) {
      hasil = hasil.filter(function (m) {
        return m.status === (filter.status === 'nonaktif' ? 'nonaktif' : 'aktif');
      });
    }

    var q = String(filter.cari || '').trim().toLowerCase();
    if (q) {
      hasil = hasil.filter(function (m) {
        return (m.nama || '').toLowerCase().indexOf(q) !== -1 ||
               (m.username || '').toLowerCase().indexOf(q) !== -1 ||
               (m.nisn || '').indexOf(q) !== -1;
      });
    }

    return hasil.sort(function (a, b) {
      return _bandingAlami(a.nama, b.nama);
    });
  }

  /** Detail satu murid (dialog detail & sandi). */
  function detail(sesi, userId) {
    var u = Db.cari('Users', 'user_id', userId);
    if (!u || u.role !== 'murid') {
      throw _err('TIDAK_DITEMUKAN', 'Murid tidak ditemukan.');
    }
    return _bentukBaris(u, _petaKelasMurid());
  }

  /* -------------------------------------------------- tambah / edit */

  /**
   * Tambah (tanpa user_id) atau edit (dengan user_id) murid.
   * Port setia Kelas.simpanMurid v1 — TANPA kelas_id: enrollment
   * dikerjakan modul Kelas sesuai alur §22D.
   */
  function simpan(sesi, p) {
    p = p || {};

    /* Nama wajib hanya saat MEMBUAT. Pada edit, isiBilaAda hanya
       menyentuh medan yang dikirim (pembaruan sebagian sah), tapi
       nama tetap tidak boleh DIKOSONGKAN. */
    if (!p.user_id && Util.kosong(p.nama)) {
      throw _err('VALIDASI_GAGAL', 'Nama wajib diisi.');
    }
    if (p.user_id && p.nama !== undefined && Util.kosong(p.nama)) {
      throw _err('VALIDASI_GAGAL', 'Nama tidak boleh dikosongkan.');
    }

    /* ---- edit ---- */
    if (p.user_id) {
      var u = Db.cari('Users', 'user_id', p.user_id);
      if (!u) throw _err('TIDAK_DITEMUKAN', 'Murid tidak ditemukan.');
      if (u.role !== 'murid') throw _err('AKSES_DITOLAK', 'Bukan akun murid.');

      /* Guru boleh membetulkan biodata; nilai kosong DIBOLEHKAN;
         nomor dirapikan di server (62xx seragam). */
      var ubah = Util.isiBilaAda({}, p, {
        nama:   Util.teks(100),
        rombel: _normRombel,
        email:  function (v) { return String(v || '').trim().toLowerCase().slice(0, 100); },
        nisn:   function (v) {
          var s = String(v || '').trim();
          if (s && !Util.nisnSah(s)) {
            throw _err('VALIDASI_GAGAL',
              'NISN hanya boleh angka (4–20 digit).');
          }
          return s;
        },
        no_wa:  function (v) {
          var s = String(v || '').trim();
          if (!s) return '';
          var wa = Util.normalisasiWa(s);
          if (!wa) {
            throw _err('VALIDASI_GAGAL',
              'Nomor WhatsApp belum benar. Contoh: 081234567890');
          }
          return wa;
        },
        status: function (v) { return v === 'nonaktif' ? 'nonaktif' : 'aktif'; }
      });

      Db.perbarui('Users', u._baris, ubah);
      if (ubah.status === 'nonaktif') {
        Auth._hapusSesiUser(p.user_id);   /* sesi aktif langsung dicabut */
      }
      Util.catatLog(sesi.user_id, 'edit_murid', p.user_id, 'ok', sesi.role,
                    'Users', p.user_id);
      return { user_id: p.user_id, baru: false };
    }

    /* ---- tambah ---- */
    var username = Util.normalisasiUsername(p.username);
    if (!username) throw _err('VALIDASI_GAGAL', 'Nama pengguna wajib diisi.');
    if (username.length < 3) {
      throw _err('VALIDASI_GAGAL', 'Nama pengguna minimal 3 karakter.');
    }
    if (Db.cariCepat('Users', 'username', username)) {
      throw _err('DUPLIKAT', 'Nama pengguna "' + username + '" sudah dipakai.');
    }

    /* Sandi kustom dari guru dipakai bila cukup panjang (v1: ≥6);
       selain itu sandi sementara acak. Keduanya wajib diganti murid. */
    var pwd = p.password && String(p.password).length >= 6
      ? String(p.password) : Util.passwordSementara();
    var salt = Util.buatSalt();

    var baru = {
      user_id: Util.buatId('USR'),
      username: username,
      password_hash: Util.hashPassword(pwd, salt),
      salt: salt,
      pwd_awal: pwd,
      nama: String(p.nama).trim().slice(0, 100),
      role: 'murid',
      rombel: _normRombel(p.rombel),
      email: String(p.email || '').trim().toLowerCase().slice(0, 100),
      nisn: String(p.nisn || '').trim(),
      no_wa: Util.normalisasiWa(p.no_wa) || '',
      status: 'aktif',
      harus_ganti_password: true,
      last_login: '',
      created_at: Util.sekarang(),
      updated_at: Util.sekarang()
    };
    Db.tambah('Users', baru);

    Util.catatLog(sesi.user_id, 'buat_murid',
                  baru.user_id + ' ' + username, 'ok', sesi.role,
                  'Users', baru.user_id);

    return { user_id: baru.user_id, username: username,
             password_sementara: pwd, baru: true };
  }

  /* -------------------------------------------------- impor massal */

  /**
   * Pratinjau impor — TIDAK menulis apa pun.
   * Format baris: `nama, rombel, username, password` (pemisah tab/;/, /|)
   * — pemetaan kolom PERSIS dengan impor() sehingga pratinjau jujur.
   */
  function pratinjauImpor(sesi, teks) {
    var baris = _pecahBaris(teks);
    if (!baris.length) {
      throw _err('VALIDASI_GAGAL', 'Tidak ada data untuk diimpor.');
    }
    if (baris.length > 100) {
      throw _err('VALIDASI_GAGAL',
        'Maksimal 100 murid sekali impor. Ditemukan ' + baris.length + ' baris.');
    }

    var adaUsername = {};
    Db.baca('Users').forEach(function (u) { adaUsername[u.username] = true; });

    var siap = [], masalah = [];
    var dipakaiDiBatch = {};

    baris.forEach(function (b, i) {
      var kolom = _pecahKolom(b);
      var nama = kolom[0];

      if (!nama) {
        masalah.push({ baris: i + 1, teks: b, alasan: 'Nama kosong' });
        return;
      }
      if (nama.length < 2) {
        masalah.push({ baris: i + 1, teks: b, alasan: 'Nama terlalu pendek' });
        return;
      }

      var kol = _petakanKolomImpor(kolom);

      /* Sandi guru diperiksa SEKARANG juga — bukan setelah separuh
         baris ditolak saat impor sebenarnya. */
      if (kol.password) {
        var pesanPwd = Util.periksaPassword(kol.password);
        if (pesanPwd) {
          masalah.push({ baris: i + 1, teks: b,
                         alasan: nama + ' — ' + pesanPwd });
          return;
        }
      }

      var diminta = Util.normalisasiUsername(kol.username || _usernameDari(nama));
      var username = diminta, n = 1, diubah = false;
      while (adaUsername[username] || dipakaiDiBatch[username]) {
        username = diminta + (++n);
        diubah = true;
      }
      dipakaiDiBatch[username] = true;

      siap.push({
        baris: i + 1,
        nama: nama.slice(0, 100),
        rombel: _normRombel(kol.rombel),
        username: username,
        diminta: diminta,
        diubah: diubah,
        sandi_sendiri: !!kol.password,
        catatan: diubah ? 'Nama pengguna "' + diminta + '" sudah dipakai' : ''
      });
    });

    return {
      total: baris.length,
      siap: siap,
      masalah: masalah,
      jml_diubah: siap.filter(function (x) { return x.diubah; }).length
    };
  }

  /**
   * Impor murid dari teks tempelan (maks 100 baris).
   * Sandi acak untuk baris tanpa password; sandi kustom guru dipakai
   * apa adanya dan TIDAK dipaksa ganti (v1.6.4). Dedupe username:
   * bentrok → akhiran angka (budi, budi2, budi3 …).
   */
  function impor(sesi, teks) {
    var baris = _pecahBaris(teks);
    if (!baris.length) throw _err('VALIDASI_GAGAL', 'Tidak ada data untuk diimpor.');
    if (baris.length > 100) {
      throw _err('VALIDASI_GAGAL', 'Maksimal 100 murid sekali impor.');
    }

    var adaUsername = {};
    Db.baca('Users').forEach(function (u) { adaUsername[u.username] = true; });

    var barisBaru = [], hasil = [], gagal = [];
    var now = Util.sekarang();

    baris.forEach(function (b, i) {
      var bagian = _pecahKolom(b);
      var nama = bagian[0];
      if (!nama || nama.length < 2) {
        gagal.push('Baris ' + (i + 1) + ': nama tidak sah');
        return;
      }

      var kol = _petakanKolomImpor(bagian);

      /* Sandi guru divalidasi dengan aturan yang SAMA seperti saat
         murid mengganti sendiri — baris tak memenuhi DITOLAK, bukan
         diam-diam diganti sandi acak. */
      var pwd, wajibGanti;
      if (kol.password) {
        var pesan = Util.periksaPassword(kol.password);
        if (pesan) {
          gagal.push('Baris ' + (i + 1) + ' (' + nama + '): ' + pesan);
          return;
        }
        pwd = kol.password;
        wajibGanti = false;
      } else {
        pwd = Util.passwordSementara();
        wajibGanti = true;
      }

      var username = Util.normalisasiUsername(kol.username || _usernameDari(nama));
      var asli = username, n = 1;
      while (adaUsername[username]) { username = asli + (++n); }
      adaUsername[username] = true;

      var salt = Util.buatSalt();
      var uid = Util.buatId('USR');
      var rombel = _normRombel(kol.rombel);

      barisBaru.push({
        user_id: uid, username: username,
        password_hash: Util.hashPassword(pwd, salt), salt: salt,
        pwd_awal: pwd,
        nama: nama.slice(0, 100), role: 'murid',
        rombel: rombel, email: '', nisn: '', no_wa: '',
        status: 'aktif', harus_ganti_password: wajibGanti,
        last_login: '', created_at: now, updated_at: now
      });
      hasil.push({ nama: nama, username: username, password: pwd,
                   rombel: rombel, user_id: uid,
                   sandi_sendiri: !wajibGanti });
    });

    if (barisBaru.length) Db.tambah('Users', barisBaru);

    Util.catatLog(sesi.user_id, 'impor_murid',
                  barisBaru.length + ' murid (' + gagal.length + ' gagal)',
                  'ok', sesi.role, 'Users', '');

    return {
      hasil: hasil,
      gagal: gagal,
      jml_baru: barisBaru.length,
      jml_gagal: gagal.length
    };
  }

  return {
    daftar: daftar,
    detail: detail,
    simpan: simpan,
    pratinjauImpor: pratinjauImpor,
    impor: impor
  };
})();
