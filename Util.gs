/**
 * ============================================================
 *  LessonLen — Util.gs
 *  Fungsi bantu: ID, hash, tanggal, sanitasi, acak, log
 * ============================================================
 */

var Util = (function () {

  var PREFIX_SAH = ['USR','KLS','ENR','MP','PTM','ITM','PRG','SOL','ATT',
                    'LKP','AI','NTF','RST','LOG',
                    'GRP',    /* kelompok soal berbagi satu teks bacaan */
                    'KLP'];   /* kelompok kerja tugas kelompok (v1.7.0) */

  /* -------------------------------------------------- ID */

  /** Buat ID berurutan, mis. buatId('USR') → 'USR-0001'. */
  function buatId(prefix) {
    if (PREFIX_SAH.indexOf(prefix) === -1) {
      throw new Error('Prefix ID tidak dikenal: ' + prefix);
    }
    var P = PropertiesService.getScriptProperties();
    var k = 'CTR_' + prefix;
    var n = Number(P.getProperty(k) || 0) + 1;
    P.setProperty(k, String(n));
    return prefix + '-' + ('0000' + n).slice(-4);
  }

  /** Token sesi acak 32 karakter. */
  function buatToken() {
    return Utilities.getUuid().replace(/-/g, '') +
           Math.random().toString(36).slice(2, 8);
  }

  /* -------------------------------------------------- password */

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

  /** Password sementara 8 karakter tanpa karakter ambigu (0 O 1 I L). */
  function passwordSementara() {
    /* tanpa 0 O 1 I L — mudah tertukar saat didiktekan */
    var c = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    var s = '';
    for (var i = 0; i < 8; i++) s += c.charAt(Math.floor(Math.random() * c.length));
    return s;
  }

  /**
   * Periksa kekuatan password baru.
   * @returns {string|null} pesan kesalahan, atau null bila lolos
   */
  function periksaPassword(p) {
    if (!p || p.length < 6) return 'Password minimal 6 karakter.';
    if (p.length > 64)      return 'Password maksimal 64 karakter.';
    if (!/[a-zA-Z]/.test(p)) return 'Password harus memuat huruf.';
    if (!/[0-9]/.test(p))    return 'Password harus memuat angka.';
    return null;
  }

  /* -------------------------------------------------- teks & waktu */

  function normalisasiUsername(u) {
    return String(u || '').trim().toLowerCase().replace(/\s+/g, '');
  }

  /* ==================================================== BIODATA
   *  v1.10.0 — dipakai layar Lengkapi Biodata & Kelola Murid.
   * ============================================================ */

  /**
   * Rapikan nomor WhatsApp menjadi bentuk baku `62xxxxxxxxxx`.
   *
   * Murid boleh mengetik apa saja: `0812-3456-7890`, `+62 812 3456`,
   * `(62)8123456`. Yang disimpan selalu satu bentuk, supaya guru bisa
   * langsung memakainya sebagai tautan `wa.me` tanpa membersihkan
   * apa pun.
   *
   * Nomor Indonesia SELALU diawali 8 setelah kode negara. Karena itu:
   *   0812…  → 62812…      (0 di depan diganti kode negara)
   *   812…   → 62812…      (murid lupa nolnya)
   *   62812… → tetap
   *
   * @returns {string} nomor baku, atau '' bila tidak masuk akal
   */
  function normalisasiWa(v) {
    var s = String(v || '').replace(/[^0-9]/g, '');
    if (!s) return '';

    if (s.indexOf('62') === 0)      s = s;
    else if (s.indexOf('0') === 0)  s = '62' + s.slice(1);
    else if (s.indexOf('8') === 0)  s = '62' + s;
    else return '';                 /* bukan nomor Indonesia */

    /* 62 + 9..13 digit. Nomor terpendek di Indonesia 62 + 9 digit,
       terpanjang 62 + 12. Diberi kelonggaran satu digit. */
    if (s.length < 11 || s.length > 15) return '';
    if (s.charAt(2) !== '8') return '';   /* wajib 8 setelah 62 */
    return s;
  }

  /**
   * Alamat surel masuk akal atau tidak.
   *
   * Sengaja TIDAK memakai regex RFC yang panjang: yang dicegah di sini
   * adalah salah ketik yang jelas, bukan alamat eksotis. Wajib ada
   * satu `@`, ada titik SESUDAH `@`, dan tidak ada spasi.
   */
  function emailSah(v) {
    var s = String(v || '').trim();
    if (!s || s.length > 100) return false;
    if (/\s/.test(s)) return false;
    return /^[^@]+@[^@]+\.[^@.]+$/.test(s);
  }

  /**
   * NISN — angka saja, 4–20 digit. BOLEH KOSONG.
   *
   * Sebagian murid NISN-nya belum terbit saat aplikasi dipakai
   * (keputusan guru: "email & WA ketat, NISN longgar"). Karena itu
   * kosong dianggap sah, dan panjangnya tidak dipaku 10 digit.
   */
  function nisnSah(v) {
    var s = String(v || '').trim();
    if (!s) return true;                       /* kosong = sah */
    return /^[0-9]{4,20}$/.test(s);
  }

  /**
   * Biodata seorang murid sudah lengkap atau belum.
   *
   * SATU-SATUNYA sumber kebenaran untuk pertanyaan ini — dipakai
   * Auth (saat login), Beranda (spanduk), dan Kelas (ekspor). Bila
   * tiap tempat menghitungnya sendiri, ketiganya pasti berbeda suatu
   * saat.
   *
   * NISN TIDAK ikut menentukan, sebab boleh kosong.
   */
  function biodataLengkap(u) {
    if (!u) return false;
    return emailSah(u.email) && !!normalisasiWa(u.no_wa);
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

  /**
   * Apakah `src` iframe benar-benar dari domain yang diizinkan.
   *
   * 🔴 BUG v1.9.8 — versi lama memakai `src.indexOf(domain) !== -1`,
   * sehingga alamat berikut LOLOS:
   *
   *     https://youtube.com.jahat.id/x      domain lain, kata cocok
   *     https://jahat.id/?a=youtube.com     hanya di parameter
   *
   * Penyerang cukup menyisipkan nama domain izin di mana saja pada
   * alamatnya. Yang diperiksa sekarang adalah HOST-nya sungguhan:
   * sama persis, atau subdomain sah (`www.youtube.com`).
   *
   * Wajib `https://` — `http://` diblokir peramban di halaman aman,
   * dan menerima skema lain membuka jalan `javascript:`.
   */
  function _iframeSah(src) {
    var u = String(src || '').trim();
    var m = /^https:\/\/([^\/?#:]+)/i.exec(u);
    if (!m) return false;

    var host = m[1].toLowerCase();
    return IFRAME_IZIN.some(function (d) {
      return host === d || host.slice(-(d.length + 1)) === '.' + d;
    });
  }

  /**
   * Bersihkan HTML sebelum disimpan.
   * Menyisakan $ \( \) \[ \] agar MathJax tetap bekerja.
   */
  function sanitasi(html) {
    if (!html) return '';
    var s = String(html);

    s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
    s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
    s = s.replace(/<!--(?!bagian-->)[\s\S]*?-->/g, '');      /* sisakan <!--bagian--> */
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

  /** Hitung jumlah bagian materi dari pemisah <!--bagian-->. */
  function hitungBagian(konten) {
    if (!konten) return 0;
    return String(konten).split('<!--bagian-->').length;
  }

  /** Ambil satu bagian materi (1-based). */
  function ambilBagian(konten, ke) {
    var arr = String(konten || '').split('<!--bagian-->');
    return arr[ke - 1] || '';
  }

  /**
   * SELURUH bagian materi sekaligus (v1.16.0).
   *
   * Dipakai `bukaMateri` supaya murid dapat berpindah bagian tanpa
   * memanggil server lagi. Kontennya toh sudah terbaca utuh dari
   * sheet, jadi ini nol biaya tambahan di sisi server.
   *
   * Selalu mengembalikan minimal satu bagian — materi kosong pun
   * harus punya sesuatu untuk digambar, kalau tidak layarnya
   * mengira datanya rusak.
   */
  function semuaBagian(konten) {
    var arr = String(konten || '').split('<!--bagian-->');
    return arr.length ? arr : [''];
  }

  /* -------------------------------------------------- acak berbenih */

  /**
   * Acak array dengan benih tetap — urutan sama setiap dipanggil
   * dengan benih yang sama (dipakai untuk urutan soal per attempt).
   */
  function acakBerbenih(arr, benih) {
    var a = arr.slice();
    var s = 0;
    for (var i = 0; i < String(benih).length; i++) {
      s = (s * 31 + String(benih).charCodeAt(i)) % 233280;
    }
    for (var j = a.length - 1; j > 0; j--) {
      s = (s * 9301 + 49297) % 233280;
      var k = Math.floor(s / 233280 * (j + 1));
      var t = a[j]; a[j] = a[k]; a[k] = t;
    }
    return a;
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
   * Salin nilai dari sumber ke target HANYA bila kolomnya benar-benar
   * dikirim (tidak undefined).
   *
   * Mencegah kelas bug "edit parsial menghapus data": pemanggil yang
   * hanya mengirim sebagian kolom tidak boleh mengosongkan kolom lain
   * yang sudah tersimpan.
   *
   * @param {Object} target  objek yang akan ditulis ke sheet
   * @param {Object} sumber  payload dari klien
   * @param {Object} aturan  { nama_kolom: fungsiTransformasi }
   */
  function isiBilaAda(target, sumber, aturan) {
    Object.keys(aturan).forEach(function (kol) {
      if (sumber[kol] === undefined) return;
      var f = aturan[kol];
      target[kol] = typeof f === 'function' ? f(sumber[kol]) : sumber[kol];
    });
    return target;
  }

  /* pembantu transformasi umum */
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

  /* -------------------------------------------------- log */

  /* Penumpuk log — lihat mulaiTumpukLog(). */
  var _tumpukan = null;

  /**
   * Kumpulkan log ke memori alih-alih menulisnya satu per satu.
   *
   * `Db.tambah()` adalah satu panggilan API per pemanggilan. Operasi
   * borongan seperti menerapkan kerangka semester memanggil
   * `catatLog()` sekali per item — 20 pertemuan bisa berarti 100+
   * penulisan yang seluruhnya masuk ke sheet yang sama.
   *
   * WAJIB dipasangkan dengan siramTumpukLog() di blok `finally`,
   * kalau tidak lognya hilang dan penumpuk bocor ke operasi lain.
   */
  function mulaiTumpukLog() { _tumpukan = []; }

  /** Tulis seluruh log yang tertumpuk dalam SATU panggilan. */
  function siramTumpukLog() {
    var isi = _tumpukan;
    _tumpukan = null;                 /* dilepas lebih dulu: bila
                                         penulisan gagal, penumpuk
                                         tidak tertinggal menyala */
    if (!isi || !isi.length) return 0;
    try { Db.tambah('log', isi); return isi.length; }
    catch (e) { return 0; }
  }

  function catatLog(userId, aksi, detail, status) {
    if (_tumpukan) {
      _tumpukan.push({
        log_id: buatId('LOG'),
        user_id: userId || '',
        aksi: aksi,
        detail: typeof detail === 'string' ? detail.slice(0, 1000)
                                           : JSON.stringify(detail).slice(0, 1000),
        status: status || 'ok',
        timestamp: sekarang()
      });
      return;
    }
    try {
      Db.tambah('log', {
        log_id: buatId('LOG'),
        user_id: userId || '',
        aksi: aksi,
        detail: typeof detail === 'string' ? detail.slice(0, 1000)
                                           : JSON.stringify(detail).slice(0, 1000),
        status: status || 'ok',
        timestamp: sekarang()
      });
    } catch (e) { /* log gagal jangan sampai menggagalkan operasi utama */ }
  }

  return {
    buatId: buatId, buatToken: buatToken,
    buatSalt: buatSalt, hashPassword: hashPassword,
    passwordSementara: passwordSementara, periksaPassword: periksaPassword,
    normalisasiUsername: normalisasiUsername,
    normalisasiWa: normalisasiWa, emailSah: emailSah,
    nisnSah: nisnSah, biodataLengkap: biodataLengkap,
    sekarang: sekarang, tambahJam: tambahJam, lewat: lewat,
    formatTanggal: formatTanggal,
    mulaiTumpukLog: mulaiTumpukLog, siramTumpukLog: siramTumpukLog,
    sanitasi: sanitasi, escapeHtml: escapeHtml,
    hitungBagian: hitungBagian, ambilBagian: ambilBagian,
    semuaBagian: semuaBagian,
    acakBerbenih: acakBerbenih,
    urlSah: urlSah, kosong: kosong,
    isiBilaAda: isiBilaAda, teks: teks, angka: angka, boolean: boolean,
    catatLog: catatLog
  };
})();


/**
 * Penjaga fungsi editor (diagnostik, setup, reset darurat).
 *
 * google.script.run dapat memanggil SETIAP fungsi global. Tanpa
 * penjaga ini, murid di browser bisa menjalankan ujiTahap*,
 * resetGuruDarurat, _sesiGuruDiagnostik, hapusSeedData, dll.
 *
 * ─────────────────────────────────────────────────────────────
 * v1.18.3 — PERBAIKAN: penjaga versi lama MEMBLOKIR EDITOR.
 *
 * Versi f2959b1 hanya membandingkan ActiveUser dengan EffectiveUser.
 * Asumsinya: dari editor keduanya sama dengan pemilik. Itu TIDAK
 * selalu benar. `Session.getActiveUser().getEmail()` mengembalikan
 * string kosong bila email pengguna tidak diungkapkan ke skrip
 * (mis. akun di luar domain pemilik, atau skrip dibagikan sebagai
 * editor bukan pemilik). Akibatnya guru melihat:
 *
 *     Error: Hanya dijalankan dari editor Apps Script.
 *     _hanyaEditor @ Util.gs:428
 *     hapusSeedData @ Setup.gs:808
 *
 * …padahal dia memang di editor. 25 fungsi admin ikut terkunci:
 * cekKesehatan, setupLengkap, cekBerkasUI, resetTahunAjaran,
 * hapusSeedData, cekNomorWa, dan lainnya.
 *
 * Karena email tidak bisa diandalkan, ditambah satu saklar yang
 * hanya bisa dipasang guru sendiri — lewat Project Settings, TANPA
 * menjalankan kode apa pun. Murid di browser tidak bisa memasang
 * Script Property, jadi penjaga tetap berlaku penuh selama saklar
 * itu tidak ada.
 *
 * Trigger waktu (tugasHarianQuiz) JANGAN memakai penjaga ini.
 */
function _hanyaEditor() {
  /* 1. Saklar eksplisit guru. Dipasang dari:
        Project Settings (ikon gerigi) → Script Properties
        → Add script property → IZIN_EDITOR = YA
     Tidak memerlukan kode berjalan, jadi tetap bisa dipasang
     justru ketika penjaga ini sedang memblokir semuanya. */
  try {
    if (PropertiesService.getScriptProperties()
          .getProperty('IZIN_EDITOR') === 'YA') {
      Logger.log('⚠️  _hanyaEditor: IZIN_EDITOR=YA aktif — penjaga ' +
                 'sedang DILEWATI. Hapus properti ini setelah selesai.');
      return;
    }
  } catch (e) { /* PropertiesService gagal → jangan dianggap izin */ }

  /* 2. Editor normal: pengguna aktif = pengguna efektif = pemilik. */
  var aktif = '';
  var efektif = '';
  try { aktif = Session.getActiveUser().getEmail() || ''; } catch (e) {}
  try { efektif = Session.getEffectiveUser().getEmail() || ''; } catch (e) {}
  if (aktif && aktif === efektif) return;

  /* 3. Sisanya ditolak — dengan pesan yang menjelaskan jalan keluarnya,
        bukan sekadar melarang. Pesan versi lama ("Hanya dijalankan dari
        editor Apps Script.") tidak memberi tahu apa pun kepada guru
        yang MEMANG berada di editor. */
  throw new Error(
    'Ditolak: fungsi ini hanya boleh dijalankan dari editor Apps Script.\n\n' +
    'Bila Anda MEMANG menjalankannya dari editor dan tetap melihat pesan ' +
    'ini, artinya akun Google Anda bukan pemilik skrip ini, atau email ' +
    'Anda tidak diungkapkan ke skrip — sehingga pemeriksaan tidak dapat ' +
    'memastikan. Ini keterbatasan penjaga, bukan kesalahan Anda.\n\n' +
    'Cara membuka kunci (tidak melemahkan penjaga untuk murid):\n' +
    '  1. Project Settings (ikon gerigi di panel kiri)\n' +
    '  2. Script Properties → Add script property\n' +
    '  3. Property: IZIN_EDITOR    Value: YA\n' +
    '  4. Simpan, lalu jalankan lagi fungsinya\n' +
    '  5. HAPUS properti itu setelah selesai\n\n' +
    'Murid tidak bisa memasang Script Property, jadi selama properti itu ' +
    'tidak ada, google.script.run tetap ditolak.'
  );
}
