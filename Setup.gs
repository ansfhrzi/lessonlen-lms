/**
 * ============================================================
 *  LessonLen — Setup.gs
 *  Tahap 1: pembuat spreadsheet DB_LESSONLEN + seed data
 * ------------------------------------------------------------
 *  CARA PAKAI (sekali saja):
 *    1. Buat project Apps Script baru
 *    2. Tempel berkas ini
 *    3. Jalankan  setupLengkap()
 *    4. Izinkan akses saat diminta
 *    5. Salin DB_ID yang tampil di Log
 *
 *  FUNGSI LAIN:
 *    setupLengkap()      buat DB + seed contoh  (paling sering dipakai)
 *    setupDatabase()     buat DB tanpa seed
 *    isiSeedData()       tambahkan seed ke DB yang sudah ada
 *    hapusSeedData()     bersihkan seed, siap dipakai sungguhan
 *    resetTotal()        KOSONGKAN semua data (tetap simpan struktur)
 *    infoDatabase()      tampilkan ringkasan isi DB
 *
 *  Acuan: KESEPAKATAN-SISTEM.md v4.5 §11 · KONVENSI-TEKNIS.md v1.0
 * ============================================================
 */

var NAMA_DB = 'DB_LESSONLEN';

/* ============================================================
 *  DEFINISI 14 SHEET
 *  head  : nama kolom (urutan menentukan urutan kolom di sheet)
 *  lebar : lebar kolom piksel (opsional, default 120)
 *  enum  : validasi dropdown  { nama_kolom: [pilihan...] }
 *  wrap  : kolom yang dibungkus teks
 * ============================================================ */
var SKEMA = {

  users: {
    /* `nisn` & `no_wa` (v1.10.0): biodata murid.
       `email` sudah ada sejak Tahap 1.

       TIDAK ada kolom `biodata_lengkap` — status itu DIHITUNG dari
       terisinya `email` + `no_wa`. Menyimpan sesuatu yang bisa
       dihitung membuatnya cepat tidak sinkron: guru mengedit email
       murid lewat Kelola Murid, penandanya tertinggal.

       `no_wa` disimpan sudah TERNORMALISASI (62xxxxxxxxxx) supaya
       ekspor guru langsung dapat dipakai sebagai tautan wa.me. */
    head: ['user_id','username','password_hash','salt','pwd_awal','nama','role',
           'rombel','email','nisn','no_wa',
           'status','harus_ganti_password','last_login','created_at'],
    lebar: { user_id:90, username:120, password_hash:200, salt:120,
             pwd_awal:110, nama:180, role:80, rombel:110, email:180,
             nisn:120, no_wa:140, status:90,
             harus_ganti_password:110, last_login:140, created_at:140 },
    enum: { role: ['guru','murid'], status: ['aktif','nonaktif'],
            harus_ganti_password: [true,false] },
    /* Kolom yang isinya ANGKA tetapi harus diperlakukan sebagai TEKS.

       🔴 v1.10.4. NISN "0098765432" disimpan Sheets sebagai bilangan,
       sehingga nol di depannya HILANG dan tersimpan 98765432. Sama
       untuk nomor WA "6281234567890" yang bisa berubah jadi notasi
       ilmiah pada nomor panjang.

       Tidak ada galat, tidak ada peringatan — nilainya sekadar
       berubah. Dipasang `setNumberFormat('@')` supaya Sheets
       menyimpannya apa adanya. */
    teks: ['nisn','no_wa','username','pwd_awal','rombel']
  },

  kelas: {
    head: ['kelas_id','nama_kelas','mapel','jenjang','fase','tingkat',
           'kompetensi_keahlian','capaian_pembelajaran','catatan_gaya',
           'alokasi_jp','status','created_at'],
    lebar: { kelas_id:90, nama_kelas:150, mapel:260, jenjang:80, fase:60,
             tingkat:70, kompetensi_keahlian:200, capaian_pembelajaran:420,
             catatan_gaya:220, alokasi_jp:90, status:90, created_at:140 },
    enum: { jenjang: ['SD','SMP','SMA','SMK'],
            fase: ['A','B','C','D','E','F'],
            tingkat: ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'],
            status: ['aktif','arsip'] },
    wrap: ['capaian_pembelajaran','catatan_gaya','mapel']
  },

  enrollment: {
    head: ['enroll_id','kelas_id','user_id','tanggal_daftar','status'],
    lebar: { enroll_id:100, kelas_id:90, user_id:90,
             tanggal_daftar:140, status:90 },
    enum: { status: ['aktif','keluar'] }
  },

  /* Tingkat teratas isi kelas. Satu Materi Pokok memuat beberapa
     pertemuan, ditambah pertemuan khusus Ujian/UH dan Refleksi.
     ±12 kelas x 5 materi pokok = 60 baris/tahun. */
  materi_pokok: {
    head: ['mp_id','kelas_id','urutan','judul','deskripsi',
           'tujuan_pembelajaran','wajib','urut_ketat','status',
           'created_at','updated_at'],
    lebar: { mp_id:110, kelas_id:90, urutan:70, judul:240,
             deskripsi:300, tujuan_pembelajaran:320, wajib:70,
             urut_ketat:90, status:90, created_at:140, updated_at:140 },
    enum: { wajib:[true,false], urut_ketat:[true,false],
            status:['draft','publish'] },
    wrap: ['deskripsi','tujuan_pembelajaran']
  },

  pertemuan: {
    head: ['pertemuan_id','mp_id','kelas_id','urutan','judul','deskripsi',
           'tujuan_pembelajaran','jenis','wajib','urut_ketat','status',
           'created_at','updated_at'],
    lebar: { pertemuan_id:110, mp_id:110, kelas_id:90, urutan:70, judul:220,
             deskripsi:280, tujuan_pembelajaran:320, jenis:100, wajib:70,
             urut_ketat:90, status:90, created_at:140, updated_at:140 },
    enum: { jenis:['biasa','ujian','refleksi'],
            wajib:[true,false], urut_ketat:[true,false],
            status:['draft','publish'] },
    wrap: ['deskripsi','tujuan_pembelajaran']
  },

  item: {
    head: ['item_id','pertemuan_id','mp_id','kelas_id','tipe','urutan','judul',
           'tujuan_pembelajaran','deskripsi','konten','jml_bagian','wajib',
           'min_durasi_detik','batas_waktu','acak_soal','acak_opsi',
           'tampilkan_pembahasan','batas_waktu_menit','kkm','max_percobaan',
           'sumber_ai','ai_ditinjau','status','created_at','updated_at'],
    lebar: { item_id:90, pertemuan_id:110, mp_id:110, kelas_id:90,
             tipe:80, urutan:70,
             judul:220, tujuan_pembelajaran:300, deskripsi:280, konten:400,
             jml_bagian:90, wajib:70, min_durasi_detik:110, batas_waktu:140,
             acak_soal:90, acak_opsi:90, tampilkan_pembahasan:130,
             batas_waktu_menit:120, kkm:70, max_percobaan:110,
             sumber_ai:90, ai_ditinjau:100, status:90,
             created_at:140, updated_at:140 },
    enum: { tipe:['materi','lkpd','quiz','refleksi','tugas_kelompok'],
            wajib:[true,false],
            acak_soal:[true,false], acak_opsi:[true,false],
            tampilkan_pembahasan:[true,false], sumber_ai:[true,false],
            ai_ditinjau:[true,false], status:['draft','publish'] },
    wrap: ['konten','deskripsi','tujuan_pembelajaran']
  },

  progress: {
    head: ['progress_id','user_id','item_id','pertemuan_id','mp_id',
           'kelas_id','tipe',
           'status','bagian_terakhir','nilai','percobaan','dibuka_paksa',
           'alasan_paksa','waktu_buka','waktu_selesai','updated_at'],
    lebar: { progress_id:110, user_id:90, item_id:90, pertemuan_id:110,
             mp_id:110, kelas_id:90, tipe:80, status:110, bagian_terakhir:110,
             nilai:70, percobaan:90, dibuka_paksa:100, alasan_paksa:200,
             waktu_buka:140, waktu_selesai:140, updated_at:140 },
    enum: { tipe:['materi','lkpd','quiz','refleksi','tugas_kelompok'],
            status:['berjalan','menunggu','gagal','selesai'],
            dibuka_paksa:[true,false] }
  },

  soal: {
    /* grup_id & stimulus: soal berbasis teks bacaan (wacana, dialog,
       puisi). Beberapa soal berbagi SATU bacaan; bacaannya disimpan
       sekali pada soal pertama kelompok, bukan diulang tiap soal.
       Kolom kosong = soal mandiri, seperti sebelumnya. */
    head: ['soal_id','item_id','grup_id','stimulus','nomor','tipe',
           'pertanyaan','gambar_url','opsi',
           'kunci','bobot','pembahasan','tingkat','sumber_ai','created_at'],
    lebar: { soal_id:90, item_id:90, grup_id:90, stimulus:400, nomor:70,
             tipe:110, pertanyaan:360,
             gambar_url:200, opsi:320, kunci:100, bobot:70,
             pembahasan:320, tingkat:90, sumber_ai:90, created_at:140 },
    enum: { tipe:['pg','benar_salah','isian','esai'],
            tingkat:['mudah','sedang','sulit'], sumber_ai:[true,false] },
    wrap: ['stimulus','pertanyaan','opsi','pembahasan']
  },

  quiz_attempt: {
    /* `terlambat` (v1.9.0): quiz kini bertenggat TANGGAL seperti LKPD,
       bukan timer hitung mundur. Lewat tenggat tetap boleh
       mengumpulkan dan nilainya tetap dihitung penuh — yang berubah
       hanya penandanya di layar guru. */
    head: ['attempt_id','user_id','item_id','kelas_id','percobaan_ke','status',
           'urutan_soal','jawaban','skor','skor_maks','nilai','lulus',
           'terlambat','catatan_guru','dibaca_murid',
           'mulai_at','selesai_at','dikoreksi_at'],
    lebar: { attempt_id:110, user_id:90, item_id:90, kelas_id:90,
             percobaan_ke:100, status:130, urutan_soal:260, jawaban:360,
             skor:70, skor_maks:90, nilai:70, lulus:70, terlambat:90,
             catatan_guru:300, dibaca_murid:100,
             mulai_at:140, selesai_at:140, dikoreksi_at:140 },
    enum: { status:['berjalan','menunggu_koreksi','selesai','kedaluwarsa'],
            lulus:[true,false], terlambat:[true,false],
            dibaca_murid:[true,false] },
    wrap: ['urutan_soal','jawaban','catatan_guru']
  },

  /* Sheet ini menampung TIGA jenis pengumpulan:
     - LKPD perorangan (sejak Tahap 6A)
     - jawaban refleksi   (v1.2.0 — links dipakai ulang untuk JSON)
     - tugas kelompok     (v1.7.0 — kelompok_id & nilai_anggota terisi)
     Dipakai ulang, bukan tabel baru: statusnya, penilaiannya, dan
     umpan baliknya identik. */
  lkpd_submission: {
    head: ['submission_id','user_id','item_id','kelas_id','revisi_ke','links',
           'catatan_murid','status','terlambat','nilai','catatan_guru',
           'dibaca_murid','kelompok_id','nilai_anggota',
           'waktu_kumpul','waktu_dinilai'],
    lebar: { submission_id:120, user_id:90, item_id:90, kelas_id:90,
             revisi_ke:90, links:340, catatan_murid:260, status:130,
             terlambat:90, nilai:70, catatan_guru:300, dibaca_murid:100,
             kelompok_id:110, nilai_anggota:200,
             waktu_kumpul:140, waktu_dinilai:140 },
    enum: { status:['draft','menunggu','dinilai_proses','diterima','ditolak'],
            terlambat:[true,false], dibaca_murid:[true,false] },
    wrap: ['links','catatan_murid','catatan_guru']
  },

  /* Kelompok kerja untuk item bertipe `tugas_kelompok`.
     Anggota disimpan sebagai JSON larik user_id — bukan satu baris
     per anggota — karena selalu dibaca sebagai satu kesatuan dan
     jumlahnya kecil (3-6 orang). */
  kelompok: {
    head: ['kelompok_id','item_id','kelas_id','nama','ketua_user_id',
           'anggota','urutan','created_at'],
    lebar: { kelompok_id:110, item_id:90, kelas_id:90, nama:160,
             ketua_user_id:110, anggota:300, urutan:70, created_at:140 },
    wrap: ['anggota']
  },

  materi_ai: {
    head: ['ai_id','item_id','kelas_id','prompt_ringkas','konten_hasil',
           'saran_soal','saran_lkpd','model','key_index','token_terpakai',
           'durasi_ms','status','error','dibuat_at'],
    lebar: { ai_id:90, item_id:90, kelas_id:90, prompt_ringkas:300,
             konten_hasil:400, saran_soal:340, saran_lkpd:280, model:150,
             key_index:80, token_terpakai:110, durasi_ms:90, status:90,
             error:240, dibuat_at:140 },
    enum: { status:['sukses','gagal','antre'] },
    wrap: ['prompt_ringkas','konten_hasil','saran_soal','saran_lkpd','error']
  },

  notifikasi: {
    head: ['notif_id','user_id','jenis','judul','pesan','link','dibaca','dibuat_at'],
    lebar: { notif_id:100, user_id:90, jenis:150, judul:220,
             pesan:340, link:220, dibaca:80, dibuat_at:140 },
    enum: { jenis:['enroll_kelas','pertemuan_baru','lkpd_dinilai','quiz_dikoreksi',
                   'feedback_baru','quiz_gagal_habis','lkpd_masuk','permintaan_reset',
                   'refleksi_dibalas'],
            dibaca:[true,false] },
    wrap: ['pesan']
  },

  permintaan_reset: {
    head: ['request_id','user_id','input_user','status','dibuat_at','diproses_at'],
    lebar: { request_id:110, user_id:90, input_user:160, status:110,
             dibuat_at:140, diproses_at:140 },
    enum: { status:['antre','selesai','kedaluwarsa'] }
  },

  session: {
    head: ['token','user_id','dibuat_at','expired_at'],
    lebar: { token:300, user_id:90, dibuat_at:140, expired_at:140 }
  },

  log: {
    head: ['log_id','user_id','aksi','detail','status','timestamp'],
    lebar: { log_id:100, user_id:90, aksi:180, detail:420,
             status:90, timestamp:140 },
    wrap: ['detail']
  }
};

