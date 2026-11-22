import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  BerkasRecord,
  CustomTemplateEntry,
  OfficeSettings,
  TemplateDocKey,
} from '../types/ppats';
import { DEFAULT_OFFICE_SETTINGS } from './seedData';
import { normalizeBerkasStatus } from './dashboardHelpers';
import { loadCustomTemplates, loadRecords, loadSettings } from './storage';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  DEFAULT_OFFICE_ID,
  MAX_ALLOWED_EMAILS,
  MAX_TEMPLATE_BASE64_LEN,
  clampString,
  emailToInviteId,
  isBootstrappedAdminEmail,
  sanitizeAllowedEmails,
  sanitizeFirestoreId,
  stripUndefinedDeep,
} from './cloudSyncHelpers';

export {
  BOOTSTRAPPED_ADMIN_EMAIL,
  DEFAULT_OFFICE_ID,
  MAX_ALLOWED_EMAILS,
  MAX_TEMPLATE_BASE64_LEN,
  clampString,
  emailToInviteId,
  isBootstrappedAdminEmail,
  sanitizeAllowedEmails,
  sanitizeFirestoreId,
  stripUndefinedDeep,
};

export type OfficeRole = 'admin' | 'petugas';
export type CloudSyncState = 'signed_out' | 'connecting' | 'connected' | 'uninvited';

export interface OfficeMemberInfo {
  uid: string;
  officeId: string;
  officeOwnerUid: string;
  email: string;
  displayName: string;
  role: OfficeRole;
}

export interface OfficeInviteInfo {
  id: string;
  officeId: string;
  emailLower: string;
  displayLabel: string;
  role: OfficeRole;
  createdByUid: string;
}

export interface CloudSessionInfo {
  status: CloudSyncState;
  officeId: string;
  officeName: string;
  role: OfficeRole | null;
  allowedEmails: string[];
  isBootstrappedAdmin: boolean;
}

