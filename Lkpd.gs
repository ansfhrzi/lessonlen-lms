/**
 * ============================================================
 *  LessonLen — Lkpd.gs
 *  Pengumpulan LKPD via tautan + penilaian guru
 * ------------------------------------------------------------
 *  Acuan: KESEPAKATAN-SISTEM.md v4.7 §5c, §6.2, §6.4
 *
 *  ALUR:  draft → menunggu → dinilai_proses → diterima/ditolak
 *  Ditolak kembali ke draft, revisi_ke bertambah.
 * ============================================================
 */

var Lkpd = (function () {

  var MAKS_LINK = 5;

  function _err(kode, pesan) {
    var e = new Error(pesan);
    e.kode = kode;
    return e;
  }

  function _cekEnroll(userId, kelasId) {
    var ada = Db.saringKolom('enrollment',
      { user_id: userId, kelas_id: kelasId, status: 'aktif' }, ['enroll_id']);
    if (!ada.length) {
      throw _err('AKSES_DITOLAK', 'Anda tidak terdaftar di kelas ini.');
    }
  }

  /** Ambil item LKPD dan pastikan murid berhak mengaksesnya. */
  function _itemTerbuka(sesi, itemId) {
    var item = Db.cariBarisCache('item', 'item_id', itemId);
    if (!item || item.status !== 'publish') {
      throw _err('TIDAK_DITEMUKAN', 'LKPD tidak ditemukan.');
    }
    if (item.tipe !== 'lkpd') {
      throw _err('VALIDASI_GAGAL', 'Item ini bukan LKPD.');
    }

    var p = Db.cariBarisCache('pertemuan', 'pertemuan_id', item.pertemuan_id);
    if (!p || p.status !== 'publish') {
      throw _err('TIDAK_DITEMUKAN', 'Pertemuan tidak ditemukan.');
    }
    _cekEnroll(sesi.user_id, p.kelas_id);

    /* unlock logic dihitung ulang di server — jangan percaya klien */
    var d = Belajar.detailPertemuan(sesi, item.pertemuan_id);
    var ini = null;
    d.item.forEach(function (x) { if (x.item_id === itemId) ini = x; });
    if (!ini) throw _err('TIDAK_DITEMUKAN', 'LKPD tidak tersedia.');
    if (!ini.terbuka) {
      throw _err('ITEM_TERKUNCI', ini.alasan_kunci || 'LKPD masih terkunci.');
    }

    return { item: item, pertemuan: p, status: ini };
  }

  function _cariSubmission(userId, itemId) {
    return Db.cariBarisCache2('lkpd_submission',
      'user_id', userId, 'item_id', itemId);
  }

  /**
   * Apakah baris pengumpulan ini milik TUGAS KELOMPOK, bukan LKPD?
   *
   * Sheet `lkpd_submission` dipakai bersama oleh tiga fitur: LKPD,
   * refleksi (v1.2.0), dan tugas kelompok (v1.7.0). Refleksi tidak
   * pernah bocor ke sini karena statusnya selalu `diterima`/`selesai`
   * dan itemnya tidak pernah lolos penapis. Tugas kelompok BOCOR:
   * statusnya `menunggu`, persis seperti LKPD.
   *
   * Membiarkannya lolos berakibat nyata:
   *   - muncul di antrean penilaian LKPD atas nama KETUA saja
   *   - dinilai lewat Lkpd.nilai() → hanya progres ketua yang terisi,
   *     dua anggota lain tertinggal di status `menunggu` selamanya
   *   - Lkpd.beriFeedback() mengirim notifikasi hanya ke ketua,
   *     dengan tautan #/lkpd/… yang salah layar
   *
   * Satu kolom `kelompok_id` sudah cukup membedakannya, dan kolom itu
   * memang selalu terisi oleh Kelompok.gs.
   */
  function _milikKelompok(s) {
    return !!(s && String(s.kelompok_id || '').trim());
  }

  /** Tolak submission tugas kelompok yang masuk lewat jalur LKPD. */
  function _tolakBilaKelompok(s) {
    if (_milikKelompok(s)) {
      throw _err('VALIDASI_GAGAL',
        'Ini pengumpulan tugas kelompok. Nilai lewat layar ' +
        'Tugas Kelompok agar seluruh anggota ikut tercatat.');
    }
  }

  function _parseLinks(v) {
    if (!v) return [];
    try {
      var a = JSON.parse(v);
      return Array.isArray(a) ? a : [];
    } catch (e) { return []; }
  }

  function _terlambat(item) {
    if (Util.kosong(item.batas_waktu)) return false;
    return new Date() > new Date(item.batas_waktu);
  }

  /* ==================================================== MURID */

  /** Buka LKPD: petunjuk + draf pengumpulan yang sedang berjalan. */
  function bukaLkpd(sesi, itemId) {
    var ctx = _itemTerbuka(sesi, itemId);
    var item = ctx.item;
    var sub = _cariSubmission(sesi.user_id, itemId);

    var status = sub ? sub.status : 'draft';
    var terkunci = status === 'menunggu' || status === 'dinilai_proses' ||
                   status === 'diterima';

    /* tandai umpan balik sudah dibaca */
    if (sub && sub.catatan_guru && sub.dibaca_murid !== true) {
      Db.perbarui('lkpd_submission', sub._baris, { dibaca_murid: true });
    }

    return {
      item_id: itemId,
      judul: item.judul,
      tujuan_pembelajaran: item.tujuan_pembelajaran,
      petunjuk: item.konten,
      pertemuan_id: item.pertemuan_id,
      pertemuan_judul: ctx.pertemuan.judul,
      kelas_id: ctx.pertemuan.kelas_id,     /* dipakai sidebar navigasi */
      batas_waktu: item.batas_waktu
        ? Util.formatTanggal(item.batas_waktu) : '',
      lewat_batas: _terlambat(item),
      maks_link: MAKS_LINK,

      status: status,
      terkunci: terkunci,
      links: sub ? _parseLinks(sub.links) : [],
      catatan_murid: sub ? sub.catatan_murid : '',
      revisi_ke: sub ? (Number(sub.revisi_ke) || 1) : 1,
      terlambat: sub ? sub.terlambat === true : false,
      nilai: sub ? sub.nilai : '',
      catatan_guru: sub ? sub.catatan_guru : '',
      waktu_kumpul: sub && sub.waktu_kumpul
        ? Util.formatTanggal(sub.waktu_kumpul) : '',
      waktu_dinilai: sub && sub.waktu_dinilai
        ? Util.formatTanggal(sub.waktu_dinilai) : '',
      bisa_batalkan: status === 'menunggu'
    };
  }

  /** Simpan draf: daftar tautan + catatan. Belum diserahkan. */
  function simpanDraf(sesi, itemId, links, catatan) {
    var ctx = _itemTerbuka(sesi, itemId);

    var bersih = (links || [])
      .map(function (l) { return String(l || '').trim(); })
      .filter(function (l) { return l.length > 0; });

    if (bersih.length > MAKS_LINK) {
      throw _err('VALIDASI_GAGAL',
        'Maksimal ' + MAKS_LINK + ' tautan per pengumpulan.');
    }
    for (var i = 0; i < bersih.length; i++) {
      if (!Util.urlSah(bersih[i])) {
        throw _err('VALIDASI_GAGAL',
          'Tautan ke-' + (i + 1) + ' tidak sah. Awali dengan https://');
      }
      if (bersih[i].length > 500) {
        throw _err('VALIDASI_GAGAL', 'Tautan ke-' + (i + 1) + ' terlalu panjang.');
      }
    }

    var isiCatatan = String(catatan || '').slice(0, 1000);

    return Db.denganKunci(function () {
      var sub = _cariSubmission(sesi.user_id, itemId);

      if (sub) {
        if (sub.status === 'menunggu' || sub.status === 'dinilai_proses') {
          throw _err('VALIDASI_GAGAL',
            'Pekerjaan sudah diserahkan. Batalkan dahulu untuk mengubah.');
        }
        if (sub.status === 'diterima') {
          throw _err('VALIDASI_GAGAL', 'Pekerjaan sudah diterima guru.');
        }
        Db.perbarui('lkpd_submission', sub._baris, {
          links: JSON.stringify(bersih),
          catatan_murid: isiCatatan,
          status: 'draft'
        });
        return { tersimpan: true, jml_link: bersih.length };
      }

      Db.tambah('lkpd_submission', {
        submission_id: Util.buatId('LKP'),
        user_id: sesi.user_id,
        item_id: itemId,
        kelas_id: ctx.pertemuan.kelas_id,
        revisi_ke: 1,
        links: JSON.stringify(bersih),
        catatan_murid: isiCatatan,
        status: 'draft',
        terlambat: false,
        nilai: '', catatan_guru: '', dibaca_murid: false,
        waktu_kumpul: '', waktu_dinilai: ''
      });
      return { tersimpan: true, jml_link: bersih.length };
    });
  }

  /** Titik komitmen: kunci lampiran dan masukkan ke antrean guru. */
  function kumpulkan(sesi, itemId) {
    var ctx = _itemTerbuka(sesi, itemId);
    var item = ctx.item;

    /* TANPA kunci global (v1.9.1) — hanya memperbarui baris
       `lkpd_submission` milik satu murid/kelompok. `Db.tambah()`
       mengambil kuncinya sendiri bila baris baru diperlukan
       (§6.2 no. 56). */
    var hasil = (function () {
      var sub = _cariSubmission(sesi.user_id, itemId);
      if (!sub) {
        throw _err('VALIDASI_GAGAL', 'Belum ada pekerjaan untuk dikumpulkan.');
      }
      if (sub.status === 'menunggu' || sub.status === 'dinilai_proses') {
        throw _err('VALIDASI_GAGAL', 'Pekerjaan sudah diserahkan.');
      }
      if (sub.status === 'diterima') {
        throw _err('VALIDASI_GAGAL', 'Pekerjaan sudah diterima guru.');
      }

      var links = _parseLinks(sub.links);
      if (!links.length) {
        throw _err('VALIDASI_GAGAL',
          'Tempelkan minimal satu tautan sebelum mengumpulkan.');
      }

      var telat = _terlambat(item);
      Db.perbarui('lkpd_submission', sub._baris, {
        status: 'menunggu',
        terlambat: telat,
        waktu_kumpul: Util.sekarang()
      });

      return { revisi_ke: Number(sub.revisi_ke) || 1, terlambat: telat,
               jml_link: links.length };
    })();

    _tulisProgres(sesi.user_id, itemId, item, ctx.pertemuan, 'menunggu');

    Notif.kirimKeGuru('lkpd_masuk',
      sesi.nama + ' mengumpulkan "' + item.judul + '"' +
      (hasil.terlambat ? ' (terlambat)' : '') + '.',
      '#/nilai-lkpd');

    Util.catatLog(sesi.user_id, 'kumpul_lkpd',
      itemId + ' revisi ' + hasil.revisi_ke);

    return hasil;
  }

  /** Batalkan penyerahan — hanya selama guru belum mulai menilai. */
  function batalkan(sesi, itemId) {
    var ctx = _itemTerbuka(sesi, itemId);

    /* TANPA kunci global (v1.9.1) — hanya memperbarui baris
       `lkpd_submission` milik satu murid/kelompok. `Db.tambah()`
       mengambil kuncinya sendiri bila baris baru diperlukan
       (§6.2 no. 56). */
    (function () {
      var sub = _cariSubmission(sesi.user_id, itemId);
      if (!sub) throw _err('TIDAK_DITEMUKAN', 'Pengumpulan tidak ditemukan.');

      if (sub.status === 'dinilai_proses') {
        throw _err('VALIDASI_GAGAL',
          'Guru sedang menilai pekerjaan Anda. Tidak dapat dibatalkan.');
      }
      if (sub.status !== 'menunggu') {
        throw _err('VALIDASI_GAGAL', 'Pekerjaan belum diserahkan.');
      }

      Db.perbarui('lkpd_submission', sub._baris, {
        status: 'draft', waktu_kumpul: ''
      });
    })();

    _tulisProgres(sesi.user_id, itemId, ctx.item, ctx.pertemuan, 'berjalan');
    Util.catatLog(sesi.user_id, 'batal_lkpd', itemId);
    return { dibatalkan: true };
  }

  /* ==================================================== GURU */

  /** Antrean pekerjaan yang menunggu penilaian. */
  function antrean(kelasId) {
    /* baca kolom seperlunya — `links` dan `catatan_murid` tidak dipakai
       di daftar antrean, dan keduanya bisa panjang */
    var sub = Db.bacaKolom('lkpd_submission',
      ['submission_id','user_id','item_id','kelas_id','revisi_ke',
       'links','status','terlambat','waktu_kumpul','kelompok_id'])
      .filter(function (s) {
        if (s.status !== 'menunggu' && s.status !== 'dinilai_proses') return false;
        /* tugas kelompok punya antreannya sendiri — di sini ia hanya
           tampil atas nama ketua dan menyesatkan (v1.7.1) */
        if (_milikKelompok(s)) return false;
        return !kelasId || s.kelas_id === kelasId;
      });
    if (!sub.length) return [];

    var petaUser = {};
    Db.bacaKolom('users', ['user_id', 'nama']).forEach(function (u) {
      petaUser[u.user_id] = u.nama;
    });
    var petaItem = {};
    Db.bacaKolom('item', ['item_id', 'judul', 'pertemuan_id'])
      .forEach(function (i) { petaItem[i.item_id] = i; });
    var petaPtm = {};
    Db.bacaKolom('pertemuan', ['pertemuan_id', 'urutan', 'judul'])
      .forEach(function (p) { petaPtm[p.pertemuan_id] = p; });
    var petaKelas = {};
    Db.bacaKolom('kelas', ['kelas_id', 'nama_kelas']).forEach(function (k) {
      petaKelas[k.kelas_id] = k.nama_kelas;
    });

    return sub.map(function (s) {
      var it = petaItem[s.item_id] || {};
      var pt = petaPtm[it.pertemuan_id] || {};
      return {
        submission_id: s.submission_id,
        user_id: s.user_id,
        nama: petaUser[s.user_id] || '(tidak dikenal)',
        item_id: s.item_id,
        judul_lkpd: it.judul || '',
        pertemuan: pt.urutan ? 'Pertemuan ' + pt.urutan : '',
        kelas: petaKelas[s.kelas_id] || '',
        kelas_id: s.kelas_id,
        revisi_ke: Number(s.revisi_ke) || 1,
        terlambat: s.terlambat === true,
        status: s.status,
        jml_link: _parseLinks(s.links).length,
        waktu_kumpul: s.waktu_kumpul ? Util.formatTanggal(s.waktu_kumpul) : ''
      };
    }).sort(function (a, b) {
      return String(a.waktu_kumpul).localeCompare(String(b.waktu_kumpul));
    });
  }

  /**
   * Daftar SELURUH murid di kelas untuk satu LKPD, beserta statusnya.
   *
   * Berbeda dengan antrean() yang hanya menampilkan yang menunggu,
   * fungsi ini menjawab pertanyaan sehari-hari guru: siapa saja yang
   * sudah mengumpulkan, sudah dinilai, dan yang belum menyentuh
   * sama sekali.
   */
  function daftarKelas(itemId) {
    var item = Db.cariBarisCache('item', 'item_id', itemId);
    if (!item) throw _err('TIDAK_DITEMUKAN', 'LKPD tidak ditemukan.');
    if (item.tipe !== 'lkpd') {
      throw _err('VALIDASI_GAGAL', 'Item ini bukan LKPD.');
    }

    var ptm = Db.cariBarisCache('pertemuan', 'pertemuan_id', item.pertemuan_id);
    var kelas = Db.cariBarisCache('kelas', 'kelas_id', item.kelas_id);

    /* seluruh murid aktif di kelas ini */
    var enroll = Db.saringKolom('enrollment',
      { kelas_id: item.kelas_id, status: 'aktif' }, ['user_id']);

    var petaNama = {};
    Db.bacaKolom('users', ['user_id', 'nama', 'username'])
      .forEach(function (u) { petaNama[u.user_id] = u; });

    /* pengumpulan yang ada untuk item ini */
    /* Baca 1 kolom kunci untuk menemukan baris item ini saja, bukan
       seluruh sheet lkpd_submission yang memuat semua LKPD semua kelas. */
    var petaSub = {};
    Db.saringBaris('lkpd_submission', 'item_id', itemId,
      ['submission_id','user_id','revisi_ke','links','kelompok_id',
       'status','terlambat','nilai','catatan_guru','waktu_kumpul','waktu_dinilai'])
      .forEach(function (s) {
        /* item ini sudah dipastikan bertipe `lkpd` di atas, jadi baris
           kelompok seharusnya tidak ada. Penapis ini jaring pengaman
           bila suatu saat tipe item diubah setelah ada pengumpulan. */
        if (_milikKelompok(s)) return;
        petaSub[s.user_id] = s;
      });

    var hasil = enroll.map(function (e) {
      var u = petaNama[e.user_id] || {};
      var s = petaSub[e.user_id];

      var status = s ? s.status : 'belum';
      if (status === 'draft') status = 'draft';

      return {
        user_id: e.user_id,
        nama: u.nama || '(tidak dikenal)',
        username: u.username || '',
        submission_id: s ? s.submission_id : '',
        status: status,
        revisi_ke: s ? (Number(s.revisi_ke) || 1) : 0,
        terlambat: s ? s.terlambat === true : false,
        jml_link: s ? _parseLinks(s.links).length : 0,
        nilai: s && s.nilai !== '' ? s.nilai : '',
        ada_catatan: !!(s && s.catatan_guru),
        waktu_kumpul: s && s.waktu_kumpul
          ? Util.formatTanggal(s.waktu_kumpul) : '',
        waktu_dinilai: s && s.waktu_dinilai
          ? Util.formatTanggal(s.waktu_dinilai) : ''
      };
    }).sort(function (a, b) {
      /* yang perlu tindakan didahulukan, lalu urut nama */
      /* Mulai dari 1, bukan 0. Dengan `bobot[x] || 9`, nilai 0 dianggap
         falsy dan berubah menjadi 9 — status prioritas tertinggi justru
         terlempar ke urutan terakhir. */
      var bobot = { menunggu: 1, dinilai_proses: 2, ditolak: 3,
                    draft: 4, belum: 5, diterima: 6 };
      var d = (bobot[a.status] || 9) - (bobot[b.status] || 9);
      if (d !== 0) return d;
      return String(a.nama).localeCompare(String(b.nama), 'id');
    });

    /* rekap angka */
    var rekap = { total: hasil.length, belum: 0, draft: 0, menunggu: 0,
                  diterima: 0, ditolak: 0, terlambat: 0, jml_nilai: 0,
                  total_nilai: 0 };
    hasil.forEach(function (h) {
      if (h.status === 'dinilai_proses') rekap.menunggu++;
      else if (rekap[h.status] !== undefined) rekap[h.status]++;
      if (h.terlambat) rekap.terlambat++;
      if (h.nilai !== '' && !isNaN(Number(h.nilai))) {
        rekap.jml_nilai++;
        rekap.total_nilai += Number(h.nilai);
      }
    });
    rekap.rata_nilai = rekap.jml_nilai
      ? Math.round(rekap.total_nilai / rekap.jml_nilai) : '';
    rekap.sudah_kumpul = rekap.menunggu + rekap.diterima + rekap.ditolak;
    rekap.persen_kumpul = rekap.total
      ? Math.round(rekap.sudah_kumpul / rekap.total * 100) : 0;

    return {
      item: {
        item_id: itemId,
        judul: item.judul,
        pertemuan_id: item.pertemuan_id,
        pertemuan_judul: ptm ? ptm.judul : '',
        pertemuan_urutan: ptm ? Number(ptm.urutan) : 0,
        kelas_id: item.kelas_id,
        nama_kelas: kelas ? kelas.nama_kelas : '',
        batas_waktu: item.batas_waktu
          ? Util.formatTanggal(item.batas_waktu) : ''
      },
      rekap: rekap,
      murid: hasil
    };
  }

  /** Detail satu pengumpulan untuk dinilai. */
  function detail(submissionId) {
    var s = Db.cariBarisCache('lkpd_submission', 'submission_id', submissionId);
    if (!s) throw _err('TIDAK_DITEMUKAN', 'Pengumpulan tidak ditemukan.');
    _tolakBilaKelompok(s);

    var u = Db.cariBarisCache('users', 'user_id', s.user_id);
    var it = Db.cariBarisCache('item', 'item_id', s.item_id);
    var k = Db.cariBarisCache('kelas', 'kelas_id', s.kelas_id);

    return {
      submission_id: s.submission_id,
      user_id: s.user_id,
      nama: u ? u.nama : '(tidak dikenal)',
      username: u ? u.username : '',
      item_id: s.item_id,
      judul_lkpd: it ? it.judul : '',
      petunjuk: it ? it.konten : '',
      kelas: k ? k.nama_kelas : '',
      links: _parseLinks(s.links),
      catatan_murid: s.catatan_murid,
      revisi_ke: Number(s.revisi_ke) || 1,
      terlambat: s.terlambat === true,
      status: s.status,
      nilai: s.nilai,
      catatan_guru: s.catatan_guru,
      waktu_kumpul: s.waktu_kumpul ? Util.formatTanggal(s.waktu_kumpul) : '',
      waktu_dinilai: s.waktu_dinilai ? Util.formatTanggal(s.waktu_dinilai) : ''
    };
  }

  /** Tandai sedang dinilai — mengunci tombol Batalkan pada sisi murid. */
  function mulaiMenilai(sesi, submissionId) {
    /* TANPA kunci global (v1.9.1) — hanya memperbarui baris
       `lkpd_submission` milik satu murid/kelompok. `Db.tambah()`
       mengambil kuncinya sendiri bila baris baru diperlukan
       (§6.2 no. 56). */
    (function () {
      var s = Db.cariBarisCache('lkpd_submission', 'submission_id', submissionId);
      if (!s) throw _err('TIDAK_DITEMUKAN', 'Pengumpulan tidak ditemukan.');
      _tolakBilaKelompok(s);
      if (s.status === 'menunggu') {
        Db.perbarui('lkpd_submission', s._baris, { status: 'dinilai_proses' });
      }
    })();
    return { dikunci: true };
  }

  /**
   * Nilai pekerjaan.
   * @param {string} keputusan 'diterima' | 'ditolak'
   */
  function nilai(sesi, submissionId, keputusan, angka, catatan) {
    if (keputusan !== 'diterima' && keputusan !== 'ditolak') {
      throw _err('VALIDASI_GAGAL', 'Keputusan tidak sah.');
    }
    var isiCatatan = String(catatan || '').trim().slice(0, 1000);

    /* menolak tanpa alasan membuat murid tidak tahu harus memperbaiki apa */
    if (keputusan === 'ditolak' && !isiCatatan) {
      throw _err('VALIDASI_GAGAL',
        'Catatan wajib diisi saat menolak pekerjaan.');
    }

    var n = angka === '' || angka === null || angka === undefined
      ? '' : Number(angka);
    if (n !== '' && (isNaN(n) || n < 0 || n > 100)) {
      throw _err('VALIDASI_GAGAL', 'Nilai harus antara 0 dan 100.');
    }

    /* TANPA kunci global (v1.9.1) — hanya memperbarui baris
       `lkpd_submission` milik satu murid/kelompok. `Db.tambah()`
       mengambil kuncinya sendiri bila baris baru diperlukan
       (§6.2 no. 56). */
    var info = (function () {
      var s = Db.cariBarisCache('lkpd_submission', 'submission_id', submissionId);
      if (!s) throw _err('TIDAK_DITEMUKAN', 'Pengumpulan tidak ditemukan.');
      _tolakBilaKelompok(s);
      if (s.status === 'diterima') {
        throw _err('VALIDASI_GAGAL', 'Pekerjaan sudah diterima sebelumnya.');
      }

      var revisi = Number(s.revisi_ke) || 1;
      Db.perbarui('lkpd_submission', s._baris, {
        status: keputusan,
        nilai: n,
        catatan_guru: isiCatatan,
        dibaca_murid: false,
        revisi_ke: keputusan === 'ditolak' ? revisi + 1 : revisi,
        waktu_dinilai: Util.sekarang()
      });

      return { user_id: s.user_id, item_id: s.item_id,
               kelas_id: s.kelas_id, revisi_ke: revisi };
    })();

    var item = Db.cariBarisCache('item', 'item_id', info.item_id);
    var ptm = Db.cariBarisCache('pertemuan', 'pertemuan_id', item.pertemuan_id);

    _tulisProgres(info.user_id, info.item_id, item, ptm,
                  keputusan === 'diterima' ? 'selesai' : 'berjalan', n);

    Notif.kirimSatu(info.user_id, 'lkpd_dinilai',
      keputusan === 'diterima'
        ? 'Pekerjaan "' + item.judul + '" diterima.' +
          (n !== '' ? ' Nilai: ' + n + '.' : '')
        : 'Pekerjaan "' + item.judul + '" perlu diperbaiki. ' +
          'Baca catatan guru.',
      '#/lkpd/' + info.item_id);

    Util.catatLog(sesi.user_id, 'nilai_lkpd',
      submissionId + ' → ' + keputusan + (n !== '' ? ' (' + n + ')' : ''));

    var hasil = { keputusan: keputusan, nilai: n };

    /* Data untuk tombol "Kirim lewat WhatsApp" (v1.11.4).

       HANYA saat menolak: pekerjaan yang diterima tidak perlu
       ditindaklanjuti murid, jadi tombolnya tidak digambar.

       Yang dikembalikan bahan mentahnya saja — tautannya disusun
       `Kelas.tautanPerbaikanWa()` lewat Code.gs, satu tempat untuk
       LKPD maupun Tugas Kelompok. */
    if (keputusan === 'ditolak') {
      var murid = Db.cariBarisCache('users', 'user_id', info.user_id);
      hasil.wa = {
        nama: murid ? murid.nama : '',
        no_wa: murid ? Util.normalisasiWa(murid.no_wa) : '',
        judul: item ? item.judul : '',
        catatan: isiCatatan
      };
    }

    return hasil;
  }

  /** Tambah catatan pada pekerjaan yang sudah dinilai. */
  function beriFeedback(sesi, submissionId, catatan) {
    var isi = String(catatan || '').trim().slice(0, 1000);
    if (!isi) throw _err('VALIDASI_GAGAL', 'Catatan tidak boleh kosong.');

    var s = Db.cariBarisCache('lkpd_submission', 'submission_id', submissionId);
    if (!s) throw _err('TIDAK_DITEMUKAN', 'Pengumpulan tidak ditemukan.');
    _tolakBilaKelompok(s);

    Db.perbarui('lkpd_submission', s._baris, {
      catatan_guru: isi, dibaca_murid: false
    });

    var item = Db.cariBarisCache('item', 'item_id', s.item_id);
    Notif.kirimSatu(s.user_id, 'feedback_baru',
      'Guru menambahkan catatan pada "' + (item ? item.judul : 'LKPD') + '".',
      '#/lkpd/' + s.item_id);

    Util.catatLog(sesi.user_id, 'feedback_lkpd', submissionId);
    return { terkirim: true };
  }

  /* ==================================================== bantu */

  /** Selaraskan baris progress dengan status LKPD. */
  function _tulisProgres(userId, itemId, item, ptm, status, nilaiAngka) {
    Db.tulisProgres(userId, function () {
      /* Nomor baris sering sudah diketahui dari cache progres murid.
         bacaBarisJika memverifikasi user_id & item_id, jadi pergeseran
         baris tetap aman — bila meleset, jatuh ke pemindaian penuh. */
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
        status: status,
        updated_at: Util.sekarang()
      };
      if (nilaiAngka !== undefined && nilaiAngka !== '') isi.nilai = nilaiAngka;
      if (status === 'selesai') isi.waktu_selesai = Util.sekarang();

      if (pr) {
        Db.perbarui('progress', pr._baris, isi);
      } else {
        Db.tambah('progress', {
          progress_id: Util.buatId('PRG'),
          user_id: userId, item_id: itemId,
          pertemuan_id: item.pertemuan_id,
          mp_id: item.mp_id || (ptm ? ptm.mp_id : '') || '',
          kelas_id: ptm.kelas_id,
          tipe: 'lkpd', status: status, bagian_terakhir: 0,
          nilai: nilaiAngka === undefined ? '' : nilaiAngka,
          percobaan: 0, dibuka_paksa: false, alasan_paksa: '',
          waktu_buka: Util.sekarang(),
          waktu_selesai: status === 'selesai' ? Util.sekarang() : '',
          updated_at: Util.sekarang()
        });
      }
    });
    Beranda.invalidasiProgres(userId);
  }

  return {
    bukaLkpd: bukaLkpd, simpanDraf: simpanDraf,
    kumpulkan: kumpulkan, batalkan: batalkan,
    antrean: antrean, daftarKelas: daftarKelas,
    detail: detail, mulaiMenilai: mulaiMenilai,
    nilai: nilai, beriFeedback: beriFeedback
  };
})();