/* urutan tab di spreadsheet */
var URUTAN_SHEET = ['users','kelas','enrollment','materi_pokok',
  'pertemuan','item','progress',
  'soal','quiz_attempt','lkpd_submission','kelompok','materi_ai','notifikasi',
  'permintaan_reset','session','log'];

/* ============================================================
 *  FUNGSI UTAMA
 * ============================================================ */

/** Buat database + isi seed. Jalankan ini untuk memulai. */
function setupLengkap() {
  _hanyaEditor();
  var id = setupDatabase();
  isiSeedData();
  Logger.log('');
  Logger.log('==================================================');
  Logger.log(' SETUP LENGKAP SELESAI');
  Logger.log(' DB_ID: ' + id);
  Logger.log(' URL  : https://docs.google.com/spreadsheets/d/' + id);
  Logger.log('');
  Logger.log(' Login contoh:');
  Logger.log('   guru  → username: guru     password: guru123');
  Logger.log('   murid → username: siswa01  password: siswa123');
  Logger.log('');
  Logger.log(' Setelah siap dipakai sungguhan: jalankan hapusSeedData()');
  Logger.log('==================================================');
  return id;
}

/** Buat spreadsheet + 15 sheet berikut header, validasi, format. */
function setupDatabase() {
  _hanyaEditor();
  var P = PropertiesService.getScriptProperties();
  var idLama = P.getProperty('DB_ID');

  var ss;
  if (idLama) {
    try {
      ss = SpreadsheetApp.openById(idLama);
      Logger.log('Memakai DB yang sudah ada: ' + idLama);
    } catch (e) {
      Logger.log('DB_ID lama tidak dapat dibuka, membuat baru…');
      ss = null;
    }
  }
  if (!ss) {
    ss = SpreadsheetApp.create(NAMA_DB);
    P.setProperty('DB_ID', ss.getId());
    Logger.log('Spreadsheet dibuat: ' + ss.getId());
  }

  ss.setSpreadsheetTimeZone('Asia/Jakarta');

  URUTAN_SHEET.forEach(function (nama) {
    _buatSheet(ss, nama, SKEMA[nama]);
  });

  /* hapus sheet bawaan bila masih ada */
  ['Sheet1','Sheet 1','Helaian1'].forEach(function (n) {
    var sh = ss.getSheetByName(n);
    if (sh && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });

  /* susun ulang urutan tab */
  URUTAN_SHEET.forEach(function (nama, i) {
    var sh = ss.getSheetByName(nama);
    if (sh) { ss.setActiveSheet(sh); ss.moveActiveSheet(i + 1); }
  });
  ss.setActiveSheet(ss.getSheetByName('users'));

  _pasangCounter();

  Logger.log('Struktur ' + URUTAN_SHEET.length + ' sheet siap.');
  return ss.getId();
}

/**
 * Buat satu sheet lengkap dengan header, format, validasi.
 *
 * CATATAN: fungsi ini memakai getRange() di dalam loop — pengecualian
 * yang disengaja terhadap KONVENSI-TEKNIS.md §6.2 aturan 1. Alasannya:
 * pemformatan kolom (lebar, validasi, format tanggal) hanya bisa
 * diterapkan per kolom, dan fungsi ini hanya dijalankan SEKALI saat
 * pembuatan database — bukan operasi data berulang.
 */
function _buatSheet(ss, nama, def) {
  var sh = ss.getSheetByName(nama);
  if (!sh) sh = ss.insertSheet(nama);

  var head = def.head;

  /* --- header --- */
  sh.getRange(1, 1, 1, head.length)
    .setValues([head])
    .setFontWeight('bold')
    .setFontColor('#FFFFFF')
    .setBackground('#4E9A4A')          /* hijau tua, palet resmi */
    .setVerticalAlignment('middle')
    .setHorizontalAlignment('left');

  sh.setFrozenRows(1);
  sh.setRowHeight(1, 34);

  /* --- lebar kolom --- */
  head.forEach(function (kol, i) {
    var w = (def.lebar && def.lebar[kol]) ? def.lebar[kol] : 120;
    sh.setColumnWidth(i + 1, w);
  });

  /* --- bungkus teks pada kolom panjang --- */
  (def.wrap || []).forEach(function (kol) {
    var i = head.indexOf(kol);
    if (i >= 0) {
      sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1)
        .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
    }
  });

  /* --- kolom angka-yang-sebenarnya-teks (v1.10.4) --- */
  _pasangFormatTeks(sh, def);

  /* --- validasi dropdown --- */
  if (def.enum) {
    Object.keys(def.enum).forEach(function (kol) {
      var i = head.indexOf(kol);
      if (i < 0) return;
      var pilihan = def.enum[kol].map(function (v) { return v; });
      var rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(pilihan, true)
        .setAllowInvalid(false)
        .setHelpText('Pilihan: ' + pilihan.join(', '))
        .build();
      sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setDataValidation(rule);
    });
  }

  /* --- format tanggal --- */
  head.forEach(function (kol, i) {
    if (/_at$|^waktu_|^tanggal_|^last_login$|^batas_waktu$|^timestamp$/.test(kol)) {
      sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1)
        .setNumberFormat('yyyy-mm-dd hh:mm:ss');
    }
  });

  /* --- baris selang-seling --- */
  try {
    sh.getBandings().forEach(function (b) { b.remove(); });
    sh.getRange(1, 1, sh.getMaxRows(), head.length)
      .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false);
  } catch (e) { /* abaikan bila gagal */ }

  /* --- buang kolom berlebih --- */
  var maxKol = sh.getMaxColumns();
  if (maxKol > head.length) sh.deleteColumns(head.length + 1, maxKol - head.length);

  /* --- proteksi header --- */
  try {
    sh.getProtections(SpreadsheetApp.ProtectionType.RANGE)
      .forEach(function (p) { if (p.canEdit()) p.remove(); });
    sh.getRange(1, 1, 1, head.length)
      .protect()
      .setDescription('Header ' + nama + ' — jangan diubah')
      .setWarningOnly(true);
  } catch (e) { /* abaikan */ }
}

