/**
 * ============================================================
 *  LessonLen — Refleksi.gs
 *  Item tipe `refleksi`: pertanyaan terbuka + skala pemahaman diri
 * ------------------------------------------------------------
 *  Acuan: KESEPAKATAN-SISTEM.md §6.5
 *
 *  BENTUK DATA
 *
 *  Pertanyaan disimpan guru sebagai JSON pada `item.konten`:
 *      [ { "t": "Apa yang paling menantang?", "wajib": true }, … ]
 *
 *  Jawaban murid memakai ulang sheet `lkpd_submission` — bukan tabel
 *  baru. Pemetaan kolomnya:
 *      links        → JSON larik jawaban ["…","…"]
 *      nilai        → skala pemahaman diri 1–5
 *      catatan_guru → balasan guru
 *      dibaca_murid → penanda balasan sudah dibaca
 *      status       → 'draft' selagi diisi, 'diterima' setelah dikirim
 *
 *  KEPUTUSAN PENTING
 *
 *  Refleksi langsung berstatus `selesai` begitu murid mengirim, TIDAK
 *  menunggu guru. Bila menunggu seperti LKPD, 432 murid bisa tertahan
 *  hanya karena guru belum sempat membaca. Refleksi juga tidak dinilai
 *  benar/salah — skala 1–5 adalah penilaian diri murid, bukan nilai guru.
 *
 *  ATURAN MENGIKAT:
 *   - Dilarang getRange() di dalam loop
 *   - Tulis progress satu murid lewat Db.tulisProgres()
 *   - Sanitasi teks sebelum disimpan
 * ============================================================
 */

