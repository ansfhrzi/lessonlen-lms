/**
 * ============================================================
 *  LessonLen — Pertemuan.gs
 *  CRUD pertemuan + item (materi / lkpd / quiz), salin antar kelas
 * ------------------------------------------------------------
 *  Acuan: KESEPAKATAN-SISTEM.md v4.6 §3, §4.2, §11.4, §11.5
 * ============================================================
 */

var Pertemuan = (function () {

  var TIPE = ['materi', 'lkpd', 'quiz', 'refleksi', 'tugas_kelompok'];

  /* ==================================================== PERTEMUAN */

  /** Daftar pertemuan untuk guru — termasuk draf, dengan cacah item. */
  function daftarGuru(kelasId) {
    var item = Db.saring('item', { kelas_id: kelasId });
    var cacah = {};
    item.forEach(function (i) {
      var k = i.pertemuan_id;
      cacah[k] = cacah[k] || { total: 0, materi: 0, lkpd: 0, quiz: 0, draf: 0 };
      cacah[k].total++;
      if (cacah[k][i.tipe] !== undefined) cacah[k][i.tipe]++;
      if (i.status !== 'publish') cacah[k].draf++;
    });

    return Db.saring('pertemuan', { kelas_id: kelasId })
      .map(function (p) {
        var c = cacah[p.pertemuan_id] || { total:0, materi:0, lkpd:0, quiz:0, draf:0 };
        return {
          pertemuan_id: p.pertemuan_id,
          urutan: Number(p.urutan) || 0,
          judul: p.judul,
          deskripsi: p.deskripsi,
          tujuan_pembelajaran: p.tujuan_pembelajaran,
          wajib: p.wajib === true,
          urut_ketat: p.urut_ketat === true,
          status: p.status,
          jml_item: c.total, jml_materi: c.materi,
          jml_lkpd: c.lkpd, jml_quiz: c.quiz, jml_draf: c.draf
        };
      })
      .sort(function (a, b) { return a.urutan - b.urutan; });
  }

  /**
   * Satu pertemuan — untuk form Ubah.
   *
   * Disusun eksplisit, tanpa kolom tanggal: nilai Date yang rusak di
   * spreadsheet membuat google.script.run gagal menyerialkan balasan,
   * dan galatnya sampai ke peramban tanpa pesan yang bisa dibaca.
   */
  function detail(pertemuanId) {
    var p = Db.cari('pertemuan', 'pertemuan_id', pertemuanId);
    if (!p) throw _err('TIDAK_DITEMUKAN', 'Pertemuan tidak ditemukan.');

    return {
      pertemuan_id: String(p.pertemuan_id || ''),
      mp_id: String(p.mp_id || ''),
      kelas_id: String(p.kelas_id || ''),
      urutan: Number(p.urutan) || 0,
      judul: String(p.judul || ''),
      deskripsi: String(p.deskripsi || ''),
      tujuan_pembelajaran: String(p.tujuan_pembelajaran || ''),
      jenis: p.jenis || 'biasa',
      wajib: p.wajib === true,
      urut_ketat: p.urut_ketat === true,
      status: p.status === 'publish' ? 'publish' : 'draft',

      /* Status BAB ikut dikirim (v1.9.5).

         Murid hanya melihat item bila KETIGA tingkat terbit: bab →
         pertemuan → item. Sebelumnya layar guru hanya menampilkan
         status item, sehingga item bertanda "terbit" tetap tidak
         terlihat murid tanpa penjelasan apa pun — guru melaporkannya
         sebagai "quiz terkunci, pertemuan tidak ditemukan". */
      mp_status: (function () {
        if (!p.mp_id) return 'publish';
        var mp = Db.cariBarisCache('materi_pokok', 'mp_id', p.mp_id);
        return mp && mp.status === 'publish' ? 'publish' : 'draft';
      })(),
      mp_judul: (function () {
        if (!p.mp_id) return '';
        var mp = Db.cariBarisCache('materi_pokok', 'mp_id', p.mp_id);
        return mp ? String(mp.judul || '') : '';
      })()
    };
  }

  /**
   * Materi Pokok bawaan sebuah kelas — dibuat bila belum ada.
   *
   * Pemanggil boleh menyebut `kelas_id` saja tanpa `mp_id`; pertemuan
   * akan masuk ke materi pokok pertama kelas itu. Ini menjaga alur
   * lama tetap jalan dan memudahkan guru yang belum membutuhkan
   * pengelompokan bab.
   */
  function _mpBawaan(sesi, kelasId) {
    var ada = Db.saringBaris('materi_pokok', 'kelas_id', kelasId,
      ['mp_id', 'urutan'])
      .sort(function (a, b) { return Number(a.urutan) - Number(b.urutan); });
    if (ada.length) return ada[0].mp_id;

    if (!Db.cariBarisCache('kelas', 'kelas_id', kelasId)) {
      throw _err('TIDAK_DITEMUKAN', 'Kelas tidak ditemukan.');
    }
    return MateriPokok.simpan(sesi, {
      kelas_id: kelasId,
      judul: 'Materi Pokok 1',
      status: 'publish'
    }).mp_id;
  }

  function simpan(sesi, p) {
    if (Util.kosong(p.judul)) throw _err('VALIDASI_GAGAL', 'Judul wajib diisi.');

    /* mp_id boleh diturunkan dari kelas_id demi kompatibilitas */
    if (!p.pertemuan_id && Util.kosong(p.mp_id)) {
      if (Util.kosong(p.kelas_id)) {
        throw _err('VALIDASI_GAGAL', 'Materi Pokok atau Kelas wajib dipilih.');
      }
      p = Object.keys(p).reduce(function (o, k) { o[k] = p[k]; return o; }, {});
      p.mp_id = _mpBawaan(sesi, p.kelas_id);
    }

    /* hanya kolom yang dikirim yang diperbarui (§ cegah edit parsial) */
    var isi = Util.isiBilaAda({ updated_at: Util.sekarang() }, p, {
      judul:               Util.teks(150),
      deskripsi:           Util.teks(1000),
      tujuan_pembelajaran: Util.teks(1000),
      wajib:               function (v) { return v !== false; },
      urut_ketat:          function (v) { return v !== false; },
      /* biasa | ujian | refleksi — nilai asing dikembalikan ke 'biasa'
         supaya enum sheet tidak pernah ternoda */
      jenis:               function (v) {
        return (v === 'ujian' || v === 'refleksi') ? v : 'biasa';
      },
      status:              function (v) { return v === 'publish' ? 'publish' : 'draft'; }
    });

    /* ---- edit ---- */
    if (p.pertemuan_id) {
      var ada = Db.cari('pertemuan', 'pertemuan_id', p.pertemuan_id);
      if (!ada) throw _err('TIDAK_DITEMUKAN', 'Pertemuan tidak ditemukan.');

      var terbitBaru = isi.status === 'publish' && ada.status !== 'publish';
      Db.perbarui('pertemuan', ada._baris, isi);

      if (terbitBaru) _notifTerbit(ada.kelas_id, isi.judul, p.pertemuan_id);
      Util.catatLog(sesi.user_id, 'edit_pertemuan', p.pertemuan_id);
      return { pertemuan_id: p.pertemuan_id, baru: false };
    }

    /* ---- tambah ---- */
    /* kelas_id diturunkan dari materi pokok, bukan dikirim klien —
       satu sumber kebenaran, tidak mungkin tidak sinkron */
    var mp = Db.cariBarisCache('materi_pokok', 'mp_id', p.mp_id);
    if (!mp) throw _err('TIDAK_DITEMUKAN', 'Materi Pokok tidak ditemukan.');
    var kelasIdMp = mp.kelas_id;

    /* urutan dihitung DALAM materi pokok, bukan seluruh kelas */
    var maks = 0;
    Db.saringBaris('pertemuan', 'mp_id', p.mp_id, ['urutan'])
      .forEach(function (r) {
        maks = Math.max(maks, Number(r.urutan) || 0);
      });

    /* nilai bawaan untuk pertemuan baru */
    if (isi.deskripsi === undefined) isi.deskripsi = '';
    if (isi.tujuan_pembelajaran === undefined) isi.tujuan_pembelajaran = '';
    if (isi.wajib === undefined) isi.wajib = true;
    if (isi.urut_ketat === undefined) isi.urut_ketat = true;
    if (isi.status === undefined) isi.status = 'draft';

    if (isi.jenis === undefined) isi.jenis = 'biasa';

    isi.pertemuan_id = Util.buatId('PTM');
    isi.mp_id = p.mp_id;
    isi.kelas_id = kelasIdMp;
    isi.urutan = maks + 1;
    isi.created_at = Util.sekarang();
    Db.tambah('pertemuan', isi);

    /* kelasIdMp, bukan p.kelas_id: pemanggil baru hanya mengirim mp_id
       sehingga p.kelas_id undefined dan notifikasi tidak pernah terkirim */
    if (isi.status === 'publish') _notifTerbit(kelasIdMp, isi.judul, isi.pertemuan_id);
    Util.catatLog(sesi.user_id, 'buat_pertemuan',
                  isi.pertemuan_id + ' urutan ' + isi.urutan);
    return { pertemuan_id: isi.pertemuan_id, urutan: isi.urutan, baru: true };
  }

  function hapus(sesi, pertemuanId) {
    var p = Db.cariCepat('pertemuan', 'pertemuan_id', pertemuanId);
    if (!p) throw _err('TIDAK_DITEMUKAN', 'Pertemuan tidak ditemukan.');

    var daftarItem = Db.saringBaris('item', 'pertemuan_id', pertemuanId,
      ['item_id']);
    var idItem = daftarItem.map(function (i) { return i.item_id; });

    /* Db.baca() memindahkan SELURUH sheet — pada `progress` 32.400 baris
       itu 486.000 sel hanya untuk menemukan beberapa baris.

       `progress` punya kolom pertemuan_id, jadi satu pemindaian cukup.
       Sheet lain hanya punya item_id, tetapi jumlah itemnya sedikit
       (biasanya 3-5 per pertemuan) sehingga tetap jauh lebih murah
       daripada membaca seluruh sheet. */
    var barisProg = Db.saringBaris('progress', 'pertemuan_id', pertemuanId,
      ['pertemuan_id']).map(function (r) { return r._baris; });
    if (barisProg.length) Db.hapusBanyak('progress', barisProg);

    /* satu pemindaian per sheet untuk SELURUH item, bukan per item */
    ['quiz_attempt','lkpd_submission','kelompok','materi_ai','soal']
      .forEach(function (sheet) {
        var baris = Db.saringBarisBanyak(sheet, 'item_id', idItem, ['item_id'])
          .map(function (r) { return r._baris; });
        if (baris.length) Db.hapusBanyak(sheet, baris);
      });

    var barisItem = daftarItem.map(function (i) { return i._baris; });
    if (barisItem.length) Db.hapusBanyak('item', barisItem);

    Db.hapus('pertemuan',
      Db.cariCepat('pertemuan', 'pertemuan_id', pertemuanId)._baris);
    _rapikanUrutan(p.mp_id);

    Util.catatLog(sesi.user_id, 'hapus_pertemuan',
                  pertemuanId + ' (' + idItem.length + ' item)');
    return { terhapus: true, item_terhapus: idItem.length };
  }

  /** Ubah urutan pertemuan. ids = daftar pertemuan_id sesuai urutan baru. */
  function aturUrutan(sesi, kelasId, ids) {
    var peta = {};
    Db.saring('pertemuan', { kelas_id: kelasId }).forEach(function (p) {
      peta[p.pertemuan_id] = p;
    });

    var ubah = [];
    ids.forEach(function (id, i) {
      var p = peta[id];
      if (p && Number(p.urutan) !== i + 1) {
        ubah.push({ _baris: p._baris, urutan: i + 1 });
      }
    });
    if (ubah.length) Db.perbaruiBanyak('pertemuan', ubah);
    Util.catatLog(sesi.user_id, 'atur_urutan_pertemuan', kelasId);
    return { diubah: ubah.length };
  }

  /**
   * Rapikan urutan pertemuan DALAM satu materi pokok.
   * Dulu per kelas; setelah hierarki tiga tingkat, penomoran
   * dimulai ulang di tiap materi pokok (1.1, 1.2, lalu 2.1 …).
   */
  function _rapikanUrutan(mpId) {
    if (!mpId) return;
    var list = Db.saringBaris('pertemuan', 'mp_id', mpId, ['urutan'])
      .sort(function (a, b) { return Number(a.urutan) - Number(b.urutan); });
    var ubah = [];
    list.forEach(function (p, i) {
      if (Number(p.urutan) !== i + 1) ubah.push({ _baris: p._baris, urutan: i + 1 });
    });
    if (ubah.length) Db.perbaruiBanyak('pertemuan', ubah);
  }

  /**
   * Pindahkan satu pertemuan ke Materi Pokok lain.
   *
   * `mp_id` sengaja TIDAK bisa diubah lewat simpan(): kepindahan
   * bukan sekadar mengganti satu kolom — item dan progress ikut
   * membawa `mp_id` demi penghapusan berantai yang murah, jadi
   * ketiganya harus berubah bersama-sama. Bila hanya kolom
   * pertemuan yang diubah, menghapus materi pokok tujuan akan
   * meninggalkan item & progres yatim (pelajaran v1.0.1).
   */
  function pindah(sesi, pertemuanId, mpTujuan) {
    var p = Db.cariBarisCache('pertemuan', 'pertemuan_id', pertemuanId);
    if (!p) throw _err('TIDAK_DITEMUKAN', 'Pertemuan tidak ditemukan.');

    var mp = Db.cariBarisCache('materi_pokok', 'mp_id', mpTujuan);
    if (!mp) throw _err('TIDAK_DITEMUKAN', 'Materi Pokok tujuan tidak ditemukan.');

    /* lintas kelas dilarang: kelas_id item & progress tidak ikut
       diperbarui, dan murid kelas lain tidak ter-enroll di sini */
    if (String(mp.kelas_id) !== String(p.kelas_id)) {
      throw _err('VALIDASI_GAGAL',
        'Pertemuan hanya bisa dipindah antar Materi Pokok dalam kelas yang sama.');
    }

    var mpAsal = p.mp_id || '';
    if (String(mpAsal) === String(mpTujuan)) return { dipindah: false };

    var maks = 0;
    Db.saringBaris('pertemuan', 'mp_id', mpTujuan, ['urutan'])
      .forEach(function (r) { maks = Math.max(maks, Number(r.urutan) || 0); });

    Db.perbarui('pertemuan', p._baris, {
      mp_id: mpTujuan, urutan: maks + 1, updated_at: Util.sekarang()
    });

    /* item ikut pindah */
    var ubahItem = Db.saringBaris('item', 'pertemuan_id', pertemuanId, ['mp_id'])
      .map(function (r) { return { _baris: r._baris, mp_id: mpTujuan }; });
    if (ubahItem.length) Db.perbaruiBanyak('item', ubahItem);

    /* progress juga — kolomnya dipakai MateriPokok.hapus() */
    var ubahProg = Db.saringBaris('progress', 'pertemuan_id', pertemuanId,
      ['mp_id']).map(function (r) { return { _baris: r._baris, mp_id: mpTujuan }; });
    if (ubahProg.length) Db.perbaruiBanyak('progress', ubahProg);

    _rapikanUrutan(mpAsal);

    Util.catatLog(sesi.user_id, 'pindah_pertemuan',
      pertemuanId + ' → ' + mpTujuan +
      ' (' + ubahItem.length + ' item, ' + ubahProg.length + ' progres)');
    return { dipindah: true, item: ubahItem.length, progres: ubahProg.length };
  }

  /* ==================================================== ITEM */

  /** Daftar item dalam satu pertemuan — untuk guru. */
  function daftarItem(pertemuanId) {
    var soal = Db.baca('soal');
    var cacahSoal = {};
    soal.forEach(function (s) {
      cacahSoal[s.item_id] = (cacahSoal[s.item_id] || 0) + 1;
    });

    return Db.saring('item', { pertemuan_id: pertemuanId })
      .map(function (i) {
        return {
          item_id: i.item_id,
          tipe: i.tipe,
          urutan: Number(i.urutan) || 0,
          judul: i.judul,
          deskripsi: i.deskripsi,
          tujuan_pembelajaran: i.tujuan_pembelajaran,
          wajib: i.wajib === true,
          status: i.status,
          jml_bagian: Number(i.jml_bagian) || 0,
          jml_soal: cacahSoal[i.item_id] || 0,
          kkm: i.kkm,
          sumber_ai: i.sumber_ai === true,
          ai_ditinjau: i.ai_ditinjau === true,
          ada_konten: !Util.kosong(i.konten)
        };
      })
      .sort(function (a, b) { return a.urutan - b.urutan; });
  }

  /** Detail item lengkap dengan konten — untuk editor guru. */
  function detailItem(itemId) {
    var i = Db.cari('item', 'item_id', itemId);
    if (!i) throw _err('TIDAK_DITEMUKAN', 'Item tidak ditemukan.');
    delete i._baris;

    ['wajib','acak_soal','acak_opsi','tampilkan_pembahasan',
     'sumber_ai','ai_ditinjau'].forEach(function (k) {
      i[k] = i[k] === true;
    });
    i.jml_bagian = Number(i.jml_bagian) || 0;
    return i;
  }

  function simpanItem(sesi, p) {
    if (Util.kosong(p.judul)) throw _err('VALIDASI_GAGAL', 'Judul wajib diisi.');
    if (!p.item_id) {
      if (Util.kosong(p.pertemuan_id)) {
        throw _err('VALIDASI_GAGAL', 'Pertemuan wajib dipilih.');
      }
      if (TIPE.indexOf(p.tipe) === -1) {
        throw _err('VALIDASI_GAGAL', 'Jenis item tidak sah.');
      }
    }

    var isi = Util.isiBilaAda({ updated_at: Util.sekarang() }, p, {
      judul: Util.teks(150),
      wajib: function (v) { return v !== false; }
    });

    /* Hanya perbarui kolom yang benar-benar dikirim.
       Tanpa ini, edit parsial (mis. hanya mencentang ai_ditinjau)
       akan MENGHAPUS konten yang sudah ditulis. */
    if (p.konten !== undefined) {
      var konten = Util.sanitasi(p.konten || '');
      isi.konten = konten;
      isi.jml_bagian = konten ? Util.hitungBagian(konten) : 0;
    }
    if (p.deskripsi !== undefined) {
      isi.deskripsi = String(p.deskripsi).slice(0, 500);
    }
    if (p.tujuan_pembelajaran !== undefined) {
      isi.tujuan_pembelajaran = String(p.tujuan_pembelajaran).slice(0, 1000);
    }
    if (p.min_durasi_detik !== undefined) {
      isi.min_durasi_detik = Number(p.min_durasi_detik) || 0;
    }
    if (p.batas_waktu !== undefined) isi.batas_waktu = p.batas_waktu || '';
    if (p.status !== undefined) {
      isi.status = p.status === 'publish' ? 'publish' : 'draft';
    }

    /* Penanda sumber AI juga berlaku saat EDIT — bukan hanya saat item
       dibuat. Alur nyata generator adalah: item dibuat manual (kosong),
       lalu diisi hasil AI lewat edit. Tanpa baris ini penanda tidak
       pernah tersimpan, sehingga guard "AI wajib ditinjau" di bawah
       tidak pernah aktif dan materi AI bisa langsung terbit. */
    if (p.sumber_ai !== undefined) isi.sumber_ai = p.sumber_ai === true;

    /* pengaturan khusus quiz — juga hanya bila dikirim */
    if (p.tipe === 'quiz' || (p.item_id && _tipeItem(p.item_id) === 'quiz')) {
      Util.isiBilaAda(isi, p, {
        acak_soal:            function (v) { return v !== false; },
        acak_opsi:            function (v) { return v !== false; },
        tampilkan_pembahasan: function (v) { return v !== false; },
        batas_waktu_menit:    Util.angka(0),
        kkm:                  Util.angka(75),
        max_percobaan:        Util.angka(3)
      });
    }

    /* ---- edit ---- */
    if (p.item_id) {
      var ada = Db.cari('item', 'item_id', p.item_id);
      if (!ada) throw _err('TIDAK_DITEMUKAN', 'Item tidak ditemukan.');

      /* materi hasil AI wajib ditinjau sebelum terbit (§8.4) */
      var statusAkhir = isi.status !== undefined ? isi.status : ada.status;
      if (statusAkhir === 'publish' && ada.sumber_ai === true &&
          ada.ai_ditinjau !== true && p.ai_ditinjau !== true) {
        throw _err('VALIDASI_GAGAL',
          'Materi hasil AI harus ditandai sudah ditinjau sebelum diterbitkan.');
      }
      if (p.ai_ditinjau !== undefined) isi.ai_ditinjau = p.ai_ditinjau === true;

      Db.perbarui('item', ada._baris, isi);
      Util.catatLog(sesi.user_id, 'edit_item', p.item_id);
      return { item_id: p.item_id, baru: false,
               jml_bagian: isi.jml_bagian !== undefined
                 ? isi.jml_bagian : Number(ada.jml_bagian) || 0 };
    }

    /* ---- tambah ----

       `cariBarisCache` mengingat nomor barisnya, sedangkan `Db.cari`
       membaca SELURUH sheet `pertemuan` setiap kali. Membuat 100 item
       berarti 100 pembacaan penuh — separuh dari 132 detik yang
       terukur di lapangan (v1.8.5). */
    var ptm = Db.cariBarisCache('pertemuan', 'pertemuan_id',
                                p.pertemuan_id);
    if (!ptm) throw _err('TIDAK_DITEMUKAN', 'Pertemuan tidak ditemukan.');

    /* LKPD, quiz, dan refleksi maksimal satu per pertemuan (§3.2).
       Materi boleh banyak — itulah "submateri". */
    /* `saringBaris` membaca kolom seperlunya lewat kolom kunci —
       `Db.saring()` menyeret SELURUH sheet `item` termasuk `konten`
       yang bisa puluhan ribu karakter per baris.

       Terukur di lapangan (v1.8.5): membuat 40 item memakan 132
       detik karena tiap item memicu dua pembacaan penuh. Dengan
       pembacaan terarah, kerangka 20 pertemuan tidak lagi mendekati
       batas 6 menit Apps Script. */
    var itemPtm = Db.saringBaris('item', 'pertemuan_id', p.pertemuan_id,
      ['item_id', 'tipe', 'urutan']);

    if (p.tipe === 'lkpd' || p.tipe === 'quiz' ||
        p.tipe === 'refleksi' || p.tipe === 'tugas_kelompok') {
      var sudahAda = itemPtm.filter(function (r) {
        return r.tipe === p.tipe;
      }).length;
      if (sudahAda > 0) {
        /* Nama enum jangan pernah bocor apa adanya ke guru:
           "TUGAS_KELOMPOK" bukan istilah yang dikenalnya. */
        var NAMA_TIPE = { lkpd: 'LKPD', quiz: 'Quiz',
                          refleksi: 'Refleksi',
                          tugas_kelompok: 'Tugas Kelompok' };
        throw _err('DUPLIKAT',
          'Pertemuan ini sudah memiliki ' +
          (NAMA_TIPE[p.tipe] || p.tipe) + '.');
      }
    }

    /* dipakai ulang dari pembacaan di atas — bukan membaca lagi */
    var maks = 0;
    itemPtm.forEach(function (r) {
      maks = Math.max(maks, Number(r.urutan) || 0);
    });

    /* nilai bawaan untuk item baru */
    if (isi.konten === undefined) { isi.konten = ''; isi.jml_bagian = 0; }
    if (isi.deskripsi === undefined) isi.deskripsi = '';
    if (isi.tujuan_pembelajaran === undefined) isi.tujuan_pembelajaran = '';
    if (isi.min_durasi_detik === undefined) isi.min_durasi_detik = 0;
    if (isi.batas_waktu === undefined) isi.batas_waktu = '';
    if (isi.status === undefined) isi.status = 'draft';
    if (isi.wajib === undefined) isi.wajib = true;

    isi.item_id = Util.buatId('ITM');
    isi.pertemuan_id = p.pertemuan_id;
    isi.kelas_id = ptm.kelas_id;
    isi.mp_id = ptm.mp_id || '';        /* diwarisi, bukan dikirim klien */
    isi.tipe = p.tipe;
    isi.urutan = maks + 1;
    isi.sumber_ai = p.sumber_ai === true;
    isi.ai_ditinjau = false;
    isi.created_at = Util.sekarang();

    if (p.tipe === 'quiz') {
      if (isi.kkm === undefined) isi.kkm = 75;
      if (isi.max_percobaan === undefined) isi.max_percobaan = 3;
      if (isi.acak_soal === undefined) isi.acak_soal = true;
      if (isi.acak_opsi === undefined) isi.acak_opsi = true;
      if (isi.tampilkan_pembahasan === undefined) isi.tampilkan_pembahasan = true;
      if (isi.batas_waktu_menit === undefined) isi.batas_waktu_menit = 0;
    }

    Db.tambah('item', isi);
    Util.catatLog(sesi.user_id, 'buat_item',
                  isi.item_id + ' ' + p.tipe + ' di ' + p.pertemuan_id);
    return { item_id: isi.item_id, urutan: isi.urutan, baru: true,
             jml_bagian: isi.jml_bagian };
  }

  function hapusItem(sesi, itemId) {
    var i = Db.cari('item', 'item_id', itemId);
    if (!i) throw _err('TIDAK_DITEMUKAN', 'Item tidak ditemukan.');

    ['progress','quiz_attempt','lkpd_submission','kelompok',
     'materi_ai','soal']
      .forEach(function (sheet) {
        var baris = Db.saring(sheet, { item_id: itemId })
          .map(function (r) { return r._baris; });
        if (baris.length) Db.hapusBanyak(sheet, baris);
      });

    Db.hapus('item', Db.cari('item', 'item_id', itemId)._baris);
    _rapikanUrutanItem(i.pertemuan_id);

    Util.catatLog(sesi.user_id, 'hapus_item', itemId + ' ' + i.tipe);
    return { terhapus: true };
  }

  function aturUrutanItem(sesi, pertemuanId, ids) {
    var peta = {};
    Db.saring('item', { pertemuan_id: pertemuanId }).forEach(function (i) {
      peta[i.item_id] = i;
    });
    var ubah = [];
    ids.forEach(function (id, idx) {
      var i = peta[id];
      if (i && Number(i.urutan) !== idx + 1) {
        ubah.push({ _baris: i._baris, urutan: idx + 1 });
      }
    });
    if (ubah.length) Db.perbaruiBanyak('item', ubah);
    return { diubah: ubah.length };
  }

  function _rapikanUrutanItem(pertemuanId) {
    var list = Db.saring('item', { pertemuan_id: pertemuanId })
      .sort(function (a, b) { return Number(a.urutan) - Number(b.urutan); });
    var ubah = [];
    list.forEach(function (i, idx) {
      if (Number(i.urutan) !== idx + 1) ubah.push({ _baris: i._baris, urutan: idx + 1 });
    });
    if (ubah.length) Db.perbaruiBanyak('item', ubah);
  }

  function _tipeItem(itemId) {
    var i = Db.cari('item', 'item_id', itemId);
    return i ? i.tipe : '';
  }


  /* ==================================================== SALIN */

  /**
   * Salin pertemuan (beserta item & soal) ke kelas lain.
   * Fitur penghemat waktu terbesar untuk 12 kelas (§4.2 Langkah 5).
   */
  /**
   * @param {boolean} cerminStruktur bila true, Materi Pokok asal
   *   direplikasi di kelas tujuan dan tiap pertemuan mendarat di bab
   *   padanannya. Dipakai duplikat kelas — tanpa ini seluruh bab
   *   runtuh menjadi satu.
   */
  function salin(sesi, pertemuanIds, kelasTujuan, cerminStruktur) {
    if (!pertemuanIds || !pertemuanIds.length) {
      throw _err('VALIDASI_GAGAL', 'Pilih minimal satu pertemuan.');
    }
    if (!kelasTujuan || !kelasTujuan.length) {
      throw _err('VALIDASI_GAGAL', 'Pilih minimal satu kelas tujuan.');
    }

    var semuaPtm  = Db.baca('pertemuan');
    var semuaItem = Db.baca('item');
    var semuaSoal = Db.baca('soal');
    var now = Util.sekarang();

    var petaPtm = {};
    semuaPtm.forEach(function (p) { petaPtm[p.pertemuan_id] = p; });

    /* Materi Pokok tujuan tiap kelas — dibuat bila kelas itu belum punya.
       Tanpa ini salinan lahir dengan mp_id kosong: yatim, tidak terlihat
       murid, dan menumpang mp_id kelas ASAL sehingga menghapus materi
       pokok di kelas asal ikut menghapus isi kelas tujuan.

       Dibuat MALAS — hanya saat benar-benar dipakai. Pada mode cermin
       tiap pertemuan mendarat di bab replikanya sendiri, sehingga
       memanggil _mpBawaan() di muka akan meninggalkan "Materi Pokok 1"
       kosong yang tidak pernah dipakai di setiap kelas hasil duplikat. */
    var mpTujuan = {};
    function _mpBawaanKelas(kid) {
      if (!mpTujuan[kid]) mpTujuan[kid] = _mpBawaan(sesi, kid);
      return mpTujuan[kid];
    }

    /* --- mode cermin: replikasi bab asal ke tiap kelas tujuan --- */
    var petaMp = {};        /* kelas tujuan → { mp_id asal: mp_id baru } */
    if (cerminStruktur) {
      var mpAsalDipakai = [];
      pertemuanIds.forEach(function (pid) {
        var a = petaPtm[pid];
        if (a && a.mp_id && mpAsalDipakai.indexOf(a.mp_id) === -1) {
          mpAsalDipakai.push(a.mp_id);
        }
      });

      var detailMp = {};
      mpAsalDipakai.forEach(function (id) {
        var m = Db.cariBarisCache('materi_pokok', 'mp_id', id);
        if (m) detailMp[id] = m;
      });
      mpAsalDipakai.sort(function (a, b) {
        return Number((detailMp[a] || {}).urutan || 0) -
               Number((detailMp[b] || {}).urutan || 0);
      });

      kelasTujuan.forEach(function (kid) {
        petaMp[kid] = {};
        mpAsalDipakai.forEach(function (id) {
          var m = detailMp[id];
          if (!m) return;
          petaMp[kid][id] = MateriPokok.simpan(sesi, {
            kelas_id: kid,
            judul: m.judul,
            deskripsi: m.deskripsi,
            tujuan_pembelajaran: m.tujuan_pembelajaran,
            wajib: m.wajib === true,
            urut_ketat: m.urut_ketat === true,
            status: 'draft'          /* seperti pertemuannya: guru tinjau dulu */
          }).mp_id;
        });
      });
    }

    /** Materi Pokok tujuan untuk satu pertemuan asal. */
    function _mpUntuk(kid, asal) {
      if (cerminStruktur && petaMp[kid] && petaMp[kid][asal.mp_id]) {
        return petaMp[kid][asal.mp_id];
      }
      return _mpBawaanKelas(kid);
    }

    /* Urutan tertinggi dihitung per MATERI POKOK tujuan, bukan per kelas:
       setelah hierarki tiga tingkat penomoran dimulai ulang di tiap bab
       (1.1, 1.2, lalu 2.1). Menghitung per kelas membuat salinan
       bernomor lompat, mis. langsung 2.16.

       Kuncinya mp_id, sehingga mode cermin yang memakai beberapa bab
       sekaligus tetap tertangani. */
    var maksUrutan = {};
    semuaPtm.forEach(function (p) {
      var k = String(p.mp_id || '');
      if (!k) return;
      maksUrutan[k] = Math.max(maksUrutan[k] || 0, Number(p.urutan) || 0);
    });

    /* KELOMPOK SENGAJA TIDAK DISALIN (v1.7.0).

       Kelompok merujuk user_id murid kelas ASAL; menyalinnya ke kelas
       lain akan membuat kelompok berisi murid yang tidak terdaftar di
       sana — persis kelas bug lintas kelas v1.1.1. Guru membentuk
       kelompoknya sendiri di kelas tujuan. */
    var ptmBaru = [], itemBaru = [], soalBaru = [];
    var jml = { pertemuan: 0, item: 0, soal: 0 };

    kelasTujuan.forEach(function (kid) {
      pertemuanIds.forEach(function (pid) {
        var asal = petaPtm[pid];
        if (!asal) return;
        if (asal.kelas_id === kid) return;      /* jangan salin ke diri sendiri */

        var idPtmBaru = Util.buatId('PTM');
        var mpIni = _mpUntuk(kid, asal);
        maksUrutan[mpIni] = (maksUrutan[mpIni] || 0) + 1;

        ptmBaru.push({
          pertemuan_id: idPtmBaru, mp_id: mpIni, kelas_id: kid,
          urutan: maksUrutan[mpIni], judul: asal.judul,
          deskripsi: asal.deskripsi,
          tujuan_pembelajaran: asal.tujuan_pembelajaran,
          /* jenis ikut disalin: Ujian yang disalin harus tetap Ujian */
          jenis: asal.jenis || 'biasa',
          wajib: asal.wajib === true, urut_ketat: asal.urut_ketat === true,
          status: 'draft',                      /* selalu draf, guru tinjau dulu */
          created_at: now, updated_at: now
        });
        jml.pertemuan++;

        semuaItem
          .filter(function (i) { return i.pertemuan_id === pid; })
          .sort(function (a, b) { return Number(a.urutan) - Number(b.urutan); })
          .forEach(function (asalItem) {
            var idItemBaru = Util.buatId('ITM');
            var salinan = {};
            Object.keys(asalItem).forEach(function (k) {
              if (k !== '_baris') salinan[k] = asalItem[k];
            });
            salinan.item_id = idItemBaru;
            salinan.pertemuan_id = idPtmBaru;
            /* mp_id WAJIB ikut diganti. Bila tertinggal menunjuk materi
               pokok kelas asal, menghapus materi pokok itu akan ikut
               menghapus item kelas tujuan — kehilangan data lintas kelas. */
            salinan.mp_id = mpIni;
            salinan.kelas_id = kid;
            salinan.status = 'draft';
            salinan.created_at = now;
            salinan.updated_at = now;
            itemBaru.push(salinan);
            jml.item++;

            semuaSoal
              .filter(function (s) { return s.item_id === asalItem.item_id; })
              .forEach(function (asalSoal) {
                var s2 = {};
                Object.keys(asalSoal).forEach(function (k) {
                  if (k !== '_baris') s2[k] = asalSoal[k];
                });
                s2.soal_id = Util.buatId('SOL');
                s2.item_id = idItemBaru;
                s2.created_at = now;
                soalBaru.push(s2);
                jml.soal++;
              });
          });
      });
    });

    /* tulis massal — satu operasi per sheet */
    if (ptmBaru.length)  Db.tambah('pertemuan', ptmBaru);
    if (itemBaru.length) Db.tambah('item', itemBaru);
    if (soalBaru.length) Db.tambah('soal', soalBaru);

    Util.catatLog(sesi.user_id, 'salin_pertemuan',
      JSON.stringify(jml) + ' ke ' + kelasTujuan.length + ' kelas');

    return jml;
  }

  /* ==================================================== bantu */

  function _notifTerbit(kelasId, judul, pertemuanId) {
    try {
      Notif.kirimKeKelas(kelasId, 'pertemuan_baru',
        'Pertemuan "' + judul + '" sudah dapat diakses.',
        '#/belajar/' + pertemuanId);
    } catch (e) { /* notifikasi gagal jangan menggagalkan simpan */ }
  }

  function _err(kode, pesan) {
    var e = new Error(pesan);
    e.kode = kode;
    return e;
  }

  return {
    daftarGuru: daftarGuru, detail: detail, simpan: simpan, hapus: hapus,
    aturUrutan: aturUrutan, pindah: pindah,
    daftarItem: daftarItem, detailItem: detailItem, simpanItem: simpanItem,
    hapusItem: hapusItem, aturUrutanItem: aturUrutanItem,
    salin: salin
  };
})();