/** Siapkan counter ID agar tidak bertabrakan. */
function _pasangCounter() {
  _hanyaEditor();
  var P = PropertiesService.getScriptProperties();

  /* template umpan balik bawaan (§6.4.4) */
  if (P.getProperty('TEMPLATE_FEEDBACK') === null) {
    P.setProperty('TEMPLATE_FEEDBACK', JSON.stringify([
      'Kerja bagus, pertahankan.',
      'Sudah benar, tetapi kurang lengkap pada bagian ',
      'Tautan tidak dapat dibuka. Mohon periksa pengaturan berbagi menjadi "Siapa saja yang memiliki tautan".',
      'Silakan pelajari kembali materi, lalu kerjakan ulang.',
      'Analisis sudah tepat. Lain kali sertakan tangkapan layar hasil pengujian.',
      'Format penulisan perlu dirapikan.'
    ]));
  }
  ['USR','KLS','ENR','PTM','ITM','PRG','SOL','ATT','LKP','AI','NTF','RST','LOG']
    .forEach(function (p) {
      if (P.getProperty('CTR_' + p) === null) P.setProperty('CTR_' + p, '0');
    });
}

/* ============================================================
 *  UTILITAS INTERNAL
 *
 *  SELURUHNYA berpenjaga `_hanyaEditor()` (v1.17.1), kecuali
 *  `_pad()` yang murni merapikan teks untuk Logger.
 *
 *  Alasannya: `google.script.run` dapat memanggil SETIAP fungsi
 *  global, termasuk yang berawalan garis bawah — awalan itu konvensi
 *  manusia, bukan pembatas akses. Yang menentukan sebuah fungsi bisa
 *  dipanggil dari peramban adalah ARGUMENNYA: bila semua argumen
 *  bisa diserialkan (string, angka, larik, objek biasa), fungsi itu
 *  terjangkau.
 *
 *  Karena itu enam fungsi di bawah dijaga, sedangkan `_buatSheet()`,
 *  `_hapusBarisJika()`, `_enumBerubah()`, `_pasangFormatTeks()`,
 *  `_pasangValidasi()`, dan `_formatUlang()` TIDAK — semuanya
 *  menuntut objek Spreadsheet/Sheet sebagai argumen pertama, yang
 *  tidak bisa dikirim dari peramban.
 * ============================================================ */

function _db() {
  _hanyaEditor();
  var id = PropertiesService.getScriptProperties().getProperty('DB_ID');
  if (!id) throw new Error('DB_ID belum ada. Jalankan setupDatabase() dulu.');
  return SpreadsheetApp.openById(id);
}

function _buatId(prefix) {
  _hanyaEditor();
  var P = PropertiesService.getScriptProperties();
  var k = 'CTR_' + prefix;
  var n = Number(P.getProperty(k) || 0) + 1;
  P.setProperty(k, String(n));
  return prefix + '-' + ('0000' + n).slice(-4);
}

function _salt() {
  _hanyaEditor();
  var c = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var s = '';
  for (var i = 0; i < 16; i++) s += c.charAt(Math.floor(Math.random() * c.length));
  return s;
}

function _hash(password, salt) {
  /* Dijaga karena ini ORACLE HASH: dari peramban orang bisa meminta
     hash untuk sandi dan salt apa pun. Tidak berguna sendirian,
     tetapi menjadi langkah tengah rantai pembuatan akun guru palsu
     bersama `_salt()` dan `_tambah()`. */
  _hanyaEditor();
  return Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256, salt + password, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); })
    .join('');
}

