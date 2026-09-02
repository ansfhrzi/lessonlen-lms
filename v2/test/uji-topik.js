/* ============================================================
 *  LMS v2 — uji-topik.js
 *  Uji logika Kelola Topik & Item (Topik.gs + endpoint Code.gs)
 *  — Tahap 4 poin 1, acuan §7.8/§7.8b:
 *    susunan gabungan, buat paling dasar, 5 jenis item,
 *    status 👁/🙈 (jadwal batal), jadwal scheduled, pindah+renumber,
 *    hapus (topik kaskade item), notifikasi publish eksplisit.
 *  Jalankan:  node v2/test/uji-topik.js
 * ============================================================ */
require('./mock.js');
const fs = require('fs');
const path = require('path');
['Util', 'Auth', 'Kelas', 'Course', 'Topik', 'Code'].forEach(function (n) {
  (0, eval)(fs.readFileSync(path.join(__dirname, '..', n + '.gs'), 'utf8'));
});

let gagal = 0, no = 0;
function cek(nama, kondisi, info) {
  no++;
  if (kondisi) console.log('  OK  ' + nama);
  else { console.log('  GAGAL ' + nama + (info ? ' → ' + info : '')); gagal++; }
}
function cobalah(fn) {
  try { return fn(); }
  catch (e) { return { error: e.kode || 'GALAT', pesan: e.message }; }
}
function jml(n) { return Db.baca(n).length; }
function notifPB() { return Db.saring('Notifications', { jenis: 'pertemuan_baru' }); }

const SESI_GURU = { user_id: 'USR-GURU', role: 'guru' };

/* ---- seed: guru, kelas, murid ter-enroll (untuk notifikasi) ---- */
const saltG = Util.buatSalt();
Db.tambah('Users', { user_id: 'USR-GURU', username: 'guru',
  password_hash: Util.hashPassword('guru123', saltG), salt: saltG, pwd_awal: '',
  nama: 'Guru Uji', role: 'guru', rombel: '', email: '', nisn: '', no_wa: '',
  tanggal_lahir: '', status: 'aktif', harus_ganti_password: false,
  last_login: '', created_at: new Date(), updated_at: new Date() });
Db.tambah('Classes', { class_id: 'CLS-0001', name: 'XI TKJ 1',
  academic_year: '2026/2027', status: 'aktif',
  created_at: new Date(), updated_at: new Date() });
const saltM = Util.buatSalt();
Db.tambah('Users', { user_id: 'USR-M1', username: 'rina.andini',
  password_hash: Util.hashPassword('Rina12345', saltM), salt: saltM, pwd_awal: '',
  nama: 'Rina Andini', role: 'murid', rombel: '', email: '', nisn: '', no_wa: '',
  tanggal_lahir: '', status: 'aktif', harus_ganti_password: false,
  last_login: '', created_at: new Date(), updated_at: new Date() });
Db.tambah('Enrollment', { enroll_id: 'ENR-0001', class_id: 'CLS-0001',
  user_id: 'USR-M1', tanggal_daftar: new Date(), status: 'aktif' });

const TA1 = Course.simpan(SESI_GURU, { class_id: 'CLS-0001', name: 'Matematika' })
  .teaching_assignment_id;

console.log('\n== BUAT BARIS (selalu paling dasar — §7.8b) ==');

let r = cobalah(function () { return Topik.buatBaris(SESI_GURU, TA1, { jenis_baris: 'topik' }); });
cek('tanpa judul ditolak', r.error === 'VALIDASI_GAGAL');
r = cobalah(function () { return Topik.buatBaris(SESI_GURU, TA1, { jenis_baris: 'materi', judul: 'X' }); });
cek('materi MANDIRI ditolak (wajib bertopik §7.8b-1)', r.error === 'VALIDASI_GAGAL');
r = cobalah(function () { return Topik.buatBaris(SESI_GURU, TA1, { jenis_baris: 'topik', judul: '' }); });
cek('judul kosong ditolak', r.error === 'VALIDASI_GAGAL');

