/**
 * ============================================================
 *  LMS v2 — Setup.gs
 *  Pembuat spreadsheet DB_LMS_V2 (23 sheet) + seed data
 * ------------------------------------------------------------
 *  CARA PAKAI (sekali saja):
 *    1. Buat project Apps Script baru (terpisah dari LessonLen v1)
 *    2. Tempel seluruh berkas folder v2/
 *    3. Jalankan setupLengkap()
 *    4. Izinkan akses saat diminta
 *    5. Salin DB_ID yang tampil di Log
 *
 *  FUNGSI LAIN:
 *    setupLengkap()      buat DB + seed contoh  (paling sering dipakai)
 *    setupDatabase()     buat DB tanpa seed
 *    isiSeedData()       tambahkan seed ke DB yang sudah ada
 *    hapusSeedData()     bersihkan seed, siap dipakai sungguhan
 *    resetTotal()        KOSONGKAN semua data (struktur tetap)
 *    migrasiStruktur()   sesuaikan sheet dengan SKEMA terbaru
 *    infoDatabase()      ringkasan isi DB
 * ============================================================
 */

var NAMA_DB = 'DB_LMS_V2';

/* ============================================================
 *  DEFINISI 23 SHEET — rancangan v2.1
 *  head  : nama kolom (urutan menentukan urutan kolom di sheet)
 *  lebar : lebar kolom piksel (opsional)
 *  enum  : validasi dropdown
 *  wrap  : kolom yang dibungkus teks
 *  teks  : kolom angka-yang-sebenarnya-teks (format '@')
 * ============================================================ */
