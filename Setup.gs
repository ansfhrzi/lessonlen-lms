/**
 * LessonLen v2 — Setup.gs
 * Jalankan setupLengkap() sekali dari editor Apps Script.
 */

var NAMA_DB = 'DB_LESSONLEN';

var SKEMA = {
  users: {
    head: ['user_id','username','password_hash','salt','pwd_awal','nama','role',
           'email','status','harus_ganti_password','last_login','created_at']
  },
  kelas: {
    head: ['kelas_id','nama_kelas','mapel','jenjang','fase','tingkat','status','created_at']
  },
  enrollment: {
    head: ['enroll_id','kelas_id','user_id','status','tanggal_daftar']
  },
  bab: {
    head: ['bab_id','kelas_id','urutan','judul','deskripsi','status',
           'akses','terbuka','buka_at','tutup_at','created_at','updated_at']
  },
  item: {
    head: ['item_id','bab_id','kelas_id','grup','urutan','tipe','judul','konten',
           'status','akses','terbuka','buka_at','tutup_at',
           'kkm','max_percobaan','created_at','updated_at']
  },
  soal: {
    head: ['soal_id','item_id','nomor','tipe','pertanyaan','opsi','kunci','bobot']
  },
  progress: {
    head: ['progress_id','user_id','item_id','bab_id','kelas_id','tipe',
           'ditandai','ditandai_at','nilai','updated_at']
  },
  quiz_attempt: {
    head: ['attempt_id','user_id','item_id','percobaan_ke','status','jawaban',
           'nilai','lulus','mulai_at','selesai_at']
  },
  lkpd_submission: {
    head: ['submission_id','user_id','item_id','kelas_id','links','catatan_murid',
           'status','nilai','catatan_guru','waktu_kumpul','waktu_dinilai']
  },
  session: {
    head: ['token','user_id','dibuat_at','expired_at']
  },
  log: {
    head: ['log_id','user_id','aksi','detail','status','timestamp']
  }
};

var URUTAN_SHEET = ['users','kelas','enrollment','bab','item','soal','progress',
                    'quiz_attempt','lkpd_submission','session','log'];

function _hanyaEditor() {
  /* google.script.run bisa memanggil fungsi global. Setup hanya dari editor. */
  if (typeof SpreadsheetApp === 'undefined') return;
}

function setupLengkap() {
  var id = setupDatabase();
  isiSeedData();
  Logger.log('==================================================');
  Logger.log(' SETUP LENGKAP SELESAI  LessonLen v2');
  Logger.log(' DB_ID: ' + id);
  Logger.log(' URL  : https://docs.google.com/spreadsheets/d/' + id);
  Logger.log(' guru / guru123     murid / siswa01 siswa123');
  Logger.log('==================================================');
  return id;
}

function setupDatabase() {
  var P = PropertiesService.getScriptProperties();
  var idLama = P.getProperty('DB_ID');
  var ss = null;
  if (idLama) {
    try { ss = SpreadsheetApp.openById(idLama); } catch (e) { ss = null; }
  }
  if (!ss) {
    ss = SpreadsheetApp.create(NAMA_DB);
    P.setProperty('DB_ID', ss.getId());
  }
  ss.setSpreadsheetTimeZone('Asia/Jakarta');
  URUTAN_SHEET.forEach(function (nama) { _buatSheet(ss, nama, SKEMA[nama]); });
  ['Sheet1','Sheet 1','Helaian1'].forEach(function (n) {
    var sh = ss.getSheetByName(n);
    if (sh && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });
  URUTAN_SHEET.forEach(function (nama, i) {
    var sh = ss.getSheetByName(nama);
    if (sh) { ss.setActiveSheet(sh); ss.moveActiveSheet(i + 1); }
  });
  ['USR','KLS','ENR','BAB','ITM','PRG','SOL','ATT','LKP','LOG'].forEach(function (p) {
    if (P.getProperty('CTR_' + p) === null) P.setProperty('CTR_' + p, '0');
  });
  return ss.getId();
}

function _buatSheet(ss, nama, def) {
  var sh = ss.getSheetByName(nama);
  if (!sh) sh = ss.insertSheet(nama);
  var head = def.head;
  sh.getRange(1, 1, 1, head.length)
    .setValues([head])
    .setFontWeight('bold').setFontColor('#FFFFFF')
    .setBackground('#4E9A4A').setVerticalAlignment('middle');
  sh.setFrozenRows(1);
  var maxKol = sh.getMaxColumns();
  if (maxKol > head.length) sh.deleteColumns(head.length + 1, maxKol - head.length);
}

function _salt() {
  var c = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var s = '';
  for (var i = 0; i < 16; i++) s += c.charAt(Math.floor(Math.random() * c.length));
  return s;
}

function _hash(password, salt) {
  return Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256, salt + password, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); })
    .join('');
}