/** Tambah banyak baris sekaligus (satu setValues). */
function _tambah(nama, objArr) {
  /* 🔴 WAJIB. Ini celah paling parah di seluruh proyek, dan baru
     ketahuan saat audit v1.17.1.

     `_tambah()` menerima DUA argumen yang bisa diserialkan peramban:
     nama sheet (string) dan larik baris (objek biasa). Artinya
     `google.script.run._tambah('users', [{…}])` benar-benar bisa
     dipanggil murid dari browser — dan menulis baris apa pun ke
     sheet APA PUN.

     Yang membuatnya berbahaya bukan korupsi data, tapi eskalasi
     hak: cukup satu panggilan untuk menyisipkan baris `users`
     ber-`role: 'guru'`, lalu masuk sebagai guru. Seluruh penjaga
     peran di `_bungkus()` dilewati karena akunnya memang guru.

     Rantainya lengkap dari browser: `_salt()` memberi salt,
     `_hash(sandi, salt)` memberi hash yang sah, `_tambah()`
     menanam barisnya. Ketiganya kini dijaga. */
  _hanyaEditor();
  if (!objArr || !objArr.length) return;
  var sh = _db().getSheetByName(nama);
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var baris = objArr.map(function (o) {
    return head.map(function (h) { return o[h] !== undefined ? o[h] : ''; });
  });
  sh.getRange(sh.getLastRow() + 1, 1, baris.length, head.length).setValues(baris);
}

/* ============================================================
 *  SEED DATA — contoh PKPJ / TJKT
 *  Semua baris seed diberi penanda [CONTOH] agar mudah dikenali
 * ============================================================ */