var SKEMA = {

  Users: {
    /* Sama seperti v1 (keputusan final v2.1): username + kata sandi. */
    head: ['user_id','username','password_hash','salt','pwd_awal','nama','role',
           'rombel','email','nisn','no_wa','tanggal_lahir',
           'status','harus_ganti_password','last_login','created_at','updated_at'],
    lebar: { user_id:90, username:120, password_hash:200, salt:120,
             pwd_awal:110, nama:180, role:80, rombel:110, email:180,
             nisn:120, no_wa:140, tanggal_lahir:110, status:90,
             harus_ganti_password:110, last_login:140, created_at:140,
             updated_at:140 },
    enum: { role: ['guru','murid'], status: ['aktif','nonaktif'],
            harus_ganti_password: [true,false] },
    teks: ['nisn','no_wa','tanggal_lahir','username','pwd_awal','rombel']
  },

  Classes: {
    head: ['class_id','name','academic_year','status','created_at','updated_at'],
    lebar: { class_id:90, name:180, academic_year:110, status:90,
             created_at:140, updated_at:140 },
    enum: { status: ['aktif','arsip'] }
  },

  Subjects: {
    head: ['subject_id','name','code','owner_teacher_id','status',
           'created_at','updated_at'],
    lebar: { subject_id:100, name:220, code:90, owner_teacher_id:110,
             status:90, created_at:140, updated_at:140 },
    enum: { status: ['aktif','nonaktif'] }
  },

  /* Relasi guru + kelas + mapel — menggantikan kolom guru/mapel di kelas. */
  Teaching_Assignments: {
    head: ['teaching_assignment_id','class_id','teacher_id','subject_id',
           'academic_year','status','created_at','updated_at'],
    lebar: { teaching_assignment_id:130, class_id:90, teacher_id:100,
             subject_id:100, academic_year:110, status:90,
             created_at:140, updated_at:140 },
    enum: { status: ['aktif','nonaktif'] }
  },

  /* Proses enrollment sama seperti v1 (keputusan final v2.1 no. 3). */
  Enrollment: {
    head: ['enroll_id','class_id','user_id','tanggal_daftar','status'],
    lebar: { enroll_id:110, class_id:90, user_id:90,
             tanggal_daftar:140, status:90 },
    enum: { status: ['aktif','keluar'] }
  },

  Topics: {
    head: ['topic_id','teaching_assignment_id','title','description','status',
           'sort_order','created_at','updated_at'],
    lebar: { topic_id:100, teaching_assignment_id:130, title:240,
             description:300, status:90, sort_order:80,
             created_at:140, updated_at:140 },
    enum: { status: ['draft','publish'] },
    wrap: ['description']
  },

  Items: {
    head: ['item_id','topic_id','type','title','description','content',
           'status','related_id','sort_order','ai_source','ai_reviewed',
           'created_at','updated_at'],
    lebar: { item_id:90, topic_id:100, type:110, title:220, description:280,
             content:400, status:90, related_id:110, sort_order:80,
             ai_source:90, ai_reviewed:100, created_at:140, updated_at:140 },
    enum: { type: ['materi','tugas_individu','tugas_kelompok','quiz','refleksi'],
            status: ['draft','publish'],
            ai_source: [true,false], ai_reviewed: [true,false] },
    wrap: ['description','content']
  },

  Progress: {
    head: ['progress_id','user_id','item_id','status','completed_at','updated_at'],
    lebar: { progress_id:110, user_id:90, item_id:90, status:120,
             completed_at:140, updated_at:140 },
    enum: { status: ['not_completed','completed'] }
  },

  Quizzes: {
    head: ['quiz_id','item_id','deadline','max_attempts','show_score','status',
           'created_at','updated_at'],
    lebar: { quiz_id:100, item_id:90, deadline:140, max_attempts:100,
             show_score:100, status:90, created_at:140, updated_at:140 },
    enum: { status: ['aktif','nonaktif'], show_score: [true,false] }
  },

  Quiz_Questions: {
    /* answer_key TIDAK boleh masuk respons endpoint murid. */
    head: ['question_id','quiz_id','order_no','type','question','options_json',
           'answer_key','rubric','points','ai_source','created_at'],
    lebar: { question_id:110, quiz_id:100, order_no:80, type:110,
             question:360, options_json:320, answer_key:100, rubric:260,
             points:70, ai_source:90, created_at:140 },
    enum: { type: ['pg','benar_salah','isian','esai'],
            ai_source: [true,false] },
    wrap: ['question','options_json','rubric']
  },

  Quiz_Submissions: {
    head: ['submission_id','quiz_id','user_id','attempt_no','answers_json',
           'submitted_at','status','score','max_score','graded_at'],
    lebar: { submission_id:120, quiz_id:100, user_id:90, attempt_no:90,
             answers_json:360, submitted_at:140, status:120, score:70,
             max_score:90, graded_at:140 },
    enum: { status: ['submitted','graded'] },
    wrap: ['answers_json']
  },

  Assignments: {
    head: ['assignment_id','item_id','type','instructions','deadline',
           'template_file_id','allow_resubmit','status','created_at','updated_at'],
    lebar: { assignment_id:120, item_id:90, type:100, instructions:320,
             deadline:140, template_file_id:160, allow_resubmit:100,
             status:90, created_at:140, updated_at:140 },
    enum: { type: ['individual','group'],
            allow_resubmit: [true,false],
            status: ['aktif','nonaktif'] },
    wrap: ['instructions']
  },

  Groups: {
    head: ['group_id','assignment_id','name','leader_id','status',
           'created_at','updated_at'],
    lebar: { group_id:110, assignment_id:120, name:160, leader_id:110,
             status:90, created_at:140, updated_at:140 },
    enum: { status: ['aktif','nonaktif'] }
  },

  Group_Members: {
    head: ['group_member_id','group_id','user_id','status','joined_at'],
    lebar: { group_member_id:130, group_id:110, user_id:90, status:90,
             joined_at:140 },
    enum: { status: ['aktif','nonaktif'] }
  },

  Submissions: {
    head: ['submission_id','assignment_id','group_id','user_id','file_id',
           'submitted_url','attempt_no','submitted_at','status','feedback',
           'updated_at'],
    lebar: { submission_id:120, assignment_id:120, group_id:110, user_id:90,
             file_id:160, submitted_url:260, attempt_no:90, submitted_at:140,
             status:120, feedback:300, updated_at:140 },
    enum: { status: ['submitted','graded','returned'] },
    wrap: ['feedback']
  },

  Grades: {
    head: ['grade_id','item_id','source_type','source_id','user_id','group_id',
           'score','max_score','notes','graded_by','graded_at','updated_at'],
    lebar: { grade_id:100, item_id:90, source_type:100, source_id:110,
             user_id:90, group_id:110, score:70, max_score:90, notes:260,
             graded_by:100, graded_at:140, updated_at:140 },
    enum: { source_type: ['quiz','assignment','reflection','manual'] },
    wrap: ['notes']
  },

  Reflections: {
    head: ['reflection_id','item_id','user_id','content','created_at','updated_at'],
    lebar: { reflection_id:110, item_id:90, user_id:90, content:400,
             created_at:140, updated_at:140 },
    wrap: ['content']
  },

  Notifications: {
    head: ['notif_id','user_id','jenis','judul','pesan','link','dibaca','created_at'],
    lebar: { notif_id:100, user_id:90, jenis:150, judul:220, pesan:340,
             link:220, dibaca:80, created_at:140 },
    enum: { jenis: ['enroll_kelas','pertemuan_baru','lkpd_dinilai',
                    'quiz_dikoreksi','feedback_baru','quiz_gagal_habis',
                    'lkpd_masuk','permintaan_reset','refleksi_dibalas'],
            dibaca: [true,false] },
    wrap: ['pesan']
  },

  /* Riwayat generate AI — sama seperti v1 (keputusan final v2.1 no. 4).
     Key TIDAK PERNAH dicatat; hanya indeksnya. */
  Materi_AI: {
    head: ['ai_id','item_id','class_id','prompt_ringkas','konten_hasil',
           'saran_soal','saran_lkpd','model','key_index','token_terpakai',
           'durasi_ms','status','error','dibuat_at'],
    lebar: { ai_id:100, item_id:90, class_id:90, prompt_ringkas:300,
             konten_hasil:400, saran_soal:340, saran_lkpd:280, model:150,
             key_index:80, token_terpakai:110, durasi_ms:90, status:90,
             error:240, dibuat_at:140 },
    enum: { status: ['sukses','gagal','antre'] },
    wrap: ['prompt_ringkas','konten_hasil','saran_soal','saran_lkpd','error']
  },

  /* Antrean lupa kata sandi — sama seperti v1. */
  Permintaan_Reset: {
    head: ['request_id','user_id','input_user','status','dibuat_at','diproses_at'],
    lebar: { request_id:110, user_id:90, input_user:160, status:110,
             dibuat_at:140, diproses_at:140 },
    enum: { status: ['antre','selesai','kedaluwarsa'] }
  },

  /* Sesi login — sama seperti v1 (token, TTL 12 jam). */
  Session: {
    head: ['token','user_id','dibuat_at','expired_at'],
    lebar: { token:300, user_id:90, dibuat_at:140, expired_at:140 }
  },

  /* Generator ID — dipakai Util.buatId() dengan LockService. */
  Counters: {
    head: ['entity','last_number'],
    lebar: { entity:110, last_number:110 }
  },

  /* Menggantikan sheet `log` v1 dengan action/entity terstruktur. */
  Audit_Logs: {
    head: ['log_id','user_id','role','action','entity','entity_id','detail',
           'status','timestamp'],
    lebar: { log_id:100, user_id:90, role:80, action:120, entity:110,
             entity_id:110, detail:420, status:90, timestamp:140 },
    wrap: ['detail']
  }
};

