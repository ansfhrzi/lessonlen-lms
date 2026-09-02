/**
 * ============================================================
 *  LMS v2 — Mapel.gs
 *  Mapel (Subjects), Penugasan (Teaching_Assignments),
 *  Topik (Topics), Item (Items) — Tahap 4
 * ------------------------------------------------------------
 *  Rancangan v2 (DOKUMENTASI §7.4–7.8, §9.2, §9.4):
 *   - Subjects berkolom owner_teacher_id (guru pemilik / admin)
 *   - Teaching_Assignment = relasi guru + kelas + mapel
 *   - Topic selalu di bawah Teaching_Assignment
 *   - Item mewarisi kelas/mapel melalui topic → TA
 *   - guru = admin: kelola seluruh mapel/penugasan;
 *     murid hanya membaca yang publish + terdaftar di kelasnya
 *
 *  ATURAN:
 *   - status mapel/penugasan: aktif | nonaktif (soft delete)
 *   - status topik/item     : draft | publish
 *   - unik penugasan aktif  : class_id + teacher_id + subject_id
 *     (baris nonaktif diaktifkan kembali, bukan baris baru —
 *      pola sama seperti enrollment)
 *   - konten item disanitasi Util.sanitasi (sama seperti v1)
 * ============================================================
 */

var Mapel = (function () {

  var TIPE_ITEM = ['materi', 'tugas_individu', 'tugas_kelompok',
                   'quiz', 'refleksi'];

  /* ==================================================== MAPEL */

  /** Daftar mapel + jumlah penugasan aktif + nama pemilik. */
  function daftar() {
    var perMapel = {};
    Db.bacaKolom('Teaching_Assignments',
                 ['teaching_assignment_id', 'subject_id', 'status'])
      .forEach(function (t) {
        if (t.status !== 'aktif') return;
        perMapel[t.subject_id] = (perMapel[t.subject_id] || 0) + 1;
      });

    var petaGuru = {};
    Db.bacaKolom('Users', ['user_id', 'nama'])
      .forEach(function (u) { petaGuru[u.user_id] = u.nama; });

    return Db.baca('Subjects').map(function (s) {
      return {
        subject_id: s.subject_id,
        name: s.name,
        code: s.code || '',
        owner_teacher_id: s.owner_teacher_id || '',
        owner: petaGuru[s.owner_teacher_id] || '',
        jml_penugasan: perMapel[s.subject_id] || 0,
        status: s.status
      };
    }).sort(function (a, b) { return _banding(a.name, b.name); });
  }

  /**
   * Buat/ubah mapel. Pemilik otomatis = guru yang membuat.
   * Edit parsial: hanya kolom yang dikirim yang diperbarui.
   * Status TIDAK lewat sini — gunakan ubahStatus().
   */
  function simpan(sesi, p) {
    if (p.subject_id) {
      var ada = Db.cari('Subjects', 'subject_id', p.subject_id);
      if (!ada) throw _err('TIDAK_DITEMUKAN', 'Mapel tidak ditemukan.');

      var ubah = Util.isiBilaAda({}, p, {
        name: _namaMapel,
        code: function (v) {
          return String(v == null ? '' : v).trim().slice(0, 20);
        }
      });
      if (ubah.name === '') {
        throw _err('VALIDASI_GAGAL', 'Nama mapel tidak boleh dikosongkan.');
      }
      ubah.updated_at = Util.sekarang();
      Db.perbarui('Subjects', ada._baris, ubah);
      Util.catatLog(sesi.user_id, 'UPDATE', 'edit_mapel ' +
                    p.subject_id, 'ok', sesi.role, 'Subjects', p.subject_id);
      return { subject_id: p.subject_id, baru: false };
    }

    var nama = _namaMapel(p.name);
    if (!nama) throw _err('VALIDASI_GAGAL', 'Nama mapel wajib diisi.');

    var isi = {
      subject_id: Util.buatId('SBK'),
      name: nama,
      code: String(p.code || '').trim().slice(0, 20),
      owner_teacher_id: sesi.user_id,
      status: 'aktif',
      created_at: Util.sekarang(),
      updated_at: Util.sekarang()
    };
    Db.tambah('Subjects', isi);
    Util.catatLog(sesi.user_id, 'CREATE', 'buat_mapel ' +
                  isi.subject_id + ' ' + isi.name, 'ok', sesi.role,
                  'Subjects', isi.subject_id);
    return { subject_id: isi.subject_id, baru: true };
  }

  /** Nonaktifkan / aktifkan kembali mapel (soft delete). */
  function ubahStatus(sesi, subjectId, status) {
    if (['aktif', 'nonaktif'].indexOf(status) === -1) {
      throw _err('VALIDASI_GAGAL', 'Status tidak sah.');
    }
    var s = Db.cari('Subjects', 'subject_id', subjectId);
    if (!s) throw _err('TIDAK_DITEMUKAN', 'Mapel tidak ditemukan.');

    Db.perbarui('Subjects', s._baris,
                { status: status, updated_at: Util.sekarang() });
    Util.catatLog(sesi.user_id, 'UPDATE', 'mapel_' + status, 'ok',
                  sesi.role, 'Subjects', subjectId);
    return { subject_id: subjectId, status: status };
  }

  /** Guru aktif — untuk pilihan pengampu pada dialog penugasan. */
  function guruAktif() {
    return Db.saring('Users', { role: 'guru', status: 'aktif' })
      .map(function (g) {
        return { user_id: g.user_id, nama: g.nama, username: g.username };
      })
      .sort(function (a, b) { return _banding(a.nama, b.nama); });
  }

  /* ==================================================== PENUGASAN */

  /**
   * Daftar penugasan + nama kelas/mapel/guru.
   * Filter: { class_id, subject_id, teacher_id, status }
   * Default: hanya aktif.
   */
  function penugasanDaftar(filter) {
    var f = filter || {};
    var petaKelas = {};
    Db.bacaKolom('Classes', ['class_id', 'name'])
      .forEach(function (k) { petaKelas[k.class_id] = k.name; });

    var petaMapel = {};
    Db.bacaKolom('Subjects', ['subject_id', 'name'])
      .forEach(function (s) { petaMapel[s.subject_id] = s.name; });

    var petaGuru = {};
    Db.bacaKolom('Users', ['user_id', 'nama'])
      .forEach(function (u) { petaGuru[u.user_id] = u.nama; });

    /* topik per penugasan — jumlah untuk kolom informasi */
    var topikPer = {};
    Db.bacaKolom('Topics', ['topic_id', 'teaching_assignment_id'])
      .forEach(function (t) {
        topikPer[t.teaching_assignment_id] =
          (topikPer[t.teaching_assignment_id] || 0) + 1;
      });

    return Db.baca('Teaching_Assignments')
      .filter(function (t) {
        if (!f.semua && f.status !== 'nonaktif' && t.status !== 'aktif') return false;
        if (f.status && t.status !== f.status) return false;
        if (f.class_id && t.class_id !== f.class_id) return false;
        if (f.subject_id && t.subject_id !== f.subject_id) return false;
        if (f.teacher_id && t.teacher_id !== f.teacher_id) return false;
        return true;
      })
      .map(function (t) {
        return {
          teaching_assignment_id: t.teaching_assignment_id,
          class_id: t.class_id,
          kelas: petaKelas[t.class_id] || '(kelas dihapus)',
          subject_id: t.subject_id,
          mapel: petaMapel[t.subject_id] || '(mapel dihapus)',
          teacher_id: t.teacher_id,
          guru: petaGuru[t.teacher_id] || '?',
          academic_year: t.academic_year || '',
          jml_topik: topikPer[t.teaching_assignment_id] || 0,
          status: t.status
        };
      })
      .sort(function (a, b) {
        return _banding(a.kelas, b.kelas) || _banding(a.mapel, b.mapel);
      });
  }

  /**
   * Buat/ubah penugasan.
   *  - teacher_id berasal dari server: default pembuat, boleh guru lain
   *    (guru = admin) tetapi WAJIB akun guru aktif.
   *  - tahun ajaran diambil dari kelas bila tidak dikirim.
   *  - kombinasi aktif class+teacher+subject unik; baris nonaktif
   *    dengan kombinasi sama diaktifkan kembali (pola enrollment).
   *  - edit: hanya teacher_id & academic_year — ganti kelas/mapel =
   *    nonaktifkan lalu buat penugasan baru.
   */
  function penugasanSimpan(sesi, p) {
    /* ---- edit ---- */
    if (p.teaching_assignment_id) {
      var ta = Db.cari('Teaching_Assignments', 'teaching_assignment_id',
                       p.teaching_assignment_id);
      if (!ta) throw _err('TIDAK_DITEMUKAN', 'Penugasan tidak ditemukan.');

      var ubah = {};
      if (p.teacher_id !== undefined) {
        ubah.teacher_id = _validasiGuru(p.teacher_id);
      }
      if (p.academic_year !== undefined) {
        ubah.academic_year = _tahunAjaran(p.academic_year);
      }
      ubah.updated_at = Util.sekarang();
      Db.perbarui('Teaching_Assignments', ta._baris, ubah);

      /* kombinasinya bisa berubah karena teacher — cek ulang unik */
      _tolakDuplikat(ta.class_id, ubah.teacher_id || ta.teacher_id,
                     ta.subject_id, p.teaching_assignment_id);

      Util.catatLog(sesi.user_id, 'UPDATE', 'edit_penugasan ' +
                    p.teaching_assignment_id, 'ok', sesi.role,
                    'Teaching_Assignments', p.teaching_assignment_id);
      return { teaching_assignment_id: p.teaching_assignment_id, baru: false };
    }

    /* ---- buat ---- */
    var kelas = Db.cari('Classes', 'class_id', p.class_id);
    if (!kelas) throw _err('TIDAK_DITEMUKAN', 'Kelas tidak ditemukan.');
    if (kelas.status === 'arsip') {
      throw _err('VALIDASI_GAGAL', 'Kelas sudah diarsipkan.');
    }

    var mapel = Db.cari('Subjects', 'subject_id', p.subject_id);
    if (!mapel) throw _err('TIDAK_DITEMUKAN', 'Mapel tidak ditemukan.');
    if (mapel.status !== 'aktif') {
      throw _err('VALIDASI_GAGAL',
        'Mapel "' + mapel.name + '" nonaktif. Aktifkan dulu.');
    }

    var teacherId = _validasiGuru(
      Util.kosong(p.teacher_id) ? sesi.user_id : p.teacher_id);

    /* kombinasi aktif yang sama → tolak / aktifkan kembali */
    var lama = null;
    Db.saring('Teaching_Assignments', {
      class_id: kelas.class_id,
      teacher_id: teacherId,
      subject_id: mapel.subject_id
    }).forEach(function (t) { if (t.status === 'nonaktif') lama = t; });

    var aktif = Db.saring('Teaching_Assignments', {
      class_id: kelas.class_id,
      teacher_id: teacherId,
      subject_id: mapel.subject_id,
      status: 'aktif'
    });
    if (aktif.length) {
      throw _err('DUPLIKAT', 'Penugasan itu sudah ada.');
    }

    if (lama) {
      Db.perbarui('Teaching_Assignments', lama._baris, {
        status: 'aktif',
        academic_year: _tahunAjaran(p.academic_year || kelas.academic_year),
        updated_at: Util.sekarang()
      });
      Util.catatLog(sesi.user_id, 'UPDATE', 'reaktivasi_penugasan ' +
                    lama.teaching_assignment_id, 'ok', sesi.role,
                    'Teaching_Assignments', lama.teaching_assignment_id);
      return { teaching_assignment_id: lama.teaching_assignment_id,
               diaktifkan: true };
    }

    var isi = {
      teaching_assignment_id: Util.buatId('TA'),
      class_id: kelas.class_id,
      teacher_id: teacherId,
      subject_id: mapel.subject_id,
      academic_year: _tahunAjaran(p.academic_year || kelas.academic_year),
      status: 'aktif',
      created_at: Util.sekarang(),
      updated_at: Util.sekarang()
    };
    Db.tambah('Teaching_Assignments', isi);
    Util.catatLog(sesi.user_id, 'CREATE', 'buat_penugasan ' +
                  isi.teaching_assignment_id + ' ' + kelas.name + '/' +
                  mapel.name, 'ok', sesi.role,
                  'Teaching_Assignments', isi.teaching_assignment_id);
    return { teaching_assignment_id: isi.teaching_assignment_id, baru: true };
  }

  /** Nonaktifkan / aktifkan penugasan (soft delete). */
  function penugasanUbahStatus(sesi, taId, status) {
    if (['aktif', 'nonaktif'].indexOf(status) === -1) {
      throw _err('VALIDASI_GAGAL', 'Status tidak sah.');
    }
    var ta = Db.cari('Teaching_Assignments', 'teaching_assignment_id', taId);
    if (!ta) throw _err('TIDAK_DITEMUKAN', 'Penugasan tidak ditemukan.');

    Db.perbarui('Teaching_Assignments', ta._baris,
                { status: status, updated_at: Util.sekarang() });
    Util.catatLog(sesi.user_id, 'UPDATE', 'penugasan_' + status, 'ok',
                  sesi.role, 'Teaching_Assignments', taId);
    return { teaching_assignment_id: taId, status: status };
  }

  /* ==================================================== TOPIK */

  /** Topik satu penugasan + jumlah item per topik. */
  function topikDaftar(taId) {
    var ta = Db.cari('Teaching_Assignments', 'teaching_assignment_id', taId);
    if (!ta) throw _err('TIDAK_DITEMUKAN', 'Penugasan tidak ditemukan.');

    var itemPer = {};
    Db.bacaKolom('Items', ['item_id', 'topic_id'])
      .forEach(function (i) {
        itemPer[i.topic_id] = (itemPer[i.topic_id] || 0) + 1;
      });

    var topik = Db.saring('Topics', { teaching_assignment_id: taId })
      .map(function (t) {
        return {
          topic_id: t.topic_id,
          title: t.title,
          description: t.description || '',
          status: t.status,
          sort_order: Number(t.sort_order) || 0,
          jml_item: itemPer[t.topic_id] || 0
        };
      })
      .sort(function (a, b) {
        return a.sort_order - b.sort_order ||
               String(a.topic_id).localeCompare(String(b.topic_id));
      });

    return { jml_topik: topik.length, topik: topik };
  }

  function topikSimpan(sesi, p) {
    /* ---- edit ---- */
    if (p.topic_id) {
      var ada = Db.cari('Topics', 'topic_id', p.topic_id);
      if (!ada) throw _err('TIDAK_DITEMUKAN', 'Topik tidak ditemukan.');

      var ubah = Util.isiBilaAda({}, p, {
        title:       _judul,
        description: function (v) {
          return String(v == null ? '' : v).trim().slice(0, 1000);
        }
      });
      if (ubah.title === '') {
        throw _err('VALIDASI_GAGAL', 'Judul topik tidak boleh dikosongkan.');
      }
      ubah.updated_at = Util.sekarang();
      Db.perbarui('Topics', ada._baris, ubah);
      Util.catatLog(sesi.user_id, 'UPDATE', 'edit_topik ' +
                    p.topic_id, 'ok', sesi.role, 'Topics', p.topic_id);
      return { topic_id: p.topic_id, baru: false };
    }

    /* ---- buat ---- */
    var ta = Db.cari('Teaching_Assignments', 'teaching_assignment_id',
                     p.teaching_assignment_id);
    if (!ta) throw _err('TIDAK_DITEMUKAN', 'Penugasan tidak ditemukan.');

    var judul = _judul(p.title);
    if (!judul) throw _err('VALIDASI_GAGAL', 'Judul topik wajib diisi.');

    var isi = {
      topic_id: Util.buatId('TPC'),
      teaching_assignment_id: ta.teaching_assignment_id,
      title: judul,
      description: String(p.description || '').trim().slice(0, 1000),
      status: 'draft',
      sort_order: _urutBerikut('Topics', 'teaching_assignment_id',
                               ta.teaching_assignment_id),
      created_at: Util.sekarang(),
      updated_at: Util.sekarang()
    };
    Db.tambah('Topics', isi);
    Util.catatLog(sesi.user_id, 'CREATE', 'buat_topik ' +
                  isi.topic_id + ' ' + judul, 'ok', sesi.role,
                  'Topics', isi.topic_id);
    return { topic_id: isi.topic_id, baru: true };
  }

  /** Terbitkan / jadikan draf kembali. */
  function topikUbahStatus(sesi, topicId, status) {
    if (['draft', 'publish'].indexOf(status) === -1) {
      throw _err('VALIDASI_GAGAL', 'Status tidak sah.');
    }
    var t = Db.cari('Topics', 'topic_id', topicId);
    if (!t) throw _err('TIDAK_DITEMUKAN', 'Topik tidak ditemukan.');

    Db.perbarui('Topics', t._baris,
                { status: status, updated_at: Util.sekarang() });
    Util.catatLog(sesi.user_id, 'UPDATE', 'topik_' + status, 'ok',
                  sesi.role, 'Topics', topicId);
    return { topic_id: topicId, status: status };
  }

  /**
   * Hapus topik — HANYA bila masih kosong. Topik berisi item
   * wajib dikosongkan dulu (data historis tidak dihapus diam-diam).
   */
  function topikHapus(sesi, topicId) {
    var t = Db.cari('Topics', 'topic_id', topicId);
    if (!t) throw _err('TIDAK_DITEMUKAN', 'Topik tidak ditemukan.');

    var item = Db.saringBaris('Items', 'topic_id', topicId, ['item_id']);
    if (item.length) {
      throw _err('VALIDASI_GAGAL', 'Topik masih berisi ' + item.length +
        ' item. Hapus item dulu.');
    }

    Db.hapus('Topics', t._baris);
    Util.catatLog(sesi.user_id, 'DELETE', 'hapus_topik ' + topicId,
                  'ok', sesi.role, 'Topics', topicId);
    return { dihapus: true };
  }

  /** Naik/turunkan topik (tukar sort_order dengan tetangga). */
  function topikPindah(sesi, topicId, arah) {
    var t = Db.cari('Topics', 'topic_id', topicId);
    if (!t) throw _err('TIDAK_DITEMUKAN', 'Topik tidak ditemukan.');
    return _pindahUrut(sesi, 'Topics', 'topic_id', 'teaching_assignment_id',
                       t, arah, 'topik');
  }

  /* ==================================================== ITEM */

  /** Item satu topik (urut sort_order). */
  function itemDaftar(topicId) {
    var topik = Db.cari('Topics', 'topic_id', topicId);
    if (!topik) throw _err('TIDAK_DITEMUKAN', 'Topik tidak ditemukan.');

    return Db.saring('Items', { topic_id: topicId })
      .map(function (i) {
        return {
          item_id: i.item_id,
          type: i.type,
          title: i.title,
          description: i.description || '',
          status: i.status,
          related_id: i.related_id || '',
          sort_order: Number(i.sort_order) || 0,
          ai_source: i.ai_source === true,
          ai_reviewed: i.ai_reviewed === true
        };
      })
      .sort(function (a, b) {
        return a.sort_order - b.sort_order ||
               String(a.item_id).localeCompare(String(b.item_id));
      });
  }

  /**
   * Buat/ubah item. Konten (HTML materi) disanitasi sebelum
   * disimpan — keyakinan sama seperti v1. related_id & penanda AI
   * TIDAK diterima dari klien (diisi tahap berikutnya).
   */
  /**
   * Detail penuh satu item (termasuk konten) — untuk editor guru.
   * Baca-saja; itemDaftar sengaja tanpa konten agar daftar tetap ringan,
   * bacaMateri khusus murid & hanya publish.
   */
  function itemDetail(itemId) {
    var i = Db.cari('Items', 'item_id', itemId);
    if (!i) throw _err('TIDAK_DITEMUKAN', 'Item tidak ditemukan.');
    return {
      item_id: i.item_id,
      topic_id: i.topic_id,
      type: i.type,
      title: i.title,
      description: i.description || '',
      content: i.content || '',
      status: i.status,
      related_id: i.related_id || '',
      ai_source: i.ai_source === true,
      ai_reviewed: i.ai_reviewed === true
    };
  }

  function itemSimpan(sesi, p) {
    /* ---- edit ---- */
    if (p.item_id) {
      var ada = Db.cari('Items', 'item_id', p.item_id);
      if (!ada) throw _err('TIDAK_DITEMUKAN', 'Item tidak ditemukan.');

      var ubah = Util.isiBilaAda({}, p, {
        title:       _judul,
        description: _deskripsiItem,
        content:     _konten
      });
      if (ubah.title === '') {
        throw _err('VALIDASI_GAGAL', 'Judul item tidak boleh dikosongkan.');
      }
      /* tipe hanya boleh berubah selama item belum tertaut */
      if (p.type !== undefined && !(ada.related_id)) {
        var tipe = String(p.type || '');
        if (TIPE_ITEM.indexOf(tipe) === -1) {
          throw _err('VALIDASI_GAGAL', 'Jenis item tidak dikenal: ' + tipe);
        }
        ubah.type = tipe;
      }
      ubah.updated_at = Util.sekarang();
      Db.perbarui('Items', ada._baris, ubah);
      Util.catatLog(sesi.user_id, 'UPDATE', 'edit_item ' +
                    p.item_id, 'ok', sesi.role, 'Items', p.item_id);
      return { item_id: p.item_id, baru: false };
    }

    /* ---- buat ---- */
    var topik = Db.cari('Topics', 'topic_id', p.topic_id);
    if (!topik) throw _err('TIDAK_DITEMUKAN', 'Topik tidak ditemukan.');

    var tipe = String(p.type || '');
    if (TIPE_ITEM.indexOf(tipe) === -1) {
      throw _err('VALIDASI_GAGAL', 'Jenis item tidak dikenal: ' + tipe);
    }
    var judul = _judul(p.title);
    if (!judul) throw _err('VALIDASI_GAGAL', 'Judul item wajib diisi.');

    var status = p.status === 'publish' ? 'publish' : 'draft';

    var isi = {
      item_id: Util.buatId('ITM'),
      topic_id: topik.topic_id,
      type: tipe,
      title: judul,
      description: _deskripsiItem(p.description),
      content: _konten(p.content),
      status: status,
      related_id: '',
      sort_order: _urutBerikut('Items', 'topic_id', topik.topic_id),
      ai_source: false,
      ai_reviewed: false,
      created_at: Util.sekarang(),
      updated_at: Util.sekarang()
    };
    Db.tambah('Items', isi);

    if (status === 'publish') _beriTahuKelas(topik, isi);

    Util.catatLog(sesi.user_id, 'CREATE', 'buat_item ' + isi.item_id +
                  ' ' + tipe + ' ' + judul, 'ok', sesi.role,
                  'Items', isi.item_id);
    return { item_id: isi.item_id, baru: true };
  }

  /**
   * Terbitkan / jadikan draf. Draf → publish menotify murid kelas
   * (jenis pertemuan_baru, judul khusus materi).
   */
  function itemUbahStatus(sesi, itemId, status) {
    if (['draft', 'publish'].indexOf(status) === -1) {
      throw _err('VALIDASI_GAGAL', 'Status tidak sah.');
    }
    var i = Db.cari('Items', 'item_id', itemId);
    if (!i) throw _err('TIDAK_DITEMUKAN', 'Item tidak ditemukan.');

    var terbit = i.status !== 'publish' && status === 'publish';
    Db.perbarui('Items', i._baris,
                { status: status, updated_at: Util.sekarang() });

    if (terbit) {
      var topik = Db.cari('Topics', 'topic_id', i.topic_id);
      if (topik && topik.status === 'publish') {
        _beriTahuKelas(topik, i);
      }
    }
    Util.catatLog(sesi.user_id, 'UPDATE', 'item_' + status, 'ok',
                  sesi.role, 'Items', itemId);
    return { item_id: itemId, status: status };
  }

  /**
   * Hapus item. Item yang sudah tertaut (quiz/tugas/refleksi
   * dari tahap berikutnya) tidak boleh dihapus lewat sini.
   */
  function itemHapus(sesi, itemId) {
    var i = Db.cari('Items', 'item_id', itemId);
    if (!i) throw _err('TIDAK_DITEMUKAN', 'Item tidak ditemukan.');
    if (i.related_id) {
      throw _err('VALIDASI_GAGAL',
        'Item sudah tertaut ke aktivitas. Nonaktifkan saja.');
    }

    Db.hapus('Items', i._baris);
    Util.catatLog(sesi.user_id, 'DELETE', 'hapus_item ' + itemId,
                  'ok', sesi.role, 'Items', itemId);
    return { dihapus: true };
  }

  /** Naik/turunkan item dalam satu topik. */
  function itemPindah(sesi, itemId, arah) {
    var i = Db.cari('Items', 'item_id', itemId);
    if (!i) throw _err('TIDAK_DITEMUKAN', 'Item tidak ditemukan.');
    return _pindahUrut(sesi, 'Items', 'item_id', 'topic_id',
                       i, arah, 'item');
  }

  /* ==================================================== MURID */

  /**
   * Topik milik satu penugasan untuk murid — HANYA yang publish,
   * HANYA bila murid terdaftar aktif di kelas penugasan dan
   * penugasan + kelas masih aktif.
   */
  function topikMurid(sesi, taId) {
    var ctx = _konteksMurid(sesi, taId);

    var itemPer = {};
    Db.bacaKolom('Items', ['item_id', 'topic_id', 'status'])
      .forEach(function (i) {
        if (i.status !== 'publish') return;
        itemPer[i.topic_id] = (itemPer[i.topic_id] || 0) + 1;
      });

    var topik = Db.saring('Topics',
        { teaching_assignment_id: taId, status: 'publish' })
      .map(function (t) {
        return {
          topic_id: t.topic_id,
          title: t.title,
          description: t.description || '',
          jml_item: itemPer[t.topic_id] || 0
        };
      })
      .sort(function (a, b) {
        return (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) ||
               String(a.topic_id).localeCompare(String(b.topic_id));
      });

    return {
      kelas: { class_id: ctx.kelas.class_id, name: ctx.kelas.name },
      mapel: { subject_id: ctx.mapel.subject_id, name: ctx.mapel.name },
      guru: ctx.guru,
      academic_year: ctx.ta.academic_year || '',
      topik: topik
    };
  }

  /** Isi satu topik untuk murid — item publish, TANPA konten. */
  function topikBuka(sesi, topicId) {
    var topik = Db.cari('Topics', 'topic_id', topicId);
    if (!topik || topik.status !== 'publish') {
      throw _err('TIDAK_DITEMUKAN', 'Topik tidak ditemukan.');
    }
    var ctx = _konteksMurid(sesi, topik.teaching_assignment_id);

    var item = Db.saring('Items', { topic_id: topicId, status: 'publish' })
      .map(function (i) {
        return {
          item_id: i.item_id,
          type: i.type,
          title: i.title,
          description: i.description || ''
        };
      })
      .sort(function (a, b) {
        return (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) ||
               String(a.item_id).localeCompare(String(b.item_id));
      });

    return {
      topic_id: topik.topic_id,
      title: topik.title,
      description: topik.description || '',
      kelas: ctx.kelas.name,
      mapel: ctx.mapel.name,
      item: item
    };
  }

  /**
   * Baca satu materi. Tahap ini baru menghidupkan type 'materi' —
   * quiz/tugas/refleksi menyusul di tahap berikutnya.
   */
  function materiBaca(sesi, itemId) {
    var i = Db.cari('Items', 'item_id', itemId);
    if (!i || i.status !== 'publish') {
      throw _err('TIDAK_DITEMUKAN', 'Materi tidak ditemukan.');
    }
    if (i.type !== 'materi') {
      throw _err('FITUR_BELUM_ADA',
        'Fitur untuk "' + i.type + '" menyusul di tahap berikutnya.');
    }

    var topik = Db.cari('Topics', 'topic_id', i.topic_id);
    if (!topik || topik.status !== 'publish') {
      throw _err('TIDAK_DITEMUKAN', 'Materi tidak ditemukan.');
    }
    _konteksMurid(sesi, topik.teaching_assignment_id);

    return {
      item_id: i.item_id,
      type: i.type,
      title: i.title,
      description: i.description || '',
      content: i.content || '',
      topic_id: topik.topic_id,
      topik: topik.title
    };
  }

  /* ==================================================== BANTU */

  function _err(kode, pesan) {
    var e = new Error(pesan);
    e.kode = kode;
    return e;
  }

  function _namaMapel(v) {
    return String(v == null ? '' : v).trim().slice(0, 120);
  }
  function _judul(v) {
    return String(v == null ? '' : v).trim().slice(0, 200);
  }
  function _deskripsiItem(v) {
    return String(v == null ? '' : v).trim().slice(0, 2000);
  }
  /** Konten materi: disanitasi + dibatasi (batas sel Sheets 50rb). */
  function _konten(v) {
    return Util.sanitasi(String(v == null ? '' : v)).slice(0, 45000);
  }
  function _tahunAjaran(v) {
    var t = String(v || '').trim();
    if (t && !/^\d{4}\/\d{4}$/.test(t)) {
      throw _err('VALIDASI_GAGAL', 'Tahun ajaran bertulis 2026/2027.');
    }
    return t;
  }

  /** teacher_id WAJIB akun guru aktif — tidak dipercaya dari klien. */
  function _validasiGuru(teacherId) {
    var u = Db.cariCepat('Users', 'user_id', teacherId);
    if (!u || u.role !== 'guru') {
      throw _err('VALIDASI_GAGAL', 'Pengampu harus akun guru.');
    }
    if (u.status !== 'aktif') {
      throw _err('VALIDASI_GAGAL', 'Akun guru tersebut nonaktif.');
    }
    return u.user_id;
  }

  /** Kombinasi aktif class+teacher+subject tidak boleh kembar. */
  function _tolakDuplikat(classId, teacherId, subjectId, kecualiTaId) {
    var kembar = Db.baca('Teaching_Assignments').some(function (t) {
      return t.status === 'aktif' &&
             t.class_id === classId &&
             t.teacher_id === teacherId &&
             t.subject_id === subjectId &&
             t.teaching_assignment_id !== kecualiTaId;
    });
    if (kembar) throw _err('DUPLIKAT', 'Penugasan itu sudah ada.');
  }

  /** sort_order berikutnya dalam satu induk (TA / topik). */
  function _urutBerikut(sheet, kolomInduk, idInduk) {
    var maks = 0;
    Db.bacaKolom(sheet, ['sort_order', kolomInduk])
      .forEach(function (r) {
        if (r[kolomInduk] !== idInduk) return;
        var n = Number(r.sort_order) || 0;
        if (n > maks) maks = n;
      });
    return maks + 1;
  }

  /** Tukar posisi baris dengan tetangganya (atas/bawah). */
  function _pindahUrut(sesi, sheet, kolId, kolInduk, baris, arah, label) {
    if (arah !== 'atas' && arah !== 'bawah') {
      throw _err('VALIDASI_GAGAL', 'Arah tidak sah.');
    }

    var urut = Db.saring(sheet, {})
      .filter(function (r) { return r[kolInduk] === baris[kolInduk]; })
      .sort(function (a, b) {
        return (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0);
      });

    var idx = -1;
    urut.forEach(function (r, n) { if (r[kolId] === baris[kolId]) idx = n; });
    var tetangga = arah === 'atas' ? idx - 1 : idx + 1;
    if (idx < 0 || tetangga < 0 || tetangga >= urut.length) {
      return { pindah: false };
    }

    Db.perbaruiBanyak(sheet, [
      { _baris: urut[idx]._baris,
        sort_order: Number(urut[tetangga].sort_order) || 0,
        updated_at: Util.sekarang() },
      { _baris: urut[tetangga]._baris,
        sort_order: Number(urut[idx].sort_order) || 0,
        updated_at: Util.sekarang() }
    ]);
    Util.catatLog(sesi.user_id, 'UPDATE', label + '_pindah_' + arah +
                  ' ' + baris[kolId], 'ok', sesi.role, sheet, baris[kolId]);
    return { pindah: true };
  }

  /**
   * Konteks murid untuk membaca materi: penugasan aktif + kelas
   * aktif + murid terdaftar aktif. Seluruh bacaan murid lewat sini.
   */
  function _konteksMurid(sesi, taId) {
    var ta = Db.cari('Teaching_Assignments', 'teaching_assignment_id', taId);
    if (!ta || ta.status !== 'aktif') {
      throw _err('TIDAK_DITEMUKAN', 'Penugasan tidak ditemukan.');
    }

    var kelas = Db.cari('Classes', 'class_id', ta.class_id);
    if (!kelas || kelas.status !== 'aktif') {
      throw _err('TIDAK_DITEMUKAN', 'Kelas tidak ditemukan.');
    }

    var enr = Db.cariCepat2('Enrollment', 'class_id', ta.class_id,
                            'user_id', sesi.user_id);
    if (!enr || enr.status !== 'aktif') {
      throw _err('AKSES_DITOLAK', 'Anda tidak terdaftar di kelas ini.');
    }

    var mapel = Db.cari('Subjects', 'subject_id', ta.subject_id);
    var guru = Db.cariCepat('Users', 'user_id', ta.teacher_id);

    return {
      ta: ta,
      kelas: { class_id: kelas.class_id, name: kelas.name },
      mapel: mapel ? { subject_id: mapel.subject_id, name: mapel.name }
                   : { subject_id: ta.subject_id, name: '(mapel dihapus)' },
      guru: guru ? guru.nama : ''
    };
  }

  /** Kabari murid kelas bahwa ada konten baru yang diterbitkan. */
  function _beriTahuKelas(topik, item) {
    var ta = Db.cari('Teaching_Assignments', 'teaching_assignment_id',
                     topik.teaching_assignment_id);
    if (!ta) return;
    Notif.kirimKeKelas(ta.class_id, 'pertemuan_baru',
      item.title, '', 'Materi baru tersedia');
  }

  /** Bandingkan teks dengan angka diurut sebagai angka. */
  function _banding(a, b) {
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

  return {
    /* mapel */
    daftar: daftar, simpan: simpan, ubahStatus: ubahStatus,
    guruAktif: guruAktif,
    /* penugasan */
    penugasanDaftar: penugasanDaftar, penugasanSimpan: penugasanSimpan,
    penugasanUbahStatus: penugasanUbahStatus,
    /* topik */
    topikDaftar: topikDaftar, topikSimpan: topikSimpan,
    topikUbahStatus: topikUbahStatus, topikHapus: topikHapus,
    topikPindah: topikPindah,
    /* item */
    itemDaftar: itemDaftar, itemSimpan: itemSimpan,
    itemUbahStatus: itemUbahStatus, itemHapus: itemHapus,
    itemPindah: itemPindah, itemDetail: itemDetail,
    /* murid */
    topikMurid: topikMurid, topikBuka: topikBuka, materiBaca: materiBaca
  };
})();
