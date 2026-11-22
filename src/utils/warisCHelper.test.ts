import test from 'node:test';
import assert from 'node:assert/strict';
import { BerkasRecord } from '../types/ppats';
import { DEFAULT_OFFICE_SETTINGS } from './seedData';
import { computeAgeFromBirthDate, resolveWarisCConfig } from './warisCHelper';
import { renderDocxPreviewPages } from './docxPreviewParser';
import { getDefaultNpoptkp, isAktaService } from './taxAndAudit';
import { getNonAktaBundleFileName } from './bundleGenerator';

function createSampleWarisCRecord(): BerkasRecord {
  return {
    id: 'test-waris-c-1',
    no_urut: 99,
    kode_berkas: 'REG-2026-099',
    tanggal_masuk: '2026-07-25',
    layanan: 'Waris C',
    status: '1. Pemberkasan',
    para_pihak: [
      {
        id: 'aw-1',
        peran: 'Pihak I',
        nik: '3309117112490001',
        nama: 'MINAH',
        tempat_lahir: 'Boyolali',
        tanggal_lahir: '31-12-1949',
        jenis_kelamin: 'Perempuan',
        alamat_jalan: 'Klelesan',
        rt_rw: '004/008',
        desa_kelurahan: 'Giriroto',
        kecamatan: 'Ngemplak',
        kabupaten: 'Boyolali',
        pekerjaan: 'Petani/Pekebun',
        status_perkawinan: 'Kawin',
      },
      {
        id: 'aw-2',
        peran: 'Pihak I',
        nik: '3309112512600002',
        nama: 'R.J.SUBANDIYO / BEJO',
        tempat_lahir: 'Boyolali',
        tanggal_lahir: '25-12-1960',
        jenis_kelamin: 'Laki-laki',
        alamat_jalan: 'Kebayoran',
        rt_rw: '001/002',
        desa_kelurahan: 'Jaksel',
        kecamatan: 'Kebayoran',
        kabupaten: 'Jakarta Selatan',
        pekerjaan: 'Karyawan Swasta',
        status_perkawinan: 'Kawin',
      },
      {
        id: 'aw-3',
        peran: 'Pihak I',
        nik: '3309114212600003',
        nama: 'MINEM',
        tempat_lahir: 'Boyolali',
        tanggal_lahir: '02-12-1960',
        jenis_kelamin: 'Perempuan',
        alamat_jalan: 'Klelesan',
        rt_rw: '004/008',
        desa_kelurahan: 'Giriroto',
        kecamatan: 'Ngemplak',
        kabupaten: 'Boyolali',
        pekerjaan: 'Mengurus Rumah Tangga',
        status_perkawinan: 'Kawin',
      },
      {
        id: 'aw-4',
        peran: 'Pihak I',
        nik: '3309117112659149',
        nama: 'WIJIATI',
        tempat_lahir: 'Boyolali',
        tanggal_lahir: '13-12-1965',
        jenis_kelamin: 'Perempuan',
        alamat_jalan: 'Klelesan',
        rt_rw: '004/008',
        desa_kelurahan: 'Giriroto',
        kecamatan: 'Ngemplak',
        kabupaten: 'Boyolali',
        pekerjaan: 'Karyawan Swasta',
        status_perkawinan: 'Kawin',
      },
    ],
    tanah: {
      jenis_sertipikat: 'analog',
      jenis_hak: 'Hak Milik Adat',
      nib: '',
      nomor_hak_lama: 'C-723 Persil 73-109 Kelas IIa',
      luas_m2: 5650,
      desa: 'Giriroto',
      kecamatan: 'Ngemplak',
      kabupaten: 'Boyolali',
      provinsi: 'Jawa Tengah',
      batas_utara: 'Basis',
      batas_timur: 'Yudi Wiyono',
      batas_selatan: 'Saluran',
      batas_barat: 'Sulasno, Bakoh, Slamet Riyadi',
      penggunaan_tanah: 'Pertanian',
      status_tanah: 'Non-Pertanian',
      menguasai_sejak_tahun: '2014',
      dasar_perolehan: 'Warisan',
      pemegang_hak_sertipikat: ['SANURI'],
    },
    pbb: {
      nop: '33.09.110.008.004-0723.0',
      tahun_pajak: '2026',
      njop_bumi_m2: 120000,
      njop_bangunan: 0,
    },
    audit_warnings: [],
    akta: {
      nomor_akta: '',
      tanggal_akta: '2026-07-25',
      nama_ppats: 'MUCHSONI, S.Sos',
      jabatan_ppats: 'Camat Ngemplak',
      nip_ppats: '19761002 200502 1 007',
      harga_per_m2: 0,
      nilai_transaksi_override: null,
      npoptkp: 300_000_000,
      nama_kuasa_bpn: 'SUWARDJO',
      kuasa_bpn_detail: {
        nama: 'SUWARDJO',
        tempat_lahir: 'Boyolali',
        tanggal_lahir: '10-11-1957',
        pekerjaan: 'Pensiunan',
        nik: '3309111011570003',
        alamat_jalan: 'Dukuhrejo',
        rt: '01',
        rw: '02',
        desa_kelurahan: 'Donohudan',
        kecamatan: 'Ngemplak',
        kabupaten: 'Boyolali',
      },
      saksi_1: 'SALIMIN',
      saksi_2: 'SAINO',
      catatan_loket: '',
    },
    pajak: {
      nilai_kesepakatan: 0,
      njop_bumi_total: 678_000_000,
      njop_total: 678_000_000,
      npop: 678_000_000,
      npoptkp: 300_000_000,
      npopkp: 378_000_000,
      bphtb: 18_900_000,
      pph: 16_950_000,
    },
    non_akta: {
      sebutan_pewaris: 'Almarhum',
      nama_pewaris: 'SANURI',
      tanggal_meninggal: '31-12-1966',
      tempat_meninggal: 'Desa Giriroto, Kecamatan Ngemplak, Kabupaten Boyolali',
      hubungan_pasangan_pewaris: 'Istrinya',
      nama_pasangan_pewaris: 'Daliyem',
      tanggal_meninggal_pasangan: '14-01-2014',
      jumlah_anak_waris: 4,
      camat_pengesahan_jabatan: 'Camat Ngemplak',
      camat_pengesahan_nama: 'MUCHSONI, S.Sos',
      camat_pengesahan_nip: '19761002 200502 1 007',
      kades_pengesahan_jabatan: 'PJ. Kepala Desa Giriroto',
      kades_pengesahan_nama: 'LILIK RUSMIYANTO',
      kades_pengesahan_nip: '198312022017061002',
      waris_c_hak_adat: 'C-723 Persil 73-109 Kelas IIa',
      waris_c_atas_nama_c: 'SANURI',
      waris_c_tahun_tercatat_c: '1959',
      waris_c_jenis_tanah: 'Sawah / Pekarangan',
      waris_c_penerima_bagian: 'WIJIATI',
      waris_c_luas_bagian_m2: 1412,
      waris_c_sertakan_kuasa_pemecahan: true,
      link_maps: 'https://maps.app.goo.gl/a7zF2NPHVFjCbCWYA',
    },
    updated_at: '2026-07-25T00:00:00Z',
  };
}