r = Topik.buatBaris(SESI_GURU, TA1, { jenis_baris: 'topik', judul: 'Pecahan' });
const TPC = r.id;
let tp = Db.cari('Topics', 'topic_id', TPC);
cek('topik dibuat draf urutan 1', tp && tp.status === 'draft' && Number(tp.sort_order) === 1);
cek('ID topik berawalan TPC-', /^TPC-/.test(TPC));

r = Topik.buatBaris(SESI_GURU, TA1, { jenis_baris: 'quiz_mandiri',
  judul: 'Tryout operasi hitung', status: 'publish' });
const ITM_TRY = r.id;
let it = Db.cari('Items', 'item_id', ITM_TRY);
cek('quiz mandiri = Items dgn ta_id, topic_id kosong',
    it && it.ta_id === TA1 && !it.topic_id && it.type === 'quiz');
cek('masuk paling dasar (urutan 2)', Number(it.sort_order) === 2);
cek('publish eksplisit → notifikasi pertemuan_baru (1 murid)',
    notifPB().length === 1 && notifPB()[0].user_id === 'USR-M1');

r = Topik.buatBaris(SESI_GURU, TA1, { jenis_baris: 'refleksi_mandiri', judul: 'Refleksi #1' });
const ITM_REF = r.id;
cek('refleksi mandiri urutan 3',
    Number(Db.cari('Items', 'item_id', ITM_REF).sort_order) === 3);

console.log('\n== SUSUNAN GABUNGAN ==');

r = Topik.susunan(SESI_GURU, TA1);
cek('course terbawa (mapel)', r.course.subject_name === 'Matematika');
cek('3 baris urut gabungan: topik, quiz, refleksi',
    r.baris.length === 3 &&
    r.baris[0].tipe === 'topik' && r.baris[1].jenis === 'quiz_mandiri' &&
    r.baris[2].jenis === 'refleksi_mandiri', JSON.stringify(r.baris.map(b => b.jenis)));
cek('urutan 1..3', r.baris.map(b => b.urutan).join('') === '123');

console.log('\n== ITEM DALAM TOPIK (5 jenis §7.8) ==');

r = cobalah(function () { return Topik.buatItem(SESI_GURU, TPC, { type: 'lkpd', judul: 'X' }); });
cek('jenis di luar enum ditolak', r.error === 'VALIDASI_GAGAL');
r = cobalah(function () { return Topik.buatItem(SESI_GURU, TPC, { type: 'materi' }); });
cek('item tanpa judul ditolak', r.error === 'VALIDASI_GAGAL');

['materi', 'tugas_individu', 'quiz'].forEach(function (jp, i) {
  Topik.buatItem(SESI_GURU, TPC, { type: jp, judul: 'Item ' + jp });
});
r = Topik.susunan(SESI_GURU, TA1);
cek('3 item dalam topik urut 1..3',
    r.baris[0].item.length === 3 &&
    r.baris[0].item.map(x => x.jenis).join(',') === 'materi,tugas_individu,quiz');
const ITM_QUIZ = r.baris[0].item[2].id;

console.log('\n== UBAH ==');

r = cobalah(function () { return Topik.ubahBaris(SESI_GURU, 'topik', TPC, { judul: '  ' }); });
cek('ubah dgn judul kosong ditolak', r.error === 'VALIDASI_GAGAL');
Topik.ubahBaris(SESI_GURU, 'topik', TPC, { judul: 'Pecahan & desimal', deskripsi: 'Bab 1', status: 'draft' });
cek('ubah judul+desk tersimpan',
    Db.cari('Topics', 'topic_id', TPC).title === 'Pecahan & desimal');
Topik.ubahBaris(SESI_GURU, 'topik', TPC, { judul: 'Pecahan & desimal', status: 'publish' });
cek('draf→publish = publish eksplisit (notif bertambah)', notifPB().length === 2);
Topik.ubahItem(SESI_GURU, ITM_QUIZ, { judul: 'Quiz pecahan', status: 'draft' });
cek('ubah item judul tersimpan',
    Db.cari('Items', 'item_id', ITM_QUIZ).title === 'Quiz pecahan');

