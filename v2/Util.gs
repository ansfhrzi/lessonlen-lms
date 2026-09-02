/**
 * ============================================================
 *  LMS v2 — Util.gs
 *  Fungsi bantu: ID (sheet Counters), hash kata sandi, tanggal,
 *  sanitasi, validasi, audit log
 * ------------------------------------------------------------
 *  Perbedaan dari v1: generator ID memakai sheet Counters dengan
 *  LockService (rancangan v2 §7.21), bukan Script Properties.
 * ============================================================
 */

var Util = (function () {

  var PREFIX_SAH = ['USR','KLS','SBK','TA','ENR','TPC','ITM','PRG',
                    'QIZ','QQA','QSB','ASG','KLP','KLM','SBM',
                    'GRD','RFL','NTF','AIG','RST','LOG'];

  /* -------------------------------------------------- ID */

  /**
   * Buat ID berurutan dari sheet Counters, mis. buatId('USR') → 'USR-0001'.
   *
   * Seluruh operasi baca-tulis counter berada di dalam Db.denganKunci()
   * sehingga dua eksekusi bersamaan tidak menghasilkan ID sama
   * (rancangan v2 §7.21: lock + update counter atomik).
   */
  function buatId(prefix) {
    if (PREFIX_SAH.indexOf(prefix) === -1) {
      throw new Error('Prefix ID tidak dikenal: ' + prefix);
    }
    return Db.denganKunci(function () {
      var sh = Db.sheet('Counters');
      var head = Db.header('Counters');
      var iEnt = head.indexOf('entity');
      var iNum = head.indexOf('last_number');
      if (iEnt < 0 || iNum < 0) {
        throw new Error('Sheet Counters tidak berformat entity/last_number.');
      }

      var lastRow = sh.getLastRow();
      var n = 0;
      var baris = -1;
      if (lastRow >= 2) {
        var vals = sh.getRange(2, iEnt + 1, lastRow - 1, 1).getValues();
        for (var i = 0; i < vals.length; i++) {
          if (vals[i][0] === prefix) { baris = i + 2; break; }
        }
        if (baris > 0) {
          n = Number(sh.getRange(baris, iNum + 1).getValue()) || 0;
        }
      }

      n++;
      if (baris > 0) {
        sh.getRange(baris, iNum + 1).setValue(n);
      } else {
        sh.getRange(sh.getLastRow() + 1, iEnt + 1, 1, 2).setValues([[prefix, n]]);
      }
      Db.invalidasi('Counters');
      return prefix + '-' + ('0000' + n).slice(-4);
    });
  }

  /** Token sesi acak 32+ karakter. */
  function buatToken() {
    return Utilities.getUuid().replace(/-/g, '') +
           Math.random().toString(36).slice(2, 8);
  }

  /* -------------------------------------------------- kata sandi */

  function buatSalt() {
    var c = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var s = '';
    for (var i = 0; i < 16; i++) s += c.charAt(Math.floor(Math.random() * c.length));
    return s;
  }

  function hashPassword(password, salt) {
    return Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256, salt + password, Utilities.Charset.UTF_8)
      .map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); })
      .join('');
  }

  /** Kata sandi sementara 8 karakter tanpa karakter ambigu (0 O 1 I L). */
  function passwordSementara() {
    var c = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    var s = '';
    for (var i = 0; i < 8; i++) s += c.charAt(Math.floor(Math.random() * c.length));
    return s;
  }

  /**
   * Periksa kekuatan kata sandi baru.
   * @returns {string|null} pesan kesalahan, atau null bila lolos
   */
  function periksaPassword(p) {
    if (!p || p.length < 6) return 'Kata sandi minimal 6 karakter.';
    if (p.length > 64)      return 'Kata sandi maksimal 64 karakter.';
    if (!/[a-zA-Z]/.test(p)) return 'Kata sandi harus memuat huruf.';
    if (!/[0-9]/.test(p))    return 'Kata sandi harus memuat angka.';
    return null;
  }

  /* -------------------------------------------------- teks & waktu */

  function normalisasiUsername(u) {
    return String(u || '').trim().toLowerCase().replace(/\s+/g, '');
  }

  /** Rapikan nomor WhatsApp menjadi bentuk baku 62xxxxxxxxxx. */
  function normalisasiWa(v) {
    var s = String(v || '').replace(/[^0-9]/g, '');
    if (!s) return '';

    if (s.indexOf('62') === 0)      s = s;
    else if (s.indexOf('0') === 0)  s = '62' + s.slice(1);
    else if (s.indexOf('8') === 0)  s = '62' + s;
    else return '';

    if (s.length < 11 || s.length > 15) return '';
    if (s.charAt(2) !== '8') return '';
    return s;
  }

  /** Alamat surel masuk akal atau tidak (anti salah ketik yang jelas). */
  function emailSah(v) {
    var s = String(v || '').trim();
    if (!s || s.length > 100) return false;
    if (/\s/.test(s)) return false;
    return /^[^@]+@[^@]+\.[^@.]+$/.test(s);
  }

  /** NISN — angka saja 4–20 digit, boleh kosong. */
  function nisnSah(v) {
    var s = String(v || '').trim();
    if (!s) return true;
    return /^[0-9]{4,20}$/.test(s);
  }

  /** Tanggal lahir — terima YYYY-MM-DD atau DD/MM/YYYY; kembalikan
      bentuk baku YYYY-MM-DD, atau '' bila tidak sah. */
  function tglLahirSah(v) {
    var s = String(v || '').trim();
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!m) {
      m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m) m = [s, m[3], m[2], m[1]];
    }
    if (!m) return '';
    var t = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (t.getFullYear() !== Number(m[1]) || t.getMonth() !== Number(m[2]) - 1 ||
        t.getDate() !== Number(m[3])) return '';
    if (Number(m[1]) < 1900 || new Date(t.getTime() + 365 * 864e5) > new Date()) {
      return '';   /* tak masuk akal: <1900 atau lahir di masa depan */
    }
    return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  }

  /** Biodata murid lengkap = email sah + no WA + tanggal lahir.
      NISN OPSIONAL (keputusan 2026-09-02) — tidak dihitung. */
  function biodataLengkap(u) {
    if (!u) return false;
    return emailSah(u.email) && !!normalisasiWa(u.no_wa) &&
           !!tglLahirSah(u.tanggal_lahir);
  }

  function sekarang() { return new Date(); }

  function tambahJam(tgl, jam) {
    return new Date(tgl.getTime() + jam * 3600000);
  }

  function lewat(tgl) {
    if (!tgl) return true;
    return new Date(tgl).getTime() < Date.now();
  }

  function formatTanggal(tgl) {
    if (!tgl) return '';
    return Utilities.formatDate(new Date(tgl), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
  }

  /* -------------------------------------------------- sanitasi HTML */

  var TAG_IZIN = ['h2','h3','h4','p','br','hr','ul','ol','li','b','i','u',
    'strong','em','table','thead','tbody','tr','th','td','img','a','code',
    'pre','blockquote','iframe','span','div'];

  var IFRAME_IZIN = ['youtube.com','youtube-nocookie.com',
                     'docs.google.com','drive.google.com'];

  function _iframeSah(src) {
    var u = String(src || '').trim();
    var m = /^https:\/\/([^\/?#:]+)/i.exec(u);
    if (!m) return false;

    var host = m[1].toLowerCase();
    return IFRAME_IZIN.some(function (d) {
      return host === d || host.slice(-(d.length + 1)) === '.' + d;
    });
  }

  /** Bersihkan HTML sebelum disimpan (sama seperti v1). */
  function sanitasi(html) {
    if (!html) return '';
    var s = String(html);

    s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
    s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
    s = s.replace(/<!--(?!bagian-->)[\s\S]*?-->/g, '');
    s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    s = s.replace(/(href|src)\s*=\s*("|')?\s*javascript:[^"'>]*/gi, '$1="#"');

    s = s.replace(/<iframe([^>]*)>/gi, function (m, attr) {
      var src = (attr.match(/src\s*=\s*["']([^"']+)["']/i) || [])[1] || '';
      return _iframeSah(src) ? m : '';
    });

    s = s.replace(/<(\/?)([a-zA-Z0-9]+)([^>]*)>/g, function (m, tutup, tag) {
      return TAG_IZIN.indexOf(tag.toLowerCase()) === -1 ? '' : m;
    });

    return s;
  }

  /** Escape teks biasa agar aman ditampilkan sebagai HTML. */
  function escapeHtml(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* -------------------------------------------------- validasi */

  function urlSah(u) {
    return /^https?:\/\/[^\s]+\.[^\s]+/i.test(String(u || '').trim());
  }

  function kosong(v) {
    return v === undefined || v === null || String(v).trim() === '';
  }

  /* -------------------------------------------------- pembaruan parsial */

  /**
   * Salin nilai dari sumber ke target HANYA bila kolomnya dikirim —
   * mencegah edit parsial mengosongkan kolom lain.
   */
  function isiBilaAda(target, sumber, aturan) {
    Object.keys(aturan).forEach(function (kol) {
      if (sumber[kol] === undefined) return;
      var f = aturan[kol];
      target[kol] = typeof f === 'function' ? f(sumber[kol]) : sumber[kol];
    });
    return target;
  }

  function teks(maks) {
    return function (v) { return String(v == null ? '' : v).trim().slice(0, maks); };
  }
  function angka(bawaan) {
    return function (v) {
      var n = Number(v);
      return isNaN(n) ? (bawaan || 0) : n;
    };
  }
  function boolean(v) { return v === true || v === 'true' || v === 'TRUE'; }

  /* -------------------------------------------------- audit log */

  /**
   * Catat aktivitas penting ke sheet Audit_Logs.
   * Log gagal tidak boleh menggagalkan operasi utama.
   */
  function catatLog(userId, aksi, detail, status, role, entitas, entitasId) {
    try {
      Db.tambah('Audit_Logs', {
        log_id: buatId('LOG'),
        user_id: userId || '',
        role: role || '',
        action: aksi || '',
        entity: entitas || '',
        entity_id: entitasId || '',
        detail: typeof detail === 'string' ? detail.slice(0, 1000)
                                             : JSON.stringify(detail).slice(0, 1000),
        status: status || 'ok',
        timestamp: sekarang()
      });
    } catch (e) { /* jangan gagalkan operasi utama */ }
  }

  return {
    buatId: buatId, buatToken: buatToken,
    buatSalt: buatSalt, hashPassword: hashPassword,
    passwordSementara: passwordSementara, periksaPassword: periksaPassword,
    normalisasiUsername: normalisasiUsername,
    normalisasiWa: normalisasiWa, emailSah: emailSah,
    nisnSah: nisnSah, tglLahirSah: tglLahirSah, biodataLengkap: biodataLengkap,
    sekarang: sekarang, tambahJam: tambahJam, lewat: lewat,
    formatTanggal: formatTanggal,
    sanitasi: sanitasi, escapeHtml: escapeHtml,
    urlSah: urlSah, kosong: kosong,
    isiBilaAda: isiBilaAda, teks: teks, angka: angka, boolean: boolean,
    catatLog: catatLog
  };
})();