export function buildCloudBerkasPayload(
  officeId: string,
  record: BerkasRecord,
  uid: string,
  allowedEmails: string[],
  existingMeta?: { createdByUid?: string; createdAt?: unknown }
): Record<string, unknown> {
  const safeId = sanitizeFirestoreId(record.id, 'reg');
  const base: Record<string, unknown> = {
    id: safeId,
    officeId,
    no_urut: Math.max(0, Math.min(1_000_000, Number(record.no_urut) || 0)),
    kode_berkas: clampString(record.kode_berkas || safeId, 80) || safeId,
    tanggal_masuk: clampString(record.tanggal_masuk || '', 40),
    layanan: record.layanan,
    status: normalizeBerkasStatus(record.status),
    para_pihak: stripUndefinedDeep((record.para_pihak || []).slice(0, 50)),
    tanah: stripUndefinedDeep(record.tanah || {}),
    pbb: stripUndefinedDeep(record.pbb || {}),
    audit_warnings: stripUndefinedDeep((record.audit_warnings || []).slice(0, 50)),
    akta: stripUndefinedDeep(record.akta || {}),
    pajak: stripUndefinedDeep(record.pajak || {}),
    updated_at: clampString(record.updated_at || new Date().toISOString(), 60),
    allowedEmails: sanitizeAllowedEmails(allowedEmails),
    createdByUid: existingMeta?.createdByUid || uid,
    updatedByUid: uid,
    createdAt: existingMeta?.createdAt ?? serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (record.non_akta !== undefined) {
    base.non_akta = stripUndefinedDeep(record.non_akta);
  }
  return base;
}

export function buildCloudOfficeConfigPayload(
  officeId: string,
  settings: OfficeSettings,
  uid: string,
  existingCreatedAt?: unknown
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    officeId,
    nama_kecamatan: clampString(settings.nama_kecamatan || '', 160),
    nama_kabupaten: clampString(settings.nama_kabupaten || '', 160),
    nama_ppats: clampString(settings.nama_ppats || '', 160),
    jabatan_ppats: clampString(settings.jabatan_ppats || '', 160),
    nip_ppats: clampString(settings.nip_ppats || '', 80),
    alamat_kantor: clampString(settings.alamat_kantor || '', 400),
    telepon_kantor: clampString(settings.telepon_kantor || '', 80),
    daftar_saksi: (settings.daftar_saksi || []).slice(0, 50).map((s) => clampString(s, 150)),
    daftar_kuasa_bpn: (settings.daftar_kuasa_bpn || [])
      .slice(0, 50)
      .map((s) => clampString(s, 150)),
    npoptkp_umum: Math.max(0, Math.min(10_000_000_000, Number(settings.npoptkp_umum) || 0)),
    npoptkp_waris: Math.max(0, Math.min(10_000_000_000, Number(settings.npoptkp_waris) || 0)),
    updatedByUid: uid,
    createdAt: existingCreatedAt ?? serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (settings.nama_provinsi !== undefined) {
    payload.nama_provinsi = clampString(settings.nama_provinsi, 120);
  }
  if (settings.sk_ppats_nomor !== undefined) {
    payload.sk_ppats_nomor = clampString(settings.sk_ppats_nomor, 160);
  }
  if (settings.sk_ppats_tanggal !== undefined) {
    payload.sk_ppats_tanggal = clampString(settings.sk_ppats_tanggal, 60);
  }
  if (settings.sk_ppats_penerbit !== undefined) {
    payload.sk_ppats_penerbit = clampString(settings.sk_ppats_penerbit, 200);
  }
  if (Array.isArray(settings.profil_saksi)) {
    payload.profil_saksi = stripUndefinedDeep(settings.profil_saksi.slice(0, 50));
  }
  if (Array.isArray(settings.profil_kuasa)) {
    payload.profil_kuasa = stripUndefinedDeep(settings.profil_kuasa.slice(0, 50));
  }

  return payload;
}

export function buildCloudTemplatePayload(
  officeId: string,
  entry: CustomTemplateEntry,
  uid: string,
  allowedEmails: string[],
  existingCreatedAt?: unknown
): Record<string, unknown> {
  if (!entry.dataBase64 || entry.dataBase64.length > MAX_TEMPLATE_BASE64_LEN) {
    throw new Error(
      'Ukuran file template .docx melebihi batas penyimpanan cloud (maks. ~600 KB). Perkecil ukuran gambar di dalam dokumen Word lalu coba unggah kembali.'
    );
  }

  return {
    key: sanitizeFirestoreId(entry.key, 'tpl'),
    officeId,
    fileName: clampString(entry.fileName || `${entry.key}.docx`, 200),
    updatedAtIso: clampString(entry.updatedAt || new Date().toISOString(), 60),
    dataBase64: entry.dataBase64,
    allowedEmails: sanitizeAllowedEmails(allowedEmails),
    updatedByUid: uid,
    createdAt: existingCreatedAt ?? serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function docDataToBerkasRecord(data: Record<string, unknown>): BerkasRecord {
  return {
    id: String(data.id || ''),
    no_urut: Number(data.no_urut) || 0,
    kode_berkas: String(data.kode_berkas || ''),
    tanggal_masuk: String(data.tanggal_masuk || ''),
    layanan: data.layanan as BerkasRecord['layanan'],
    status: normalizeBerkasStatus(String(data.status ?? '')),
    para_pihak: (Array.isArray(data.para_pihak) ? data.para_pihak : []) as BerkasRecord['para_pihak'],
    tanah: (data.tanah || {}) as BerkasRecord['tanah'],
    pbb: (data.pbb || {}) as BerkasRecord['pbb'],
    audit_warnings: (Array.isArray(data.audit_warnings)
      ? data.audit_warnings
      : []) as BerkasRecord['audit_warnings'],
    akta: (data.akta || {}) as BerkasRecord['akta'],
    pajak: (data.pajak || {}) as BerkasRecord['pajak'],
    non_akta: data.non_akta as BerkasRecord['non_akta'],
    updated_at: String(data.updated_at || ''),
  };
}

function docDataToOfficeSettings(data: Record<string, unknown>): OfficeSettings {
  return {
    ...DEFAULT_OFFICE_SETTINGS,
    nama_kecamatan: String(data.nama_kecamatan ?? DEFAULT_OFFICE_SETTINGS.nama_kecamatan),
    nama_kabupaten: String(data.nama_kabupaten ?? DEFAULT_OFFICE_SETTINGS.nama_kabupaten),
    nama_provinsi:
      typeof data.nama_provinsi === 'string'
        ? data.nama_provinsi
        : DEFAULT_OFFICE_SETTINGS.nama_provinsi,
    nama_ppats: String(data.nama_ppats ?? DEFAULT_OFFICE_SETTINGS.nama_ppats),
    jabatan_ppats: String(data.jabatan_ppats ?? DEFAULT_OFFICE_SETTINGS.jabatan_ppats),
    nip_ppats: String(data.nip_ppats ?? DEFAULT_OFFICE_SETTINGS.nip_ppats),
    sk_ppats_nomor:
      typeof data.sk_ppats_nomor === 'string'
        ? data.sk_ppats_nomor
        : DEFAULT_OFFICE_SETTINGS.sk_ppats_nomor,
    sk_ppats_tanggal:
      typeof data.sk_ppats_tanggal === 'string'
        ? data.sk_ppats_tanggal
        : DEFAULT_OFFICE_SETTINGS.sk_ppats_tanggal,
    sk_ppats_penerbit:
      typeof data.sk_ppats_penerbit === 'string'
        ? data.sk_ppats_penerbit
        : DEFAULT_OFFICE_SETTINGS.sk_ppats_penerbit,
    alamat_kantor: String(data.alamat_kantor ?? DEFAULT_OFFICE_SETTINGS.alamat_kantor),
    telepon_kantor: String(data.telepon_kantor ?? DEFAULT_OFFICE_SETTINGS.telepon_kantor),
    daftar_saksi: Array.isArray(data.daftar_saksi)
      ? (data.daftar_saksi as string[])
      : DEFAULT_OFFICE_SETTINGS.daftar_saksi,
    daftar_kuasa_bpn: Array.isArray(data.daftar_kuasa_bpn)
      ? (data.daftar_kuasa_bpn as string[])
      : DEFAULT_OFFICE_SETTINGS.daftar_kuasa_bpn,
    profil_saksi: Array.isArray(data.profil_saksi)
      ? (data.profil_saksi as OfficeSettings['profil_saksi'])
      : DEFAULT_OFFICE_SETTINGS.profil_saksi,
    profil_kuasa: Array.isArray(data.profil_kuasa)
      ? (data.profil_kuasa as OfficeSettings['profil_kuasa'])
      : DEFAULT_OFFICE_SETTINGS.profil_kuasa,
    npoptkp_umum: Number(data.npoptkp_umum ?? DEFAULT_OFFICE_SETTINGS.npoptkp_umum),
    npoptkp_waris: Number(data.npoptkp_waris ?? DEFAULT_OFFICE_SETTINGS.npoptkp_waris),
  };
}

/**
 * Mendaftarkan/memperbarui profil privat pengguna di /users/{uid}
 * serta memverifikasi atau menginisialisasi akses ruang kerja bersama kantor PPATS.
 */
export async function resolveOfficeSession(
  user: User,
  localSettings: OfficeSettings
): Promise<CloudSessionInfo> {
  const emailLower = (user.email || '').trim().toLowerCase();
  const isBootAdmin = isBootstrappedAdminEmail(emailLower);
  const officeId = DEFAULT_OFFICE_ID;

  // 1. Upsert user private profile
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  try {
    const existingUser = await getDoc(userRef);
    const profilePayload: Record<string, unknown> = {
      uid: user.uid,
      email: clampString(emailLower || 'unknown@local', 200),
      displayName: clampString(user.displayName || emailLower.split('@')[0] || 'Petugas', 150),
      activeOfficeId: officeId,
      createdAt: existingUser.exists() ? existingUser.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (user.photoURL) {
      profilePayload.photoURL = clampString(user.photoURL, 500);
    }
    if (existingUser.exists()) {
      await updateDoc(userRef, {
        email: profilePayload.email,
        displayName: profilePayload.displayName,
        ...(profilePayload.photoURL ? { photoURL: profilePayload.photoURL } : {}),
        activeOfficeId: officeId,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(userRef, profilePayload);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, userPath);
  }

  const officeRef = doc(db, 'offices', officeId);
  const memberRef = doc(db, 'offices', officeId, 'members', user.uid);

  // 2. Bootstrapped Admin flow: auto-provision shared office workspace if missing
  if (isBootAdmin) {
    try {
      const officeSnap = await getDoc(officeRef);
      let allowedEmails = sanitizeAllowedEmails([emailLower]);
      let officeName = localSettings.nama_kecamatan
        ? `Kantor PPATS ${localSettings.nama_kecamatan}`
        : 'Kantor PPATS Utama';

      if (!officeSnap.exists()) {
        await setDoc(officeRef, {
          id: officeId,
          name: clampString(officeName, 160),
          ownerUid: user.uid,
          ownerEmail: emailLower,
          allowedEmails,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const data = officeSnap.data();
        officeName = String(data.name || officeName);
        allowedEmails = sanitizeAllowedEmails(
          Array.isArray(data.allowedEmails) ? (data.allowedEmails as string[]) : [],
          emailLower
        );
      }

      const memberSnap = await getDoc(memberRef);
      const ownerUid = officeSnap.exists() ? String(officeSnap.data().ownerUid || user.uid) : user.uid;
      if (!memberSnap.exists()) {
        await setDoc(memberRef, {
          uid: user.uid,
          officeId,
          officeOwnerUid: ownerUid,
          email: emailLower,
          displayName: clampString(user.displayName || 'Admin PPATS', 150),
          role: 'admin',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      const configRef = doc(db, 'offices', officeId, 'config', 'office_settings');
      const configSnap = await getDoc(configRef);
      if (!configSnap.exists()) {
        await setDoc(
          configRef,
          buildCloudOfficeConfigPayload(officeId, localSettings, user.uid)
        );
      }

      return {
        status: 'connected',
        officeId,
        officeName,
        role: 'admin',
        allowedEmails,
        isBootstrappedAdmin: true,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `offices/${officeId}`);
    }
  }

  // 3. Regular staff flow: check existing membership first
  try {
    const memberSnap = await getDoc(memberRef);
    if (memberSnap.exists()) {
      const memberData = memberSnap.data();
      const officeSnap = await getDoc(officeRef);
      const officeData = officeSnap.exists() ? officeSnap.data() : {};
      const allowedEmails = sanitizeAllowedEmails(
        Array.isArray(officeData.allowedEmails) ? (officeData.allowedEmails as string[]) : [],
        emailLower
      );
      return {
        status: 'connected',
        officeId,
        officeName: String(officeData.name || 'Kantor PPATS Bersama'),
        role: memberData.role === 'admin' ? 'admin' : 'petugas',
        allowedEmails,
        isBootstrappedAdmin: false,
      };
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `offices/${officeId}/members/${user.uid}`);
  }

  // 4. Check if invited by Admin via /offices/{officeId}/invites/{inviteKey}
  const inviteId = emailToInviteId(emailLower);
  const inviteRef = doc(db, 'offices', officeId, 'invites', inviteId);
  try {
    const inviteSnap = await getDoc(inviteRef);
    if (inviteSnap.exists()) {
      const inviteData = inviteSnap.data();
      const officeSnap = await getDoc(officeRef);
      if (officeSnap.exists()) {
        const officeData = officeSnap.data();
        const invitedRole: OfficeRole = inviteData.role === 'admin' ? 'admin' : 'petugas';
        await setDoc(memberRef, {
          uid: user.uid,
          officeId,
          officeOwnerUid: String(officeData.ownerUid),
          email: emailLower,
          displayName: clampString(user.displayName || inviteData.displayLabel || emailLower, 150),
          role: invitedRole,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        const allowedEmails = sanitizeAllowedEmails(
          Array.isArray(officeData.allowedEmails) ? (officeData.allowedEmails as string[]) : [],
          emailLower
        );
        return {
          status: 'connected',
          officeId,
          officeName: String(officeData.name || 'Kantor PPATS Bersama'),
          role: invitedRole,
          allowedEmails,
          isBootstrappedAdmin: false,
        };
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `offices/${officeId}/invites/${inviteId}`);
  }

  return {
    status: 'uninvited',
    officeId,
    officeName: 'Kantor PPATS Bersama',
    role: null,
    allowedEmails: [],
    isBootstrappedAdmin: false,
  };
}

export function subscribeSharedOfficeData(params: {
  officeId: string;
  userEmail: string;
  isBootstrappedAdmin: boolean;
  onRecords: (records: BerkasRecord[]) => void;
  onSettings: (settings: OfficeSettings) => void;
  onTemplates: (templates: Partial<Record<TemplateDocKey, CustomTemplateEntry>>) => void;
  onAllowedEmailsChange?: (emails: string[]) => void;
  onError: (err: Error) => void;
}): Unsubscribe {
  const { officeId, userEmail, isBootstrappedAdmin } = params;
  const emailLower = userEmail.trim().toLowerCase();
  const unsubs: Unsubscribe[] = [];

  const officePath = `offices/${officeId}`;
  unsubs.push(
    onSnapshot(
      doc(db, 'offices', officeId),
      (snap) => {
        if (snap.exists() && params.onAllowedEmailsChange) {
          const emails = Array.isArray(snap.data().allowedEmails)
            ? (snap.data().allowedEmails as string[])
            : [];
          params.onAllowedEmailsChange(sanitizeAllowedEmails(emails));
        }
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, officePath);
        } catch (e) {
          params.onError(e as Error);
        }
      }
    )
  );

  const berkasPath = `offices/${officeId}/berkas`;
  const berkasRef = collection(db, 'offices', officeId, 'berkas');
  const berkasQuery = isBootstrappedAdmin
    ? berkasRef
    : query(berkasRef, where('allowedEmails', 'array-contains', emailLower));

  unsubs.push(
    onSnapshot(
      berkasQuery,
      (snap) => {
        const list = snap.docs
          .map((d) => docDataToBerkasRecord(d.data() as Record<string, unknown>))
          .sort((a, b) => a.no_urut - b.no_urut);
        params.onRecords(list);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, berkasPath);
        } catch (e) {
          params.onError(e as Error);
        }
      }
    )
  );

  const configPath = `offices/${officeId}/config/office_settings`;
  unsubs.push(
    onSnapshot(
      doc(db, 'offices', officeId, 'config', 'office_settings'),
      (snap) => {
        if (snap.exists()) {
          params.onSettings(docDataToOfficeSettings(snap.data() as Record<string, unknown>));
        }
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, configPath);
        } catch (e) {
          params.onError(e as Error);
        }
      }
    )
  );

  const templatesPath = `offices/${officeId}/templates`;
  const templatesRef = collection(db, 'offices', officeId, 'templates');
  const templatesQuery = isBootstrappedAdmin
    ? templatesRef
    : query(templatesRef, where('allowedEmails', 'array-contains', emailLower));

  unsubs.push(
    onSnapshot(
      templatesQuery,
      (snap) => {
        const map: Partial<Record<TemplateDocKey, CustomTemplateEntry>> = {};
        for (const d of snap.docs) {
          const data = d.data() as Record<string, unknown>;
          const key = String(data.key || d.id) as TemplateDocKey;
          map[key] = {
            key,
            fileName: String(data.fileName || `${key}.docx`),
            updatedAt: String(data.updatedAtIso || ''),
            dataBase64: String(data.dataBase64 || ''),
          };
        }
        params.onTemplates(map);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, templatesPath);
        } catch (e) {
          params.onError(e as Error);
        }
      }
    )
  );

  return () => {
    for (const u of unsubs) u();
  };
}

export function subscribeOfficeTeam(params: {
  officeId: string;
  userUid: string;
  isBootstrappedAdmin: boolean;
  onMembers: (members: OfficeMemberInfo[]) => void;
  onInvites: (invites: OfficeInviteInfo[]) => void;
  onError: (err: Error) => void;
}): Unsubscribe {
  const { officeId, userUid, isBootstrappedAdmin } = params;
  const unsubs: Unsubscribe[] = [];

  const membersPath = `offices/${officeId}/members`;
  const membersCol = collection(db, 'offices', officeId, 'members');
  const membersQ = isBootstrappedAdmin
    ? membersCol
    : query(membersCol, where('officeOwnerUid', '==', userUid));

  unsubs.push(
    onSnapshot(
      membersQ,
      (snap) => {
        const items: OfficeMemberInfo[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            uid: String(data.uid || d.id),
            officeId: String(data.officeId || officeId),
            officeOwnerUid: String(data.officeOwnerUid || ''),
            email: String(data.email || ''),
            displayName: String(data.displayName || ''),
            role: data.role === 'admin' ? 'admin' : 'petugas',
          };
        });
        params.onMembers(items);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, membersPath);
        } catch (e) {
          params.onError(e as Error);
        }
      }
    )
  );

  const invitesPath = `offices/${officeId}/invites`;
  const invitesCol = collection(db, 'offices', officeId, 'invites');
  const invitesQ = isBootstrappedAdmin
    ? invitesCol
    : query(invitesCol, where('createdByUid', '==', userUid));

  unsubs.push(
    onSnapshot(
      invitesQ,
      (snap) => {
        const items: OfficeInviteInfo[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id || d.id),
            officeId: String(data.officeId || officeId),
            emailLower: String(data.emailLower || ''),
            displayLabel: String(data.displayLabel || ''),
            role: data.role === 'admin' ? 'admin' : 'petugas',
            createdByUid: String(data.createdByUid || ''),
          };
        });
        params.onInvites(items);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, invitesPath);
        } catch (e) {
          params.onError(e as Error);
        }
      }
    )
  );

  return () => {
    for (const u of unsubs) u();
  };
}

