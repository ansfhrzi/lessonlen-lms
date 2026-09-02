/**
 * ============================================================
 *  LMS v2 — Kelas.gs
 *  CRUD kelas, murid, enrollment — port dari v1 (Tahap 3)
 * ------------------------------------------------------------
 *  Keputusan v2.1:
 *   - sheet Classes/Enrollment (proses enrollment sama seperti v1)
 *   - role guru = admin; murid hanya melihat kelas yang diikuti
 *   - soft delete: kelas diarsipkan, tidak dihapus berantai
 * ============================================================
 */

var Kelas = (function () {

  /* ==================================================== KELAS */

  /**
   * Daftar kelas + jumlah murid aktif + jumlah mapel (dari
   * Teaching_Assignments). Default: hanya kelas aktif.
   */
  function daftar(hanyaAktif) {
    var enroll = Db.saring('Enrollment', { status: 'aktif' });
    var muridPerKelas = {};
    enroll.forEach(function (e) {
      muridPerKelas[e.class_id] = (muridPerKelas[e.class_id] || 0) + 1;
    });

    var mapelPerKelas = {};
    Db.bacaKolom('Teaching_Assignments',
                 ['teaching_assignment_id', 'class_id', 'status'])
      .forEach(function (t) {
        if (t.status !== 'aktif') return;
        mapelPerKelas[t.class_id] = (mapelPerKelas[t.class_id] || 0) + 1;
      });

    return Db.baca('Classes')
      .filter(function (k) {
        return hanyaAktif === false ? true : k.status !== 'arsip';
      })
      .map(function (k) {
        return {
          class_id: k.class_id,
          name: k.name,
          academic_year: k.academic_year || '',
          jml_murid: muridPerKelas[k.class_id] || 0,
          jml_mapel: mapelPerKelas[k.class_id] || 0,
          status: k.status
        };
      })
      .sort(function (a, b) { return _bandingAlami(a.name, b.name); });
  }

  function detail(classId) {
    var k = Db.cari('Classes', 'class_id', classId);
    if (!k) throw _err('TIDAK_DITEMUKAN', 'Kelas tidak ditemukan.');
    delete k._baris;
    return k;
  }

  /**
   * Buat/ubah kelas. Edit parsial aman: hanya kolom yang dikirim
   * yang diperbarui.
   */
  function simpan(sesi, p) {
    if (Util.kosong(p.name)) {
      throw _err('VALIDASI_GAGAL', 'Nama kelas wajib diisi.');
    }
    var tahun = String(p.academic_year || '').trim();
    if (tahun && !/^\d{4}\/\d{4}$/.test(tahun)) {
      throw _err('VALIDASI_GAGAL', 'Tahun ajaran bertulis 2026/2027.');
    }

    var isi = Util.isiBilaAda({}, p, {
      name:          Util.teks(100),
      academic_year: Util.teks(20),
      status:        Util.teks(10)
    });

    if (p.class_id) {
      var ada = Db.cari('Classes', 'class_id', p.class_id);
      if (!ada) throw _err('TIDAK_DITEMUKAN', 'Kelas tidak ditemukan.');
      isi.updated_at = Util.sekarang();
      Db.perbarui('Classes', ada._baris, isi);
      Util.catatLog(sesi.user_id, 'UPDATE', 'edit_kelas', 'ok',
                    sesi.role, 'Classes', p.class_id);
      return { class_id: p.class_id, baru: false };
    }

    isi.class_id = Util.buatId('KLS');
    isi.status = isi.status || 'aktif';
    isi.created_at = Util.sekarang();
    isi.updated_at = isi.created_at;
    Db.tambah('Classes', isi);
    Util.catatLog(sesi.user_id, 'CREATE', 'buat_kelas ' + isi.class_id +
                  ' ' + isi.name, 'ok', sesi.role, 'Classes', isi.class_id);
    return { class_id: isi.class_id, baru: true };
  }

  /** Arsipkan / aktifkan kembali kelas (soft delete). */
  function ubahStatus(sesi, classId, status) {
    if (['aktif', 'arsip'].indexOf(status) === -1) {
      throw _err('VALIDASI_GAGAL', 'Status tidak sah.');
    }
    var k = Db.cari('Classes', 'class_id', classId);
    if (!k) throw _err('TIDAK_DITEMUKAN', 'Kelas tidak ditemukan.');

    Db.perbarui('Classes', k._baris,
                { status: status, updated_at: Util.sekarang() });
    Util.catatLog(sesi.user_id, 'UPDATE', 'kelas_' + status, 'ok',
                  sesi.role, 'Classes', classId);
    return { class_id: classId, status: status };
  }

  /* ==================================================== MURID */

  /**
   * Daftar seluruh murid + kelas yang diikuti + biodata.
   * Filter: { cari, rombel, status, class_id }
   */
  function daftarMurid(filter) {
    var enroll = Db.saring('Enrollment', { status: 'aktif' });
    var petaKelas = {};
    Db.bacaKolom('Classes', ['class_id', 'name'])
      .forEach(function (k) { petaKelas[k.class_id] = k; });

    var kelasPerMurid = {};
    enroll.forEach(function (e) {
      var k = petaKelas[e.class_id];
      (kelasPerMurid[e.user_id] = kelasPerMurid[e.user_id] || [])
        .push({ class_id: e.class_id, nama: k ? k.name : '?' });
    });

    var hasil = Db.saring('Users', { role: 'murid' }).map(function (u) {
      var kl = kelasPerMurid[u.user_id] || [];
      return {
        user_id: u.user_id,
        username: u.username,
        nama: u.nama,
        rombel: u.rombel || '',
        email: u.email || '',
        nisn: String(u.nisn || ''),
        no_wa: String(u.no_wa || ''),
        biodata_lengkap: Util.biodataLengkap(u),
        status: u.status,
        harus_ganti_password: u.harus_ganti_password === true,
        last_login: u.last_login ? Util.formatTanggal(u.last_login) : '',
        kelas: kl,
        /* sandi sementara hanya tampil selama belum diganti murid */
        pwd_awal: u.pwd_awal || '',
        sudah_ganti: !u.pwd_awal
      };
    });

    if (filter && filter.cari) {
      var q = String(filter.cari).toLowerCase();
      hasil = hasil.filter(function (m) {
        return String(m.nama).toLowerCase().indexOf(q) !== -1 ||
               String(m.username).toLowerCase().indexOf(q) !== -1 ||
               String(m.rombel).toLowerCase().indexOf(q) !== -1;
      });
    }
    if (filter && filter.rombel) {
      var r = filter.rombel === '__none__' ? '' : _normRombel(filter.rombel);
      hasil = hasil.filter(function (m) { return (m.rombel || '') === r; });
    }
    if (filter && filter.status) {
      hasil = hasil.filter(function (m) { return m.status === filter.status; });
    }
    if (filter && filter.class_id) {
      hasil = hasil.filter(function (m) {
        return m.kelas.some(function (k) {
          return k.class_id === filter.class_id; });
      });
    }

    return hasil.sort(function (a, b) { return _bandingAlami(a.nama, b.nama); });
  }

  /**
   * Tambah/edit murid. Edit parsial: kolom yang tidak dikirim
   * tidak disentuh; guru boleh mengosongkan biodata murid.
   */
  function simpanMurid(sesi, p) {
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

      var ubah = Util.isiBilaAda({}, p, {
        nama:   Util.teks(100),
        rombel: _normRombel,
        email:  function (v) {
          return String(v || '').trim().toLowerCase().slice(0, 100);
        },
        nisn:   function (v) {
          var s = String(v || '').trim();
          if (s && !Util.nisnSah(s)) {
            throw _err('VALIDASI_GAGAL', 'NISN hanya boleh angka (4–20 digit).');
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
      ubah.updated_at = Util.sekarang();
      Db.perbarui('Users', u._baris, ubah);
      if (ubah.status === 'nonaktif') Auth._hapusSesiUser(p.user_id);
      Util.catatLog(sesi.user_id, 'UPDATE', 'edit_murid ' + p.user_id, 'ok',
                    sesi.role, 'Users', p.user_id);
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
      no_wa: '',
      status: 'aktif',
      harus_ganti_password: true,
      last_login: '',
      created_at: Util.sekarang(),
      updated_at: Util.sekarang()
    };
    Db.tambah('Users', baru);

    if (p.class_id) {
      try { enroll(sesi, p.class_id, [baru.user_id]); } catch (e) {}
    }

    Util.catatLog(sesi.user_id, 'CREATE', 'buat_murid ' + baru.user_id +
                  ' ' + username, 'ok', sesi.role, 'Users', baru.user_id);
    return { user_id: baru.user_id, username: username,
             password_sementara: pwd, baru: true };
  }

  /* ==================================================== IMPOR */

  /** Uji impor tanpa menulis apa pun — pratinjau di layar. */
  function pratinjauImpor(teks) {
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
   * Impor murid dari teks tempelan.
   * Format: nama, rombel, username, password (rombel/username/password opsional).
   * Rombel hanyalah LABEL — pendaftaran kelas tetap lewat parameter classId.
   */
  function imporMurid(sesi, classId, teks) {
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

      /* Sandi dari guru divalidasi dengan aturan yang SAMA seperti
         saat murid menggantinya sendiri. Baris yang tidak memenuhi
         DITOLAK, bukan diam-diam diganti sandi acak. */
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

    if (!barisBaru.length) {
      throw _err('VALIDASI_GAGAL',
        'Tidak ada baris yang sah.' +
        (gagal.length ? ' ' + gagal[0] : ''));
    }

    Db.tambah('Users', barisBaru);      /* satu operasi tulis */

    if (classId) {
      enroll(sesi, classId, hasil.map(function (h) { return h.user_id; }));
    }

    Util.catatLog(sesi.user_id, 'CREATE', 'impor_murid ' + hasil.length +
                  ' murid ke ' + (classId || '-'), 'ok', sesi.role);
    return { berhasil: hasil.length, gagal: gagal, daftar: hasil };
  }

  /* ==================================================== ENROLLMENT */

  /** Murid yang terdaftar aktif di satu kelas. */
  function muridDiKelas(classId) {
    var enroll = Db.saring('Enrollment', { class_id: classId, status: 'aktif' });
    var peta = {};
    Db.baca('Users').forEach(function (u) { peta[u.user_id] = u; });

    return enroll.map(function (e) {
      var u = peta[e.user_id] || {};
      return {
        enroll_id: e.enroll_id,
        user_id: e.user_id,
        nama: u.nama || '(tidak dikenal)',
        username: u.username || '',
        status_akun: u.status || '',
        pwd_awal: u.pwd_awal || '',
        sudah_ganti: !u.pwd_awal,
        tanggal_daftar: Util.formatTanggal(e.tanggal_daftar)
      };
    }).sort(function (a, b) { return _bandingAlami(a.nama, b.nama); });
  }

  /**
   * Daftarkan murid ke kelas (proses sama seperti v1):
   * - belum terdaftar → baris baru status aktif
   * - pernah keluar   → baris lama diaktifkan kembali
   * - sudah aktif     → dilewati (tidak pernah duplikat)
   * + notifikasi enroll_kelas
   */
  function enroll(sesi, classId, userIds) {
    var kls = Db.cariCepat('Classes', 'class_id', classId);
    if (!kls) throw _err('TIDAK_DITEMUKAN', 'Kelas tidak ditemukan.');
    if (!userIds || !userIds.length) {
      throw _err('VALIDASI_GAGAL', 'Pilih minimal satu murid.');
    }

    var sudah = {};
    Db.saringBaris('Enrollment', 'class_id', classId,
      ['enroll_id', 'user_id', 'status']).forEach(function (e) {
        sudah[e.user_id] = e;
      });

    var now = Util.sekarang();
    var baru = [], aktifkanLagi = [];

    userIds.forEach(function (uid) {
      var ada = sudah[uid];
      if (ada) {
        if (ada.status !== 'aktif') {
          aktifkanLagi.push({ _baris: ada._baris, status: 'aktif',
                              tanggal_daftar: now });
        }
        return;
      }
      baru.push({
        enroll_id: Util.buatId('ENR'), class_id: classId, user_id: uid,
        tanggal_daftar: now, status: 'aktif'
      });
    });

    if (baru.length)         Db.tambah('Enrollment', baru);
    if (aktifkanLagi.length) Db.perbaruiBanyak('Enrollment', aktifkanLagi);

    var total = baru.length + aktifkanLagi.length;
    if (total) {
      Notif.kirim(userIds, 'enroll_kelas',
                  'Anda didaftarkan ke kelas ' + kls.name + '.',
                  '#/kelas-saya/' + classId);
      Util.catatLog(sesi.user_id, 'CREATE', 'enroll ' + total +
                    ' murid ke ' + classId, 'ok', sesi.role,
                    'Enrollment', classId);
    }
    return { ditambah: baru.length, diaktifkan: aktifkanLagi.length };
  }

  /** Keluarkan murid dari kelas — status baris jadi 'keluar'. */
  function keluarkan(sesi, classId, userId) {
    var e = null;
    Db.saring('Enrollment', { class_id: classId, user_id: userId })
      .forEach(function (r) { e = r; });
    if (!e) throw _err('TIDAK_DITEMUKAN', 'Murid tidak terdaftar di kelas ini.');

    Db.perbarui('Enrollment', e._baris, { status: 'keluar' });
    Util.catatLog(sesi.user_id, 'UPDATE', 'keluarkan_murid ' + userId +
                  ' dari ' + classId, 'ok', sesi.role, 'Enrollment', e.enroll_id);
    return { dikeluarkan: true };
  }

  /**
   * Murid aktif yang BELUM terdaftar di kelas ini — kandidat
   * pendaftaran. Nama murid tidak unik, karena itu kelas lain yang
   * sudah diikuti ikut disertakan.
   */
  function muridTersedia(classId) {
    var terdaftar = {};
    var kelasLain = {};

    /* satu pemindaian Enrollment untuk DUA keperluan */
    Db.saring('Enrollment', { status: 'aktif' }).forEach(function (e) {
      if (e.class_id === classId) terdaftar[e.user_id] = true;
      (kelasLain[e.user_id] = kelasLain[e.user_id] || []).push(e.class_id);
    });

    var namaKelas = {};
    Db.bacaKolom('Classes', ['class_id', 'name'])
      .forEach(function (k) { namaKelas[k.class_id] = k; });

    return Db.saring('Users', { role: 'murid', status: 'aktif' })
      .filter(function (u) { return !terdaftar[u.user_id]; })
      .map(function (u) {
        var daftar = (kelasLain[u.user_id] || [])
          .map(function (id) {
            var k = namaKelas[id];
            return k ? { class_id: id, nama: k.name } : null;
          })
          .filter(function (x) { return !!x; })
          .sort(function (a, b) { return _bandingAlami(a.nama, b.nama); });

        return { user_id: u.user_id, nama: u.nama, username: u.username,
                 rombel: u.rombel || '', kelas: daftar };
      })
      .sort(function (a, b) { return _bandingAlami(a.nama, b.nama); });
  }

  /* ==================================================== KELAS SAYA (murid) */

  /**
   * Kelas aktif yang diikuti murid + daftar mapel di tiap kelas.
   * Untuk guru: kelas aktif yang memiliki teaching assignment miliknya.
   */
  function kelasSaya(sesi) {
    var petaKelas = {};
    Db.bacaKolom('Classes', ['class_id', 'name', 'academic_year', 'status'])
      .forEach(function (k) {
        if (k.status !== 'arsip') petaKelas[k.class_id] = k;
      });

    var petaMapel = {};
    Db.bacaKolom('Subjects', ['subject_id', 'name', 'status'])
      .forEach(function (s) { petaMapel[s.subject_id] = s; });

    var petaGuru = {};
    Db.bacaKolom('Users', ['user_id', 'nama'])
      .forEach(function (u) { petaGuru[u.user_id] = u; });

    var idKelas = {};
    if (sesi.role === 'murid') {
      Db.saring('Enrollment', { user_id: sesi.user_id, status: 'aktif' })
        .forEach(function (e) {
          if (petaKelas[e.class_id]) idKelas[e.class_id] = true;
        });
    } else {
      Db.saring('Teaching_Assignments', { teacher_id: sesi.user_id })
        .forEach(function (t) {
          if (petaKelas[t.class_id]) idKelas[t.class_id] = true;
        });
    }

    /* mapel per kelas dari Teaching_Assignments aktif */
    var mapelPerKelas = {};
    Db.baca('Teaching_Assignments').forEach(function (t) {
      if (t.status !== 'aktif' || !idKelas[t.class_id]) return;
      var s = petaMapel[t.subject_id];
      var g = petaGuru[t.teacher_id];
      (mapelPerKelas[t.class_id] = mapelPerKelas[t.class_id] || [])
        .push({ subject_id: t.subject_id,
                ta_id: t.teaching_assignment_id,
                nama: s ? s.name : '(mapel dihapus)',
                guru: g ? g.nama : '' });
    });

    return Object.keys(idKelas).map(function (cid) {
      var k = petaKelas[cid];
      return {
        class_id: cid,
        name: k.name,
        academic_year: k.academic_year || '',
        mapel: (mapelPerKelas[cid] || []).sort(function (a, b) {
          return _bandingAlami(a.nama, b.nama);
        })
      };
    }).sort(function (a, b) { return _bandingAlami(a.name, b.name); });
  }

  /* ==================================================== BIODATA MURID */

  /**
   * Murid melengkapi biodata sendiri — aturan lebih ketat daripada
   * edit oleh guru: email & WA wajib sah, tidak boleh kosong.
   */
  function simpanBiodata(sesi, p) {
    var u = Db.cari('Users', 'user_id', sesi.user_id);
    if (!u) throw _err('TIDAK_DITEMUKAN', 'Pengguna tidak ditemukan.');

    var email = String(p.email || '').trim().toLowerCase().slice(0, 100);
    if (!Util.emailSah(email)) {
      throw _err('VALIDASI_GAGAL', 'Email belum benar. Contoh: nama@contoh.id');
    }
    var wa = Util.normalisasiWa(p.no_wa);
    if (!wa) {
      throw _err('VALIDASI_GAGAL',
        'Nomor WhatsApp belum benar. Contoh: 081234567890');
    }
    var nisn = String(p.nisn || '').trim();
    if (!Util.nisnSah(nisn)) {
      throw _err('VALIDASI_GAGAL', 'NISN hanya boleh angka (4–20 digit).');
    }

    Db.perbarui('Users', u._baris,
                { email: email, no_wa: wa, nisn: nisn,
                  updated_at: Util.sekarang() });
    Util.catatLog(sesi.user_id, 'UPDATE', 'simpan_biodata', 'ok', sesi.role);
    return { berhasil: true };
  }

  /* ==================================================== BANTU */

  function _err(kode, pesan) {
    var e = new Error(pesan);
    e.kode = kode;
    return e;
  }

  /** Rombel = LABEL bebas pada murid — dirapikan agar filter menyatu. */
  function _normRombel(v) {
    return String(v == null ? '' : v)
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase()
      .slice(0, 40);
  }

  /** Bandingkan teks dengan angka diurut sebagai angka ("Kelas 2" < "Kelas 10"). */
  function _bandingAlami(a, b) {
    var ra = String(a == null ? '' : a).match(/(\d+|\D+)/g) || [];
    var rb = String(b == null ? '' : b).match(/(\d+|\D+)/g) || [];
    for (var i = 0; i < Math.min(ra.length, rb.length); i++) {
      var pa = ra[i], pb = rb[i];
      var na = /^\d+$/.test(pa), nb = /^\d+$/.test(pb);
      if (na && nb) {
        var d = Number(pa) - Number(pb);
        if (d !== 0) return d;
      } else {
        var c = pa.localeCompare(pb, 'id', { sensitivity: 'base' });
        if (c !== 0) return c;
      }
    }
    return ra.length - rb.length;
  }

  function _pecahBaris(teks) {
    return String(teks || '').split(/\r?\n/)
      .map(function (b) { return b.trim(); })
      .filter(function (b) { return b.length > 0; });
  }

  /**
   * Pisahkan kolom: tab, titik koma, koma, atau pipa.
   * Nomor urut di awal baris dibuang — daftar dari Word/Excel
   * hampir selalu memuatnya.
   */
  function _pecahKolom(b) {
    var t = String(b).trim();

    /* "1. Budi" / "12) Budi" / "3 Budi" */
    t = t.replace(/^\d{1,3}\s*[.)\-]\s+/, '')
         .replace(/^\d{1,3}\s{2,}/, '');

    var k = t.split(/[\t;,|]/).map(function (x) { return x.trim(); });

    /* "1<TAB>Budi<TAB>budi" — nomor urut sebagai kolom tersendiri */
    if (k.length > 1 && /^\d{1,3}[.)]?$/.test(k[0])) k.shift();

    return k.filter(function (x, i) { return i === 0 || x !== ''; });
  }

  /**
   * Arti tiap kolom setelah nama.
   * Format baru : nama, rombel, username, password
   * Format lama : nama, username
   * Pembeda bentuk 2 kolom: rombel hampir selalu berspasi,
   * username tidak pernah.
   */
  function _petakanKolomImpor(bagian) {
    var k2 = bagian[1] || '';
    var k3 = bagian[2] || '';
    var k4 = bagian[3] || '';

    if (k3) return { rombel: k2, username: k3, password: k4 };
    if (k2 && /\s/.test(k2.trim())) return { rombel: k2, username: '', password: '' };
    return { rombel: '', username: k2, password: '' };
  }

  function _usernameDari(nama) {
    var bersih = String(nama).toLowerCase()
      .replace(/[^a-z0-9\s]/g, '').trim().split(/\s+/);
    return (bersih[0] || 'murid') + (bersih[1] ? bersih[1].charAt(0) : '');
  }

  return {
    daftar: daftar, detail: detail, simpan: simpan, ubahStatus: ubahStatus,
    daftarMurid: daftarMurid, simpanMurid: simpanMurid,
    pratinjauImpor: pratinjauImpor, imporMurid: imporMurid,
    muridDiKelas: muridDiKelas, enroll: enroll, keluarkan: keluarkan,
    muridTersedia: muridTersedia, kelasSaya: kelasSaya,
    simpanBiodata: simpanBiodata
  };
})();
