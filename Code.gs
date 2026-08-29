/**
 * ============================================================
 *  LessonLen — Code.gs
 *  doGet, include(), pembungkus API
 * ------------------------------------------------------------
 *  Acuan: KONVENSI-TEKNIS.md §4 (kontrak respons), §5.4 (include)
 * ============================================================
 */

var APP_NAMA  = 'LessonLen';
var APP_VERSI = '1.18.1';

/**
 * Ikon aplikasi — SATU tempat untuk seluruh layar (v1.15.6).
 *
 * Sebelumnya emoji 🌱 diketik tangan di TIGA berkas:
 * `index.html` (favicon), `js_core.html` (topbar), dan
 * `v_login.html` (layar masuk). Mengganti ikon berarti mengingat
 * ketiganya — dan yang terlupa baru ketahuan berminggu-minggu
 * kemudian saat guru kebetulan membuka layar itu (§6.2 no. 120).
 *
 * CARA MENGGANTI: ubah SATU baris di bawah, lalu salin ulang
 * `Code.gs`. Emoji apa pun boleh — mis. '📚' '🎓'
 * '✅' '🧩' '🌱'.
 *
 * Bila ingin memakai GAMBAR sendiri (bukan emoji), lihat
 * CARA-PAKAI-IKON.md.
 */
var APP_IKON = '\uD83C\uDF31';        /* 🌱 tunas */

/* ============================================================
 *  ENTRI WEB APP
 * ============================================================ */

function doGet(e) {
  var t = HtmlService.createTemplateFromFile('index');
  t.appNama = APP_NAMA;
  t.appVersi = APP_VERSI;
  t.appIkon = APP_IKON;

  /* Catatan: setFaviconUrl() hanya menerima PNG/ICO — SVG ditolak Apps Script.
     Favicon dipasang lewat <link rel="icon"> di index.html sebagai data-URI. */
  return t.evaluate()
    .setTitle(APP_NAMA)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=5')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Sisipkan berkas HTML lain ke dalam template. */
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
    Util.catatLog(null, 'error',
      String(err && err.message) + ' | ' + String(err && err.stack || ''), 'gagal');
    return { ok: false, error: 'KESALAHAN_SERVER',
             pesan: 'Terjadi kesalahan. Coba lagi beberapa saat.' };
  }
}

/* ============================================================
 *  API — AUTENTIKASI
 * ============================================================ */

/** Login. Mengembalikan bentuk {ok,…} langsung dari Auth.login. */
function login(username, password) {
  try {
    return Auth.login(username, password);
  } catch (err) {
    Util.catatLog(null, 'error_login', String(err && err.message), 'gagal');
    return { ok: false, error: 'KESALAHAN_SERVER',
             pesan: 'Terjadi kesalahan saat masuk.' };
  }
}

function cekSesi(token) {
  return _bungkus(token, 'apa_saja', function (sesi) {
    /* Status biodata dibaca SEGAR dari sheet, bukan dari objek sesi.

       Sesi di-cache satu jam. Bila statusnya ikut disimpan di sana,
       murid yang baru saja melengkapi biodata tetap dianggap kurang
       sampai cache kedaluwarsa — spanduknya muncul terus dan terasa
       seperti simpanannya gagal. `cariBarisCache` hanya menyentuh
       satu baris, jadi biayanya kecil (v1.10.0). */
    var biodataKurang = false;
    if (sesi.role === 'murid') {
      var u = Db.cariBarisCache('users', 'user_id', sesi.user_id);
      biodataKurang = !Util.biodataLengkap(u);
    }
    return {
      user: { user_id: sesi.user_id, username: sesi.username,
              nama: sesi.nama, role: sesi.role },
      harus_ganti_password: sesi.harus_ganti_password === true,
      biodata_kurang: biodataKurang
    };
  });
}

