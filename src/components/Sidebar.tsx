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

/* ============================================================================
 * 5 CUSTOM SAKAMOTO DAYS MINIMALIST SVG ICONS FOR MOBILE BOTTOM NAVIGATION BAR
 * (20px x 20px, strokeWidth 1.8px, clean vector geometry)
 * ============================================================================ */

/** 1) Beranda: Sakamoto's Store Japanese konbini awning storefront */
const SakamotoStoreIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M3 9.5 4.8 4.5h14.4L21 9.5" />
    <path d="M3 9.5a2.25 2.25 0 0 0 4.5 0 2.25 2.25 0 0 0 4.5 0 2.25 2.25 0 0 0 4.5 0 2.25 2.25 0 0 0 4.5 0" />
    <path d="M5 11.75V20h14v-8.25" />
    <path d="M9.5 20v-5h5v5" />
  </svg>
);

/** 2) Pajak: Konbini shopping receipt with barcode stripes */
const KonbiniReceiptIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M5 3.5h14v17l-2.3-1.4-2.3 1.4L12 19.1l-2.4 1.4-2.3-1.4L5 20.5v-17Z" />
    <path d="M8.5 8h7" />
    <path d="M8.5 11.5v3.5" />
    <path d="M11 11.5v3.5" />
    <path d="M13.5 11.5v3.5" />
    <path d="M15.5 11.5v3.5" />
  </svg>
);

/** 3) Berkas (+): Assassin target crosshair with crisp center + */
const CrosshairPlusIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="7.5" />
    <path d="M12 2.2v2.3" />
    <path d="M12 19.5v2.3" />
    <path d="M2.2 12h2.3" />
    <path d="M19.5 12h2.3" />
    <path d="M12 8.75v6.5" />
    <path d="M8.75 12h6.5" />
  </svg>
);

/** 4) Register: Mugshot slate / dossier archive ledger */
const DossierMugshotIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <rect x="4" y="3.5" width="16" height="17" rx="2" />
    <path d="M4 8h16" />
    <path d="M7.5 5.75h3" />
    <path d="M15 5.75h1.5" />
    <rect x="7.5" y="11" width="9" height="4.5" rx="1" />
    <path d="M8.5 18h7" />
  </svg>
);

