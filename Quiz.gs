/**
 * ============================================================
 *  LessonLen — Quiz.gs
 *  Quiz internal: bank soal, pengerjaan, penilaian
 * ------------------------------------------------------------
 *  Acuan: KESEPAKATAN-SISTEM.md v4.7 §9
 *
 *  ATURAN KEAMANAN MENGIKAT (§9.8):
 *   - kunci jawaban TIDAK PERNAH dikirim ke klien saat pengerjaan
 *   - nilai dihitung ULANG di server; `nilai` dari klien diabaikan
 *   - batas waktu diverifikasi di server (mulai_at + batas_waktu_menit)
 *   - jumlah percobaan dihitung dari baris quiz_attempt, bukan klien
 *   - attempt.user_id wajib cocok dengan sesi
 *
 *  PENYIMPANAN (§9.2):
 *   Jawaban disimpan sebagai JSON per attempt, BUKAN 1 baris per
 *   jawaban. 77.000 → 7.700 baris/tahun.
 *   Format: [{"s":"SOL-001","j":"B","b":true},
 *            {"s":"SOL-006","j":"...","b":null,"n":8,"fb":"..."}]
 *   s = soal_id · j = jawaban · b = benar/salah · n = nilai esai
 *   fb = umpan balik butir
 * ============================================================
 */

