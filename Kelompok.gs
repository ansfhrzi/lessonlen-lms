/**
 * ============================================================
 *  LessonLen — Kelompok.gs
 *  Item tipe `tugas_kelompok`: murid mengerjakan berkelompok
 * ------------------------------------------------------------
 *  Acuan: KESEPAKATAN-SISTEM.md §6.6 (v1.7.0)
 *
 *  ALUR GURU
 *    1. buat item bertipe `tugas_kelompok`
 *    2. bentuk kelompok, pilih anggota & ketua
 *    3. tulis tujuan pembelajaran
 *    4. tulis isi kegiatan (langkah kerja + pertanyaan) — boleh AI
 *    5. terima hasil, beri nilai kelompok + penyesuaian per anggota
 *
 *  ALUR MURID
 *    1. buka item, lihat daftar anggota kelompoknya
 *    2. tiap anggota boleh membaca tugasnya
 *    3. KETUA yang mengumpulkan tautan
 *    4. guru meninjau
 *    5. tiap anggota melihat nilainya sendiri + catatan guru
 *
 *  BENTUK DATA
 *
 *  Sheet `kelompok` menyimpan susunan; `lkpd_submission` menyimpan
 *  pengumpulannya — dipakai ulang karena status, penilaian, dan
 *  umpan baliknya identik dengan LKPD. Kolom pembeda:
 *      kelompok_id    → menandai baris ini milik kelompok
 *      nilai_anggota  → JSON {user_id: nilai} penyesuaian per anggota
 *      user_id        → diisi KETUA (yang mengumpulkan)
 *
 *  KEPUTUSAN PENTING (disepakati guru)
 *
 *  Ketua mengumpulkan, tetapi `progress` SELURUH anggota ikut
 *  berubah. Bila hanya ketua yang tercatat selesai, anggota lain
 *  terkunci selamanya di pertemuan berurut-ketat — mereka tidak
 *  punya cara menyelesaikannya sendiri.
 *
 *  Nilai dua tingkat: nilai kelompok berlaku untuk semua, lalu guru
 *  boleh menyesuaikan per anggota. Yang ditulis ke `progress.nilai`
 *  tiap murid adalah nilai AKHIRNYA, supaya Rekap Nilai konsisten.
 *
 *  ATURAN MENGIKAT
 *   - Dilarang getRange() di dalam loop (KONVENSI §6.2 no. 1)
 *   - Daftar kolom EKSPLISIT di setiap pembacaan (no. 16)
 *   - Nilai getValues() tidak boleh langsung ke peramban (no. 12)
 *   - Satu murid hanya boleh di SATU kelompok per item
 * ============================================================
 */

