/**
 * ============================================================
 *  LessonLen — Notif.gs
 *  Notifikasi in-app (tanpa email sama sekali)
 * ------------------------------------------------------------
 *  Acuan: KESEPAKATAN-SISTEM.md v4.5 §11.11
 *  PENTING: kirim ke banyak murid WAJIB satu setValues (§11.11).
 * ============================================================
 */

var Notif = (function () {

  var JUDUL = {
    enroll_kelas:      'Anda terdaftar di kelas baru',
    pertemuan_baru:    'Pertemuan baru tersedia',
    lkpd_dinilai:      'LKPD Anda sudah dinilai',
    quiz_dikoreksi:    'Quiz Anda sudah dikoreksi',
    feedback_baru:     'Ada umpan balik baru',
    quiz_gagal_habis:  'Percobaan quiz habis',
    lkpd_masuk:        'LKPD masuk',
    permintaan_reset:  'Permintaan reset kata sandi'
  };

  var IKON = {
    enroll_kelas: '📚', pertemuan_baru: '🆕', lkpd_dinilai: '📝',
    quiz_dikoreksi: '🎯', feedback_baru: '💬', quiz_gagal_habis: '⚠️',
    lkpd_masuk: '📥', permintaan_reset: '🔑'
  };

  /**
   * Kirim ke banyak penerima sekaligus — satu operasi tulis.
   * @param {Array<string>} userIds
   */
  function kirim(userIds, jenis, pesan, link, judul) {
    if (!userIds || !userIds.length) return 0;
    var now = Util.sekarang();
    var baris = userIds.map(function (uid) {
      return {
        notif_id: Util.buatId('NTF'),
        user_id: uid,
        jenis: jenis,
        judul: judul || JUDUL[jenis] || 'Pemberitahuan',
        pesan: pesan || '',
        link: link || '',
        dibaca: false,
        dibuat_at: now
      };
    });
    Db.tambah('notifikasi', baris);
    return baris.length;
  }

  function kirimSatu(userId, jenis, pesan, link, judul) {
    return kirim([userId], jenis, pesan, link, judul);
  }

  /** Kirim ke seluruh guru aktif. */
  function kirimKeGuru(jenis, pesan, link, judul) {
    /* Daftar guru praktis tidak pernah berubah (1 orang), sementara
       fungsi ini dipanggil setiap murid mengumpulkan LKPD/quiz — saat
       satu kelas mengumpulkan bersamaan, seluruh sheet `users` dibaca
       36 kali. Simpan hasilnya; dibatalkan lewat Db.invalidasi('users'). */
    var ids = null;
    try {
      var c = CacheService.getScriptCache().get('id_guru');
      if (c) ids = JSON.parse(c);
    } catch (e) {}

    if (!ids) {
      ids = Db.saringKolom('users', { role: 'guru', status: 'aktif' },
                           ['user_id'])
        .map(function (g) { return g.user_id; });
      try {
        CacheService.getScriptCache().put('id_guru', JSON.stringify(ids), 21600);
      } catch (e) {}
    }
    return kirim(ids, jenis, pesan, link, judul);
  }

  /** Kirim ke seluruh murid aktif dalam satu kelas. */
  function kirimKeKelas(kelasId, jenis, pesan, link, judul) {
    var enroll = Db.saring('enrollment', { kelas_id: kelasId, status: 'aktif' });
    return kirim(enroll.map(function (e) { return e.user_id; }),
                 jenis, pesan, link, judul);
  }

  function daftar(userId, limit) {
    var n = Number(limit) || 30;
    return Db.saring('notifikasi', { user_id: userId })
      .sort(function (a, b) {
        var d = new Date(b.dibuat_at).getTime() - new Date(a.dibuat_at).getTime();
        /* tie-break: bila stempel waktu sama persis, urutkan menurut ID
           agar urutan tetap menentu (notifikasi massal dibuat serentak) */
        return d !== 0 ? d : String(b.notif_id).localeCompare(String(a.notif_id));
      })
      .slice(0, n)
      .map(function (r) {
        return {
          notif_id: r.notif_id,
          jenis: r.jenis,
          ikon: IKON[r.jenis] || '🔔',
          judul: r.judul,
          pesan: r.pesan,
          link: r.link,
          dibaca: r.dibaca === true || r.dibaca === 'TRUE',
          dibuat_at: Util.formatTanggal(r.dibuat_at),
          relatif: _relatif(r.dibuat_at)
        };
      });
  }

  function hitungBelumDibaca(userId) {
    return Db.saring('notifikasi', { user_id: userId })
      .filter(function (n) { return n.dibaca !== true && n.dibaca !== 'TRUE'; })
      .length;
  }

  function tandaiDibaca(userId, notifId) {
    var milik = Db.saring('notifikasi', { user_id: userId });

    if (notifId === 'semua') {
      var belum = milik.filter(function (n) {
        return n.dibaca !== true && n.dibaca !== 'TRUE';
      });
      if (!belum.length) return 0;
      Db.perbaruiBanyak('notifikasi', belum.map(function (n) {
        return { _baris: n._baris, dibaca: true };
      }));
      return belum.length;
    }

    for (var i = 0; i < milik.length; i++) {
      if (milik[i].notif_id === notifId) {
        Db.perbarui('notifikasi', milik[i]._baris, { dibaca: true });
        return 1;
      }
    }
    return 0;
  }

  function _relatif(tgl) {
    if (!tgl) return '';
    var selisih = Date.now() - new Date(tgl).getTime();
    var menit = Math.floor(selisih / 60000);
    if (menit < 1)    return 'baru saja';
    if (menit < 60)   return menit + ' menit lalu';
    var jam = Math.floor(menit / 60);
    if (jam < 24)     return jam + ' jam lalu';
    var hari = Math.floor(jam / 24);
    if (hari < 7)     return hari + ' hari lalu';
    return Util.formatTanggal(tgl).slice(0, 10);
  }

  return {
    kirim: kirim, kirimSatu: kirimSatu,
    kirimKeGuru: kirimKeGuru, kirimKeKelas: kirimKeKelas,
    daftar: daftar, hitungBelumDibaca: hitungBelumDibaca,
    tandaiDibaca: tandaiDibaca
  };
})();