export async function saveCloudRecord(
  officeId: string,
  record: BerkasRecord,
  user: User,
  allowedEmails: string[]
): Promise<void> {
  const safeId = sanitizeFirestoreId(record.id, 'reg');
  const path = `offices/${officeId}/berkas/${safeId}`;
  const ref = doc(db, 'offices', officeId, 'berkas', safeId);
  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      const existingData = existingSnap.data();
      const payload = buildCloudBerkasPayload(
        officeId,
        { ...record, id: safeId },
        user.uid,
        Array.isArray(existingData.allowedEmails)
          ? (existingData.allowedEmails as string[])
          : allowedEmails,
        {
          createdByUid: String(existingData.createdByUid || user.uid),
          createdAt: existingData.createdAt,
        }
      );
      await setDoc(ref, payload);
    } else {
      // Ensure allowedEmails strictly matches the current office master document
      const officeSnap = await getDoc(doc(db, 'offices', officeId));
      const masterAllowed = officeSnap.exists() && Array.isArray(officeSnap.data().allowedEmails)
        ? (officeSnap.data().allowedEmails as string[])
        : allowedEmails;
      const payload = buildCloudBerkasPayload(
        officeId,
        { ...record, id: safeId },
        user.uid,
        masterAllowed
      );
      await setDoc(ref, payload);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteCloudRecord(officeId: string, recordId: string): Promise<void> {
  const safeId = sanitizeFirestoreId(recordId, 'reg');
  const path = `offices/${officeId}/berkas/${safeId}`;
  try {
    await deleteDoc(doc(db, 'offices', officeId, 'berkas', safeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveCloudSettings(
  officeId: string,
  settings: OfficeSettings,
  user: User
): Promise<void> {
  const path = `offices/${officeId}/config/office_settings`;
  const ref = doc(db, 'offices', officeId, 'config', 'office_settings');
  try {
    const existingSnap = await getDoc(ref);
    const payload = buildCloudOfficeConfigPayload(
      officeId,
      settings,
      user.uid,
      existingSnap.exists() ? existingSnap.data().createdAt : undefined
    );
    await setDoc(ref, payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function saveCloudTemplate(
  officeId: string,
  entry: CustomTemplateEntry,
  user: User,
  allowedEmails: string[]
): Promise<void> {
  const safeKey = sanitizeFirestoreId(entry.key, 'tpl');
  const path = `offices/${officeId}/templates/${safeKey}`;
  const ref = doc(db, 'offices', officeId, 'templates', safeKey);
  try {
    const [existingSnap, officeSnap] = await Promise.all([
      getDoc(ref),
      getDoc(doc(db, 'offices', officeId)),
    ]);
    const masterAllowed =
      officeSnap.exists() && Array.isArray(officeSnap.data().allowedEmails)
        ? (officeSnap.data().allowedEmails as string[])
        : allowedEmails;
    const payload = buildCloudTemplatePayload(
      officeId,
      entry,
      user.uid,
      masterAllowed,
      existingSnap.exists() ? existingSnap.data().createdAt : undefined
    );
    await setDoc(ref, payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteCloudTemplate(
  officeId: string,
  key: TemplateDocKey
): Promise<void> {
  const safeKey = sanitizeFirestoreId(key, 'tpl');
  const path = `offices/${officeId}/templates/${safeKey}`;
  try {
    await deleteDoc(doc(db, 'offices', officeId, 'templates', safeKey));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

async function propagateAllowedEmails(
  officeId: string,
  nextAllowedEmails: string[],
  adminUid: string
): Promise<void> {
  const officeRef = doc(db, 'offices', officeId);
  await updateDoc(officeRef, {
    allowedEmails: nextAllowedEmails,
    updatedAt: serverTimestamp(),
  });

  const [berkasSnap, templatesSnap] = await Promise.all([
    getDocs(collection(db, 'offices', officeId, 'berkas')),
    getDocs(collection(db, 'offices', officeId, 'templates')),
  ]);

  const docsToUpdate = [...berkasSnap.docs, ...templatesSnap.docs];
  const chunkSize = 400;
  for (let i = 0; i < docsToUpdate.length; i += chunkSize) {
    const batch = writeBatch(db);
    for (const d of docsToUpdate.slice(i, i + chunkSize)) {
      batch.update(d.ref, {
        allowedEmails: nextAllowedEmails,
        updatedByUid: adminUid,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }
}

export async function inviteOfficeStaff(params: {
  officeId: string;
  email: string;
  displayLabel: string;
  role: OfficeRole;
  adminUser: User;
}): Promise<string[]> {
  const emailLower = params.email.trim().toLowerCase();
  if (!emailLower || !emailLower.includes('@') || emailLower.length > 200) {
    throw new Error('Masukkan alamat email Google yang valid.');
  }

  const inviteId = emailToInviteId(emailLower);
  const invitePath = `offices/${params.officeId}/invites/${inviteId}`;
  const inviteRef = doc(db, 'offices', params.officeId, 'invites', inviteId);
  const officeRef = doc(db, 'offices', params.officeId);

  try {
    const [existingInvite, officeSnap] = await Promise.all([
      getDoc(inviteRef),
      getDoc(officeRef),
    ]);
    if (!officeSnap.exists()) {
      throw new Error('Ruang kerja kantor cloud belum ditemukan.');
    }

    const existingEmails = Array.isArray(officeSnap.data().allowedEmails)
      ? (officeSnap.data().allowedEmails as string[])
      : [];
    const nextAllowed = sanitizeAllowedEmails([...existingEmails, emailLower]);

    await setDoc(inviteRef, {
      id: inviteId,
      officeId: params.officeId,
      emailLower,
      displayLabel: clampString(params.displayLabel.trim() || emailLower.split('@')[0], 150),
      role: params.role,
      createdByUid: existingInvite.exists()
        ? String(existingInvite.data().createdByUid || params.adminUser.uid)
        : params.adminUser.uid,
      createdAt: existingInvite.exists() ? existingInvite.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await propagateAllowedEmails(params.officeId, nextAllowed, params.adminUser.uid);
    return nextAllowed;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, invitePath);
  }
}

export async function revokeOfficeStaffAccess(params: {
  officeId: string;
  email: string;
  memberUid?: string;
  adminUser: User;
}): Promise<string[]> {
  const emailLower = params.email.trim().toLowerCase();
  if (emailLower === BOOTSTRAPPED_ADMIN_EMAIL) {
    throw new Error('Akses Admin utama kantor tidak dapat dicabut.');
  }

  const officeRef = doc(db, 'offices', params.officeId);
  const inviteId = emailToInviteId(emailLower);

  try {
    const officeSnap = await getDoc(officeRef);
    const existingEmails =
      officeSnap.exists() && Array.isArray(officeSnap.data().allowedEmails)
        ? (officeSnap.data().allowedEmails as string[])
        : [];
    const nextAllowed = sanitizeAllowedEmails(
      existingEmails.filter((e) => e.toLowerCase() !== emailLower)
    );

    if (params.memberUid) {
      await deleteDoc(doc(db, 'offices', params.officeId, 'members', params.memberUid));
    }
    await deleteDoc(doc(db, 'offices', params.officeId, 'invites', inviteId)).catch(() => {});

    await propagateAllowedEmails(params.officeId, nextAllowed, params.adminUser.uid);
    return nextAllowed;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `offices/${params.officeId}/members`);
  }
}

export async function syncLocalBrowserDataToCloud(params: {
  officeId: string;
  user: User;
  role: OfficeRole;
  allowedEmails: string[];
}): Promise<{ recordCount: number; templateCount: number; settingsSynced: boolean }> {
  const [localRecords, localSettings, localTemplatesMap] = await Promise.all([
    loadRecords(),
    loadSettings(),
    loadCustomTemplates(),
  ]);

  let recordCount = 0;
  for (const rec of localRecords) {
    await saveCloudRecord(params.officeId, rec, params.user, params.allowedEmails);
    recordCount += 1;
  }

  let settingsSynced = false;
  let templateCount = 0;
  if (params.role === 'admin') {
    await saveCloudSettings(params.officeId, localSettings, params.user);
    settingsSynced = true;
    for (const tpl of Object.values(localTemplatesMap)) {
      if (tpl && tpl.dataBase64 && tpl.dataBase64.length <= MAX_TEMPLATE_BASE64_LEN) {
        await saveCloudTemplate(params.officeId, tpl, params.user, params.allowedEmails);
        templateCount += 1;
      }
    }
  }

  return { recordCount, templateCount, settingsSynced };
}

export async function reloadCloudSnapshotFromServer(params: {
  officeId: string;
  userEmail: string;
  isBootstrappedAdmin: boolean;
}): Promise<{
  records: BerkasRecord[];
  settings: OfficeSettings | null;
  templates: Partial<Record<TemplateDocKey, CustomTemplateEntry>>;
}> {
  const emailLower = params.userEmail.trim().toLowerCase();
  const berkasRef = collection(db, 'offices', params.officeId, 'berkas');
  const berkasQ = params.isBootstrappedAdmin
    ? berkasRef
    : query(berkasRef, where('allowedEmails', 'array-contains', emailLower));

  const templatesRef = collection(db, 'offices', params.officeId, 'templates');
  const templatesQ = params.isBootstrappedAdmin
    ? templatesRef
    : query(templatesRef, where('allowedEmails', 'array-contains', emailLower));

  try {
    const [berkasSnap, configSnap, templatesSnap] = await Promise.all([
      getDocsFromServer(berkasQ),
      getDocFromServer(doc(db, 'offices', params.officeId, 'config', 'office_settings')),
      getDocsFromServer(templatesQ),
    ]);

    const records = berkasSnap.docs
      .map((d) => docDataToBerkasRecord(d.data() as Record<string, unknown>))
      .sort((a, b) => a.no_urut - b.no_urut);

    const settings = configSnap.exists()
      ? docDataToOfficeSettings(configSnap.data() as Record<string, unknown>)
      : null;

    const templates: Partial<Record<TemplateDocKey, CustomTemplateEntry>> = {};
    for (const d of templatesSnap.docs) {
      const data = d.data() as Record<string, unknown>;
      const key = String(data.key || d.id) as TemplateDocKey;
      templates[key] = {
        key,
        fileName: String(data.fileName || `${key}.docx`),
        updatedAt: String(data.updatedAtIso || ''),
        dataBase64: String(data.dataBase64 || ''),
      };
    }

    return { records, settings, templates };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `offices/${params.officeId}`);
  }
}