var Kelompok = (function () {

  var MAKS_ANGGOTA = 12;
  var MAKS_LINK    = 5;

  function _err(kode, pesan) {
    var e = new Error(pesan);
    e.kode = kode;
    return e;
  }

  /* ==================================================== bantu */

  function _parseJson(v, bawaan) {
    if (v === undefined || v === null || v === '') return bawaan;
    try {
      var j = JSON.parse(v);
      return j === null ? bawaan : j;
    } catch (e) { return bawaan; }
  }

  /** Item wajib bertipe tugas_kelompok; kembalikan konteksnya. */
  function _itemTugas(itemId) {
    var item = Db.cariBarisCache('item', 'item_id', itemId);
    if (!item) throw _err('TIDAK_DITEMUKAN', 'Tugas kelompok tidak ditemukan.');
    if (item.tipe !== 'tugas_kelompok') {
      throw _err('VALIDASI_GAGAL', 'Item ini bukan tugas kelompok.');
    }
    var ptm = Db.cariBarisCache('pertemuan', 'pertemuan_id', item.pertemuan_id);
    if (!ptm) throw _err('TIDAK_DITEMUKAN', 'Pertemuan tidak ditemukan.');
    return { item: item, pertemuan: ptm };
  }

  /**
   * Seluruh kelompok satu item, terurut.
   *
   * Daftar kolom EKSPLISIT — menambah kolom ke skema tidak otomatis
   * membuatnya terbaca (pelajaran v1.4.0).
   */
  function _kelompokItem(itemId) {
    return Db.saringBaris('kelompok', 'item_id', itemId,
      ['kelompok_id', 'item_id', 'kelas_id', 'nama', 'ketua_user_id',
       'anggota', 'urutan', 'created_at'])
      .map(function (k) {
        k.anggota = _parseJson(k.anggota, []);
        return k;
      })
      .sort(function (a, b) {
        return (Number(a.urutan) || 0) - (Number(b.urutan) || 0);
      });
  }

  /** Kelompok yang memuat murid ini, atau null. */
  function _kelompokMurid(itemId, userId) {
    var semua = _kelompokItem(itemId);
    for (var i = 0; i < semua.length; i++) {
      if (semua[i].anggota.indexOf(userId) !== -1) return semua[i];
    }
    return null;
  }

  /** Peta user_id → nama, untuk satu kelas. */
  function _petaNama() {
    var peta = {};
    Db.bacaKolom('users', ['user_id', 'nama', 'username'])
      .forEach(function (u) { peta[u.user_id] = u; });
    return peta;
  }

  /**
   * Himpunan murid yang MASIH aktif di kelas ini.
   *
   * Keanggotaan kelompok adalah salinan `user_id` di dalam JSON, jadi
   * ia tidak ikut berubah saat murid dikeluarkan dari kelas
   * (`Kelas.keluarkan()` hanya menyetel enrollment jadi `keluar`).
   *
   * Tanpa penyaringan ini, murid yang sudah pindah/keluar tetap
   * menerima progres dan NILAI saat ketua mengumpulkan — nilai
   * menempel pada orang yang bukan lagi murid kelas itu, dan ikut
   * terbawa ke Rekap (v1.7.3).
   */
  function _muridAktif(kelasId) {
    var aktif = {};
    Db.saringKolom('enrollment',
      { kelas_id: kelasId, status: 'aktif' }, ['user_id'])
      .forEach(function (e) { aktif[e.user_id] = true; });
    return aktif;
  }

  /** Anggota kelompok yang masih aktif di kelasnya. */
  function _anggotaAktif(anggota, kelasId) {
    var aktif = _muridAktif(kelasId);
    return anggota.filter(function (uid) { return aktif[uid]; });
  }

  /** Pengumpulan milik satu kelompok, atau null. */
  function _submissionKelompok(itemId, kelompokId) {
    var ada = Db.saringBaris('lkpd_submission', 'item_id', itemId,
      ['submission_id', 'user_id', 'item_id', 'kelas_id', 'revisi_ke',
       'links', 'catatan_murid', 'status', 'terlambat', 'nilai',
       'catatan_guru', 'dibaca_murid', 'kelompok_id', 'nilai_anggota',
       'waktu_kumpul', 'waktu_dinilai']);
    for (var i = 0; i < ada.length; i++) {
      if (String(ada[i].kelompok_id || '') === kelompokId) return ada[i];
    }
    return null;
  }

  function _terlambat(item) {
    if (!item.batas_waktu) return false;
    var b = new Date(item.batas_waktu);
    return isFinite(b.getTime()) && new Date() > b;
  }

  /**
   * Tulis progres untuk SELURUH anggota sekaligus.
   *
   * Satu operasi per murid lewat Db.tulisProgres() — tetap satu
   * pemanggilan per anggota, tetapi anggota kelompok hanya 3-6 orang
   * sehingga jauh di bawah ambang kuota. Memakai jalur yang sama
   * dengan Lkpd supaya cache progres & unlock ikut disegarkan.
   */
  function _tulisProgresAnggota(anggota, itemId, item, ptm, status, nilaiPer) {
    /* Disaring DI SINI, satu titik, bukan di tiap pemanggil: kelima
       jalur (kumpul, batal, nilai, hapus) sama-sama tidak boleh
       menulis progres untuk murid yang sudah keluar kelas. Menambal
       per pemanggil berarti jalur ke-enam nanti pasti terlewat. */
    anggota = _anggotaAktif(anggota, ptm.kelas_id);
    if (!anggota.length) return;

    /* 🔴 v1.12.5 — LAPORAN LAPANGAN: `nilaiKelompok` 16,7 detik.
     *
     * Sebelumnya fungsi ini memanggil `Db.cariBarisCache2()` sekali
     * PER ANGGOTA di dalam loop. Tiap panggilan memindai kolom
     * `user_id` sheet `progress` sepenuhnya, jadi kelompok 6 anggota
     * membayar enam pemindaian penuh. Terukur pada 16.200 baris:
     *
     *     97.858 sel — 98% dari seluruh biaya menilai
     *
     * Lebih buruk lagi, biayanya TUMBUH seiring besar kelompok.
     *
     * Kini: satu pencarian borongan + satu penulisan borongan.
     * Bandingkan §6.2 no. 1 — yang dilarang bukan hanya `getRange()`
     * di dalam loop, melainkan setiap operasi API yang jumlahnya
     * tumbuh mengikuti jumlah data. */
    var peta = Db.cariBarisBanyak2('progress', 'user_id', anggota,
                                   'item_id', itemId);

    var now = Util.sekarang();
    var perbarui = [], baru = [];

    anggota.forEach(function (uid) {
      var isi = { status: status, updated_at: now };
      if (nilaiPer && nilaiPer[uid] !== undefined && nilaiPer[uid] !== '') {
        isi.nilai = nilaiPer[uid];
      }
      if (status === 'selesai') isi.waktu_selesai = now;

      var pr = peta[uid];
      if (pr) {
        isi._baris = pr._baris;
        perbarui.push(isi);
      } else {
        isi.progress_id = Util.buatId('PRG');
        isi.user_id = uid;
        isi.item_id = itemId;
        isi.pertemuan_id = item.pertemuan_id;
        /* mp_id WAJIB — tanpa ini barisnya yatim saat Materi Pokok
           dihapus (pelajaran v1.0.1, lima jalur tulis kebobolan) */
        isi.mp_id = ptm.mp_id || item.mp_id || '';
        isi.kelas_id = ptm.kelas_id;
        isi.tipe = 'tugas_kelompok';
        isi.waktu_buka = now;
        baru.push(isi);
      }
    });

    /* Kunci dipegang SEKALI untuk seluruh anggota, bukan sekali per
       anggota. Selain lebih cepat, ini membuat penilaian satu
       kelompok menjadi satu operasi utuh: tidak ada keadaan setengah
       jadi bila eksekusi terputus di tengah. */
    Db.denganKunci(function () {
      if (perbarui.length) Db.perbaruiBanyak('progress', perbarui);
      if (baru.length) Db.tambah('progress', baru);
    });

    /* Pembatalan cache progres.
     *
     * ⚠️ Penulisan borongan di atas TIDAK dibungkus `Db.tulisProgres()`,
     * sehingga `Db.invalidasi('progress')` menaikkan epoch GLOBAL —
     * yang membatalkan cache progres SELURUH 218 murid, bukan hanya
     * enam anggota kelompok ini. Itu memindahkan biaya, bukan
     * menghapusnya: murid lain jadi membayar pemindaian penuh.
     *
     * Karena itu epoch tiap anggota dinaikkan satu per satu di sini.
     * `tulisProgres()` dengan fungsi kosong hanya menyentuh
     * CacheService — tidak ada operasi Spreadsheet sama sekali,
     * jadi biayanya dapat diabaikan. */
    anggota.forEach(function (uid) {
      Db.tulisProgres(uid, function () { Db.invalidasi('progress'); });
    });

    /* Nomor baris dititipkan supaya penilaian berikutnya pada item
       yang sama tidak memindai ulang sama sekali. */
    anggota.forEach(function (uid) {
      var pr = peta[uid];
      if (pr) Db.titipBaris2('progress', uid, itemId, pr._baris);
    });
  }

  /* ==================================================== GURU: susunan */

  /**
   * Daftar kelompok + murid yang belum masuk kelompok mana pun.
   */
  function daftar(itemId) {
    var ctx = _itemTugas(itemId);
    var kelasId = ctx.pertemuan.kelas_id;
    var nama = _petaNama();

    var kel = _kelompokItem(itemId);
    var sudah = {};
    kel.forEach(function (k) {
      k.anggota.forEach(function (u) { sudah[u] = k.kelompok_id; });
    });

    var aktif = _muridAktif(kelasId);

    var enroll = Db.saringKolom('enrollment',
      { kelas_id: kelasId, status: 'aktif' }, ['user_id']);

    var belum = enroll
      .filter(function (e) { return !sudah[e.user_id]; })
      .map(function (e) {
        var u = nama[e.user_id] || {};
        return { user_id: e.user_id, nama: u.nama || '(tidak dikenal)',
                 username: u.username || '' };
      })
      .sort(function (a, b) {
        return String(a.nama).localeCompare(String(b.nama), 'id');
      });

    var sub = {};
    Db.saringBaris('lkpd_submission', 'item_id', itemId,
      ['submission_id', 'kelompok_id', 'status', 'nilai', 'links',
       'terlambat', 'waktu_kumpul'])
      .forEach(function (s) {
        if (s.kelompok_id) sub[s.kelompok_id] = s;
      });

    return {
      item: {
        item_id: ctx.item.item_id,
        judul: ctx.item.judul,
        pertemuan_id: ctx.item.pertemuan_id,
        kelas_id: kelasId,
        tujuan_pembelajaran: ctx.item.tujuan_pembelajaran || '',
        konten: ctx.item.konten || '',
        status: ctx.item.status
      },
      kelompok: kel.map(function (k) {
        var s = sub[k.kelompok_id];
        return {
          kelompok_id: k.kelompok_id,
          nama: k.nama,
          urutan: Number(k.urutan) || 0,
          ketua_user_id: k.ketua_user_id || '',
        anggota: k.anggota.map(function (uid) {
          var u = nama[uid] || {};
          return { user_id: uid, nama: u.nama || '(tidak dikenal)',
                   username: u.username || '',
                   ketua: uid === k.ketua_user_id,
                   /* Murid yang sudah keluar kelas TETAP ditampilkan,
                      ditandai. Menyembunyikannya membuat guru bingung
                      kenapa jumlah anggota tidak cocok, dan ia tidak
                      akan tahu perlu membenahi susunannya. */
                   keluar: !aktif[uid] };
        }),
        jml_anggota: k.anggota.length,
        jml_aktif: k.anggota.filter(function (u) { return aktif[u]; }).length,
        /* ketua yang sudah keluar = kelompok ini TIDAK BISA
           mengumpulkan sampai guru menunjuk ketua baru */
        ketua_keluar: !!k.ketua_user_id && !aktif[k.ketua_user_id],
          status: s ? s.status : 'belum',
          nilai: s && s.nilai !== '' ? s.nilai : '',
          jml_link: s ? _parseJson(s.links, []).length : 0,
          terlambat: s ? s.terlambat === true : false,
          submission_id: s ? s.submission_id : '',
          waktu_kumpul: s && s.waktu_kumpul
            ? Util.formatTanggal(s.waktu_kumpul) : ''
        };
      }),
      belum_berkelompok: belum,
      rekap: {
        jml_kelompok: kel.length,
        jml_belum: belum.length,
        jml_terkumpul: Object.keys(sub).length
      }
    };
  }

  /**
   * Simpan satu kelompok — tambah bila `kelompok_id` kosong.
   *
   * Satu murid hanya boleh berada di SATU kelompok per item.
   * Memindahkannya diam-diam akan menyusutkan kelompok lamanya;
   * guru harus tahu apa yang terjadi (pola sama dengan grup soal
   * v1.4.1 B3).
   */
  function simpan(sesi, p) {
    var itemId = String(p.item_id || '').trim();
    var ctx = _itemTugas(itemId);
    var kelasId = ctx.pertemuan.kelas_id;

    var namaKel = Util.sanitasi(String(p.nama || '')).trim().slice(0, 60);
    if (!namaKel) throw _err('VALIDASI_GAGAL', 'Nama kelompok wajib diisi.');

    var anggota = (p.anggota || [])
      .map(function (x) { return String(x || '').trim(); })
      .filter(function (x) { return x.length; });

    /* buang duplikat dalam satu kiriman */
    var unik = [], lihat = {};
    anggota.forEach(function (a) {
      if (!lihat[a]) { lihat[a] = true; unik.push(a); }
    });
    anggota = unik;

    if (!anggota.length) {
      throw _err('VALIDASI_GAGAL', 'Pilih minimal satu anggota.');
    }
    if (anggota.length > MAKS_ANGGOTA) {
      throw _err('VALIDASI_GAGAL',
        'Maksimal ' + MAKS_ANGGOTA + ' anggota per kelompok.');
    }

    /* seluruh anggota harus murid aktif di kelas ini */
    var sah = {};
    Db.saringKolom('enrollment', { kelas_id: kelasId, status: 'aktif' },
      ['user_id']).forEach(function (e) { sah[e.user_id] = true; });

    var bukanMurid = anggota.filter(function (a) { return !sah[a]; });
    if (bukanMurid.length) {
      /* Sebut NAMANYA dan jalan keluarnya. Pesan lama hanya menghitung
         ("1 orang bukan murid aktif") — guru tidak tahu siapa yang
         harus dilepas, padahal kasus tersering adalah murid yang
         dikeluarkan dari kelas SETELAH kelompok terbentuk. */
      var namaPeta = _petaNama();
      var daftarNama = bukanMurid.map(function (u) {
        return (namaPeta[u] || {}).nama || u;
      });
      throw _err('VALIDASI_GAGAL',
        daftarNama.join(', ') + ' bukan lagi murid aktif kelas ini. ' +
        'Hapus centangnya untuk mengeluarkannya dari kelompok.');
    }

    var ketua = String(p.ketua_user_id || '').trim();
    if (!ketua) throw _err('VALIDASI_GAGAL', 'Pilih ketua kelompok.');
    if (anggota.indexOf(ketua) === -1) {
      throw _err('VALIDASI_GAGAL', 'Ketua harus salah satu anggota.');
    }

    var lain = _kelompokItem(itemId).filter(function (k) {
      return k.kelompok_id !== p.kelompok_id;
    });

    /* bentrok dengan kelompok lain */
    var nama = _petaNama();
    var bentrok = [];
    lain.forEach(function (k) {
      k.anggota.forEach(function (u) {
        if (anggota.indexOf(u) !== -1) {
          bentrok.push((nama[u] || {}).nama || u);
        }
      });
    });
    if (bentrok.length) {
      throw _err('VALIDASI_GAGAL',
        bentrok.join(', ') + ' sudah berada di kelompok lain. ' +
        'Keluarkan dari kelompok itu dahulu.');
    }

    /* ---- ubah ---- */
    if (p.kelompok_id) {
      var ada = Db.cariCepat('kelompok', 'kelompok_id', p.kelompok_id);
      if (!ada) throw _err('TIDAK_DITEMUKAN', 'Kelompok tidak ditemukan.');
      if (ada.item_id !== itemId) {
        throw _err('VALIDASI_GAGAL', 'Kelompok bukan milik tugas ini.');
      }

      _tolakBilaSudahDinilai(itemId, p.kelompok_id, 'mengubah susunan kelompok');

      Db.perbarui('kelompok', ada._baris, {
        nama: namaKel, ketua_user_id: ketua,
        anggota: JSON.stringify(anggota)
      });
      Util.catatLog(sesi.user_id, 'ubah_kelompok',
        p.kelompok_id + ' (' + anggota.length + ' anggota)');
      return { kelompok_id: p.kelompok_id, aksi: 'perbarui',
               jml: anggota.length };
    }

    /* ---- tambah ---- */
    var maks = 0;
    lain.forEach(function (k) { maks = Math.max(maks, Number(k.urutan) || 0); });

    var baru = {
      kelompok_id: Util.buatId('KLP'),
      item_id: itemId,
      kelas_id: kelasId,
      nama: namaKel,
      ketua_user_id: ketua,
      anggota: JSON.stringify(anggota),
      urutan: maks + 1,
      created_at: Util.sekarang()
    };
    Db.tambah('kelompok', baru);

    Util.catatLog(sesi.user_id, 'buat_kelompok',
      baru.kelompok_id + ' di ' + itemId + ' (' + anggota.length + ')');
    return { kelompok_id: baru.kelompok_id, aksi: 'tambah',
             jml: anggota.length };
  }

  /**
   * Tolak perubahan susunan bila kelompok sudah dinilai.
   *
   * Mengubah anggota setelah nilai keluar membuat nilai menempel pada
   * orang yang salah — dan murid yang keluar tetap memegang nilainya
   * di `progress`. Guru harus membatalkan penilaiannya dulu.
   */
  function _tolakBilaSudahDinilai(itemId, kelompokId, aksi) {
    var s = _submissionKelompok(itemId, kelompokId);
    if (s && (s.status === 'diterima' || s.status === 'ditolak')) {
      throw _err('VALIDASI_GAGAL',
        'Kelompok ini sudah dinilai. ' +
        'Tidak dapat ' + aksi + ' setelah penilaian keluar.');
    }
  }

  /** Bubarkan kelompok. Pengumpulannya ikut dihapus. */
  function hapus(sesi, itemId, kelompokId) {
    _itemTugas(itemId);
    var k = Db.cariCepat('kelompok', 'kelompok_id', kelompokId);
    if (!k) throw _err('TIDAK_DITEMUKAN', 'Kelompok tidak ditemukan.');
    if (k.item_id !== itemId) {
      throw _err('VALIDASI_GAGAL', 'Kelompok bukan milik tugas ini.');
    }

    _tolakBilaSudahDinilai(itemId, kelompokId, 'membubarkan kelompok');

    /* pengumpulan kelompok ini ikut dibuang — kalau ditinggal, ia
       jadi baris yatim yang tak pernah bisa dinilai maupun dihapus */
    var sub = _submissionKelompok(itemId, kelompokId);
    if (sub) Db.hapus('lkpd_submission', sub._baris);

    /* progres anggotanya dikembalikan ke 'berjalan' */
    var anggota = _parseJson(k.anggota, []);
    var ctx = _itemTugas(itemId);
    if (anggota.length) {
      _tulisProgresAnggota(anggota, itemId, ctx.item, ctx.pertemuan,
                           'berjalan');
    }

    Db.hapus('kelompok', k._baris);
    Util.catatLog(sesi.user_id, 'hapus_kelompok', kelompokId);
    return { terhapus: true, jml_anggota: anggota.length };
  }

  /**
   * Bentuk kelompok otomatis dari murid yang belum berkelompok.
   *
   * Ketua ditetapkan sebagai anggota pertama tiap kelompok — guru
   * bisa menggantinya lewat Ubah. Tanpa penetapan awal, guru harus
   * memilih ketua satu per satu untuk belasan kelompok.
   */
  function bagiOtomatis(sesi, itemId, perKelompok) {
    var ctx = _itemTugas(itemId);
    var n = Math.max(2, Math.min(MAKS_ANGGOTA, Number(perKelompok) || 4));

    var d = daftar(itemId);
    var belum = d.belum_berkelompok.map(function (m) { return m.user_id; });
    if (!belum.length) {
      throw _err('VALIDASI_GAGAL',
        'Semua murid sudah masuk kelompok.');
    }

    var maks = 0;
    _kelompokItem(itemId).forEach(function (k) {
      maks = Math.max(maks, Number(k.urutan) || 0);
    });

    var baris = [], dibuat = 0;
    for (var i = 0; i < belum.length; i += n) {
      var potong = belum.slice(i, i + n);
      /* Sisa 1 orang digabung ke kelompok terakhir, bukan dibiarkan
         sendirian — kelompok beranggota satu bukan kerja kelompok. */
      if (potong.length === 1 && baris.length) {
        var akhir = baris[baris.length - 1];
        var isi = _parseJson(akhir.anggota, []);
        if (isi.length < MAKS_ANGGOTA) {
          isi.push(potong[0]);
          akhir.anggota = JSON.stringify(isi);
          continue;
        }
      }
      dibuat++;
      baris.push({
        kelompok_id: Util.buatId('KLP'),
        item_id: itemId,
        kelas_id: ctx.pertemuan.kelas_id,
        nama: 'Kelompok ' + (maks + dibuat),
        ketua_user_id: potong[0],
        anggota: JSON.stringify(potong),
        urutan: maks + dibuat,
        created_at: Util.sekarang()
      });
    }

    if (baris.length) Db.tambah('kelompok', baris);

    Util.catatLog(sesi.user_id, 'bagi_kelompok_otomatis',
      itemId + ' → ' + baris.length + ' kelompok');
    return { dibuat: baris.length, jml_murid: belum.length };
  }

  /* ==================================================== MURID */

  /**
   * Layar murid: tugasnya, kelompoknya, dan pengumpulannya.
   *
   * Murid yang belum dimasukkan ke kelompok TETAP boleh membuka
   * (keputusan guru) — ia melihat pesan, bukan galat.
   */
  function buka(sesi, itemId) {
    var ctx = _itemTugas(itemId);
    var item = ctx.item, ptm = ctx.pertemuan;

    var terdaftar = Db.saringKolom('enrollment',
      { user_id: sesi.user_id, kelas_id: ptm.kelas_id, status: 'aktif' },
      ['user_id']);
    if (!terdaftar.length) {
      throw _err('AKSES_DITOLAK', 'Anda tidak terdaftar di kelas ini.');
    }

    /* unlock dihitung ulang di server — jangan percaya klien */
    var d = Belajar.detailPertemuan(sesi, item.pertemuan_id);
    var ini = null;
    d.item.forEach(function (x) { if (x.item_id === itemId) ini = x; });
    if (!ini) throw _err('TIDAK_DITEMUKAN', 'Tugas tidak tersedia.');
    if (!ini.terbuka) {
      throw _err('ITEM_TERKUNCI', ini.alasan_kunci || 'Tugas masih terkunci.');
    }

    var kel = _kelompokMurid(itemId, sesi.user_id);
    var nama = _petaNama();

    var dasar = {
      item_id: item.item_id,
      judul: item.judul,
      pertemuan_id: item.pertemuan_id,
      pertemuan_judul: ptm.judul,
      kelas_id: ptm.kelas_id,
      tujuan_pembelajaran: item.tujuan_pembelajaran || '',
      konten: item.konten || '',
      batas_waktu: item.batas_waktu
        ? Util.formatTanggal(item.batas_waktu) : '',
      terlambat: _terlambat(item),
      /* Batas tautan datang dari SERVER, jangan ditulis ulang di
         klien — dua angka yang harus dijaga selaras selalu berakhir
         berbeda. */
      maks_link: MAKS_LINK
    };

    if (!kel) {
      return {
        item: dasar, punya_kelompok: false, kelompok: null,
        pesan: 'Anda belum dimasukkan ke kelompok mana pun. ' +
               'Hubungi guru Anda.'
      };
    }

    var sub = _submissionKelompok(itemId, kel.kelompok_id);
    var akuKetua = kel.ketua_user_id === sesi.user_id;

    /* nilai yang ditampilkan adalah nilai AKHIR murid ini —
       penyesuaian per anggota bila ada, kalau tidak nilai kelompok */
    var nilaiSaya = '';
    if (sub && sub.status === 'diterima') {
      var per = _parseJson(sub.nilai_anggota, {});
      nilaiSaya = (per && per[sesi.user_id] !== undefined &&
                   per[sesi.user_id] !== '')
        ? per[sesi.user_id]
        : (sub.nilai !== '' ? sub.nilai : '');
    }

    return {
      item: dasar,
      punya_kelompok: true,
      aku_ketua: akuKetua,
      kelompok: {
        kelompok_id: kel.kelompok_id,
        nama: kel.nama,
        ketua_user_id: kel.ketua_user_id,
        anggota: kel.anggota.map(function (uid) {
          var u = nama[uid] || {};
          return { user_id: uid, nama: u.nama || '(tidak dikenal)',
                   ketua: uid === kel.ketua_user_id,
                   aku: uid === sesi.user_id };
        })
      },
      pengumpulan: sub ? {
        status: sub.status,
        links: _parseJson(sub.links, []),
        catatan_murid: sub.catatan_murid || '',
        revisi_ke: Number(sub.revisi_ke) || 1,
        terlambat: sub.terlambat === true,
        /* Dua keadaan ini dihitung di SERVER karena aturannya sama
           dengan yang ditegakkan simpanDraf()/batalkan(). Bila klien
           menghitungnya sendiri, tombolnya bisa tampak aktif padahal
           server menolak — pola bug v1.4.3. */
        terkunci: sub.status === 'menunggu' ||
                  sub.status === 'dinilai_proses' ||
                  sub.status === 'diterima',
        bisa_batalkan: sub.status === 'menunggu',
        catatan_guru: sub.status === 'diterima' || sub.status === 'ditolak'
          ? (sub.catatan_guru || '') : '',
        nilai_kelompok: sub.status === 'diterima' && sub.nilai !== ''
          ? sub.nilai : '',
        nilai_saya: nilaiSaya,
        waktu_kumpul: sub.waktu_kumpul
          ? Util.formatTanggal(sub.waktu_kumpul) : ''
      } : { status: 'belum', links: [], catatan_murid: '', revisi_ke: 1,
            terlambat: false, terkunci: false, bisa_batalkan: false,
            catatan_guru: '', nilai_kelompok: '', nilai_saya: '',
            waktu_kumpul: '' }
    };
  }

  /** Simpan draf tautan — hanya ketua. */
  function simpanDraf(sesi, itemId, links, catatan) {
    var ctx = _itemTugas(itemId);
    var kel = _wajibKetua(sesi, itemId);

    var bersih = (links || [])
      .map(function (l) { return String(l || '').trim(); })
      .filter(function (l) { return l.length > 0; });

    if (bersih.length > MAKS_LINK) {
      throw _err('VALIDASI_GAGAL',
        'Maksimal ' + MAKS_LINK + ' tautan.');
    }
    for (var i = 0; i < bersih.length; i++) {
      if (!Util.urlSah(bersih[i])) {
        throw _err('VALIDASI_GAGAL',
          'Tautan ke-' + (i + 1) + ' tidak sah: ' + bersih[i]);
      }
    }

    var isiCatatan = Util.sanitasi(String(catatan || '')).trim().slice(0, 1000);

    return Db.denganKunci(function () {
      var sub = _submissionKelompok(itemId, kel.kelompok_id);

      if (sub && (sub.status === 'menunggu' ||
                  sub.status === 'dinilai_proses' ||
                  sub.status === 'diterima')) {
        throw _err('VALIDASI_GAGAL',
          'Tugas sudah diserahkan. Tidak dapat diubah.');
      }

      if (sub) {
        Db.perbarui('lkpd_submission', sub._baris, {
          links: JSON.stringify(bersih),
          catatan_murid: isiCatatan,
          status: 'draft',
          user_id: sesi.user_id     /* ketua bisa berganti */
        });
        return { tersimpan: true, jml: bersih.length };
      }

      Db.tambah('lkpd_submission', {
        submission_id: Util.buatId('LKP'),
        user_id: sesi.user_id,
        item_id: itemId,
        kelas_id: ctx.pertemuan.kelas_id,
        revisi_ke: 1,
        links: JSON.stringify(bersih),
        catatan_murid: isiCatatan,
        status: 'draft',
        terlambat: false,
        nilai: '',
        catatan_guru: '',
        dibaca_murid: false,
        kelompok_id: kel.kelompok_id,
        nilai_anggota: '',
        waktu_kumpul: '',
        waktu_dinilai: ''
      });
      return { tersimpan: true, jml: bersih.length };
    });
  }

  /** Pastikan murid ini ketua kelompoknya. */
  function _wajibKetua(sesi, itemId) {
    var kel = _kelompokMurid(itemId, sesi.user_id);
    if (!kel) {
      throw _err('AKSES_DITOLAK',
        'Anda belum dimasukkan ke kelompok mana pun.');
    }
    if (kel.ketua_user_id !== sesi.user_id) {
      throw _err('AKSES_DITOLAK',
        'Hanya ketua kelompok yang dapat mengumpulkan tugas.');
    }
    return kel;
  }

  /**
   * Ketua mengumpulkan. Progres SELURUH anggota ikut berubah.
   */
  function kumpulkan(sesi, itemId) {
    var ctx = _itemTugas(itemId);
    var kel = _wajibKetua(sesi, itemId);

    /* TANPA kunci global (v1.9.1) — hanya memperbarui baris
       `lkpd_submission` milik satu murid/kelompok. `Db.tambah()`
       mengambil kuncinya sendiri bila baris baru diperlukan
       (§6.2 no. 56). */
    var hasil = (function () {
      var sub = _submissionKelompok(itemId, kel.kelompok_id);
      if (!sub) {
        throw _err('VALIDASI_GAGAL',
          'Belum ada tautan untuk dikumpulkan.');
      }
      if (sub.status === 'menunggu' || sub.status === 'dinilai_proses') {
        throw _err('VALIDASI_GAGAL', 'Tugas sudah diserahkan.');
      }
      if (sub.status === 'diterima') {
        throw _err('VALIDASI_GAGAL', 'Tugas sudah diterima guru.');
      }

      var links = _parseJson(sub.links, []);
      if (!links.length) {
        throw _err('VALIDASI_GAGAL',
          'Tempelkan minimal satu tautan sebelum mengumpulkan.');
      }

      var telat = _terlambat(ctx.item);
      Db.perbarui('lkpd_submission', sub._baris, {
        status: 'menunggu',
        terlambat: telat,
        user_id: sesi.user_id,
        waktu_kumpul: Util.sekarang()
      });
      return { terlambat: telat, jml_link: links.length,
               revisi_ke: Number(sub.revisi_ke) || 1 };
    })();

    /* SELURUH anggota, bukan hanya ketua — tanpa ini anggota lain
       terkunci selamanya di pertemuan berurut-ketat */
    _tulisProgresAnggota(kel.anggota, itemId, ctx.item, ctx.pertemuan,
                         'menunggu');

    Notif.kirimKeGuru('lkpd_masuk',
      kel.nama + ' mengumpulkan "' + ctx.item.judul + '"' +
      (hasil.terlambat ? ' (terlambat)' : '') + '.',
      '#/nilai-kelompok/' + itemId);

    Util.catatLog(sesi.user_id, 'kumpul_tugas_kelompok',
      itemId + ' / ' + kel.kelompok_id);
    return hasil;
  }

  /** Batalkan pengumpulan selama guru belum menilai. */
  function batalkan(sesi, itemId) {
    var ctx = _itemTugas(itemId);
    var kel = _wajibKetua(sesi, itemId);

    /* TANPA kunci global (v1.9.1) — hanya memperbarui baris
       `lkpd_submission` milik satu murid/kelompok. `Db.tambah()`
       mengambil kuncinya sendiri bila baris baru diperlukan
       (§6.2 no. 56). */
    (function () {
      var sub = _submissionKelompok(itemId, kel.kelompok_id);
      if (!sub) throw _err('TIDAK_DITEMUKAN', 'Belum ada pengumpulan.');
      if (sub.status !== 'menunggu') {
        throw _err('VALIDASI_GAGAL',
          sub.status === 'dinilai_proses'
            ? 'Guru sedang menilai tugas ini.'
            : 'Tidak dapat dibatalkan pada status ini.');
      }
      Db.perbarui('lkpd_submission', sub._baris,
        { status: 'draft', waktu_kumpul: '' });
    })();

    _tulisProgresAnggota(kel.anggota, itemId, ctx.item, ctx.pertemuan,
                         'berjalan');

    Util.catatLog(sesi.user_id, 'batal_kumpul_kelompok', itemId);
    return { dibatalkan: true };
  }

  /* ==================================================== GURU: nilai */

  /** Antrean penilaian: kelompok yang sudah mengumpulkan. */
  function antrean(itemId) {
    var d = daftar(itemId);
    var nama = _petaNama();

    var perlu = d.kelompok.filter(function (k) {
      return k.status === 'menunggu' || k.status === 'dinilai_proses';
    });

    return {
      item: d.item,
      kelompok: d.kelompok,
      perlu_dinilai: perlu.length,
      rekap: d.rekap
    };
  }

  /**
   * Detail satu kelompok untuk layar penilaian guru.
   *
   * `daftar()` sengaja TIDAK memuat tautan, catatan, dan penyesuaian
   * per anggota — payloadnya akan membengkak untuk 12 kelompok
   * sekaligus padahal guru hanya membuka satu. Layar penilaian
   * memanggil fungsi ini saat panel dibuka.
   */
  function detail(itemId, kelompokId) {
    var ctx = _itemTugas(itemId);
    var k = Db.cariCepat('kelompok', 'kelompok_id', kelompokId);
    if (!k) throw _err('TIDAK_DITEMUKAN', 'Kelompok tidak ditemukan.');
    if (k.item_id !== itemId) {
      throw _err('VALIDASI_GAGAL', 'Kelompok bukan milik tugas ini.');
    }

    var anggota = _parseJson(k.anggota, []);
    var nama = _petaNama();
    var sub = _submissionKelompok(itemId, kelompokId);
    var per = sub ? _parseJson(sub.nilai_anggota, {}) : {};

    return {
      item: {
        item_id: ctx.item.item_id,
        judul: ctx.item.judul,
        pertemuan_id: ctx.item.pertemuan_id,
        kelas_id: ctx.pertemuan.kelas_id
      },
      kelompok: {
        kelompok_id: k.kelompok_id,
        nama: k.nama,
        ketua_user_id: k.ketua_user_id || '',
        anggota: anggota.map(function (uid) {
          var u = nama[uid] || {};
          return {
            user_id: uid,
            nama: u.nama || '(tidak dikenal)',
            username: u.username || '',
            ketua: uid === k.ketua_user_id,
            /* nilai penyesuaian yang tersimpan; kosong = ikut nilai
               kelompok. Kosong BUKAN nol (KONVENSI §6.2 no. 22). */
            nilai_penyesuaian: (per && per[uid] !== undefined &&
                                per[uid] !== '') ? per[uid] : ''
          };
        })
      },
      pengumpulan: sub ? {
        submission_id: sub.submission_id,
        status: sub.status,
        links: _parseJson(sub.links, []),
        catatan_murid: sub.catatan_murid || '',
        catatan_guru: sub.catatan_guru || '',
        nilai: sub.nilai === '' ? '' : sub.nilai,
        revisi_ke: Number(sub.revisi_ke) || 1,
        terlambat: sub.terlambat === true,
        waktu_kumpul: sub.waktu_kumpul
          ? Util.formatTanggal(sub.waktu_kumpul) : ''
      } : { status: 'belum', links: [], catatan_murid: '',
            catatan_guru: '', nilai: '', revisi_ke: 1, terlambat: false,
            waktu_kumpul: '' }
    };
  }

  /**
   * Antrean SELURUH tugas kelompok yang menunggu penilaian,
   * dikelompokkan per item — seluruh kelas sekaligus.
   *
   * Sejajar dengan `Lkpd.antrean()`: beranda guru menunjukkan angka
   * "N tugas kelompok menunggu", dan angka itu butuh layar yang
   * memuat semuanya. Sebelum ini tombolnya hanya bisa menunjuk satu
   * item, sehingga tugas kelompok di kelas lain tidak terlihat.
   *
   * Dibaca secara BATCH, bukan memanggil daftar() per item: dengan 12
   * kelas × beberapa tugas, pola per-item berarti puluhan pembacaan
   * sheet berulang (KONVENSI §6.2 no. 1).
   *
   * @param {string=} kelasId  tapis satu kelas; kosong = semua
   */
  function antreanSemua(kelasId) {
    var kelas = String(kelasId || '').trim();

    /* 1. pengumpulan kelompok yang menunggu */
    var sub = Db.bacaKolom('lkpd_submission',
      ['submission_id', 'item_id', 'kelas_id', 'status', 'kelompok_id',
       'terlambat', 'waktu_kumpul'])
      .filter(function (s) {
        if (!String(s.kelompok_id || '').trim()) return false;
        if (s.status !== 'menunggu' && s.status !== 'dinilai_proses') {
          return false;
        }
        return !kelas || s.kelas_id === kelas;
      });

    if (!sub.length) return { item: [], total_kelompok: 0, total_item: 0 };

    /* 2. nama kelompoknya */
    var namaKel = {};
    Db.bacaKolom('kelompok', ['kelompok_id', 'nama', 'anggota'])
      .forEach(function (k) {
        namaKel[k.kelompok_id] = {
          nama: k.nama,
          jml: _parseJson(k.anggota, []).length
        };
      });

    /* 3. judul item & kelasnya */
    var petaItem = {};
    Db.bacaKolom('item', ['item_id', 'judul', 'pertemuan_id', 'tipe'])
      .forEach(function (i) {
        if (i.tipe === 'tugas_kelompok') petaItem[i.item_id] = i;
      });

    var petaPtm = {};
    Db.bacaKolom('pertemuan', ['pertemuan_id', 'urutan'])
      .forEach(function (p) { petaPtm[p.pertemuan_id] = p; });

    var petaKelas = {};
    Db.bacaKolom('kelas', ['kelas_id', 'nama_kelas', 'mapel'])
      .forEach(function (k) { petaKelas[k.kelas_id] = k; });

    /* 4. kelompokkan per item */
    var perItem = {}, urut = [];
    sub.forEach(function (s) {
      var it = petaItem[s.item_id];
      if (!it) return;                    /* item terhapus / bukan tugas */

      if (!perItem[s.item_id]) {
        var kls = petaKelas[s.kelas_id] || {};
        var pt = petaPtm[it.pertemuan_id] || {};
        perItem[s.item_id] = {
          item_id: s.item_id,
          judul: it.judul,
          pertemuan_id: it.pertemuan_id,
          pertemuan_urutan: Number(pt.urutan) || 0,
          kelas_id: s.kelas_id,
          nama_kelas: kls.nama_kelas || '',
          mapel: kls.mapel || '',
          kelompok: []
        };
        urut.push(perItem[s.item_id]);
      }

      var info = namaKel[s.kelompok_id] || {};
      perItem[s.item_id].kelompok.push({
        kelompok_id: s.kelompok_id,
        nama: info.nama || '(kelompok terhapus)',
        jml_anggota: info.jml || 0,
        status: s.status,
        terlambat: s.terlambat === true,
        waktu_kumpul: s.waktu_kumpul
          ? Util.formatTanggal(s.waktu_kumpul) : ''
      });
    });

    var total = 0;
    urut.forEach(function (x) {
      total += x.kelompok.length;
      x.jml_menunggu = x.kelompok.length;
      x.kelompok.sort(function (a, b) {
        return String(a.nama).localeCompare(String(b.nama), 'id');
      });
    });

    /* kelas dulu, lalu urutan pertemuan — cara guru menyusuri kerjanya */
    urut.sort(function (a, b) {
      var k = String(a.nama_kelas).localeCompare(String(b.nama_kelas), 'id');
      if (k !== 0) return k;
      return a.pertemuan_urutan - b.pertemuan_urutan;
    });

    return { item: urut, total_kelompok: total, total_item: urut.length };
  }

  /**
   * Nilai satu kelompok.
   *
   * @param {string} keputusan   'diterima' | 'ditolak'
   * @param {number} nilai       nilai kelompok 0-100
   * @param {Object} nilaiAnggota {user_id: nilai} penyesuaian, opsional
   */
  function nilai(sesi, itemId, kelompokId, keputusan, angka,
                 catatan, nilaiAnggota) {
    var ctx = _itemTugas(itemId);

    if (keputusan !== 'diterima' && keputusan !== 'ditolak') {
      throw _err('VALIDASI_GAGAL', 'Keputusan tidak sah.');
    }
    var isiCatatan = Util.sanitasi(String(catatan || '')).trim().slice(0, 1000);
    if (keputusan === 'ditolak' && !isiCatatan) {
      throw _err('VALIDASI_GAGAL',
        'Catatan wajib diisi saat meminta perbaikan.');
    }

    var n = (angka === '' || angka === null || angka === undefined)
      ? '' : Number(angka);
    if (n !== '' && (isNaN(n) || n < 0 || n > 100)) {
      throw _err('VALIDASI_GAGAL', 'Nilai harus antara 0 dan 100.');
    }

    var kel = Db.cariCepat('kelompok', 'kelompok_id', kelompokId);
    if (!kel) throw _err('TIDAK_DITEMUKAN', 'Kelompok tidak ditemukan.');
    var anggota = _parseJson(kel.anggota, []);

    /* Penyesuaian per anggota: hanya untuk anggota kelompok ini, dan
       nilainya divalidasi dengan aturan yang sama. */
    var per = {};
    if (nilaiAnggota && typeof nilaiAnggota === 'object') {
      Object.keys(nilaiAnggota).forEach(function (uid) {
        if (anggota.indexOf(uid) === -1) return;      /* bukan anggota */
        var v = nilaiAnggota[uid];
        if (v === '' || v === null || v === undefined) return;
        var a = Number(v);
        if (isNaN(a) || a < 0 || a > 100) {
          throw _err('VALIDASI_GAGAL',
            'Nilai anggota harus antara 0 dan 100.');
        }
        per[uid] = a;
      });
    }

    var info = Db.denganKunci(function () {
      var sub = _submissionKelompok(itemId, kelompokId);
      if (!sub) throw _err('TIDAK_DITEMUKAN', 'Kelompok belum mengumpulkan.');
      if (sub.status === 'draft' || sub.status === 'belum') {
        throw _err('VALIDASI_GAGAL', 'Kelompok belum mengumpulkan.');
      }

      var revisi = Number(sub.revisi_ke) || 1;
      Db.perbarui('lkpd_submission', sub._baris, {
        status: keputusan,
        nilai: n,
        catatan_guru: isiCatatan,
        dibaca_murid: false,
        nilai_anggota: JSON.stringify(per),
        revisi_ke: keputusan === 'ditolak' ? revisi + 1 : revisi,
        waktu_dinilai: Util.sekarang()
      });
      return { revisi_ke: revisi };
    });

    /* Nilai AKHIR tiap anggota = penyesuaian bila ada, kalau tidak
       nilai kelompok. Yang masuk progress adalah nilai akhir itu,
       supaya Rekap Nilai konsisten dengan yang dilihat murid. */
    var nilaiPer = {};
    if (keputusan === 'diterima') {
      anggota.forEach(function (uid) {
        nilaiPer[uid] = (per[uid] !== undefined) ? per[uid] : n;
      });
    }

    _tulisProgresAnggota(anggota, itemId, ctx.item, ctx.pertemuan,
      keputusan === 'diterima' ? 'selesai' : 'berjalan',
      keputusan === 'diterima' ? nilaiPer : null);

    /* Tiap anggota diberi tahu nilainya SENDIRI — kecuali yang sudah
       keluar kelas. Ia tidak lagi melihat kelas ini, jadi notifikasi
       bernilai itu hanya membingungkan. */
    _anggotaAktif(anggota, ctx.pertemuan.kelas_id).forEach(function (uid) {
      var nx = nilaiPer[uid];
      Notif.kirimSatu(uid, 'lkpd_dinilai',
        keputusan === 'diterima'
          ? 'Tugas kelompok "' + ctx.item.judul + '" diterima.' +
            (nx !== undefined && nx !== '' ? ' Nilai Anda: ' + nx + '.' : '')
          : 'Tugas kelompok "' + ctx.item.judul + '" perlu diperbaiki. ' +
            'Baca catatan guru.',
        '#/tugas-kelompok/' + itemId);
    });

    Util.catatLog(sesi.user_id, 'nilai_tugas_kelompok',
      kelompokId + ' → ' + keputusan + (n !== '' ? ' (' + n + ')' : ''));

    var hasil = { keputusan: keputusan, nilai: n,
                  jml_anggota: anggota.length,
                  jml_disesuaikan: Object.keys(per).length };

    /* Data untuk tombol "Kirim lewat WhatsApp" (v1.11.4).

       Penerimanya KETUA, bukan seluruh anggota (keputusan guru):
       ketualah yang mengumpulkan, jadi dialah yang memperbaiki.
       Anggota lain tetap menerima notifikasi in-app di atas.

       Bila ketua sudah keluar kelas, nomornya sengaja TIDAK dipakai —
       ia tak lagi melihat kelas ini, dan `ketua_keluar` memang sudah
       ditandai di layar susunan kelompok. */
    if (keputusan === 'ditolak') {
      var uidKetua = kel.ketua_user_id || '';
      var masihAktif = uidKetua &&
        _anggotaAktif([uidKetua], ctx.pertemuan.kelas_id).length > 0;
      var ketua = masihAktif
        ? Db.cariBarisCache('users', 'user_id', uidKetua) : null;

      hasil.wa = {
        nama: ketua ? ketua.nama : '',
        no_wa: ketua ? Util.normalisasiWa(ketua.no_wa) : '',
        judul: ctx.item.judul,
        catatan: isiCatatan,
        nama_kelompok: kel.nama || '',
        peran: 'ketua'
      };
    }

    return hasil;
  }

  return {
    daftar: daftar,
    simpan: simpan,
    hapus: hapus,
    bagiOtomatis: bagiOtomatis,
    buka: buka,
    simpanDraf: simpanDraf,
    kumpulkan: kumpulkan,
    batalkan: batalkan,
    antrean: antrean,
    antreanSemua: antreanSemua,
    detail: detail,
    nilai: nilai,
    MAKS_ANGGOTA: MAKS_ANGGOTA
  };
})();
