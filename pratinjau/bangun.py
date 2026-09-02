#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
bangun.py — rakit pratinjau statis UI LMS v2 (data contoh, tanpa server).

Membaca berkas klien di ../v2 lalu:
  1. menyalin index.html apa adanya (scriptlet <?= ... ?> diganti nilai
     contoh — di GAS scriptlet hanya dievaluasi di index),
  2. mengganti <?!= include('nama') ?> dengan isi berkas tersebut
     (meniru HtmlService.include),
  3. menyuntikkan mock google.script.run (data contoh) SEBELUM js klien.

Hasil: index.html di folder ini. Jalankan ulang setiap kali v2 berubah:
    python3 pratinjau/bangun.py
Pratinjau disajikan statis, mis.:
    python3 -m http.server 8080 --directory pratinjau
"""
import io, os, re

V2 = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'v2')

def baca(nama):
    return io.open(os.path.join(V2, nama), encoding='utf-8').read()

idx = baca('index.html')

def isi_include(m):
    return baca(m.group(1) + '.html').strip()

idx = re.sub(r"<\?!= include\('([\w]+)'\) \?>", isi_include, idx)
idx = (idx
       .replace("<?= appNama ?>", "LessonLen")
       .replace("<?= appVersi ?>", "2.0.0")
       .replace("<?= appIkon ?>", "\U0001F331"))

MOCK = r"""
/* ===== PRATINJAU: mock google.script.run (data contoh, bukan server) ===== */
(function () {
  var db = {
    guru: { user_id: 'u-guru', username: 'guru', nama: 'Ustadz Ahmad Fauzi', role: 'guru' },
    murid: { user_id: 'u-m1', username: 'siswa01', nama: 'Rara Aisyah Putri', role: 'murid',
             harus_ganti_password: false,
             biodata: { nisn: '', email: '', no_wa: '', tanggal_lahir: '' } },
    sesi: null,
    notif: [
      { notif_id: 'n1', jenis: 'permintaan_reset', judul: 'Citra Maharani meminta reset sandi', pesan: 'Ajukan lewat Kelola Murid', dibaca: false, created_at: '2026-09-01 07:12' },
      { notif_id: 'n2', jenis: 'enroll_kelas', judul: 'Bayu Setiawan masuk kelas XI TKJ 1', pesan: 'oleh guru', dibaca: false, created_at: '2026-08-30 09:40' },
      { notif_id: 'n3', jenis: 'info', judul: 'Jadwal simpan panen bergeser', pesan: 'Mulai pekan ini', dibaca: true, created_at: '2026-08-28 13:05' }
    ],
    muridDaftar: [
      { user_id: 'u-m1', nama: 'Rara Aisyah Putri', username: 'siswa01', nisn: '0091234561', no_wa: '081234567001', rombel: 'XI TKJ 1', status: 'aktif', last_login: '2026-09-01 06:55' },
      { user_id: 'u-m2', nama: 'Bayu Setiawan', username: 'siswa02', nisn: '0091234562', no_wa: '081234567002', rombel: 'XI TKJ 1', status: 'aktif', last_login: '2026-08-31 20:11' },
      { user_id: 'u-m3', nama: 'Citra Maharani', username: 'siswa03', nisn: '', no_wa: '081234567003', rombel: 'XI TKJ 1', status: 'aktif', last_login: '' },
      { user_id: 'u-m4', nama: 'Dimas Prakoso', username: 'siswa04', nisn: '0091234564', no_wa: '', rombel: 'XI TKJ 2', status: 'aktif', last_login: '2026-08-29 07:30' },
      { user_id: 'u-m5', nama: 'Eka Nurjanah', username: 'siswa05', nisn: '', no_wa: '081234567005', rombel: 'XI TKJ 2', status: 'nonaktif', last_login: '2026-08-10 08:00' },
      { user_id: 'u-m6', nama: 'Fajar Ramadhan', username: 'siswa06', nisn: '0091234566', no_wa: '081234567006', rombel: 'XI RPL 1', status: 'aktif', last_login: '' }
    ],
    kelas: [
      { class_id: 'k1', name: 'XI TKJ 1', academic_year: '2026/2027', jml_murid: 3, jml_course: 2 },
      { class_id: 'k2', name: 'XI TKJ 2', academic_year: '2026/2027', jml_murid: 2, jml_course: 1 },
      { class_id: 'k3', name: 'XI RPL 1', academic_year: '2026/2027', jml_murid: 1, jml_course: 1 }
    ],
    course: [
      { teaching_assignment_id: 't1', class_id: 'k1', class_name: 'XI TKJ 1', subject_id: 's1', subject_name: 'Matematika', label: 'XI TKJ 1 - Matematika', academic_year: '2026/2027', status: 'aktif', jml_murid: 3 },
      { teaching_assignment_id: 't2', class_id: 'k1', class_name: 'XI TKJ 1', subject_id: 's2', subject_name: 'Bahasa Indonesia', label: 'XI TKJ 1 - Bahasa Indonesia', academic_year: '2026/2027', status: 'aktif', jml_murid: 3 },
      { teaching_assignment_id: 't3', class_id: 'k2', class_name: 'XI TKJ 2', subject_id: 's1', subject_name: 'Matematika', label: 'XI TKJ 2 - Matematika', academic_year: '2026/2027', status: 'aktif', jml_murid: 2 },
      { teaching_assignment_id: 't4', class_id: 'k3', class_name: 'XI RPL 1', subject_id: 's3', subject_name: 'Simpan Digital', label: 'XI RPL 1 - Simpan Digital', academic_year: '2025/2026', status: 'nonaktif', jml_murid: 1 }
    ]
  };

  function ringkas() {
    if (db.sesi.role === 'guru') {
      return { role: 'guru', kelas_aktif: 3, course_aktif: 3, murid_aktif: 5,
        api_key: { jml: 6, maks: 10, jml_siap: 5, terpasang: true },
        perlu_tindakan: { jml: 2, daftar: [
          { request_id: 'r1', user_id: 'u-m3', nama: 'Citra Maharani', username: 'siswa03', dibuat_at: '2026-09-01 07:10' },
          { request_id: 'r2', user_id: 'u-m6', nama: 'Fajar Ramadhan', username: 'siswa06', dibuat_at: '2026-08-31 15:47' }
        ] } };
    }
    return { role: 'murid', kelas_diikuti: 1, notif_baru: 2,
             biodata_kurang: !db.muridBiodataIsi };
  }

  var mock = {
    login: function (u, p) {
      if (u === 'guru' && p === 'guru123') {
        db.sesi = db.guru;
        return { token: 't-token', user: db.guru, harus_ganti_password: false,
                 biodata_kurang: false, biodata: {} };
      }
      if (u === 'siswa01' && p === 'siswa123') {
        db.sesi = db.murid;
        return { token: 't-token', user: db.murid, harus_ganti_password: false,
                 biodata_kurang: !db.muridBiodataIsi, biodata: db.murid.biodata };
      }
      return { ok: false, error: 'KREDENSIAL_SALAH',
               pesan: 'Nama pengguna atau kata sandi salah.' };
    },
    cekSesi: function () { return db.sesi; },
    ringkasDashboard: function () { return ringkas(); },
    daftarNotifikasi: function () { return db.notif; },
    logout: function () { db.sesi = null; return {}; },
    gantiPassword: function () { return { berhasil: true }; },
    ajukanReset: function () { return { diterima: true }; },
    simpanBiodata: function (t, b) {
      db.muridBiodataIsi = true;
      db.murid.biodata = {
        nisn: (b.nisn || '').trim(), email: (b.email || '').trim().toLowerCase(),
        no_wa: b.no_wa || '', tanggal_lahir: b.tanggal_lahir || ''
      };
      return { berhasil: true, biodata_kurang: false };
    },
    getBiodata: function () {
      if (!db.sesi || db.sesi.role !== 'murid')
        return { ok: false, error: 'AKSES_DITOLAK', pesan: 'Hanya murid.' };
      return Object.assign({}, db.murid.biodata);
    },
    /* §5.5: akun contoh utk pratinjau lupa akses mandiri */
    lupaPassword: function (t, username, wa, tgl) {
      if (String(username).trim() === 'siswa02' &&
          String(wa).replace(/[^0-9]/g, '').replace(/^08/, '62') === '621234567002' &&
          tgl === '2008-08-08')
        return { diterima: true, username: 'siswa02', password_sementara: 'Hr4Tampil' };
      return { diterima: false,
               pesan: 'Data tidak cocok. Silakan hubungi guru Anda untuk mereset akses.' };
    },
    lupaUsername: function (t, email, wa, tgl) {
      if (String(email).trim().toLowerCase() === 'citra@contoh.id' &&
          String(wa).replace(/[^0-9]/g, '').replace(/^08/, '62') === '621234567003' &&
          tgl === '2009-05-10')
        return { diterima: true, username: 'siswa03', password_sementara: 'Smb4Ketik' };
      return { diterima: false,
               pesan: 'Data tidak cocok. Silakan hubungi guru Anda untuk mereset akses.' };
    },
    muridDaftar: function (t, f) {
      var daftar = db.muridDaftar;
      if (f && f.status) daftar = daftar.filter(function (m) { return m.status === f.status; });
      if (f && f.cari) {
        var q = f.cari.toLowerCase();
        daftar = daftar.filter(function (m) {
          return (m.nama + ' ' + m.username + ' ' + (m.nisn || '')).toLowerCase().indexOf(q) >= 0;
        });
      }
      return daftar;
    },
    muridDetail: function (t, id) {
      var m = db.muridDaftar.filter(function (x) { return x.user_id === id; })[0] || {};
      return Object.assign({}, m, {
        email: m.no_wa ? 'rahasia@contoh.id' : '',
        tanggal_lahir: '2009-04-17',
        kelas: [{ name: m.rombel || 'XI TKJ 1' }],
        pwd_awal: m.username === 'siswa01' ? '' : 'Xk' + id.slice(-2) + 'aQ',
        sudah_ganti: m.username === 'siswa01'
      });
    },
    muridSimpan: function (t, p) {
      if (!p.user_id) {
        var id = 'u-m' + Math.floor(Math.random() * 90 + 10);
        var sandi = Math.random().toString(36).slice(2, 8);
        db.muridDaftar.unshift({ user_id: id, nama: p.nama, username: p.username,
          nisn: p.nisn || '', no_wa: p.no_wa || '', rombel: p.rombel || '',
          status: 'aktif', last_login: '' });
        return { baru: true, user_id: id, nama: p.nama, username: p.username,
                 password_sementara: sandi, no_wa: p.no_wa || '' };
      }
      var m = db.muridDaftar.filter(function (x) { return x.user_id === p.user_id; })[0];
      if (m) { if (p.nama) m.nama = p.nama; if (p.no_wa !== undefined) m.no_wa = p.no_wa;
               if (p.nisn !== undefined) m.nisn = p.nisn;
               if (p.rombel !== undefined) m.rombel = p.rombel;
               if (p.status) m.status = p.status; }
      return {};
    },
    resetPasswordMurid: function (t, id) {
      var m = db.muridDaftar.filter(function (x) { return x.user_id === id; })[0] || {};
      return { user_id: id, username: m.username, nama: m.nama, no_wa: m.no_wa || '',
               password_sementara: Math.random().toString(36).slice(2, 8) };
    },
    muridPratinjauImpor: function (t, teks) {
      var baris = String(teks || '').split('\n').filter(function (x) { return x.trim(); });
      var siap = [], masalah = [], diubah = 0;
      baris.forEach(function (b, i) {
        var bagian = b.split(/[,;\t]/).map(function (x) { return x.trim(); });
        if (bagian.length < 3) { masalah.push({ baris: i + 1, alasan: 'format tak terbaca' }); return; }
        var uname = bagian[2], catatan = '';
        if (db.muridDaftar.some(function (m) { return m.username === uname; })) {
          uname += '2'; catatan = 'username dipakai → diganti'; diubah++;
        }
        siap.push({ nama: bagian[0], rombel: bagian[1], username: uname,
                    sandi_sendiri: bagian.length > 3 && !!bagian[3], diubah: !!catatan, catatan: catatan });
      });
      return { total: baris.length, siap: siap, masalah: masalah, jml_diubah: diubah };
    },
    muridImpor: function (t, teks) {
      var p = mock.muridPratinjauImpor(t, teks);
      p.siap.forEach(function (x) {
        var sandi = x.sandi_sendiri ? 'sandi-nyata' : Math.random().toString(36).slice(2, 8);
        db.muridDaftar.unshift({ user_id: 'u-m' + Math.floor(Math.random() * 90 + 10),
          nama: x.nama, username: x.username, nisn: '', no_wa: '', rombel: x.rombel,
          status: 'aktif', last_login: '' });
        x.password = sandi;
      });
      return { jml_baru: p.siap.length, jml_gagal: p.masalah.length, hasil: p.siap, gagal: [] };
    },
    kelasDaftar: function () { return db.kelas; },
    /* kartu Kelas Saya (murid): kelas yang diikuti + mapel aktif */
    kelasSaya: function () {
      if (!db.sesi || db.sesi.role !== 'murid')
        return { ok: false, error: 'AKSES_DITOLAK', pesan: 'Hanya murid.' };
      return db.kelas
        .filter(function (k) {
          return db.muridDaftar.some(function (m) {
            return m.user_id === 'u-m1' && m.rombel === k.name;
          });
        })
        .map(function (k) {
          var mp = db.course.filter(function (c) {
            return c.class_id === k.class_id && c.status === 'aktif';
          }).map(function (c) { return c.subject_name; });
          return { class_id: k.class_id, name: k.name,
                   academic_year: k.academic_year, jml_course: mp.length,
                   course: mp };
        });
    },
    kelasDetail: function (t, id) {
      var k = db.kelas.filter(function (x) { return x.class_id === id; })[0] || {};
      return Object.assign({}, k, { murid: db.muridDaftar.filter(function (m) {
        return m.rombel === k.name && m.status === 'aktif';
      }).map(function (m, i) {
        return { enroll_id: 'e-' + m.user_id, user_id: m.user_id, nama: m.nama,
                 username: m.username, status_akun: 'aktif',
                 pwd_awal: 'Xk' + (i + 3) + 'aQ', sudah_ganti: i % 2 === 0,
                 tanggal_daftar: '2026-08-01' };
      }) });
    },
    kelasSimpan: function (t, p) {
      if (p.class_id) {
        var k = db.kelas.filter(function (x) { return x.class_id === p.class_id; })[0];
        if (k) { k.name = p.name; k.academic_year = p.academic_year; }
      } else {
        db.kelas.push({ class_id: 'k' + Date.now(), name: p.name,
                        academic_year: p.academic_year || '', jml_murid: 0, jml_course: 0 });
      }
      return {};
    },
    /* kontrak nyata: (token, classId) → yang BELUM terdaftar di kelas itu */
    kelasMuridTersedia: function (t, classId) {
      var k = db.kelas.filter(function (x) { return x.class_id === classId; })[0];
      return db.muridDaftar
        .filter(function (m) { return m.status === 'aktif' &&
                                     (!k || m.rombel !== k.name); })
        .map(function (m) { return { user_id: m.user_id, nama: m.nama,
             username: m.username, rombel: m.rombel || '',
             kelas: m.rombel ? [{ class_id: k ? k.class_id : '', name: m.rombel }] : [] }; });
    },
    kelasEnroll: function (t, classId, pilihan) {
      var k = db.kelas.filter(function (x) { return x.class_id === classId; })[0];
      var ditambah = 0;
      (pilihan || []).forEach(function (x) {
        var id = typeof x === 'object' ? x.user_id : x;
        var m = db.muridDaftar.filter(function (y) { return y.user_id === id; })[0];
        if (m && k && m.rombel !== k.name) { m.rombel = k.name; ditambah++; }
      });
      return { ditambah: ditambah, diaktifkan: 0, dilewati: 0 };
    },
    kelasKeluarkan: function () { return {}; },
    courseDaftar: function () { return db.course; },
    courseDetail: function (t, id) {
      var c = db.course.filter(function (x) { return x.teaching_assignment_id === id; })[0] || {};
      return { class_id: c.class_id, class_name: c.class_name,
               subject_name: c.subject_name, academic_year: c.academic_year,
               status: c.status, jml_murid: c.jml_murid };
    },
    /* backend Course.simpan menerima { class_id, name } — mirror */
    courseSimpan: function (t, p) {
      var nama = p.name || '';
      if (p.teaching_assignment_id) {
        var c = db.course.filter(function (x) {
          return x.teaching_assignment_id === p.teaching_assignment_id; })[0];
        if (c) { c.class_id = p.class_id; c.subject_name = nama;
          var k = db.kelas.filter(function (x) { return x.class_id === p.class_id; })[0];
          c.class_name = k ? k.name : ''; c.label = c.class_name + ' - ' + nama; }
      } else {
        var k2 = db.kelas.filter(function (x) { return x.class_id === p.class_id; })[0];
        db.course.unshift({ teaching_assignment_id: 't' + Date.now(),
          class_id: p.class_id, class_name: k2 ? k2.name : '(kelas)',
          subject_id: 's' + Date.now(), subject_name: nama,
          label: (k2 ? k2.name : '(kelas)') + ' - ' + nama,
          academic_year: '2026/2027', status: 'aktif', jml_murid: 0 });
      }
      return {};
    },
    courseHapus: function (t, id) {
      db.course = db.course.filter(function (x) { return x.teaching_assignment_id !== id; });
      return {};
    },
    apiKeyStatus: function () {
      var key = [], status = ['siap', 'siap', 'istirahat', 'siap', 'siap', 'bermasalah'];
      for (var i = 0; i < 6; i++) key.push({ index: i, ekor: (1000 + i * 137) % 10000 + '', status: status[i] });
      return { jml: 6, maks: 10, terpasang: true, cursor: '42/50', jml_siap: 3,
               jml_bermasalah: 1,
               model: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash',
                       'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'],
               model_aktif: 'gemini-2.5-flash', key: key };
    },
    apiKeySimpan: function () { return {}; },
    apiKeyResetCooldown: function () { return { direset: true }; }
  };

  /* google.script.run = objek runner (bukan fungsi), seperti GAS asli */
  window.google = { script: {} };
  Object.defineProperty(window.google.script, 'run', {
    get: function () {
      var okH, failH;
      var proxy = new Proxy({ withSuccessHandler: function (f) { okH = f; return proxy; },
                              withFailureHandler: function (f) { failH = f; return proxy; } }, {
        get: function (target, nama) {
          if (nama in target) return target[nama];
          return function () {
            var args = arguments;
            setTimeout(function () {
              try {
                var hasil = mock[nama] ? mock[nama].apply(null, args)
                  : { ok: false, error: 'FUNGSI_TAK_ADA', pesan: 'Mock belum ada: ' + nama };
                if (hasil && hasil.ok === false) {
                  if (failH) failH(new Error(hasil.pesan || hasil.error));
                } else if (okH) okH({ ok: true, data: hasil });
              } catch (e) {
                if (failH) failH(e);
              }
            }, 120);
          };
        }
      });
      return proxy;
    }
  });
})();
"""

halaman = f"""<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LessonLen — Pratinjau UI Tahap 3 (data contoh)</title>
<style>
.pratinjau-pita {{ position:fixed; left:0; right:0; bottom:0; z-index:999;
  background:#233524; color:#DDE7DC; font-size:.75rem; text-align:center;
  padding:4px 10px; }}
