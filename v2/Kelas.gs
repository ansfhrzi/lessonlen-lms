/* ============================================================
 *  LMS v2 — Kelas.gs
 *  Kelola Kelas (menu dashboard guru — keputusan §22D):
 *  CRUD kelas (arsip = soft delete), daftar murid dalam kelas,
 *  enroll murid (dedupe + reaktivasi, persis proses v1),
 *  keluarkan murid, daftar murid yang tersedia untuk di-enroll.
 *
 *  Port perilaku v1 (Kelas.gs) ke sheet & idiom v2:
 *   · Enrollment dedupe: yang sudah aktif di-skip; baris berstatus
 *     `keluar` DIAKTIFKAN lagi (bukan membuat baris kedua)
 *   · Notifikasi `enroll_kelas` hanya untuk murid yang benar-benar
 *     berubah (v1 mengirim ke seluruh daftar — termasuk yang sudah
 *     aktif; di sini dirapikan)
 *   · Kelas diarsipkan, bukan dihapus — dan ditolak bila masih
 *     dipakai course aktif (relasi guru-kelas-mapel)
 * ============================================================ */

var Kelas = (function () {

  /* -------------------------------------------------- bantu */

  function _err(kode, pesan) {
    var e = new Error(pesan);
    e.kode = kode;
    return e;
  }

  function _bandingAlami(a, b) {
    return String(a || '').localeCompare(String(b || ''), 'id',
                                         { numeric: true });
  }

  /** Tahun ajaran berjalan (batas 1 Juli), bawaan bila kosong. */
  function _tahunAjaran() {
    var bawaan = '';
    try {
      bawaan = PropertiesService.getScriptProperties()
        .getProperty('TAHUN_AJARAN') || '';
    } catch (e) {}
    if (bawaan) return bawaan;
    var kini = new Date();
    var y = kini.getFullYear();
    return kini.getMonth() >= 6 ? (y + '/' + (y + 1)) : ((y - 1) + '/' + y);
  }

  /** Kunci dedupe nama kelas (tidak peka huruf besar/spasi ganda). */
  function _kunciNama(v) {
    return String(v || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  /** Peta class_id → jumlah murid enrollment aktif. */
  function _petaJmlMurid() {
    var peta = {};
    Db.saring('Enrollment', { status: 'aktif' }).forEach(function (e) {
      peta[e.class_id] = (peta[e.class_id] || 0) + 1;
    });
    return peta;
  }

  /** Peta class_id → jumlah course aktif (Teaching_Assignments). */
  function _petaJmlCourse() {
    var peta = {};
    Db.saring('Teaching_Assignments', { status: 'aktif' })
      .forEach(function (t) {
        peta[t.class_id] = (peta[t.class_id] || 0) + 1;
      });
    return peta;
  }

  /* -------------------------------------------------- CRUD kelas */

  /** Daftar semua kelas non-arsip + hitungan murid & course. */
  function daftar(sesi) {
    var jm = _petaJmlMurid();
    var jc = _petaJmlCourse();
    return Db.saring('Classes', { status: 'aktif' })
      .map(function (k) {
        return {
          class_id: k.class_id,
          name: k.name,
          academic_year: k.academic_year || '',
          jml_murid: jm[k.class_id] || 0,
          jml_course: jc[k.class_id] || 0
        };
      })
      .sort(function (a, b) { return _bandingAlami(a.name, b.name); });
  }

  /**
   * Buat (tanpa class_id) atau edit (dengan class_id) kelas.
   * Nama wajib & tidak boleh kembar dengan kelas aktif lain.
   */
  function simpan(sesi, p) {
    p = p || {};
    var nama = String(p.name || '').replace(/\s+/g, ' ').trim();
    if (nama.length < 2) {
      throw _err('VALIDASI_GAGAL',
        'Nama kelas wajib diisi (minimal 2 karakter). Contoh: XI TKJ 1');
    }
    if (nama.length > 60) {
      throw _err('VALIDASI_GAGAL', 'Nama kelas maksimal 60 karakter.');
    }

    /* ---- edit ---- */
    if (p.class_id) {
      var k = Db.cari('Classes', 'class_id', p.class_id);
      if (!k) throw _err('TIDAK_DITEMUKAN', 'Kelas tidak ditemukan.');

      var kunci = _kunciNama(nama);
      var kembar = Db.saring('Classes', { status: 'aktif' })
        .filter(function (x) {
          return x.class_id !== p.class_id &&
                 _kunciNama(x.name) === kunci;
        });
      if (kembar.length) {
        throw _err('DUPLIKAT', 'Nama kelas "' + nama + '" sudah dipakai.');
      }

      var ubah = { updated_at: Util.sekarang() };
      if (p.name !== undefined) ubah.name = nama;
      if (p.academic_year !== undefined) {
        ubah.academic_year = String(p.academic_year || '').trim().slice(0, 20);
      }
      Db.perbarui('Classes', k._baris, ubah);
      Util.catatLog(sesi.user_id, 'EDIT_KELAS', p.class_id + ' ' + nama,
                    'ok', sesi.role, 'Classes', p.class_id);
      return { class_id: p.class_id, baru: false };
    }

    /* ---- buat ---- */
    var kunci2 = _kunciNama(nama);
    var ada = Db.saring('Classes', { status: 'aktif' })
      .some(function (x) { return _kunciNama(x.name) === kunci2; });
    if (ada) {
      throw _err('DUPLIKAT', 'Nama kelas "' + nama + '" sudah dipakai.');
    }

    var tahun = String(p.academic_year || '').trim() || _tahunAjaran();
    var baru = {
      class_id: Util.buatId('KLS'),
      name: nama,
      academic_year: tahun.slice(0, 20),
      status: 'aktif',
      created_at: Util.sekarang(),
      updated_at: Util.sekarang()
    };
    Db.tambah('Classes', baru);
    Util.catatLog(sesi.user_id, 'BUAT_KELAS', baru.class_id + ' ' + nama,
                  'ok', sesi.role, 'Classes', baru.class_id);
    return { class_id: baru.class_id, name: baru.name,
             academic_year: baru.academic_year, baru: true };
  }

  /**
   * Arsipkan kelas (soft delete) — hilang dari daftar & dropdown,
   * riwayatnya tetap. DITOLAK bila masih dipakai course aktif.
   */
  function arsip(sesi, classId) {
    var k = Db.cari('Classes', 'class_id', classId);
    if (!k) throw _err('TIDAK_DITEMUKAN', 'Kelas tidak ditemukan.');

    var dipakai = Db.saring('Teaching_Assignments', { class_id: classId })
      .filter(function (t) { return t.status === 'aktif'; }).length;
    if (dipakai) {
      throw _err('VALIDASI_GAGAL', 'Kelas masih dipakai ' + dipakai +
        ' course. Hapus/nonaktifkan course-nya terlebih dahulu.');
    }

    Db.perbarui('Classes', k._baris,
                { status: 'arsip', updated_at: Util.sekarang() });
    Util.catatLog(sesi.user_id, 'ARSIP_KELAS', classId + ' ' + k.name,
                  'ok', sesi.role, 'Classes', classId);
    return { diarsipkan: true };
  }

  /* -------------------------------------------------- anggota kelas */

  /** Detail kelas: identitas + daftar murid yang ter-enroll aktif. */
  function detail(sesi, classId) {
    var k = Db.cari('Classes', 'class_id', classId);
    if (!k) throw _err('TIDAK_DITEMUKAN', 'Kelas tidak ditemukan.');

    var petaU = {};
    Db.baca('Users').forEach(function (u) { petaU[u.user_id] = u; });

    var murid = Db.saring('Enrollment', { class_id: classId })
      .filter(function (e) { return e.status === 'aktif'; })
      .map(function (e) {
        var u = petaU[e.user_id] || {};
        return {
          enroll_id: e.enroll_id,
          user_id: e.user_id,
          nama: u.nama || '(tidak dikenal)',
          username: u.username || '',
          status_akun: u.status || '',
          pwd_awal: u.pwd_awal || '',
          sudah_ganti: !u.pwd_awal,
          tanggal_daftar: e.tanggal_daftar ? String(e.tanggal_daftar) : ''
        };
      })
      .sort(function (a, b) { return _bandingAlami(a.nama, b.nama); });

    return {
      class_id: k.class_id,
      name: k.name,
      academic_year: k.academic_year || '',
      status: k.status,
      jml_murid: murid.length,
      jml_course: _petaJmlCourse()[classId] || 0,
      murid: murid
    };
  }

  /**
   * Murid aktif yang BELUM terdaftar (aktif) di kelas ini — bahan
   * dialog enroll. Menyertakan daftar kelas lain yang sudah diikuti,
   * agar guru bisa membedakan dua murid yang namanya sama.
   */
  function muridTersedia(sesi, classId) {
    var k = Db.cari('Classes', 'class_id', classId);
    if (!k) throw _err('TIDAK_DITEMUKAN', 'Kelas tidak ditemukan.');

    var terdaftar = {};
    var kelasLain = {};
    Db.saring('Enrollment', { status: 'aktif' }).forEach(function (e) {
      if (e.class_id === classId) terdaftar[e.user_id] = true;
      (kelasLain[e.user_id] = kelasLain[e.user_id] || []).push(e.class_id);
    });

    var petaKelas = {};
    Db.baca('Classes').forEach(function (x) { petaKelas[x.class_id] = x; });

    return Db.saring('Users', { role: 'murid', status: 'aktif' })
      .filter(function (u) { return !terdaftar[u.user_id]; })
      .map(function (u) {
        var lain = (kelasLain[u.user_id] || [])
          .map(function (id) {
            var x = petaKelas[id];
            return x && x.status === 'aktif'
              ? { class_id: id, name: x.name } : null;
          })
          .filter(function (x) { return !!x; })
          .sort(function (a, b) { return _bandingAlami(a.name, b.name); });
        return { user_id: u.user_id, nama: u.nama, username: u.username,
                 rombel: String(u.rombel || ''), kelas: lain };
      })
      .sort(function (a, b) { return _bandingAlami(a.nama, b.nama); });
  }

  /**
   * Enroll murid ke kelas — proses persis v1:
   *   · yang sudah aktif  → dilewati (tanpa notif, tanpa baris baru)
   *   · yang pernah keluar → barisnya DIAKTIFKAN lagi
   *   · sisanya           → baris baru
   * Notifikasi `enroll_kelas` hanya ke murid yang benar-benar berubah.
   */
  function enroll(sesi, classId, userIds) {
    var k = Db.cari('Classes', 'class_id', classId);
    if (!k || k.status !== 'aktif') {
      throw _err('TIDAK_DITEMUKAN', 'Kelas tidak ditemukan.');
    }
    if (!userIds || !userIds.length) {
      throw _err('VALIDASI_GAGAL', 'Pilih minimal satu murid.');
    }

    /* hanya murid aktif yang diproses — sisanya dilaporkan dilewati */
    var sah = {};
    Db.saring('Users', { role: 'murid', status: 'aktif' })
      .forEach(function (u) { sah[u.user_id] = true; });

    var sudah = {};
    Db.saring('Enrollment', { class_id: classId }).forEach(function (e) {
      sudah[e.user_id] = e;
    });

    var now = Util.sekarang();
    var baru = [], aktifkanLagi = [], berubah = [], dilewati = 0;

    userIds.forEach(function (uid) {
      if (!sah[uid]) { dilewati++; return; }
      var ada = sudah[uid];
      if (ada) {
        if (ada.status !== 'aktif') {
          aktifkanLagi.push({ _baris: ada._baris, status: 'aktif',
                              tanggal_daftar: now });
          berubah.push(uid);
        }
        return;                     /* sudah aktif → tanpa apa-apa */
      }
      baru.push({
        enroll_id: Util.buatId('ENR'), class_id: classId, user_id: uid,
        tanggal_daftar: now, status: 'aktif'
      });
      berubah.push(uid);
    });

    if (baru.length) Db.tambah('Enrollment', baru);
    if (aktifkanLagi.length) Db.perbaruiBanyak('Enrollment', aktifkanLagi);

    if (berubah.length) {
      _kirimNotif(berubah, 'enroll_kelas',
        'Anda didaftarkan ke kelas ' + k.name + '.',
        '#/kelas-saya/' + classId);
    }
    Util.catatLog(sesi.user_id, 'ENROLL',
                  berubah.length + ' murid ke ' + classId +
                  ' (dilewati ' + dilewati + ')', 'ok', sesi.role,
                  'Classes', classId);
    return { ditambah: baru.length, diaktifkan: aktifkanLagi.length,
             dilewati: dilewati };
  }

  /** Keluarkan murid dari kelas (baris aktif → keluar); akun tetap ada. */
  function keluarkan(sesi, classId, userId) {
    var baris = null;
    Db.saring('Enrollment', { class_id: classId, user_id: userId })
      .forEach(function (e) {
        if (e.status === 'aktif') baris = e;
      });
    if (!baris) {
      throw _err('TIDAK_DITEMUKAN', 'Murid tidak terdaftar (aktif) di kelas ini.');
    }

    Db.perbarui('Enrollment', baris._baris, { status: 'keluar' });
    Util.catatLog(sesi.user_id, 'KELUARKAN_MURID',
                  userId + ' dari ' + classId, 'ok', sesi.role,
                  'Classes', classId);
    return { dikeluarkan: true };
  }

  /** Tulis notifikasi in-app (baris sheet Notifications). */
  function _kirimNotif(userIds, jenis, judul, link) {
    var now = Util.sekarang();
    Db.tambah('Notifications', userIds.map(function (uid) {
      return {
        notif_id: Util.buatId('NTF'),
        user_id: uid,
        jenis: jenis,
        judul: judul,
        pesan: judul,
        link: link || '',
        dibaca: false,
        created_at: now
      };
    }));
  }

  /* ------------------------------------------------ kelas saya (murid) */

  /**
   * KELAS SAYA (murid) — kelas yang diikuti aktif, plus daftar mapel
   * (course aktif) di kelas itu. Untuk kartu "Kelas Saya" pada
   * dashboard murid. Kelas terarsip tidak ditampilkan.
   */
  function kelasSaya(sesi) {
    var diikuti = {};
    Db.saring('Enrollment', { user_id: sesi.user_id, status: 'aktif' })
      .forEach(function (e) { diikuti[e.class_id] = true; });

    var mapel = {};   /* class_id → [nama mapel aktif] */
    Db.saring('Teaching_Assignments', { status: 'aktif' })
      .forEach(function (t) {
        var s = Db.cari('Subjects', 'subject_id', t.subject_id) || {};
        if (s.name) {
          (mapel[t.class_id] = mapel[t.class_id] || []).push(s.name);
        }
      });

    return Db.saring('Classes', { status: 'aktif' })
      .filter(function (k) { return diikuti[k.class_id]; })
      .map(function (k) {
        var mp = (mapel[k.class_id] || []).sort(_bandingAlami);
        return {
          class_id: k.class_id,
          name: k.name,
          academic_year: k.academic_year || '',
          jml_course: mp.length,
          course: mp
        };
      })
      .sort(function (a, b) { return _bandingAlami(a.name, b.name); });
  }

  return {
    daftar: daftar,
    simpan: simpan,
    arsip: arsip,
    detail: detail,
    muridTersedia: muridTersedia,
    enroll: enroll,
    keluarkan: keluarkan,
    kelasSaya: kelasSaya
  };
})();