function isiSeedData() {
  _hanyaEditor();
  var ss = _db();
  if (ss.getSheetByName('users').getLastRow() > 1) {
    Logger.log('Data sudah ada — seed dilewati. Pakai resetTotal() bila ingin mengosongkan.');
    return;
  }

  var now = new Date();
  var CP = 'Pada akhir fase F, peserta didik mampu memasang perangkat jaringan ' +
    'ke dalam sistem jaringan, mengganti perangkat jaringan sesuai dengan kebutuhan, ' +
    'menjelaskan konsep VLAN, mengkonfigurasi dan menguji VLAN, memahami proses routing ' +
    'dan jenis-jenis routing, mengkonfigurasi, menganalisis permasalahan dan memperbaiki ' +
    'konfigurasi routing statis dan routing dinamis, mengkonfigurasi NAT, menganalisis ' +
    'permasalahan internet gateway dan memperbaiki konfigurasi NAT, mengkonfigurasi, ' +
    'menganalisis permasalahan dan memperbaiki konfigurasi proxy server, manajemen ' +
    'bandwidth dan load balancing.';

  /* ---------- users ---------- */
  var saltGuru = _salt();
  var guru = {
    user_id: _buatId('USR'), username: 'guru',
    password_hash: _hash('guru123', saltGuru), salt: saltGuru,
    pwd_awal: 'guru123',
    nama: 'Guru PKPJ', role: 'guru', email: '',
    status: 'aktif', harus_ganti_password: false,
    last_login: '', created_at: now
  };

  var murid = [];
  ['Ahmad Fauzi','Bella Kusuma','Candra Wijaya'].forEach(function (nm, i) {
    var s = _salt();
    murid.push({
      user_id: _buatId('USR'),
      username: 'siswa0' + (i + 1),
      password_hash: _hash('siswa123', s), salt: s,
      pwd_awal: 'siswa123',
      nama: '[CONTOH] ' + nm, role: 'murid', email: '',
      status: 'aktif', harus_ganti_password: false,
      last_login: '', created_at: now
    });
  });
  _tambah('users', [guru].concat(murid));

  /* ---------- kelas ---------- */
  var kelas = {
    kelas_id: _buatId('KLS'),
    nama_kelas: '[CONTOH] XI TJKT 1',
    mapel: 'Pemasangan dan Konfigurasi Peralatan Jaringan (PKPJ)',
    jenjang: 'SMK', fase: 'F', tingkat: 'XI',
    kompetensi_keahlian: 'Teknik Jaringan Komputer dan Telekomunikasi (TJKT)',
    capaian_pembelajaran: CP,
    catatan_gaya: 'Gunakan contoh perangkat MikroTik dan Cisco Packet Tracer. ' +
                  'Bahasa lugas, banyak analogi praktis.',
    alokasi_jp: 6, status: 'aktif', created_at: now
  };
  _tambah('kelas', [kelas]);

  /* ---------- enrollment ---------- */
  _tambah('enrollment', murid.map(function (m) {
    return { enroll_id: _buatId('ENR'), kelas_id: kelas.kelas_id,
             user_id: m.user_id, tanggal_daftar: now, status: 'aktif' };
  }));

  /* ---------- pertemuan 1 ---------- */
  var p1 = {
    pertemuan_id: _buatId('PTM'), kelas_id: kelas.kelas_id, urutan: 1,
    judul: 'Konsep Dasar VLAN',
    deskripsi: 'Memahami pengertian, manfaat, dan cara kerja VLAN pada jaringan switch.',
    tujuan_pembelajaran: 'Peserta didik mampu menjelaskan konsep VLAN dan ' +
      'mengidentifikasi manfaatnya dalam segmentasi jaringan.',
    wajib: true, urut_ketat: true, status: 'publish',
    created_at: now, updated_at: now
  };

  var p2 = {
    pertemuan_id: _buatId('PTM'), kelas_id: kelas.kelas_id, urutan: 2,
    judul: 'Konfigurasi dan Pengujian VLAN',
    deskripsi: 'Praktik membuat VLAN, menetapkan port, dan menguji konektivitas.',
    tujuan_pembelajaran: 'Peserta didik mampu mengkonfigurasi VLAN pada switch ' +
      'dan menguji hasil konfigurasinya.',
    wajib: true, urut_ketat: true, status: 'publish',
    created_at: now, updated_at: now
  };
  _tambah('pertemuan', [p1, p2]);

  /* ---------- item pertemuan 1 ---------- */
  var m1Konten =
    '<h3>Pengertian VLAN</h3>' +
    '<p><b>VLAN</b> (<i>Virtual Local Area Network</i>) adalah metode membagi ' +
    'satu jaringan fisik menjadi beberapa jaringan logis yang saling terpisah. ' +
    'Meskipun perangkat terhubung ke switch yang sama, VLAN membuat mereka ' +
    'seolah berada di jaringan berbeda.</p>' +
    '<p>Analogi sederhana: satu gedung sekolah (switch) dibagi menjadi ' +
    'beberapa ruang kelas (VLAN). Siswa di ruang A tidak bisa langsung ' +
    'berbicara dengan siswa di ruang B tanpa melewati koridor (router).</p>' +
    '<p data-saran-gambar="Ilustrasi satu switch fisik dibagi menjadi tiga VLAN berwarna berbeda"></p>' +
    '<!--bagian-->' +
    '<h3>Manfaat VLAN</h3>' +
    '<ul>' +
    '<li><b>Keamanan</b> — lalu lintas antar-VLAN terisolasi.</li>' +
    '<li><b>Efisiensi</b> — <i>broadcast domain</i> mengecil sehingga jaringan lebih ringan.</li>' +
    '<li><b>Fleksibilitas</b> — pengelompokan berdasarkan fungsi, bukan lokasi fisik.</li>' +
    '<li><b>Penghematan</b> — tidak perlu membeli switch terpisah tiap kelompok.</li>' +
    '</ul>' +
    '<p>Contoh di sekolah: VLAN 10 untuk Lab Komputer, VLAN 20 untuk Ruang Guru, ' +
    'VLAN 30 untuk Tata Usaha. Ketiganya memakai switch yang sama namun tidak ' +
    'saling mengganggu.</p>' +
    '<!--bagian-->' +
    '<h3>Jenis VLAN</h3>' +
    '<table>' +
    '<thead><tr><th>Jenis</th><th>Dasar Pengelompokan</th></tr></thead>' +
    '<tbody>' +
    '<tr><td>Port-based</td><td>Nomor port pada switch</td></tr>' +
    '<tr><td>MAC-based</td><td>Alamat MAC perangkat</td></tr>' +
    '<tr><td>Protocol-based</td><td>Protokol yang digunakan</td></tr>' +
    '</tbody></table>' +
    '<p>Di lapangan, <b>port-based VLAN</b> paling sering dipakai karena ' +
    'paling sederhana dikonfigurasi dan dirawat.</p>';

  var i1 = {
    item_id: _buatId('ITM'), pertemuan_id: p1.pertemuan_id,
    kelas_id: kelas.kelas_id, tipe: 'materi', urutan: 1,
    judul: 'Apa itu VLAN',
    tujuan_pembelajaran: 'Menjelaskan pengertian, manfaat, dan jenis VLAN.',
    deskripsi: 'Pengenalan konsep VLAN beserta manfaat dan jenis-jenisnya.',
    konten: m1Konten, jml_bagian: 3, wajib: true, min_durasi_detik: 0,
    batas_waktu: '', acak_soal: '', acak_opsi: '', tampilkan_pembahasan: '',
    batas_waktu_menit: '', kkm: '', max_percobaan: '',
    sumber_ai: false, ai_ditinjau: false, status: 'publish',
    created_at: now, updated_at: now
  };

  var i2 = {
    item_id: _buatId('ITM'), pertemuan_id: p1.pertemuan_id,
    kelas_id: kelas.kelas_id, tipe: 'lkpd', urutan: 2,
    judul: 'LKPD 1 — Identifikasi Kebutuhan VLAN',
    tujuan_pembelajaran: 'Merancang pembagian VLAN untuk studi kasus sekolah.',
    deskripsi: 'Latihan merancang skema VLAN berdasarkan kebutuhan nyata.',
    konten:
      '<h3>Petunjuk Kerja</h3>' +
      '<ol>' +
      '<li>Amati denah jaringan sekolah pada tautan berikut.</li>' +
      '<li>Tentukan pembagian VLAN yang sesuai, minimal 3 VLAN.</li>' +
      '<li>Buat tabel: nomor VLAN, nama, rentang port, dan alasan pemilihan.</li>' +
      '<li>Simpan pekerjaan sebagai Google Docs atau PDF.</li>' +
      '<li>Atur berbagi menjadi <b>Siapa saja yang memiliki tautan</b>.</li>' +
      '<li>Tempel tautannya pada kolom pengumpulan di bawah.</li>' +
      '</ol>' +
      '<h3>Kriteria Penilaian</h3>' +
      '<ul>' +
      '<li>Ketepatan pembagian VLAN — 40%</li>' +
      '<li>Alasan yang logis — 30%</li>' +
      '<li>Kerapian tabel — 20%</li>' +
      '<li>Ketepatan waktu — 10%</li>' +
      '</ul>',
    jml_bagian: 1, wajib: true, min_durasi_detik: '',
    batas_waktu: '', acak_soal: '', acak_opsi: '', tampilkan_pembahasan: '',
    batas_waktu_menit: '', kkm: '', max_percobaan: '',
    sumber_ai: false, ai_ditinjau: false, status: 'publish',
    created_at: now, updated_at: now
  };

  var i3 = {
    item_id: _buatId('ITM'), pertemuan_id: p1.pertemuan_id,
    kelas_id: kelas.kelas_id, tipe: 'quiz', urutan: 3,
    judul: 'Quiz 1 — Konsep VLAN',
    tujuan_pembelajaran: 'Mengukur pemahaman konsep dasar VLAN.',
    deskripsi: 'Lima soal pilihan ganda seputar konsep VLAN.',
    konten: '', jml_bagian: '', wajib: true, min_durasi_detik: '',
    batas_waktu: '', acak_soal: true, acak_opsi: true,
    tampilkan_pembahasan: true, batas_waktu_menit: 15,
    kkm: 75, max_percobaan: 3,
    sumber_ai: false, ai_ditinjau: false, status: 'publish',
    created_at: now, updated_at: now
  };

  /* ---------- item pertemuan 2 ---------- */
  var i4 = {
    item_id: _buatId('ITM'), pertemuan_id: p2.pertemuan_id,
    kelas_id: kelas.kelas_id, tipe: 'materi', urutan: 1,
    judul: 'Langkah Konfigurasi VLAN',
    tujuan_pembelajaran: 'Menjelaskan tahapan konfigurasi VLAN pada switch.',
    deskripsi: 'Urutan perintah membuat dan menetapkan VLAN.',
    konten:
      '<h3>Membuat VLAN</h3>' +
      '<p>Masuk ke mode konfigurasi global, lalu buat VLAN dengan penomoran ' +
      'yang telah direncanakan.</p>' +
      '<pre>Switch&gt; enable\n' +
      'Switch# configure terminal\n' +
      'Switch(config)# vlan 10\n' +
      'Switch(config-vlan)# name LAB_KOMPUTER\n' +
      'Switch(config-vlan)# exit</pre>' +
      '<!--bagian-->' +
      '<h3>Menetapkan Port ke VLAN</h3>' +
      '<p>Setelah VLAN dibuat, tetapkan port mana saja yang menjadi anggotanya.</p>' +
      '<pre>Switch(config)# interface range fa0/1-8\n' +
      'Switch(config-if-range)# switchport mode access\n' +
      'Switch(config-if-range)# switchport access vlan 10\n' +
      'Switch(config-if-range)# exit</pre>' +
      '<p>Verifikasi dengan perintah <code>show vlan brief</code>.</p>',
    jml_bagian: 2, wajib: true, min_durasi_detik: 0,
    batas_waktu: '', acak_soal: '', acak_opsi: '', tampilkan_pembahasan: '',
    batas_waktu_menit: '', kkm: '', max_percobaan: '',
    sumber_ai: false, ai_ditinjau: false, status: 'publish',
    created_at: now, updated_at: now
  };

  _tambah('item', [i1, i2, i3, i4]);

  /* ---------- soal quiz ---------- */
  var soal = [
    { p:'Apa fungsi utama VLAN pada jaringan?',
      o:['Memisahkan broadcast domain secara logis',
         'Menambah kecepatan kabel jaringan',
         'Mengganti alamat IP otomatis',
         'Mempercepat proses routing'],
      k:'A', b:'VLAN membagi satu jaringan fisik menjadi beberapa broadcast domain logis.' },
    { p:'Jenis VLAN yang paling umum digunakan karena kemudahannya adalah…',
      o:['MAC-based VLAN','Port-based VLAN','Protocol-based VLAN','Dynamic VLAN'],
      k:'B', b:'Port-based VLAN paling sederhana dikonfigurasi dan dirawat.' },
    { p:'Perintah untuk melihat daftar VLAN pada switch Cisco adalah…',
      o:['show ip route','show running-config','show vlan brief','show interfaces'],
      k:'C', b:'Perintah show vlan brief menampilkan ringkasan VLAN dan port anggotanya.' },
    { p:'Manakah yang BUKAN manfaat VLAN?',
      o:['Meningkatkan keamanan','Mengurangi broadcast',
         'Menambah bandwidth fisik kabel','Mempermudah pengelompokan'],
      k:'C', b:'VLAN bekerja pada tingkat logis; kapasitas fisik kabel tidak berubah.' },
    { p:'Agar dua VLAN dapat saling berkomunikasi, diperlukan…',
      o:['Hub tambahan','Router atau switch layer 3','Kabel crossover','Repeater'],
      k:'B', b:'Komunikasi antar-VLAN memerlukan perangkat layer 3 (inter-VLAN routing).' }
  ];

  _tambah('soal', soal.map(function (s, i) {
    return {
      soal_id: _buatId('SOL'), item_id: i3.item_id, nomor: i + 1, tipe: 'pg',
      pertanyaan: '<p>' + s.p + '</p>', gambar_url: '',
      opsi: JSON.stringify(s.o), kunci: s.k, bobot: 1,
      pembahasan: s.b, tingkat: 'sedang', sumber_ai: false, created_at: now
    };
  }));

  /* ---------- notifikasi contoh ---------- */
  _tambah('notifikasi', murid.map(function (m) {
    return {
      notif_id: _buatId('NTF'), user_id: m.user_id, jenis: 'enroll_kelas',
      judul: 'Anda terdaftar di kelas baru',
      pesan: 'Anda telah didaftarkan ke kelas ' + kelas.nama_kelas + '.',
      link: '#/kelas-saya/' + kelas.kelas_id,
      dibaca: false, dibuat_at: now
    };
  }));

  Logger.log('Seed data terisi: 1 guru, 3 murid, 1 kelas, 2 pertemuan, 4 item, 5 soal.');
}