/** 5) Lainnya: Slim minimalist three-line menu */
const SlimMenuIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M4.5 7h15" />
    <path d="M4.5 12h15" />
    <path d="M4.5 17h10.5" />
  </svg>
);

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
  useEffect(() => {
    if (!isMobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onToggleMobile();
      }
    };
    const isSmallViewport = window.matchMedia('(max-width: 1023px)').matches;
    const prevOverflow = document.body.style.overflow;
    if (isSmallViewport) {
      document.body.style.overflow = 'hidden';
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (isSmallViewport) {
        document.body.style.overflow = prevOverflow;
      }
    };
  }, [isMobileOpen, onToggleMobile]);

  return (
    <>
      {/* Smoothly fading frosted backdrop for mobile drawer */}
      <div
        className={`no-print fixed inset-0 z-40 lg:hidden bg-black/70 backdrop-blur-[4px] transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          isMobileOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
        onClick={onToggleMobile}
        aria-hidden="true"
      />

      {/* Left Navigation Sidebar & Mobile Drawer — Matte Black (#0E1014) + Warm Manga Yellow Border */}
      <aside
        aria-label="Navigasi Utama SIM-PPATS"
        className={`no-print fixed lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto inset-y-0 left-0 z-50 lg:z-auto w-[272px] max-w-[84vw] lg:w-64 shrink-0 max-lg:bg-[#0E1014]/96 max-lg:backdrop-blur-[12px] lg:bg-[#0E1014] border-r border-[#FACC15]/55 text-[#F8FAFC] flex flex-col rounded-r-[20px] lg:rounded-none overflow-hidden pt-safe pb-safe will-change-transform transition-[transform,opacity,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          isMobileOpen
            ? 'translate-x-0 opacity-100 pointer-events-auto shadow-[12px_0_36px_rgba(0,0,0,0.75)]'
            : '-translate-x-full opacity-0 pointer-events-none shadow-none lg:translate-x-0 lg:opacity-100 lg:pointer-events-auto lg:shadow-[6px_0_22px_rgba(0,0,0,0.45)]'
        }`}
      >
        {/* Black & Warm Manga Yellow Diagonal Hazard Stripe */}
        <div className="manga-hazard-stripe shrink-0" aria-hidden="true" />

        {/* Office Brand Header — Warm Manga Yellow Logo (#FACC15) + Yellow Rounded Icon Box */}
        <div className="relative z-10 px-4 h-14 flex items-center justify-between border-b border-white/[0.08] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#FACC15] text-[#0E1014] flex items-center justify-center shrink-0 shadow-[0_2px_10px_rgba(250,204,21,0.3)]">
              <Scale className="w-4 h-4 stroke-[2.4]" />
            </div>
            <div className="min-w-0">
              <div className="font-extrabold text-[16px] tracking-tight text-[#FACC15] truncate leading-tight">
                SIM-PPATS
              </div>
              <p className="text-[11px] text-[#94A3B8] truncate leading-tight mt-0.5 font-medium">
                {settings.nama_kecamatan}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleMobile}
            aria-label="Tutup menu navigasi"
            className="lg:hidden inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#171A21] border border-white/[0.12] text-[#FACC15] hover:bg-[#FACC15] hover:text-[#0E1014] active:scale-95 transition-all duration-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Links — Warm Manga Yellow Active + Clean White Inactive */}
        <nav
          className={`relative z-10 flex-1 px-3 py-3 pb-64 lg:pb-72 space-y-1 overflow-y-auto no-scrollbar transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
            isMobileOpen ? 'translate-x-0' : '-translate-x-3 lg:translate-x-0'
          }`}
        >
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
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 min-h-[40px] rounded-[10px] text-[13px] transition-all duration-150 text-left whitespace-nowrap ${
                  isActive
                    ? 'bg-[#FACC15] text-[#0E1014] font-extrabold shadow-[0_2px_14px_rgba(250,204,21,0.28)]'
                    : 'text-[#F8FAFC] font-medium hover:bg-white/[0.06] hover:text-[#FACC15]'
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center w-6.5 h-6.5 rounded-md shrink-0 transition-colors ${
                    isActive
                      ? 'bg-[#0E1014]/12 text-[#0E1014]'
                      : 'bg-[#171A21] border border-white/[0.08] text-[#FACC15]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                </span>
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </nav>

        {/* SINGLE Decorative Character: Taro Sakamoto inside Sidebar (Desktop & Mobile Drawer only) */}
        <img
          src="/sakamoto.png"
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          className="pointer-events-none select-none absolute inset-x-0 mx-auto bottom-[46px] z-[5] w-[256px] max-w-[96%] lg:w-[246px] h-auto max-h-[48vh] object-contain object-bottom sakamoto-float drop-shadow-[0_12px_26px_rgba(0,0,0,0.8)]"
        />

        {/* Minimal High-Contrast Office Identity Footer */}
        <div className="relative z-20 px-4 py-2.5 border-t border-white/[0.1] bg-[#0E1014]/96">
          <p className="text-xs font-extrabold text-[#FACC15] truncate">
            {settings.nama_ppats}
          </p>
          <p className="text-[11px] text-[#94A3B8] truncate mt-0.5 font-medium">
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
    <header className="no-print sticky top-0 z-30 pt-safe max-lg:bg-[#0E1014]/96 max-lg:border-b max-lg:border-[#FACC15]/45 max-lg:backdrop-blur-md max-lg:shadow-[0_4px_16px_rgba(0,0,0,0.5)] shrink-0">
      <div className="h-[52px] lg:h-14 px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-1.5 sm:gap-2.5">
        {/* Left: Compact 32px Mobile Drawer Trigger + Slim Breadcrumb */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <button
            type="button"
            onClick={onToggleMobile}
            aria-expanded={isMobileOpen}
            aria-label={isMobileOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
            className="lg:hidden inline-flex items-center justify-center w-8 h-8 rounded-[7px] bg-[#171A21] border border-white/[0.12] text-[#FACC15] hover:border-[#FACC15]/60 active:scale-95 transition-all shrink-0"
          >
            {isMobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 overflow-hidden text-[11.5px] sm:text-xs px-2.5 sm:px-3.5 h-[30px] sm:h-8 rounded-[7px] sm:rounded-full max-lg:bg-[#171A21] max-lg:border max-lg:border-[#FACC15]/35 lg:bg-[#171A21]/92 lg:border lg:border-white/[0.1] lg:backdrop-blur-md">
            <span className="lg:hidden font-extrabold text-[#FACC15] tracking-tight truncate">
              SIM-PPATS
            </span>
            <span className="hidden lg:inline text-[#FACC15] font-bold truncate max-w-[180px]">
              {settings.nama_kecamatan}
            </span>
            <span className="hidden lg:inline text-white/25">/</span>
            <span className="hidden lg:inline font-semibold text-[#F8FAFC] truncate">
              {sectionLabel}
            </span>
          </div>
        </div>

        {/* Right: Cohesive Dark Slate PWA, Uniform 32px Utility Icons, Slim Warm Yellow Login */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <PWAInstallButton variant="header-download" />

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
              className="inline-flex items-center justify-center gap-1.5 w-8 h-8 sm:w-auto sm:h-8 px-0 sm:px-3 rounded-[7px] sm:rounded-full bg-[#171A21] border border-white/[0.12] hover:border-[#FACC15]/50 text-[#F8FAFC] hover:text-[#FACC15] text-xs font-semibold transition-all whitespace-nowrap"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#FACC15] shrink-0" />
              <span className="hidden sm:inline">Utilitas</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 hidden sm:inline" />
            </button>

            {/* Keep mounted while hidden so PWAInstallButton modals stay open cleanly */}
            <div
              role="menu"
              aria-label="Utilitas Kantor"
              className={`${
                utilityOpen ? 'block' : 'hidden'
              } absolute right-0 mt-2 w-56 rounded-xl bg-[#171A21]/98 border border-white/[0.12] shadow-[0_14px_32px_rgba(0,0,0,0.72)] p-1.5 z-50`}
            >
              <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#FACC15]">
                Data &amp; Aplikasi
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setUtilityOpen(false);
                  onExportBackup();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-semibold text-[#F8FAFC] hover:bg-white/[0.08] hover:text-[#FACC15] rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-[#FACC15] shrink-0" />
                <span>Export Backup (.JSON)</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setUtilityOpen(false);
                  restoreInputRef.current?.click();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-semibold text-[#F8FAFC] hover:bg-white/[0.08] hover:text-[#FACC15] rounded-lg transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                <span>Restore Backup (.JSON)</span>
              </button>
              <div className="my-1 border-t border-white/[0.08]" />
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

          {/* Uniform 32x32 Dark / Light Mode Toggle */}
          <button
            type="button"
            onClick={() => onSetTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={
              theme === 'dark' ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Malam'
            }
            title={theme === 'dark' ? 'Mode Terang' : 'Mode Malam'}
            className="inline-flex items-center justify-center w-8 h-8 rounded-[7px] sm:rounded-full bg-[#171A21] border border-white/[0.12] hover:border-[#FACC15]/50 text-[#FACC15] transition-all shrink-0"
          >
            {theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5 text-[#FACC15]" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-[#FACC15]" />
            )}
          </button>

          {/* Slim Warm Manga Yellow Login Button (height: 30px; padding: 0 12px; font-size: 12px) */}
          {!authUser ? (
            <button
              type="button"
              onClick={onSignIn}
              disabled={authBusy}
              className="btn-gold-metallic inline-flex items-center gap-1.5 h-[30px] sm:h-8 px-3 sm:px-3.5 text-[12px] tracking-tight whitespace-nowrap disabled:opacity-60"
            >
              <LogIn className="w-3.5 h-3.5 text-[#0E1014] stroke-[2.4] shrink-0" />
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
                className="btn-gold-metallic inline-flex items-center gap-1.5 h-[30px] sm:h-8 px-2 pr-2.5 text-[12px] whitespace-nowrap"
              >
                <span className="relative inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#0E1014] text-[#FACC15] text-[10px] font-extrabold shrink-0">
                  {userInitial}
                  <span
                    aria-hidden="true"
                    className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-[#FACC15] ${
                      cloudSession.status === 'connected'
                        ? 'bg-emerald-400'
                        : 'bg-[#EF4444]'
                    }`}
                  />
                </span>
                <span className="hidden md:inline max-w-[110px] truncate text-[#0E1014] font-extrabold">
                  {authUser.displayName || authUser.email}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[#0E1014] shrink-0" />
              </button>

              {accountOpen && (
                <div
                  role="menu"
                  aria-label="Menu Akun Cloud"
                  className="absolute right-0 mt-2 w-64 rounded-xl bg-[#171A21]/98 border border-white/[0.12] shadow-[0_14px_32px_rgba(0,0,0,0.75)] p-2 z-50 space-y-1.5"
                >
                  <div className="px-2.5 py-1.5 border-b border-white/[0.08]">
                    <p className="text-xs font-bold text-[#FACC15] truncate">
                      {authUser.displayName || authUser.email}
                    </p>
                    <p className="text-[11px] text-[#94A3B8] truncate">
                      {authUser.email}
                    </p>
                    <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-200">
                      <Cloud
                        className={`w-3.5 h-3.5 shrink-0 ${
                          cloudSession.status === 'connected'
                            ? 'text-emerald-300'
                            : 'text-[#FACC15]'
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
                      className="w-full flex items-center gap-2 px-2.5 py-2 text-left text-xs font-semibold text-[#F8FAFC] hover:bg-white/[0.08] hover:text-[#FACC15] rounded-lg transition-colors disabled:opacity-60"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 text-sky-300 ${reloadingCloud ? 'animate-spin' : ''}`}
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
                      className="w-full flex items-center gap-2 px-2.5 py-2 text-left text-xs font-semibold text-[#F8FAFC] hover:bg-white/[0.08] hover:text-[#FACC15] rounded-lg transition-colors"
                    >
                      <Settings className="w-3.5 h-3.5 text-[#FACC15]" />
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
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-left text-xs font-semibold text-[#EF4444] hover:bg-[#EF4444]/15 rounded-lg transition-colors disabled:opacity-60"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Keluar Akun</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

interface MobileBottomNavProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  onOpenDrawer: () => void;
  isDrawerOpen: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeSection,
  onSelectSection,
  onOpenDrawer,
  isDrawerOpen,
}) => {
  const isMoreActive =
    isDrawerOpen ||
    activeSection === 'report' ||
    activeSection === 'non_akta_rekap' ||
    activeSection === 'settings';

  return (
    <nav
      aria-label="Navigasi Cepat Mobile SIM-PPATS"
      className="no-print lg:hidden fixed bottom-0 inset-x-0 z-30 bg-[#0A0A0A]/98 backdrop-blur-md border-t border-[#FACC15]/70 pb-safe shadow-[0_-6px_20px_rgba(0,0,0,0.55)]"
    >
      <div className="grid grid-cols-5 items-stretch h-[58px] px-1">
        {/* 1. Beranda — Sakamoto's Store Awning Storefront */}
        <button
          type="button"
          onClick={() => onSelectSection('dashboard')}
          aria-current={activeSection === 'dashboard' ? 'page' : undefined}
          className={`relative flex flex-col items-center justify-center gap-0.5 transition-colors ${
            activeSection === 'dashboard'
              ? 'text-[#FACC15]'
              : 'text-[#94A3B8] hover:text-[#FACC15]'
          }`}
        >
          {activeSection === 'dashboard' && (
            <span
              aria-hidden="true"
              className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-7 rounded-b-[4px] bg-[#FACC15]"
            />
          )}
          <SakamotoStoreIcon className="w-5 h-5 shrink-0" />
          <span className="text-[10px] font-semibold tracking-tight whitespace-nowrap">
            Beranda
          </span>
        </button>

        {/* 2. Pajak — Konbini Barcode Receipt */}
        <button
          type="button"
          onClick={() => onSelectSection('tax')}
          aria-current={activeSection === 'tax' ? 'page' : undefined}
          className={`relative flex flex-col items-center justify-center gap-0.5 transition-colors ${
            activeSection === 'tax'
              ? 'text-[#FACC15]'
              : 'text-[#94A3B8] hover:text-[#FACC15]'
          }`}
        >
          {activeSection === 'tax' && (
            <span
              aria-hidden="true"
              className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-7 rounded-b-[4px] bg-[#FACC15]"
            />
          )}
          <KonbiniReceiptIcon className="w-5 h-5 shrink-0" />
          <span className="text-[10px] font-semibold tracking-tight whitespace-nowrap">
            Pajak
          </span>
        </button>

        {/* 3. Berkas (+) — Floating Crimson Target Crosshair Circle (46px, -20px lift) */}
        <button
          type="button"
          onClick={() => onSelectSection('wizard')}
          aria-current={activeSection === 'wizard' ? 'page' : undefined}
          className="flex flex-col items-center justify-center"
        >
          <span className="inline-flex items-center justify-center w-[46px] h-[46px] -mt-[20px] rounded-full bg-[#EF4444] text-white border-[1.5px] border-[#FACC15] shadow-[0_4px_16px_rgba(239,68,68,0.48)] transition-transform active:scale-95">
            <CrosshairPlusIcon className="w-5 h-5 shrink-0" />
          </span>
          <span
            className={`text-[10px] font-bold tracking-tight mt-0.5 whitespace-nowrap ${
              activeSection === 'wizard' ? 'text-[#FACC15]' : 'text-[#F8FAFC]'
            }`}
          >
            Berkas
          </span>
        </button>

        {/* 4. Register — Mugshot Board / Dossier Archive */}
        <button
          type="button"
          onClick={() => onSelectSection('register')}
          aria-current={activeSection === 'register' ? 'page' : undefined}
          className={`relative flex flex-col items-center justify-center gap-0.5 transition-colors ${
            activeSection === 'register'
              ? 'text-[#FACC15]'
              : 'text-[#94A3B8] hover:text-[#FACC15]'
          }`}
        >
          {activeSection === 'register' && (
            <span
              aria-hidden="true"
              className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-7 rounded-b-[4px] bg-[#FACC15]"
            />
          )}
          <DossierMugshotIcon className="w-5 h-5 shrink-0" />
          <span className="text-[10px] font-semibold tracking-tight whitespace-nowrap">
            Register
          </span>
        </button>

        {/* 5. Lainnya — Slim Minimalist 3-Line Menu */}
        <button
          type="button"
          onClick={onOpenDrawer}
          aria-expanded={isDrawerOpen}
          aria-label="Buka menu lainnya"
          className={`relative flex flex-col items-center justify-center gap-0.5 transition-colors ${
            isMoreActive
              ? 'text-[#FACC15]'
              : 'text-[#94A3B8] hover:text-[#FACC15]'
          }`}
        >
          {isMoreActive && (
            <span
              aria-hidden="true"
              className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-7 rounded-b-[4px] bg-[#FACC15]"
            />
          )}
          <SlimMenuIcon className="w-5 h-5 shrink-0" />
          <span className="text-[10px] font-semibold tracking-tight whitespace-nowrap">
            Lainnya
          </span>
        </button>
      </div>
    </nav>
  );
};
