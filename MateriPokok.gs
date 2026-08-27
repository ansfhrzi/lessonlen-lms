/**
 * ============================================================
 *  LessonLen — MateriPokok.gs
 *  Tingkat teratas isi kelas (Bab / Materi Pokok)
 * ------------------------------------------------------------
 *  Hierarki setelah restrukturisasi v1.0:
 *
 *    KELAS
 *      └── MATERI POKOK 1
 *            ├── Pertemuan 1        (jenis: biasa)
 *            │     ├── 📄 Submateri 1
 *            │     ├── 📄 Submateri 2
 *            │     ├── 📝 LKPD
 *            │     ├── 🎯 Quiz
 *            │     └── 🪞 Refleksi
 *            ├── Pertemuan 2        (jenis: biasa)
 *            ├── Ujian / UH         (jenis: ujian)
 *            └── Refleksi Bab       (jenis: refleksi)
 *      └── MATERI POKOK 2 …
 *
 *  Ujian dan Refleksi Bab adalah PERTEMUAN dengan `jenis` khusus —
 *  bukan entitas baru. Keputusan ini menjaga unlock logic tetap
 *  dua tingkat di dalam materi pokok, bukan bercabang.
 *
 *  ATURAN MENGIKAT:
 *   - Dilarang getRange() di dalam loop
 *   - Setiap tulis diikuti Db.invalidasi() (otomatis di Db)
 *   - Penghapusan berantai memakai Db.saringBaris(), bukan Db.baca()
 * ============================================================
 */