function logout(token) {
  return _bungkus(token, 'apa_saja', function (sesi) {
    Util.catatLog(sesi.user_id, 'logout', '');
    Auth._hapusSesi(token);
    return { keluar: true };
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

/**
 * Cari username dari email + nomor WhatsApp (v1.17.0).
 * Tanpa token — diakses dari halaman login, SEBELUM murid punya sesi.
 *
 * Ini PEMULIHAN, bukan login: tidak ada sesi yang dibuat. Yang
 * dikembalikan hanya username; kata sandi tetap direset guru. Alasan
 * dan aturan keamanannya ada di `Auth.pulihkanAkun()`.
 */
function pulihkanAkun(inputEmail, inputWa) {
  return _bungkus('', 'publik', function () {
    return Auth.pulihkanAkun(inputEmail, inputWa);
  });
}

function getPermintaanReset(token) {
  return _bungkus(token, 'guru', function () {
    return Auth.getPermintaanReset();
  });
}

function resetPasswordMurid(token, userId, requestId) {
  return _bungkus(token, 'guru', function (sesi) {
    var r = Auth.resetPasswordMurid(sesi, userId, requestId);

    /* Tautan WhatsApp disusun di SERVER (v1.11.3), bukan di klien:
       pesannya sama persis dari layar mana pun reset dijalankan, dan
       hanya ada satu tempat yang perlu diubah bila kalimatnya
       disesuaikan.

       Kosong bila murid belum mengisi nomor — layar menyembunyikan
       tombolnya. */
    r.tautan_wa = Kelas.tautanResetWa(r.no_wa, r.nama, r.username,
                                      r.password_sementara);
    return r;
  });
}

/* ============================================================
 *  API — BERANDA
 * ============================================================ */

/** Data ringkas untuk memuat aplikasi pertama kali. */
function getRingkasanAwal(token) {
  return _bungkus(token, 'apa_saja', function (sesi) {
    return {
      user: { user_id: sesi.user_id, nama: sesi.nama, role: sesi.role },
      notif_belum_dibaca: Notif.hitungBelumDibaca(sesi.user_id),
      versi: APP_VERSI
    };
  });
}

/** Data lengkap dashboard, berbeda menurut peran. */
function getBeranda(token) {
  return _bungkus(token, 'apa_saja', function (sesi) {
    return Beranda.ambil(sesi);
  });
}

/* ============================================================
 *  API — NOTIFIKASI
 * ============================================================ */

function getNotifikasi(token, limit) {
  return _bungkus(token, 'apa_saja', function (sesi) {
    return Notif.daftar(sesi.user_id, limit);
  });
}

function tandaiDibaca(token, notifId) {
  return _bungkus(token, 'apa_saja', function (sesi) {
    return { jumlah: Notif.tandaiDibaca(sesi.user_id, notifId) };
  });
}


/* ============================================================
 *  API — KELAS  (guru)
 * ============================================================ */

function getDaftarKelas(token) {
  return _bungkus(token, 'guru', function () { return Kelas.daftar(); });
}

function getDetailKelas(token, kelasId) {
  return _bungkus(token, 'guru', function () { return Kelas.detail(kelasId); });
}

function simpanKelas(token, payload) {
  return _bungkus(token, 'guru', function (sesi) {
    return Kelas.simpan(sesi, payload || {});
  });
}

function duplikatKelas(token, kelasId, namaBaru, ikutIsi, jumlah) {
  return _bungkus(token, 'guru', function (sesi) {
    return Kelas.duplikat(sesi, kelasId, namaBaru, ikutIsi === true, jumlah);
  });
}

function hapusKelas(token, kelasId) {
  return _bungkus(token, 'guru', function (sesi) {
    return Kelas.hapus(sesi, kelasId);
  });
}

/* ============================================================
 *  API — MURID & ENROLLMENT  (guru)
 * ============================================================ */

function getDaftarMurid(token, filter) {
  return _bungkus(token, 'guru', function () {
    return Kelas.daftarMurid(filter || {});
  });
}

/* ---------------------------------------------- BIODATA MURID (v1.10.0)

   Murid melengkapi NISN, email, dan nomor WhatsApp sendiri.
   Peran dikunci 'murid': guru tidak dimintai biodata. */

function getBiodataSaya(token) {
  return _bungkus(token, 'murid', function (sesi) {
    return Kelas.biodataSaya(sesi);
  });
}

function simpanBiodataSaya(token, payload) {
  return _bungkus(token, 'murid', function (sesi) {
    return Kelas.simpanBiodata(sesi, payload || {});
  });
}

/**
 * Isi dialog Profil Saya — biodata + kontak guru sekaligus (v1.11.1).
 *
 * Digabung SATU panggilan karena keduanya selalu dibutuhkan bersamaan
 * saat dialog dibuka. Dua panggilan berarti dua perjalanan bolak-balik
 * dan dialog yang tergambar bertahap (§6.2 no. 51).
 */
function getProfilSaya(token) {
  return _bungkus(token, 'murid', function (sesi) {
    var d = Kelas.biodataSaya(sesi);
    d.guru = Kelas.kontakGuru(sesi);
    return d;
  });
}

/* Profil guru (v1.11.2) — satu-satunya pintu masuk untuk mengisi
   nomor WA guru. Tanpa ini tombol "Hubungi Guru" di layar murid
   tidak akan pernah muncul, sebab `daftarMurid()` hanya menyaring
   role 'murid' sehingga akun guru tak dapat disunting dari mana pun. */
function getProfilGuru(token) {
  return _bungkus(token, 'guru', function (sesi) {
    return Kelas.profilGuru(sesi);
  });
}

function simpanProfilGuru(token, payload) {
  return _bungkus(token, 'guru', function (sesi) {
    return Kelas.simpanProfilGuru(sesi, payload || {});
  });
}

function simpanMurid(token, payload) {
  return _bungkus(token, 'guru', function (sesi) {
    return Kelas.simpanMurid(sesi, payload || {});
  });
}

function pratinjauImpor(token, teks) {
  return _bungkus(token, 'guru', function () {
    return Kelas.pratinjauImpor(teks);
  });
}

function imporMurid(token, kelasId, teks) {
  return _bungkus(token, 'guru', function (sesi) {
    return Kelas.imporMurid(sesi, kelasId, teks);
  });
}

function unduhCsvMurid(token, kelasId) {
  return _bungkus(token, 'guru', function (sesi) {
    return Kelas.csvMurid(sesi, kelasId || '');
  });
}

/* Biodata dipisah dari daftar murid karena berkasnya TIDAK memuat
   kata sandi — sering dibagikan atau dibuka di ponsel (v1.11.0). */
function unduhCsvBiodata(token, kelasId) {
  return _bungkus(token, 'guru', function (sesi) {
    return Kelas.csvBiodata(sesi, kelasId || '');
  });
}

function getMuridKelas(token, kelasId) {
  return _bungkus(token, 'guru', function () {
    return Kelas.murididKelas(kelasId);
  });
}

function getMuridTersedia(token, kelasId) {
  return _bungkus(token, 'guru', function () {
    return Kelas.muridTersedia(kelasId);
  });
}

function enrollMurid(token, kelasId, userIds) {
  return _bungkus(token, 'guru', function (sesi) {
    return Kelas.enroll(sesi, kelasId, userIds || []);
  });
}

function keluarkanMurid(token, kelasId, userId) {
  return _bungkus(token, 'guru', function (sesi) {
    return Kelas.keluarkan(sesi, kelasId, userId);
  });
}

/* ============================================================
 *  API — PERTEMUAN  (guru)
 * ============================================================ */

function getDaftarPertemuan(token, kelasId) {
  return _bungkus(token, 'guru', function () {
    return {
      kelas: Kelas.detail(kelasId),
      pertemuan: Pertemuan.daftarGuru(kelasId)
    };
  });
}

function getDetailPertemuan(token, pertemuanId) {
  return _bungkus(token, 'guru', function () {
    var p = Pertemuan.detail(pertemuanId);
    return {
      pertemuan: p,
      kelas: Kelas.detail(p.kelas_id),
      item: Pertemuan.daftarItem(pertemuanId)
    };
  });
}

function simpanPertemuan(token, payload) {
  return _bungkus(token, 'guru', function (sesi) {
    return Pertemuan.simpan(sesi, payload || {});
  });
}

function hapusPertemuan(token, pertemuanId) {
  return _bungkus(token, 'guru', function (sesi) {
    return Pertemuan.hapus(sesi, pertemuanId);
  });
}

function aturUrutanPertemuan(token, kelasId, ids) {
  return _bungkus(token, 'guru', function (sesi) {
    return Pertemuan.aturUrutan(sesi, kelasId, ids || []);
  });
}

function salinPertemuan(token, pertemuanIds, kelasTujuan) {
  return _bungkus(token, 'guru', function (sesi) {
    return Pertemuan.salin(sesi, pertemuanIds || [], kelasTujuan || []);
  });
}

/* ============================================================
 *  API — ITEM  (guru)
 * ============================================================ */

function getDetailItem(token, itemId) {
  return _bungkus(token, 'guru', function () {
    var i = Pertemuan.detailItem(itemId);
    return { item: i, pertemuan: Pertemuan.detail(i.pertemuan_id) };
  });
}

function simpanItem(token, payload) {
  return _bungkus(token, 'guru', function (sesi) {
    return Pertemuan.simpanItem(sesi, payload || {});
  });
}

function hapusItem(token, itemId) {
  return _bungkus(token, 'guru', function (sesi) {
    return Pertemuan.hapusItem(sesi, itemId);
  });
}

function aturUrutanItem(token, pertemuanId, ids) {
  return _bungkus(token, 'guru', function (sesi) {
    return Pertemuan.aturUrutanItem(sesi, pertemuanId, ids || []);
  });
}

/* ============================================================
 *  API — BELAJAR  (murid)
 * ============================================================ */

function getPertemuanMurid(token, kelasId) {
  return _bungkus(token, 'murid', function (sesi) {
    return Belajar.daftarPertemuan(sesi, kelasId);
  });
}

function getDetailPertemuanMurid(token, pertemuanId) {
  return _bungkus(token, 'murid', function (sesi) {
    return Belajar.detailPertemuan(sesi, pertemuanId);
  });
}

function bukaMateri(token, itemId, bagianKe) {
  return _bungkus(token, 'murid', function (sesi) {
    return Belajar.bukaMateri(sesi, itemId, bagianKe);
  });
}

function tandaiBagianSelesai(token, itemId, bagianKe, detikBaca) {
  return _bungkus(token, 'murid', function (sesi) {
    return Belajar.tandaiBagianSelesai(sesi, itemId, bagianKe, detikBaca);
  });
}

/* guru */
/* ---- Buka Kunci (v1.8.0) ---- */

/** Item apa saja yang terkunci untuk satu murid. */
function getKunciMurid(token, userId, kelasId) {
  return _bungkus(token, 'guru', function () {
    return Belajar.kunciMurid(userId, kelasId);
  });
}

/** Murid mana saja yang terkunci pada satu item. */
function getKunciItem(token, itemId) {
  return _bungkus(token, 'guru', function () {
    return Belajar.kunciItem(itemId);
  });
}

/** Buka satu item untuk beberapa murid sekaligus. */
function bukaKunciBanyak(token, userIds, itemId, alasan) {
  return _bungkus(token, 'guru', function (sesi) {
    return Belajar.bukaBanyak(sesi, userIds || [], itemId, alasan);
  });
}

/** Batalkan pembukaan paksa. */
function kunciUlangItem(token, userId, itemId) {
  return _bungkus(token, 'guru', function (sesi) {
    return Belajar.kunciUlang(sesi, userId, itemId);
  });
}

function unlockPaksa(token, userId, itemId, alasan) {
  return _bungkus(token, 'guru', function (sesi) {
    return Belajar.unlockPaksa(sesi, userId, itemId, alasan);
  });
}

/* ============================================================
 *  API — LKPD  (murid)
 * ============================================================ */

function bukaLkpd(token, itemId) {
  return _bungkus(token, 'murid', function (sesi) {
    return Lkpd.bukaLkpd(sesi, itemId);
  });
}

function simpanDrafLkpd(token, itemId, links, catatan) {
  return _bungkus(token, 'murid', function (sesi) {
    return Lkpd.simpanDraf(sesi, itemId, links, catatan);
  });
}

function kumpulkanLkpd(token, itemId) {
  return _bungkus(token, 'murid', function (sesi) {
    return Lkpd.kumpulkan(sesi, itemId);
  });
}

function batalkanLkpd(token, itemId) {
  return _bungkus(token, 'murid', function (sesi) {
    return Lkpd.batalkan(sesi, itemId);
  });
}

/* ============================================================
 *  API — LKPD  (guru)
 * ============================================================ */

function getAntreanLkpd(token, kelasId) {
  return _bungkus(token, 'guru', function () {
    return Lkpd.antrean(kelasId || '');
  });
}

function getDaftarLkpdKelas(token, itemId) {
  return _bungkus(token, 'guru', function () {
    return Lkpd.daftarKelas(itemId);
  });
}

function getDetailLkpd(token, submissionId) {
  return _bungkus(token, 'guru', function () {
    return Lkpd.detail(submissionId);
  });
}

function mulaiMenilaiLkpd(token, submissionId) {
  return _bungkus(token, 'guru', function (sesi) {
    return Lkpd.mulaiMenilai(sesi, submissionId);
  });
}

/**
 * Susun tautan WhatsApp "minta perbaikan" pada hasil penilaian.
 *
 * Dipakai LKPD dan Tugas Kelompok (v1.11.4). Ditaruh di satu tempat
 * supaya kalimat pesannya tidak pernah berbeda antar keduanya, dan
 * supaya penjaga "nomor tidak sah → tanpa tautan" hanya ada sekali.
 *
 * `hasil.wa` diisi modulnya HANYA saat keputusan `ditolak`.
 */
function _lengkapiTautanWa(hasil) {
  if (!hasil || !hasil.wa) return hasil;
  hasil.wa.tautan = Kelas.tautanPerbaikanWa(
    hasil.wa.no_wa, hasil.wa.nama, hasil.wa.judul,
    hasil.wa.catatan, hasil.wa.nama_kelompok);
  return hasil;
}

function nilaiLkpd(token, submissionId, keputusan, nilai, catatan) {
  return _bungkus(token, 'guru', function (sesi) {
    return _lengkapiTautanWa(
      Lkpd.nilai(sesi, submissionId, keputusan, nilai, catatan));
  });
}

function beriFeedbackLkpd(token, submissionId, catatan) {
  return _bungkus(token, 'guru', function (sesi) {
    return Lkpd.beriFeedback(sesi, submissionId, catatan);
  });
}

function getTemplateFeedback(token) {
  return _bungkus(token, 'guru', function () {
    var t = PropertiesService.getScriptProperties()
      .getProperty('TEMPLATE_FEEDBACK');
    try { return JSON.parse(t || '[]'); } catch (e) { return []; }
  });
}


/**
 * Indeks kelas untuk sidebar navigasi murid — seluruh pertemuan
 * beserta itemnya dalam satu panggilan.
 */
function getIndeksKelas(token, kelasId) {
  return _bungkus(token, 'murid', function (sesi) {
    return Belajar.indeksKelas(sesi, kelasId);
  });
}

/* ============================================================
 *  QUIZ — bank soal (guru)
 * ============================================================ */

function getSoalQuizGuru(token, itemId) {
  return _bungkus(token, 'guru', function () {
    return Quiz.getSoalGuru(itemId);
  });
}

/** Satukan beberapa soal jadi satu kelompok berbagi teks bacaan. */
function satukanGrupSoal(token, itemId, soalIds, stimulus) {
  return _bungkus(token, 'guru', function (sesi) {
    return Quiz.satukanGrup(sesi, itemId, soalIds || [], stimulus || '');
  });
}

/** Ubah teks bacaan sebuah kelompok, tanpa menyusun ulang anggotanya. */
function ubahStimulusGrupSoal(token, itemId, grupId, stimulus) {
  return _bungkus(token, 'guru', function (sesi) {
    return Quiz.ubahStimulusGrup(sesi, itemId, grupId, stimulus || '');
  });
}

/** Lepaskan kelompok; soalnya kembali berdiri sendiri. */
function lepasGrupSoal(token, itemId, grupId) {
  return _bungkus(token, 'guru', function (sesi) {
    return Quiz.lepasGrup(sesi, itemId, grupId);
  });
}

function simpanSoal(token, payload) {
  return _bungkus(token, 'guru', function (sesi) {
    return Quiz.simpanSoal(sesi, payload || {});
  });
}

function hapusSoal(token, soalId) {
  return _bungkus(token, 'guru', function (sesi) {
    return Quiz.hapusSoal(sesi, soalId);
  });
}

function aturUrutanSoal(token, itemId, ids) {
  return _bungkus(token, 'guru', function (sesi) {
    return Quiz.aturUrutanSoal(sesi, itemId, ids || []);
  });
}

function imporSoal(token, dariItemId, keItemId) {
  return _bungkus(token, 'guru', function (sesi) {
    return Quiz.imporSoal(sesi, dariItemId, keItemId);
  });
}

function simpanSoalTerpilih(token, itemId, daftar) {
  return _bungkus(token, 'guru', function (sesi) {
    return Quiz.simpanSoalTerpilih(sesi, itemId, daftar || []);
  });
}

/* ============================================================
 *  QUIZ — pengerjaan (murid)
 * ============================================================ */

function bukaQuiz(token, itemId) {
  return _bungkus(token, 'murid', function (sesi) {
    return Quiz.bukaQuiz(sesi, itemId);
  });
}

function mulaiQuiz(token, itemId) {
  return _bungkus(token, 'murid', function (sesi) {
    return Quiz.mulaiQuiz(sesi, itemId);
  });
}

function lanjutkanAttempt(token, itemId) {
  return _bungkus(token, 'murid', function (sesi) {
    return Quiz.lanjutkanAttempt(sesi, itemId);
  });
}

function simpanJawaban(token, attemptId, soalId, jawaban, ragu) {
  return _bungkus(token, 'murid', function (sesi) {
    return Quiz.simpanJawaban(sesi, attemptId, soalId, jawaban, ragu);
  });
}

/**
 * Kumpulkan quiz beserta SELURUH jawaban sekaligus.
 *
 * `jawaban` adalah larik [{s: soal_id, j: isi, r: ragu}] yang
 * dikumpulkan klien di localStorage selama murid mengerjakan.
 * Boleh kosong — attempt yang jawabannya sudah tersimpan di server
 * (mis. dari versi lama) tetap dinilai apa adanya (v1.9.0).
 */
function kumpulkanQuiz(token, attemptId, jawaban) {
  return _bungkus(token, 'murid', function (sesi) {
    return Quiz.kumpulkanQuiz(sesi, attemptId, jawaban);
  });
}

function getHasilQuiz(token, attemptId) {
  return _bungkus(token, 'murid', function (sesi) {
    return Quiz.hasilAttempt(sesi, attemptId);
  });
}

/* ============================================================
 *  QUIZ — koreksi (guru)
 * ============================================================ */

function getAttemptMenungguKoreksi(token, kelasId) {
  return _bungkus(token, 'guru', function () {
    return Quiz.antreanKoreksi(kelasId || '');
  });
}

function getDaftarKelasQuiz(token, itemId) {
  return _bungkus(token, 'guru', function () {
    return Quiz.daftarKelasQuiz(itemId);
  });
}

function getDaftarQuizLain(token, kecualiItemId) {
  return _bungkus(token, 'guru', function () {
    return Quiz.daftarQuizLain(kecualiItemId || '');
  });
}

function getDetailAttempt(token, attemptId) {
  return _bungkus(token, 'guru', function () {
    return Quiz.detailAttempt(attemptId);
  });
}

function koreksiQuiz(token, attemptId, payload) {
  return _bungkus(token, 'guru', function (sesi) {
    var p = payload || {};
    return Quiz.koreksiQuiz(sesi, attemptId, p.nilai_butir || [], p.catatan);
  });
}

function beriFeedbackQuiz(token, attemptId, catatan) {
  return _bungkus(token, 'guru', function (sesi) {
    return Quiz.beriFeedbackQuiz(sesi, attemptId, catatan);
  });
}

function resetPercobaanQuiz(token, userId, itemId, alasan) {
  return _bungkus(token, 'guru', function (sesi) {
    return Quiz.resetPercobaanQuiz(sesi, userId, itemId, alasan);
  });
}

/**
 * Dipasang sebagai trigger harian.
 * Menandai attempt berjalan yang lewat 24 jam sebagai kedaluwarsa.
 */
function tugasHarianQuiz() {
  var r = Quiz.bersihkanAttemptBasi();
  Logger.log('Attempt kedaluwarsa: ' + r.kedaluwarsa);
  return r;
}



/* ============================================================
 *  MATERI POKOK — tingkat teratas isi kelas (guru)
 * ============================================================ */

function getMateriPokok(token, kelasId) {
  return _bungkus(token, 'guru', function () {
    return MateriPokok.daftar(kelasId);
  });
}

/** Pohon lengkap kelas: materi pokok → pertemuan → cacah item. */
function getStrukturKelas(token, kelasId) {
  return _bungkus(token, 'guru', function () {
    return MateriPokok.struktur(kelasId);
  });
}

/** Pindahkan satu pertemuan ke Materi Pokok lain (kelas yang sama). */
function pindahPertemuan(token, pertemuanId, mpTujuan) {
  return _bungkus(token, 'guru', function (sesi) {
    return Pertemuan.pindah(sesi, pertemuanId, mpTujuan);
  });
}

function getDetailMateriPokok(token, mpId) {
  return _bungkus(token, 'guru', function () {
    return MateriPokok.detail(mpId);
  });
}

function simpanMateriPokok(token, payload) {
  return _bungkus(token, 'guru', function (sesi) {
    return MateriPokok.simpan(sesi, payload || {});
  });
}

function hapusMateriPokok(token, mpId) {
  return _bungkus(token, 'guru', function (sesi) {
    return MateriPokok.hapus(sesi, mpId);
  });
}

function geserMateriPokok(token, mpId, arah) {
  return _bungkus(token, 'guru', function (sesi) {
    return MateriPokok.geser(sesi, mpId, arah);
  });
}

/* ============================================================
 *  REFLEKSI — pertanyaan terbuka + skala pemahaman diri
 * ============================================================ */

function bukaRefleksi(token, itemId) {
  return _bungkus(token, 'murid', function (sesi) {
    return Refleksi.buka(sesi, itemId);
  });
}

function simpanDrafRefleksi(token, itemId, jawaban, skala) {
  return _bungkus(token, 'murid', function (sesi) {
    return Refleksi.simpanDraf(sesi, itemId, jawaban, skala);
  });
}

function kirimRefleksi(token, itemId, jawaban, skala) {
  return _bungkus(token, 'murid', function (sesi) {
    return Refleksi.kirim(sesi, itemId, jawaban, skala);
  });
}

/** Rekap satu refleksi untuk seluruh kelas (guru). */
function getRekapRefleksi(token, itemId) {
  return _bungkus(token, 'guru', function () {
    return Refleksi.rekap(itemId);
  });
}

/** Daftar refleksi satu kelas beserta ringkasan pengisiannya (guru). */
function getRefleksiKelas(token, kelasId) {
  return _bungkus(token, 'guru', function () {
    return Refleksi.daftarKelas(kelasId);
  });
}

function balasRefleksi(token, submissionId, catatan) {
  return _bungkus(token, 'guru', function (sesi) {
    return Refleksi.balas(sesi, submissionId, catatan);
  });
}


/* ============================================================
 *  TUGAS KELOMPOK — v1.7.0
 * ============================================================ */

/* ---- guru: susunan kelompok ---- */

function getKelompok(token, itemId) {
  return _bungkus(token, 'guru', function () {
    return Kelompok.daftar(itemId);
  });
}

function simpanKelompok(token, payload) {
  return _bungkus(token, 'guru', function (sesi) {
    return Kelompok.simpan(sesi, payload || {});
  });
}

function hapusKelompok(token, itemId, kelompokId) {
  return _bungkus(token, 'guru', function (sesi) {
    return Kelompok.hapus(sesi, itemId, kelompokId);
  });
}

function bagiKelompokOtomatis(token, itemId, perKelompok) {
  return _bungkus(token, 'guru', function (sesi) {
    return Kelompok.bagiOtomatis(sesi, itemId, perKelompok);
  });
}

/* ---- guru: penilaian ---- */

function getAntreanKelompok(token, itemId) {
  return _bungkus(token, 'guru', function () {
    return Kelompok.antrean(itemId);
  });
}

/** Seluruh tugas kelompok yang menunggu penilaian, semua kelas. */
function getAntreanKelompokSemua(token, kelasId) {
  return _bungkus(token, 'guru', function () {
    return Kelompok.antreanSemua(kelasId || '');
  });
}

function getDetailKelompok(token, itemId, kelompokId) {
  return _bungkus(token, 'guru', function () {
    return Kelompok.detail(itemId, kelompokId);
  });
}

function nilaiKelompok(token, itemId, kelompokId, keputusan,
                       nilai, catatan, nilaiAnggota) {
  return _bungkus(token, 'guru', function (sesi) {
    return _lengkapiTautanWa(
      Kelompok.nilai(sesi, itemId, kelompokId, keputusan,
                     nilai, catatan, nilaiAnggota || {}));
  });
}

/* ---- murid ---- */

function bukaTugasKelompok(token, itemId) {
  return _bungkus(token, 'murid', function (sesi) {
    return Kelompok.buka(sesi, itemId);
  });
}

function simpanDrafKelompok(token, itemId, links, catatan) {
  return _bungkus(token, 'murid', function (sesi) {
    return Kelompok.simpanDraf(sesi, itemId, links || [], catatan || '');
  });
}

function kumpulkanTugasKelompok(token, itemId) {
  return _bungkus(token, 'murid', function (sesi) {
    return Kelompok.kumpulkan(sesi, itemId);
  });
}

function batalkanTugasKelompok(token, itemId) {
  return _bungkus(token, 'murid', function (sesi) {
    return Kelompok.batalkan(sesi, itemId);
  });
}


/* ============================================================
 *  REKAP NILAI — Tahap 8 (guru)
 * ============================================================ */

/** Tabel rekap satu kelas, ditapis per Materi Pokok. */
function getRekapKelas(token, kelasId, mpId) {
  return _bungkus(token, 'guru', function () {
    return Rekap.kelas(kelasId, mpId || 'semua');
  });
}

/** Daftar bab untuk penapis rekap, beserta cacah item bernilainya. */
function getPilihanBabRekap(token, kelasId) {
  return _bungkus(token, 'guru', function () {
    return Rekap.pilihanBab(kelasId);
  });
}

/**
 * Rekap + pilihan bab sekaligus (v1.12.6).
 *
 * Layar Rekap dulu memanggil `getRekapKelas` dan `getPilihanBabRekap`
 * berbarengan — terlihat di log lapangan berangkat pada detik yang
 * sama (10.34.36). Tiap panggilan Apps Script adalah eksekusi
 * terpisah dengan biaya lantai ±0,9 detik sendiri-sendiri.
 *
 * Kedua API lama sengaja DIPERTAHANKAN: dipakai fungsi diagnostik dan
 * menjadi jalan mundur bila `js_rekap.html` belum tersalin.
 */
function getRekapLengkap(token, kelasId, mpId) {
  return _bungkus(token, 'guru', function () {
    return Rekap.kelasLengkap(kelasId, mpId || 'semua');
  });
}

/**
 * Tulis rekap ke Google Sheet baru, kembalikan tautannya.
 *
 * Operasi ini MEMBUAT BERKAS di Drive guru — bukan sekadar membaca.
 * Karena itu ia menerima sesi (untuk log) dan tidak boleh dipanggil
 * dari jalur murid.
 */
function eksporRekapKelas(token, kelasId, mpId) {
  return _bungkus(token, 'guru', function (sesi) {
    return Rekap.ekspor(sesi, kelasId, mpId || 'semua');
  });
}

/** Buang berkas ekspor lama dari Drive (bawaan: lebih tua dari 30 hari). */
function hapusEksporRekapLama(token, simpanHari) {
  return _bungkus(token, 'guru', function (sesi) {
    return Rekap.hapusEksporLama(sesi, simpanHari);
  });
}


/* ============================================================
 *  AI — generator materi & soal (guru)
 * ============================================================ */


function generateMateriAI(token, itemId, catatan) {
  return _bungkus(token, 'guru', function (sesi) {
    return Ai.generateMateri(sesi, itemId, catatan);
  });
}

/** Susun isi kegiatan LKPD / Tugas Kelompok dengan AI (v1.7.6). */
function generateKegiatanAI(token, itemId, catatan) {
  return _bungkus(token, 'guru', function (sesi) {
    return Ai.generateKegiatan(sesi, itemId, catatan || '');
  });
}

/** Susun pertanyaan refleksi dengan AI (v1.8.1). */
function generateRefleksiAI(token, itemId, jumlah, catatan) {
  return _bungkus(token, 'guru', function (sesi) {
    return Ai.generateRefleksi(sesi, itemId, jumlah, catatan || '');
  });
}

function generateSoalAI(token, payload) {
  return _bungkus(token, 'guru', function (sesi) {
    return Ai.generateSoal(sesi, payload || {});
  });
}

function generateKerangkaAI(token, kelasId, jumlah) {
  return _bungkus(token, 'guru', function (sesi) {
    return Ai.generateKerangka(sesi, kelasId, jumlah);
  });
}

function terapkanKerangkaAI(token, kelasId, daftar) {
  return _bungkus(token, 'guru', function (sesi) {
    return Ai.terapkanKerangka(sesi, kelasId, daftar || []);
  });
}

function getRiwayatAI(token, itemId) {
  return _bungkus(token, 'guru', function () {
    return Ai.riwayat(itemId);
  });
}

function getStatusApiKey(token) {
  return _bungkus(token, 'guru', function () {
    return Ai.statusKeys();
  });
}

function simpanModelAI(token, nama) {
  return _bungkus(token, 'guru', function (sesi) {
    return Ai.simpanModel(sesi, nama);
  });
}

function resetCooldownAI(token) {
  return _bungkus(token, 'guru', function (sesi) {
    return Ai.resetCooldown(sesi);
  });
}

function simpanApiKeys(token, daftar) {
  return _bungkus(token, 'guru', function (sesi) {
    return Ai.simpanKeys(sesi, daftar || []);
  });
}

/**
 * Pasang API key sekali dari editor Apps Script.
 *
 * KEAMANAN: tempel key LANGSUNG di sini, jalankan, lalu HAPUS
 * kembali isinya sebelum menyimpan berkas. Key tidak boleh
 * tertinggal di kode maupun repositori (§10.1b).
 */
function pasangApiKeysManual() {
  _hanyaEditor();
  var KEYS = [
    // 'AIza...1',
    // 'AIza...2',
  ];
  var bersih = KEYS.filter(function (k) { return String(k || '').trim(); });
  if (!bersih.length) {
    Logger.log('Belum ada key diisi. Tempel key di dalam larik KEYS, ' +
               'jalankan ulang, lalu KOSONGKAN kembali.');
    return;
  }
  var r = Ai.simpanKeys(null, bersih);
  Logger.log(r.jml + ' API key tersimpan di Script Properties.');
  Logger.log('SEKARANG: kosongkan kembali larik KEYS di atas, lalu simpan.');
}


/* ============================================================
 *  DIAGNOSTIK — dijalankan dari editor
 * ============================================================ */

/**
 * Sesi guru untuk fungsi diagnostik — TANPA password.
 *
 * 🔴 v1.9.11. Seluruh `ujiTahapN()` sebelumnya memanggil
 * `Auth.login('guru', 'guru123')`, yaitu password SEED. Begitu guru
 * mengganti kata sandinya sendiri — hal yang pasti terjadi pada
 * pemakaian nyata — semua fungsi diagnostik berhenti dengan
 * "Login guru gagal", padahal aplikasinya sehat dan login lewat web
 * berhasil. Dilaporkan dari lapangan.
 *
 * Fungsi ini membuat sesi langsung dari baris `users`, jadi tidak
 * peduli kata sandinya apa. Aman: hanya dapat dijalankan dari editor
 * Apps Script, yang aksesnya sudah milik pemilik skrip.
 *
 * Bentuk kembaliannya sengaja DISAMAKAN dengan `Auth.login()`
 * — `{ ok, data.token, pesan }` — supaya seluruh pemanggil lama
 * yang memeriksa `g.ok` dan membaca `g.data.token` tetap bekerja
 * tanpa diubah (§6.2 no. 61: baca bentuk kembalian, jangan menebak).
 *
 * @returns {Object} { ok, data: { token }, pesan }
 */
function _sesiGuruDiagnostik() {
  _hanyaEditor();
  var guru = Db.saring('users', { role: 'guru', status: 'aktif' });
  if (!guru.length) {
    return { ok: false,
             pesan: 'Tidak ada akun guru aktif di sheet `users`.' };
  }
  return { ok: true, data: { token: Auth._buatSesi(guru[0]) } };
}




function ujiTahap2() {
  _hanyaEditor();
  Logger.log('=== UJI TAHAP 2 ===');
  Logger.log('1. DB_ID  : ' + Db.idDb());
  Logger.log('2. users  : ' + Db.baca('users').length + ' baris');

  var r = _sesiGuruDiagnostik();  /* tanpa password (v1.9.11) */
  Logger.log('3. sesi guru : ' + (r.ok ? 'BERHASIL (tanpa password)' : 'GAGAL — ' + r.pesan));
  if (!r.ok) return;

  var token = r.data.token;
  var s = cekSesi(token);
  Logger.log('4. cekSesi : ' + (s.ok ? s.data.user.nama + ' (' + s.data.user.role + ')' : 'GAGAL'));

  var salah = Auth.login('guru', 'salah');
  Logger.log('5. password salah ditolak : ' + (!salah.ok ? 'YA' : 'TIDAK — BAHAYA'));

  logout(token);
  Logger.log('6. logout & sesi mati : ' + (!cekSesi(token).ok ? 'YA' : 'TIDAK — BAHAYA'));
  Logger.log('=== SELESAI ===');
}

function ujiTahap3() {
  _hanyaEditor();
  Logger.log('=== UJI TAHAP 3 ===');

  var g = _sesiGuruDiagnostik();  /* tanpa password (v1.9.11) */
  if (!g.ok) { Logger.log('Login guru GAGAL: ' + g.pesan); return; }
  var tg = g.data.token;

  var bg = getBeranda(tg);
  if (!bg.ok) { Logger.log('getBeranda guru GAGAL: ' + bg.pesan); return; }
  Logger.log('1. Beranda GURU');
  Logger.log('   kelas        : ' + bg.data.statistik.jml_kelas);
  Logger.log('   murid        : ' + bg.data.statistik.jml_murid);
  Logger.log('   pertemuan    : ' + bg.data.statistik.jml_pertemuan);
  Logger.log('   perlu tindak : ' + bg.data.perlu_tindakan.total);
  bg.data.kelas.forEach(function (k) {
    Logger.log('   - ' + k.nama_kelas + ' | ' + k.jml_murid + ' murid | ' +
               k.jml_pertemuan + ' pertemuan | ' + k.progres + '%');
  });

  var m = Auth.login('siswa01', 'siswa123');
  if (!m.ok) { Logger.log('Login murid GAGAL: ' + m.pesan); return; }
  var tm = m.data.token;

  var bm = getBeranda(tm);
  if (!bm.ok) { Logger.log('getBeranda murid GAGAL: ' + bm.pesan); return; }
  Logger.log('2. Beranda MURID');
  Logger.log('   progres total : ' + bm.data.ringkas.progres + '%');
  bm.data.kelas.forEach(function (k) {
    Logger.log('   - ' + k.nama_kelas + ' (' + k.progres + '%)');
    k.pertemuan.forEach(function (p) {
      var ikon = p.status === 'selesai' ? 'OK  '
               : p.status === 'terkunci' ? 'KUNCI' : 'AKTIF';
      Logger.log('       [' + ikon + '] ' + p.urutan + '. ' + p.judul +
                 '  (' + p.item_selesai + '/' + p.jml_wajib + ' item)');
    });
  });

  var n = getNotifikasi(tm, 5);
  Logger.log('3. notifikasi murid : ' + (n.ok ? n.data.length + ' item' : 'GAGAL'));
  if (n.ok && n.data.length) {
    Logger.log('   contoh : ' + n.data[0].ikon + ' ' + n.data[0].judul +
               ' (' + n.data[0].relatif + ')');
  }

  Logger.log('4. unlock logic: pertemuan 2 harus TERKUNCI karena');
  Logger.log('   pertemuan 1 belum selesai — cek daftar di atas.');
  Logger.log('=== SELESAI ===');
}

function ujiTahap4() {
  _hanyaEditor();
  Logger.log('=== UJI TAHAP 4 ===');
  var g = _sesiGuruDiagnostik();  /* tanpa password (v1.9.11) */
  if (!g.ok) { Logger.log('Login gagal'); return; }
  var t = g.data.token;

  var k = getDaftarKelas(t);
  Logger.log('1. daftar kelas : ' + (k.ok ? k.data.length : 'GAGAL'));
  k.data.forEach(function (x) {
    Logger.log('   - ' + x.nama_kelas + ' | ' + x.jml_murid + ' murid | ' +
               x.jml_pertemuan + ' pertemuan');
  });

  var kid = k.data[0].kelas_id;
  var dp = getDaftarPertemuan(t, kid);
  Logger.log('2. pertemuan di kelas : ' + (dp.ok ? dp.data.pertemuan.length : 'GAGAL'));
  dp.data.pertemuan.forEach(function (p) {
    Logger.log('   ' + p.urutan + '. ' + p.judul + ' [' + p.status + '] ' +
               p.jml_item + ' item (M' + p.jml_materi + ' L' + p.jml_lkpd +
               ' Q' + p.jml_quiz + ')');
  });

  var pid = dp.data.pertemuan[0].pertemuan_id;
  var di = getDetailPertemuan(t, pid);
  Logger.log('3. item di pertemuan 1 :');
  di.data.item.forEach(function (i) {
    Logger.log('   - [' + i.tipe + '] ' + i.judul +
               (i.jml_bagian ? ' (' + i.jml_bagian + ' bagian)' : '') +
               (i.jml_soal ? ' (' + i.jml_soal + ' soal)' : ''));
  });

  var m = getDaftarMurid(t, {});
  Logger.log('4. daftar murid : ' + (m.ok ? m.data.length : 'GAGAL'));

  var tersedia = getMuridTersedia(t, kid);
  Logger.log('5. murid belum terdaftar : ' +
             (tersedia.ok ? tersedia.data.length : 'GAGAL'));

  Logger.log('=== SELESAI ===');
}

function ujiTahap5() {
  _hanyaEditor();
  Logger.log('=== UJI TAHAP 5 ===');
  var m = Auth.login('siswa01', 'siswa123');
  if (!m.ok) { Logger.log('Login murid gagal'); return; }
  var t = m.data.token;

  var b = getBeranda(t);
  if (!b.ok || !b.data.kelas.length) { Logger.log('Murid tanpa kelas'); return; }
  var kid = b.data.kelas[0].kelas_id;

  var dp = getPertemuanMurid(t, kid);
  Logger.log('1. Daftar pertemuan (' + dp.data.progres + '%)');
  dp.data.pertemuan.forEach(function (p) {
    Logger.log('   [' + (p.status === 'selesai' ? 'OK   '
      : p.status === 'terkunci' ? 'KUNCI' : 'AKTIF') + '] ' +
      p.urutan + '. ' + p.judul + ' (' + p.item_selesai + '/' + p.jml_wajib + ')');
  });

  var pid = dp.data.pertemuan[0].pertemuan_id;
  var d = getDetailPertemuanMurid(t, pid);
  Logger.log('2. Item di pertemuan 1:');
  d.data.item.forEach(function (i) {
    Logger.log('   [' + (i.terbuka ? 'BUKA ' : 'KUNCI') + '] ' +
      i.tipe + ' — ' + i.judul +
      (i.jml_bagian ? ' (' + i.bagian_terakhir + '/' + i.jml_bagian + ' bagian)' : '') +
      (i.terbuka ? '' : ' — ' + i.alasan_kunci));
  });

  var materi = null;
  d.data.item.forEach(function (i) {
    if (!materi && i.tipe === 'materi' && i.terbuka) materi = i;
  });
  if (!materi) { Logger.log('Tidak ada materi terbuka'); return; }

  var bm = bukaMateri(t, materi.item_id, 1);
  Logger.log('3. Buka materi bagian 1 dari ' + bm.data.jml_bagian);
  Logger.log('   panjang konten: ' + String(bm.data.konten).length + ' karakter');

  var lompat = bukaMateri(t, materi.item_id, bm.data.jml_bagian);
  Logger.log('4. Lompat ke bagian akhir ditolak: ' +
             (!lompat.ok ? 'YA (' + lompat.error + ')' : 'TIDAK — BAHAYA'));

  var ts = tandaiBagianSelesai(t, materi.item_id, 1, 999);
  Logger.log('5. Tandai bagian 1 selesai: ' +
             ts.data.bagian_terakhir + '/' + ts.data.jml_bagian);

  Logger.log('=== SELESAI ===');
}

function ujiTahap6A() {
  _hanyaEditor();
  Logger.log('=== UJI TAHAP 6A — LKPD ===');
  var m = Auth.login('siswa01', 'siswa123');
  if (!m.ok) { Logger.log('Login murid gagal'); return; }
  var tm = m.data.token;
  var g = _sesiGuruDiagnostik();  /* tanpa password (v1.9.11) */
  var tg = g.data.token;

  var b = getBeranda(tm);
  if (!b.ok || !b.data.kelas.length) { Logger.log('Murid tanpa kelas'); return; }

  /* cari item LKPD yang terbuka */
  var target = null;
  b.data.kelas[0].pertemuan.forEach(function (p) {
    if (target || !p.terbuka) return;
    var d = getDetailPertemuanMurid(tm, p.pertemuan_id);
    if (!d.ok) return;
    d.data.item.forEach(function (i) {
      if (!target && i.tipe === 'lkpd' && i.terbuka) target = i;
    });
  });
  if (!target) { Logger.log('Tidak ada LKPD terbuka — selesaikan materi dulu.'); return; }

  Logger.log('1. LKPD: ' + target.judul);
  var bk = bukaLkpd(tm, target.item_id);
  Logger.log('   status awal : ' + bk.data.status);

  simpanDrafLkpd(tm, target.item_id,
    ['https://drive.google.com/file/d/contoh'], 'Sudah saya kerjakan.');
  Logger.log('2. Draf disimpan');

  var k = kumpulkanLkpd(tm, target.item_id);
  Logger.log('3. Dikumpulkan: ' + (k.ok ? 'BERHASIL' : k.pesan));

  var a = getAntreanLkpd(tg, '');
  Logger.log('4. Antrean guru: ' + (a.ok ? a.data.length + ' pekerjaan' : 'GAGAL'));
  if (!a.ok || !a.data.length) return;

  var sid = a.data[0].submission_id;
  nilaiLkpd(tg, sid, 'diterima', 90, 'Kerja bagus.');
  Logger.log('5. Dinilai 90 → diterima');

  var cek = bukaLkpd(tm, target.item_id);
  Logger.log('6. Status akhir: ' + cek.data.status + ', nilai ' + cek.data.nilai);
  Logger.log('=== SELESAI ===');
}

/**
 * UJI TAHAP 6B — Quiz internal.
 * Menjalankan satu siklus penuh: guru menyusun soal → murid mengerjakan
 * → penilaian otomatis → koreksi esai → pembahasan.
 *
 * AMAN dijalankan berulang: memakai kelas & pertemuan uji tersendiri
 * yang dibuat sekali, lalu dibersihkan di akhir.
 */
function ujiTahap6B() {
  _hanyaEditor();
  Logger.log('=== UJI TAHAP 6B — QUIZ ===');

  var g = _sesiGuruDiagnostik();  /* tanpa password (v1.9.11) */
  if (!g.ok) { Logger.log('❌ Login guru gagal: ' + g.pesan); return; }
  var tg = g.data.token;
  var sg = Auth.validasiToken(tg);

  var m = Auth.login('siswa01', 'siswa123');
  if (!m.ok) { Logger.log('❌ Login murid gagal: ' + m.pesan); return; }
  var tm = m.data.token;
  var sm = Auth.validasiToken(tm);

  var lolos = 0, gagal = 0;
  function cek(nama, benar, ket) {
    if (benar) { lolos++; Logger.log('  ✅ ' + nama + (ket ? '  ' + ket : '')); }
    else { gagal++; Logger.log('  ❌ ' + nama + (ket ? '  → ' + ket : '')); }
  }

  /* --- siapkan kelas uji --- */
  var kelasUji = Db.cari('kelas', 'nama_kelas', 'ZZ Uji Quiz');
  var kelasId;
  if (kelasUji) {
    kelasId = kelasUji.kelas_id;
  } else {
    kelasId = Kelas.simpan(sg, {
      nama_kelas: 'ZZ Uji Quiz', mapel: 'PKPJ', jenjang: 'SMK',
      fase: 'F', tingkat: 'XI', keahlian: 'TJKT'
    }).kelas_id;
    Kelas.enroll(sg, kelasId, [sm.user_id]);
  }

  var ptm = Pertemuan.simpan(sg, {
    kelas_id: kelasId, judul: 'Uji Quiz ' + new Date().getTime(),
    urut_ketat: false, wajib: false, status: 'publish'
  });

  var item = Pertemuan.simpanItem(sg, {
    pertemuan_id: ptm.pertemuan_id, tipe: 'quiz',
    judul: 'Quiz Uji Otomatis', status: 'publish',
    kkm: 60, max_percobaan: 2, acak_soal: false, acak_opsi: false,
    tampilkan_pembahasan: true
  });
  Logger.log('Kelas & quiz uji siap: ' + item.item_id);

  /* --- 1. guru menyusun soal --- */
  Logger.log('');
  Logger.log('1. Bank soal');
  var s1 = Quiz.simpanSoal(sg, { item_id: item.item_id, tipe: 'pg',
    pertanyaan: 'Apa kepanjangan VLAN?',
    opsi: ['Virtual LAN', 'Very Large Area Network', 'Verified LAN', 'Volume LAN'],
    kunci: 'A', bobot: 2, pembahasan: 'VLAN = Virtual Local Area Network.' });
  var s2 = Quiz.simpanSoal(sg, { item_id: item.item_id, tipe: 'benar_salah',
    pertanyaan: 'VLAN memisahkan broadcast domain.', kunci: 'Benar', bobot: 1 });
  var s3 = Quiz.simpanSoal(sg, { item_id: item.item_id, tipe: 'isian',
    pertanyaan: 'Standar IEEE untuk trunking VLAN?',
    kunci: '802.1Q | dot1q', bobot: 1 });
  var s4 = Quiz.simpanSoal(sg, { item_id: item.item_id, tipe: 'esai',
    pertanyaan: 'Jelaskan manfaat VLAN di laboratorium sekolah.', bobot: 6 });

  var bank = getSoalQuizGuru(tg, item.item_id);
  cek('4 soal tersimpan', bank.ok && bank.data.soal.length === 4,
      bank.ok ? bank.data.soal.length + ' soal' : bank.pesan);
  cek('total bobot 10', bank.ok && bank.data.rekap.total_bobot === 10);
  cek('terdeteksi ada soal esai', bank.ok && bank.data.rekap.ada_esai === true);

  /* --- 2. keamanan: kunci tidak bocor --- */
  Logger.log('');
  Logger.log('2. Keamanan');
  cek('murid ditolak membuka bank soal',
      getSoalQuizGuru(tm, item.item_id).error === 'AKSES_DITOLAK');

  var mulai = mulaiQuiz(tm, item.item_id);
  cek('murid bisa memulai quiz', mulai.ok, mulai.ok ? '' : mulai.pesan);
  if (!mulai.ok) { Logger.log('Uji dihentikan.'); return; }

  var att = mulai.data;
  var teks = JSON.stringify(att);
  cek('payload TIDAK memuat kunci', teks.indexOf('"kunci"') === -1);
  cek('payload TIDAK memuat pembahasan', teks.indexOf('"pembahasan"') === -1);
  cek('teks kunci tidak bocor', teks.indexOf('Virtual Local Area') === -1);
  cek('4 soal terkirim ke murid', att.soal.length === 4);

  /* --- 3. autosave --- */
  Logger.log('');
  Logger.log('3. Pengerjaan');
  simpanJawaban(tm, att.attempt_id, s1.soal_id, 'Virtual LAN', false);
  simpanJawaban(tm, att.attempt_id, s2.soal_id, 'Benar', false);
  simpanJawaban(tm, att.attempt_id, s3.soal_id, 'dot1q', false);
  simpanJawaban(tm, att.attempt_id, s4.soal_id,
    'VLAN memisahkan lab dari jaringan kantor sehingga lebih aman.', false);

  var lanjut = lanjutkanAttempt(tm, item.item_id);
  cek('autosave tersimpan', lanjut.ok && lanjut.data.jml_terjawab === 4,
      lanjut.ok ? lanjut.data.jml_terjawab + ' terjawab' : lanjut.pesan);

  /* --- 4. penilaian otomatis --- */
  Logger.log('');
  Logger.log('4. Penilaian');
  var hasil = kumpulkanQuiz(tm, att.attempt_id);
  cek('berhasil dikumpulkan', hasil.ok, hasil.ok ? '' : hasil.pesan);
  if (!hasil.ok) return;

  cek('status menunggu_koreksi (ada esai)',
      hasil.data.status === 'menunggu_koreksi', hasil.data.status);
  cek('skor otomatis 4 dari 10',
      hasil.data.skor === 4 && hasil.data.skor_maks === 10,
      'skor ' + hasil.data.skor + '/' + hasil.data.skor_maks);

  var antre = getAttemptMenungguKoreksi(tg, '');
  cek('masuk antrean koreksi guru',
      antre.ok && antre.data.length >= 1,
      antre.ok ? antre.data.length + ' menunggu' : antre.pesan);

  /* --- 5. koreksi esai --- */
  Logger.log('');
  Logger.log('5. Koreksi esai');
  var kor = koreksiQuiz(tg, att.attempt_id, {
    nilai_butir: [{ soal_id: s4.soal_id, nilai: 5,
                    umpan_balik: 'Bagus, tambahkan contoh konfigurasi.' }],
    catatan: 'Pertahankan.'
  });
  cek('koreksi tersimpan', kor.ok, kor.ok ? '' : kor.pesan);
  cek('nilai akhir 90', kor.ok && kor.data.nilai === 90,
      kor.ok ? 'nilai ' + kor.data.nilai : '');
  cek('dinyatakan lulus (KKM 60)', kor.ok && kor.data.lulus === true);

  /* --- 6. murid melihat hasil --- */
  Logger.log('');
  Logger.log('6. Hasil & pembahasan');
  var lihat = getHasilQuiz(tm, att.attempt_id);
  cek('murid melihat hasil', lihat.ok, lihat.ok ? '' : lihat.pesan);
  if (lihat.ok) {
    cek('pembahasan tampil (4 butir)', lihat.data.pembahasan.length === 4);
    cek('kunci terlihat SETELAH selesai',
        lihat.data.pembahasan[0].kunci === 'Virtual LAN');
    cek('catatan guru sampai', lihat.data.catatan_guru === 'Pertahankan.');
  }

  var prog = Db.cariCepat2('progress', 'user_id', sm.user_id,
                           'item_id', item.item_id);
  cek('progress murid selesai', prog && prog.status === 'selesai',
      prog ? prog.status : 'tidak ada');
  cek('nilai progress 90', prog && Number(prog.nilai) === 90,
      prog ? 'nilai ' + prog.nilai : '');

  /* --- 7. capaian tidak boleh turun (bug audit) --- */
  Logger.log('');
  Logger.log('7. Capaian tidak turun saat mengulang');
  var ulang = mulaiQuiz(tm, item.item_id);
  if (ulang.ok) {
    var pr2 = Db.cariCepat2('progress', 'user_id', sm.user_id,
                            'item_id', item.item_id);
    cek('progress TETAP selesai setelah mengulang',
        pr2 && pr2.status === 'selesai', pr2 ? pr2.status : '');
    cek('nilai tertinggi tetap 90', pr2 && Number(pr2.nilai) === 90,
        pr2 ? 'nilai ' + pr2.nilai : '');
  } else {
    Logger.log('  (percobaan habis — lewati)');
  }

  /* --- bersihkan --- */
  Pertemuan.hapus(sg, ptm.pertemuan_id);
  Logger.log('');
  Logger.log('Pertemuan uji dihapus.');
  Logger.log('=====================================');
  Logger.log('  LOLOS: ' + lolos + '   GAGAL: ' + gagal);
  Logger.log('=====================================');
  if (gagal === 0) Logger.log('✅ Tahap 6B berfungsi di Apps Script.');
  else Logger.log('❌ Ada ' + gagal + ' pemeriksaan gagal — periksa log di atas.');
}

/**
 * UJI TAHAP 7 — Generator AI (memanggil Gemini SUNGGUHAN).
 *
 * Berbeda dari uji Node yang memakai UrlFetchApp tiruan: fungsi ini
 * benar-benar menghubungi Gemini, jadi inilah satu-satunya cara
 * membuktikan API key Anda sah, kuotanya hidup, dan Generative
 * Language API sudah aktif di project-nya.
 *
 * Memakai 1-2 panggilan API. Aman dijalankan berulang: memakai
 * pertemuan uji tersendiri yang dihapus di akhir.
 */
function ujiTahap7() {
  _hanyaEditor();
  Logger.log('=== UJI TAHAP 7 — GENERATOR AI ===');

  var g = _sesiGuruDiagnostik();  /* tanpa password (v1.9.11) */
  if (!g.ok) { Logger.log('❌ Login guru gagal: ' + g.pesan); return; }
  var sg = Auth.validasiToken(g.data.token);

  var lolos = 0, gagal = 0;
  function cek(nama, benar, ket) {
    if (benar) { lolos++; Logger.log('  ✅ ' + nama + (ket ? '  ' + ket : '')); }
    else { gagal++; Logger.log('  ❌ ' + nama + (ket ? '  → ' + ket : '')); }
  }

  /* --- 1. key terpasang? --- */
  Logger.log('');
  Logger.log('1. API key');
  var st = Ai.statusKeys();
  if (!st.terpasang) {
    Logger.log('  ❌ Belum ada API key. Pasang dahulu lewat');
    Logger.log('     Beranda → 🔑 Status API Key, atau pasangApiKeysManual().');
    Logger.log('     Uji dihentikan.');
    return;
  }
  cek(st.jml + ' key terpasang', true);
  var siap = 0;
  st.key.forEach(function (x) { if (x.status === 'siap') siap++; });
  cek(siap + ' key siap dipakai', siap > 0,
      siap === 0 ? 'semua sedang cooldown — tunggu beberapa menit' : '');

  /* Key "istirahat" bukan kerusakan: kuotanya habis pada seluruh model
     dan akan pulih sendiri. Dijelaskan agar tidak disangka masalah. */
  if (siap < st.jml) {
    var istirahat = st.jml - siap - st.jml_bermasalah;
    if (istirahat > 0) {
      Logger.log('     ℹ️ ' + istirahat + ' key sedang istirahat — kuotanya ' +
                 'habis pada semua model.');
      Logger.log('        Kuota per menit pulih ~60 detik, kuota harian ' +
                 'pulih tengah malam waktu Pasifik (±14.00 WIB).');
      Logger.log('        Sistem tetap berjalan memakai ' + siap + ' key lain.');
    }
  }
  cek('nilai key tidak ditampilkan',
      JSON.stringify(st).indexOf('AIza') === -1);
  if (siap === 0) { Logger.log('  Uji dihentikan.'); return; }

  /* --- siapkan kelas & item uji --- */
  var kelasUji = Db.cari('kelas', 'nama_kelas', 'ZZ Uji AI');
  var kelasId;
  if (kelasUji) {
    kelasId = kelasUji.kelas_id;
  } else {
    kelasId = Kelas.simpan(sg, {
      nama_kelas: 'ZZ Uji AI', mapel: 'Pemasangan dan Konfigurasi Peralatan Jaringan',
      jenjang: 'SMK', fase: 'F', tingkat: 'XI', kompetensi_keahlian: 'TJKT',
      capaian_pembelajaran: 'Peserta didik mampu menjelaskan konsep VLAN, ' +
        'mengkonfigurasi dan menguji VLAN pada perangkat jaringan.',
      catatan_gaya: 'ringkas, banyak contoh praktik'
    }).kelas_id;
  }

  var ptm = Pertemuan.simpan(sg, {
    kelas_id: kelasId, judul: 'Uji AI ' + new Date().getTime(),
    tujuan_pembelajaran: 'Memahami konsep dasar VLAN', status: 'draft'
  });
  var item = Pertemuan.simpanItem(sg, {
    pertemuan_id: ptm.pertemuan_id, tipe: 'materi',
    judul: 'Pengertian dan Fungsi VLAN',
    tujuan_pembelajaran: 'Menjelaskan pengertian VLAN dan tiga manfaatnya',
    status: 'draft'
  });

  /* --- 2. generate materi SUNGGUHAN --- */
  Logger.log('');
  Logger.log('2. Generate materi (menghubungi Gemini…)');
  var t0 = new Date().getTime();
  var draf = null, pesanGagal = '';
  try {
    draf = Ai.generateMateri(sg, item.item_id, 'sertakan contoh lab sekolah');
  } catch (e) {
    pesanGagal = e.message;
  }

  if (!draf) {
    cek('berhasil menghubungi Gemini', false, pesanGagal);
    Logger.log('');
    Logger.log('  Kemungkinan sebab:');
    Logger.log('   • Key salah tempel atau sudah dicabut');
    Logger.log('   • Generative Language API belum aktif di project key itu');
    Logger.log('   • Kuota harian habis (tunggu, atau tambah key)');
    Pertemuan.hapus(sg, ptm.pertemuan_id);
    Logger.log('=====================================');
    Logger.log('  LOLOS: ' + lolos + '   GAGAL: ' + (gagal + 1));
    return;
  }

  var detik = Math.round((new Date().getTime() - t0) / 1000);
  cek('berhasil menghubungi Gemini', true, detik + ' detik, key#' + draf.key_index);
  cek('konten terisi', draf.konten.length > 200, draf.konten.length + ' karakter');
  cek('terpecah beberapa bagian', draf.jml_bagian >= 2,
      draf.jml_bagian + ' bagian');
  cek('deskripsi terisi', String(draf.deskripsi || '').length > 10);
  cek('ada saran soal', String(draf.saran_soal || '').length > 10);
  cek('konten sudah disanitasi',
      draf.konten.toLowerCase().indexOf('<script') === -1);
  cek('durasi wajar (< 90 detik)', detik < 90, detik + ' detik');

  Logger.log('');
  Logger.log('  Cuplikan hasil:');
  Logger.log('  ' + draf.konten.replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ').slice(0, 220) + '…');

  /* --- 3. guard: AI tidak boleh langsung terbit --- */
  Logger.log('');
  Logger.log('3. Guard "AI wajib ditinjau"');
  Pertemuan.simpanItem(sg, {
    pertemuan_id: ptm.pertemuan_id, item_id: item.item_id,
    judul: 'Pengertian dan Fungsi VLAN',
    konten: draf.konten, sumber_ai: true, status: 'draft'
  });
  var ditolak = false;
  try {
    Pertemuan.simpanItem(sg, {
      pertemuan_id: ptm.pertemuan_id, item_id: item.item_id,
      judul: 'Pengertian dan Fungsi VLAN', status: 'publish'
    });
  } catch (e) { ditolak = true; }
  cek('publish tanpa ditinjau DITOLAK', ditolak,
      ditolak ? '' : 'BAHAYA: materi AI bisa terbit tanpa ditinjau');

  Pertemuan.simpanItem(sg, {
    pertemuan_id: ptm.pertemuan_id, item_id: item.item_id,
    judul: 'Pengertian dan Fungsi VLAN', ai_ditinjau: true, status: 'publish'
  });
  Db.invalidasi('item');
  cek('publish setelah ditinjau berhasil',
      Db.cariCepat('item', 'item_id', item.item_id).status === 'publish');

  /* --- 4. riwayat --- */
  Logger.log('');
  Logger.log('4. Riwayat');
  var riw = Ai.riwayat(item.item_id);
  cek('riwayat tercatat', riw.length > 0, riw.length + ' entri');
  cek('riwayat tidak memuat key', JSON.stringify(riw).indexOf('AIza') === -1);

  /* --- bersihkan --- */
  Pertemuan.hapus(sg, ptm.pertemuan_id);
  Logger.log('');
  Logger.log('Pertemuan uji dihapus.');
  Logger.log('=====================================');
  Logger.log('  LOLOS: ' + lolos + '   GAGAL: ' + gagal);
  Logger.log('=====================================');
  if (gagal === 0) {
    Logger.log('✅ Generator AI berfungsi di Apps Script.');
  } else {
    Logger.log('❌ Ada ' + gagal + ' pemeriksaan gagal — periksa log di atas.');
  }
}

/**
 * ============================================================
 *  ujiTahap9() — hierarki tiga tingkat + Refleksi (v1.2.0)
 * ------------------------------------------------------------
 *  Menguji di Apps Script SUNGGUHAN, bukan mock:
 *    A. skema & modul termuat
 *    B. Materi Pokok: buat, isi, geser, struktur()
 *    C. jenis pertemuan (biasa/ujian/refleksi)
 *    D. Refleksi: guru menyusun, murid mengisi, rekap, balasan
 *    E. unlock TIGA tingkat dari sudut pandang murid
 *    F. pindah pertemuan antar Materi Pokok
 *    G. salin antar kelas TIDAK merusak kelas lain (bug v1.1.1)
 *
 *  AMAN: seluruh data uji dibuat di kelas bernama "ZZ Uji Hierarki"
 *  dan "ZZ Uji Salin", lalu DIHAPUS di akhir. Data asli tidak
 *  tersentuh. Aman diulang.
 *
 *  Perkiraan waktu: 30–90 detik (tanpa memanggil Gemini).
 * ============================================================
 */
function ujiTahap9() {
  _hanyaEditor();
  Logger.log('=== UJI TAHAP 9 — HIERARKI & REFLEKSI (v' + APP_VERSI + ') ===');
  var mulai = new Date();

  var g = _sesiGuruDiagnostik();  /* tanpa password (v1.9.11) */
  if (!g.ok) { Logger.log('❌ Login guru gagal: ' + g.pesan); return; }
  var sg = Auth.validasiToken(g.data.token);

  var lolos = 0, gagal = 0;
  function cek(nama, benar, ket) {
    if (benar) { lolos++; Logger.log('  ✅ ' + nama + (ket ? '  ' + ket : '')); }
    else { gagal++; Logger.log('  ❌ ' + nama + (ket ? '  → ' + ket : '')); }
  }
  function cekAman(nama, fn, ket) {
    var hasil;
    try { hasil = fn(); }
    catch (e) { cek(nama, false, 'galat: ' + e.message); return; }
    cek(nama, hasil, ket);
  }
  function ditolak(fn, kode) {
    try { fn(); return false; }
    catch (e) { return kode ? e.kode === kode : true; }
  }

  /* bersihkan sisa uji sebelumnya, bila ada */
  ['ZZ Uji Hierarki', 'ZZ Uji Salin'].forEach(function (nm) {
    var k = Db.cari('kelas', 'nama_kelas', nm);
    if (k) { try { Kelas.hapus(sg, k.kelas_id); } catch (e) {} }
  });

  var kelasId = null, kelasSalin = null;

  try {

  /* ============================== A. Skema & modul */
  Logger.log('');
  Logger.log('A. Skema & modul');

  cek('modul MateriPokok termuat', typeof MateriPokok === 'object');
  cek('modul Refleksi termuat', typeof Refleksi === 'object');

  var shMp = Db.sheet('materi_pokok');
  cek('sheet materi_pokok ada', !!shMp);
  if (shMp) {
    var hMp = Db.header('materi_pokok');
    cek('kolom materi_pokok lengkap', hMp.indexOf('mp_id') === 0 &&
        hMp.indexOf('urut_ketat') > -1, hMp.length + ' kolom');
  }
  var hPtm = Db.header('pertemuan');
  cek('pertemuan punya kolom mp_id', hPtm.indexOf('mp_id') > -1);
  cek('pertemuan punya kolom jenis', hPtm.indexOf('jenis') > -1);
  cek('item punya kolom mp_id', Db.header('item').indexOf('mp_id') > -1);
  cek('progress punya kolom mp_id', Db.header('progress').indexOf('mp_id') > -1);

  /* ============================== B. Materi Pokok */
  Logger.log('');
  Logger.log('B. Materi Pokok');

  kelasId = Kelas.simpan(sg, {
    nama_kelas: 'ZZ Uji Hierarki', mapel: 'PKPJ',
    jenjang: 'SMK', fase: 'F', tingkat: 'XI'
  }).kelas_id;
  cek('kelas uji dibuat', !!kelasId, kelasId);

  var mp1 = MateriPokok.simpan(sg, { kelas_id: kelasId,
    judul: 'Bab 1 — Konsep VLAN', status: 'publish' });
  var mp2 = MateriPokok.simpan(sg, { kelas_id: kelasId,
    judul: 'Bab 2 — Routing', status: 'publish' });
  cek('dua Materi Pokok dibuat', !!mp1.mp_id && !!mp2.mp_id);
  cek('urutan otomatis 1 lalu 2', mp1.urutan === 1 && mp2.urutan === 2);

  /* pertemuan biasa + ujian + refleksi */
  var p11 = Pertemuan.simpan(sg, { mp_id: mp1.mp_id, judul: 'Pengantar VLAN',
    urut_ketat: false, status: 'publish' });
  var p12 = Pertemuan.simpan(sg, { mp_id: mp1.mp_id, judul: 'Konfigurasi VLAN',
    urut_ketat: false, status: 'publish' });
  var pUji = Pertemuan.simpan(sg, { mp_id: mp1.mp_id, judul: 'Ulangan Harian 1',
    jenis: 'ujian', urut_ketat: false, status: 'publish' });
  var pRef = Pertemuan.simpan(sg, { mp_id: mp1.mp_id, judul: 'Refleksi Bab 1',
    jenis: 'refleksi', wajib: true, urut_ketat: false, status: 'publish' });
  var p21 = Pertemuan.simpan(sg, { mp_id: mp2.mp_id, judul: 'Routing Statis',
    urut_ketat: false, status: 'publish' });

  cek('penomoran dimulai ulang tiap bab',
      p11.urutan === 1 && p12.urutan === 2 && p21.urutan === 1,
      'Bab1: ' + p11.urutan + ',' + p12.urutan + ' | Bab2: ' + p21.urutan);

  var m11 = Pertemuan.simpanItem(sg, { pertemuan_id: p11.pertemuan_id,
    tipe: 'materi', judul: 'Apa itu VLAN',
    konten: '<p>VLAN memisahkan jaringan secara logis.</p>',
    wajib: true, status: 'publish' });
  var m12 = Pertemuan.simpanItem(sg, { pertemuan_id: p12.pertemuan_id,
    tipe: 'materi', judul: 'Langkah konfigurasi',
    konten: '<p>Masuk mode config lalu buat VLAN.</p>',
    wajib: true, status: 'publish' });
  var m21 = Pertemuan.simpanItem(sg, { pertemuan_id: p21.pertemuan_id,
    tipe: 'materi', judul: 'Konsep routing',
    konten: '<p>Routing statis ditulis manual.</p>',
    wajib: true, status: 'publish' });

  cekAman('item mewarisi mp_id dari pertemuan', function () {
    return String(Db.cari('item', 'item_id', m11.item_id).mp_id) ===
           String(mp1.mp_id);
  });

  var st = MateriPokok.struktur(kelasId);
  cek('struktur() mengembalikan 2 bab', st.materi_pokok.length === 2,
      '=' + st.materi_pokok.length);
  cek('Bab 1 berisi 4 pertemuan', st.materi_pokok[0].pertemuan.length === 4,
      '=' + st.materi_pokok[0].pertemuan.length);
  cek('tidak ada pertemuan yatim', st.yatim.length === 0,
      '=' + st.yatim.length);

  var jns = {};
  st.materi_pokok[0].pertemuan.forEach(function (p) {
    jns[p.jenis] = (jns[p.jenis] || 0) + 1;
  });
  cek('jenis tersimpan benar',
      jns.biasa === 2 && jns.ujian === 1 && jns.refleksi === 1,
      'biasa=' + jns.biasa + ' ujian=' + jns.ujian + ' refleksi=' + jns.refleksi);

  MateriPokok.geser(sg, mp2.mp_id, -1);
  var stG = MateriPokok.struktur(kelasId);
  cek('geser Materi Pokok bekerja',
      stG.materi_pokok[0].mp_id === mp2.mp_id,
      stG.materi_pokok[0].judul);
  MateriPokok.geser(sg, mp2.mp_id, 1);   /* kembalikan */

  /* ============================== C. Refleksi — guru menyusun */
  Logger.log('');
  Logger.log('C. Refleksi — guru menyusun');

  var kontenTanya = Refleksi.susunPertanyaan([
    { t: 'Apa yang paling menantang saat mengonfigurasi VLAN?', wajib: true },
    { t: 'Bagian mana yang masih membuat Anda ragu?', wajib: true },
    { t: 'Di mana konsep ini Anda temui di dunia kerja?', wajib: false }
  ]);
  var itRef = Pertemuan.simpanItem(sg, { pertemuan_id: pRef.pertemuan_id,
    tipe: 'refleksi', judul: 'Refleksi Akhir Bab 1',
    konten: kontenTanya, wajib: true, status: 'publish' });
  cek('item refleksi dibuat', !!itRef.item_id, itRef.item_id);

  var tanya = Refleksi.bacaPertanyaan(kontenTanya);
  cek('3 pertanyaan tersimpan', tanya.length === 3, '=' + tanya.length);
  cek('penanda wajib benar',
      tanya[0].wajib === true && tanya[2].wajib === false);

  /* ============================== D. Murid: unlock 3 tingkat */
  Logger.log('');
  Logger.log('D. Murid — unlock tiga tingkat');

  var mur = Kelas.simpanMurid(sg, { nama: 'ZZ Murid Uji',
    username: 'zzujihierarki', kelas_id: kelasId });
  Db.perbarui('users', Db.cari('users', 'user_id', mur.user_id)._baris,
    { harus_ganti_password: false });
  var lm = Auth.login('zzujihierarki', mur.password_sementara);
  if (!lm.ok) {
    cek('login murid uji', false, lm.pesan);
    throw new Error('tidak bisa lanjut tanpa sesi murid');
  }
  var sm = Auth.validasiToken(lm.data.token);
  cek('murid uji dibuat & login', !!sm);

  var d = Belajar.daftarPertemuan(sm, kelasId);
  cek('murid melihat 2 Materi Pokok', d.materi_pokok.length === 2,
      '=' + d.materi_pokok.length);
  cek('Bab 1 TERBUKA', d.materi_pokok[0].terbuka === true);
  cek('Bab 2 TERKUNCI', d.materi_pokok[1].terbuka === false);
  cek('pertemuan 1.1 terbuka',
      d.materi_pokok[0].pertemuan[0].terbuka === true);
  cek('pertemuan 1.2 terkunci',
      d.materi_pokok[0].pertemuan[1].terbuka === false);

  cek('murid TIDAK bisa lompat ke Bab 2',
      ditolak(function () {
        Belajar.detailPertemuan(sm, p21.pertemuan_id);
      }, 'ITEM_TERKUNCI'));

  /* selesaikan berurutan sampai refleksi */
  Belajar.bukaMateri(sm, m11.item_id, 1);
  Belajar.tandaiBagianSelesai(sm, m11.item_id, 1, 999);
  Belajar.bukaMateri(sm, m12.item_id, 1);
  Belajar.tandaiBagianSelesai(sm, m12.item_id, 1, 999);

  /* ujian tidak punya item wajib → tidak boleh mengunci selamanya */
  d = Belajar.daftarPertemuan(sm, kelasId);
  cek('pertemuan Ujian kosong tidak mengunci',
      d.materi_pokok[0].pertemuan[3].terbuka === true,
      'refleksi terbuka: ' + d.materi_pokok[0].pertemuan[3].terbuka);

  /* ============================== E. Refleksi — murid mengisi */
  Logger.log('');
  Logger.log('E. Refleksi — murid mengisi');

  var br = Refleksi.buka(sm, itRef.item_id);
  cek('murid membuka refleksi', br.pertanyaan.length === 3);
  cek('belum terkirim', br.terkirim === false);

  Refleksi.simpanDraf(sm, itRef.item_id, ['coba draf', '', ''], 3);
  cek('draf tersimpan',
      Refleksi.buka(sm, itRef.item_id).jawaban[0] === 'coba draf');

  cek('pertanyaan wajib kosong DITOLAK',
      ditolak(function () {
        Refleksi.kirim(sm, itRef.item_id, ['a', '', ''], 4);
      }, 'VALIDASI_GAGAL'));
  cek('tanpa skala DITOLAK',
      ditolak(function () {
        Refleksi.kirim(sm, itRef.item_id, ['a', 'b', ''], null);
      }, 'VALIDASI_GAGAL'));

  Refleksi.kirim(sm, itRef.item_id,
    ['Menentukan port trunk dan access.', 'Perintah encapsulation.', ''], 2);
  cek('refleksi terkirim', Refleksi.buka(sm, itRef.item_id).terkirim === true);

  var prRef = Db.cariCepat2('progress', 'user_id', mur.user_id,
                            'item_id', itRef.item_id);
  cek('progress langsung SELESAI (tidak menunggu guru)',
      prRef && prRef.status === 'selesai', prRef && prRef.status);
  cek('skala tersimpan sebagai nilai',
      prRef && Number(prRef.nilai) === 2, prRef && prRef.nilai);
  cek('progress membawa mp_id (cegah baris yatim)',
      prRef && String(prRef.mp_id) === String(mp1.mp_id),
      prRef && prRef.mp_id);

  cek('kirim ulang DITOLAK',
      ditolak(function () {
        Refleksi.kirim(sm, itRef.item_id, ['x', 'y', ''], 5);
      }, 'VALIDASI_GAGAL'));

  /* ============================== F. Refleksi — rekap & balasan */
  Logger.log('');
  Logger.log('F. Refleksi — rekap guru');

  var rk = Refleksi.rekap(itRef.item_id);
  cek('rekap mencatat 1 jawaban', rk.jml_terkirim === 1,
      '=' + rk.jml_terkirim);
  cek('rata-rata dihitung', rk.rata_skala === 2, '=' + rk.rata_skala);
  cek('penanda perlu_diulang menyala (rata < 3)',
      rk.perlu_diulang === true);
  cek('nama murid ikut', rk.jawaban.length && !!rk.jawaban[0].nama,
      rk.jawaban.length ? rk.jawaban[0].nama : '');

  Refleksi.balas(sg, rk.jawaban[0].submission_id,
    'Terima kasih. Kita ulas lagi bagian trunk minggu depan.');
  cek('balasan sampai ke murid',
      Refleksi.buka(sm, itRef.item_id).balasan_guru.length > 0);

  var notif = Db.saring('notifikasi',
    { user_id: mur.user_id, jenis: 'refleksi_dibalas' });
  cek('notifikasi refleksi_dibalas terkirim', notif.length > 0,
      notif.length + ' notifikasi');
  cek('tautan notifikasi benar',
      notif.length > 0 && notif[0].link === '#/refleksi/' + itRef.item_id,
      notif.length ? notif[0].link : '');

  var dk = Refleksi.daftarKelas(kelasId);
  cek('daftar refleksi kelas terisi', dk.length === 1, '=' + dk.length);
  cek('nomor bertingkat benar', dk.length && dk[0].nomor === '1.4',
      dk.length ? dk[0].nomor : '');

  /* ============================== G. Pindah antar Materi Pokok */
  Logger.log('');
  Logger.log('G. Pindah pertemuan antar Materi Pokok');

  var rP = Pertemuan.pindah(sg, p12.pertemuan_id, mp2.mp_id);
  cek('pertemuan dipindah', rP.dipindah === true);
  cekAman('item ikut pindah', function () {
    return String(Db.cari('item', 'item_id', m12.item_id).mp_id) ===
           String(mp2.mp_id);
  });
  cekAman('progress ikut pindah', function () {
    var pr = Db.cariCepat2('progress', 'user_id', mur.user_id,
                           'item_id', m12.item_id);
    return pr && String(pr.mp_id) === String(mp2.mp_id);
  });
  cek('pindah LINTAS KELAS ditolak',
      ditolak(function () {
        var kl = Db.cari('kelas', 'nama_kelas', 'ZZ Uji Hierarki');
        Pertemuan.pindah(sg, p11.pertemuan_id, 'MP-TIDAK-ADA');
      }, 'TIDAK_DITEMUKAN'));

  /* ============================== H. Salin tidak merusak kelas lain */
  Logger.log('');
  Logger.log('H. Salin antar kelas (bug v1.1.1)');

  kelasSalin = Kelas.simpan(sg, { nama_kelas: 'ZZ Uji Salin',
    mapel: 'PKPJ' }).kelas_id;
  Pertemuan.salin(sg, [p11.pertemuan_id], [kelasSalin]);

  var stS = MateriPokok.struktur(kelasSalin);
  var ptmSalin = [];
  stS.materi_pokok.forEach(function (m) {
    m.pertemuan.forEach(function (p) { ptmSalin.push(p); });
  });
  cek('salinan masuk Materi Pokok (tidak yatim)',
      ptmSalin.length === 1 && stS.yatim.length === 0,
      'dalam bab: ' + ptmSalin.length + ', yatim: ' + stS.yatim.length);

  var itemSalin = Db.saring('item', { kelas_id: kelasSalin });
  cek('item tersalin', itemSalin.length === 1, '=' + itemSalin.length);
  cekAman('mp_id item menunjuk bab kelas TUJUAN', function () {
    if (!itemSalin.length) return false;
    var mpItem = Db.cari('materi_pokok', 'mp_id', itemSalin[0].mp_id);
    return mpItem && String(mpItem.kelas_id) === String(kelasSalin);
  });

  /* inti bug: hapus bab di kelas ASAL tidak boleh menyentuh kelas tujuan */
  var sebelum = Db.saring('item', { kelas_id: kelasSalin }).length;
  MateriPokok.hapus(sg, mp1.mp_id);
  var sesudah = Db.saring('item', { kelas_id: kelasSalin }).length;
  cek('hapus bab kelas A TIDAK menghapus isi kelas B',
      sesudah === sebelum, sebelum + ' → ' + sesudah);

  } catch (e) {
    gagal++;
    Logger.log('  ❌ GALAT: ' + e.message);
    if (e.stack) Logger.log('     ' + String(e.stack).split('\n')[1]);
  } finally {
    /* ============================== bersih-bersih */
    Logger.log('');
    Logger.log('Membersihkan data uji…');
    [kelasId, kelasSalin].forEach(function (kid) {
      if (!kid) return;
      try { Kelas.hapus(sg, kid); } catch (e) {
        Logger.log('  ⚠️ gagal menghapus ' + kid + ': ' + e.message);
      }
    });
    var mu = Db.cari('users', 'username', 'zzujihierarki');
    if (mu) { try { Db.hapus('users', mu._baris); } catch (e) {} }
    Logger.log('  Data uji dihapus.');
  }

  var detik = Math.round((new Date() - mulai) / 1000);
  Logger.log('');
  Logger.log('=====================================');
  Logger.log('  LOLOS: ' + lolos + '   GAGAL: ' + gagal +
             '   (' + detik + ' detik)');
  Logger.log('=====================================');
  if (gagal === 0) {
    Logger.log('✅ Hierarki tiga tingkat & Refleksi berfungsi di Apps Script.');
  } else {
    Logger.log('❌ Ada ' + gagal + ' pemeriksaan gagal — salin log di atas.');
  }
}


/**
 * ============================================================
 *  diagRefleksi() — cari penyebab "terjadi kesalahan" pada rekap
 * ------------------------------------------------------------
 *  Dipakai bila tombol 🪞 Penilaian menampilkan pesan kesalahan.
 *  Menelusuri SETIAP item refleksi yang ada di database sungguhan
 *  (bukan data uji), lalu melaporkan galat aslinya lengkap dengan
 *  baris kode penyebabnya.
 *
 *  Tidak mengubah apa pun — hanya membaca.
 * ============================================================
 */
function diagRefleksi() {
  _hanyaEditor();
  Logger.log('=== DIAGNOSTIK REKAP REFLEKSI (v' + APP_VERSI + ') ===');

  var g = _sesiGuruDiagnostik();  /* tanpa password (v1.9.11) */
  if (!g.ok) { Logger.log('❌ Login guru gagal: ' + g.pesan); return; }
  var tok = g.data.token;

  var semuaItem = Db.baca('item').filter(function (i) {
    return i.tipe === 'refleksi';
  });

  Logger.log('');
  Logger.log('Item refleksi ditemukan: ' + semuaItem.length);
  if (!semuaItem.length) {
    Logger.log('  Belum ada item bertipe refleksi. Buat dahulu lewat');
    Logger.log('  Kelola Item → 🪞 Refleksi, lalu jalankan ulang.');
    return;
  }

  var rusak = 0;

  semuaItem.forEach(function (i, n) {
    Logger.log('');
    Logger.log((n + 1) + '. ' + i.item_id + ' — ' + i.judul);
    Logger.log('   status     : ' + i.status);
    Logger.log('   pertemuan  : ' + i.pertemuan_id);
    Logger.log('   kelas      : ' + i.kelas_id);

    /* --- isi kolom konten --- */
    var konten = String(i.konten || '');
    Logger.log('   konten     : ' + konten.length + ' karakter');
    if (konten.length) {
      Logger.log('   cuplikan   : ' +
        konten.slice(0, 120).replace(/\n/g, ' '));
    }

    var tanya = null;
    try {
      tanya = Refleksi.bacaPertanyaan(konten);
      Logger.log('   pertanyaan : ' + tanya.length + ' terbaca');
      if (!tanya.length && konten.length) {
        Logger.log('   ⚠️ konten TERISI tetapi tidak terbaca sebagai');
        Logger.log('      daftar pertanyaan — kemungkinan JSON rusak.');
      }
    } catch (e) {
      Logger.log('   ❌ bacaPertanyaan galat: ' + e.message);
    }

    /* --- pertemuan induk masih ada? --- */
    var ptm = Db.cari('pertemuan', 'pertemuan_id', i.pertemuan_id);
    if (!ptm) {
      Logger.log('   ⚠️ pertemuan induk TIDAK ADA (item yatim)');
    }

    /* --- jumlah isian murid --- */
    var sub = Db.saring('lkpd_submission', { item_id: i.item_id });
    Logger.log('   isian murid: ' + sub.length);
    sub.forEach(function (s) {
      var links = String(s.links || '');
      var sah = true;
      try { JSON.parse(links || '[]'); } catch (e) { sah = false; }
      if (!sah) {
        Logger.log('   ⚠️ isian ' + s.submission_id +
                   ' punya links yang bukan JSON: ' + links.slice(0, 60));
      }
    });

    /* --- panggil API persis seperti layar --- */
    var r = getRekapRefleksi(tok, i.item_id);
    if (r.ok) {
      Logger.log('   ✅ rekap BERHASIL — ' + r.data.jml_terkirim +
                 ' jawaban, rata ' + r.data.rata_skala);
    } else {
      rusak++;
      Logger.log('   ❌ rekap GAGAL');
      Logger.log('      error : ' + r.error);
      Logger.log('      pesan : ' + r.pesan);

      /* panggil langsung agar galat aslinya terlihat */
      try {
        Refleksi.rekap(i.item_id);
      } catch (e) {
        Logger.log('      GALAT ASLI : ' + e.message);
        if (e.stack) {
          String(e.stack).split('\n').slice(0, 4).forEach(function (b) {
            Logger.log('        ' + b);
          });
        }
      }
    }
  });

  /* --- daftar per kelas juga --- */
  Logger.log('');
  Logger.log('Uji getRefleksiKelas() tiap kelas:');
  Db.baca('kelas').forEach(function (k) {
    var r = getRefleksiKelas(tok, k.kelas_id);
    if (r.ok) {
      Logger.log('  ✅ ' + k.nama_kelas + ' — ' + r.data.length + ' refleksi');
    } else {
      rusak++;
      Logger.log('  ❌ ' + k.nama_kelas + ' — ' + r.error + ': ' + r.pesan);
      try { Refleksi.daftarKelas(k.cid || k.kelas_id); }
      catch (e) { Logger.log('     GALAT ASLI : ' + e.message); }
    }
  });

  Logger.log('');
  Logger.log('=====================================');
  if (rusak === 0) {
    Logger.log('✅ Semua rekap refleksi berhasil dibuka.');
    Logger.log('   Bila layar masih menampilkan kesalahan, masalahnya');
    Logger.log('   di sisi tampilan — buka Konsol Peramban (F12).');
  } else {
    Logger.log('❌ ' + rusak + ' pemanggilan gagal — salin log di atas.');
  }
  Logger.log('=====================================');
}


/**
 * ============================================================
 *  diagUbahMateriPokok() — cari penyebab "terjadi kesalahan"
 *  saat tombol Ubah pada Materi Pokok ditekan
 * ------------------------------------------------------------
 *  Console peramban hanya menampilkan "Uncaught (in promise) Object"
 *  — itu respons {ok:false} dari server. Pesan aslinya TIDAK ikut
 *  ke browser bila galatnya tanpa kode; yang tercatat hanya di
 *  sheet `log`. Fungsi ini membacanya untuk Anda.
 *
 *  Tidak mengubah apa pun — hanya membaca.
 * ============================================================
 */
function diagUbahMateriPokok() {
  _hanyaEditor();
  Logger.log('=== DIAGNOSTIK: Ubah Materi Pokok (v' + APP_VERSI + ') ===');

  var g = _sesiGuruDiagnostik();  /* tanpa password (v1.9.11) */
  if (!g.ok) { Logger.log('❌ Login guru gagal: ' + g.pesan); return; }
  var tok = g.data.token;

  var semua = Db.baca('materi_pokok');
  Logger.log('');
  Logger.log('Materi Pokok di database: ' + semua.length);
  if (!semua.length) {
    Logger.log('  Belum ada. Buat satu dahulu lalu jalankan ulang.');
    return;
  }

  var rusak = 0;

  semua.forEach(function (m, n) {
    Logger.log('');
    Logger.log((n + 1) + '. ' + m.mp_id + ' — ' + m.judul);
    Logger.log('   kelas   : ' + m.kelas_id);
    Logger.log('   status  : ' + m.status + '  urutan: ' + m.urutan);

    /* Nilai tanggal dari Sheets berupa objek Date. Bila kolomnya
       terisi teks aneh atau tanggal rusak, JSON.stringify di jalur
       google.script.run bisa gagal — dan galatnya tanpa kode. */
    ['created_at', 'updated_at'].forEach(function (kol) {
      var v = m[kol];
      var tipe = Object.prototype.toString.call(v);
      var tampil = String(v);
      if (tampil.length > 40) tampil = tampil.slice(0, 40) + '…';
      Logger.log('   ' + kol + ' : ' + tipe + '  ' + tampil);
      if (v instanceof Date && isNaN(v.getTime())) {
        Logger.log('      ⚠️ TANGGAL RUSAK — inilah kemungkinan penyebabnya');
      }
    });

    /* apakah seluruh objek bisa diserialkan ke browser? */
    try {
      var teks = JSON.stringify(m);
      Logger.log('   serial  : ' + teks.length + ' karakter — OK');
    } catch (e) {
      rusak++;
      Logger.log('   ❌ TIDAK BISA DISERIALKAN: ' + e.message);
    }

    /* panggil API persis seperti yang dilakukan layar */
    var r = getDetailMateriPokok(tok, m.mp_id);
    if (r.ok) {
      Logger.log('   ✅ getDetailMateriPokok BERHASIL');
    } else {
      rusak++;
      Logger.log('   ❌ getDetailMateriPokok GAGAL');
      Logger.log('      error : ' + r.error);
      Logger.log('      pesan : ' + r.pesan);
      try {
        MateriPokok.detail(m.mp_id);
      } catch (e) {
        Logger.log('      GALAT ASLI : ' + e.message);
        if (e.stack) {
          String(e.stack).split('\n').slice(0, 5).forEach(function (b) {
            Logger.log('        ' + b);
          });
        }
      }
    }
  });

  /* --- galat terakhir yang tercatat sistem --- */
  Logger.log('');
  Logger.log('10 galat terakhir di sheet `log`:');
  var log = Db.baca('log').filter(function (x) {
    return x.aksi === 'error' || x.status === 'gagal';
  });
  if (!log.length) {
    Logger.log('  (tidak ada catatan galat)');
  } else {
    log.slice(-10).forEach(function (x) {
      Logger.log('  • ' + Util.formatTanggal(x.timestamp));
      Logger.log('    ' + String(x.detail).slice(0, 300));
    });
  }

  Logger.log('');
  Logger.log('=====================================');
  if (rusak === 0) {
    Logger.log('✅ Semua Materi Pokok dapat dibuka dari server.');
    Logger.log('   Bila layar masih gagal, masalahnya di sisi tampilan.');
    Logger.log('   Buka Konsol Peramban (F12), klik segitiga di samping');
    Logger.log('   baris merah "Uncaught (in promise) Object" untuk');
    Logger.log('   melihat isi objeknya, lalu kirimkan ke saya.');
  } else {
    Logger.log('❌ ' + rusak + ' pemeriksaan gagal — salin log di atas.');
  }
  Logger.log('=====================================');
}


/**
 * ============================================================
 *  ujiTahap10() — Generator Soal AI (v1.3)
 * ------------------------------------------------------------
 *  MEMANGGIL GEMINI SUNGGUHAN. Perkiraan 20–60 detik.
 *
 *  Membuat kelas uji "ZZ Uji Soal AI", meminta AI menyusun soal,
 *  memeriksa bentuk hasilnya, menyimpan sebagian, lalu MENGHAPUS
 *  seluruh data uji. Data asli tidak tersentuh. Aman diulang.
 * ============================================================
 */
function ujiTahap10() {
  _hanyaEditor();
  Logger.log('=== UJI TAHAP 10 — GENERATOR SOAL AI (v' + APP_VERSI + ') ===');
  var mulai = new Date();

  var g = _sesiGuruDiagnostik();  /* tanpa password (v1.9.11) */
  if (!g.ok) { Logger.log('❌ Login guru gagal: ' + g.pesan); return; }
  var sg = Auth.validasiToken(g.data.token);

  var lolos = 0, gagal = 0;
  function cek(nama, benar, ket) {
    if (benar) { lolos++; Logger.log('  ✅ ' + nama + (ket ? '  ' + ket : '')); }
    else { gagal++; Logger.log('  ❌ ' + nama + (ket ? '  → ' + ket : '')); }
  }

  var st = Ai.statusKeys();
  if (!st.terpasang) {
    Logger.log('❌ Belum ada API key. Pasang lewat 🔑 Status API Key.');
    return;
  }
  var siap = 0;
  st.key.forEach(function (x) { if (x.status === 'siap') siap++; });
  Logger.log('');
  Logger.log(st.jml + ' key terpasang, ' + siap + ' siap dipakai.');
  if (siap === 0) {
    Logger.log('⚠️ Semua key sedang istirahat — coba lagi beberapa menit.');
    return;
  }

  /* bersihkan sisa uji sebelumnya */
  var lama = Db.cari('kelas', 'nama_kelas', 'ZZ Uji Soal AI');
  if (lama) { try { Kelas.hapus(sg, lama.kelas_id); } catch (e) {} }

  var kelasId = null;
  try {
    kelasId = Kelas.simpan(sg, {
      nama_kelas: 'ZZ Uji Soal AI', mapel: 'PKPJ',
      jenjang: 'SMK', fase: 'F', tingkat: 'XI',
      kompetensi_keahlian: 'TJKT'
    }).kelas_id;

    var mp = MateriPokok.simpan(sg, { kelas_id: kelasId,
      judul: 'Konsep VLAN', status: 'publish' });
    var ptm = Pertemuan.simpan(sg, { mp_id: mp.mp_id,
      judul: 'Konsep dan Fungsi VLAN',
      tujuan_pembelajaran: 'Peserta didik mampu menjelaskan fungsi VLAN ' +
        'dan membedakan trunk dengan access port.',
      urut_ketat: false, status: 'publish' });

    /* materi jadi rujukan isi soal */
    Pertemuan.simpanItem(sg, { pertemuan_id: ptm.pertemuan_id,
      tipe: 'materi', judul: 'Pengertian VLAN',
      konten: '<p>VLAN memisahkan jaringan secara logis.</p>',
      status: 'publish' });

    var quiz = Pertemuan.simpanItem(sg, { pertemuan_id: ptm.pertemuan_id,
      tipe: 'quiz', judul: 'Quiz VLAN', kkm: 75, status: 'draft' });

    Logger.log('');
    Logger.log('Meminta AI menyusun 4 soal (3 PG + 1 uraian)…');
    var t0 = new Date();
    var hasil = Ai.generateSoal(sg, {
      item_id: quiz.item_id,
      komposisi: { pg: 3, esai: 1 },
      tingkat: 'sedang'
    });
    var detik = Math.round((new Date() - t0) / 1000);

    cek('berhasil menghubungi Gemini', true,
        detik + ' detik, key#' + hasil.key_index);
    cek('soal dihasilkan', hasil.jml > 0, hasil.jml + ' soal');
    cek('jumlah mendekati yang diminta', hasil.jml >= 3,
        hasil.jml + ' dari ' + hasil.diminta);

    var adaPg = false, adaEsai = false, kunciPgSah = true, semuaAda = true;
    hasil.soal.forEach(function (s) {
      if (!s.pertanyaan) semuaAda = false;
      if (s.tipe === 'pg') {
        adaPg = true;
        if (!s.opsi || s.opsi.length < 2) kunciPgSah = false;
        if ('ABCDE'.indexOf(String(s.kunci).toUpperCase()) < 0) kunciPgSah = false;
      }
      if (s.tipe === 'esai') adaEsai = true;
    });

    cek('semua soal punya pertanyaan', semuaAda);
    cek('ada soal pilihan ganda', adaPg);
    cek('kunci PG berupa huruf opsi yang sah', kunciPgSah);
    cek('ada soal uraian', adaEsai);
    cek('ditandai sumber_ai',
        hasil.soal.every(function (s) { return s.sumber_ai === true; }));

    Logger.log('');
    Logger.log('  Cuplikan soal pertama:');
    Logger.log('   ' + String(hasil.soal[0].pertanyaan).slice(0, 120));
    if (hasil.soal[0].opsi && hasil.soal[0].opsi.length) {
      Logger.log('   Kunci: ' + hasil.soal[0].kunci +
                 ' → ' + hasil.soal[0].opsi[
                   'ABCDE'.indexOf(String(hasil.soal[0].kunci).toUpperCase())]);
    }

    /* simpan hanya SEBAGIAN — meniru guru yang membuang satu soal */
    Logger.log('');
    var pilih = hasil.soal.slice(0, Math.max(1, hasil.soal.length - 1));
    var r = Quiz.simpanSoalTerpilih(sg, quiz.item_id, pilih);
    cek('soal terpilih tersimpan', r.jml === pilih.length,
        r.jml + ' dari ' + hasil.soal.length + ' dihasilkan');

    var bank = Db.saring('soal', { item_id: quiz.item_id });
    cek('bank soal berisi tepat yang dipilih', bank.length === pilih.length,
        bank.length + ' soal');
    cek('soal yang dibuang TIDAK ikut tersimpan',
        bank.length < hasil.soal.length || hasil.soal.length === 1);
    cek('penomoran berurutan dari 1',
        bank.map(function (s) { return Number(s.nomor); })
            .sort(function (a, b) { return a - b; })[0] === 1);

    /* ------------------------------------------ soal bercerita v1.5.5 */
    Logger.log('');
    Logger.log('Meminta 5 soal, 3 di antaranya berbagi satu wacana…');

    var ptm2 = Pertemuan.simpan(sg, { mp_id: mp.mp_id,
      judul: 'Subnetting Lanjut',
      tujuan_pembelajaran: 'Menghitung kebutuhan alamat IP',
      urut_ketat: false, status: 'draft' });
    var quiz2 = Pertemuan.simpanItem(sg, { pertemuan_id: ptm2.pertemuan_id,
      tipe: 'quiz', judul: 'Quiz Bercerita', kkm: 75, status: 'draft' });

    var t1 = new Date();
    var hc = Ai.generateSoal(sg, {
      item_id: quiz2.item_id,
      komposisi: { pg: 5 },
      tingkat: 'sedang',
      jml_bercerita: 3,
      jenis_stimulus: 'kasus'
    });
    Logger.log('  (' + Math.round((new Date() - t1) / 1000) + ' detik)');

    /* Jumlah total TIDAK boleh bertambah — wacana bagian dari
       komposisi, bukan tambahan. Ini kesalahpahaman paling mungkin
       dilakukan model. */
    cek('total soal tetap 5, wacana bukan tambahan', hc.soal.length === 5,
        hc.soal.length + ' soal');

    var berGrup = hc.soal.filter(function (x) { return !!x.grup_id; });
    var pemegang = hc.soal.filter(function (x) { return !!x.stimulus; });

    cek('kelompok terbentuk', berGrup.length >= 2,
        berGrup.length + ' anggota');
    cek('wacana disimpan SEKALI saja', pemegang.length === 1,
        pemegang.length + ' pemegang');

    var polaC = hc.soal.map(function (x) { return x.grup_id ? 'G' : '.'; }).join('');
    cek('anggota kelompok BERDAMPINGAN', /^\.*G{2,}\.*$/.test(polaC), polaC);

    if (hc.bercerita.peringatan) {
      Logger.log('  ⚠️ AI menyimpang: ' + hc.bercerita.peringatan);
    } else {
      cek('AI menuruti jumlah yang diminta', hc.bercerita.jadi === 3,
          hc.bercerita.jadi + ' dari 3');
    }

    if (pemegang.length) {
      var w = String(pemegang[0].stimulus);
      cek('wacana cukup panjang untuk bermakna', w.length > 200,
          w.length + ' karakter');
      Logger.log('');
      Logger.log('  Cuplikan wacana:');
      Logger.log('   ' + w.replace(/<[^>]+>/g, ' ').slice(0, 160) + '…');
      Logger.log('  Soal bercerita pertama:');
      Logger.log('   ' + String(berGrup[0].pertanyaan).slice(0, 120));
    }

    /* tersimpan lalu TERBACA kembali — jalur yang paling sering putus */
    Quiz.simpanSoalTerpilih(sg, quiz2.item_id, hc.soal);
    var bank2 = Quiz.getSoalGuru(quiz2.item_id);

    cek('seluruh soal bercerita tersimpan', bank2.soal.length === 5,
        bank2.soal.length + ' soal');
    cek('grup_id dipetakan ke GRP-xxxx sungguhan',
        bank2.soal.some(function (x) {
          return String(x.grup_id).indexOf('GRP-') === 0;
        }));
    cek('tidak memakai penanda sementara AI1',
        bank2.soal.every(function (x) { return x.grup_id !== 'AI1'; }));
    cek('wacana TERBACA kembali dari sheet',
        bank2.soal.filter(function (x) { return !!x.stimulus; }).length === 1);
    cek('rekap mencacah satu kelompok', bank2.rekap.jml_grup === 1,
        String(bank2.rekap.jml_grup));

    /* penjagaan parameter — tidak memanggil AI, cepat */
    Logger.log('');
    var tolak1 = false;
    try {
      Ai.generateSoal(sg, { item_id: quiz2.item_id, komposisi: { pg: 3 },
        jml_bercerita: 5 });
    } catch (e) { tolak1 = (e.kode === 'VALIDASI_GAGAL'); }
    cek('bercerita melebihi total ditolak sebelum memanggil AI', tolak1);

    var tolak2 = false;
    try {
      Ai.generateSoal(sg, { item_id: quiz2.item_id, komposisi: { pg: 5 },
        jml_bercerita: 1 });
    } catch (e) { tolak2 = (e.kode === 'VALIDASI_GAGAL'); }
    cek('bercerita = 1 ditolak (kelompok butuh 2)', tolak2);

  } catch (e) {
    gagal++;
    Logger.log('  ❌ GALAT: ' + e.message);
    if (e.stack) Logger.log('     ' + String(e.stack).split('\n')[1]);
  } finally {
    Logger.log('');
    Logger.log('Membersihkan data uji…');
    if (kelasId) {
      try { Kelas.hapus(sg, kelasId); Logger.log('  Data uji dihapus.'); }
      catch (e) { Logger.log('  ⚠️ gagal menghapus: ' + e.message); }
    }
  }

  var total = Math.round((new Date() - mulai) / 1000);
  Logger.log('');
  Logger.log('=====================================');
  Logger.log('  LOLOS: ' + lolos + '   GAGAL: ' + gagal +
             '   (' + total + ' detik)');
  Logger.log('=====================================');
  if (gagal === 0) {
    Logger.log('✅ Generator Soal AI berfungsi di Apps Script.');
  } else {
    Logger.log('❌ Ada ' + gagal + ' pemeriksaan gagal — salin log di atas.');
  }
}


/**
 * Uji cepat koneksi Gemini — SATU panggilan, tanpa menyentuh data.
 * Dipakai saat baru memasang key untuk memastikan key-nya hidup.
 */
/**
 * UJI TAHAP 11 — Rekap Nilai & ekspor (Tahap 8).
 *
 * Membuat kelas `ZZ Uji Rekap` berisi LKPD, Quiz, dan Refleksi,
 * mengisikan nilai untuk tiga murid, lalu memeriksa tabel rekap dan
 * ekspornya. Membersihkan dirinya sendiri — aman diulang.
 *
 * Item refleksi sengaja IKUT dibuat dan diisi, justru untuk
 * membuktikan skalanya TIDAK bocor ke rekap nilai (ralat guru
 * v1.5.1). Menghapusnya dari data uji akan membuat pemeriksaan ini
 * hijau palsu.
 *
 * Berkas Sheet hasil ekspor IKUT dibuang ke tong sampah agar Drive
 * tidak menumpuk berkas uji.
 */
function ujiTahap11() {
  _hanyaEditor();
  Logger.log('=== UJI TAHAP 11 — REKAP NILAI (v' + APP_VERSI + ') ===');
  var mulai = new Date();

  var g = _sesiGuruDiagnostik();  /* tanpa password (v1.9.11) */
  if (!g.ok) { Logger.log('❌ Login guru gagal: ' + g.pesan); return; }
  var sg = Auth.validasiToken(g.data.token);

  var lolos = 0, gagal = 0;
  function cek(nama, benar, ket) {
    if (benar) { lolos++; Logger.log('  ✅ ' + nama + (ket ? '  ' + ket : '')); }
    else { gagal++; Logger.log('  ❌ ' + nama + (ket ? '  → ' + ket : '')); }
  }

  /* Nama murid uji dipakai di DUA tempat (bersih-bersih awal & akhir),
     jadi didaftarkan sekali di sini. */
  var MURID_UJI = ['zzrekapa', 'zzrekapb', 'zzrekapc'];

  /**
   * Buang sisa uji sebelumnya.
   *
   * Kelas.hapus() SENGAJA tidak menghapus baris `users` — murid bisa
   * terdaftar di beberapa kelas, jadi menghapus kelas tidak boleh
   * menghapus orangnya. Akibatnya murid uji tertinggal dan
   * simpanMurid() menolak dengan "Nama pengguna sudah dipakai" pada
   * jalankan KEDUA. Karena itu username-nya dibersihkan terpisah.
   */
  function bersihkanSisaUji() {
    var kl = Db.cari('kelas', 'nama_kelas', 'ZZ Uji Rekap');
    if (kl) { try { Kelas.hapus(sg, kl.kelas_id); } catch (e) {} }

    MURID_UJI.forEach(function (u) {
      var mu = Db.cari('users', 'username', u);
      if (mu) { try { Db.hapus('users', mu._baris); } catch (e) {} }
    });
  }

  bersihkanSisaUji();

  var kelasId = null, berkasId = null;
  try {
    kelasId = Kelas.simpan(sg, {
      nama_kelas: 'ZZ Uji Rekap', mapel: 'PKPJ',
      jenjang: 'SMK', fase: 'F', tingkat: 'XI',
      kompetensi_keahlian: 'TJKT'
    }).kelas_id;

    /* wajib:false — gerbang antar bab memakai `wajib`, bukan
       urut_ketat; tanpa ini bab 2 terkunci dan refleksi tak terisi */
    var mp1 = MateriPokok.simpan(sg, { kelas_id: kelasId,
      judul: 'Bab Uji A', wajib: false, urut_ketat: false,
      status: 'publish' }).mp_id;
    var mp2 = MateriPokok.simpan(sg, { kelas_id: kelasId,
      judul: 'Bab Uji B', wajib: false, urut_ketat: false,
      status: 'publish' }).mp_id;

    var p1 = Pertemuan.simpan(sg, { mp_id: mp1, judul: 'Pertemuan Uji A',
      urut_ketat: false, status: 'publish' }).pertemuan_id;
    var p2 = Pertemuan.simpan(sg, { mp_id: mp2, judul: 'Pertemuan Uji B',
      urut_ketat: false, status: 'publish' }).pertemuan_id;

    var iL = Pertemuan.simpanItem(sg, { pertemuan_id: p1, tipe: 'lkpd',
      judul: 'LKPD Uji', status: 'publish' }).item_id;
    var iQ = Pertemuan.simpanItem(sg, { pertemuan_id: p1, tipe: 'quiz',
      judul: 'Quiz Uji', kkm: 70, max_percobaan: 3,
      status: 'publish' }).item_id;
    var iR = Pertemuan.simpanItem(sg, { pertemuan_id: p2, tipe: 'refleksi',
      judul: 'Refleksi Uji',
      konten: Refleksi.susunPertanyaan([{ t: 'Apa yang dipelajari?', wajib: true }]),
      status: 'publish' }).item_id;
    Pertemuan.simpanItem(sg, { pertemuan_id: p2, tipe: 'lkpd',
      judul: 'LKPD Draf', status: 'draft' });

    Quiz.simpanSoal(sg, { item_id: iQ, tipe: 'pg', pertanyaan: 'Berapa 1+1?',
      opsi: ['1', '2'], kunci: 'B', bobot: 10 });

    Logger.log('');
    Logger.log('A. Struktur rekap');

    var d0 = Rekap.kelas(kelasId, 'semua');
    cek('item draf & refleksi tidak jadi kolom', d0.item.length === 2,
        d0.item.length + ' kolom');
    cek('urutan kolom mengikuti pelajaran',
        d0.item[0].item_id === iL && d0.item[1].item_id === iQ);

    /* tiga murid */
    var murid = [];
    MURID_UJI.forEach(function (u) {
      var m = Kelas.simpanMurid(sg, { nama: u, username: u,
                                      kelas_id: kelasId });
      Db.perbarui('users', Db.cari('users', 'user_id', m.user_id)._baris,
        { harus_ganti_password: false });
      murid.push({ user_id: m.user_id, nama: u,
        sesi: Auth.validasiToken(
          Auth.login(u, m.password_sementara).data.token) });
    });

    var A = murid[0], Bm = murid[1];

    Logger.log('');
    Logger.log('B. Nilai masuk rekap');

    /* A: LKPD diterima 80 */
    Lkpd.simpanDraf(A.sesi, iL, ['https://drive.google.com/uji'], '');
    Lkpd.kumpulkan(A.sesi, iL);
    var sub = Db.saringKolom('lkpd_submission',
      { item_id: iL, user_id: A.user_id }, ['submission_id'])[0];
    Lkpd.nilai(sg, sub.submission_id, 'diterima', 80, 'ok');

    /* B: LKPD dikumpulkan, BELUM dinilai */
    Lkpd.simpanDraf(Bm.sesi, iL, ['https://drive.google.com/uji2'], '');
    Lkpd.kumpulkan(Bm.sesi, iL);

    /* A: quiz dua percobaan, 100 lalu 0 */
    var t1 = Quiz.mulaiQuiz(A.sesi, iQ);
    Quiz.simpanJawaban(A.sesi, t1.attempt_id, t1.soal[0].soal_id, '2', false);
    Quiz.kumpulkanQuiz(A.sesi, t1.attempt_id);
    var t2 = Quiz.mulaiQuiz(A.sesi, iQ);
    Quiz.simpanJawaban(A.sesi, t2.attempt_id, t2.soal[0].soal_id, '1', false);
    Quiz.kumpulkanQuiz(A.sesi, t2.attempt_id);

    /* A: refleksi skala 4 */
    Refleksi.kirim(A.sesi, iR, ['Belajar VLAN'], 4);

    var d = Rekap.kelas(kelasId, 'semua');
    var a = null, b = null, c = null;
    d.murid.forEach(function (m) {
      if (m.nama === 'zzrekapa') a = m;
      if (m.nama === 'zzrekapb') b = m;
      if (m.nama === 'zzrekapc') c = m;
    });

    var kL = 0, kQ = 1;
    cek('LKPD diterima → 80', a && a.nilai[kL] === 80,
        a ? String(a.nilai[kL]) : '');
    cek('quiz mengambil nilai TERTINGGI (100, bukan 0)',
        a && a.nilai[kQ] === 100, a ? String(a.nilai[kQ]) : '');
    cek('skala refleksi TIDAK bocor ke rekap nilai',
        a && a.nilai.indexOf(4) === -1, a ? JSON.stringify(a.nilai) : '');
    cek('tidak ada kolom bertipe refleksi', d.item.every(function (x) {
      return x.tipe !== 'refleksi';
    }));
    cek('skala tetap hidup di Rekap Refleksi', function () {
      var rr = Refleksi.rekap(iR);
      return rr.jml_terkirim === 1 && rr.rata_skala === 4;
    }());
    cek('LKPD belum dinilai → sel kosong', b && b.nilai[kL] === '');
    cek('catatan membedakan menunggu dari belum',
        b && b.catatan[kL] === 'menunggu', b ? b.catatan[kL] : '');
    cek('murid tanpa aktivitas → semua kosong',
        c && c.nilai.join('|') === '|');

    Logger.log('');
    Logger.log('C. Rata-rata');
    cek('rata-rata = 90 dari LKPD & Quiz', a && a.rata === 90,
        a ? String(a.rata) : '');
    cek('murid tanpa nilai → rata kosong', c && c.rata === '');

    Logger.log('');
    Logger.log('D. Penapis bab');
    var pb = Rekap.pilihanBab(kelasId);
    cek('cacah item per bab benar',
        pb.bab.length >= 2 && pb.bab[0].jml_item === 2 &&
        pb.bab[1].jml_item === 0);
    cek('bab berisi refleksi saja → nol kolom bernilai',
        Rekap.kelas(kelasId, mp2).item.length === 0);

    Logger.log('');
    Logger.log('E. Ekspor ke Google Sheet');
    var r = Rekap.ekspor(sg, kelasId, 'semua');
    berkasId = r.spreadsheet_id;
    cek('berkas dibuat', !!r.spreadsheet_id, r.spreadsheet_id);
    cek('bukan menimpa basis data',
        r.spreadsheet_id !== Db.idDb(), r.spreadsheet_id);
    cek('tautan tersedia', String(r.url).indexOf('http') === 0);
    cek('jumlah murid & item benar',
        r.jml_murid === 3 && r.jml_item === 2,
        r.jml_murid + ' murid, ' + r.jml_item + ' item');

    var isi = SpreadsheetApp.openById(r.spreadsheet_id)
      .getSheets()[0].getDataRange().getValues();
    cek('isi berkas tertulis', isi.length > 8, isi.length + ' baris');

    var barisA = null;
    isi.forEach(function (row) { if (row[1] === 'zzrekapa') barisA = row; });
    cek('baris murid ada di berkas', !!barisA);
    cek('nilai tertulis benar',
        barisA && barisA[3] === 80 && barisA[4] === 100);
    cek('skala refleksi tidak ikut ke berkas',
        barisA && barisA.indexOf(4) === -1,
        barisA ? JSON.stringify(barisA) : '');
    cek('rata-rata tertulis 90', barisA && barisA[5] === 90,
        barisA ? String(barisA[5]) : '');

    Logger.log('');
    Logger.log('  📂 Berkas uji: ' + r.url);

  } catch (e) {
    gagal++;
    Logger.log('  ❌ GALAT: ' + e.message);
    if (e.stack) Logger.log('     ' + String(e.stack).split('\n')[1]);
  } finally {
    Logger.log('');
    Logger.log('Membersihkan data uji…');
    /* Memakai ulang bersihkanSisaUji(): kelas DAN username murid.
       Hanya menghapus kelas membuat jalankan berikutnya gagal dengan
       "Nama pengguna sudah dipakai" — bug yang ditemukan user pada
       jalankan kedua ujiTahap11(). */
    try { bersihkanSisaUji(); Logger.log('  Kelas & murid uji dihapus.'); }
    catch (e) { Logger.log('  ⚠️ gagal membersihkan: ' + e.message); }

    if (berkasId) {
      try {
        DriveApp.getFileById(berkasId).setTrashed(true);
        Logger.log('  Berkas ekspor uji dibuang ke tong sampah.');
      } catch (e) { Logger.log('  ⚠️ gagal membuang berkas: ' + e.message); }
    }
  }

  var total = Math.round((new Date() - mulai) / 1000);
  Logger.log('');
  Logger.log('=====================================');
  Logger.log('  LOLOS: ' + lolos + '   GAGAL: ' + gagal +
             '   (' + total + ' detik)');
  Logger.log('=====================================');
  if (gagal === 0) {
    Logger.log('✅ Rekap nilai & ekspor berfungsi di Apps Script.');
  } else {
    Logger.log('❌ Ada ' + gagal + ' pemeriksaan gagal — salin log di atas.');
  }
}


/**
 * UJI TAHAP 12 — Kelompok soal berbagi teks bacaan (v1.4.0–1.4.3).
 *
 * Menutup celah verifikasi: ujiTahap9() menguji hierarki & refleksi,
 * ujiTahap11() menguji rekap — tidak satu pun menyentuh kelompok soal,
 * padahal v1.4.0–1.4.3 menyentuh SKEMA (`grup_id` + `stimulus`).
 *
 * Yang diperiksa adalah hal-hal yang hanya bisa gagal di Apps Script
 * sungguhan: kolom skema benar-benar ada setelah migrasiStruktur(),
 * nilai tersimpan lalu TERBACA kembali, dan pengacakan menjaga
 * kelompok utuh.
 *
 * Membuat kelas `ZZ Uji Grup Soal` lalu menghapusnya sendiri —
 * termasuk username murid uji (pelajaran v1.5.3). Aman diulang.
 */
function ujiTahap12() {
  _hanyaEditor();
  Logger.log('=== UJI TAHAP 12 — KELOMPOK SOAL (v' + APP_VERSI + ') ===');
  var mulai = new Date();

  var g = _sesiGuruDiagnostik();  /* tanpa password (v1.9.11) */
  if (!g.ok) { Logger.log('❌ Login guru gagal: ' + g.pesan); return; }
  var sg = Auth.validasiToken(g.data.token);

  var lolos = 0, gagal = 0;
  function cek(nama, benar, ket) {
    if (benar) { lolos++; Logger.log('  ✅ ' + nama + (ket ? '  ' + ket : '')); }
    else { gagal++; Logger.log('  ❌ ' + nama + (ket ? '  → ' + ket : '')); }
  }

  var MURID_UJI = ['zzgrupa', 'zzgrupb'];

  function bersihkanSisaUji() {
    var kl = Db.cari('kelas', 'nama_kelas', 'ZZ Uji Grup Soal');
    if (kl) { try { Kelas.hapus(sg, kl.kelas_id); } catch (e) {} }
    MURID_UJI.forEach(function (u) {
      var mu = Db.cari('users', 'username', u);
      if (mu) { try { Db.hapus('users', mu._baris); } catch (e) {} }
    });
  }

  bersihkanSisaUji();

  var kelasId = null;
  try {
    /* ---------------------------------------- A. Skema */
    Logger.log('');
    Logger.log('A. Skema sheet `soal`');

    var head = Db.header('soal');
    cek('kolom grup_id ada', head.indexOf('grup_id') > -1,
        head.indexOf('grup_id') < 0 ? 'JALANKAN migrasiStruktur()' : '');
    cek('kolom stimulus ada', head.indexOf('stimulus') > -1,
        head.indexOf('stimulus') < 0 ? 'JALANKAN migrasiStruktur()' : '');
    /* PREFIX_SAH tidak diekspor — diuji lewat perilakunya: buatId()
       melempar galat bila prefix tidak terdaftar. */
    var prefixOk = true;
    try { Util.buatId('GRP'); } catch (e) { prefixOk = false; }
    cek('prefix GRP terdaftar di Util', prefixOk);
    cek('API grup soal termuat',
        typeof Quiz.satukanGrup === 'function' &&
        typeof Quiz.lepasGrup === 'function' &&
        typeof Quiz.ubahStimulusGrup === 'function');

    if (head.indexOf('grup_id') < 0 || head.indexOf('stimulus') < 0) {
      Logger.log('');
      Logger.log('⛔ Kolom skema belum ada — hentikan.');
      Logger.log('   Jalankan migrasiStruktur() lalu ulangi ujiTahap12().');
      throw new Error('skema belum dimigrasi');
    }

    /* ---------------------------------------- siapkan */
    kelasId = Kelas.simpan(sg, {
      nama_kelas: 'ZZ Uji Grup Soal', mapel: 'PKPJ',
      jenjang: 'SMK', fase: 'F', tingkat: 'XI',
      kompetensi_keahlian: 'TJKT'
    }).kelas_id;

    var mp = MateriPokok.simpan(sg, { kelas_id: kelasId, judul: 'Bab Uji Grup',
      wajib: false, urut_ketat: false, status: 'publish' }).mp_id;
    var ptm = Pertemuan.simpan(sg, { mp_id: mp, judul: 'Pertemuan Uji Grup',
      urut_ketat: false, status: 'publish' }).pertemuan_id;
    var itemId = Pertemuan.simpanItem(sg, { pertemuan_id: ptm, tipe: 'quiz',
      judul: 'Quiz Uji Grup', kkm: 70, max_percobaan: 5,
      acak_soal: true, acak_opsi: false, status: 'publish' }).item_id;

    var BACAAN = '<p>Sebuah laboratorium memiliki 24 komputer yang ' +
      'terhubung ke satu switch. Switch itu tersambung ke router utama ' +
      'sekolah melalui kabel uplink.</p>';

    var sid = [];
    for (var n = 1; n <= 6; n++) {
      sid.push(Quiz.simpanSoal(sg, { item_id: itemId, tipe: 'pg',
        pertanyaan: 'Soal nomor ' + n + '?',
        opsi: ['A' + n, 'B' + n], kunci: 'A', bobot: 10 }).soal_id);
    }
    cek('enam soal tersimpan', Quiz.getSoalGuru(itemId).soal.length === 6);

    /* ---------------------------------------- B. Satukan */
    Logger.log('');
    Logger.log('B. Menyatukan kelompok');

    var r = Quiz.satukanGrup(sg, itemId, [sid[0], sid[1], sid[2]], BACAAN);
    cek('tiga soal disatukan', r.jml === 3, r.jml + ' soal');
    cek('grup_id berprefix GRP', String(r.grup_id).indexOf('GRP-') === 0,
        r.grup_id);

    /* Inilah bug v1.4.0: tersimpan benar tetapi TERBACA kosong karena
       daftar kolom eksplisit _soalItem() belum memuat kolom baru. */
    var d = Quiz.getSoalGuru(itemId);
    var anggota = d.soal.filter(function (s) { return s.grup_id === r.grup_id; });
    cek('grup_id TERBACA kembali (bug v1.4.0)', anggota.length === 3,
        anggota.length + ' anggota terbaca');

    var pemegang = d.soal.filter(function (s) { return !!s.stimulus; });
    cek('bacaan TERBACA kembali', pemegang.length === 1,
        pemegang.length + ' pemegang');
    cek('bacaan hanya disimpan SEKALI',
        pemegang.length === 1 && pemegang[0].stimulus.indexOf('24 komputer') > -1);
    cek('rekap mencacah 1 kelompok', d.rekap.jml_grup === 1,
        String(d.rekap.jml_grup));

    /* ---------------------------------------- C. Susun ulang */
    Logger.log('');
    Logger.log('C. Susun ulang tidak memecah kelompok (bug v1.4.1 B2)');

    var urut = d.soal.slice().sort(function (a, b) { return a.nomor - b.nomor; })
      .map(function (s) { return s.soal_id; });
    /* pindahkan blok kelompok ke belakang */
    var tanpaGrup = urut.filter(function (x) { return anggota.every(
      function (a) { return a.soal_id !== x; }); });
    Quiz.aturUrutanSoal(sg, itemId,
      [tanpaGrup[0]].concat(anggota.map(function (a) { return a.soal_id; }))
        .concat(tanpaGrup.slice(1)));

    var d2 = Quiz.getSoalGuru(itemId);
    var urutGrup = d2.soal
      .sort(function (a, b) { return a.nomor - b.nomor; })
      .map(function (s) { return s.grup_id ? 'G' : '.'; }).join('');
    cek('anggota kelompok tetap BERDAMPINGAN', /^\.?G{3}\.*$/.test(urutGrup),
        urutGrup);

    /* ---------------------------------------- D. Penjagaan */
    Logger.log('');
    Logger.log('D. Penjagaan');

    var ditolak = false;
    try { Quiz.satukanGrup(sg, itemId, [sid[0], sid[3]], 'teks lain'); }
    catch (e) { ditolak = (e.kode === 'VALIDASI_GAGAL'); }
    cek('soal bergrup tidak bisa masuk kelompok kedua (v1.4.1 B3)', ditolak);

    var ditolak2 = false;
    try { Quiz.satukanGrup(sg, itemId, [sid[3]], 'teks'); }
    catch (e) { ditolak2 = true; }
    cek('kelompok beranggota satu ditolak', ditolak2);

    /* ---------------------------------------- E. Ubah bacaan */
    Logger.log('');
    Logger.log('E. Ubah teks bacaan (API v1.4.1)');

    var BARU = '<p>Teks bacaan yang sudah diperbarui oleh guru.</p>';
    var u = Quiz.ubahStimulusGrup(sg, itemId, r.grup_id, BARU);
    cek('tiga anggota diperbarui', u.diperbarui === 3, String(u.diperbarui));

    var d3 = Quiz.getSoalGuru(itemId);
    var pem3 = d3.soal.filter(function (s) { return !!s.stimulus; });
    cek('bacaan baru terbaca',
        pem3.length === 1 && pem3[0].stimulus.indexOf('diperbarui') > -1);
    cek('masih hanya satu pemegang', pem3.length === 1);

    /* ---------------------------------------- F. Hapus pemegang */
    Logger.log('');
    Logger.log('F. Hapus pemegang bacaan (bug v1.4.1 B1)');

    Quiz.hapusSoal(sg, pem3[0].soal_id);
    var d4 = Quiz.getSoalGuru(itemId);
    var pem4 = d4.soal.filter(function (s) { return !!s.stimulus; });
    cek('bacaan DISELAMATKAN ke anggota tersisa', pem4.length === 1,
        pem4.length + ' pemegang');
    cek('isinya tidak berubah',
        pem4.length === 1 && pem4[0].stimulus.indexOf('diperbarui') > -1);
    cek('kelompok tinggal dua anggota',
        d4.soal.filter(function (s) { return !!s.grup_id; }).length === 2);

    /* ---------------------------------------- G. Murid */
    Logger.log('');
    Logger.log('G. Murid mengerjakan — acak menjaga kelompok');

    var murid = [];
    MURID_UJI.forEach(function (uname) {
      var m = Kelas.simpanMurid(sg, { nama: uname, username: uname,
                                      kelas_id: kelasId });
      Db.perbarui('users', Db.cari('users', 'user_id', m.user_id)._baris,
        { harus_ganti_password: false });
      murid.push(Auth.validasiToken(
        Auth.login(uname, m.password_sementara).data.token));
    });

    var utuh = 0, adaBacaan = 0, adaKunci = 0, percobaan = 0;
    for (var p = 0; p < 4; p++) {
      var sesiM = murid[p % 2];
      var att;
      try { att = Quiz.mulaiQuiz(sesiM, itemId); }
      catch (e) { continue; }
      percobaan++;

      var pola = att.soal.map(function (s) { return s.grup_id ? 'G' : '.'; }).join('');
      if (/^\.*G{2}\.*$/.test(pola)) utuh++;
      if (att.soal.some(function (s) { return !!s.stimulus; })) adaBacaan++;
      if (att.soal.some(function (s) {
        return s.kunci !== undefined || s.pembahasan !== undefined;
      })) adaKunci++;

      Quiz.kumpulkanQuiz(sesiM, att.attempt_id);
    }

    cek('percobaan berhasil dijalankan', percobaan >= 2, percobaan + 'x');
    cek('acak MENJAGA kelompok berdampingan', utuh === percobaan,
        utuh + '/' + percobaan + ' percobaan utuh');
    cek('bacaan sampai ke murid', adaBacaan === percobaan,
        adaBacaan + '/' + percobaan);
    cek('kunci & pembahasan TIDAK bocor', adaKunci === 0);

    /* ---------------------------------------- H. Saat dikerjakan */
    Logger.log('');
    Logger.log('H. Perubahan ditolak saat murid mengerjakan (v1.4.1 B4)');

    var attHidup = Quiz.mulaiQuiz(murid[0], itemId);
    var tolakUbah = false;
    try { Quiz.ubahStimulusGrup(sg, itemId, r.grup_id, '<p>ubah</p>'); }
    catch (e) { tolakUbah = true; }
    cek('ubah bacaan ditolak', tolakUbah);

    var tolakLepas = false;
    try { Quiz.lepasGrup(sg, itemId, r.grup_id); }
    catch (e) { tolakLepas = true; }
    cek('lepas kelompok ditolak', tolakLepas);

    Quiz.kumpulkanQuiz(murid[0], attHidup.attempt_id);

    /* ---------------------------------------- I. Lepas */
    Logger.log('');
    Logger.log('I. Melepas kelompok');

    var lp = Quiz.lepasGrup(sg, itemId, r.grup_id);
    cek('dua soal dilepas', lp.dilepas === 2, String(lp.dilepas));

    var d5 = Quiz.getSoalGuru(itemId);
    cek('tidak ada grup_id tersisa',
        d5.soal.every(function (s) { return !s.grup_id; }));
    cek('tidak ada bacaan tersisa',
        d5.soal.every(function (s) { return !s.stimulus; }));
    cek('soalnya SENDIRI tidak ikut terhapus', d5.soal.length === 5,
        d5.soal.length + ' soal');

  } catch (e) {
    gagal++;
    Logger.log('  ❌ GALAT: ' + e.message);
    if (e.stack) Logger.log('     ' + String(e.stack).split('\n')[1]);
  } finally {
    Logger.log('');
    Logger.log('Membersihkan data uji…');
    try { bersihkanSisaUji(); Logger.log('  Kelas & murid uji dihapus.'); }
    catch (e) { Logger.log('  ⚠️ gagal membersihkan: ' + e.message); }
  }

  var total = Math.round((new Date() - mulai) / 1000);
  Logger.log('');
  Logger.log('=====================================');
  Logger.log('  LOLOS: ' + lolos + '   GAGAL: ' + gagal +
             '   (' + total + ' detik)');
  Logger.log('=====================================');
  if (gagal === 0) {
    Logger.log('✅ Kelompok soal berfungsi di Apps Script.');
  } else {
    Logger.log('❌ Ada ' + gagal + ' pemeriksaan gagal — salin log di atas.');
  }
}



/**
 * ujiTahap13() — TUGAS KELOMPOK di Apps Script sungguhan (v1.7.x)
 *
 * Menutup celah yang tidak bisa dilihat mock: skema sheet nyata,
 * validasi dropdown Sheets, dan perilaku enum `tipe` yang baru.
 *
 * AMAN DIULANG. Bersih-bersih memakai fungsi yang SAMA di awal dan
 * akhir (KONVENSI §6.2 no. 24), termasuk menghapus baris `users` —
 * `Kelas.hapus()` sengaja tidak menyentuhnya (pelajaran v1.5.3).
 */
function ujiTahap13() {
  _hanyaEditor();
  Logger.log('=== UJI TAHAP 13 — TUGAS KELOMPOK (v' + APP_VERSI + ') ===');
  var mulai = new Date();

  var g = _sesiGuruDiagnostik();  /* tanpa password (v1.9.11) */
  if (!g.ok) { Logger.log('❌ Login guru gagal: ' + g.pesan); return; }
  var sg = Auth.validasiToken(g.data.token);

  var lolos = 0, gagal = 0;
  function cek(nama, benar, ket) {
    if (benar) { lolos++; Logger.log('  ✅ ' + nama + (ket ? '  ' + ket : '')); }
    else { gagal++; Logger.log('  ❌ ' + nama + (ket ? '  → ' + ket : '')); }
  }

  var NAMA_KELAS = 'ZZ Uji Tugas Kelompok';
  var MURID_UJI  = ['zzklpa', 'zzklpb', 'zzklpc', 'zzklpd'];

  function bersihkanSisaUji() {
    var kl = Db.cari('kelas', 'nama_kelas', NAMA_KELAS);
    if (kl) { try { Kelas.hapus(sg, kl.kelas_id); } catch (e) {} }
    MURID_UJI.forEach(function (u) {
      var mu = Db.cari('users', 'username', u);
      if (mu) { try { Db.hapus('users', mu._baris); } catch (e) {} }
    });
  }

  bersihkanSisaUji();

  var kelasId = null;
  try {
    /* ---------------------------------------- A. Skema & modul */
    Logger.log('');
    Logger.log('A. Skema & modul');

    var adaSheet = true;
    try { Db.header('kelompok'); } catch (e) { adaSheet = false; }
    cek('sheet `kelompok` ada', adaSheet,
        adaSheet ? '' : 'JALANKAN migrasiStruktur()');
    if (!adaSheet) throw new Error('sheet kelompok belum dibuat');

    var hk = Db.header('kelompok');
    ['kelompok_id', 'item_id', 'kelas_id', 'nama', 'ketua_user_id',
     'anggota', 'urutan'].forEach(function (k) {
      cek('kolom kelompok.' + k, hk.indexOf(k) > -1);
    });

    var hs = Db.header('lkpd_submission');
    cek('kolom lkpd_submission.kelompok_id', hs.indexOf('kelompok_id') > -1,
        hs.indexOf('kelompok_id') < 0 ? 'JALANKAN migrasiStruktur()' : '');
    cek('kolom lkpd_submission.nilai_anggota',
        hs.indexOf('nilai_anggota') > -1,
        hs.indexOf('nilai_anggota') < 0 ? 'JALANKAN migrasiStruktur()' : '');

    var prefixOk = true;
    try { Util.buatId('KLP'); } catch (e) { prefixOk = false; }
    cek('prefix KLP terdaftar di Util', prefixOk);
    cek('modul Kelompok termuat', typeof Kelompok === 'object');
    cek('Kelompok.antreanSemua tersedia',
        typeof Kelompok.antreanSemua === 'function');

    /* ---------------------------------------- B. Item bertipe baru */
    Logger.log('');
    Logger.log('B. Membuat item tugas kelompok');

    kelasId = Kelas.simpan(sg, { nama_kelas: NAMA_KELAS,
      mapel: 'PKPJ', tingkat: 'XI' }).kelas_id;
    var ptm = Pertemuan.simpan(sg, { kelas_id: kelasId, judul: 'Uji TK',
      urut_ketat: false, status: 'publish' });

    /* Inilah yang gagal di lapangan: enum `tipe` sheet `item` menolak
       nilai baru bila validasi dropdown belum dimigrasikan. */
    var itemTK = null, galatItem = '';
    try {
      itemTK = Pertemuan.simpanItem(sg, {
        pertemuan_id: ptm.pertemuan_id, tipe: 'tugas_kelompok',
        judul: 'Rancang Topologi', tujuan_pembelajaran: 'Merancang jaringan',
        konten: '<p>Langkah kerja.</p>', status: 'publish' });
    } catch (e) { galatItem = e.message; }
    cek('item bertipe tugas_kelompok BISA disimpan', !!itemTK,
        galatItem ? galatItem + ' — JALANKAN migrasiStruktur()' : '');
    if (!itemTK) throw new Error('enum tipe belum dimigrasikan');

    var itRow = Db.cari('item', 'item_id', itemTK.item_id);
    cek('tipe tersimpan apa adanya di sheet',
        itRow.tipe === 'tugas_kelompok', String(itRow.tipe));

    /* ---------------------------------------- C. Payload UI guru */
    Logger.log('');
    Logger.log('C. Payload layar guru');

    var m = {};
    ['a', 'b', 'c', 'd'].forEach(function (n, i) {
      var u = MURID_UJI[i];
      var r = Kelas.simpanMurid(sg, { nama: 'ZZ Murid ' + n.toUpperCase(),
        username: u, kelas_id: kelasId });
      Db.perbarui('users', Db.cari('users', 'user_id', r.user_id)._baris,
        { harus_ganti_password: false });
      m[n] = { id: r.user_id, pwd: r.password_sementara };
    });

    Kelompok.simpan(sg, { item_id: itemTK.item_id, nama: 'Tim Router',
      anggota: [m.a.id, m.b.id, m.c.id], ketua_user_id: m.a.id });

    var d1 = Kelompok.daftar(itemTK.item_id);
    var k1 = d1.kelompok[0];
    cek('kelompok tersimpan', d1.kelompok.length === 1);
    cek('nama kelompok ketikan guru dipakai', k1.nama === 'Tim Router');
    cek('3 anggota tercatat', k1.jml_anggota === 3);
    cek('ketua ditandai',
        k1.anggota.filter(function (a) { return a.ketua; }).length === 1);
    cek('murid d masuk daftar belum berkelompok',
        d1.belum_berkelompok.length === 1);

    /* medan v1.7.3 — dipakai UI untuk memperingatkan guru */
    cek('payload membawa jml_aktif', k1.jml_aktif === 3,
        String(k1.jml_aktif));
    cek('payload membawa ketua_keluar', k1.ketua_keluar === false);
    cek('tiap anggota membawa penanda keluar',
        k1.anggota.every(function (a) { return a.keluar === false; }));

    /* ---------------------------------------- D. Alur murid */
    Logger.log('');
    Logger.log('D. Alur murid');

    var sesi = {};
    ['a', 'b', 'd'].forEach(function (n) {
      var i = { a: 0, b: 1, c: 2, d: 3 }[n];
      sesi[n] = Auth.validasiToken(
        Auth.login(MURID_UJI[i], m[n].pwd).data.token);
    });

    var bukaB = Kelompok.buka(sesi.b, itemTK.item_id);
    cek('anggota melihat kelompoknya', bukaB.punya_kelompok === true);
    cek('anggota bukan ketua tahu dirinya bukan ketua',
        bukaB.aku_ketua === false);

    var bukaD = Kelompok.buka(sesi.d, itemTK.item_id);
    cek('murid tanpa kelompok TETAP bisa membuka',
        bukaD.punya_kelompok === false);
    cek('ia diberi pesan, bukan galat',
        String(bukaD.pesan || '').indexOf('belum dimasukkan') > -1);

    var tolakB = false;
    try { Kelompok.kumpulkan(sesi.b, itemTK.item_id); }
    catch (e) { tolakB = e.kode === 'AKSES_DITOLAK'; }
    cek('bukan ketua DITOLAK mengumpulkan', tolakB);

    /* Medan yang dipakai layar murid (v1.7.7). Bila salah satu
       hilang, layarnya menampilkan "undefined" — persis kegagalan
       yang dilaporkan guru pada v1.7.5. */
    cek('payload membawa judul pertemuan',
        !!bukaB.item.pertemuan_judul, String(bukaB.item.pertemuan_judul));
    cek('payload membawa batas tautan dari server',
        Number(bukaB.item.maks_link) > 0, String(bukaB.item.maks_link));
    cek('payload pengumpulan membawa penanda terkunci',
        bukaB.pengumpulan.terkunci === false);
    cek('payload pengumpulan membawa bisa_batalkan',
        bukaB.pengumpulan.bisa_batalkan === false);
    cek('anggota tahu siapa ketuanya',
        bukaB.kelompok.anggota.filter(function (a) {
          return a.ketua; }).length === 1);
    cek('murid tahu yang mana dirinya',
        bukaB.kelompok.anggota.filter(function (a) {
          return a.aku; }).length === 1);

    Kelompok.simpanDraf(sesi.a, itemTK.item_id,
      ['https://drive.google.com/file/d/zzuji'], 'Sudah kami kerjakan.');
    var hasilKumpul = Kelompok.kumpulkan(sesi.a, itemTK.item_id);
    cek('ketua berhasil mengumpulkan', hasilKumpul.jml_link === 1);

    function progresPeta() {
      var p = {};
      Db.saringBaris('progress', 'item_id', itemTK.item_id,
        ['user_id', 'status', 'nilai']).forEach(function (r) {
          p[r.user_id] = r;
        });
      return p;
    }
    var pr1 = progresPeta();
    cek('SELURUH anggota berstatus menunggu',
        [m.a.id, m.b.id, m.c.id].every(function (u) {
          return pr1[u] && pr1[u].status === 'menunggu';
        }),
        [m.a.id, m.b.id, m.c.id].map(function (u) {
          return (pr1[u] || {}).status;
        }).join('/'));
    cek('murid di luar kelompok tidak kebagian progres', !pr1[m.d.id]);

    /* ---------------------------------------- E. Tidak bocor ke LKPD */
    Logger.log('');
    Logger.log('E. Tidak bocor ke jalur LKPD (v1.7.1)');

    var antreLkpd = Lkpd.antrean(kelasId);
    cek('tidak muncul di antrean penilaian LKPD',
        antreLkpd.every(function (s) { return s.item_id !== itemTK.item_id; }),
        antreLkpd.length + ' entri');

    var subKel = null;
    Db.saringBaris('lkpd_submission', 'item_id', itemTK.item_id,
      ['submission_id', 'kelompok_id']).forEach(function (s) {
        if (s.kelompok_id) subKel = s;
      });
    cek('pengumpulan menyimpan kelompok_id', !!subKel);

    var tolakNilaiLkpd = false;
    try { Lkpd.nilai(sg, subKel.submission_id, 'diterima', 99, 'x'); }
    catch (e) { tolakNilaiLkpd = e.kode === 'VALIDASI_GAGAL'; }
    cek('Lkpd.nilai() MENOLAK submission kelompok', tolakNilaiLkpd);

    var brd = Beranda.untukGuru(sg);
    cek('beranda menghitungnya terpisah dari LKPD',
        brd.perlu_tindakan.kelompok_menunggu >= 1,
        'kelompok=' + brd.perlu_tindakan.kelompok_menunggu +
        ' lkpd=' + brd.perlu_tindakan.lkpd_menunggu);

    var antreSemua = Kelompok.antreanSemua('');
    cek('antrean gabungan memuat tugas ini',
        antreSemua.item.some(function (x) {
          return x.item_id === itemTK.item_id;
        }));

    /* ---------------------------------------- F. Penilaian dua tingkat */
    Logger.log('');
    Logger.log('F. Nilai kelompok + penyesuaian anggota');

    var penyesuaian = {};
    penyesuaian[m.c.id] = 70;
    var hasilNilai = Kelompok.nilai(sg, itemTK.item_id, k1.kelompok_id,
      'diterima', 85, 'Kerja bagus.', penyesuaian);
    cek('penilaian menyentuh 3 anggota', hasilNilai.jml_anggota === 3);
    cek('1 anggota disesuaikan', hasilNilai.jml_disesuaikan === 1);

    var pr2 = progresPeta();
    cek('anggota tanpa penyesuaian dapat nilai kelompok',
        Number(pr2[m.a.id].nilai) === 85 && Number(pr2[m.b.id].nilai) === 85,
        pr2[m.a.id].nilai + '/' + pr2[m.b.id].nilai);
    cek('anggota yang disesuaikan dapat nilainya sendiri',
        Number(pr2[m.c.id].nilai) === 70, String(pr2[m.c.id].nilai));
    cek('seluruh anggota berstatus selesai',
        [m.a.id, m.b.id, m.c.id].every(function (u) {
          return pr2[u].status === 'selesai';
        }));

    /* Ketua membatalkan lalu mengumpulkan lagi — jalur yang dipakai
       tombol "Batalkan Penyerahan" di layar murid. */
    var sesiA = Auth.validasiToken(
      Auth.login(MURID_UJI[0], m.a.pwd).data.token);
    var sblBatal = Kelompok.buka(sesiA, itemTK.item_id);
    cek('setelah dinilai, tidak bisa dibatalkan lagi',
        sblBatal.pengumpulan.bisa_batalkan === false);

    var lihatC = Kelompok.buka(
      Auth.validasiToken(Auth.login(MURID_UJI[2], m.c.pwd).data.token),
      itemTK.item_id);
    cek('murid melihat nilai kelompok DAN nilainya sendiri',
        Number(lihatC.pengumpulan.nilai_kelompok) === 85 &&
        Number(lihatC.pengumpulan.nilai_saya) === 70,
        lihatC.pengumpulan.nilai_kelompok + ' / ' +
        lihatC.pengumpulan.nilai_saya);

    /* ---------------------------------------- G. Rekap */
    Logger.log('');
    Logger.log('G. Rekap nilai');

    var rk = Rekap.kelas(kelasId, 'semua');
    var kolTK = -1;
    rk.item.forEach(function (it, i) {
      if (it.item_id === itemTK.item_id) kolTK = i;
    });
    cek('tugas kelompok punya kolom di rekap', kolTK > -1);
    var barisRk = {};
    rk.murid.forEach(function (x) { barisRk[x.user_id] = x; });
    cek('nilai anggota terbaca lewat kelompok, bukan pemilik submission',
        Number(barisRk[m.b.id].nilai[kolTK]) === 85,
        String(barisRk[m.b.id].nilai[kolTK]));
    cek('penyesuaian ikut terbawa ke rekap',
        Number(barisRk[m.c.id].nilai[kolTK]) === 70,
        String(barisRk[m.c.id].nilai[kolTK]));

    /* ---------------------------------------- H. Murid keluar kelas */
    Logger.log('');
    Logger.log('H. Anggota keluar kelas (v1.7.3)');

    Kelas.keluarkan(sg, kelasId, m.c.id);
    var d2 = Kelompok.daftar(itemTK.item_id);
    var k2 = d2.kelompok[0];
    cek('anggota yang keluar TETAP tampil, ditandai',
        k2.anggota.length === 3 &&
        k2.anggota.filter(function (a) { return a.keluar; }).length === 1);
    cek('jml_aktif menyusut, jml_anggota tetap',
        k2.jml_aktif === 2 && k2.jml_anggota === 3,
        k2.jml_aktif + '/' + k2.jml_anggota);

    var pesanTolak = '';
    try {
      Kelompok.simpan(sg, { item_id: itemTK.item_id,
        kelompok_id: k2.kelompok_id, nama: 'Tim Router',
        anggota: [m.a.id, m.b.id, m.c.id], ketua_user_id: m.a.id });
    } catch (e) { pesanTolak = e.message; }
    cek('menyimpan ulang dengan murid keluar DITOLAK', !!pesanTolak);
    cek('penolakan menyebut NAMA murid',
        pesanTolak.indexOf('ZZ Murid C') > -1, pesanTolak);

    /* ---------------------------------------- I. Penghapusan berantai */
    Logger.log('');
    Logger.log('I. Penghapusan berantai');

    var jmlKelompokSebelum = Db.saringBaris('kelompok', 'item_id',
      itemTK.item_id, ['kelompok_id']).length;
    cek('kelompok masih ada sebelum item dihapus',
        jmlKelompokSebelum === 1);

    Pertemuan.hapusItem(sg, itemTK.item_id);
    cek('menghapus item ikut membuang kelompoknya',
        Db.saringBaris('kelompok', 'item_id', itemTK.item_id,
          ['kelompok_id']).length === 0);
    cek('pengumpulannya ikut terbuang',
        Db.saringBaris('lkpd_submission', 'item_id', itemTK.item_id,
          ['submission_id']).length === 0);
    cek('progresnya ikut terbuang',
        Db.saringBaris('progress', 'item_id', itemTK.item_id,
          ['progress_id']).length === 0);

  } catch (e) {
    gagal++;
    Logger.log('  ❌ GALAT: ' + e.message);
    if (e.stack) Logger.log('     ' + String(e.stack).split('\n')[1]);
  } finally {
    Logger.log('');
    Logger.log('Membersihkan data uji…');
    try { bersihkanSisaUji(); Logger.log('  Kelas & murid uji dihapus.'); }
    catch (e) { Logger.log('  ⚠️ gagal membersihkan: ' + e.message); }
  }

  var total = Math.round((new Date() - mulai) / 1000);
  Logger.log('');
  Logger.log('=====================================');
  Logger.log('  LOLOS: ' + lolos + '   GAGAL: ' + gagal +
             '   (' + total + ' detik)');
  Logger.log('=====================================');
  if (gagal === 0) {
    Logger.log('✅ Tugas kelompok berfungsi di Apps Script.');
  } else {
    Logger.log('❌ Ada ' + gagal + ' pemeriksaan gagal — salin log di atas.');
    Logger.log('   Bila kegagalan menyebut skema/enum,');
    Logger.log('   jalankan migrasiStruktur() lalu ulangi.');
  }
}



/**
 * ujiTahap14() — BUKA KUNCI di Apps Script sungguhan (v1.8.0)
 *
 * Menutup celah verifikasi §6.2 no. 25: v1.8.0 mengubah PERILAKU
 * unlock — item yang dibuka paksa kini menembus kunci pertemuan.
 * Itu perubahan pada jalur yang dipakai SELURUH tipe item, jadi
 * wajib dibuktikan di lapangan, bukan hanya di mock.
 *
 * AMAN DIULANG. Bersih-bersih memakai fungsi yang SAMA di awal dan
 * akhir, termasuk menghapus baris `users`.
 */
function ujiTahap14() {
  _hanyaEditor();
  Logger.log('=== UJI TAHAP 14 — BUKA KUNCI (v' + APP_VERSI + ') ===');
  var mulai = new Date();

  var g = _sesiGuruDiagnostik();  /* tanpa password (v1.9.11) */
  if (!g.ok) { Logger.log('❌ Login guru gagal: ' + g.pesan); return; }
  var sg = Auth.validasiToken(g.data.token);

  var lolos = 0, gagal = 0;
  function cek(nama, benar, ket) {
    if (benar) { lolos++; Logger.log('  ✅ ' + nama + (ket ? '  ' + ket : '')); }
    else { gagal++; Logger.log('  ❌ ' + nama + (ket ? '  → ' + ket : '')); }
  }

  var NAMA_KELAS = 'ZZ Uji Buka Kunci';
  var MURID_UJI = ['zzkuncia', 'zzkuncib', 'zzkuncic'];

  function bersihkanSisaUji() {
    var kl = Db.cari('kelas', 'nama_kelas', NAMA_KELAS);
    if (kl) { try { Kelas.hapus(sg, kl.kelas_id); } catch (e) {} }
    MURID_UJI.forEach(function (u) {
      var mu = Db.cari('users', 'username', u);
      if (mu) { try { Db.hapus('users', mu._baris); } catch (e) {} }
    });
  }

  bersihkanSisaUji();

  try {
    /* ---------------------------------------- A. modul & API */
    Logger.log('');
    Logger.log('A. Modul & API');

    ['kunciMurid', 'kunciItem', 'bukaBanyak', 'kunciUlang',
     'unlockPaksa'].forEach(function (f) {
      cek('Belajar.' + f + ' tersedia', typeof Belajar[f] === 'function');
    });

    var head = Db.header('progress');
    cek('kolom progress.dibuka_paksa ada',
        head.indexOf('dibuka_paksa') > -1);
    cek('kolom progress.alasan_paksa ada',
        head.indexOf('alasan_paksa') > -1);

    /* ---------------------------------------- B. panggung */
    Logger.log('');
    Logger.log('B. Menyiapkan kelas berurut-ketat');

    var kelasId = Kelas.simpan(sg, { nama_kelas: NAMA_KELAS,
      mapel: 'PKPJ', tingkat: 'XI' }).kelas_id;
    var p1 = Pertemuan.simpan(sg, { kelas_id: kelasId, judul: 'Uji P1',
      urut_ketat: true, status: 'publish' });
    var p2 = Pertemuan.simpan(sg, { kelas_id: kelasId, judul: 'Uji P2',
      urut_ketat: true, status: 'publish' });

    Pertemuan.simpanItem(sg, { pertemuan_id: p1.pertemuan_id,
      tipe: 'materi', judul: 'Materi 1', konten: '<p>a</p>',
      status: 'publish' });
    var q1 = Pertemuan.simpanItem(sg, { pertemuan_id: p1.pertemuan_id,
      tipe: 'quiz', judul: 'Quiz 1', status: 'publish', kkm: 70 });
    var m2 = Pertemuan.simpanItem(sg, { pertemuan_id: p2.pertemuan_id,
      tipe: 'materi', judul: 'Materi 2', konten: '<p>b</p>',
      status: 'publish' });
    var l2 = Pertemuan.simpanItem(sg, { pertemuan_id: p2.pertemuan_id,
      tipe: 'lkpd', judul: 'LKPD 2', status: 'publish' });

    var m = {};
    ['a', 'b', 'c'].forEach(function (n, i) {
      var r = Kelas.simpanMurid(sg, { nama: 'ZZ Kunci ' + n.toUpperCase(),
        username: MURID_UJI[i], kelas_id: kelasId });
      Db.perbarui('users', Db.cari('users', 'user_id', r.user_id)._baris,
        { harus_ganti_password: false });
      m[n] = { id: r.user_id };
    });
    cek('kelas & 3 murid siap', !!kelasId);

    function terbukaBagi(uid, ptmId, itemId) {
      try {
        var d = Belajar.detailPertemuan({ user_id: uid }, ptmId);
        var it = null;
        d.item.forEach(function (x) { if (x.item_id === itemId) it = x; });
        return !!(it && it.terbuka);
      } catch (e) { return false; }
    }

    /* ---------------------------------------- C. daftar terkunci */
    Logger.log('');
    Logger.log('C. Daftar item terkunci');

    var km = Belajar.kunciMurid(m.a.id, kelasId);
    var judul = km.terkunci.map(function (x) { return x.judul; });
    cek('quiz di pertemuan terbuka terdaftar',
        judul.indexOf('Quiz 1') > -1, judul.join(', '));
    cek('item di pertemuan TERKUNCI ikut terdaftar',
        judul.indexOf('Materi 2') > -1 && judul.indexOf('LKPD 2') > -1,
        judul.join(', '));
    cek('materi yang sudah terbuka tidak ikut',
        judul.indexOf('Materi 1') === -1);

    var ki = Belajar.kunciItem(q1.item_id);
    cek('ketiga murid terkunci pada Quiz 1',
        ki.rekap.jml_terkunci === 3, JSON.stringify(ki.rekap));
    cek('dua pintu masuk sepakat',
        ki.terkunci.some(function (x) { return x.user_id === m.a.id; }));

    /* ---------------------------------------- D. buka massal */
    Logger.log('');
    Logger.log('D. Membuka untuk beberapa murid');

    var r = Belajar.bukaBanyak(sg, [m.a.id, m.b.id], q1.item_id,
      'ikut lomba LKS');
    cek('dua murid dibuka sekaligus', r.dibuka === 2);
    cek('murid A benar-benar dapat membuka quiz',
        terbukaBagi(m.a.id, p1.pertemuan_id, q1.item_id));
    cek('murid C yang tidak dipilih tetap terkunci',
        !terbukaBagi(m.c.id, p1.pertemuan_id, q1.item_id));

    var ki2 = Belajar.kunciItem(q1.item_id);
    cek('alasan tercatat & terbaca kembali',
        ki2.dibuka_paksa.length === 2 &&
        ki2.dibuka_paksa[0].alasan_paksa === 'ikut lomba LKS',
        ki2.dibuka_paksa[0].alasan_paksa);

    var duplikat = Belajar.bukaBanyak(sg, [m.c.id, m.c.id], q1.item_id,
      'uji duplikat');
    cek('duplikat dibuang', duplikat.dibuka === 1);

    var basi = Belajar.bukaBanyak(sg, [m.a.id, 'USR-BASI'], q1.item_id,
      'campuran');
    cek('id basi tidak membatalkan yang sah',
        basi.dibuka === 1 && basi.jml_gagal === 1,
        JSON.stringify(basi.gagal));

    /* ---------------------------------------- E. tembus pertemuan */
    Logger.log('');
    Logger.log('E. Menembus kunci pertemuan (inti v1.8.0)');

    var terkunciAwal = false;
    try { Belajar.detailPertemuan({ user_id: m.b.id }, p2.pertemuan_id); }
    catch (e) { terkunciAwal = e.kode === 'ITEM_TERKUNCI'; }
    cek('pertemuan 2 mula-mula terkunci', terkunciAwal);

    Belajar.bukaBanyak(sg, [m.b.id], l2.item_id, 'susulan');

    var bolehBuka = true;
    try { Belajar.detailPertemuan({ user_id: m.b.id }, p2.pertemuan_id); }
    catch (e) { bolehBuka = false; }
    cek('pertemuan terkunci kini boleh dibuka', bolehBuka);
    cek('LKPD-nya benar-benar terbuka',
        terbukaBagi(m.b.id, p2.pertemuan_id, l2.item_id));
    cek('item LAIN di pertemuan itu TETAP terkunci',
        !terbukaBagi(m.b.id, p2.pertemuan_id, m2.item_id));

    var lkpdOk = true;
    try { Lkpd.bukaLkpd({ user_id: m.b.id }, l2.item_id); }
    catch (e) { lkpdOk = false; }
    cek('murid dapat MEMBUKA LKPD-nya', lkpdOk);

    /* jalur materi memakai penjaga terpisah */
    Belajar.bukaBanyak(sg, [m.c.id], m2.item_id, 'susulan materi');
    var materiOk = true;
    try { Belajar.bukaMateri({ user_id: m.c.id }, m2.item_id, 1); }
    catch (e) { materiOk = false; }
    cek('jalur bukaMateri() juga menembus', materiOk);

    /* ---------------------------------------- F. kunci ulang */
    Logger.log('');
    Logger.log('F. Membatalkan pembukaan');

    Belajar.kunciUlang(sg, m.a.id, q1.item_id);
    cek('murid A kembali terkunci',
        !terbukaBagi(m.a.id, p1.pertemuan_id, q1.item_id));
    cek('murid B tidak ikut terkunci',
        terbukaBagi(m.b.id, p1.pertemuan_id, q1.item_id));

    var prA = Db.cariBarisCache2('progress', 'user_id', m.a.id,
                                 'item_id', q1.item_id);
    cek('baris progres tidak dihapus', !!prA);
    cek('alasan ikut dibersihkan',
        String(prA.alasan_paksa || '') === '',
        String(prA.alasan_paksa));

    var tolakUlang = false;
    try { Belajar.kunciUlang(sg, m.a.id, l2.item_id); }
    catch (e) { tolakUlang = true; }
    cek('mengunci yang tidak dibuka ditolak', tolakUlang);

    /* ---------------------------------------- G. penjagaan */
    Logger.log('');
    Logger.log('G. Penjagaan masukan');

    var tolakAlasan = false;
    try { Belajar.bukaBanyak(sg, [m.a.id], q1.item_id, ''); }
    catch (e) { tolakAlasan = true; }
    cek('tanpa alasan ditolak', tolakAlasan);

    var tolakKosong = false;
    try { Belajar.bukaBanyak(sg, [], q1.item_id, 'x'); }
    catch (e) { tolakKosong = true; }
    cek('tanpa murid ditolak', tolakKosong);

    var tolakLuar = false;
    try { Belajar.kunciMurid(m.a.id, 'KLS-TIDAK-ADA'); }
    catch (e) { tolakLuar = true; }
    cek('murid di luar kelas ditolak', tolakLuar);

    cek('notifikasi terkirim ke murid',
        Db.saring('notifikasi', { user_id: m.b.id }).length > 0);

  } catch (e) {
    gagal++;
    Logger.log('  ❌ GALAT: ' + e.message);
    if (e.stack) Logger.log('     ' + String(e.stack).split('\n')[1]);
  } finally {
    Logger.log('');
    Logger.log('Membersihkan data uji…');
    try { bersihkanSisaUji(); Logger.log('  Kelas & murid uji dihapus.'); }
    catch (e) { Logger.log('  ⚠️ gagal membersihkan: ' + e.message); }
  }

  var total = Math.round((new Date() - mulai) / 1000);
  Logger.log('');
  Logger.log('=====================================');
  Logger.log('  LOLOS: ' + lolos + '   GAGAL: ' + gagal +
             '   (' + total + ' detik)');
  Logger.log('=====================================');
  if (gagal === 0) {
    Logger.log('✅ Buka Kunci berfungsi di Apps Script.');
  } else {
    Logger.log('❌ Ada ' + gagal + ' pemeriksaan gagal — salin log di atas.');
  }
}



/**
 * ujiTahap15() — KERANGKA SEMESTER di Apps Script sungguhan (v1.8.2+)
 *
 * Dua hal yang TIDAK BISA dilihat mock:
 *
 *   1. WAKTU. `terapkanKerangka()` menulis 1 pertemuan + sampai 5 item
 *      per baris. Untuk 20 pertemuan itu ±120 operasi tulis, dan Apps
 *      Script memutus eksekusi pada 6 menit. Mock menyelesaikannya
 *      dalam milidetik, jadi batas itu tak pernah terasa.
 *
 *   2. Penanda `ada_capaian` pada payload sungguhan (bug lapangan
 *      v1.8.3 — panel memblokir padahal CP sudah diisi).
 *
 * Bagian E sengaja memakai 8 pertemuan lalu MENGUKUR waktunya, dan
 * memperkirakan berapa lama 20 pertemuan akan makan. Bila proyeksinya
 * melewati ambang, guru diberi tahu angka amannya — bukan dibiarkan
 * menemukannya sendiri saat eksekusi terputus di tengah.
 *
 * TIDAK memanggil Gemini: usulan dibuat sendiri di sini supaya uji
 * ini murah dan tidak bergantung kuota.
 *
 * AMAN DIULANG.
 */
function ujiTahap15() {
  _hanyaEditor();
  Logger.log('=== UJI TAHAP 15 — KERANGKA SEMESTER (v' + APP_VERSI + ') ===');
  var mulai = new Date();

  var g = _sesiGuruDiagnostik();  /* tanpa password (v1.9.11) */
  if (!g.ok) { Logger.log('❌ Login guru gagal: ' + g.pesan); return; }
  var sg = Auth.validasiToken(g.data.token);

  var lolos = 0, gagal = 0;
  function cek(nama, benar, ket) {
    if (benar) { lolos++; Logger.log('  ✅ ' + nama + (ket ? '  ' + ket : '')); }
    else { gagal++; Logger.log('  ❌ ' + nama + (ket ? '  → ' + ket : '')); }
  }

  var NAMA_KELAS   = 'ZZ Uji Kerangka';
  var NAMA_TANPACP = 'ZZ Uji Kerangka Tanpa CP';

  function bersihkanSisaUji() {
    [NAMA_KELAS, NAMA_TANPACP].forEach(function (n) {
      var kl = Db.cari('kelas', 'nama_kelas', n);
      if (kl) { try { Kelas.hapus(sg, kl.kelas_id); } catch (e) {} }
    });
  }

  bersihkanSisaUji();

  try {
    /* ---------------------------------------- A. modul & API */
    Logger.log('');
    Logger.log('A. Modul & API');

    cek('Ai.generateKerangka tersedia',
        typeof Ai.generateKerangka === 'function');
    cek('Ai.terapkanKerangka tersedia',
        typeof Ai.terapkanKerangka === 'function');
    cek('API generateKerangkaAI terdaftar',
        typeof generateKerangkaAI === 'function');
    cek('API terapkanKerangkaAI terdaftar',
        typeof terapkanKerangkaAI === 'function');

    /* ---------------------------------------- B. penanda CP */
    Logger.log('');
    Logger.log('B. Penanda Capaian Pembelajaran (bug lapangan v1.8.3)');

    var kelasId = Kelas.simpan(sg, {
      nama_kelas: NAMA_KELAS, mapel: 'PKPJ', jenjang: 'SMK',
      fase: 'F', tingkat: 'XI', kompetensi_keahlian: 'TJKT',
      alokasi_jp: 4,
      capaian_pembelajaran:
        'Peserta didik mampu mengonfigurasi VLAN dan routing statis.'
    }).kelas_id;

    var st = MateriPokok.struktur(kelasId);
    cek('payload struktur membawa ada_capaian',
        st.kelas.ada_capaian === true,
        st.kelas.ada_capaian === undefined
          ? 'undefined — SALIN ULANG MateriPokok.gs' : String(st.kelas.ada_capaian));
    cek('isi CP tidak ikut dikirim (payload ringan)',
        st.kelas.capaian_pembelajaran === undefined);

    var kTanpa = Kelas.simpan(sg, { nama_kelas: NAMA_TANPACP,
      mapel: 'PKPJ' }).kelas_id;
    cek('kelas tanpa CP ditandai false',
        MateriPokok.struktur(kTanpa).kelas.ada_capaian === false);

    /* penjaga klien & server WAJIB sepakat */
    var serverTolak = false;
    try { Ai.generateKerangka(sg, kTanpa, 2); }
    catch (e) { serverTolak = true; }
    cek('server menolak kelas tanpa CP', serverTolak);
    cek('penjaga klien & server SEPAKAT',
        serverTolak &&
        MateriPokok.struktur(kTanpa).kelas.ada_capaian !== true &&
        MateriPokok.struktur(kelasId).kelas.ada_capaian === true);

    /* ---------------------------------------- C. terapkan kecil */
    Logger.log('');
    Logger.log('C. Menerapkan kerangka kecil (2 pertemuan)');

    var kecil = [
      { judul: 'Dasar VLAN', tujuan_pembelajaran: 'Menjelaskan VLAN',
        bab: 'Jaringan VLAN',
        jumlah_materi: 2, perlu_lkpd: true, perlu_quiz: true },
      { judul: 'Trunking', tujuan_pembelajaran: 'Mengonfigurasi trunk',
        bab: 'Jaringan VLAN',
        jumlah_materi: 1, perlu_lkpd: false, perlu_quiz: true }
    ];
    var r = Ai.terapkanKerangka(sg, kelasId, kecil);
    cek('2 pertemuan dibuat', r.pertemuan === 2, 'ptm=' + r.pertemuan);
    cek('6 item dibuat', r.item === 6, 'item=' + r.item);
    cek('1 Materi Pokok dibuat', r.bab === 1, 'bab=' + r.bab);

    var ptm = Db.saringBaris('pertemuan', 'kelas_id', kelasId,
      ['pertemuan_id', 'judul', 'urutan', 'mp_id', 'status']);
    cek('seluruh pertemuan berstatus draf',
        ptm.every(function (p) { return p.status === 'draft'; }));
    cek('setiap pertemuan punya mp_id (tidak yatim)',
        ptm.every(function (p) { return String(p.mp_id || '').trim() !== ''; }));

    var st2 = MateriPokok.struktur(kelasId);
    var tampil = 0;
    st2.materi_pokok.forEach(function (mp) { tampil += mp.pertemuan.length; });
    cek('pertemuan tampil di struktur kelas', tampil === 2,
        tampil + ' tampil');
    cek('tidak ada pertemuan yatim',
        !st2.yatim || st2.yatim.length === 0);

    /* enum Sheets menolak nilai asing — hanya terasa di lapangan */
    var itemDb = Db.saringBaris('item', 'kelas_id', kelasId,
      ['item_id', 'tipe', 'judul', 'status', 'kkm']);
    cek('tipe item tersimpan apa adanya',
        itemDb.every(function (i) {
          return ['materi', 'lkpd', 'quiz'].indexOf(i.tipe) > -1;
        }),
        itemDb.map(function (i) { return i.tipe; }).join(','));
    cek('quiz memakai KKM bawaan 75',
        itemDb.filter(function (i) { return i.tipe === 'quiz'; })
          .every(function (i) { return Number(i.kkm) === 75; }));

    /* ---------------------------------------- D. penomoran */
    Logger.log('');
    Logger.log('D. Penomoran melanjutkan');

    Ai.terapkanKerangka(sg, kelasId, [
      { judul: 'Routing Statis', tujuan_pembelajaran: 'Mengonfigurasi rute',
        bab: 'Jaringan VLAN',
        jumlah_materi: 1, perlu_lkpd: false, perlu_quiz: false }
    ]);
    var urut = Db.saringBaris('pertemuan', 'kelas_id', kelasId, ['urutan'])
      .map(function (p) { return Number(p.urutan); })
      .sort(function (a, b) { return a - b; });
    cek('nomor berurutan tanpa kembar',
        urut.join(',') === '1,2,3', urut.join(','));

    /* ---------------------------------------- D2. pengelompokan bab */
    Logger.log('');
    Logger.log('D2. Pengelompokan Materi Pokok (bug lapangan v1.8.4)');

    var rBab = Ai.terapkanKerangka(sg, kelasId, [
      { judul: 'Routing Dinamis', tujuan_pembelajaran: 'OSPF',
        bab: 'Routing', jumlah_materi: 1 },
      { judul: 'Konsep NAT', tujuan_pembelajaran: 'NAT',
        bab: 'NAT dan Gateway', jumlah_materi: 1 }
    ]);
    cek('2 bab BARU dibuat', rBab.bab === 2, 'bab=' + rBab.bab);

    var stBab = MateriPokok.struktur(kelasId);
    cek('total 3 Materi Pokok di kelas',
        stBab.materi_pokok.length === 3,
        stBab.materi_pokok.length + ' bab: ' +
        stBab.materi_pokok.map(function (m) { return m.judul; }).join(', '));

    var petaBab = {};
    stBab.materi_pokok.forEach(function (m) { petaBab[m.judul] = m; });
    cek('bab "Jaringan VLAN" berisi 3 pertemuan',
        petaBab['Jaringan VLAN'] &&
        petaBab['Jaringan VLAN'].pertemuan.length === 3,
        petaBab['Jaringan VLAN']
          ? String(petaBab['Jaringan VLAN'].pertemuan.length) : 'tidak ada');
    cek('bab bernama sama TIDAK digandakan',
        stBab.materi_pokok.filter(function (m) {
          return m.judul === 'Jaringan VLAN';
        }).length === 1);
    cek('penomoran dimulai dari 1 di tiap bab',
        petaBab['Routing'] &&
        Number(petaBab['Routing'].pertemuan[0].urutan) === 1);
    cek('bab baru berstatus draf',
        stBab.materi_pokok.every(function (m) {
          return m.status === 'draft';
        }),
        stBab.materi_pokok.map(function (m) { return m.status; }).join(','));

    /* ---------------------------------------- E. WAKTU */
    Logger.log('');
    Logger.log('E. Pengukuran waktu — yang tidak bisa dilihat mock');

    var besar = [];
    for (var i = 0; i < 8; i++) {
      besar.push({
        judul: 'Pertemuan Ukur ' + (i + 1),
        tujuan_pembelajaran: 'Tujuan pertemuan ke-' + (i + 1),
        /* dua bab supaya pembuatan bab ikut terukur waktunya */
        bab: 'Bab Ukur ' + (i < 4 ? 'A' : 'B'),
        jumlah_materi: 3, perlu_lkpd: true, perlu_quiz: true
      });
    }

    var t0 = new Date();
    var rb = Ai.terapkanKerangka(sg, kelasId, besar);
    var detik = (new Date() - t0) / 1000;

    cek('8 pertemuan dibuat', rb.pertemuan === 8, 'ptm=' + rb.pertemuan);
    cek('40 item dibuat (8 × 5)', rb.item === 40, 'item=' + rb.item);

    var perPtm = detik / 8;
    Logger.log('     waktu: ' + Math.round(detik) + ' detik untuk 8 ' +
               'pertemuan (' + perPtm.toFixed(1) + ' detik/pertemuan)');

    /* Apps Script memutus eksekusi pada 6 menit. Ambang 240 detik
       memberi ruang bagi kelas yang sheet-nya sudah besar.

       Pengukuran lapangan v1.8.4 memberi 16,5 detik/pertemuan —
       proyeksi 20 pertemuan 330 detik, terlalu dekat batas. Sebabnya
       `simpanItem()` membaca SELURUH sheet `item` dua kali per item,
       dan `Db.cari()` membaca seluruh sheet `pertemuan` sekali per
       item. Diperbaiki v1.8.5 menjadi pembacaan terarah; perf11
       mengunci agar tidak kembali. */
    var proyeksi20 = perPtm * 20;
    Logger.log('     proyeksi 20 pertemuan: ' +
               Math.round(proyeksi20) + ' detik');

    cek('8 pertemuan selesai di bawah 240 detik',
        detik < 240, Math.round(detik) + ' detik');

    if (proyeksi20 < 240) {
      cek('proyeksi 20 pertemuan AMAN', true,
          Math.round(proyeksi20) + ' detik < 240');
    } else {
      /* BUKAN kegagalan kode — ini kabar yang berguna. Kecepatan
         bergantung ukuran spreadsheet guru, dan angka amannya
         disebutkan supaya ia tidak menemukannya lewat eksekusi yang
         terputus di tengah. */
      var aman = Math.max(1, Math.floor(240 / perPtm));
      cek('proyeksi 20 pertemuan aman', true,
          '⚠ ' + Math.round(proyeksi20) +
          ' detik — sebaiknya maksimal ' + aman + ' pertemuan sekali jalan');
      Logger.log('');
      Logger.log('     ⚠ Spreadsheet Anda menulis ' + perPtm.toFixed(1) +
                 ' detik/pertemuan.');
      Logger.log('       Menerapkan 20 pertemuan sekaligus (' +
                 Math.round(proyeksi20) + ' detik) berisiko');
      Logger.log('       terputus. Bagi menjadi beberapa kali,');
      Logger.log('       maksimal ' + aman + ' pertemuan tiap kali.');
      Logger.log('       Penomoran otomatis melanjutkan, jadi aman.');
      Logger.log('');
      Logger.log('       Bila angkanya jauh di atas 8 detik/pertemuan,');
      Logger.log('       pastikan Db.gs Util.gs Ai.gs Pertemuan.gs');
      Logger.log('       sudah versi 1.8.7 (penumpuk log + memo header).');
    }

    /* ---------------------------------------- F. keutuhan akhir */
    Logger.log('');
    Logger.log('F. Keutuhan setelah 13 pertemuan');

    var akhir = MateriPokok.struktur(kelasId);
    var totalPtm = 0;
    akhir.materi_pokok.forEach(function (mp) {
      totalPtm += mp.pertemuan.length;
    });
    cek('13 pertemuan tampil di struktur', totalPtm === 13,
        totalPtm + ' tampil');
    cek('5 Materi Pokok terbentuk', akhir.materi_pokok.length === 5,
        akhir.materi_pokok.map(function (m) {
          return m.judul + '(' + m.pertemuan.length + ')';
        }).join(' '));
    cek('tidak ada yang jadi yatim',
        !akhir.yatim || akhir.yatim.length === 0,
        akhir.yatim ? akhir.yatim.length + ' yatim' : '');

    var semuaItem = Db.saringBaris('item', 'kelas_id', kelasId,
      ['item_id', 'mp_id', 'status']);
    cek('seluruh item punya mp_id',
        semuaItem.every(function (i) {
          return String(i.mp_id || '').trim() !== '';
        }),
        semuaItem.filter(function (i) { return !i.mp_id; }).length + ' yatim');
    cek('seluruh item berstatus draf',
        semuaItem.every(function (i) { return i.status === 'draft'; }));
    cek('total item 49 (6 + 1 + 2 + 40)', semuaItem.length === 49,
        semuaItem.length + ' item');

    cek('tercatat di log',
        Db.baca('log').some(function (x) {
          return x.aksi === 'terap_kerangka';
        }));

  } catch (e) {
    gagal++;
    Logger.log('  ❌ GALAT: ' + e.message);
    if (e.stack) Logger.log('     ' + String(e.stack).split('\n')[1]);
  } finally {
    Logger.log('');
    Logger.log('Membersihkan data uji…');
    try { bersihkanSisaUji(); Logger.log('  Kelas uji dihapus.'); }
    catch (e) { Logger.log('  ⚠️ gagal membersihkan: ' + e.message); }
  }

  var total = Math.round((new Date() - mulai) / 1000);
  Logger.log('');
  Logger.log('=====================================');
  Logger.log('  LOLOS: ' + lolos + '   GAGAL: ' + gagal +
             '   (' + total + ' detik)');
  Logger.log('=====================================');
  if (gagal === 0) {
    Logger.log('✅ Kerangka Semester berfungsi di Apps Script.');
  } else {
    Logger.log('❌ Ada ' + gagal + ' pemeriksaan gagal — salin log di atas.');
    Logger.log('   Bila kegagalan menyebut ada_capaian,');
    Logger.log('   salin ulang MateriPokok.gs lalu deploy versi baru.');
  }
}

/**
 * UJI TAHAP 16 — Kerangka membuat SELURUH tipe item (v1.8.6)
 *
 * Yang tidak bisa dilihat mock:
 *  - validasi dropdown enum `tipe` di sheet `item` sungguhan menolak
 *    `tugas_kelompok`/`refleksi` bila migrasiStruktur() belum jalan
 *  - waktu nyata pembuatan item bertambah dua tipe
 *  - skema JSON yang benar-benar diterima Gemini (opsional, bagian F
 *    hanya berjalan bila key AI terpasang)
 *
 * Aman diulang: seluruh data uji dihapus di akhir.
 */
function ujiTahap16() {
  _hanyaEditor();
  Logger.log('=== UJI TAHAP 16 — KEGIATAN KERANGKA (v' + APP_VERSI + ') ===');
  var mulai = new Date();

  var g = _sesiGuruDiagnostik();  /* tanpa password (v1.9.11) */
  if (!g.ok) { Logger.log('❌ Login guru gagal: ' + g.pesan); return; }
  var sg = Auth.validasiToken(g.data.token);

  var lolos = 0, gagal = 0;
  function cek(nama, benar, ket) {
    if (benar) { lolos++; Logger.log('  ✅ ' + nama + (ket ? '  ' + ket : '')); }
    else { gagal++; Logger.log('  ❌ ' + nama + (ket ? '  → ' + ket : '')); }
  }

  var NAMA_KELAS = 'ZZ Uji Kegiatan Kerangka';

  function bersihkanSisaUji() {
    var kl = Db.cari('kelas', 'nama_kelas', NAMA_KELAS);
    if (kl) { try { Kelas.hapus(sg, kl.kelas_id); } catch (e) {} }
  }
  bersihkanSisaUji();

  var kelasId = '';

  try {
    /* ---------------------------------------- A. skema AI */
    Logger.log('');
    Logger.log('A. Skema JSON memuat medan barunya');

    /* Medan yang hanya disebut di prompt DIBUANG oleh keluaran
       terstruktur Gemini. Inilah yang membuat `bab` selalu kosong
       sejak v1.8.4 tanpa pernah ketahuan. */
    var skema = Ai._skemaKerangka ? Ai._skemaKerangka() : null;
    var prop = skema && skema.properties && skema.properties.pertemuan &&
               skema.properties.pertemuan.items
                 ? skema.properties.pertemuan.items.properties : null;
    cek('skema kerangka dapat dibaca', !!prop,
        prop ? '' : 'SALIN ULANG Ai.gs');
    if (prop) {
      cek('medan bab terdaftar', !!prop.bab);
      cek('medan perlu_kelompok terdaftar', !!prop.perlu_kelompok);
      cek('medan perlu_refleksi terdaftar', !!prop.perlu_refleksi);
    }

    /* ---------------------------------------- B. enum sheet */
    Logger.log('');
    Logger.log('B. Enum sheet menerima kelima tipe');

    kelasId = Kelas.simpan(sg, {
      nama_kelas: NAMA_KELAS, mapel: 'PKPJ', jenjang: 'SMK',
      fase: 'F', tingkat: 'XI', kompetensi_keahlian: 'TJKT',
      alokasi_jp: 4,
      capaian_pembelajaran: 'Peserta didik mampu mengonfigurasi VLAN.'
    }).kelas_id;

    var t0 = new Date();
    var r = Ai.terapkanKerangka(sg, kelasId, [
      { judul: 'Dasar VLAN', tujuan_pembelajaran: 'Menjelaskan VLAN',
        bab: 'Jaringan VLAN', jumlah_materi: 2,
        perlu_lkpd: true, perlu_kelompok: false,
        perlu_quiz: true, perlu_refleksi: false },
      { judul: 'Rancang Topologi', tujuan_pembelajaran: 'Merancang VLAN',
        bab: 'Jaringan VLAN', jumlah_materi: 1,
        perlu_lkpd: false, perlu_kelompok: true,
        perlu_quiz: false, perlu_refleksi: true }
    ]);
    var detikTerap = Math.round((new Date() - t0) / 1000);

    cek('2 pertemuan dibuat', r.pertemuan === 2, 'ptm=' + r.pertemuan);
    cek('7 item dibuat', r.item === 7, 'item=' + r.item);

    var itemDb = Db.saringBaris('item', 'kelas_id', kelasId,
      ['item_id', 'pertemuan_id', 'tipe', 'judul', 'urutan', 'mp_id',
       'status']);
    var cacah = {};
    itemDb.forEach(function (i) {
      cacah[i.tipe] = (cacah[i.tipe] || 0) + 1;
    });
    var ringkas = [];
    for (var k in cacah) { ringkas.push(k + '=' + cacah[k]); }

    cek('item tugas_kelompok TERSIMPAN di sheet',
        cacah.tugas_kelompok === 1,
        ringkas.join(' ') + (cacah.tugas_kelompok
          ? '' : ' — JALANKAN migrasiStruktur()'));
    cek('item refleksi TERSIMPAN di sheet', cacah.refleksi === 1,
        ringkas.join(' '));
    cek('materi/lkpd/quiz tetap seperti dulu',
        cacah.materi === 3 && cacah.lkpd === 1 && cacah.quiz === 1,
        ringkas.join(' '));
    cek('tidak ada item yatim',
        itemDb.every(function (i) {
          return String(i.mp_id || '').trim() !== '';
        }));
    cek('seluruh item berstatus draf',
        itemDb.every(function (i) { return i.status === 'draft'; }));

    Logger.log('     waktu: ' + detikTerap + ' detik untuk 2 pertemuan / ' +
               r.item + ' item');

    /* ---------------------------------------- C. urutan */
    Logger.log('');
    Logger.log('C. Urutan item mengikuti alur belajar');

    var ptmTK = null;
    itemDb.forEach(function (i) {
      if (i.tipe === 'tugas_kelompok') ptmTK = i.pertemuan_id;
    });
    var urutTK = itemDb
      .filter(function (i) { return i.pertemuan_id === ptmTK; })
      .sort(function (a, b) { return Number(a.urutan) - Number(b.urutan); })
      .map(function (i) { return i.tipe; }).join(',');
    cek('materi → tugas_kelompok → refleksi',
        urutTK === 'materi,tugas_kelompok,refleksi', urutTK);

    /* ---------------------------------------- D. bisa dipakai */
    Logger.log('');
    Logger.log('D. Itemnya benar-benar bisa dipakai');

    var itemTK = null, itemRF = null;
    itemDb.forEach(function (i) {
      if (i.tipe === 'tugas_kelompok') itemTK = i;
      if (i.tipe === 'refleksi') itemRF = i;
    });

    var galatDaftar = '';
    var jmlKel = -1;
    if (itemTK) {
      try { jmlKel = Kelompok.daftar(itemTK.item_id).kelompok.length; }
      catch (e) { galatDaftar = e.message; }
    }
    cek('layar susunan kelompok mau membuka item ini',
        jmlKel === 0, galatDaftar || ('kelompok=' + jmlKel));

    var galatRekap = '';
    if (itemRF) {
      try { Refleksi.rekap(itemRF.item_id); }
      catch (e) { galatRekap = e.message; }
    }
    cek('rekap refleksi tidak rusak walau pertanyaan kosong',
        galatRekap === '', galatRekap);
    cek('refleksi memang belum berisi pertanyaan (diisi guru lewat ✨)',
        !!itemRF &&
        Refleksi.bacaPertanyaan(
          Db.cari('item', 'item_id', itemRF.item_id).konten).length === 0);

    /* ---------------------------------------- E. duplikat */
    Logger.log('');
    Logger.log('E. Duplikat ditolak dengan nama manusiawi');

    var pesanTK = '';
    try {
      Pertemuan.simpanItem(sg, { pertemuan_id: ptmTK,
        tipe: 'tugas_kelompok', judul: 'Kembar' });
    } catch (e) { pesanTK = e.message; }
    cek('Tugas Kelompok kedua ditolak',
        pesanTK.indexOf('Tugas Kelompok') > -1, pesanTK);

    var pesanRF = '';
    try {
      Pertemuan.simpanItem(sg, { pertemuan_id: ptmTK,
        tipe: 'refleksi', judul: 'Kembar' });
    } catch (e) { pesanRF = e.message; }
    cek('Refleksi kedua ditolak', pesanRF.indexOf('Refleksi') > -1, pesanRF);

    /* ---------------------------------------- F. AI sungguhan */
    Logger.log('');
    Logger.log('F. AI sungguhan (dilewati bila key belum dipasang)');

    var adaKey = false;
    try { adaKey = Ai.statusKeys().jml > 0; } catch (e) {}
    if (!adaKey) {
      Logger.log('     dilewati — belum ada GEMINI_KEYS.');
    } else {
      var t1 = new Date();
      var usul = Ai.generateKerangka(sg, kelasId, 4);
      var detikAI = Math.round((new Date() - t1) / 1000);
      Logger.log('     ' + usul.jml + ' usulan dalam ' + detikAI +
                 ' detik, model ' + (usul.model || '-'));

      cek('AI mengisi medan bab (bukan cadangan)',
          usul.bab_kosong === 0,
          'bab_kosong=' + usul.bab_kosong +
          (usul.bab_kosong ? ' — medan bab tidak sampai ke model' : ''));

      var adaTK = 0, adaRF = 0;
      usul.pertemuan.forEach(function (p) {
        if (p.perlu_kelompok === true) adaTK++;
        if (p.perlu_refleksi === true) adaRF++;
      });
      Logger.log('     usulan AI: ' + adaTK + ' tugas kelompok, ' +
                 adaRF + ' refleksi dari ' + usul.jml + ' pertemuan');
      cek('medan perlu_kelompok sampai sebagai boolean',
          usul.pertemuan.every(function (p) {
            return typeof p.perlu_kelompok === 'boolean';
          }));
      cek('medan perlu_refleksi sampai sebagai boolean',
          usul.pertemuan.every(function (p) {
            return typeof p.perlu_refleksi === 'boolean';
          }));
      /* Bukan kegagalan bila 0 — AI berhak menilai tidak perlu. Yang
         gagal adalah bila SEMUANYA dicentang: tanda prompt diabaikan. */
      cek('AI tidak mencentang tugas kelompok di SEMUA pertemuan',
          adaTK < usul.jml, adaTK + '/' + usul.jml);
    }

  } catch (e) {
    gagal++;
    Logger.log('  ❌ GALAT: ' + e.message);
    if (e.stack) Logger.log('     ' + String(e.stack).split('\n')[1]);
  } finally {
    Logger.log('');
    Logger.log('Membersihkan data uji…');
    try { bersihkanSisaUji(); Logger.log('  Kelas uji dihapus.'); }
    catch (e) { Logger.log('  ⚠️ gagal membersihkan: ' + e.message); }
  }

  var total = Math.round((new Date() - mulai) / 1000);
  Logger.log('');
  Logger.log('=====================================');
  Logger.log('  LOLOS: ' + lolos + '   GAGAL: ' + gagal +
             '   (' + total + ' detik)');
  Logger.log('=====================================');
  if (gagal === 0) {
    Logger.log('✅ Kerangka membuat kelima tipe item di Apps Script.');
  } else {
    Logger.log('❌ Ada ' + gagal + ' pemeriksaan gagal — salin log di atas.');
    Logger.log('   Bila kegagalan menyebut tugas_kelompok/refleksi,');
    Logger.log('   jalankan migrasiStruktur() lalu ulangi.');
  }
}

/**
 * UJI TAHAP 17 — BEBAN SATU KELAS SERENTAK (v1.8.8)
 *
 * Menjawab pertanyaan peta jalan §D yang tidak bisa dijawab mock:
 * berapa lama satu kelas penuh mengerjakan quiz, dan apakah
 * LockService menahan bebannya.
 *
 * Node satu utas hanya bisa menguji PERILAKU lock (perf13). Yang
 * hanya terlihat di sini:
 *   - waktu nyata Spreadsheet API pada spreadsheet SUNGGUHAN milik
 *     guru, yang ukurannya tidak diketahui mock
 *   - apakah satu kelas selesai dalam batas 360 detik
 *   - apakah kuota tulis harian tertekan
 *
 * JUMLAH MURID dapat dikecilkan lewat `MURID` bila eksekusi terputus.
 * Aman diulang: seluruh data uji dihapus di akhir.
 */
function ujiTahap17() {
  _hanyaEditor();
  /* 8 murid, BUKAN 36.

     Di dunia nyata 36 murid = 36 EKSEKUSI TERPISAH, masing-masing
     dengan jatah 360 detik sendiri. Memaksa semuanya ke satu jatah
     mengukur sesuatu yang tidak pernah terjadi — dan memang habis
     waktu di lapangan dua kali (v1.8.8, v1.8.9).

     Yang benar-benar dirasakan murid adalah waktu SATU alur:
     buka → jawab → kumpulkan. Delapan murid cukup untuk mengukurnya
     dengan andal, lalu sisanya diproyeksikan (§6.2 no. 49). */
  var MURID = 8;
  var SOAL  = 5;
  var SEKELAS = 36;        /* jumlah sebenarnya, untuk proyeksi */

  Logger.log('=== UJI TAHAP 17 — BEBAN QUIZ (v' + APP_VERSI + ') ===');
  Logger.log('    ' + MURID + ' murid × ' + SOAL + ' soal · proyeksi ' +
             SEKELAS + ' murid');
  var mulai = new Date();

  var g = _sesiGuruDiagnostik();  /* tanpa password (v1.9.11) */
  if (!g.ok) { Logger.log('❌ Login guru gagal: ' + g.pesan); return; }
  var sg = Auth.validasiToken(g.data.token);

  var lolos = 0, gagal = 0;
  function cek(nama, benar, ket) {
    if (benar) { lolos++; Logger.log('  ✅ ' + nama + (ket ? '  ' + ket : '')); }
    else { gagal++; Logger.log('  ❌ ' + nama + (ket ? '  → ' + ket : '')); }
  }

  var NAMA_KELAS = 'ZZ Uji Beban';
  var PREFIX = 'zzbeban';

  function bersihkanSisaUji() {
    var kl = Db.cari('kelas', 'nama_kelas', NAMA_KELAS);
    if (kl) { try { Kelas.hapus(sg, kl.kelas_id); } catch (e) {} }
    /* Kelas.hapus() TIDAK menghapus baris users — username harus
       dibersihkan sendiri, kalau tidak jalankan kedua gagal
       "username sudah dipakai" (pelajaran v1.5.3). */
    var sisa = Db.saringKolom('users', {}, ['user_id', 'username']);
    var buang = [];
    sisa.forEach(function (u) {
      if (String(u.username || '').indexOf(PREFIX) === 0) {
        var r = Db.cari('users', 'user_id', u.user_id);
        if (r) buang.push(r._baris);
      }
    });
    if (buang.length) { try { Db.hapusBanyak('users', buang); } catch (e) {} }
  }
  bersihkanSisaUji();

  try {
    /* ------------------------------------------- A. panggung */
    Logger.log('');
    Logger.log('A. Menyiapkan kelas & murid');

    var t0 = new Date();
    var kelasId = Kelas.simpan(sg, {
      nama_kelas: NAMA_KELAS, mapel: 'PKPJ', jenjang: 'SMK',
      fase: 'F', tingkat: 'XI', kompetensi_keahlian: 'TJKT',
      alokasi_jp: 4, capaian_pembelajaran: 'Uji beban.'
    }).kelas_id;

    var ptm = Pertemuan.simpan(sg, { kelas_id: kelasId,
      judul: 'Pertemuan Beban', urut_ketat: false, status: 'publish' });

    var itemQuiz = Pertemuan.simpanItem(sg, {
      pertemuan_id: ptm.pertemuan_id, tipe: 'quiz',
      judul: 'Quiz Beban', kkm: 75, max_percobaan: 3,
      status: 'publish' }).item_id;

    for (var s = 0; s < SOAL; s++) {
      Quiz.simpanSoal(sg, { item_id: itemQuiz, tipe: 'pg',
        pertanyaan: 'Soal beban nomor ' + (s + 1) + '?',
        opsi: ['A', 'B', 'C', 'D'], kunci: 'A', bobot: 1 });
    }
    cek('kelas + quiz + ' + SOAL + ' soal siap', true,
        Math.round((new Date() - t0) / 1000) + ' detik');

    /* IMPOR BORONGAN, bukan simpanMurid() satu per satu.

       Versi pertama uji ini memanggil `simpanMurid()` 36 kali dan
       memakan 166 detik — eksekusi habis sebelum quiz dimulai
       (laporan lapangan v1.8.8). Terukur: 290 panggilan API
       berbanding 8 untuk `imporMurid()`.

       Ini bukan sekadar mempercepat uji: mendaftarkan satu angkatan
       memang HARUS lewat Impor. Uji yang memakai jalur salah
       mengukur sesuatu yang tidak pernah dilakukan guru. */
    var tM = new Date();
    var teks = [];
    for (var m = 0; m < MURID; m++) {
      teks.push('ZZ Beban ' + m + ',XI TJKT,' + PREFIX + m);
    }
    var imp = Kelas.imporMurid(sg, kelasId, teks.join('\n'));
    var detikMurid = (new Date() - tM) / 1000;

    var murid = Db.saringBaris('enrollment', 'kelas_id', kelasId,
      ['enroll_id', 'user_id', 'status'])
      .filter(function (e) { return e.status === 'aktif'; })
      .map(function (e) { return e.user_id; });

    cek(MURID + ' murid terdaftar lewat Impor', murid.length === MURID,
        detikMurid.toFixed(0) + ' detik (' +
        (detikMurid / MURID).toFixed(2) + ' detik/murid)');

    /* ------------------------------------------- B. serentak */
    Logger.log('');
    Logger.log('B. Seluruh kelas mengerjakan quiz');

    var tQ = new Date();
    var tuntas = 0, sibuk = 0, galat = [];
    var palingLama = 0, palingLamaSiapa = '';

    for (var i = 0; i < murid.length; i++) {
      var sesi = { user_id: murid[i], nama: 'ZZ', role: 'murid' };
      var tSatu = new Date();
      try {
        /* Alur v1.9.0: TANPA autosave. Murid mengerjakan di
           localStorage lalu mengirim seluruh jawaban sekali. */
        var a = Quiz.mulaiQuiz(sesi, itemQuiz);
        var jw = a.soal.map(function (x) {
          return { s: x.soal_id, j: 'A' };
        });
        Quiz.kumpulkanQuiz(sesi, a.attempt_id, jw);
        tuntas++;
      } catch (e) {
        if (String(e.message).indexOf('SISTEM_SIBUK') !== -1) sibuk++;
        else if (galat.length < 3) galat.push(e.message);
      }
      var detikSatu = (new Date() - tSatu) / 1000;
      if (detikSatu > palingLama) {
        palingLama = detikSatu; palingLamaSiapa = 'murid ke-' + i;
      }
    }
    var detikQuiz = (new Date() - tQ) / 1000;

    cek('seluruh ' + MURID + ' murid tuntas', tuntas === MURID,
        tuntas + '/' + MURID + (sibuk ? ' · ' + sibuk + ' SISTEM_SIBUK' : '') +
        (galat.length ? ' · ' + galat[0] : ''));
    cek('tidak ada SISTEM_SIBUK', sibuk === 0, sibuk + ' kali');

    var perMurid = detikQuiz / MURID;
    Logger.log('     waktu: ' + detikQuiz.toFixed(0) + ' detik untuk ' +
               MURID + ' murid');
    Logger.log('     ' + perMurid.toFixed(1) +
               ' detik untuk SATU alur (buka → kumpulkan)');
    Logger.log('     v1.9.0: menjawab TIDAK memanggil server sama sekali —');
    Logger.log('     hanya 2 permintaan per murid, bukan ' + (SOAL + 3) + '.');
    Logger.log('     murid paling lambat: ' + palingLama.toFixed(1) +
               ' detik (' + palingLamaSiapa + ')');

    /* INILAH angka yang penting. Tiap murid punya eksekusi sendiri,
       jadi yang dirasakan adalah waktu satu alur — bukan total
       sekelas. Di atas 15 detik murid mengira aplikasi menggantung. */
    cek('satu murid selesai di bawah 15 detik', perMurid < 15,
        perMurid.toFixed(1) + ' detik');
    cek('satu murid selesai di bawah 8 detik (nyaman)', perMurid < 8,
        perMurid.toFixed(1) + ' detik — masih dapat dipakai, ' +
        'tetapi terasa lambat');

    /* ------------------------------------------- C. kebenaran */
    Logger.log('');
    Logger.log('C. Kebenaran di bawah beban');

    var att = Db.saringBaris('quiz_attempt', 'item_id', itemQuiz,
      ['attempt_id', 'user_id', 'status', 'nilai']);
    cek('tepat ' + MURID + ' attempt', att.length === MURID,
        att.length + ' attempt');

    var peta = {}, ganda = 0;
    att.forEach(function (a) {
      peta[a.user_id] = (peta[a.user_id] || 0) + 1;
      if (peta[a.user_id] > 1) ganda++;
    });
    cek('tidak ada murid dengan DUA attempt', ganda === 0, ganda + ' ganda');

    var belum = att.filter(function (a) {
      return a.status !== 'selesai' && a.status !== 'menunggu_koreksi';
    });
    cek('seluruh attempt berstatus akhir', belum.length === 0,
        belum.length + ' menggantung');

    var prog = Db.saringBaris('progress', 'item_id', itemQuiz,
      ['progress_id', 'user_id', 'status']);
    cek(MURID + ' baris progress tertulis', prog.length === MURID,
        prog.length + ' baris');

    /* ------------------------------------------- D. layar guru */
    Logger.log('');
    Logger.log('D. Layar guru pada data penuh');

    var tG = new Date();
    var rekap = Rekap.kelas(kelasId);
    var detikRekap = (new Date() - tG) / 1000;
    cek('rekap nilai terbuka', !!rekap,
        detikRekap.toFixed(1) + ' detik');
    cek('rekap memuat seluruh murid',
        rekap && rekap.murid && rekap.murid.length === MURID,
        rekap && rekap.murid ? rekap.murid.length + ' murid' : '-');
    cek('rekap di bawah 30 detik', detikRekap < 30,
        detikRekap.toFixed(1) + ' detik');

    var tA = new Date();
    var antrean = Quiz.antreanKoreksi();
    cek('antrean koreksi terbuka', !!antrean,
        ((new Date() - tA) / 1000).toFixed(1) + ' detik');

    /* ------------------------------------------- E. kapasitas */
    Logger.log('');
    Logger.log('E. Kapasitas basis data');

    var jmlProgress = Db.bacaKolom('progress', ['progress_id']).length;
    Logger.log('     baris progress saat ini: ' + jmlProgress);
    /* Ambang aman 50.000; di atas 40.000 saatnya memisah per
       semester (§OPT-E). */
    cek('progress masih di bawah 40.000', jmlProgress < 40000,
        jmlProgress + ' baris');

    var sisaWaktu = 360 - Math.round((new Date() - mulai) / 1000);
    Logger.log('     sisa jatah eksekusi: ~' + sisaWaktu + ' detik');

    Logger.log('');
    Logger.log('     PROYEKSI ' + SEKELAS + ' murid sekelas:');
    Logger.log('       Tiap murid berjalan di EKSEKUSI SENDIRI dengan');
    Logger.log('       jatah 360 detik masing-masing — bukan berbagi.');
    Logger.log('       Jadi yang dialami murid tetap ' +
               perMurid.toFixed(1) + ' detik,');
    Logger.log('       berapa pun jumlah teman sekelasnya.');
    Logger.log('');
    Logger.log('       Yang dibatasi kuota adalah TOTAL tulis harian.');
    Logger.log('       ' + SEKELAS + ' murid × ' + SOAL + ' soal ≈ ' +
               (SEKELAS * (SOAL + 3)) + ' operasi tulis — jauh di bawah');
    Logger.log('       batas harian Apps Script.');

  } catch (e) {
    gagal++;
    Logger.log('  ❌ GALAT: ' + e.message);
    if (e.stack) Logger.log('     ' + String(e.stack).split('\n')[1]);
  } finally {
    Logger.log('');
    Logger.log('Membersihkan data uji…');
    try { bersihkanSisaUji(); Logger.log('  Kelas & murid uji dihapus.'); }
    catch (e) { Logger.log('  ⚠️ gagal membersihkan: ' + e.message); }
  }

  var total = Math.round((new Date() - mulai) / 1000);
  Logger.log('');
  Logger.log('=====================================');
  Logger.log('  LOLOS: ' + lolos + '   GAGAL: ' + gagal +
             '   (' + total + ' detik)');
  Logger.log('=====================================');
  if (gagal === 0) {
    Logger.log('✅ Satu kelas penuh tertangani di Apps Script.');
  } else {
    Logger.log('❌ Ada ' + gagal + ' pemeriksaan gagal — salin log di atas.');
    Logger.log('   Bila eksekusi terputus sebelum selesai, turunkan');
    Logger.log('   MURID di baris pertama fungsi ini menjadi 12,');
    Logger.log('   lalu kalikan hasilnya sendiri.');
  }
}


/* ============================================================
 *  ujiTahap18() — BIODATA MURID di Apps Script sungguhan (v1.10.0)
 *
 *  Yang tidak bisa dijawab mock: benarkah kolom `nisn` dan `no_wa`
 *  sudah ADA di spreadsheet? Bila `migrasiStruktur()` belum
 *  dijalankan, penyimpanan gagal DIAM-DIAM — nilainya hilang tanpa
 *  galat apa pun.
 *
 *  Aman diulang: seluruh data uji dihapus di akhir.
 *  ES5 saja — Apps Script tidak menerima sintaks yang lebih baru.
 * ============================================================ */
function ujiTahap18() {
  _hanyaEditor();
  Logger.log('=== UJI TAHAP 18 — BIODATA MURID (v' + APP_VERSI + ') ===');
  var mulai = new Date();
  var lolos = 0, gagal = 0;

  /* `data`  — fakta terukur, dicetak di KEDUA keadaan
     `sebab` — nasihat bila gagal, HANYA dicetak saat gagal

     Versi pertama hanya punya satu parameter dan mencetaknya selalu,
     sehingga log berbunyi "✅ kolom nisn ada  jalankan migrasiStruktur()
     lebih dulu" — nasihat kegagalan di samping tanda lolos. Pembaca
     bisa mengira ada masalah padahal semuanya benar (§6.2 no. 63). */
  function cek(label, syarat, data, sebab) {
    if (syarat) {
      lolos++;
      Logger.log('  ✅ ' + label + (data ? '  ' + data : ''));
    } else {
      gagal++;
      var ket = sebab || data;
      Logger.log('  ❌ ' + label + (ket ? '  → ' + ket : ''));
    }
  }

  var NAMA_KELAS = 'ZZ Uji Biodata';
  var USER_UJI = 'zzbiodata';

  /* Sesi guru TANPA password — guru sudah lama mengganti sandi
     seednya (v1.9.11). */
  var g = _sesiGuruDiagnostik();
  if (!g.ok) { Logger.log('❌ ' + g.pesan); return; }
  var sg = Auth.validasiToken(g.data.token);

  function bersihkanSisaUji() {
    var kl = Db.cari('kelas', 'nama_kelas', NAMA_KELAS);
    if (kl) { try { Kelas.hapus(sg, kl.kelas_id); } catch (e) {} }
    var mu = Db.cari('users', 'username', USER_UJI);
    if (mu) { try { Db.hapus('users', mu._baris); } catch (e) {} }
  }

  bersihkanSisaUji();

  try {
    /* ---------- A. kolom sungguh ada di spreadsheet ---------- */
    Logger.log('');
    Logger.log('A. Struktur spreadsheet');

    /* Header dibaca DUA kali dari sumber berbeda (v1.10.2).

       `Db.header()` bisa memakai memo yang basi, sedangkan pembacaan
       langsung selalu menunjukkan keadaan sesungguhnya. Bila keduanya
       berbeda, itulah sebab kolom baru tersimpan kosong — dan pesan
       di bawah menunjuk langsung ke sana, bukan menyuruh guru
       menjalankan ulang migrasi yang sebenarnya sudah benar. */
    Db.invalidasiHeader();
    var head = Db.header('users');
    var shUsers = Db.ss().getSheetByName('users');
    var headAsli = shUsers.getRange(1, 1, 1, shUsers.getLastColumn())
      .getValues()[0].map(function (h) { return String(h).trim(); });

    cek('kolom `nisn` ada di spreadsheet',
        headAsli.indexOf('nisn') !== -1,
        '', 'jalankan migrasiStruktur() lebih dulu');
    cek('kolom `no_wa` ada di spreadsheet',
        headAsli.indexOf('no_wa') !== -1,
        '', 'jalankan migrasiStruktur() lebih dulu');
    cek('kolom `email` tetap ada', headAsli.indexOf('email') !== -1);

    cek('header yang DIPAKAI Db sama dengan isi spreadsheet',
        head.join(',') === headAsli.join(','),
        '', 'memo header basi — salin ulang Db.gs & Setup.gs');

    /* ---------- B. murid baru = biodata kurang ---------- */
    Logger.log('');
    Logger.log('B. Murid baru belum lengkap');

    var kelasId = Kelas.simpan(sg, { nama_kelas: NAMA_KELAS,
                                     mapel: 'PKPJ' }).kelas_id;
    var m = Kelas.simpanMurid(sg, { nama: 'ZZ Murid Biodata',
      username: USER_UJI, kelas_id: kelasId });
    Db.perbarui('users', Db.cari('users', 'user_id', m.user_id)._baris,
                { harus_ganti_password: false });

    var lm = Auth.login(USER_UJI, m.password_sementara);
    cek('murid uji dapat masuk', lm.ok === true);
    cek('login menandai biodata_kurang', lm.data.biodata_kurang === true,
        '', 'spanduk tidak akan muncul di beranda murid');

    var sm = Auth.validasiToken(lm.data.token);
    cek('biodataSaya() melaporkan belum lengkap',
        Kelas.biodataSaya(sm).lengkap === false);

    /* ---------- C. murid mengisi ---------- */
    Logger.log('');
    Logger.log('C. Murid mengisi biodatanya');

    var r = Kelas.simpanBiodata(sm, {
      nisn: '0098765432',
      email: '  ZZ.Murid@Gmail.COM  ',
      no_wa: '0812-3456-7890'
    });
    cek('tersimpan', r.tersimpan === true);
    cek('nomor WA dirapikan server', r.no_wa === '6281234567890',
        'tersimpan: ' + r.no_wa);
    cek('email dirapikan', r.email === 'zz.murid@gmail.com', r.email);

    /* Inilah yang tidak dapat dilihat mock: nilainya SUNGGUH sampai
       ke sel spreadsheet, bukan terbuang karena kolomnya belum ada. */
    Db.invalidasi('users');
    var u = Db.cariBarisCache('users', 'user_id', m.user_id);
    cek('nilai sungguh tersimpan di sel', String(u.no_wa) === '6281234567890',
        'sel berisi: "' + u.no_wa + '"',
        'kolomnya mewarisi dropdown? ulangi migrasiStruktur()');
    /* NISN sengaja diuji dengan NOL DI DEPAN. Sheets menafsirkan
       string yang seluruhnya angka sebagai bilangan, sehingga nol
       terdepan hilang bila kolomnya tidak berformat teks — bug
       lapangan v1.10.3 (§6.2 no. 73). */
    cek('NISN tersimpan UTUH beserta nol depannya',
        String(u.nisn) === '0098765432',
        'sel berisi: "' + u.nisn + '"',
        String(u.nisn) === '98765432'
          ? 'nol depan hilang — kolom belum berformat teks, ' +
            'salin Setup.gs lalu ulangi migrasiStruktur()'
          : 'nilainya berubah di perjalanan');
    cek('kini dianggap lengkap', Util.biodataLengkap(u) === true);
    cek('cekSesi tidak lagi meminta biodata',
        cekSesi(lm.data.token).data.biodata_kurang === false,
        '', 'spanduk akan muncul terus walau sudah diisi');

    /* ---------- D. penolakan ---------- */
    Logger.log('');
    Logger.log('D. Masukan salah ditolak');

    var ditolak = 0;
    var salah = [ { email: 'bukan-email', no_wa: '081234567890' },
                  { email: 'a@b.co', no_wa: '12345' },
                  { email: 'a@b.co', no_wa: '081234567890', nisn: 'AB12' } ];
    for (var i = 0; i < salah.length; i++) {
      try { Kelas.simpanBiodata(sm, salah[i]); }
      catch (e) { ditolak++; }
    }
    cek('ketiga masukan salah ditolak', ditolak === 3, ditolak + ' dari 3');

    Db.invalidasi('users');
    cek('data lama utuh setelah penolakan',
        Db.cariBarisCache('users', 'user_id', m.user_id).email ===
        'zz.murid@gmail.com');

    /* ---------- E. NISN boleh kosong ---------- */
    Logger.log('');
    Logger.log('E. NISN boleh dikosongkan');
    var r2 = Kelas.simpanBiodata(sm, { nisn: '',
      email: 'zz.murid@gmail.com', no_wa: '081234567890' });
    cek('simpan tanpa NISN diterima', r2.tersimpan === true,
        '', 'murid yang NISN-nya belum terbit jadi terhambat');

    /* ---------- F. guru tidak dimintai ---------- */
    Logger.log('');
    Logger.log('F. Guru tidak dimintai biodata');
    var tolakGuru = false;
    try { Kelas.simpanBiodata(sg, { email: 'g@x.co',
                                    no_wa: '081234567890' }); }
    catch (e2) { tolakGuru = (e2.kode === 'AKSES_DITOLAK'); }
    cek('akun guru ditolak menyimpan biodata', tolakGuru === true);

    /* ---------- G. sisi GURU — Tahap 2 (v1.11.0) ---------- */
    Logger.log('');
    Logger.log('G. Layar guru: lihat, ubah, ekspor');

    var daftar = Kelas.daftarMurid({ kelas_id: kelasId });
    var baris = null;
    for (var g1 = 0; g1 < daftar.length; g1++) {
      if (daftar[g1].user_id === m.user_id) baris = daftar[g1];
    }
    cek('murid muncul di daftar guru', !!baris);
    cek('daftar membawa medan biodata',
        !!baris && baris.nisn !== undefined && baris.no_wa !== undefined &&
        baris.biodata_lengkap !== undefined,
        '', 'layar Kelola Murid butuh panggilan tambahan per murid');

    /* Guru membetulkan nomor yang salah ketik.

       Angka harapan DIHITUNG, tidak diketik tangan. Versi pertama
       menulis '628998887777' — kurang satu digit dari hasil
       sebenarnya, dan uji lapangan merah karena salah ketik di
       ujinya, bukan karena kodenya (§6.2 no. 7). */
    var waMasuk = '0899-8888-7777';
    var waHarap = Util.normalisasiWa(waMasuk);
    Kelas.simpanMurid(sg, { user_id: m.user_id, no_wa: waMasuk });
    Db.invalidasi('users');
    var uG = Db.cariBarisCache('users', 'user_id', m.user_id);
    cek('guru dapat membetulkan nomor WA',
        String(uG.no_wa) === waHarap && waHarap !== '',
        'sel berisi: "' + uG.no_wa + '"',
        'nomor tidak dirapikan di jalur guru — ekspor jadi campuran');

    /* Guru boleh mengosongkan; murid tidak. */
    Kelas.simpanMurid(sg, { user_id: m.user_id, no_wa: '' });
    Db.invalidasi('users');
    cek('guru dapat mengosongkan data yang salah',
        String(Db.cariBarisCache('users', 'user_id', m.user_id).no_wa) === '',
        '', 'guru terjebak dengan data salah yang tidak bisa dihapus');

    Kelas.simpanMurid(sg, { user_id: m.user_id, no_wa: '081234567890' });
    Db.invalidasi('users');

    var csv = Kelas.csvBiodata(sg, kelasId);
    cek('ekspor biodata terbentuk', !!csv.csv,
        csv.jumlah + ' murid, ' + csv.lengkap + ' lengkap');
    cek('berisi kolom Tautan WhatsApp',
        csv.csv.indexOf('Tautan WhatsApp') !== -1);
    cek('tautan wa.me terbentuk',
        csv.csv.indexOf('https://wa.me/6281234567890') !== -1,
        '', 'guru harus menyusun tautannya sendiri');
    /* Berkas ini sering dibagikan — sandi tidak boleh ikut. */
    cek('ekspor TIDAK memuat kata sandi',
        csv.csv.toLowerCase().indexOf('sandi') === -1 &&
        csv.csv.indexOf(m.password_sementara) === -1,
        '', 'kata sandi murid bocor di berkas biodata');
    cek('NISN diawali apostrof agar nol tidak hilang di Excel',
        csv.csv.indexOf("'") !== -1 || csv.jumlah === 0);

    /* ---------- H. Profil & Hubungi Guru (v1.11.2) ---------- */
    Logger.log('');
    Logger.log('H. Profil murid & tombol Hubungi Guru');

    /* Nomor guru disimpan sementara lalu dipulihkan, supaya uji ini
       tidak mengubah data guru yang sesungguhnya. */
    var barisGuru = Db.cariBarisCache('users', 'user_id', sg.user_id);
    var waAsli = String(barisGuru.no_wa || '');

    Kelas.simpanProfilGuru(sg, { no_wa: '' });
    Db.invalidasi('users');
    cek('tanpa nomor guru, tombol Hubungi Guru disembunyikan',
        Kelas.kontakGuru(sm).ada === false,
        '', 'layar murid menampilkan tautan rusak wa.me/');

    var waUji = '0813-5555-6666';
    Kelas.simpanProfilGuru(sg, { no_wa: waUji });
    Db.invalidasi('users');

    var kon = Kelas.kontakGuru(sm);
    cek('kontak guru tersedia', kon.ada === true,
        '', 'tombol Hubungi Guru tidak akan muncul');
    cek('tautan memakai nomor baku',
        kon.ada && kon.tautan.indexOf(
          'https://wa.me/' + Util.normalisasiWa(waUji)) === 0,
        kon.ada ? kon.tautan.slice(0, 38) : '-');

    var pesanWa = kon.ada
      ? decodeURIComponent(String(kon.tautan).split('?text=')[1] || '') : '';
    cek('pesan pembuka memuat nama murid',
        pesanWa.indexOf('ZZ Murid Biodata') !== -1,
        '', 'guru tidak tahu siapa yang menghubungi');

    var prof = getProfilSaya(lm.data.token);
    cek('getProfilSaya berhasil', prof.ok === true);
    cek('membawa biodata + kontak guru sekaligus',
        prof.ok && !!prof.data.guru && prof.data.guru.ada === true,
        '', 'dialog profil perlu 2 perjalanan bolak-balik');

    /* Peran dikunci: murid tidak boleh menyentuh profil guru. */
    cek('murid ditolak menyimpan profil guru',
        simpanProfilGuru(lm.data.token, { no_wa: '081200000000' }).ok === false,
        '', 'murid dapat mengganti nomor kontak guru');

    Kelas.simpanProfilGuru(sg, { no_wa: waAsli });
    Db.invalidasi('users');
    cek('nomor guru dipulihkan seperti semula',
        String(Db.cariBarisCache('users', 'user_id', sg.user_id).no_wa)
          === waAsli,
        waAsli ? 'kembali ke ' + waAsli : 'kembali kosong');

  } catch (e) {
    gagal++;
    Logger.log('  ❌ GALAT: ' + e.message);
    Logger.log('     ' + (e.stack || '').split('\n').slice(0, 3).join(' | '));
  } finally {
    Logger.log('');
    Logger.log('Membersihkan data uji…');
    try { bersihkanSisaUji(); Logger.log('  Kelas & murid uji dihapus.'); }
    catch (e3) { Logger.log('  ⚠️ gagal membersihkan: ' + e3.message); }
  }

  var total = Math.round((new Date() - mulai) / 1000);
  Logger.log('');
  Logger.log('=====================================');
  Logger.log('  LOLOS: ' + lolos + '   GAGAL: ' + gagal +
             '   (' + total + ' detik)');
  Logger.log('=====================================');
  if (gagal === 0) {
    Logger.log('✅ Biodata murid bekerja di Apps Script sungguhan.');
  } else {
    Logger.log('❌ Ada ' + gagal + ' gagal.');
    Logger.log('');
    Logger.log('   Bila "kolom ... ada di spreadsheet" gagal:');
    Logger.log('     jalankan migrasiStruktur() lebih dulu.');
    Logger.log('');
    Logger.log('   Bila kolomnya ADA tetapi "sungguh tersimpan di sel"');
    Logger.log('   gagal: memo header basi — salin ulang Db.gs dan');
    Logger.log('   Setup.gs, lalu ulangi migrasiStruktur().');
    Logger.log('');
    Logger.log('   Bila NISN kehilangan NOL DI DEPAN (0098… → 98…):');
    Logger.log('     kolomnya belum berformat teks. Salin Setup.gs');
    Logger.log('     versi 1.10.4, lalu ulangi migrasiStruktur().');
  }
}


function tesKoneksiAI() {
  _hanyaEditor();
  Logger.log('=== TES KONEKSI GEMINI ===');
  var st = Ai.statusKeys();
  if (!st.terpasang) {
    Logger.log('❌ Belum ada API key terpasang.');
    return;
  }
  Logger.log(st.jml + ' key terpasang. Menghubungi Gemini…');

  var t0 = new Date().getTime();
  try {
    /* Jatah token sengaja longgar: pada Gemini 2.5+ token "thinking"
       ikut memotong maxOutputTokens, sehingga angka kecil membuat
       jawaban terpotong dan tes memberi hasil menyesatkan. */
    var r = Ai.panggil(
      'Balas JSON {"pesan":"halo"} saja, tanpa penjelasan.',
      { maksToken: 2048, suhu: 0 });
    var detik = ((new Date().getTime() - t0) / 1000).toFixed(1);

    Logger.log('✅ BERHASIL — key#' + r.key_index + ', model ' + r.model +
               ', ' + detik + ' detik');
    Logger.log('   Balasan: ' + String(r.teks).slice(0, 120));

    /* Beri tahu bila model yang dipakai BUKAN pilihan pertama —
       biasanya berarti model teratas tidak dikenal endpoint v1beta
       atau kuotanya habis. Tanpa ini, penurunan diam-diam tidak
       pernah disadari. */
    var utama = Ai.MODEL_BAWAAN[0];
    if (r.model !== utama) {
      Logger.log('   ⚠️ Model utama (' + utama + ') tidak terpakai.');
      Logger.log('      Mungkin belum tersedia di endpoint ini, atau ' +
                 'kuotanya habis. Sistem memakai cadangan — tetap aman.');
    }

    /* Waktu jauh di atas wajar menandakan mode berpikir masih menyala. */
    /* Terukur 1,4 detik pada gemini-3.6-flash dengan thinkingLevel
       "low". Bila suatu saat melonjak di atas 10 detik, hampir pasti
       pengaturan thinking tidak lagi diterima model. */
    if (Number(detik) > 10) {
      Logger.log('   ⚠️ ' + detik + ' detik untuk permintaan sepele — ' +
                 'biasanya 1-3 detik. Mode berpikir mungkin menyala lagi.');
      Logger.log('      Tidak merusak hasil, hanya lebih lambat.');
    }

    /* Pastikan balasannya benar-benar JSON, bukan sekadar terkirim. */
    var sah = false;
    try { sah = !!Ai._parseJson(r.teks); } catch (e) {}
    if (sah) {
      Logger.log('   Format JSON terbaca. Generator AI siap dipakai.');
    } else {
      Logger.log('   ⚠️ Balasan bukan JSON yang utuh.');
      Logger.log('      Model mungkin memotong jawaban. Jalankan');
      Logger.log('      ujiTahap7() untuk memeriksa lebih lanjut.');
    }
  } catch (e) {
    Logger.log('❌ GAGAL: ' + e.message);
    Logger.log('');
    Logger.log('Periksa:');
    Logger.log(' • Key benar dan belum dicabut');
    Logger.log(' • Generative Language API aktif di project key tersebut');
    Logger.log(' • Kuota harian belum habis');
  }
}

/**
 * PEMERIKSAAN KESEHATAN — jalankan setelah menyalin berkas baru.
 *
 * Memastikan seluruh modul termuat, fungsi baru tersedia, struktur
 * sheet lengkap, dan cache berfungsi. Tidak mengubah data apa pun.
 */
/**
 * Periksa berkas HTML/CSS mana yang BELUM tersalin ke editor.
 *
 * cekKesehatan() hanya melihat berkas .gs — ia memeriksa `typeof Util`
 * dan sejenisnya, yang mustahil dilakukan pada CSS. Akibatnya guru
 * yang lupa menyalin `css.html` tetap dilapori "sehat", lalu bingung
 * kenapa tampilannya tidak berubah setelah Deploy (laporan v1.6.1).
 *
 * Cara kerjanya: tiap rilis menitipkan PENANDA — sepotong teks khas
 * yang hanya ada pada versi baru. Bila penandanya tidak ditemukan,
 * berkas itu masih versi lama.
 */
function cekBerkasUI() {
  _hanyaEditor();
  Logger.log('=== CEK BERKAS UI — LessonLen v' + APP_VERSI + ' ===');
  Logger.log('');
  Logger.log('Memeriksa apakah berkas HTML/CSS sudah versi terbaru.');
  Logger.log('cekKesehatan() TIDAK bisa melihat ini — ia hanya');
  Logger.log('memeriksa berkas .gs.');

  /* Penanda per rilis: [berkas, teks khas, versi, apa yang rusak
     bila belum tersalin]. Sengaja memakai potongan yang tidak
     mungkin muncul di versi sebelumnya. */
  var PENANDA = [
    ['css', 'overflow-x: hidden;\n  width: 100%;', '1.6.6',
     'seluruh halaman bisa DIGESER ke samping di ponsel — lebar meluber'],
    ['css', 'img, video, iframe, svg, canvas', '1.6.6',
     'gambar lebar mendorong halaman melebihi layar'],
    ['js_kelola', '<th>Rombel</th><th>Nama Pengguna</th>', '1.6.5',
     'layar Periksa impor tidak menampilkan rombel'],
    ['js_kelola', 'm.kelas_mapel', '1.6.5',
     'kolom Kelas-Mapel hanya menampilkan nama kelas, tanpa mapel'],
    ['js_core', 'function labelKelas(', '1.6.4',
     'dropdown pemilih kelas tidak menyebut mapel — kelas senama tak terbedakan'],
    ['js_kelola', 'nama, kelas, username, password', '1.6.4',
     'format impor lama — belum bisa isi rombel & password manual'],
    ['js_kelola', 'filter-rombel', '1.6.4',
     'tidak ada penyaring rombel di layar Kelola Murid'],
    ['js_kelola', 'belum punya kelas', '1.6.3',
     'daftar pilih murid tidak menyebut kelas — murid senama tertukar'],
    ['css', '.baris-pil', '1.6.3',
     'pil kelas pada daftar murid tidak membungkus rapi'],
    ['css', 'max-height: calc(100vh - 40px)', '1.6.2',
     'isi dialog TERPOTONG dan tidak bisa digulir'],
    ['css', 'position: sticky; bottom: -24px', '1.6.2',
     'tombol Simpan/Batal hilang saat dialog digulir'],
    ['css', '.isian, .input {', '1.6.0',
     'kotak jawaban esai murid tampil tanpa tepi & tanpa tinggi sentuh'],
    ['css', 'flex-wrap: wrap; gap: var(--sela)', '1.6.0',
     'judul panjang + tombol berdesakan di ponsel'],
    ['css', '.btn-bahaya-hantu', '1.6.0',
     'tombol hapus tampil HIJAU seperti tombol biasa'],
    ['css', '.mb-12', '1.6.0',
     'jarak antar elemen hilang di 19 tempat'],
    ['css', '.konten-kaya table', '1.5.6',
     'tabel dari AI tampil TANPA GARIS'],
    ['css', '.kotak-cerita', '1.5.5',
     'kotak "Soal bercerita" tidak berbingkai'],
    ['css', '.tabel-rekap-bungkus', '1.5.0',
     'kolom Nama pada Rekap Nilai tidak membeku'],
    ['css', '.pesan-muat', '1.4.3',
     'tirai muat tanpa keterangan saat mengumpulkan quiz'],
    ['css', '.blok-grup', '1.4.2',
     'kelompok soal tidak berbingkai — sulit dilihat'],

    ['js_quiz', '_daftarSoalGuru', '1.4.2',
     'kelompok soal tidak dibungkus bingkai'],
    ['js_quiz', 'sedangKumpul', '1.4.3',
     'klik ganda tombol Kumpulkan membuat pengumpulan berulang'],
    ['js_quiz', 'tabel-gulir', '1.6.0',
     'tabel penilaian melebarkan seluruh halaman di ponsel'],

    ['js_core', 'function tampilkanMuat(tampil, pesan)', '1.4.3',
     'tirai muat tidak bisa menampilkan pesan'],
    ['js_core', "rekap: 'js_rekap'", '1.5.0',
     'rute Rekap Nilai tidak dikenali router'],

    ['index', 'pesan-muat', '1.4.3',
     'wadah pesan pada tirai muat tidak ada'],
    ['index', 'js_rekap', '1.5.0',
     'halaman Rekap Nilai tidak pernah dimuat'],

    ['js_soal_ai', 'ai-cerita', '1.5.5',
     'isian "Soal bercerita" tidak muncul di dialog AI'],
    ['js_soal_ai', 'tebal konten-kaya', '1.5.6',
     'tabel pada soal AI tampil sebagai kode mentah'],

    ['js_beranda', "data-tautan=\"#/rekap\"", '1.5.0',
     'tombol 📊 Rekap Nilai tidak ada di beranda'],

    ['js_editor', '\'<div class="tabel-gulir">\'', '1.6.0',
     'tabel status API key melebarkan halaman'],

    ['js_rekap', 'kol-beku', '1.5.0',
     'berkas js_rekap BELUM DIBUAT sama sekali'],

    /* ---- Tugas Kelompok, v1.7.0 ---- */
    ['js_kelompok', 'function muatLayarKelompok(', '1.7.0',
     'berkas js_kelompok BELUM DIBUAT — layar kelola kelompok tidak ada'],
    ['js_kelompok', 'ikut kelompok', '1.7.0',
     'kotak penyesuaian nilai tanpa keterangan — kosong dikira nol'],
    ['js_core', "'nilai-kelompok': 'js_kelompok'", '1.7.0',
     'rute kelola kelompok tidak dikenali router'],
    ['index', 'js_kelompok', '1.7.0',
     'halaman Tugas Kelompok tidak pernah dimuat'],
    ['js_editor', 'data-tambah=\"tugas_kelompok\"', '1.7.0',
     'tombol tambah item Tugas Kelompok tidak ada di layar pertemuan'],
    ['js_editor', 'data-kelola-kelompok=', '1.7.0',
     'item tugas kelompok tanpa tombol menuju layar kelompoknya'],
    ['css', '.kartu-kelompok', '1.7.0',
     'kartu kelompok tampil sebagai kartu polos tanpa penanda'],
    ['css', '.isian-nilai', '1.7.0',
     'kotak nilai per anggota melebar tak beraturan di ponsel'],

    /* ---- pemisahan LKPD vs tugas kelompok, v1.7.1 ---- */
    ['js_beranda', 'kelompok_menunggu', '1.7.1',
     'tugas kelompok yang menunggu tidak punya tombol di beranda guru'],

    /* ---- antrean gabungan, v1.7.2 ---- */
    ['js_kelompok', 'function muatAntreanKelompok(', '1.7.2',
     'tombol beranda hanya membuka SATU tugas — tugas kelompok di ' +
     'kelas lain tidak pernah terlihat'],

    /* ---- anggota keluar kelas, v1.7.3 ---- */
    ['js_kelompok', 'k.ketua_keluar', '1.7.3',
     'kelompok yang ketuanya keluar kelas tampak normal padahal ' +
     'BUNTU — tidak ada yang bisa mengumpulkan'],
    ['css', '.pil-keluar', '1.7.3',
     'anggota yang sudah keluar kelas tidak terbedakan di daftar'],

    /* ---- enum tipe dikenali seluruh UI, v1.7.5 ---- */
    ['js_nav', 'tugas_kelompok', '1.7.5',
     'sidebar murid menampilkan "undefined" untuk tugas kelompok, ' +
     'dan mengkliknya tidak membuka apa pun'],
    ['js_belajar', 'tugas_kelompok', '1.7.5',
     'kartu item murid menampilkan nama enum mentah "tugas_kelompok"'],
    ['js_kelompok', "daftarRute('tugas-kelompok'", '1.7.5',
     'murid yang menekan notifikasi nilai mendapat pesan "berkas ' +
     'belum tersalin" yang menyesatkan'],

    /* ---- generator AI untuk LKPD & tugas kelompok, v1.7.6 ---- */
    ['js_editor', 'var BISA_AI', '1.7.6',
     'tombol ✨ Generate tidak muncul di editor LKPD & Tugas Kelompok'],
    ['js_editor', 'jalankanGenerateKegiatan', '1.7.6',
     'tombol Generate pada LKPD menimpa isi dengan format Materi'],
    ['v_editor', 'ed-gen-judul', '1.7.6',
     'panel AI di layar LKPD tetap berjudul "Susun Materi dengan AI"'],

    /* ---- layar murid tugas kelompok, v1.7.7 ---- */
    ['js_kelompok', 'function gambarTugasKelompok(', '1.7.7',
     'murid membuka tugas kelompok dan hanya melihat pesan ' +
     '"belum tersedia" — tidak bisa mengumpulkan sama sekali'],
    ['js_kelompok', 'tetap ikut menerima nilai', '1.7.7',
     'anggota bukan ketua diberi kotak isian yang PASTI ditolak ' +
     'server — pekerjaannya hilang tanpa penjelasan'],

    /* ---- buka kunci, v1.8.0 ---- */
    ['js_kunci', 'function panelKunciMurid(', '1.8.0',
     'berkas js_kunci BELUM DIBUAT — tombol 🔓 tidak berfungsi'],
    ['js_kunci', '>Kunci Ulang</button>', '1.8.0',
     'pembukaan akses tidak bisa dibatalkan — salah pilih murid ' +
     'hanya bisa diperbaiki lewat Sheet'],
    ['index', 'js_kunci', '1.8.0',
     'panel buka kunci tidak pernah dimuat'],
    ['js_editor', 'data-buka-kunci=', '1.8.0',
     'tidak ada tombol 🔓 pada baris item — pintu dari sisi ITEM hilang'],
    ['js_kelola', 'data-kunci=', '1.8.0',
     'tidak ada tombol 🔓 pada daftar murid — pintu dari sisi MURID hilang'],

    /* ---- AI refleksi, v1.8.1 ---- */
    ['js_editor', 'jalankanGenerateRefleksi', '1.8.1',
     'tombol ✨ tidak muncul di editor Refleksi — satu-satunya tipe ' +
     'yang masih harus ditulis manual'],
    ['js_editor', 'Susun Pertanyaan Refleksi dengan AI', '1.8.1',
     'panel AI di layar Refleksi memakai judul tipe lain'],

    /* ---- kerangka semester AI, v1.8.2 ---- */
    ['js_kerangka', 'function panelKerangkaAI(', '1.8.2',
     'berkas js_kerangka BELUM DIBUAT — tombol ✨ Kerangka AI mati'],
    ['js_kerangka', 'tidak dapat diurungkan', '1.8.2',
     'guru menerapkan belasan pertemuan tanpa diberi tahu bahwa ' +
     'tindakan itu tak dapat dibatalkan sekaligus'],
    ['index', 'js_kerangka', '1.8.2',
     'panel kerangka semester tidak pernah dimuat'],
    ['js_editor', 'id="btn-kerangka"', '1.8.2',
     'tidak ada tombol ✨ Kerangka AI di layar struktur kelas'],
    ['css', '.krg-baris', '1.8.2',
     'baris usulan kerangka tampil polos — yang dilepas centangnya ' +
     'tidak terbedakan'],

    /* ---- penanda CP di payload struktur, v1.8.3 ---- */
    ['js_kerangka', 'KRG.kelas.ada_capaian === true', '1.8.3',
     'panel Kerangka AI berkata "Capaian Pembelajaran belum diisi" ' +
     'PADAHAL SUDAH — tombolnya mati selamanya'],

    /* ---- pengelompokan bab, v1.8.4 ---- */
    ['js_kerangka', 'krg-bab', '1.8.4',
     'seluruh pertemuan hasil kerangka menumpuk di SATU Materi ' +
     'Pokok — tidak terkelompok per bab'],
    ['js_kerangka', 'krg-tempat', '1.8.4',
     'kelas yang sudah punya Materi Pokok tidak ditanyai apakah ' +
     'hasil kerangka digabung atau dibuat bab baru'],
    ['css', '.krg-bab', '1.8.4',
     'kolom bab tidak terbedakan dari judul pertemuan'],

    /* ---- kecepatan penerapan kerangka, v1.8.5 ---- */
    ['js_kerangka', 'krg-ringkas', '1.8.5',
     'ringkasan jumlah bab/pertemuan/item tidak tampil sebelum ' +
     'menerapkan'],

    /* ---- kerangka membuat SELURUH tipe item, v1.8.6 ---- */
    ['js_kerangka', 'krg-kelompok', '1.8.6',
     'kerangka tidak pernah membuat item Tugas Kelompok — guru ' +
     'harus menambahkannya satu per satu di 15 pertemuan'],
    ['js_kerangka', 'krg-refleksi', '1.8.6',
     'kerangka tidak pernah membuat item Refleksi'],
    ['js_kerangka', 'function _cacahItem(', '1.8.6',
     'hitungan item disalin di dua tempat — angka di konfirmasi ' +
     'bisa berbeda dengan yang benar-benar dibuat'],
    ['css', '.krg-kelompok', '1.8.6',
     'centang Tugas Kelompok & Refleksi tampil renggang di baris usulan'],

    /* ---- quiz dikerjakan offline di localStorage, v1.9.0 ---- */
    ['js_quiz', 'function _simpanLokal(', '1.9.0',
     'quiz MASIH memanggil server tiap klik jawaban — 36 murid ' +
     'serentak akan gagal SISTEM_SIBUK lagi'],
    ['js_quiz', '_jawabanUntukKirim', '1.9.0',
     'jawaban tidak dikirim borongan saat Kumpulkan'],
    ['js_quiz', 'masih tersimpan di ', '1.9.0',
     'murid tidak diberi tahu jawabannya aman saat jaringan gagal'],
    ['js_editor', 'id="q-batas"', '1.9.0',
     'editor quiz masih meminta batas waktu MENIT, bukan tenggat tanggal'],

    /* ---- pratinjau item di layar guru, v1.9.2 ---- */
    ['js_editor', 'function pratinjauItem(', '1.9.2',
     'tombol 👁 pratinjau mati — guru harus membuka editor satu per ' +
     'satu untuk memeriksa isi item'],
    ['js_editor', 'data-pratinjau-item', '1.9.2',
     'tombol pratinjau tidak muncul di baris item'],
    ['js_editor', 'pv-kunci-isi', '1.9.2',
     'kunci jawaban quiz tampil begitu saja di pratinjau — berbahaya ' +
     'bila layar guru terlihat murid'],

    /* ---- lebar dialog jadi bagian kontrak, v1.9.4 ---- */
    ['js_core', "opsi.lebar === 'penuh'", '1.9.4',
     'dialog pratinjau tetap 420px — materi bertabel sulit dibaca'],
    ['css', '.dialog.dialog-penuh', '1.9.4',
     'kelas lebar penuh belum ada; pratinjau menyempit'],
    ['js_editor', "lebar: 'penuh'", '1.9.4',
     'pratinjau item tidak meminta dialog lebar'],

    /* ---- peringatan terbit bertingkat, v1.9.5 ---- */
    ['js_editor', 'function _peringatanTerbit(', '1.9.5',
     'guru tidak diberi tahu saat item terbit tertahan oleh ' +
     'pertemuan/bab yang masih draf — murid melihat "Pertemuan ' +
     'tidak ditemukan" tanpa sebab yang jelas'],

    /* ---- nama kartu kelas "Kelas - Mapel", v1.9.6 ---- */
    ['js_core', 'function namaKelasLengkap(', '1.9.6',
     'kartu kelas masih memisah nama & mapel jadi dua baris'],

    /* ---- video YouTube di materi, v1.9.8 ---- */
    ['v_editor', 'data-cmd="video"', '1.9.8',
     'tombol ▶ Video tidak ada di toolbar editor'],
    ['js_editor', 'function idYouTube(', '1.9.8',
     'tombol ▶ Video mati — tautan YouTube tidak dikenali'],
    ['css', '.bingkai-video', '1.9.8',
     'video tampil tanpa bingkai & rasio 16:9'],

    /* ---- tabel dapat diatur ukurannya, v1.9.9 ---- */
    ['js_editor', 'function dialogTabel(', '1.9.9',
     'tombol ▦ masih menyisipkan tabel yang dipaku 2×2'],
    ['v_editor', 'data-cmd="kolom-tambah"', '1.9.9',
     'tidak ada tombol menambah baris/kolom pada tabel yang sudah ada'],
    ['css', '.alat-tabel', '1.9.9',
     'tombol alat tabel tampak berserakan di toolbar'],

    /* ---- mode sunting HTML, v1.9.10 ---- */
    ['v_editor', 'id="ed-mode-html"', '1.9.10',
     'tombol </> HTML tidak ada di toolbar editor'],
    ['js_editor', 'function samakanDariHtml(', '1.9.10',
     'suntingan mode HTML HILANG saat menekan Simpan'],
    ['css', '.editor-html', '1.9.10',
     'kotak kode HTML tampil tanpa huruf monospace'],

    /* ---- warna yang tidak pernah ada, v1.9.11 ---- */

    ['css', 'background: var(--hijau-tua); color: #fff', '1.9.11',
     'tombol "Visual" tidak terlihat — teks putih di atas latar putih'],

    /* ---- biodata murid, v1.10.0 ---- */
    ['js_auth', "daftarRute('biodata'", '1.10.0',
     'layar Lengkapi Biodata tidak ada — murid mendarat di layar putih'],
    ['js_beranda', 'function spandukBiodata(', '1.10.0',
     'spanduk pengingat biodata tidak pernah muncul di beranda murid'],
    /* Berkas BARU. Bila belum dibuat di editor, `include('v_biodata')`
       di index.html gagal dan SELURUH halaman tidak termuat — jadi
       penanda ini yang paling penting dari ketiganya. */
    ['v_biodata', 'id="tpl-biodata"', '1.10.0',
     'berkas v_biodata.html belum dibuat — buat file baru di editor'],

    /* ---- dialog biodata saat login, v1.10.1 ----
       TERLUPA saat dirilis; ditemukan v1.11.7 oleh run83. */
    ['js_auth', 'function dialogBiodata(', '1.10.1',
     'dialog biodata tidak muncul otomatis sesudah murid masuk'],
    ['js_core', 'biodata_kurang = d.biodata_kurang', '1.10.1',
     'sesudah muat ulang halaman, spanduk biodata tidak pernah muncul'],

    /* ---- biodata sisi guru (Tahap 2), v1.11.0 ---- */
    ['js_kelola', 'function selBiodata(', '1.11.0',
     'kolom Biodata di Kelola Murid kosong — seluruh tabel bergeser'],
    ['js_kelola', 'id="btn-unduh-bio"', '1.11.0',
     'tombol Ekspor Biodata tidak ada di layar Kelola Murid'],

    /* ---- profil di topbar & Hubungi Guru, v1.11.2 ---- */
    ['js_core', 'id="btn-profil"', '1.11.2',
     'nama di pojok kanan atas tidak dapat diklik'],
    ['js_auth', 'function dialogProfilGuru(', '1.11.2',
     'guru tidak punya tempat mengisi nomor WA — tombol Hubungi Guru ' +
     'tidak akan pernah muncul di layar murid'],

    /* ---- kirim sandi reset lewat WhatsApp, v1.11.3 ---- */
    ['js_core', 'function dialogHasilReset(', '1.11.3',
     'tombol Kirim lewat WhatsApp tidak ada sesudah reset kata sandi'],

    /* ---- minta perbaikan lewat WhatsApp, v1.11.4 ---- */
    ['js_core', 'function dialogPerbaikanWa(', '1.11.4',
     'tombol WhatsApp tidak muncul sesudah Minta Perbaikan pada ' +
     'LKPD maupun Tugas Kelompok'],

    /* ---- dialog perbaikan menjelaskan diri, v1.11.5 ----
       TERLUPA saat v1.11.5 dirilis: cekBerkasUI() menyatakan "semua
       terbaru" padahal berkasnya masih versi lama. Rilis apa pun yang
       menyentuh berkas UI WAJIB menitipkan penandanya. */
    ['js_core', 'Belum ada nomor WhatsApp', '1.11.5',
     'saat murid belum punya nomor, dialog dilewati DIAM-DIAM — ' +
     'guru mengira tombol WhatsApp rusak'],

    /* ---- tombol pembersih ekspor Drive, v1.12.1 ---- */
    ['js_rekap', 'id="btn-bersih"', '1.12.1',
     'tombol Bersihkan tidak ada — berkas ekspor menumpuk di Drive'],

    /* ---- tombol Rekap per kelas, v1.12.3 ----
       Dua penanda: tombolnya DAN penanganan kliknya. Tombol tanpa
       penangan tampil normal tetapi tidak melakukan apa-apa saat
       ditekan — kegagalan paling membingungkan bagi guru. */
    ['js_kelola', 'data-rekap="', '1.12.3',
     'tombol 📊 Rekap tidak ada di kartu kelas — rekap hanya ' +
     'terjangkau lewat beranda'],
    ['js_kelola', "pergiKe('#/rekap/' + b.dataset.rekap)", '1.12.3',
     'tombol 📊 Rekap tampil tetapi TIDAK BEREAKSI saat ditekan'],

    /* ---- beranda guru dirampingkan, v1.12.4 ----
       Penanda ini penting justru karena berkas .gs dan .html HARUS
       disalin bersama: `Beranda.gs` berhenti mengirim `progres`,
       sedangkan `js_beranda.html` lama masih membacanya. Bila hanya
       salah satu tersalin, kartu kelas menampilkan "undefined%". */
    /* Penanda menunjuk KODE, bukan komentar (§6.2 no. 99).
       Versi lama menulis `'<div class="baris kecil lembut mt-8"` —
       kelas `mt-8` diperlukan di sana untuk memberi jarak dari bilah
       progres. Begitu bilahnya dibuang, jaraknya ikut hilang, jadi
       string ini HANYA ada pada versi baru. */
    ['js_beranda', '\'<div class="baris kecil lembut" style="gap:14px">\'',
     '1.12.4',
     'kartu kelas guru menampilkan "undefined%" — js_beranda masih ' +
     'membaca angka yang tidak lagi dikirim Beranda.gs'],

    /* ---- layar Rekap satu panggilan, v1.12.6 ----
       Aman satu arah: js_rekap lama tetap bekerja karena kedua API
       lama sengaja dipertahankan. Yang rugi hanya kecepatannya —
       dan justru itu yang mudah tidak disadari. */
    /* ---- cache beranda, v1.12.8 ----
       Lima berkas berubah bersama. Penanda dipasang pada yang paling
       menentukan: tanpa js_beranda baru, `bataliBeranda()` tidak ada
       dan seluruh pembatal di berkas lain diam (dijaga typeof), jadi
       cache tidak pernah dibuang — antrean koreksi tampil basi. */
    /* ---- sidebar menu guru, v1.13.0 ----
       js_menu adalah berkas BARU: bila belum dibuat di editor,
       seluruh penjaga typeof diam dan sidebar tidak pernah muncul —
       tanpa satu pun pesan galat. Penanda inilah satu-satunya yang
       memberi tahu. */
    /* ---- sidebar di SELURUH layar guru, v1.13.2 ----
       Tiap berkas ini punya layar guru yang sebelumnya kehilangan
       sidebar. Penanda per berkas: guru bisa menyalin sebagian saja,
       dan gejalanya (sidebar lenyap di layar tertentu) sulit
       dilacak tanpa diberi tahu berkas mana yang tertinggal. */
    ['js_lkpd', "menuRangka(app, 'lkpd')", '1.13.2',
     'sidebar hilang saat membuka Nilai LKPD'],
    ['js_quiz', "menuRangka(app, 'quiz')", '1.13.2',
     'sidebar hilang saat membuka Koreksi Quiz'],
    ['js_kelompok', "menuRangka(app, 'kelompok')", '1.13.2',
     'sidebar hilang saat membuka Tugas Kelompok'],
    ['js_editor', "menuRangka(app, 'kelas')", '1.13.2',
     'sidebar hilang saat membuka kelas dari daftar Kelas Saya'],
    ['js_refleksi', 'menuRangka(app', '1.13.2',
     'sidebar hilang di layar refleksi kelas'],

    /* ---- item tampil di Daftar Isi murid, v1.14.0 ----
       js_belajar & css harus tersalin BERSAMA: tanpa css, daftar
       itemnya tampil sebagai daftar berpeluru tanpa gaya. */
    /* ---- pelipatan pertemuan, v1.14.2 ----
       js_belajar & css wajib tersalin BERSAMA: tanpa css, panah
       lipat menimpa nomor pertemuan. */
    /* ---- tombol Segarkan pada layar penilaian, v1.14.3 ----
       js_core memuat fungsinya; ketiga layar memanggilnya lewat
       penjaga typeof. Bila js_core belum tersalin, tombolnya tidak
       muncul sama sekali — layarnya tetap bekerja. */
    /* ---- Segarkan pada layar PER ITEM, v1.14.4 ----
       Dibuka dari dalam pertemuan. Justru layar inilah yang paling
       lama ditunggui guru: ia menilai murid satu per satu sementara
       murid lain masih mengumpulkan. */
    /* ---- sidebar dibentangkan sampai item, v1.15.0 ----
       js_menu & css wajib tersalin BERSAMA: tanpa css, keempat
       tingkat bentangan tampil rata tanpa jorokan dan tidak
       terbaca sebagai susunan. */
    /* ---- perbaikan lapangan sidebar, v1.15.1 ---- */
    /* ---- ikon terpusat, v1.15.6 ----
       Empat berkas berubah bersama. Bila index.html tertinggal,
       favicon tetap ikon lama walau topbar sudah berubah — gejala
       yang membingungkan karena separuh benar. */
    /* ---- baca materi DIKEMBALIKAN, v1.16.1 ----
       v1.16.0 melewatkan `tandaiBagianSelesai` pada bagian tengah;
       server menolak panggilan bagian terakhir dengan ITEM_TERKUNCI
       sehingga materi tidak pernah selesai dan murid tidak bisa
       lanjut ke item berikutnya. Penandanya menunjuk KETIADAAN
       jalur lokal itu. */
    ['js_belajar', 'mulai: 0, timer: null };', '1.16.1',
     'masih memakai jalur v1.16.0 — materi tidak pernah bisa ' +
     'diselesaikan, murid mentok di bagian terakhir'],

    /* ---- pemulihan username, v1.17.0 ----
       TIGA berkas berubah bersama dan harus tersalin bersama.
       Bila v_login tertinggal, tombolnya tidak ada — murid tetap
       harus bertemu guru. Bila js_auth tertinggal, tombolnya ADA
       tetapi tidak melakukan apa-apa: lebih buruk, karena murid
       mengira sudah meminta dan menunggu. */
    ['v_login', 'id="btn-pulihkan"', '1.17.0',
     'tombol "Lupa nama pengguna?" tidak ada di layar masuk — ' +
     'murid yang lupa username tetap harus bertemu guru'],
    ['v_login', 'id="tpl-pulihkan"', '1.17.0',
     'dialog pemulihan tidak punya isian email & nomor WA'],
    ['js_auth', "callApi('pulihkanAkun'", '1.17.0',
     'tombol "Lupa nama pengguna?" ada tetapi TIDAK MELAKUKAN ' +
     'APA-APA — murid mengira sudah meminta lalu menunggu'],

    /* ---- reset menolak akun tak ada, v1.18.0 ----
       HANYA js_auth yang berubah di sisi klien (Auth.gs tidak
       diperiksa cekBerkasUI). Bila berkas ini tertinggal, server
       sudah menolak dengan benar tetapi layar tetap menampilkan
       "Permintaan Diterima" — murid kembali menunggu sesuatu yang
       tidak pernah terkirim. Gejala persis seperti sebelum v1.18.0. */
    ['js_auth', "'Tidak Dapat Diproses'", '1.18.0',
     'server sudah menolak akun yang tidak ada/nonaktif, tetapi ' +
     'layar tetap menampilkan "Permintaan Diterima" — murid menunggu ' +
     'permintaan yang tidak pernah terkirim'],

    /* ---- placeholder siswa01 dibuang, v1.18.1 ----
       Perubahan ini MENGHAPUS teks, jadi tidak ada string baru yang
       bisa dijadikan penanda kecuali komentarnya. Penanda berbasis
       komentar memang rapuh — bisa terhapus tanpa mengubah perilaku
       (pelajaran v1.12.7). Diterima di sini karena akibatnya kecil:
       placeholder kembali muncul, bukan layar yang rusak. */
    ['v_login', 'placeholder berisi nama akun seed DIBUANG', '1.18.1',
     'layar masuk masih mengiklankan nama akun seed — akun nyata ' +
     'bersandi baku yang terlihat oleh siapa pun tanpa login'],
    ['js_kelola', 'placeholder akun seed dibuang', '1.18.1',
     'form Murid Baru masih memakai nama akun seed sebagai contoh'],

    ['js_menu', 'Menu.ringkas', '1.15.7',
     'kartu Kelola Kelas menampilkan "undefined murid / undefined ' +
     'pertemuan" — layar memakai benih 3 kolom dari beranda'],

    ['index', '<?= appIkon ?>', '1.15.6',
     'favicon tetap ikon lama walau topbar sudah berubah'],
    ['js_core', 'typeof APP_IKON', '1.15.6',
     'ikon di topbar tidak mengikuti APP_IKON di Code.gs'],
    ['js_auth', 'merek-ikon-login', '1.15.6',
     'ikon di layar masuk tidak mengikuti APP_IKON'],
    ['v_login', 'id="merek-ikon-login"', '1.15.6',
     'layar masuk tidak punya tempat mengisi ikon'],

    ['js_menu', 'function _menuGulirKeAktif(', '1.15.4',
     'sidebar kembali ke atas tiap kali guru berpindah layar — ' +
     'kelas yang baru diklik hilang dari pandangan'],

    ['js_menu', 'function strukturKelasBersama(', '1.15.3',
     'sidebar dan layar kelas menembak getStrukturKelas pada detik ' +
     'yang sama — dua eksekusi untuk data yang identik'],
    ['js_editor', 'strukturKelasBersama(kelasId)', '1.15.3',
     'layar Kelola Pertemuan masih memanggil getStrukturKelas ' +
     'terpisah dari sidebar'],

    ['js_menu', 'Menu.tungguBenih', '1.15.2',
     'sidebar menembak getDaftarKelas sendiri saat getBeranda lambat ' +
     '— dua panggilan untuk data yang sama'],
    ['js_beranda', 'lepasBenihSidebar()', '1.15.2',
     'bila getBeranda gagal, daftar kelas di sidebar kosong selamanya'],

    ['js_kelompok', "menuRangka(app, 'kelompok')", '1.15.1',
     'sidebar MENGHILANG saat guru membuka penilaian tugas kelompok ' +
     'dari sidebar'],
    ['js_menu', "'#/pertemuan/' + pid", '1.15.1',
     'item materi di sidebar tidak dapat diklik — guru mengeklik ' +
     'lalu tidak terjadi apa-apa'],

    ['js_menu', 'function menuBentangKelas(', '1.15.0',
     'sidebar tidak dapat dibentangkan — guru harus kembali ke ' +
     'halaman utama kelas untuk berpindah antar item'],
    ['css', '.menu-bentang', '1.15.0',
     'bentangan sidebar tampil rata tanpa jorokan — bab, pertemuan, ' +
     'dan item tidak terbedakan'],

    ['js_lkpd', "btnSegarkan('btn-segar-lkpd-item')", '1.14.4',
     'daftar murid pada satu LKPD tidak dapat disegarkan — ' +
     'pengumpulan baru tidak terlihat'],
    ['js_quiz', "btnSegarkan('btn-segar-quiz-item')", '1.14.4',
     'daftar murid pada satu Quiz tidak dapat disegarkan'],
    ['js_kelompok', "btnSegarkan('btn-segar-klp-item')", '1.14.4',
     'daftar kelompok pada satu tugas tidak dapat disegarkan'],

    ['js_core', 'function btnSegarkan(', '1.14.3',
     'tombol Segarkan tidak muncul di layar penilaian LKPD, Quiz, ' +
     'dan Tugas Kelompok'],
    ['js_lkpd', "btnSegarkan('btn-segar-lkpd')", '1.14.3',
     'antrean LKPD tidak dapat disegarkan tanpa pindah layar'],
    ['js_quiz', "btnSegarkan('btn-segar-quiz')", '1.14.3',
     'antrean Koreksi Quiz tidak dapat disegarkan'],
    ['js_kelompok', "btnSegarkan('btn-segar-klp')", '1.14.3',
     'antrean Tugas Kelompok tidak dapat disegarkan'],

    ['js_belajar', 'function ptmTerlipat(', '1.14.2',
     'SELURUH item semua pertemuan tampil sekaligus — 8 pertemuan x ' +
     '5 item membuat Daftar Isi terlalu panjang'],
    ['css', '.btn-lipat-ptm', '1.14.2',
     'panah lipat menimpa nomor pertemuan'],

    ['js_nav', 'JEDA_SEGAR_NAV', '1.14.1',
     'sidebar murid menembak getIndeksKelas tiap kali dipasang ulang ' +
     '— 2x dalam 19 detik pada satu alur belajar'],

    ['js_belajar', 'function daftarItemMurid(', '1.14.0',
     'Daftar Isi murid tidak menampilkan item — murid tetap perlu ' +
     'dua klik untuk sampai ke satu materi'],
    ['css', '.item-baris {', '1.14.0',
     'daftar item di bawah pertemuan tampil tanpa gaya — berpeluru ' +
     'dan tidak terbaca sebagai daftar'],

    ['js_menu', 'function benihiKelasSidebar(', '1.13.4',
     'sidebar menembak getDaftarKelas pada detik yang sama dengan ' +
     'getBeranda — padahal beranda sudah mengirim daftar kelasnya'],
    ['js_beranda', 'benihiKelasSidebar(d.kelas)', '1.13.4',
     'beranda tidak membenihi sidebar — panggilan kedua tetap terjadi'],

    ['js_menu', 'function daftarKelasBersama(', '1.13.3',
     'sidebar dan layar memanggil getDaftarKelas sendiri-sendiri — ' +
     'dua eksekusi Apps Script pada detik yang sama untuk data yang ' +
     'sama persis'],
    ['js_kelola', 'typeof daftarKelasBersama', '1.13.3',
     'Kelola Kelas & Kelola Murid masih memanggil getDaftarKelas ' +
     'terpisah dari sidebar'],

    ['js_menu', 'function menuPergi(', '1.13.1',
     'mengeklik menu membawa guru ke URL userCodeAppPanel — tautan ' +
     'hash menavigasi iframe sandbox, bukan rute aplikasi'],

    ['js_menu', 'function menuRangka(', '1.13.0',
     'berkas js_menu.html BELUM DIBUAT — sidebar menu tidak muncul, ' +
     'guru tetap harus lewat beranda untuk berpindah layar'],
    ['index', "include('js_menu')", '1.13.0',
     'js_menu tidak pernah dimuat — sidebar diam walau berkasnya ada'],
    ['css', '.menu-tautan.aktif', '1.13.0',
     'menu yang sedang dibuka tidak ditandai — guru kehilangan jejak'],
    ['js_beranda', 'menuRangka(app', '1.13.0',
     'beranda tampil tanpa sidebar'],

    ['js_beranda', 'function bataliBeranda(', '1.12.8',
     'beranda dipanggil ulang tiap kali guru kembali — 57% waktu ' +
     'terbuang (log 24 Agu: 5 panggilan dalam 82 detik)'],
    ['js_lkpd', 'typeof bataliBeranda', '1.12.8',
     'sesudah menilai LKPD, antrean di beranda masih menampilkan ' +
     'angka lama sampai 30 detik'],

    ['js_rekap', "callApi('getRekapLengkap'", '1.12.6',
     'layar Rekap masih menembakkan DUA panggilan sekaligus — ' +
     'membayar biaya lantai Apps Script dua kali (±0,9 dtk terbuang)']
  ];

  /* baca tiap berkas sekali saja */
  var isi = {}, hilang = [];
  PENANDA.forEach(function (p) {
    if (isi[p[0]] !== undefined) return;
    try {
      isi[p[0]] = include(p[0]);
    } catch (e) {
      isi[p[0]] = null;
      hilang.push(p[0]);
    }
  });

  if (hilang.length) {
    Logger.log('');
    Logger.log('⛔ BERKAS TIDAK ADA di editor: ' + hilang.join(', '));
    Logger.log('   Buat berkas HTML dengan nama itu, lalu salin isinya.');
  }

  var basi = {}, jmlBasi = 0, jmlOk = 0;
  PENANDA.forEach(function (p) {
    var berkas = p[0], teks = p[1], versi = p[2], akibat = p[3];
    if (isi[berkas] === null) return;
    if (isi[berkas].indexOf(teks) > -1) { jmlOk++; return; }
    jmlBasi++;
    (basi[berkas] = basi[berkas] || []).push({ versi: versi, akibat: akibat });
  });

  Logger.log('');
  Logger.log('---------------------------------------------');
  if (!jmlBasi && !hilang.length) {
    Logger.log('✅ SELURUH BERKAS UI SUDAH VERSI TERBARU');
    Logger.log('   ' + jmlOk + ' penanda ditemukan.');
    Logger.log('');
    Logger.log('Bila tampilan MASIH terlihat lama, sebabnya cache');
    Logger.log('peramban — bukan kode:');
    Logger.log('  • buka dengan Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)');
    Logger.log('  • atau buka di jendela Penyamaran/Incognito');
    Logger.log('  • pastikan URL yang dibuka adalah URL /exec deployment,');
    Logger.log('    bukan /dev maupun tab lama yang belum dimuat ulang');
    return;
  }

  Logger.log('❌ ADA ' + jmlBasi + ' PENANDA TIDAK DITEMUKAN');
  Logger.log('');
  Object.keys(basi).forEach(function (berkas) {
    var d = basi[berkas];
    var versiTerlama = d[d.length - 1].versi;
    Logger.log('📄 ' + berkas + '.html — masih versi lama (perlu v' +
               versiTerlama + ' atau lebih baru)');
    d.forEach(function (x) {
      Logger.log('     • v' + x.versi + ': ' + x.akibat);
    });
    Logger.log('');
  });

  Logger.log('---------------------------------------------');
  Logger.log('YANG HARUS DILAKUKAN:');
  Logger.log('  1. Salin ulang berkas di atas dari folder src/');
  Logger.log('  2. Simpan (Ctrl+S) — pastikan tidak ada galat');
  Logger.log('  3. Deploy → Manage deployments → ✏️ → New version');
  Logger.log('  4. Muat ulang paksa: Ctrl+Shift+R');
  Logger.log('  5. Jalankan cekBerkasUI() lagi untuk memastikan');
}


/* ============================================================
 *  cekNomorWa() — kenapa tombol WhatsApp tidak muncul? (v1.11.6)
 *
 *  Dijalankan dari editor Apps Script. Menunjukkan APA ADANYA isi
 *  kolom `no_wa` tiap murid beserta hasil normalisasinya, sehingga
 *  penyebabnya terlihat tanpa perlu menebak.
 *
 *  Tidak mengubah data apa pun. Aman diulang.
 * ============================================================ */
/* ============================================================
 *  resetTahunAjaran() — pergantian tahun ajaran (v1.12.0)
 *
 *  DUA LANGKAH, dijalankan dari editor Apps Script:
 *
 *    resetTahunAjaran()                → hanya MELIHAT
 *    resetTahunAjaran('YA SAYA YAKIN') → menjalankan
 *
 *  Tidak ada tombol di aplikasi. Operasi ini tidak dapat diurungkan,
 *  dan tombol yang hidup sepanjang tahun di layar yang dipakai saat
 *  mengajar adalah risiko yang tidak sepadan.
 * ============================================================ */
function resetTahunAjaran(frasa) {
  _hanyaEditor();
  Logger.log('=== RESET TAHUN AJARAN (v' + APP_VERSI + ') ===');
  Logger.log('');

  var g = _sesiGuruDiagnostik();
  if (!g.ok) { Logger.log('❌ ' + g.pesan); return; }
  var sg = Auth.validasiToken(g.data.token);

  var d = ResetTahun.periksa();

  Logger.log('YANG AKAN TERKENA');
  Logger.log('  kelas aktif  : ' + d.kelas_aktif +
             (d.nama_kelas.length ? '  (' + d.nama_kelas.join(', ') + ')' : ''));
  Logger.log('  murid aktif  : ' + d.murid_aktif);
  Logger.log('');
  Logger.log('YANG AKAN DIHAPUS  (diarsipkan lebih dulu)');
  ResetTahun.SHEET_PEKERJAAN.forEach(function (n) {
    Logger.log('  ' + _pad(n, 18) + d.baris[n] + ' baris');
  });
  Logger.log('  ——');
  Logger.log('  ' + _pad('total', 18) + d.total_baris + ' baris');
  Logger.log('');
  Logger.log('JEJAK SEMENTARA  (dibersihkan, tidak diarsipkan)');
  ResetTahun.SHEET_JEJAK.forEach(function (n) {
    Logger.log('  ' + _pad(n, 18) + d.baris[n] + ' baris');
  });
  Logger.log('');
  Logger.log('YANG TIDAK DISENTUH');
  Logger.log('  ' + ResetTahun.SHEET_DIPERTAHANKAN.join(' · '));
  Logger.log('  Materi, bank soal, dan akun murid TETAP UTUH.');
  Logger.log('  Kelas hanya diarsipkan — materinya masih dapat disalin.');
  Logger.log('');

  /* ---------- mode intip ---------- */
  if (!frasa) {
    Logger.log('=====================================');
    Logger.log('MODE PERIKSA — belum ada yang diubah.');
    Logger.log('');
    Logger.log('Bila sudah yakin, jalankan:');
    Logger.log("    resetTahunAjaran('" + ResetTahun.FRASA + "')");
    Logger.log('');
    Logger.log('⚠️  TIDAK DAPAT DIURUNGKAN. Pastikan lebih dulu:');
    Logger.log('   • rapor sudah selesai dibagikan');
    Logger.log('   • arsip rekap akan dibuat otomatis di Drive Anda,');
    Logger.log('     tetapi periksa kuota Drive masih cukup');
    Logger.log('=====================================');
    return;
  }

  /* ---------- jalankan ---------- */
  Logger.log('Menjalankan… (arsip dibuat lebih dulu)');
  Logger.log('');
  var mulai = new Date();
  var hasil;
  try {
    hasil = ResetTahun.jalankan(sg, frasa);
  } catch (e) {
    Logger.log('❌ ' + e.message);
    Logger.log('');
    if (e.kode === 'GAGAL_ARSIP') {
      Logger.log('Tidak ada data yang dihapus. Perbaiki sebabnya');
      Logger.log('lalu jalankan ulang.');
    }
    return;
  }

  Logger.log('ARSIP TERSIMPAN DI DRIVE');
  hasil.arsip.berhasil.forEach(function (a) {
    Logger.log('  ✅ ' + a.kelas);
    if (a.url) Logger.log('     ' + a.url);
  });

  Logger.log('');
  Logger.log('DIHAPUS');
  Object.keys(hasil.dihapus).forEach(function (n) {
    Logger.log('  ' + _pad(n, 18) + hasil.dihapus[n] + ' baris');
  });

  Logger.log('');
  Logger.log('  murid dinonaktifkan : ' + hasil.murid_dinonaktifkan);
  Logger.log('  kelas diarsipkan    : ' + hasil.kelas_diarsipkan);

  var detik = Math.round((new Date() - mulai) / 1000);
  Logger.log('');
  Logger.log('=====================================');
  Logger.log('✅ SELESAI dalam ' + detik + ' detik.');
  Logger.log('');
  Logger.log('LANGKAH BERIKUTNYA');
  Logger.log('  1. Buat kelas baru, atau salin materi dari kelas');
  Logger.log('     lama lewat Kelola Kelas → Salin ke Kelas Lain');
  Logger.log('  2. Impor murid tahun ajaran baru');
  Logger.log('  3. Semua sesi berakhir — masuk ulang ke aplikasi');
  Logger.log('=====================================');
}


function cekNomorWa() {
  _hanyaEditor();
  Logger.log('=== CEK NOMOR WHATSAPP (v' + APP_VERSI + ') ===');
  Logger.log('');

  var head = Db.header('users');
  Logger.log('1. Kolom di sheet `users`');
  if (head.indexOf('no_wa') === -1) {
    Logger.log('   ❌ kolom `no_wa` TIDAK ADA — jalankan migrasiStruktur()');
    return;
  }
  Logger.log('   ✅ kolom `no_wa` ada di posisi ' +
             (head.indexOf('no_wa') + 1));

  var semua = Db.baca('users');
  var murid = [], guru = [];
  semua.forEach(function (u) {
    if (u.role === 'murid') murid.push(u);
    else if (u.role === 'guru') guru.push(u);
  });

  Logger.log('');
  Logger.log('2. Akun guru');
  guru.forEach(function (g) {
    var wa = Util.normalisasiWa(g.no_wa);
    Logger.log('   ' + (wa ? '✅' : '⚠️ ') + ' ' + g.nama +
               '  sel=' + JSON.stringify(g.no_wa) +
               '  → ' + (wa || 'KOSONG/TIDAK SAH'));
  });
  Logger.log('   (nomor guru dipakai tombol "Hubungi Guru" di layar murid)');

  Logger.log('');
  Logger.log('3. Murid — ' + murid.length + ' akun');

  var sah = 0, kosong = 0, rusak = [];
  murid.forEach(function (m) {
    var mentah = m.no_wa;
    var wa = Util.normalisasiWa(mentah);
    if (wa) { sah++; return; }
    if (mentah === '' || mentah === null || mentah === undefined) {
      kosong++;
      return;
    }
    rusak.push(m);
  });

  Logger.log('   ✅ nomor sah      : ' + sah);
  Logger.log('   ⚪ belum diisi    : ' + kosong);
  Logger.log('   ❌ terisi TAPI tidak terbaca : ' + rusak.length);

  if (rusak.length) {
    Logger.log('');
    Logger.log('   INILAH yang membuat tombol WhatsApp tidak muncul');
    Logger.log('   walau selnya kelihatan berisi:');
    rusak.forEach(function (m) {
      var t = typeof m.no_wa;
      Logger.log('     • ' + m.nama + ' (' + m.username + ')');
      Logger.log('       sel   : ' + JSON.stringify(m.no_wa));
      Logger.log('       tipe  : ' + t +
                 (t === 'number' ? '  ← tersimpan sebagai ANGKA' : ''));
      Logger.log('       digit : ' +
                 String(m.no_wa).replace(/[^0-9]/g, ''));
    });
    Logger.log('');
    Logger.log('   Perbaiki lewat Kelola Murid → Ubah, ketik ulang');
    Logger.log('   nomornya (mis. 081234567890) lalu Simpan.');
  }

  /* Contoh nyata: satu murid yang PUNYA nomor, ditelusuri sampai
     tautannya — supaya terlihat bahwa jalurnya memang utuh. */
  var contoh = null;
  for (var i = 0; i < murid.length; i++) {
    if (Util.normalisasiWa(murid[i].no_wa)) { contoh = murid[i]; break; }
  }
  Logger.log('');
  Logger.log('4. Uji satu tautan sungguhan');
  if (!contoh) {
    Logger.log('   ⚠️  Tidak ada murid dengan nomor sah — tombol memang');
    Logger.log('       tidak akan muncul untuk siapa pun.');
  } else {
    var t = Kelas.tautanPerbaikanWa(contoh.no_wa, contoh.nama,
      'Contoh LKPD', 'Contoh catatan guru.');
    Logger.log('   murid  : ' + contoh.nama);
    Logger.log('   tautan : ' + (t ? t.slice(0, 60) + '…' : '(GAGAL)'));
    Logger.log('   ' + (t ? '✅ jalur tautan BEKERJA' : '❌ jalur tautan gagal'));
  }

  Logger.log('');
  Logger.log('=====================================');
  if (rusak.length) {
    Logger.log('Ada ' + rusak.length + ' nomor yang perlu diketik ulang.');
  } else if (!sah) {
    Logger.log('Belum ada murid yang punya nomor WhatsApp.');
  } else {
    Logger.log('✅ ' + sah + ' murid siap dihubungi lewat WhatsApp.');
    Logger.log('   Bila tombol tetap tidak muncul, berkas UI belum');
    Logger.log('   tersalin — jalankan cekBerkasUI().');
  }
  Logger.log('=====================================');
}


function cekKesehatan() {
  _hanyaEditor();
  Logger.log('=== CEK KESEHATAN LessonLen v' + APP_VERSI + ' ===');
  var masalah = [];

  /* 1. modul termuat */
  var modul = { Util: typeof Util, Db: typeof Db,
                Auth: typeof Auth, Notif: typeof Notif, Kelas: typeof Kelas,
                Pertemuan: typeof Pertemuan, Beranda: typeof Beranda,
                Belajar: typeof Belajar, Lkpd: typeof Lkpd, Quiz: typeof Quiz,
                MateriPokok: typeof MateriPokok, Refleksi: typeof Refleksi,
                Rekap: typeof Rekap, Kelompok: typeof Kelompok,
                Ai: typeof Ai, ResetTahun: typeof ResetTahun };
  Logger.log('');
  Logger.log('1. Modul');
  Object.keys(modul).forEach(function (n) {
    if (modul[n] === 'object') Logger.log('   ✅ ' + n);
    else { Logger.log('   ❌ ' + n + ' TIDAK ADA'); masalah.push('modul ' + n); }
  });
  /* Setup.gs berisi fungsi lepas (bukan modul), jadi diperiksa berbeda */
  if (typeof migrasiStruktur === 'function' && typeof infoDatabase === 'function') {
    Logger.log('   ✅ Setup.gs (migrasiStruktur, infoDatabase)');
  } else {
    Logger.log('   ❌ Setup.gs TIDAK LENGKAP');
    masalah.push('Setup.gs');
  }

  /* 2. fungsi Db yang dipakai modul lain */
  Logger.log('');
  Logger.log('2. Fungsi Db (wajib ada setelah optimasi T6-OPT-5)');
  ['saringBaris', 'bacaBarisJika', 'cariBarisCache', 'cariBarisCache2',
   'titipBaris2', 'tulisProgres', 'epochProgres'].forEach(function (f) {
    if (typeof Db[f] === 'function') Logger.log('   ✅ Db.' + f + '()');
    else {
      Logger.log('   ❌ Db.' + f + '() TIDAK ADA — Db.gs belum diperbarui!');
      masalah.push('Db.' + f);
    }
  });

  /* 3. struktur sheet */
  Logger.log('');
  Logger.log('3. Sheet');
  /* Daftar dibaca dari URUTAN_SHEET, bukan ditulis ulang di sini.

     🔴 v1.9.11: daftar harfiah di tempat ini melewatkan `materi_pokok`
     dan `kelompok` — dua sheet yang justru paling sering bermasalah.
     Sheet yang hilang tidak akan pernah dilaporkan bila namanya lupa
     dicantumkan (§6.2 no. 45 & 70: baca dari sumbernya, jangan
     menyalin daftar). */
  var perlu = URUTAN_SHEET;
  var ss = Db.ss();
  perlu.forEach(function (n) {
    var sh = ss.getSheetByName(n);
    if (sh) Logger.log('   ✅ ' + n + ' (' + Math.max(0, sh.getLastRow() - 1) + ' baris)');
    else { Logger.log('   ❌ ' + n + ' TIDAK ADA'); masalah.push('sheet ' + n); }
  });

  /* 4. cache */
  Logger.log('');
  Logger.log('4. Layanan');
  try {
    CacheService.getScriptCache().put('cek_sehat', '1', 60);
    var v = CacheService.getScriptCache().get('cek_sehat');
    if (v === '1') Logger.log('   ✅ CacheService berfungsi');
    else { Logger.log('   ❌ CacheService tidak menyimpan'); masalah.push('cache'); }
  } catch (e) {
    Logger.log('   ❌ CacheService error: ' + e.message);
    masalah.push('cache');
  }
  try {
    var lock = LockService.getScriptLock();
    if (lock.tryLock(3000)) { lock.releaseLock(); Logger.log('   ✅ LockService berfungsi'); }
    else { Logger.log('   ⚠️ LockService sibuk (mungkin ada eksekusi lain)'); }
  } catch (e) {
    Logger.log('   ❌ LockService error: ' + e.message);
    masalah.push('lock');
  }

  /* 5. API key Gemini (Tahap 7) */
  Logger.log('');
  Logger.log('5. Generator AI');
  try {
    var stKey = Ai.statusKeys();
    if (!stKey.terpasang) {
      Logger.log('   ⚠️ API key BELUM dipasang — generator AI tidak dapat dipakai.');
      Logger.log('      Pasang lewat Beranda → 🔑 Status API Key, ' +
                 'atau jalankan pasangApiKeysManual().');
    } else {
      var siap = 0;
      stKey.key.forEach(function (x) { if (x.status === 'siap') siap++; });
      Logger.log('   ✅ ' + stKey.jml + ' key terpasang (' + siap + ' siap)');
      if (stKey.jml_bermasalah > 0) {
        Logger.log('   ⚠️ ' + stKey.jml_bermasalah + ' key bermasalah — ' +
                   'periksa Status API Key.');
      }
      if (stKey.jml < 3) {
        Logger.log('   ⚠️ Hanya ' + stKey.jml + ' key. Disarankan 10 key ' +
                   'dari 10 project agar kuota harian longgar.');
      }
    }
  } catch (e) {
    Logger.log('   ❌ Ai.gs bermasalah: ' + e.message);
    masalah.push('Ai.gs');
  }

  /* 6. trigger harian */
  Logger.log('');
  Logger.log('6. Trigger harian');
  var adaTrigger = false;
  try {
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (t.getHandlerFunction() === 'tugasHarianQuiz') adaTrigger = true;
    });
  } catch (e) {}
  if (adaTrigger) Logger.log('   ✅ tugasHarianQuiz terpasang');
  else Logger.log('   ⚠️ tugasHarianQuiz BELUM dipasang — attempt terbengkalai ' +
                  'tidak akan kedaluwarsa otomatis');

  Logger.log('');
  Logger.log('=====================================');
  if (!masalah.length) {
    Logger.log('✅ SEHAT — semua siap dipakai.');
  } else {
    Logger.log('❌ ADA ' + masalah.length + ' MASALAH:');
    masalah.forEach(function (m) { Logger.log('   • ' + m); });
    Logger.log('');
    Logger.log('Bila menyebut Db.<fungsi>, berarti Db.gs belum disalin ulang.');
    /* Petunjuk yang menunjuk SEBAB, bukan gejala (§6.2 no. 63).
       "modul Kelompok TIDAK ADA" membingungkan bila guru tidak tahu
       bahwa artinya sebuah berkas belum tersalin ke editor. */
    Logger.log('Bila menyebut "modul X", berarti berkas X.gs belum ada');
    Logger.log('di editor Apps Script — tambahkan file baru bernama X.gs');
    Logger.log('lalu salin isinya dari src/X.gs.');
  }
  Logger.log('=====================================');
}

/**
 * Pasang trigger harian untuk menandai attempt terbengkalai.
 * Aman dijalankan berulang — trigger lama dibuang lebih dulu.
 */
function pasangTriggerHarian() {
  _hanyaEditor();
  var jml = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'tugasHarianQuiz') {
      ScriptApp.deleteTrigger(t); jml++;
    }
  });
  ScriptApp.newTrigger('tugasHarianQuiz')
    .timeBased().atHour(1).everyDays(1).create();
  Logger.log('Trigger harian dipasang (sekitar pukul 01.00).');
  if (jml) Logger.log('(' + jml + ' trigger lama dihapus lebih dulu)');
}
