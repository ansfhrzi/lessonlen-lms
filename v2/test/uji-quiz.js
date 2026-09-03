/* ============================================================
 *  LMS v2 — uji-quiz.js
 *  Uji Tahap 4 poin 2b — editor Quiz (Quiz.gs + endpoint):
 *  lazy baris Quizzes, pengaturan, 4 tipe soal dgn validasi
 *  kunci ketat, pindah/hapus + renumber, kepemilikan guru.
 *  Jalankan:  node v2/test/uji-quiz.js
 * ============================================================ */
require('./mock.js');
const fs = require('fs');
const path = require('path');
['Util', 'Auth', 'Kelas', 'Course', 'Topik', 'Quiz', 'Code'].forEach(function (n) {
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

const SESI = { user_id: 'USR-GURU', role: 'guru' };

/* ---- seed ---- */
const salt = Util.buatSalt();
Db.tambah('Users', { user_id: 'USR-GURU', username: 'guru',
  password_hash: Util.hashPassword('guru123', salt), salt, pwd_awal: '',
  nama: 'Guru', role: 'guru', rombel: '', email: '', nisn: '', no_wa: '',
  tanggal_lahir: '', status: 'aktif', harus_ganti_password: false,
  last_login: '', created_at: new Date(), updated_at: new Date() });
Db.tambah('Users', { user_id: 'USR-G2', username: 'guru2',
  password_hash: Util.hashPassword('guru123', salt), salt, pwd_awal: '',
  nama: 'Guru Dua', role: 'guru', rombel: '', email: '', nisn: '', no_wa: '',
  tanggal_lahir: '', status: 'aktif', harus_ganti_password: false,
  last_login: '', created_at: new Date(), updated_at: new Date() });
Db.tambah('Classes', { class_id: 'CLS-1', name: 'XI TKJ 1',
  academic_year: '2026/2027', status: 'aktif',
  created_at: new Date(), updated_at: new Date() });
const TA = Course.simpan(SESI, { class_id: 'CLS-1', name: 'Matematika' })
  .teaching_assignment_id;
const TPC = Topik.buatBaris(SESI, TA, { jenis_baris: 'topik', judul: 'Pecahan' }).id;
const ITM_Q = Topik.buatItem(SESI, TPC, { type: 'quiz', judul: 'Quiz pecahan' }).id;
const ITM_M = Topik.buatItem(SESI, TPC, { type: 'materi', judul: 'Materi' }).id;

console.log('\n== MUAT (lazy) ==');

let r = Quiz.muat(SESI, ITM_Q);
cek('baris Quizzes dibuat lazy dgn default',
    r.quiz.max_attempts === 1 && r.quiz.kkm === 75 && r.quiz.acak_soal === true &&
    r.quiz.acak_opsi === true && r.quiz.show_score === true &&
    r.quiz.tampilkan_pembahasan === false);
cek('item terbawa (judul, ta_id, topic_id)',
    r.item.judul === 'Quiz pecahan' && r.item.ta_id === TA &&
    r.item.topic_id === TPC);
cek('soal kosong → rekap 0', r.rekap.jml_soal === 0 &&
    r.rekap.total_bobot === 0 && !r.rekap.ada_esai);

r = cobalah(function () { return Quiz.muat(SESI, ITM_M); });
cek('muat item BUKAN quiz ditolak', r.error === 'VALIDASI_GAGAL');

r = cobalah(function () {
  return Quiz.muat({ user_id: 'USR-G2', role: 'guru' }, ITM_Q);
});
cek('course milik guru lain → TIDAK_DITEMUKAN', r.error === 'TIDAK_DITEMUKAN');

console.log('\n== PENGATURAN ==');

r = Quiz.simpanPengaturan(SESI, ITM_Q, { deadline: '2026-09-30',
  max_attempts: 3, kkm: 80, show_score: true, acak_soal: false,
  acak_opsi: false, tampilkan_pembahasan: true });
cek('pengaturan tersimpan', !r.error);
let q = Db.saring('Quizzes', { item_id: ITM_Q })[0];
cek('nilai tersimpan: tenggat/kkm/kesempatan/acak/pembahasan',
    q.deadline === '2026-09-30' && Number(q.kkm) === 80 &&
    Number(q.max_attempts) === 3 && (q.acak_soal === false || q.acak_soal === 'FALSE') &&
    (q.tampilkan_pembahasan === true || q.tampilkan_pembahasan === 'TRUE'));

r = cobalah(function () { return Quiz.simpanPengaturan(SESI, ITM_Q,
  { deadline: '', max_attempts: 3, kkm: 150 }); });
cek('KKM > 100 ditolak', r.error === 'VALIDASI_GAGAL');
r = cobalah(function () { return Quiz.simpanPengaturan(SESI, ITM_Q,
  { deadline: '', max_attempts: -2, kkm: 75 }); });
cek('kesempatan negatif ditolak', r.error === 'VALIDASI_GAGAL');
r = cobalah(function () { return Quiz.simpanPengaturan(SESI, ITM_Q,
  { deadline: 'besok', max_attempts: 1, kkm: 75 }); });
cek('tenggat format asing ditolak', r.error === 'VALIDASI_GAGAL');

console.log('\n== TAMBAH SOAL (4 tipe, kunci ketat) ==');

r = cobalah(function () { return Quiz.simpanSoal(SESI, ITM_Q,
  { type: 'pg', question: 'Soal tanpa opsi cukup', answer_key: 'A' }); });
cek('pg dgn < 2 opsi ditolak', r.error === 'VALIDASI_GAGAL');

r = Quiz.simpanSoal(SESI, ITM_Q, { type: 'pg',
  question: '6/9 sederhana?', points: 10, tingkat: 'C2',
  options: ['2/3', '3/2', '1/3', '6/3'], answer_key: 'A' });
cek('pg valid tersimpan (QQA-)', /^QQA-/.test(r.question_id));
const SOAL1 = r.question_id;
let s = Db.cari('Quiz_Questions', 'question_id', SOAL1);
cek('options_json = JSON daftar opsi',
    JSON.parse(s.options_json)[0] === '2/3', s.options_json);
cek('order_no = 1, kunci A, tingkat C2',
    Number(s.order_no) === 1 && s.answer_key === 'A' && s.tingkat === 'C2');

r = cobalah(function () { return Quiz.simpanSoal(SESI, ITM_Q,
  { type: 'pg', question: 'x', options: ['a','b','c','d'],
    answer_key: 'E' }); });
cek('kunci E tanpa opsi E ditolak', r.error === 'VALIDASI_GAGAL');

r = cobalah(function () { return Quiz.simpanSoal(SESI, ITM_Q,
  { type: 'benar_salah', question: 'x', answer_key: 'Mungkin' }); });
cek('benar_salah dgn kunci asing ditolak', r.error === 'VALIDASI_GAGAL');

r = Quiz.simpanSoal(SESI, ITM_Q, { type: 'benar_salah',
  question: '0,5 = 1/2?', points: 5, answer_key: 'Benar' });
const SOAL2 = r.question_id;
cek('benar_salah valid (order 2)',
    Number(Db.cari('Quiz_Questions', 'question_id', SOAL2).order_no) === 2);

r = cobalah(function () { return Quiz.simpanSoal(SESI, ITM_Q,
  { type: 'isian', question: 'x', answer_key: '' }); });
cek('isian tanpa kunci ditolak', r.error === 'VALIDASI_GAGAL');

r = Quiz.simpanSoal(SESI, ITM_Q, { type: 'isian',
  question: 'FPB 6 dan 9?', answer_key: '3' });
const SOAL3 = r.question_id;
cek('isian dgn kunci tersimpan', !!SOAL3);

r = Quiz.simpanSoal(SESI, ITM_Q, { type: 'esai',
  question: 'Jelaskan!', points: 20,
  rubric: 'Sebut FPB + contoh.' });
const SOAL4 = r.question_id;
s = Db.cari('Quiz_Questions', 'question_id', SOAL4);
cek('esai: tanpa kunci, rubrik tersimpan',
    s.answer_key === '' && s.rubric === 'Sebut FPB + contoh.');

r = cobalah(function () { return Quiz.simpanSoal(SESI, ITM_Q,
  { type: 'pg', question: 'x', options: ['a','b'], answer_key: 'A',
    gambar_url: 'ftp://salah' }); });
cek('gambar non-http ditolak', r.error === 'VALIDASI_GAGAL');

r = cobalah(function () { return Quiz.simpanSoal(SESI, ITM_Q,
  { type: 'pg', question: 'x', options: ['a','b'], answer_key: 'A',
    points: 500 }); });
cek('bobot > 100 ditolak', r.error === 'VALIDASI_GAGAL');

console.log('\n== REKAP, UBAH, PINDAH, HAPUS ==');

r = Quiz.muat(SESI, ITM_Q);
cek('rekap: 4 soal, total 36 (isian default bobot 1), ada esai',
    r.rekap.jml_soal === 4 && r.rekap.total_bobot === 36 && r.rekap.ada_esai,
    JSON.stringify(r.rekap));

Quiz.simpanSoal(SESI, ITM_Q, { question_id: SOAL3, type: 'isian',
  question: 'FPB 6 dan 9 adalah…', answer_key: '3', points: 5 });
s = Db.cari('Quiz_Questions', 'question_id', SOAL3);
cek('ubah soal: pertanyaan & bobot berubah, order tetap',
    s.question === 'FPB 6 dan 9 adalah…' && Number(s.points) === 5 &&
    Number(s.order_no) === 3);

r = Quiz.pindahSoal(SESI, ITM_Q, SOAL1, 'atas');
cek('paling atas ▲ → pindah:false', r.pindah === false);
r = Quiz.pindahSoal(SESI, ITM_Q, SOAL1, 'bawah');
r = Quiz.muat(SESI, ITM_Q);
cek('▼ soal 1 → tukar dgn soal 2',
    r.soal[0].question_id === SOAL2 && r.soal[1].question_id === SOAL1);
cek('renumber 1..N rapi',
    r.soal.map(x => x.order_no).join('') === '1234');

r = Quiz.hapusSoal(SESI, ITM_Q, SOAL2);
r = Quiz.muat(SESI, ITM_Q);
cek('hapus soal → 3 soal, renumber',
    r.rekap.jml_soal === 3 &&
    r.soal.map(x => x.order_no).join('') === '123');

r = cobalah(function () { return Quiz.hapusSoal(SESI, ITM_Q, 'QQA-XX'); });
cek('hapus soal asing → TIDAK_DITEMUKAN', r.error === 'TIDAK_DITEMUKAN');

console.log('\n== ENDPOINT ==');

const TOKEN_G = Auth.login('guru', 'guru123').data.token;
const TOKEN_G2 = Auth.login('guru2', 'guru123').data.token;
r = quizMuat(TOKEN_G, ITM_Q);
cek('endpoint quizMuat OK (guru)', r.ok === true && r.data.soal.length === 3);
r = quizMuat(TOKEN_G2, ITM_Q);
cek('endpoint guru lain → TIDAK_DITEMUKAN',
    r.ok === false && r.error === 'TIDAK_DITEMUKAN');
r = quizSimpanSoal(TOKEN_G, ITM_Q, { type: 'esai', question: '' });
cek('endpoint validasi berlaku', r.ok === false && r.error === 'VALIDASI_GAGAL');
r = quizPindahSoal(TOKEN_G, ITM_Q, r.ok ? '' : r.question_id || SOAL1, 'bawah');
cek('endpoint quizPindahSoal merespons', r.ok === true || r.error);

console.log('\n========================================');
console.log(no + ' cek, ' + gagal + ' gagal');
process.exit(gagal ? 1 : 0);
