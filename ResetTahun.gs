/* ============================================================
 *  ResetTahun.gs — pergantian tahun ajaran (v1.12.0)
 *
 *  Dijalankan SEKALI setiap Juni–Juli, dari editor Apps Script saja.
 *
 *  KEPUTUSAN GURU (ask_user, sesi v1.12.0):
 *    · nilai & pekerjaan murid  → DIARSIPKAN ke Drive, lalu dihapus
 *    · akun murid               → dinonaktifkan, TIDAK dihapus
 *    · struktur pelajaran       → kelas diarsipkan, isinya TETAP
 *    · dijalankan dari          → editor Apps Script saja
 *    · cakupan                  → semua kelas aktif sekaligus
 *
 *  KENAPA TIDAK ADA TOMBOL DI APLIKASI
 *
 *  Operasi ini TIDAK DAPAT DIURUNGKAN. Sekali `progress` dan
 *  `quiz_attempt` terhapus, nilai satu tahun hilang permanen —
 *  Sheets tidak punya tempat sampah untuk baris. Tombol yang hidup
 *  sepanjang tahun di layar yang dipakai saat mengajar adalah risiko
 *  yang tidak sepadan dengan kemudahan sekali setahun.
 *
 *  CARA PAKAI — DUA LANGKAH
 *
 *    resetTahunAjaran()                  → hanya MENGHITUNG, tidak
 *                                          mengubah apa pun
 *    resetTahunAjaran('YA SAYA YAKIN')   → menjalankan
 *
 *  Langkah pertama wajib dibaca lebih dulu. Kalimat konfirmasinya
 *  sengaja panjang dan harus diketik tangan — tidak mungkin terpicu
 *  karena salah klik.
 * ============================================================ */

