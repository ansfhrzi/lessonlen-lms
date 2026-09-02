/**
 * ============================================================
 *  LMS v2 — Code.gs
 *  doGet, include(), pembungkus API
 *  Kontrak respons sama seperti v1: {ok, data|error, pesan}
 * ============================================================
 */

var APP_NAMA  = 'LessonLen';
var APP_VERSI = '2.0.0';
var APP_IKON  = '\uD83C\uDF31';        /* 🌱 tunas */

/* ============================================================
 *  ENTRI WEB APP
 * ============================================================ */

function doGet(e) {
  var t = HtmlService.createTemplateFromFile('index');
  t.appNama = APP_NAMA;
  t.appVersi = APP_VERSI;
  t.appIkon = APP_IKON;

  return t.evaluate()
    .setTitle(APP_NAMA)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=5')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Sisipkan berkas HTML lain ke dalam template (pola v1 — terbukti). */
function include(nama) {
  return HtmlService.createHtmlOutputFromFile(nama).getContent();
}

/* ============================================================
 *  PEMBUNGKUS API
 *  Seluruh fungsi publik WAJIB lewat sini.
 * ============================================================ */

/**
 * @param {string}   token  token sesi ('' untuk fungsi publik)
 * @param {string}   peran  'guru' | 'murid' | 'apa_saja' | 'publik'
 * @param {Function} fn     menerima (sesi) dan mengembalikan data mentah
 */
function _bungkus(token, peran, fn) {
  try {
    var sesi = null;

    if (peran !== 'publik') {
      sesi = Auth.validasiToken(token);
      if (!sesi) {
        return { ok: false, error: 'SESI_INVALID',
                 pesan: 'Sesi berakhir. Silakan masuk kembali.' };
      }
      if (peran !== 'apa_saja' && sesi.role !== peran) {
        return { ok: false, error: 'AKSES_DITOLAK',
                 pesan: 'Anda tidak berhak mengakses fitur ini.' };
      }
    }

    return { ok: true, data: fn(sesi) };

  } catch (err) {
    /* error yang sengaja dilempar dengan kode */
    if (err && err.kode) {
      return { ok: false, error: err.kode, pesan: err.message };
    }
    /* kunci gagal */
    if (err && String(err.message).indexOf('SISTEM_SIBUK') !== -1) {
      return { ok: false, error: 'SISTEM_SIBUK',
               pesan: 'Sistem sedang sibuk. Coba lagi sebentar.' };
    }
    Util.catatLog(null, 'ERROR',
      String(err && err.message) + ' | ' + String(err && err.stack || ''), 'gagal');
    return { ok: false, error: 'KESALAHAN_SERVER',
             pesan: 'Terjadi kesalahan. Coba lagi beberapa saat.' };
  }
}

/* ============================================================
 *  API — KELOLA KELAS (menu dashboard guru — §22D)
 * ============================================================ */

/** Daftar semua kelas aktif + hitungan murid & course. */
function kelasDaftar(token) {
  return _bungkus(token, 'guru', function (sesi) {
    return Kelas.daftar(sesi);
  });
}

/** Detail kelas + daftar murid yang ter-enroll (dengan pwd_awal). */
function kelasDetail(token, classId) {
  return _bungkus(token, 'guru', function (sesi) {
    return Kelas.detail(sesi, classId);
  });
}

/** Buat/edit kelas. */
function kelasSimpan(token, p) {
  return _bungkus(token, 'guru', function (sesi) {
    return Kelas.simpan(sesi, p);
  });
}

/** Arsipkan kelas (ditolak bila masih dipakai course aktif). */
function kelasArsip(token, classId) {
  return _bungkus(token, 'guru', function (sesi) {
    return Kelas.arsip(sesi, classId);
  });
}

/** Murid aktif yang belum terdaftar di kelas — bahan dialog enroll. */
function kelasMuridTersedia(token, classId) {
  return _bungkus(token, 'guru', function (sesi) {
    return Kelas.muridTersedia(sesi, classId);
  });
}

/** Enroll murid (dedupe + reaktivasi otomatis, proses v1). */
function kelasEnroll(token, classId, userIds) {
  return _bungkus(token, 'guru', function (sesi) {
    return Kelas.enroll(sesi, classId, userIds);
  });
}

/** Keluarkan murid dari kelas (akunnya tetap ada). */
function kelasKeluarkan(token, classId, userId) {
  return _bungkus(token, 'guru', function (sesi) {
    return Kelas.keluarkan(sesi, classId, userId);
  });
}

/* ============================================================
 *  API — KELOLA COURSE (menu dashboard guru — §22D)
 *  "Course" = istilah UI untuk Teaching_Assignments.
 * ============================================================ */

/** Daftar course guru ("KELAS - MAPEL") + hitungan murid. */
function courseDaftar(token) {
  return _bungkus(token, 'guru', function (sesi) {
    return Course.daftar(sesi);
  });
}

/** Detail satu course. */
function courseDetail(token, taId) {
  return _bungkus(token, 'guru', function (sesi) {
    return Course.detail(sesi, taId);
  });
}

/** Buat course = kelas + nama mapel bebas (auto-dedupe ke Subjects). */
function courseSimpan(token, p) {
  return _bungkus(token, 'guru', function (sesi) {
    return Course.simpan(sesi, p);
  });
}

/** Hapus course (lepas relasi; kelas & mapel tetap). */
function courseHapus(token, taId) {
  return _bungkus(token, 'guru', function (sesi) {
    return Course.hapus(sesi, taId);
  });
}

/* ============================================================
 *  API — STATUS API KEY (menu dashboard guru — §22D)
 *  Key tersimpan di Script Properties; panel hanya melihat
 *  4 digit terakhir. Mekanisme persis v1 (Ai.gs).
 * ============================================================ */

/** Status seluruh key (siap / istirahat / bermasalah). */
function apiKeyStatus(token) {
  return _bungkus(token, 'guru', function (sesi) {
    return ApiKey.status(sesi);
  });
}

/** Timpa daftar key (maks 10). Daftar kosong = mencabut semua. */
function apiKeySimpan(token, daftar) {
  return _bungkus(token, 'guru', function (sesi) {
    return ApiKey.simpan(sesi, daftar);
  });
}

/** Buang seluruh cooldown — tombol "Coba Lagi Sekarang". */
function apiKeyResetCooldown(token) {
  return _bungkus(token, 'guru', function (sesi) {
    return ApiKey.resetCooldown(sesi);
  });
}

/* ============================================================
 *  API — BIODATA & LUPA AKSES MANDIRI (keputusan 2026-09-02)
 * ============================================================ */

/** Murid melengkapi biodata: email, no WA, tanggal lahir (NISN opsional). */
function simpanBiodata(token, p) {
  return _bungkus(token, 'apa_saja', function (sesi) {
    return Auth.simpanBiodata(sesi, p);
  });
}

/** Lupa password: username + no WA + tanggal lahir → sandi baru otomatis. */
/** Biodata milik murid sendiri — dipakai layar "Biodata Saya"
 *  (lihat/edit setelah lengkap) & acuan lupa akses mandiri §5.5. */
function getBiodata(token) {
  return _bungkus(token, 'murid', function (sesi) {
    var u = Db.cari('Users', 'user_id', sesi.user_id);
    if (!u) throw { kode: 'TIDAK_DITEMUKAN', message: 'Pengguna tidak ditemukan.' };
    return {
      nisn: String(u.nisn || ''),
      email: String(u.email || ''),
      no_wa: String(u.no_wa || ''),
      tanggal_lahir: String(u.tanggal_lahir || '')
    };
  });
}

function lupaPassword(tokenKosong, username, noWa, tglLahir) {
  return _bungkus('', 'publik', function () {
    return Auth.lupaPassword(username, noWa, tglLahir);
  });
}

/** Lupa username & password: email + no WA + tanggal lahir
 *  → username ditampilkan + sandi baru otomatis. */
function lupaUsername(tokenKosong, email, noWa, tglLahir) {
  return _bungkus('', 'publik', function () {
    return Auth.lupaUsername(email, noWa, tglLahir);
  });
}

/* ============================================================
 *  API — KELOLA MURID (menu dashboard guru — §22D)
 * ============================================================ */

/** Daftar seluruh murid + cari/filter status. */
function muridDaftar(token, filter) {
  return _bungkus(token, 'guru', function (sesi) {
    return Murid.daftar(sesi, filter || {});
  });
}

/** Detail satu murid (biodata + sandi sementara + kelas diikuti). */
function muridDetail(token, userId) {
  return _bungkus(token, 'guru', function (sesi) {
    return Murid.detail(sesi, userId);
  });
}

/** Tambah/edit murid. Buat → kembalikan password_sementara. */
function muridSimpan(token, p) {
  return _bungkus(token, 'guru', function (sesi) {
    return Murid.simpan(sesi, p);
  });
}

/** Uji impor tanpa menulis — untuk pratinjau di layar. */
function muridPratinjauImpor(token, teks) {
  return _bungkus(token, 'guru', function (sesi) {
    return Murid.pratinjauImpor(sesi, teks);
  });
}

/** Impor massal (maks 100) — kembalikan daftar sandi untuk guru. */
function muridImpor(token, teks) {
  return _bungkus(token, 'guru', function (sesi) {
    return Murid.impor(sesi, teks);
  });
}

/* ============================================================
 *  API — AUTENTIKASI (sama seperti v1)
 * ============================================================ */

/** Login. Mengembalikan bentuk {ok,…} langsung dari Auth.login. */
function login(username, password) {
  try {
    return Auth.login(username, password);
  } catch (err) {
    Util.catatLog(null, 'ERROR_LOGIN', String(err && err.message), 'gagal');
    return { ok: false, error: 'KESALAHAN_SERVER',
             pesan: 'Terjadi kesalahan saat masuk.' };
  }
}

/** Cek sesi + status biodata segar dari sheet (bukan dari cache sesi). */
function cekSesi(token) {
  return _bungkus(token, 'apa_saja', function (sesi) {
    var u = Db.cari('Users', 'user_id', sesi.user_id);

    return {
      user_id: sesi.user_id,
      username: sesi.username,
      nama: sesi.nama,
      role: sesi.role,
      harus_ganti_password: u ? (u.harus_ganti_password === true ||
                                 u.harus_ganti_password === 'TRUE') : false,
      biodata_kurang: sesi.role === 'murid' && u ? !Util.biodataLengkap(u) : false,
      versi: APP_VERSI
    };
  });
}

function logout(token) {
  return _bungkus(token, 'apa_saja', function (sesi) {
    Auth._hapusSesi(token);
    Util.catatLog(sesi.user_id, 'LOGOUT', '', 'ok', sesi.role);
    return { berhasil: true };
  });
}

function gantiPassword(token, lama, baru) {
  return _bungkus(token, 'apa_saja', function (sesi) {
    return Auth.gantiPassword(sesi, lama, baru);
  });
}

/** Tanpa token — diakses dari halaman login. */
function ajukanReset(inputUser) {
  return _bungkus('', 'publik', function () {
    return Auth.ajukanReset(inputUser);
  });
}

function getPermintaanReset(token) {
  return _bungkus(token, 'guru', function () {
    return Auth.getPermintaanReset();
  });
}

function resetPasswordMurid(token, userId, requestId) {
  return _bungkus(token, 'guru', function (sesi) {
    return Auth.resetPasswordMurid(sesi, userId, requestId);
  });
}

/* ============================================================
 *  API — DASBOR (ringkasan awal per role)
 * ============================================================ */

function ringkasDashboard(token) {
  return _bungkus(token, 'apa_saja', function (sesi) {
    if (sesi.role === 'guru') return _ringkasGuru(sesi);
    return _ringkasMurid(sesi);
  });
}

/* Beranda ringkas ala §22D: 4 angka + "perlu tindakan". */
function _ringkasGuru(sesi) {
  var murid = Db.bacaKolom('Users', ['user_id', 'role', 'status']);
  var kelas = Db.bacaKolom('Classes', ['class_id', 'status']);
  var ta    = Db.bacaKolom('Teaching_Assignments',
              ['teaching_assignment_id', 'teacher_id', 'status']);
  var api   = ApiKey.status(sesi);

  /* perlu tindakan: antrean permintaan reset sandi (identitas murid). */
  var petaU = {};
  Db.bacaKolom('Users', ['user_id', 'nama', 'username']).forEach(function (u) {
    petaU[u.user_id] = u;
  });
  var antre = Db.saring('Permintaan_Reset', { status: 'antre' })
    .map(function (r) {
      var u = petaU[r.user_id] || {};
      return { request_id: r.request_id, user_id: r.user_id,
               nama: u.nama || '(tidak dikenal)',
               username: u.username || '',
               dibuat_at: String(r.dibuat_at || '') };
    })
    .sort(function (a, b) {
      return String(a.dibuat_at) < String(b.dibuat_at) ? 1 : -1;
    });

  return {
    role: 'guru',
    kelas_aktif: kelas.filter(function (k) { return k.status === 'aktif'; }).length,
    course_aktif: ta.filter(function (t) {
      return t.teacher_id === sesi.user_id && t.status === 'aktif'; }).length,
    murid_aktif: murid.filter(function (u) {
      return u.role === 'murid' && u.status === 'aktif'; }).length,
    api_key: { jml: api.jml, maks: api.maks,
               jml_siap: api.jml_siap, terpasang: api.terpasang },
    perlu_tindakan: { jml: antre.length, daftar: antre.slice(0, 5) }
  };
}

function _ringkasMurid(sesi) {
  var enr = Db.bacaKolom('Enrollment', ['enroll_id', 'user_id', 'status']);
  var notif = Db.bacaKolom('Notifications', ['notif_id', 'user_id', 'dibaca']);
  var saya = Db.cari('Users', 'user_id', sesi.user_id);

  return {
    role: 'murid',
    kelas_diikuti: enr.filter(function (e) {
      return e.user_id === sesi.user_id && e.status === 'aktif'; }).length,
    notif_baru: notif.filter(function (n) {
      return n.user_id === sesi.user_id &&
             (n.dibaca === false || n.dibaca === 'FALSE'); }).length,
    biodata_kurang: saya ? !Util.biodataLengkap(saya) : false
  };
}

/* ============================================================
 *  API — NOTIFIKASI (dasar)
 * ============================================================ */

function daftarNotifikasi(token) {
  return _bungkus(token, 'apa_saja', function (sesi) {
    return Db.saring('Notifications', { user_id: sesi.user_id })
      .sort(function (a, b) { return String(a.created_at) < String(b.created_at) ? 1 : -1; })
      .slice(0, 20)
      .map(function (n) {
        return { notif_id: n.notif_id, jenis: n.jenis, judul: n.judul,
                 pesan: n.pesan, dibaca: n.dibaca === true || n.dibaca === 'TRUE',
                 created_at: String(n.created_at) };
      });
  });
}
