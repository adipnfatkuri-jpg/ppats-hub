/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { auth, googleProvider } from './firebase';
import {
  BerkasRecord,
  BerkasStatus,
  CustomTemplateEntry,
  OfficeSettings,
  ServiceType,
  TaxDraftPrefill,
  TemplateDocKey,
} from './types/ppats';
import { DEFAULT_OFFICE_SETTINGS } from './utils/seedData';
import { duplicateBerkasRecord } from './utils/recordDuplicate';
import { isTerminalStatus } from './utils/dashboardHelpers';
import {
  deleteCustomTemplate,
  deleteRecord,
  exportDatabaseBackup,
  importDatabaseBackup,
  loadCustomTemplates,
  loadRecords,
  loadSettings,
  saveCustomTemplate,
  saveRecord,
  saveSettings,
} from './utils/storage';
import {
  DEFAULT_OFFICE_ID,
  deleteCloudRecord,
  deleteCloudTemplate,
  inviteOfficeStaff,
  reloadCloudSnapshotFromServer,
  resolveOfficeSession,
  revokeOfficeStaffAccess,
  saveCloudRecord,
  saveCloudSettings,
  saveCloudTemplate,
  subscribeOfficeTeam,
  subscribeSharedOfficeData,
  syncLocalBrowserDataToCloud,
  type CloudSessionInfo,
  type OfficeInviteInfo,
  type OfficeMemberInfo,
  type OfficeRole,
} from './utils/cloudSync';
import { MobileBottomNav, NavSection, Sidebar, TopHeader } from './components/Sidebar';
import { DashboardModule } from './components/DashboardModule';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAInstallBanner } from './components/PWAInstallButton';
import { useTheme } from './hooks/useTheme';

const WizardModule = lazy(() =>
  import('./components/WizardModule').then((m) => ({ default: m.WizardModule }))
);
const TaxCalculatorModule = lazy(() =>
  import('./components/TaxCalculatorModule').then((m) => ({ default: m.TaxCalculatorModule }))
);
const RegisterModule = lazy(() =>
  import('./components/RegisterModule').then((m) => ({ default: m.RegisterModule }))
);
const ReportModule = lazy(() =>
  import('./components/ReportModule').then((m) => ({ default: m.ReportModule }))
);
const NonAktaRekapModule = lazy(() =>
  import('./components/NonAktaRekapModule').then((m) => ({ default: m.NonAktaRekapModule }))
);
const SettingsModule = lazy(() =>
  import('./components/SettingsModule').then((m) => ({ default: m.SettingsModule }))
);
const ReceiptModal = lazy(() =>
  import('./components/ReceiptModal').then((m) => ({ default: m.ReceiptModal }))
);

const ModuleLoadingFallback: React.FC = () => (
  <div className="space-y-4" aria-busy="true" aria-label="Memuat modul">
    <div className="h-7 w-56 bg-slate-200/80 dark:bg-slate-800 rounded-lg animate-pulse" />
    <div className="bento-card p-6 space-y-3">
      <div className="h-5 w-72 bg-slate-200/70 dark:bg-slate-800 rounded-md animate-pulse" />
      <div className="h-28 w-full bg-slate-100 dark:bg-slate-800/60 rounded-lg animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="h-16 bg-slate-100 dark:bg-slate-800/60 rounded-lg animate-pulse" />
        <div className="h-16 bg-slate-100 dark:bg-slate-800/60 rounded-lg animate-pulse" />
      </div>
    </div>
  </div>
);

const SIGNED_OUT_SESSION: CloudSessionInfo = {
  status: 'signed_out',
  officeId: DEFAULT_OFFICE_ID,
  officeName: 'Kantor PPATS Bersama',
  role: null,
  allowedEmails: [],
  isBootstrappedAdmin: false,
};

