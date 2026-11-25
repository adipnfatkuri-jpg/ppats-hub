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
          className="no-print fixed inset-0 bg-[#081726]/60 z-30 lg:hidden"
          onClick={onToggleMobile}
          aria-hidden="true"
        />
      )}

      {/* Left Navigation Sidebar — Deep Marine Navy (#0B1F3A) with 3px Gold-Wood border (#C89B3C) */}
      <aside
        aria-label="Navigasi Utama SIM-PPATS"
        className={`no-print fixed lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto inset-y-0 left-0 z-40 w-64 shrink-0 bg-[#0B1F3A] dark:bg-[#071529] text-[#F8FAFC] flex flex-col border-r-[3px] border-[#C89B3C] shadow-[4px_0_20px_rgba(7,21,41,0.35)] transition-transform duration-150 overflow-hidden ${
          isMobileOpen
            ? 'translate-x-0 visible'
            : '-translate-x-full invisible lg:visible lg:translate-x-0'
        }`}
      >
        {/* Minimalist Nautical Chart & Compass Rose SVG Pattern (opacity 0.05) */}
        <svg
          aria-hidden="true"
          viewBox="0 0 260 900"
          preserveAspectRatio="xMidYMid slice"
          className="pointer-events-none select-none absolute inset-0 w-full h-full opacity-[0.06] text-[#F4C430]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Cartographic Latitude & Longitude Grid */}
          <path
            d="M0 140 H260 M0 310 H260 M0 480 H260 M0 650 H260 M0 810 H260"
            stroke="currentColor"
            strokeWidth="0.75"
            strokeDasharray="4 6"
          />
          <path
            d="M65 0 V900 M130 0 V900 M195 0 V900"
            stroke="currentColor"
            strokeWidth="0.75"
            strokeDasharray="4 6"
          />
          {/* Rhumb Lines radiating from Lower Compass Rose */}
          <g stroke="currentColor" strokeWidth="0.75">
            <line x1="190" y1="680" x2="-40" y2="380" />
            <line x1="190" y1="680" x2="260" y2="210" />
            <line x1="190" y1="680" x2="-60" y2="680" />
            <line x1="190" y1="680" x2="190" y2="200" />
            <line x1="190" y1="680" x2="10" y2="880" />
            <line x1="190" y1="680" x2="320" y2="540" />
          </g>
          {/* Minimalist Compass Rose (Lower Right) */}
          <g transform="translate(190 680)" stroke="currentColor">
            <circle cx="0" cy="0" r="108" strokeWidth="1" />
            <circle cx="0" cy="0" r="94" strokeWidth="0.75" strokeDasharray="3 4" />
            <circle cx="0" cy="0" r="48" strokeWidth="0.9" />
            <polygon points="0,-102 12,-14 0,-26 -12,-14" fill="currentColor" />
            <polygon points="0,102 12,14 0,26 -12,14" strokeWidth="1" />
            <polygon points="102,0 14,12 26,0 14,-12" strokeWidth="1" />
            <polygon points="-102,0 -14,12 -26,0 -14,-12" strokeWidth="1" />
            <polygon points="68,-68 10,-2 2,-10" strokeWidth="0.8" />
            <polygon points="-68,-68 -2,-10 -10,-2" strokeWidth="0.8" />
            <polygon points="68,68 2,10 10,2" strokeWidth="0.8" />
            <polygon points="-68,68 -10,2 -2,10" strokeWidth="0.8" />
            <circle cx="0" cy="0" r="7" fill="currentColor" />
          </g>
          {/* Subtle Upper Arc */}
          <circle cx="30" cy="180" r="130" stroke="currentColor" strokeWidth="0.75" strokeDasharray="6 8" />
        </svg>

        {/* Office Brand Header — Classic Gold Serif Logo (#F4C430) */}
        <div className="relative z-10 px-4 h-16 flex items-center justify-between border-b border-[#C89B3C]/35 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#142E52] border-2 border-[#C89B3C] flex items-center justify-center shrink-0 shadow-sm">
              <Scale className="w-4.5 h-4.5 text-[#F4C430]" />
            </div>
            <div className="min-w-0">
              <div className="font-cinzel font-extrabold text-[15px] tracking-wider text-[#F4C430] truncate leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                SIM-PPATS
              </div>
              <p className="text-[11px] text-[#F8FAFC]/80 truncate leading-tight mt-0.5">
                {settings.nama_kecamatan}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleMobile}
            aria-label="Tutup menu navigasi"
            className="lg:hidden p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Links (clean ivory text with subtle gold active highlight) */}
        <nav className="relative z-10 flex-1 px-3 py-4 sm:pb-44 space-y-1 overflow-y-auto">
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
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 text-left whitespace-nowrap border-l-[3px] ${
                  isActive
                    ? 'border-[#F4C430] bg-[#C89B3C]/20 text-[#F8FAFC] font-semibold shadow-[inset_0_0_0_1px_rgba(244,196,48,0.2)]'
                    : 'border-transparent text-[#F8FAFC]/82 font-medium hover:bg-white/10 hover:text-[#FFFFFF]'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-[#F4C430]' : 'text-[#F8FAFC]/70'
                  }`}
                />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Decorative Luffy Chibi Sticker (bottom-left sidebar above official's name, non-blocking) */}
        <img
          src="/luffy-chibi.png"
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          className="hidden sm:block pointer-events-none select-none absolute left-3 bottom-[68px] z-10 w-[120px] h-auto drop-shadow-[0_6px_12px_rgba(0,0,0,0.45)]"
        />

        {/* Minimal Quiet Office Identity Footer */}
        <div className="relative z-20 px-4 py-3.5 border-t border-[#C89B3C]/35 bg-[#08172D]/90">
          <p className="text-xs font-semibold text-[#F4C430] truncate">
            {settings.nama_ppats}
          </p>
          <p className="text-[11px] text-[#F8FAFC]/80 truncate mt-0.5">
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
    <header className="no-print sticky top-0 z-30 h-16 bg-transparent px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 shrink-0">
      {/* Left: Mobile drawer trigger + Frosted Parchment Contextual Breadcrumb (leaves Grand Line sky visible) */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={onToggleMobile}
          aria-label={isMobileOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
          className="lg:hidden p-2 -ml-1 rounded-lg border-2 border-[#6B4423] dark:border-[#C89B3C] bg-[#FBF3E0]/92 dark:bg-[#0B1F3A]/90 text-[#3E2712] dark:text-[#F4C430] hover:bg-[#F3E5C8] dark:hover:bg-[#163450] shadow-sm transition-colors shrink-0"
        >
          {isMobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>

        <div className="flex items-center gap-2 min-w-0 text-xs sm:text-sm px-3.5 py-1.5 rounded-full bg-[#FFFBF0]/88 dark:bg-[#0B1F3A]/85 backdrop-blur-sm border border-[#C89B3C]/80 shadow-[0_2px_10px_rgba(11,31,58,0.18)]">
          <span className="lg:hidden font-cinzel font-extrabold text-[#6B4423] dark:text-[#F4C430] tracking-wider whitespace-nowrap">
            SIM-PPATS
          </span>
          <span className="hidden lg:inline text-[#6B4423] dark:text-[#F4C430]/90 font-semibold truncate max-w-[180px]">
            {settings.nama_kecamatan}
          </span>
          <span className="hidden sm:inline text-[#C89B3C] dark:text-[#C89B3C]/60">/</span>
          <span className="hidden sm:inline font-bold text-[#0B1F3A] dark:text-[#F8FAFC] truncate">
            {sectionLabel}
          </span>
        </div>
      </div>

      {/* Right: Compact Utility Menu, Dark/Light Mode Toggle, and Metallic Gold Login Google */}
      <div className="flex items-center gap-2.5 shrink-0">
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
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-[#C89B3C]/85 bg-[#FFFBF0]/92 dark:bg-[#0B1F3A]/88 backdrop-blur-sm hover:bg-[#FBF3E0] dark:hover:bg-[#142F52] text-[#0B1F3A] dark:text-[#F8FAFC] text-xs font-semibold shadow-[0_2px_10px_rgba(11,31,58,0.18)] transition-colors whitespace-nowrap"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#6B4423] dark:text-[#F4C430] shrink-0" />
            <span className="hidden sm:inline">Utilitas</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#8C6239] dark:text-slate-300 shrink-0 hidden sm:inline" />
          </button>

          {/* Keep mounted while hidden so PWAInstallButton modals stay open cleanly */}
          <div
            role="menu"
            aria-label="Utilitas Kantor"
            className={`${
              utilityOpen ? 'block' : 'hidden'
            } absolute right-0 mt-2 w-56 rounded-xl border-2 border-[#6B4423] dark:border-[#C89B3C] bg-[#FFFBF0] dark:bg-[#0B1F3A] shadow-xl p-1.5 z-50`}
          >
            <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#6B4423] dark:text-[#F4C430]">
              Data &amp; Aplikasi
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setUtilityOpen(false);
                onExportBackup();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-[#1E293B] dark:text-slate-200 hover:bg-[#F3E5C8] dark:hover:bg-[#163450] rounded-md transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-[#6B4423] dark:text-[#F4C430] shrink-0" />
              <span>Export Backup (.JSON)</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setUtilityOpen(false);
                restoreInputRef.current?.click();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-[#1E293B] dark:text-slate-200 hover:bg-[#F3E5C8] dark:hover:bg-[#163450] rounded-md transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-[#6B4423] dark:text-[#F4C430] shrink-0" />
              <span>Restore Backup (.JSON)</span>
            </button>
            <div className="my-1 border-t border-[#E2D5C1] dark:border-[#1E3A54]" />
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
          className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-[#C89B3C]/85 bg-[#FFFBF0]/92 dark:bg-[#0B1F3A]/88 backdrop-blur-sm hover:bg-[#FBF3E0] dark:hover:bg-[#142F52] text-[#0B1F3A] dark:text-[#F4C430] shadow-[0_2px_10px_rgba(11,31,58,0.18)] transition-colors shrink-0"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-[#F4C430]" />
          ) : (
            <Moon className="w-4 h-4 text-[#0B1F3A]" />
          )}
        </button>

        {/* Metallic Gold Capsule Login Google / Cloud Account Status */}
        {!authUser ? (
          <button
            type="button"
            onClick={onSignIn}
            disabled={authBusy}
            className="btn-gold-metallic inline-flex items-center gap-1.5 h-9 px-4 text-xs tracking-tight whitespace-nowrap disabled:opacity-60"
          >
            <LogIn className="w-3.5 h-3.5 text-[#111827] stroke-[2.5] shrink-0" />
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
              className="btn-gold-metallic inline-flex items-center gap-2 h-9 px-2.5 pr-3 text-xs whitespace-nowrap"
            >
              <span className="relative inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#0B1F3A] text-[#F4C430] text-[11px] font-bold shrink-0">
                {userInitial}
                <span
                  aria-hidden="true"
                  className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-[#FDE047] ${
                    cloudSession.status === 'connected'
                      ? 'bg-emerald-500'
                      : 'bg-amber-500'
                  }`}
                />
              </span>
              <span className="hidden md:inline max-w-[110px] truncate text-[#111827] font-bold">
                {authUser.displayName || authUser.email}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#111827] shrink-0" />
            </button>

            {accountOpen && (
              <div
                role="menu"
                aria-label="Menu Akun Cloud"
                className="absolute right-0 mt-2 w-64 rounded-xl border-2 border-[#6B4423] dark:border-[#C89B3C] bg-[#FFFBF0] dark:bg-[#0B1F3A] shadow-xl p-2 z-50 space-y-1.5"
              >
                <div className="px-2.5 py-1.5 border-b border-[#E2D5C1] dark:border-[#1E3A54]">
                  <p className="text-xs font-semibold text-[#0B1F3A] dark:text-white truncate">
                    {authUser.displayName || authUser.email}
                  </p>
                  <p className="text-[11px] text-[#786B59] dark:text-slate-400 truncate">
                    {authUser.email}
                  </p>
                  <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-[#475569] dark:text-slate-300">
                    <Cloud
                      className={`w-3.5 h-3.5 shrink-0 ${
                        cloudSession.status === 'connected'
                          ? 'text-emerald-700 dark:text-emerald-400'
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
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-left text-xs font-medium text-[#1E293B] dark:text-slate-200 hover:bg-[#F7F2E7] dark:hover:bg-[#163450] rounded-md transition-colors disabled:opacity-60"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 text-[#786B59] ${reloadingCloud ? 'animate-spin' : ''}`}
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
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-left text-xs font-medium text-[#1E293B] dark:text-slate-200 hover:bg-[#F7F2E7] dark:hover:bg-[#163450] rounded-md transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-[#786B59]" />
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
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-left text-xs font-medium text-[#B91C1C] dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors disabled:opacity-60"
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
