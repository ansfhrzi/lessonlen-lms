/**
 * LessonLen v2 — Akses.gs
 * Satu tempat menghitung terbuka/tertutup.
 *
 * Bab: draft = tersembunyi. Terbit + manual/jadwal menentukan buka.
 * Item default ikut bab. Bisa override manual atau jadwal sendiri.
 */

var Akses = (function () {

  function _vis(ent, now) {
    if (!ent) return false;
    var mode = ent.akses || 'manual';
    if (mode === 'jadwal') {
      var buka = Util.parseWaktu(ent.buka_at);
      var tutup = Util.parseWaktu(ent.tutup_at);
      if (buka && now < buka) return false;
      if (tutup && now > tutup) return false;
      return true;
    }
    return Util.ya(ent.terbuka);
  }

  /** Bab terlihat di daftar murid hanya jika terbit. */
  function babTerbit(bab) {
    return bab && bab.status === 'publish';
  }

  function babTerbuka(bab, now) {
    now = now || Date.now();
    return babTerbit(bab) && _vis(bab, now);
  }

  /**
   * @returns {'tersembunyi'|'tertutup'|'terbuka'}
   */
  function statusItem(bab, item, now) {
    now = now || Date.now();
    if (!bab || bab.status !== 'publish') return 'tersembunyi';
    if (!item || item.status !== 'publish') return 'tersembunyi';
    if (!_vis(bab, now)) return 'tertutup';
    var mode = item.akses || 'ikut_bab';
    if (mode === 'ikut_bab') return 'terbuka';
    return _vis(item, now) ? 'terbuka' : 'tertutup';
  }

  return {
    babTerbit: babTerbit,
    babTerbuka: babTerbuka,
    statusItem: statusItem
  };
})();
