/**
 * LessonLen v2 — Belajar.gs
 * Sisi murid. Prinsip: 1 panggilan untuk buka bab, tulis hanya saat aksi.
 */

var Belajar = (function () {

  function _enroll(userId, kelasId) {
    var ada = Db.saring('enrollment', { user_id: userId, kelas_id: kelasId, status: 'aktif' });
    if (!ada.length) throw Util.err('AKSES_DITOLAK', 'Anda tidak terdaftar di kelas ini.');
  }

  function _petaProgres(userId) {
    var peta = {};
    Db.saring('progress', { user_id: userId }).forEach(function (r) {
      peta[r.item_id] = r;
    });
    return peta;
  }

  function _petaLkpd(userId) {
    var peta = {};
    Db.saring('lkpd_submission', { user_id: userId }).forEach(function (r) {
      var lama = peta[r.item_id];
      if (!lama || r._baris > lama._baris) peta[r.item_id] = r;
    });
    return peta;
  }

  function _petaQuiz(userId) {
    var peta = {};
    Db.saring('quiz_attempt', { user_id: userId }).forEach(function (r) {
      if (r.status !== 'selesai') return;
      var lama = peta[r.item_id];
      var n = Number(r.nilai) || 0;
      if (!lama || n > (Number(lama.nilai) || 0)) peta[r.item_id] = r;
    });
    return peta;
  }

  function _rekapBab(items, petaP, petaL, petaQ) {
    var materi = items.filter(function (i) { return i.tipe === 'materi'; });
    var tugas = items.filter(function (i) { return i.tipe !== 'materi'; });
    var mOk = materi.filter(function (i) {
      return petaP[i.item_id] && Util.ya(petaP[i.item_id].ditandai);
    }).length;
    var tOk = tugas.filter(function (i) {
      if (i.tipe === 'lkpd') {
        var s = petaL[i.item_id];
        return s && (s.status === 'menunggu' || s.status === 'diterima');
      }
      if (i.tipe === 'quiz') return !!petaQ[i.item_id];
      return false;
    }).length;
    return {
      materi_selesai: mOk, materi_total: materi.length,
      tugas_selesai: tOk, tugas_total: tugas.length
    };
  }

  function _progresItem(item, petaP, petaL, petaQ) {
    var pr = petaP[item.item_id];
    var out = { ditandai: !!(pr && Util.ya(pr.ditandai)), nilai: pr ? pr.nilai : '' };
    if (item.tipe === 'lkpd') {
      var s = petaL[item.item_id];
      out.lkpd_status = s ? s.status : '';
      out.lkpd_nilai = s ? s.nilai : '';
      out.lkpd_catatan = s ? (s.catatan_guru || '') : '';
      out.lkpd_links = s ? s.links : '';
    }
    if (item.tipe === 'quiz') {
      var q = petaQ[item.item_id];
      out.quiz_nilai = q ? q.nilai : '';
      out.quiz_lulus = q ? Util.ya(q.lulus) : false;
    }
    return out;
  }

  /** Satu panggilan: daftar kelas + bab (tanpa konten). */
  function beranda(sesi) {
    if (sesi.role === 'guru') return Guru.beranda(sesi);

    var enroll = Db.saring('enrollment', { user_id: sesi.user_id, status: 'aktif' });
    var petaP = _petaProgres(sesi.user_id);
    var petaL = _petaLkpd(sesi.user_id);
    var petaQ = _petaQuiz(sesi.user_id);
    var now = Date.now();

    var kelas = enroll.map(function (e) {
      var k = Db.cari('kelas', 'kelas_id', e.kelas_id);
      if (!k || k.status === 'arsip') return null;
      var bab = Db.saring('bab', { kelas_id: k.kelas_id })
        .filter(function (b) { return Akses.babTerbit(b); })
        .sort(function (a, b) { return Number(a.urutan) - Number(b.urutan); });
      var items = Db.saring('item', { kelas_id: k.kelas_id, status: 'publish' });

      var daftarBab = bab.map(function (b) {
        var milik = items.filter(function (i) { return i.bab_id === b.bab_id; });
        var r = _rekapBab(milik, petaP, petaL, petaQ);
        return {
          bab_id: b.bab_id, urutan: Number(b.urutan), judul: b.judul,
          deskripsi: b.deskripsi || '',
          terbuka: Akses.babTerbuka(b, now),
          akses: b.akses, buka_at: b.buka_at || '', tutup_at: b.tutup_at || '',
          rekap: r
        };
      });

      var semua = items;
      var rk = _rekapBab(semua, petaP, petaL, petaQ);
      return {
        kelas_id: k.kelas_id, nama_kelas: k.nama_kelas, mapel: k.mapel,
        rekap: rk, bab: daftarBab
      };
    }).filter(function (x) { return !!x; });

    return { user: { nama: sesi.nama, role: sesi.role }, kelas: kelas };
  }

  /**
   * SATU muat: seluruh item bab + konten yang terbuka.
   * Quiz tidak membawa soal/kunci.
   */
  function bukaBab(sesi, babId) {
    var bab = Db.cari('bab', 'bab_id', babId);
    if (!bab || bab.status !== 'publish') {
      throw Util.err('TIDAK_DITEMUKAN', 'Bab tidak ditemukan atau belum diterbitkan.');
    }
    _enroll(sesi.user_id, bab.kelas_id);
    var now = Date.now();
    if (!Akses.babTerbuka(bab, now)) {
      throw Util.err('DITUTUP', 'Bab ini belum dibuka guru.');
    }

    var kelas = Db.cari('kelas', 'kelas_id', bab.kelas_id);
    var items = Db.saring('item', { bab_id: babId })
      .sort(function (a, b) { return Number(a.urutan) - Number(b.urutan); });
    var petaP = _petaProgres(sesi.user_id);
    var petaL = _petaLkpd(sesi.user_id);
    var petaQ = _petaQuiz(sesi.user_id);
    var soalHitung = {};
    Db.baca('soal').forEach(function (s) {
      soalHitung[s.item_id] = (soalHitung[s.item_id] || 0) + 1;
    });

    var daftar = [];
    items.forEach(function (i) {
      var st = Akses.statusItem(bab, i, now);
      if (st === 'tersembunyi') return;
      var row = {
        item_id: i.item_id, tipe: i.tipe, grup: i.grup || '',
        urutan: Number(i.urutan), judul: i.judul,
        terbuka: st === 'terbuka',
        konten: '',
        progres: _progresItem(i, petaP, petaL, petaQ)
      };
      if (st === 'terbuka') {
        if (i.tipe === 'quiz') {
          row.konten = i.konten || '';
          row.quiz_meta = {
            jml_soal: soalHitung[i.item_id] || 0,
            kkm: Number(i.kkm) || 0,
            max_percobaan: Number(i.max_percobaan) || 0
          };
        } else {
          row.konten = i.konten || '';
        }
      }
      daftar.push(row);
    });

    var grupUrut = [];
    var petaG = {};
    daftar.forEach(function (i) {
      var n = i.grup || 'Umum';
      if (!petaG[n]) {
        petaG[n] = { nama: n, item: [] };
        grupUrut.push(petaG[n]);
      }
      petaG[n].item.push(i);
    });

    return {
      bab: { bab_id: bab.bab_id, judul: bab.judul, deskripsi: bab.deskripsi || '' },
      kelas: { kelas_id: kelas.kelas_id, nama_kelas: kelas.nama_kelas, mapel: kelas.mapel },
      grup: grupUrut,
      rekap: _rekapBab(items.filter(function (i) { return i.status === 'publish'; }),
                       petaP, petaL, petaQ)
    };
  }

  function tandaiSelesai(sesi, itemId, selesai) {
    var item = Db.cari('item', 'item_id', itemId);
    if (!item || item.tipe !== 'materi') {
      throw Util.err('VALIDASI_GAGAL', 'Hanya materi yang ditandai selesai.');
    }
    var bab = Db.cari('bab', 'bab_id', item.bab_id);
    _enroll(sesi.user_id, item.kelas_id);
    if (Akses.statusItem(bab, item) !== 'terbuka') {
      throw Util.err('DITUTUP', 'Materi ini sedang ditutup.');
    }

    var ada = Db.saring('progress', { user_id: sesi.user_id, item_id: itemId })[0];
    var now = Util.sekarang();
    var flag = !!selesai;
    if (ada) {
      Db.perbarui('progress', ada._baris, {
        ditandai: flag,
        ditandai_at: flag ? now : '',
        updated_at: now
      });
    } else if (flag) {
      Db.tambah('progress', {
        progress_id: Util.buatId('PRG'),
        user_id: sesi.user_id, item_id: itemId,
        bab_id: item.bab_id, kelas_id: item.kelas_id, tipe: 'materi',
        ditandai: true, ditandai_at: now, nilai: '', updated_at: now
      });
    }

    var items = Db.saring('item', { bab_id: item.bab_id, status: 'publish' });
    return {
      ditandai: flag,
      rekap: _rekapBab(items, _petaProgres(sesi.user_id),
                       _petaLkpd(sesi.user_id), _petaQuiz(sesi.user_id))
    };
  }

  function kumpulkanLkpd(sesi, itemId, links, catatan) {
    var item = Db.cari('item', 'item_id', itemId);
    if (!item || item.tipe !== 'lkpd') throw Util.err('VALIDASI_GAGAL', 'Bukan LKPD.');
    var bab = Db.cari('bab', 'bab_id', item.bab_id);
    _enroll(sesi.user_id, item.kelas_id);
    if (Akses.statusItem(bab, item) !== 'terbuka') {
      throw Util.err('DITUTUP', 'LKPD ini sedang ditutup.');
    }
    var arr = Array.isArray(links) ? links : [];
    arr = arr.map(function (x) { return String(x || '').trim(); }).filter(function (x) { return x; });
    if (!arr.length) throw Util.err('VALIDASI_GAGAL', 'Tempel minimal satu tautan.');
    if (arr.length > 5) throw Util.err('VALIDASI_GAGAL', 'Maksimal 5 tautan.');
    arr.forEach(function (u) {
      if (!/^https?:\/\//i.test(u)) throw Util.err('VALIDASI_GAGAL', 'Tautan harus diawali http:// atau https://');
    });

    var ada = Db.saring('lkpd_submission', { user_id: sesi.user_id, item_id: itemId })[0];
    if (ada && (ada.status === 'menunggu' || ada.status === 'diterima')) {
      throw Util.err('VALIDASI_GAGAL', 'LKPD sudah dikumpulkan.');
    }
    var now = Util.sekarang();
    var payload = {
      links: JSON.stringify(arr),
      catatan_murid: String(catatan || '').slice(0, 500),
      status: 'menunggu', nilai: '', catatan_guru: '',
      waktu_kumpul: now, waktu_dinilai: ''
    };
    if (ada) {
      Db.perbarui('lkpd_submission', ada._baris, payload);
    } else {
      payload.submission_id = Util.buatId('LKP');
      payload.user_id = sesi.user_id;
      payload.item_id = itemId;
      payload.kelas_id = item.kelas_id;
      Db.tambah('lkpd_submission', payload);
    }
    var items = Db.saring('item', { bab_id: item.bab_id, status: 'publish' });
    return {
      status: 'menunggu',
      rekap: _rekapBab(items, _petaProgres(sesi.user_id),
                       _petaLkpd(sesi.user_id), _petaQuiz(sesi.user_id))
    };
  }

  function mulaiQuiz(sesi, itemId) {
    var item = Db.cari('item', 'item_id', itemId);
    if (!item || item.tipe !== 'quiz') throw Util.err('VALIDASI_GAGAL', 'Bukan quiz.');
    var bab = Db.cari('bab', 'bab_id', item.bab_id);
    _enroll(sesi.user_id, item.kelas_id);
    if (Akses.statusItem(bab, item) !== 'terbuka') {
      throw Util.err('DITUTUP', 'Quiz ini sedang ditutup.');
    }
    var max = Number(item.max_percobaan) || 0;
    var semua = Db.saring('quiz_attempt', { user_id: sesi.user_id, item_id: itemId });
    var berjalan = null;
    semua.forEach(function (a) { if (a.status === 'berjalan') berjalan = a; });
    var selesaiN = semua.filter(function (a) { return a.status === 'selesai'; }).length;

    if (berjalan) {
      return _payloadQuiz(item, berjalan);
    }
    if (max && selesaiN >= max) {
      throw Util.err('VALIDASI_GAGAL', 'Kesempatan mengerjakan sudah habis.');
    }

    var att = {
      attempt_id: Util.buatId('ATT'),
      user_id: sesi.user_id, item_id: itemId,
      percobaan_ke: selesaiN + 1, status: 'berjalan',
      jawaban: '', nilai: '', lulus: false,
      mulai_at: Util.sekarang(), selesai_at: ''
    };
    Db.tambah('quiz_attempt', att);
    return _payloadQuiz(item, att);
  }

  function _payloadQuiz(item, att) {
    var soal = Db.saring('soal', { item_id: item.item_id })
      .sort(function (a, b) { return Number(a.nomor) - Number(b.nomor); })
      .map(function (s) {
        var opsi = [];
        try { opsi = JSON.parse(s.opsi || '[]'); } catch (e) { opsi = []; }
        return {
          soal_id: s.soal_id, nomor: Number(s.nomor), tipe: s.tipe || 'pg',
          pertanyaan: s.pertanyaan, opsi: opsi
        };
      });
    return {
      attempt_id: att.attempt_id,
      item_id: item.item_id,
      judul: item.judul,
      kkm: Number(item.kkm) || 0,
      percobaan_ke: Number(att.percobaan_ke) || 1,
      soal: soal
    };
  }

  function kumpulkanQuiz(sesi, attemptId, jawaban) {
    var att = Db.cari('quiz_attempt', 'attempt_id', attemptId);
    if (!att || att.user_id !== sesi.user_id) {
      throw Util.err('TIDAK_DITEMUKAN', 'Percobaan tidak ditemukan.');
    }
    if (att.status !== 'berjalan') {
      throw Util.err('VALIDASI_GAGAL', 'Quiz ini sudah dikumpulkan.');
    }
    var item = Db.cari('item', 'item_id', att.item_id);
    var bab = Db.cari('bab', 'bab_id', item.bab_id);
    if (Akses.statusItem(bab, item) !== 'terbuka') {
      throw Util.err('DITUTUP', 'Quiz ini sedang ditutup.');
    }
    var jawab = jawaban || {};
    var soal = Db.saring('soal', { item_id: item.item_id });
    var skor = 0, maks = 0;
    var kunci = {};
    soal.forEach(function (s) {
      var bobot = Number(s.bobot) || 1;
      maks += bobot;
      var j = String(jawab[s.soal_id] || '').trim().toUpperCase();
      var k = String(s.kunci || '').trim().toUpperCase();
      if (j && j === k) skor += bobot;
      kunci[s.soal_id] = { kunci: s.kunci, benar: j === k };
    });
    var nilai = maks ? Math.round(skor / maks * 100) : 0;
    var kkm = Number(item.kkm) || 0;
    var lulus = kkm ? nilai >= kkm : true;
    var now = Util.sekarang();
    Db.perbarui('quiz_attempt', att._baris, {
      status: 'selesai',
      jawaban: JSON.stringify(jawab),
      nilai: nilai, lulus: lulus, selesai_at: now
    });

    var adaP = Db.saring('progress', { user_id: sesi.user_id, item_id: item.item_id })[0];
    var nilaiSimpan = nilai;
    if (adaP && Number(adaP.nilai) > nilai) nilaiSimpan = Number(adaP.nilai);
    if (adaP) {
      Db.perbarui('progress', adaP._baris, { nilai: nilaiSimpan, updated_at: now });
    } else {
      Db.tambah('progress', {
        progress_id: Util.buatId('PRG'),
        user_id: sesi.user_id, item_id: item.item_id,
        bab_id: item.bab_id, kelas_id: item.kelas_id, tipe: 'quiz',
        ditandai: false, ditandai_at: '', nilai: nilaiSimpan, updated_at: now
      });
    }

    var items = Db.saring('item', { bab_id: item.bab_id, status: 'publish' });
    return {
      nilai: nilai, lulus: lulus, kkm: kkm, kunci: kunci,
      rekap: _rekapBab(items, _petaProgres(sesi.user_id),
                       _petaLkpd(sesi.user_id), _petaQuiz(sesi.user_id))
    };
  }

  return {
    beranda: beranda,
    bukaBab: bukaBab,
    tandaiSelesai: tandaiSelesai,
    kumpulkanLkpd: kumpulkanLkpd,
    mulaiQuiz: mulaiQuiz,
    kumpulkanQuiz: kumpulkanQuiz
  };
})();
