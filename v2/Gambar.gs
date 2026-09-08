/* ============================================================
 * LMS v2 — Gambar.gs
 * Penyimpanan gambar (soal quiz sekarang; materi menyusul).
 *
 * Unggahan guru disimpan sebagai BERKAS DRIVE di folder khusus
 * ("LMS v2 — Gambar Soal") lalu dibagikan "siapa saja dengan
 * tautan → lihat" supaya murid tanpa login Google tetap dapat
 * melihatnya. Kolom `gambar_url` menyimpan tautan
 * https://drive.google.com/file/d/ID/view; klien mengubahnya
 * menjadi endpoint thumbnail saat render (lihat urlGambarQz).
 *
 * Klien mengompres gambar dulu di browser (maks ±1280 px, JPEG)
 * sehingga payload `google.script.run` tetap ringan; server
 * mengulang pemeriksaan: mime whitelist + maks 3 MB.
 * ============================================================ */

var Gambar = (function () {

  var MIME_OK = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  var NAMA_FOLDER = 'LMS v2 — Gambar Soal';
  var MAKS_BYTES = 3 * 1024 * 1024; /* 3 MB setelah di-decode */

  function _err(kode, pesan) {
    var e = new Error(pesan); e.kode = kode; throw e;
  }

  /** Folder penyimpanan — dibuat lazy, id-nya dicache di properti. */
  function _folder() {
    var P = PropertiesService.getScriptProperties();
    var id = P.getProperty('FOLDER_GAMBAR_ID');
    if (id) {
      try { return DriveApp.getFolderById(id); } catch (e) { /* terhapus */ }
    }
    var it = DriveApp.getFoldersByName(NAMA_FOLDER);
    var f = it.hasNext() ? it.next() : DriveApp.createFolder(NAMA_FOLDER);
    P.setProperty('FOLDER_GAMBAR_ID', f.getId());
    return f;
  }

  /**
   * Unggah gambar (guru).
   * p = { nama: 'kucing.jpg', mime: 'image/jpeg', base64: '...' }
   * → { file_id, tautan }  (tautan utk kolom gambar_url)
   */
  function unggah(sesi, p) {
    if (sesi.role !== 'guru') _err('DITOLAK', 'Hanya guru yang dapat mengunggah.');
    p = p || {};

    var mime = String(p.mime || '');
    if (MIME_OK.indexOf(mime) === -1)
      _err('VALIDASI_GAGAL', 'Jenis berkas harus JPG, PNG, GIF, atau WebP.');

    var b64 = String(p.base64 || '').replace(/^data:[^;]+;base64,/, '');
    if (!b64) _err('VALIDASI_GAGAL', 'Berkas kosong.');

    var bytes;
    try { bytes = Utilities.base64Decode(b64); }
    catch (e) { _err('VALIDASI_GAGAL', 'Isian gambar tidak sah.'); }
    if (!bytes || !bytes.length) _err('VALIDASI_GAGAL', 'Berkas kosong.');
    if (bytes.length > MAKS_BYTES)
      _err('VALIDASI_GAGAL', 'Gambar maksimal 3 MB — pilih gambar lebih kecil.');

    var nama = String(p.nama || 'gambar').slice(0, 100) || 'gambar';
    var file;
    try {
      file = _folder().createFile(Utilities.newBlob(bytes, mime, nama));
    } catch (e) {
      _err('DRIVE_BLOKIR', 'Drive menolak menyimpan berkas — coba lagi ' +
        'atau pakai tempel tautan gambar.');
    }

    /* Berbagi "siapa saja dgn tautan" SERING diblokir kebijakan domain
       (laporan pemilik 2026-09-08). Kegagalan berbagi BUKAN kegagalan
       unggah: gambar tetap tersimpan (privat) dan disajikan lewat web
       app sendiri — doGet '?gambar=ID' berjalan "as Me" sehingga murid
       tanpa login Google tetap dapat melihat gambarnya. */
    var boleh = true;
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) { boleh = false; }

    var tautan = boleh
      ? 'https://drive.google.com/file/d/' + file.getId() + '/view'
      : ScriptApp.getService().getUrl() + '?gambar=' + file.getId();

    Util.catatLog(sesi.user_id, 'GAMBAR_UNGGAH', nama + ' ' + mime +
        (boleh ? '' : ' (berbagi diblokir domain)'),
      'ok', sesi.role, 'Drive', file.getId());
    return {
      file_id: file.getId(),
      tautan: tautan,
      berbagi: boleh
    };
  }

  /**
   * Sajikan berkas gambar lewat doGet (?gambar=ID) — publik, tanpa
   * sesi: dipanggil <img> murid. Id divalidasi ketat; berkas yang
   * tidak ada → teks penjelasan (bukan error tanpa pesan).
   */
  function sajikan(id) {
    id = String(id || '');
    if (!/^[A-Za-z0-9_-]+$/.test(id)) {
      return ContentService.createOutput('Id gambar tidak sah.')
        .setMimeType(ContentService.MimeType.TEXT);
    }
    var peta = { 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/gif': 'GIF' };
    try {
      var blob = DriveApp.getFileById(id).getBlob();
      var mime = String(blob.getContentType() || '');
      return ContentService.createOutput(blob.getBytes())
        .setMimeType(ContentService.MimeType[peta[mime] || 'JPEG']);
    } catch (e) {
      return ContentService.createOutput('Gambar tidak ditemukan.')
        .setMimeType(ContentService.MimeType.TEXT);
    }
  }

  return { unggah: unggah, sajikan: sajikan };
})();
