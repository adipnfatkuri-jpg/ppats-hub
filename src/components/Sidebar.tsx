import React, { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  LayoutDashboard,
  FilePlus2,
  Calculator,
  BookOpenCheck,
  FileSpreadsheet,
  ClipboardList,
  Settings,
  Download,
  Upload,
  Menu,
  X,
  Scale,
  Cloud,
  LogIn,
  LogOut,
  RefreshCw,
  Sun,
  Moon,
  ChevronDown,
  SlidersHorizontal,
} from 'lucide-react';
import { OfficeSettings } from '../types/ppats';
import type { CloudSessionInfo } from '../utils/cloudSync';
import type { AppTheme } from '../hooks/useTheme';
import { PWAInstallButton } from './PWAInstallButton';

export type NavSection =
  | 'dashboard'
  | 'wizard'
  | 'tax'
  | 'register'
  | 'report'
  | 'non_akta_rekap'
  | 'settings';

export const NAV_SECTION_TITLES: Record<NavSection, string> = {
  dashboard: 'Dashboard & Tracking',
  wizard: 'Buat Berkas Baru',
  tax: 'Perhitungan Pajak',
  register: 'Buku Register Akta',
  report: 'Laporan Bulanan PPATS',
  non_akta_rekap: 'Rekap Non-Akta',
  settings: 'Pengaturan & Template',
};

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  settings: OfficeSettings;
  isMobileOpen: boolean;
  onToggleMobile: () => void;
  editingBadge?: string | null;
}

