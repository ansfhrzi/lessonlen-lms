/**
 * ============================================================
 *  LessonLen — Belajar.gs
 *  Sisi murid: buka pertemuan, baca materi per bagian,
 *  tandai selesai, unlock logic 2 tingkat
 * ------------------------------------------------------------
 *  Acuan: KESEPAKATAN-SISTEM.md v4.7 §3.3, §4.3, §5
 *
 *  ATURAN KEAMANAN:
 *   - seluruh pengecekan kunci dilakukan di SERVER
 *   - konten item terkunci TIDAK PERNAH dikirim ke klien
 * ============================================================
 */

var Belajar = (function () {

  /* ==================================================== bantu */

  function _err(kode, pesan) {
    var e = new Error(pesan);
    e.kode = kode;
    return e;
  }

  /** Pastikan murid benar-benar terdaftar di kelas tersebut. */
  function _cekEnroll(userId, kelasId) {
    var ada = Db.saringKolom('enrollment',
      { user_id: userId, kelas_id: kelasId, status: 'aktif' }, ['enroll_id']);
    if (!ada.length) {
      throw _err('AKSES_DITOLAK', 'Anda tidak terdaftar di kelas ini.');
    }
  }

  /**
   * Hitung status seluruh pertemuan dalam satu kelas — unlock tingkat 1.
   * @returns {Array} pertemuan berurutan beserta terbuka/selesai
   */
  function _statusPertemuan(kelasId, petaProg, semuaPtm, semuaItem, mpId) {
    var ptm = semuaPtm
      .filter(function (p) {
        if (p.kelas_id !== kelasId || p.status !== 'publish') return false;
        /* bila mpId diberikan, batasi pada materi pokok itu saja */
        return mpId === undefined || String(p.mp_id || '') === String(mpId);
      })
      .sort(function (a, b) { return Number(a.urutan) - Number(b.urutan); });

    var itemPer = {};
    semuaItem.forEach(function (i) {
      if (i.status !== 'publish') return;
      (itemPer[i.pertemuan_id] = itemPer[i.pertemuan_id] || []).push(i);
    });

    var lolos = true;
    return ptm.map(function (p) {
      var items = itemPer[p.pertemuan_id] || [];
      var wajib = items.filter(function (i) { return i.wajib === true; });
      var beres = wajib.filter(function (i) {
        var pr = petaProg[i.item_id];
        return pr && pr.status === 'selesai';
      });
      /* Pertemuan tanpa item wajib dianggap SELESAI.
         Tanpa ini, pertemuan kosong (atau yang seluruh itemnya opsional)
         tidak pernah bisa dituntaskan dan mengunci seluruh pertemuan
         sesudahnya secara permanen. */
      var selesai = wajib.length === 0 || beres.length === wajib.length;
      var terbuka = lolos;

      if (p.wajib === true && !selesai) lolos = false;

      return {
        pertemuan_id: p.pertemuan_id,
        mp_id: p.mp_id || '',
        urutan: Number(p.urutan),
        judul: p.judul,
        deskripsi: p.deskripsi,
        tujuan_pembelajaran: p.tujuan_pembelajaran,
        jenis: p.jenis || 'biasa',
        wajib: p.wajib === true,
        urut_ketat: p.urut_ketat === true,
        terbuka: terbuka,
        selesai: selesai,
        jml_item: items.length,
        jml_wajib: wajib.length,
        item_selesai: beres.length,
        progres: wajib.length ? Math.round(beres.length / wajib.length * 100)
                              : (items.length ? 0 : 100),
        kosong: items.length === 0,
        status: selesai ? 'selesai' : (!terbuka ? 'terkunci' : 'berjalan'),

        /* Daftar item ikut dikirim (v1.14.0) — permintaan guru:
           "pada bagian pertemuan tampilkan item nya, jadi alurnya
           lebih singkat tidak terlalu banyak klik".
         *
         * Sebelumnya layar Daftar Isi hanya memuat CACAH item
         * (`jml_item`), sehingga murid harus membuka pertemuan dulu
         * baru melihat isinya — dua klik untuk sampai ke satu materi.
         *
         * `_statusItem()` dipanggil apa pun keadaan pertemuannya:
         * guru memilih item pada pertemuan terkunci tetap TAMPIL
         * dengan gembok, supaya murid tahu apa yang menanti. Kunci
         * per-item tetap dihormati — `terbuka` di bawah selalu false
         * bila pertemuannya belum terbuka, jadi tidak ada jalan
         * pintas.
         *
         * Hanya kolom yang dipakai layar yang dikirim; `deskripsi`
         * dan `tujuan_pembelajaran` sengaja TIDAK ikut agar payload
         * tidak membengkak (§6.2 no. 43). */
        item: _statusItem(p, items, petaProg).map(function (i) {
          return {
            item_id: i.item_id,
            tipe: i.tipe,
            urutan: i.urutan,
            judul: i.judul,
            wajib: i.wajib,
            terbuka: terbuka && i.terbuka,
            status: i.status,
            jml_bagian: i.jml_bagian,
            bagian_terakhir: i.bagian_terakhir,
            nilai: i.nilai
          };
        })
      };
    });
  }

  /**
   * Hitung status seluruh MATERI POKOK satu kelas — unlock tingkat 0.
   *
   * Materi Pokok berikutnya terkunci sampai yang sebelumnya tuntas,
   * mengikuti aturan yang sama dengan antar-pertemuan. Materi pokok
   * yang tidak wajib tidak pernah mengunci penerusnya.
   *
   * @returns {Array} materi pokok berurutan, masing-masing memuat
   *                  daftar pertemuannya
   */
  function _statusMateriPokok(kelasId, petaProg, semuaMp, semuaPtm, semuaItem) {
    var mp = semuaMp
      .filter(function (m) {
        return m.kelas_id === kelasId && m.status === 'publish';
      })
      .sort(function (a, b) { return Number(a.urutan) - Number(b.urutan); });

    var lolos = true;

    return mp.map(function (m) {
      var ptm = _statusPertemuan(kelasId, petaProg, semuaPtm, semuaItem,
                                 m.mp_id);

      var wajib = ptm.filter(function (p) { return p.wajib; });
      var beres = wajib.filter(function (p) { return p.selesai; });

      /* Materi pokok tanpa pertemuan wajib dianggap selesai — kalau
         tidak, bab kosong mengunci seluruh sisanya selamanya. */
      var selesai = wajib.length === 0 || beres.length === wajib.length;
      var terbukaMp = lolos;

      if (m.wajib === true && !selesai) lolos = false;

      /* Pertemuan hanya benar-benar terbuka bila materi pokoknya juga
         terbuka. Tanpa ini murid bisa melompati seluruh bab. */
      if (!terbukaMp) {
        ptm.forEach(function (p) {
          p.terbuka = false;
          p.status = 'terkunci';
        });
      }

      return {
        mp_id: m.mp_id,
        urutan: Number(m.urutan),
        judul: m.judul,
        deskripsi: m.deskripsi,
        tujuan_pembelajaran: m.tujuan_pembelajaran,
        wajib: m.wajib === true,
        urut_ketat: m.urut_ketat === true,
        terbuka: terbukaMp,
        selesai: selesai,
        jml_pertemuan: ptm.length,
        jml_wajib: wajib.length,
        pertemuan_selesai: beres.length,
        progres: wajib.length
          ? Math.round(beres.length / wajib.length * 100)
          : (ptm.length ? 0 : 100),
        kosong: ptm.length === 0,
        status: selesai ? 'selesai' : (!terbukaMp ? 'terkunci' : 'berjalan'),
        pertemuan: ptm
      };
    });
  }

  /** Ratakan hasil _statusMateriPokok jadi satu larik pertemuan. */
  function _ratakan(daftarMp) {
    var hasil = [];
    daftarMp.forEach(function (m) {
      m.pertemuan.forEach(function (p) { hasil.push(p); });
    });
    return hasil;
  }

  /**
   * Hitung status item dalam satu pertemuan — unlock tingkat 2.
   * Bila `urut_ketat`, materi dikerjakan berurutan dan LKPD/Quiz
   * baru terbuka setelah seluruh materi wajib selesai.
   */
  function _statusItem(pertemuan, items, petaProg) {
    var urut = items
      .filter(function (i) { return i.status === 'publish'; })
      .sort(function (a, b) { return Number(a.urutan) - Number(b.urutan); });

    var materiWajibBeres = urut
      .filter(function (i) { return i.tipe === 'materi' && i.wajib === true; })
      .every(function (i) {
        var pr = petaProg[i.item_id];
        return pr && pr.status === 'selesai';
      });

    var lolosMateri = true;

    return urut.map(function (i) {
      var pr = petaProg[i.item_id];
      var selesai = pr && pr.status === 'selesai';
      var terbuka;

      if (!pertemuan.urut_ketat)    terbuka = true;
      else if (i.tipe === 'materi') terbuka = lolosMateri;
      else                          terbuka = materiWajibBeres;

      /* Bila PERTEMUANNYA sendiri masih terkunci (unlock tingkat 1),
         tidak ada item yang boleh terbuka karena aturan biasa — hanya
         yang dibuka paksa guru.

         Tanpa penjaga ini, membuka SATU item membuat detailPertemuan()
         lolos, lalu SELURUH item di pertemuan itu ikut terbuka. Guru
         bermaksud membuka satu LKPD susulan, yang terjadi seluruh
         pertemuan terbuka (v1.8.0). */
      if (pertemuan.terkunci === true) terbuka = false;

      if (pr && pr.dibuka_paksa === true) terbuka = true;

      if (i.tipe === 'materi' && i.wajib === true && !selesai) lolosMateri = false;

      var status = selesai ? 'selesai'
                 : !terbuka ? 'terkunci'
                 : (pr && pr.status === 'menunggu') ? 'menunggu'
                 : (pr && pr.status === 'gagal') ? 'gagal'
                 : (pr ? 'berjalan' : 'belum');

      return {
        item_id: i.item_id,
        tipe: i.tipe,
        urutan: Number(i.urutan),
        judul: i.judul,
        deskripsi: i.deskripsi,
        tujuan_pembelajaran: i.tujuan_pembelajaran,
        wajib: i.wajib === true,
        terbuka: terbuka,
        status: status,
        jml_bagian: Number(i.jml_bagian) || 0,
        bagian_terakhir: pr ? (Number(pr.bagian_terakhir) || 0) : 0,
        min_durasi_detik: Number(i.min_durasi_detik) || 0,
        kkm: i.kkm,
        nilai: pr ? pr.nilai : '',
        alasan_kunci: terbuka ? '' : (i.tipe === 'materi'
          ? 'Selesaikan materi sebelumnya dahulu'
          : 'Selesaikan seluruh materi wajib dahulu')
      };
    });
  }

  /**
   * Bulatkan & jepit nomor bagian ke rentang 1..total.
   * Menerima masukan apa pun (pecahan, teks, null) tanpa error.
   */
  function _nomorBagian(v, total) {
    var n = Math.floor(Number(v));
    if (!isFinite(n) || n < 1) n = 1;
    return Math.max(1, Math.min(total, n));
  }

  /**
   * Ambil progres murid sebagai peta {item_id: baris}.
   *
   * Sheet `progress` mencapai puluhan ribu baris sementara satu murid
   * hanya memiliki puluhan. Hasilnya di-cache per murid dengan kunci
   * ber-epoch: setiap penulisan ke sheet progress/item/pertemuan
   * memajukan epoch sehingga cache lama otomatis kedaluwarsa
   * (lihat Db.invalidasi dan Beranda.invalidasiProgres).
   */
  /** Kunci cache progres murid pada epoch saat ini.
      Epoch gabungan: global (struktur kelas) + per murid (progres). */
  function _kunciProg(userId) {
    return 'bprog_' + userId + '_' + Db.epochProgres(userId);
  }

  /**
   * Nomor baris progres satu murid pada satu item, HANYA bila sudah
   * ada di cache. Tidak pernah membaca sheet — pemanggil wajib
   * menyediakan jalur cadangan bila hasilnya null.
   */
  function barisProgresCache(userId, itemId) {
    try {
      var c = CacheService.getScriptCache().get(_kunciProg(userId));
      if (!c) return null;
      var peta = JSON.parse(c);
      return peta[itemId] && peta[itemId]._baris ? peta[itemId]._baris : null;
    } catch (e) { return null; }
  }

  function _progresMurid(userId) {
    var kunci = _kunciProg(userId);
    try {
      var c = CacheService.getScriptCache().get(kunci);
      if (c) return JSON.parse(c);
    } catch (e) { /* cache rusak → baca ulang */ }

    /* `saringBaris` memindai kolom `user_id` SELURUH sheet untuk
       menemukan baris satu murid. Pada sekolah penuh itu 32.400 sel
       demi ±75 baris yang dicari — terukur 33.648 sel, dua pertiga
       dari seluruh biaya membuka quiz (v1.8.11).

       Cache 300 detik di atas menutupinya pada pemanggilan kedua dan
       seterusnya, TETAPI pemanggilan pertama tiap murid tetap
       membayar penuh — dan itulah yang dialami murid saat menekan
       "Mulai Quiz" pertama kali di jam pelajaran.

       Belum diperbaiki: memperbaikinya butuh kolom indeks atau sheet
       progress per-semester (§OPT-E peta jalan). Dicatat di sini
       supaya tidak terlupakan, dan dijaga `perf16` agar tidak
       memburuk diam-diam. */
    var baris = Db.saringBaris('progress', 'user_id', userId,
      ['item_id', 'status', 'bagian_terakhir', 'nilai', 'dibuka_paksa']);
    var peta = {};
    /* _baris ikut disimpan agar penulisan berikutnya bisa langsung
       menuju barisnya tanpa memindai ulang seluruh sheet. Nomor itu
       juga dititipkan ke cache baris tunggal supaya modul lain
       (Quiz, Lkpd) ikut menikmatinya tanpa perlu peta ini. */
    baris.forEach(function (r) {
      peta[r.item_id] = r;
      Db.titipBaris2('progress', userId, r.item_id, r._baris);
    });

    try {
      CacheService.getScriptCache().put(kunci, JSON.stringify(peta), 300);
    } catch (e) { /* terlalu besar → lewati */ }
    return peta;
  }


  /** Baca kolom materi_pokok yang dibutuhkan perhitungan unlock. */
  function _bacaMp() {
    return Db.bacaKolom('materi_pokok',
      ['mp_id','kelas_id','urutan','judul','deskripsi',
       'tujuan_pembelajaran','wajib','urut_ketat','status']);
  }

  /** Kolom pertemuan yang dibutuhkan perhitungan unlock. */
  function _bacaPtm() {
    return Db.bacaKolom('pertemuan',
      ['pertemuan_id','mp_id','kelas_id','urutan','judul','deskripsi',
       'tujuan_pembelajaran','jenis','wajib','urut_ketat','status']);
  }

  /* ==================================================== INDEKS KELAS */

  /**
   * Indeks lengkap satu kelas untuk sidebar navigasi — seluruh
   * pertemuan beserta item di dalamnya, plus urutan datar untuk
   * tombol Sebelumnya/Berikutnya.
   *
   * Satu panggilan untuk seluruh sidebar. Memakai cache progres murid
   * yang sama dengan daftarPertemuan(), jadi biayanya nyaris nol bila
   * halaman sebelumnya baru saja dibuka.
   *
   * Item pada pertemuan TERKUNCI sengaja tidak dikirim judulnya secara
   * rinci? Tidak — judul item bukan rahasia (sudah tampil di daftar
   * pertemuan). Yang dijaga adalah KONTEN, dan itu tidak pernah ikut.
   */
  function indeksKelas(sesi, kelasId) {
    _cekEnroll(sesi.user_id, kelasId);

    var kelas = Db.cariBarisCache('kelas', 'kelas_id', kelasId);
    if (!kelas || kelas.status === 'arsip') {
      throw _err('TIDAK_DITEMUKAN', 'Kelas tidak ditemukan.');
    }

    var petaProg = _progresMurid(sesi.user_id);
    var semuaPtm = _bacaPtm();
    var semuaItem = Db.bacaKolom('item',
      ['item_id','pertemuan_id','kelas_id','tipe','urutan','judul',
       'deskripsi','tujuan_pembelajaran','jml_bagian','wajib',
       'min_durasi_detik','kkm','status']);

    var daftarMp = _statusMateriPokok(kelasId, petaProg, _bacaMp(),
                                      semuaPtm, semuaItem);
    var daftar = _ratakan(daftarMp);

    /* kelompokkan item per pertemuan sekali saja */
    var itemPer = {};
    semuaItem.forEach(function (i) {
      if (i.status !== 'publish') return;
      (itemPer[i.pertemuan_id] = itemPer[i.pertemuan_id] || []).push(i);
    });

    var rantai = [];      /* urutan datar seluruh item yang terbuka */

    function bungkusPtm(p) {
      var items = [];
      if (p.terbuka) {
        /* status item hanya dihitung untuk pertemuan yang terbuka —
           pertemuan terkunci cukup menampilkan jumlahnya saja */
        items = _statusItem(p, itemPer[p.pertemuan_id] || [], petaProg)
          .map(function (i) {
            return {
              item_id: i.item_id,
              pertemuan_id: p.pertemuan_id,
              tipe: i.tipe,
              urutan: i.urutan,
              judul: i.judul,
              wajib: i.wajib,
              terbuka: i.terbuka,
              status: i.status,
              jml_bagian: i.jml_bagian,
              bagian_terakhir: i.bagian_terakhir,
              nilai: i.nilai
            };
          });

        items.forEach(function (i) {
          if (i.terbuka) {
            rantai.push({ item_id: i.item_id, tipe: i.tipe,
                          judul: i.judul, pertemuan_id: p.pertemuan_id,
                          pertemuan_urutan: p.urutan,
                          mp_id: p.mp_id });
          }
        });
      }

      return {
        pertemuan_id: p.pertemuan_id,
        mp_id: p.mp_id,
        urutan: p.urutan,
        judul: p.judul,
        jenis: p.jenis,
        wajib: p.wajib,
        terbuka: p.terbuka,
        selesai: p.selesai,
        status: p.status,
        progres: p.progres,
        jml_item: p.jml_item,
        jml_wajib: p.jml_wajib,
        item_selesai: p.item_selesai,
        kosong: p.kosong,
        item: items
      };
    }

    var materiPokok = daftarMp.map(function (m) {
      return {
        mp_id: m.mp_id,
        urutan: m.urutan,
        judul: m.judul,
        wajib: m.wajib,
        terbuka: m.terbuka,
        selesai: m.selesai,
        status: m.status,
        progres: m.progres,
        jml_pertemuan: m.jml_pertemuan,
        jml_wajib: m.jml_wajib,
        pertemuan_selesai: m.pertemuan_selesai,
        kosong: m.kosong,
        pertemuan: m.pertemuan.map(bungkusPtm)
      };
    });

    /* larik datar dipertahankan agar kode lama tetap jalan */
    var pertemuan = [];
    materiPokok.forEach(function (m) {
      m.pertemuan.forEach(function (p) { pertemuan.push(p); });
    });

    return {
      kelas: {
        kelas_id: kelas.kelas_id,
        nama_kelas: kelas.nama_kelas,
        mapel: kelas.mapel
      },
      materi_pokok: materiPokok,
      pertemuan: pertemuan,
      rantai: rantai
    };
  }

  /**
   * Tetangga sebelum/sesudah satu item dalam rantai datar.
   * Dipakai tombol Sebelumnya/Berikutnya agar lintas pertemuan.
   */
  function tetanggaItem(rantai, itemId) {
    var idx = -1;
    for (var i = 0; i < rantai.length; i++) {
      if (rantai[i].item_id === itemId) { idx = i; break; }
    }
    if (idx < 0) return { sebelum: null, sesudah: null, posisi: 0, total: rantai.length };
    return {
      sebelum: idx > 0 ? rantai[idx - 1] : null,
      sesudah: idx < rantai.length - 1 ? rantai[idx + 1] : null,
      posisi: idx + 1,
      total: rantai.length
    };
  }

  /* ==================================================== DAFTAR PERTEMUAN */

  function daftarPertemuan(sesi, kelasId) {
    _cekEnroll(sesi.user_id, kelasId);

    var kelas = Db.cariBarisCache('kelas', 'kelas_id', kelasId);
    if (!kelas || kelas.status === 'arsip') {
      throw _err('TIDAK_DITEMUKAN', 'Kelas tidak ditemukan.');
    }

    var petaProg = _progresMurid(sesi.user_id);
    var semuaPtm = _bacaPtm();

    /* SATU pembacaan `item` untuk dua keperluan.

       Versi lama memanggil `bacaKolom('item', …)` DUA KALI dengan
       daftar kolom berbeda — dan memo `bacaKolom` berkunci pada
       daftar kolomnya, jadi keduanya tidak pernah berbagi hasil.
       Sheet `item` dibaca dua kali penuh setiap murid membuka
       pertemuan (v1.8.10).

       Kolom `konten` tetap TIDAK diambil: itu yang membuat sheet
       `item` berat, dan detail pertemuan tidak memerlukannya. */
    var semuaItem = Db.bacaKolom('item',
      ['item_id','pertemuan_id','mp_id','kelas_id','tipe','urutan','judul',
       'deskripsi','tujuan_pembelajaran','jml_bagian','wajib',
       'min_durasi_detik','kkm','status']);

    var daftarMp = _statusMateriPokok(kelasId, petaProg, _bacaMp(),
                                      semuaPtm, semuaItem);
    var hasil = _ratakan(daftarMp);
    var wajib = hasil.filter(function (h) { return h.wajib; });
    var beres = wajib.filter(function (h) { return h.selesai; });

    var lanjut = null;
    for (var i = 0; i < hasil.length; i++) {
      if (hasil[i].terbuka && !hasil[i].selesai) { lanjut = hasil[i]; break; }
    }

    return {
      kelas: {
        kelas_id: kelas.kelas_id,
        nama_kelas: kelas.nama_kelas,
        mapel: kelas.mapel
      },
      progres: wajib.length ? Math.round(beres.length / wajib.length * 100) : 0,
      jml_pertemuan: hasil.length,
      jml_materi_pokok: daftarMp.length,
      selesai: beres.length,
      lanjutkan: lanjut,
      /* bertingkat untuk tampilan, datar untuk kode lama */
      materi_pokok: daftarMp,
      pertemuan: hasil
    };
  }

  /* ==================================================== DETAIL PERTEMUAN */

  function detailPertemuan(sesi, pertemuanId) {
    var p = Db.cariBarisCache('pertemuan', 'pertemuan_id', pertemuanId);
    /* Dibedakan: benar-benar TIDAK ADA vs ada tetapi BELUM TERBIT.
       Keduanya dulu berbunyi sama, sehingga guru yang lupa
       menerbitkan pertemuan mengira sistemnya rusak (v1.9.5). */
    if (!p) throw _err('TIDAK_DITEMUKAN', 'Pertemuan tidak ditemukan.');
    if (p.status !== 'publish') {
      throw _err('TIDAK_DITEMUKAN',
        'Pertemuan ini belum diterbitkan guru. Coba lagi nanti.');
    }
    _cekEnroll(sesi.user_id, p.kelas_id);

    var petaProg = _progresMurid(sesi.user_id);
    var semuaPtm = _bacaPtm();

    /* SATU pembacaan `item` untuk dua keperluan.

       Versi lama memanggil `bacaKolom('item', …)` DUA KALI dengan
       daftar kolom berbeda — dan memo `bacaKolom` berkunci pada
       daftar kolomnya, jadi keduanya tidak pernah berbagi hasil.
       Sheet `item` dibaca dua kali penuh setiap murid membuka
       pertemuan (v1.8.10).

       Kolom `konten` tetap TIDAK diambil: itu yang membuat sheet
       `item` berat, dan detail pertemuan tidak memerlukannya. */
    var semuaItem = Db.bacaKolom('item',
      ['item_id','pertemuan_id','mp_id','kelas_id','tipe','urutan','judul',
       'deskripsi','tujuan_pembelajaran','jml_bagian','wajib',
       'min_durasi_detik','kkm','status']);

    /* pertemuan ini harus terbuka menurut unlock tingkat 1 */
    var daftar = _ratakan(_statusMateriPokok(p.kelas_id, petaProg, _bacaMp(),
                                             semuaPtm, semuaItem));
    var ini = null, idx = -1;
    daftar.forEach(function (d, i) {
      if (d.pertemuan_id === pertemuanId) { ini = d; idx = i; }
    });
    /* Pertemuan terbit tetapi tidak muncul di struktur = BAB-nya yang
       belum terbit. Menyebutkannya menghemat waktu guru mencari
       (v1.9.5). */
    if (!ini) {
      throw _err('TIDAK_DITEMUKAN',
        'Materi Pokok pertemuan ini belum diterbitkan guru.');
    }

    /* Pertemuan terkunci TETAP boleh dibuka bila ada satu saja item
       di dalamnya yang dibuka paksa guru.

       Ini penjaga yang sama dengan bukaMateri(), tetapi berlaku untuk
       SELURUH tipe item — Lkpd, Quiz, Refleksi, dan Kelompok semuanya
       lewat sini. Tanpa ini, membuka kunci LKPD di pertemuan yang
       belum terbuka tidak berpengaruh apa pun: guru menekan tombol,
       murid tetap ditolak (v1.8.0). */
    var adaPaksa = false;
    semuaItem.forEach(function (i) {
      if (i.pertemuan_id !== pertemuanId) return;
      var pr = petaProg[i.item_id];
      if (pr && pr.dibuka_paksa === true) adaPaksa = true;
    });

    if (!ini.terbuka && !adaPaksa) {
      throw _err('ITEM_TERKUNCI',
        'Selesaikan Pertemuan ' + (idx > 0 ? daftar[idx - 1].urutan : '') +
        ' terlebih dahulu.');
    }

    /* dipakai ulang dari pembacaan di atas — bukan membaca lagi */
    var itemLengkap = semuaItem.filter(function (i) {
      return i.pertemuan_id === pertemuanId;
    });

    var kelas = Db.cariBarisCache('kelas', 'kelas_id', p.kelas_id);

    return {
      kelas: { kelas_id: kelas.kelas_id, nama_kelas: kelas.nama_kelas },
      pertemuan: ini,
      /* Baris `pertemuan` mentah, untuk pemanggil internal yang
         memerlukannya (Quiz, Lkpd, Refleksi, Kelompok). Tanpa ini
         mereka memanggil `cariBarisCache('pertemuan', …)` lagi
         padahal barisnya baru saja dibaca di sini (v1.8.11).

         Diawali garis bawah: bukan bagian payload untuk klien. */
      _barisPertemuan: p,
      sebelumnya: idx > 0 ? {
        pertemuan_id: daftar[idx - 1].pertemuan_id,
        urutan: daftar[idx - 1].urutan
      } : null,
      berikutnya: idx < daftar.length - 1 ? {
        pertemuan_id: daftar[idx + 1].pertemuan_id,
        urutan: daftar[idx + 1].urutan,
        terbuka: daftar[idx + 1].terbuka
      } : null,
      /* `terkunci` menandai pertemuan yang lolos ke sini HANYA karena
         ada item dibuka paksa. Tanpa itu seluruh isinya ikut terbuka. */
      item: _statusItem(
        { urut_ketat: ini.urut_ketat, terkunci: ini.terbuka !== true },
        itemLengkap, petaProg)
    };
  }

  /* ==================================================== BUKA MATERI */

  /**
   * Ambil satu bagian materi.
   * Konten hanya dikirim bila item benar-benar terbuka DAN bagian
   * yang diminta tidak melompati bagian yang belum dibaca.
   */
  function bukaMateri(sesi, itemId, bagianKe) {
    var item = Db.cariBarisCache('item', 'item_id', itemId);
    if (!item || item.status !== 'publish') {
      throw _err('TIDAK_DITEMUKAN', 'Materi tidak ditemukan.');
    }
    if (item.tipe !== 'materi') {
      throw _err('VALIDASI_GAGAL', 'Item ini bukan materi.');
    }

    var p = Db.cariBarisCache('pertemuan', 'pertemuan_id', item.pertemuan_id);
    if (!p) throw _err('TIDAK_DITEMUKAN', 'Pertemuan tidak ditemukan.');
    _cekEnroll(sesi.user_id, p.kelas_id);

    var petaProg = _progresMurid(sesi.user_id);

    /* --- unlock tingkat 1 --- */
    var semuaPtm = _bacaPtm();
    var semuaItem = Db.bacaKolom('item',
      ['item_id','pertemuan_id','kelas_id','tipe','urutan','wajib','status']);
    var daftar = _ratakan(_statusMateriPokok(p.kelas_id, petaProg, _bacaMp(),
                                             semuaPtm, semuaItem));
    var ptmIni = null;
    daftar.forEach(function (d) {
      if (d.pertemuan_id === item.pertemuan_id) ptmIni = d;
    });
    /* Item yang DIBUKA PAKSA guru menembus kunci pertemuan.
       Tanpa ini pembukaan jadi sia-sia: guru menekan tombol, murid
       tetap ditolak, dan tidak ada yang tahu sebabnya. Kasus
       tersering justru inilah — murid tertinggal SATU PERTEMUAN
       penuh, jadi pertemuannya pasti masih terkunci (v1.8.0). */
    var prIni = petaProg[itemId];
    var dipaksa = !!(prIni && prIni.dibuka_paksa === true);

    if (!dipaksa && (!ptmIni || !ptmIni.terbuka)) {
      throw _err('ITEM_TERKUNCI', 'Pertemuan ini masih terkunci.');
    }

    /* --- unlock tingkat 2 --- */
    var itemPtm = semuaItem.filter(function (i) {
      return i.pertemuan_id === item.pertemuan_id;
    });
    var statusItem = _statusItem(
      { urut_ketat: p.urut_ketat === true,
        terkunci: !(ptmIni && ptmIni.terbuka) }, itemPtm, petaProg);

    var ini = null;
    statusItem.forEach(function (s) { if (s.item_id === itemId) ini = s; });
    if (!ini || !ini.terbuka) {
      throw _err('ITEM_TERKUNCI',
        ini ? ini.alasan_kunci : 'Materi ini masih terkunci.');
    }

    /* --- validasi nomor bagian --- */
    var total = Math.max(1, Util.hitungBagian(item.konten));
    var ke = _nomorBagian(bagianKe, total);
    var terakhir = petaProg[itemId]
      ? (Number(petaProg[itemId].bagian_terakhir) || 0) : 0;

    /* tidak boleh melompati bagian yang belum dibaca */
    if (ke > terakhir + 1) {
      throw _err('ITEM_TERKUNCI',
        'Selesaikan bagian ' + (terakhir + 1) + ' terlebih dahulu.');
    }

    /* --- catat progres 'berjalan' bila baru pertama kali dibuka --- */
    if (!petaProg[itemId]) {
      var kunciLama = _kunciProg(sesi.user_id);
      var barisBaru = Db.tulisProgres(sesi.user_id, function () {
        var cek = Db.cariBarisCache2('progress',
          'user_id', sesi.user_id, 'item_id', itemId);
        if (!cek) {
          Db.tambah('progress', {
            progress_id: Util.buatId('PRG'),
            user_id: sesi.user_id,
            item_id: itemId,
            pertemuan_id: item.pertemuan_id,
            mp_id: item.mp_id || '',
            kelas_id: p.kelas_id,
            tipe: 'materi',
            status: 'berjalan',
            bagian_terakhir: 0,
            nilai: '', percobaan: 0,
            dibuka_paksa: false, alasan_paksa: '',
            waktu_buka: Util.sekarang(),
            waktu_selesai: '',
            updated_at: Util.sekarang()
          });
          /* baris baru selalu ditambahkan di akhir sheet */
          return Db.sheet('progress').getLastRow();
        }
        return cek._baris;
      });
      /* Penulisan tadi memajukan epoch, sehingga cache yang barusan
         dibuat _progresMurid() sudah basi. Simpan ulang di kunci epoch
         BARU agar pemanggilan berikutnya tidak membaca sheet lagi. */
      petaProg[itemId] = {
        item_id: itemId, status: 'berjalan', bagian_terakhir: 0,
        nilai: '', dibuka_paksa: false, _baris: barisBaru
      };
      try {
        var c1 = CacheService.getScriptCache();
        c1.remove(kunciLama);
        c1.put(_kunciProg(sesi.user_id), JSON.stringify(petaProg), 300);
      } catch (e) {}

      Beranda.invalidasiProgres(sesi.user_id);
      terakhir = 0;
    }

    return {
      item_id: itemId,
      judul: item.judul,
      tujuan_pembelajaran: item.tujuan_pembelajaran,
      pertemuan_id: item.pertemuan_id,
      pertemuan_judul: p.judul,
      pertemuan_urutan: ptmIni.urutan,
      kelas_id: p.kelas_id,          /* dipakai sidebar navigasi */
      bagian_ke: ke,
      jml_bagian: total,
      konten: Util.ambilBagian(item.konten, ke),

      /* `semua_bagian` (v1.16.0) DIBUANG di v1.16.1 bersama jalur
         pindah-bagian lokal yang memakainya. Payload yang tidak
         pernah dibaca hanya menambah ukuran kiriman tanpa manfaat
         (§6.2 no. 102). */
      min_durasi_detik: Number(item.min_durasi_detik) || 0,
      bagian_terakhir: terakhir,
      sudah_selesai: petaProg[itemId] &&
                     petaProg[itemId].status === 'selesai',
      wajib: item.wajib === true
    };
  }

  /* ==================================================== TANDAI SELESAI */

  /**
   * Tandai satu bagian materi selesai dibaca.
   * Bila bagian terakhir, seluruh item ditandai selesai.
   */
  function tandaiBagianSelesai(sesi, itemId, bagianKe, detikBaca) {
    var item = Db.cariBarisCache('item', 'item_id', itemId);
    if (!item || item.status !== 'publish') {
      throw _err('TIDAK_DITEMUKAN', 'Materi tidak ditemukan.');
    }
    if (item.tipe !== 'materi') {
      throw _err('VALIDASI_GAGAL', 'Item ini bukan materi.');
    }

    var p = Db.cariBarisCache('pertemuan', 'pertemuan_id', item.pertemuan_id);
    _cekEnroll(sesi.user_id, p.kelas_id);

    var total = Math.max(1, Util.hitungBagian(item.konten));
    var ke = _nomorBagian(bagianKe, total);

    /* durasi minimum diverifikasi di server, bukan hanya di layar */
    var minDurasi = Number(item.min_durasi_detik) || 0;
    if (minDurasi > 0 && Number(detikBaca) < minDurasi) {
      throw _err('VALIDASI_GAGAL',
        'Bacalah minimal ' + minDurasi + ' detik sebelum menandai selesai.');
    }

    /* dibaca sebelum penulisan; biasanya sudah tersedia di cache */
    var petaSebelum = _progresMurid(sesi.user_id);
    var kunciSebelum = _kunciProg(sesi.user_id);

    var hasil = Db.tulisProgres(sesi.user_id, function () {
      /* Nomor baris sudah diketahui dari cache progres — ambil langsung
         satu baris itu. bacaBarisJika memverifikasi user_id & item_id,
         jadi pergeseran baris akibat penghapusan tetap aman: bila tidak
         cocok, hasilnya null dan kita jatuh ke pemindaian penuh. */
      var baris = null;
      var tebak = petaSebelum[itemId] && petaSebelum[itemId]._baris;
      if (tebak) {
        baris = Db.bacaBarisJika('progress', tebak,
          { user_id: sesi.user_id, item_id: itemId });
      }
      if (!baris) {
        baris = Db.cariCepat2('progress',
          'user_id', sesi.user_id, 'item_id', itemId);
      }

      /* Bila baris progres belum ada — misalnya murid menyegarkan
         halaman tepat setelah membuka — buat sekarang alih-alih menolak.
         Kunci akses sudah diperiksa di atas lewat _cekEnroll dan
         status publish item. */
      if (!baris) {
        Db.tambah('progress', {
          progress_id: Util.buatId('PRG'),
          user_id: sesi.user_id, item_id: itemId,
          pertemuan_id: item.pertemuan_id, mp_id: item.mp_id || '',
          kelas_id: p.kelas_id,
          tipe: 'materi', status: 'berjalan', bagian_terakhir: 0,
          nilai: '', percobaan: 0, dibuka_paksa: false, alasan_paksa: '',
          waktu_buka: Util.sekarang(), waktu_selesai: '',
          updated_at: Util.sekarang()
        });
        baris = Db.cariCepat2('progress',
          'user_id', sesi.user_id, 'item_id', itemId);
      }

      var terakhir = Number(baris.bagian_terakhir) || 0;

      /* tidak boleh melompat */
      if (ke > terakhir + 1) {
        throw _err('ITEM_TERKUNCI',
          'Selesaikan bagian ' + (terakhir + 1) + ' terlebih dahulu.');
      }

      var baruTerakhir = Math.max(terakhir, ke);
      var tuntas = baruTerakhir >= total;

      Db.perbarui('progress', baris._baris, {
        bagian_terakhir: baruTerakhir,
        status: tuntas ? 'selesai' : 'berjalan',
        waktu_selesai: tuntas ? Util.sekarang() : '',
        updated_at: Util.sekarang()
      });

      return { bagian_terakhir: baruTerakhir, item_selesai: tuntas,
               _baris: baris._baris };
    });

    /* Penulisan tadi memajukan epoch sehingga cache progres murid ini
       kedaluwarsa. Alih-alih memindahkan puluhan ribu baris lagi,
       bangun peta dari salinan yang diambil SEBELUM penulisan lalu
       timpa satu entri yang benar-benar berubah. Salinan diambil di
       awal fungsi sehingga dijamin mencerminkan keadaan terkini. */
    Beranda.invalidasiProgres(sesi.user_id);

    var petaProg = {};
    Object.keys(petaSebelum).forEach(function (k) {
      petaProg[k] = petaSebelum[k];
    });
    petaProg[itemId] = {
      item_id: itemId,
      status: hasil.item_selesai ? 'selesai' : 'berjalan',
      bagian_terakhir: hasil.bagian_terakhir,
      nilai: petaSebelum[itemId] ? petaSebelum[itemId].nilai : '',
      dibuka_paksa: petaSebelum[itemId]
        ? petaSebelum[itemId].dibuka_paksa : false,
      /* _baris WAJIB ikut disimpan. Tanpa ini, penandaan bagian
         berikutnya kehilangan petunjuk baris dan terpaksa memindai
         seluruh sheet progress lagi. */
      _baris: hasil._baris
    };

    /* simpan di kunci epoch BARU, buang kunci lama agar tidak menumpuk */
    try {
      var c2 = CacheService.getScriptCache();
      c2.remove(kunciSebelum);
      c2.put(_kunciProg(sesi.user_id), JSON.stringify(petaProg), 300);
    } catch (e) {}

    /* --- periksa apakah pertemuan ikut tuntas --- */
    var itemPtm = Db.bacaKolom('item',
      ['item_id','pertemuan_id','wajib','status'])
      .filter(function (i) {
        return i.pertemuan_id === item.pertemuan_id && i.status === 'publish';
      });

    var wajib = itemPtm.filter(function (i) { return i.wajib === true; });
    var beres = wajib.filter(function (i) {
      var pr = petaProg[i.item_id];
      return pr && pr.status === 'selesai';
    });
    var ptmTuntas = wajib.length === 0 || beres.length === wajib.length;

    /* pertemuan berikutnya terbuka? */
    var bukaBerikut = null;
    if (ptmTuntas) {
      var semuaPtm = _bacaPtm();
      var semuaItem = Db.bacaKolom('item',
        ['item_id','pertemuan_id','kelas_id','tipe','urutan','wajib','status']);
      var daftar = _ratakan(_statusMateriPokok(p.kelas_id, petaProg, _bacaMp(),
                                             semuaPtm, semuaItem));
      for (var i = 0; i < daftar.length; i++) {
        if (daftar[i].pertemuan_id === item.pertemuan_id &&
            i < daftar.length - 1 && daftar[i + 1].terbuka) {
          bukaBerikut = {
            pertemuan_id: daftar[i + 1].pertemuan_id,
            urutan: daftar[i + 1].urutan,
            judul: daftar[i + 1].judul
          };
        }
      }
      Util.catatLog(sesi.user_id, 'pertemuan_selesai', item.pertemuan_id);
    }

    return {
      bagian_terakhir: hasil.bagian_terakhir,
      jml_bagian: total,
      item_selesai: hasil.item_selesai,
      pertemuan_selesai: ptmTuntas,
      item_beres: beres.length,
      item_wajib: wajib.length,
      buka_berikutnya: bukaBerikut
    };
  }

  /* ==================================================== UNLOCK PAKSA */

  /** Guru membuka kunci satu item untuk satu murid. */
  function unlockPaksa(sesi, userId, itemId, alasan) {
    if (Util.kosong(alasan)) {
      throw _err('VALIDASI_GAGAL', 'Alasan wajib diisi.');
    }
    var item = Db.cariBarisCache('item', 'item_id', itemId);
    if (!item) throw _err('TIDAK_DITEMUKAN', 'Item tidak ditemukan.');

    var murid = Db.cariBarisCache('users', 'user_id', userId);
    if (!murid) throw _err('TIDAK_DITEMUKAN', 'Murid tidak ditemukan.');

    var kunciLamaPaksa = _kunciProg(userId);
    Db.tulisProgres(userId, function () {
      var baris = Db.cariBarisCache2('progress',
        'user_id', userId, 'item_id', itemId);

      if (baris) {
        Db.perbarui('progress', baris._baris, {
          dibuka_paksa: true,
          alasan_paksa: String(alasan).slice(0, 200),
          updated_at: Util.sekarang()
        });
      } else {
        Db.tambah('progress', {
          progress_id: Util.buatId('PRG'),
          user_id: userId, item_id: itemId,
          pertemuan_id: item.pertemuan_id, mp_id: item.mp_id || '',
          kelas_id: item.kelas_id,
          tipe: item.tipe, status: 'berjalan', bagian_terakhir: 0,
          nilai: '', percobaan: 0,
          dibuka_paksa: true,
          alasan_paksa: String(alasan).slice(0, 200),
          waktu_buka: Util.sekarang(), waktu_selesai: '',
          updated_at: Util.sekarang()
        });
      }
    });

    try {
      CacheService.getScriptCache().remove(kunciLamaPaksa);
    } catch (e) {}
    Beranda.invalidasiProgres(userId);
    Util.catatLog(sesi.user_id, 'unlock_paksa',
      userId + ' → ' + itemId + ' | ' + alasan);

    Notif.kirimSatu(userId, 'feedback_baru',
      'Guru membuka akses "' + item.judul + '" untuk Anda.',
      '#/belajar/' + item.pertemuan_id,
      'Akses dibuka');

    return { dibuka: true };
  }

  /* ============================================ BUKA KUNCI (v1.8.0)

     `unlockPaksa()` sudah ada sejak Tahap 5 tetapi tak pernah punya
     tombol. Empat fungsi di bawah melengkapinya menjadi fitur utuh:

       kunciMurid()  — item apa saja yang terkunci untuk SATU murid
       kunciItem()   — murid mana saja yang terkunci pada SATU item
       bukaBanyak()  — buka beberapa murid sekaligus
       kunciUlang()  — BATALKAN pembukaan (salah klik pasti terjadi)

     Tanpa kunciUlang(), guru yang salah memilih murid tidak punya
     jalan keluar selain menyunting Sheet dengan tangan.
  */

  /** Peta user_id → {nama, username} untuk sekumpulan murid. */
  function _petaMurid() {
    var peta = {};
    Db.bacaKolom('users', ['user_id', 'nama', 'username'])
      .forEach(function (u) { peta[u.user_id] = u; });
    return peta;
  }

  /**
   * Seluruh item yang TERKUNCI untuk satu murid di satu kelas.
   *
   * Memakai indeksKelas() — jalur perhitungan unlock yang SAMA dengan
   * yang dilihat murid. Menghitungnya ulang di sini berarti dua
   * salinan aturan yang pasti berbeda suatu saat (§6.2 no. 32).
   */
  function kunciMurid(userId, kelasId) {
    var murid = Db.cariBarisCache('users', 'user_id', userId);
    if (!murid) throw _err('TIDAK_DITEMUKAN', 'Murid tidak ditemukan.');

    var terdaftar = Db.saringKolom('enrollment',
      { user_id: userId, kelas_id: kelasId, status: 'aktif' }, ['user_id']);
    if (!terdaftar.length) {
      throw _err('VALIDASI_GAGAL',
        'Murid ini tidak terdaftar di kelas tersebut.');
    }

    /* sesi tiruan: indeksKelas() hanya memakai user_id-nya */
    var d = indeksKelas({ user_id: userId }, kelasId);

    var petaProg = {};
    Db.saringBaris('progress', 'user_id', userId,
      ['item_id', 'dibuka_paksa', 'alasan_paksa', 'status'])
      .forEach(function (r) { petaProg[r.item_id] = r; });

    var terkunci = [], dibuka = [];
    d.pertemuan.forEach(function (p) {
      /* Pertemuan yang TERKUNCI tidak memuat daftar itemnya (indeks
         sengaja tidak menghitungnya). Itemnya dibaca langsung supaya
         guru tetap bisa membukanya — justru inilah kasus tersering:
         murid tertinggal seluruh pertemuan. */
      var items = p.item;
      if (!p.terbuka || !items.length) {
        items = Db.saringBaris('item', 'pertemuan_id', p.pertemuan_id,
          ['item_id', 'tipe', 'urutan', 'judul', 'status', 'wajib'])
          .filter(function (i) { return i.status === 'publish'; })
          .sort(function (a, b) { return Number(a.urutan) - Number(b.urutan); })
          .map(function (i) {
            var pr = petaProg[i.item_id];
            return {
              item_id: i.item_id, tipe: i.tipe, judul: i.judul,
              urutan: Number(i.urutan), wajib: i.wajib === true,
              terbuka: !!(pr && pr.dibuka_paksa === true),
              status: pr ? pr.status : 'belum'
            };
          });
      }

      items.forEach(function (i) {
        var pr = petaProg[i.item_id];
        var paksa = !!(pr && pr.dibuka_paksa === true);
        var baris = {
          item_id: i.item_id, judul: i.judul, tipe: i.tipe,
          pertemuan_id: p.pertemuan_id, pertemuan_urutan: p.urutan,
          pertemuan_judul: p.judul, pertemuan_terbuka: p.terbuka === true,
          wajib: i.wajib === true, status: i.status,
          alasan_paksa: pr ? (pr.alasan_paksa || '') : ''
        };
        if (paksa) dibuka.push(baris);
        else if (!i.terbuka) terkunci.push(baris);
      });
    });

    return {
      murid: { user_id: userId, nama: murid.nama,
               username: murid.username },
      kelas_id: kelasId,
      terkunci: terkunci,
      dibuka_paksa: dibuka,
      rekap: { jml_terkunci: terkunci.length, jml_dibuka: dibuka.length }
    };
  }

  /**
   * Murid mana saja yang TERKUNCI pada satu item.
   *
   * Kebalikan kunciMurid(). Guru memakainya saat bertanya "siapa yang
   * belum bisa mengakses quiz ini?" — cara berpikir yang berbeda,
   * tetapi menuju tindakan yang sama.
   */
  function kunciItem(itemId) {
    var item = Db.cariBarisCache('item', 'item_id', itemId);
    if (!item) throw _err('TIDAK_DITEMUKAN', 'Item tidak ditemukan.');

    var ptm = Db.cariBarisCache('pertemuan', 'pertemuan_id',
                                item.pertemuan_id);
    var kelas = Db.cariBarisCache('kelas', 'kelas_id', item.kelas_id);

    var enroll = Db.saringKolom('enrollment',
      { kelas_id: item.kelas_id, status: 'aktif' }, ['user_id']);
    var nama = _petaMurid();

    /* Baris progres SELURUH murid untuk item ini, dibaca sekali —
       bukan satu pembacaan per murid (§6.2 no. 1). */
    var petaProg = {};
    Db.saringBaris('progress', 'item_id', itemId,
      ['user_id', 'dibuka_paksa', 'alasan_paksa', 'status'])
      .forEach(function (r) { petaProg[r.user_id] = r; });

    var terkunci = [], dibuka = [], terbuka = [];
    enroll.forEach(function (e) {
      var u = nama[e.user_id] || {};
      var pr = petaProg[e.user_id];
      var baris = {
        user_id: e.user_id,
        nama: u.nama || '(tidak dikenal)',
        username: u.username || '',
        status: pr ? pr.status : 'belum',
        alasan_paksa: pr ? (pr.alasan_paksa || '') : ''
      };

      if (pr && pr.dibuka_paksa === true) { dibuka.push(baris); return; }

      /* Perhitungan unlock per murid memakai jalur yang SAMA dengan
         layar murid. Untuk 36 murid ini 36 pemanggilan indeksKelas(),
         tetapi seluruhnya membaca dari cache baris progres yang sama
         dan hanya dijalankan saat panel dibuka. */
      var d = indeksKelas({ user_id: e.user_id }, item.kelas_id);
      var ketemu = null;
      d.pertemuan.forEach(function (p) {
        (p.item || []).forEach(function (i) {
          if (i.item_id === itemId) ketemu = i;
        });
      });

      if (ketemu && ketemu.terbuka) terbuka.push(baris);
      else terkunci.push(baris);
    });

    function urut(a, b) {
      return String(a.nama).localeCompare(String(b.nama), 'id');
    }
    terkunci.sort(urut); dibuka.sort(urut); terbuka.sort(urut);

    return {
      item: {
        item_id: itemId, judul: item.judul, tipe: item.tipe,
        pertemuan_id: item.pertemuan_id,
        pertemuan_urutan: ptm ? Number(ptm.urutan) || 0 : 0,
        kelas_id: item.kelas_id,
        nama_kelas: kelas ? kelas.nama_kelas : '',
        mapel: kelas ? kelas.mapel : ''
      },
      terkunci: terkunci,
      dibuka_paksa: dibuka,
      sudah_terbuka: terbuka,
      rekap: {
        jml_murid: enroll.length,
        jml_terkunci: terkunci.length,
        jml_dibuka: dibuka.length,
        jml_terbuka: terbuka.length
      }
    };
  }

  /**
   * Buka satu item untuk BEBERAPA murid sekaligus.
   *
   * Kasusnya nyata: serombongan murid ikut lomba dan sama-sama
   * tertinggal satu pertemuan. Membuka satu per satu untuk 5 murid
   * berarti 5 dialog dengan alasan yang sama persis.
   *
   * Memanggil unlockPaksa() per murid, bukan menulis sendiri —
   * validasi, cache, notifikasi, dan log-nya sudah benar di sana.
   * Menyalin logikanya berarti dua jalur tulis yang harus dijaga
   * selaras (pelajaran v1.0.1: lima jalur tulis kebobolan).
   */
  function bukaBanyak(sesi, userIds, itemId, alasan) {
    var ids = (userIds || [])
      .map(function (x) { return String(x || '').trim(); })
      .filter(function (x) { return x.length; });

    /* buang duplikat dalam satu kiriman */
    var unik = [], lihat = {};
    ids.forEach(function (u) {
      if (!lihat[u]) { lihat[u] = true; unik.push(u); }
    });
    ids = unik;

    if (!ids.length) {
      throw _err('VALIDASI_GAGAL', 'Pilih minimal satu murid.');
    }
    if (Util.kosong(alasan)) {
      throw _err('VALIDASI_GAGAL', 'Alasan wajib diisi.');
    }

    var berhasil = 0, gagal = [];
    ids.forEach(function (uid) {
      try {
        unlockPaksa(sesi, uid, itemId, alasan);
        berhasil++;
      } catch (e) {
        /* Satu murid gagal TIDAK boleh membatalkan sisanya — mis.
           satu id basi karena murid keluar kelas. Kegagalannya
           dilaporkan, bukan didiamkan (§6.2 no. 26). */
        var u = Db.cariBarisCache('users', 'user_id', uid);
        gagal.push((u ? u.nama : uid) + ': ' + e.message);
      }
    });

    return { dibuka: berhasil, jml_gagal: gagal.length, gagal: gagal };
  }

  /**
   * Batalkan pembukaan paksa — kunci kembali seperti semula.
   *
   * Progres yang SUDAH terlanjur dikerjakan tidak dihapus: nilainya
   * sah dan menghapusnya merugikan murid. Yang dicabut hanya
   * penandanya, sehingga aturan unlock normal berlaku lagi.
   */
  function kunciUlang(sesi, userId, itemId) {
    var item = Db.cariBarisCache('item', 'item_id', itemId);
    if (!item) throw _err('TIDAK_DITEMUKAN', 'Item tidak ditemukan.');

    var kunciLama = _kunciProg(userId);
    var adaBaris = false;

    Db.tulisProgres(userId, function () {
      var baris = Db.cariBarisCache2('progress',
        'user_id', userId, 'item_id', itemId);
      if (!baris) return;
      adaBaris = true;
      Db.perbarui('progress', baris._baris, {
        dibuka_paksa: false,
        alasan_paksa: '',
        updated_at: Util.sekarang()
      });
    });

    if (!adaBaris) {
      throw _err('TIDAK_DITEMUKAN',
        'Item ini tidak sedang dibuka paksa untuk murid tersebut.');
    }

    try { CacheService.getScriptCache().remove(kunciLama); } catch (e) {}
    Beranda.invalidasiProgres(userId);
    Util.catatLog(sesi.user_id, 'kunci_ulang', userId + ' → ' + itemId);

    return { dikunci: true };
  }

  return {
    barisProgresCache: barisProgresCache,
    indeksKelas: indeksKelas, tetanggaItem: tetanggaItem,
    daftarPertemuan: daftarPertemuan,
    detailPertemuan: detailPertemuan,
    bukaMateri: bukaMateri,
    tandaiBagianSelesai: tandaiBagianSelesai,
    unlockPaksa: unlockPaksa,
    kunciMurid: kunciMurid, kunciItem: kunciItem,
    bukaBanyak: bukaBanyak, kunciUlang: kunciUlang
  };
})();
