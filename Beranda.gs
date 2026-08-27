/**
 * ============================================================
 *  LessonLen — Beranda.gs
 *  Data dashboard guru & murid
 * ------------------------------------------------------------
 *  Semua perhitungan progres memakai unlock logic §5 kesepakatan.
 *  Dibaca sekali (batch), diolah di memory.
 * ============================================================
 */

var Beranda = (function () {

  /* -------------------------------------------------- guru */

  function untukGuru(sesi) {
    var kelas     = Db.baca('kelas');
    var pertemuan = Db.baca('pertemuan');
    var enroll    = Db.saring('enrollment', { status: 'aktif' });

    /* hanya kolom yang dipakai menghitung statistik — hindari `konten` */
    var item     = Db.bacaKolom('item', ['item_id']);

    /* 🔴 v1.12.4 — `progress` TIDAK LAGI dibaca di sini.
     *
     * LAPORAN LAPANGAN 19 Agu 2026: getBeranda 10,71 detik.
     *
     * Sebelumnya baris ini ada:
     *     var progress = Db.bacaKolom('progress', ['kelas_id','status']);
     *
     * Terukur pada volume nyata (8 kelas · 218 murid): **48.616 sel**
     * dari total 51.041 — 95% biaya seluruh beranda guru — hanya untuk
     * menghasilkan satu angka persen per kartu.
     *
     * Yang membuatnya jauh lebih buruk daripada titik berat lain:
     * `progress` ada di dalam TANPA_CACHE (Db.gs), jadi **cache tidak
     * pernah menyala**. Berbeda dari `_progresMurid()` yang setidaknya
     * tertutup cache 300 detik, biaya ini dibayar PENUH setiap kali
     * guru membuka beranda — termasuk tiap kali kembali dari layar lain.
     *
     * Guru memutuskan angka itu jarang dilihat, jadi dibuang dari kartu
     * (§6.2 no. 92). Rekap Nilai per kelas memberi gambaran yang jauh
     * lebih berguna, dan kini terjangkau satu klik dari Kelola Kelas
     * (v1.12.3).
     *
     * Jangan menambahkan kembali pembacaan `progress` di fungsi ini
     * tanpa penghitung ringkas — dijaga `perf18`. */
    /* `kelompok_id` WAJIB ikut dibaca: sheet ini dipakai bersama LKPD
       dan tugas kelompok. Tanpa kolom itu, tugas kelompok yang
       menunggu ikut terhitung sebagai "LKPD menunggu penilaian" dan
       mengirim guru ke layar yang tidak memuatnya (v1.7.1). */
    var lkpd     = Db.bacaKolom('lkpd_submission',
      ['status', 'kelompok_id']);
    var attempt  = Db.bacaKolom('quiz_attempt', ['status']);

    /* indeks bantu */
    var muridPerKelas = {};
    enroll.forEach(function (e) {
      (muridPerKelas[e.kelas_id] = muridPerKelas[e.kelas_id] || []).push(e.user_id);
    });

    var daftarKelas = kelas
      .filter(function (k) { return k.status === 'aktif'; })
      .map(function (k) {
        var jmlMurid = (muridPerKelas[k.kelas_id] || []).length;
        var jmlPtm = pertemuan.filter(function (p) {
          return p.kelas_id === k.kelas_id;
        }).length;

        return {
          kelas_id: k.kelas_id,
          nama_kelas: k.nama_kelas,
          mapel: k.mapel,
          tingkat: k.tingkat,
          jenjang: k.jenjang,
          jml_murid: jmlMurid,
          jml_pertemuan: jmlPtm,
          jml_publish: pertemuan.filter(function (p) {
            return p.kelas_id === k.kelas_id && p.status === 'publish';
          }).length
          /* `progres` sengaja TIDAK ADA lagi di sini — lihat v1.12.4
             di kepala fungsi. Kartu murid tetap punya `progres`;
             yang dihapus hanya kartu GURU. */
        };
      })
      .sort(function (a, b) {
        return String(a.nama_kelas).localeCompare(String(b.nama_kelas));
      });

    /* tugas yang menunggu tindakan guru */
    var lkpdMenunggu = lkpd.filter(function (l) {
      return l.status === 'menunggu' &&
             !String(l.kelompok_id || '').trim();
    }).length;

    /* Tugas kelompok dihitung TERPISAH. Menggabungkannya ke angka LKPD
       membuat guru menekan "LKPD menunggu penilaian" lalu menemukan
       antrean kosong — pekerjaannya ada di layar lain. */
    /* Tombolnya menuju #/nilai-kelompok TANPA item_id — layar itu
       memuat seluruh tugas kelompok yang menunggu, sejajar dengan
       #/nilai-lkpd. Menunjuk satu item saja menyembunyikan tugas di
       kelas lain (v1.7.2). */
    var kelompokMenunggu = lkpd.filter(function (l) {
      return l.status === 'menunggu' &&
             !!String(l.kelompok_id || '').trim();
    }).length;

    var quizMenunggu = attempt.filter(function (a) {
      return a.status === 'menunggu_koreksi';
    }).length;

    var resetAntre = Db.saring('permintaan_reset', { status: 'antre' })
      .filter(function (r) { return r.user_id; }).length;

    return {
      peran: 'guru',
      user: { user_id: sesi.user_id, nama: sesi.nama, role: sesi.role },
      statistik: {
        jml_kelas: daftarKelas.length,
        jml_murid: Db.saring('users', { role: 'murid', status: 'aktif' }).length,
        jml_pertemuan: pertemuan.length,
        jml_item: item.length
      },
      perlu_tindakan: {
        lkpd_menunggu: lkpdMenunggu,
        quiz_menunggu: quizMenunggu,
        kelompok_menunggu: kelompokMenunggu,
        reset_antre: resetAntre,
        total: lkpdMenunggu + quizMenunggu + kelompokMenunggu + resetAntre
      },
      kelas: daftarKelas,
      notif_belum_dibaca: Notif.hitungBelumDibaca(sesi.user_id)
    };
  }

  /* -------------------------------------------------- murid */

  function untukMurid(sesi) {
    var enroll = Db.saring('enrollment',
                           { user_id: sesi.user_id, status: 'aktif' });

    if (!enroll.length) {
      return {
        peran: 'murid',
        user: { user_id: sesi.user_id, nama: sesi.nama, role: sesi.role },
        kelas: [],
        ringkas: { total_pertemuan: 0, selesai: 0, progres: 0 },
        notif_belum_dibaca: Notif.hitungBelumDibaca(sesi.user_id)
      };
    }

    var idKelas = enroll.map(function (e) { return e.kelas_id; });

    /* Beranda memakai ulang perhitungan Belajar.daftarPertemuan() —
       BUKAN menghitung ulang sendiri.

       Versi sebelumnya menyalin unlock logic dan tidak ikut diperbarui
       saat hierarki tiga tingkat ditambahkan (v1.0). Akibatnya beranda
       mengabaikan Materi Pokok: pertemuan di dalam bab DRAF ikut tampil
       — membocorkan judul yang belum boleh dilihat murid — dan angka
       progresnya berbeda dari halaman kelas.

       Satu sumber kebenaran menghilangkan seluruh kelas bug itu. */
    var daftarKelas = [];
    var totalPtm = 0, totalSelesai = 0;

    idKelas.forEach(function (kid) {
      var d;
      try { d = Belajar.daftarPertemuan(sesi, kid); }
      catch (e) { return; }        /* kelas diarsip / tidak lagi terdaftar */

      var wajib = d.pertemuan.filter(function (p) { return p.wajib; });
      var beres = wajib.filter(function (p) { return p.selesai; });
      totalPtm += wajib.length;
      totalSelesai += beres.length;

      daftarKelas.push({
        kelas_id: d.kelas.kelas_id,
        nama_kelas: d.kelas.nama_kelas,
        mapel: d.kelas.mapel,
        jml_pertemuan: d.pertemuan.length,
        pertemuan_selesai: beres.length,
        progres: d.progres,
        lanjutkan: d.lanjutkan
        /* `pertemuan` sengaja TIDAK dikirim: beranda hanya menampilkan
           judul kelas dan progresnya. Rincian isi ada di halaman kelas,
           dan tidak mengirimnya memangkas payload secara berarti. */
      });
    });

    return {
      peran: 'murid',
      user: { user_id: sesi.user_id, nama: sesi.nama, role: sesi.role },
      kelas: daftarKelas,
      ringkas: {
        total_pertemuan: totalPtm,
        selesai: totalSelesai,
        progres: totalPtm ? Math.round(totalSelesai / totalPtm * 100) : 0
      },
      notif_belum_dibaca: Notif.hitungBelumDibaca(sesi.user_id)
    };
  }

  function ambil(sesi) {
    return sesi.role === 'guru' ? untukGuru(sesi) : untukMurid(sesi);
  }

  /**
   * Hapus cache progres murid. WAJIB dipanggil setiap kali progres
   * berubah, agar dashboard tidak menampilkan data basi.
   */
  /**
   * Batalkan cache dashboard milik satu murid.
   *
   * Hanya kunci murid tersebut yang dihapus — memajukan epoch global
   * akan ikut membatalkan cache 431 murid lain tanpa alasan.
   */
  function invalidasiProgres(userId) {
    try {
      CacheService.getScriptCache()
        .remove('prog_' + userId + '_' + Db.epochProgres(userId));
    } catch (e) {}
  }

  return { ambil: ambil, untukGuru: untukGuru, untukMurid: untukMurid,
           invalidasiProgres: invalidasiProgres };
})();
