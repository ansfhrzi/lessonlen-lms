/**
 * ============================================================
 *  LMS v2 — Db.gs
 *  Lapisan akses Google Sheets + cache + LockService
 *  Port dari LessonLen v1, disesuaikan nama sheet v2 (23 sheet)
 * ------------------------------------------------------------
 *  ATURAN MENGIKUTI (DOKUMENTASI_RANCANGAN_LMS_GAS_v2.md §12.3):
 *   1. Selalu Db.baca()/bacaKolom(). Hindari getRange() berulang.
 *   2. Setiap tulis WAJIB diikuti invalidasi cache (otomatis di sini).
 *   3. Penyaringan di memory (.filter()), bukan TextFinder.
 *   4. Sheet bervolume tinggi tidak di-cache.
 *   5. Operasi tulis rawan tabrakan dibungkus Db.denganKunci().
 * ============================================================
 */

var Db = (function () {

  /* sheet yang TIDAK di-cache — terlalu besar / terlalu sering berubah */
  var TANPA_CACHE = ['Progress', 'Quiz_Submissions', 'Submissions',
                     'Session', 'Audit_Logs', 'Notifications', 'Materi_AI'];

  var TTL_CACHE  = 21600;        /* 6 jam */
  var BATAS_CACHE = 95000;       /* CacheService maks ~100 KB per entri */

  var _ss = null;
  var _memo = {};                /* memo seumur satu eksekusi */

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

  function header(nama) {
    var m = (_memo[nama] = _memo[nama] || {});
    if (m.__head) return m.__head;
    var sh = sheet(nama);
    m.__head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    return m.__head;
  }

  /* -------------------------------------------------- baca */

  /**
   * Baca seluruh sheet sebagai array objek.
   * Tiap objek memuat _baris = nomor baris asli (untuk update/hapus).
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
   * Ubah nilai satu sel menjadi bentuk yang aman dikirim ke browser.
   * Date dinormalkan menjadi string — Date rusak menghasilkan ''.
   */
  function _aman(v) {
    if (v instanceof Date) {
      var t = v.getTime();
      if (isNaN(t)) return '';
      try {
        return Utilities.formatDate(v, 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
      } catch (e) { return ''; }
    }
    return v;
  }

  /**
   * Baca HANYA sebagian kolom — hemat untuk sheet besar.
   * @returns {Array<Object>} tanpa _baris (bukan untuk update)
   */
  function bacaKolom(nama, kolom) {
    var kunciMemo = 'bk_' + nama + '|' + kolom.slice().sort().join(',');
    if (_memo[nama] && _memo[nama][kunciMemo]) return _memo[nama][kunciMemo];
    var hasil = _bacaKolom(nama, kolom);
    (_memo[nama] = _memo[nama] || {})[kunciMemo] = hasil;
    return hasil;
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

    /* kelompokkan indeks berdekatan menjadi rentang sempit */
    var rentang = [], mulai = idx[0], akhir = idx[0];
    for (var n = 1; n < idx.length; n++) {
      if (idx[n] - akhir <= 2) { akhir = idx[n]; }
      else { rentang.push([mulai, akhir]); mulai = akhir = idx[n]; }
    }
    rentang.push([mulai, akhir]);

    var tinggi = lastRow - 1;
    var blok = rentang.map(function (r) {
      return sh.getRange(2, r[0] + 1, tinggi, r[1] - r[0] + 1).getValues();
    });

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

    /* penanda baris terisi = primary key (kolom pertama sheet) */
    var pk = head[0];
    var kolomId = peta[pk] !== undefined ? pk : null;

    var hasil = [];
    for (var r = 0; r < tinggi; r++) {
      var o = {};
      for (var k in peta) o[k] = _aman(blok[peta[k][0]][r][peta[k][1]]);

      if (kolomId) {
        if (o[kolomId] === '' || o[kolomId] === null) continue;
      } else {
        var adaIsi = false;
        for (var k2 in peta) {
          if (o[k2] !== '' && o[k2] !== null && o[k2] !== undefined) { adaIsi = true; break; }
        }
        if (!adaIsi) continue;
      }
      hasil.push(o);
    }
    return hasil;
  }

  /** Saring berdasarkan SATU kolom kunci tanpa memindahkan seluruh sheet. */
  function saringBaris(nama, kolomKunci, nilai, kolom) {
    var BATAS_RENTANG = 12;
    var JEDA_GABUNG = 20;

    var sh = sheet(nama);
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return [];

    var head = header(nama);
    var idxKunci = head.indexOf(kolomKunci);
    if (idxKunci < 0) return [];

    var kunci = sh.getRange(2, idxKunci + 1, lastRow - 1, 1).getValues();
    var cocok = [];
    for (var i = 0; i < kunci.length; i++) {
      if (kunci[i][0] === nilai) cocok.push(i + 2);
    }
    if (!cocok.length) return [];

    return _ambilBaris(sh, head, cocok, kolomKunci, idxKunci, kolom,
                       BATAS_RENTANG, JEDA_GABUNG);
  }

  /** Ambil isi baris pada nomor-nomor tertentu, digabung jadi rentang. */
  function _ambilBaris(sh, head, cocok, kolomKunci, idxKunci, kolom,
                       batasRentang, jedaGabung) {
    var runs = [], awal = cocok[0], akhir = cocok[0];
    for (var n = 1; n < cocok.length; n++) {
      if (cocok[n] - akhir <= jedaGabung) akhir = cocok[n];
      else { runs.push([awal, akhir]); awal = akhir = cocok[n]; }
    }
    runs.push([awal, akhir]);

    if (runs.length > batasRentang) {
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

  /** Cari satu baris TANPA memindahkan seluruh sheet. */
  function cariCepat(nama, kolomKunci, nilai) {
    var sh = sheet(nama);
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return null;

    var head = header(nama);
    var idx = head.indexOf(kolomKunci);
    if (idx < 0) return null;

    var kunci = sh.getRange(2, idx + 1, lastRow - 1, 1).getValues();
    var target = -1;
    for (var i = 0; i < kunci.length; i++) {
      if (kunci[i][0] === nilai) { target = i + 2; break; }
    }
    if (target < 0) return null;

    var baris = sh.getRange(target, 1, 1, head.length).getValues()[0];
    var o = { _baris: target };
    for (var j = 0; j < head.length; j++) o[head[j]] = _aman(baris[j]);
    return o;
  }

  /** Cari baris yang cocok pada DUA kolom sekaligus. */
  function cariCepat2(nama, kol1, nil1, kol2, nil2) {
    var sh = sheet(nama);
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return null;

    var head = header(nama);
    var i1 = head.indexOf(kol1), i2 = head.indexOf(kol2);
    if (i1 < 0 || i2 < 0) return null;

    var kolom1 = sh.getRange(2, i1 + 1, lastRow - 1, 1).getValues();
    var kandidat = [];
    for (var i = 0; i < kolom1.length; i++) {
      if (kolom1[i][0] === nil1) kandidat.push(i + 2);
    }
    if (!kandidat.length) return null;

    var target = -1;
    if (kandidat.length <= 8) {
      for (var c = 0; c < kandidat.length; c++) {
        var v = sh.getRange(kandidat[c], i2 + 1, 1, 1).getValues()[0][0];
        if (v === nil2) { target = kandidat[c]; break; }
      }
    } else {
      var awal = kandidat[0], ujung = kandidat[kandidat.length - 1];
      var blok2 = sh.getRange(awal, i2 + 1, ujung - awal + 1, 1).getValues();
      for (var d = 0; d < kandidat.length; d++) {
        if (blok2[kandidat[d] - awal][0] === nil2) { target = kandidat[d]; break; }
      }
    }
    if (target < 0) return null;

    var baris = sh.getRange(target, 1, 1, head.length).getValues()[0];
    var o = { _baris: target };
    for (var j = 0; j < head.length; j++) o[head[j]] = _aman(baris[j]);
    return o;
  }

  /** Cari satu baris berdasarkan kolom = nilai (lewat baca penuh). */
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

    /* getLastRow()+1 adalah satu-satunya titik rebutan antar user —
       karena itu kunci diambil di sini, sesingkat mungkin. */
    denganKunci(function () {
      var sh = sheet(nama);
      sh.getRange(sh.getLastRow() + 1, 1, baris.length, head.length)
        .setValues(baris);
    });

    invalidasi(nama);
    return baris.length;
  }

  /** Perbarui sebagian kolom pada satu baris. */
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
   * Baris berdekatan ditulis satu blok; baris tercebar ditulis per baris.
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

    /* blok jauh lebih besar daripada baris yang diubah → per baris */
    if (tinggi > items.length * 4 && tinggi > 50) {
      items.forEach(function (it) { perbarui(nama, it._baris, it); });
      return;
    }

    var blok = sh.getRange(min, 1, tinggi, head.length).getValues();
    items.forEach(function (it) {
      var idx = it._baris - min;
      for (var i = 0; i < head.length; i++) {
        if (it[head[i]] !== undefined) blok[idx][i] = it[head[i]];
      }
    });
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

  /** Kosongkan SELURUH isi sheet, header tetap. */
  function kosongkanSheet(nama) {
    var sh = sheet(nama);
    var akhir = sh.getLastRow();
    if (akhir < 2) return 0;
    sh.deleteRows(2, akhir - 1);
    invalidasi(nama);
    return akhir - 1;
  }

  /** Simpan: perbarui bila kunci cocok, tambah bila belum ada. */
  function simpan(nama, kolomKunci, obj) {
    var ada = cari(nama, kolomKunci, obj[kolomKunci]);
    if (ada) { perbarui(nama, ada._baris, obj); return 'perbarui'; }
    tambah(nama, obj);
    return 'tambah';
  }

  /* -------------------------------------------------- cache */

  function invalidasi(nama) {
    /* header TIDAK ikut dibuang — hanya berubah saat migrasiStruktur() */
    var head = _memo[nama] && _memo[nama].__head;
    delete _memo[nama];
    if (head) _memo[nama] = { __head: head };
    try {
      CacheService.getScriptCache().remove('sh_' + nama);
      if (nama === 'Users') CacheService.getScriptCache().remove('id_guru');
    } catch (e) {}
  }

  /**
   * Buang memo header — WAJIB dipanggil setelah migrasiStruktur().
   * Tanpa ini Db memakai susunan kolom LAMA dan membuang kolom baru diam-diam.
   */
  function invalidasiHeader() {
    Object.keys(_memo).forEach(function (n) {
      if (_memo[n]) delete _memo[n].__head;
    });
  }

  function invalidasiSemua() {
    _memo = {};
  }

  /* -------------------------------------------------- kunci */

  /* Kedalaman kunci dalam SATU eksekusi — mencegah kunci dilepas terlalu
     awal ketika Db.tambah() dipanggil dari dalam blok yang sudah berkunci. */
  var _dalamKunci = 0;

  /**
   * Bungkus operasi tulis yang rawan tabrakan.
   * LockService hanya ada SATU untuk seluruh aplikasi — pakai selektif.
   * Melempar Error('SISTEM_SIBUK') bila kunci tidak didapat dalam 45 detik.
   */
  function denganKunci(fn) {
    if (_dalamKunci > 0) {
      _dalamKunci++;
      try { return fn(); } finally { _dalamKunci--; }
    }

    var lock = LockService.getScriptLock();
    if (!lock.tryLock(45000)) throw new Error('SISTEM_SIBUK');
    _dalamKunci = 1;
    try { return fn(); }
    finally { _dalamKunci = 0; lock.releaseLock(); }
  }

  return {
    idDb: idDb, ss: ss, sheet: sheet, header: header,
    baca: baca, cari: cari, saring: saring,
    bacaKolom: bacaKolom,
    saringBaris: saringBaris,
    cariCepat: cariCepat, cariCepat2: cariCepat2,
    tambah: tambah, perbarui: perbarui, perbaruiBanyak: perbaruiBanyak,
    hapus: hapus, hapusBanyak: hapusBanyak,
    kosongkanSheet: kosongkanSheet, simpan: simpan,
    invalidasi: invalidasi, invalidasiSemua: invalidasiSemua,
    invalidasiHeader: invalidasiHeader,
    denganKunci: denganKunci,
    lupakanMemo: function (nama) {
      if (nama) delete _memo[nama]; else _memo = {};
    }
  };
})();