var MateriPokok = (function () {

  function _err(kode, pesan) {
    var e = new Error(pesan);
    e.kode = kode;
    return e;
  }

  /* ==================================================== DAFTAR */

  /**
   * Seluruh materi pokok satu kelas beserta ringkasan isinya.
   * Dipakai halaman guru saat menyusun kelas.
   */
  function daftar(kelasId) {
    var mp = Db.saringBaris('materi_pokok', 'kelas_id', kelasId,
      ['mp_id', 'urutan', 'judul', 'deskripsi', 'tujuan_pembelajaran',
       'wajib', 'urut_ketat', 'status'])
      .sort(function (a, b) { return Number(a.urutan) - Number(b.urutan); });

    if (!mp.length) return [];

    /* hitung pertemuan & item sekali jalan, bukan per materi pokok */
    var ptmPer = {};
    Db.saringBaris('pertemuan', 'kelas_id', kelasId,
      ['pertemuan_id', 'mp_id', 'jenis', 'status'])
      .forEach(function (p) {
        var k = p.mp_id || '';
        (ptmPer[k] = ptmPer[k] || []).push(p);
      });

    var itemPer = {};
    Db.saringBaris('item', 'kelas_id', kelasId,
      ['item_id', 'pertemuan_id', 'status'])
      .forEach(function (i) {
        (itemPer[i.pertemuan_id] = itemPer[i.pertemuan_id] || []).push(i);
      });

    return mp.map(function (m) {
      var ptm = ptmPer[m.mp_id] || [];
      var jmlItem = 0;
      ptm.forEach(function (p) {
        jmlItem += (itemPer[p.pertemuan_id] || []).length;
      });

      return {
        mp_id: m.mp_id,
        urutan: Number(m.urutan),
        judul: m.judul,
        deskripsi: m.deskripsi,
        tujuan_pembelajaran: m.tujuan_pembelajaran,
        wajib: m.wajib === true,
        urut_ketat: m.urut_ketat === true,
          status: m.status,
        jml_pertemuan: ptm.filter(function (p) {
          return p.jenis !== 'ujian' && p.jenis !== 'refleksi';
        }).length,
        jml_ujian: ptm.filter(function (p) { return p.jenis === 'ujian'; }).length,
        jml_refleksi: ptm.filter(function (p) {
          return p.jenis === 'refleksi';
        }).length,
        jml_item: jmlItem,
        jml_draf: ptm.filter(function (p) { return p.status !== 'publish'; }).length
      };
    });
  }

  /**
   * Pohon lengkap satu kelas untuk halaman guru:
   * materi pokok → pertemuan → cacah item.
   *
   * Satu panggilan menggantikan getDaftarPertemuan + getMateriPokok,
   * sehingga halaman kelola tidak perlu dua kali bolak-balik ke server.
   *
   * Berbeda dari Belajar.daftarPertemuan(): di sini DRAF ikut tampil
   * (guru harus bisa melihat yang belum terbit) dan tidak ada
   * perhitungan unlock sama sekali.
   */
  function struktur(kelasId) {
    var kelas = Db.cariBarisCache('kelas', 'kelas_id', kelasId);
    if (!kelas) throw _err('TIDAK_DITEMUKAN', 'Kelas tidak ditemukan.');

    var mp = Db.saringBaris('materi_pokok', 'kelas_id', kelasId,
      ['mp_id', 'urutan', 'judul', 'deskripsi', 'tujuan_pembelajaran',
       'wajib', 'urut_ketat', 'status'])
      .sort(function (a, b) { return Number(a.urutan) - Number(b.urutan); });

    /* cacah + daftar item per pertemuan, sekali jalan.
     *
     * v1.15.0 — daftar itemnya ikut dikirim supaya sidebar guru dapat
     * membentangkan kelas sampai ke item tanpa memanggil API lagi
     * (permintaan guru: "tampilkan semua sub bagiannya sampai di
     * daftar itemnya … biar gak bolak balik kembali ke halaman utama
     * kelas").
     *
     * `judul` & `urutan` ikut dibaca — dua kolom kecil, dan sheet
     * `item` memang sudah dipindai di sini. `konten` TIDAK pernah
     * disentuh (§6.2 no. 43). */
    var cacah = {}, itemPer = {};
    Db.saringBaris('item', 'kelas_id', kelasId,
      ['item_id', 'pertemuan_id', 'tipe', 'status', 'judul', 'urutan'])
      .forEach(function (i) {
        var c = cacah[i.pertemuan_id] = cacah[i.pertemuan_id] ||
          { total: 0, materi: 0, lkpd: 0, quiz: 0, refleksi: 0, draf: 0 };
        c.total++;
        if (c[i.tipe] !== undefined) c[i.tipe]++;
        if (i.status !== 'publish') c.draf++;

        (itemPer[i.pertemuan_id] = itemPer[i.pertemuan_id] || []).push({
          item_id: i.item_id,
          tipe: i.tipe,
          judul: i.judul,
          urutan: Number(i.urutan) || 0,
          status: i.status
        });
      });

    Object.keys(itemPer).forEach(function (k) {
      itemPer[k].sort(function (a, b) { return a.urutan - b.urutan; });
    });

    var ptmPer = {};
    Db.saringBaris('pertemuan', 'kelas_id', kelasId,
      ['pertemuan_id', 'mp_id', 'urutan', 'judul', 'deskripsi',
       'tujuan_pembelajaran', 'jenis', 'wajib', 'urut_ketat', 'status'])
      .forEach(function (p) {
        var c = cacah[p.pertemuan_id] ||
          { total: 0, materi: 0, lkpd: 0, quiz: 0, refleksi: 0, draf: 0 };
        (ptmPer[p.mp_id || ''] = ptmPer[p.mp_id || ''] || []).push({
          pertemuan_id: p.pertemuan_id,
          mp_id: p.mp_id || '',
          urutan: Number(p.urutan) || 0,
          judul: p.judul,
          deskripsi: p.deskripsi,
          tujuan_pembelajaran: p.tujuan_pembelajaran,
          jenis: p.jenis || 'biasa',
          wajib: p.wajib === true,
          urut_ketat: p.urut_ketat === true,
          status: p.status,
          jml_item: c.total, jml_materi: c.materi, jml_lkpd: c.lkpd,
          jml_quiz: c.quiz, jml_refleksi: c.refleksi, jml_draf: c.draf,
          item: itemPer[p.pertemuan_id] || []
        });
      });

    Object.keys(ptmPer).forEach(function (k) {
      ptmPer[k].sort(function (a, b) { return a.urutan - b.urutan; });
    });

    var daftarMp = mp.map(function (m) {
      var ptm = ptmPer[m.mp_id] || [];
      var jmlItem = 0, jmlDraf = 0;
      ptm.forEach(function (p) {
        jmlItem += p.jml_item;
        if (p.status !== 'publish') jmlDraf++;
      });
      return {
        mp_id: m.mp_id,
        urutan: Number(m.urutan),
        judul: m.judul,
        deskripsi: m.deskripsi,
        tujuan_pembelajaran: m.tujuan_pembelajaran,
        wajib: m.wajib === true,
        urut_ketat: m.urut_ketat === true,
          status: m.status,
        jml_pertemuan: ptm.length,
        jml_item: jmlItem,
        jml_draf: jmlDraf,
        pertemuan: ptm
      };
    });

    /* Pertemuan yang mp_id-nya tidak menunjuk materi pokok mana pun —
       sisa data lama yang belum kena migrasiHierarki(). Ditampilkan
       terpisah, bukan disembunyikan: guru harus tahu ada isi yatim. */
    var idSah = {};
    daftarMp.forEach(function (m) { idSah[m.mp_id] = true; });
    var yatim = [];
    Object.keys(ptmPer).forEach(function (k) {
      if (!idSah[k]) yatim = yatim.concat(ptmPer[k]);
    });
    yatim.sort(function (a, b) { return a.urutan - b.urutan; });

    return {
      kelas: {
        kelas_id: kelas.kelas_id,
        nama_kelas: kelas.nama_kelas,
        mapel: kelas.mapel,
        /* Dipakai panel Kerangka AI untuk memutuskan tombolnya aktif
           atau tidak. Tanpa medan ini klien selalu mengira Capaian
           Pembelajaran kosong dan memblokir guru — padahal server
           menerimanya dengan baik (laporan lapangan v1.8.3).

           `capaian_pembelajaran` bisa panjang (ribuan karakter), jadi
           yang dikirim cukup PENANDA ADA/TIDAK, bukan isinya. Payload
           ini dimuat setiap kali layar struktur kelas dibuka. */
        ada_capaian: String(kelas.capaian_pembelajaran || '').trim() !== ''
      },
      materi_pokok: daftarMp,
      yatim: yatim
    };
  }

  /**
   * Satu materi pokok — untuk form Ubah.
   *
   * Bentuknya disusun EKSPLISIT, bukan meneruskan baris sheet apa
   * adanya. Baris mentah membawa objek Date pada kolom created_at /
   * updated_at, dan nilai tanggal yang rusak di spreadsheet membuat
   * google.script.run gagal menyerialkannya — galatnya muncul di
   * peramban sebagai "Uncaught (in promise) Object" tanpa pesan.
   *
   * Form Ubah tidak memerlukan kolom tanggal sama sekali, jadi
   * kolom itu memang tidak dikirim.
   */
  function detail(mpId) {
    var m = Db.cariBarisCache('materi_pokok', 'mp_id', mpId);
    if (!m) throw _err('TIDAK_DITEMUKAN', 'Materi pokok tidak ditemukan.');

    return {
      mp_id: String(m.mp_id || ''),
      kelas_id: String(m.kelas_id || ''),
      urutan: Number(m.urutan) || 0,
      judul: String(m.judul || ''),
      deskripsi: String(m.deskripsi || ''),
      tujuan_pembelajaran: String(m.tujuan_pembelajaran || ''),
      wajib: m.wajib === true,
      urut_ketat: m.urut_ketat === true,
      status: m.status === 'publish' ? 'publish' : 'draft'
    };
  }

  /* ==================================================== SIMPAN */

  function simpan(sesi, p) {
    if (Util.kosong(p.judul)) throw _err('VALIDASI_GAGAL', 'Judul wajib diisi.');
    if (!p.mp_id && Util.kosong(p.kelas_id)) {
      throw _err('VALIDASI_GAGAL', 'Kelas wajib dipilih.');
    }

    /* hanya kolom yang benar-benar dikirim yang diperbarui — mencegah
       edit parsial menghapus data yang sudah ada */
    var isi = Util.isiBilaAda({ updated_at: Util.sekarang() }, p, {
      judul:               Util.teks(150),
      deskripsi:           Util.teks(1000),
      tujuan_pembelajaran: Util.teks(1000),
      wajib:               function (v) { return v !== false; },
      urut_ketat:          function (v) { return v !== false; },
      status:              function (v) {
        return v === 'publish' ? 'publish' : 'draft';
      }
    });

    /* ---- edit ---- */
    if (p.mp_id) {
      var ada = Db.cariBarisCache('materi_pokok', 'mp_id', p.mp_id);
      if (!ada) throw _err('TIDAK_DITEMUKAN', 'Materi pokok tidak ditemukan.');

      Db.perbarui('materi_pokok', ada._baris, isi);
      Util.catatLog(sesi.user_id, 'edit_materi_pokok', p.mp_id);
      return { mp_id: p.mp_id, baru: false };
    }

    /* ---- tambah ---- */
    if (!Db.cariBarisCache('kelas', 'kelas_id', p.kelas_id)) {
      throw _err('TIDAK_DITEMUKAN', 'Kelas tidak ditemukan.');
    }

    var maks = 0;
    Db.saringBaris('materi_pokok', 'kelas_id', p.kelas_id, ['urutan'])
      .forEach(function (r) { maks = Math.max(maks, Number(r.urutan) || 0); });

    if (isi.deskripsi === undefined) isi.deskripsi = '';
    if (isi.tujuan_pembelajaran === undefined) isi.tujuan_pembelajaran = '';
    if (isi.wajib === undefined) isi.wajib = true;
    if (isi.urut_ketat === undefined) isi.urut_ketat = true;
    if (isi.status === undefined) isi.status = 'draft';

    isi.mp_id = Util.buatId('MP');
    isi.kelas_id = p.kelas_id;
    isi.urutan = maks + 1;
    isi.created_at = Util.sekarang();

    Db.tambah('materi_pokok', isi);
    Util.catatLog(sesi.user_id, 'tambah_materi_pokok',
      isi.mp_id + ' ' + isi.judul);
    return { mp_id: isi.mp_id, baru: true, urutan: isi.urutan };
  }

  /* ==================================================== HAPUS */

  /**
   * Hapus materi pokok beserta SELURUH isinya.
   *
   * Memakai Db.saringBaris(), bukan Db.baca(): pada `progress`
   * 32.400 baris, membaca seluruh sheet berarti ratusan ribu sel
   * hanya untuk menemukan beberapa baris (pelajaran v0.9.9).
   */
  function hapus(sesi, mpId) {
    var m = Db.cariBarisCache('materi_pokok', 'mp_id', mpId);
    if (!m) throw _err('TIDAK_DITEMUKAN', 'Materi pokok tidak ditemukan.');

    var daftarPtm = Db.saringBaris('pertemuan', 'mp_id', mpId,
      ['pertemuan_id']);
    var idPtm = daftarPtm.map(function (x) { return x.pertemuan_id; });

    var daftarItem = Db.saringBaris('item', 'mp_id', mpId, ['item_id']);
    var idItem = daftarItem.map(function (x) { return x.item_id; });

    /* progress punya kolom mp_id → satu pemindaian cukup.

       TAPI baris progres lama (dibuat sebelum v1.0.1, atau oleh data yang
       belum kena migrasiHierarki) bisa punya mp_id kosong. Menyaring
       hanya lewat mp_id akan meninggalkan baris yatim yang membuat
       murid tampak "sudah selesai" pada item yang sudah tidak ada.
       Karena itu pertemuan_id dipindai juga — sama murahnya, sebab
       jumlah pertemuan per materi pokok sedikit. */
    var petaBarisProg = {};
    Db.saringBaris('progress', 'mp_id', mpId, ['mp_id'])
      .forEach(function (r) { petaBarisProg[r._baris] = true; });
    /* saringBarisBanyak: SATU pemindaian untuk seluruh pertemuan,
       bukan satu pemindaian per pertemuan */
    Db.saringBarisBanyak('progress', 'pertemuan_id', idPtm, ['pertemuan_id'])
      .forEach(function (r) { petaBarisProg[r._baris] = true; });
    var barisProg = Object.keys(petaBarisProg).map(Number);
    if (barisProg.length) Db.hapusBanyak('progress', barisProg);

    /* sheet lain hanya punya item_id — juga satu pemindaian per sheet */
    ['quiz_attempt', 'lkpd_submission', 'materi_ai', 'soal']
      .forEach(function (sheet) {
        var baris = Db.saringBarisBanyak(sheet, 'item_id', idItem, ['item_id'])
          .map(function (r) { return r._baris; });
        if (baris.length) Db.hapusBanyak(sheet, baris);
      });

    var barisItem = daftarItem.map(function (x) { return x._baris; });
    if (barisItem.length) Db.hapusBanyak('item', barisItem);

    var barisPtm = daftarPtm.map(function (x) { return x._baris; });
    if (barisPtm.length) Db.hapusBanyak('pertemuan', barisPtm);

    Db.hapus('materi_pokok',
      Db.cariCepat('materi_pokok', 'mp_id', mpId)._baris);
    _rapikanUrutan(m.kelas_id);

    Util.catatLog(sesi.user_id, 'hapus_materi_pokok',
      mpId + ' (' + idPtm.length + ' pertemuan, ' + idItem.length + ' item)');
    return { terhapus: true,
             pertemuan_terhapus: idPtm.length,
             item_terhapus: idItem.length };
  }

  /* ==================================================== URUTAN */

  /** Jadikan urutan 1..n tanpa lompatan. */
  function _rapikanUrutan(kelasId) {
    var mp = Db.saringBaris('materi_pokok', 'kelas_id', kelasId, ['urutan'])
      .sort(function (a, b) { return Number(a.urutan) - Number(b.urutan); });

    var ubah = [];
    mp.forEach(function (m, i) {
      if (Number(m.urutan) !== i + 1) {
        ubah.push({ _baris: m._baris, urutan: i + 1 });
      }
    });
    if (ubah.length) Db.perbaruiBanyak('materi_pokok', ubah);
  }

  /** Geser satu materi pokok naik/turun. */
  function geser(sesi, mpId, arah) {
    var m = Db.cariBarisCache('materi_pokok', 'mp_id', mpId);
    if (!m) throw _err('TIDAK_DITEMUKAN', 'Materi pokok tidak ditemukan.');

    var daftarMp = Db.saringBaris('materi_pokok', 'kelas_id', m.kelas_id,
      ['mp_id', 'urutan'])
      .sort(function (a, b) { return Number(a.urutan) - Number(b.urutan); });

    var idx = -1;
    for (var i = 0; i < daftarMp.length; i++) {
      if (daftarMp[i].mp_id === mpId) { idx = i; break; }
    }
    var tujuan = idx + (arah < 0 ? -1 : 1);
    if (idx < 0 || tujuan < 0 || tujuan >= daftarMp.length) {
      return { digeser: false };
    }

    Db.perbaruiBanyak('materi_pokok', [
      { _baris: daftarMp[idx]._baris,    urutan: tujuan + 1 },
      { _baris: daftarMp[tujuan]._baris, urutan: idx + 1 }
    ]);
    Util.catatLog(sesi.user_id, 'geser_materi_pokok', mpId);
    return { digeser: true };
  }

  return {
    daftar: daftar,
    struktur: struktur,
    detail: detail,
    simpan: simpan,
    hapus: hapus,
    geser: geser
  };
})();