/* ============================================================
 *  PEMELIHARAAN
 * ============================================================ */

/** Hapus seluruh baris bertanda [CONTOH] beserta turunannya. */
function hapusSeedData() {
  _hanyaEditor();
  var ss = _db();

  var kelasSh = ss.getSheetByName('kelas');
  var kelasData = kelasSh.getDataRange().getValues();
  var idKelasContoh = [];
  for (var i = 1; i < kelasData.length; i++) {
    if (String(kelasData[i][1]).indexOf('[CONTOH]') === 0) idKelasContoh.push(kelasData[i][0]);
  }

  var usersSh = ss.getSheetByName('users');
  var usersData = usersSh.getDataRange().getValues();
  var idUserContoh = [];
  for (var j = 1; j < usersData.length; j++) {
    if (String(usersData[j][4]).indexOf('[CONTOH]') === 0) idUserContoh.push(usersData[j][0]);
  }

  var aturan = {
    kelas:            { kol:'kelas_id', nilai:idKelasContoh },
    pertemuan:        { kol:'kelas_id', nilai:idKelasContoh },
    item:             { kol:'kelas_id', nilai:idKelasContoh },
    enrollment:       { kol:'kelas_id', nilai:idKelasContoh },
    progress:         { kol:'kelas_id', nilai:idKelasContoh },
    quiz_attempt:     { kol:'kelas_id', nilai:idKelasContoh },
    lkpd_submission:  { kol:'kelas_id', nilai:idKelasContoh },
    materi_ai:        { kol:'kelas_id', nilai:idKelasContoh },
    users:            { kol:'user_id',  nilai:idUserContoh },
    notifikasi:       { kol:'user_id',  nilai:idUserContoh }
  };

  var total = 0;
  Object.keys(aturan).forEach(function (nama) {
    total += _hapusBarisJika(ss, nama, aturan[nama].kol, aturan[nama].nilai);
  });

  /* soal mengikuti item yang sudah terhapus */
  var itemSh = ss.getSheetByName('item');
  var itemAda = itemSh.getDataRange().getValues().slice(1)
    .map(function (r) { return r[0]; });
  var soalSh = ss.getSheetByName('soal');
  var soalData = soalSh.getDataRange().getValues();
  for (var s = soalData.length - 1; s >= 1; s--) {
    if (itemAda.indexOf(soalData[s][1]) === -1) { soalSh.deleteRow(s + 1); total++; }
  }

  Logger.log('Seed data dihapus. Total ' + total + ' baris.');
  Logger.log('Catatan: akun "guru" TIDAK ikut terhapus — ganti passwordnya sebelum dipakai.');
}

function _hapusBarisJika(ss, nama, namaKol, daftarNilai) {
  if (!daftarNilai.length) return 0;
  var sh = ss.getSheetByName(nama);
  if (!sh || sh.getLastRow() < 2) return 0;
  var data = sh.getDataRange().getValues();
  var idx = data[0].indexOf(namaKol);
  if (idx < 0) return 0;
  var n = 0;
  for (var r = data.length - 1; r >= 1; r--) {
    if (daftarNilai.indexOf(data[r][idx]) !== -1) { sh.deleteRow(r + 1); n++; }
  }
  return n;
}

/** Kosongkan SEMUA data, struktur tetap. Hati-hati. */
function resetTotal() {
  _hanyaEditor();
  var ss = _db();
  URUTAN_SHEET.forEach(function (nama) {
    var sh = ss.getSheetByName(nama);
    if (sh && sh.getLastRow() > 1) {
      sh.deleteRows(2, sh.getLastRow() - 1);
    }
  });
  var P = PropertiesService.getScriptProperties();
  ['USR','KLS','ENR','PTM','ITM','PRG','SOL','ATT','LKP','AI','NTF','RST','LOG']
    .forEach(function (p) { P.setProperty('CTR_' + p, '0'); });
  Logger.log('Semua data dikosongkan, counter direset.');
}

/* ============================================================
 *  MIGRASI — jalankan setelah memperbarui kode
 * ============================================================ */

/**
 * Sesuaikan struktur sheet dengan SKEMA terbaru tanpa menghapus data.
 *
 * Aman dijalankan berulang kali: kolom yang sudah ada dilewati,
 * kolom baru disisipkan pada posisi yang benar beserta format dan
 * validasinya. Data lama tetap utuh dan tetap sejajar dengan
 * kolomnya masing-masing.
 */
function migrasiStruktur() {
  _hanyaEditor();
  var ss = _db();
  var total = 0;
  var laporan = [];

  URUTAN_SHEET.forEach(function (nama) {
    var def = SKEMA[nama];
    var sh = ss.getSheetByName(nama);

    if (!sh) {
      _buatSheet(ss, nama, def);
      laporan.push('  + sheet BARU  : ' + nama);
      total++;
      return;
    }

    var lebarLama = Math.max(1, sh.getLastColumn());
    var headLama = sh.getRange(1, 1, 1, lebarLama).getValues()[0]
      .map(function (h) { return String(h).trim(); });

    var ditambah = [];
    def.head.forEach(function (kol, target) {
      if (headLama.indexOf(kol) !== -1) return;      /* sudah ada */

      /* sisipkan tepat di posisi sesuai skema */
      var posisi = Math.min(target + 1, sh.getLastColumn() + 1);
      if (posisi <= sh.getLastColumn()) sh.insertColumnBefore(posisi);
      else sh.insertColumnAfter(sh.getLastColumn());

      /* 🔴 WAJIB — v1.10.3.

         `insertColumnBefore()` MEWARISI format dan validasi dari
         kolom tetangganya. Bila kolom baru kebetulan disisipkan di
         sebelah kolom ber-enum, ia ikut membawa dropdown itu —
         lengkap dengan `setAllowInvalid(false)`.

         Sheets lalu MENOLAK setiap nilai di luar daftar, dan
         penolakan itu TIDAK melempar galat ke Apps Script: selnya
         diam-diam tetap kosong. Persis kelas bug notifikasi
         `refleksi_dibalas` v1.2.0 yang sudah dicatat di bawah.

         Terjadi di lapangan v1.10.2: `nisn` & `no_wa` disisipkan
         tepat sebelum `status` (enum aktif/nonaktif), sehingga
         keduanya selalu tersimpan kosong meski header sudah benar.

         Kolom yang MEMANG ber-enum akan dipasangi validasinya sendiri
         oleh `_pasangValidasi()` di bawah, jadi membersihkan di sini
         selalu aman. */
      sh.getRange(1, posisi, sh.getMaxRows(), 1).setDataValidation(null);

      sh.getRange(1, posisi).setValue(kol);
      headLama.splice(target, 0, kol);
      ditambah.push(kol);
    });

    if (ditambah.length) {
      _formatUlang(sh, def);
      laporan.push('  + ' + _pad(nama, 20) + ditambah.join(', '));
      total += ditambah.length;
    } else if (_enumBerubah(sh, def)) {
      /* Kolomnya sudah lengkap, tetapi daftar nilai enum-nya bertambah.
         Validasi dropdown dipasang setAllowInvalid(false), sehingga
         Sheets MENOLAK nilai baru — dan penolakan itu tidak melempar
         galat ke Apps Script: barisnya diam-diam tidak tersimpan.

         Inilah yang membuat notifikasi `refleksi_dibalas` hilang di
         v1.2.0 meski seluruh uji hijau (mock mengabaikan validasi). */
      _pasangValidasi(sh, def);
      laporan.push('  ~ ' + _pad(nama, 20) + 'validasi dropdown diperbarui');
      total++;
    }
  });

  /* 🔧 PEMULIH — v1.10.3.

     Perbaikan di atas hanya menolong kolom yang disisipkan MULAI
     SEKARANG. Spreadsheet yang terlanjur dimigrasi versi lama sudah
     punya kolom bervalidasi warisan, dan menyalin kode saja tidak
     membersihkannya.

     Karena itu setiap kali migrasi dijalankan, seluruh kolom yang
     TIDAK ber-enum dipastikan bebas dropdown. Murah (satu panggilan
     per kolom, hanya saat migrasi) dan aman diulang. */
  URUTAN_SHEET.forEach(function (nama) {
    var def = SKEMA[nama];
    var sh = ss.getSheetByName(nama);
    if (!sh || !def) return;

    var lebar = Math.max(1, sh.getLastColumn());
    var head = sh.getRange(1, 1, 1, lebar).getValues()[0]
      .map(function (h) { return String(h).trim(); });

    var dibersihkan = 0;
    head.forEach(function (kol, i) {
      if (!kol) return;
      if (def.enum && def.enum[kol]) return;      /* memang ber-enum */
      var rentang = sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1);
      var adaAturan = false;
      try { adaAturan = !!rentang.getDataValidation(); } catch (e) {}
      if (!adaAturan) return;
      rentang.setDataValidation(null);
      dibersihkan++;
    });

    if (dibersihkan) {
      laporan.push('  ~ ' + _pad(nama, 20) +
                   dibersihkan + ' kolom dibebaskan dari dropdown warisan');
      total += dibersihkan;
    }

    /* Format teks juga dipasang ulang tiap migrasi (v1.10.4).

       Alasannya sama seperti pembersihan dropdown di atas: kolom yang
       sudah terlanjur dibuat versi lama masih berformat bilangan, dan
       menyalin kode tidak mengubah format sel yang sudah ada. */
    if (def.teks && def.teks.length) _pasangFormatTeks(sh, def);
  });

  _pasangCounter();

  /* 🔴 WAJIB — v1.10.2.

     `Db.invalidasi()` sengaja MEMPERTAHANKAN memo header demi
     kecepatan (v1.8.7), sebab header hanya berubah di sini. Karena
     itu di sinilah satu-satunya tempat yang harus membuangnya.

     Tanpa baris ini `Db` terus memakai susunan kolom LAMA di sisa
     eksekusi: kolom yang baru saja ditambahkan tidak ada dalam
     daftarnya, sehingga setiap penulisan MEMBUANGNYA diam-diam —
     tanpa galat apa pun. Kolom lama tetap tersimpan normal, dan
     itulah yang membuat gejalanya sulit dikenali (laporan lapangan
     v1.10.1: `nisn` & `no_wa` selalu kosong padahal `email` masuk). */
  try { Db.invalidasiHeader(); } catch (e) {}

  Logger.log('=== MIGRASI STRUKTUR ===');
  if (total === 0) {
    Logger.log('  Struktur sudah sesuai. Tidak ada perubahan.');
  } else {
    laporan.forEach(function (b) { Logger.log(b); });
    Logger.log('');
    Logger.log('  ' + total + ' kolom/sheet ditambahkan. Data lama utuh.');
  }
  Logger.log('========================');
  return total;
}