test('Waris C classification, NPOPTKP default, and bundle filename are configured properly', () => {
  assert.equal(isAktaService('Waris C'), false);
  assert.equal(getDefaultNpoptkp('Waris C'), 300_000_000);
  assert.equal(getNonAktaBundleFileName('Waris C'), '02_Lampiran_Bundel_Waris_C.docx');
});

test('computeAgeFromBirthDate and resolveWarisCConfig calculate heir ages and Letter C defaults cleanly', () => {
  const ref = new Date(2026, 6, 25); // 25 Jul 2026
  assert.equal(computeAgeFromBirthDate('31-12-1949', ref), 76);
  assert.equal(computeAgeFromBirthDate('13-12-1965', ref), 60);

  const rec = createSampleWarisCRecord();
  const cfg = resolveWarisCConfig(rec, DEFAULT_OFFICE_SETTINGS, ref);

  assert.equal(cfg.namaPewaris, 'SANURI');
  assert.equal(cfg.jumlahAnak, 4);
  assert.equal(cfg.jumlahAnakTerbilang, 'Empat');
  assert.equal(cfg.ahliWaris.length, 4);
  assert.equal(cfg.ahliWaris[0].nama, 'MINAH');
  assert.equal(cfg.ahliWaris[3].nama, 'WIJIATI');
  assert.equal(cfg.hakAdat, 'C-723 Persil 73-109 Kelas IIa');
  assert.equal(cfg.kadesNip, '198312022017061002');
  assert.equal(cfg.bidangPecahan.length, 4);
});

test('renderDocxPreviewPages generates 16-page Waris C bundle with all required legal forms and 15-page without kuasa pemecahan', async () => {
  const rec = createSampleWarisCRecord();
  const preview16 = await renderDocxPreviewPages(
    rec,
    DEFAULT_OFFICE_SETTINGS,
    {},
    '02_lampiran_bundel'
  );

  assert.equal(preview16.pages.length, 16);
  const titles = preview16.pages.map((p) => p.title);
  assert.ok(titles[0].includes('Surat Pernyataan Ahli Warisan'));
  assert.ok(titles[1].includes('Permohonan ATR/BPN'));
  assert.ok(titles[2].includes('Surat Kuasa (Pengakuan Hak)'));
  assert.ok(titles[3].includes('Surat Kuasa (Pemecahan Bidang)'));
  assert.ok(titles[4].includes('Surat Pernyataan BPHTB'));
  assert.ok(titles[5].includes('Penguasaan Fisik & Tidak Sengketa'));
  assert.ok(titles[6].includes('Penguasaan Fisik Bidang Tanah'));
  assert.ok(titles[7].includes('Pemasangan Tanda Batas & Sketsa'));
  assert.ok(titles[8].includes('Gambar Sket Tanah'));
  assert.ok(titles[9].includes('Berita Acara Kesaksian (Fisik)'));
  assert.ok(titles[10].includes('Berita Acara Kesaksian (Riwayat)'));
  assert.ok(titles[11].includes('Surat Keterangan Desa (PP 24/1997)'));
  assert.ok(titles[12].includes('Surat Keterangan Riwayat Tanah'));
  assert.ok(titles[13].includes('Surat Pernyataan Pembagian Warisan'));
  assert.ok(titles[14].includes('Geotagging Tampak Depan & Patok 1-2'));
  assert.ok(titles[15].includes('Patok 3-4 & Poligon'));

  // Toggle off kuasa pemecahan -> 15 pages
  rec.non_akta = { ...rec.non_akta, waris_c_sertakan_kuasa_pemecahan: false };
  const preview15 = await renderDocxPreviewPages(
    rec,
    DEFAULT_OFFICE_SETTINGS,
    {},
    '02_lampiran_bundel'
  );
  assert.equal(preview15.pages.length, 15);
});