.pratinjau-pita b {{ color:#D9F2D4; }}
</style>
</head>
<body>
<noscript><div style="position:fixed;top:0;left:0;right:0;z-index:9999;background:#c0392b;color:#fff;font:14px system-ui;padding:10px 14px">Pratinjau ini membutuhkan JavaScript. Buka lewat <b>Live Preview</b> (tab pratinjau server), bukan penampil berkas.</div></noscript>
<div id="app"></div>

<script>
/* penangkap error: bila pratinjau gagal di browser nyata, pesan tampil di layar */
window.onerror = function (pesan, sumber, baris) {{
  var el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#c0392b;color:#fff;font:13px/1.45 system-ui;padding:8px 14px;white-space:pre-wrap';
  el.textContent = 'ERROR PRATINJAU: ' + pesan + '  (baris ' + baris + ')';
  document.body.appendChild(el);
}};
</script>

<script>{MOCK}</script>
{idx}

<div class="pratinjau-pita">PRATINJAU STATIS — data contoh, bukan server.
Masuk guru: <b>guru / guru123</b> · murid: <b>siswa01 / siswa123</b> ·
lupa sandi: <b>siswa02 / 081234567002 / 2008-08-08</b></div>
</body>
</html>
"""

keluar = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'index.html')
io.open(keluar, 'w', encoding='utf-8').write(halaman)
print('pratinjau/index.html dibuat:', len(halaman), 'karakter')
