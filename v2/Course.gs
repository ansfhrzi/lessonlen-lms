/* ============================================================
 *  LMS v2 — Course.gs
 *  Kelola Course (menu dashboard guru — keputusan §22D).
 *
 *  "Course" adalah ISTILAH UI untuk relasi guru-kelas-mapel —
 *  di database tetap sheet `Teaching_Assignments`; nama sheet
 *  tidak berubah. Tampilannya: "XI TKJ 1 - PKPJ".
 *
 *  Buat course = pilih kelas + tulis nama mapel bebas:
 *   · mapel yang sudah pernah dibuat (milik guru ini) DIPAKAI,
 *     tidak dibuat dua kali (dedupe ke `Subjects`)
 *   · mapel baru otomatis dibuat bila belum ada
 *   · pasangan kelas+mapel yang sama tak boleh dua kali (DUPLIKAT)
 *   · course yang pernah dihapus (nonaktif) DIAKTIFKAN lagi,
 *     bukan membuat baris kedua — filosofi sama dgn enrollment
 *
 *  Hapus course = melepas RELASI (status nonaktif); kelas &
 *  mapel tidak terhapus. Tidak ada notifikasi — murid melihat
 *  course lewat kelasnya.
 * ============================================================ */

var Course = (function () {

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

  function _kunciNama(v) {
    return String(v || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function _rapikan(v, maks) {
    return String(v || '').replace(/\s+/g, ' ').trim().slice(0, maks);
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

  /** Peta class_id → nama kelas (semua status). */
  function _petaKelas() {
    var peta = {};
    Db.baca('Classes').forEach(function (k) { peta[k.class_id] = k; });
    return peta;
  }

  /** Peta class_id → jumlah murid enrollment aktif. */
  function _petaJmlMurid() {
    var peta = {};
    Db.saring('Enrollment', { status: 'aktif' }).forEach(function (e) {
      peta[e.class_id] = (peta[e.class_id] || 0) + 1;
    });
    return peta;
  }

  /**
   * Cari/dedupe mapel milik guru: kembalikan subject_id baris yang
   * sudah ada bila namanya sama (tak peka huruf), atau buat baru.
   */
  function _dedupeMapel(sesi, nama) {
    var kunci = _kunciNama(nama);
    var ada = Db.saring('Subjects', { owner_teacher_id: sesi.user_id })
      .filter(function (s) { return _kunciNama(s.name) === kunci; })[0];
    if (ada) return ada;

    var baru = {
      subject_id: Util.buatId('SBK'),
      name: nama,
      code: '',
      owner_teacher_id: sesi.user_id,
      status: 'aktif',
      created_at: Util.sekarang(),
      updated_at: Util.sekarang()
    };
    Db.tambah('Subjects', baru);
    Util.catatLog(sesi.user_id, 'BUAT_MAPEL', baru.subject_id + ' ' + nama,
                  'ok', sesi.role, 'Subjects', baru.subject_id);
    return baru;
  }

  function _bentukBaris(ta, petaK, jm) {
    var k = petaK[ta.class_id] || {};
    var s = Db.cari('Subjects', 'subject_id', ta.subject_id) || {};
    var namaKelas = k.name || '(kelas terhapus)';
    var namaMapel = s.name || '(mapel terhapus)';
    return {
      teaching_assignment_id: ta.teaching_assignment_id,
      class_id: ta.class_id,
      class_name: namaKelas,
      subject_id: ta.subject_id,
      subject_name: namaMapel,
      label: namaKelas + ' - ' + namaMapel,
      academic_year: ta.academic_year || '',
      status: ta.status,
      jml_murid: jm[ta.class_id] || 0
    };
  }

  /* -------------------------------------------------- daftar & detail */

  /** Daftar course milik guru (aktif saja) + hitungan murid. */
  function daftar(sesi) {
    var petaK = _petaKelas();
    var jm = _petaJmlMurid();
    return Db.saring('Teaching_Assignments', { teacher_id: sesi.user_id })
      .filter(function (t) { return t.status === 'aktif'; })
      .map(function (t) { return _bentukBaris(t, petaK, jm); })
      .sort(function (a, b) {
        return _bandingAlami(a.class_name, b.class_name) ||
               _bandingAlami(a.subject_name, b.subject_name);
      });
  }

  /** Detail satu course. */
  function detail(sesi, taId) {
    var ta = Db.cari('Teaching_Assignments', 'teaching_assignment_id', taId);
    if (!ta || ta.teacher_id !== sesi.user_id) {
      throw _err('TIDAK_DITEMUKAN', 'Course tidak ditemukan.');
    }
    return _bentukBaris(ta, _petaKelas(), _petaJmlMurid());
  }

  /* -------------------------------------------------- buat / edit */

  /**
   * Buat (tanpa teaching_assignment_id) atau edit (dengan).
   * p = { class_id, name (nama mapel), academic_year? }
   *     { teaching_assignment_id, class_id?, name? }
   */
  function simpan(sesi, p) {
    p = p || {};
    var namaMapel = _rapikan(p.name, 60);

    /* ---- edit: ganti kelas dan/atau nama mapel ---- */
    if (p.teaching_assignment_id) {
      var ta = Db.cari('Teaching_Assignments', 'teaching_assignment_id',
                       p.teaching_assignment_id);
      if (!ta || ta.teacher_id !== sesi.user_id) {
        throw _err('TIDAK_DITEMUKAN', 'Course tidak ditemukan.');
      }

      var classId = p.class_id !== undefined ? p.class_id : ta.class_id;
      if (namaMapel === '') namaMapel =
        (Db.cari('Subjects', 'subject_id', ta.subject_id) || {}).name || '';
      if (namaMapel.length < 2) {
        throw _err('VALIDASI_GAGAL',
          'Nama mapel wajib diisi (minimal 2 karakter).');
      }

      var k = Db.cari('Classes', 'class_id', classId);
      if (!k || k.status !== 'aktif') {
        throw _err('TIDAK_DITEMUKAN', 'Kelas tidak ditemukan / sudah diarsipkan.');
      }

      var sbk = _dedupeMapel(sesi, namaMapel);

      var kembar = Db.saring('Teaching_Assignments', { teacher_id: sesi.user_id })
        .filter(function (x) {
          return x.status === 'aktif' &&
                 x.teaching_assignment_id !== p.teaching_assignment_id &&
                 x.class_id === classId && x.subject_id === sbk.subject_id;
        });
      if (kembar.length) {
        throw _err('DUPLIKAT', 'Course "' + k.name + ' - ' + namaMapel +
          '" sudah ada.');
      }

      Db.perbarui('Teaching_Assignments', ta._baris, {
        class_id: classId, subject_id: sbk.subject_id,
        updated_at: Util.sekarang()
      });
      Util.catatLog(sesi.user_id, 'EDIT_COURSE', p.teaching_assignment_id,
                    'ok', sesi.role, 'Teaching_Assignments',
                    p.teaching_assignment_id);
      return { teaching_assignment_id: p.teaching_assignment_id,
               subject_id: sbk.subject_id, baru: false };
    }

    /* ---- buat ---- */
    if (!p.class_id) {
      throw _err('VALIDASI_GAGAL', 'Pilih kelas terlebih dahulu.');
    }
    if (namaMapel.length < 2) {
      throw _err('VALIDASI_GAGAL',
        'Nama mapel wajib diisi (minimal 2 karakter). Contoh: PKPJ');
    }

    var k2 = Db.cari('Classes', 'class_id', p.class_id);
    if (!k2 || k2.status !== 'aktif') {
      throw _err('TIDAK_DITEMUKAN', 'Kelas tidak ditemukan / sudah diarsipkan.');
    }

    var sbk2 = _dedupeMapel(sesi, namaMapel);

    /* pasangan sama yang masih aktif → DUPLIKAT */
    var ada = Db.saring('Teaching_Assignments', { teacher_id: sesi.user_id })
      .some(function (x) {
        return x.status === 'aktif' &&
               x.class_id === p.class_id && x.subject_id === sbk2.subject_id;
      });
    if (ada) {
      throw _err('DUPLIKAT',
        'Course "' + k2.name + ' - ' + namaMapel + '" sudah ada.');
    }

    /* pasangan sama yang pernah dihapus → aktifkan lagi (bukan baris baru) */
    var mati = Db.saring('Teaching_Assignments', { teacher_id: sesi.user_id })
      .filter(function (x) {
        return x.status !== 'aktif' &&
               x.class_id === p.class_id && x.subject_id === sbk2.subject_id;
      })[0];
    if (mati) {
      Db.perbarui('Teaching_Assignments', mati._baris, {
        status: 'aktif', academic_year: _tahunAjaran(),
        updated_at: Util.sekarang()
      });
      Util.catatLog(sesi.user_id, 'BUAT_COURSE',
        mati.teaching_assignment_id + ' (reaktivasi) ' +
        k2.name + ' - ' + namaMapel, 'ok', sesi.role,
        'Teaching_Assignments', mati.teaching_assignment_id);
      return { teaching_assignment_id: mati.teaching_assignment_id,
               subject_id: sbk2.subject_id,
               label: k2.name + ' - ' + namaMapel,
               baru: true, reaktivasi: true };
    }

    var tahun = String(p.academic_year || '').trim() || _tahunAjaran();
    var baru = {
      teaching_assignment_id: Util.buatId('TA'),
      class_id: p.class_id,
      teacher_id: sesi.user_id,
      subject_id: sbk2.subject_id,
      academic_year: tahun.slice(0, 20),
      status: 'aktif',
      created_at: Util.sekarang(),
      updated_at: Util.sekarang()
    };
    Db.tambah('Teaching_Assignments', baru);
    Util.catatLog(sesi.user_id, 'BUAT_COURSE',
      baru.teaching_assignment_id + ' ' + k2.name + ' - ' + namaMapel,
      'ok', sesi.role, 'Teaching_Assignments', baru.teaching_assignment_id);
    return { teaching_assignment_id: baru.teaching_assignment_id,
             subject_id: sbk2.subject_id,
             label: k2.name + ' - ' + namaMapel,
             academic_year: baru.academic_year,
             baru: true };
  }

  /* -------------------------------------------------- hapus */

  /**
   * Hapus course = lepas relasi (status nonaktif — riwayat tetap).
   * Kelas & mapel TIDAK terhapus. (Tahap konten nanti: bila course
   * masih punya topik/item, pengecekan ditambahkan di sini.)
   */
  function hapus(sesi, taId) {
    var ta = Db.cari('Teaching_Assignments', 'teaching_assignment_id', taId);
    if (!ta || ta.teacher_id !== sesi.user_id) {
      throw _err('TIDAK_DITEMUKAN', 'Course tidak ditemukan.');
    }
    if (ta.status !== 'aktif') {
      throw _err('VALIDASI_GAGAL', 'Course sudah dihapus sebelumnya.');
    }

    Db.perbarui('Teaching_Assignments', ta._baris,
                { status: 'nonaktif', updated_at: Util.sekarang() });
    Util.catatLog(sesi.user_id, 'HAPUS_COURSE', taId, 'ok', sesi.role,
                  'Teaching_Assignments', taId);
    return { dihapus: true };
  }

  return {
    daftar: daftar,
    detail: detail,
    simpan: simpan,
    hapus: hapus
  };
})();
