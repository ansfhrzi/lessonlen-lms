/**
 * LessonLen v2 — Code.gs
 * doGet + API tipis. Semua lewat _bungkus kecuali login.
 */

var APP_NAMA  = 'LessonLen';
var APP_VERSI = '2.0.0';
var APP_IKON  = '\uD83C\uDF31';

function doGet() {
  var t = HtmlService.createTemplateFromFile('index');
  t.appNama = APP_NAMA;
  t.appVersi = APP_VERSI;
  t.appIkon = APP_IKON;
  return t.evaluate()
    .setTitle(APP_NAMA)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=5')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(nama) {
  return HtmlService.createHtmlOutputFromFile(nama).getContent();
}

function _bungkus(token, peran, fn) {
  try {
    var sesi = null;
    if (peran !== 'publik') {
      sesi = Auth.validasiToken(token);
      if (!sesi) {
        return { ok: false, error: 'SESI_INVALID', pesan: 'Sesi berakhir. Silakan masuk kembali.' };
      }
      if (peran !== 'apa_saja' && sesi.role !== peran) {
        return { ok: false, error: 'AKSES_DITOLAK', pesan: 'Anda tidak berhak mengakses fitur ini.' };
      }
    }
    return { ok: true, data: fn(sesi) };
  } catch (err) {
    if (err && err.kode) return { ok: false, error: err.kode, pesan: err.message };
    if (err && String(err.message).indexOf('SISTEM_SIBUK') !== -1) {
      return { ok: false, error: 'SISTEM_SIBUK', pesan: 'Sistem sedang sibuk. Coba lagi sebentar.' };
    }
    Util.catatLog(null, 'error', String(err && err.message), 'gagal');
    return { ok: false, error: 'KESALAHAN_SERVER', pesan: 'Terjadi kesalahan. Coba lagi beberapa saat.' };
  }
}

/* ---------- auth ---------- */
function login(username, password) {
  try { return Auth.login(username, password); }
  catch (err) {
    return { ok: false, error: 'KESALAHAN_SERVER', pesan: 'Terjadi kesalahan saat masuk.' };
  }
}

function cekSesi(token) {
  return _bungkus(token, 'apa_saja', function (sesi) {
    return {
      user: { user_id: sesi.user_id, username: sesi.username, nama: sesi.nama, role: sesi.role },
      harus_ganti_password: sesi.harus_ganti_password === true
    };
  });
}

function logout(token) {
  return _bungkus(token, 'apa_saja', function (sesi) {
    Auth._hapusSesi(token);
    return { keluar: true };
  });
}

function gantiPassword(token, lama, baru) {
  return _bungkus(token, 'apa_saja', function (sesi) {
    return Auth.gantiPassword(sesi, lama, baru);
  });
}

/* ---------- murid (juga guru memakai getBeranda) ---------- */
function getBeranda(token) {
  return _bungkus(token, 'apa_saja', function (sesi) { return Belajar.beranda(sesi); });
}

function bukaBab(token, babId) {
  return _bungkus(token, 'murid', function (sesi) { return Belajar.bukaBab(sesi, babId); });
}

function tandaiSelesai(token, itemId, selesai) {
  return _bungkus(token, 'murid', function (sesi) {
    return Belajar.tandaiSelesai(sesi, itemId, selesai);
  });
}

function kumpulkanLkpd(token, itemId, links, catatan) {
  return _bungkus(token, 'murid', function (sesi) {
    return Belajar.kumpulkanLkpd(sesi, itemId, links, catatan);
  });
}

function mulaiQuiz(token, itemId) {
  return _bungkus(token, 'murid', function (sesi) { return Belajar.mulaiQuiz(sesi, itemId); });
}

function kumpulkanQuiz(token, attemptId, jawaban) {
  return _bungkus(token, 'murid', function (sesi) {
    return Belajar.kumpulkanQuiz(sesi, attemptId, jawaban);
  });
}

/* ---------- guru ---------- */
function simpanKelas(token, payload) {
  return _bungkus(token, 'guru', function (sesi) { return Guru.simpanKelas(sesi, payload || {}); });
}
function hapusKelas(token, kelasId) {
  return _bungkus(token, 'guru', function (sesi) { return Guru.hapusKelas(sesi, kelasId); });
}
function getIsiKelas(token, kelasId) {
  return _bungkus(token, 'guru', function (sesi) { return Guru.isiKelas(sesi, kelasId); });
}
function simpanBab(token, payload) {
  return _bungkus(token, 'guru', function (sesi) { return Guru.simpanBab(sesi, payload || {}); });
}
function hapusBab(token, babId) {
  return _bungkus(token, 'guru', function (sesi) { return Guru.hapusBab(sesi, babId); });
}
function simpanItem(token, payload) {
  return _bungkus(token, 'guru', function (sesi) { return Guru.simpanItem(sesi, payload || {}); });
}
function hapusItem(token, itemId) {
  return _bungkus(token, 'guru', function (sesi) { return Guru.hapusItem(sesi, itemId); });
}
function aturAkses(token, payload) {
  return _bungkus(token, 'guru', function (sesi) { return Guru.aturAkses(sesi, payload || {}); });
}
function simpanMurid(token, payload) {
  return _bungkus(token, 'guru', function (sesi) { return Guru.simpanMurid(sesi, payload || {}); });
}
function imporMurid(token, kelasId, teks) {
  return _bungkus(token, 'guru', function (sesi) { return Guru.imporMurid(sesi, kelasId, teks); });
}
function keluarkanMurid(token, kelasId, userId) {
  return _bungkus(token, 'guru', function (sesi) { return Guru.keluarkanMurid(sesi, kelasId, userId); });
}
function resetPasswordMurid(token, userId) {
  return _bungkus(token, 'guru', function (sesi) { return Auth.resetPasswordMurid(sesi, userId); });
}
function getRekap(token, kelasId) {
  return _bungkus(token, 'guru', function (sesi) { return Guru.rekap(sesi, kelasId); });
}
function getAntreanLkpd(token) {
  return _bungkus(token, 'guru', function (sesi) { return Guru.antreanLkpd(sesi); });
}
function nilaiLkpd(token, submissionId, keputusan, nilai, catatan) {
  return _bungkus(token, 'guru', function (sesi) {
    return Guru.nilaiLkpd(sesi, submissionId, keputusan, nilai, catatan);
  });
}