/**
 * Apakah daftar nilai enum di sheet sudah ketinggalan dari SKEMA?
 *
 * Dibandingkan lewat getDataValidation() pada baris ke-2. Bila API itu
 * tidak tersedia (mock, atau sheet tanpa validasi), kembalikan true
 * supaya validasi dipasang ulang — memasang ulang selalu aman, jauh
 * lebih murah daripada risiko nilai tertolak dalam diam.
 */
function _enumBerubah(sh, def) {
  if (!def.enum) return false;
  var head = def.head;

  for (var kol in def.enum) {
    var i = head.indexOf(kol);
    if (i < 0) continue;

    var adaSemua = false;
    try {
      var rule = sh.getRange(2, i + 1).getDataValidation();
      if (rule && rule.getCriteriaValues) {
        var kv = rule.getCriteriaValues();
        var terpasang = (kv && kv[0]) ? kv[0] : [];
        adaSemua = def.enum[kol].every(function (v) {
          return terpasang.indexOf(v) !== -1;
        });
      }
    } catch (e) { adaSemua = false; }

    if (!adaSemua) return true;
  }
  return false;
}

/** Pasang ulang validasi dropdown sesuai SKEMA. */
/**
 * Paksa kolom tertentu disimpan sebagai TEKS, bukan bilangan.
 *
 * 🔴 v1.10.4, laporan lapangan. NISN `"0098765432"` tersimpan menjadi
 * `98765432` — Sheets menafsirkannya sebagai bilangan dan membuang nol
 * di depan. Tidak ada galat, tidak ada peringatan; nilainya sekadar
 * berubah, dan baru ketahuan saat dibandingkan.
 *
 * Nomor WA punya risiko serupa: bilangan 13 digit dapat ditampilkan
 * dalam notasi ilmiah.
 *
 * Kolom mana saja ditentukan lewat `teks:` di SKEMA, bukan ditebak
 * dari namanya — daftar eksplisit lebih mudah ditelusuri saat kolom
 * baru ditambahkan.
 */
function _pasangFormatTeks(sh, def) {
  if (!def.teks || !def.teks.length) return;
  var head = def.head;
  def.teks.forEach(function (kol) {
    var i = head.indexOf(kol);
    if (i < 0) return;
    sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat('@');
  });
}

function _pasangValidasi(sh, def) {
  if (!def.enum) return;
  var head = def.head;
  Object.keys(def.enum).forEach(function (kol) {
    var i = head.indexOf(kol);
    if (i < 0) return;
    var rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(def.enum[kol], true)
      .setAllowInvalid(false)
      .setHelpText('Pilihan: ' + def.enum[kol].join(', '))
      .build();
    sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setDataValidation(rule);
  });
}

/** Terapkan ulang lebar kolom, validasi, dan format tanggal. */
function _formatUlang(sh, def) {
  var head = def.head;

  sh.getRange(1, 1, 1, head.length)
    .setFontWeight('bold').setFontColor('#FFFFFF')
    .setBackground('#4E9A4A').setVerticalAlignment('middle');

  head.forEach(function (kol, i) {
    var w = (def.lebar && def.lebar[kol]) ? def.lebar[kol] : 120;
    sh.setColumnWidth(i + 1, w);

    if (/_at$|^waktu_|^tanggal_|^last_login$|^batas_waktu$|^timestamp$/.test(kol)) {
      sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1)
        .setNumberFormat('yyyy-mm-dd hh:mm:ss');
    }
  });

  /* Setelah format tanggal, supaya kolom `teks` menang bila keduanya
     entah bagaimana bertabrakan (v1.10.4). */
  _pasangFormatTeks(sh, def);
  _pasangValidasi(sh, def);
}