var Quiz = (function () {

  var TIPE_SOAL = ['pg', 'benar_salah', 'isian', 'esai'];
  var TIPE_OTOMATIS = ['pg', 'benar_salah', 'isian'];
  var MAKS_OPSI = 5;                 /* A–E */
  var MAKS_STIMULUS = 8000;          /* wacana panjang ± 1.200 kata */
  /* 7 hari (v1.9.0). Dulu 24 jam ketika jawaban tersimpan di server
     tiap klik, sehingga "melanjutkan attempt" berarti melanjutkan
     pekerjaan yang sungguh ada di sana.

     Sejak jawaban pindah ke localStorage, attempt `berjalan` di
     server hanyalah penanda "sedang dikerjakan" — isinya ada di HP
     murid. Kedaluwarsa TIDAK menghanguskan kesempatan dan TIDAK
     menghapus nilai yang sudah diraih; ia hanya membersihkan baris
     menggantung supaya sheet tidak menumpuk. Karena itu boleh
     longgar: ini tugas, bukan ujian. */
  var BATAS_KEDALUWARSA_JAM = 24 * 7;

  function _err(kode, pesan) {
    var e = new Error(pesan);
    e.kode = kode;
    return e;
  }

  /* ==================================================== bantu umum */

  function _parseJson(v, bawaan) {
    if (v === '' || v === null || v === undefined) return bawaan;
    try {
      var a = JSON.parse(v);
      return a === null ? bawaan : a;
    } catch (e) { return bawaan; }
  }

  /** Ambil item quiz dan pastikan benar-benar bertipe quiz. */
  function _itemQuiz(itemId) {
    /* cariBarisCache: nomor baris diingat, isinya diverifikasi ulang.
       Dipanggil di hampir setiap operasi quiz — termasuk autosave. */
    var item = Db.cariBarisCache('item', 'item_id', itemId);
    if (!item) throw _err('TIDAK_DITEMUKAN', 'Quiz tidak ditemukan.');
    if (item.tipe !== 'quiz') {
      throw _err('VALIDASI_GAGAL', 'Item ini bukan Quiz.');
    }
    return item;
  }

  /**
   * Seluruh soal satu quiz, terurut nomor.
   *
   * Bank soal praktis beku selama jam pelajaran — guru menyusunnya
   * sebelum quiz dibuka. Sementara itu fungsi ini dipanggil pada
   * hampir setiap operasi murid (bukaQuiz, mulaiQuiz, lanjutkan,
   * kumpulkan, hasil). Saat 36 murid mengerjakan bersamaan, soal yang
   * sama dibaca ratusan kali.
   *
   * Hasilnya di-cache per item dengan epoch dari sheet `soal`, jadi
   * penyuntingan guru langsung terlihat (lihat Db.invalidasi).
   */
  function _soalItem(itemId) {
    var epoch = '0';
    try {
      epoch = CacheService.getScriptCache().get('soal_epoch') || '0';
    } catch (e) {}
    var kunci = 'soal_' + itemId + '_' + epoch;

    try {
      var c = CacheService.getScriptCache().get(kunci);
      if (c) return JSON.parse(c);
    } catch (e) { /* cache rusak → baca ulang */ }

    /* Daftar kolom EKSPLISIT: menambah kolom ke skema tidak otomatis
       membuatnya terbaca di sini. grup_id & stimulus (v1.4) sempat
       terlewat — soal tersimpan benar tetapi selalu terbaca kosong. */
    var hasil = Db.saringBaris('soal', 'item_id', itemId,
      ['soal_id', 'grup_id', 'stimulus', 'nomor', 'tipe', 'pertanyaan',
       'gambar_url', 'opsi',
       'kunci', 'bobot', 'pembahasan', 'tingkat', 'sumber_ai'])
      .sort(function (a, b) { return Number(a.nomor) - Number(b.nomor); });

    try {
      var teks = JSON.stringify(hasil);
      if (teks.length < 95000) {
        CacheService.getScriptCache().put(kunci, teks, 21600);
      }
    } catch (e) { /* terlalu besar → lewati */ }
    return hasil;
  }

  function _bobot(s) {
    var b = Number(s.bobot);
    return isFinite(b) && b > 0 ? b : 1;
  }

  /* ==================================================== BANK SOAL (guru) */

  /**
   * Daftar soal untuk guru — LENGKAP dengan kunci.
   * Hanya dipanggil dari rute guru; otorisasi di Code.gs.
   */
  /** Berapa kelompok bacaan berbeda dalam satu quiz. */
  function _cacahGrup(soal) {
    var ada = {};
    soal.forEach(function (s) {
      var g = String(s.grup_id || '').trim();
      if (g) ada[g] = true;
    });
    return Object.keys(ada).length;
  }

  function getSoalGuru(itemId) {
    var item = _itemQuiz(itemId);
    var soal = _soalItem(itemId);

    var totalBobot = 0;
    var perTipe = { pg: 0, benar_salah: 0, isian: 0, esai: 0 };
    soal.forEach(function (s) {
      totalBobot += _bobot(s);
      if (perTipe[s.tipe] !== undefined) perTipe[s.tipe]++;
    });

    return {
      item: {
        item_id: item.item_id,
        judul: item.judul,
        pertemuan_id: item.pertemuan_id,
        kelas_id: item.kelas_id,
        kkm: Number(item.kkm) || 0,
        max_percobaan: Number(item.max_percobaan) || 0,
        batas_waktu_menit: Number(item.batas_waktu_menit) || 0,
        acak_soal: item.acak_soal === true,
        acak_opsi: item.acak_opsi === true,
        tampilkan_pembahasan: item.tampilkan_pembahasan === true,
        status: item.status
      },
      rekap: {
        jml_soal: soal.length,
        total_bobot: totalBobot,
        per_tipe: perTipe,
        ada_esai: perTipe.esai > 0,
        jml_grup: _cacahGrup(soal)
      },
      soal: soal.map(function (s) {
        return {
          soal_id: s.soal_id,
          nomor: Number(s.nomor),
          tipe: s.tipe,
          grup_id: s.grup_id || '',
          stimulus: s.stimulus || '',
          pertanyaan: s.pertanyaan,
          gambar_url: s.gambar_url,
          opsi: _parseJson(s.opsi, []),
          kunci: s.kunci,
          bobot: _bobot(s),
          pembahasan: s.pembahasan,
          tingkat: s.tingkat,
          sumber_ai: s.sumber_ai === true
        };
      })
    };
  }

  /**
   * Validasi + normalisasi satu soal sebelum disimpan.
   * Melempar bila tidak sah. Mengembalikan objek siap tulis.
   */
  function _validasiSoal(p) {
    var tipe = String(p.tipe || '').trim();
    if (TIPE_SOAL.indexOf(tipe) === -1) {
      throw _err('VALIDASI_GAGAL', 'Tipe soal tidak dikenal: ' + tipe);
    }

    var pertanyaan = Util.sanitasi(String(p.pertanyaan || '')).trim();
    if (!pertanyaan) {
      throw _err('VALIDASI_GAGAL', 'Pertanyaan wajib diisi.');
    }

    var bobot = Number(p.bobot);
    if (!isFinite(bobot) || bobot <= 0) bobot = 1;
    if (bobot > 100) {
      throw _err('VALIDASI_GAGAL', 'Bobot maksimal 100.');
    }

    var opsi = [];
    var kunci = String(p.kunci === undefined || p.kunci === null
      ? '' : p.kunci).trim();

    if (tipe === 'pg') {
      opsi = (p.opsi || []).map(function (o) {
        return Util.sanitasi(String(o == null ? '' : o)).trim();
      }).filter(function (o) { return o.length > 0; });

      if (opsi.length < 2) {
        throw _err('VALIDASI_GAGAL',
          'Pilihan ganda perlu minimal 2 opsi.');
      }
      if (opsi.length > MAKS_OPSI) {
        throw _err('VALIDASI_GAGAL',
          'Pilihan ganda maksimal ' + MAKS_OPSI + ' opsi (A–E).');
      }

      /* kunci disimpan sebagai huruf A..E agar tahan terhadap
         penyuntingan teks opsi di kemudian hari */
      kunci = kunci.toUpperCase();
      var idx = 'ABCDE'.indexOf(kunci);
      if (idx < 0 || idx >= opsi.length) {
        throw _err('VALIDASI_GAGAL',
          'Kunci pilihan ganda harus salah satu huruf opsi yang tersedia.');
      }

    } else if (tipe === 'benar_salah') {
      opsi = ['Benar', 'Salah'];
      var kb = kunci.toLowerCase();
      if (kb === 'true' || kb === 'benar' || kb === 'b') kunci = 'Benar';
      else if (kb === 'false' || kb === 'salah' || kb === 's') kunci = 'Salah';
      else {
        throw _err('VALIDASI_GAGAL',
          'Kunci benar-salah harus "Benar" atau "Salah".');
      }

    } else if (tipe === 'isian') {
      /* kunci boleh beberapa alternatif dipisah | (§9.3) */
      var alt = kunci.split('|')
        .map(function (x) { return x.trim(); })
        .filter(function (x) { return x.length > 0; });
      if (!alt.length) {
        throw _err('VALIDASI_GAGAL', 'Kunci jawaban isian wajib diisi.');
      }
      kunci = alt.join('|');

    } else {
      /* esai — dikoreksi manual, tidak punya kunci otomatis */
      kunci = '';
    }

    var tingkat = String(p.tingkat || 'sedang').trim();
    if (['mudah', 'sedang', 'sulit'].indexOf(tingkat) === -1) {
      tingkat = 'sedang';
    }

    var gambar = String(p.gambar_url || '').trim();
    if (gambar && !Util.urlSah(gambar)) {
      throw _err('VALIDASI_GAGAL', 'Tautan gambar tidak sah.');
    }

    /* Teks bacaan bersama (wacana, dialog, puisi). Disimpan HANYA pada
       soal pertama kelompok; soal lain sekelompok mewarisinya lewat
       grup_id. Menyimpan ulang di tiap soal memboroskan payload dan
       membuat penyuntingan bacaan harus dilakukan berkali-kali. */
    var stimulus = Util.sanitasi(String(p.stimulus || '')).trim();
    if (stimulus.length > MAKS_STIMULUS) {
      throw _err('VALIDASI_GAGAL',
        'Teks bacaan maksimal ' + MAKS_STIMULUS + ' karakter.');
    }

    return {
      tipe: tipe,
      pertanyaan: pertanyaan,
      stimulus: stimulus,
      gambar_url: gambar.slice(0, 500),
      opsi: JSON.stringify(opsi),
      kunci: kunci.slice(0, 500),
      bobot: bobot,
      pembahasan: Util.sanitasi(String(p.pembahasan || '')).trim(),
      tingkat: tingkat
    };
  }

  /**
   * Jaga agar teks bacaan tersimpan SEKALI saja per kelompok.
   *
   * Bacaan diletakkan pada soal bernomor terkecil dalam kelompok;
   * salinan pada soal lain dikosongkan. Tanpa ini, menyunting bacaan
   * berarti menyuntingnya berkali-kali, dan payload quiz membengkak
   * sebesar (jumlah soal − 1) × panjang bacaan.
   *
   * Dipanggil setelah setiap perubahan susunan soal.
   */
  function _rapikanStimulus(itemId) {
    var soal = _soalItem(itemId);
    var perGrup = {};

    soal.forEach(function (s) {
      var g = String(s.grup_id || '').trim();
      if (!g) return;
      (perGrup[g] = perGrup[g] || []).push(s);
    });

    var ubah = [];
    Object.keys(perGrup).forEach(function (g) {
      var anggota = perGrup[g].sort(function (a, b) {
        return (Number(a.nomor) || 0) - (Number(b.nomor) || 0);
      });

      /* Bacaan diambil dari anggota mana pun yang punya — guru bisa
         mengetiknya di soal ke-2 dan tetap benar. */
      var teks = '';
      anggota.forEach(function (s) {
        if (!teks && String(s.stimulus || '').trim()) {
          teks = String(s.stimulus).trim();
        }
      });

      /* Kelompok beranggota satu tidak bermakna — bisa terjadi setelah
         soal lain dihapus atau dipindah ke kelompok lain. Dibubarkan
         supaya guru tidak melihat "kelompok" berisi satu soal. */
      if (anggota.length < 2) {
        anggota.forEach(function (s) {
          ubah.push({ _baris: s._baris, grup_id: '', stimulus: '' });
        });
        return;
      }

      anggota.forEach(function (s, i) {
        var seharusnya = (i === 0) ? teks : '';
        if (String(s.stimulus || '') !== seharusnya) {
          ubah.push({ _baris: s._baris, stimulus: seharusnya });
        }
      });
    });

    /* soal mandiri tidak boleh menyimpan bacaan — tidak ada yang
       mewarisinya, dan itu hanya memperberat payload */
    soal.forEach(function (s) {
      if (String(s.grup_id || '').trim()) return;
      if (String(s.stimulus || '').trim()) {
        ubah.push({ _baris: s._baris, stimulus: '' });
      }
    });

    if (ubah.length) Db.perbaruiBanyak('soal', ubah);
    return ubah.length;
  }

  /**
   * Simpan satu soal — tambah bila `soal_id` kosong, perbarui bila ada.
   *
   * Penyuntingan memakai isiBilaAda-style: seluruh medan divalidasi
   * sebagai satu kesatuan karena kunci bergantung pada tipe & opsi.
   * Mengirim sebagian medan saja tidak sah untuk soal.
   */
  function simpanSoal(sesi, p) {
    var itemId = String(p.item_id || '').trim();
    _itemQuiz(itemId);

    var bersih = _validasiSoal(p);

    if (p.soal_id) {
      var lama = Db.cariCepat('soal', 'soal_id', p.soal_id);
      if (!lama) throw _err('TIDAK_DITEMUKAN', 'Soal tidak ditemukan.');
      if (lama.item_id !== itemId) {
        throw _err('VALIDASI_GAGAL', 'Soal bukan milik quiz ini.');
      }

      /* grup_id hanya berubah bila memang dikirim — penyuntingan biasa
         tidak boleh diam-diam mengeluarkan soal dari kelompoknya */
      if (p.grup_id !== undefined) {
        bersih.grup_id = String(p.grup_id || '').trim();
      }

      Db.perbarui('soal', lama._baris, bersih);
      _rapikanStimulus(itemId);
      Util.catatLog(sesi.user_id, 'ubah_soal', p.soal_id);
      return { soal_id: p.soal_id, aksi: 'perbarui' };
    }

    /* nomor berikutnya = terbesar + 1, bukan jumlah baris — soal yang
       pernah dihapus tidak boleh membuat nomor bertabrakan */
    var ada = _soalItem(itemId);
    var maks = 0;
    ada.forEach(function (s) { maks = Math.max(maks, Number(s.nomor) || 0); });

    bersih.soal_id = Util.buatId('SOL');
    bersih.item_id = itemId;
    bersih.grup_id = String(p.grup_id || '').trim();
    bersih.nomor = maks + 1;
    bersih.sumber_ai = p.sumber_ai === true;
    bersih.created_at = Util.sekarang();

    Db.tambah('soal', bersih);
    _rapikanStimulus(itemId);
    Util.catatLog(sesi.user_id, 'tambah_soal', itemId + ' → ' + bersih.soal_id);
    return { soal_id: bersih.soal_id, aksi: 'tambah', nomor: bersih.nomor };
  }

  /** Hapus satu soal, lalu rapatkan penomoran sisanya. */
  function hapusSoal(sesi, soalId) {
    var s = Db.cariCepat('soal', 'soal_id', soalId);
    if (!s) throw _err('TIDAK_DITEMUKAN', 'Soal tidak ditemukan.');

    var itemId = s.item_id;

    _tolakBilaAdaYangMengerjakan(itemId, 'menghapus soal');

    /* BUG v1.4.1: bacaan hanya tersimpan pada SATU anggota kelompok.
       Bila soal itu yang dihapus, wacananya lenyap permanen dan
       anggota lain jadi yatim — tanpa pesan galat apa pun.

       Teksnya diselamatkan SEBELUM baris dihapus, lalu dititipkan ke
       anggota tersisa. _rapikanStimulus saja tidak cukup: ia membaca
       ulang dari sheet, yang saat itu sudah kehilangan teksnya. */
    var grup = String(s.grup_id || '').trim();
    var teksSelamat = grup ? String(s.stimulus || '').trim() : '';

    Db.hapus('soal', s._baris);
    _rapatkanNomor(itemId);

    if (grup && teksSelamat) {
      var sisa = _soalItem(itemId)
        .filter(function (x) { return String(x.grup_id || '') === grup; })
        .sort(function (a, b) {
          return (Number(a.nomor) || 0) - (Number(b.nomor) || 0);
        });
      /* hanya bila kelompoknya masih bermakna (≥2 anggota) */
      if (sisa.length >= 2) {
        Db.perbarui('soal', sisa[0]._baris, { stimulus: teksSelamat });
      }
    }
    _rapikanStimulus(itemId);

    Util.catatLog(sesi.user_id, 'hapus_soal', soalId);
    return { terhapus: true };
  }

  /**
   * Tolak perubahan susunan bila ada murid sedang mengerjakan.
   *
   * Attempt menyimpan urutan_soal saat dimulai. Mengubah susunan atau
   * kelompok di tengah jalan membuat urutan itu tidak lagi cocok —
   * murid bisa kehilangan teks bacaan di layar, atau melihat soal
   * yang tidak ada di attempt-nya.
   */
  function _tolakBilaAdaYangMengerjakan(itemId, aksi) {
    var berjalan = Db.saringBaris('quiz_attempt', 'item_id', itemId,
      ['attempt_id', 'status']).filter(function (a) {
        return a.status === 'berjalan';
      });
    if (berjalan.length) {
      throw _err('VALIDASI_GAGAL',
        'Ada ' + berjalan.length + ' murid sedang mengerjakan quiz ini. ' +
        'Tunggu sampai selesai sebelum ' + aksi + '.');
    }
  }

  /** Jadikan nomor soal berurutan 1..n tanpa lompatan. */
  function _rapatkanNomor(itemId) {
    var soal = Db.saringBaris('soal', 'item_id', itemId, ['soal_id', 'nomor'])
      .sort(function (a, b) { return Number(a.nomor) - Number(b.nomor); });

    var ubah = [];
    soal.forEach(function (s, i) {
      if (Number(s.nomor) !== i + 1) {
        ubah.push({ _baris: s._baris, nomor: i + 1 });
      }
    });
    if (ubah.length) Db.perbaruiBanyak('soal', ubah);
  }

  /** Ubah urutan soal sesuai daftar id yang dikirim. */
  function aturUrutanSoal(sesi, itemId, ids) {
    _itemQuiz(itemId);
    _tolakBilaAdaYangMengerjakan(itemId, 'mengubah urutan soal');
    if (!ids || !ids.length) {
      throw _err('VALIDASI_GAGAL', 'Daftar urutan kosong.');
    }

    var soal = _soalItem(itemId);
    var peta = {};
    soal.forEach(function (s) { peta[s.soal_id] = s; });

    /* daftar dari klien harus memuat tepat soal-soal quiz ini */
    if (ids.length !== soal.length) {
      throw _err('VALIDASI_GAGAL',
        'Daftar urutan tidak lengkap (' + ids.length + ' dari ' +
        soal.length + ' soal).');
    }
    var terlihat = {};
    for (var i = 0; i < ids.length; i++) {
      if (!peta[ids[i]]) {
        throw _err('VALIDASI_GAGAL', 'Soal tidak dikenal: ' + ids[i]);
      }
      if (terlihat[ids[i]]) {
        throw _err('VALIDASI_GAGAL', 'Soal ganda dalam daftar urutan.');
      }
      terlihat[ids[i]] = true;
    }

    /* BUG v1.4.1: urutan dari klien bisa menyelipkan soal lain di
       tengah kelompok, memecah anggota yang harus berdampingan.

       Urutan diterjemahkan menjadi urutan BLOK: posisi kelompok
       ditentukan oleh anggota pertamanya, dan seluruh anggotanya
       ikut ke situ. Guru tidak perlu memikirkan aturan ini —
       kelompok bergerak sebagai satu kesatuan. */
    var terpakai = {};
    var urutBlok = [];
    ids.forEach(function (id) {
      var s = peta[id];
      var g = String(s.grup_id || '').trim();
      if (!g) { urutBlok.push([s]); return; }
      if (terpakai[g]) return;              /* anggota lain sudah ikut */
      terpakai[g] = true;
      urutBlok.push(soal.filter(function (x) {
        return String(x.grup_id || '').trim() === g;
      }).sort(function (a, b) {
        return (Number(a.nomor) || 0) - (Number(b.nomor) || 0);
      }));
    });

    var datar = [];
    urutBlok.forEach(function (b) {
      b.forEach(function (x) { datar.push(x); });
    });

    var ubah = [];
    datar.forEach(function (s, i) {
      if (Number(s.nomor) !== i + 1) {
        ubah.push({ _baris: s._baris, nomor: i + 1 });
      }
    });
    if (ubah.length) Db.perbaruiBanyak('soal', ubah);
    _rapikanStimulus(itemId);

    Util.catatLog(sesi.user_id, 'urut_soal', itemId);
    return { tersimpan: true, jml: ids.length };
  }

  /**
   * Satukan beberapa soal menjadi satu kelompok berbagi bacaan.
   *
   * @param {Array<string>} soalIds soal yang dikelompokkan
   * @param {string} stimulus       teks bacaan bersama
   */
  function satukanGrup(sesi, itemId, soalIds, stimulus) {
    _itemQuiz(itemId);
    _tolakBilaAdaYangMengerjakan(itemId, 'mengubah kelompok soal');
    if (!soalIds || soalIds.length < 2) {
      throw _err('VALIDASI_GAGAL',
        'Pilih minimal dua soal untuk dijadikan satu kelompok.');
    }

    var teks = Util.sanitasi(String(stimulus || '')).trim();
    if (!teks) {
      throw _err('VALIDASI_GAGAL', 'Teks bacaan wajib diisi.');
    }
    if (teks.length > MAKS_STIMULUS) {
      throw _err('VALIDASI_GAGAL',
        'Teks bacaan maksimal ' + MAKS_STIMULUS + ' karakter.');
    }

    var soal = _soalItem(itemId);
    var peta = {};
    soal.forEach(function (s) { peta[s.soal_id] = s; });

    soalIds.forEach(function (id) {
      if (!peta[id]) throw _err('VALIDASI_GAGAL', 'Soal tidak dikenal: ' + id);
    });

    /* Soal hanya boleh berada di SATU kelompok. Memindahkannya diam-diam
       akan menyusutkan kelompok lama — bisa menyisakan kelompok
       beranggota satu yang tak bermakna. Guru harus melepas dahulu,
       supaya sadar apa yang terjadi pada kelompok lamanya. */
    var bentrok = soalIds.filter(function (id) {
      return String(peta[id].grup_id || '').trim();
    });
    if (bentrok.length) {
      throw _err('VALIDASI_GAGAL',
        bentrok.length + ' soal sudah tergabung dalam kelompok lain. ' +
        'Lepaskan kelompoknya terlebih dahulu.');
    }

    /* Soal sekelompok harus BERDAMPINGAN. Bila tersebar, nomornya
       dirapatkan mengikuti posisi anggota pertama — kalau tidak,
       "acak antar kelompok" tidak punya arti yang jelas. */
    var anggota = soal.filter(function (s) {
      return soalIds.indexOf(s.soal_id) !== -1;
    }).sort(function (a, b) {
      return (Number(a.nomor) || 0) - (Number(b.nomor) || 0);
    });
    var lain = soal.filter(function (s) {
      return soalIds.indexOf(s.soal_id) === -1;
    }).sort(function (a, b) {
      return (Number(a.nomor) || 0) - (Number(b.nomor) || 0);
    });

    var posisi = Number(anggota[0].nomor) || 1;
    var urutBaru = [];
    lain.forEach(function (s) {
      if ((Number(s.nomor) || 0) < posisi) urutBaru.push(s);
    });
    anggota.forEach(function (s) { urutBaru.push(s); });
    lain.forEach(function (s) {
      if ((Number(s.nomor) || 0) >= posisi) urutBaru.push(s);
    });

    var grupId = Util.buatId('GRP');
    var ubah = [];
    urutBaru.forEach(function (s, i) {
      var isi = {};
      var perlu = false;
      if (Number(s.nomor) !== i + 1) { isi.nomor = i + 1; perlu = true; }
      if (soalIds.indexOf(s.soal_id) !== -1) {
        isi.grup_id = grupId;
        isi.stimulus = (s.soal_id === anggota[0].soal_id) ? teks : '';
        perlu = true;
      }
      if (perlu) { isi._baris = s._baris; ubah.push(isi); }
    });
    if (ubah.length) Db.perbaruiBanyak('soal', ubah);
    _rapikanStimulus(itemId);

    Util.catatLog(sesi.user_id, 'satukan_grup_soal',
      itemId + ' → ' + grupId + ' (' + soalIds.length + ' soal)');
    return { grup_id: grupId, jml: soalIds.length };
  }

  /**
   * Ubah teks bacaan sebuah kelompok tanpa menyusun ulang anggotanya.
   *
   * Dipisah dari satukanGrup(): fungsi itu kini menolak soal yang
   * sudah bergrup, jadi memakainya untuk menyunting bacaan akan
   * ditolak oleh penjaganya sendiri.
   */
  function ubahStimulusGrup(sesi, itemId, grupId, stimulus) {
    _itemQuiz(itemId);
    _tolakBilaAdaYangMengerjakan(itemId, 'mengubah teks bacaan');

    var g = String(grupId || '').trim();
    if (!g) throw _err('VALIDASI_GAGAL', 'Kelompok tidak disebutkan.');

    var teks = Util.sanitasi(String(stimulus || '')).trim();
    if (!teks) throw _err('VALIDASI_GAGAL', 'Teks bacaan wajib diisi.');
    if (teks.length > MAKS_STIMULUS) {
      throw _err('VALIDASI_GAGAL',
        'Teks bacaan maksimal ' + MAKS_STIMULUS + ' karakter.');
    }

    var anggota = _soalItem(itemId)
      .filter(function (s) { return String(s.grup_id || '') === g; })
      .sort(function (a, b) {
        return (Number(a.nomor) || 0) - (Number(b.nomor) || 0);
      });
    if (!anggota.length) {
      throw _err('TIDAK_DITEMUKAN', 'Kelompok tidak ditemukan.');
    }

    /* bacaan hanya pada anggota pertama — aturan yang sama dengan
       _rapikanStimulus */
    var ubah = [];
    anggota.forEach(function (s, i) {
      var seharusnya = (i === 0) ? teks : '';
      if (String(s.stimulus || '') !== seharusnya) {
        ubah.push({ _baris: s._baris, stimulus: seharusnya });
      }
    });
    if (ubah.length) Db.perbaruiBanyak('soal', ubah);

    Util.catatLog(sesi.user_id, 'ubah_stimulus_grup', itemId + ' → ' + g);
    return { diperbarui: anggota.length };
  }

  /** Lepaskan satu kelompok; soalnya kembali berdiri sendiri. */
  function lepasGrup(sesi, itemId, grupId) {
    _itemQuiz(itemId);
    _tolakBilaAdaYangMengerjakan(itemId, 'melepas kelompok soal');
    var g = String(grupId || '').trim();
    if (!g) throw _err('VALIDASI_GAGAL', 'Kelompok tidak disebutkan.');

    var ubah = _soalItem(itemId)
      .filter(function (s) { return String(s.grup_id || '') === g; })
      .map(function (s) {
        return { _baris: s._baris, grup_id: '', stimulus: '' };
      });

    if (!ubah.length) {
      throw _err('TIDAK_DITEMUKAN', 'Kelompok tidak ditemukan.');
    }
    Db.perbaruiBanyak('soal', ubah);

    Util.catatLog(sesi.user_id, 'lepas_grup_soal', itemId + ' → ' + g);
    return { dilepas: ubah.length };
  }

  /** Salin seluruh soal dari quiz lain ke quiz ini. */
  function imporSoal(sesi, dariItemId, keItemId) {
    if (dariItemId === keItemId) {
      throw _err('VALIDASI_GAGAL', 'Tidak bisa mengimpor dari quiz yang sama.');
    }
    _itemQuiz(dariItemId);
    _itemQuiz(keItemId);

    var sumber = _soalItem(dariItemId);
    if (!sumber.length) {
      throw _err('VALIDASI_GAGAL', 'Quiz sumber belum punya soal.');
    }

    var ada = _soalItem(keItemId);
    var maks = 0;
    ada.forEach(function (s) { maks = Math.max(maks, Number(s.nomor) || 0); });

    /* grup_id lama tidak boleh dibawa apa adanya: bila quiz tujuan
       kebetulan punya grup dengan id sama, dua bacaan berbeda akan
       menyatu. Tiap kelompok sumber dipetakan ke id baru. */
    var petaGrupBaru = {};
    sumber.forEach(function (s) {
      var g = String(s.grup_id || '').trim();
      if (g && !petaGrupBaru[g]) petaGrupBaru[g] = Util.buatId('GRP');
    });

    var baris = sumber.map(function (s, i) {
      var g = String(s.grup_id || '').trim();
      return {
        soal_id: Util.buatId('SOL'),
        item_id: keItemId,
        grup_id: g ? petaGrupBaru[g] : '',
        stimulus: s.stimulus || '',
        nomor: maks + i + 1,
        tipe: s.tipe,
        pertanyaan: s.pertanyaan,
        gambar_url: s.gambar_url,
        opsi: typeof s.opsi === 'string' ? s.opsi : JSON.stringify(s.opsi || []),
        kunci: s.kunci,
        bobot: _bobot(s),
        pembahasan: s.pembahasan,
        tingkat: s.tingkat,
        sumber_ai: s.sumber_ai === true,
        created_at: Util.sekarang()
      };
    });

    Db.tambah('soal', baris);
    Util.catatLog(sesi.user_id, 'impor_soal',
      dariItemId + ' → ' + keItemId + ' (' + baris.length + ')');
    return { jml: baris.length };
  }

  /** Simpan sekaligus beberapa soal — dipakai hasil generate AI. */
  function simpanSoalTerpilih(sesi, itemId, daftar) {
    _itemQuiz(itemId);
    if (!daftar || !daftar.length) {
      throw _err('VALIDASI_GAGAL', 'Tidak ada soal yang dipilih.');
    }

    /* Validasi SELURUH soal dulu; baru menulis bila semuanya sah.
       Menulis sebagian lalu gagal di tengah menyisakan bank soal
       setengah jadi yang membingungkan guru. */
    var bersih = daftar.map(function (p, i) {
      try {
        return _validasiSoal(p);
      } catch (e) {
        throw _err('VALIDASI_GAGAL', 'Soal ke-' + (i + 1) + ': ' + e.message);
      }
    });

    var ada = _soalItem(itemId);
    var maks = 0;
    ada.forEach(function (s) { maks = Math.max(maks, Number(s.nomor) || 0); });

    /* Soal AI boleh datang berkelompok (mis. satu wacana untuk 4 soal).
       Nama grup dari klien dipetakan ke id baru supaya tidak bentrok
       dengan kelompok yang sudah ada di quiz ini. */
    var petaGrup = {};
    bersih.forEach(function (b, i) {
      var g = String(daftar[i].grup_id || '').trim();
      if (g && !petaGrup[g]) petaGrup[g] = Util.buatId('GRP');

      b.soal_id = Util.buatId('SOL');
      b.item_id = itemId;
      b.grup_id = g ? petaGrup[g] : '';
      b.nomor = maks + i + 1;
      b.sumber_ai = daftar[i].sumber_ai === true;
      b.created_at = Util.sekarang();
    });

    Db.tambah('soal', bersih);
    _rapikanStimulus(itemId);
    Util.catatLog(sesi.user_id, 'simpan_soal_ai',
      itemId + ' (' + bersih.length + ')');
    return { jml: bersih.length };
  }


  /* ==================================================== MURID */

  /** Pastikan murid berhak membuka quiz ini (unlock dihitung ulang). */
  function _quizTerbuka(sesi, itemId) {
    var item = _itemQuiz(itemId);
    if (item.status !== 'publish') {
      throw _err('TIDAK_DITEMUKAN', 'Quiz tidak ditemukan.');
    }

    /* Pemeriksaan pertemuan & keanggotaan TIDAK diulang di sini.

       `Belajar.detailPertemuan()` di bawah sudah melakukan keduanya —
       ia menolak pertemuan yang belum terbit dan memanggil
       `_cekEnroll()`. Versi lama membacanya lebih dulu, sehingga
       sheet `pertemuan` dibaca dua kali dan `enrollment` sekali
       tanpa guna pada SETIAP operasi quiz (v1.8.10).

       Penjaganya tidak berkurang: yang dibuang adalah pengulangan,
       bukan pemeriksaannya. Uji dua arah di run11 & perf13
       memastikan quiz terkunci tetap ditolak. */
    var d = Belajar.detailPertemuan(sesi, item.pertemuan_id);
    var ini = null;
    d.item.forEach(function (x) { if (x.item_id === itemId) ini = x; });
    if (!ini) throw _err('TIDAK_DITEMUKAN', 'Quiz tidak tersedia.');
    if (!ini.terbuka) {
      throw _err('ITEM_TERKUNCI', ini.alasan_kunci || 'Quiz masih terkunci.');
    }

    /* Baris pertemuan dipakai ulang dari detailPertemuan() — ia baru
       saja membacanya. Membacanya lagi di sini berarti dua panggilan
       API untuk baris yang sama (v1.8.11). */
    var p = d._barisPertemuan;
    if (!p) throw _err('TIDAK_DITEMUKAN', 'Pertemuan tidak ditemukan.');

    return { item: item, pertemuan: p, status: ini };
  }

  /** Seluruh attempt milik satu murid pada satu quiz. */
  /**
   * Seluruh attempt milik satu murid pada satu quiz.
   *
   * DIUKUR: menyaring `user_id` dengan saringBaris paling murah.
   * Dua alternatif dicoba dan keduanya LEBIH MAHAL:
   *   - saring `item_id` lalu buang    → 59.686 sel/murid
   *   - saringBaris2 dua kolom kunci   → 68.288 sel/murid
   *     (`user_id` & `item_id` tidak bersebelahan, rentangnya lebar)
   *   - saringBaris `user_id`          → 56.530 sel/murid  ✅
   * Baris milik satu murid berkumpul rapat karena dibuat berurutan,
   * sehingga hanya sedikit rentang yang perlu dibaca.
   */
  function _attemptMurid(userId, itemId) {
    return Db.saringBaris('quiz_attempt', 'user_id', userId,
      ['attempt_id', 'item_id', 'kelas_id', 'percobaan_ke', 'status',
       'urutan_soal', 'jawaban', 'skor', 'skor_maks', 'nilai', 'lulus',
       'catatan_guru', 'mulai_at', 'selesai_at'])
      .filter(function (a) { return a.item_id === itemId; })
      .sort(function (a, b) {
        return Number(a.percobaan_ke) - Number(b.percobaan_ke);
      });
  }

  /**
   * Ambil satu baris attempt LENGKAP — termasuk `urutan_soal` &
   * `jawaban` yang sengaja tidak dibawa _attemptMurid().
   * Nomor barisnya sudah diketahui, jadi biayanya satu baris.
   */
  function _attemptLengkap(ringkas) {
    if (!ringkas) return null;
    var penuh = Db.bacaBarisJika('quiz_attempt', ringkas._baris,
      { attempt_id: ringkas.attempt_id });
    return penuh || Db.cariBarisCache('quiz_attempt',
      'attempt_id', ringkas.attempt_id);
  }

  /**
   * Sisa detik attempt. Dihitung dari mulai_at + batas_waktu_menit,
   * SELALU di server (§9.5 aturan 3).
   * @returns {number|null} null bila quiz tanpa batas waktu
   */
  function _sisaDetik(attempt, item) {
    var menit = Number(item.batas_waktu_menit) || 0;
    if (menit <= 0) return null;
    var mulai = new Date(attempt.mulai_at).getTime();
    if (!isFinite(mulai)) return null;
    var habis = mulai + menit * 60000;
    return Math.max(0, Math.round((habis - Date.now()) / 1000));
  }

  /** Attempt berjalan yang sudah lewat 24 jam dianggap kedaluwarsa. */
  function _sudahBasi(attempt) {
    var mulai = new Date(attempt.mulai_at).getTime();
    if (!isFinite(mulai)) return false;
    return (Date.now() - mulai) > BATAS_KEDALUWARSA_JAM * 3600000;
  }

  /**
   * Acak soal TANPA memecah kelompok bacaan.
   *
   * Soal yang berbagi satu teks bacaan harus tetap berdampingan dan
   * berurutan; kalau tidak, murid membaca ulang wacana yang sama di
   * posisi acak — dan bacaan yang tersimpan pada soal pertama tidak
   * lagi muncul lebih dulu.
   *
   * Yang diacak adalah BLOK: tiap kelompok dianggap satu blok utuh,
   * soal mandiri jadi blok berisi satu. Urutan di dalam kelompok
   * mengikuti nomor aslinya.
   */
  function _acakJagaGrup(soal, benih) {
    var blok = [];
    var petaGrup = {};

    soal.forEach(function (s) {
      var g = String(s.grup_id || '').trim();
      if (!g) { blok.push([s]); return; }        /* mandiri */
      if (petaGrup[g] === undefined) {
        petaGrup[g] = blok.length;
        blok.push([]);
      }
      blok[petaGrup[g]].push(s);
    });

    /* urutan dalam kelompok TIDAK diacak — soal bacaan biasanya
       disusun mengikuti alur teks */
    blok.forEach(function (b) {
      b.sort(function (a, c) {
        return (Number(a.nomor) || 0) - (Number(c.nomor) || 0);
      });
    });

    var acak = Util.acakBerbenih(blok, benih);
    var hasil = [];
    acak.forEach(function (b) {
      b.forEach(function (s) { hasil.push(s); });
    });
    return hasil;
  }

  /**
   * Susun urutan soal & opsi untuk satu attempt.
   * Benih = attempt_id, sehingga urutan TETAP SAMA saat halaman
   * dimuat ulang (§9.5 aturan 4).
   *
   * @returns {Array} [{s: soal_id, o: [indeks opsi asli]}]
   */
  function _susunUrutan(attemptId, soal, item) {
    var urut = item.acak_soal === true
      ? _acakJagaGrup(soal, attemptId)
      : soal.slice();

    return urut.map(function (s) {
      var jml = _parseJson(s.opsi, []).length;
      var idx = [];
      for (var i = 0; i < jml; i++) idx.push(i);

      /* benih opsi dibedakan per soal agar dua soal tidak teracak
         dengan pola yang persis sama */
      if (item.acak_opsi === true && s.tipe === 'pg' && jml > 1) {
        idx = Util.acakBerbenih(idx, attemptId + '#' + s.soal_id);
      }
      return { s: s.soal_id, o: idx };
    });
  }

  /**
   * Bentuk soal untuk dikirim ke murid — TANPA kunci & pembahasan.
   * Ini satu-satunya jalur soal menuju klien saat pengerjaan (§9.8).
   */
  function _soalUntukMurid(urutan, petaSoal, jawabanPeta) {
    var hasil = [];
    urutan.forEach(function (u, i) {
      var s = petaSoal[u.s];
      if (!s) return;                       /* soal terhapus — lewati */

      var opsiAsli = _parseJson(s.opsi, []);
      var opsi = (u.o || []).map(function (ix) { return opsiAsli[ix]; })
        .filter(function (x) { return x !== undefined; });

      var jw = jawabanPeta[u.s];
      hasil.push({
        soal_id: s.soal_id,
        nomor: i + 1,
        tipe: s.tipe,
        grup_id: s.grup_id || '',
        /* bacaan hanya terisi pada soal pertama kelompok; klien
           menampilkannya di atas pertanyaan */
        stimulus: s.stimulus || '',
        pertanyaan: s.pertanyaan,
        gambar_url: s.gambar_url,
        opsi: opsi,
        bobot: _bobot(s),
        jawaban: jw && jw.j !== undefined ? jw.j : '',
        ragu: !!(jw && jw.r)
        /* kunci & pembahasan SENGAJA tidak disertakan */
      });
    });
    return hasil;
  }

  /** Layar pembuka quiz: aturan, riwayat percobaan, sisa kesempatan. */
  function bukaQuiz(sesi, itemId) {
    var ctx = _quizTerbuka(sesi, itemId);
    var item = ctx.item;

    var soal = _soalItem(itemId);
    var attempt = _attemptMurid(sesi.user_id, itemId);

    var maks = Number(item.max_percobaan) || 0;
    var terpakai = attempt.filter(function (a) {
      return a.status !== 'kedaluwarsa';
    }).length;

    var berjalan = null;
    attempt.forEach(function (a) {
      if (a.status === 'berjalan' && !_sudahBasi(a)) berjalan = a;
    });

    /* nilai tertinggi dari seluruh percobaan (§9.7) */
    var tertinggi = null;
    attempt.forEach(function (a) {
      if (a.nilai === '' || a.nilai === null || a.nilai === undefined) return;
      var n = Number(a.nilai);
      if (!isFinite(n)) return;
      if (tertinggi === null || n > tertinggi) tertinggi = n;
    });

    var totalBobot = 0;
    var adaEsai = false;
    soal.forEach(function (s) {
      totalBobot += _bobot(s);
      if (s.tipe === 'esai') adaEsai = true;
    });

    return {
      item_id: itemId,
      judul: item.judul,
      tujuan_pembelajaran: item.tujuan_pembelajaran,
      petunjuk: item.konten,
      pertemuan_id: item.pertemuan_id,
      pertemuan_judul: ctx.pertemuan.judul,
      kelas_id: ctx.pertemuan.kelas_id,     /* dipakai sidebar navigasi */

      jml_soal: soal.length,
      total_bobot: totalBobot,
      ada_esai: adaEsai,
      kkm: Number(item.kkm) || 0,
      /* Tenggat TANGGAL menggantikan timer hitung mundur (v1.9.0).
         `lewat_batas` memberi tahu murid lebih dulu bahwa
         pengumpulannya akan ditandai terlambat — bukan mengejutkannya
         setelah selesai mengerjakan. */
      batas_waktu: item.batas_waktu ? Util.formatTanggal(item.batas_waktu) : '',
      lewat_batas: _terlambat(item),
      tampilkan_pembahasan: item.tampilkan_pembahasan === true,

      max_percobaan: maks,
      percobaan_terpakai: terpakai,
      sisa_percobaan: maks > 0 ? Math.max(0, maks - terpakai) : null,
      bisa_mulai: soal.length > 0 && (maks <= 0 || terpakai < maks),
      alasan_tak_bisa: soal.length === 0
        ? 'Guru belum menambahkan soal pada quiz ini.'
        : (maks > 0 && terpakai >= maks ? 'Kesempatan mengerjakan sudah habis.' : ''),

      ada_attempt_berjalan: !!berjalan,
      attempt_berjalan_id: berjalan ? berjalan.attempt_id : '',
      sisa_detik_berjalan: berjalan ? _sisaDetik(berjalan, item) : null,

      nilai_tertinggi: tertinggi,
      lulus: tertinggi !== null && tertinggi >= (Number(item.kkm) || 0),
      riwayat: attempt.map(function (a) {
        return {
          attempt_id: a.attempt_id,
          percobaan_ke: Number(a.percobaan_ke),
          status: a.status,
          nilai: a.nilai,
          lulus: a.lulus === true,
          catatan_guru: a.catatan_guru,
          mulai_at: a.mulai_at ? Util.formatTanggal(a.mulai_at) : '',
          selesai_at: a.selesai_at ? Util.formatTanggal(a.selesai_at) : ''
        };
      })
    };
  }

  /**
   * Mulai attempt baru. Bila masih ada attempt berjalan yang belum
   * kedaluwarsa, attempt itulah yang dikembalikan — bukan yang baru.
   */
  function mulaiQuiz(sesi, itemId) {
    var ctx = _quizTerbuka(sesi, itemId);
    var item = ctx.item;

    var soal = _soalItem(itemId);
    if (!soal.length) {
      throw _err('VALIDASI_GAGAL', 'Quiz ini belum punya soal.');
    }

    /* Daftar attempt dibaca SEKALI di dalam kunci, lalu dipakai ulang
       oleh `_selaraskanProgresQuiz` di bawah. Versi lama membacanya
       dua kali per klik "Mulai Quiz" — dan `_selaraskanProgresQuiz`
       sudah lama menerima parameter `daftar` yang tidak pernah
       diisi pemanggilnya (v1.8.10). */
    var daftarAttempt = null;
    var hasil = Db.denganKunci(function () {
      var attempt = _attemptMurid(sesi.user_id, itemId);
      daftarAttempt = attempt;

      /* lanjutkan yang masih berjalan */
      for (var i = 0; i < attempt.length; i++) {
        if (attempt[i].status === 'berjalan') {
          if (_sudahBasi(attempt[i])) {
            Db.perbarui('quiz_attempt', attempt[i]._baris,
              { status: 'kedaluwarsa' });
            continue;
          }
          return { attempt: attempt[i], baru: false };
        }
      }

      /* Jumlah percobaan dihitung dari baris, BUKAN kiriman klien.
         Attempt kedaluwarsa tidak menghanguskan kesempatan. */
      var maks = Number(item.max_percobaan) || 0;
      var terpakai = attempt.filter(function (a) {
        return a.status !== 'kedaluwarsa';
      }).length;
      if (maks > 0 && terpakai >= maks) {
        throw _err('VALIDASI_GAGAL', 'Kesempatan mengerjakan sudah habis.');
      }

      var nomorMaks = 0;
      attempt.forEach(function (a) {
        nomorMaks = Math.max(nomorMaks, Number(a.percobaan_ke) || 0);
      });

      var attemptId = Util.buatId('ATT');
      var urutan = _susunUrutan(attemptId, soal, item);
      var totalBobot = 0;
      soal.forEach(function (s) { totalBobot += _bobot(s); });

      Db.tambah('quiz_attempt', {
        attempt_id: attemptId,
        user_id: sesi.user_id,
        item_id: itemId,
        kelas_id: ctx.pertemuan.kelas_id,
        percobaan_ke: nomorMaks + 1,
        status: 'berjalan',
        urutan_soal: JSON.stringify(urutan),
        jawaban: '[]',
        skor: '', skor_maks: totalBobot,
        nilai: '', lulus: false,
        catatan_guru: '', dibaca_murid: false,
        mulai_at: Util.sekarang(),
        selesai_at: '', dikoreksi_at: ''
      });

      /* Baris baru selalu di akhir sheet — tidak perlu memindai. */
      var nomorBaris = Db.sheet('quiz_attempt').getLastRow();
      var baris = Db.bacaBarisJika('quiz_attempt', nomorBaris,
        { attempt_id: attemptId });
      if (!baris) baris = Db.cariCepat('quiz_attempt', 'attempt_id', attemptId);
      /* attempt baru ikut diperhitungkan saat menyelaraskan progres */
      daftarAttempt = attempt.concat([baris]);
      return { attempt: baris, baru: true };
    });

    /* Selaraskan dari keadaan sebenarnya — JANGAN paksa 'berjalan'.
       Murid yang sudah lulus lalu mengulang tidak boleh kehilangan
       status selesainya. */
    _selaraskanProgresQuiz(sesi.user_id, item, ctx.pertemuan, daftarAttempt);

    if (hasil.baru) {
      Util.catatLog(sesi.user_id, 'mulai_quiz',
        itemId + ' percobaan ' + hasil.attempt.percobaan_ke);
    }
    return _bentukAttempt(hasil.attempt, item, soal);
  }

  /** Kembali ke attempt yang sedang berjalan. */
  function lanjutkanAttempt(sesi, itemId) {
    var ctx = _quizTerbuka(sesi, itemId);
    var soal = _soalItem(itemId);

    var attempt = _attemptMurid(sesi.user_id, itemId);
    var jalan = null;
    attempt.forEach(function (a) {
      if (a.status === 'berjalan') jalan = a;
    });
    if (!jalan) {
      throw _err('TIDAK_DITEMUKAN', 'Tidak ada pengerjaan yang berjalan.');
    }
    if (_sudahBasi(jalan)) {
      Db.perbarui('quiz_attempt', jalan._baris, { status: 'kedaluwarsa' });
      throw _err('VALIDASI_GAGAL',
        'Pengerjaan sudah kedaluwarsa karena lewat ' +
        BATAS_KEDALUWARSA_JAM + ' jam.');
    }
    return _bentukAttempt(jalan, ctx.item, soal);
  }

  /** Payload attempt untuk murid — tanpa kunci jawaban. */
  function _bentukAttempt(attempt, item, soal) {
    var petaSoal = {};
    soal.forEach(function (s) { petaSoal[s.soal_id] = s; });

    var urutan = _parseJson(attempt.urutan_soal, []);
    var jawaban = _parseJson(attempt.jawaban, []);
    var petaJw = {};
    jawaban.forEach(function (j) { petaJw[j.s] = j; });

    var sisa = _sisaDetik(attempt, item);
    var terjawab = jawaban.filter(function (j) {
      return j.j !== undefined && j.j !== null && String(j.j).trim() !== '';
    }).length;

    return {
      attempt_id: attempt.attempt_id,
      item_id: attempt.item_id,
      judul: item.judul,
      percobaan_ke: Number(attempt.percobaan_ke),
      status: attempt.status,
      kkm: Number(item.kkm) || 0,
      batas_waktu_menit: Number(item.batas_waktu_menit) || 0,
      sisa_detik: sisa,
      waktu_habis: sisa !== null && sisa <= 0,
      jml_soal: urutan.length,
      jml_terjawab: terjawab,
      soal: _soalUntukMurid(urutan, petaSoal, petaJw)
    };
  }

  /**
   * Ambil attempt milik sesi ini saja — cegah membuka milik murid lain.
   *
   * Nomor baris di-cache karena autosave memanggil ini setiap murid
   * pindah soal (10x per quiz). Tanpa cache, tiap panggilan memindai
   * seluruh kolom attempt_id. bacaBarisJika memverifikasi ulang isinya,
   * jadi pergeseran baris tetap aman.
   */
  function _attemptMilik(sesi, attemptId) {
    var a = Db.cariBarisCache('quiz_attempt', 'attempt_id', attemptId);
    if (!a) throw _err('TIDAK_DITEMUKAN', 'Pengerjaan tidak ditemukan.');
    if (a.user_id !== sesi.user_id) {
      throw _err('AKSES_DITOLAK', 'Ini bukan pengerjaan Anda.');
    }
    return a;
  }

  /**
   * Autosave satu jawaban (§9.5 aturan 1).
   * Sengaja ringan: tidak menghitung benar/salah, tidak menyentuh
   * progress. Dipanggil setiap murid pindah soal.
   */
  function simpanJawaban(sesi, attemptId, soalId, jawaban, ragu) {
    /* TANPA kunci global (v1.9.1) — memperbarui baris attempt milik
       murid ini saja. Sejak v1.9.0 klien tidak lagi memanggilnya per
       klik, tetapi API-nya dipertahankan untuk peramban lama yang
       localStorage-nya diblokir. */
    return (function () {
      var a = _attemptMilik(sesi, attemptId);
      if (a.status !== 'berjalan') {
        throw _err('VALIDASI_GAGAL', 'Pengerjaan sudah ditutup.');
      }

      /* Penjaga timer dibuang v1.9.0 — quiz tidak lagi berbatas
         waktu hitung mundur. Tenggat kini berupa TANGGAL dan hanya
         menandai "terlambat" saat mengumpulkan (seperti LKPD). */
      var item = _itemQuiz(a.item_id);

      /* soal harus benar-benar bagian dari attempt ini */
      var urutan = _parseJson(a.urutan_soal, []);
      var sah = false;
      for (var i = 0; i < urutan.length; i++) {
        if (urutan[i].s === soalId) { sah = true; break; }
      }
      if (!sah) throw _err('VALIDASI_GAGAL', 'Soal bukan bagian quiz ini.');

      var isi = String(jawaban === null || jawaban === undefined
        ? '' : jawaban).slice(0, 5000);

      var daftar = _parseJson(a.jawaban, []);
      var ketemu = false;
      for (var j = 0; j < daftar.length; j++) {
        if (daftar[j].s === soalId) {
          daftar[j].j = isi;
          if (ragu !== undefined) daftar[j].r = ragu === true;
          ketemu = true;
          break;
        }
      }
      if (!ketemu) {
        var baru = { s: soalId, j: isi };
        if (ragu === true) baru.r = true;
        daftar.push(baru);
      }

      Db.perbarui('quiz_attempt', a._baris,
        { jawaban: JSON.stringify(daftar) });

      return { tersimpan: true, sisa_detik: null };
    })();
  }

  /* ==================================================== PENILAIAN OTOMATIS */

  /** Samakan bentuk jawaban isian sebelum dibandingkan (§9.3). */
  function _normalIsian(v) {
    return String(v === null || v === undefined ? '' : v)
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Periksa satu jawaban terhadap kuncinya.
   * @returns {boolean|null} null untuk esai (perlu koreksi manual)
   */
  function _periksaJawaban(soal, jawabanMurid) {
    if (soal.tipe === 'esai') return null;

    var j = String(jawabanMurid === null || jawabanMurid === undefined
      ? '' : jawabanMurid).trim();
    if (!j) return false;

    if (soal.tipe === 'pg') {
      /* jawaban murid berupa TEKS opsi; bandingkan dengan teks opsi
         pada posisi kunci. Membandingkan huruf saja tidak aman karena
         opsi bisa diacak. */
      var opsi = _parseJson(soal.opsi, []);
      var ik = 'ABCDE'.indexOf(String(soal.kunci || '').toUpperCase());
      if (ik < 0 || ik >= opsi.length) return false;
      return _normalIsian(j) === _normalIsian(opsi[ik]);
    }

    if (soal.tipe === 'benar_salah') {
      return _normalIsian(j) === _normalIsian(soal.kunci);
    }

    /* isian — kunci boleh beberapa alternatif dipisah | */
    var alt = String(soal.kunci || '').split('|');
    for (var i = 0; i < alt.length; i++) {
      if (_normalIsian(alt[i]) && _normalIsian(alt[i]) === _normalIsian(j)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Hitung skor attempt.
   * Soal esai yang belum dinilai guru dihitung 0 sementara, dan
   * ditandai lewat `perluKoreksi`.
   */
  /**
   * Gabungkan jawaban borongan dari klien ke jawaban tersimpan.
   *
   * Sejak v1.9.0 murid mengerjakan quiz OFFLINE: jawaban disimpan di
   * localStorage peramban, lalu dikirim SEKALI saat menekan
   * Kumpulkan. Autosave per klik dihapus — 36 murid × 5 soal = 180
   * permintaan yang seluruhnya mengantre di satu `LockService`
   * skrip, dan mayoritas gagal `SISTEM_SIBUK` (laporan lapangan).
   *
   * Yang tersimpan di server tetap menjadi dasar: kiriman klien
   * hanya MENIMPA jawaban soal yang benar-benar ada di attempt ini.
   * Soal asing diabaikan diam-diam — bukan ditolak, sebab menolak
   * seluruh kiriman karena satu id basi berarti murid kehilangan
   * seluruh pekerjaannya.
   */
  function _gabungJawaban(a, kiriman) {
    var daftar = _parseJson(a.jawaban, []);
    if (!kiriman || !kiriman.length) return daftar;

    /* hanya soal yang memang bagian dari attempt ini */
    var sah = {};
    _parseJson(a.urutan_soal, []).forEach(function (u) { sah[u.s] = true; });

    var peta = {};
    daftar.forEach(function (d, i) { peta[d.s] = i; });

    kiriman.slice(0, 200).forEach(function (k) {
      var sid = String((k && k.s) || '');
      if (!sid || !sah[sid]) return;
      var isi = String(k.j === null || k.j === undefined ? '' : k.j)
        .slice(0, 5000);
      var baru = { s: sid, j: isi };
      if (k.r === true) baru.r = true;
      if (peta[sid] === undefined) { peta[sid] = daftar.length; daftar.push(baru); }
      else daftar[peta[sid]] = baru;
    });
    return daftar;
  }

  /**
   * Lewat tenggat atau tidak — pola yang SAMA dengan `Lkpd._terlambat()`.
   *
   * Quiz memakai `item.batas_waktu` (tanggal), bukan
   * `batas_waktu_menit` (timer hitung mundur). Lewat tenggat tetap
   * boleh mengumpulkan dan nilainya tetap penuh; guru cukup melihat
   * penandanya (v1.9.0).
   */
  function _terlambat(item) {
    if (Util.kosong(item.batas_waktu)) return false;
    return new Date() > new Date(item.batas_waktu);
  }

  function _hitungSkor(urutan, petaSoal, daftarJawaban) {
    var petaJw = {};
    daftarJawaban.forEach(function (j) { petaJw[j.s] = j; });

    var skor = 0, maks = 0, perluKoreksi = 0;
    var rinci = [];

    urutan.forEach(function (u) {
      var s = petaSoal[u.s];
      if (!s) return;                       /* soal dihapus setelah mulai */

      var bobot = _bobot(s);
      maks += bobot;

      var jw = petaJw[u.s] || {};
      var isi = jw.j;

      if (s.tipe === 'esai') {
        /* nilai esai diisi guru; sebelum itu dianggap 0 */
        var n = Number(jw.n);
        var sudah = isFinite(n) && jw.n !== undefined && jw.n !== null
                    && jw.n !== '';
        if (sudah) skor += Math.max(0, Math.min(bobot, n));
        else perluKoreksi++;

        rinci.push({ s: u.s, j: isi === undefined ? '' : isi,
                     b: null, n: sudah ? n : null,
                     fb: jw.fb === undefined ? '' : jw.fb });
      } else {
        var benar = _periksaJawaban(s, isi);
        if (benar) skor += bobot;
        rinci.push({ s: u.s, j: isi === undefined ? '' : isi, b: !!benar });
      }
      if (jw.r) rinci[rinci.length - 1].r = true;
    });

    return {
      skor: skor,
      skor_maks: maks,
      nilai: maks > 0 ? Math.round(skor / maks * 100) : 0,
      perlu_koreksi: perluKoreksi,
      rinci: rinci
    };
  }

  /**
   * Kumpulkan jawaban → hitung nilai di server.
   * Nilai kiriman klien diabaikan sepenuhnya (§9.8).
   */
  function kumpulkanQuiz(sesi, attemptId, jawabanBorongan) {
    /* TANPA kunci global (v1.9.1).
     *
     * Yang ditulis di sini hanya `Db.perbarui('quiz_attempt', …)`
     * pada baris MILIK MURID INI — nomor barisnya sudah pasti dan
     * murid lain tidak pernah menyentuhnya.
     *
     * Kunci ganda ("sudah dikumpulkan") tetap terjaga oleh
     * pemeriksaan status di bawah: attempt yang sudah bukan
     * `berjalan` langsung ditolak.
     *
     * Inilah momen paling serentak dalam satu kelas — 36 murid
     * menekan Kumpulkan dalam menit yang sama. Dengan kunci global,
     * mereka mengantre 43 detik dan sebagian gagal SISTEM_SIBUK
     * (§6.2 no. 56). */
    /* Log ditumpuk, disiram SEKALI di `finally`.

       `catatLog()` memanggil `Db.tambah()`, dan `Db.tambah()`
       mengambil kunci global (rebutan `getLastRow`). Tanpa penumpuk,
       36 murid menekan Kumpulkan bersamaan berarti 36 pengambilan
       kunci — hanya untuk mencatat log (v1.9.1). */
    Util.mulaiTumpukLog();
    try {

    var info = (function () {
      var a = _attemptMilik(sesi, attemptId);
      if (a.status !== 'berjalan') {
        throw _err('VALIDASI_GAGAL', 'Pengerjaan sudah dikumpulkan.');
      }

      var item = _itemQuiz(a.item_id);
      var soal = _soalItem(a.item_id);
      var petaSoal = {};
      soal.forEach(function (s) { petaSoal[s.soal_id] = s; });

      var urutan = _parseJson(a.urutan_soal, []);
      /* Jawaban dari localStorage murid digabung DI DALAM kunci,
         bersama penilaian — satu operasi, satu kunci (v1.9.0). */
      var jawaban = _gabungJawaban(a, jawabanBorongan);
      var h = _hitungSkor(urutan, petaSoal, jawaban);

      var adaEsai = h.perlu_koreksi > 0;
      var status = adaEsai ? 'menunggu_koreksi' : 'selesai';
      var kkm = Number(item.kkm) || 0;
      var lulus = !adaEsai && h.nilai >= kkm;
      var telat = _terlambat(item);

      Db.perbarui('quiz_attempt', a._baris, {
        status: status,
        jawaban: JSON.stringify(h.rinci),
        skor: h.skor,
        skor_maks: h.skor_maks,
        nilai: adaEsai ? '' : h.nilai,
        lulus: lulus,
        /* Terlambat TIDAK mengurangi nilai — hanya menandai, persis
           LKPD. Keputusan guru: quiz ini tugas, bukan ujian. */
        terlambat: telat,
        selesai_at: Util.sekarang()
      });

      return {
        item: item, soal: soal, hitung: h,
        status: status, lulus: lulus, kkm: kkm,
        terlambat: telat,
        percobaan_ke: Number(a.percobaan_ke),
        kelas_id: a.kelas_id
      };
    })();

    var item = info.item;
    var ptm = Db.cariBarisCache('pertemuan', 'pertemuan_id', item.pertemuan_id);

    /* SATU pembacaan attempt dipakai untuk tiga keperluan: nilai
       tertinggi, penyelarasan progres, dan sisa kuota percobaan. */
    var semua = _attemptMurid(sesi.user_id, item.item_id);
    var ringkas = _selaraskanProgresQuiz(sesi.user_id, item, ptm, semua);
    var tertinggi = ringkas.nilai === '' ? null : ringkas.nilai;

    if (info.status === 'menunggu_koreksi') {
      Notif.kirimKeGuru('lkpd_masuk',
        sesi.nama + ' mengumpulkan quiz "' + item.judul +
        '" — ada soal esai yang perlu dikoreksi.',
        '#/koreksi-quiz');
    }

    /* peringatan bila kesempatan habis tanpa lulus */
    var maks = Number(item.max_percobaan) || 0;
    var terpakai = semua.filter(function (a) {
      return a.status !== 'kedaluwarsa';
    }).length;
    if (info.status === 'selesai' && !info.lulus &&
        maks > 0 && terpakai >= maks) {
      Notif.kirimKeGuru('quiz_gagal_habis',
        sesi.nama + ' kehabisan kesempatan pada quiz "' + item.judul + '".',
        '#/koreksi-quiz');
    }

    Util.catatLog(sesi.user_id, 'kumpul_quiz',
      item.item_id + ' percobaan ' + info.percobaan_ke +
      ' nilai ' + (info.status === 'menunggu_koreksi' ? '-' : info.hitung.nilai));

    return _bentukHasil(attemptId, info, tertinggi, terpakai, maks);

    } finally {
      /* `finally` — kegagalan di tengah tidak boleh membuang jejak
         pengumpulan yang terlanjur tercatat. */
      Util.siramTumpukLog();
    }
  }

  /** Hasil setelah dikumpulkan — pembahasan hanya bila diizinkan. */
  function _bentukHasil(attemptId, info, tertinggi, terpakai, maks) {
    var item = info.item;
    var boleh = item.tampilkan_pembahasan === true;

    var petaSoal = {};
    info.soal.forEach(function (s) { petaSoal[s.soal_id] = s; });

    return {
      attempt_id: attemptId,
      item_id: item.item_id,
      judul: item.judul,
      status: info.status,
      menunggu_koreksi: info.status === 'menunggu_koreksi',
      skor: info.hitung.skor,
      skor_maks: info.hitung.skor_maks,
      nilai: info.status === 'menunggu_koreksi' ? null : info.hitung.nilai,
      kkm: info.kkm,
      lulus: info.lulus,
      terlambat: info.terlambat === true,
      nilai_tertinggi: tertinggi,
      percobaan_ke: info.percobaan_ke,
      percobaan_terpakai: terpakai,
      max_percobaan: maks,
      sisa_percobaan: maks > 0 ? Math.max(0, maks - terpakai) : null,
      bisa_ulang: !info.lulus && (maks <= 0 || terpakai < maks),
      tampilkan_pembahasan: boleh,

      /* Kunci & pembahasan dikirim HANYA setelah dikumpulkan, itu pun
         bila guru mengizinkan (§9.5 aturan 5). */
      pembahasan: boleh ? info.hitung.rinci.map(function (r, i) {
        var s = petaSoal[r.s] || {};
        var opsi = _parseJson(s.opsi, []);
        var kunciTeks = s.kunci;
        if (s.tipe === 'pg') {
          var ik = 'ABCDE'.indexOf(String(s.kunci || '').toUpperCase());
          kunciTeks = (ik >= 0 && ik < opsi.length) ? opsi[ik] : s.kunci;
        }
        return {
          nomor: i + 1,
          soal_id: r.s,
          tipe: s.tipe,
          pertanyaan: s.pertanyaan,
          gambar_url: s.gambar_url,
          opsi: opsi,
          bobot: _bobot(s),
          jawaban_murid: r.j,
          kunci: s.tipe === 'esai' ? '' : kunciTeks,
          benar: r.b,
          nilai_esai: r.n === undefined ? null : r.n,
          umpan_balik: r.fb || '',
          pembahasan: s.pembahasan || ''
        };
      }) : []
    };
  }

  /** Lihat hasil attempt yang sudah selesai. */
  function hasilAttempt(sesi, attemptId) {
    var a = _attemptMilik(sesi, attemptId);
    if (a.status === 'berjalan') {
      throw _err('VALIDASI_GAGAL', 'Pengerjaan belum dikumpulkan.');
    }

    var item = _itemQuiz(a.item_id);
    var soal = _soalItem(a.item_id);

    /* tandai umpan balik sudah dibaca */
    if (a.catatan_guru && a.dibaca_murid !== true) {
      Db.perbarui('quiz_attempt', a._baris, { dibaca_murid: true });
    }

    var semua = _attemptMurid(sesi.user_id, a.item_id);
    var tertinggi = null;
    semua.forEach(function (x) {
      var n = Number(x.nilai);
      if (isFinite(n) && x.nilai !== '' &&
          (tertinggi === null || n > tertinggi)) tertinggi = n;
    });
    var maks = Number(item.max_percobaan) || 0;
    var terpakai = semua.filter(function (x) {
      return x.status !== 'kedaluwarsa';
    }).length;

    var info = {
      item: item, soal: soal,
      hitung: {
        skor: Number(a.skor) || 0,
        skor_maks: Number(a.skor_maks) || 0,
        nilai: a.nilai === '' ? 0 : Number(a.nilai),
        rinci: _parseJson(a.jawaban, [])
      },
      status: a.status,
      lulus: a.lulus === true,
      kkm: Number(item.kkm) || 0,
      percobaan_ke: Number(a.percobaan_ke)
    };

    var hasil = _bentukHasil(attemptId, info, tertinggi, terpakai, maks);
    hasil.catatan_guru = a.catatan_guru || '';
    return hasil;
  }

  /**
   * Hitung status progres quiz dari SELURUH attempt murid.
   *
   * Status TIDAK PERNAH ditentukan oleh satu peristiwa saja. Dulu
   * mulaiQuiz memaksa status 'berjalan'; akibatnya murid yang sudah
   * lulus lalu menekan "Ulangi Quiz" kehilangan status selesai dan
   * pertemuan berikutnya TERKUNCI KEMBALI. Menurunkan capaian yang
   * sudah diraih tidak pernah benar — §9.7 menyatakan yang dipakai
   * adalah nilai TERTINGGI dari seluruh percobaan.
   *
   * @returns {{status:string, nilai:(number|string), percobaan:number}}
   */
  function _hitungProgresQuiz(userId, itemId, kkm, daftar) {
    /* `daftar` opsional: bila pemanggil sudah membaca attempt, gunakan
       ulang alih-alih memindai sheet lagi. */
    var list = daftar || _attemptMurid(userId, itemId);

    var tertinggi = null, adaBerjalan = false, adaKoreksi = false,
        adaSelesai = false, aktif = 0;

    list.forEach(function (a) {
      if (a.status !== 'kedaluwarsa') aktif++;
      if (a.status === 'berjalan') adaBerjalan = true;
      if (a.status === 'menunggu_koreksi') adaKoreksi = true;
      if (a.status === 'selesai') adaSelesai = true;

      /* Attempt kedaluwarsa TETAP dihitung nilainya: nilai yang sudah
         diraih adalah fakta, sedangkan kedaluwarsa hanya soal kuota. */
      var n = Number(a.nilai);
      if (a.nilai !== '' && a.nilai !== null && a.nilai !== undefined &&
          isFinite(n) && (tertinggi === null || n > tertinggi)) {
        tertinggi = n;
      }
    });

    var status;
    if (tertinggi !== null && tertinggi >= kkm) status = 'selesai';
    else if (adaBerjalan)  status = 'berjalan';
    else if (adaKoreksi)   status = 'menunggu';
    else if (adaSelesai)   status = 'gagal';
    else                   status = 'berjalan';

    return { status: status,
             nilai: tertinggi === null ? '' : tertinggi,
             percobaan: aktif };
  }

  /** Selaraskan baris progress dari keadaan attempt sebenarnya. */
  function _selaraskanProgresQuiz(userId, item, ptm, daftar) {
    var kkm = Number(item.kkm) || 0;
    var h = _hitungProgresQuiz(userId, item.item_id, kkm, daftar);
    _tulisProgresQuiz(userId, item.item_id, item, ptm,
                      h.status, h.nilai, h.percobaan);
    return h;
  }

  /** Selaraskan baris progress dengan hasil quiz. */
  function _tulisProgresQuiz(userId, itemId, item, ptm, status, nilai, percobaan) {
    Db.tulisProgres(userId, function () {
      /* Dua sumber tebakan nomor baris: cache peta progres murid
         (terisi saat membuka daftar pertemuan) dan cache baris tunggal.
         Keduanya diverifikasi ulang, jadi tebakan basi tidak berbahaya. */
      var pr = null;
      var tebak = Belajar.barisProgresCache(userId, itemId);
      if (tebak) {
        pr = Db.bacaBarisJika('progress', tebak,
          { user_id: userId, item_id: itemId });
      }
      if (!pr) {
        pr = Db.cariBarisCache2('progress', 'user_id', userId,
                                'item_id', itemId);
      }

      var isi = { status: status, updated_at: Util.sekarang() };
      if (nilai !== undefined && nilai !== '') isi.nilai = nilai;
      if (percobaan !== undefined) isi.percobaan = percobaan;
      if (status === 'selesai') isi.waktu_selesai = Util.sekarang();

      if (pr) {
        /* Bila tidak ada yang benar-benar berubah, jangan menulis.
           Setiap tulis membatalkan cache progres murid, dan mulaiQuiz
           dipanggil setiap kali murid membuka halaman pengerjaan. */
        var berubah = String(pr.status) !== String(status) ||
          (isi.nilai !== undefined && String(pr.nilai) !== String(isi.nilai)) ||
          (isi.percobaan !== undefined &&
           String(pr.percobaan) !== String(isi.percobaan));
        if (!berubah) return;

        Db.perbarui('progress', pr._baris, isi);
      } else {
        Db.tambah('progress', {
          progress_id: Util.buatId('PRG'),
          user_id: userId, item_id: itemId,
          pertemuan_id: item.pertemuan_id,
          mp_id: item.mp_id || (ptm ? ptm.mp_id : '') || '',
          kelas_id: ptm ? ptm.kelas_id : item.kelas_id,
          tipe: 'quiz', status: status, bagian_terakhir: 0,
          nilai: nilai === undefined ? '' : nilai,
          percobaan: percobaan === undefined ? 0 : percobaan,
          dibuka_paksa: false, alasan_paksa: '',
          waktu_buka: Util.sekarang(),
          waktu_selesai: status === 'selesai' ? Util.sekarang() : '',
          updated_at: Util.sekarang()
        });
      }
    });
    Beranda.invalidasiProgres(userId);
  }


  /* ==================================================== KOREKSI (guru) */

  /** Antrean attempt yang menunggu koreksi esai. */
  function antreanKoreksi(kelasId) {
    var att = Db.bacaKolom('quiz_attempt',
      ['attempt_id','user_id','item_id','kelas_id','percobaan_ke',
       'status','skor','skor_maks','terlambat','mulai_at','selesai_at'])
      .filter(function (a) {
        if (a.status !== 'menunggu_koreksi') return false;
        return !kelasId || a.kelas_id === kelasId;
      });
    if (!att.length) return [];

    var petaUser = {};
    Db.bacaKolom('users', ['user_id', 'nama']).forEach(function (u) {
      petaUser[u.user_id] = u.nama;
    });
    var petaItem = {};
    Db.bacaKolom('item', ['item_id', 'judul', 'pertemuan_id'])
      .forEach(function (i) { petaItem[i.item_id] = i; });
    var petaPtm = {};
    Db.bacaKolom('pertemuan', ['pertemuan_id', 'urutan'])
      .forEach(function (p) { petaPtm[p.pertemuan_id] = p; });
    var petaKelas = {};
    Db.bacaKolom('kelas', ['kelas_id', 'nama_kelas']).forEach(function (k) {
      petaKelas[k.kelas_id] = k.nama_kelas;
    });

    return att.map(function (a) {
      var it = petaItem[a.item_id] || {};
      var pt = petaPtm[it.pertemuan_id] || {};
      return {
        attempt_id: a.attempt_id,
        user_id: a.user_id,
        nama: petaUser[a.user_id] || '(tidak dikenal)',
        item_id: a.item_id,
        judul_quiz: it.judul || '',
        pertemuan: pt.urutan ? 'Pertemuan ' + pt.urutan : '',
        kelas: petaKelas[a.kelas_id] || '',
        kelas_id: a.kelas_id,
        percobaan_ke: Number(a.percobaan_ke),
        skor_otomatis: a.skor,
        skor_maks: a.skor_maks,
        terlambat: a.terlambat === true,
        selesai_at: a.selesai_at ? Util.formatTanggal(a.selesai_at) : ''
      };
    }).sort(function (a, b) {
      return String(a.selesai_at).localeCompare(String(b.selesai_at));
    });
  }

  /**
   * Daftar seluruh murid pada satu Quiz — termasuk yang BELUM
   * mengerjakan sama sekali.
   *
   * Pelajaran Tahap 6A: antrean saja tidak cukup. Guru perlu melihat
   * siapa yang belum mengerjakan, bukan hanya yang sudah masuk.
   */
  function daftarKelasQuiz(itemId) {
    var item = _itemQuiz(itemId);
    var ptm = Db.cariBarisCache('pertemuan', 'pertemuan_id', item.pertemuan_id);
    var kelas = Db.cariCepat('kelas', 'kelas_id', item.kelas_id);
    var soal = _soalItem(itemId);

    var enroll = Db.saringKolom('enrollment',
      { kelas_id: item.kelas_id, status: 'aktif' }, ['user_id']);

    var petaNama = {};
    Db.bacaKolom('users', ['user_id', 'nama', 'username'])
      .forEach(function (u) { petaNama[u.user_id] = u; });

    /* seluruh attempt pada item ini — baca baris item ini saja */
    var perMurid = {};
    Db.saringBaris('quiz_attempt', 'item_id', itemId,
      ['attempt_id','user_id','percobaan_ke','status','skor','skor_maks',
       'nilai','lulus','terlambat','catatan_guru','mulai_at','selesai_at'])
      .forEach(function (a) {
        (perMurid[a.user_id] = perMurid[a.user_id] || []).push(a);
      });

    var kkm = Number(item.kkm) || 0;

    var hasil = enroll.map(function (e) {
      var u = petaNama[e.user_id] || {};
      var list = (perMurid[e.user_id] || []).sort(function (a, b) {
        return Number(a.percobaan_ke) - Number(b.percobaan_ke);
      });

      var tertinggi = null, adaKoreksi = false, adaBerjalan = false;
      var terakhir = null;
      list.forEach(function (a) {
        if (a.status === 'menunggu_koreksi') adaKoreksi = true;
        if (a.status === 'berjalan') adaBerjalan = true;
        var n = Number(a.nilai);
        if (a.nilai !== '' && isFinite(n) &&
            (tertinggi === null || n > tertinggi)) tertinggi = n;
        terakhir = a;
      });

      var status;
      if (!list.length)        status = 'belum';
      else if (adaBerjalan)    status = 'berjalan';
      else if (adaKoreksi)     status = 'menunggu_koreksi';
      else if (tertinggi !== null && tertinggi >= kkm) status = 'lulus';
      else                     status = 'belum_lulus';

      return {
        user_id: e.user_id,
        nama: u.nama || '(tidak dikenal)',
        username: u.username || '',
        status: status,
        jml_percobaan: list.filter(function (a) {
          return a.status !== 'kedaluwarsa';
        }).length,
        nilai_tertinggi: tertinggi,
        lulus: tertinggi !== null && tertinggi >= kkm,
        /* Penanda terlambat diambil dari attempt TERAKHIR — itulah
           yang dinilai guru (v1.9.0). */
        terlambat: !!(terakhir && terakhir.terlambat === true),
        attempt_terakhir: terakhir ? terakhir.attempt_id : '',
        attempt_koreksi: (function () {
          for (var i = 0; i < list.length; i++) {
            if (list[i].status === 'menunggu_koreksi') return list[i].attempt_id;
          }
          return '';
        })(),
        ada_catatan: list.some(function (a) { return !!a.catatan_guru; }),
        selesai_at: terakhir && terakhir.selesai_at
          ? Util.formatTanggal(terakhir.selesai_at) : ''
      };
    }).sort(function (a, b) {
      /* yang perlu tindakan didahulukan. Bobot mulai dari 1 — dengan
         `bobot[x] || 9`, nilai 0 dianggap falsy dan terlempar ke akhir. */
      var bobot = { menunggu_koreksi: 1, berjalan: 2, belum_lulus: 3,
                    belum: 4, lulus: 5 };
      var d = (bobot[a.status] || 9) - (bobot[b.status] || 9);
      if (d !== 0) return d;
      return String(a.nama).localeCompare(String(b.nama), 'id');
    });

    var rekap = { total: hasil.length, belum: 0, berjalan: 0,
                  menunggu_koreksi: 0, lulus: 0, belum_lulus: 0,
                  jml_nilai: 0, total_nilai: 0 };
    hasil.forEach(function (h) {
      if (rekap[h.status] !== undefined) rekap[h.status]++;
      if (h.nilai_tertinggi !== null) {
        rekap.jml_nilai++;
        rekap.total_nilai += h.nilai_tertinggi;
      }
    });
    rekap.rata_nilai = rekap.jml_nilai
      ? Math.round(rekap.total_nilai / rekap.jml_nilai) : '';
    rekap.sudah_kerja = rekap.total - rekap.belum;
    rekap.persen_kerja = rekap.total
      ? Math.round(rekap.sudah_kerja / rekap.total * 100) : 0;

    return {
      item: {
        item_id: itemId,
        judul: item.judul,
        pertemuan_id: item.pertemuan_id,
        pertemuan_judul: ptm ? ptm.judul : '',
        pertemuan_urutan: ptm ? Number(ptm.urutan) : 0,
        kelas_id: item.kelas_id,
        nama_kelas: kelas ? kelas.nama_kelas : '',
        kkm: kkm,
        jml_soal: soal.length,
        max_percobaan: Number(item.max_percobaan) || 0
      },
      rekap: rekap,
      murid: hasil
    };
  }

  /**
   * Daftar quiz LAIN yang sudah punya soal — untuk dialog impor.
   * Quiz tujuan sendiri dikecualikan.
   */
  function daftarQuizLain(kecualiItemId) {
    var jml = {};
    Db.bacaKolom('soal', ['soal_id', 'item_id']).forEach(function (s) {
      jml[s.item_id] = (jml[s.item_id] || 0) + 1;
    });

    var petaKelas = {};
    Db.bacaKolom('kelas', ['kelas_id', 'nama_kelas']).forEach(function (k) {
      petaKelas[k.kelas_id] = k.nama_kelas;
    });
    var petaPtm = {};
    Db.bacaKolom('pertemuan', ['pertemuan_id', 'urutan'])
      .forEach(function (p) { petaPtm[p.pertemuan_id] = p; });

    return Db.bacaKolom('item',
      ['item_id', 'pertemuan_id', 'kelas_id', 'tipe', 'judul'])
      .filter(function (i) {
        return i.tipe === 'quiz' && i.item_id !== kecualiItemId &&
               jml[i.item_id] > 0;
      })
      .map(function (i) {
        var pt = petaPtm[i.pertemuan_id] || {};
        return {
          item_id: i.item_id,
          judul: i.judul,
          nama_kelas: petaKelas[i.kelas_id] || '',
          pertemuan_urutan: pt.urutan ? Number(pt.urutan) : 0,
          jml_soal: jml[i.item_id]
        };
      })
      .sort(function (a, b) {
        var d = String(a.nama_kelas).localeCompare(String(b.nama_kelas), 'id');
        if (d !== 0) return d;
        return a.pertemuan_urutan - b.pertemuan_urutan;
      });
  }

  /** Detail satu attempt untuk dikoreksi guru — LENGKAP dengan kunci. */
  function detailAttempt(attemptId) {
    var a = Db.cariBarisCache('quiz_attempt', 'attempt_id', attemptId);
    if (!a) throw _err('TIDAK_DITEMUKAN', 'Pengerjaan tidak ditemukan.');

    var item = _itemQuiz(a.item_id);
    var soal = _soalItem(a.item_id);
    var petaSoal = {};
    soal.forEach(function (s) { petaSoal[s.soal_id] = s; });

    var u = Db.cariCepat('users', 'user_id', a.user_id);
    var k = Db.cariCepat('kelas', 'kelas_id', a.kelas_id);

    var urutan = _parseJson(a.urutan_soal, []);
    var jawaban = _parseJson(a.jawaban, []);
    var petaJw = {};
    jawaban.forEach(function (j) { petaJw[j.s] = j; });

    var butir = urutan.map(function (x, i) {
      var s = petaSoal[x.s] || {};
      var jw = petaJw[x.s] || {};
      var opsi = _parseJson(s.opsi, []);
      var kunciTeks = s.kunci;
      if (s.tipe === 'pg') {
        var ik = 'ABCDE'.indexOf(String(s.kunci || '').toUpperCase());
        kunciTeks = (ik >= 0 && ik < opsi.length) ? opsi[ik] : s.kunci;
      }
      return {
        nomor: i + 1,
        soal_id: x.s,
        tipe: s.tipe || '',
        pertanyaan: s.pertanyaan || '(soal telah dihapus)',
        gambar_url: s.gambar_url || '',
        opsi: opsi,
        bobot: _bobot(s),
        kunci: s.tipe === 'esai' ? '' : kunciTeks,
        pembahasan: s.pembahasan || '',
        jawaban_murid: jw.j === undefined ? '' : jw.j,
        benar: jw.b === undefined ? null : jw.b,
        nilai_esai: jw.n === undefined || jw.n === null ? '' : jw.n,
        umpan_balik: jw.fb || '',
        ragu: jw.r === true,
        perlu_koreksi: s.tipe === 'esai'
      };
    });

    return {
      attempt_id: a.attempt_id,
      user_id: a.user_id,
      nama: u ? u.nama : '(tidak dikenal)',
      username: u ? u.username : '',
      item_id: a.item_id,
      judul_quiz: item.judul,
      kelas: k ? k.nama_kelas : '',
      kelas_id: a.kelas_id,
      percobaan_ke: Number(a.percobaan_ke),
      status: a.status,
      skor: a.skor, skor_maks: a.skor_maks,
      nilai: a.nilai, lulus: a.lulus === true,
      kkm: Number(item.kkm) || 0,
      catatan_guru: a.catatan_guru || '',
      mulai_at: a.mulai_at ? Util.formatTanggal(a.mulai_at) : '',
      selesai_at: a.selesai_at ? Util.formatTanggal(a.selesai_at) : '',
      dikoreksi_at: a.dikoreksi_at ? Util.formatTanggal(a.dikoreksi_at) : '',
      jml_esai: butir.filter(function (b) { return b.perlu_koreksi; }).length,
      butir: butir
    };
  }

  /**
   * Simpan koreksi esai. Nilai akhir dihitung ULANG di server dari
   * seluruh butir — nilai kiriman klien tidak dipakai.
   *
   * @param {Array} nilaiButir [{soal_id, nilai, umpan_balik}]
   */
  function koreksiQuiz(sesi, attemptId, nilaiButir, catatan) {
    var isiCatatan = String(catatan || '').trim().slice(0, 1000);

    var info = Db.denganKunci(function () {
      var a = Db.cariBarisCache('quiz_attempt', 'attempt_id', attemptId);
      if (!a) throw _err('TIDAK_DITEMUKAN', 'Pengerjaan tidak ditemukan.');
      if (a.status === 'berjalan') {
        throw _err('VALIDASI_GAGAL', 'Murid belum mengumpulkan quiz ini.');
      }

      var item = _itemQuiz(a.item_id);
      var soal = _soalItem(a.item_id);
      var petaSoal = {};
      soal.forEach(function (s) { petaSoal[s.soal_id] = s; });

      var urutan = _parseJson(a.urutan_soal, []);
      var jawaban = _parseJson(a.jawaban, []);
      var petaJw = {};
      jawaban.forEach(function (j) { petaJw[j.s] = j; });

      /* terapkan nilai esai dari guru */
      (nilaiButir || []).forEach(function (b) {
        var s = petaSoal[b.soal_id];
        if (!s) {
          throw _err('VALIDASI_GAGAL', 'Soal tidak dikenal: ' + b.soal_id);
        }
        if (s.tipe !== 'esai') {
          throw _err('VALIDASI_GAGAL',
            'Hanya soal esai yang dinilai manual (soal ' + b.soal_id + ').');
        }
        var bobot = _bobot(s);
        var n = Number(b.nilai);
        if (!isFinite(n) || n < 0 || n > bobot) {
          throw _err('VALIDASI_GAGAL',
            'Nilai soal esai harus antara 0 dan ' + bobot + '.');
        }
        var jw = petaJw[b.soal_id];
        if (!jw) {
          jw = { s: b.soal_id, j: '' };
          petaJw[b.soal_id] = jw;
          jawaban.push(jw);
        }
        jw.n = n;
        jw.b = null;
        if (b.umpan_balik !== undefined) {
          jw.fb = String(b.umpan_balik || '').slice(0, 1000);
        }
      });

      /* hitung ULANG seluruh skor dari data tersimpan */
      var h = _hitungSkor(urutan, petaSoal, jawaban);
      if (h.perlu_koreksi > 0) {
        throw _err('VALIDASI_GAGAL',
          'Masih ada ' + h.perlu_koreksi + ' soal esai yang belum dinilai.');
      }

      var kkm = Number(item.kkm) || 0;
      var lulus = h.nilai >= kkm;

      Db.perbarui('quiz_attempt', a._baris, {
        status: 'selesai',
        jawaban: JSON.stringify(h.rinci),
        skor: h.skor,
        skor_maks: h.skor_maks,
        nilai: h.nilai,
        lulus: lulus,
        catatan_guru: isiCatatan,
        dibaca_murid: false,
        dikoreksi_at: Util.sekarang()
      });

      return { user_id: a.user_id, item: item, nilai: h.nilai,
               lulus: lulus, kkm: kkm,
               percobaan_ke: Number(a.percobaan_ke) };
    });

    var item = info.item;
    var ptm = Db.cariBarisCache('pertemuan', 'pertemuan_id', item.pertemuan_id);

    _selaraskanProgresQuiz(info.user_id, item, ptm);

    Notif.kirimSatu(info.user_id, 'quiz_dikoreksi',
      'Quiz "' + item.judul + '" sudah dikoreksi. Nilai: ' + info.nilai +
      (info.lulus ? ' (lulus).' : '.'),
      '#/quiz/' + item.item_id);

    Util.catatLog(sesi.user_id, 'koreksi_quiz',
      attemptId + ' → ' + info.nilai);

    return { nilai: info.nilai, lulus: info.lulus };
  }

  /** Tambah catatan pada attempt yang sudah dinilai. */
  function beriFeedbackQuiz(sesi, attemptId, catatan) {
    var isi = String(catatan || '').trim().slice(0, 1000);
    if (!isi) throw _err('VALIDASI_GAGAL', 'Catatan tidak boleh kosong.');

    var a = Db.cariBarisCache('quiz_attempt', 'attempt_id', attemptId);
    if (!a) throw _err('TIDAK_DITEMUKAN', 'Pengerjaan tidak ditemukan.');

    Db.perbarui('quiz_attempt', a._baris, {
      catatan_guru: isi, dibaca_murid: false
    });

    var item = Db.cariCepat('item', 'item_id', a.item_id);
    Notif.kirimSatu(a.user_id, 'feedback_baru',
      'Guru menambahkan catatan pada quiz "' +
      (item ? item.judul : 'Quiz') + '".',
      '#/quiz/' + a.item_id);

    Util.catatLog(sesi.user_id, 'feedback_quiz', attemptId);
    return { terkirim: true };
  }

  /**
   * Beri kesempatan ulang: attempt lama ditandai kedaluwarsa sehingga
   * tidak lagi menghitung kuota percobaan.
   *
   * Riwayat TIDAK dihapus — guru tetap bisa melihat pengerjaan lama,
   * dan nilai tertinggi yang sudah diraih tetap tersimpan.
   */
  function resetPercobaanQuiz(sesi, userId, itemId, alasan) {
    if (Util.kosong(alasan)) {
      throw _err('VALIDASI_GAGAL', 'Alasan wajib diisi.');
    }
    var item = _itemQuiz(itemId);

    var jml = Db.denganKunci(function () {
      var list = _attemptMurid(userId, itemId);
      var ubah = [];
      list.forEach(function (a) {
        if (a.status !== 'kedaluwarsa') {
          ubah.push({ _baris: a._baris, status: 'kedaluwarsa' });
        }
      });
      if (ubah.length) Db.perbaruiBanyak('quiz_attempt', ubah);
      return ubah.length;
    });

    var ptm = Db.cariBarisCache('pertemuan', 'pertemuan_id', item.pertemuan_id);
    /* Reset hanya mengembalikan KUOTA percobaan. Nilai yang sudah
       diraih tetap berlaku — kalau murid sudah lulus, ia tetap lulus. */
    _selaraskanProgresQuiz(userId, item, ptm);

    Notif.kirimSatu(userId, 'feedback_baru',
      'Guru memberi Anda kesempatan mengulang quiz "' + item.judul + '". ' +
      String(alasan).slice(0, 200),
      '#/quiz/' + itemId);

    Util.catatLog(sesi.user_id, 'reset_quiz',
      userId + ' → ' + itemId + ' (' + jml + ' attempt) | ' + alasan);

    return { direset: jml };
  }

  /**
   * Tandai attempt berjalan yang sudah lewat batas sebagai kedaluwarsa.
   * Dipanggil trigger harian (§9.5 aturan 6).
   */
  function bersihkanAttemptBasi() {
    /* saringBaris (bukan bacaKolom) karena perbaruiBanyak butuh _baris.
       Sekaligus lebih hemat: hanya baris berstatus 'berjalan' yang
       benar-benar diambil. */
    var list = Db.saringBaris('quiz_attempt', 'status', 'berjalan',
      ['attempt_id', 'user_id', 'item_id', 'mulai_at']);

    var ubah = [], tersentuh = [];
    list.forEach(function (a) {
      if (!_sudahBasi(a)) return;
      ubah.push({ _baris: a._baris, status: 'kedaluwarsa' });
      tersentuh.push({ user_id: a.user_id, item_id: a.item_id });
    });
    if (!ubah.length) return { kedaluwarsa: 0, progres_diperbaiki: 0 };

    Db.perbaruiBanyak('quiz_attempt', ubah);

    /* Baris progress murid yang attempt-nya baru saja kedaluwarsa masih
       berstatus 'berjalan'. Tanpa penyelarasan, murid yang sebenarnya
       sudah lulus di percobaan sebelumnya akan tampak belum selesai —
       dan pertemuan berikutnya ikut terkunci. */
    var petaItem = {};
    var diperbaiki = 0;
    tersentuh.forEach(function (t) {
      var item = petaItem[t.item_id];
      if (item === undefined) {
        item = Db.cariCepat('item', 'item_id', t.item_id);
        petaItem[t.item_id] = item || null;
      }
      if (!item) return;
      var ptm = Db.cariBarisCache('pertemuan', 'pertemuan_id', item.pertemuan_id);
      _selaraskanProgresQuiz(t.user_id, item, ptm);
      diperbaiki++;
    });

    return { kedaluwarsa: ubah.length, progres_diperbaiki: diperbaiki };
  }

  return {
    /* bank soal */
    getSoalGuru: getSoalGuru,
    simpanSoal: simpanSoal,
    hapusSoal: hapusSoal,
    aturUrutanSoal: aturUrutanSoal,
    imporSoal: imporSoal,
    simpanSoalTerpilih: simpanSoalTerpilih,

    /* murid */
    bukaQuiz: bukaQuiz,
    mulaiQuiz: mulaiQuiz,
    lanjutkanAttempt: lanjutkanAttempt,
    simpanJawaban: simpanJawaban,
    kumpulkanQuiz: kumpulkanQuiz,
    hasilAttempt: hasilAttempt,

    /* koreksi guru */
    antreanKoreksi: antreanKoreksi,
    satukanGrup: satukanGrup, lepasGrup: lepasGrup,
    ubahStimulusGrup: ubahStimulusGrup,
    daftarKelasQuiz: daftarKelasQuiz,
    daftarQuizLain: daftarQuizLain,
    detailAttempt: detailAttempt,
    koreksiQuiz: koreksiQuiz,
    beriFeedbackQuiz: beriFeedbackQuiz,
    resetPercobaanQuiz: resetPercobaanQuiz,
    bersihkanAttemptBasi: bersihkanAttemptBasi,

    /* dipakai modul lain & uji */
    _soalItem: _soalItem,
    _periksaJawaban: _periksaJawaban,
    _hitungSkor: _hitungSkor,
    _susunUrutan: _susunUrutan,
    _sisaDetik: _sisaDetik,
    _parseJson: _parseJson,
    _bobot: _bobot,
    _acakJagaGrup: _acakJagaGrup,
    _rapikanStimulus: _rapikanStimulus,
    MAKS_STIMULUS: MAKS_STIMULUS,
    TIPE_SOAL: TIPE_SOAL,
    TIPE_OTOMATIS: TIPE_OTOMATIS,
    BATAS_KEDALUWARSA_JAM: BATAS_KEDALUWARSA_JAM
  };
})();
