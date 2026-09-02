/* ============================================================
 *  LMS v2 — uji-tahap4.js
 *  Uji Mapel, Penugasan, Topik, Item + bacaan murid + penjaga.
 *  Jalankan:  node v2/test/uji-tahap4.js
 * ============================================================ */
require('./mock.js');
const fs = require('fs');
const path = require('path');
(0, eval)(fs.readFileSync(path.join(__dirname, '..', 'Util.gs'), 'utf8'));
(0, eval)(fs.readFileSync(path.join(__dirname, '..', 'Auth.gs'), 'utf8'));
(0, eval)(fs.readFileSync(path.join(__dirname, '..', 'Notif.gs'), 'utf8'));
(0, eval)(fs.readFileSync(path.join(__dirname, '..', 'Kelas.gs'), 'utf8'));
(0, eval)(fs.readFileSync(path.join(__dirname, '..', 'Mapel.gs'), 'utf8'));
(0, eval)(fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8'));

let gagal = 0;
let no = 0;
function cek(nama, kondisi, info) {
  no++;
  if (kondisi) console.log('  OK  ' + nama);
  else { console.log('  GAGAL ' + nama + (info ? ' → ' + info : '')); gagal++; }
}

/* ============================================================
 *  SEED — guru, murid, kelas, enrollment
 * ============================================================ */
function buatUser(username, nama, role) {
  const salt = Util.buatSalt();
  const id = Util.buatId('USR');
  Db.tambah('Users', { user_id: id, username,
    password_hash: Util.hashPassword('sandix123', salt), salt,
    pwd_awal: '', nama, role, rombel: '', email: '', nisn: '', no_wa: '',
    status: 'aktif', harus_ganti_password: false, last_login: '',
    created_at: new Date(), updated_at: new Date() });
  return id;
}

const GURU_ID = buatUser('guru', 'Guru Uji', 'guru');
const GURU2   = buatUser('guru2', 'Guru Kedua', 'guru');
const TOKEN_G = Auth.login('guru', 'sandix123').data.token;

let r = muridSimpan(TOKEN_G, { nama: 'Budi Santoso', username: 'budi01' });
const BUDI = r.data.user_id;
r = muridSimpan(TOKEN_G, { nama: 'Citra Dewi', username: 'citra01' });
const CITRA = r.data.user_id;
r = muridSimpan(TOKEN_G, { nama: 'Dodi Pratama', username: 'dodi01' });
const DODI = r.data.user_id;

const TOKEN_B = Auth.login('budi01', Db.cari('Users','user_id',BUDI).pwd_awal).data.token;
const TOKEN_D = Auth.login('dodi01', Db.cari('Users','user_id',DODI).pwd_awal).data.token;

r = kelasSimpan(TOKEN_G, { name: 'XI TJKT 1', academic_year: '2026/2027' });
const KLS = r.data.class_id;
muridDaftarkan(TOKEN_G, KLS, [BUDI, CITRA]);

/* ============================================================
 *  MAPEL (Subjects)
 * ============================================================ */
console.log('\n--- MAPEL ---');

r = mapelSimpan(TOKEN_G, { name: 'Jaringan Dasar', code: 'jd' });
cek('buat mapel', r.ok === true && r.data.baru === true, JSON.stringify(r));
const SBK = r.data.subject_id;
cek('pemilik mapel = guru pembuat',
  Db.cari('Subjects', 'subject_id', SBK).owner_teacher_id === GURU_ID);

r = mapelSimpan(TOKEN_G, { name: '   ' });
cek('mapel tanpa nama ditolak', r.ok === false && r.error === 'VALIDASI_GAGAL');

r = mapelSimpan(TOKEN_G, { subject_id: SBK, code: 'JRD' });
cek('edit mapel parsial (kode saja)',
  r.ok === true && Db.cari('Subjects','subject_id',SBK).code === 'JRD' &&
  Db.cari('Subjects','subject_id',SBK).name === 'Jaringan Dasar');

r = mapelSimpan(TOKEN_G, { subject_id: SBK, name: '' });
cek('edit: nama dikosongkan ditolak', r.ok === false && r.error === 'VALIDASI_GAGAL');

r = mapelDaftar(TOKEN_G);
cek('daftar mapel: 1 mapel, 0 penugasan, pemilik terisi',
  r.ok === true && r.data.length === 1 &&
  r.data[0].jml_penugasan === 0 && r.data[0].owner === 'Guru Uji',
  JSON.stringify(r.data));

r = mapelUbahStatus(TOKEN_G, SBK, 'bekas');
cek('status tidak sah ditolak', r.ok === false && r.error === 'VALIDASI_GAGAL');

r = mapelUbahStatus(TOKEN_G, SBK, 'nonaktif');
cek('nonaktifkan mapel', r.ok === true &&
  Db.cari('Subjects','subject_id',SBK).status === 'nonaktif');

r = penugasanSimpan(TOKEN_G, { class_id: KLS, subject_id: SBK });
cek('penugasan dengan mapel nonaktif ditolak',
  r.ok === false && r.error === 'VALIDASI_GAGAL');

mapelUbahStatus(TOKEN_G, SBK, 'aktif');

r = mapelSimpan(TOKEN_B, { name: 'Diretas' });
cek('murid TIDAK boleh buat mapel', r.ok === false && r.error === 'AKSES_DITOLAK');
r = mapelDaftar(TOKEN_B);
cek('murid TIDAK boleh daftar mapel', r.ok === false && r.error === 'AKSES_DITOLAK');

/* ============================================================
 *  PENUGASAN (Teaching_Assignments)
 * ============================================================ */
console.log('\n--- PENUGASAN ---');

r = penugasanSimpan(TOKEN_G, { class_id: KLS, subject_id: SBK });
cek('buat penugasan', r.ok === true && r.data.baru === true, JSON.stringify(r));
const TA = r.data.teaching_assignment_id;

const taRow = Db.cari('Teaching_Assignments','teaching_assignment_id',TA);
cek('tahun ajaran diambil dari kelas', taRow.academic_year === '2026/2027');
cek('pengampu default = pembuat', taRow.teacher_id === GURU_ID);

r = penugasanSimpan(TOKEN_G, { class_id: KLS, subject_id: SBK });
cek('penugasan kembar ditolak', r.ok === false && r.error === 'DUPLIKAT');

r = penugasanSimpan(TOKEN_G, { class_id: 'KLS-9999', subject_id: SBK });
cek('kelas tidak ditemukan', r.ok === false && r.error === 'TIDAK_DITEMUKAN');

r = penugasanSimpan(TOKEN_G, { class_id: KLS, subject_id: 'SBK-9999' });
cek('mapel tidak ditemukan', r.ok === false && r.error === 'TIDAK_DITEMUKAN');

r = penugasanSimpan(TOKEN_G, { class_id: KLS, subject_id: SBK, teacher_id: BUDI });
cek('pengampu harus guru', r.ok === false && r.error === 'VALIDASI_GAGAL');

r = penugasanDaftar(TOKEN_G, {});
cek('daftar penugasan memuat 1 baris + nama terisi',
  r.ok === true && r.data.length === 1 &&
  r.data[0].kelas === 'XI TJKT 1' && r.data[0].mapel === 'Jaringan Dasar' &&
  r.data[0].guru === 'Guru Uji', JSON.stringify(r.data));

r = penugasanUbahStatus(TOKEN_G, TA, 'nonaktif');
cek('nonaktifkan penugasan', r.ok === true);

r = penugasanDaftar(TOKEN_G, {});
cek('penugasan nonaktif tak tampil default', r.data.length === 0);
r = penugasanDaftar(TOKEN_G, { semua: true });
cek('penugasan nonaktif tampil bila semua', r.data.length === 1);
r = penugasanDaftar(TOKEN_G, { status: 'nonaktif' });
cek('filter status nonaktif', r.data.length === 1);
r = penugasanDaftar(TOKEN_G, { class_id: KLS, semua: true });
cek('filter class_id cocok', r.data.length === 1);
r = penugasanDaftar(TOKEN_G, { class_id: 'KLS-x', semua: true });
cek('filter class lain kosong', r.data.length === 0);
r = penugasanDaftar(TOKEN_G, { subject_id: SBK, semua: true });
cek('filter subject_id cocok', r.data.length === 1);
r = penugasanDaftar(TOKEN_G, { teacher_id: GURU2, semua: true });
cek('filter guru lain kosong', r.data.length === 0);

r = penugasanSimpan(TOKEN_G, { class_id: KLS, subject_id: SBK });
cek('penugasan sama → baris nonaktif diaktifkan kembali',
  r.ok === true && r.data.diaktifkan === true && !r.data.baru,
  JSON.stringify(r));
cek('jumlah baris penugasan tetap 1',
  Db.baca('Teaching_Assignments').length === 1);

r = penugasanSimpan(TOKEN_G,
  { teaching_assignment_id: TA, teacher_id: GURU2 });
cek('edit penugasan: ganti pengampu', r.ok === true &&
  Db.cari('Teaching_Assignments','teaching_assignment_id',TA).teacher_id === GURU2);

r = penugasanSimpan(TOKEN_G,
  { teaching_assignment_id: TA, academic_year: 'salah' });
cek('edit penugasan: tahun salah ditolak', r.ok === false && r.error === 'VALIDASI_GAGAL');

penugasanSimpan(TOKEN_G, { teaching_assignment_id: TA, teacher_id: GURU_ID });

r = penugasanSimpan(TOKEN_B, { class_id: KLS, subject_id: SBK });
cek('murid TIDAK boleh kelola penugasan', r.ok === false && r.error === 'AKSES_DITOLAK');
r = guruDaftar(TOKEN_B);
cek('murid TIDAK boleh daftar guru', r.ok === false && r.error === 'AKSES_DITOLAK');

/* ============================================================
 *  TOPIK (Topics)
 * ============================================================ */
console.log('\n--- TOPIK ---');

r = topikSimpan(TOKEN_G, { teaching_assignment_id: TA, title: 'Bab 1 — Pengenalan' });
cek('buat topik 1', r.ok === true && r.data.baru === true);
const TPC1 = r.data.topic_id;
r = topikSimpan(TOKEN_G, { teaching_assignment_id: TA, title: 'Bab 2' });
const TPC2 = r.data.topic_id;
r = topikSimpan(TOKEN_G, { teaching_assignment_id: TA, title: 'Bab 3' });
const TPC3 = r.data.topic_id;

cek('urutan topik otomatis 1,2,3',
  [TPC1,TPC2,TPC3].map(id => Number(Db.cari('Topics','topic_id',id).sort_order))
    .join(',') === '1,2,3');

r = topikSimpan(TOKEN_G, { teaching_assignment_id: 'TA-9999', title: 'X' });
cek('topik tanpa penugasan sah ditolak', r.ok === false && r.error === 'TIDAK_DITEMUKAN');
r = topikSimpan(TOKEN_G, { teaching_assignment_id: TA, title: '' });
cek('topik tanpa judul ditolak', r.ok === false && r.error === 'VALIDASI_GAGAL');

r = topikSimpan(TOKEN_G, { topic_id: TPC1, description: 'Dasar-dasar jaringan' });
cek('edit topik parsial', r.ok === true &&
  Db.cari('Topics','topic_id',TPC1).description === 'Dasar-dasar jaringan');

r = topikDaftar(TOKEN_G, TA);
cek('topikDaftar: 3 topik urut',
  r.ok === true && r.data.topik.length === 3 &&
  r.data.topik[0].topic_id === TPC1, JSON.stringify(r.data));

r = topikUbahStatus(TOKEN_G, TPC1, 'publish');
cek('terbitkan topik 1', r.ok === true &&
  Db.cari('Topics','topic_id',TPC1).status === 'publish');
r = topikUbahStatus(TOKEN_G, TPC1, 'bekas');
cek('status topik tidak sah ditolak', r.ok === false && r.error === 'VALIDASI_GAGAL');

r = topikPindah(TOKEN_G, TPC3, 'atas');
cek('pindah atas: Bab 3 naik ke urutan 2',
  r.ok === true && r.data.pindah === true &&
  Number(Db.cari('Topics','topic_id',TPC3).sort_order) === 2 &&
  Number(Db.cari('Topics','topic_id',TPC2).sort_order) === 3);
r = topikPindah(TOKEN_G, TPC1, 'atas');
cek('pindah di urutan teratas → no-op',
  r.ok === true && r.data.pindah === false &&
  Number(Db.cari('Topics','topic_id',TPC1).sort_order) === 1);

r = topikHapus(TOKEN_G, TPC1);
/* TPC1 masih kosong — boleh hapus; buat lagi agar uji lanjutan konsisten */
cek('hapus topik kosong berhasil', r.ok === true && r.data.dihapus === true);
r = topikSimpan(TOKEN_G, { teaching_assignment_id: TA, title: 'Bab 1 — Pengenalan',
                           description: 'Dasar-dasar jaringan' });
const TPC1b = r.data.topic_id;
topikUbahStatus(TOKEN_G, TPC1b, 'publish');

r = topikPindah(TOKEN_B, TPC2, 'atas');
cek('murid TIDAK boleh kelola topik', r.ok === false && r.error === 'AKSES_DITOLAK');

/* ============================================================
 *  ITEM (Items)
 * ============================================================ */
console.log('\n--- ITEM ---');

const KONTEN = '<p>Selamat belajar</p><script>alert(1)</script>' +
  '<iframe src="https://www.youtube.com/embed/abc"></iframe>' +
  '<iframe src="https://www.youtube.com.jahat.id/embed/x"></iframe>';

r = itemSimpan(TOKEN_G, { topic_id: TPC1b, type: 'materi',
  title: 'Pengenalan LAN', content: KONTEN });
cek('buat item materi', r.ok === true && r.data.baru === true, JSON.stringify(r));
const ITM1 = r.data.item_id;

const isi = Db.cari('Items','item_id',ITM1).content;
cek('konten: script dibuang', isi.indexOf('<script>') === -1, isi);
cek('konten: iframe youtube dipertahankan',
  isi.indexOf('https://www.youtube.com/embed/abc') !== -1);
cek('konten: iframe domain asing dibuang',
  isi.indexOf('jahat.id') === -1);

r = itemSimpan(TOKEN_G, { topic_id: TPC1b, type: 'quiz', title: 'Quiz Bab 1' });
const ITMQ = r.data.item_id;
r = itemSimpan(TOKEN_G, { topic_id: TPC1b, type: 'materi', title: 'Perangkat Jaringan' });
const ITM2 = r.data.item_id;

r = itemSimpan(TOKEN_G, { topic_id: TPC1b, type: 'salah', title: 'X' });
cek('jenis item tidak dikenal ditolak', r.ok === false && r.error === 'VALIDASI_GAGAL');
r = itemSimpan(TOKEN_G, { topic_id: 'TPC-9999', type: 'materi', title: 'X' });
cek('item tanpa topik sah ditolak', r.ok === false && r.error === 'TIDAK_DITEMUKAN');
r = itemSimpan(TOKEN_G, { topic_id: TPC1b, type: 'materi', title: '' });
cek('item tanpa judul ditolak', r.ok === false && r.error === 'VALIDASI_GAGAL');

r = itemDaftar(TOKEN_G, TPC1b);
cek('itemDaftar: 3 item urut + tanpa konten',
  r.ok === true && r.data.length === 3 &&
  r.data[0].item_id === ITM1 && r.data[0].content === undefined,
  JSON.stringify(r.data && r.data.map(x=>x.title)));

r = itemSimpan(TOKEN_G, { item_id: ITM1, description: 'Materi pembuka.' });
cek('edit item parsial: deskripsi, konten utuh',
  r.ok === true &&
  Db.cari('Items','item_id',ITM1).description === 'Materi pembuka.' &&
  Db.cari('Items','item_id',ITM1).content.indexOf('Selamat belajar') !== -1);

r = itemPindah(TOKEN_G, ITM2, 'atas');
cek('pindah item atas: tukar dengan tetangga',
  r.ok === true && r.data.pindah === true &&
  Number(Db.cari('Items','item_id',ITM2).sort_order) === 2 &&
  Number(Db.cari('Items','item_id',ITMQ).sort_order) === 3 &&
  Number(Db.cari('Items','item_id',ITM1).sort_order) === 1);

/* publish item: topik sudah publish → notif ke 2 murid terdaftar */
r = itemUbahStatus(TOKEN_G, ITM1, 'publish');
cek('terbitkan item', r.ok === true);
cek('notif materi baru terkirim ke 2 murid',
  Db.saring('Notifications', { jenis: 'pertemuan_baru' }).length === 2);

itemUbahStatus(TOKEN_G, ITM1, 'publish');
cek('publish ulang tidak menggandakan notif',
  Db.saring('Notifications', { jenis: 'pertemuan_baru' }).length === 2);

r = itemUbahStatus(TOKEN_G, ITM1, 'bekas');
cek('status item tidak sah ditolak', r.ok === false && r.error === 'VALIDASI_GAGAL');

/* item tertaut tidak boleh dihapus */
Db.perbarui('Items', Db.cari('Items','item_id',ITMQ)._baris, { related_id: 'QIZ-0001' });
r = itemHapus(TOKEN_G, ITMQ);
cek('item tertaut ditolak dihapus', r.ok === false && r.error === 'VALIDASI_GAGAL');

r = itemHapus(TOKEN_B, ITM2);
cek('murid TIDAK boleh hapus item', r.ok === false && r.error === 'AKSES_DITOLAK');
r = itemSimpan(TOKEN_B, { topic_id: TPC1b, type: 'materi', title: 'X' });
cek('murid TIDAK boleh buat item', r.ok === false && r.error === 'AKSES_DITOLAK');

/* ============================================================
 *  BACAAN MURID
 * ============================================================ */
console.log('\n--- BACAAN MURID ---');

r = kelasSaya(TOKEN_B);
cek('kelasSaya membawa ta_id pada mapel',
  r.ok === true && r.data[0].mapel[0].ta_id === TA &&
  r.data[0].mapel[0].subject_id === SBK, JSON.stringify(r.data));

/* kartu course ala v1: jumlah topik publish per mapel */
cek('kelasSaya mapel membawa jml_topik (publish saja)',
  r.data[0].mapel[0].jml_topik ===
  Db.baca('Topics').filter(function (t) {
    return t.teaching_assignment_id === TA && t.status === 'publish';
  }).length,
  'jml_topik=' + r.data[0].mapel[0].jml_topik);

/* daftar isi ala v1: item publish menempel di topiknya, tanpa konten.
   ITM1 ada di TPC1b; hanya ITM1 yang publish (ITMQ/ITM2 masih draf). */
r = topikKelasSaya(TOKEN_B, TA);
const TPC1bTopik = r.ok ? r.data.topik.filter(function (t) {
  return t.topic_id === TPC1b; })[0] : null;
const TPC1items = (TPC1bTopik && TPC1bTopik.item) || [];
cek('topikKelasSaya: item publish menempel pada topik',
  TPC1bTopik && TPC1bTopik.jml_item === 1 &&
  TPC1items.some(function (i) {
    return i.item_id === ITM1 && i.type === 'materi' &&
           i.title === 'Pengenalan LAN'; }),
  JSON.stringify(TPC1bTopik || r).slice(0, 220));
cek('topikKelasSaya: item TANPA konten',
  TPC1items.every(function (i) { return i.content === undefined; }));

r = topikKelasSaya(TOKEN_B, TA);
cek('topikKelasSaya: konteks kelas/mapel/guru terisi',
  r.ok === true && r.data.kelas.name === 'XI TJKT 1' &&
  r.data.mapel.name === 'Jaringan Dasar' && r.data.guru === 'Guru Uji',
  JSON.stringify(r.data));
cek('topikKelasSaya: hanya publish, hitung item publish saja',
  r.data.topik.length === 1 && r.data.topik[0].topic_id === TPC1b &&
  r.data.topik[0].jml_item === 1, JSON.stringify(r.data.topik));

itemUbahStatus(TOKEN_G, ITM2, 'publish');
r = topikKelasSaya(TOKEN_B, TA);
cek('item kedua masuk hitungan setelah publish', r.data.topik[0].jml_item === 2);

r = bukaTopik(TOKEN_B, TPC1b);
cek('bukaTopik: 2 item publish tanpa konten',
  r.ok === true && r.data.item.length === 2 &&
  r.data.item.every(i => i.content === undefined), JSON.stringify(r.data));

/* draft item tersembunyi */
r = itemSimpan(TOKEN_G, { topic_id: TPC1b, type: 'materi', title: 'Draf tersembunyi' });
const ITMD = r.data.item_id;
r = bukaTopik(TOKEN_B, TPC1b);
cek('item draft tersembunyi dari murid', r.data.item.length === 2);
itemHapus(TOKEN_G, ITMD);

r = bacaMateri(TOKEN_B, ITM1);
cek('bacaMateri: konten tampil',
  r.ok === true && r.data.content.indexOf('Selamat belajar') !== -1 &&
  r.data.topik === 'Bab 1 — Pengenalan', JSON.stringify(r.data && r.data.title));

itemUbahStatus(TOKEN_G, ITMQ, 'publish');   /* quiz diterbitkan utk uji penjaga */
r = bacaMateri(TOKEN_B, ITMQ);
cek('bacaMateri quiz → FITUR_BELUM_ADA',
  r.ok === false && r.error === 'FITUR_BELUM_ADA');

/* draf topic tidak terlihat */
r = topikSimpan(TOKEN_G, { teaching_assignment_id: TA, title: 'Bab Draf' });
const TPCD = r.data.topic_id;
r = bukaTopik(TOKEN_B, TPCD);
cek('topik draft ditolak untuk murid', r.ok === false && r.error === 'TIDAK_DITEMUKAN');
r = topikKelasSaya(TOKEN_B, TA);
cek('topik draft tidak masuk daftar murid', r.data.topik.length === 1);
topikHapus(TOKEN_G, TPCD);

/* murid tak terdaftar */
r = topikKelasSaya(TOKEN_D, TA);
cek('murid tak terdaftar ditolak', r.ok === false && r.error === 'AKSES_DITOLAK');
r = bacaMateri(TOKEN_D, ITM1);
cek('murid tak terdaftar tak bisa baca materi', r.ok === false && r.error === 'AKSES_DITOLAK');

/* penugasan nonaktif → bacaan tertutup */
penugasanUbahStatus(TOKEN_G, TA, 'nonaktif');
r = topikKelasSaya(TOKEN_B, TA);
cek('penugasan nonaktif menutup bacaan', r.ok === false && r.error === 'TIDAK_DITEMUKAN');
penugasanUbahStatus(TOKEN_G, TA, 'aktif');

/* kelas diarsipkan → bacaan tertutup */
kelasUbahStatus(TOKEN_G, KLS, 'arsip');
r = topikKelasSaya(TOKEN_B, TA);
cek('kelas arsip menutup bacaan', r.ok === false && r.error === 'TIDAK_DITEMUKAN');
kelasUbahStatus(TOKEN_G, KLS, 'aktif');

/* sesi rusak */
r = bacaMateri('token-palsu', ITM1);
cek('token palsu → SESI_INVALID', r.ok === false && r.error === 'SESI_INVALID');

/* ============================================================
 *  GET ITEM GURU (editor)
 * ============================================================ */
console.log('\n--- GET ITEM GURU (editor) ---');
r = getItemGuru(TOKEN_G, ITM1);
cek('guru membaca detail item berisi konten',
  r.ok === true && r.data.item_id === ITM1 &&
  String(r.data.content).indexOf('Selamat belajar') !== -1 &&
  r.data.topic_id && r.data.status === 'publish',
  JSON.stringify(r.data || r).slice(0, 200));
r = getItemGuru(TOKEN_B, ITM1);
cek('murid ditolak getItemGuru', r.ok === false && r.error === 'AKSES_DITOLAK');
r = getItemGuru(TOKEN_G, 'ITM-tak-ada');
cek('item tak ada → TIDAK_DITEMUKAN',
  r.ok === false && r.error === 'TIDAK_DITEMUKAN');

/* ============================================================
 *  ITEM MANDIRI & JADWAL TERBIT (pola v1 yang diminta guru)
 * ============================================================ */
console.log('\n--- ITEM MANDIRI & JADWAL TERBIT ---');

/* quiz mandiri tanpa topik — wajib ta_id */
r = itemSimpan(TOKEN_G, { ta_id: TA, type: 'quiz', title: 'UTS Jaringan' });
cek('quiz mandiri tanpa topik dibuat', r.ok === true && r.data.baru === true,
  JSON.stringify(r));
const ITM_M = r.data.item_id;

r = itemSimpan(TOKEN_G, { type: 'quiz', title: 'Tanpa induk' });
cek('quiz tanpa topik & tanpa ta_id ditolak',
  r.ok === false && r.error === 'TIDAK_DITEMUKAN');
r = itemSimpan(TOKEN_G, { ta_id: TA, type: 'materi', title: 'X' });
cek('materi wajib bertopik',
  r.ok === false && r.error === 'VALIDASI_GAGAL');

/* daftar guru membawa mandiri[] */
r = topikDaftar(TOKEN_G, TA);
cek('topikDaftar membawa mandiri (1 item)',
  r.ok === true && r.data.mandiri.length === 1 &&
  r.data.mandiri[0].item_id === ITM_M &&
  r.data.mandiri[0].type === 'quiz', JSON.stringify(r.data.mandiri));

/* jadwal terbit: scheduled tanpa jadwal ditolak */
r = itemUbahStatus(TOKEN_G, ITM_M, 'scheduled', '');
cek('scheduled tanpa waktu ditolak',
  r.ok === false && r.error === 'VALIDASI_GAGAL');

/* terjadwal di masa depan → belum terlihat murid */
r = itemUbahStatus(TOKEN_G, ITM_M, 'scheduled', '9999-12-31 23:59');
cek('pasang jadwal masa depan', r.ok === true &&
  r.data.publish_at === '9999-12-31 23:59:00', JSON.stringify(r));
let dMurid = topikKelasSaya(TOKEN_B, TA);
cek('murid TIDAK melihat mandiri sebelum waktunya',
  dMurid.ok === true && dMurid.data.mandiri.length === 0,
  JSON.stringify(dMurid.data.mandiri));

/* waktunya tiba → otomatis terlihat (lazy, tanpa trigger) */
itemUbahStatus(TOKEN_G, ITM_M, 'scheduled', '2000-01-01 00:00');
dMurid = topikKelasSaya(TOKEN_B, TA);
cek('murid MELIHAT mandiri setelah waktunya',
  dMurid.ok === true && dMurid.data.mandiri.length === 1 &&
  dMurid.data.mandiri[0].item_id === ITM_M,
  JSON.stringify(dMurid.data && dMurid.data.mandiri));

/* batal jadwal → draft, publish_at kosong */
r = itemUbahStatus(TOKEN_G, ITM_M, 'draft');
cek('batal jadwal → draft tanpa publish_at',
  r.ok === true &&
  Db.cari('Items', 'item_id', ITM_M).publish_at === '' &&
  Db.cari('Items', 'item_id', ITM_M).status === 'draft');

/* jadwal pada TOPIK: sembunyi sebelum waktunya, muncul tepat */
r = topikUbahStatus(TOKEN_G, TPC2, 'scheduled', '9999-12-31 23:59');
cek('topik dijadwalkan', r.ok === true && r.data.status === 'scheduled');
dMurid = topikKelasSaya(TOKEN_B, TA);
cek('murid tidak melihat topik terjadwal sebelum waktunya',
  dMurid.ok === true &&
  dMurid.data.topik.every(function (t) { return t.topic_id !== TPC2; }));
topikUbahStatus(TOKEN_G, TPC2, 'scheduled', '2000-01-01 00:00');
dMurid = topikKelasSaya(TOKEN_B, TA);
cek('topik terjadwal muncul saat waktunya',
  dMurid.ok === true &&
  dMurid.data.topik.some(function (t) { return t.topic_id === TPC2; }));
r = topikUbahStatus(TOKEN_G, TPC2, 'draft');
cek('batal jadwal topik → draf',
  Db.cari('Topics', 'topic_id', TPC2).status === 'draft' &&
  Db.cari('Topics', 'topic_id', TPC2).publish_at === '');

/* ============================================================
 *  AUDIT & RAPIH
 * ============================================================ */
console.log('\n--- AUDIT ---');
const log = Db.baca('Audit_Logs').map(l => l.action + ':' + l.detail);
cek('audit: buat_mapel tercatat', log.some(x => x.indexOf('CREATE:buat_mapel') === 0));
cek('audit: buat_penugasan tercatat', log.some(x => x.indexOf('CREATE:buat_penugasan') === 0));
cek('audit: buat_topik tercatat', log.some(x => x.indexOf('CREATE:buat_topik') === 0));
cek('audit: reaktivasi penugasan tercatat',
  log.some(x => x.indexOf('UPDATE:reaktivasi_penugasan') === 0));
cek('audit: hapus_topik tercatat', log.some(x => x.indexOf('DELETE:hapus_topik') === 0));
cek('audit: item_publish tercatat', log.some(x => x.indexOf('UPDATE:item_publish') === 0));

r = penugasanDaftar(TOKEN_G, {});
cek('sanity: penugasan aktif 1 dengan 3 topik',
  r.data.length === 1 && r.data[0].jml_topik === 3, JSON.stringify(r.data));

/* kartu course ala v1: draf & murid per penugasan */
cek('penugasan membawa jml_draf yang benar',
  r.data[0].jml_draf === Db.baca('Topics').filter(function (t) {
    return t.teaching_assignment_id === r.data[0].teaching_assignment_id &&
           t.status !== 'publish';
  }).length,
  'jml_draf=' + r.data[0].jml_draf);
cek('penugasan membawa jml_murid yang benar',
  r.data[0].jml_murid === Db.baca('Enrollment').filter(function (e) {
    return e.class_id === r.data[0].class_id && e.status === 'aktif';
  }).length,
  'jml_murid=' + r.data[0].jml_murid);

console.log(gagal === 0 ? '\nSEMUA ' + no + ' UJI TAHAP 4 LULUS ✔'
                        : '\nADA ' + gagal + '/' + no + ' UJI GAGAL ✘');
process.exit(gagal ? 1 : 0);