/** Ringkasan isi database + peringatan kapasitas. */
function infoDatabase() {
  _hanyaEditor();
  var ss = _db();
  Logger.log('=== ' + NAMA_DB + ' ===');
  Logger.log('ID  : ' + ss.getId());
  Logger.log('URL : ' + ss.getUrl());
  Logger.log('');

  /* ambang perhatian per sheet (baris) */
  var AMBANG = { progress: 40000, quiz_attempt: 20000,
                 lkpd_submission: 20000, notifikasi: 20000, log: 20000 };

  var total = 0;
  var peringatan = [];

  URUTAN_SHEET.forEach(function (nama) {
    var sh = ss.getSheetByName(nama);
    var n = sh ? Math.max(0, sh.getLastRow() - 1) : -1;
    if (n >= 0) total += n;

    var tanda = '';
    if (AMBANG[nama] && n >= AMBANG[nama]) {
      tanda = '  ⚠️ LEWAT AMBANG (' + AMBANG[nama] + ')';
      peringatan.push(nama);
    } else if (AMBANG[nama] && n >= AMBANG[nama] * 0.75) {
      tanda = '  ⚠ mendekati ambang';
    }
    Logger.log('  ' + _pad(nama, 20) + (n < 0 ? 'TIDAK ADA' : n + ' baris') + tanda);
  });

  Logger.log('');
  Logger.log('  Total ' + total + ' baris data.');

  if (peringatan.length) {
    Logger.log('');
    Logger.log('  ⚠️ TINDAKAN DIPERLUKAN');
    Logger.log('     Sheet berikut melewati ambang: ' + peringatan.join(', '));
    Logger.log('     Lihat OPT-E pada docs/RENCANA-OPTIMASI.md');
    Logger.log('     (pisahkan data per semester ke spreadsheet arsip)');
  }

  /* Proyeksi progress — dihitung per kelas, bukan murid × seluruh item.
     Seorang murid hanya mengerjakan item di kelasnya sendiri. */
  try {
    var dataE = ss.getSheetByName('enrollment').getDataRange().getValues();
    var dataI = ss.getSheetByName('item').getDataRange().getValues();

    var muridPerKelas = {};
    for (var i = 1; i < dataE.length; i++) {
      if (dataE[i][4] === 'aktif') {
        muridPerKelas[dataE[i][1]] = (muridPerKelas[dataE[i][1]] || 0) + 1;
      }
    }
    var itemPerKelas = {};
    for (var j = 1; j < dataI.length; j++) {
      if (dataI[j][21] === 'publish') {
        itemPerKelas[dataI[j][2]] = (itemPerKelas[dataI[j][2]] || 0) + 1;
      }
    }

    var proyeksi = 0;
    Object.keys(muridPerKelas).forEach(function (kid) {
      proyeksi += muridPerKelas[kid] * (itemPerKelas[kid] || 0);
    });

    if (proyeksi > 0) {
      Logger.log('');
      Logger.log('  Proyeksi progress bila semua murid tuntas:');
      Logger.log('     ' + proyeksi + ' baris (dihitung per kelas)');
      Logger.log('     Kapasitas aman ~50.000 → ' +
        (proyeksi > 50000
          ? '⚠️ MELEBIHI — siapkan arsip per semester (OPT-E)'
          : 'aman, ' + Math.round(proyeksi / 50000 * 100) + '% terpakai'));
    }
  } catch (e) { /* abaikan bila sheet belum lengkap */ }

  return total;
}

function _pad(s, n) {
  s = String(s);
  while (s.length < n) s += ' ';
  return s;
}


/**
 * MIGRASI HIERARKI — pertemuan lama dimasukkan ke Materi Pokok bawaan.
 *
 * Sebelum v1.0 struktur hanya dua tingkat (Kelas → Pertemuan). Setelah
 * penambahan Materi Pokok, pertemuan lama tidak punya `mp_id` sehingga
 * tidak muncul di mana pun. Fungsi ini membuat satu Materi Pokok
 * "Materi Pokok 1" per kelas lalu memasukkan seluruh pertemuan yatim
 * ke dalamnya.
 *
 * Jalankan SETELAH migrasiStruktur(). Aman diulang: pertemuan yang
 * sudah punya mp_id dilewati.
 */
function migrasiHierarki() {
  _hanyaEditor();
  Logger.log('=== MIGRASI HIERARKI (Materi Pokok) ===');

  var ptm = Db.baca('pertemuan');

  /* Peta mp_id → kelas pemiliknya. Dipakai mendeteksi pertemuan yang
     mp_id-nya SILANG KELAS: menunjuk materi pokok milik kelas lain,
     atau materi pokok yang sudah tidak ada.

     Kondisi ini dihasilkan Pertemuan.salin() sebelum v1.1.1, yang lupa
     mengganti mp_id salinan. Akibatnya pertemuan tidak muncul di kelas
     mana pun, dan menghapus materi pokok di kelas asal ikut menghapus
     isi kelas tujuan. Nilai kosong saja tidak cukup untuk mendeteksinya. */
  var pemilikMp = {};
  Db.baca('materi_pokok').forEach(function (m) {
    pemilikMp[m.mp_id] = m.kelas_id;
  });

  var yatim = ptm.filter(function (p) {
    if (!p.mp_id || String(p.mp_id).trim() === '') return true;
    var pemilik = pemilikMp[p.mp_id];
    return pemilik === undefined ||
           String(pemilik) !== String(p.kelas_id);
  });

  if (!yatim.length) {
    Logger.log('  Tidak ada pertemuan tanpa Materi Pokok.');
    Logger.log('  Struktur sudah sesuai — tidak ada yang diubah.');
    return { dipindah: 0, mp_dibuat: 0 };
  }

  var jmlSilang = yatim.filter(function (p) {
    return p.mp_id && String(p.mp_id).trim() !== '';
  }).length;
  Logger.log('  ' + yatim.length + ' pertemuan perlu ditata ulang' +
    (jmlSilang ? ' (' + jmlSilang + ' menunjuk Materi Pokok kelas lain)' : '') +
    '.');

  /* kelompokkan per kelas */
  var perKelas = {};
  yatim.forEach(function (p) {
    (perKelas[p.kelas_id] = perKelas[p.kelas_id] || []).push(p);
  });

  var mpAda = Db.baca('materi_pokok');
  var mpDibuat = 0, dipindah = 0;

  Object.keys(perKelas).forEach(function (kelasId) {
    /* pakai ulang MP pertama kelas ini bila sudah ada */
    var target = null;
    mpAda.forEach(function (m) {
      if (!target && m.kelas_id === kelasId) target = m;
    });

    if (!target) {
      var mpId = Util.buatId('MP');
      Db.tambah('materi_pokok', {
        mp_id: mpId, kelas_id: kelasId, urutan: 1,
        judul: 'Materi Pokok 1',
        deskripsi: 'Dibuat otomatis saat migrasi struktur.',
        tujuan_pembelajaran: '',
        wajib: true, urut_ketat: true, status: 'publish',
        created_at: Util.sekarang(), updated_at: Util.sekarang()
      });
      target = { mp_id: mpId };
      mpDibuat++;
      Logger.log('  + Materi Pokok baru untuk kelas ' + kelasId);
    }

    /* Penomoran DILANJUTKAN dari isi Materi Pokok target, bukan dimulai
       dari 1. Materi pokok itu bisa sudah berisi pertemuan sehat — mulai
       dari 1 akan membuat dua pertemuan bernomor sama, dan urutan
       tampilnya jadi tak menentu. */
    var mulai = 0;
    ptm.forEach(function (q) {
      if (String(q.mp_id || '') === String(target.mp_id)) {
        mulai = Math.max(mulai, Number(q.urutan) || 0);
      }
    });

    /* satu perbaruiBanyak per kelas, bukan per baris */
    var ubah = perKelas[kelasId].map(function (p, i) {
      dipindah++;
      return { _baris: p._baris, mp_id: target.mp_id,
               urutan: mulai + i + 1,
               jenis: p.jenis || 'biasa' };
    });
    Db.perbaruiBanyak('pertemuan', ubah);
  });

  /* item juga perlu mp_id agar penghapusan berantai tetap murah */
  var petaPtm = {};
  Db.baca('pertemuan').forEach(function (p) { petaPtm[p.pertemuan_id] = p.mp_id; });

  var itemUbah = [];
  Db.baca('item').forEach(function (i) {
    var mpBenar = petaPtm[i.pertemuan_id] || '';
    if (String(i.mp_id || '') !== String(mpBenar)) {
      itemUbah.push({ _baris: i._baris, mp_id: mpBenar });
    }
  });
  if (itemUbah.length) Db.perbaruiBanyak('item', itemUbah);

  /* progress menyusul dari itemnya */
  var petaItem = {};
  Db.baca('item').forEach(function (i) { petaItem[i.item_id] = i.mp_id; });

  var progUbah = [];
  Db.baca('progress').forEach(function (r) {
    var mpBenar = petaItem[r.item_id] || '';
    if (String(r.mp_id || '') !== String(mpBenar)) {
      progUbah.push({ _baris: r._baris, mp_id: mpBenar });
    }
  });
  if (progUbah.length) Db.perbaruiBanyak('progress', progUbah);

  Logger.log('');
  Logger.log('  Materi Pokok dibuat : ' + mpDibuat);
  Logger.log('  Pertemuan dipindah  : ' + dipindah);
  Logger.log('  Item disesuaikan    : ' + itemUbah.length);
  Logger.log('  Progress disesuaikan: ' + progUbah.length);
  Logger.log('========================');
  Logger.log('Selesai. Buka aplikasi dan periksa daftar kelas.');

  return { dipindah: dipindah, mp_dibuat: mpDibuat,
           item: itemUbah.length, progress: progUbah.length };
}
