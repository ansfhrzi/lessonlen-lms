/* ============================================================
 *  LMS v2 — ApiKey.gs
 *  Status API Key (menu dashboard guru — keputusan §22D):
 *  pasang daftar API key Gemini (maksimal 10) dan pantau
 *  statusnya. Mekanisme PERSIS v1 (Ai.gs):
 *   · key disimpan di Script Properties "GEMINI_KEYS" (JSON) —
 *     BUKAN di spreadsheet, tidak pernah keluar dari server
 *   · panel status HANYA menampilkan 4 digit terakhir tiap key
 *   · cooldown per key/model memakai CacheService, kunci
 *     "gemini_cd_<i>_<model>" & "gemini_key_rusak_<i>" — sama
 *     dengan yang dipakai generator AI nanti (tahap port Ai)
 *   · menyimpan daftar baru MENIMPA seluruh daftar lama dan
 *     menghapus semua cooldown
 *
 *  Nama properti/kunci dibuat identik agar port penuh Ai.gs
 *  (tahap berikutnya) langsung kompatibel tanpa migrasi.
 * ============================================================ */

var ApiKey = (function () {

  var PROP_KEYS = 'GEMINI_KEYS';
  var PROP_CURSOR = 'GEMINI_KEY_CURSOR';
  var MAKS_KEY = 10;                 /* keputusan §22D */

  var MODEL_BAWAAN = [
    'gemini-3.6-flash',            /* terbaru, dipakai guru */
    'gemini-3.5-flash',            /* terverifikasi masih gratis */
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.0-flash'
  ];

  /* -------------------------------------------------- bantu */

  function _err(kode, pesan) {
    var e = new Error(pesan);
    e.kode = kode;
    return e;
  }

  function _cd(i, model) { return 'gemini_cd_' + i + '_' + (model || ''); }

  /** Daftar key dari Script Properties (mentah, JANGAN dikirim ke klien). */
  function _keys() {
    var mentah;
    try {
      mentah = PropertiesService.getScriptProperties().getProperty(PROP_KEYS);
    } catch (e) { return []; }
    if (!mentah) return [];
    try {
      var a = JSON.parse(mentah);
      return Array.isArray(a)
        ? a.filter(function (k) { return String(k || '').trim().length > 10; })
        : [];
    } catch (e) { return []; }
  }

  function _cursor() {
    var v = '';
    try {
      v = PropertiesService.getScriptProperties().getProperty(PROP_CURSOR) || '';
    } catch (e) {}
    var n = Number(v);
    return isFinite(n) && n >= 0 ? n : 0;
  }

  function _sedangCooldown(i, model) {
    try {
      return CacheService.getScriptCache().get(_cd(i, model)) !== null;
    } catch (e) { return false; }
  }

  function _keyRusak(i) {
    try {
      return CacheService.getScriptCache().get('gemini_key_rusak_' + i) !== null;
    } catch (e) { return false; }
  }

  /** Hapus seluruh cooldown key (semua model + tanda rusak). */
  function _resetCooldownSemua(jml) {
    try {
      var kunci = [];
      for (var i = 0; i < (jml || 20); i++) {
        kunci.push('gemini_key_rusak_' + i);
        MODEL_BAWAAN.forEach(function (m) { kunci.push(_cd(i, m)); });
      }
      CacheService.getScriptCache().removeAll(kunci);
    } catch (e) {}
  }

  /* -------------------------------------------------- API guru */

  /**
   * Status key untuk panel guru.
   * HANYA 4 digit terakhir yang ditampilkan (praktik §10.4 v1).
   * status: 'siap' | 'istirahat' (semua model sedang cooldown) |
   *         'bermasalah' (key ditolak server — cooldown panjang)
   */
  function status(sesi) {
    var keys = _keys();
    var rusak = 0, siap = 0;

    var daftar = keys.map(function (k, i) {
      var status;
      if (_keyRusak(i)) { status = 'bermasalah'; rusak++; }
      else {
        /* key dianggap siap bila MASIH ada model yang belum cooldown */
        var bebas = MODEL_BAWAAN.filter(function (m) {
          return !_sedangCooldown(i, m);
        });
        if (bebas.length) { status = 'siap'; siap++; }
        else status = 'istirahat';
      }
      return { index: i, ekor: String(k).slice(-4), status: status };
    });

    return {
      jml: keys.length,
      maks: MAKS_KEY,
      terpasang: keys.length > 0,
      cursor: keys.length ? _cursor() % keys.length : 0,
      jml_siap: siap,
      jml_bermasalah: rusak,
      model: MODEL_BAWAAN,
      model_aktif: MODEL_BAWAAN[0],
      key: daftar
    };
  }

  /**
   * Simpan daftar key — MENIMPA seluruh daftar lama (v1).
   * daftar: larik string. Aturan: maks 10, tiap key ≥30 karakter dan
   * tanpa spasi (bentuk key Google AIza…; sekadar mencegah salah
   * tempel — bukan jaminan key sah). Daftar kosong = mencabut semua.
   */
  function simpan(sesi, daftar) {
    if (!Array.isArray(daftar)) {
      throw _err('VALIDASI_GAGAL', 'Daftar key harus berupa larik.');
    }

    var bersih = daftar
      .map(function (k) { return String(k || '').trim(); })
      .filter(function (k) { return k.length > 0; });

    if (bersih.length > MAKS_KEY) {
      throw _err('VALIDASI_GAGAL',
        'Maksimal ' + MAKS_KEY + ' key. Dikirim: ' + bersih.length + '.');
    }

    for (var i = 0; i < bersih.length; i++) {
      if (bersih[i].length < 30 || bersih[i].indexOf(' ') !== -1) {
        throw _err('VALIDASI_GAGAL',
          'Key ke-' + (i + 1) + ' tidak berbentuk API key yang wajar.');
      }
    }

    try {
      PropertiesService.getScriptProperties()
        .setProperty(PROP_KEYS, JSON.stringify(bersih));
    } catch (e) {
      throw _err('KESALAHAN_SERVER', 'Gagal menyimpan key.');
    }
    _resetCooldownSemua(bersih.length);

    Util.catatLog(sesi.user_id, 'SIMPAN_API_KEY',
      bersih.length + ' key dipasang', 'ok', sesi.role);
    return { jml: bersih.length };
  }

  /** Buang seluruh cooldown — tombol "Coba Lagi Sekarang". */
  function resetCooldown(sesi) {
    _resetCooldownSemua(_keys().length);
    Util.catatLog(sesi.user_id, 'RESET_COOLDOWN_AI', '', 'ok', sesi.role);
    return { direset: true };
  }

  return {
    status: status,
    simpan: simpan,
    resetCooldown: resetCooldown,
    /* internal — dipakai modul AI nanti, tidak lewat endpoint */
    _keys: _keys,
    _cd: _cd,
    PROP_KEYS: PROP_KEYS,
    PROP_CURSOR: PROP_CURSOR,
    MODEL_BAWAAN: MODEL_BAWAAN
  };
})();
