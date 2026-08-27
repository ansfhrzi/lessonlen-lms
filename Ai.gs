/**
 * ============================================================
 *  LessonLen — Ai.gs
 *  Generator materi & soal dengan Gemini + rotasi 10 API key
 * ------------------------------------------------------------
 *  Acuan: KESEPAKATAN-SISTEM.md v4.7 §8, §10
 *
 *  ATURAN MENGIKAT:
 *   - Key HANYA di Script Properties. Tidak pernah masuk kode,
 *     sheet, log, atau browser. Di log dirujuk sebagai key#3.
 *   - AI selalu menghasilkan DRAFT. Tidak ada jalur otomatis
 *     dari AI ke murid — guru wajib meninjau (ai_ditinjau).
 *   - Round-robin, BUKAN acak: beban merata & mudah ditelusuri.
 *   - Maksimal satu putaran key per permintaan.
 *   - Berhenti bila akumulasi > 90 detik (batas GAS 6 menit).
 * ============================================================
 */

var Ai = (function () {

  var PROP_KEYS   = 'GEMINI_KEYS';
  var PROP_CURSOR = 'GEMINI_KEY_CURSOR';

  /**
   * Daftar model dicoba berurutan. Ini penambahan penting: kuota gratis
   * Gemini dihitung per (project × MODEL), sehingga saat satu model
   * kehabisan kuota harian, model lain di project yang sama MASIH punya
   * jatah sendiri. Merotasi model melipatgandakan kapasitas tanpa
   * menambah key sama sekali.
   *
   * Urutan sengaja menaruh Flash-Lite di depan: kuota hariannya paling
   * longgar (±1.000-1.500 permintaan/hari) dan cukup untuk menyusun
   * materi ajar. Model yang tidak dikenal akan dijawab 404 lalu
   * dilewati otomatis, jadi daftar ini aman memuat model baru.
   */
  var MODEL_BAWAAN = [
    'gemini-3.6-flash',            /* terbaru, dipakai guru */
    'gemini-3.5-flash',            /* terverifikasi masih gratis */
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.0-flash'
  ];
  var PROP_MODEL = 'GEMINI_MODEL';        /* pilihan guru, opsional */
  var MODEL = MODEL_BAWAAN[0];            /* dipakai saat mencatat riwayat */
  var ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/';

  /* Satu panggilan Gemini bisa memakan 25-40 detik untuk materi
     panjang. Batas 90 detik membuat rotasi berhenti setelah ~2
     percobaan — terlalu cepat menyerah. Dinaikkan ke 240 detik,
     masih menyisakan ruang aman dari batas 6 menit Apps Script. */
  var BATAS_TOTAL_MS = 240000;
  var CD_MENIT   = 60;          /* 429 kuota per-menit → istirahat 60 detik */
  var CD_HARIAN  = 3600;        /* 429 kuota HARIAN → istirahat 1 jam */
  var CD_RUSAK   = 86400;       /* 400/403 → cooldown 24 jam */
  var JEDA_SERVER = 2000;       /* 500/503 → jeda 2 detik */

  function _err(kode, pesan) {
    var e = new Error(pesan);
    e.kode = kode;
    return e;
  }

  /* ==================================================== KEY */

  /** Daftar key dari Script Properties. Tidak pernah keluar dari modul ini. */
  function _keys() {
    var mentah = PropertiesService.getScriptProperties().getProperty(PROP_KEYS);
    if (!mentah) return [];
    try {
      var a = JSON.parse(mentah);
      return Array.isArray(a)
        ? a.filter(function (k) { return String(k || '').trim().length > 10; })
        : [];
    } catch (e) { return []; }
  }

  /**
   * Simpan daftar key. Dipanggil dari UI guru atau editor.
   * Nilai lama ditimpa seluruhnya.
   */
  function simpanKeys(sesi, daftar) {
    if (!Array.isArray(daftar)) {
      throw _err('VALIDASI_GAGAL', 'Daftar key harus berupa larik.');
    }
    var bersih = daftar
      .map(function (k) { return String(k || '').trim(); })
      .filter(function (k) { return k.length > 0; });

    for (var i = 0; i < bersih.length; i++) {
      /* Bentuk key Google: AIza… 39 karakter. Periksa sekadar mencegah
         salah tempel — bukan jaminan key-nya sah. */
      if (bersih[i].length < 30 || bersih[i].indexOf(' ') !== -1) {
        throw _err('VALIDASI_GAGAL',
          'Key ke-' + (i + 1) + ' tidak berbentuk API key yang wajar.');
      }
    }

    PropertiesService.getScriptProperties()
      .setProperty(PROP_KEYS, JSON.stringify(bersih));
    _resetCooldownSemua(bersih.length);

    Util.catatLog(sesi ? sesi.user_id : null, 'simpan_api_key',
      bersih.length + ' key dipasang');
    return { jml: bersih.length };
  }

  /** Daftar model yang akan dicoba, pilihan guru didahulukan. */
  function _daftarModel() {
    var pilihan = '';
    try {
      pilihan = PropertiesService.getScriptProperties()
        .getProperty(PROP_MODEL) || '';
    } catch (e) {}

    var daftar = MODEL_BAWAAN.slice();
    if (pilihan && daftar.indexOf(pilihan) === -1) daftar.unshift(pilihan);
    else if (pilihan) {
      daftar = [pilihan].concat(daftar.filter(function (m) {
        return m !== pilihan;
      }));
    }
    /* model yang terbukti tidak ada (404) dibuang selama 24 jam */
    return daftar.filter(function (m) { return !_modelMati(m); });
  }

  /** Model yang terbukti menolak responseSchema — ingat 24 jam. */
  function _modelTanpaSkema(m) {
    try {
      return CacheService.getScriptCache().get('gemini_nosk_' + m) !== null;
    } catch (e) { return false; }
  }

  function _tandaiTanpaSkema(m) {
    try {
      CacheService.getScriptCache().put('gemini_nosk_' + m, '1', 86400);
    } catch (e) {}
  }

  /**
   * Bentuk thinkingConfig yang cocok untuk sebuah model.
   * 'level'  → thinkingLevel: MINIMAL   (seri 3.x)
   * 'budget' → thinkingBudget: 0        (seri 2.5)
   * Tebakan awal dari nama model, lalu dikoreksi oleh jawaban server
   * dan diingat 24 jam.
   */
  function _gayaThink(m) {
    try {
      var tersimpan = CacheService.getScriptCache().get('gemini_gaya_' + m);
      if (tersimpan) return tersimpan;
    } catch (e) {}
    return /gemini-3/i.test(m) ? 'level' : 'budget';
  }

  /**
   * Nilai thinkingLevel yang dipakai. 'minimal' paling hemat, tetapi
   * sebagian model (mis. seri Pro) hanya menerima 'low' ke atas.
   * Bila ditolak, nilai berikutnya dicoba dan diingat.
   */
  /* Urutan mengikuti contoh resmi Google yang memakai "low". Nilai
     "minimal" lebih hemat tetapi tidak semua model menerimanya, dan
     dokumentasi Gemini 3 Flash menyebut minimal pun "model masih
     berpotensi berpikir". Bila "low" ditolak, "minimal" dicoba. */
  var LEVEL_URUT = ['low', 'minimal'];

  function _levelThink(m) {
    try {
      var v = CacheService.getScriptCache().get('gemini_lvl_' + m);
      if (v) return v;
    } catch (e) {}
    return LEVEL_URUT[0];
  }

  function _tandaiLevel(m, v) {
    try {
      CacheService.getScriptCache().put('gemini_lvl_' + m, v, 86400);
    } catch (e) {}
  }

  function _tandaiGaya(m, gaya) {
    try {
      CacheService.getScriptCache().put('gemini_gaya_' + m, gaya, 86400);
    } catch (e) {}
  }

  /** Model yang tidak mengenal thinkingConfig — ingat 24 jam. */
  function _modelTanpaThink(m) {
    try {
      return CacheService.getScriptCache().get('gemini_noth_' + m) !== null;
    } catch (e) { return false; }
  }

  function _tandaiTanpaThink(m) {
    try {
      CacheService.getScriptCache().put('gemini_noth_' + m, '1', 86400);
    } catch (e) {}
  }

  function _modelMati(m) {
    try {
      return CacheService.getScriptCache().get('gemini_mdl_' + m) !== null;
    } catch (e) { return false; }
  }

  function _tandaiModelMati(m) {
    try {
      CacheService.getScriptCache().put('gemini_mdl_' + m, '1', 86400);
    } catch (e) {}
  }

  /** Cooldown disimpan per pasangan key+model, bukan per key saja. */
  function _cd(i, model) { return 'gemini_cd_' + i + '_' + (model || ''); }

  function _sedangCooldown(i, model) {
    try {
      return CacheService.getScriptCache().get(_cd(i, model)) !== null;
    } catch (e) { return false; }
  }

  function _pasangCooldown(i, model, detik, sebab) {
    try {
      CacheService.getScriptCache().put(_cd(i, model), sebab || '1', detik);
    } catch (e) {}
  }

  /** Key ditolak (bukan sekadar kuota) berlaku untuk SEMUA model. */
  function _pasangCooldownKey(i, detik, sebab) {
    try {
      var c = CacheService.getScriptCache();
      MODEL_BAWAAN.forEach(function (m) {
        c.put(_cd(i, m), sebab, detik);
      });
      c.put('gemini_key_rusak_' + i, sebab, detik);
    } catch (e) {}
  }

  function _keyRusak(i) {
    try {
      return CacheService.getScriptCache().get('gemini_key_rusak_' + i) !== null;
    } catch (e) { return false; }
  }

  function _resetCooldownSemua(jml) {
    try {
      var kunci = [];
      for (var i = 0; i < (jml || 20); i++) {
        kunci.push('gemini_key_rusak_' + i);
        MODEL_BAWAAN.forEach(function (m) { kunci.push(_cd(i, m)); });
      }
      MODEL_BAWAAN.forEach(function (m) {
        kunci.push('gemini_mdl_' + m);
        kunci.push('gemini_nosk_' + m);
        kunci.push('gemini_noth_' + m);
        kunci.push('gemini_gaya_' + m);
        kunci.push('gemini_lvl_' + m);
      });
      CacheService.getScriptCache().removeAll(kunci);
    } catch (e) {}
  }

  function _cursor() {
    var v = PropertiesService.getScriptProperties().getProperty(PROP_CURSOR);
    var n = Number(v);
    return isFinite(n) && n >= 0 ? n : 0;
  }

  function _simpanCursor(n) {
    try {
      PropertiesService.getScriptProperties()
        .setProperty(PROP_CURSOR, String(n));
    } catch (e) {}
  }

  /**
   * Status key untuk panel guru.
   * HANYA 4 digit terakhir yang ditampilkan (§10.4).
   */
  function statusKeys() {
    var keys = _keys();
    var model = _daftarModel();
    var rusak = 0, siap = 0;

    var daftar = keys.map(function (k, i) {
      var status;
      if (_keyRusak(i)) { status = 'bermasalah'; rusak++; }
      else {
        /* key dianggap siap bila MASIH ada model yang belum cooldown */
        var bebas = model.filter(function (m) {
          return !_sedangCooldown(i, m);
        });
        if (bebas.length) { status = 'siap'; siap++; }
        else status = 'istirahat';
      }
      return { index: i, ekor: String(k).slice(-4), status: status };
    });

    return {
      jml: keys.length,
      terpasang: keys.length > 0,
      cursor: keys.length ? _cursor() % keys.length : 0,
      jml_siap: siap,
      jml_bermasalah: rusak,
      model: model,
      model_aktif: model.length ? model[0] : '',
      key: daftar
    };
  }

  /** Simpan model pilihan guru. Kosongkan untuk kembali ke bawaan. */
  function simpanModel(sesi, nama) {
    var m = String(nama || '').trim();
    if (m && !/^gemini-[a-z0-9.\-]+$/i.test(m)) {
      throw _err('VALIDASI_GAGAL', 'Nama model tidak wajar.');
    }
    try {
      if (m) PropertiesService.getScriptProperties().setProperty(PROP_MODEL, m);
      else PropertiesService.getScriptProperties().deleteProperty(PROP_MODEL);
    } catch (e) {}
    _resetCooldownSemua(_keys().length);
    Util.catatLog(sesi ? sesi.user_id : null, 'ganti_model_ai', m || '(bawaan)');
    return { model: m || MODEL_BAWAAN[0] };
  }

  /** Buang seluruh cooldown — dipakai tombol "Coba Lagi Sekarang". */
  function resetCooldown(sesi) {
    _resetCooldownSemua(_keys().length);
    Util.catatLog(sesi ? sesi.user_id : null, 'reset_cooldown_ai', '');
    return { direset: true };
  }

  /* ==================================================== PANGGILAN */

  /**
   * Panggil Gemini dengan rotasi key round-robin + cooldown (§10.3).
   *
   * @param {string} prompt
   * @param {Object} opsi { skema, suhu, maksToken }
   * @returns {{teks:string, key_index:number, durasi_ms:number}}
   */
  function panggil(prompt, opsi) {
    opsi = opsi || {};
    var keys = _keys();
    if (!keys.length) {
      throw _err('AI_BELUM_SIAP',
        'API key Gemini belum dipasang. Buka Utilitas → Status API Key.');
    }

    var model = _daftarModel();
    if (!model.length) {
      throw _err('AI_BELUM_SIAP',
        'Tidak ada model AI yang tersedia. Coba lagi besok.');
    }

    var mulaiTotal = Date.now();
    var cursor = _cursor();
    var terakhirGagal = '';
    var adaYangDicoba = false;

    /* `polos` = kirim tanpa responseSchema/responseMimeType. Sebagian
       model belum mendukungnya; bila ditolak kita ulangi secara polos
       dan mengandalkan _parseJson() untuk membaca hasilnya. */
    var polos = false;
    var muatan = null;          /* disusun per model, lihat di bawah */

    /* Rotasi DUA sumbu: key × model.
       Kuota gratis dihitung per (project × model), jadi saat satu model
       kehabisan jatah harian, model lain pada key yang sama masih bisa
       dipakai. Model di lapisan luar supaya seluruh key dicoba dulu
       pada model termurah sebelum berpindah model. */
    for (var m = 0; m < model.length; m++) {
      var modelIni = model[m];

      /* Model yang sudah terbukti menolak skema langsung dikirim polos —
         tanpa ini setiap panggilan memboroskan satu percobaan gagal. */
      polos = _modelTanpaSkema(modelIni);
      var tanpaThinking = _modelTanpaThink(modelIni);
      var gaya = _gayaThink(modelIni);
      var level = _levelThink(modelIni);
      muatan = _muatan(polos ? _promptPolos(prompt) : prompt, opsi,
                       polos, tanpaThinking, gaya, level);

      for (var putaran = 0; putaran < keys.length; putaran++) {

        if (Date.now() - mulaiTotal > BATAS_TOTAL_MS) {
          throw _err('AI_TIMEOUT',
            'Permintaan ke AI terlalu lama. Coba lagi sebentar.');
        }

        cursor = (cursor + 1) % keys.length;
        _simpanCursor(cursor);

        if (_keyRusak(cursor)) continue;
        if (_sedangCooldown(cursor, modelIni)) continue;

        adaYangDicoba = true;
        var mulai = Date.now();
        var resp;
        try {
          resp = UrlFetchApp.fetch(
            ENDPOINT + modelIni + ':generateContent?key=' +
              encodeURIComponent(keys[cursor]),
            {
              method: 'post',
              contentType: 'application/json',
              payload: muatan,
              muteHttpExceptions: true
            });
        } catch (e) {
          terakhirGagal = 'gangguan jaringan';
          Utilities.sleep(JEDA_SERVER);
          continue;
        }

        var kode = resp.getResponseCode();
        var isi = resp.getContentText();

        if (kode === 200) {
          var teks = _ambilTeks(isi);
          if (!teks) { terakhirGagal = 'balasan kosong'; continue; }

          /* Balasan yang terpotong TIDAK boleh dianggap sukses.
             Diam-diam mengembalikan potongan membuat _parseJson gagal
             dengan pesan menyesatkan, atau lebih buruk: materi tersimpan
             separuh jadi. */
          if (_terpotong(isi)) {
            terakhirGagal = 'jawaban ' + modelIni + ' terpotong (batas token)';
            if (!tanpaThinking) {
              /* Sudah mengirim thinkingConfig tetapi tetap terpotong —
                 mungkin medan itu diabaikan model. Coba tanpa medan
                 tersebut sambil memperbesar jatah token. */
              tanpaThinking = true;
              _tandaiTanpaThink(modelIni);
              muatan = _muatan(polos ? _promptPolos(prompt) : prompt,
                               opsi, polos, true, gaya, level);
              putaran--;
              continue;
            }
            /* sudah tanpa thinking pun terpotong → model ini tak cocok */
            _tandaiModelMati(modelIni);
            break;
          }

          return {
            teks: teks,
            key_index: cursor,
            model: modelIni,
            durasi_ms: Date.now() - mulai
          };
        }

        /* Pesan asli Google jauh lebih berguna daripada nomor kode.
           Contoh: "Limit: 15 requests per day" memberi tahu guru bahwa
           yang habis adalah kuota HARIAN, bukan sekadar terlalu cepat. */
        var pesanAsli = _pesanError(isi);

        if (kode === 429) {
          /* Bedakan kuota per-menit (pulih cepat) dari kuota harian
             (baru pulih tengah malam Pasifik). Menandai keduanya sama
             membuat sistem terus menabrak dinding yang sama. */
          var harian = /per day|perDay|GenerateRequestsPerDay/i.test(pesanAsli);
          _pasangCooldown(cursor, modelIni,
            harian ? CD_HARIAN : CD_MENIT,
            harian ? 'kuota-harian' : 'kuota-menit');
          terakhirGagal = harian
            ? 'kuota harian ' + modelIni + ' habis'
            : 'terlalu banyak permintaan pada ' + modelIni;
          /* jitter kecil agar tidak semua percobaan menumpuk bersamaan */
          Utilities.sleep(300 + Math.floor(Math.random() * 500));
          continue;
        }

        if (kode === 404) {
          /* model tidak ada / tidak tersedia untuk key ini */
          _tandaiModelMati(modelIni);
          terakhirGagal = 'model ' + modelIni + ' tidak tersedia';
          break;                       /* langsung coba model berikutnya */
        }

        if (kode === 400 || kode === 401 || kode === 403) {
          /* 401 & 403 hampir selalu soal izin/key → perlakukan sebagai
             key bermasalah walau pesannya kosong.
             400 ambigu: sering berarti PROMPT yang salah, bukan key.
             Hanya naikkan jadi "key bermasalah" bila pesannya memang
             menyebut key/izin, supaya key sehat tidak ikut dihukum. */
          var soalKey = kode === 401 || kode === 403 ||
            /API key|API_KEY|permission|PERMISSION_DENIED|unregistered/i
              .test(pesanAsli);
          if (soalKey) {
            _pasangCooldownKey(cursor, CD_RUSAK, 'rusak');
            terakhirGagal = 'key ditolak: ' + (pesanAsli || kode);
            continue;
          }

          /* Model menolak bentuk permintaannya, bukan key-nya. Ini
             terjadi bila sebuah model belum mendukung responseSchema
             atau responseMimeType. Menyerah di sini berarti model lain
             yang sebenarnya sanggup tidak pernah dicoba. */
          /* Keluhan seputar thinking. Pola sengaja longgar: Google
             menulisnya dengan SPASI ("thinking budget"), bukan
             camelCase — pola sempit membuat pemulihan tidak pernah
             berjalan dan seluruh generate gagal. */
          /* Sebagian pesan penolakan nilai TIDAK menyebut kata
             "thinking" sama sekali — mis. "Invalid value: allowed
             values are minimal, high". Selama kita memang sedang
             mengirim thinkingConfig, keluhan soal nilai/enum patut
             dicurigai berasal dari situ. */
          var soalThinking = /thinking[ _]?(config|budget|level)/i.test(pesanAsli) ||
            (!tanpaThinking &&
             /invalid value|allowed values|enum|not supported|unsupported/i
               .test(pesanAsli));

          if (soalThinking) {

            /* "only one of thinking budget and thinking level" →
               bentuk yang dikirim salah, bukan medannya tak dikenal.
               Tukar bentuknya lalu ulangi model yang sama. */
            /* Nilai levelnya yang ditolak, bukan medannya. Naikkan ke
               nilai berikutnya sebelum menyerah pada thinkingConfig. */
            var nilaiSalah = gaya === 'level' &&
              /invalid|not supported|unsupported|allowed values|enum/i.test(pesanAsli);
            if (nilaiSalah) {
              var ix = LEVEL_URUT.indexOf(level);
              if (ix >= 0 && ix < LEVEL_URUT.length - 1) {
                level = LEVEL_URUT[ix + 1];
                _tandaiLevel(modelIni, level);
                muatan = _muatan(polos ? _promptPolos(prompt) : prompt,
                                 opsi, polos, false, gaya, level);
                terakhirGagal = 'thinkingLevel disesuaikan ke ' + level;
                putaran--;
                continue;
              }
            }

            var bentukSalah = /only one of/i.test(pesanAsli);
            if (bentukSalah && !tanpaThinking) {
              gaya = (gaya === 'level') ? 'budget' : 'level';
              _tandaiGaya(modelIni, gaya);
              muatan = _muatan(polos ? _promptPolos(prompt) : prompt,
                               opsi, polos, false, gaya, level);
              terakhirGagal = 'bentuk thinkingConfig disesuaikan';
              putaran--;
              continue;
            }

            if (!tanpaThinking) {
              tanpaThinking = true;
              _tandaiTanpaThink(modelIni);
              muatan = _muatan(polos ? _promptPolos(prompt) : prompt,
                               opsi, polos, true, gaya, level);
              terakhirGagal = 'model ' + modelIni + ' tidak mengenal thinkingConfig';
              putaran--;
              continue;
            }
          }

          if (/responseSchema|response_schema|responseMimeType|response_mime_type|Unknown name|not supported/i
                .test(pesanAsli)) {
            if (!polos) {
              /* coba sekali lagi TANPA skema, model yang sama.
                 Diingat supaya panggilan berikutnya langsung polos. */
              polos = true;
              _tandaiTanpaSkema(modelIni);
              muatan = _muatan(_promptPolos(prompt), opsi, true, tanpaThinking, gaya, level);
              terakhirGagal = 'model ' + modelIni + ' tidak mendukung skema JSON';
              putaran--;                 /* ulangi key yang sama */
              continue;
            }
            /* sudah polos pun ditolak → model ini memang tidak cocok */
            _tandaiModelMati(modelIni);
            terakhirGagal = 'model ' + modelIni + ' menolak permintaan';
            break;
          }

          /* masalah pada permintaan itu sendiri (mis. prompt terlalu
             panjang) — mengulang ke key lain sia-sia */
          throw _err('AI_FORMAT',
            'Permintaan ditolak Gemini: ' + (pesanAsli || 'kode ' + kode));
        }

        if (kode >= 500) {
          terakhirGagal = 'server Gemini sedang bermasalah';
          Utilities.sleep(JEDA_SERVER);
          continue;
        }

        terakhirGagal = pesanAsli || ('kode ' + kode);
      }
    }

    _cekKeyBermasalah();

    /* Pesan dibedakan: tidak ada yang sempat dicoba (semua masih
       istirahat) vs sudah dicoba tapi gagal. Dulu keduanya sama dan
       tanda kurungnya kosong ketika belum ada percobaan. */
    if (!adaYangDicoba) {
      throw _err('SEMUA_KEY_HABIS',
        'Semua API key sedang istirahat karena kuota baru saja habis. ' +
        'Tunggu beberapa menit lalu coba lagi, atau tulis materi manual.');
    }
    throw _err('SEMUA_KEY_HABIS',
      'Gagal menghubungi AI — ' + terakhirGagal + '. ' +
      'Coba lagi beberapa saat lagi, atau tulis materi secara manual.');
  }

  /** Tambahan instruksi saat skema JSON tidak dapat dipakai. */
  function _promptPolos(prompt) {
    return prompt + '\n\nBalas HANYA dengan JSON valid, ' +
           'tanpa teks pembuka maupun pagar kode.';
  }

  /** Susun badan permintaan. `polos` membuang pengaturan JSON terstruktur. */
  function _muatan(prompt, opsi, polos, tanpaThinking, gaya, level) {
    var cfg = {
      temperature: opsi.suhu === undefined ? 0.7 : opsi.suhu,

      maxOutputTokens: opsi.maksToken || 8192
    };

    /* Gemini 2.5+ menyalakan "thinking" secara BAWAAN, dan token
       berpikir dipotong dari maxOutputTokens yang sama. Proses berpikir
       memakan hampir seluruh jatah sehingga jawaban terpotong —
       gejalanya balasan sependek "Here is" dengan MAX_TOKENS.

       Menyusun materi ajar tidak butuh penalaran berlapis, jadi
       thinking dimatikan.

       PENTING: `thinkingBudget` dan `thinkingLevel` SALING EKSKLUSIF —
       mengirim keduanya ditolak dengan "You can only set only one of
       thinking budget and thinking level." Seri 2.5 memakai budget,
       seri 3.x memakai level, jadi bentuknya dipilih per model dan
       bentuk yang ditolak diingat agar tidak diulang. */
    if (!tanpaThinking) {
      /* Nilai ditulis HURUF KECIL sesuai dokumentasi REST Google
         ("low", "minimal"). Nilai huruf besar berisiko diabaikan
         diam-diam sehingga model tetap berpikir penuh — gejalanya
         permintaan sepele memakan 25-30 detik. */
      cfg.thinkingConfig = (gaya === 'level')
        ? { thinkingLevel: level || LEVEL_URUT[0] }
        : { thinkingBudget: 0 };
    }
    if (!polos) {
      cfg.responseMimeType = 'application/json';
      if (opsi.skema) cfg.responseSchema = opsi.skema;
    }
    return JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: cfg
    });
  }

  /**
   * Apakah balasan terpotong karena kehabisan token?
   *
   * finishReason MAX_TOKENS berarti model berhenti di tengah kalimat.
   * Pada seri 2.5+ penyebab tersering adalah token "thinking" yang
   * memakan jatah keluaran.
   */
  function _terpotong(mentah) {
    try {
      var j = JSON.parse(mentah);
      if (!j.candidates || !j.candidates.length) return false;
      var alasan = j.candidates[0].finishReason;
      return alasan === 'MAX_TOKENS';
    } catch (e) { return false; }
  }

  /** Ambil pesan error asli dari balasan Google. */
  function _pesanError(mentah) {
    try {
      var j = JSON.parse(mentah);
      if (j && j.error && j.error.message) {
        return String(j.error.message).slice(0, 300);
      }
    } catch (e) {}
    return '';
  }

  /** Ambil teks jawaban dari struktur balasan Gemini. */
  function _ambilTeks(mentah) {
    try {
      var j = JSON.parse(mentah);
      if (!j.candidates || !j.candidates.length) return '';
      var p = j.candidates[0].content;
      if (!p || !p.parts || !p.parts.length) return '';
      return String(p.parts[0].text || '');
    } catch (e) { return ''; }
  }

  /** Kirim notifikasi bila lebih dari 5 key bermasalah 24 jam. */
  function _cekKeyBermasalah() {
    try {
      var st = statusKeys();
      if (st.jml_bermasalah > 5) {
        Notif.kirimKeGuru('feedback_baru',
          st.jml_bermasalah + ' dari ' + st.jml + ' API key Gemini ' +
          'bermasalah. Periksa Utilitas → Status API Key.',
          '#/api-key');
      }
    } catch (e) {}
  }

  /** Buang pagar ```json bila model menyertakannya. */
  function _bersihkanJson(teks) {
    var t = String(teks || '').trim();
    if (t.indexOf('```') === 0) {
      t = t.replace(/^```[a-zA-Z]*\s*/, '').replace(/```\s*$/, '').trim();
    }
    return t;
  }

  function _parseJson(teks) {
    var t = _bersihkanJson(teks);
    try {
      return JSON.parse(t);
    } catch (e) {
      /* kadang model menambah kalimat pembuka — ambil objek pertama */
      var a = t.indexOf('{'), b = t.lastIndexOf('}');
      if (a >= 0 && b > a) {
        try { return JSON.parse(t.slice(a, b + 1)); } catch (e2) {}
      }
      throw _err('AI_FORMAT',
        'Jawaban AI tidak dapat dibaca. Coba jalankan ulang.');
    }
  }


  /* ==================================================== KONTEKS */

  /** Kumpulkan konteks kelas + pertemuan untuk prompt. */
  function _konteks(itemId, pertemuanId) {
    var item = null, ptm = null;

    if (itemId) {
      item = Db.cariBarisCache('item', 'item_id', itemId);
      if (!item) throw _err('TIDAK_DITEMUKAN', 'Item tidak ditemukan.');
      pertemuanId = item.pertemuan_id;
    }
    ptm = Db.cariBarisCache('pertemuan', 'pertemuan_id', pertemuanId);
    if (!ptm) throw _err('TIDAK_DITEMUKAN', 'Pertemuan tidak ditemukan.');

    var kelas = Db.cariBarisCache('kelas', 'kelas_id', ptm.kelas_id);
    if (!kelas) throw _err('TIDAK_DITEMUKAN', 'Kelas tidak ditemukan.');

    return { item: item, pertemuan: ptm, kelas: kelas };
  }

  /** Judul materi sebelum & sesudah, agar AI menyambung, bukan mengulang. */
  function _tetanggaMateri(pertemuanId, itemId) {
    var daftar = Db.saringBaris('item', 'pertemuan_id', pertemuanId,
      ['item_id', 'tipe', 'urutan', 'judul'])
      .filter(function (i) { return i.tipe === 'materi'; })
      .sort(function (a, b) { return Number(a.urutan) - Number(b.urutan); });

    var idx = -1;
    for (var i = 0; i < daftar.length; i++) {
      if (daftar[i].item_id === itemId) { idx = i; break; }
    }
    return {
      sebelum: idx > 0 ? daftar[idx - 1].judul : '',
      sesudah: (idx >= 0 && idx < daftar.length - 1) ? daftar[idx + 1].judul : '',
      nomor: idx >= 0 ? idx + 1 : daftar.length + 1
    };
  }

  function _barisKonteks(k) {
    var b = [];
    b.push('Jenjang  : ' + (k.jenjang || '-') +
           ' kelas ' + (k.tingkat || '-') + ' | Fase ' + (k.fase || '-'));
    b.push('Mapel    : ' + (k.mapel || '-'));
    if (k.kompetensi_keahlian) b.push('Keahlian : ' + k.kompetensi_keahlian);
    if (k.capaian_pembelajaran) {
      b.push('CP kelas : ' + String(k.capaian_pembelajaran).slice(0, 2000));
    }
    if (k.catatan_gaya) b.push('Gaya     : ' + k.catatan_gaya);
    return b.join('\n');
  }

  /* ==================================================== GENERATE MATERI */

  /**
   * Ubah tabel Markdown jadi <table> HTML.
   *
   * Prompt sudah meminta HTML, tetapi model KERAP tetap membalas
   * bergaya Markdown — itulah bentuk yang paling sering dilatihkan
   * padanya. Tanpa pengubah ini, murid melihat deretan tanda `|`
   * mentah di layar (laporan guru v1.5.6).
   *
   * Yang dikenali:
   *     | Lokasi | Unit |
   *     |---|---|
   *     | Lab    | 8    |
   *
   * Baris pemisah (--- atau :---:) menandai baris sebelumnya sebagai
   * kepala tabel.
   */
  function _tabelMarkdownKeHtml(teks) {
    var baris = String(teks).split('\n');
    var keluar = [];
    var i = 0;

    function selTabel(b) {
      /* baris tabel: memuat | dan bukan sekadar teks bertanda pipa */
      var t = b.trim();
      return t.indexOf('|') > -1 && /^\|?[^|]*\|/.test(t);
    }
    function pisah(b) {
      var t = b.trim().replace(/^\|/, '').replace(/\|$/, '');
      return t.split('|').map(function (x) { return x.trim(); });
    }
    function barisPemisah(b) {
      return /^\|?[\s:|-]+\|[\s:|-]*$/.test(b.trim()) &&
             b.indexOf('-') > -1;
    }

    while (i < baris.length) {
      if (selTabel(baris[i]) &&
          i + 1 < baris.length && barisPemisah(baris[i + 1])) {

        var kepala = pisah(baris[i]);
        i += 2;                                  /* lewati pemisah */

        var isi = [];
        while (i < baris.length && selTabel(baris[i]) &&
               !barisPemisah(baris[i])) {
          isi.push(pisah(baris[i]));
          i++;
        }

        var html = '<table><thead><tr>' +
          kepala.map(function (h) {
            return '<th>' + Util.escapeHtml(h) + '</th>';
          }).join('') + '</tr></thead><tbody>' +
          isi.map(function (r) {
            /* samakan jumlah kolom dengan kepalanya supaya tabel
               tidak rusak bila model kurang/lebih satu sel */
            var sel = r.slice(0, kepala.length);
            while (sel.length < kepala.length) sel.push('');
            return '<tr>' + sel.map(function (c) {
              return '<td>' + Util.escapeHtml(c) + '</td>';
            }).join('') + '</tr>';
          }).join('') + '</tbody></table>';

        keluar.push(html);
        continue;
      }
      keluar.push(baris[i]);
      i++;
    }
    return keluar.join('\n');
  }

  var SKEMA_MATERI = {
    type: 'OBJECT',
    properties: {
      konten:      { type: 'STRING' },
      deskripsi:   { type: 'STRING' },
      saran_soal:  { type: 'STRING' },
      saran_lkpd:  { type: 'STRING' }
    },
    required: ['konten', 'deskripsi']
  };

  /**
   * Susun materi untuk satu item (§8.2 Cara A).
   * Hasilnya DRAFT — tidak pernah langsung tersimpan ke item.
   */
  function generateMateri(sesi, itemId, catatanTambahan) {
    var ctx = _konteks(itemId, null);
    var item = ctx.item, ptm = ctx.pertemuan, kelas = ctx.kelas;

    if (item.tipe !== 'materi') {
      throw _err('VALIDASI_GAGAL', 'Item ini bukan Materi.');
    }
    if (Util.kosong(item.tujuan_pembelajaran)) {
      throw _err('VALIDASI_GAGAL',
        'Isi Tujuan Pembelajaran dahulu — itu bahan utama AI.');
    }

    var tetangga = _tetanggaMateri(ptm.pertemuan_id, itemId);
    var catatan = String(catatanTambahan || '').trim().slice(0, 500);

    var prompt =
      'Kamu penyusun materi ajar Kurikulum Merdeka Indonesia.\n\n' +
      _barisKonteks(kelas) + '\n\n' +
      'Pertemuan ' + ptm.urutan + ': "' + ptm.judul + '"\n' +
      'Materi ke-' + tetangga.nomor + ': "' + item.judul + '"\n' +
      'Tujuan Pembelajaran: ' + item.tujuan_pembelajaran + '\n' +
      (tetangga.sebelum
        ? 'Materi sebelumnya: "' + tetangga.sebelum + '" (lanjutkan, jangan ulangi)\n' : '') +
      (tetangga.sesudah
        ? 'Materi sesudahnya: "' + tetangga.sesudah + '" (jangan mendahului)\n' : '') +
      (catatan ? 'Catatan tambahan: ' + catatan + '\n' : '') +
      '\nHasilkan JSON dengan medan:\n' +
      '- konten: HTML memakai tag h3,p,ul,ol,li,b,i,table,tr,td,th saja. ' +
      '500-900 kata.\n' +
      '  WAJIB dipecah 3-5 bagian dengan pemisah <!--bagian-->\n' +
      '  Tiap bagian sekitar 150-250 kata dan memuat satu gagasan utuh.\n' +
      '  Sertakan minimal 2 contoh kontekstual Indonesia' +
      (kelas.kompetensi_keahlian
        ? ' yang sesuai kompetensi keahlian ' + kelas.kompetensi_keahlian : '') + '.\n' +
      '  Sisipkan <p data-saran-gambar="deskripsi gambar"></p> bila perlu gambar.\n' +
      '  Tulis rumus dalam $$...$$ agar dirender MathJax.\n' +
      '- deskripsi: ringkasan 1-2 kalimat\n' +
      '- saran_soal: 5 soal pilihan ganda beserta kunci dan pembahasan singkat\n' +
      '- saran_lkpd: 1 instruksi kerja beserta kriteria penilaian\n\n' +
      'Gunakan Bahasa Indonesia baku namun mudah dipahami murid.';

    var hasil = panggil(prompt, { skema: SKEMA_MATERI, suhu: 0.7 });
    var j = _parseJson(hasil.teks);

    /* Jaring pengaman Markdown (v1.5.6). Prompt meminta HTML, tetapi
       model kerap menyisipkan tabel bergaya Markdown di tengah konten
       yang lain sudah benar. Tanpa ini, murid melihat deretan tanda |
       mentah. Fungsi ini tidak mengubah HTML yang sudah sah. */
    var konten = Util.sanitasi(
      _tabelMarkdownKeHtml(String(j.konten || '')));
    if (!konten.trim()) {
      throw _err('AI_FORMAT', 'AI tidak menghasilkan konten. Coba lagi.');
    }

    var draf = {
      konten: konten,
      deskripsi: String(j.deskripsi || '').slice(0, 500),
      saran_soal: String(j.saran_soal || '').slice(0, 5000),
      saran_lkpd: String(j.saran_lkpd || '').slice(0, 5000),
      jml_bagian: Util.hitungBagian(konten),
      key_index: hasil.key_index,
      durasi_ms: hasil.durasi_ms
    };

    _catatRiwayat({
      item_id: itemId, kelas_id: kelas.kelas_id,
      prompt_ringkas: 'materi: ' + item.judul + (catatan ? ' | ' + catatan : ''),
      konten_hasil: draf.konten,
      saran_soal: draf.saran_soal, saran_lkpd: draf.saran_lkpd,
      key_index: hasil.key_index, durasi_ms: hasil.durasi_ms,
      model: hasil.model, status: 'sukses', error: ''
    });

    Util.catatLog(sesi.user_id, 'generate_materi',
      itemId + ' | key#' + hasil.key_index + ' | ' + hasil.model +
      ' | ' + hasil.durasi_ms + ' ms');

    return draf;
  }

  /* ============================================ GENERATE LKPD & KELOMPOK */

  var SKEMA_KEGIATAN = {
    type: 'OBJECT',
    properties: {
      konten:    { type: 'STRING' },
      deskripsi: { type: 'STRING' }
    },
    required: ['konten']
  };

  /**
   * Susun isi kegiatan untuk item `lkpd` atau `tugas_kelompok`.
   *
   * Satu fungsi untuk dua tipe karena strukturnya sama — yang berbeda
   * hanya cara mengerjakannya. Memisahkannya jadi dua fungsi berarti
   * dua prompt yang harus dijaga selaras, dan pengalaman v1.6.5
   * menunjukkan cabang kembar seperti itu selalu ada yang tertinggal
   * saat diperbaiki.
   *
   * Bentuk LKPD mengikuti kesepakatan guru (v1.7.6): Tujuan, Alat &
   * Bahan, Langkah Kerja, Pertanyaan/Tugas, Kesimpulan.
   *
   * Untuk tugas kelompok, pembedanya adalah DISKUSI dan keputusan
   * bersama — bukan pembagian peran formal. Guru menegaskan langkah
   * kerjanya harus menuntut musyawarah, sebab pembagian peran
   * cenderung membuat anggota bekerja sendiri-sendiri.
   *
   * Rubrik penilaian TIDAK dibuat (keputusan guru) — guru menilai
   * dengan pertimbangannya sendiri.
   */
  function generateKegiatan(sesi, itemId, catatanTambahan) {
    var ctx = _konteks(itemId, null);
    var item = ctx.item, ptm = ctx.pertemuan, kelas = ctx.kelas;

    var berkelompok = item.tipe === 'tugas_kelompok';
    if (item.tipe !== 'lkpd' && !berkelompok) {
      throw _err('VALIDASI_GAGAL',
        'Generator ini hanya untuk LKPD dan Tugas Kelompok.');
    }
    if (Util.kosong(item.tujuan_pembelajaran)) {
      throw _err('VALIDASI_GAGAL',
        'Isi Tujuan Pembelajaran dahulu — itu bahan utama AI.');
    }

    var catatan = String(catatanTambahan || '').trim().slice(0, 500);
    var label = berkelompok ? 'Tugas Kelompok' : 'LKPD';

    /* Materi di pertemuan yang sama jadi acuan supaya kegiatannya
       benar-benar melatih yang baru dipelajari, bukan topik lepas. */
    var materi = Db.saringBaris('item', 'pertemuan_id', ptm.pertemuan_id,
      ['item_id', 'tipe', 'urutan', 'judul'])
      .filter(function (i) { return i.tipe === 'materi'; })
      .sort(function (a, b) { return Number(a.urutan) - Number(b.urutan); })
      .map(function (i) { return i.judul; });

    var infoKelompok = '';
    if (berkelompok) {
      /* Ukuran kelompok memengaruhi beban kerja yang masuk akal.
         Bila kelompok belum dibentuk, katakan asumsinya secara
         TERBUKA — jangan diam-diam memakai angka karangan. */
      var kel = Db.saringBaris('kelompok', 'item_id', itemId,
        ['kelompok_id', 'anggota']);
      var n = 0;
      kel.forEach(function (k) {
        var a;
        try { a = JSON.parse(k.anggota); } catch (e) { a = []; }
        if (Array.isArray(a) && a.length > n) n = a.length;
      });
      infoKelompok = kel.length
        ? 'Kelompok sudah dibentuk: ' + kel.length + ' kelompok, ' +
          'anggota terbanyak ' + n + ' orang.\n'
        : 'Kelompok belum dibentuk — rancang untuk 3-4 orang.\n';
    }

    var prompt =
      'Kamu guru SMK penyusun lembar kegiatan Kurikulum Merdeka ' +
      'Indonesia.\n\n' +
      _barisKonteks(kelas) + '\n\n' +
      'Pertemuan ' + ptm.urutan + ': "' + ptm.judul + '"\n' +
      'Judul ' + label + ': "' + item.judul + '"\n' +
      'Tujuan Pembelajaran: ' + item.tujuan_pembelajaran + '\n' +
      (materi.length
        ? 'Materi di pertemuan ini: ' + materi.join('; ') +
          '\n(kegiatan WAJIB melatih materi itu, bukan topik lain)\n'
        : '') +
      infoKelompok +
      (item.batas_waktu ? 'Ada batas waktu pengumpulan.\n' : '') +
      (catatan ? 'Catatan tambahan guru: ' + catatan + '\n' : '') +

      '\nCara pengerjaan: ' +
      (berkelompok
        ? 'DIKERJAKAN BERKELOMPOK. Ketua kelompok yang mengumpulkan ' +
          'hasilnya.\n' +
          'PENTING — yang membedakannya dari tugas perorangan adalah ' +
          'DISKUSI:\n' +
          '  - langkah kerja harus menuntut musyawarah dan keputusan ' +
          'bersama\n' +
          '  - sertakan titik-titik diskusi: hal yang harus ' +
          'disepakati kelompok\n' +
          '  - JANGAN membagi peran formal (koordinator, pencatat, ' +
          'dsb.) — seluruh anggota memikirkan seluruh persoalan\n' +
          '  - pertanyaan diarahkan pada hasil kesepakatan, bukan ' +
          'jawaban perorangan\n'
        : 'DIKERJAKAN PERORANGAN oleh tiap murid.\n') +

      '\nHasilkan JSON dengan medan:\n' +
      '- konten: HTML memakai tag h3,p,ul,ol,li,b,i,table,tr,td,th ' +
      'saja. 350-600 kata.\n' +
      '  WAJIB memuat LIMA bagian berjudul <h3>, berurutan:\n' +
      '   1. <h3>Tujuan Kegiatan</h3> — 2-3 butir, turunan Tujuan ' +
      'Pembelajaran di atas\n' +
      '   2. <h3>Alat dan Bahan</h3> — daftar <ul>, sebutkan yang ' +
      'benar-benar dipakai; bila kegiatannya tidak memerlukan alat ' +
      'khusus, tulis alat tulis dan sumber belajar yang dipakai\n' +
      '   3. <h3>Langkah Kerja</h3> — <ol> 5-8 langkah, tiap langkah ' +
      'satu tindakan yang bisa dikerjakan dan diamati hasilnya' +
      (berkelompok
        ? '; sisipkan minimal 2 langkah yang menuntut diskusi ' +
          'kelompok\n'
        : '\n') +
      '   4. <h3>Pertanyaan dan Tugas</h3> — <ol> 3-5 pertanyaan ' +
      'analisis, BUKAN sekadar hafalan; pertanyaan terakhir menuntut ' +
      'penerapan pada situasi baru\n' +
      '   5. <h3>Kesimpulan</h3> — instruksi bagi murid menuliskan ' +
      'simpulannya sendiri, beserta hal-hal yang harus tercakup\n' +
      '  Tulis rumus dalam $$...$$ agar dirender MathJax.\n' +
      '  JANGAN menyertakan rubrik atau kriteria penilaian — guru ' +
      'menilai dengan pertimbangannya sendiri.\n' +
      '  JANGAN menyertakan kunci jawaban.\n' +
      '  JANGAN memakai pemisah <!--bagian-->.\n' +
      '- deskripsi: ringkasan 1-2 kalimat\n\n' +

      'Hasil dikumpulkan sebagai TAUTAN (Google Drive/Docs), jadi ' +
      'pastikan langkah terakhir menyebut apa yang harus diunggah ' +
      'dan dibagikan tautannya.\n' +
      'Gunakan Bahasa Indonesia baku namun mudah dipahami murid SMK.';

    var hasil = panggil(prompt, { skema: SKEMA_KEGIATAN, suhu: 0.7 });
    var j = _parseJson(hasil.teks);

    /* Jaring pengaman Markdown yang sama dengan generateMateri —
       model kerap menyisipkan tabel bergaya Markdown (v1.5.6). */
    var konten = Util.sanitasi(
      _tabelMarkdownKeHtml(String(j.konten || '')));
    if (!konten.trim()) {
      throw _err('AI_FORMAT', 'AI tidak menghasilkan konten. Coba lagi.');
    }

    /* Pemisah bagian milik tipe `materi`. Bila lolos ke sini, murid
       melihat komentar HTML mentah di layar. Dibuang, dan
       penyimpangannya DILAPORKAN — bukan diperbaiki diam-diam
       (KONVENSI §6.2 no. 26). */
    var adaPemisah = konten.indexOf('<!--bagian-->') > -1;
    if (adaPemisah) konten = konten.split('<!--bagian-->').join('\n');

    /* Bagian yang WAJIB ada. Guru berhak tahu bila AI melewatkannya,
       supaya ia tidak menerbitkan LKPD tanpa Langkah Kerja. */
    var WAJIB = ['Tujuan', 'Alat', 'Langkah Kerja', 'Pertanyaan',
                 'Kesimpulan'];
    var hilang = WAJIB.filter(function (b) {
      return konten.indexOf(b) === -1;
    });

    var draf = {
      konten: konten,
      deskripsi: String(j.deskripsi || '').slice(0, 500),
      tipe: item.tipe,
      berkelompok: berkelompok,
      bagian_hilang: hilang,
      ada_pemisah_dibuang: adaPemisah,
      key_index: hasil.key_index,
      durasi_ms: hasil.durasi_ms
    };

    _catatRiwayat({
      item_id: itemId, kelas_id: kelas.kelas_id,
      prompt_ringkas: (berkelompok ? 'tugas kelompok: ' : 'lkpd: ') +
        item.judul + (catatan ? ' | ' + catatan : ''),
      konten_hasil: draf.konten,
      saran_soal: '', saran_lkpd: '',
      key_index: hasil.key_index, durasi_ms: hasil.durasi_ms,
      model: hasil.model, status: 'sukses', error: ''
    });

    Util.catatLog(sesi.user_id,
      berkelompok ? 'generate_tugas_kelompok' : 'generate_lkpd',
      itemId + ' | key#' + hasil.key_index + ' | ' + hasil.model +
      ' | ' + hasil.durasi_ms + ' ms');

    return draf;
  }

  /* ============================================ GENERATE REFLEKSI */

  var SKEMA_REFLEKSI = {
    type: 'OBJECT',
    properties: {
      pertanyaan: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            t:     { type: 'STRING' },
            wajib: { type: 'BOOLEAN' }
          },
          required: ['t']
        }
      }
    },
    required: ['pertanyaan']
  };

  var MAKS_TANYA_REFLEKSI = 6;      /* selaras Refleksi.MAKS_PERTANYAAN */

  /**
   * Susun pertanyaan refleksi (§6.5, Permendikdasmen 13/2025).
   *
   * BERBEDA dari generator lain: keluarannya JSON larik pertanyaan,
   * bukan HTML. `item.konten` pada tipe `refleksi` menyimpan daftar
   * pertanyaan, dan editor kontennya sengaja disembunyikan.
   *
   * ARAH PERTANYAAN — keputusan guru (v1.8.1): **kesadaran belajar**,
   * bukan penguasaan materi. Prinsip *berkesadaran (mindful)* menuntut
   * murid memantau strategi belajarnya sendiri dan mengenali bagian
   * yang belum dikuasai.
   *
   * Konsekuensinya prompt harus MELARANG dua hal yang paling mudah
   * dilanggar model:
   *   1. pertanyaan yang punya jawaban benar/salah — itu quiz, bukan
   *      refleksi (§6.5: refleksi BUKAN penilaian)
   *   2. pertanyaan ya/tidak — dijawab satu kata, tidak menggali
   */
  function generateRefleksi(sesi, itemId, jumlah, catatanTambahan) {
    var ctx = _konteks(itemId, null);
    var item = ctx.item, ptm = ctx.pertemuan, kelas = ctx.kelas;

    if (item.tipe !== 'refleksi') {
      throw _err('VALIDASI_GAGAL', 'Item ini bukan Refleksi.');
    }

    var n = Math.max(2, Math.min(MAKS_TANYA_REFLEKSI, Number(jumlah) || 3));
    var catatan = String(catatanTambahan || '').trim().slice(0, 500);

    /* Refleksi merenungkan apa yang BARU dipelajari, jadi konteksnya
       seluruh isi pertemuan — bukan hanya materi seperti pada LKPD. */
    var isiPertemuan = Db.saringBaris('item', 'pertemuan_id',
      ptm.pertemuan_id, ['item_id', 'tipe', 'urutan', 'judul', 'status'])
      .filter(function (i) {
        return i.status === 'publish' && i.tipe !== 'refleksi';
      })
      .sort(function (a, b) { return Number(a.urutan) - Number(b.urutan); });

    var NAMA = { materi: 'Materi', lkpd: 'LKPD', quiz: 'Quiz',
                 tugas_kelompok: 'Tugas Kelompok' };
    var daftarIsi = isiPertemuan.map(function (i) {
      return (NAMA[i.tipe] || i.tipe) + ': ' + i.judul;
    });

    var prompt =
      'Kamu guru SMK yang menyusun pertanyaan REFLEKSI ' +
      'sesuai Pembelajaran Mendalam (Permendikdasmen 13/2025).\n\n' +
      _barisKonteks(kelas) + '\n\n' +
      'Pertemuan ' + ptm.urutan + ': "' + ptm.judul + '"\n' +
      (item.tujuan_pembelajaran
        ? 'Tujuan Pembelajaran: ' + item.tujuan_pembelajaran + '\n' : '') +
      (daftarIsi.length
        ? 'Yang baru dipelajari murid di pertemuan ini:\n  - ' +
          daftarIsi.join('\n  - ') + '\n'
        : '') +
      (catatan ? 'Catatan tambahan guru: ' + catatan + '\n' : '') +

      '\nARAH PERTANYAAN — KESADARAN BELAJAR, bukan penguasaan materi.\n' +
      'Refleksi BUKAN penilaian. Murid merenungkan CARA ia belajar, ' +
      'bukan diuji apa yang ia hafal.\n\n' +
      'Setiap pertanyaan menggali salah satu dari:\n' +
      '  - strategi belajar yang dipakai dan seberapa membantu\n' +
      '  - bagian yang masih terasa sulit atau meragukan, beserta ' +
      'dugaan sebabnya\n' +
      '  - langkah yang akan diambil untuk memperbaiki pemahamannya\n' +
      '  - perubahan cara pandang setelah pertemuan ini\n\n' +

      'DILARANG KERAS:\n' +
      '  - pertanyaan yang punya jawaban BENAR/SALAH — itu quiz\n' +
      '  - pertanyaan ya/tidak — dijawab satu kata, tidak menggali\n' +
      '  - meminta murid mengulang definisi atau menyebutkan langkah\n' +
      '  - menanyakan nilai, peringkat, atau perbandingan dengan teman\n\n' +

      'Hasilkan JSON: medan `pertanyaan` berisi TEPAT ' + n +
      ' pertanyaan.\n' +
      'Tiap pertanyaan objek dengan medan:\n' +
      '  - t: teks pertanyaan, kalimat tanya terbuka, maksimal 200 ' +
      'karakter, memakai sapaan "Anda"\n' +
      '  - wajib: true untuk pertanyaan inti, false untuk yang boleh ' +
      'dilewati. Pertanyaan TERAKHIR wajib bernilai false.\n\n' +
      'Gunakan Bahasa Indonesia yang hangat dan tidak menghakimi, ' +
      'supaya murid berani jujur mengakui yang belum ia kuasai.';

    var hasil = panggil(prompt, { skema: SKEMA_REFLEKSI, suhu: 0.8 });
    var j = _parseJson(hasil.teks);

    var mentah = (j && j.pertanyaan) || [];
    if (!Array.isArray(mentah)) mentah = [];

    /* --- normalisasi + catat penyimpangan (§6.2 no. 26) --- */
    var catatanPenyimpangan = [];

    var bersih = [];
    mentah.forEach(function (q) {
      var t = String((q && (q.t !== undefined ? q.t : q)) || '').trim();
      if (!t) return;
      /* AI kerap menomori sendiri ("1. Apa…") padahal panel guru sudah
         menampilkan nomornya — jadi dobel di layar. */
      t = t.replace(/^\s*\d+[.)]\s*/, '').slice(0, 200);
      if (!t) return;
      bersih.push({ t: t, wajib: !(q && q.wajib === false) });
    });

    if (!bersih.length) {
      throw _err('AI_FORMAT',
        'AI tidak menghasilkan pertanyaan. Coba lagi.');
    }

    if (bersih.length !== n) {
      catatanPenyimpangan.push('AI membuat ' + bersih.length +
        ' pertanyaan, bukan ' + n + '.');
    }
    if (bersih.length > MAKS_TANYA_REFLEKSI) {
      bersih = bersih.slice(0, MAKS_TANYA_REFLEKSI);
      catatanPenyimpangan.push('Dipotong menjadi ' +
        MAKS_TANYA_REFLEKSI + ' (batas panel).');
    }

    /* Pertanyaan ya/tidak lolos prompt cukup sering. Dideteksi dari
       kata pembukanya — dilaporkan, bukan dibuang: guru yang menilai
       apakah masih terpakai. */
    var POLA_TERTUTUP = /^(apakah|adakah|bisakah|sudahkah|pernahkah|dapatkah|benarkah)\b/i;
    var tertutup = bersih.filter(function (q) {
      return POLA_TERTUTUP.test(q.t);
    }).length;
    if (tertutup) {
      catatanPenyimpangan.push(tertutup +
        ' pertanyaan berpotensi dijawab ya/tidak — periksa kembali.');
    }

    /* Pertanyaan terakhir sebaiknya opsional supaya murid tidak
       terhenti di isian panjang. Dibetulkan, lalu dilaporkan. */
    if (bersih.length > 1 &&
        bersih[bersih.length - 1].wajib === true) {
      bersih[bersih.length - 1].wajib = false;
      catatanPenyimpangan.push(
        'Pertanyaan terakhir dijadikan opsional.');
    }

    var draf = {
      pertanyaan: bersih,
      jml: bersih.length,
      penyimpangan: catatanPenyimpangan,
      key_index: hasil.key_index,
      durasi_ms: hasil.durasi_ms
    };

    _catatRiwayat({
      item_id: itemId, kelas_id: kelas.kelas_id,
      prompt_ringkas: 'refleksi: ' + item.judul +
        (catatan ? ' | ' + catatan : ''),
      konten_hasil: JSON.stringify(bersih),
      saran_soal: '', saran_lkpd: '',
      key_index: hasil.key_index, durasi_ms: hasil.durasi_ms,
      model: hasil.model, status: 'sukses', error: ''
    });

    Util.catatLog(sesi.user_id, 'generate_refleksi',
      itemId + ' | ' + bersih.length + ' pertanyaan | key#' +
      hasil.key_index + ' | ' + hasil.model + ' | ' +
      hasil.durasi_ms + ' ms');

    return draf;
  }

  /* ==================================================== GENERATE SOAL */

  var SKEMA_SOAL = {
    type: 'OBJECT',
    properties: {
      /* Wacana bersama (v1.5.5). Diminta sebagai medan TERPISAH, bukan
         diselipkan ke tiap soal: model cenderung menyalin ulang teks
         panjang ke setiap butir bila dijadikan properti soal, dan itu
         memboroskan token keluaran sekaligus melanggar aturan "bacaan
         disimpan sekali" (§9.10). */
      stimulus:      { type: 'STRING' },
      jml_bercerita: { type: 'NUMBER' },
      soal: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            tipe:       { type: 'STRING' },
            pertanyaan: { type: 'STRING' },
            opsi:       { type: 'ARRAY', items: { type: 'STRING' } },
            kunci:      { type: 'STRING' },
            bobot:      { type: 'NUMBER' },
            pembahasan: { type: 'STRING' },
            tingkat:    { type: 'STRING' },
            /* true = soal ini memakai `stimulus` di atas */
            pakai_stimulus: { type: 'BOOLEAN' }
          },
          required: ['tipe', 'pertanyaan', 'kunci']
        }
      }
    },
    required: ['soal']
  };

  /** Jenis wacana yang boleh diminta guru. */
  var JENIS_STIMULUS = {
    kasus:   'studi kasus di dunia kerja — situasi nyata yang harus dianalisis',
    narasi:  'narasi/cerita pendek dengan tokoh dan alur',
    data:    'sajian data: tabel angka, spesifikasi, atau hasil pengukuran',
    dialog:  'dialog atau percakapan antar dua orang',
    kutipan: 'kutipan teks bacaan (artikel, prosedur, atau dokumentasi)'
  };
  var MAKS_STIMULUS_AI = 8000;      /* selaras Quiz.MAKS_STIMULUS */

  /**
   * Bagian prompt untuk soal bercerita.
   *
   * Ditulis SANGAT eksplisit karena tiga hal mudah dilanggar model:
   *  1. jumlah soal bertambah — dikira wacana itu tambahan
   *  2. wacana disalin ulang ke tiap pertanyaan
   *  3. soal bisa dijawab tanpa membaca wacananya (wacana jadi hiasan)
   */
  function _bagianStimulus(nCerita, jenis, total) {
    if (nCerita < 2) return '';

    var mandiri = total - nCerita;
    return '\n=== SOAL BERCERITA ===\n' +
      'Buat SATU wacana bersama, lalu ' + nCerita + ' dari ' + total +
      ' soal itu mengacu padanya.\n' +
      'Jenis wacana: ' + JENIS_STIMULUS[jenis] + '.\n' +
      'Panjang wacana 120-250 kata, memuat rincian konkret ' +
      '(angka, nama alat, kondisi) yang DIPERLUKAN untuk menjawab.\n\n' +
      'FORMAT WACANA — HTML, BUKAN Markdown:\n' +
      '- Paragraf memakai <p>…</p>\n' +
      '- Data tabular WAJIB memakai <table><thead><tr><th>…</th></tr>' +
      '</thead><tbody><tr><td>…</td></tr></tbody></table>. ' +
      'DILARANG memakai tabel bergaya Markdown (baris berisi | dan ---), ' +
      'karena akan tampil sebagai teks mentah di layar murid.\n' +
      '- Daftar memakai <ul><li>…</li></ul> atau <ol>\n' +
      '- Penekanan memakai <b> atau <i>, BUKAN **teks**\n\n' +
      'ATURAN WAJIB:\n' +
      '- Tulis wacana HANYA di medan "stimulus" tingkat atas. ' +
      'JANGAN menyalinnya ke dalam medan "pertanyaan".\n' +
      '- Tepat ' + nCerita + ' soal diberi pakai_stimulus = true' +
      (mandiri > 0
        ? ', dan ' + mandiri + ' soal sisanya pakai_stimulus = false'
        : '') + '.\n' +
      '- Jumlah TOTAL soal tetap ' + total + '. Wacana BUKAN tambahan.\n' +
      '- Tiap soal bercerita harus MUSTAHIL dijawab benar tanpa ' +
      'membaca wacananya. Rujuk data spesifik di dalamnya.\n' +
      '- Pertanyaan soal bercerita berdiri sendiri sebagai kalimat, ' +
      'tanpa mengulang isi wacana.\n' +
      '- Isi medan jml_bercerita dengan ' + nCerita + '.\n' +
      (mandiri > 0
        ? '- ' + mandiri + ' soal mandiri TIDAK boleh menyinggung wacana.\n'
        : '') +
      '\n';
  }

  /**
   * Susun soal quiz (§9.9). Hasilnya draf untuk ditinjau guru —
   * penyimpanan lewat Quiz.simpanSoalTerpilih().
   *
   * @param {Object} p { item_id, jumlah, komposisi{pg,benar_salah,isian,esai}, tingkat }
   */
  function generateSoal(sesi, p) {
    p = p || {};
    var ctx = _konteks(p.item_id, null);
    var item = ctx.item, ptm = ctx.pertemuan, kelas = ctx.kelas;

    if (item.tipe !== 'quiz') {
      throw _err('VALIDASI_GAGAL', 'Item ini bukan Quiz.');
    }

    var k = p.komposisi || {};
    var n_pg    = Math.max(0, Number(k.pg) || 0);
    var n_bs    = Math.max(0, Number(k.benar_salah) || 0);
    var n_isian = Math.max(0, Number(k.isian) || 0);
    var n_esai  = Math.max(0, Number(k.esai) || 0);
    var total   = n_pg + n_bs + n_isian + n_esai;

    if (total === 0) {
      throw _err('VALIDASI_GAGAL', 'Tentukan jumlah soal untuk tiap tipe.');
    }
    if (total > 20) {
      throw _err('VALIDASI_GAGAL',
        'Maksimal 20 soal sekali generate agar hasilnya tetap berkualitas.');
    }

    var tingkat = ['mudah', 'sedang', 'sulit'].indexOf(p.tingkat) >= 0
      ? p.tingkat : 'sedang';

    /* Soal bercerita (v1.5.5): sebagian dari total berbagi SATU wacana.
       Bukan tambahan di luar komposisi — guru meminta "dari 8 PG,
       4 di antaranya bercerita", sehingga totalnya tetap 8. */
    var nCerita = Math.max(0, Number(p.jml_bercerita) || 0);
    var jenis = JENIS_STIMULUS[p.jenis_stimulus] ? p.jenis_stimulus : 'kasus';

    if (nCerita === 1) {
      throw _err('VALIDASI_GAGAL',
        'Soal bercerita minimal 2 butir — satu wacana untuk satu soal ' +
        'tidak perlu dikelompokkan.');
    }
    if (nCerita > total) {
      throw _err('VALIDASI_GAGAL',
        'Soal bercerita (' + nCerita + ') melebihi jumlah soal (' +
        total + '). Soal bercerita adalah BAGIAN dari komposisi, ' +
        'bukan tambahan.');
    }

    /* materi pada pertemuan yang sama jadi rujukan isi soal */
    var judulMateri = Db.saringBaris('item', 'pertemuan_id', ptm.pertemuan_id,
      ['item_id', 'tipe', 'judul', 'tujuan_pembelajaran'])
      .filter(function (i) { return i.tipe === 'materi'; })
      .map(function (i) { return '- ' + i.judul; })
      .join('\n');

    var tujuan = item.tujuan_pembelajaran || ptm.tujuan_pembelajaran || '';

    var prompt =
      'Kamu penyusun soal evaluasi Kurikulum Merdeka Indonesia.\n\n' +
      _barisKonteks(kelas) + '\n\n' +
      'Pertemuan ' + ptm.urutan + ': "' + ptm.judul + '"\n' +
      (tujuan ? 'Tujuan Pembelajaran: ' + tujuan + '\n' : '') +
      (judulMateri ? 'Materi yang sudah dipelajari:\n' + judulMateri + '\n' : '') +
      '\nBuat tepat ' + total + ' soal dengan komposisi:\n' +
      (n_pg    ? '- ' + n_pg + ' pilihan ganda (tipe "pg", 4 opsi)\n' : '') +
      (n_bs    ? '- ' + n_bs + ' benar-salah (tipe "benar_salah")\n' : '') +
      (n_isian ? '- ' + n_isian + ' isian singkat (tipe "isian")\n' : '') +
      (n_esai  ? '- ' + n_esai + ' uraian (tipe "esai")\n' : '') +
      'Tingkat kesulitan: ' + tingkat + '\n\n' +
      'Aturan kunci jawaban:\n' +
      '- pg: kunci berupa HURUF opsi yang benar (A, B, C, atau D)\n' +
      '- benar_salah: kunci "Benar" atau "Salah", medan opsi dikosongkan\n' +
      '- isian: kunci berupa jawaban singkat; alternatif dipisah tanda |\n' +
      '- esai: kunci dikosongkan (dinilai manual guru)\n\n' +
      'Sertakan pembahasan singkat tiap soal dan bobot ' +
      '(1 untuk soal otomatis, 3-6 untuk uraian).\n' +
      'Konteks Indonesia' +
      (kelas.kompetensi_keahlian
        ? ', sesuai kompetensi keahlian ' + kelas.kompetensi_keahlian : '') + '.\n' +
      'Hindari jebakan bahasa; uji pemahaman konsep.\n' +
      _bagianStimulus(nCerita, jenis, total) +
      'Balas JSON dengan medan "soal" berisi larik soal.';

    var hasil = panggil(prompt, { skema: SKEMA_SOAL, suhu: 0.8 });
    var j = _parseJson(hasil.teks);

    var mentah = Array.isArray(j.soal) ? j.soal : [];
    if (!mentah.length) {
      throw _err('AI_FORMAT', 'AI tidak menghasilkan soal. Coba lagi.');
    }

    /* Normalisasi ringan. Validasi ketat tetap di Quiz.simpanSoalTerpilih()
       supaya aturan kunci hanya ditegakkan di SATU tempat. */
    var soal = mentah.map(function (s) {
      var tipe = String(s.tipe || 'pg').toLowerCase().trim();
      if (['pg', 'benar_salah', 'isian', 'esai'].indexOf(tipe) === -1) tipe = 'pg';
      var opsi = Array.isArray(s.opsi) ? s.opsi.map(function (o) {
        return String(o || '').trim();
      }).filter(function (o) { return o.length; }) : [];

      var kunci = String(s.kunci === undefined ? '' : s.kunci).trim();
      if (tipe === 'esai') kunci = '';
      if (tipe === 'benar_salah') opsi = [];

      return {
        tipe: tipe,
        pertanyaan: String(s.pertanyaan || '').trim(),
        opsi: opsi,
        kunci: kunci,
        bobot: Number(s.bobot) > 0 ? Number(s.bobot) : (tipe === 'esai' ? 5 : 1),
        pembahasan: String(s.pembahasan || '').trim(),
        tingkat: ['mudah', 'sedang', 'sulit'].indexOf(s.tingkat) >= 0
          ? s.tingkat : tingkat,
        sumber_ai: true,
        /* ditandai sementara; dipetakan ke grup_id di bawah */
        _cerita: s.pakai_stimulus === true
      };
    }).filter(function (s) { return s.pertanyaan.length > 0; });

    var stimulus = _rapikanStimulusAI(j.stimulus, nCerita);
    var infoGrup = _pasangGrupCerita(soal, stimulus, nCerita);

    _catatRiwayat({
      item_id: p.item_id, kelas_id: kelas.kelas_id,
      prompt_ringkas: 'soal: ' + total + ' butir tingkat ' + tingkat,
      konten_hasil: '', saran_soal: JSON.stringify(soal).slice(0, 10000),
      saran_lkpd: '',
      key_index: hasil.key_index, durasi_ms: hasil.durasi_ms,
      model: hasil.model, status: 'sukses', error: ''
    });

    Util.catatLog(sesi.user_id, 'generate_soal',
      p.item_id + ' | ' + soal.length + ' soal | key#' + hasil.key_index +
      ' | ' + hasil.model);

    return {
      soal: soal,
      jml: soal.length,
      diminta: total,
      /* dipakai layar tinjau untuk memberi tahu guru bila AI tidak
         menuruti permintaan bercerita */
      bercerita: {
        diminta: nCerita,
        jadi: infoGrup.jml,
        jenis: jenis,
        ada_stimulus: !!stimulus,
        peringatan: infoGrup.peringatan
      },
      key_index: hasil.key_index,
      durasi_ms: hasil.durasi_ms
    };
  }

  /** Bersihkan wacana dari AI; kosongkan bila tidak diminta. */
  function _rapikanStimulusAI(teks, nCerita) {
    if (nCerita < 2) return '';
    var t = String(teks || '').trim();
    if (!t) return '';

    /* Tabel Markdown → <table> SEBELUM apa pun. Bila dibiarkan, ia
       lolos ke murid sebagai deretan tanda | mentah. */
    t = _tabelMarkdownKeHtml(t);

    /* Sudah HTML? Jangan disentuh lagi.

       Versi sebelumnya menjalankan escapeHtml() pada blok yang tidak
       diawali "<p", sehingga wacana yang dibuka <table> berubah jadi
       &lt;table&gt; — tabelnya tampil sebagai kode mentah. Pemeriksaan
       harus mengenali SEMUA tag blok yang diizinkan, bukan <p> saja. */
    var sudahHtml = /<(p|table|ul|ol|h2|h3|h4|blockquote|pre|div)\b/i.test(t);

    if (!sudahHtml) {
      t = t.split(/\n\s*\n/)
        .filter(function (b) { return b.trim().length; })
        .map(function (b) {
          return '<p>' + Util.escapeHtml(b.trim()).split('\n').join('<br>') + '</p>';
        }).join('');
    } else {
      /* Sebagian HTML, sebagian teks polos — kerap terjadi bila model
         menaruh <table> di tengah paragraf biasa. Bungkus barisan
         teks telanjang saja, tag yang sudah ada dibiarkan utuh. */
      t = t.split(/\n\s*\n/)
        .filter(function (b) { return b.trim().length; })
        .map(function (b) {
          var x = b.trim();
          if (/^</.test(x)) return x;
          return '<p>' + Util.escapeHtml(x).split('\n').join('<br>') + '</p>';
        }).join('');
    }

    /* Pemangkasan dilakukan SETELAH pembentukan HTML dan memotong di
       batas TAG, bukan di tengah-tengahnya. Memotong di tengah
       "<table>" menyisakan markup rusak yang dibuang sanitasi —
       seluruh tabel lenyap. */
    if (t.length > MAKS_STIMULUS_AI) {
      var potong = t.slice(0, MAKS_STIMULUS_AI - 20);
      var tutup = potong.lastIndexOf('>');
      t = (tutup > 100 ? potong.slice(0, tutup + 1) : potong) + '<p>…</p>';
    }

    /* jaring pengaman terakhir — tidak boleh melewati batas Quiz */
    if (t.length > MAKS_STIMULUS_AI) t = t.slice(0, MAKS_STIMULUS_AI);
    return t;
  }

  /**
   * Tandai soal bercerita dengan grup_id + stimulus.
   *
   * Model tidak selalu menuruti jumlah yang diminta — kadang menandai
   * terlalu banyak, terlalu sedikit, atau lupa sama sekali. Semua
   * penyimpangan itu DIRAPIKAN di sini lalu DILAPORKAN ke guru; tidak
   * ada yang diperbaiki diam-diam.
   *
   * Nama grup memakai penanda sementara 'AI1'; Quiz.simpanSoalTerpilih()
   * memetakannya ke GRP-xxxx yang sesungguhnya.
   */
  function _pasangGrupCerita(soal, stimulus, nCerita) {
    var out = { jml: 0, peringatan: '' };

    if (nCerita < 2) {
      soal.forEach(function (s) { delete s._cerita; });
      return out;
    }

    if (!stimulus) {
      soal.forEach(function (s) { delete s._cerita; });
      out.peringatan = 'AI tidak menyertakan teks wacana — ' +
        'soal disimpan tanpa kelompok.';
      return out;
    }

    var idx = [];
    soal.forEach(function (s, i) { if (s._cerita) idx.push(i); });

    /* Tidak ada yang ditandai: ambil sejumlah soal pertama sebagai
       tebakan terbaik, dan katakan terus terang pada guru. */
    if (!idx.length) {
      for (var a = 0; a < Math.min(nCerita, soal.length); a++) idx.push(a);
      out.peringatan = 'AI tidak menandai soal mana yang memakai wacana. ' +
        idx.length + ' soal pertama dikelompokkan — periksa apakah ' +
        'benar-benar merujuk wacananya.';
    } else if (idx.length > nCerita) {
      out.peringatan = 'AI menandai ' + idx.length + ' soal bercerita, ' +
        'diminta ' + nCerita + '. Semuanya tetap dikelompokkan.';
    } else if (idx.length < nCerita) {
      out.peringatan = 'AI hanya membuat ' + idx.length +
        ' soal bercerita dari ' + nCerita + ' yang diminta.';
    }

    /* Satu anggota tidak bermakna sebagai kelompok (aturan v1.4.1 B3);
       Quiz._rapikanStimulus() akan membubarkannya. Lebih baik tidak
       dibentuk sejak awal. */
    if (idx.length < 2) {
      soal.forEach(function (s) { delete s._cerita; });
      out.peringatan = 'AI hanya menandai ' + idx.length +
        ' soal bercerita — kelompok butuh minimal 2, jadi dibatalkan.';
      return out;
    }

    /* Anggota kelompok harus BERDAMPINGAN (aturan v1.4.0): pindahkan
       ke posisi anggota pertama, urutan relatifnya dijaga.

       `idx` adalah SATU-SATUNYA sumber kebenaran di sini — bukan
       penanda _cerita. Pada jalur tebakan (AI tidak menandai apa pun),
       idx diisi sendiri sementara _cerita seluruhnya false; menghitung
       "sisanya" dari _cerita membuat anggota tersalin DUA KALI dan
       5 soal berubah jadi 8. */
    var anggotaIdx = {};
    idx.forEach(function (i) { anggotaIdx[i] = true; });

    var anggota = idx.map(function (i) { return soal[i]; });
    var lain = soal.filter(function (s, i) { return !anggotaIdx[i]; });

    /* posisi diukur pada larik ASAL; setelah anggota diangkat, jumlah
       soal sebelum titik sisip bisa lebih sedikit. */
    var sebelum = 0;
    for (var q = 0; q < idx[0]; q++) if (!anggotaIdx[q]) sebelum++;

    var urut = lain.slice(0, sebelum).concat(anggota, lain.slice(sebelum));
    soal.length = 0;
    urut.forEach(function (s) { soal.push(s); });

    /* stimulus HANYA pada anggota pertama — aturan hemat payload §9.10 */
    anggota.forEach(function (s) { s.grup_id = 'AI1'; s.stimulus = ''; });
    anggota[0].stimulus = stimulus;
    soal.forEach(function (s) { delete s._cerita; });

    out.jml = anggota.length;
    return out;
  }

  /* ==================================================== KERANGKA */

  var SKEMA_KERANGKA = {
    type: 'OBJECT',
    properties: {
      pertemuan: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            /* `bab` SEMPAT hilang dari skema ini (v1.8.4–1.8.5).
               Prompt memintanya, tetapi `responseSchema` tidak
               mendaftarkannya — dan keluaran terstruktur Gemini hanya
               memuat medan yang terdaftar. Akibatnya `bab` selalu
               kosong dan `bab_kosong` selalu menyala. Menambah medan
               di prompt SAJA tidak cukup (§6.2 no. 40). */
            bab:                 { type: 'STRING' },
            judul:               { type: 'STRING' },
            tujuan_pembelajaran: { type: 'STRING' },
            jumlah_materi:       { type: 'NUMBER' },
            perlu_lkpd:          { type: 'BOOLEAN' },
            perlu_kelompok:      { type: 'BOOLEAN' },
            perlu_quiz:          { type: 'BOOLEAN' },
            perlu_refleksi:      { type: 'BOOLEAN' }
          },
          required: ['judul', 'tujuan_pembelajaran']
        }
      }
    },
    required: ['pertemuan']
  };

  /**
   * Susun kerangka pertemuan satu kelas (§8.2 Cara B).
   * Hanya USULAN — pembuatan pertemuan dilakukan terpisah setelah
   * guru menyunting tabelnya.
   */
  function generateKerangka(sesi, kelasId, jumlah) {
    var kelas = Db.cariBarisCache('kelas', 'kelas_id', kelasId);
    if (!kelas) throw _err('TIDAK_DITEMUKAN', 'Kelas tidak ditemukan.');

    if (Util.kosong(kelas.capaian_pembelajaran)) {
      throw _err('VALIDASI_GAGAL',
        'Isi Capaian Pembelajaran kelas dahulu — itu bahan utama AI.');
    }

    var n = Number(jumlah) || 0;
    if (n < 1 || n > 20) {
      throw _err('VALIDASI_GAGAL', 'Jumlah pertemuan antara 1 dan 20.');
    }

    var prompt =
      'Kamu perancang kurikulum Kurikulum Merdeka.\n' +
      _barisKonteks(kelas) + '\n' +
      (kelas.alokasi_jp ? 'Alokasi: ' + kelas.alokasi_jp + ' JP\n' : '') +
      '\nBerdasarkan CP/ATP di atas, susun ' + n + ' pertemuan berurutan ' +
      'dari paling dasar ke paling lanjut.\n\n' +
      'Tiap pertemuan keluarkan: judul (maksimal 60 karakter), ' +
      'tujuan_pembelajaran (1 kalimat memakai kata kerja operasional), ' +
      'jumlah_materi (1-3), perlu_lkpd, perlu_kelompok, perlu_quiz, ' +
      'perlu_refleksi (semuanya true/false), dan bab.\n\n' +

      'JENIS KEGIATAN — pilih yang paling masuk akal, jangan asal ' +
      'semuanya true:\n' +
      '  - perlu_lkpd: kerja MANDIRI terpandu (langkah kerja, ' +
      'pengamatan, latihan konfigurasi sendiri)\n' +
      '  - perlu_kelompok: tugas yang memang menuntut DISKUSI dan ' +
      'keputusan bersama (merancang, membandingkan, menganalisis ' +
      'kasus, proyek). Jangan diberikan pada pertemuan pengantar ' +
      'teori; sasaran sekitar 1 dari 4 pertemuan\n' +
      '  - perlu_quiz: ada konsep yang layak diukur ketuntasannya\n' +
      '  - perlu_refleksi: pertemuan penutup bab atau pertemuan berat ' +
      'yang perlu murid menimbang cara belajarnya. Sasaran 1 per bab, ' +
      'letakkan di pertemuan TERAKHIR bab itu\n' +
      '  - satu pertemuan sebaiknya TIDAK memuat LKPD dan Tugas ' +
      'Kelompok sekaligus — pilih salah satu\n\n' +

      'MEDAN `bab` — pengelompokan pertemuan menjadi Materi Pokok:\n' +
      '  - kelompokkan pertemuan yang satu tema ke dalam bab yang sama\n' +
      '  - tulis judul babnya, misalnya "Konsep dan Konfigurasi VLAN"\n' +
      '  - JANGAN memberi awalan nomor ("Bab 1:") — penomoran ' +
      'ditambahkan sistem\n' +
      '  - pertemuan satu bab HARUS berurutan, jangan diselang-seling\n' +
      '  - sasaran 3-5 pertemuan per bab; hindari bab berisi satu ' +
      'pertemuan kecuali temanya memang berdiri sendiri\n\n' +

      'Balas JSON dengan medan "pertemuan" berisi larik.';

    var hasil = panggil(prompt, { skema: SKEMA_KERANGKA, suhu: 0.6 });
    var j = _parseJson(hasil.teks);

    var mentah = Array.isArray(j.pertemuan) ? j.pertemuan : [];
    if (!mentah.length) {
      throw _err('AI_FORMAT', 'AI tidak menghasilkan kerangka. Coba lagi.');
    }

    var daftar = mentah.slice(0, n).map(function (x, i) {
      /* Awalan nomor dari AI dibuang — sistem yang menomori bab.
         Tanpa ini muncul "Bab 1: Bab 1: VLAN" di layar. */
      var bab = String(x.bab || '').trim()
        .replace(/^\s*(bab|unit|materi pokok)\s*\d*\s*[:.\-]?\s*/i, '')
        .slice(0, 150);

      return {
        urutan: i + 1,
        judul: String(x.judul || 'Pertemuan ' + (i + 1)).trim().slice(0, 120),
        tujuan_pembelajaran: String(x.tujuan_pembelajaran || '').trim().slice(0, 500),
        jumlah_materi: Math.min(3, Math.max(1, Number(x.jumlah_materi) || 1)),
        perlu_lkpd: x.perlu_lkpd === true,
        /* Tugas Kelompok & Refleksi (v1.8.6). Keduanya sudah menjadi
           tipe item sah sejak v1.7.0 dan v0.6.0, tetapi kerangka tidak
           pernah membuatnya — guru harus menambahkannya satu per satu
           setelah 15 pertemuan terbentuk. */
        perlu_kelompok: x.perlu_kelompok === true,
        perlu_quiz: x.perlu_quiz === true,
        perlu_refleksi: x.perlu_refleksi === true,
        bab: bab
      };
    });

    /* Bila AI melewatkan medan `bab`, seluruhnya jatuh ke satu bab —
       perilaku lama, tetapi TIDAK didiamkan: `bab_kosong` memberi
       tahu guru mengapa hasilnya tidak terkelompok (§6.2 no. 26). */
    var tanpaBab = daftar.filter(function (x) { return !x.bab; }).length;
    if (tanpaBab) {
      daftar.forEach(function (x) {
        if (!x.bab) x.bab = String(kelas.mapel || 'Materi Pokok');
      });
    }

    _catatRiwayat({
      item_id: '', kelas_id: kelasId,
      prompt_ringkas: 'kerangka: ' + n + ' pertemuan',
      konten_hasil: JSON.stringify(daftar).slice(0, 10000),
      saran_soal: '', saran_lkpd: '',
      key_index: hasil.key_index, durasi_ms: hasil.durasi_ms,
      model: hasil.model, status: 'sukses', error: ''
    });

    Util.catatLog(sesi.user_id, 'generate_kerangka',
      kelasId + ' | ' + daftar.length + ' pertemuan');

    /* daftar bab UNIK sesuai urutan kemunculan */
    var bab = [], lihat = {};
    daftar.forEach(function (x) {
      if (!lihat[x.bab]) { lihat[x.bab] = true; bab.push(x.bab); }
    });

    /* `model` ikut dikembalikan seperti generator lain. Tanpa ini
       diagnostik melaporkan "model -" dan tidak ada jejak model mana
       yang menyusun kerangka — padahal rotasi model membuat hasilnya
       bisa berbeda antar percobaan (v1.8.7). */
    return { pertemuan: daftar, jml: daftar.length,
             bab: bab, jml_bab: bab.length, bab_kosong: tanpaBab,
             model: hasil.model,
             key_index: hasil.key_index, durasi_ms: hasil.durasi_ms };
  }

  /**
   * Wujudkan kerangka jadi pertemuan + item, semuanya berstatus DRAF.
   * Dipanggil setelah guru menyunting tabel usulan.
   */
  function terapkanKerangka(sesi, kelasId, daftar) {
    var kelas = Db.cariBarisCache('kelas', 'kelas_id', kelasId);
    if (!kelas) throw _err('TIDAK_DITEMUKAN', 'Kelas tidak ditemukan.');
    if (!daftar || !daftar.length) {
      throw _err('VALIDASI_GAGAL', 'Tidak ada pertemuan yang dipilih.');
    }
    if (daftar.length > 20) {
      throw _err('VALIDASI_GAGAL', 'Maksimal 20 pertemuan sekali terap.');
    }

    /* Penomoran TIDAK dihitung di sini.

       `Pertemuan.simpan()` mengabaikan `urutan` yang dikirim dan
       menghitungnya sendiri DALAM materi pokok — itulah sumber
       kebenarannya. Versi lama menghitung `maks + i + 1` dari seluruh
       kelas lalu mengirimkannya; nilai itu tidak pernah dipakai, dan
       rumusnya pun keliru (penomoran per-kelas, bukan per-bab).

       Kode mati yang tampak benar lebih berbahaya daripada tidak ada:
       pembaca berikutnya akan mengira penomoran ditangani di sini
       (v1.8.2). */
    var jmlPtm = 0, jmlItem = 0, jmlBab = 0;

    /* --- Materi Pokok per bab (v1.8.4) ---

       Versi lama tidak pernah membuat bab: `Pertemuan.simpan()`
       dipanggil tanpa `mp_id`, lalu `_mpBawaan()` melemparkan SEMUA
       pertemuan ke bab pertama yang kebetulan ada. Akibatnya 15
       pertemuan menumpuk jadi satu bab (laporan lapangan v1.8.4).

       Bab dibuat SEKALI per judul unik, lalu dipakai ulang — bukan
       satu bab per pertemuan. Judul yang sama persis dengan bab yang
       SUDAH ADA di kelas ini dipakai kembali, supaya menjalankan
       kerangka dua kali tidak melahirkan bab kembar. */
    /* Log ditumpuk selama penerapan, disiram sekali di `finally`.

       Tiap `simpanItem()` memanggil `catatLog()`, dan tiap
       `catatLog()` adalah satu penulisan sheet. Menerapkan 20
       pertemuan berisi 5 item = 120+ penulisan ke sheet `log` —
       sebanyak penulisan data yang sebenarnya (v1.8.7). */
    Util.mulaiTumpukLog();

    var babAda = {};
    Db.saringBaris('materi_pokok', 'kelas_id', kelasId,
      ['mp_id', 'judul']).forEach(function (m) {
        babAda[String(m.judul || '').trim().toLowerCase()] = m.mp_id;
      });

    function mpUntuk(judulBab) {
      var bersih = String(judulBab || '').trim().slice(0, 150);
      if (!bersih) bersih = String(kelas.mapel || 'Materi Pokok');
      var kunci = bersih.toLowerCase();

      if (babAda[kunci]) return babAda[kunci];

      var baru = MateriPokok.simpan(sesi, {
        kelas_id: kelasId,
        judul: bersih,
        /* Bab ikut DRAF — seluruh hasil kerangka tidak boleh terlihat
           murid sebelum guru menerbitkannya (§8.1). */
        status: 'draft'
      }).mp_id;
      babAda[kunci] = baru;
      jmlBab++;
      return baru;
    }

    try {
      daftar.forEach(function (p, i) {
        var judul = String(p.judul || '').trim();
        if (!judul) return;

        var hasil = Pertemuan.simpan(sesi, {
          mp_id: mpUntuk(p.bab),
          kelas_id: kelasId,
          judul: judul.slice(0, 120),
          tujuan_pembelajaran: String(p.tujuan_pembelajaran || '').slice(0, 500),
          wajib: true, urut_ketat: true,
          status: 'draft'                       /* selalu draf (§8.1) */
        });
        jmlPtm++;

        var urut = 1;
        var nMateri = Math.min(3, Math.max(1, Number(p.jumlah_materi) || 1));
        for (var m = 0; m < nMateri; m++) {
          Pertemuan.simpanItem(sesi, {
            pertemuan_id: hasil.pertemuan_id, tipe: 'materi',
            judul: nMateri > 1 ? (judul + ' — bagian ' + (m + 1)) : judul,
            tujuan_pembelajaran: String(p.tujuan_pembelajaran || '').slice(0, 500),
            urutan: urut++, wajib: true, status: 'draft'
          });
          jmlItem++;
        }
        if (p.perlu_lkpd === true) {
          Pertemuan.simpanItem(sesi, {
            pertemuan_id: hasil.pertemuan_id, tipe: 'lkpd',
            judul: 'LKPD — ' + judul.slice(0, 100),
            urutan: urut++, wajib: true, status: 'draft'
          });
          jmlItem++;
        }
        /* Tugas Kelompok sesudah LKPD, sebelum Quiz — urutannya
           mengikuti alur pembelajaran: berlatih sendiri, berdiskusi,
           lalu diukur (v1.8.6). */
        if (p.perlu_kelompok === true) {
          Pertemuan.simpanItem(sesi, {
            pertemuan_id: hasil.pertemuan_id, tipe: 'tugas_kelompok',
            judul: 'Tugas Kelompok — ' + judul.slice(0, 100),
            tujuan_pembelajaran: String(p.tujuan_pembelajaran || '').slice(0, 500),
            urutan: urut++, wajib: true, status: 'draft'
          });
          jmlItem++;
        }
        if (p.perlu_quiz === true) {
          Pertemuan.simpanItem(sesi, {
            pertemuan_id: hasil.pertemuan_id, tipe: 'quiz',
            judul: 'Quiz — ' + judul.slice(0, 100),
            urutan: urut++, wajib: true, kkm: 75, max_percobaan: 2,
            status: 'draft'
          });
          jmlItem++;
        }
        /* Refleksi selalu paling akhir — murid menimbang cara
           belajarnya SETELAH menjalani kegiatannya (§6.5).

           `konten` sengaja dibiarkan kosong: pertanyaannya disusun guru
           lewat panel Refleksi (tombol ✨), bukan ditebak di sini.
           Item refleksi tanpa pertanyaan tetap sah sebagai draf. */
        if (p.perlu_refleksi === true) {
          Pertemuan.simpanItem(sesi, {
            pertemuan_id: hasil.pertemuan_id, tipe: 'refleksi',
            judul: 'Refleksi — ' + judul.slice(0, 100),
            urutan: urut++, wajib: true, status: 'draft'
          });
          jmlItem++;
        }
      });

      Util.catatLog(sesi.user_id, 'terap_kerangka',
        kelasId + ' | ' + jmlBab + ' bab, ' + jmlPtm + ' pertemuan, ' +
        jmlItem + ' item');
    } finally {
      /* `finally` — bila penerapan gagal di tengah, log pertemuan
         yang TERLANJUR dibuat tetap tersimpan. Tanpa ini jejaknya
         hilang justru pada saat paling dibutuhkan. */
      Util.siramTumpukLog();
    }

    return { pertemuan: jmlPtm, item: jmlItem, bab: jmlBab };
  }

  /* ==================================================== RIWAYAT */

  function _catatRiwayat(d) {
    try {
      Db.tambah('materi_ai', {
        ai_id: Util.buatId('AI'),
        item_id: d.item_id || '',
        kelas_id: d.kelas_id || '',
        prompt_ringkas: String(d.prompt_ringkas || '').slice(0, 500),
        konten_hasil: String(d.konten_hasil || '').slice(0, 20000),
        saran_soal: String(d.saran_soal || '').slice(0, 10000),
        saran_lkpd: String(d.saran_lkpd || '').slice(0, 10000),
        model: d.model || MODEL,
        key_index: d.key_index === undefined ? '' : d.key_index,
        token_terpakai: '',
        durasi_ms: d.durasi_ms || 0,
        status: d.status || 'sukses',
        error: String(d.error || '').slice(0, 500),
        dibuat_at: Util.sekarang()
      });
    } catch (e) { /* riwayat gagal tidak boleh membatalkan hasil */ }
  }

  /** Riwayat generate untuk satu item. */
  function riwayat(itemId) {
    return Db.saringBaris('materi_ai', 'item_id', itemId,
      ['ai_id', 'prompt_ringkas', 'model', 'key_index',
       'durasi_ms', 'status', 'dibuat_at'])
      .sort(function (a, b) {
        return String(b.dibuat_at).localeCompare(String(a.dibuat_at));
      })
      .slice(0, 20)
      .map(function (r) {
        return {
          ai_id: r.ai_id,
          prompt_ringkas: r.prompt_ringkas,
          model: r.model,
          key_index: r.key_index,
          durasi_ms: r.durasi_ms,
          status: r.status,
          dibuat_at: r.dibuat_at ? Util.formatTanggal(r.dibuat_at) : ''
        };
      });
  }

  return {
    /* key */
    simpanKeys: simpanKeys,
    statusKeys: statusKeys,
    simpanModel: simpanModel,
    resetCooldown: resetCooldown,

    /* panggilan */
    panggil: panggil,

    /* generator */
    generateMateri: generateMateri,
    generateKegiatan: generateKegiatan,
    generateRefleksi: generateRefleksi,
    generateSoal: generateSoal,
    generateKerangka: generateKerangka,
    terapkanKerangka: terapkanKerangka,
    riwayat: riwayat,

    /* dipakai modul lain & uji */
    /* Skema dibuka supaya ujiTahap16() dapat memeriksanya di Apps
       Script sungguhan. Medan yang hanya disebut prompt tetapi tidak
       terdaftar di sini DIBUANG diam-diam oleh keluaran terstruktur
       Gemini — bug `bab` v1.8.4 yang baru ketahuan di v1.8.6. */
    _skemaKerangka: function () { return SKEMA_KERANGKA; },
    _parseJson: _parseJson,
    _bersihkanJson: _bersihkanJson,
    _ambilTeks: _ambilTeks,
    _terpotong: _terpotong,
    MODEL: MODEL,
    MODEL_BAWAAN: MODEL_BAWAAN
  };
})();
