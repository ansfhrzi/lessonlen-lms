/**
 * ============================================================
 *  LessonLen — Db.gs
 *  Lapisan akses Google Sheets + cache
 * ------------------------------------------------------------
 *  ATURAN MENGIKAT (KONVENSI-TEKNIS.md §6.2):
 *   1. Selalu Db.baca(). Dilarang getRange() di dalam loop.
 *   2. Setiap tulis WAJIB diikuti invalidasi cache (otomatis di sini).
 *   3. Penyaringan di memory (.filter()), bukan TextFinder.
 *   4. Sheet bervolume tinggi tidak di-cache.
 *   5. Tulis ke progress/quiz_attempt/lkpd_submission dibungkus LockService.
 * ============================================================
 */

var Db = (function () {

  /* sheet yang TIDAK di-cache — terlalu besar / terlalu sering berubah */
  var TANPA_CACHE = ['progress', 'quiz_attempt', 'lkpd_submission',
                     'session', 'log', 'notifikasi'];

  var TTL_CACHE = 21600;          /* 6 jam */
  var BATAS_CACHE = 95000;        /* CacheService maks ~100 KB per entri */

  var _ss = null;
  var _epochSeq = 0;      /* pembeda epoch dalam milidetik yang sama */

  /* Memo seumur satu eksekusi. CacheService masih dipakai untuk lintas
     eksekusi; memo ini mencegah sheet yang sama dibaca dua kali dalam
     satu permintaan (mis. `item` dibaca oleh daftarPertemuan lalu oleh
     detailPertemuan). Dikosongkan setiap invalidasi. */
  var _memo = {};

  /* Murid yang sedang ditulis progresnya — lihat tulisProgres(). */
  var _muridProgres = null;

  /* -------------------------------------------------- spreadsheet */

  function idDb() {
    var id = PropertiesService.getScriptProperties().getProperty('DB_ID');
    if (!id) throw new Error('DB_ID belum diset. Jalankan setupDatabase() dulu.');
    return id;
  }

  function ss() {
    if (!_ss) _ss = SpreadsheetApp.openById(idDb());
    return _ss;
  }

  function sheet(nama) {
    var sh = ss().getSheetByName(nama);
    if (!sh) throw new Error('Sheet tidak ditemukan: ' + nama);
    return sh;
  }

  /* -------------------------------------------------- baca */

  /**
   * Baca seluruh sheet sebagai array objek.
   * Tiap objek memuat _baris = nomor baris asli di sheet (untuk update/hapus).
   */
  function baca(nama) {
    var pakaiCache = TANPA_CACHE.indexOf(nama) === -1;

    if (pakaiCache) {
      try {
        var c = CacheService.getScriptCache().get('sh_' + nama);
        if (c) return JSON.parse(c);
      } catch (e) { /* cache rusak → baca ulang */ }
    }

    var nilai = sheet(nama).getDataRange().getValues();
    if (nilai.length < 2) return [];

    var head = nilai[0];
    var hasil = [];
    for (var i = 1; i < nilai.length; i++) {
      var baris = nilai[i];
      if (_barisKosong(baris)) continue;
      var o = { _baris: i + 1 };
      /* _aman juga di sini, bukan hanya di jalur tanpa-cache: sheet
         dalam TANPA_CACHE (progress, quiz_attempt, lkpd_submission)
         tidak pernah melewati JSON.stringify, jadi Date-nya lolos
         mentah. Menyeragamkan di satu tempat membuat SEMUA jalur baca
         menghasilkan bentuk tanggal yang sama. */
      for (var j = 0; j < head.length; j++) o[head[j]] = _aman(baris[j]);
      hasil.push(o);
    }

    if (pakaiCache) {
      try {
        var teks = JSON.stringify(hasil);
        if (teks.length < BATAS_CACHE) {
          CacheService.getScriptCache().put('sh_' + nama, teks, TTL_CACHE);
        }
      } catch (e) { /* lewati cache bila gagal */ }
    }
    return hasil;
  }

  function _barisKosong(baris) {
    for (var i = 0; i < baris.length; i++) {
      if (baris[i] !== '' && baris[i] !== null) return false;
    }
    return true;
  }

  /**
   * Ubah nilai satu sel menjadi bentuk yang AMAN dikirim ke peramban.
   *
   * getValues() mengembalikan objek Date untuk sel bertipe tanggal.
   * Objek Date tidak bisa diserialkan google.script.run bila nilainya
   * rusak (sel berisi #REF!, teks bebas, atau tanggal di luar jangkauan),
   * dan kegagalannya SENYAP: peramban menerima `null`, bukan pesan galat.
   * Console hanya menampilkan "Uncaught (in promise) Object".
   *
   * Db.baca() kebetulan aman karena hasilnya melewati JSON.stringify
   * untuk cache — Date terlanjur menjadi string di sana. Jalur yang
   * TIDAK lewat cache (cariCepat, saringBaris, bacaKolom, dan turunannya)
   * meneruskan Date apa adanya. Itulah mengapa "Ubah Pertemuan" berhasil
   * sementara "Ubah Materi Pokok" gagal — keduanya membaca sheet yang
   * setara, hanya jalurnya berbeda.
   *
   * Semua tanggal dinormalkan di sini, satu tempat, supaya tidak perlu
   * diingat pada setiap fungsi yang mengembalikan data.
   */
  function _aman(v) {
    if (v instanceof Date) {
      var t = v.getTime();
      if (isNaN(t)) return '';                 /* tanggal rusak */
      try {
        return Utilities.formatDate(v, 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
      } catch (e) { return ''; }   /* di luar jangkauan → jangan gagal */
    }
    return v;
  }

  /**
   * Baca HANYA sebagian kolom. Jauh lebih hemat untuk sheet besar.
   *
   * Sheet `progress` punya 15 kolom dan puluhan ribu baris; membaca
   * seluruhnya memindahkan ratusan ribu sel padahal yang dipakai
   * hanya beberapa kolom. Fungsi ini membaca rentang kolom minimum
   * yang mencakup kolom-kolom yang diminta.
   *
   * @param {string} nama        nama sheet
   * @param {Array<string>} kolom  daftar kolom yang dibutuhkan
   * @returns {Array<Object>}    tanpa _baris (bukan untuk update)
   */
  function bacaKolom(nama, kolom) {
    /* Memo per eksekusi: satu permintaan sering membaca kolom yang sama
       berkali-kali (mis. `item` dibaca daftarPertemuan lalu
       detailPertemuan lalu Lkpd). Kuncinya nama sheet + daftar kolom
       terurut, sehingga hanya permintaan yang benar-benar identik yang
       berbagi hasil. */
    var kunciMemo = 'bk_' + nama + '|' + kolom.slice().sort().join(',');
    if (_memo[nama] && _memo[nama][kunciMemo]) return _memo[nama][kunciMemo];

    var hasilMemo = _bacaKolom(nama, kolom);
    (_memo[nama] = _memo[nama] || {})[kunciMemo] = hasilMemo;
    return hasilMemo;
  }

  function _bacaKolom(nama, kolom) {
    var sh = sheet(nama);
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return [];

    var head = header(nama);
    var idx = [];
    kolom.forEach(function (k) {
      var i = head.indexOf(k);
      if (i >= 0 && idx.indexOf(i) === -1) idx.push(i);
    });
    if (!idx.length) return [];
    idx.sort(function (a, b) { return a - b; });

    /* Kelompokkan indeks berdekatan menjadi beberapa rentang.
       Membaca 2-3 rentang sempit jauh lebih hemat daripada satu
       rentang lebar yang ikut menyeret kolom besar seperti `konten`. */
    var rentang = [], mulai = idx[0], akhir = idx[0];
    for (var n = 1; n < idx.length; n++) {
      if (idx[n] - akhir <= 2) { akhir = idx[n]; }        /* jeda <=2 digabung */
      else { rentang.push([mulai, akhir]); mulai = akhir = idx[n]; }
    }
    rentang.push([mulai, akhir]);

    /* PENGECUALIAN SAH terhadap KONVENSI-TEKNIS.md §6.2 aturan 1:
       getRange dipanggil di dalam map, tetapi jumlahnya tetap kecil
       (2-3 rentang) dan justru JAUH lebih hemat daripada satu rentang
       lebar yang ikut menyeret kolom besar seperti `konten`. */
    var tinggi = lastRow - 1;
    var blok = rentang.map(function (r) {
      return sh.getRange(2, r[0] + 1, tinggi, r[1] - r[0] + 1).getValues();
    });

    /* peta kolom → (blok ke-i, offset) */
    var peta = {};
    kolom.forEach(function (k) {
      var i = head.indexOf(k);
      if (i < 0) return;
      for (var b = 0; b < rentang.length; b++) {
        if (i >= rentang[b][0] && i <= rentang[b][1]) {
          peta[k] = [b, i - rentang[b][0]];
          return;
        }
      }
    });

    /* Kolom penanda baris terisi.
       JANGAN memakai "semua nilai kosong" sebagai patokan — nilai
       `false` dan `0` adalah data sah dan tidak boleh dianggap kosong.

       HANYA PRIMARY KEY yang boleh jadi penanda, yaitu kolom PERTAMA
       sheet. Versi lama memakai `*_id` mana pun yang kebetulan lebih
       dulu ditemukan — termasuk FOREIGN KEY yang sah bila kosong,
       seperti `kelompok_id` (hanya terisi pada tugas kelompok),
       `mp_id`, dan `grup_id`.

       Akibatnya seluruh baris yang FK-nya kosong DIBUANG DIAM-DIAM.
       Terdeteksi v1.7.1: bacaKolom('lkpd_submission',
       ['status','kelompok_id']) mengembalikan larik kosong, sehingga
       beranda guru melaporkan 0 LKPD menunggu padahal ada.

       Urutan `for..in` tidak dijamin, jadi bug ini bahkan tidak
       konsisten antar mesin. */
    var kolomId = null;
    var pk = head[0];
    if (peta[pk] !== undefined) kolomId = pk;

    var hasil = [];
    for (var r = 0; r < tinggi; r++) {
      var o = {};
      for (var k in peta) o[k] = _aman(blok[peta[k][0]][r][peta[k][1]]);

      if (kolomId) {
        if (o[kolomId] === '' || o[kolomId] === null) continue;   /* baris kosong */
      } else {
        var adaIsi = false;
        for (var k2 in peta) {
          var v = o[k2];
          if (v !== '' && v !== null && v !== undefined) { adaIsi = true; break; }
        }
        if (!adaIsi) continue;
      }
      hasil.push(o);
    }
    return hasil;
  }

  /**
   * Saring berdasarkan SATU kolom kunci tanpa memindahkan seluruh sheet.
   *
   * Membaca kolom kunci saja (1 kolom) untuk menemukan nomor baris yang
   * cocok, lalu mengambil hanya baris-baris itu. Untuk `progress`
   * 32.400 baris di mana satu murid hanya punya ~75 baris, ini
   * memangkas 226.800 sel menjadi sekitar 33.500.
   *
   * Baris yang berdekatan digabung menjadi satu rentang. Bila hasilnya
   * terlalu terpencar (lebih dari BATAS_RENTANG potongan), fungsi
   * beralih ke pembacaan blok tunggal agar jumlah panggilan API tetap
   * terkendali.
   *
   * @returns {Array<Object>} beserta _baris
   */
  /**
   * Seperti saringBaris(), tetapi mencocokkan BANYAK nilai sekaligus
   * dalam satu kali pemindaian kolom kunci.
   *
   * Dipakai penghapusan berantai: MateriPokok.hapus() perlu semua baris
   * `progress` milik 15 pertemuan. Memanggil saringBaris() 15 kali
   * berarti memindai kolom kunci 15 kali (15 × 32.400 sel). Di sini
   * kolom kunci dibaca SEKALI saja.
   */
  function saringBarisBanyak(nama, kolomKunci, nilaiArr, kolom) {
    if (!nilaiArr || !nilaiArr.length) return [];

    var cari = {};
    nilaiArr.forEach(function (v) { cari[String(v)] = true; });

    var sh = sheet(nama);
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return [];

    var head = header(nama);
    var idxKunci = head.indexOf(kolomKunci);
    if (idxKunci < 0) return [];

    /* satu pemindaian kolom kunci untuk SELURUH nilai */
    var kunci = sh.getRange(2, idxKunci + 1, lastRow - 1, 1).getValues();
    var cocok = [];
    for (var i = 0; i < kunci.length; i++) {
      if (cari[String(kunci[i][0])]) cocok.push(i + 2);
    }
    if (!cocok.length) return [];

    return _ambilBaris(sh, head, cocok, kolomKunci, idxKunci, kolom);
  }

  /** Ambil isi baris pada nomor-nomor tertentu, digabung jadi rentang. */
  function _ambilBaris(sh, head, cocok, kolomKunci, idxKunci, kolom) {
    var BATAS_RENTANG = 12;
    var JEDA_GABUNG = 20;

    var runs = [], awal = cocok[0], akhir = cocok[0];
    for (var n = 1; n < cocok.length; n++) {
      if (cocok[n] - akhir <= JEDA_GABUNG) akhir = cocok[n];
      else { runs.push([awal, akhir]); awal = akhir = cocok[n]; }
    }
    runs.push([awal, akhir]);

    if (runs.length > BATAS_RENTANG) {
      runs = [[cocok[0], cocok[cocok.length - 1]]];
    }

    var perluBaris = {};
    cocok.forEach(function (r) { perluBaris[r] = true; });

    var hasil = [];
    runs.forEach(function (r) {
      var tinggi = r[1] - r[0] + 1;
      var blok = sh.getRange(r[0], 1, tinggi, head.length).getValues();
      for (var b = 0; b < tinggi; b++) {
        var nomor = r[0] + b;
        if (!perluBaris[nomor]) continue;
        var o = { _baris: nomor };
        if (kolom && kolom.length) {
          for (var c = 0; c < kolom.length; c++) {
            var ic = head.indexOf(kolom[c]);
            if (ic >= 0) o[kolom[c]] = _aman(blok[b][ic]);
          }
          o[kolomKunci] = _aman(blok[b][idxKunci]);
        } else {
          for (var j = 0; j < head.length; j++) o[head[j]] = _aman(blok[b][j]);
        }
        hasil.push(o);
      }
    });
    return hasil;
  }

  function saringBaris(nama, kolomKunci, nilai, kolom) {
    var BATAS_RENTANG = 12;
    var JEDA_GABUNG = 20;      /* baris kosong sebanyak ini masih digabung */

    var sh = sheet(nama);
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return [];

    var head = header(nama);
    var idxKunci = head.indexOf(kolomKunci);
    if (idxKunci < 0) return [];

    /* 1 kolom saja untuk menemukan posisi */
    var kunci = sh.getRange(2, idxKunci + 1, lastRow - 1, 1).getValues();
    var cocok = [];
    for (var i = 0; i < kunci.length; i++) {
      if (kunci[i][0] === nilai) cocok.push(i + 2);
    }
    if (!cocok.length) return [];

    /* gabungkan baris berdekatan menjadi rentang */
    var runs = [], awal = cocok[0], akhir = cocok[0];
    for (var n = 1; n < cocok.length; n++) {
      if (cocok[n] - akhir <= JEDA_GABUNG) akhir = cocok[n];
      else { runs.push([awal, akhir]); awal = akhir = cocok[n]; }
    }
    runs.push([awal, akhir]);

    /* terlalu terpencar → satu blok saja */
    if (runs.length > BATAS_RENTANG) {
      runs = [[cocok[0], cocok[cocok.length - 1]]];
    }

    /* PENGECUALIAN SAH terhadap KONVENSI-TEKNIS.md §6.2 aturan 1:
       getRange dipanggil di dalam loop, tetapi jumlahnya dibatasi
       BATAS_RENTANG dan totalnya jauh lebih hemat daripada membaca
       seluruh sheet. */
    var perluBaris = {};
    cocok.forEach(function (r) { perluBaris[r] = true; });

    var hasil = [];
    runs.forEach(function (r) {
      var tinggi = r[1] - r[0] + 1;
      var blok = sh.getRange(r[0], 1, tinggi, head.length).getValues();
      for (var b = 0; b < tinggi; b++) {
        var nomor = r[0] + b;
        if (!perluBaris[nomor]) continue;
        var o = { _baris: nomor };
        if (kolom && kolom.length) {
          for (var c = 0; c < kolom.length; c++) {
            var ic = head.indexOf(kolom[c]);
            if (ic >= 0) o[kolom[c]] = _aman(blok[b][ic]);
          }
          o[kolomKunci] = _aman(blok[b][idxKunci]);
        } else {
          for (var j = 0; j < head.length; j++) o[head[j]] = _aman(blok[b][j]);
        }
        hasil.push(o);
      }
    });
    return hasil;
  }

  /**
   * Saring sekaligus baca sebagian kolom — gabungan bacaKolom + filter.
   * Dipakai untuk kueri bervolume tinggi seperti progress per murid.
   */
  function saringKolom(nama, kriteria, kolom) {
    var perlu = kolom.slice();
    Object.keys(kriteria).forEach(function (k) {
      if (perlu.indexOf(k) === -1) perlu.push(k);
    });
    return bacaKolom(nama, perlu).filter(function (r) {
      for (var k in kriteria) { if (r[k] !== kriteria[k]) return false; }
      return true;
    });
  }

  /**
   * Cari satu baris TANPA memindahkan seluruh sheet.
   *
   * Membaca kolom kunci saja untuk menemukan nomor barisnya, lalu
   * mengambil satu baris itu. Untuk sheet besar (`progress` 32.400 baris)
   * atau sheet berkolom berat (`item` dengan `konten` 4 KB), ini
   * menghemat ratusan ribu sel dibanding Db.cari().
   *
   * @returns {Object|null} objek lengkap beserta _baris
   */
  function cariCepat(nama, kolomKunci, nilai) {
    var sh = sheet(nama);
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return null;

    var head = header(nama);
    var idx = head.indexOf(kolomKunci);
    if (idx < 0) return null;

    /* 1 kolom saja untuk mencari posisi */
    var kunci = sh.getRange(2, idx + 1, lastRow - 1, 1).getValues();
    var target = -1;
    for (var i = 0; i < kunci.length; i++) {
      if (kunci[i][0] === nilai) { target = i + 2; break; }
    }
    if (target < 0) return null;

    /* 1 baris saja */
    var baris = sh.getRange(target, 1, 1, head.length).getValues()[0];
    var o = { _baris: target };
    for (var j = 0; j < head.length; j++) o[head[j]] = _aman(baris[j]);
    return o;
  }

  /**
   * Cari baris yang cocok pada DUA kolom sekaligus — mis. progres
   * satu murid pada satu item. Membaca dua kolom kunci saja.
   */
  function cariCepat2(nama, kol1, nil1, kol2, nil2) {
    var sh = sheet(nama);
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return null;

    var head = header(nama);
    var i1 = head.indexOf(kol1), i2 = head.indexOf(kol2);
    if (i1 < 0 || i2 < 0) return null;

    /* Baca SATU kolom kunci saja untuk menyaring kandidat, lalu periksa
       kolom kedua hanya pada baris kandidat. Membaca dua kolom sekaligus
       (min..max) bisa jauh lebih mahal bila keduanya berjauhan, dan tetap
       2x lebih mahal walau bersebelahan. Pada `progress` 32.400 baris,
       ini memangkas 64.800 sel menjadi ~32.400 + beberapa baris. */
    var kolom1 = sh.getRange(2, i1 + 1, lastRow - 1, 1).getValues();
    var kandidat = [];
    for (var i = 0; i < kolom1.length; i++) {
      if (kolom1[i][0] === nil1) kandidat.push(i + 2);
    }
    if (!kandidat.length) return null;

    /* Bila kandidatnya banyak, satu blok lebih murah daripada puluhan
       panggilan getRange terpisah. */
    var target = -1;
    if (kandidat.length <= 8) {
      for (var c = 0; c < kandidat.length; c++) {
        var v = sh.getRange(kandidat[c], i2 + 1, 1, 1).getValues()[0][0];
        if (v === nil2) { target = kandidat[c]; break; }
      }
    } else {
      var awal = kandidat[0], ujung = kandidat[kandidat.length - 1];
      var kol2 = sh.getRange(awal, i2 + 1, ujung - awal + 1, 1).getValues();
      for (var d = 0; d < kandidat.length; d++) {
        if (kol2[kandidat[d] - awal][0] === nil2) { target = kandidat[d]; break; }
      }
    }
    if (target < 0) return null;

    var baris = sh.getRange(target, 1, 1, head.length).getValues()[0];
    var o = { _baris: target };
    for (var j = 0; j < head.length; j++) o[head[j]] = _aman(baris[j]);
    return o;
  }

  /**
   * Ambil satu baris berdasarkan nomor baris yang SUDAH diketahui,
   * lalu pastikan isinya benar-benar cocok dengan yang diharapkan.
   *
   * Nomor baris bisa bergeser bila ada penghapusan, maka hasilnya
   * selalu diverifikasi terhadap `cocok`. Bila tidak cocok, kembalikan
   * null agar pemanggil jatuh ke pencarian penuh.
   *
   * Biaya: 1 baris, bukan puluhan ribu.
   *
   * @param {Object} cocok pasangan kolom→nilai yang wajib sama
   */
  function bacaBarisJika(nama, nomorBaris, cocok) {
    if (!nomorBaris || nomorBaris < 2) return null;
    var sh = sheet(nama);
    if (nomorBaris > sh.getLastRow()) return null;

    var head = header(nama);
    var baris = sh.getRange(nomorBaris, 1, 1, head.length).getValues()[0];

    var o = { _baris: nomorBaris };
    for (var j = 0; j < head.length; j++) o[head[j]] = _aman(baris[j]);

    for (var k in cocok) { if (o[k] !== cocok[k]) return null; }
    return o;
  }

  /**
   * Seperti cariCepat(), tetapi nomor barisnya DIINGAT di CacheService.
   *
   * Pemanggilan berikutnya langsung membaca satu baris itu dan
   * memverifikasi isinya lewat bacaBarisJika(). Bila nomor baris meleset
   * (baris di atasnya terhapus), hasilnya null dan fungsi jatuh ke
   * pemindaian penuh lalu memperbarui cache.
   *
   * Dipakai untuk lookup yang berulang-ulang pada sheet besar:
   * `item` (924 baris kolom kunci), `progress` (32.400), `quiz_attempt`.
   * Biaya turun dari sepanjang-sheet menjadi satu baris.
   *
   * AMAN karena isi baris selalu dicocokkan ulang — cache yang basi
   * hanya membuat satu pembacaan sia-sia, tidak pernah salah data.
   */
  function cariBarisCache(nama, kolomKunci, nilai) {
    if (nilai === '' || nilai === null || nilai === undefined) return null;
    var kunci = 'rb_' + nama + '_' + kolomKunci + '_' + nilai;
    var cache = null;
    try { cache = CacheService.getScriptCache(); } catch (e) {}

    if (cache) {
      var tebak = null;
      try { tebak = cache.get(kunci); } catch (e) {}
      if (tebak) {
        var cocok = {};
        cocok[kolomKunci] = nilai;
        var baris = bacaBarisJika(nama, Number(tebak), cocok);
        if (baris) return baris;
      }
    }

    var hasil = cariCepat(nama, kolomKunci, nilai);
    if (hasil && cache) {
      try { cache.put(kunci, String(hasil._baris), 21600); } catch (e) {}
    }
    return hasil;
  }

  /**
   * Versi dua kolom — mis. progres satu murid pada satu item.
   * Nomor baris diingat, isinya diverifikasi ulang setiap kali.
   */
  function cariBarisCache2(nama, kol1, nil1, kol2, nil2) {
    if (nil1 === '' || nil1 === null || nil1 === undefined) return null;
    if (nil2 === '' || nil2 === null || nil2 === undefined) return null;
    var kunci = 'rb2_' + nama + '_' + nil1 + '_' + nil2;
    var cache = null;
    try { cache = CacheService.getScriptCache(); } catch (e) {}

    if (cache) {
      var tebak = null;
      try { tebak = cache.get(kunci); } catch (e) {}
      if (tebak) {
        var cocok = {};
        cocok[kol1] = nil1;
        cocok[kol2] = nil2;
        var baris = bacaBarisJika(nama, Number(tebak), cocok);
        if (baris) return baris;
      }
    }

    var hasil = cariCepat2(nama, kol1, nil1, kol2, nil2);
    if (hasil && cache) {
      try { cache.put(kunci, String(hasil._baris), 21600); } catch (e) {}
    }
    return hasil;
  }

  /**
   * Cari baris untuk BANYAK nilai kol1 sekaligus, pada satu nilai kol2.
   *
   * 🔴 v1.12.5 — LAPORAN LAPANGAN: `nilaiKelompok` 16,7 detik.
   *
   * `cariBarisCache2()` memindai satu kolom penuh tiap kali dipanggil.
   * Itu sah untuk SATU murid, tetapi `Kelompok.nilai()` memanggilnya
   * sekali per anggota di dalam loop. Terukur pada 6 anggota dengan
   * 16.200 baris progress:
   *
   *     97.858 sel dibaca — 98% dari seluruh biaya
   *
   * Enam pemindaian penuh untuk menemukan enam baris. Dan biayanya
   * TUMBUH seiring besar kelompok: kelompok 10 anggota membayar 10x.
   *
   * Fungsi ini memindai kolom kunci SATU KALI, lalu mencocokkan
   * seluruh nilai yang dicari dalam satu lintasan memori.
   *
   * Cache nomor baris tetap dihormati: nilai yang nomornya sudah
   * diingat diverifikasi lebih dulu (murah, satu baris), dan
   * pemindaian penuh hanya dilakukan bila MASIH ada yang belum
   * ketemu — jadi pemanggilan kedua praktis gratis.
   *
   * @returns {Object} peta nilai kol1 → baris (tanpa yang tidak ada)
   */
  function cariBarisBanyak2(nama, kol1, daftarNil1, kol2, nil2) {
    var hasil = {};
    if (!daftarNil1 || !daftarNil1.length) return hasil;
    if (nil2 === '' || nil2 === null || nil2 === undefined) return hasil;

    /* buang duplikat & nilai kosong */
    var perlu = [];
    daftarNil1.forEach(function (v) {
      if (v === '' || v === null || v === undefined) return;
      if (perlu.indexOf(v) === -1) perlu.push(v);
    });
    if (!perlu.length) return hasil;

    var cache = null;
    try { cache = CacheService.getScriptCache(); } catch (e) {}

    /* Tahap 1 — pakai nomor baris yang sudah diingat. Tiap verifikasi
       hanya membaca SATU baris, jadi jauh lebih murah daripada
       memindai kolom. */
    var sisa = [];
    perlu.forEach(function (v) {
      var tebak = null;
      if (cache) {
        try { tebak = cache.get('rb2_' + nama + '_' + v + '_' + nil2); }
        catch (e) {}
      }
      if (tebak) {
        var cocok = {};
        cocok[kol1] = v;
        cocok[kol2] = nil2;
        var baris = bacaBarisJika(nama, Number(tebak), cocok);
        if (baris) { hasil[v] = baris; return; }
      }
      sisa.push(v);
    });
    if (!sisa.length) return hasil;

    /* Tahap 2 — SATU pemindaian untuk seluruh sisa. */
    var sh = sheet(nama);
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return hasil;

    var head = header(nama);
    var i1 = head.indexOf(kol1), i2 = head.indexOf(kol2);
    if (i1 < 0 || i2 < 0) return hasil;

    var kolom1 = sh.getRange(2, i1 + 1, lastRow - 1, 1).getValues();
    var kandidat = [];
    for (var i = 0; i < kolom1.length; i++) {
      if (sisa.indexOf(kolom1[i][0]) !== -1) kandidat.push(i + 2);
    }
    if (!kandidat.length) return hasil;

    /* Kolom kedua dibaca sebagai satu blok yang mencakup seluruh
       kandidat — satu panggilan, bukan satu per kandidat. */
    var awal = kandidat[0], ujung = kandidat[kandidat.length - 1];
    var blok2 = sh.getRange(awal, i2 + 1, ujung - awal + 1, 1).getValues();

    var cocokBaris = [];
    for (var c = 0; c < kandidat.length; c++) {
      if (blok2[kandidat[c] - awal][0] === nil2) cocokBaris.push(kandidat[c]);
    }
    if (!cocokBaris.length) return hasil;

    /* Baris utuh juga dibaca sebagai satu blok. */
    var a2 = cocokBaris[0], u2 = cocokBaris[cocokBaris.length - 1];
    var blokIsi = sh.getRange(a2, 1, u2 - a2 + 1, head.length).getValues();

    cocokBaris.forEach(function (nomor) {
      var baris = blokIsi[nomor - a2];
      var o = { _baris: nomor };
      for (var j = 0; j < head.length; j++) o[head[j]] = _aman(baris[j]);
      hasil[o[kol1]] = o;
      if (cache) {
        try {
          cache.put('rb2_' + nama + '_' + o[kol1] + '_' + nil2,
                    String(nomor), 21600);
        } catch (e) {}
      }
    });

    return hasil;
  }

  /**
   * Titipkan nomor baris ke cache tanpa membacanya lebih dulu.
   *
   * Dipakai ketika pemanggil SUDAH memegang barisnya dari sumber lain
   * (mis. peta progres murid), agar lookup berikutnya tidak memindai
   * sheet. Nomor tetap diverifikasi saat dipakai, jadi menitipkan
   * nomor yang keliru tidak pernah merusak data.
   */
  function titipBaris2(nama, nil1, nil2, nomorBaris) {
    if (!nomorBaris) return;
    try {
      CacheService.getScriptCache()
        .put('rb2_' + nama + '_' + nil1 + '_' + nil2,
             String(nomorBaris), 21600);
    } catch (e) {}
  }

  /** Cari satu baris berdasarkan kolom = nilai. Mengembalikan null bila tidak ada. */
  function cari(nama, kolom, nilai) {
    var data = baca(nama);
    for (var i = 0; i < data.length; i++) {
      if (data[i][kolom] === nilai) return data[i];
    }
    return null;
  }

  /** Saring baris berdasarkan pasangan kolom-nilai. */
  function saring(nama, kriteria) {
    return baca(nama).filter(function (r) {
      for (var k in kriteria) {
        if (r[k] !== kriteria[k]) return false;
      }
      return true;
    });
  }

  /* -------------------------------------------------- tulis */

  function header(nama) {
    /* Header hanya berubah saat migrasiStruktur(). Dalam satu eksekusi
       ia bisa dibaca puluhan kali (setiap tambah/perbarui/bacaKolom),
       dan tiap pembacaan adalah satu panggilan API. */
    var m = (_memo[nama] = _memo[nama] || {});
    if (m.__head) return m.__head;
    var sh = sheet(nama);
    m.__head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    return m.__head;
  }

  /** Tambah satu atau banyak baris. Satu setValues. */
  function tambah(nama, objAtauArr) {
    var arr = Array.isArray(objAtauArr) ? objAtauArr : [objAtauArr];
    if (!arr.length) return 0;

    var head = header(nama);
    var baris = arr.map(function (o) {
      return head.map(function (h) {
        return (o[h] === undefined || o[h] === null) ? '' : o[h];
      });
    });

    /* KUNCI ADA DI SINI, bukan di pemanggil.
     *
     * `getLastRow() + 1` adalah satu-satunya operasi yang benar-benar
     * REBUTAN antar murid:
     *
     *     A: getLastRow() → 100, tulis baris 101
     *     B: getLastRow() → 100, tulis baris 101   ← menimpa A
     *
     * Memperbarui baris yang SUDAH ADA tidak punya masalah ini —
     * nomor barisnya sudah pasti, dan tiap murid menyentuh barisnya
     * sendiri. Karena itu `perbarui()` TIDAK berkunci (v1.9.1).
     *
     * Blok yang dikunci sesingkat mungkin: baca nomor baris, tulis,
     * selesai. Penyusunan larik di atas sengaja dilakukan di LUAR
     * kunci supaya murid lain tidak menunggu pekerjaan yang tidak
     * menyentuh sheet. */
    denganKunci(function () {
      var sh = sheet(nama);
      sh.getRange(sh.getLastRow() + 1, 1, baris.length, head.length)
        .setValues(baris);
    });

    invalidasi(nama);
    return baris.length;
  }

  /**
   * Perbarui sebagian kolom pada satu baris.
   * @param {number} nomorBaris nilai _baris hasil baca()
   */
  function perbarui(nama, nomorBaris, obj) {
    var sh = sheet(nama);
    var head = header(nama);
    var lama = sh.getRange(nomorBaris, 1, 1, head.length).getValues()[0];

    for (var i = 0; i < head.length; i++) {
      if (obj[head[i]] !== undefined) lama[i] = obj[head[i]];
    }
    sh.getRange(nomorBaris, 1, 1, head.length).setValues([lama]);
    invalidasi(nama);
  }

  /**
   * Perbarui banyak baris sekaligus. items = [{_baris, ...kolom}]
   *
   * Membaca seluruh rentang yang tersentuh SEKALI, mengubahnya di memory,
   * lalu menulis balik sekali. Jauh lebih cepat daripada getRange per baris.
   */
  function perbaruiBanyak(nama, items) {
    if (!items || !items.length) return;
    if (items.length === 1) { perbarui(nama, items[0]._baris, items[0]); return; }

    var sh = sheet(nama);
    var head = header(nama);

    var nomor = items.map(function (it) { return it._baris; });
    var min = Math.min.apply(null, nomor);
    var max = Math.max.apply(null, nomor);
    var tinggi = max - min + 1;

    /* 🔴 v1.12.5 — satu blok hanya menang bila barisnya BERDEKATAN.
     *
     * Fungsi ini dirancang untuk baris berurutan (mis. 40 item satu
     * pertemuan). Tetapi `Kelompok.nilai()` memperbarui progres 6
     * anggota yang barisnya tersebar di seluruh sheet: satu blok dari
     * baris terkecil ke terbesar ikut menyeret ribuan baris murid lain
     * yang tidak disentuh — terukur 6.016 sel untuk memperbarui 6.
     *
     * Bila blok jauh lebih besar daripada jumlah baris yang benar-benar
     * diubah, satu getRange per baris justru lebih murah. Ambang 4x
     * dipilih konservatif: pada rasio itu kedua cara setara, di atasnya
     * blok mulai kalah.
     *
     * Bandingkan §6.2 no. 88 — arah sebaliknya. Tidak ada satu pola
     * yang selalu menang; yang menentukan adalah KERAPATAN baris. */
    if (tinggi > items.length * 4 && tinggi > 50) {
      items.forEach(function (it) { perbarui(nama, it._baris, it); });
      return;
    }

    /* satu kali baca untuk seluruh rentang */
    var blok = sh.getRange(min, 1, tinggi, head.length).getValues();

    items.forEach(function (it) {
      var idx = it._baris - min;
      for (var i = 0; i < head.length; i++) {
        if (it[head[i]] !== undefined) blok[idx][i] = it[head[i]];
      }
    });

    /* satu kali tulis */
    sh.getRange(min, 1, tinggi, head.length).setValues(blok);
    invalidasi(nama);
  }

  /** Hapus satu baris. */
  function hapus(nama, nomorBaris) {
    sheet(nama).deleteRow(nomorBaris);
    invalidasi(nama);
  }

  /** Hapus banyak baris. Diurut menurun agar nomor tidak bergeser. */
  function hapusBanyak(nama, daftarBaris) {
    if (!daftarBaris.length) return 0;
    var sh = sheet(nama);
    daftarBaris.slice().sort(function (a, b) { return b - a; })
      .forEach(function (n) { sh.deleteRow(n); });
    invalidasi(nama);
    return daftarBaris.length;
  }

  /**
   * Kosongkan SELURUH isi sheet, header tetap (v1.12.0).
   *
   * `hapusBanyak()` memanggil `deleteRow()` sekali per baris. Untuk
   * puluhan ribu baris `progress` itu puluhan ribu panggilan API dan
   * pasti menabrak batas 6 menit — persis pekerjaan yang dibutuhkan
   * `resetTahunAjaran()`.
   *
   * `deleteRows(2, n)` menghapus seluruh rentang dalam SATU panggilan.
   *
   * @returns {number} jumlah baris data yang dibuang
   */
  function kosongkanSheet(nama) {
    var sh = sheet(nama);
    var akhir = sh.getLastRow();
    if (akhir < 2) return 0;              /* hanya header */
    sh.deleteRows(2, akhir - 1);
    invalidasi(nama);
    return akhir - 1;
  }

  /**
   * Simpan: perbarui bila kunci cocok, tambah bila belum ada.
   * @returns {string} 'perbarui' | 'tambah'
   */
  function simpan(nama, kolomKunci, obj) {
    var ada = cari(nama, kolomKunci, obj[kolomKunci]);
    if (ada) { perbarui(nama, ada._baris, obj); return 'perbarui'; }
    tambah(nama, obj);
    return 'tambah';
  }

  /* -------------------------------------------------- cache */

  function invalidasi(nama) {
    /* Header TIDAK ikut dibuang.

       `_memo[nama]` menyimpan dua hal berbeda: hasil `bacaKolom()`
       yang memang basi setelah menulis, dan `__head` yang HANYA
       berubah saat `migrasiStruktur()`. Menghapus keduanya sekaligus
       memaksa satu `getRange()` header tambahan pada setiap tulis
       berikutnya.

       Terasa saat menulis banyak: `tambah()` memanggil `header()`,
       lalu `invalidasi()` membuangnya, lalu `tambah()` berikutnya
       membacanya lagi. Menerapkan kerangka 20 pertemuan = ratusan
       pembacaan header yang seluruhnya mengembalikan nilai sama
       (v1.8.7). */
    var head = _memo[nama] && _memo[nama].__head;
    delete _memo[nama];
    if (head) _memo[nama] = { __head: head };
    try {
      CacheService.getScriptCache().remove('sh_' + nama);

      /* Daftar id guru di-cache oleh Notif.kirimKeGuru(). */
      if (nama === 'users') CacheService.getScriptCache().remove('id_guru');

      /* Bank soal di-cache per item oleh Quiz._soalItem(). Memajukan
         epoch membatalkan seluruhnya sekaligus — penyuntingan soal
         jarang terjadi, jadi membatalkan semua jauh lebih sederhana
         daripada melacak item mana yang tersentuh. */
      if (nama === 'soal') {
        _epochSeq++;
        CacheService.getScriptCache()
          .put('soal_epoch', Date.now() + '-' + _epochSeq, 21600);
      }

      /* Cache progres memakai DUA tingkat epoch:

         - epoch GLOBAL   : dimajukan bila `item`/`pertemuan`/`enrollment`
                            berubah. Struktur kelas berubah → perhitungan
                            progres SEMUA murid ikut berubah, jadi memang
                            harus membatalkan cache semua orang. Jarang
                            terjadi (hanya saat guru menyunting).

         - epoch PER MURID: dimajukan bila `progress` berubah. Progres
                            satu murid tidak memengaruhi murid lain.

         Sebelumnya `progress` ikut memajukan epoch global. Akibatnya
         satu murid menandai satu bagian selesai membatalkan cache 431
         murid lain — pada kelas 36 murid yang belajar bersamaan, cache
         praktis tidak pernah kena. Lihat test/perf7-serentak.js. */
      if (nama === 'item' || nama === 'pertemuan' || nama === 'enrollment') {
        /* Date.now() saja tidak cukup: dua penulisan dalam milidetik
           yang sama menghasilkan epoch identik, sehingga cache lama
           tetap terpakai. Tambahkan penghitung yang selalu naik. */
        _epochSeq++;
        CacheService.getScriptCache()
          .put('prog_epoch', Date.now() + '-' + _epochSeq, 21600);
      } else if (nama === 'progress') {
        if (_muridProgres) {
          _epochSeq++;
          CacheService.getScriptCache().put('pe_' + _muridProgres,
            Date.now() + '-' + _epochSeq, 21600);
        } else {
          /* Penulis tidak menyatakan murid mana yang tersentuh — bisa
             jadi operasi massal. Ambil jalan aman: batalkan semua. */
          _epochSeq++;
          CacheService.getScriptCache()
            .put('prog_epoch', Date.now() + '-' + _epochSeq, 21600);
        }
      }
    } catch (e) {}
  }

  /**
   * Epoch gabungan untuk cache progres satu murid.
   * Berubah bila struktur kelas berubah (global) ATAU progres murid
   * itu sendiri berubah (per murid).
   */
  function epochProgres(userId) {
    var g = '0', u = '0';
    try {
      var c = CacheService.getScriptCache();
      g = c.get('prog_epoch') || '0';
      u = c.get('pe_' + userId) || '0';
    } catch (e) {}
    return g + '.' + u;
  }

  /**
   * Nyatakan bahwa penulisan `progress` berikutnya hanya menyentuh satu
   * murid, sehingga cache murid lain tidak perlu dibatalkan.
   *
   * WAJIB dipanggil berpasangan — selalu di dalam try/finally atau
   * lewat Db.denganKunci — agar tidak bocor ke operasi berikutnya.
   */
  function mulaiProgresMurid(userId) { _muridProgres = userId || null; }
  function selesaiProgresMurid()     { _muridProgres = null; }

  /**
   * Bungkus penulisan progres satu murid: kunci + penandaan murid.
   * Penanda selalu dibersihkan meski fn melempar error.
   */
  /**
   * Bungkus penulisan progres SATU murid.
   *
   * Tidak lagi mengambil kunci global (v1.9.1). Yang ditulis di sini
   * adalah baris `progress` milik satu murid — murid lain tidak
   * pernah menyentuhnya. Bila di dalamnya ternyata perlu MENAMBAH
   * baris baru, `Db.tambah()` yang mengambil kuncinya sendiri, dan
   * hanya selama operasi tulis itu berlangsung.
   *
   * Dulu seluruh blok ini berkunci, sehingga 36 murid mengumpulkan
   * quiz bersamaan mengantre dua kali masing-masing (§6.2 no. 56).
   */
  function tulisProgres(userId, fn) {
    mulaiProgresMurid(userId);
    try { return fn(); } finally { selesaiProgresMurid(); }
  }

  /**
   * Buang memo header — WAJIB dipanggil setelah `migrasiStruktur()`.
   *
   * 🔴 v1.10.2. `invalidasi()` sengaja MEMPERTAHANKAN `__head` demi
   * kecepatan (v1.8.7): header hanya berubah saat migrasi, jadi
   * membacanya ulang tiap tulis adalah pemborosan.
   *
   * Tetapi tidak ada satu pun yang memberi tahu memo itu ketika
   * migrasi BENAR-BENAR mengubah header. Akibatnya `Db` terus memakai
   * susunan kolom LAMA di sisa eksekusi: kolom yang baru ditambahkan
   * tidak ada dalam daftar, sehingga `tambah()` dan `perbarui()`
   * MEMBUANGNYA diam-diam — tanpa galat apa pun.
   *
   * Dilaporkan dari lapangan (v1.10.1): guru menjalankan
   * `migrasiStruktur()`, kolom `nisn` & `no_wa` sungguh terbentuk di
   * spreadsheet, tetapi nilainya selalu kosong. `email` — kolom lama
   * yang sudah ada di header — tersimpan normal, dan justru itulah
   * yang membuat gejalanya membingungkan.
   */
  function invalidasiHeader() {
    Object.keys(_memo).forEach(function (n) {
      if (_memo[n]) delete _memo[n].__head;
    });
  }

  function invalidasiSemua() {
    _memo = {};
    try {
      CacheService.getScriptCache().removeAll(
        ['users','kelas','enrollment','pertemuan','item','soal',
         'materi_ai','permintaan_reset'].map(function (n) { return 'sh_' + n; })
      );
    } catch (e) {}
  }

  /* -------------------------------------------------- kunci */

  /**
   * Bungkus operasi tulis yang rawan tabrakan.
   * Melempar Error('SISTEM_SIBUK') bila kunci tidak didapat dalam 10 detik.
   */
  /* Kedalaman kunci dalam SATU eksekusi. `Db.tambah()` mengambil
     kunci sendiri (lihat di sana), dan ia sering dipanggil dari dalam
     blok yang sudah berkunci — tanpa penghitung ini, kunci akan
     dilepas terlalu awal oleh blok bagian dalam. */
  var _dalamKunci = 0;

  /**
   * Bungkus operasi yang benar-benar rawan tabrakan ANTAR MURID.
   *
   * ⚠️ `LockService.getScriptLock()` adalah SATU kunci untuk SELURUH
   * aplikasi — bukan per murid, bukan per sheet. Setiap pemakaian
   * membuat seluruh murid mengantre di belakang satu sama lain.
   *
   * Laporan lapangan v1.9.0: 36 murid mengerjakan quiz bersamaan →
   * "server sibuk, data tidak tersimpan". Sebabnya kunci ini dipakai
   * untuk operasi yang sebenarnya hanya menyentuh baris MILIK MURID
   * SENDIRI (§6.2 no. 56).
   *
   * Sejak v1.9.1 dipakai SANGAT selektif — lihat `tambah()`.
   */
  function denganKunci(fn) {
    /* sudah di dalam kunci: jangan ambil lagi, jangan lepas dua kali */
    if (_dalamKunci > 0) {
      _dalamKunci++;
      try { return fn(); } finally { _dalamKunci--; }
    }

    /* 45 detik, naik dari 10 (v1.9.1).
     *
     * Kunci dipegang <1 detik per operasi. Yang membuat murid gagal
     * bukan lamanya operasi, melainkan PANJANG ANTREAN: 36 murid
     * menekan Kumpulkan bersamaan → murid terakhir menunggu ~21
     * detik, dan `tryLock(10000)` menyerah di detik ke-10.
     *
     * Menunggu 21 detik dengan tirai yang jelas jauh lebih baik
     * daripada gagal di detik ke-10 dan kehilangan pekerjaan.
     *
     * Aman terhadap batas eksekusi 360 detik: 45 detik menunggu +
     * beberapa detik bekerja masih jauh di bawahnya. */
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(45000)) throw new Error('SISTEM_SIBUK');
    _dalamKunci = 1;
    try { return fn(); }
    finally { _dalamKunci = 0; lock.releaseLock(); }
  }

  return {
    idDb: idDb, ss: ss, sheet: sheet, header: header,
    baca: baca, cari: cari, saring: saring,
    bacaKolom: bacaKolom, saringKolom: saringKolom,
    saringBaris: saringBaris, saringBarisBanyak: saringBarisBanyak,
    bacaBarisJika: bacaBarisJika,
    cariBarisCache: cariBarisCache, cariBarisCache2: cariBarisCache2,
    cariBarisBanyak2: cariBarisBanyak2,
    titipBaris2: titipBaris2,
    cariCepat: cariCepat, cariCepat2: cariCepat2,
    tambah: tambah, perbarui: perbarui, perbaruiBanyak: perbaruiBanyak,
    hapus: hapus, hapusBanyak: hapusBanyak,
    kosongkanSheet: kosongkanSheet, simpan: simpan,
    invalidasi: invalidasi, invalidasiSemua: invalidasiSemua,
    invalidasiHeader: invalidasiHeader,
    denganKunci: denganKunci,
    epochProgres: epochProgres, tulisProgres: tulisProgres,
    mulaiProgresMurid: mulaiProgresMurid,
    selesaiProgresMurid: selesaiProgresMurid,
    lupakanMemo: function (nama) {
      if (nama) delete _memo[nama]; else _memo = {};
    }
  };
})();
