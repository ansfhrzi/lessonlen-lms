/**
 * ============================================================
 *  LMS v2 — Quiz.gs
 *  Tahap 4 poin 2b: editor Quiz (pengaturan + bank soal).
 *  Acuan: §7.10 Quizzes, §7.11 Quiz_Questions (+ paritas v1:
 *  kkm, acak_soal, acak_opsi, tampilkan_pembahasan, pembahasan,
 *  gambar_url, tingkat kognitif — persetujuan pemilik 2026-09-03).
 * ------------------------------------------------------------
 *  · Baris Quizzes dibuat LAZY saat guru membuka/menyimpan editor.
 *  · Soal = 1 baris per soal; opsi PG di options_json (§7.11):
 *      ["teks A","teks B",…]
 *  · answer_key: pg = 'A'..'E' · benar_salah = 'Benar'|'Salah' ·
 *      isian = teks kunci · esai = '' (dikoreksi guru).
 *  · answer_key TIDAK BOLEH masuk respons murid (§7.11) —
 *    dikunci di endpoint murid (poin 3).
 * ============================================================
 */

var Quiz = (function () {

  var TIPE_SOAL = ['pg', 'benar_salah', 'isian', 'esai'];
  var TINGKAT = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'];

  function _err(kode, pesan) {
    var e = new Error(pesan); e.kode = kode; throw e;
  }

  function _kini() { return Util.sekarang(); }

  /* -------------------------------------------------- kepemilikan */

  /** Item quiz milik guru ini (via topik induk atau ta_id mandiri). */
  function _itemSah(sesi, itemId) {
    var it = Db.cari('Items', 'item_id', itemId);
    if (!it) _err('TIDAK_DITEMUKAN', 'Item tidak ditemukan.');
    var taId = it.ta_id;
    if (it.topic_id) {
      var t = Db.cari('Topics', 'topic_id', it.topic_id);
      if (!t) _err('TIDAK_DITEMUKAN', 'Topik induk tidak ditemukan.');
      taId = t.teaching_assignment_id;
    }
    var ta = Db.cari('Teaching_Assignments', 'teaching_assignment_id', taId);
    if (!ta || ta.teacher_id !== sesi.user_id) {
      _err('TIDAK_DITEMUKAN', 'Item tidak ditemukan.');
    }
    if (it.type !== 'quiz') {
      _err('VALIDASI_GAGAL', 'Item ini bukan quiz.');
    }
    return it;
  }

  /* -------------------------------------------------- baris quiz */

  /** Baris Quizzes milik item — dibuat LAZY bila belum ada. */
  function _quizOf(itemId, buatJika) {
    var q = Db.saring('Quizzes', { item_id: itemId })[0];
    if (!q && buatJika) {
      var id = Util.buatId('QIZ');
      q = {
        quiz_id: id, item_id: itemId,
        deadline: '', max_attempts: 1,
        show_score: true, status: 'aktif',
        kkm: 75, acak_soal: true, acak_opsi: true,
        tampilkan_pembahasan: false,
        created_at: _kini(), updated_at: _kini()
      };
      Db.tambah('Quizzes', q);
      q = Db.saring('Quizzes', { item_id: itemId })[0];
    }
    return q;
  }

  function _soalDari(quizId) {
    return Db.saring('Quiz_Questions', { quiz_id: quizId })
      .sort(function (a, b) { return (Number(a.order_no) || 0) - (Number(b.order_no) || 0); });
  }

  function _renumber(quizId) {
    var daftar = _soalDari(quizId);
    Db.perbaruiBanyak('Quiz_Questions', daftar.map(function (s, i) {
      return { _baris: s._baris, order_no: i + 1 };
    }));
  }

  function _bentukSoal(s, utkGuru) {
    var opsi = [];
    if (s.options_json) {
      try { opsi = JSON.parse(s.options_json) || []; } catch (e) { opsi = []; }
    }
    return {
      question_id: s.question_id,
      order_no: Number(s.order_no) || 0,
      type: s.type,
      question: s.question || '',
      options: opsi,
      /* answer_key hanya utk guru — endpoint murid (poin 3) memanggil
         _bentukSoal dgn utkGuru=false */
      answer_key: utkGuru ? String(s.answer_key || '') : '',
      rubric: utkGuru ? String(s.rubric || '') : '',
      pembahasan: utkGuru ? String(s.pembahasan || '') : '',
      gambar_url: String(s.gambar_url || ''),
      points: Number(s.points) || 1,
      tingkat: String(s.tingkat || ''),
      ai_source: s.ai_source === true || s.ai_source === 'TRUE'
    };
  }

  /* -------------------------------------------------- API guru */

  /** Seluruh data layar editor quiz (lazily membuat baris Quizzes). */
  function muat(sesi, itemId) {
    var it = _itemSah(sesi, itemId);
    var q = _quizOf(itemId, true);
    var soal = _soalDari(q.quiz_id);

    var rekap = { jml_soal: soal.length, total_bobot: 0,
                  per_tipe: { pg: 0, benar_salah: 0, isian: 0, esai: 0 },
                  ada_esai: false };
    soal.forEach(function (s) {
      var poin = Number(s.points) || 1;
      rekap.total_bobot += poin;
      rekap.per_tipe[s.type] = (rekap.per_tipe[s.type] || 0) + 1;
      if (s.type === 'esai') rekap.ada_esai = true;
    });

    var t = Db.cari('Topics', 'topic_id', it.topic_id);
    return {
      item: { item_id: it.item_id, jenis: it.type,
              judul: it.title, deskripsi: it.description || '',
              status: it.status, publish_at: it.publish_at || '',
              topic_id: it.topic_id,
              ta_id: t ? t.teaching_assignment_id : it.ta_id },
      quiz: {
        quiz_id: q.quiz_id,
        deadline: q.deadline || '',
        max_attempts: Number(q.max_attempts) || 0,
        show_score: q.show_score === true || q.show_score === 'TRUE',
        kkm: Number(q.kkm) || 75,
        acak_soal: q.acak_soal === true || q.acak_soal === 'TRUE',
        acak_opsi: q.acak_opsi === true || q.acak_opsi === 'TRUE',
        tampilkan_pembahasan:
          q.tampilkan_pembahasan === true || q.tampilkan_pembahasan === 'TRUE'
      },
      soal: soal.map(function (s) { return _bentukSoal(s, true); }),
      rekap: rekap,
      tingkat_tersedia: TINGKAT
    };
  }

  /** Simpan kartu pengaturan quiz. deadline kosong = tanpa tenggat. */
  function simpanPengaturan(sesi, itemId, p) {
    p = p || {};
    _itemSah(sesi, itemId);
    var q = _quizOf(itemId, true);

    var deadline = String(p.deadline == null ? '' : p.deadline).trim();
    if (deadline && !/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2})?$/.test(deadline)) {
      _err('VALIDASI_GAGAL', 'Format tenggat tidak dikenal.');
    }
    var kesempatan = Number(p.max_attempts);
    if (isNaN(kesempatan) || kesempatan < 0 || kesempatan > 99) {
      _err('VALIDASI_GAGAL',
        'Kesempatan mengerjakan 0–99 (0 = bebas mengerjakan).');
    }
    var kkm = Number(p.kkm);
    if (isNaN(kkm) || kkm < 0 || kkm > 100) {
      _err('VALIDASI_GAGAL', 'KKM harus angka 0–100.');
    }

    var bool = function (v) { return v === true || v === 'true' || v === true; };
    Db.perbarui('Quizzes', q._baris, {
      deadline: deadline ? deadline.slice(0, 16).replace('T', ' ') : '',
      max_attempts: Math.round(kesempatan),
      show_score: p.show_score ? true : false,
      kkm: Math.round(kkm),
      acak_soal: p.acak_soal ? true : false,
      acak_opsi: p.acak_opsi ? true : false,
      tampilkan_pembahasan: p.tampilkan_pembahasan ? true : false,
      updated_at: _kini()
    });
    Util.catatLog(sesi.user_id, 'QUIZ_PENGATURAN', q.quiz_id,
                  'ok', sesi.role, 'Quizzes', q.quiz_id);
    return { disimpan: true };
  }

  /**
   * Tambah / ubah satu soal.
   * p = { question_id?, type, question, points, options?, answer_key?,
   *       rubric?, pembahasan?, gambar_url?, tingkat? }
   */
  function simpanSoal(sesi, itemId, p) {
    p = p || {};
    _itemSah(sesi, itemId);
    var q = _quizOf(itemId, true);

    var tipe = p.type;
    if (TIPE_SOAL.indexOf(tipe) === -1) {
      _err('VALIDASI_GAGAL', 'Tipe soal tidak dikenal.');
    }
    var teks = String(p.question == null ? '' : p.question).trim();
    if (!teks) _err('VALIDASI_GAGAL', 'Pertanyaan wajib diisi.');
    if (teks.length > 2000) {
      _err('VALIDASI_GAGAL', 'Pertanyaan maksimal 2000 karakter.');
    }
    var poin = Math.round(Number(p.points) || 1);
    if (poin < 1 || poin > 100) {
      _err('VALIDASI_GAGAL', 'Bobot soal harus angka 1–100.');
    }

    /* ---- kunci & opsi per tipe ---- */
    var opsiJson = '';
    var kunci = '';
    var rubric = '';

    if (tipe === 'pg') {
      var opsi = (p.options || []).map(function (o) {
        return String(o == null ? '' : o).trim();
      }).filter(function (o) { return o !== ''; });
      if (opsi.length < 2) {
        _err('VALIDASI_GAGAL', 'Pilihan ganda butuh minimal 2 opsi terisi.');
      }
      if (opsi.length > 5) {
        _err('VALIDASI_GAGAL', 'Pilihan ganda maksimal 5 opsi.');
      }
      kunci = String(p.answer_key || '').trim().toUpperCase();
      if ('ABCDE'.indexOf(kunci) === -1 ||
          'ABCDE'.indexOf(kunci) >= opsi.length) {
        _err('VALIDASI_GAGAL',
          'Kunci jawaban harus salah satu huruf opsi yang terisi.');
      }
      opsiJson = JSON.stringify(opsi);
    } else if (tipe === 'benar_salah') {
      kunci = String(p.answer_key || '').trim();
      if (kunci !== 'Benar' && kunci !== 'Salah') {
        _err('VALIDASI_GAGAL', 'Kunci benar–salah harus Benar atau Salah.');
      }
    } else if (tipe === 'isian') {
      kunci = String(p.answer_key || '').trim();
      if (!kunci) {
        _err('VALIDASI_GAGAL', 'Isian singkat wajib punya kunci jawaban.');
      }
      if (kunci.length > 100) {
        _err('VALIDASI_GAGAL', 'Kunci isian maksimal 100 karakter.');
      }
    } else { /* esai */
      rubric = String(p.rubric == null ? '' : p.rubric).trim().slice(0, 1000);
      kunci = '';
    }

    var pembahasan =
      String(p.pembahasan == null ? '' : p.pembahasan).trim().slice(0, 1000);
    var gambar = String(p.gambar_url == null ? '' : p.gambar_url).trim();
    if (gambar && !/^https?:\/\//i.test(gambar)) {
      _err('VALIDASI_GAGAL', 'Tautan gambar harus diawali http:// atau https://');
    }
    if (gambar.length > 500) {
      _err('VALIDASI_GAGAL', 'Tautan gambar maksimal 500 karakter.');
    }
    var tingkat = TINGKAT.indexOf(p.tingkat) >= 0 ? p.tingkat : '';

    var daftar = _soalDari(q.quiz_id);
    var lama = p.question_id
      ? daftar.filter(function (s) { return s.question_id === p.question_id; })[0]
      : null;
    if (p.question_id && !lama) {
      _err('TIDAK_DITEMUKAN', 'Soal tidak ditemukan.');
    }

    var isi = {
      quiz_id: q.quiz_id, type: tipe, question: teks,
      options_json: opsiJson, answer_key: kunci, rubric: rubric,
      pembahasan: pembahasan, gambar_url: gambar, points: poin
    };

    if (lama) {
      isi.tingkat = tingkat || String(lama.tingkat || '');
      Db.perbarui('Quiz_Questions', lama._baris, isi);
      Util.catatLog(sesi.user_id, 'QUIZ_SOAL',
        p.question_id + ' ubah', 'ok', sesi.role, 'Quiz_Questions', p.question_id);
      return { question_id: p.question_id, baru: false };
    }

    var idBaru = Util.buatId('QQA');
    Db.tambah('Quiz_Questions', Object.assign({}, isi, {
      question_id: idBaru,
      order_no: daftar.length + 1,     /* SELALU paling dasar */
      tingkat: tingkat,
      ai_source: false,
      created_at: _kini()
    }));
    Util.catatLog(sesi.user_id, 'QUIZ_SOAL',
      idBaru + ' baru (' + tipe + ')', 'ok', sesi.role, 'Quiz_Questions', idBaru);
    return { question_id: idBaru, baru: true };
  }

  function hapusSoal(sesi, itemId, questionId) {
    _itemSah(sesi, itemId);
    var q = _quizOf(itemId, true);
    var s = Db.saring('Quiz_Questions', { quiz_id: q.quiz_id })
      .filter(function (x) { return x.question_id === questionId; })[0];
    if (!s) _err('TIDAK_DITEMUKAN', 'Soal tidak ditemukan.');
    Db.hapus('Quiz_Questions', s._baris);
    _renumber(q.quiz_id);
    Util.catatLog(sesi.user_id, 'QUIZ_SOAL_HAPUS', questionId,
                  'ok', sesi.role, 'Quiz_Questions', questionId);
    return { terhapus: true };
  }

  /** ▲▼ soal: tukar tetangga dalam quiz + renumber 1..N. */
  function pindahSoal(sesi, itemId, questionId, arah) {
    if (arah !== 'atas' && arah !== 'bawah') {
      _err('VALIDASI_GAGAL', 'Arah harus atas atau bawah.');
    }
    _itemSah(sesi, itemId);
    var q = _quizOf(itemId, true);
    var daftar = _soalDari(q.quiz_id);
    var i = -1;
    daftar.forEach(function (x, idx) { if (x.question_id === questionId) i = idx; });
    if (i < 0) _err('TIDAK_DITEMUKAN', 'Soal tidak ditemukan.');
    var lawan = arah === 'atas' ? i - 1 : i + 1;
    if (lawan < 0 || lawan >= daftar.length) return { pindah: false };
    var tmp = daftar[i]; daftar[i] = daftar[lawan]; daftar[lawan] = tmp;
    Db.perbaruiBanyak('Quiz_Questions', daftar.map(function (x, idx) {
      return { _baris: x._baris, order_no: idx + 1 };
    }));
    return { pindah: true };
  }

  return {
    muat: muat,
    simpanPengaturan: simpanPengaturan,
    simpanSoal: simpanSoal,
    hapusSoal: hapusSoal,
    pindahSoal: pindahSoal
  };
})();
