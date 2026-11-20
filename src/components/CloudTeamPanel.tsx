import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Cloud,
  CloudOff,
  LogIn,
  LogOut,
  RefreshCw,
  UploadCloud,
  UserPlus,
  Users,
  Trash2,
  ShieldCheck,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  type CloudSessionInfo,
  type OfficeInviteInfo,
  type OfficeMemberInfo,
  type OfficeRole,
} from '../utils/cloudSync';

export interface CloudTeamPanelProps {
  user: User | null;
  session: CloudSessionInfo;
  authBusy: boolean;
  reloadingCloud: boolean;
  syncingLocal: boolean;
  members: OfficeMemberInfo[];
  invites: OfficeInviteInfo[];
  onSignIn: () => void;
  onSignOut: () => void;
  onRetryAccess: () => void;
  onReloadCloud: () => void;
  onSyncLocalToCloud: () => void;
  onInviteStaff: (email: string, displayLabel: string, role: OfficeRole) => Promise<void>;
  onRevokeAccess: (email: string, memberUid?: string) => Promise<void>;
}

export const CloudTeamPanel: React.FC<CloudTeamPanelProps> = ({
  user,
  session,
  authBusy,
  reloadingCloud,
  syncingLocal,
  members,
  invites,
  onSignIn,
  onSignOut,
  onRetryAccess,
  onReloadCloud,
  onSyncLocalToCloud,
  onInviteStaff,
  onRevokeAccess,
}) => {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLabel, setInviteLabel] = useState('');
  const [inviteRole, setInviteRole] = useState<OfficeRole>('petugas');
  const [inviting, setInviting] = useState(false);
  const [revokingEmail, setRevokingEmail] = useState<string | null>(null);

  const isAdmin = session.status === 'connected' && session.role === 'admin';

  // Gabungkan member aktif dan undangan tertunda per email
  const combinedTeam = React.useMemo(() => {
    const byEmail = new Map<
      string,
      {
        email: string;
        displayName: string;
        role: OfficeRole;
        memberUid?: string;
        joined: boolean;
      }
    >();

    for (const inv of invites) {
      const em = inv.emailLower.toLowerCase();
      byEmail.set(em, {
        email: em,
        displayName: inv.displayLabel || em,
        role: inv.role,
        joined: false,
      });
    }
    for (const m of members) {
      const em = m.email.toLowerCase();
      byEmail.set(em, {
        email: em,
        displayName: m.displayName || byEmail.get(em)?.displayName || em,
        role: m.role,
        memberUid: m.uid,
        joined: true,
      });
    }
    return Array.from(byEmail.values()).sort((a, b) => {
      if (a.email === BOOTSTRAPPED_ADMIN_EMAIL) return -1;
      if (b.email === BOOTSTRAPPED_ADMIN_EMAIL) return 1;
      if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
      return a.email.localeCompare(b.email);
    });
  }, [members, invites]);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await onInviteStaff(inviteEmail.trim(), inviteLabel.trim(), inviteRole);
      setInviteEmail('');
      setInviteLabel('');
      setInviteRole('petugas');
    } finally {
      setInviting(false);
    }
  };

  const handleRevoke = async (email: string, memberUid?: string) => {
    setRevokingEmail(email);
    try {
      await onRevokeAccess(email, memberUid);
    } finally {
      setRevokingEmail(null);
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-start gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
              session.status === 'connected'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-slate-100 border-slate-200 text-slate-600'
            }`}
          >
            {session.status === 'connected' ? (
              <Cloud className="w-4.5 h-4.5" />
            ) : (
              <CloudOff className="w-4.5 h-4.5" />
            )}
          </div>
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Sinkronisasi Cloud & Akses Tim Kantor Bersama
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Masuk dengan akun Google agar berkas akta, rekap non-akta, profil kantor, saksi/kuasa, dan template otomatis tersinkron lintas perangkat dan dapat diakses bersama staf kantor.
            </p>
          </div>
        </div>

        {!user ? (
          <button
            type="button"
            onClick={onSignIn}
            disabled={authBusy}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition-colors whitespace-nowrap disabled:opacity-60"
          >
            {authBusy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            <span>Masuk dengan Google</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onSignOut}
            disabled={authBusy}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar Akun</span>
          </button>
        )}
      </div>

      {!user && (
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5">
          <p className="font-semibold text-slate-800">Mode Penyimpanan Lokal Perangkat Aktif</p>
          <p>
            Saat belum login, data hanya tersimpan di browser perangkat ini. Klik{' '}
            <strong>Masuk dengan Google</strong> untuk mengaktifkan sinkronisasi real-time antar HP, laptop, dan komputer kantor.
          </p>
        </div>
      )}

      {user && session.status === 'connecting' && (
        <div className="flex items-center gap-2.5 p-4 rounded-lg bg-sky-50 border border-sky-200 text-xs text-sky-900">
          <Loader2 className="w-4 h-4 animate-spin text-sky-600 shrink-0" />
          <span>Menghubungkan akun {user.email} ke ruang kerja cloud kantor PPATS...</span>
        </div>
      )}

      {user && session.status === 'uninvited' && (
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">
                Akun {user.email} belum terdaftar pada Akses Tim Kantor PPATS
              </p>
              <p className="text-amber-800 leading-relaxed">
                Agar dapat mengakses dan mengedit buku register bersama, minta Admin Kantor (
                <span className="font-mono">{BOOTSTRAPPED_ADMIN_EMAIL}</span>) menambahkan alamat
                email Anda di bagian <strong>Akses Tim Kantor</strong>, lalu klik tombol cek ulang di bawah.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRetryAccess}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Cek Akses Lagi</span>
            </button>
          </div>
        </div>
      )}

      {user && session.status === 'connected' && (
        <div className="space-y-5">
          {/* Active Cloud Account Bar */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-3 min-w-0">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Akun Google'}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-full border border-slate-200 shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-sky-600 text-white flex items-center justify-center font-semibold text-sm shrink-0">
                  {(user.displayName || user.email || 'U').slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-900 truncate">
                    {user.displayName || user.email}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-100 text-sky-800 text-[11px] font-semibold">
                    <ShieldCheck className="w-3 h-3" />
                    {session.role === 'admin' ? 'Admin Kantor' : 'Petugas Loket'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {user.email} · Ruang Kerja: <strong className="text-slate-700">{session.officeName}</strong>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onReloadCloud}
                disabled={reloadingCloud}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-800 transition-colors disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${reloadingCloud ? 'animate-spin' : ''}`} />
                <span>{reloadingCloud ? 'Memuat...' : 'Reload dari Cloud'}</span>
              </button>
              <button
                type="button"
                onClick={onSyncLocalToCloud}
                disabled={syncingLocal}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-semibold transition-colors disabled:opacity-60"
              >
                {syncingLocal ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <UploadCloud className="w-3.5 h-3.5" />
                )}
                <span>{syncingLocal ? 'Mengunggah...' : 'Unggah Data Lokal ke Cloud'}</span>
              </button>
            </div>
          </div>

          {/* Admin Team Access Management */}
          {isAdmin ? (
            <div className="space-y-4 pt-1">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-700" />
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Akses Tim Kantor Bersama ({combinedTeam.length}/30 akun)
                </h3>
              </div>
              <p className="text-xs text-slate-500 -mt-2">
                Tambahkan alamat email Google staf kantor agar mereka dapat login dari HP atau komputer masing-masing dan mengakses buku register yang sama secara real-time.
              </p>

              <form onSubmit={handleAddStaff} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <input
                  type="email"
                  required
                  placeholder="Email Google staf (contoh: petugas@gmail.com)"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="sm:col-span-5 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <input
                  type="text"
                  placeholder="Nama / Jabatan (opsional)"
                  value={inviteLabel}
                  onChange={(e) => setInviteLabel(e.target.value)}
                  className="sm:col-span-3 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <select
                  aria-label="Peran anggota tim"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as OfficeRole)}
                  className="sm:col-span-2 px-2.5 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="petugas">Petugas</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail.trim()}
                  className="sm:col-span-2 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold transition-colors disabled:opacity-60 whitespace-nowrap"
                >
                  {inviting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="w-3.5 h-3.5" />
                  )}
                  <span>Tambah</span>
                </button>
              </form>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="divide-y divide-slate-200">
                  {combinedTeam.map((member) => {
                    const isPrimaryOwner = member.email === BOOTSTRAPPED_ADMIN_EMAIL;
                    return (
                      <div
                        key={member.email}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3.5 py-2.5 text-xs bg-white"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900 truncate">
                              {member.displayName}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                member.role === 'admin'
                                  ? 'bg-slate-900 text-white'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {member.role === 'admin' ? 'Admin' : 'Petugas'}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                member.joined
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {member.joined ? 'Aktif' : 'Menunggu Login'}
                            </span>
                          </div>
                          <p className="text-slate-500 font-mono text-[11px] truncate mt-0.5">
                            {member.email}
                          </p>
                        </div>

                        {!isPrimaryOwner && (
                          <button
                            type="button"
                            onClick={() => void handleRevoke(member.email, member.memberUid)}
                            disabled={revokingEmail === member.email}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium text-[11px] self-start sm:self-center disabled:opacity-60"
                          >
                            {revokingEmail === member.email ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                            <span>Cabut Akses</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-lg bg-sky-50/70 border border-sky-200 text-xs text-sky-900">
              Anda masuk sebagai <strong>Petugas Loket</strong>. Seluruh berkas register akta & rekap non-akta kantor tersinkron otomatis. Pengaturan profil kantor, template Word, berkas berstatus <em>5. Selesai</em>, dan daftar tim dikelola oleh Admin Kantor.
            </div>
          )}
        </div>
      )}
    </section>
  );
};