var ResetTahun = (function () {

  var FRASA = 'YA SAYA YAKIN';

  /* Sheet yang isinya pekerjaan murid — DIKOSONGKAN.

     Urutannya sengaja: yang paling besar lebih dulu, supaya bila
     eksekusi terputus di tengah, yang tersisa justru yang murah
     diulang. */
  var SHEET_PEKERJAAN = ['progress', 'quiz_attempt',
                         'lkpd_submission', 'kelompok'];

  /* Jejak sementara — tidak perlu diarsipkan. */
  var SHEET_JEJAK = ['notifikasi', 'session', 'permintaan_reset'];

  /* Sheet yang TIDAK PERNAH disentuh. Ditulis eksplisit sebagai
     dokumentasi sekaligus dijaga uji: hasil kerja guru berbulan-bulan
     ada di sini. */
  var SHEET_DIPERTAHANKAN = ['users', 'kelas', 'materi_pokok',
                             'pertemuan', 'item', 'soal',
                             'enrollment', 'materi_ai', 'log'];

  function _err(kode, pesan) {
    var e = new Error(pesan); e.kode = kode; return e;
  }

  /**
   * Hitung apa saja yang akan terkena — TANPA mengubah apa pun.
   *
   * Dipakai mode intip maupun laporan akhir, sehingga angka yang
   * dijanjikan dan yang dikerjakan berasal dari sumber yang sama.
   */
  function periksa() {
    var kelasAktif = Db.baca('kelas').filter(function (k) {
      return k.status !== 'arsip';
    });

    var muridAktif = Db.baca('users').filter(function (u) {
      return u.role === 'murid' && u.status === 'aktif';
    });

    var jml = {};
    SHEET_PEKERJAAN.concat(SHEET_JEJAK).forEach(function (nama) {
      jml[nama] = Math.max(0, Db.sheet(nama).getLastRow() - 1);
    });

    return {
      kelas_aktif: kelasAktif.length,
      nama_kelas: kelasAktif.map(function (k) { return k.nama_kelas; }),
      murid_aktif: muridAktif.length,
      baris: jml,
      total_baris: SHEET_PEKERJAAN.reduce(function (a, n) {
        return a + jml[n];
      }, 0)
    };
  }

  /**
   * Arsipkan rekap nilai tiap kelas aktif ke Spreadsheet di Drive.
   *
   * Memakai `Rekap.ekspor()` yang sudah dipakai guru sehari-hari —
   * bukan penulis baru. Bentuk berkasnya jadi sama persis dengan yang
   * sudah dikenal, dan hanya ada satu penyusun tabel yang dirawat.
   *
   * Kegagalan satu kelas TIDAK menghentikan yang lain, tetapi
   * dicatat: reset hanya boleh lanjut bila SELURUH arsip berhasil.
   */
  function arsipkan(sesi) {
    var hasil = { berhasil: [], gagal: [] };

    Db.baca('kelas').filter(function (k) {
      return k.status !== 'arsip';
    }).forEach(function (k) {
      try {
        var r = Rekap.ekspor(sesi, k.kelas_id, 'semua');
        hasil.berhasil.push({ kelas: k.nama_kelas,
                              url: r.url || '', nama: r.nama || '' });
      } catch (e) {
        hasil.gagal.push({ kelas: k.nama_kelas, pesan: e.message });
      }
    });

    return hasil;
  }

  /**
   * Jalankan reset. Hanya dipanggil `resetTahunAjaran()` di Code.gs.
   *
   * @param {Object} sesi   sesi guru
   * @param {string} frasa  wajib sama persis dengan FRASA
   */
  function jalankan(sesi, frasa) {
    if (String(frasa || '').trim().toUpperCase() !== FRASA) {
      throw _err('VALIDASI_GAGAL',
        'Frasa konfirmasi tidak cocok. Ketik persis: ' + FRASA);
    }

    var awal = periksa();
    var laporan = { sebelum: awal, arsip: null, dihapus: {},
                    murid_dinonaktifkan: 0, kelas_diarsipkan: 0 };

    /* --- 1. ARSIPKAN LEBIH DULU ---

       Bila arsip gagal, reset DIBATALKAN seluruhnya. Menghapus nilai
       yang belum sempat tersimpan adalah kehilangan yang tidak dapat
       diperbaiki, dan guru sudah memilih "diekspor dulu". */
    var arsip = arsipkan(sesi);
    laporan.arsip = arsip;
    if (arsip.gagal.length) {
      throw _err('GAGAL_ARSIP',
        'Arsip gagal untuk ' + arsip.gagal.length + ' kelas (' +
        arsip.gagal[0].kelas + ': ' + arsip.gagal[0].pesan + '). ' +
        'Reset DIBATALKAN — tidak ada data yang dihapus.');
    }

    /* --- 2. kosongkan pekerjaan murid --- */
    SHEET_PEKERJAAN.forEach(function (nama) {
      laporan.dihapus[nama] = Db.kosongkanSheet(nama);
    });

    /* --- 3. nonaktifkan murid ---

       Akunnya SENGAJA tidak dihapus (keputusan guru): nama, NISN, dan
       nomor WhatsApp masih berguna bila murid mengulang atau ada
       urusan administrasi. Guru dapat menghapusnya manual nanti. */
    var ubahMurid = [];
    Db.baca('users').forEach(function (u) {
      if (u.role !== 'murid' || u.status !== 'aktif') return;
      ubahMurid.push({ _baris: u._baris, status: 'nonaktif' });
    });
    if (ubahMurid.length) {
      Db.perbaruiBanyak('users', ubahMurid);
      laporan.murid_dinonaktifkan = ubahMurid.length;
    }

    /* --- 4. arsipkan kelas ---

       Status 'arsip' sudah dikenali `Belajar` dan `Kelas.daftar()`
       sejak lama: kelasnya hilang dari daftar aktif tetapi materinya
       tetap dapat disalin ke kelas baru lewat panel Salin. */
    var ubahKelas = [];
    Db.baca('kelas').forEach(function (k) {
      if (k.status === 'arsip') return;
      ubahKelas.push({ _baris: k._baris, status: 'arsip' });
    });
    if (ubahKelas.length) {
      Db.perbaruiBanyak('kelas', ubahKelas);
      laporan.kelas_diarsipkan = ubahKelas.length;
    }

    /* --- 5. bersihkan jejak sementara ---

       `session` dikosongkan terakhir: begitu ia hilang, seluruh
       pengguna termasuk guru harus masuk ulang. */
    SHEET_JEJAK.forEach(function (nama) {
      laporan.dihapus[nama] = Db.kosongkanSheet(nama);
    });

    Util.catatLog(sesi.user_id, 'reset_tahun_ajaran',
      awal.kelas_aktif + ' kelas, ' + awal.murid_aktif + ' murid, ' +
      awal.total_baris + ' baris pekerjaan');

    return laporan;
  }

  return {
    periksa: periksa,
    arsipkan: arsipkan,
    jalankan: jalankan,
    FRASA: FRASA,
    SHEET_PEKERJAAN: SHEET_PEKERJAAN,
    SHEET_JEJAK: SHEET_JEJAK,
    SHEET_DIPERTAHANKAN: SHEET_DIPERTAHANKAN
  };
})();
