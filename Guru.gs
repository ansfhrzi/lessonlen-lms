/**
 * LessonLen v2 — Guru.gs
 * CRUD kelas/murid/bab/item + akses + rekap.
 * Guru 1 orang: boleh refetch setelah simpan.
 */

var Guru = (function () {

  function beranda(sesi) {
    var kelas = Db.saring('kelas', { status: 'aktif' });
    var enroll = Db.saring('enrollment', { status: 'aktif' });
    var bab = Db.baca('bab');
    var item = Db.baca('item');
    var antre = Db.saring('lkpd_submission', { status: 'menunggu' }).length;

    var kartu = kelas.map(function (k) {
      var nMurid = enroll.filter(function (e) { return e.kelas_id === k.kelas_id; }).length;
      var nBab = bab.filter(function (b) { return b.kelas_id === k.kelas_id; }).length;
      var nItem = item.filter(function (i) { return i.kelas_id === k.kelas_id; }).length;
      return {
        kelas_id: k.kelas_id, nama_kelas: k.nama_kelas, mapel: k.mapel,
        jenjang: k.jenjang, n_murid: nMurid, n_bab: nBab, n_item: nItem
      };
    });
    return { user: { nama: sesi.nama, role: 'guru' }, kelas: kartu, antrean_lkpd: antre };
  }

  function simpanKelas(sesi, p) {
    p = p || {};
    if (Util.kosong(p.nama_kelas)) throw Util.err('VALIDASI_GAGAL', 'Nama kelas wajib.');
    var now = Util.sekarang();
    if (p.kelas_id) {
      var k = Db.cari('kelas', 'kelas_id', p.kelas_id);
      if (!k) throw Util.err('TIDAK_DITEMUKAN', 'Kelas tidak ditemukan.');
      Db.perbarui('kelas', k._baris, {
        nama_kelas: String(p.nama_kelas).slice(0, 80),
        mapel: String(p.mapel || '').slice(0, 120),
        jenjang: p.jenjang || k.jenjang,
        fase: p.fase || k.fase,
        tingkat: p.tingkat || k.tingkat
      });
      return { kelas_id: k.kelas_id };
    }
    var id = Util.buatId('KLS');
    Db.tambah('kelas', {
      kelas_id: id, nama_kelas: String(p.nama_kelas).slice(0, 80),
      mapel: String(p.mapel || '').slice(0, 120),
      jenjang: p.jenjang || 'SMK', fase: p.fase || 'F', tingkat: p.tingkat || 'XI',
      status: 'aktif', created_at: now
    });
    return { kelas_id: id };
  }

  function hapusKelas(sesi, kelasId) {
    var k = Db.cari('kelas', 'kelas_id', kelasId);
    if (!k) throw Util.err('TIDAK_DITEMUKAN', 'Kelas tidak ditemukan.');
    function buang(sheet, kol) {
      var bar = Db.saring(sheet, {});
      var id = [];
      bar.forEach(function (r) { if (r[kol] === kelasId) id.push(r._baris); });
      Db.hapusBanyak(sheet, id);
    }
    var items = Db.saring('item', { kelas_id: kelasId });
    var itemIds = {};
    items.forEach(function (i) { itemIds[i.item_id] = true; });
    var soalHapus = [];
    Db.baca('soal').forEach(function (s) {
      if (itemIds[s.item_id]) soalHapus.push(s._baris);
    });
    Db.hapusBanyak('soal', soalHapus);
    buang('progress', 'kelas_id');
    buang('lkpd_submission', 'kelas_id');
    buang('item', 'kelas_id');
    buang('bab', 'kelas_id');
    buang('enrollment', 'kelas_id');
    Db.hapus('kelas', k._baris);
    return { hapus: true };
  }

  function isiKelas(sesi, kelasId) {
    var k = Db.cari('kelas', 'kelas_id', kelasId);
    if (!k) throw Util.err('TIDAK_DITEMUKAN', 'Kelas tidak ditemukan.');
    var bab = Db.saring('bab', { kelas_id: kelasId })
      .sort(function (a, b) { return Number(a.urutan) - Number(b.urutan); });
    var items = Db.saring('item', { kelas_id: kelasId })
      .sort(function (a, b) { return Number(a.urutan) - Number(b.urutan); });
    var soal = Db.baca('soal');
    var soalPer = {};
    soal.forEach(function (s) {
      (soalPer[s.item_id] = soalPer[s.item_id] || []).push({
        soal_id: s.soal_id, nomor: Number(s.nomor), tipe: s.tipe,
        pertanyaan: s.pertanyaan, opsi: s.opsi, kunci: s.kunci, bobot: Number(s.bobot) || 1
      });
    });
    Object.keys(soalPer).forEach(function (id) {
      soalPer[id].sort(function (a, b) { return a.nomor - b.nomor; });
    });

    var daftarBab = bab.map(function (b) {
      return {
        bab_id: b.bab_id, urutan: Number(b.urutan), judul: b.judul,
        deskripsi: b.deskripsi || '', status: b.status,
        akses: b.akses, terbuka: Util.ya(b.terbuka),
        buka_at: b.buka_at || '', tutup_at: b.tutup_at || '',
        item: items.filter(function (i) { return i.bab_id === b.bab_id; }).map(function (i) {
          return {
            item_id: i.item_id, bab_id: b.bab_id, grup: i.grup || '', urutan: Number(i.urutan),
            tipe: i.tipe, judul: i.judul, konten: i.konten || '',
            status: i.status, akses: i.akses || 'ikut_bab',
            terbuka: Util.ya(i.terbuka), buka_at: i.buka_at || '', tutup_at: i.tutup_at || '',
            kkm: i.kkm, max_percobaan: i.max_percobaan,
            soal: soalPer[i.item_id] || []
          };
        })
      };
    });

    var murid = Db.saring('enrollment', { kelas_id: kelasId, status: 'aktif' }).map(function (e) {
      var u = Db.cari('users', 'user_id', e.user_id);
      return u ? { user_id: u.user_id, username: u.username, nama: u.nama, status: u.status } : null;
    }).filter(function (x) { return !!x; })
      .sort(function (a, b) { return String(a.nama).localeCompare(String(b.nama), 'id'); });

    return {
      kelas: { kelas_id: k.kelas_id, nama_kelas: k.nama_kelas, mapel: k.mapel,
               jenjang: k.jenjang, fase: k.fase, tingkat: k.tingkat },
      bab: daftarBab,
      murid: murid
    };
  }

  function simpanBab(sesi, p) {
    p = p || {};
    if (Util.kosong(p.judul)) throw Util.err('VALIDASI_GAGAL', 'Judul bab wajib.');
    if (Util.kosong(p.kelas_id)) throw Util.err('VALIDASI_GAGAL', 'Kelas wajib.');
    var now = Util.sekarang();
    if (p.bab_id) {
      var b = Db.cari('bab', 'bab_id', p.bab_id);
      if (!b) throw Util.err('TIDAK_DITEMUKAN', 'Bab tidak ditemukan.');
      Db.perbarui('bab', b._baris, {
        judul: String(p.judul).slice(0, 120),
        deskripsi: String(p.deskripsi || '').slice(0, 500),
        urutan: Number(p.urutan) || b.urutan,
        status: p.status === 'publish' ? 'publish' : 'draft',
        akses: p.akses === 'jadwal' ? 'jadwal' : 'manual',
        terbuka: p.terbuka === true || p.terbuka === 'true',
        buka_at: p.buka_at || '', tutup_at: p.tutup_at || '',
        updated_at: now
      });
      return { bab_id: b.bab_id };
    }
    var n = Db.saring('bab', { kelas_id: p.kelas_id }).length;
    var id = Util.buatId('BAB');
    Db.tambah('bab', {
      bab_id: id, kelas_id: p.kelas_id, urutan: Number(p.urutan) || (n + 1),
      judul: String(p.judul).slice(0, 120),
      deskripsi: String(p.deskripsi || '').slice(0, 500),
      status: p.status === 'publish' ? 'publish' : 'draft',
      akses: p.akses === 'jadwal' ? 'jadwal' : 'manual',
      terbuka: p.terbuka === true || p.terbuka === 'true',
      buka_at: p.buka_at || '', tutup_at: p.tutup_at || '',
      created_at: now, updated_at: now
    });
    return { bab_id: id };
  }

  function hapusBab(sesi, babId) {
    var b = Db.cari('bab', 'bab_id', babId);
    if (!b) throw Util.err('TIDAK_DITEMUKAN', 'Bab tidak ditemukan.');
    var items = Db.saring('item', { bab_id: babId });
    var itemIds = {};
    items.forEach(function (i) { itemIds[i.item_id] = true; });
    var soalH = [], progH = [], lkpH = [], attH = [];
    Db.baca('soal').forEach(function (s) { if (itemIds[s.item_id]) soalH.push(s._baris); });
    Db.saring('progress', { bab_id: babId }).forEach(function (r) { progH.push(r._baris); });
    Db.baca('lkpd_submission').forEach(function (r) { if (itemIds[r.item_id]) lkpH.push(r._baris); });
    Db.baca('quiz_attempt').forEach(function (r) { if (itemIds[r.item_id]) attH.push(r._baris); });
    Db.hapusBanyak('soal', soalH);
    Db.hapusBanyak('progress', progH);
    Db.hapusBanyak('lkpd_submission', lkpH);
    Db.hapusBanyak('quiz_attempt', attH);
    Db.hapusBanyak('item', items.map(function (i) { return i._baris; }));
    Db.hapus('bab', b._baris);
    return { hapus: true };
  }

  function simpanItem(sesi, p) {
    p = p || {};
    if (Util.kosong(p.judul)) throw Util.err('VALIDASI_GAGAL', 'Judul wajib.');
    if (Util.kosong(p.bab_id)) throw Util.err('VALIDASI_GAGAL', 'Bab wajib.');
    var bab = Db.cari('bab', 'bab_id', p.bab_id);
    if (!bab) throw Util.err('TIDAK_DITEMUKAN', 'Bab tidak ditemukan.');
    var tipe = p.tipe || 'materi';
    if (['materi','lkpd','quiz'].indexOf(tipe) < 0) {
      throw Util.err('VALIDASI_GAGAL', 'Tipe tidak dikenal.');
    }
    var now = Util.sekarang();
    var akses = p.akses === 'manual' || p.akses === 'jadwal' ? p.akses : 'ikut_bab';
    var kol = {
      judul: String(p.judul).slice(0, 160),
      grup: String(p.grup || '').slice(0, 80),
      urutan: Number(p.urutan) || 1,
      konten: Util.sanitasi(p.konten || ''),
      status: p.status === 'publish' ? 'publish' : 'draft',
      akses: akses,
      terbuka: p.terbuka === true || p.terbuka === 'true',
      buka_at: p.buka_at || '', tutup_at: p.tutup_at || '',
      kkm: tipe === 'quiz' ? (Number(p.kkm) || 70) : '',
      max_percobaan: tipe === 'quiz' ? (Number(p.max_percobaan) || 3) : '',
      updated_at: now
    };

    var id = p.item_id;
    if (id) {
      var it = Db.cari('item', 'item_id', id);
      if (!it) throw Util.err('TIDAK_DITEMUKAN', 'Item tidak ditemukan.');
      Db.perbarui('item', it._baris, kol);
    } else {
      id = Util.buatId('ITM');
      kol.item_id = id;
      kol.bab_id = bab.bab_id;
      kol.kelas_id = bab.kelas_id;
      kol.tipe = tipe;
      kol.created_at = now;
      Db.tambah('item', kol);
    }

    if (tipe === 'quiz' && Array.isArray(p.soal)) {
      _simpanSoal(id, p.soal);
    }
    return { item_id: id };
  }

  function _simpanSoal(itemId, daftar) {
    var lama = Db.saring('soal', { item_id: itemId });
    Db.hapusBanyak('soal', lama.map(function (s) { return s._baris; }));
    var baris = [];
    daftar.forEach(function (s, i) {
      if (Util.kosong(s.pertanyaan)) return;
      var opsi = s.opsi;
      if (typeof opsi !== 'string') opsi = JSON.stringify(opsi || []);
      baris.push({
        soal_id: Util.buatId('SOL'), item_id: itemId,
        nomor: Number(s.nomor) || (i + 1), tipe: s.tipe || 'pg',
        pertanyaan: String(s.pertanyaan).slice(0, 1000),
        opsi: opsi, kunci: String(s.kunci || 'A').slice(0, 8),
        bobot: Number(s.bobot) || 1
      });
    });
    if (baris.length) Db.tambah('soal', baris);
  }

  function hapusItem(sesi, itemId) {
    var it = Db.cari('item', 'item_id', itemId);
    if (!it) throw Util.err('TIDAK_DITEMUKAN', 'Item tidak ditemukan.');
    var soalH = Db.saring('soal', { item_id: itemId }).map(function (s) { return s._baris; });
    var prH = Db.saring('progress', { item_id: itemId }).map(function (s) { return s._baris; });
    var lkH = Db.saring('lkpd_submission', { item_id: itemId }).map(function (s) { return s._baris; });
    var atH = Db.saring('quiz_attempt', { item_id: itemId }).map(function (s) { return s._baris; });
    Db.hapusBanyak('soal', soalH);
    Db.hapusBanyak('progress', prH);
    Db.hapusBanyak('lkpd_submission', lkH);
    Db.hapusBanyak('quiz_attempt', atH);
    Db.hapus('item', it._baris);
    return { hapus: true };
  }

  /** Saklar buka/tutup/jadwal — satu fungsi untuk bab atau item. */
  function aturAkses(sesi, p) {
    p = p || {};
    var now = Util.sekarang();
    if (p.jenis === 'bab') {
      var b = Db.cari('bab', 'bab_id', p.id);
      if (!b) throw Util.err('TIDAK_DITEMUKAN', 'Bab tidak ditemukan.');
      var ubah = { updated_at: now };
      if (p.status) ubah.status = p.status === 'publish' ? 'publish' : 'draft';
      if (p.akses) ubah.akses = p.akses === 'jadwal' ? 'jadwal' : 'manual';
      if (p.terbuka !== undefined) ubah.terbuka = !!p.terbuka;
      if (p.buka_at !== undefined) ubah.buka_at = p.buka_at || '';
      if (p.tutup_at !== undefined) ubah.tutup_at = p.tutup_at || '';
      Db.perbarui('bab', b._baris, ubah);
      return { ok: true };
    }
    var it = Db.cari('item', 'item_id', p.id);
    if (!it) throw Util.err('TIDAK_DITEMUKAN', 'Item tidak ditemukan.');
    var u2 = { updated_at: now };
    if (p.status) u2.status = p.status === 'publish' ? 'publish' : 'draft';
    if (p.akses) u2.akses = (p.akses === 'manual' || p.akses === 'jadwal') ? p.akses : 'ikut_bab';
    if (p.terbuka !== undefined) u2.terbuka = !!p.terbuka;
    if (p.buka_at !== undefined) u2.buka_at = p.buka_at || '';
    if (p.tutup_at !== undefined) u2.tutup_at = p.tutup_at || '';
    Db.perbarui('item', it._baris, u2);
    return { ok: true };
  }

  function simpanMurid(sesi, p) {
    p = p || {};
    if (Util.kosong(p.nama)) throw Util.err('VALIDASI_GAGAL', 'Nama wajib.');
    var now = Util.sekarang();
    if (p.user_id) {
      var u = Db.cari('users', 'user_id', p.user_id);
      if (!u) throw Util.err('TIDAK_DITEMUKAN', 'Murid tidak ditemukan.');
      Db.perbarui('users', u._baris, {
        nama: String(p.nama).slice(0, 80),
        status: p.status === 'nonaktif' ? 'nonaktif' : 'aktif'
      });
      if (p.status === 'nonaktif') Auth._hapusSesiUser(u.user_id);
      return { user_id: u.user_id };
    }
    var base = Util.normalisasiUsername(p.username || p.nama.split(/\s+/)[0] || 'siswa');
    base = base.replace(/[^a-z0-9]/g, '') || 'siswa';
    var uname = base, n = 2;
    while (Db.cari('users', 'username', uname)) { uname = base + n; n++; }
    var pwd = Util.passwordSementara();
    var salt = Util.buatSalt();
    var id = Util.buatId('USR');
    Db.tambah('users', {
      user_id: id, username: uname,
      password_hash: Util.hashPassword(pwd, salt), salt: salt, pwd_awal: pwd,
      nama: String(p.nama).slice(0, 80), role: 'murid', email: '',
      status: 'aktif', harus_ganti_password: true, last_login: '', created_at: now
    });
    if (p.kelas_id) {
      Db.tambah('enrollment', {
        enroll_id: Util.buatId('ENR'), kelas_id: p.kelas_id,
        user_id: id, status: 'aktif', tanggal_daftar: now
      });
    }
    return { user_id: id, username: uname, password_sementara: pwd };
  }

  function imporMurid(sesi, kelasId, teks) {
    var baris = String(teks || '').split(/\r?\n/).map(function (s) { return s.trim(); })
      .filter(function (s) { return s && s.indexOf('#') !== 0; });
    var hasil = [];
    baris.forEach(function (nama) {
      hasil.push(simpanMurid(sesi, { nama: nama, kelas_id: kelasId }));
    });
    return { jumlah: hasil.length, akun: hasil };
  }

  function keluarkanMurid(sesi, kelasId, userId) {
    var e = Db.saring('enrollment', { kelas_id: kelasId, user_id: userId, status: 'aktif' })[0];
    if (!e) throw Util.err('TIDAK_DITEMUKAN', 'Murid tidak ada di kelas ini.');
    Db.perbarui('enrollment', e._baris, { status: 'keluar' });
    return { ok: true };
  }

  function rekap(sesi, kelasId) {
    var k = Db.cari('kelas', 'kelas_id', kelasId);
    if (!k) throw Util.err('TIDAK_DITEMUKAN', 'Kelas tidak ditemukan.');
    var murid = Db.saring('enrollment', { kelas_id: kelasId, status: 'aktif' }).map(function (e) {
      return Db.cari('users', 'user_id', e.user_id);
    }).filter(function (u) { return u; })
      .sort(function (a, b) { return String(a.nama).localeCompare(String(b.nama), 'id'); });

    var bab = Db.saring('bab', { kelas_id: kelasId, status: 'publish' })
      .sort(function (a, b) { return Number(a.urutan) - Number(b.urutan); });
    var items = Db.saring('item', { kelas_id: kelasId, status: 'publish' })
      .sort(function (a, b) { return Number(a.urutan) - Number(b.urutan); });

    var prog = Db.saring('progress', { kelas_id: kelasId });
    var lkpd = Db.saring('lkpd_submission', { kelas_id: kelasId });
    var att = Db.baca('quiz_attempt');

    function sel(userId, item) {
      if (item.tipe === 'materi') {
        var p = null;
        prog.forEach(function (r) {
          if (r.user_id === userId && r.item_id === item.item_id) p = r;
        });
        return p && Util.ya(p.ditandai) ? { jenis: 'tanda', teks: '✓' } : { jenis: 'kosong', teks: '—' };
      }
      if (item.tipe === 'lkpd') {
        var s = null;
        lkpd.forEach(function (r) {
          if (r.user_id === userId && r.item_id === item.item_id) s = r;
        });
        if (!s) return { jenis: 'kosong', teks: '—' };
        if (s.status === 'diterima') return { jenis: 'ok', teks: String(s.nilai === '' ? '✓' : s.nilai) };
        if (s.status === 'menunggu') return { jenis: 'tunggu', teks: '⏳' };
        if (s.status === 'ditolak') return { jenis: 'tolak', teks: '↩' };
        return { jenis: 'kosong', teks: '—' };
      }
      var terbaik = null;
      att.forEach(function (r) {
        if (r.user_id === userId && r.item_id === item.item_id && r.status === 'selesai') {
          if (!terbaik || Number(r.nilai) > Number(terbaik.nilai)) terbaik = r;
        }
      });
      if (!terbaik) return { jenis: 'kosong', teks: '—' };
      var kkm = Number(item.kkm) || 0;
      var n = Number(terbaik.nilai);
      return { jenis: (kkm && n < kkm) ? 'kurang' : 'ok', teks: String(n) };
    }

    var kolom = [];
    bab.forEach(function (b) {
      items.forEach(function (i) {
        if (i.bab_id !== b.bab_id) return;
        kolom.push({
          item_id: i.item_id, bab: b.judul, grup: i.grup || '',
          judul: i.judul, tipe: i.tipe
        });
      });
    });

    var baris = murid.map(function (u) {
      var selArr = kolom.map(function (c) {
        var it = null;
        items.forEach(function (i) { if (i.item_id === c.item_id) it = i; });
        return sel(u.user_id, it);
      });
      return { user_id: u.user_id, nama: u.nama, username: u.username, sel: selArr };
    });

    return {
      kelas: { kelas_id: k.kelas_id, nama_kelas: k.nama_kelas, mapel: k.mapel },
      kolom: kolom, baris: baris
    };
  }

  function antreanLkpd(sesi) {
    var sub = Db.saring('lkpd_submission', { status: 'menunggu' });
    var users = Db.baca('users');
    var items = Db.baca('item');
    var pU = {}, pI = {};
    users.forEach(function (u) { pU[u.user_id] = u; });
    items.forEach(function (i) { pI[i.item_id] = i; });
    return sub.map(function (s) {
      var u = pU[s.user_id] || {};
      var i = pI[s.item_id] || {};
      var links = [];
      try { links = JSON.parse(s.links || '[]'); } catch (e) {}
      return {
        submission_id: s.submission_id, nama: u.nama || '', username: u.username || '',
        judul: i.judul || '', item_id: s.item_id,
        links: links, catatan_murid: s.catatan_murid || '',
        waktu_kumpul: s.waktu_kumpul
      };
    }).sort(function (a, b) { return String(a.waktu_kumpul) < String(b.waktu_kumpul) ? -1 : 1; });
  }

  function nilaiLkpd(sesi, submissionId, keputusan, nilai, catatan) {
    var s = Db.cari('lkpd_submission', 'submission_id', submissionId);
    if (!s) throw Util.err('TIDAK_DITEMUKAN', 'Pengumpulan tidak ditemukan.');
    if (keputusan !== 'diterima' && keputusan !== 'ditolak') {
      throw Util.err('VALIDASI_GAGAL', 'Keputusan tidak sah.');
    }
    if (keputusan === 'ditolak' && Util.kosong(catatan)) {
      throw Util.err('VALIDASI_GAGAL', 'Catatan wajib saat menolak.');
    }
    var n = nilai === '' || nilai === null || nilai === undefined ? '' : Number(nilai);
    if (n !== '' && (isNaN(n) || n < 0 || n > 100)) {
      throw Util.err('VALIDASI_GAGAL', 'Nilai 0–100.');
    }
    Db.perbarui('lkpd_submission', s._baris, {
      status: keputusan, nilai: n, catatan_guru: String(catatan || '').slice(0, 500),
      waktu_dinilai: Util.sekarang()
    });
    return { status: keputusan };
  }

  return {
    beranda: beranda,
    simpanKelas: simpanKelas, hapusKelas: hapusKelas,
    isiKelas: isiKelas,
    simpanBab: simpanBab, hapusBab: hapusBab,
    simpanItem: simpanItem, hapusItem: hapusItem,
    aturAkses: aturAkses,
    simpanMurid: simpanMurid, imporMurid: imporMurid, keluarkanMurid: keluarkanMurid,
    rekap: rekap, antreanLkpd: antreanLkpd, nilaiLkpd: nilaiLkpd
  };
})();
