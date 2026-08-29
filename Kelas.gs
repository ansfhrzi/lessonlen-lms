/**
 * ============================================================
 *  LessonLen — Kelas.gs
 *  CRUD kelas, murid, enrollment
 * ------------------------------------------------------------
 *  Acuan: KESEPAKATAN-SISTEM.md v4.6 §4.2, §11.2, §11.3
 * ============================================================
 */

var Kelas = (function () {

  var JENJANG = ['SD','SMP','SMA','SMK'];
  var FASE    = ['A','B','C','D','E','F'];

  /* ==================================================== KELAS */

  function daftar() {
    var pertemuan = Db.baca('pertemuan');
    var enroll    = Db.saring('enrollment', { status: 'aktif' });

    return Db.baca('kelas')
      .filter(function (k) { return k.status !== 'arsip'; })
      .map(function (k) {
        return {
          kelas_id: k.kelas_id,
          nama_kelas: k.nama_kelas,
          mapel: k.mapel,
          jenjang: k.jenjang,
          fase: k.fase,
          tingkat: k.tingkat,
          kompetensi_keahlian: k.kompetensi_keahlian,
          jml_murid: enroll.filter(function (e) {
            return e.kelas_id === k.kelas_id; }).length,
          jml_pertemuan: pertemuan.filter(function (p) {
            return p.kelas_id === k.kelas_id; }).length,
          status: k.status
        };
      })
      .sort(function (a, b) {
        return _bandingAlami(a.nama_kelas, b.nama_kelas);
      });
  }

  /**
   * Bandingkan teks dengan angka diurut sebagai angka.
   * "XI TJKT 2" harus datang sebelum "XI TJKT 10", bukan sesudahnya.
   */
  /**
   * Rapikan label rombel.
   *
   * Rombel adalah LABEL BEBAS pada murid — bukan entitas, bukan
   * enrollment. Gunanya menyaring daftar murid saat mendaftarkan
   * satu rombongan ke kelas-mapel.
   *
   * Karena bebas diketik, "XII TKJ 1" / "xii tkj 1" / "XII  TKJ  1"
   * akan menjadi tiga rombel berbeda dan filternya pecah. Spasi
   * dirapatkan dan huruf dibesarkan supaya ketiganya menyatu.
   */
  function _normRombel(v) {
    return String(v == null ? '' : v)
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase()
      .slice(0, 40);
  }

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

  function detail(kelasId) {
    var k = Db.cari('kelas', 'kelas_id', kelasId);
    if (!k) throw _err('TIDAK_DITEMUKAN', 'Kelas tidak ditemukan.');
    delete k._baris;
    return k;
  }

  function simpan(sesi, p) {
    if (Util.kosong(p.nama_kelas)) {
      throw _err('VALIDASI_GAGAL', 'Nama kelas wajib diisi.');
    }
    if (Util.kosong(p.mapel)) {
      throw _err('VALIDASI_GAGAL', 'Mata pelajaran wajib diisi.');
    }
    if (p.jenjang && JENJANG.indexOf(p.jenjang) === -1) {
      throw _err('VALIDASI_GAGAL', 'Jenjang tidak sah.');
    }
    if (p.fase && FASE.indexOf(p.fase) === -1) {
      throw _err('VALIDASI_GAGAL', 'Fase tidak sah.');
    }

    /* hanya kolom yang dikirim yang diperbarui — cegah edit parsial
       menghapus data yang sudah tersimpan */
    var isi = Util.isiBilaAda({}, p, {
      nama_kelas:          Util.teks(100),
      mapel:               Util.teks(200),
      jenjang:             Util.teks(10),
      fase:                Util.teks(5),
      tingkat:             Util.teks(10),
      kompetensi_keahlian: Util.teks(200),
      capaian_pembelajaran: Util.teks(5000),
      catatan_gaya:        Util.teks(500),
      alokasi_jp:          function (v) { return v === '' ? '' : Util.angka(0)(v); },
      status:              Util.teks(10)
    });

    if (p.kelas_id) {
      var ada = Db.cari('kelas', 'kelas_id', p.kelas_id);
      if (!ada) throw _err('TIDAK_DITEMUKAN', 'Kelas tidak ditemukan.');
      Db.perbarui('kelas', ada._baris, isi);
      Util.catatLog(sesi.user_id, 'edit_kelas', p.kelas_id);
      return { kelas_id: p.kelas_id, baru: false };
    }

    /* nilai bawaan untuk kelas baru */
    ['jenjang','fase','tingkat','kompetensi_keahlian',
     'capaian_pembelajaran','catatan_gaya','alokasi_jp'].forEach(function (k) {
      if (isi[k] === undefined) isi[k] = '';
    });
    if (isi.status === undefined) isi.status = 'aktif';

    isi.kelas_id = Util.buatId('KLS');
    isi.created_at = Util.sekarang();
    Db.tambah('kelas', isi);
    Util.catatLog(sesi.user_id, 'buat_kelas', isi.kelas_id + ' ' + isi.nama_kelas);
    return { kelas_id: isi.kelas_id, baru: true };
  }

  /** Hapus kelas beserta seluruh turunannya. */
  function hapus(sesi, kelasId) {
    var k = Db.cari('kelas', 'kelas_id', kelasId);
    if (!k) throw _err('TIDAK_DITEMUKAN', 'Kelas tidak ditemukan.');

    var jml = { materi_pokok: 0, pertemuan: 0, item: 0,
                progress: 0, enrollment: 0 };

    /* soal tidak punya kolom kelas_id, jadi id item dikumpulkan dahulu
       SEBELUM barisnya dihapus */
    var idItem = Db.saringBaris('item', 'kelas_id', kelasId, ['item_id'])
      .map(function (i) { return i.item_id; });

    /* saringBaris, bukan Db.saring: yang terakhir memindahkan seluruh
       sheet (pada `progress` 32.400 baris = ratusan ribu sel) hanya
       untuk menemukan baris satu kelas. */
    ['progress','quiz_attempt','lkpd_submission','kelompok','materi_ai',
     'item','pertemuan','materi_pokok','enrollment'].forEach(function (sheet) {
      var baris = Db.saringBaris(sheet, 'kelas_id', kelasId, ['kelas_id'])
        .map(function (r) { return r._baris; });
      if (baris.length) {
        Db.hapusBanyak(sheet, baris);
        if (jml[sheet] !== undefined) jml[sheet] = baris.length;
      }
    });

    /* soal mengikuti item yang barusan terhapus */
    var barisSoal = Db.saringBarisBanyak('soal', 'item_id', idItem, ['item_id'])
      .map(function (r) { return r._baris; });
    if (barisSoal.length) Db.hapusBanyak('soal', barisSoal);

    Db.hapus('kelas', Db.cari('kelas', 'kelas_id', kelasId)._baris);
    Util.catatLog(sesi.user_id, 'hapus_kelas',
                  kelasId + ' ' + k.nama_kelas + ' ' + JSON.stringify(jml));
    return { terhapus: true, rincian: jml };
  }

  /* ==================================================== MURID */

  function daftarMurid(filter) {
    var enroll = Db.saring('enrollment', { status: 'aktif' });
    /* MAPEL wajib ikut: satu rombel bisa punya beberapa kelas-mapel
       bernama sama, dan tanpa mapelnya kolom "Kelas-Mapel" hanya
       menampilkan "XII TKJ 1" dua kali (laporan v1.6.5). */
    var petaKelas = {};
    Db.bacaKolom('kelas', ['kelas_id', 'nama_kelas', 'mapel'])
      .forEach(function (k) { petaKelas[k.kelas_id] = k; });

    var kelasPerMurid = {};
    enroll.forEach(function (e) {
      var k = petaKelas[e.kelas_id];
      (kelasPerMurid[e.user_id] = kelasPerMurid[e.user_id] || [])
        .push({ kelas_id: e.kelas_id,
                nama: k ? k.nama_kelas : '?',
                mapel: k ? (k.mapel || '') : '' });
    });

    var hasil = Db.saring('users', { role: 'murid' }).map(function (u) {
      var kl = kelasPerMurid[u.user_id] || [];
      return {
        user_id: u.user_id,
        username: u.username,
        nama: u.nama,
        rombel: u.rombel || '',
        /* Biodata (v1.11.0) — ikut di daftar supaya layar Kelola Murid
           dapat menampilkan kolomnya tanpa panggilan tambahan.
           `lengkap` dihitung, bukan disimpan (lihat Util.biodataLengkap). */
        email: u.email || '',
        nisn: String(u.nisn || ''),
        no_wa: String(u.no_wa || ''),
        biodata_lengkap: Util.biodataLengkap(u),
        status: u.status,
        harus_ganti_password: u.harus_ganti_password === true,
        last_login: u.last_login ? Util.formatTanggal(u.last_login) : '',
        /* `kelas` tetap larik nama demi pemakai lama; `kelas_mapel`
           membawa mapelnya untuk ditampilkan. */
        kelas: kl.map(function (k) { return k.nama; }),
        kelas_mapel: kl.map(function (k) {
          return { kelas_id: k.kelas_id, nama_kelas: k.nama, mapel: k.mapel };
        }),
        kelas_id: kl.map(function (k) { return k.kelas_id; }),
        /* sandi awal hanya ada selama murid belum menggantinya sendiri */
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
      /* '__none__' = murid yang belum diberi label rombel */
      var r = filter.rombel === '__none__' ? '' : _normRombel(filter.rombel);
      hasil = hasil.filter(function (m) { return (m.rombel || '') === r; });
    }
    if (filter && filter.status) {
      hasil = hasil.filter(function (m) { return m.status === filter.status; });
    }
    if (filter && filter.kelas_id) {
      hasil = hasil.filter(function (m) {
        return m.kelas_id.indexOf(filter.kelas_id) !== -1;
      });
    }

    return hasil.sort(function (a, b) {
      return _bandingAlami(a.nama, b.nama);
    });
  }

  function simpanMurid(sesi, p) {
    /* Nama wajib hanya saat MEMBUAT murid baru.

       Pada edit, `Util.isiBilaAda()` di bawah sengaja hanya menyentuh
       medan yang dikirim — itulah gunanya. Memaksa `nama` selalu ada
       membuat pembaruan sebagian mustahil: guru yang hanya ingin
       membetulkan nomor WA harus ikut mengirim ulang nama, dan
       pemanggil yang lupa akan ditolak dengan pesan yang membingungkan
       ("Nama wajib diisi" padahal namanya tidak diapa-apakan).

       Nama tetap tidak boleh DIKOSONGKAN — dijaga di bawah. */
    if (!p.user_id && Util.kosong(p.nama)) {
      throw _err('VALIDASI_GAGAL', 'Nama wajib diisi.');
    }
    if (p.user_id && p.nama !== undefined && Util.kosong(p.nama)) {
      throw _err('VALIDASI_GAGAL', 'Nama tidak boleh dikosongkan.');
    }

    /* ---- edit ---- */
    if (p.user_id) {
      var u = Db.cari('users', 'user_id', p.user_id);
      if (!u) throw _err('TIDAK_DITEMUKAN', 'Murid tidak ditemukan.');
      if (u.role !== 'murid') throw _err('AKSES_DITOLAK', 'Bukan akun murid.');

      /* Guru boleh membetulkan biodata murid (v1.11.0) — mis. salah
         ketik nomor WA. Aturannya SENGAJA lebih longgar daripada
         `simpanBiodata()` milik murid:

           · medan yang tidak dikirim tidak disentuh (isiBilaAda)
           · nilai kosong DIBOLEHKAN — guru perlu bisa mengosongkan
             data yang salah, sementara murid tidak boleh mengosongkan
             miliknya sendiri

         Yang tetap sama: nomor dirapikan di SERVER, supaya ekspor
         tidak pernah berisi campuran 08xx dan 62xx. */
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
      Db.perbarui('users', u._baris, ubah);
      if (ubah.status === 'nonaktif') Auth._hapusSesiUser(p.user_id);
      Util.catatLog(sesi.user_id, 'edit_murid', p.user_id);
      return { user_id: p.user_id, baru: false };
    }

    /* ---- tambah ---- */
    var username = Util.normalisasiUsername(p.username);
    if (!username) throw _err('VALIDASI_GAGAL', 'Nama pengguna wajib diisi.');
    if (username.length < 3) {
      throw _err('VALIDASI_GAGAL', 'Nama pengguna minimal 3 karakter.');
    }
    /* `Db.cari()` menyeret SELURUH sheet `users` — 13 kolom × seluruh
       murid sekolah — hanya untuk memastikan satu username belum
       dipakai. `cariCepat` memindai kolom `username` saja lalu
       mengambil satu baris.

       Inilah biaya yang paling cepat membesar: makin banyak murid
       terdaftar, makin mahal mendaftarkan murid BERIKUTNYA. Impor
       satu angkatan adalah kasus terburuknya (v1.8.9). */
    if (Db.cariCepat('users', 'username', username)) {
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
      status: 'aktif',
      harus_ganti_password: true,
      last_login: '',
      created_at: Util.sekarang()
    };
    Db.tambah('users', baru);

    if (p.kelas_id) {
      try { enroll(sesi, p.kelas_id, [baru.user_id]); } catch (e) {}
    }

    Util.catatLog(sesi.user_id, 'buat_murid', baru.user_id + ' ' + username);
    return { user_id: baru.user_id, username: username,
             password_sementara: pwd, baru: true };
  }

  /**
   * Tambah banyak murid sekaligus dari teks.
  /**
   * Uji impor tanpa menulis apa pun — untuk pratinjau di layar.
   *
   * WAJIB memakai _petakanKolomImpor() yang SAMA dengan imporMurid().
   * Sampai v1.6.5 fungsi ini masih membaca kolom[1] sebagai username,
   * sehingga "XII TKJ 2" ditampilkan sebagai nama pengguna `xiitkj2`
   * dan ketiga murid tampak bentrok. Pratinjau yang berbeda dari
   * hasil sebenarnya lebih buruk daripada tidak ada pratinjau —
   * guru membatalkan impor yang sebenarnya benar.
   */
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
    Db.baca('users').forEach(function (u) { adaUsername[u.username] = true; });

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

      /* Sandi diperiksa di sini juga, supaya guru tahu SEBELUM
         menekan Impor — bukan setelah separuh baris ditolak. */
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

  function _pecahBaris(teks) {
    return String(teks || '').split(/\r?\n/)
      .map(function (b) { return b.trim(); })
      .filter(function (b) { return b.length > 0; });
  }

  /**
   * Pisahkan kolom: tab, titik koma, koma, atau pipa.
   * Nomor urut di awal baris dibuang — daftar yang disalin dari
   * Word/Excel hampir selalu memuatnya.
   */
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

  /**
   * Impor murid dari teks tempelan.
   *
   * Format (v1.6.4):  nama, rombel, username, password
   *
   *   Budi Santoso, XII TKJ 1, budi01, budi123
   *   Citra Dewi,   XII TKJ 1            → username & password otomatis
   *   Eko Prasetyo                       → nama saja, tanpa rombel
   *
   * ROMBEL hanyalah LABEL pada murid — ia TIDAK mendaftarkan murid ke
   * kelas-mapel mana pun. Pendaftaran tetap lewat dropdown `kelasId`
   * atau panel Daftarkan Murid. Rombel dipakai untuk MENYARING daftar
   * murid supaya satu rombongan bisa dipilih sekaligus.
   *
   * PASSWORD opsional. Bila diisi, dipakai apa adanya dan murid TIDAK
   * dipaksa menggantinya (keputusan guru v1.6.4) — guru memegang
   * daftar sandinya sendiri. Bila kosong, sandi acak dibuat dan murid
   * wajib menggantinya saat login pertama, seperti sebelumnya.
   */
  function imporMurid(sesi, kelasId, teks) {
    var baris = _pecahBaris(teks);

    if (!baris.length) throw _err('VALIDASI_GAGAL', 'Tidak ada data untuk diimpor.');
    if (baris.length > 100) {
      throw _err('VALIDASI_GAGAL', 'Maksimal 100 murid sekali impor.');
    }

    var adaUsername = {};
    Db.baca('users').forEach(function (u) { adaUsername[u.username] = true; });

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

      /* Password dari guru divalidasi dengan aturan yang SAMA seperti
         saat murid menggantinya sendiri — satu aturan, satu tempat.
         Baris yang sandinya tidak memenuhi DITOLAK, bukan diam-diam
         diganti sandi acak: guru sudah memegang daftarnya, dan
         mengganti tanpa memberi tahu membuat murid tidak bisa masuk. */
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
        rombel: rombel, email: '',
        status: 'aktif', harus_ganti_password: wajibGanti,
        last_login: '', created_at: now
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

    Db.tambah('users', barisBaru);   /* satu operasi tulis */

    if (kelasId) {
      enroll(sesi, kelasId, hasil.map(function (h) { return h.user_id; }));
    }

    Util.catatLog(sesi.user_id, 'impor_murid',
                  hasil.length + ' murid ke ' + (kelasId || '-'));
    return { berhasil: hasil.length, gagal: gagal, daftar: hasil };
  }

  /**
   * Tentukan arti tiap kolom setelah nama.
   *
   * Format BARU  : nama, rombel, username, password
   * Format LAMA  : nama, username
   *
   * Keduanya harus jalan — guru punya daftar lama yang sudah
   * tersalin, dan menolaknya berarti pekerjaan terbuang.
   *
   * Pembeda pada bentuk 2 kolom: rombel hampir selalu memuat SPASI
   * ("XII TKJ 1"), sedangkan username tidak pernah — Util
   * .normalisasiUsername() membuang spasi. Jadi kolom kedua yang
   * berspasi dibaca sebagai rombel, yang tanpa spasi sebagai
   * username.
   */
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

  function _usernameDari(nama) {
    var bersih = String(nama).toLowerCase()
      .replace(/[^a-z0-9\s]/g, '').trim().split(/\s+/);
    return (bersih[0] || 'murid') + (bersih[1] ? bersih[1].charAt(0) : '');
  }

  /* ==================================================== ENROLLMENT */

  function murididKelas(kelasId) {
    var enroll = Db.saring('enrollment', { kelas_id: kelasId, status: 'aktif' });
    var peta = {};
    Db.baca('users').forEach(function (u) { peta[u.user_id] = u; });

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
    }).sort(function (a, b) {
      return _bandingAlami(a.nama, b.nama);
    });
  }

  function enroll(sesi, kelasId, userIds) {
    /* `Db.cari()` membaca SELURUH sheet `kelas`; versi lama
       memanggilnya DUA KALI (di sini dan saat menyusun notifikasi).
       Terukur di lapangan v1.8.8: mendaftarkan 36 murid memakan 166
       detik — 4,6 detik/murid. Satu pembacaan ber-cache, dipakai
       ulang (v1.8.9). */
    var kls = Db.cariBarisCache('kelas', 'kelas_id', kelasId);
    if (!kls) {
      throw _err('TIDAK_DITEMUKAN', 'Kelas tidak ditemukan.');
    }
    if (!userIds || !userIds.length) {
      throw _err('VALIDASI_GAGAL', 'Pilih minimal satu murid.');
    }

    /* `Db.saring()` menyeret seluruh sheet `enrollment`;
       `saringBaris` memindai satu kolom kunci saja. */
    var sudah = {};
    Db.saringBaris('enrollment', 'kelas_id', kelasId,
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
        enroll_id: Util.buatId('ENR'), kelas_id: kelasId, user_id: uid,
        tanggal_daftar: now, status: 'aktif'
      });
    });

    if (baru.length)         Db.tambah('enrollment', baru);
    if (aktifkanLagi.length) Db.perbaruiBanyak('enrollment', aktifkanLagi);

    var total = baru.length + aktifkanLagi.length;
    if (total) {
      var nk = kls.nama_kelas;      /* dipakai ulang, bukan baca lagi */
      Notif.kirim(userIds, 'enroll_kelas',
                  'Anda didaftarkan ke kelas ' + nk + '.',
                  '#/kelas-saya/' + kelasId);
      Util.catatLog(sesi.user_id, 'enroll', total + ' murid ke ' + kelasId);
    }
    return { ditambah: baru.length, diaktifkan: aktifkanLagi.length };
  }

  function keluarkan(sesi, kelasId, userId) {
    var e = null;
    Db.saring('enrollment', { kelas_id: kelasId, user_id: userId })
      .forEach(function (r) { e = r; });
    if (!e) throw _err('TIDAK_DITEMUKAN', 'Murid tidak terdaftar di kelas ini.');

    Db.perbarui('enrollment', e._baris, { status: 'keluar' });
    Util.catatLog(sesi.user_id, 'keluarkan_murid', userId + ' dari ' + kelasId);
    return { dikeluarkan: true };
  }

  /** Murid yang belum terdaftar di kelas tertentu. */
  /**
   * Murid yang BELUM terdaftar di kelas ini.
   *
   * Menyertakan `kelas` — daftar kelas lain yang sudah diikuti murid.
   *
   * Tanpa itu daftarnya hanya berupa nama, dan guru mustahil
   * membedakan "Ahmad" anak XII TKJ 1 dari "Ahmad" anak XII TKJ 2
   * (laporan v1.6.3). Nama murid TIDAK unik, dan username otomatis
   * juga tidak menyiratkan kelas.
   *
   * Murid tanpa kelas ditandai larik kosong — justru merekalah yang
   * paling mungkin perlu didaftarkan.
   */
  function muridTersedia(kelasId) {
    var terdaftar = {};
    var kelasLain = {};

    /* satu pemindaian enrollment untuk DUA keperluan: menyaring yang
       sudah terdaftar, sekaligus mengumpulkan kelas tiap murid */
    Db.saring('enrollment', { status: 'aktif' }).forEach(function (e) {
      if (e.kelas_id === kelasId) terdaftar[e.user_id] = true;
      (kelasLain[e.user_id] = kelasLain[e.user_id] || []).push(e.kelas_id);
    });

    var namaKelas = {};
    Db.bacaKolom('kelas', ['kelas_id', 'nama_kelas', 'mapel'])
      .forEach(function (k) { namaKelas[k.kelas_id] = k; });

    return Db.saring('users', { role: 'murid', status: 'aktif' })
      .filter(function (u) { return !terdaftar[u.user_id]; })
      .map(function (u) {
        var daftar = (kelasLain[u.user_id] || [])
          .map(function (id) {
            var k = namaKelas[id];
            return k ? { kelas_id: id, nama_kelas: k.nama_kelas,
                         mapel: k.mapel || '' } : null;
          })
          .filter(function (x) { return !!x; })
          .sort(function (a, b) {
            return _bandingAlami(a.nama_kelas, b.nama_kelas);
          });

        return { user_id: u.user_id, nama: u.nama, username: u.username,
                 rombel: u.rombel || '', kelas: daftar };
      })
      .sort(function (a, b) {
        return _bandingAlami(a.nama, b.nama);
      });
  }

  /* ==================================================== DUPLIKAT */

  /**
   * Salin satu kelas beserta pengaturannya.
   *
   * @param {boolean} ikutIsi  sertakan pertemuan, item, dan soal
   *                           (semuanya menjadi draf)
   * @param {number}  jumlah   banyaknya salinan sekaligus (1-11)
   */
  function duplikat(sesi, kelasId, namaBaru, ikutIsi, jumlah) {
    var asal = Db.cari('kelas', 'kelas_id', kelasId);
    if (!asal) throw _err('TIDAK_DITEMUKAN', 'Kelas tidak ditemukan.');

    var n = Math.max(1, Math.min(11, Number(jumlah) || 1));
    if (n === 1 && Util.kosong(namaBaru)) {
      throw _err('VALIDASI_GAGAL', 'Nama kelas baru wajib diisi.');
    }

    var adaNama = {};
    Db.baca('kelas').forEach(function (k) { adaNama[k.nama_kelas] = true; });

    var now = Util.sekarang();
    var kelasBaru = [], idBaru = [];

    for (var i = 0; i < n; i++) {
      var nama = n === 1 ? String(namaBaru).trim()
                         : _namaBerikutnya(asal.nama_kelas, adaNama);
      if (adaNama[nama]) {
        throw _err('DUPLIKAT', 'Kelas "' + nama + '" sudah ada.');
      }
      adaNama[nama] = true;

      var kid = Util.buatId('KLS');
      idBaru.push(kid);
      kelasBaru.push({
        kelas_id: kid,
        nama_kelas: nama.slice(0, 100),
        mapel: asal.mapel,
        jenjang: asal.jenjang,
        fase: asal.fase,
        tingkat: asal.tingkat,
        kompetensi_keahlian: asal.kompetensi_keahlian,
        capaian_pembelajaran: asal.capaian_pembelajaran,
        catatan_gaya: asal.catatan_gaya,
        alokasi_jp: asal.alokasi_jp,
        status: 'aktif',
        created_at: now
      });
    }

    Db.tambah('kelas', kelasBaru);          /* satu operasi tulis */

    var isi = { pertemuan: 0, item: 0, soal: 0 };
    if (ikutIsi) {
      var ptmAsal = Db.saring('pertemuan', { kelas_id: kelasId })
        .map(function (p) { return p.pertemuan_id; });
      if (ptmAsal.length) {
        /* cerminStruktur: duplikat kelas harus mewarisi pembagian bab.
           Tanpa ini seluruh Materi Pokok runtuh jadi satu di kelas baru. */
        isi = Pertemuan.salin(sesi, ptmAsal, idBaru, true);
      }
    }

    Util.catatLog(sesi.user_id, 'duplikat_kelas',
      kelasId + ' → ' + n + ' kelas' + (ikutIsi ? ' dengan isi' : ' kosong'));

    return {
      jumlah: n,
      kelas_id: idBaru,
      nama: kelasBaru.map(function (k) { return k.nama_kelas; }),
      isi: isi
    };
  }

  /** Cari nama berikutnya: "XI TJKT 1" → "XI TJKT 2" → "XI TJKT 3" … */
  function _namaBerikutnya(nama, dipakai) {
    var m = String(nama).match(/^(.*?)(\d+)(\D*)$/);
    if (!m) {
      var n = 2;
      while (dipakai[nama + ' ' + n]) n++;
      return nama + ' ' + n;
    }
    var angka = Number(m[2]) + 1;
    var kandidat = m[1] + angka + m[3];
    while (dipakai[kandidat]) {
      angka++;
      kandidat = m[1] + angka + m[3];
    }
    return kandidat;
  }

  /* ==================================================== EKSPOR */

  /**
   * Susun CSV daftar murid: nama, kelas, username, kata sandi.
   *
   * Kolom sandi berisi sandi awal bila murid belum menggantinya,
   * atau "(sudah diganti)" bila sudah — sistem memang tidak menyimpan
   * sandi yang sudah diubah murid.
   *
   * @param {string} kelasId  kosong = seluruh murid
   */
  function csvMurid(sesi, kelasId) {
    var daftar = daftarMurid(kelasId ? { kelas_id: kelasId } : {});

    var judul = kelasId
      ? (Db.cari('kelas', 'kelas_id', kelasId) || {}).nama_kelas || 'Kelas'
      : 'Semua Murid';

    var baris = [['No', 'Nama', 'Rombel', 'Kelas-Mapel', 'Nama Pengguna',
                  'Kata Sandi', 'Status', 'Terakhir Masuk']];

    daftar.forEach(function (m, i) {
      baris.push([
        i + 1,
        m.nama,
        m.rombel || '',
        /* mapel ikut: satu rombel bisa punya beberapa kelas-mapel
           bernama sama (v1.6.5) */
        (m.kelas_mapel || []).map(function (k) {
          return k.nama_kelas + (k.mapel ? ' · ' + k.mapel : '');
        }).join(', '),
        m.username,
        m.sudah_ganti ? '(sudah diganti)' : m.pwd_awal,
        m.status,
        m.last_login || '-'
      ]);
    });

    Util.catatLog(sesi.user_id, 'ekspor_murid',
                  judul + ' (' + daftar.length + ' murid)');

    return {
      nama_berkas: ('Murid_' + judul + '_' + _tanggalBerkas())
                     .replace(/[^a-zA-Z0-9_\-]+/g, '_')
                     .replace(/_+/g, '_') + '.csv',
      judul: judul,
      jumlah: daftar.length,
      csv: baris.map(function (r) {
        return r.map(_selCsv).join(',');
      }).join('\r\n')
    };
  }

  /**
   * Ekspor biodata sekelas — CSV (v1.11.0).
   *
   * Terpisah dari `csvMurid()` yang berisi kata sandi. Berkas biodata
   * sering dibagikan atau dibuka di ponsel; menyertakan sandi di
   * dalamnya adalah kebocoran yang menunggu terjadi.
   *
   * Nomor WA disajikan dua kali dengan sengaja:
   *   `no_wa`   — bentuk baku 62… untuk disalin
   *   `tautan`  — https://wa.me/62… yang langsung dapat diklik
   */
  function csvBiodata(sesi, kelasId) {
    var daftar = daftarMurid(kelasId ? { kelas_id: kelasId } : {});

    var judul = kelasId
      ? (Db.cari('kelas', 'kelas_id', kelasId) || {}).nama_kelas || 'Kelas'
      : 'Semua Murid';

    var baris = [['No', 'Nama', 'Rombel', 'Kelas-Mapel', 'NISN', 'Email',
                  'No. WhatsApp', 'Tautan WhatsApp', 'Kelengkapan']];

    var lengkap = 0;
    daftar.forEach(function (m, i) {
      if (m.biodata_lengkap) lengkap++;
      baris.push([
        i + 1,
        m.nama,
        m.rombel || '',
        (m.kelas_mapel || []).map(function (k) {
          return k.nama_kelas + (k.mapel ? ' · ' + k.mapel : '');
        }).join(', '),
        /* Awalan apostrof memaksa Sheets & Excel memperlakukan NISN
           sebagai teks. Tanpa ini "0098765432" dibuka menjadi
           98765432 — bug yang sama dengan v1.10.4, kali ini di sisi
           pembaca berkas, bukan penyimpanan. */
        m.nisn ? "'" + m.nisn : '',
        m.email || '',
        m.no_wa ? "'" + m.no_wa : '',
        m.no_wa ? 'https://wa.me/' + m.no_wa : '',
        m.biodata_lengkap ? 'lengkap' : 'belum lengkap'
      ]);
    });

    Util.catatLog(sesi.user_id, 'ekspor_biodata',
                  judul + ' (' + lengkap + '/' + daftar.length + ' lengkap)');

    return {
      nama_berkas: ('Biodata_' + judul + '_' + _tanggalBerkas())
                     .replace(/[^a-zA-Z0-9_\-]+/g, '_')
                     .replace(/_+/g, '_') + '.csv',
      judul: judul,
      jumlah: daftar.length,
      lengkap: lengkap,
      belum: daftar.length - lengkap,
      csv: baris.map(function (r) {
        return r.map(_selCsv).join(',');
      }).join('\r\n')
    };
  }

  /** yyyyMMdd tanpa karakter ilegal untuk nama berkas */
  function _tanggalBerkas() {
    var d = new Date();
    var b = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + b(d.getMonth() + 1) + b(d.getDate());
  }

  function _selCsv(v) {
    var t = String(v == null ? '' : v);
    /* bungkus bila memuat koma, kutip, atau baris baru */
    if (/[",\r\n]/.test(t)) return '"' + t.replace(/"/g, '""') + '"';
    return t;
  }

  /* ==================================================== bantu */

  function _err(kode, pesan) {
    var e = new Error(pesan);
    e.kode = kode;
    return e;
  }

  /* ==================================================== BIODATA
   *  v1.10.0 — murid melengkapi datanya sendiri.
   * ============================================================ */

  /** Biodata milik murid yang sedang masuk — untuk mengisi formnya. */
  function biodataSaya(sesi) {
    var u = Db.cariBarisCache('users', 'user_id', sesi.user_id);
    if (!u) throw _err('TIDAK_DITEMUKAN', 'Akun tidak ditemukan.');
    return {
      nama: u.nama,
      username: u.username,
      rombel: u.rombel || '',
      nisn: String(u.nisn || ''),
      email: String(u.email || ''),
      no_wa: String(u.no_wa || ''),
      lengkap: Util.biodataLengkap(u)
    };
  }

  /**
   * Profil guru — dibaca & disimpan guru sendiri (v1.11.2).
   *
   * Tanpa ini tombol "Hubungi Guru" di layar murid tidak akan pernah
   * muncul: `daftarMurid()` hanya menyaring `role:'murid'`, sehingga
   * akun guru tidak dapat disunting dari mana pun. Nomornya ada
   * kolomnya sejak v1.10.0, tetapi tidak ada pintu masuknya.
   */
  function profilGuru(sesi) {
    var u = Db.cariBarisCache('users', 'user_id', sesi.user_id);
    if (!u) throw _err('TIDAK_DITEMUKAN', 'Akun tidak ditemukan.');
    return {
      nama: u.nama,
      username: u.username,
      email: String(u.email || ''),
      no_wa: String(u.no_wa || '')
    };
  }

  /**
   * Guru menyimpan profilnya sendiri.
   *
   * Seperti `simpanBiodata()` milik murid, hanya menyentuh baris
   * pemanggilnya — tidak menerima `user_id` dari klien.
   *
   * Nomor WA BOLEH dikosongkan: guru yang tidak ingin dihubungi lewat
   * WhatsApp cukup mengosongkannya, dan tombolnya hilang dari layar
   * murid dengan sendirinya.
   */
  function simpanProfilGuru(sesi, p) {
    p = p || {};
    if (sesi.role !== 'guru') {
      throw _err('AKSES_DITOLAK', 'Hanya untuk akun guru.');
    }
    var u = Db.cariBarisCache('users', 'user_id', sesi.user_id);
    if (!u) throw _err('TIDAK_DITEMUKAN', 'Akun tidak ditemukan.');

    var isi = {};

    if (p.nama !== undefined) {
      var nama = String(p.nama).trim();
      if (!nama) throw _err('VALIDASI_GAGAL', 'Nama tidak boleh kosong.');
      isi.nama = nama.slice(0, 100);
    }

    if (p.email !== undefined) {
      var em = String(p.email).trim().toLowerCase();
      if (em && !Util.emailSah(em)) {
        throw _err('VALIDASI_GAGAL',
          'Alamat email belum benar. Contoh: nama@gmail.com');
      }
      isi.email = em.slice(0, 100);
    }

    if (p.no_wa !== undefined) {
      var mentah = String(p.no_wa).trim();
      if (!mentah) {
        isi.no_wa = '';
      } else {
        var wa = Util.normalisasiWa(mentah);
        if (!wa) {
          throw _err('VALIDASI_GAGAL',
            'Nomor WhatsApp belum benar. Contoh: 081234567890');
        }
        isi.no_wa = wa;
      }
    }

    if (!Object.keys(isi).length) return { tersimpan: false };

    Db.perbarui('users', u._baris, isi);
    Util.catatLog(sesi.user_id, 'simpan_profil_guru',
                  isi.no_wa !== undefined ? 'wa=' + isi.no_wa : 'profil');

    return { tersimpan: true, no_wa: isi.no_wa !== undefined
      ? isi.no_wa : String(u.no_wa || '') };
  }

  /**
   * Tautan WhatsApp untuk meminta perbaikan pekerjaan (v1.11.4).
   *
   * Dipakai LKPD dan Tugas Kelompok. Untuk tugas kelompok penerimanya
   * adalah KETUA — dialah yang mengumpulkan, jadi dialah yang perlu
   * memperbaiki (keputusan guru).
   *
   * Catatan guru sengaja ikut di dalam pesan. Tanpa itu murid hanya
   * tahu pekerjaannya ditolak lalu tetap harus membuka aplikasi untuk
   * mencari tahu apa yang salah — dan tombol ini kehilangan gunanya.
   *
   * @param {string} noWa    nomor penerima (murid / ketua kelompok)
   * @param {string} nama    nama penerima
   * @param {string} judul   judul LKPD atau tugas kelompok
   * @param {string} catatan catatan guru; wajib ada saat menolak
   * @param {string} namaKelompok  diisi hanya untuk tugas kelompok
   * @returns {string} tautan wa.me, atau '' bila nomornya tidak sah
   */
  function tautanPerbaikanWa(noWa, nama, judul, catatan, namaKelompok) {
    var wa = Util.normalisasiWa(noWa);
    if (!wa) return '';

    var pekerjaan = namaKelompok
      ? 'Tugas kelompok "' + String(judul || '') + '" ' +
        '(kelompok ' + String(namaKelompok) + ')'
      : 'LKPD "' + String(judul || '') + '"';

    var pesan =
      'Halo ' + String(nama || '') + ', ' + pekerjaan +
      ' perlu diperbaiki.\n\n' +
      'Catatan guru:\n' + String(catatan || '-') + '\n\n' +

      'Silakan buka LessonLen untuk memperbaiki dan mengumpulkan ulang.';

    return 'https://wa.me/' + wa + '?text=' + encodeURIComponent(pesan);
  }

  /**
   * Tautan WhatsApp untuk mengirim sandi baru ke murid (v1.11.3).
   *
   * Dipakai layar guru sesudah reset. Pesannya disusun di SERVER —
   * sama seperti `kontakGuru()` — supaya formatnya satu tempat saja,
   * dan supaya dua layar yang memakai reset (Kelola Murid & Permintaan
   * Reset) tidak pernah berbeda kalimat.
   *
   * TIDAK memakai email. Kesepakatan §13 no. 11 melarang
   * `MailApp`/`GmailApp` sama sekali, dan kata sandi yang terkirim
   * lewat email tersimpan permanen di kotak masuk tanpa bisa ditarik
   * kembali. Pesan WhatsApp masih dapat dihapus guru.
   *
   * @returns {string} tautan wa.me, atau '' bila nomornya tidak sah
   */
  function tautanResetWa(noWa, nama, username, sandi) {
    var wa = Util.normalisasiWa(noWa);
    if (!wa) return '';

    var pesan =
      'Halo ' + String(nama || '') + ', kata sandi LessonLen Anda ' +
      'telah direset.\n\n' +
      'Nama pengguna: ' + String(username || '') + '\n' +
      'Kata sandi baru: ' + String(sandi || '') + '\n\n' +
      'Silakan masuk dan segera ganti kata sandi Anda sendiri. ' +
      'Jangan bagikan pesan ini kepada siapa pun.';

    return 'https://wa.me/' + wa + '?text=' + encodeURIComponent(pesan);
  }

  /**
   * Kontak guru untuk tombol "Hubungi Guru" di layar murid (v1.11.1).
   *
   * Nomor diambil dari akun guru itu sendiri — kolom `no_wa` di sheet
   * `users` sudah ada, jadi tidak perlu skema baru dan guru cukup
   * memperbaruinya di SATU tempat bila berganti nomor.
   *
   * Pesan pembuka disusun di SERVER, bukan klien. Nama & rombel murid
   * ada di baris ini juga, sehingga tidak ada panggilan tambahan; dan
   * bila formatnya perlu diubah, cukup satu tempat.
   *
   * @returns {Object} { ada, nama, tautan }  `ada:false` bila guru
   *                   belum mengisi nomornya — layar menyembunyikan
   *                   tombolnya, bukan menampilkan tautan rusak.
   */
  function kontakGuru(sesi) {
    var murid = Db.cariBarisCache('users', 'user_id', sesi.user_id);

    var g = _guruBergWa();
    if (!g) return { ada: false };

    var siapa = murid ? murid.nama : '';
    var rombel = murid && murid.rombel ? ' (' + murid.rombel + ')' : '';
    var sapaan = 'Assalamualaikum Pak/Bu, saya ' + siapa + rombel +
                 ' ingin bertanya tentang ';

    return {
      ada: true,
      nama: g.nama,
      tautan: _tautanWa(g.no_wa, sapaan)
    };
  }

  /**
   * Guru aktif pertama yang nomor WhatsApp-nya sah (v1.17.0).
   *
   * Sebelumnya pencariaan ini hanya ada di dalam `kontakGuru()`, yang
   * WAJIB menerima sesi. Pemulihan username dijalankan SEBELUM login,
   * jadi tidak punya sesi untuk diberikan. Daripada menyalin
   * pencariannya — dua tempat yang bisa berbeda nanti — ia diangkat
   * ke sini dan `kontakGuru()` ikut memakainya.
   *
   * @returns {Object|null} baris `users` guru, atau null
   */
  function _guruBergWa() {
    var guru = Db.saring('users', { role: 'guru', status: 'aktif' })
      .filter(function (g) { return !!Util.normalisasiWa(g.no_wa); });
    return guru.length ? guru[0] : null;
  }

  /** Satu tempat penyusun tautan wa.me. */
  function _tautanWa(noWa, pesan) {
    var wa = Util.normalisasiWa(noWa);
    if (!wa) return '';
    return 'https://wa.me/' + wa + '?text=' + encodeURIComponent(pesan);
  }

  /**
   * Tautan WhatsApp murid → guru untuk meminta reset kata sandi
   * (v1.17.0).
   *
   * APLIKASI INI TIDAK BISA MENGIRIM WHATSAPP. Tidak ada gateway di
   * seluruh kode — setiap fitur WA adalah tautan `wa.me` yang diklik
   * manusia (lihat juga `tautanResetWa` dan `kontakGuru`). Jadi yang
   * dikembalikan di sini adalah tautan untuk MURID: dia menekan,
   * WhatsApp-nya terbuka dengan pesan sudah tersusun, lalu dia yang
   * mengirim.
   *
   * Sifat yang menguntungkan: guru menerima pesan dari NOMOR MURID
   * ITU SENDIRI, bukan dari sistem. Guru bisa langsung membalas, dan
   * pesannya memuat username sehingga tidak perlu ditanya lagi.
   *
   * Sengaja TIDAK membuat baris `permintaan_reset` di sini. Murid
   * yang hanya lupa USERNAME tidak butuh reset sama sekali — membuat
   * permintaan akan menaruh pekerjaan palsu di antrean guru. Bila
   * sandinya juga lupa, layar menawarkan tombol yang membuka dialog
   * `ajukanReset()` yang sudah ada, TERISI username yang baru
   * ditemukan. Seluruh mesin reset lama dipakai ulang tanpa diubah.
   *
   * @returns {string} tautan wa.me, atau '' bila guru belum isi nomor
   */
  function tautanPulihWa(nama, username) {
    var g = _guruBergWa();
    if (!g) return '';

    var pesan =
      'Assalamualaikum Pak/Bu, saya ' + String(nama || '') +
      ' (nama pengguna: ' + String(username || '') + ').\n\n' +
      'Saya lupa kata sandi LessonLen. Data saya sudah dicocokkan ' +
      'lewat aplikasi, mohon bantuan reset kata sandinya.\n\n' +
      'Terima kasih.';

    return _tautanWa(g.no_wa, pesan);
  }

  /**
   * Murid menyimpan biodatanya sendiri.
   *
   * SENGAJA hanya menyentuh baris miliknya (`sesi.user_id`) — tidak
   * menerima `user_id` dari klien. Menerima id dari klien di sini
   * berarti murid mana pun dapat menimpa data murid lain hanya dengan
   * mengubah satu nilai di DevTools.
   *
   * Nama, username, dan rombel TIDAK dapat diubah murid: itu milik
   * guru. Murid hanya melengkapi tiga medan.
   */
  function simpanBiodata(sesi, p) {
    p = p || {};
    if (sesi.role !== 'murid') {
      throw _err('AKSES_DITOLAK', 'Biodata hanya untuk akun murid.');
    }

    var u = Db.cariBarisCache('users', 'user_id', sesi.user_id);
    if (!u) throw _err('TIDAK_DITEMUKAN', 'Akun tidak ditemukan.');

    var email = String(p.email || '').trim().toLowerCase();
    if (!Util.emailSah(email)) {
      throw _err('VALIDASI_GAGAL',
        'Alamat email belum benar. Contoh: nama@gmail.com');
    }

    /* Nomor dirapikan di SERVER, bukan di klien. Klien boleh membantu
       menampilkan, tetapi yang menentukan bentuk tersimpan hanya satu
       tempat — kalau tidak, ekspor guru berisi campuran 08xx dan
       62xx yang tidak bisa dipakai sebagai tautan wa.me. */
    var wa = Util.normalisasiWa(p.no_wa);
    if (!wa) {
      throw _err('VALIDASI_GAGAL',
        'Nomor WhatsApp belum benar. Contoh: 081234567890');
    }

    var nisn = String(p.nisn || '').trim();
    if (!Util.nisnSah(nisn)) {
      throw _err('VALIDASI_GAGAL',
        'NISN hanya boleh angka (4–20 digit). Kosongkan bila belum ada.');
    }

    Db.perbarui('users', u._baris, {
      email: email.slice(0, 100),
      no_wa: wa,
      nisn: nisn
    });
    Util.catatLog(sesi.user_id, 'simpan_biodata', 'wa=' + wa);

    return { tersimpan: true, no_wa: wa, email: email, nisn: nisn,
             lengkap: true };
  }

  return {
    daftar: daftar, detail: detail, simpan: simpan, hapus: hapus,
    daftarMurid: daftarMurid, simpanMurid: simpanMurid, imporMurid: imporMurid,
    murididKelas: murididKelas, enroll: enroll, keluarkan: keluarkan,
    muridTersedia: muridTersedia, csvMurid: csvMurid,
    pratinjauImpor: pratinjauImpor, duplikat: duplikat,
    biodataSaya: biodataSaya, simpanBiodata: simpanBiodata,
    kontakGuru: kontakGuru, tautanResetWa: tautanResetWa,
    tautanPerbaikanWa: tautanPerbaikanWa, tautanPulihWa: tautanPulihWa,
    profilGuru: profilGuru, simpanProfilGuru: simpanProfilGuru,
    csvBiodata: csvBiodata
  };
})();
