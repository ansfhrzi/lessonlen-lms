/**
 * ============================================================
 *  LessonLen — Rekap.gs
 *  Tahap 8: rekap nilai satu kelas + ekspor ke Google Sheet
 * ------------------------------------------------------------
 *  Acuan: KESEPAKATAN-SISTEM.md §15 tahap 8
 *
 *  BENTUK REKAP
 *
 *  Satu tabel: seluruh murid AKTIF satu kelas (baris) × seluruh item
 *  bernilai (kolom), ditapis per Materi Pokok.
 *
 *      Nama       | 1. LKPD VLAN | 2. Quiz Subnet | Rata-rata
 *      Andi       |      85      |       90       |    87,5
 *
 *  KEPUTUSAN (disepakati dengan guru)
 *
 *   - Cakupan  : satu kelas, DIPILIH per Materi Pokok ('semua' juga
 *                boleh). Satu kelas penuh lintas bab bisa 20–40 kolom;
 *                per bab membuatnya terbaca dan hemat kuota.
 *   - Refleksi : TIDAK IKUT — bukan penilaian (ralat guru v1.5.1).
 *   - Quiz     : nilai TERTINGGI dari seluruh percobaan — konsisten
 *                dengan layar Penilaian Quiz yang sudah ada.
 *   - Ekspor   : menulis Google Sheet BARU di Drive guru, lalu
 *                mengembalikan tautannya.
 *
 *  KENAPA REFLEKSI TIDAK ADA DI SINI
 *
 *  Skala 1–5 pada refleksi adalah PENILAIAN DIRI MURID atas
 *  pemahamannya sendiri — bukan nilai yang diberikan guru. Menaruhnya
 *  sebaris dengan nilai LKPD & Quiz membuatnya terbaca sebagai
 *  komponen penilaian, padahal murid yang jujur menulis "2" justru
 *  sedang membantu gurunya, bukan sedang berprestasi buruk.
 *
 *  Rekap refleksi tetap ada, di tempatnya sendiri: Refleksi.rekap()
 *  dan layar `#/rekap-refleksi/:itemId` (v1.2.0), yang menampilkan
 *  sebaran skala sekelas beserta jawaban terbukanya.
 *
 *  ATURAN MENGIKAT
 *   - Dilarang getRange() di dalam loop (KONVENSI §6.2 no. 1)
 *   - Daftar kolom EKSPLISIT di setiap pembacaan (no. 16)
 *   - Nilai getValues() tidak boleh langsung dikirim ke peramban (no. 12)
 *     → seluruh keluaran di sini berupa angka/string, tidak ada Date
 *       mentah; stempel waktu dilewatkan Util.formatTanggal()
 * ============================================================
 */