export interface TopHeaderProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  settings: OfficeSettings;
  onExportBackup: () => void;
  onRestoreBackup: (file: File) => void;
  isMobileOpen: boolean;
  onToggleMobile: () => void;
  editingBadge?: string | null;
  authUser: User | null;
  cloudSession: CloudSessionInfo;
  authBusy: boolean;
  reloadingCloud: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  onReloadCloud: () => void;
  theme: AppTheme;
  onSetTheme: (theme: AppTheme) => void;
}

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Dashboard & Tracking', icon: LayoutDashboard },
  { id: 'wizard', label: 'Buat Berkas Baru', icon: FilePlus2 },
  { id: 'tax', label: 'Perhitungan Pajak', icon: Calculator },
  { id: 'register', label: 'Buku Register Akta', icon: BookOpenCheck },
  { id: 'report', label: 'Laporan Bulanan PPATS', icon: FileSpreadsheet },
  { id: 'non_akta_rekap', label: 'Rekap Non-Akta', icon: ClipboardList },
  { id: 'settings', label: 'Pengaturan & Template', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  settings,
  isMobileOpen,
  onToggleMobile,
  editingBadge,
}) => {
  return (
    <>
      {/* Backdrop for mobile drawer */}
      {isMobileOpen && (
        <div
          className="no-print fixed inset-0 bg-slate-950/50 z-30 lg:hidden"
          onClick={onToggleMobile}
          aria-hidden="true"
        />
      )}

      {/* Left Navigation Sidebar — Flat Deep Forest Green Legal-Tech */}
      <aside
        aria-label="Navigasi Utama SIM-PPATS"
        className={`no-print fixed lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto inset-y-0 left-0 z-40 w-64 shrink-0 bg-[#064E3B] dark:bg-[#042F2E] text-emerald-50 flex flex-col border-r border-emerald-950/20 dark:border-slate-800 transition-transform duration-150 ${
          isMobileOpen
            ? 'translate-x-0 visible'
            : '-translate-x-full invisible lg:visible lg:translate-x-0'
        }`}
      >
        {/* Office Brand Header */}
        <div className="px-4 h-14 flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
              <Scale className="w-4 h-4 text-emerald-100" />
            </div>
            <div className="min-w-0">
              <div className="font-display font-bold text-sm tracking-tight text-white truncate leading-tight">
                SIM-PPATS
              </div>
              <p className="text-[11px] text-emerald-200/75 truncate leading-tight">
                {settings.nama_kecamatan}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleMobile}
            aria-label="Tutup menu navigasi"
            className="lg:hidden p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            const label =
              item.id === 'wizard' && editingBadge
                ? 'Edit Berkas Aktif'
                : item.label;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectSection(item.id);
                  if (isMobileOpen) onToggleMobile();
                }}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 text-left whitespace-nowrap ${
                  isActive
                    ? 'bg-white/15 text-white font-semibold'
                    : 'text-emerald-100/75 font-medium hover:bg-white/8 hover:text-white'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-white' : 'text-emerald-200/70'
                  }`}
                />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Minimal Quiet Office Identity Footer */}
        <div className="px-4 py-3.5 border-t border-white/10">
          <p className="text-xs font-semibold text-white truncate">
            {settings.nama_ppats}
          </p>
          <p className="text-[11px] text-emerald-200/70 truncate mt-0.5">
            {settings.nama_kabupaten}
          </p>
        </div>
      </aside>
    </>
  );
};

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeSection,
  onSelectSection,
  settings,
  onExportBackup,
  onRestoreBackup,
  isMobileOpen,
  onToggleMobile,
  editingBadge,
  authUser,
  cloudSession,
  authBusy,
  reloadingCloud,
  onSignIn,
  onSignOut,
  onReloadCloud,
  theme,
  onSetTheme,
}) => {
  const [utilityOpen, setUtilityOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const utilityRef = useRef<HTMLDivElement | null>(null);
  const accountRef = useRef<HTMLDivElement | null>(null);
  const restoreInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!utilityOpen && !accountOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (
        utilityOpen &&
        utilityRef.current &&
        !utilityRef.current.contains(e.target as Node)
      ) {
        setUtilityOpen(false);
      }
      if (
        accountOpen &&
        accountRef.current &&
        !accountRef.current.contains(e.target as Node)
      ) {
        setAccountOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUtilityOpen(false);
        setAccountOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [utilityOpen, accountOpen]);

  const handleRestoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onRestoreBackup(file);
      e.target.value = '';
    }
  };

  const sectionLabel =
    activeSection === 'wizard' && editingBadge
      ? `Edit Berkas (${editingBadge})`
      : NAV_SECTION_TITLES[activeSection];

  const userInitial = (authUser?.displayName || authUser?.email || 'U')
    .trim()
    .slice(0, 1)
    .toUpperCase();

  return (
    <header className="no-print sticky top-0 z-30 h-14 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 shrink-0">
      {/* Left: Mobile drawer trigger + Executive contextual breadcrumb */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={onToggleMobile}
          aria-label={isMobileOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
          className="lg:hidden p-1.5 -ml-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0"
        >
          {isMobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>

        <div className="flex items-center gap-2 min-w-0 text-xs sm:text-sm">
          <span className="lg:hidden font-display font-bold text-[#064E3B] dark:text-emerald-400 tracking-tight whitespace-nowrap">
            SIM-PPATS
          </span>
          <span className="hidden lg:inline text-slate-400 dark:text-slate-500 font-medium truncate max-w-[180px]">
            {settings.nama_kecamatan}
          </span>
          <span className="hidden sm:inline text-slate-300 dark:text-slate-700">/</span>
          <span className="hidden sm:inline font-semibold text-slate-800 dark:text-slate-100 truncate">
            {sectionLabel}
          </span>
        </div>
      </div>

      {/* Right: Compact Utility Menu, Dark/Light Mode Toggle, and Cloud Account */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Compact Utilities Dropdown (Backup, Restore, Shortcut/Install) */}
        <div ref={utilityRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setUtilityOpen((v) => !v);
              setAccountOpen(false);
            }}
            aria-haspopup="menu"
            aria-expanded={utilityOpen}
            aria-label="Menu Utilitas Backup, Restore, dan Shortcut"
            className="inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors whitespace-nowrap"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
            <span className="hidden sm:inline">Utilitas</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 hidden sm:inline" />
          </button>

          {/* Keep mounted while hidden so PWAInstallButton modals stay open cleanly */}
          <div
            role="menu"
            aria-label="Utilitas Kantor"
            className={`${
              utilityOpen ? 'block' : 'hidden'
            } absolute right-0 mt-1.5 w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] shadow-md p-1.5 z-50`}
          >
            <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Data &amp; Aplikasi
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setUtilityOpen(false);
                onExportBackup();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
              <span>Export Backup (.JSON)</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setUtilityOpen(false);
                restoreInputRef.current?.click();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
              <span>Restore Backup (.JSON)</span>
            </button>
            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
            <PWAInstallButton
              variant="menu-item"
              onActionTriggered={() => setUtilityOpen(false)}
            />
          </div>
          <input
            ref={restoreInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleRestoreChange}
            className="hidden"
            aria-label="Pilih file backup JSON"
          />
        </div>

        {/* Compact Dark / Light Mode Toggle */}
        <button
          type="button"
          onClick={() => onSetTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={
            theme === 'dark' ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Malam'
          }
          title={theme === 'dark' ? 'Mode Terang' : 'Mode Malam'}
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 transition-colors shrink-0"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600" />
          )}
        </button>

        {/* Compact Google Login / Cloud Account Status */}
        {!authUser ? (
          <button
            type="button"
            onClick={onSignIn}
            disabled={authBusy}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap disabled:opacity-60"
          >
            <LogIn className="w-3.5 h-3.5 text-[#064E3B] dark:text-emerald-400 shrink-0" />
            <span className="hidden sm:inline">
              {authBusy ? 'Menghubungkan...' : 'Login Google'}
            </span>
            <span className="sm:hidden">{authBusy ? '...' : 'Login'}</span>
          </button>
        ) : (
          <div ref={accountRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setAccountOpen((v) => !v);
                setUtilityOpen(false);
              }}
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              aria-label="Status Akun Google Cloud"
              className="inline-flex items-center gap-2 h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-100 text-xs font-medium transition-colors whitespace-nowrap"
            >
              <span className="relative inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold shrink-0">
                {userInitial}
                <span
                  aria-hidden="true"
                  className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-white dark:ring-slate-800 ${
                    cloudSession.status === 'connected'
                      ? 'bg-emerald-500'
                      : 'bg-amber-500'
                  }`}
                />
              </span>
              <span className="hidden md:inline max-w-[110px] truncate">
                {authUser.displayName || authUser.email}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {accountOpen && (
              <div
                role="menu"
                aria-label="Menu Akun Cloud"
                className="absolute right-0 mt-1.5 w-64 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] shadow-md p-2 z-50 space-y-1.5"
              >
                <div className="px-2.5 py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {authUser.displayName || authUser.email}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {authUser.email}
                  </p>
                  <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                    <Cloud
                      className={`w-3.5 h-3.5 shrink-0 ${
                        cloudSession.status === 'connected'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    />
                    <span>
                      {cloudSession.status === 'connected'
                        ? cloudSession.role === 'admin'
                          ? 'Cloud Bersama · Admin'
                          : 'Cloud Bersama · Petugas'
                        : cloudSession.status === 'connecting'
                          ? 'Menyambungkan Cloud...'
                          : 'Belum masuk tim kantor'}
                    </span>
                  </div>
                </div>

                {cloudSession.status === 'connected' ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAccountOpen(false);
                      onReloadCloud();
                    }}
                    disabled={reloadingCloud}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md transition-colors disabled:opacity-60"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 text-slate-500 ${reloadingCloud ? 'animate-spin' : ''}`}
                    />
                    <span>Muat Ulang Data Cloud</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAccountOpen(false);
                      onSelectSection('settings');
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-500" />
                    <span>Kelola Akses Cloud</span>
                  </button>
                )}

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountOpen(false);
                    onSignOut();
                  }}
                  disabled={authBusy}
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-left text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors disabled:opacity-60"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Keluar Akun</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