console.log('\n== JADWAL & STATUS (§7.8b-2/3) ==');

r = cobalah(function () {
  return Topik.aturJadwalBaris(SESI_GURU, 'mandiri', ITM_TRY, 'besok pagi');
});
cek('format jadwal asing ditolak', r.error === 'VALIDASI_GAGAL');

r = Topik.aturJadwalBaris(SESI_GURU, 'mandiri', ITM_TRY, '2026-09-12T07:00');
cek('jadwal → scheduled + publish_at tersimpan',
    r.status === 'scheduled' &&
    Db.cari('Items', 'item_id', ITM_TRY).publish_at === '2026-09-12 07:00');
const jmlNotif0 = notifPB().length;
Topik.aturJadwalItem(SESI_GURU, ITM_QUIZ, '2026-09-20T09:30');
cek('jadwal item → scheduled, TANPA notifikasi',
    Db.cari('Items', 'item_id', ITM_QUIZ).status === 'scheduled' &&
    notifPB().length === jmlNotif0);

Topik.ubahStatusBaris(SESI_GURU, 'mandiri', ITM_TRY, 'draft');
it = Db.cari('Items', 'item_id', ITM_TRY);
cek('🙈 pada terjadwal → draf + JADWAL DIBATALKAN',
    it.status === 'draft' && !it.publish_at);

Topik.ubahStatusBaris(SESI_GURU, 'mandiri', ITM_TRY, 'publish');
it = Db.cari('Items', 'item_id', ITM_TRY);
cek('👁 publish eksplisit → notifikasi', notifPB().length === jmlNotif0 + 1);

r = Topik.aturJadwalBaris(SESI_GURU, 'mandiri', ITM_TRY, '');
cek('kosongkan jadwal → kembali publish', r.status === 'publish');

r = cobalah(function () { return Topik.ubahStatusBaris(SESI_GURU, 'mandiri', ITM_TRY, 'scheduled'); });
cek('👁/🙈 menolak status selain publish/draft', r.error === 'VALIDASI_GAGAL');

console.log('\n== PINDAH + RENUMBER (gabungan & dalam topik) ==');

r = Topik.pindahBaris(SESI_GURU, 'topik', TPC, 'atas');
cek('paling atas ▲ → pindah:false', r.pindah === false);

r = Topik.pindahBaris(SESI_GURU, 'topik', TPC, 'bawah');
r = Topik.susunan(SESI_GURU, TA1);
cek('▼ topik → quiz mandiri naik ke urutan 1',
    r.baris[0].jenis === 'quiz_mandiri' && r.baris[1].tipe === 'topik');
cek('renumber 1..3 lintas jenis',
    r.baris.map(b => b.urutan).join('') === '123' &&
    Number(Db.baca('Items').filter(x => x.item_id === ITM_REF)[0].sort_order) === 3);

r = Topik.pindahItem(SESI_GURU, TPC, ITM_QUIZ, 'bawah');
cek('item paling dasar ▼ → pindah:false', r.pindah === false);
r = Topik.pindahItem(SESI_GURU, TPC, ITM_QUIZ, 'atas');
cek('▲ item quiz → pindah:true (tukar tetangga)', r.pindah === true);
r = Topik.susunan(SESI_GURU, TA1);
cek('urutan dalam topik berubah → materi, quiz, tugas_individu',
    r.baris[1].item.map(x => x.jenis).join(',') === 'materi,quiz,tugas_individu',
    JSON.stringify(r.baris[1].item.map(x => x.jenis)));
cek('sort_order item dalam topik 1..3',
    r.baris[1].item.map(x => true).length === 3 &&
    Db.saring('Items', { topic_id: TPC }).every(x => Number(x.sort_order) >= 1 && Number(x.sort_order) <= 3));