var Rekap = (function () {

  /* Batas aman satu tabel. 36 murid × 40 item = 1.440 sel isi; masih
     jauh di bawah kuota, tetapi kolom sebanyak itu tidak terbaca di
     layar. Angka ini memicu saran "pilih satu bab", bukan penolakan. */
  var SARAN_MAKS_KOLOM = 25;

  function _err(kode, pesan) {
    var e = new Error(pesan);
    e.kode = kode;
    return e;
  }

  /* ==================================================== bantu */

  /**
   * Item yang PUNYA nilai, terurut sesuai jalannya pelajaran.
   *
   * Urutan kolom mengikuti urutan belajar murid — bab, lalu pertemuan,
   * lalu item — bukan urutan baris di sheet. Guru membaca rapornya
   * dari kiri ke kanan seperti membaca silabus.
   *
   * Item berstatus draf DILEWATI: murid belum pernah melihatnya, jadi
   * kolomnya pasti kosong dan hanya menambah lebar tabel.
   */
  function _itemBernilai(kelasId, mpId) {
    /* Refleksi SENGAJA tidak ada di sini: skalanya penilaian diri
       murid, bukan nilai guru. Lihat catatan kepala berkas.

       Tugas kelompok IKUT (v1.7.0): nilainya berskala 0-100 sama
       seperti LKPD, dan tiap murid punya nilai akhirnya sendiri di
       `progress` (nilai kelompok atau penyesuaian per anggota). */
    var TIPE_NILAI = { lkpd: true, quiz: true, tugas_kelompok: true };

    var mp = Db.saringBaris('materi_pokok', 'kelas_id', kelasId,
      ['mp_id', 'urutan', 'judul']);
    var urutMp = {}, judulMp = {};
    mp.forEach(function (m) {
      urutMp[m.mp_id] = Number(m.urutan) || 0;
      judulMp[m.mp_id] = m.judul;
    });

    var ptm = Db.saringBaris('pertemuan', 'kelas_id', kelasId,
      ['pertemuan_id', 'mp_id', 'urutan', 'judul']);
    var infoPtm = {};
    ptm.forEach(function (p) {
      infoPtm[p.pertemuan_id] = {
        mp_id: p.mp_id || '',
        urutan: Number(p.urutan) || 0,
        judul: p.judul
      };
    });

    var item = Db.saringBaris('item', 'kelas_id', kelasId,
      ['item_id', 'pertemuan_id', 'mp_id', 'tipe', 'urutan', 'judul',
       'status', 'kkm']);

    var hasil = [];
    item.forEach(function (i) {
      if (!TIPE_NILAI[i.tipe]) return;
      if (i.status !== 'publish') return;

      var p = infoPtm[i.pertemuan_id];
      /* mp_id pada item bisa tertinggal saat pertemuan dipindah antar
         bab; yang berlaku adalah mp_id PERTEMUANnya (KONVENSI no. 16
         turunan — v1.1.1 pernah kebobolan di sini). */
      var mpBenar = p ? p.mp_id : String(i.mp_id || '');
      if (mpId && mpId !== 'semua' && mpBenar !== mpId) return;

      hasil.push({
        item_id: i.item_id,
        tipe: i.tipe,
        judul: i.judul,
        kkm: Number(i.kkm) || 0,
        mp_id: mpBenar,
        mp_judul: judulMp[mpBenar] || '(tanpa bab)',
        pertemuan_id: i.pertemuan_id,
        pertemuan_judul: p ? p.judul : '',
        _uMp: urutMp[mpBenar] === undefined ? 9999 : urutMp[mpBenar],
        _uPtm: p ? p.urutan : 9999,
        _uItem: Number(i.urutan) || 0
      });
    });

    hasil.sort(function (a, b) {
      if (a._uMp !== b._uMp) return a._uMp - b._uMp;
      if (a._uPtm !== b._uPtm) return a._uPtm - b._uPtm;
      return a._uItem - b._uItem;
    });
    return hasil;
  }

  /**
   * Nilai LKPD per murid per item.
   *
   * Hanya submission berstatus `diterima` yang dianggap bernilai —
   * `menunggu` & `ditolak` belum final.
   *
   * Catatan: sheet `lkpd_submission` juga menampung jawaban refleksi
   * (v1.2.0 memakainya ulang). Itu tidak menjadi masalah di sini
   * karena _itemBernilai() tidak pernah meloloskan item refleksi,
   * jadi itemIds tidak pernah memuatnya.
   */
  function _nilaiLkpd(itemIds) {
    var peta = {};      /* item_id → { user_id → {nilai, status} } */
    if (!itemIds.length) return peta;

    /* Susunan kelompok dibaca lebih dulu: satu baris pengumpulan
       kelompok mewakili SELURUH anggotanya, bukan hanya ketua yang
       tercatat di kolom user_id. Tanpa ini anggota non-ketua tampil
       kosong di rekap padahal tugasnya sudah dinilai (v1.7.0). */
    var anggotaKel = {};      /* kelompok_id → [user_id] */
    Db.saringBarisBanyak('kelompok', 'item_id', itemIds,
      ['kelompok_id', 'anggota'])
      .forEach(function (k) {
        var a;
        try { a = JSON.parse(k.anggota); } catch (e) { a = []; }
        anggotaKel[k.kelompok_id] = Array.isArray(a) ? a : [];
      });

    Db.saringBarisBanyak('lkpd_submission', 'item_id', itemIds,
      ['submission_id', 'user_id', 'item_id', 'status', 'nilai',
       'terlambat', 'revisi_ke', 'kelompok_id', 'nilai_anggota'])
      .forEach(function (s) {
        var per = peta[s.item_id] = peta[s.item_id] || {};

        /* siapa saja yang memegang hasil ini */
        var pemilik = [s.user_id];
        var kid = String(s.kelompok_id || '').trim();
        if (kid && anggotaKel[kid] && anggotaKel[kid].length) {
          pemilik = anggotaKel[kid];
        }

        var penyesuaian = {};
        if (kid) {
          try { penyesuaian = JSON.parse(s.nilai_anggota) || {}; }
          catch (e) { penyesuaian = {}; }
        }

        pemilik.forEach(function (uid) {
          var lama = per[uid];
          /* Revisi terbaru yang menang. Nomor revisi bisa sama bila
             data lama tidak mengisinya — dalam hal itu yang belakangan
             dibaca dipakai, sesuai urutan baris. */
          if (lama && Number(lama.revisi_ke) > Number(s.revisi_ke || 0)) return;

          /* nilai AKHIR murid ini: penyesuaian bila ada, kalau tidak
             nilai kelompok — sama dengan yang dilihat murid */
          var nilaiAkhir = s.nilai;
          if (penyesuaian[uid] !== undefined && penyesuaian[uid] !== '') {
            nilaiAkhir = penyesuaian[uid];
          }

          per[uid] = {
            nilai: nilaiAkhir,
            status: s.status,
            terlambat: s.terlambat === true,
            revisi_ke: Number(s.revisi_ke) || 0,
            kelompok: !!kid
          };
        });
      });
    return peta;
  }

  /**
   * Nilai quiz TERTINGGI per murid per item.
   *
   * Percobaan `kedaluwarsa` diabaikan. Attempt yang masih
   * `menunggu_koreksi` dicatat sebagai penanda — nilainya belum ada,
   * dan guru perlu tahu bahwa kolom kosong itu MENUNGGU DIA, bukan
   * murid yang tidak mengerjakan.
   */
  function _nilaiQuiz(itemIds) {
    var peta = {};
    if (!itemIds.length) return peta;

    Db.saringBarisBanyak('quiz_attempt', 'item_id', itemIds,
      ['attempt_id', 'user_id', 'item_id', 'status', 'nilai',
       'lulus', 'percobaan_ke'])
      .forEach(function (a) {
        if (a.status === 'kedaluwarsa') return;

        var per = peta[a.item_id] = peta[a.item_id] || {};
        var kini = per[a.user_id] =
          per[a.user_id] || { nilai: '', menunggu: false, percobaan: 0 };

        kini.percobaan++;
        if (a.status === 'menunggu_koreksi') kini.menunggu = true;
        if (a.status === 'berjalan') kini.berjalan = true;

        var n = Number(a.nilai);
        if (a.nilai !== '' && a.nilai !== null && isFinite(n)) {
          if (kini.nilai === '' || n > Number(kini.nilai)) kini.nilai = n;
        }
      });
    return peta;
  }

  /**
   * Rata-rata nilai berskala 0–100.
   *
   * Kolom kosong tidak dihitung sebagai nol — murid yang belum
   * mengerjakan tidak sama dengan murid yang mengerjakan lalu mendapat
   * nol; keduanya perlu dibedakan guru.
   *
   * Seluruh kolom di sini pasti berskala 0–100 karena _itemBernilai()
   * hanya meloloskan lkpd & quiz. Penjagaan tipe tetap dipertahankan
   * sebagai jaring pengaman: bila suatu saat tipe bernilai baru
   * ditambahkan dengan skala berbeda, ia harus didaftarkan di sini
   * secara sadar, bukan diam-diam ikut terjumlah (KONVENSI §6.2 no. 22).
   */
  var SKALA_100 = { lkpd: true, quiz: true, tugas_kelompok: true };

  function _rataNilai(sel, daftarItem) {
    var jml = 0, n = 0;
    daftarItem.forEach(function (it, i) {
      if (!SKALA_100[it.tipe]) return;
      var v = sel[i];
      if (v === '' || v === null || v === undefined) return;
      var a = Number(v);
      if (!isFinite(a)) return;
      jml += a; n++;
    });
    if (!n) return '';
    return Math.round((jml / n) * 10) / 10;
  }

  /* ==================================================== rekap */

  /**
   * Tabel rekap satu kelas.
   *
   * @param {string} kelasId
   * @param {string=} mpId  id Materi Pokok, atau 'semua'
   */
  function kelas(kelasId, mpId) {
    var k = Db.cariBarisCache('kelas', 'kelas_id', kelasId);
    if (!k) throw _err('TIDAK_DITEMUKAN', 'Kelas tidak ditemukan.');

    var daftarItem = _itemBernilai(kelasId, mpId);
    var itemIds = daftarItem.map(function (i) { return i.item_id; });

    /* murid aktif kelas ini */
    var enroll = Db.saringKolom('enrollment',
      { kelas_id: kelasId, status: 'aktif' }, ['user_id']);

    var petaNama = {};
    Db.bacaKolom('users', ['user_id', 'nama', 'username'])
      .forEach(function (u) { petaNama[u.user_id] = u; });

    var nLkpd = _nilaiLkpd(itemIds);
    var nQuiz = _nilaiQuiz(itemIds);

    var baris = enroll.map(function (e) {
      var u = petaNama[e.user_id] || {};
      var sel = [], catatan = [];

      daftarItem.forEach(function (it) {
        var v = '', c = '';

        if (it.tipe === 'quiz') {
          var q = (nQuiz[it.item_id] || {})[e.user_id];
          if (!q)                    { v = ''; c = 'belum'; }
          else if (q.nilai !== '')   { v = q.nilai;
                                       c = q.menunggu ? 'sebagian_koreksi'
                                         : (v >= it.kkm ? 'lulus' : 'belum_lulus'); }
          else if (q.menunggu)       { v = ''; c = 'menunggu_koreksi'; }
          else if (q.berjalan)       { v = ''; c = 'berjalan'; }
          else                       { v = ''; c = 'belum'; }

        } else {
          var s = (nLkpd[it.item_id] || {})[e.user_id];
          if (!s)                          { v = ''; c = 'belum'; }
          else if (s.status === 'diterima') {
            v = (s.nilai === '' || s.nilai === null) ? '' : Number(s.nilai);
            c = 'diterima';
            if (s.terlambat) c = 'terlambat';
          }
          else { v = ''; c = s.status; }   /* draft·menunggu·dinilai_proses·ditolak */
        }

        sel.push(v);
        catatan.push(c);
      });

      return {
        user_id: e.user_id,
        nama: u.nama || '(tidak dikenal)',
        username: u.username || '',
        nilai: sel,
        catatan: catatan,
        rata: _rataNilai(sel, daftarItem)
      };
    }).sort(function (a, b) {
      return String(a.nama).localeCompare(String(b.nama), 'id');
    });

    /* ringkasan per kolom — dipakai baris terbawah tabel */
    var perItem = daftarItem.map(function (it, i) {
      /* "Mencapai KKM" hanya bermakna bila item PUNYA KKM. LKPD tidak
         punya — KKM hanya diatur pada quiz. Tanpa penjagaan ini,
         kkm = 0 membuat setiap nilai (termasuk 0) terhitung tuntas,
         dan guru membaca 36/36 tuntas yang palsu. */
      var punyaKkm = it.kkm > 0;

      var jml = 0, n = 0, terisi = 0, tuntas = 0;
      baris.forEach(function (b) {
        var v = b.nilai[i];
        if (v !== '' && v !== null && v !== undefined) {
          terisi++;
          var a = Number(v);
          if (isFinite(a)) {
            jml += a; n++;
            if (punyaKkm && a >= it.kkm) tuntas++;
          }
        }
      });
      return {
        item_id: it.item_id,
        rata: n ? Math.round((jml / n) * 10) / 10 : '',
        terisi: terisi,
        belum: baris.length - terisi,
        tuntas: punyaKkm ? tuntas : ''
      };
    });

    var adaRata = baris.filter(function (b) { return b.rata !== ''; });
    var rataKelas = adaRata.length
      ? Math.round((adaRata.reduce(function (t, b) {
          return t + Number(b.rata); }, 0) / adaRata.length) * 10) / 10
      : '';

    return {
      kelas: { kelas_id: k.kelas_id, nama_kelas: k.nama_kelas,
               mapel: k.mapel || '' },
      mp_id: mpId || 'semua',
      item: daftarItem.map(function (i) {
        return { item_id: i.item_id, tipe: i.tipe, judul: i.judul,
                 kkm: i.kkm, mp_id: i.mp_id, mp_judul: i.mp_judul,
                 pertemuan_judul: i.pertemuan_judul };
      }),
      murid: baris,
      per_item: perItem,
      rekap: {
        jml_murid: baris.length,
        jml_item: daftarItem.length,
        jml_lkpd: daftarItem.filter(function (i) { return i.tipe === 'lkpd'; }).length,
        jml_quiz: daftarItem.filter(function (i) { return i.tipe === 'quiz'; }).length,
        rata_kelas: rataKelas,
        terlalu_lebar: daftarItem.length > SARAN_MAKS_KOLOM
      }
    };
  }

  /** Daftar bab untuk penapis, plus cacah item bernilai tiap bab. */
  function pilihanBab(kelasId) {
    var semua = _itemBernilai(kelasId, 'semua');
    var cacah = {};
    semua.forEach(function (i) {
      var c = cacah[i.mp_id] = cacah[i.mp_id] ||
        { mp_id: i.mp_id, judul: i.mp_judul, jml: 0 };
      c.jml++;
    });

    var mp = Db.saringBaris('materi_pokok', 'kelas_id', kelasId,
      ['mp_id', 'urutan', 'judul'])
      .sort(function (a, b) { return Number(a.urutan) - Number(b.urutan); });

    var daftar = mp.map(function (m) {
      return { mp_id: m.mp_id, judul: m.judul,
               jml_item: (cacah[m.mp_id] || {}).jml || 0 };
    });

    /* item yang pertemuannya belum punya bab tetap harus bisa dilihat */
    if (cacah['']) {
      daftar.push({ mp_id: '', judul: '(tanpa bab)', jml_item: cacah[''].jml });
    }
    return { total_item: semua.length, bab: daftar };
  }

  /**
   * Rekap + pilihan bab dalam SATU panggilan (v1.12.6).
   *
   * LAPORAN LAPANGAN 19 Agu 2026:
   *
   *     10.34.36  getRekapKelas        8,474 dtk
   *     10.34.36  getPilihanBabRekap   4,534 dtk   ← detik yang SAMA
   *
   * Layar Rekap memanggil dua API sekaligus. Di Apps Script tiap
   * panggilan adalah EKSEKUSI TERPISAH: masing-masing memuat &
   * mem-parse 760 KB kode, membuka spreadsheet, dan memvalidasi sesi
   * sendiri-sendiri. Biaya lantai itu ±0,9 detik — terukur lewat
   * `getDaftarKelas` yang 0,87 detik sambil membaca NOL sel.
   *
   * Menggabungkannya menghapus satu biaya lantai penuh. Sebagai bonus,
   * `_itemBernilai()` cukup dihitung SEKALI: `pilihanBab()` memakai
   * 'semua' sedangkan `kelas()` memakai bab terpilih, sehingga memo
   * per-eksekusi tidak pernah berbagi walau dijalankan berurutan.
   *
   * Kedua fungsi lama TETAP ADA dan tetap diekspor — dipakai
   * `ekspor()`, uji lama, dan sebagai jalan mundur bila berkas UI
   * belum tersalin.
   */
  function kelasLengkap(kelasId, mpId) {
    var semua = _itemBernilai(kelasId, 'semua');

    var cacah = {};
    semua.forEach(function (i) {
      var c = cacah[i.mp_id] = cacah[i.mp_id] ||
        { mp_id: i.mp_id, judul: i.mp_judul, jml: 0 };
      c.jml++;
    });

    var mp = Db.saringBaris('materi_pokok', 'kelas_id', kelasId,
      ['mp_id', 'urutan', 'judul'])
      .sort(function (a, b) { return Number(a.urutan) - Number(b.urutan); });

    var daftar = mp.map(function (m) {
      return { mp_id: m.mp_id, judul: m.judul,
               jml_item: (cacah[m.mp_id] || {}).jml || 0 };
    });
    if (cacah['']) {
      daftar.push({ mp_id: '', judul: '(tanpa bab)', jml_item: cacah[''].jml });
    }

    return {
      pilihan: { total_item: semua.length, bab: daftar },
      rekap: kelas(kelasId, mpId)
    };
  }

  /* ==================================================== ekspor */

  /**
   * Tulis rekap ke Google Sheet BARU, kembalikan tautannya.
   *
   * Kenapa Sheet, bukan unduhan .csv: Apps Script yang di-deploy sebagai
   * web app tidak bisa memaksa peramban mengunduh berkas dari sisi
   * server. Menulis Sheet juga langsung bisa diolah guru (rumus,
   * penyalinan ke format rapor sekolah) tanpa langkah impor.
   *
   * KONSEKUENSI: satu berkas baru dibuat di Drive guru SETIAP ekspor.
   * Namanya diberi awalan seragam supaya mudah disaring & dibersihkan —
   * lihat hapusEksporLama().
   */
  var AWALAN_BERKAS = 'LessonLen Rekap — ';

  function ekspor(sesi, kelasId, mpId) {
    var d = kelas(kelasId, mpId);

    var judulBab = 'Semua Bab';
    if (mpId && mpId !== 'semua') {
      var b = pilihanBab(kelasId).bab.filter(function (x) {
        return x.mp_id === mpId;
      })[0];
      judulBab = b ? b.judul : 'Bab';
    }

    var stempel = Utilities.formatDate(new Date(),
      Session.getScriptTimeZone(), 'yyyy-MM-dd HHmm');
    var nama = AWALAN_BERKAS + d.kelas.nama_kelas + ' — ' +
               judulBab + ' — ' + stempel;

    var ss = SpreadsheetApp.create(nama);
    var sh = ss.getSheets()[0];
    sh.setName('Rekap Nilai');

    /* --- susun SELURUH tabel di memori, tulis SEKALI ---
       Menulis baris demi baris akan melanggar KONVENSI §6.2 no. 1 dan
       untuk 36 murid berarti 36 panggilan API. */
    var tabel = [];

    tabel.push([nama]);
    tabel.push(['Kelas', d.kelas.nama_kelas, 'Mapel', d.kelas.mapel,
                'Bab', judulBab]);
    tabel.push(['Jumlah murid', d.rekap.jml_murid,
                'Jumlah item', d.rekap.jml_item,
                'Rata-rata kelas', d.rekap.rata_kelas]);
    tabel.push([]);

    /* dua baris kepala: asal item, lalu judul + KKM */
    var kepala1 = ['', 'Nama', 'Username'];
    var kepala2 = ['No', '', ''];
    d.item.forEach(function (it) {
      kepala1.push(it.pertemuan_judul || it.mp_judul);
      kepala2.push(_labelKolom(it));
    });
    kepala1.push('');
    kepala2.push('Rata-rata');
    tabel.push(kepala1);
    tabel.push(kepala2);

    d.murid.forEach(function (m, i) {
      var r = [i + 1, m.nama, m.username];
      m.nilai.forEach(function (v) { r.push(v === '' ? '' : v); });
      r.push(m.rata);
      tabel.push(r);
    });

    /* baris ringkasan */
    var barisRata = ['', 'Rata-rata butir', ''];
    var barisBelum = ['', 'Belum mengerjakan', ''];
    var barisTuntas = ['', 'Mencapai KKM', ''];
    d.per_item.forEach(function (p) {
      barisRata.push(p.rata);
      barisBelum.push(p.belum);
      barisTuntas.push(p.tuntas);
    });
    barisRata.push(d.rekap.rata_kelas);
    barisBelum.push(''); barisTuntas.push('');
    tabel.push([]);
    tabel.push(barisRata);
    tabel.push(barisBelum);
    tabel.push(barisTuntas);

    tabel.push([]);
    tabel.push(['Keterangan: sel kosong = belum ada nilai; ' +
                'angka 0 = dikerjakan tetapi mendapat nol. ' +
                'Item refleksi tidak termasuk penilaian — lihat ' +
                'menu Rekap Refleksi.']);

    /* setValues menolak baris dengan panjang berbeda — ratakan dulu */
    var lebar = 0;
    tabel.forEach(function (r) { lebar = Math.max(lebar, r.length); });
    tabel.forEach(function (r) {
      while (r.length < lebar) r.push('');
    });

    sh.getRange(1, 1, tabel.length, lebar).setValues(tabel);

    /* --- rias seperlunya, semua di luar loop baris ---

       JUDUL TIDAK DI-MERGE. Sel gabungan selebar tabel membuat
       setFrozenColumns(2) ditolak Sheets:

         "tidak dapat membekukan kolom yang berisi hanya sebagian
          dari sel gabungan"

       Pembekuan kolom Nama jauh lebih berguna daripada judul yang
       rapi di tengah — dan tanpa merge, teks A1 tetap terbaca karena
       meluber ke sel kanannya yang kosong. */
    sh.getRange(1, 1).setFontWeight('bold').setFontSize(13);
    sh.getRange(5, 1, 2, lebar).setFontWeight('bold')
      .setBackground('#D9F2D4');
    sh.setFrozenRows(6);
    sh.setFrozenColumns(2);
    sh.autoResizeColumns(1, Math.min(lebar, 3));

    Util.catatLog(sesi.user_id, 'ekspor_rekap',
      kelasId + ' → ' + ss.getId());

    return {
      spreadsheet_id: ss.getId(),
      url: ss.getUrl(),
      nama: nama,
      jml_murid: d.rekap.jml_murid,
      jml_item: d.rekap.jml_item
    };
  }

  /** Label kolom: judul item + penanda tipe & KKM. */
  function _labelKolom(it) {
    var ikon = it.tipe === 'quiz' ? '🎯 ' : '📝 ';
    var akhir = it.kkm ? ' (KKM ' + it.kkm + ')' : '';
    return ikon + it.judul + akhir;
  }

  /**
   * Buang berkas ekspor lama dari Drive.
   *
   * Tiap ekspor membuat satu Spreadsheet. Tanpa pembersihan, Drive guru
   * akan penuh berkas serupa setelah satu semester. Hanya berkas
   * berawalan AWALAN_BERKAS yang disentuh — berkas lain milik guru
   * tidak pernah tersentuh.
   *
   * @param {number=} simpanHari  berkas lebih tua dari ini dibuang (bawaan 30)
   */
  function hapusEksporLama(sesi, simpanHari) {
    var hari = Number(simpanHari);
    if (!isFinite(hari) || hari < 1) hari = 30;

    var batas = new Date().getTime() - hari * 24 * 60 * 60 * 1000;
    var berkas = DriveApp.searchFiles(
      'title contains "LessonLen Rekap" and trashed = false');

    var dibuang = 0, disimpan = 0;
    while (berkas.hasNext()) {
      var f = berkas.next();
      /* searchFiles "contains" bisa longgar — pastikan benar awalannya */
      if (f.getName().indexOf(AWALAN_BERKAS) !== 0) continue;
      if (f.getDateCreated().getTime() < batas) { f.setTrashed(true); dibuang++; }
      else disimpan++;
    }

    Util.catatLog(sesi.user_id, 'hapus_ekspor_lama',
      dibuang + ' dibuang, ' + disimpan + ' disimpan');
    return { dibuang: dibuang, disimpan: disimpan, simpan_hari: hari };
  }

  return {
    kelas: kelas,
    pilihanBab: pilihanBab,
    kelasLengkap: kelasLengkap,
    ekspor: ekspor,
    hapusEksporLama: hapusEksporLama,
    AWALAN_BERKAS: AWALAN_BERKAS,
    SARAN_MAKS_KOLOM: SARAN_MAKS_KOLOM
  };
})();
