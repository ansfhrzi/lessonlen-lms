/**
 * ============================================================
 *  LMS v2 — Topik.gs
 *  Layar Kelola Topik & Item (Tahap 4 poin 1).
 *  Acuan: DOKUMENTASI_RANCANGAN_LMS_GAS_v2.md §7.8 (Topics/Items)
 *  dan §7.8b (adendum alur course 2026-09).
 * ------------------------------------------------------------
 *  ATURAN INTI §7.8b:
 *   · Quiz & refleksi boleh MANDIRI (langsung di course, ta_id
 *     terisi, topic_id kosong); materi & tugas WAJIB bertopik.
 *   · Topik + item mandiri berbagi SATU susunan bernomor per
 *     course (sort_order bersama; baris baru SELALU paling dasar).
 *   · Item dalam topik memakai urutan dalamnya sendiri.
 *   · status: draft | publish | scheduled (+ publish_at).
 *     Menyembunyikan (draft) baris terjadwal = jadwal dibatalkan.
 *   · Jadwal (scheduled) = terlihat murid tepat pada waktunya,
 *     lazy tanpa trigger & tanpa notifikasi. Notifikasi
 *     `pertemuan_baru` HANYA saat publish eksplisit (seketika).
 * ============================================================
 */

var Topik = (function () {

  var JENIS_BARIS = ['topik', 'quiz_mandiri', 'refleksi_mandiri'];
  /* 5 jenis item dalam topik — persis enum §7.8 Items.type */
  var JENIS_ITEM = ['materi', 'tugas_individu', 'tugas_kelompok', 'quiz', 'refleksi'];
  var JENIS_MANDIRI = { quiz_mandiri: 'quiz', refleksi_mandiri: 'refleksi' };

  function _err(kode, pesan) {
    var e = new Error(pesan); e.kode = kode; throw e;
  }

  function _kini() { return Util.sekarang(); }

  function _teks(v, maks, nama) {
    var t = String(v == null ? '' : v).trim();
    if (!t) _err('VALIDASI_GAGAL', nama + ' wajib diisi.');
    if (t.length > maks) _err('VALIDASI_GAGAL', nama + ' maksimal ' + maks + ' karakter.');
    return t;
  }

  function _statusOk(s) { return s === 'draft' || s === 'publish' || s === 'scheduled'; }

  /** Normalisasi isian datetime-local → 'YYYY-MM-DD HH:mm' (string). */
  function _normJadwal(v) {
    var t = String(v == null ? '' : v).trim().replace(' ', 'T');
    if (!t) return '';
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t)) {
      _err('VALIDASI_GAGAL', 'Format jadwal tidak dikenal.');
    }
    return t.slice(0, 16).replace('T', ' ');
  }

  /* -------------------------------------------------- kepemilikan */

  function _ta(sesi, taId) {
    var ta = Db.cari('Teaching_Assignments', 'teaching_assignment_id', taId);
    if (!ta || ta.teacher_id !== sesi.user_id) {
      _err('TIDAK_DITEMUKAN', 'Course tidak ditemukan.');
    }
    return ta;
  }

  function _topik(sesi, topicId) {
    var t = Db.cari('Topics', 'topic_id', topicId);
    if (!t) _err('TIDAK_DITEMUKAN', 'Topik tidak ditemukan.');
    _ta(sesi, t.teaching_assignment_id);
    return t;
  }

  function _item(sesi, itemId) {
    var it = Db.cari('Items', 'item_id', itemId);
    if (!it) _err('TIDAK_DITEMUKAN', 'Item tidak ditemukan.');
    if (it.topic_id) {
      var t = Db.cari('Topics', 'topic_id', it.topic_id);
      if (!t) _err('TIDAK_DITEMUKAN', 'Topik induk tidak ditemukan.');
      _ta(sesi, t.teaching_assignment_id);
    } else {
      _ta(sesi, it.ta_id);
    }
    return it;
  }

  /* -------------------------------------------------- susunan gabungan */

  function _barisGabungan(taId) {
    var semua = [];
    Db.saring('Topics', { teaching_assignment_id: taId }).forEach(function (t) {
      semua.push({ tipe: 'topik', sheet: 'Topics', row: t, urut: Number(t.sort_order) || 0 });
    });
    Db.saring('Items', { ta_id: taId }).forEach(function (it) {
      semua.push({ tipe: 'mandiri', sheet: 'Items', row: it, urut: Number(it.sort_order) || 0 });
    });
    semua.sort(function (a, b) { return a.urut - b.urut; });
    semua.forEach(function (b, i) { b.urut = i + 1; });   /* 1..N */
    return semua;
  }

  function _itemTopik(topicId) {
    return Db.saring('Items', { topic_id: topicId })
      .sort(function (a, b) { return (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0); });
  }

  function _bentukItem(it) {
    return { id: it.item_id, jenis: it.type, judul: it.title,
             deskripsi: it.description || '', status: it.status,
             publish_at: it.publish_at || '' };
  }

  /**
   * Susunan lengkap satu course untuk layar guru.
   * → { course: {...}, baris: [ {tipe,id,jenis,judul,deskripsi,status,
   *      publish_at, item:[…]} ] } — terurut 1..N gabungan.
   */
  function susunan(sesi, taId) {
    var ta = _ta(sesi, taId);
    var baris = _barisGabungan(taId).map(function (b) {
      if (b.tipe === 'topik') {
        return { tipe: 'topik', id: b.row.topic_id, jenis: 'topik',
                 urutan: b.urut,
                 judul: b.row.title, deskripsi: b.row.description || '',
                 status: b.row.status, publish_at: b.row.publish_at || '',
                 item: _itemTopik(b.row.topic_id).map(_bentukItem) };
      }
      return { tipe: 'mandiri', id: b.row.item_id,
               jenis: b.row.type === 'refleksi' ? 'refleksi_mandiri' : 'quiz_mandiri',
               urutan: b.urut,
               judul: b.row.title, deskripsi: b.row.description || '',
               status: b.row.status, publish_at: b.row.publish_at || '',
               item: null };
    });
    return { course: Course.detail(sesi, taId), baris: baris };
  }

  /* -------------------------------------------------- urutan */

  /** Tulis ulang sort_order 1..N lalu simpan sekali per sheet. */
  function _renumber(daftar) {
    var perSheet = {};
    daftar.forEach(function (b, i) {
      b.row.sort_order = i + 1;
      (perSheet[b.sheet] = perSheet[b.sheet] || []).push(b.row);
    });
    Object.keys(perSheet).forEach(function (sh) {
      Db.perbaruiBanyak(sh, perSheet[sh].map(function (r) {
        return { _baris: r._baris, sort_order: r.sort_order, updated_at: _kini() };
      }));
    });
  }

  function _urutBerikut(taId) {
    var semua = _barisGabungan(taId);
    return semua.length ? semua[semua.length - 1].urut + 1 : 1;
  }

  /* -------------------------------------------------- notifikasi */

  /** Publish eksplisit → notifikasi `pertemuan_baru` ke murid aktif
   *  kelas course (§7.8b poin 3: hanya publish eksplisit). */
  function _notifikasiPertemuanBaru(ta, judul) {
    var kelas = ta.class_id;
    var mapel = '';
    var subj = Db.cari('Subjects', 'subject_id', ta.subject_id);
    if (subj) mapel = subj.name;
    Db.saring('Enrollment', { class_id: kelas, status: 'aktif' }).forEach(function (e) {
      Db.tambah('Notifications', {
        notif_id: Util.buatId('NTF'), user_id: e.user_id,
        jenis: 'pertemuan_baru',
        judul: 'Pertemuan baru: ' + judul,
        pesan: mapel ? ('Materi baru di course ' + mapel + '.') : 'Ada materi baru di course Anda.',
        link: '', dibaca: false, created_at: _kini()
      });
    });
  }

  /* -------------------------------------------------- baris course */

  /**
   * Buat baris baru — SELALU paling dasar (§7.8b poin 4).
   * p = { jenis_baris: 'topik'|'quiz_mandiri'|'refleksi_mandiri',
   *       judul, deskripsi?, status? ('draft'|'publish', default draft) }
   */
  function buatBaris(sesi, taId, p) {
    p = p || {};
    var ta = _ta(sesi, taId);
    var jenis = p.jenis_baris;
    if (JENIS_BARIS.indexOf(jenis) === -1) {
      _err('VALIDASI_GAGAL', 'Jenis baris tidak dikenal.');
    }
    var judul = _teks(p.judul, 120, 'Judul');
    var desk = String(p.deskripsi == null ? '' : p.deskripsi).trim().slice(0, 500);
    var status = p.status === 'publish' ? 'publish' : 'draft';
    var urut = _urutBerikut(taId);

    if (jenis === 'topik') {
      var id = Util.buatId('TPC');
      Db.tambah('Topics', {
        topic_id: id, teaching_assignment_id: taId,
        title: judul, description: desk,
        status: status, publish_at: '', sort_order: urut,
        created_at: _kini(), updated_at: _kini()
      });
      if (status === 'publish') _notifikasiPertemuanBaru(ta, judul);
      return { baru: true, tipe: 'topik', id: id };
    }

    var idItm = Util.buatId('ITM');
    Db.tambah('Items', {
      item_id: idItm, topic_id: '', ta_id: taId,
      type: JENIS_MANDIRI[jenis], title: judul, description: desk,
      status: status, publish_at: '', related_id: '', sort_order: urut,
      created_at: _kini(), updated_at: _kini()
    });
    if (status === 'publish') _notifikasiPertemuanBaru(ta, judul);
    return { baru: true, tipe: 'mandiri', id: idItm };
  }

  /**
   * Ubah baris (judul/deskripsi/status). Jenis TIDAK dapat diubah.
   * draft→publish dianggap publish eksplisit → notifikasi.
   */
  function ubahBaris(sesi, tipe, id, p) {
    p = p || {};
    var judul = _teks(p.judul, 120, 'Judul');
    var desk = String(p.deskripsi == null ? '' : p.deskripsi).trim().slice(0, 500);
    var status = p.status === 'publish' ? 'publish' : 'draft';
    var b = _cariBaris(sesi, tipe, id);
    var lama = b.row.status;
    Db.perbarui(b.sheet, b.row._baris, {
      title: judul, description: desk, status: status,
      publish_at: status === 'draft' ? '' : (b.row.publish_at || ''),
      updated_at: _kini()
    });
    if (lama !== 'publish' && status === 'publish') {
      _notifikasiPertemuanBaru(_ta(sesi, _taIdBaris(b)), judul);
    }
    return { diubah: true };
  }

  /** Hapus baris. Topik ikut menghapus seluruh item di dalamnya. */
  function hapusBaris(sesi, tipe, id) {
    var b = _cariBaris(sesi, tipe, id);
    if (b.tipe === 'topik') {
      var anak = _itemTopik(id);
      Db.hapusBanyak('Items', anak.map(function (x) { return x._baris; }));
    }
    Db.hapus(b.sheet, b.row._baris);
    return { terhapus: true };
  }

  /**
   * 👁/🙈 — publish eksplisit (notif) atau draf (jadwal dibatalkan).
   * status ∈ 'publish' | 'draft'.
   */
  function ubahStatusBaris(sesi, tipe, id, status) {
    if (status !== 'publish' && status !== 'draft') {
      _err('VALIDASI_GAGAL', 'Status harus publish atau draft.');
    }
    var b = _cariBaris(sesi, tipe, id);
    var lama = b.row.status;
    /* 👁 publish eksplisit & 🙈 draf sama-sama mengosongkan jadwal:
       publish = terbit sekarang; draft = jadwal dibatalkan (§7.8b-2) */
    Db.perbarui(b.sheet, b.row._baris, {
      status: status, publish_at: '', updated_at: _kini()
    });
    if (lama !== 'publish' && status === 'publish') {
      _notifikasiPertemuanBaru(_ta(sesi, _taIdBaris(b)), b.row.title);
    }
    return { status: status };
  }

  /**
   * 🕐 jadwal terbit — status 'scheduled' + publish_at; murid melihat
   * tepat pada waktunya (lazy, tanpa notifikasi). publishAt kosong
   * → jadwal dikosongkan, kembali publish.
   */
  function aturJadwalBaris(sesi, tipe, id, publishAt) {
    var jadwal = _normJadwal(publishAt);
    var b = _cariBaris(sesi, tipe, id);
    Db.perbarui(b.sheet, b.row._baris, {
      status: jadwal ? 'scheduled' : 'publish',
      publish_at: jadwal, updated_at: _kini()
    });
    return { status: jadwal ? 'scheduled' : 'publish', publish_at: jadwal };
  }

  /** ▲▼ tukar posisi tetangga dalam susunan gabungan + renumber. */
  function pindahBaris(sesi, tipe, id, arah) {
    if (arah !== 'atas' && arah !== 'bawah') {
      _err('VALIDASI_GAGAL', 'Arah harus atas atau bawah.');
    }
    var taId = _taIdBaris(_cariBaris(sesi, tipe, id));
    var semua = _barisGabungan(taId);
    var i = -1;
    semua.forEach(function (b, idx) {
      var bid = b.tipe === 'topik' ? b.row.topic_id : b.row.item_id;
      if (b.tipe === tipe && bid === id) i = idx;
    });
    if (i < 0) _err('TIDAK_DITEMUKAN', 'Baris tidak ditemukan.');
    var lawan = arah === 'atas' ? i - 1 : i + 1;
    if (lawan < 0 || lawan >= semua.length) return { pindah: false };
    var tmp = semua[i]; semua[i] = semua[lawan]; semua[lawan] = tmp;
    _renumber(semua);
    return { pindah: true };
  }

  /* -------------------------------------------------- item dalam topik */

  function _cariBaris(sesi, tipe, id) {
    if (tipe === 'topik') {
      var t = Db.cari('Topics', 'topic_id', id);
      if (!t) _err('TIDAK_DITEMUKAN', 'Topik tidak ditemukan.');
      _ta(sesi, t.teaching_assignment_id);
      return { tipe: 'topik', sheet: 'Topics', row: t };
    }
    var it = _item(sesi, id);
    return { tipe: 'mandiri', sheet: 'Items', row: it };
  }

  function _taIdBaris(b) {
    return b.tipe === 'topik'
      ? b.row.teaching_assignment_id
      : (b.row.topic_id
          ? Db.cari('Topics', 'topic_id', b.row.topic_id).teaching_assignment_id
          : b.row.ta_id);
  }

  /** Buat item dalam topik — SELALU paling dasar topiknya. */
  function buatItem(sesi, topicId, p) {
    p = p || {};
    var t = _topik(sesi, topicId);
    if (JENIS_ITEM.indexOf(p.type) === -1) {
      _err('VALIDASI_GAGAL', 'Jenis item tidak dikenal.');
    }
    var judul = _teks(p.judul, 120, 'Judul');
    var desk = String(p.deskripsi == null ? '' : p.deskripsi).trim().slice(0, 500);
    var status = p.status === 'publish' ? 'publish' : 'draft';
    var urut = _itemTopik(topicId).length + 1;
    var id = Util.buatId('ITM');
    Db.tambah('Items', {
      item_id: id, topic_id: topicId, ta_id: '',
      type: p.type, title: judul, description: desk,
      status: status, publish_at: '', related_id: '', sort_order: urut,
      created_at: _kini(), updated_at: _kini()
    });
    if (status === 'publish') {
      _notifikasiPertemuanBaru(_ta(sesi, t.teaching_assignment_id), judul);
    }
    return { baru: true, id: id };
  }

  function ubahItem(sesi, itemId, p) {
    p = p || {};
    var it = _item(sesi, itemId);
    if (it.ta_id) _err('VALIDASI_GAGAL', 'Item mandiri diubah lewat baris course.');
    var judul = _teks(p.judul, 120, 'Judul');
    var desk = String(p.deskripsi == null ? '' : p.deskripsi).trim().slice(0, 500);
    var status = p.status === 'publish' ? 'publish' : 'draft';
    var lama = it.status;
    Db.perbarui('Items', it._baris, {
      title: judul, description: desk, status: status,
      publish_at: status === 'draft' ? '' : (it.publish_at || ''),
      updated_at: _kini()
    });
    if (lama !== 'publish' && status === 'publish') {
      var t = Db.cari('Topics', 'topic_id', it.topic_id);
      _notifikasiPertemuanBaru(_ta(sesi, t.teaching_assignment_id), judul);
    }
    return { diubah: true };
  }

  function hapusItem(sesi, itemId) {
    var it = _item(sesi, itemId);
    Db.hapus('Items', it._baris);
    return { terhapus: true };
  }

  function ubahStatusItem(sesi, itemId, status) {
    if (status !== 'publish' && status !== 'draft') {
      _err('VALIDASI_GAGAL', 'Status harus publish atau draft.');
    }
    var it = _item(sesi, itemId);
    var lama = it.status;
    Db.perbarui('Items', it._baris, {
      status: status, publish_at: '', updated_at: _kini()
    });
    if (lama !== 'publish' && status === 'publish') {
      var t = Db.cari('Topics', 'topic_id', it.topic_id);
      _notifikasiPertemuanBaru(_ta(sesi, t.teaching_assignment_id), it.title);
    }
    return { status: status };
  }

  function aturJadwalItem(sesi, itemId, publishAt) {
    var jadwal = _normJadwal(publishAt);
    var it = _item(sesi, itemId);
    Db.perbarui('Items', it._baris, {
      status: jadwal ? 'scheduled' : 'publish',
      publish_at: jadwal, updated_at: _kini()
    });
    return { status: jadwal ? 'scheduled' : 'publish', publish_at: jadwal };
  }

  /** ▲▼ item: tukar tetangga DI DALAM topiknya + renumber. */
  function pindahItem(sesi, topicId, itemId, arah) {
    if (arah !== 'atas' && arah !== 'bawah') {
      _err('VALIDASI_GAGAL', 'Arah harus atas atau bawah.');
    }
    _topik(sesi, topicId);
    var daftar = _itemTopik(topicId);
    var i = -1;
    daftar.forEach(function (x, idx) { if (x.item_id === itemId) i = idx; });
    if (i < 0) _err('TIDAK_DITEMUKAN', 'Item tidak ditemukan di topik ini.');
    var lawan = arah === 'atas' ? i - 1 : i + 1;
    if (lawan < 0 || lawan >= daftar.length) return { pindah: false };
    var tmp = daftar[i]; daftar[i] = daftar[lawan]; daftar[lawan] = tmp;
    Db.perbaruiBanyak('Items', daftar.map(function (x, idx) {
      return { _baris: x._baris, sort_order: idx + 1, updated_at: _kini() };
    }));
    return { pindah: true };
  }

  return {
    susunan: susunan,
    buatBaris: buatBaris, ubahBaris: ubahBaris, hapusBaris: hapusBaris,
    ubahStatusBaris: ubahStatusBaris, aturJadwalBaris: aturJadwalBaris,
    pindahBaris: pindahBaris,
    buatItem: buatItem, ubahItem: ubahItem, hapusItem: hapusItem,
    ubahStatusItem: ubahStatusItem, aturJadwalItem: aturJadwalItem,
    pindahItem: pindahItem
  };
})();