function formatCloudErrorMessage(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : String(err || '');
  let message = raw;
  try {
    const parsed = JSON.parse(raw) as { error?: string };
    if (parsed && typeof parsed.error === 'string') {
      message = parsed.error;
    }
  } catch {
    // plain error string
  }
  if (/Missing or insufficient permissions/i.test(message)) {
    return 'Izin akses ditolak oleh aturan keamanan cloud. Pastikan peran akun Anda (Admin/Petugas) berwenang untuk aksi ini.';
  }
  if (/Quota exceeded/i.test(message)) {
    return 'Kuota harian database cloud Firestore sementara habis dan akan reset keesokan hari.';
  }
  if (/exceeds maximum size|longer than 1048487|maximum allowed size/i.test(message)) {
    return 'Ukuran foto lampiran berkas terlalu besar untuk batas dokumen cloud (1 MB). Data tetap tersimpan di perangkat lokal; perkecil ukuran foto lalu simpan ulang.';
  }
  if (/client is offline|unavailable|network error/i.test(message)) {
    return 'Koneksi ke server cloud sedang terputus. Data tetap tersimpan di penyimpanan lokal perangkat dan akan tersinkron saat koneksi kembali normal.';
  }
  return message || fallback;
}

export default function App() {
  const { theme, setTheme } = useTheme();
  const [activeSection, setActiveSection] = useState<NavSection>(() => {
    if (typeof window === 'undefined') return 'dashboard';
    const requested = new URLSearchParams(window.location.search).get('section');
    const validSections: NavSection[] = [
      'dashboard',
      'wizard',
      'tax',
      'register',
      'report',
      'non_akta_rekap',
      'settings',
    ];
    return requested && validSections.includes(requested as NavSection)
      ? (requested as NavSection)
      : 'dashboard';
  });
  const [records, setRecords] = useState<BerkasRecord[]>([]);
  const [settings, setSettings] = useState<OfficeSettings>(DEFAULT_OFFICE_SETTINGS);
  const [customTemplates, setCustomTemplates] = useState<
    Partial<Record<TemplateDocKey, CustomTemplateEntry>>
  >({});
  const [loading, setLoading] = useState(true);
  const [editingRecord, setEditingRecord] = useState<BerkasRecord | null>(null);
  const [taxPrefill, setTaxPrefill] = useState<TaxDraftPrefill | null>(null);
  const [wizardDefaultLayanan, setWizardDefaultLayanan] = useState<ServiceType | undefined>(
    undefined
  );
  const [selectedTaxRecordId, setSelectedTaxRecordId] = useState<string | null>(null);
  const [wizardKey, setWizardKey] = useState(0);
  const [receiptRecord, setReceiptRecord] = useState<BerkasRecord | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // Firebase Auth & Shared Office Cloud Sync State
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [cloudSession, setCloudSession] = useState<CloudSessionInfo>(SIGNED_OUT_SESSION);
  const [officeMembers, setOfficeMembers] = useState<OfficeMemberInfo[]>([]);
  const [officeInvites, setOfficeInvites] = useState<OfficeInviteInfo[]>([]);
  const [reloadingCloud, setReloadingCloud] = useState(false);
  const [syncingLocal, setSyncingLocal] = useState(false);
  const [sessionRetryTick, setSessionRetryTick] = useState(0);
  const settingsRef = useRef<OfficeSettings>(settings);
  settingsRef.current = settings;

  const isCloudConnected = Boolean(authUser && cloudSession.status === 'connected');

  const notify = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type });
    },
    []
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const reloadLocalAll = useCallback(async () => {
    setLoading(true);
    try {
      const [recs, sets, tpls] = await Promise.all([
        loadRecords(),
        loadSettings(),
        loadCustomTemplates(),
      ]);
      setRecords(recs);
      setSettings(sets);
      setCustomTemplates(tpls);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadLocalAll();
  }, [reloadLocalAll]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthReady(true);
      if (!user) {
        setCloudSession(SIGNED_OUT_SESSION);
        setOfficeMembers([]);
        setOfficeInvites([]);
      }
    });
    return unsub;
  }, []);

  // Resolve Shared Office Membership when signed in
  useEffect(() => {
    if (!authReady || !authUser) return;
    let cancelled = false;
    setCloudSession((prev) => ({ ...prev, status: 'connecting' }));

    void (async () => {
      try {
        const resolved = await resolveOfficeSession(authUser, settingsRef.current);
        if (cancelled) return;
        setCloudSession(resolved);
        if (resolved.status === 'uninvited') {
          notify(
            `Akun ${authUser.email} belum terdaftar di tim kantor. Minta Admin menambahkan email Anda di Pengaturan.`,
            'error'
          );
        }
      } catch (err) {
        if (cancelled) return;
        setCloudSession(SIGNED_OUT_SESSION);
        notify(
          formatCloudErrorMessage(err, 'Gagal menghubungkan sesi cloud kantor PPATS.'),
          'error'
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, authUser, sessionRetryTick, notify]);

  // Attach real-time Firestore listeners ONLY when auth is ready and user is connected to the shared office
  useEffect(() => {
    if (!authReady || !authUser || cloudSession.status !== 'connected') {
      return;
    }

    const unsubOffice = subscribeSharedOfficeData({
      officeId: cloudSession.officeId,
      userEmail: authUser.email || '',
      isBootstrappedAdmin: cloudSession.isBootstrappedAdmin,
      onRecords: (cloudRecs) => {
        setRecords(cloudRecs);
        setLoading(false);
      },
      onSettings: (cloudSets) => {
        setSettings(cloudSets);
        void saveSettings(cloudSets);
      },
      onTemplates: (cloudTpls) => {
        setCustomTemplates(cloudTpls);
      },
      onAllowedEmailsChange: (nextEmails) => {
        setCloudSession((prev) =>
          prev.status === 'connected' ? { ...prev, allowedEmails: nextEmails } : prev
        );
      },
      onError: (err) => {
        notify(formatCloudErrorMessage(err, 'Gangguan sinkronisasi real-time cloud.'), 'error');
      },
    });

    let unsubTeam: (() => void) | undefined;
    if (cloudSession.role === 'admin') {
      unsubTeam = subscribeOfficeTeam({
        officeId: cloudSession.officeId,
        userUid: authUser.uid,
        isBootstrappedAdmin: cloudSession.isBootstrappedAdmin,
        onMembers: setOfficeMembers,
        onInvites: setOfficeInvites,
        onError: (err) => {
          notify(formatCloudErrorMessage(err, 'Gagal memuat daftar tim kantor.'), 'error');
        },
      });
    }

    return () => {
      unsubOffice();
      if (unsubTeam) unsubTeam();
    };
  }, [
    authReady,
    authUser,
    cloudSession.status,
    cloudSession.officeId,
    cloudSession.role,
    cloudSession.isBootstrappedAdmin,
    notify,
  ]);

  const handleSignIn = async () => {
    setAuthBusy(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      notify(
        `Berhasil login sebagai ${cred.user.displayName || cred.user.email}. Menyambungkan data cloud bersama...`,
        'success'
      );
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return;
      }
      if (code === 'auth/popup-blocked') {
        notify(
          'Popup login Google diblokir oleh browser. Izinkan popup untuk situs ini lalu coba lagi.',
          'error'
        );
        return;
      }
      notify(
        err instanceof Error ? `Gagal login Google: ${err.message}` : 'Gagal login akun Google.',
        'error'
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    setAuthBusy(true);
    try {
      await signOut(auth);
      setCloudSession(SIGNED_OUT_SESSION);
      setOfficeMembers([]);
      setOfficeInvites([]);
      await reloadLocalAll();
      notify('Berhasil keluar akun. Aplikasi beralih ke penyimpanan lokal perangkat.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal keluar akun.', 'error');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleReloadCloud = async () => {
    if (!authUser || cloudSession.status !== 'connected') return;
    setReloadingCloud(true);
    try {
      const fresh = await reloadCloudSnapshotFromServer({
        officeId: cloudSession.officeId,
        userEmail: authUser.email || '',
        isBootstrappedAdmin: cloudSession.isBootstrappedAdmin,
      });
      setRecords(fresh.records);
      if (fresh.settings) setSettings(fresh.settings);
      setCustomTemplates(fresh.templates);
      notify(
        `Data cloud berhasil dimuat ulang (${fresh.records.length} berkas tersinkron).`,
        'success'
      );
    } catch (err) {
      notify(formatCloudErrorMessage(err, 'Gagal memuat ulang data dari cloud.'), 'error');
    } finally {
      setReloadingCloud(false);
    }
  };

  const handleSyncLocalToCloud = async () => {
    if (!authUser || cloudSession.status !== 'connected' || !cloudSession.role) return;
    setSyncingLocal(true);
    try {
      const res = await syncLocalBrowserDataToCloud({
        officeId: cloudSession.officeId,
        user: authUser,
        role: cloudSession.role,
        allowedEmails: cloudSession.allowedEmails,
      });
      notify(
        `Berhasil mengunggah ${res.recordCount} berkas${
          res.settingsSynced ? ', pengaturan kantor' : ''
        }${res.templateCount > 0 ? `, dan ${res.templateCount} template` : ''} ke Cloud Bersama.`,
        'success'
      );
    } catch (err) {
      notify(formatCloudErrorMessage(err, 'Gagal mengunggah data lokal ke cloud.'), 'error');
    } finally {
      setSyncingLocal(false);
    }
  };

  const handleInviteStaff = async (email: string, displayLabel: string, role: OfficeRole) => {
    if (!authUser || cloudSession.status !== 'connected') return;
    try {
      const nextAllowed = await inviteOfficeStaff({
        officeId: cloudSession.officeId,
        email,
        displayLabel,
        role,
        adminUser: authUser,
      });
      setCloudSession((prev) => ({ ...prev, allowedEmails: nextAllowed }));
      notify(
        `Akses tim ditambahkan untuk ${email} (${role === 'admin' ? 'Admin' : 'Petugas'}). Staf dapat langsung login dengan akun Google tersebut.`,
        'success'
      );
    } catch (err) {
      notify(formatCloudErrorMessage(err, 'Gagal menambahkan akses staf kantor.'), 'error');
      throw err;
    }
  };

  const handleRevokeAccess = async (email: string, memberUid?: string) => {
    if (!authUser || cloudSession.status !== 'connected') return;
    try {
      const nextAllowed = await revokeOfficeStaffAccess({
        officeId: cloudSession.officeId,
        email,
        memberUid,
        adminUser: authUser,
      });
      setCloudSession((prev) => ({ ...prev, allowedEmails: nextAllowed }));
      notify(`Akses tim untuk ${email} telah dicabut.`, 'success');
    } catch (err) {
      notify(formatCloudErrorMessage(err, 'Gagal mencabut akses tim.'), 'error');
    }
  };

  const handleCreateNew = () => {
    setEditingRecord(null);
    setTaxPrefill(null);
    setWizardDefaultLayanan(undefined);
    setWizardKey((k) => k + 1);
    setActiveSection('wizard');
  };

  const handleCreateNewNonAkta = () => {
    setEditingRecord(null);
    setTaxPrefill(null);
    setWizardDefaultLayanan('Turun Waris');
    setWizardKey((k) => k + 1);
    setActiveSection('wizard');
  };

  const handleEditRecord = (rec: BerkasRecord) => {
    setEditingRecord(rec);
    setTaxPrefill(null);
    setWizardDefaultLayanan(undefined);
    setWizardKey((k) => k + 1);
    setActiveSection('wizard');
  };

  const handleOpenTaxForRecord = (rec: BerkasRecord) => {
    setSelectedTaxRecordId(rec.id);
    setActiveSection('tax');
  };

  const handleCreateBerkasWithTax = (prefill: TaxDraftPrefill) => {
    setEditingRecord(null);
    setTaxPrefill(prefill);
    setWizardDefaultLayanan(undefined);
    setWizardKey((k) => k + 1);
    setActiveSection('wizard');
    notify(
      'Parameter luas, PBB, dan hasil perhitungan pajak dimuat ke formulir Buat Berkas Baru.',
      'success'
    );
  };

  const handleOpenTaxFromWizard = async (draftRecord: BerkasRecord) => {
    await handleSaveRecord(draftRecord);
    setSelectedTaxRecordId(draftRecord.id);
    setActiveSection('tax');
    notify(
      `Draft berkas ${draftRecord.kode_berkas} disimpan dan dibuka di jalur Perhitungan Pajak.`,
      'success'
    );
  };

  const handleSaveRecord = async (
    record: BerkasRecord,
    options?: { setAsEditing?: boolean }
  ) => {
    await saveRecord(record);
    if (isCloudConnected && authUser) {
      try {
        await saveCloudRecord(
          cloudSession.officeId,
          record,
          authUser,
          cloudSession.allowedEmails
        );
      } catch (err) {
        const msg = formatCloudErrorMessage(err, 'Gagal menyimpan berkas ke cloud.');
        notify(msg, 'error');
        throw new Error(msg);
      }
    }
    setRecords((prev) => {
      const exists = prev.some((r) => r.id === record.id);
      if (exists) {
        return prev.map((r) => (r.id === record.id ? record : r));
      }
      return [...prev, record].sort((a, b) => a.no_urut - b.no_urut);
    });
    if (options?.setAsEditing !== false) {
      setEditingRecord(record);
    }
  };

  const handleDuplicateRecord = async (source: BerkasRecord) => {
    const duplicated = duplicateBerkasRecord(source, records);
    try {
      await handleSaveRecord(duplicated, { setAsEditing: false });
      notify(
        `Berkas ${source.kode_berkas} berhasil diduplikasi menjadi ${duplicated.kode_berkas}. Klik Edit untuk menyesuaikan data.`,
        'success'
      );
    } catch {
      // already notified inside handleSaveRecord
    }
  };

  const handleFinishWizardToDashboard = (savedCode: string) => {
    setEditingRecord(null);
    setTaxPrefill(null);
    setWizardDefaultLayanan(undefined);
    setWizardKey((k) => k + 1);
    setActiveSection('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    notify(`Berkas ${savedCode} selesai dibuat dan tersimpan. Kembali ke Dashboard.`, 'success');
  };

  const handleFinishWizardAndCreateNew = (savedCode: string) => {
    setEditingRecord(null);
    setTaxPrefill(null);
    setWizardDefaultLayanan(undefined);
    setWizardKey((k) => k + 1);
    setActiveSection('wizard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    notify(
      `Berkas ${savedCode} selesai disimpan. Formulir pembuatan berkas baru (data kosong) siap digunakan.`,
      'success'
    );
  };

  const handleChangeStatus = async (recordId: string, nextStatus: BerkasStatus) => {
    const target = records.find((r) => r.id === recordId);
    if (!target) return;
    if (
      isCloudConnected &&
      cloudSession.role !== 'admin' &&
      isTerminalStatus(target.status)
    ) {
      notify(
        'Berkas yang sudah berstatus "11. Selesai" terkunci dan hanya dapat diubah oleh Admin Kantor.',
        'error'
      );
      return;
    }
    const updated: BerkasRecord = {
      ...target,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };
    try {
      await handleSaveRecord(updated, { setAsEditing: false });
      notify(`Status berkas ${target.kode_berkas} diubah menjadi "${nextStatus}".`, 'success');
    } catch {
      // already notified inside handleSaveRecord
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    const target = records.find((r) => r.id === recordId);
    if (isCloudConnected) {
      try {
        await deleteCloudRecord(cloudSession.officeId, recordId);
      } catch (err) {
        notify(formatCloudErrorMessage(err, 'Gagal menghapus berkas di cloud.'), 'error');
        return;
      }
    }
    await deleteRecord(recordId);
    setRecords((prev) => prev.filter((r) => r.id !== recordId));
    notify(`Berkas ${target?.kode_berkas || ''} dihapus dari register.`, 'success');
  };

  const handleSaveSettings = async (next: OfficeSettings) => {
    if (isCloudConnected && authUser) {
      if (cloudSession.role !== 'admin') {
        const msg = 'Pengaturan profil kantor bersama hanya dapat diubah oleh Admin Kantor.';
        notify(msg, 'error');
        throw new Error(msg);
      }
      try {
        await saveCloudSettings(cloudSession.officeId, next, authUser);
      } catch (err) {
        const msg = formatCloudErrorMessage(err, 'Gagal menyimpan pengaturan kantor ke cloud.');
        notify(msg, 'error');
        throw new Error(msg);
      }
    }
    await saveSettings(next);
    setSettings(next);
  };

  const handleUploadTemplate = async (entry: CustomTemplateEntry) => {
    if (isCloudConnected && authUser) {
      if (cloudSession.role !== 'admin') {
        const msg = 'Template Word kantor bersama hanya dapat diubah oleh Admin Kantor.';
        notify(msg, 'error');
        throw new Error(msg);
      }
      try {
        await saveCloudTemplate(
          cloudSession.officeId,
          entry,
          authUser,
          cloudSession.allowedEmails
        );
      } catch (err) {
        const msg = formatCloudErrorMessage(err, 'Gagal mengunggah template ke cloud.');
        notify(msg, 'error');
        throw new Error(msg);
      }
    }
    await saveCustomTemplate(entry);
    setCustomTemplates((prev) => ({ ...prev, [entry.key]: entry }));
  };

  const handleDeleteTemplate = async (key: TemplateDocKey) => {
    if (isCloudConnected) {
      if (cloudSession.role !== 'admin') {
        notify('Template Word kantor bersama hanya dapat dihapus oleh Admin Kantor.', 'error');
        return;
      }
      try {
        await deleteCloudTemplate(cloudSession.officeId, key);
      } catch (err) {
        notify(formatCloudErrorMessage(err, 'Gagal menghapus template di cloud.'), 'error');
        return;
      }
    }
    await deleteCustomTemplate(key);
    setCustomTemplates((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    notify('Template dikembalikan ke template bawaan sistem.', 'success');
  };

  const handleExportBackup = async () => {
    try {
      const payload = isCloudConnected
        ? {
            app: 'SIM-PPATS' as const,
            version: 1 as const,
            exportedAt: new Date().toISOString(),
            records,
            settings,
            templates: Object.values(customTemplates).filter(
              (t): t is CustomTemplateEntry => Boolean(t)
            ),
          }
        : await exportDatabaseBackup();
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Backup_SIM_PPATS_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      notify(`Backup berhasil diekspor (${payload.records.length} berkas).`, 'success');
    } catch (err) {
      notify(
        err instanceof Error ? err.message : 'Gagal mengekspor backup JSON.',
        'error'
      );
    }
  };

  const handleRestoreBackup = async (file: File) => {
    try {
      const text = await file.text();
      const res = await importDatabaseBackup(text);
      if (isCloudConnected && authUser && cloudSession.role) {
        await syncLocalBrowserDataToCloud({
          officeId: cloudSession.officeId,
          user: authUser,
          role: cloudSession.role,
          allowedEmails: cloudSession.allowedEmails,
        });
        notify(
          `Restore & sinkron cloud berhasil: ${res.recordCount} berkas dan ${res.templateCount} template dimuat.`,
          'success'
        );
      } else {
        await reloadLocalAll();
        notify(
          `Restore berhasil: ${res.recordCount} berkas dan ${res.templateCount} template dimuat.`,
          'success'
        );
      }
    } catch (err) {
      notify(
        formatCloudErrorMessage(err, 'Gagal me-restore file backup JSON.'),
        'error'
      );
    }
  };

  const handleSelectNavSection = (sec: NavSection) => {
    if (sec === 'wizard' && activeSection !== 'wizard' && !editingRecord) {
      setWizardDefaultLayanan(undefined);
      setWizardKey((k) => k + 1);
    }
    if (sec === 'tax') {
      setSelectedTaxRecordId(null);
    }
    setActiveSection(sec);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row app-canvas text-[#1E293B] dark:text-slate-100">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={handleSelectNavSection}
        settings={settings}
        isMobileOpen={isMobileSidebarOpen}
        onToggleMobile={() => setIsMobileSidebarOpen((v) => !v)}
        editingBadge={editingRecord?.kode_berkas ?? null}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopHeader
          activeSection={activeSection}
          onSelectSection={handleSelectNavSection}
          settings={settings}
          onExportBackup={handleExportBackup}
          onRestoreBackup={handleRestoreBackup}
          isMobileOpen={isMobileSidebarOpen}
          onToggleMobile={() => setIsMobileSidebarOpen((v) => !v)}
          editingBadge={editingRecord?.kode_berkas ?? null}
          authUser={authUser}
          cloudSession={cloudSession}
          authBusy={authBusy}
          reloadingCloud={reloadingCloud}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
          onReloadCloud={handleReloadCloud}
          theme={theme}
          onSetTheme={setTheme}
        />

        <main className="flex-1 min-w-0 px-3.5 pt-3 pb-24 sm:p-6 sm:pb-24 lg:p-8">
        {toast && (
          <div
            role="status"
            className={`no-print mb-5 px-4 py-3 rounded-xl border text-sm flex items-center justify-between gap-3 ${
              toast.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
                : 'bg-rose-50 dark:bg-rose-950/70 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-100'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              )}
              <span className="font-medium">{toast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Tutup notifikasi"
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            <div className="h-7 w-64 bg-slate-200/80 dark:bg-slate-800 rounded-lg animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-28 bento-card animate-pulse"
                />
              ))}
            </div>
          </div>
        ) : (
          <Suspense fallback={<ModuleLoadingFallback />}>
            {activeSection === 'dashboard' && (
              <DashboardModule
                records={records}
                onCreateNew={handleCreateNew}
                onEditRecord={handleEditRecord}
                onDuplicateRecord={handleDuplicateRecord}
                onCalculateTax={handleOpenTaxForRecord}
                onChangeStatus={handleChangeStatus}
                onPrintReceipt={(rec) => setReceiptRecord(rec)}
                onDeleteRecord={handleDeleteRecord}
              />
            )}

            {activeSection === 'wizard' && (
              <WizardModule
                key={wizardKey}
                existingRecords={records}
                editingRecord={editingRecord}
                taxPrefill={taxPrefill}
                initialLayanan={wizardDefaultLayanan}
                settings={settings}
                customTemplates={customTemplates}
                onSaveRecord={handleSaveRecord}
                onSaveSettings={handleSaveSettings}
                onCancelEdit={() => {
                  setEditingRecord(null);
                  setTaxPrefill(null);
                  setWizardDefaultLayanan(undefined);
                  setWizardKey((k) => k + 1);
                }}
                onFinishToDashboard={handleFinishWizardToDashboard}
                onFinishAndCreateNew={handleFinishWizardAndCreateNew}
                onPrintReceipt={(rec) => setReceiptRecord(rec)}
                onOpenTaxCalculator={handleOpenTaxFromWizard}
                onNotify={notify}
              />
            )}

            {activeSection === 'tax' && (
              <TaxCalculatorModule
                records={records}
                settings={settings}
                initialRecordId={selectedTaxRecordId}
                onSaveRecord={handleSaveRecord}
                onCreateBerkasWithTax={handleCreateBerkasWithTax}
                onEditRecord={handleEditRecord}
                onNotify={notify}
              />
            )}

            {activeSection === 'register' && (
              <RegisterModule
                records={records}
                onEditRecord={handleEditRecord}
              />
            )}

            {activeSection === 'report' && (
              <ReportModule
                records={records}
                settings={settings}
                onOpenNonAktaRekap={() => setActiveSection('non_akta_rekap')}
                onNotify={notify}
              />
            )}

            {activeSection === 'non_akta_rekap' && (
              <NonAktaRekapModule
                records={records}
                settings={settings}
                onCreateNewNonAkta={handleCreateNewNonAkta}
                onEditRecord={handleEditRecord}
                onChangeStatus={handleChangeStatus}
                onPrintReceipt={(rec) => setReceiptRecord(rec)}
                onDeleteRecord={handleDeleteRecord}
                onNotify={notify}
              />
            )}

            {activeSection === 'settings' && (
              <SettingsModule
                settings={settings}
                customTemplates={customTemplates}
                onSaveSettings={handleSaveSettings}
                onUploadTemplate={handleUploadTemplate}
                onDeleteTemplate={handleDeleteTemplate}
                onExportBackup={handleExportBackup}
                onRestoreBackup={handleRestoreBackup}
                onNotify={notify}
                cloudProps={{
                  user: authUser,
                  session: cloudSession,
                  authBusy,
                  reloadingCloud,
                  syncingLocal,
                  members: officeMembers,
                  invites: officeInvites,
                  onSignIn: handleSignIn,
                  onSignOut: handleSignOut,
                  onRetryAccess: () => setSessionRetryTick((t) => t + 1),
                  onReloadCloud: handleReloadCloud,
                  onSyncLocalToCloud: handleSyncLocalToCloud,
                  onInviteStaff: handleInviteStaff,
                  onRevokeAccess: handleRevokeAccess,
                }}
              />
            )}
          </Suspense>
        )}
        </main>
      </div>

      <MobileBottomNav
        activeSection={activeSection}
        onSelectSection={handleSelectNavSection}
        onOpenDrawer={() => setIsMobileSidebarOpen((v) => !v)}
        isDrawerOpen={isMobileSidebarOpen}
      />

      {receiptRecord && (
        <Suspense fallback={null}>
          <ReceiptModal
            record={receiptRecord}
            settings={settings}
            onClose={() => setReceiptRecord(null)}
          />
        </Suspense>
      )}
      <OfflineIndicator />
      <PWAInstallBanner />
    </div>
  );
}
