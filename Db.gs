/**
 * LessonLen v2 — Db.gs
 * Akses Sheets + cache. Kunci HANYA saat menambah baris baru.
 */

var Db = (function () {

  var TANPA_CACHE = ['progress', 'quiz_attempt', 'lkpd_submission', 'session', 'log'];
  var TTL = 21600;
  var _ss = null;
  var _memo = {};
  var _dalamKunci = 0;

  function idDb() {
    var id = PropertiesService.getScriptProperties().getProperty('DB_ID');
    if (!id) throw new Error('DB_ID belum diset. Jalankan setupLengkap() dulu.');
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

  function header(nama) {
    var m = (_memo[nama] = _memo[nama] || {});
    if (m.__head) return m.__head;
    var sh = sheet(nama);
    m.__head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    return m.__head;
  }

  function baca(nama) {
    var pakai = TANPA_CACHE.indexOf(nama) === -1;
    if (pakai) {
      try {
        var c = CacheService.getScriptCache().get('sh_' + nama);
        if (c) return JSON.parse(c);
      } catch (e) {}
    }
    var nilai = sheet(nama).getDataRange().getValues();
    if (nilai.length < 2) return [];
    var head = nilai[0];
    var hasil = [];
    for (var i = 1; i < nilai.length; i++) {
      var baris = nilai[i];
      var kosong = true;
      for (var k = 0; k < baris.length; k++) {
        if (baris[k] !== '' && baris[k] !== null) { kosong = false; break; }
      }
      if (kosong) continue;
      var o = { _baris: i + 1 };
      for (var j = 0; j < head.length; j++) o[head[j]] = _aman(baris[j]);
      hasil.push(o);
    }
    if (pakai) {
      try {
        var teks = JSON.stringify(hasil);
        if (teks.length < 95000) CacheService.getScriptCache().put('sh_' + nama, teks, TTL);
      } catch (e) {}
    }
    return hasil;
  }

  function cari(nama, kolom, nilai) {
    var data = baca(nama);
    for (var i = 0; i < data.length; i++) {
      if (data[i][kolom] === nilai) return data[i];
    }
    return null;
  }

  function saring(nama, kriteria) {
    return baca(nama).filter(function (r) {
      for (var k in kriteria) { if (r[k] !== kriteria[k]) return false; }
      return true;
    });
  }

  function invalidasi(nama) {
    var head = _memo[nama] && _memo[nama].__head;
    delete _memo[nama];
    if (head) _memo[nama] = { __head: head };
    try { CacheService.getScriptCache().remove('sh_' + nama); } catch (e) {}
  }

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

  function tambah(nama, objAtauArr) {
    var arr = Array.isArray(objAtauArr) ? objAtauArr : [objAtauArr];
    if (!arr.length) return 0;
    var head = header(nama);
    var baris = arr.map(function (o) {
      return head.map(function (h) {
        return (o[h] === undefined || o[h] === null) ? '' : o[h];
      });
    });
    denganKunci(function () {
      var sh = sheet(nama);
      sh.getRange(sh.getLastRow() + 1, 1, baris.length, head.length).setValues(baris);
    });
    invalidasi(nama);
    return baris.length;
  }

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

  function hapus(nama, nomorBaris) {
    sheet(nama).deleteRow(nomorBaris);
    invalidasi(nama);
  }

  function hapusBanyak(nama, daftarBaris) {
    if (!daftarBaris.length) return 0;
    var sh = sheet(nama);
    daftarBaris.slice().sort(function (a, b) { return b - a; })
      .forEach(function (n) { sh.deleteRow(n); });
    invalidasi(nama);
    return daftarBaris.length;
  }

  return {
    idDb: idDb, ss: ss, sheet: sheet, header: header,
    baca: baca, cari: cari, saring: saring,
    tambah: tambah, perbarui: perbarui, hapus: hapus, hapusBanyak: hapusBanyak,
    invalidasi: invalidasi, denganKunci: denganKunci
  };
})();
