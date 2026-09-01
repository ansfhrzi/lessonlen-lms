/**
 * ============================================================
 *  LMS v2 — Notif.gs
 *  Notifikasi in-app (tanpa email) — port dari v1
 * ------------------------------------------------------------
 *  PENTING: kirim ke banyak murid WAJIB satu operasi tulis.
 * ============================================================
 */

var Notif = (function () {

  var JUDUL = {
    enroll_kelas:     'Anda terdaftar di kelas baru',
    pertemuan_baru:   'Pertemuan baru tersedia',
    lkpd_dinilai:     'LKPD Anda sudah dinilai',
    quiz_dikoreksi:   'Quiz Anda sudah dikoreksi',
    feedback_baru:    'Ada umpan balik baru',
    quiz_gagal_habis: 'Percobaan quiz habis',
    lkpd_masuk:       'LKPD masuk',
    permintaan_reset: 'Permintaan reset kata sandi',
    refleksi_dibalas: 'Refleksi Anda dibalas'
  };

  var IKON = {
    enroll_kelas: '📚', pertemuan_baru: '🆕', lkpd_dinilai: '📝',
    quiz_dikoreksi: '🎯', feedback_baru: '💬', quiz_gagal_habis: '⚠️',
    lkpd_masuk: '📥', permintaan_reset: '🔑', refleksi_dibalas: '💬'
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
        created_at: now
      };
    });
    Db.tambah('Notifications', baris);
    return baris.length;
  }

  function kirimSatu(userId, jenis, pesan, link, judul) {
    return kirim([userId], jenis, pesan, link, judul);
  }

  /** Kirim ke seluruh guru aktif (daftar guru di-cache). */
  function kirimKeGuru(jenis, pesan, link, judul) {
    var ids = null;
    try {
      var c = CacheService.getScriptCache().get('id_guru');
      if (c) ids = JSON.parse(c);
    } catch (e) {}

    if (!ids) {
      ids = Db.bacaKolom('Users', ['user_id', 'role', 'status'])
        .filter(function (u) { return u.role === 'guru' && u.status === 'aktif'; })
        .map(function (g) { return g.user_id; });
      try {
        CacheService.getScriptCache().put('id_guru', JSON.stringify(ids), 21600);
      } catch (e) {}
    }
    return kirim(ids, jenis, pesan, link, judul);
  }

  /** Kirim ke seluruh murid aktif dalam satu kelas. */
  function kirimKeKelas(classId, jenis, pesan, link, judul) {
    var enroll = Db.saring('Enrollment', { class_id: classId, status: 'aktif' });
    return kirim(enroll.map(function (e) { return e.user_id; }),
                 jenis, pesan, link, judul);
  }

  function daftar(userId, limit) {
    var n = Number(limit) || 30;
    return Db.saring('Notifications', { user_id: userId })
      .sort(function (a, b) {
        var d = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
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
          created_at: Util.formatTanggal(r.created_at),
          relatif: _relatif(r.created_at)
        };
      });
  }

  function hitungBelumDibaca(userId) {
    return Db.bacaKolom('Notifications', ['notif_id', 'user_id', 'dibaca'])
      .filter(function (n) {
        return n.user_id === userId && n.dibaca !== true && n.dibaca !== 'TRUE';
      }).length;
  }

  function tandaiDibaca(userId, notifId) {
    var n = Db.cari('Notifications', 'notif_id', notifId);
    if (!n || n.user_id !== userId) return { berhasil: false };
    Db.perbarui('Notifications', n._baris, { dibaca: true });
    return { berhasil: true };
  }

  /** "3 menit lalu" — tampilan ringkas waktu. */
  function _relatif(tgl) {
    var t = new Date(tgl).getTime();
    if (isNaN(t)) return '';
    var d = Date.now() - t;
    if (d < 60000)      return 'baru saja';
    if (d < 3600000)    return Math.floor(d / 60000) + ' menit lalu';
    if (d < 86400000)   return Math.floor(d / 3600000) + ' jam lalu';
    if (d < 604800000)  return Math.floor(d / 86400000) + ' hari lalu';
    return Util.formatTanggal(tgl).slice(0, 10);
  }

  return {
    kirim: kirim, kirimSatu: kirimSatu,
    kirimKeGuru: kirimKeGuru, kirimKeKelas: kirimKeKelas,
    daftar: daftar, hitungBelumDibaca: hitungBelumDibaca,
    tandaiDibaca: tandaiDibaca
  };
})();
