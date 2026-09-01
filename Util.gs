/**
 * LessonLen v2 — Util.gs
 * ID, hash, waktu, sanitasi. Tanpa ketergantungan modul lain.
 */

var Util = (function () {

  var HURUF = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  function kosong(v) {
    return v === null || v === undefined || String(v).trim() === '';
  }

  function sekarang() {
    return Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
  }

  function parseWaktu(s) {
    if (!s) return null;
    if (s instanceof Date) {
      var t = s.getTime();
      return isNaN(t) ? null : t;
    }
    var m = String(s).trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return null;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]),
                     Number(m[4]), Number(m[5]), Number(m[6] || 0));
    var ms = d.getTime();
    return isNaN(ms) ? null : ms;
  }

  function buatId(prefix) {
    var P = PropertiesService.getScriptProperties();
    var k = 'CTR_' + prefix;
    var n = Number(P.getProperty(k) || 0) + 1;
    P.setProperty(k, String(n));
    return prefix + '-' + ('0000' + n).slice(-4);
  }

  function buatSalt() {
    var s = '';
    for (var i = 0; i < 16; i++) s += HURUF.charAt(Math.floor(Math.random() * HURUF.length));
    return s;
  }

  function buatToken() {
    var s = '';
    for (var i = 0; i < 32; i++) s += HURUF.charAt(Math.floor(Math.random() * HURUF.length));
    return s;
  }

  function hashPassword(password, salt) {
    return Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256, salt + password, Utilities.Charset.UTF_8)
      .map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); })
      .join('');
  }

  function passwordSementara() {
    var s = '';
    for (var i = 0; i < 8; i++) s += HURUF.charAt(Math.floor(Math.random() * HURUF.length));
    return s;
  }

  function periksaPassword(p) {
    p = String(p || '');
    if (p.length < 6) return 'Kata sandi minimal 6 karakter.';
    if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) {
      return 'Kata sandi harus memuat huruf dan angka.';
    }
    return '';
  }

  function normalisasiUsername(u) {
    return String(u || '').trim().toLowerCase();
  }

  function sanitasi(html) {
    var s = String(html || '');
    s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    s = s.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '');
    s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    s = s.replace(/javascript:/gi, '');
    return s;
  }

  function ya(v) {
    return v === true || v === 'TRUE' || v === 'true' || v === 1 || v === '1';
  }

  function err(kode, pesan) {
    var e = new Error(pesan);
    e.kode = kode;
    return e;
  }

  function catatLog(userId, aksi, detail, status) {
    try {
      Db.tambah('log', {
        log_id: buatId('LOG'),
        user_id: userId || '',
        aksi: aksi || '',
        detail: String(detail || '').slice(0, 500),
        status: status || 'ok',
        timestamp: sekarang()
      });
    } catch (e) { /* log tidak boleh merusak alur utama */ }
  }

  return {
    kosong: kosong, sekarang: sekarang, parseWaktu: parseWaktu,
    buatId: buatId, buatSalt: buatSalt, buatToken: buatToken,
    hashPassword: hashPassword, passwordSementara: passwordSementara,
    periksaPassword: periksaPassword, normalisasiUsername: normalisasiUsername,
    sanitasi: sanitasi, ya: ya, err: err, catatLog: catatLog
  };
})();