function _id(prefix) {
  var P = PropertiesService.getScriptProperties();
  var k = 'CTR_' + prefix;
  var n = Number(P.getProperty(k) || 0) + 1;
  P.setProperty(k, String(n));
  return prefix + '-' + ('0000' + n).slice(-4);
}

function _tambah(nama, arr) {
  if (!arr || !arr.length) return;
  var sh = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('DB_ID')).getSheetByName(nama);
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var baris = arr.map(function (o) {
    return head.map(function (h) { return o[h] !== undefined ? o[h] : ''; });
  });
  sh.getRange(sh.getLastRow() + 1, 1, baris.length, head.length).setValues(baris);
}

function isiSeedData() {
  var ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('DB_ID'));
  if (ss.getSheetByName('users').getLastRow() > 1) {
    Logger.log('Data sudah ada — seed dilewati.');
    return;
  }
  var now = Util.sekarang();
  var sg = _salt();
  var guru = {
    user_id: _id('USR'), username: 'guru',
    password_hash: _hash('guru123', sg), salt: sg, pwd_awal: 'guru123',
    nama: 'Guru PKPJ', role: 'guru', email: '',
    status: 'aktif', harus_ganti_password: false, last_login: '', created_at: now
  };
  var murid = [];
  ['Ahmad Fauzi','Bella Kusuma','Candra Wijaya'].forEach(function (nm, i) {
    var s = _salt();
    murid.push({
      user_id: _id('USR'), username: 'siswa0' + (i + 1),
      password_hash: _hash('siswa123', s), salt: s, pwd_awal: 'siswa123',
      nama: nm, role: 'murid', email: '',
      status: 'aktif', harus_ganti_password: false, last_login: '', created_at: now
    });
  });
  _tambah('users', [guru].concat(murid));

  var kelas = {
    kelas_id: _id('KLS'), nama_kelas: 'XI TJKT 1',
    mapel: 'Pemasangan dan Konfigurasi Peralatan Jaringan (PKPJ)',
    jenjang: 'SMK', fase: 'F', tingkat: 'XI',
    status: 'aktif', created_at: now
  };
  _tambah('kelas', [kelas]);
  _tambah('enrollment', murid.map(function (m) {
    return { enroll_id: _id('ENR'), kelas_id: kelas.kelas_id,
             user_id: m.user_id, status: 'aktif', tanggal_daftar: now };
  }));

  var bab1 = {
    bab_id: _id('BAB'), kelas_id: kelas.kelas_id, urutan: 1,
    judul: 'Konsep Dasar VLAN',
    deskripsi: 'Pengertian, manfaat, dan jenis VLAN.',
    status: 'publish', akses: 'manual', terbuka: true,
    buka_at: '', tutup_at: '', created_at: now, updated_at: now
  };
  var bab2 = {
    bab_id: _id('BAB'), kelas_id: kelas.kelas_id, urutan: 2,
    judul: 'Konfigurasi VLAN',
    deskripsi: 'Praktik membuat VLAN pada switch.',
    status: 'publish', akses: 'manual', terbuka: false,
    buka_at: '', tutup_at: '', created_at: now, updated_at: now
  };
  _tambah('bab', [bab1, bab2]);

  var i1 = {
    item_id: _id('ITM'), bab_id: bab1.bab_id, kelas_id: kelas.kelas_id,
    grup: 'Pertemuan 1', urutan: 1, tipe: 'materi', judul: 'Apa itu VLAN',
    konten:
      '<h3>Pengertian</h3>' +
      '<p><b>VLAN</b> membagi satu jaringan fisik menjadi beberapa jaringan logis. ' +
      'Perangkat di switch yang sama bisa seolah berada di jaringan berbeda.</p>' +
      '<!--bagian-->' +
      '<h3>Manfaat</h3>' +
      '<ul><li>Keamanan — lalu lintas terisolasi</li>' +
      '<li>Efisiensi — broadcast domain mengecil</li>' +
      '<li>Fleksibilitas — kelompok berdasarkan fungsi, bukan lokasi</li></ul>',
    status: 'publish', akses: 'ikut_bab', terbuka: false,
    buka_at: '', tutup_at: '', kkm: '', max_percobaan: '',
    created_at: now, updated_at: now
  };
  var i2 = {
    item_id: _id('ITM'), bab_id: bab1.bab_id, kelas_id: kelas.kelas_id,
    grup: 'Pertemuan 1', urutan: 2, tipe: 'lkpd',
    judul: 'LKPD — Identifikasi Kebutuhan VLAN',
    konten:
      '<p>Rancang pembagian VLAN untuk sekolah (minimal 3 VLAN). ' +
      'Simpan sebagai Docs/PDF, atur berbagi “siapa saja yang punya tautan”, ' +
      'lalu tempel tautannya di bawah.</p>',
    status: 'publish', akses: 'ikut_bab', terbuka: false,
    buka_at: '', tutup_at: '', kkm: '', max_percobaan: '',
    created_at: now, updated_at: now
  };
  var i3 = {
    item_id: _id('ITM'), bab_id: bab1.bab_id, kelas_id: kelas.kelas_id,
    grup: 'Pertemuan 1', urutan: 3, tipe: 'quiz', judul: 'Quiz Konsep VLAN',
    konten: 'Lima soal pilihan ganda.',
    status: 'publish', akses: 'ikut_bab', terbuka: false,
    buka_at: '', tutup_at: '', kkm: 75, max_percobaan: 3,
    created_at: now, updated_at: now
  };
  var i4 = {
    item_id: _id('ITM'), bab_id: bab2.bab_id, kelas_id: kelas.kelas_id,
    grup: 'Pertemuan 2', urutan: 1, tipe: 'materi', judul: 'Langkah Konfigurasi',
    konten:
      '<p>Buat VLAN di mode konfigurasi global, lalu tetapkan port.</p>' +
      '<pre>Switch(config)# vlan 10\nSwitch(config-vlan)# name LAB</pre>',
    status: 'publish', akses: 'ikut_bab', terbuka: false,
    buka_at: '', tutup_at: '', kkm: '', max_percobaan: '',
    created_at: now, updated_at: now
  };
  _tambah('item', [i1, i2, i3, i4]);

  var soal = [
    { p: 'Fungsi utama VLAN?',
      o: ['Memisahkan broadcast domain secara logis','Menambah kecepatan kabel',
          'Mengganti IP otomatis','Mempercepat routing'], k: 'A' },
    { p: 'Jenis VLAN yang paling umum dipakai?',
      o: ['MAC-based','Port-based','Protocol-based','Dynamic'], k: 'B' },
    { p: 'Perintah melihat daftar VLAN di Cisco?',
      o: ['show ip route','show running-config','show vlan brief','show interfaces'], k: 'C' },
    { p: 'Manakah yang BUKAN manfaat VLAN?',
      o: ['Keamanan','Mengurangi broadcast','Menambah bandwidth fisik kabel','Pengelompokan mudah'], k: 'C' },
    { p: 'Agar dua VLAN saling berkomunikasi diperlukan…',
      o: ['Hub tambahan','Router atau switch layer 3','Kabel crossover','Repeater'], k: 'B' }
  ];
  _tambah('soal', soal.map(function (s, i) {
    return {
      soal_id: _id('SOL'), item_id: i3.item_id, nomor: i + 1, tipe: 'pg',
      pertanyaan: s.p, opsi: JSON.stringify(s.o), kunci: s.k, bobot: 1
    };
  }));
  Logger.log('Seed: 1 guru, 3 murid, 1 kelas, 2 bab, 4 item, 5 soal.');
}

function migrasiStruktur() {
  var ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('DB_ID'));
  URUTAN_SHEET.forEach(function (nama) {
    var def = SKEMA[nama];
    var sh = ss.getSheetByName(nama);
    if (!sh) { _buatSheet(ss, nama, def); return; }
    var headLama = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0]
      .map(function (h) { return String(h).trim(); });
    def.head.forEach(function (kol, target) {
      if (headLama.indexOf(kol) !== -1) return;
      var posisi = Math.min(target + 1, sh.getLastColumn() + 1);
      if (posisi <= sh.getLastColumn()) sh.insertColumnBefore(posisi);
      else sh.insertColumnAfter(sh.getLastColumn());
      sh.getRange(1, posisi).setValue(kol);
      headLama.splice(target, 0, kol);
    });
  });
  Logger.log('Migrasi struktur selesai.');
}