var Refleksi = (function () {

  var MAKS_PERTANYAAN = 6;
  var MAKS_JAWABAN    = 2000;      /* karakter per jawaban */

  function _err(kode, pesan) {
    var e = new Error(pesan);
    e.kode = kode;
    return e;
  }

  /* ==================================================== bantu */

  /** Baca daftar pertanyaan dari item.konten. */
  function bacaPertanyaan(konten) {
    if (!konten) return [];
    var a;
    try { a = JSON.parse(konten); } catch (e) { return []; }
    if (!Array.isArray(a)) return [];

    return a.slice(0, MAKS_PERTANYAAN).map(function (q, i) {
      /* Bentuk lama pernah berupa larik string biasa. Diterima juga
         supaya refleksi yang dibuat sebelum format ini tidak hilang. */
      if (typeof q === 'string') return { t: q, wajib: true, no: i + 1 };
      return {
        t: String((q && q.t) || ''),
        wajib: !(q && q.wajib === false),
        no: i + 1
      };
    }).filter(function (q) { return q.t !== ''; });
  }

  /** Susun JSON pertanyaan dari masukan guru. */
  function susunPertanyaan(daftar) {
    if (!Array.isArray(daftar)) return '[]';
    var bersih = [];
    daftar.slice(0, MAKS_PERTANYAAN).forEach(function (q) {
      var t = Util.escapeHtml(
        String((q && (q.t !== undefined ? q.t : q)) || '').trim()).slice(0, 300);
      if (t) bersih.push({ t: t, wajib: !(q && q.wajib === false) });
    });
    return JSON.stringify(bersih);
  }

  function _parseJawaban(v) {
    if (!v) return [];
    try {
      var a = JSON.parse(v);
      return Array.isArray(a) ? a.map(function (x) { return String(x || ''); }) : [];
    } catch (e) { return []; }
  }

  function _cariIsian(userId, itemId) {
    return Db.cariBarisCache2('lkpd_submission', 'user_id', userId,
                              'item_id', itemId);
  }

  /**
   * Pastikan item benar-benar refleksi yang terbuka untuk murid ini.
   * Unlock dihitung ulang di server — jangan percaya klien.
   */
  function _itemTerbuka(sesi, itemId) {
    var item = Db.cariBarisCache('item', 'item_id', itemId);
    if (!item || item.status !== 'publish') {
      throw _err('TIDAK_DITEMUKAN', 'Refleksi tidak ditemukan.');
    }
    if (item.tipe !== 'refleksi') {
      throw _err('VALIDASI_GAGAL', 'Item ini bukan refleksi.');
    }

    var p = Db.cariBarisCache('pertemuan', 'pertemuan_id', item.pertemuan_id);
    if (!p || p.status !== 'publish') {
      throw _err('TIDAK_DITEMUKAN', 'Pertemuan tidak ditemukan.');
    }

    var d = Belajar.detailPertemuan(sesi, item.pertemuan_id);
    var ini = null;
    d.item.forEach(function (x) { if (x.item_id === itemId) ini = x; });
    if (!ini) throw _err('TIDAK_DITEMUKAN', 'Refleksi tidak tersedia.');
    if (!ini.terbuka) {
      throw _err('ITEM_TERKUNCI', ini.alasan_kunci || 'Refleksi masih terkunci.');
    }

    return { item: item, pertemuan: p, status: ini };
  }

  /* ==================================================== MURID */

  /** Buka refleksi: pertanyaan + isian yang sedang berjalan. */
  function buka(sesi, itemId) {
    var ctx = _itemTerbuka(sesi, itemId);
    var item = ctx.item;
    var sub = _cariIsian(sesi.user_id, itemId);

    var jawaban = sub ? _parseJawaban(sub.links) : [];
    var terkirim = !!sub && sub.status === 'diterima';

    /* Balasan guru dianggap dibaca begitu halaman dibuka — sama seperti
       LKPD. Menandainya di sini menghindari satu klik tambahan. */
    if (sub && sub.catatan_guru && sub.dibaca_murid !== true) {
      Db.perbarui('lkpd_submission', sub._baris, { dibaca_murid: true });
    }

    return {
      item: {
        item_id: item.item_id,
        pertemuan_id: item.pertemuan_id,
        judul: item.judul,
        deskripsi: item.deskripsi,
        tipe: 'refleksi'
      },
      pertemuan: {
        pertemuan_id: ctx.pertemuan.pertemuan_id,
        kelas_id: ctx.pertemuan.kelas_id,
        judul: ctx.pertemuan.judul,
        urutan: Number(ctx.pertemuan.urutan) || 0
      },
      pertanyaan: bacaPertanyaan(item.konten),
      jawaban: jawaban,
      skala: sub && sub.nilai !== '' && sub.nilai !== null
        ? Number(sub.nilai) : null,
      terkirim: terkirim,
      waktu_kirim: sub ? sub.waktu_kumpul : '',
      balasan_guru: sub ? (sub.catatan_guru || '') : ''
    };
  }

  /** Simpan isian tanpa mengirim — murid bisa melanjutkan nanti. */
  function simpanDraf(sesi, itemId, jawaban, skala) {
    var ctx = _itemTerbuka(sesi, itemId);
    var bersih = _bersihkanJawaban(jawaban, bacaPertanyaan(ctx.item.konten));
    var nilaiSkala = _bersihkanSkala(skala);

    Db.denganKunci(function () {
      var sub = _cariIsian(sesi.user_id, itemId);

      if (sub && sub.status === 'diterima') {
        throw _err('VALIDASI_GAGAL', 'Refleksi sudah dikirim.');
      }

      if (sub) {
        Db.perbarui('lkpd_submission', sub._baris, {
          links: JSON.stringify(bersih),
          nilai: nilaiSkala === null ? '' : nilaiSkala
        });
      } else {
        Db.tambah('lkpd_submission', {
          submission_id: Util.buatId('LKP'),
          user_id: sesi.user_id,
          item_id: itemId,
          kelas_id: ctx.pertemuan.kelas_id,
          revisi_ke: 1,
          links: JSON.stringify(bersih),
          catatan_murid: '',
          status: 'draft',
          terlambat: false,
          nilai: nilaiSkala === null ? '' : nilaiSkala,
          catatan_guru: '',
          dibaca_murid: true,
          waktu_kumpul: '',
          waktu_dinilai: ''
        });
      }
    });

    return { tersimpan: true, jml_jawaban: bersih.filter(function (x) {
      return x !== '';
    }).length };
  }

  /**
   * Kirim refleksi. Langsung berstatus `selesai` — tidak menunggu guru.
   */
  function kirim(sesi, itemId, jawaban, skala) {
    var ctx = _itemTerbuka(sesi, itemId);
    var item = ctx.item;
    var daftarTanya = bacaPertanyaan(item.konten);
    var bersih = _bersihkanJawaban(jawaban, daftarTanya);
    var nilaiSkala = _bersihkanSkala(skala);

    /* pertanyaan wajib harus terisi */
    var kurang = [];
    daftarTanya.forEach(function (q, i) {
      if (q.wajib && !String(bersih[i] || '').trim()) kurang.push(q.no);
    });
    if (kurang.length) {
      throw _err('VALIDASI_GAGAL',
        'Pertanyaan ' + kurang.join(', ') + ' wajib dijawab.');
    }
    if (nilaiSkala === null) {
      throw _err('VALIDASI_GAGAL',
        'Pilih skala pemahaman diri Anda (1–5).');
    }

    Db.denganKunci(function () {
      var sub = _cariIsian(sesi.user_id, itemId);
      if (sub && sub.status === 'diterima') {
        throw _err('VALIDASI_GAGAL', 'Refleksi sudah dikirim.');
      }

      var isi = {
        links: JSON.stringify(bersih),
        nilai: nilaiSkala,
        status: 'diterima',
        waktu_kumpul: Util.sekarang()
      };

      if (sub) {
        Db.perbarui('lkpd_submission', sub._baris, isi);
      } else {
        Db.tambah('lkpd_submission', {
          submission_id: Util.buatId('LKP'),
          user_id: sesi.user_id,
          item_id: itemId,
          kelas_id: ctx.pertemuan.kelas_id,
          revisi_ke: 1,
          links: isi.links,
          catatan_murid: '',
          status: 'diterima',
          terlambat: false,
          nilai: nilaiSkala,
          catatan_guru: '',
          dibaca_murid: true,
          waktu_kumpul: isi.waktu_kumpul,
          waktu_dinilai: ''
        });
      }
    });

    /* langsung selesai — membuka pertemuan berikutnya seketika */
    _tulisProgres(sesi.user_id, itemId, item, ctx.pertemuan, nilaiSkala);

    Util.catatLog(sesi.user_id, 'kirim_refleksi', itemId + ' skala ' + nilaiSkala);
    return { terkirim: true, skala: nilaiSkala };
  }

  function _bersihkanJawaban(jawaban, daftarTanya) {
    var arr = Array.isArray(jawaban) ? jawaban : [];
    var n = Math.max(daftarTanya.length, 0);
    var hasil = [];
    for (var i = 0; i < n; i++) {
      hasil.push(Util.escapeHtml(String(arr[i] || '').trim())
        .slice(0, MAKS_JAWABAN));
    }
    return hasil;
  }

  function _bersihkanSkala(v) {
    if (v === '' || v === null || v === undefined) return null;
    var n = Math.round(Number(v));
    if (!isFinite(n) || n < 1 || n > 5) return null;
    return n;
  }

  /** Selaraskan baris progress. Refleksi selalu langsung `selesai`. */
  function _tulisProgres(userId, itemId, item, ptm, skala) {
    Db.tulisProgres(userId, function () {
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

      var isi = {
        status: 'selesai',
        nilai: skala,
        waktu_selesai: Util.sekarang(),
        updated_at: Util.sekarang()
      };

      if (pr) {
        Db.perbarui('progress', pr._baris, isi);
      } else {
        Db.tambah('progress', {
          progress_id: Util.buatId('PRG'),
          user_id: userId, item_id: itemId,
          pertemuan_id: item.pertemuan_id,
          mp_id: item.mp_id || (ptm ? ptm.mp_id : '') || '',
          kelas_id: ptm ? ptm.kelas_id : item.kelas_id,
          tipe: 'refleksi', status: 'selesai', bagian_terakhir: 0,
          nilai: skala, percobaan: 0,
          dibuka_paksa: false, alasan_paksa: '',
          waktu_buka: Util.sekarang(),
          waktu_selesai: Util.sekarang(),
          updated_at: Util.sekarang()
        });
      }
    });
    Beranda.invalidasiProgres(userId);
  }

  /* ==================================================== GURU */

  /**
   * Rekap satu refleksi untuk seluruh kelas.
   *
   * Inilah nilai praktisnya (§6.5.4): dari 36 jawaban guru langsung
   * tahu topik mana yang perlu diulang, tanpa menunggu ulangan.
   */
  function rekap(itemId) {
    var item = Db.cariBarisCache('item', 'item_id', itemId);
    if (!item) throw _err('TIDAK_DITEMUKAN', 'Refleksi tidak ditemukan.');
    if (item.tipe !== 'refleksi') {
      throw _err('VALIDASI_GAGAL', 'Item ini bukan refleksi.');
    }

    var ptm = Db.cariBarisCache('pertemuan', 'pertemuan_id', item.pertemuan_id);
    var kelasId = ptm ? ptm.kelas_id : item.kelas_id;

    var daftarTanya = bacaPertanyaan(item.konten);

    /* saringBaris: hanya baris item ini, bukan seluruh sheet */
    var sub = Db.saringBaris('lkpd_submission', 'item_id', itemId,
      ['submission_id', 'user_id', 'status', 'links', 'nilai',
       'catatan_guru', 'dibaca_murid', 'waktu_kumpul']);

    var nama = {};
    Db.bacaKolom('users', ['user_id', 'nama']).forEach(function (u) {
      nama[u.user_id] = u.nama;
    });

    var terkirim = sub.filter(function (s) { return s.status === 'diterima'; });

    /* sebaran skala 1–5 */
    var sebaran = [0, 0, 0, 0, 0];
    var jml = 0, total = 0;
    terkirim.forEach(function (s) {
      var n = Number(s.nilai);
      if (n >= 1 && n <= 5) { sebaran[n - 1]++; jml++; total += n; }
    });
    var rata = jml ? Math.round(total / jml * 10) / 10 : null;

    var jawaban = terkirim.map(function (s) {
      return {
        submission_id: s.submission_id,
        user_id: s.user_id,
        nama: nama[s.user_id] || '(murid dihapus)',
        jawaban: _parseJawaban(s.links),
        skala: s.nilai === '' || s.nilai === null ? null : Number(s.nilai),
        balasan_guru: s.catatan_guru || '',
        dibaca_murid: s.dibaca_murid === true,
        waktu_kumpul: s.waktu_kumpul
      };
    }).sort(function (a, b) {
      return String(a.nama).localeCompare(String(b.nama), 'id');
    });

    /* berapa murid kelas ini yang belum mengisi */
    var jmlMurid = Db.saringBaris('enrollment', 'kelas_id', kelasId,
      ['user_id', 'status'])
      .filter(function (e) { return e.status === 'aktif'; }).length;

    return {
      item: {
        item_id: item.item_id,
        pertemuan_id: item.pertemuan_id,
        judul: item.judul,
        deskripsi: item.deskripsi
      },
      kelas_id: kelasId,
      pertanyaan: daftarTanya,
      jawaban: jawaban,
      jml_murid: jmlMurid,
      jml_terkirim: terkirim.length,
      jml_belum: Math.max(0, jmlMurid - terkirim.length),
      rata_skala: rata,
      sebaran_skala: sebaran,
      /* penanda dini §6.5.4: rata-rata < 3 → materi perlu diulang */
      perlu_diulang: rata !== null && rata < 3
    };
  }

  /** Daftar refleksi satu kelas beserta ringkasan pengisiannya. */
  function daftarKelas(kelasId) {
    var item = Db.saringBaris('item', 'kelas_id', kelasId,
      ['item_id', 'pertemuan_id', 'tipe', 'judul', 'status'])
      .filter(function (i) { return i.tipe === 'refleksi'; });
    if (!item.length) return [];

    var ptm = {};
    Db.saringBaris('pertemuan', 'kelas_id', kelasId,
      ['pertemuan_id', 'mp_id', 'urutan', 'judul'])
      .forEach(function (p) { ptm[p.pertemuan_id] = p; });

    var mp = {};
    Db.saringBaris('materi_pokok', 'kelas_id', kelasId, ['mp_id', 'urutan'])
      .forEach(function (m) { mp[m.mp_id] = m; });

    /* satu pemindaian untuk seluruh item refleksi kelas ini */
    var perItem = {};
    Db.saringBarisBanyak('lkpd_submission', 'item_id',
      item.map(function (i) { return i.item_id; }),
      ['item_id', 'status', 'nilai'])
      .forEach(function (s) {
        (perItem[s.item_id] = perItem[s.item_id] || []).push(s);
      });

    return item.map(function (i) {
      var s = (perItem[i.item_id] || [])
        .filter(function (x) { return x.status === 'diterima'; });
      var jml = 0, total = 0;
      s.forEach(function (x) {
        var n = Number(x.nilai);
        if (n >= 1 && n <= 5) { jml++; total += n; }
      });
      var rata = jml ? Math.round(total / jml * 10) / 10 : null;
      var p = ptm[i.pertemuan_id] || {};
      var m = mp[p.mp_id] || {};

      return {
        item_id: i.item_id,
        judul: i.judul,
        status: i.status,
        pertemuan_id: i.pertemuan_id,
        pertemuan_judul: p.judul || '',
        nomor: (m.urutan ? m.urutan + '.' : '') + (p.urutan || ''),
        jml_terkirim: s.length,
        rata_skala: rata,
        perlu_diulang: rata !== null && rata < 3
      };
    }).sort(function (a, b) {
      /* Urutkan numerik per bagian ("2.10" sesudah "2.9"), bukan
         leksikografis. localeCompare dengan opsi {numeric:true}
         dihindari: dukungannya tidak seragam di mesin Apps Script,
         dan modul lain pun memakai bentuk sederhana. */
      var pa = String(a.nomor).split('.');
      var pb = String(b.nomor).split('.');
      for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
        var na = Number(pa[i]) || 0, nb = Number(pb[i]) || 0;
        if (na !== nb) return na - nb;
      }
      return 0;
    });
  }

  /** Guru membalas refleksi seorang murid. */
  function balas(sesi, submissionId, catatan) {
    var isi = String(catatan || '').trim().slice(0, 1000);
    if (!isi) throw _err('VALIDASI_GAGAL', 'Balasan tidak boleh kosong.');

    var s = Db.cariBarisCache('lkpd_submission', 'submission_id', submissionId);
    if (!s) throw _err('TIDAK_DITEMUKAN', 'Refleksi tidak ditemukan.');

    var item = Db.cariBarisCache('item', 'item_id', s.item_id);
    if (!item || item.tipe !== 'refleksi') {
      throw _err('VALIDASI_GAGAL', 'Item ini bukan refleksi.');
    }

    Db.perbarui('lkpd_submission', s._baris, {
      catatan_guru: Util.escapeHtml(isi),
      dibaca_murid: false,
      waktu_dinilai: Util.sekarang()
    });

    Notif.kirimSatu(s.user_id, 'refleksi_dibalas',
      'Guru membalas refleksi Anda pada "' + item.judul + '".',
      '#/refleksi/' + s.item_id);

    Util.catatLog(sesi.user_id, 'balas_refleksi', submissionId);
    return { terkirim: true };
  }

  return {
    /* murid */
    buka: buka, simpanDraf: simpanDraf, kirim: kirim,
    /* guru */
    rekap: rekap, daftarKelas: daftarKelas, balas: balas,
    /* dipakai editor & uji */
    bacaPertanyaan: bacaPertanyaan, susunPertanyaan: susunPertanyaan
  };
})();