/* urutan tab di spreadsheet */
var URUTAN_SHEET = ['Users','Classes','Subjects','Teaching_Assignments',
  'Enrollment','Topics','Items','Progress','Quizzes','Quiz_Questions',
  'Quiz_Submissions','Assignments','Groups','Group_Members','Submissions',
  'Grades','Reflections','Notifications','Materi_AI','Permintaan_Reset',
  'Session','Counters','Audit_Logs'];

/* ============================================================
 *  FUNGSI UTAMA
 * ============================================================ */

/** Buat database + isi seed. Jalankan ini untuk memulai. */
function setupLengkap() {
  var id = setupDatabase();
  isiSeedData();
  Logger.log('');
  Logger.log('==================================================');
  Logger.log(' SETUP LENGKAP SELESAI — ' + URUTAN_SHEET.length + ' sheet');
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

/** Buat spreadsheet + seluruh sheet berikut header, validasi, format. */
function setupDatabase() {
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
  ss.setActiveSheet(ss.getSheetByName('Users'));

  _pasangProperti();

  Logger.log('Struktur ' + URUTAN_SHEET.length + ' sheet siap.');
  return ss.getId();
}

/**
 * Buat satu sheet lengkap dengan header, format, validasi.
 *
 * CATATAN: getRange() di dalam loop di sini adalah pengecualian yang
 * disengaja — pemformatan hanya bisa per kolom, dan fungsi ini hanya
 * dijalankan SEKALI saat pembuatan database.
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
    .setBackground('#2F6B2B')
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

  /* --- kolom angka-yang-sebenarnya-teks (NISN, no WA, dst.) --- */
  _pasangFormatTeks(sh, def);

  /* --- validasi dropdown --- */
  if (def.enum) {
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

  /* --- format tanggal --- */
  head.forEach(function (kol, i) {
    if (/_at$|^waktu_|^tanggal_|^last_login$|^deadline$|^timestamp$|^expired_at$|^joined_at$/.test(kol)) {
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

/** Properti pendukung (bukan counter — counter ada di sheet Counters). */
function _pasangProperti() {
  var P = PropertiesService.getScriptProperties();
  if (P.getProperty('TEMPLATE_FEEDBACK') === null) {
    P.setProperty('TEMPLATE_FEEDBACK', JSON.stringify([
      'Kerja bagus, pertahankan.',
      'Sudah benar, tetapi kurang lengkap pada bagian ',
      'Tautan tidak dapat dibuka. Mohon periksa pengaturan berbagi.',
      'Silakan pelajari kembali materi, lalu kerjakan ulang.',
      'Analisis sudah tepat. Lain kali sertakan bukti hasil uji.',
      'Format penulisan perlu dirapikan.'
    ]));
  }
}

/* ============================================================
 *  UTILITAS INTERNAL
 * ============================================================ */

function _db() {
  var id = PropertiesService.getScriptProperties().getProperty('DB_ID');
  if (!id) throw new Error('DB_ID belum ada. Jalankan setupDatabase() dulu.');
  return SpreadsheetApp.openById(id);
}

function _salt() {
  return Util.buatSalt();
}

function _hash(password, salt) {
  return Util.hashPassword(password, salt);
}

/** Tambah banyak baris sekaligus (satu setValues). */
function _tambah(nama, objArr) {
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
  var ss = _db();
  if (ss.getSheetByName('Users').getLastRow() > 1) {
    Logger.log('Data sudah ada — seed dilewati. Pakai resetTotal() bila ingin mengosongkan.');
    return;
  }

  var now = new Date();

  /* ---------- users ---------- */
  var saltGuru = _salt();
  var guru = {
    user_id: Util.buatId('USR'), username: 'guru',
    password_hash: _hash('guru123', saltGuru), salt: saltGuru,
    pwd_awal: 'guru123',
    nama: 'Guru PKPJ', role: 'guru', rombel: '', email: '', nisn: '', no_wa: '',
    status: 'aktif', harus_ganti_password: false,
    last_login: '', created_at: now, updated_at: now
  };

  var murid = [];
  ['Ahmad Fauzi','Bella Kusuma','Candra Wijaya'].forEach(function (nm, i) {
    var s = _salt();
    murid.push({
      user_id: Util.buatId('USR'),
      username: 'siswa0' + (i + 1),
      password_hash: _hash('siswa123', s), salt: s,
      pwd_awal: 'siswa123',
      nama: '[CONTOH] ' + nm, role: 'murid', rombel: 'XI TJKT 1',
      email: '', nisn: '', no_wa: '',
      status: 'aktif', harus_ganti_password: false,
      last_login: '', created_at: now, updated_at: now
    });
  });
  _tambah('Users', [guru].concat(murid));

  /* ---------- classes + subjects + teaching assignment ---------- */
  var kelas = {
    class_id: Util.buatId('KLS'),
    name: '[CONTOH] XI TJKT 1',
    academic_year: '2026/2027',
    status: 'aktif', created_at: now, updated_at: now
  };
  _tambah('Classes', [kelas]);

  var mapel = {
    subject_id: Util.buatId('SBK'),
    name: 'Pemasangan dan Konfigurasi Peralatan Jaringan (PKPJ)',
    code: 'PKPJ',
    owner_teacher_id: guru.user_id,
    status: 'aktif', created_at: now, updated_at: now
  };
  _tambah('Subjects', [mapel]);

  var ta = {
    teaching_assignment_id: Util.buatId('TA'),
    class_id: kelas.class_id,
    teacher_id: guru.user_id,
    subject_id: mapel.subject_id,
    academic_year: '2026/2027',
    status: 'aktif', created_at: now, updated_at: now
  };
  _tambah('Teaching_Assignments', [ta]);

  /* ---------- enrollment (proses sama seperti v1) ---------- */
  _tambah('Enrollment', murid.map(function (m) {
    return { enroll_id: Util.buatId('ENR'), class_id: kelas.class_id,
             user_id: m.user_id, tanggal_daftar: now, status: 'aktif' };
  }));

  /* ---------- topic + item contoh ---------- */
  var topic = {
    topic_id: Util.buatId('TPC'),
    teaching_assignment_id: ta.teaching_assignment_id,
    title: 'Konsep Dasar VLAN',
    description: 'Pengertian, manfaat, dan jenis VLAN pada jaringan switch.',
    status: 'publish', sort_order: 1,
    created_at: now, updated_at: now
  };
  _tambah('Topics', [topic]);

  var item = {
    item_id: Util.buatId('ITM'),
    topic_id: topic.topic_id,
    type: 'materi',
    title: 'Apa itu VLAN',
    description: 'Pengenalan konsep VLAN beserta manfaatnya.',
    content: '<h3>Pengertian VLAN</h3>' +
             '<p><b>VLAN</b> membagi satu jaringan fisik menjadi beberapa ' +
             'jaringan logis yang saling terpisah.</p>' +
             '<p>Contoh di sekolah: VLAN 10 untuk Lab Komputer, VLAN 20 untuk ' +
             'Ruang Guru — memakai switch yang sama namun tidak saling ganggu.</p>',
    status: 'publish', related_id: '', sort_order: 1,
    ai_source: false, ai_reviewed: false,
    created_at: now, updated_at: now
  };
  _tambah('Items', [item]);

  /* ---------- notifikasi contoh ---------- */
  _tambah('Notifications', murid.map(function (m) {
    return {
      notif_id: Util.buatId('NTF'), user_id: m.user_id,
      jenis: 'enroll_kelas',
      judul: 'Anda terdaftar di kelas baru',
      pesan: 'Anda telah didaftarkan ke kelas ' + kelas.name + '.',
      link: '#/kelas/' + kelas.class_id,
      dibaca: false, created_at: now
    };
  }));

  Logger.log('Seed data terisi: 1 guru, 3 murid, 1 kelas, 1 mapel, ' +
             '1 teaching assignment, 3 enrollment, 1 topic, 1 item.');
}

/* ============================================================
 *  PEMELIHARAAN
 * ============================================================ */

/** Hapus seluruh baris bertanda [CONTOH] beserta turunannya. */
function hapusSeedData() {
  var ss = _db();

  var usersData = ss.getSheetByName('Users').getDataRange().getValues();
  var idUserContoh = [];
  for (var j = 1; j < usersData.length; j++) {
    if (String(usersData[j][5]).indexOf('[CONTOH]') === 0) {
      idUserContoh.push(usersData[j][0]);
    }
  }

  var kelasData = ss.getSheetByName('Classes').getDataRange().getValues();
  var idKelasContoh = [];
  for (var i = 1; i < kelasData.length; i++) {
    if (String(kelasData[i][1]).indexOf('[CONTOH]') === 0) {
      idKelasContoh.push(kelasData[i][0]);
    }
  }

  var aturan = {
    Classes:       { kol: 'class_id', nilai: idKelasContoh },
    Enrollment:    { kol: 'class_id', nilai: idKelasContoh },
    Users:         { kol: 'user_id',  nilai: idUserContoh },
    Notifications: { kol: 'user_id',  nilai: idUserContoh }
  };

  var total = 0;
  Object.keys(aturan).forEach(function (nama) {
    total += _hapusBarisJika(ss, nama, aturan[nama].kol, aturan[nama].nilai);
  });

  /* teaching assignment + topic + item mengikuti kelas yang terhapus */
  var taAda = Db.baca('Teaching_Assignments').filter(function (t) {
    return idKelasContoh.indexOf(t.class_id) !== -1;
  });
  if (taAda.length) {
    total += _hapusBarisJika(ss, 'Teaching_Assignments', 'teaching_assignment_id',
                             taAda.map(function (t) { return t.teaching_assignment_id; }));

    var tpcAda = Db.baca('Topics').filter(function (t) {
      return taAda.some(function (x) {
        return x.teaching_assignment_id === t.teaching_assignment_id; });
    });
    if (tpcAda.length) {
      total += _hapusBarisJika(ss, 'Topics', 'topic_id',
                               tpcAda.map(function (t) { return t.topic_id; }));
      total += _hapusBarisJika(ss, 'Items', 'topic_id',
                               tpcAda.map(function (t) { return t.topic_id; }));
    }
  }

  /* mapel contoh ikut dihapus — milik guru seed, kode PKPJ */
  var sbkAda = Db.baca('Subjects').filter(function (s) {
    return String(s.code) === 'PKPJ' &&
           String(s.name).indexOf('Pemasangan') === 0;
  });
  if (sbkAda.length) {
    total += _hapusBarisJika(ss, 'Subjects', 'subject_id',
                             sbkAda.map(function (s) { return s.subject_id; }));
  }

  Logger.log('Seed data dihapus. Total ' + total + ' baris.');
  Logger.log('Catatan: akun "guru" TIDAK ikut terhapus — ganti kata sandinya sebelum dipakai.');
  return total;
}

function _hapusBarisJika(ss, nama, namaKol, daftarNilai) {
  if (!daftarNilai || !daftarNilai.length) return 0;
  var sh = ss.getSheetByName(nama);
  if (!sh || sh.getLastRow() < 2) return 0;
  var data = sh.getDataRange().getValues();
  var idx = data[0].indexOf(namaKol);
  if (idx < 0) return 0;
  var n = 0;
  for (var r = data.length - 1; r >= 1; r--) {
    if (daftarNilai.indexOf(data[r][idx]) !== -1) { sh.deleteRow(r + 1); n++; }
  }
  Db.invalidasi(nama);
  return n;
}

/** Kosongkan SEMUA data, struktur tetap. Hati-hati. */
function resetTotal() {
  var ss = _db();
  URUTAN_SHEET.forEach(function (nama) {
    if (nama === 'Counters') {
      var sh = ss.getSheetByName(nama);
      if (sh && sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
      return;
    }
    var sh = ss.getSheetByName(nama);
    if (sh && sh.getLastRow() > 1) {
      sh.deleteRows(2, sh.getLastRow() - 1);
    }
  });
  URUTAN_SHEET.forEach(function (n) { Db.invalidasi(n); });
  Logger.log('Semua data dikosongkan, counter direset.');
}

/* ============================================================
 *  MIGRASI — jalankan setelah memperbarui kode
 * ============================================================ */

/**
 * Sesuaikan struktur sheet dengan SKEMA terbaru tanpa menghapus data.
 * Aman diulang: kolom yang sudah ada dilewati.
 */
function migrasiStruktur() {
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
      if (headLama.indexOf(kol) !== -1) return;

      var posisi = Math.min(target + 1, sh.getLastColumn() + 1);
      if (posisi <= sh.getLastColumn()) sh.insertColumnBefore(posisi);
      else sh.insertColumnAfter(sh.getLastColumn());

      /* insertColumnBefore MEWARISI validasi tetangga — bersihkan,
         kolom ber-enum akan dipasangi validasinya sendiri. */
      sh.getRange(1, posisi, sh.getMaxRows(), 1).setDataValidation(null);

      sh.getRange(1, posisi).setValue(kol);
      headLama.splice(target, 0, kol);
      ditambah.push(kol);
    });

    if (ditambah.length) {
      _formatUlang(sh, def);
      laporan.push('  + ' + _pad(nama, 22) + ditambah.join(', '));
      total += ditambah.length;
    }
  });

  _pasangProperti();

  /* WAJIB: buang memo header lama setelah struktur berubah */
  try { Db.invalidasiHeader(); } catch (e) {}

  Logger.log('=== MIGRASI STRUKTUR ===');
  if (total === 0) Logger.log('  Struktur sudah sesuai. Tidak ada perubahan.');
  else {
    laporan.forEach(function (b) { Logger.log(b); });
    Logger.log('  ' + total + ' kolom/sheet ditambahkan. Data lama utuh.');
  }
  Logger.log('========================');
  return total;
}

/** Paksa kolom tertentu disimpan sebagai TEKS (NISN, no WA, dst.). */
function _pasangFormatTeks(sh, def) {
  if (!def.teks || !def.teks.length) return;
  var head = def.head;
  def.teks.forEach(function (kol) {
    var i = head.indexOf(kol);
    if (i < 0) return;
    sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat('@');
  });
}

/** Terapkan ulang lebar kolom, validasi, dan format tanggal. */
function _formatUlang(sh, def) {
  var head = def.head;

  sh.getRange(1, 1, 1, head.length)
    .setFontWeight('bold').setFontColor('#FFFFFF')
    .setBackground('#2F6B2B').setVerticalAlignment('middle');

  head.forEach(function (kol, i) {
    var w = (def.lebar && def.lebar[kol]) ? def.lebar[kol] : 120;
    sh.setColumnWidth(i + 1, w);

    if (/_at$|^waktu_|^tanggal_|^last_login$|^deadline$|^timestamp$/.test(kol)) {
      sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1)
        .setNumberFormat('yyyy-mm-dd hh:mm:ss');
    }
  });

  _pasangFormatTeks(sh, def);

  if (def.enum) {
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
}

/** Ringkasan isi database. */
function infoDatabase() {
  var ss = _db();
  Logger.log('=== ' + NAMA_DB + ' (' + URUTAN_SHEET.length + ' sheet) ===');
  Logger.log('ID  : ' + ss.getId());
  Logger.log('URL : ' + ss.getUrl());
  Logger.log('');

  var AMBANG = { Progress: 40000, Quiz_Submissions: 20000,
                 Submissions: 20000, Notifications: 20000,
                 Audit_Logs: 20000 };

  var total = 0;
  URUTAN_SHEET.forEach(function (nama) {
    var sh = ss.getSheetByName(nama);
    var n = sh ? Math.max(0, sh.getLastRow() - 1) : -1;
    if (n >= 0) total += n;
    Logger.log('  ' + _pad(nama, 22) +
               (n < 0 ? 'TIDAK ADA' : n + ' baris') +
               (AMBANG[nama] && n >= AMBANG[nama] ? '  ⚠️ LEWAT AMBANG' : ''));
  });

  Logger.log('');
  Logger.log('  Total ' + total + ' baris data.');
  return total;
}

function _pad(s, n) {
  s = String(s);
  while (s.length < n) s += ' ';
  return s;
}
