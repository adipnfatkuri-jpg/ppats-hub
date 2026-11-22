import React from 'react';
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
} from 'lucide-react';
import { OfficeSettings } from '../types/ppats';
import type { CloudSessionInfo } from '../utils/cloudSync';
import type { AppTheme } from '../hooks/useTheme';
import { PWAInstallButton } from './PWAInstallButton';
import { GlossyIcon3D } from './TactileUI';

export type NavSection =
  | 'dashboard'
  | 'wizard'
  | 'tax'
  | 'register'
  | 'report'
  | 'non_akta_rekap'
  | 'settings';

interface SidebarProps {
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
  const restoreInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleRestoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onRestoreBackup(file);
      e.target.value = '';
    }
  };

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="no-print lg:hidden flex items-center justify-between bg-gradient-to-r from-[#0F3D3E] via-[#124E52] to-[#0D3338] text-white px-4 py-3 border-b border-teal-400/15 shadow-lg sticky top-0 z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          <GlossyIcon3D tone="teal" size="xs">
            <Scale className="w-4 h-4 text-amber-200" />
          </GlossyIcon3D>
          <span className="font-display font-bold text-base tracking-tight whitespace-nowrap text-white">
            SIM-PPATS
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <PWAInstallButton variant="mobile-header" />
          <button
            type="button"
            onClick={() => onSetTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={
              theme === 'dark' ? 'Ganti ke Mode Segar (Light)' : 'Ganti ke Mode Malam (Dark Teal)'
            }
            className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-teal-100 transition-colors"
            title={theme === 'dark' ? 'Mode Segar' : 'Mode Malam'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-teal-200" />}
          </button>
          {!authUser ? (
            <button
              type="button"
              onClick={onSignIn}
              disabled={authBusy}
              className="btn-3d btn-3d-sky inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Login</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSelectSection('settings')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-teal-950/60 border border-teal-400/20 text-emerald-300 text-xs font-medium"
              title={authUser.email || 'Akun Cloud'}
            >
              <Cloud className="w-3.5 h-3.5" />
              <span className="max-w-[90px] truncate">
                {cloudSession.status === 'connected' ? 'Cloud' : 'Akun'}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={onToggleMobile}
            aria-label={isMobileOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
            className="p-2 rounded-xl text-teal-100 hover:text-white hover:bg-white/10 transition-colors"
          >
            {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Backdrop for mobile drawer */}
      {isMobileOpen && (
        <div
          className="no-print fixed inset-0 bg-[#041416]/60 backdrop-blur-[2px] z-30 lg:hidden"
          onClick={onToggleMobile}
          aria-hidden="true"
        />
      )}

      {/* Left Navigation Sidebar — Deep Ocean Teal */}
      <aside
        aria-label="Navigasi Utama SIM-PPATS"
        className={`no-print fixed lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto inset-y-0 left-0 z-40 w-64 shrink-0 bg-gradient-to-b from-[#0F3D3E] via-[#124E52] to-[#0D3338] text-teal-50 flex flex-col border-r border-teal-300/15 shadow-[8px_0_30px_-10px_rgba(7,35,38,0.45)] transition-transform duration-150 ${
          isMobileOpen
            ? 'translate-x-0 visible'
            : '-translate-x-full invisible lg:visible lg:translate-x-0'
        }`}
      >
        {/* Office Brand Header */}
        <div className="px-4 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <GlossyIcon3D tone="teal" size="sm">
              <Scale className="w-5 h-5 text-amber-200" />
            </GlossyIcon3D>
            <div className="min-w-0">
              <div className="font-display font-bold text-base tracking-tight text-white truncate">
                SIM-PPATS
              </div>
              <p className="text-xs text-teal-200/80 truncate">
                {settings.nama_kecamatan}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
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
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-semibold transition-all duration-150 text-left whitespace-nowrap ${
                  isActive
                    ? 'rounded-full bg-gradient-to-r from-[#14B8A6] to-[#10B981] text-white border-b-[3px] border-[#0B7A6F] shadow-[inset_0_1px_2px_rgba(255,255,255,0.45),0_8px_22px_-4px_rgba(20,184,166,0.65)] -translate-y-0.5'
                    : 'rounded-xl text-teal-100/85 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-white' : 'text-teal-300/80'
                  }`}
                />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Cloud Account, Theme Switcher & Backup Quick Actions */}
        <div className="p-4 border-t border-white/10 space-y-3 bg-[#0A2B2E]/45">
          <PWAInstallButton variant="sidebar" />

          {!authUser ? (
            <button
              type="button"
              onClick={onSignIn}
              disabled={authBusy}
              className="btn-3d btn-3d-sky w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold disabled:opacity-60"
            >
              <LogIn className="w-3.5 h-3.5 shrink-0" />
              <span>{authBusy ? 'Menghubungkan...' : 'Login Google (Cloud)'}</span>
            </button>
          ) : (
            <div className="rounded-2xl bg-[#09282B]/80 border border-teal-400/20 p-2.5 space-y-2 shadow-inner">
              <div className="flex items-center gap-2 min-w-0">
                <Cloud
                  className={`w-3.5 h-3.5 shrink-0 ${
                    cloudSession.status === 'connected'
                      ? 'text-emerald-300'
                      : 'text-amber-300'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white truncate">
                    {authUser.displayName || authUser.email}
                  </p>
                  <p className="text-[11px] text-teal-200/75 truncate">
                    {cloudSession.status === 'connected'
                      ? cloudSession.role === 'admin'
                        ? 'Cloud Bersama · Admin'
                        : 'Cloud Bersama · Petugas'
                      : cloudSession.status === 'connecting'
                        ? 'Menyambungkan Cloud...'
                        : 'Belum masuk tim kantor'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {cloudSession.status === 'connected' ? (
                  <button
                    type="button"
                    onClick={onReloadCloud}
                    disabled={reloadingCloud}
                    className="btn-3d btn-3d-sidebar flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold disabled:opacity-60"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${reloadingCloud ? 'animate-spin' : ''}`}
                    />
                    <span>Reload</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectSection('settings');
                      if (isMobileOpen) onToggleMobile();
                    }}
                    className="btn-3d btn-3d-sidebar flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold"
                  >
                    <span>Detail</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onSignOut}
                  disabled={authBusy}
                  className="btn-3d btn-3d-sidebar flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold hover:text-rose-200"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Keluar</span>
                </button>
              </div>
            </div>
          )}

          {/* Office Identity */}
          <div className="text-xs text-teal-200/80 space-y-0.5 px-0.5">
            <p className="font-semibold text-white truncate">
              {settings.nama_ppats}
            </p>
            <p className="truncate">{settings.nama_kabupaten}</p>
          </div>

          {/* Tactile 3D Backup / Restore */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onExportBackup}
              className="btn-3d btn-3d-sidebar flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 shrink-0 text-teal-300" />
              <span>Backup</span>
            </button>
            <button
              type="button"
              onClick={() => restoreInputRef.current?.click()}
              className="btn-3d btn-3d-sidebar flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5 shrink-0 text-sky-300" />
              <span>Restore</span>
            </button>
            <input
              ref={restoreInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleRestoreChange}
              className="hidden"
              aria-label="Pilih file backup JSON"
            />
          </div>

          {/* Theme Switcher: Mode Segar (Light) & Mode Malam (Dark Teal) */}
          <div
            role="group"
            aria-label="Pilih Tema Tampilan"
            className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#072225]/90 border border-teal-400/20 shadow-inner"
          >
            <button
              type="button"
              onClick={() => onSetTheme('light')}
              aria-pressed={theme === 'light'}
              className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150 whitespace-nowrap ${
                theme === 'light'
                  ? 'bg-gradient-to-b from-teal-400 to-teal-500 text-slate-950 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_4px_10px_-2px_rgba(20,184,166,0.6)]'
                  : 'text-teal-200/80 hover:text-white'
              }`}
            >
              <Sun className="w-3.5 h-3.5 shrink-0" />
              <span>Mode Segar</span>
            </button>
            <button
              type="button"
              onClick={() => onSetTheme('dark')}
              aria-pressed={theme === 'dark'}
              className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150 whitespace-nowrap ${
                theme === 'dark'
                  ? 'bg-gradient-to-b from-teal-500 to-teal-600 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_4px_10px_-2px_rgba(20,184,166,0.5)]'
                  : 'text-teal-200/80 hover:text-white'
              }`}
            >
              <Moon className="w-3.5 h-3.5 shrink-0" />
              <span>Mode Malam</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