r = cobalah(function () { return Topik.pindahBaris(SESI_GURU, 'topik', TPC, 'samping'); });
cek('arah asing ditolak', r.error === 'VALIDASI_GAGAL');

console.log('\n== HAPUS (kaskade) ==');

const jmlItems0 = jml('Items');
r = Topik.hapusItem(SESI_GURU, ITM_QUIZ);
cek('hapus item → Items berkurang 1', jml('Items') === jmlItems0 - 1);

r = Topik.hapusBaris(SESI_GURU, 'topik', TPC);
cek('hapus topik → seluruh item di dalamnya ikut terhapus',
    jml('Items') === jmlItems0 - 3 && !Db.cari('Topics', 'topic_id', TPC));

r = Topik.hapusBaris(SESI_GURU, 'mandiri', ITM_REF);
cek('hapus mandiri → Items berkurang', !Db.cari('Items', 'item_id', ITM_REF));

console.log('\n== KEPEMILIKAN & ENDPOINT ==');

const saltG2 = Util.buatSalt();
Db.tambah('Users', { user_id: 'USR-GURU2', username: 'guru2',
  password_hash: Util.hashPassword('guru123', saltG2), salt: saltG2, pwd_awal: '',
  nama: 'Guru Kedua', role: 'guru', rombel: '', email: '', nisn: '', no_wa: '',
  tanggal_lahir: '', status: 'aktif', harus_ganti_password: false,
  last_login: '', created_at: new Date(), updated_at: new Date() });
const SESI_GURU2 = { user_id: 'USR-GURU2', role: 'guru' };

r = cobalah(function () { return Topik.susunan(SESI_GURU2, TA1); });
cek('course milik guru lain → TIDAK_DITEMUKAN', r.error === 'TIDAK_DITEMUKAN');

Topik.buatBaris(SESI_GURU, TA1, { jenis_baris: 'topik', judul: 'Statistika' });

const TOKEN_G = Auth.login('guru', 'guru123').data.token;
const TOKEN_M = Auth.login('rina.andini', 'Rina12345').data.token;

r = courseSusunan(TOKEN_G, TA1);
cek('endpoint courseSusunan OK (2 baris: Tryout + Statistika)',
    r.ok === true && r.data.baris.length === 2 &&
    r.data.baris.some(b => b.judul === 'Statistika') &&
    r.data.baris.some(b => b.jenis === 'quiz_mandiri'),
    JSON.stringify(r.ok ? r.data.baris.map(b => b.judul) : r));

r = cobalah(function () { return courseBuatBaris(TOKEN_M, TA1, { jenis_baris: 'topik', judul: 'X' }); });
cek('endpoint murid ditolak (hanya guru)', r.error === 'AKSES_DITOLAK');

r = courseBuatBaris(TOKEN_G, TA1, { jenis_baris: 'quiz_mandiri', judul: 'Kuis UAS' });
cek('endpoint courseBuatBaris OK', r.ok === true && !!r.data.id);
const ID_BARU = r.ok ? r.data.id : '';
r = courseJadwalBaris(TOKEN_G, 'mandiri', ID_BARU, '2026-09-30T08:00');
cek('endpoint courseJadwalBaris → scheduled',
    r.ok === true && r.data.status === 'scheduled');
r = coursePindahBaris(TOKEN_G, 'mandiri', ID_BARU, 'atas');
cek('endpoint coursePindahBaris OK (naik satu)', r.ok === true);
r = Topik.susunan(SESI_GURU, TA1);
cek('urutan gabungan hasil endpoint benar (Tryout, Kuis UAS, Statistika)',
    r.baris.map(b => b.judul).join('|') === 'Tryout operasi hitung|Kuis UAS|Statistika',
    JSON.stringify(r.baris.map(b => b.judul)));

console.log('\n========================================');
console.log(no + ' cek, ' + gagal + ' gagal');
process.exit(gagal ? 1 : 0);
